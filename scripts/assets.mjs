// 素材台账命令行：node scripts/assets.mjs [report|unused|dup|check|record|harvest]
//   report                 谁上过片、每条片子的素材占比
//   unused                 拍都拍了却从没上过片的素材
//   dup                    内容相同、路径不同的重复素材
//   check <timeline.json>  这条时间轴的素材占比 + 缺素材清单（不写台账）
//   record <timeline.json> [--video 片名]  补记一条片子（重跑/手工改过分镜后用）
//   harvest [--all]        把 public/jobs/ 里已有的 timeline.json 全部补记进台账
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load, save, report, unused, dup, ratioOf, checklist, record, originResolver } from "./lib/assets.mjs";
import { loadRegistry } from "./lib/registry-node.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const cmd = argv[0] || "report";
const flag = (n) => argv.includes(`--${n}`);
const val = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const reg = await loadRegistry();
const ASSET_FIELDS = Object.fromEntries(reg.list.filter((c) => c.assetFields?.length).map((c) => [c.id, c.assetFields]));

const readTl = (p) => {
  if (!p) {
    console.error("用法：node scripts/assets.mjs check|record <public/jobs/…/timeline.json>");
    process.exit(1);
  }
  const abs = path.isAbsolute(p) ? p : path.resolve(ROOT, p);
  if (!fs.existsSync(abs)) {
    console.error(`✖ 找不到时间轴：${abs}`);
    process.exit(1);
  }
  return { tl: JSON.parse(fs.readFileSync(abs, "utf8").replace(/^﻿/, "")), abs };
};

const printRatio = (tl) => {
  const r = ratioOf(tl, ASSET_FIELDS);
  const pct = (r.pct * 100).toFixed(1);
  console.log(`素材占比 ${pct}%（${r.assetShots}/${r.shots} 个镜头上了真素材，共 ${r.files.length} 个文件）· 台账要求 ≥${(r.minRatio * 100).toFixed(0)}%`);
  const miss = checklist(tl, ASSET_FIELDS);
  if (miss.length) {
    console.log(`\n素材字段空着的镜头（${miss.length} 个）——这些位置本来可以放真截图/真 logo/真头像：`);
    for (const m of miss) console.log(`  ${m.id.padEnd(4)} ${m.type.padEnd(20)} 需要 ${m.fields.join("/")}：${(m.text || "").slice(0, 30)}`);
    console.log("  （讲稿点名了文件却没找到的那种，make.mjs 会直接 E_ASSET 失败并写 assets_todo.md）");
  }
  return r;
};

if (cmd === "report") {
  console.log(report(load()));
} else if (cmd === "unused") {
  const u = unused(load());
  if (!u.length) console.log("台账里没有闲置素材 ✓");
  for (const a of u) console.log(`  ${a.origin}  ${a.kind || "-"}  ${a.source ? `来源 ${a.source}` : "（没写来源）"}`);
} else if (cmd === "dup") {
  const d = dup(load());
  if (!d.length) console.log("没有发现重复素材 ✓");
  for (const g of d) console.log(`  ${g.md5}:\n    ${g.origins.join("\n    ")}`);
} else if (cmd === "check") {
  const { tl } = readTl(argv[1]);
  printRatio(tl);
} else if (cmd === "record") {
  const { tl, abs } = readTl(argv[1]);
  const r = record(tl, { video: val("video"), file: abs, assetFields: ASSET_FIELDS, date: val("date"), originOf: originResolver(abs) });
  console.log(`✓ 已记入台账：${r.video} · ${r.files} 个素材 · 素材占比 ${(r.ratio * 100).toFixed(1)}%`);
} else if (cmd === "harvest") {
  const jobs = path.join(ROOT, "public", "jobs");
  if (!fs.existsSync(jobs)) {
    console.error("public/jobs/ 不存在，没有可补记的时间轴");
    process.exit(1);
  }
  const dirs = fs.readdirSync(jobs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(jobs, d.name, "timeline.json"));
  const found = dirs.filter((p) => fs.existsSync(p));
  const j = load();
  let n = 0;
  for (const p of found) {
    const tl = JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
    const vid = val("video") || tl.meta?.title || path.basename(path.dirname(p));
    if (!flag("all") && j.videos.some((v) => v.id === vid)) continue;
    record(tl, { video: vid, file: p, assetFields: ASSET_FIELDS, ledger: j, originOf: originResolver(p), date: val("date") });
    n++;
  }
  save(j);
  console.log(`✓ 扫描 ${found.length} 条时间轴，补记 ${n} 条 → assets/library.json`);
  console.log(report(j));
} else {
  console.error(`未知命令 ${cmd}（可用：report / unused / dup / check / record / harvest）`);
  process.exit(1);
}
