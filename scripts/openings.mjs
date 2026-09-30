// Opening library: every per-script opening (layer "opening") is archived in openings/library.json with its
// hook type, techniques, preview and retention data. Data decides keep / retire; nothing is reused as-is.
// usage:
//   node scripts/openings.mjs sync                        登记 src/openings 里所有开场（新的记为 trial）
//   node scripts/openings.mjs list                        列出开场库 + 数据
//   node scripts/openings.mjs metric <id> bounce2s=0.31 finish5s=0.58 [plays=1200]   录入数据（比例 0~1）
//   node scripts/openings.mjs status <id> keep|retired|trial
//   node scripts/openings.mjs preview <input.json>        渲染该视频前 5 秒到 openings/previews/<id>.mp4
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./lib/registry-node.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = path.join(ROOT, "openings", "library.json");
const FPS = 30;

// retention rule of thumb (short-video platforms): 2s bounce above this = hook failed, 5s finish below this = weak
export const RULES = { bounce2sMax: 0.35, finish5sMin: 0.5 };

const load = () => (fs.existsSync(LIB) ? JSON.parse(fs.readFileSync(LIB, "utf8").replace(/^﻿/, "")) : { rules: RULES, openings: [] });
const save = (lib) => {
  fs.mkdirSync(path.dirname(LIB), { recursive: true });
  fs.writeFileSync(LIB, JSON.stringify(lib, null, 2) + "\n");
};
const die = (m) => {
  console.error(`✖ ${m}`);
  process.exit(1);
};
const find = (lib, id) => lib.openings.find((o) => o.id === id) ?? die(`开场库里没有 ${id}（先运行 sync）`);

// which folder under src/openings holds the component (by id → file search)
const fileOf = (id) => {
  const dir = path.join(ROOT, "src", "openings");
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(dir, d.name))) {
      const p = path.join(dir, d.name, f);
      if (/\.tsx?$/.test(f) && fs.readFileSync(p, "utf8").includes(`"${id}"`)) return path.relative(ROOT, p).replace(/\\/g, "/");
    }
  }
  return null;
};

const verdict = (o, rules) => {
  const m = o.metrics || {};
  if (m.bounce2s == null && m.finish5s == null) return "待数据";
  const bad = (m.bounce2s != null && m.bounce2s > rules.bounce2sMax) || (m.finish5s != null && m.finish5s < rules.finish5sMin);
  return bad ? "建议淘汰" : "建议保留";
};

const [cmd, ...rest] = process.argv.slice(2);
const lib = load();
lib.rules = { ...RULES, ...(lib.rules || {}) };

if (cmd === "sync") {
  const reg = await loadRegistry();
  const defs = reg.list.filter((c) => c.layer === "opening");
  let added = 0;
  for (const c of defs) {
    const file = fileOf(c.id);
    const date = file?.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10);
    let e = lib.openings.find((o) => o.id === c.id);
    if (!e) {
      e = { id: c.id, date, status: "trial", usedBy: [], metrics: { plays: null, bounce2s: null, finish5s: null }, notes: "" };
      lib.openings.push(e);
      added++;
    }
    Object.assign(e, {
      name: c.name,
      file,
      desc: c.desc,
      script: c.opening?.script ?? e.script,
      hook: c.opening?.hook ?? e.hook,
      techniques: c.opening?.techniques ?? e.techniques ?? [],
    });
    if (e.script && !e.usedBy.includes(e.script)) e.usedBy.push(e.script);
    const prev = path.join("openings", "previews", `${c.id}.mp4`);
    if (fs.existsSync(path.join(ROOT, prev))) e.preview = prev.replace(/\\/g, "/");
  }
  const gone = lib.openings.filter((o) => !defs.some((c) => c.id === o.id)).map((o) => o.id);
  save(lib);
  console.log(`✓ 开场库：${lib.openings.length} 个（新增 ${added}）→ ${path.relative(ROOT, LIB)}`);
  if (gone.length) console.log(`  注意：库里有、代码里没有：${gone.join(", ")}（代码被删了？库记录保留）`);
} else if (cmd === "list" || !cmd) {
  if (!lib.openings.length) console.log("开场库是空的（运行 node scripts/openings.mjs sync）");
  for (const o of lib.openings) {
    const m = o.metrics || {};
    const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(0)}%`);
    console.log(`${o.status.padEnd(7)} ${o.id}  [${o.hook}]  2s跳出 ${pct(m.bounce2s)} · 5s完播 ${pct(m.finish5s)} · 播放 ${m.plays ?? "—"}  → ${verdict(o, lib.rules)}`);
    console.log(`        ${o.date} · ${o.usedBy.join(", ")} · ${o.techniques.join(" / ")}`);
  }
} else if (cmd === "metric") {
  const [id, ...kv] = rest;
  const e = find(lib, id);
  for (const s of kv) {
    const [k, v] = s.split("=");
    if (!["bounce2s", "finish5s", "plays"].includes(k)) die(`未知指标 ${k}（bounce2s / finish5s / plays）`);
    let n = parseFloat(String(v).replace("%", ""));
    if (k !== "plays" && (String(v).includes("%") || n > 1)) n /= 100;
    e.metrics[k] = n;
  }
  e.metrics.updated = new Date().toISOString().slice(0, 10);
  save(lib);
  console.log(`✓ ${id}：${JSON.stringify(e.metrics)} → ${verdict(e, lib.rules)}`);
} else if (cmd === "status") {
  const [id, st] = rest;
  if (!["trial", "keep", "retired"].includes(st)) die("status 只能是 trial / keep / retired");
  find(lib, id).status = st;
  save(lib);
  console.log(`✓ ${id} → ${st}`);
} else if (cmd === "preview") {
  const [input] = rest;
  if (!input) die("用法：node scripts/openings.mjs preview <input.json>");
  const sb = JSON.parse(fs.readFileSync(path.resolve(path.dirname(input), JSON.parse(fs.readFileSync(input, "utf8").replace(/^﻿/, "")).storyboard ?? "storyboard.json"), "utf8").replace(/^﻿/, ""));
  const id = sb.opening?.type ?? sb.shots?.[0]?.data?.opening?.type;
  if (!id) die("这个视频的第一个镜头没有 opening");
  const out = path.join(ROOT, "openings", "previews", `${id}.mp4`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "make.mjs"), input, "--frames", `0-${5 * FPS - 1}`, "--out", out], { stdio: "inherit" });
  if (r.status) process.exit(r.status);
  const e = lib.openings.find((o) => o.id === id);
  if (e) {
    e.preview = path.relative(ROOT, out).replace(/\\/g, "/");
    save(lib);
  }
  console.log(`✓ 开场预览：${out}`);
} else die(`未知命令 ${cmd}（sync / list / metric / status / preview）`);
