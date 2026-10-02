// 正片组件用量台账 CLI
//   node scripts/usage.mjs backfill [路径…]        从历史分镜/时间轴回填（默认 examples/*/storyboard.json + public/jobs/*/timeline.json）
//   node scripts/usage.mjs record <timeline.json> [--video 名字] [--date YYYY-MM-DD]
//   node scripts/usage.mjs drop <片名>               剔除试渲染/误记的片子
//   node scripts/usage.mjs report                  覆盖率 + 高频 + 从未用过的池子
//   node scripts/usage.mjs list [--sort count|recent]
//   node scripts/usage.mjs unused                  从未用过的组件 id（按层）
//   node scripts/usage.mjs recent                  近 N 条片各用了什么
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load, save, record, usedIds, bodyComps } from "./lib/usage.mjs";
import { loadRegistry } from "./lib/registry-node.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : null;
};
const MIN_SHOTS = 4; // 少于 4 个镜头的是单组件试渲染，不算一条片子

// 支持任意段通配：examples/*/storyboard.json、public/jobs/*/timeline.json
const segRe = (s) => new RegExp("^" + s.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const expand = (abs) => {
  const parts = abs.split(path.sep);
  let cur = [parts[0]]; // "D:\" 或 "/"
  for (const p of parts.slice(1)) {
    if (!p) continue;
    const next = [];
    for (const d of cur) {
      if (!p.includes("*")) {
        next.push(path.join(d, p));
        continue;
      }
      if (!fs.existsSync(d)) continue;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory() && segRe(p).test(e.name)) next.push(path.join(d, e.name));
    }
    cur = next;
  }
  return cur.filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
};
const walkTimelines = (pats) => {
  const out = [];
  for (const p of pats) for (const f of expand(path.resolve(ROOT, p))) if (!out.includes(f)) out.push(f);
  return out;
};

const SKIP_VIDEO = /^(测试|test|tmp|demo[-_ ]?\d*|样例|未命名)$/i; // 试渲染/占位片不进台账

// examples/ 里存的是渲染前的分镜草稿：没有 meta.title，和同一条片子的成品时间轴会记成两个名字。
// 这里手工对齐成同一个片子（新增 examples 时补一行即可）。
const DIR_ALIAS = {
  "comment-mining": "从评论区挖掘爆款选题",
  "ai-tool-4steps": "20 分钟用 AI 做出你的第一个小软件",
  "0930-ability-audit": "用 AI 挖出你身上的隐藏资产",
};

// 同一条片子的多份草稿/多次重渲染要有唯一一个身份：开场组件 id 是最稳的信号
const sigOf = (tl) =>
  tl?.opening?.type || tl?.shots?.find?.((s) => s.data?.opening?.type)?.data?.opening?.type || null;

