import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./lib/registry-node.mjs";
import { RULES, parseMetrics, verdict, previewEnd } from "./lib/opening-metrics.mjs";
import { load as loadUsage } from "./lib/usage.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = path.join(ROOT, "openings", "library.json");
const PREV_DIR = path.join(ROOT, "openings", "previews");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
// preview 实际落在 openings/previews/<id>-<input hash>.mp4；sync 用同一条规则找回最近一条，
// 不再只看 <id>.mp4（那批是早期手工命名的，后来的预览一直进不了 e.preview）。
const previewsOf = (id) => fs.existsSync(PREV_DIR)
  ? fs.readdirSync(PREV_DIR)
      .filter((f) => f.endsWith(".mp4") && (f === `${id}.mp4` || f.startsWith(`${id}-`)))
      .map((f) => ({ f, t: fs.statSync(path.join(PREV_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .map((x) => `openings/previews/${x.f}`)
  : [];
const load = () => fs.existsSync(LIB) ? read(LIB) : { rules: RULES, openings: [] };
const save = (lib) => { fs.mkdirSync(path.dirname(LIB), { recursive: true }); fs.writeFileSync(LIB, JSON.stringify(lib, null, 2) + "\n"); };
const die = (m) => { console.error(`失败：${m}`); process.exit(1); };
const find = (lib, id) => lib.openings.find((o) => o.id === id) ?? die(`开场库里没有 ${id}，先运行 sync`);
const sources = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => f.isDirectory() ? sources(path.join(dir, f.name)) : /\.tsx?$/.test(f.name) ? [path.join(dir, f.name)] : []);
const [cmd = "list", ...rest] = process.argv.slice(2);
const lib = load();
lib.rules = { ...RULES, ...lib.rules };

try {
  if (cmd === "sync") {
    const reg = await loadRegistry();
    const defs = reg.list.filter((c) => c.layer === "opening");
    const files = sources(path.join(ROOT, "src", "openings")).map((p) => ({ p, text: fs.readFileSync(p, "utf8") }));
    let added = 0;
    for (const c of defs) {
      const abs = files.find((f) => f.text.includes(`"${c.id}"`))?.p;
      const file = abs ? path.relative(ROOT, abs).replace(/\\/g, "/") : null;
      let e = lib.openings.find((o) => o.id === c.id);
      if (!e) { e = { id: c.id, date: file?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? new Date().toISOString().slice(0, 10), status: "trial", usedBy: [], metrics: { plays: null, bounce2s: null, finish5s: null, finish10s: null }, notes: "" }; lib.openings.push(e); added++; }
      Object.assign(e, { name: c.name, file, desc: c.desc, script: c.opening?.script, hook: c.opening?.hook, techniques: c.opening?.techniques ?? [], sec: c.opening?.sec, minSec: c.minSec, maxSec: c.maxSec, template: !!c.opening?.template, draft: !!c.opening?.draft, signature: c.opening?.signature, beats: c.opening?.beats, requiredData: c.opening?.requiredData });
      e.metrics ??= {};
      e.metrics.finish10s ??= null;
      e.usedBy = (e.usedBy ?? []).filter((x) => x !== "template");
      if (e.script && e.script !== "template" && !e.usedBy.includes(e.script)) e.usedBy.push(e.script);
      const prev = previewsOf(c.id)[0];
      if (prev) e.preview = prev;
      else if (e.preview && !fs.existsSync(path.join(ROOT, e.preview))) delete e.preview;
    }
    save(lib);
    console.log(`开场库 ${lib.openings.length} 个，新增 ${added}；草稿 ${defs.filter((c) => c.opening?.draft).length} 个不参与默认选型`);
  } else if (cmd === "list") {
    const recent = loadUsage().videos.slice(-3).filter((v) => v.opening);
    if (recent.length) console.log(`最近开场：${recent.map((v) => `${v.id} → ${v.opening.id} / ${v.opening.sound}`).join("；")}`);
    const all = rest.includes("--all");
    for (const o of lib.openings.filter((o) => all || !o.draft)) {
      const m = o.metrics ?? {}, pct = (v) => v == null ? "—" : `${(v * 100).toFixed(0)}%`;
      console.log(`${o.draft ? "draft" : o.status} ${o.id} [${o.hook}] · ${o.sec ? `推荐${o.sec}s` : `${o.minSec ?? 2}~${o.maxSec ?? 4}s`} · ${o.signature ? `${o.signature.visual}/${o.signature.sound}` : "内嵌视听编排"}`);
      console.log(`  2s跳出 ${pct(m.bounce2s)} / 5s留存 ${pct(m.finish5s)} / 10s留存 ${pct(m.finish10s)} / 播放 ${m.plays ?? "—"} → ${verdict(m, lib.rules)}${o.metricVideo ? `（片：${o.metricVideo}，非模板均值）` : ""}`);
      if (o.requiredData?.length) console.log(`  必填：${o.requiredData.join(", ")}；${o.desc}`);
    }
    if (!all && lib.openings.some((o) => o.draft)) console.log("草稿已隐藏；list --all 查看。示例值不等于本片内容，先填文案和真实素材再预览。");
  } else if (cmd === "metric") {
    const [id, ...args] = rest;
    const e = find(lib, id);
    const parsed = parseMetrics(args);
    if (!parsed.video && e.metricVideo) die(`上次数据属于 ${e.metricVideo}，请显式填写 video=片标识，避免混合不同样本`);
    const previous = parsed.video ? e.samples?.find((s) => s.video === parsed.video)?.metrics ?? {} : e.metrics ?? {};
    const metrics = { ...previous, ...parsed.metrics, updated: new Date().toISOString().slice(0, 10) };
    if (metrics.finish5s != null && metrics.finish10s != null && metrics.finish10s > metrics.finish5s) die("同口径下10秒留存不能高于5秒留存");
    if (parsed.video) { e.samples = [...(e.samples ?? []).filter((s) => s.video !== parsed.video), { video: parsed.video, metrics }]; e.metricVideo = parsed.video; }
    else delete e.metricVideo;
    e.metrics = metrics;
    save(lib);
    console.log(`${id}：${JSON.stringify(metrics)} → ${verdict(metrics, lib.rules)}`);
  } else if (cmd === "status") {
    const [id, status] = rest;
    if (!["trial", "keep", "retired"].includes(status)) die("status只能是trial / keep / retired");
    find(lib, id).status = status; save(lib); console.log(`${id} → ${status}`);
  } else if (cmd === "pending") {
    const asJson = rest.includes("--json");
    const metricKeys = ["plays", "bounce2s", "finish5s", "finish10s"];
    const noMetric = (o) => metricKeys.every((k) => (o.metrics ?? {})[k] == null);
    const drafts = lib.openings.filter((o) => o.draft);
    const bare = lib.openings.filter((o) => !o.draft && noMetric(o));
    const usedNoMetric = bare.filter((o) => (o.usedBy ?? []).length || o.metricVideo || (o.samples ?? []).length);
    const noPreview = lib.openings.filter((o) => !o.draft && !o.preview);
    const missing = (o) => [
      o.hook ? null : "hook",
      o.sec || (o.minSec != null && o.maxSec != null) ? null : "sec 或 minSec/maxSec",
      o.signature ? null : "signature{visual,sound}",
      o.requiredData?.length ? null : "requiredData",
    ].filter(Boolean);
    const report = {
      total: lib.openings.length,
      drafts: drafts.map((o) => ({ id: o.id, missing: missing(o) })),
      noMetrics: bare.map((o) => o.id),
      usedNoMetrics: usedNoMetric.map((o) => ({ id: o.id, usedBy: o.usedBy ?? [] })),
      noPreview: noPreview.map((o) => o.id),
    };
    if (asJson) {
      console.log(JSON.stringify(report, null, 1));
      process.exit(0);
    }
    console.log(`开场待办：${report.drafts.length} 个草稿 · ${report.noMetrics.length} 个没录数据（其中 ${report.usedNoMetrics.length} 个上过片）· ${report.noPreview.length} 个没预览 / 共 ${report.total} 个`);
    if (drafts.length) {
      console.log("\n草稿（不参与默认选型，补齐后才能移除 draft）：");
      for (const d of report.drafts) console.log(`  ${d.id}${d.missing.length ? `  缺：${d.missing.join(", ")}` : "  字段齐了，只差验收/预览"}`);
    }
    if (usedNoMetric.length) {
      console.log("\n上过片但没录数据（优先补，metrics 闭环靠它）：");
      for (const { id, usedBy } of report.usedNoMetrics) console.log(`  ${id}  ← ${usedBy.join("、") || "有 metricVideo/samples"}`);
    }
    if (noPreview.length) {
      const show = report.noPreview.slice(0, 12);
      console.log(`\n没预览的正式开场（${noPreview.length} 个）：${show.join("、")}${noPreview.length > show.length ? ` …还有 ${noPreview.length - show.length} 个` : ""}`);
      console.log("  出预览：node scripts/openings.mjs preview <该片 input.json>（按 input hash 落到 openings/previews/<id>-<hash>.mp4）");
    }
    if (!drafts.length && !bare.length && !noPreview.length) console.log("\n开场库已闭环：草稿、数据、预览都齐 ✓");
  } else if (cmd === "preview") {
    const input = rest[0] && path.resolve(rest[0]);
    if (!input) die("用法：node scripts/openings.mjs preview <input.json>（前10秒，短片自动截到结尾）");
    const plan = spawnSync(process.execPath, [path.join(ROOT, "scripts", "make.mjs"), input, "--plan-only"], { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (plan.stderr) process.stderr.write(plan.stderr);
    if (plan.error || plan.status !== 0) die(plan.error?.message ?? "开场分镜检查未通过，请先修复上方错误");
    const timelinePath = /时间轴：([^\r\n]+)/.exec(plan.stdout)?.[1]?.trim();
    if (!timelinePath) die("make没有返回时间轴路径");
    const timeline = read(timelinePath);
    const reg = await loadRegistry();
    const first = timeline.shots?.[0];
    const id = timeline.opening?.type ?? first?.data?.opening?.type ?? (reg.byId[first?.type]?.layer === "opening" ? first.type : null);
    if (!id) die("第一个镜头没有开场");
    const hash = crypto.createHash("sha256").update(input).digest("hex").slice(0, 12);
    const safeId = id.replace(/[^a-zA-Z0-9-]/g, "-");
    const out = path.join(ROOT, "openings", "previews", `${safeId}-${hash}.mp4`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const { bundle } = await import("@remotion/bundler");
    const { selectComposition, renderMedia } = await import("@remotion/renderer");
    const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
    const inputProps = { timeline }, chromiumOptions = { gl: "angle" };
    const composition = await selectComposition({ serveUrl, id: "NeuroCast", inputProps, chromiumOptions });
    await renderMedia({ serveUrl, composition, inputProps, chromiumOptions, codec: "h264", outputLocation: out, frameRange: [0, previewEnd(timeline.durationInFrames, timeline.meta.fps)], concurrency: 4 });
    const fresh = load(), e = fresh.openings.find((o) => o.id === id);
    if (e) {
      const rel = path.relative(ROOT, out).replace(/\\/g, "/");
      e.previews = [...(e.previews ?? []).filter((p) => p.input !== input), { input, title: timeline.meta.title, path: rel }];
      e.preview = rel; // 最近一次渲染的预览就是列表/文档里引用的那一条
      save(fresh);
    }
    console.log(`开场预览：${out}（不写发布用量台账；必须看片并听声，预览存在不代表已验收）`);
  } else die(`未知命令 ${cmd}（sync / list / pending / metric / status / preview）`);
} catch (e) { die(e.message); }