if (cmd === "backfill") {
  const pats = argv.slice(1).filter((a) => !a.startsWith("--"));
  const keepTest = argv.includes("--include-test");
  const files = walkTimelines(pats.length ? pats : ["examples/*/storyboard.json", "public/jobs/*/timeline.json"]);
  const titleOf = (tl) => tl?.meta?.title || tl?.title || tl?.input?.title || tl?.topic || null;
  const byVideo = new Map();
  let skipped = 0;
  for (const f of files) {
    let tl;
    try {
      tl = readJson(f);
    } catch {
      continue;
    }
    const shots = (tl.shots || []).length;
    if (shots < MIN_SHOTS) continue;
    const dir = path.basename(path.dirname(f)).replace(/[-_]\d{6,8}$/, "");
    const id = titleOf(tl) || DIR_ALIAS[dir] || dir;
    if (!keepTest && SKIP_VIDEO.test(id)) {
      skipped++;
      continue;
    }
    const mtime = fs.statSync(f).mtime.toISOString().slice(0, 10);
    // 优先用文件名/目录名里的日期（真实创作日期），mtime 只兜底（同步/复制会改写它）
    const dm = /(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/.exec(`${path.basename(path.dirname(f))}/${path.basename(f)}`);
    const date = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : mtime;
    // 身份：有开场组件按开场认，没有就按片名认
    const key = sigOf(tl) || `name:${id}`;
    const prev = byVideo.get(key);
    if (prev && (prev.date > date || (prev.date === date && prev.shots >= shots))) {
      if (prev.id !== id) console.log(`  · ${id} 与 ${prev.id} 是同一开场（${sigOf(tl)}）的两次草稿，保留 ${prev.file}`);
      continue;
    }
    if (prev) console.log(`  · ${id} 覆盖 ${prev.id}（${prev.file}）：本份更全/更新`);
    byVideo.set(key, { id, tl, file: rel(f), date, shots });
  }
  const list = [...byVideo.values()].sort((a, b) => a.date.localeCompare(b.date));
  const ledger = load();
  for (const v of list) {
    record(v.tl, { video: v.id, file: v.file, date: v.date, ledger });
    console.log(`✓ ${v.id.padEnd(30)} ${String(v.shots).padStart(3)} 镜  ${v.date}  ${v.file}`);
  }
  console.log(`\n回填 ${list.length} 条片子（${files.length} 个文件里筛出，镜头数 <${MIN_SHOTS} 的试渲染已排除${skipped ? `，${skipped} 个测试片已跳过` : ""}）`);
  process.exit(0);
}

if (cmd === "record") {
  const f = argv[1];
  if (!f) {
    console.log("用法: node scripts/usage.mjs record <timeline.json> [--video 名字] [--date YYYY-MM-DD]");
    process.exit(1);
  }
  const p = path.resolve(ROOT, f);
  const r = record(readJson(p), { video: flag("--video"), date: flag("--date"), file: rel(p) });
  console.log(`✓ 已记录 ${r.video?.id}：${r.added} 个镜头、${Object.keys(r.video?.types || {}).length} 种组件`);
  process.exit(0);
}

if (cmd === "drop") {
  const vid = argv[1];
  if (!vid) {
    console.log("用法: node scripts/usage.mjs drop <片名>（把试渲染/误记的片子从台账里剔掉）");
    process.exit(1);
  }
  const j = load();
  const i = j.videos.findIndex((v) => v.id === vid);
  if (i < 0) {
    console.log(`台账里没有「${vid}」（可用 node scripts/usage.mjs recent --n 99 查片名）`);
    process.exit(1);
  }
  j.videos.splice(i, 1);
  for (const [id, c] of Object.entries(j.comps)) {
    const n = c.history.filter((h) => h.video === vid).reduce((s, h) => s + h.shots.length, 0);
    c.count = Math.max(0, c.count - n);
    c.history = c.history.filter((h) => h.video !== vid);
    c.videos = c.videos.filter((v) => v !== vid);
    c.lastDate = c.history.length ? c.history[c.history.length - 1].date : null;
    if (!c.count) delete j.comps[id];
  }
  save(j);
  console.log(`✓ 已剔除「${vid}」，剩余 ${j.videos.length} 条片子`);
  process.exit(0);
}

const j = load();
const { list } = await loadRegistry();
const body = bodyComps(list);

if (cmd === "report" || !cmd) {
  const used = usedIds(j);
  const never = body.filter((c) => !used.has(c.id));
  const cnt = body.filter((c) => j.comps[c.id]?.count).sort((a, b) => (j.comps[b.id]?.count || 0) - (j.comps[a.id]?.count || 0));
  console.log(`台账：${j.videos.length} 条片子 · ${body.length} 个正片组件里用过 ${cnt.length} 个 · 从未用过 ${never.length} 个`);
  console.log(`规则：近 ${j.rules.recentVideos} 条片算「刚用过」；每条片至少首次使用 ${j.rules.minFresh} 个组件`);
  console.log("\n高频 TOP 12：");
  for (const c of cnt.slice(0, 12)) {
    const e = j.comps[c.id];
    console.log(`  ${String(e.count).padStart(3)} 次  ${c.id.padEnd(22)} 最近 ${e.lastDate}  入场用过 ${[...new Set(e.history.flatMap((h) => h.enters))].join("/") || "（未声明）"}`);
  }
  const byLayer = {};
  for (const c of never) (byLayer[c.layer] ??= []).push(c.id);
  console.log("\n从未用过（按层）：");
  for (const [l, ids] of Object.entries(byLayer)) console.log(`  ${l} (${ids.length})  ${ids.join(", ")}`);
  process.exit(0);
}

if (cmd === "list") {
  const sort = flag("--sort") === "recent" ? "recent" : "count";
  const rows = body.map((c) => ({ c, e: j.comps[c.id] })).filter((r) => r.e?.count);
  rows.sort((a, b) => (sort === "recent" ? String(b.e.lastDate).localeCompare(String(a.e.lastDate)) : b.e.count - a.e.count));
  for (const { c, e } of rows) console.log(`${String(e.count).padStart(3)}  ${e.lastDate}  ${c.id.padEnd(22)}  ${e.videos.slice(-3).join(" | ")}`);
  process.exit(0);
}

if (cmd === "unused") {
  const used = usedIds(j);
  const byLayer = {};
  for (const c of body.filter((x) => !used.has(x.id))) (byLayer[c.layer] ??= []).push(c);
  for (const [l, cs] of Object.entries(byLayer)) {
    console.log(`\n## ${l}（${cs.length} 个从未上过片）`);
    for (const c of cs) console.log(`  ${c.id.padEnd(22)} ${c.name.padEnd(16, "　")}  ${(c.use || c.tags.join("、")).slice(0, 46)}`);
  }
  console.log(`\n合计 ${Object.values(byLayer).reduce((s, x) => s + x.length, 0)} / ${body.length} 个正片组件从未用过`);
  process.exit(0);
}

if (cmd === "recent") {
  const n = Number(flag("--n") || j.rules.recentVideos);
  for (const v of j.videos.slice(-n)) {
    console.log(`\n${v.id}  ${v.date}  ${v.shots} 镜`);
    console.log("  " + Object.entries(v.types).sort((a, b) => b[1] - a[1]).map(([k, x]) => `${k}×${x}`).join("  "));
  }
  process.exit(0);
}

console.log(`未知命令 ${cmd}（可用：backfill / record / report / list / unused / recent）`);
process.exit(1);
