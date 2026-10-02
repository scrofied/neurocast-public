// 选型助手：写分镜时判断「这个语义，现有组件够不够用」
//   node scripts/pick.mjs "把琐碎经历提炼成可售卖的资产"
//   node scripts/pick.mjs --storyboard examples/xxx/storyboard.json     逐镜体检，标出该新增组件的位置
//   node scripts/pick.mjs --list                                        列出全部组件的动效与适用
//   node scripts/pick.mjs --fresh ["语义"]                               只在「从未上过片」的组件里选
//   node scripts/pick.mjs --recent [--n 3]                              近 N 条片各用了哪些组件
//   node scripts/pick.mjs "语义" --avoid quote,versus                    排除指定组件后再选
//
// 设计意图：组件的价值是语义资产。当现有组件「表达不准确」而不是「完全表达不了」时，
// 就应该新增——阈值故意压低，让每条片子都能长出几个新组件。本工具只负责把
// 「不够贴合」显式指出来，不让它被含糊过去。
//
// 用量台账（usage/library.json）解决另一半问题：库里 80+ 个组件，历史只用到 50 个。
// 选型时把「上一条片刚用过」标出来，重复感才不会又落到那几个老面孔上。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./lib/registry-node.mjs";
import { load as loadUsage, recent as recentOf, statsOf, usageNote, bodyComps, NON_BODY } from "./lib/usage.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 判定阈值：低于 LOW 说明「现有组件撑不住这个语义」，应当新增组件
const GOOD = 7; // 直接可用
const OK = 4.5; // 勉强，可改造或考虑新增
const LOW = 4.5; // 以下 = 应该新增

// 终端对齐：中日韩字符占两格，padEnd 按码元数算会排歪，这里按显示宽度补空格
const w = (s) => [...String(s)].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
const pad = (s, n) => {
  let t = String(s);
  if (w(t) > n) {
    while (t.length && w(t) > n - 1) t = t.slice(0, -1);
    t += "…";
  }
  return t + " ".repeat(Math.max(0, n - w(t)));
};

const ngrams = (s) => {
  const out = new Set();
  const t = String(s).replace(/[\s，。、；：？！「」『』（）()"']+/g, "");
  for (let i = 0; i + 2 <= t.length; i++) out.add(t.slice(i, i + 2));
  return out;
};

const score = (q, c) => {
  const qg = ngrams(q);
  const text = [c.name, c.use || "", c.desc || "", c.tags.join(" "), c.motion?.kind || ""].join(" ");
  const cg = ngrams(text);
  let hit = 0;
  for (const g of qg) if (cg.has(g)) hit++;
  const cover = qg.size ? hit / qg.size : 0;
  let tagHit = 0;
  for (const t of c.tags) if (t.length >= 2 && String(q).includes(t)) tagHit++;
  return Math.round((cover * 10 + tagHit * 2.5) * 10) / 10;
};

const reg = await loadRegistry();
const poolAll = reg.list.filter((c) => c.layer !== "opening" && !NON_BODY.has(c.id));
const ledger = loadUsage();

const args = process.argv.slice(2);
const has = (n) => args.includes(n);
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};
const avoid = new Set((flag("--avoid") || "").split(/[,\s]+/).filter(Boolean));
const recentMap = recentOf(ledger);

// 「语义够用但刚用过」时给出的一句提示
const usageTag = (id) => {
  const s = statsOf(id, { ledger, rec: recentMap });
  return { ...s, tag: s.fresh ? "新" : s.recentN ? `刚用过${s.recentN}` : `${s.count}次` };
};

if (has("--recent")) {
  const n = Number(flag("--n") || ledger.rules.recentVideos);
  const vids = ledger.videos.slice(-n);
  if (!vids.length) console.log("台账是空的：先跑 node scripts/usage.mjs backfill");
  for (const v of vids) {
    console.log(`\n${v.date}  ${v.id}（${v.shots} 镜）`);
    console.log("  " + Object.entries(v.types).sort((a, b) => b[1] - a[1]).map(([k, x]) => `${k}×${x}`).join("  "));
  }
  if (vids.length) console.log(`\n近 ${vids.length} 条片合计用到 ${new Set(vids.flatMap((v) => Object.keys(v.types))).size} 种组件 / 库里 ${poolAll.length} 种`);
  process.exit(0);
}

if (has("--list")) {
  for (const c of poolAll) {
    if (avoid.has(c.id)) continue;
    const t = usageTag(c.id);
    console.log(`${c.id}\t${c.motion?.kind || "—"}\t变体${c.variants}\t${t.fresh ? "从未上过片" : `已用 ${t.count} 次（最近 ${t.lastDate}）`}\t${c.use || c.tags.join("、")}`);
  }
  process.exit(0);
}

const sbPath = flag("--storyboard");
if (sbPath) {
  const sb = JSON.parse(fs.readFileSync(path.resolve(ROOT, sbPath), "utf8"));
  const used = new Set((sb.shots || []).map((s) => s.type));
  const shots = sb.shots || [];
  const withIntent = shots.filter((s) => s.intent).length;
  console.log(`分镜体检：${sbPath}`);
  if (!withIntent) {
    console.log("  ⚠ 分镜没写 intent（一句话画面意图）。这里只能拿台词文字去匹配语义，");
    console.log("    台词 ≠ 画面，结果仅供参考。建议给每条镜头补 intent 后再体检。\n");
  } else {
    console.log(`  （${withIntent}/${shots.length} 条写了 intent）\n`);
  }
  let weak = 0;
  shots.forEach((s, i) => {
    if (s.type === "outro" || s.type === "talking-head-stage") return;
    const line = String(s.intent || s.start || "");
    const ranked = poolAll.filter((c) => !avoid.has(c.id)).map((c) => ({ c, v: score(line, c) })).sort((a, b) => b.v - a.v);
    const mine = ranked.find((r) => r.c.id === s.type);
    const myV = mine ? mine.v : 0;
    const near = ranked.filter((r) => r.v > 0).slice(0, 3);
    const tagOf = (c) => {
      const t = usageTag(c.id);
      return t.fresh ? "★新" : t.recentN ? "⚠刚用过" : "";
    };
    if (myV < LOW) {
      weak++;
      console.log(`  ⚠ s${i} ${s.type}  ←「${line}」吻合度 ${myV}`);
      console.log(`     更接近的：${near.length ? near.map((r) => `${r.c.id}(${r.v})${tagOf(r.c)}`).join(" / ") : "没有语义接近的"}`);
      console.log(`     ⇒ 现有组件都撑不住这个语义，应当新增一个（见 CATALOG.md 顶部「新增组件判定」）`);
    } else if (myV < GOOD) {
      console.log(`  · s${i} ${s.type}  勉强（${myV}）←「${line}」`);
    } else if (usageTag(s.type).recentN) {
      const alt = ranked.filter((r) => r.v >= GOOD * 0.7 && usageTag(r.c.id).fresh).slice(0, 2);
      console.log(`  · s${i} ${s.type}  语义够（${myV}）但近片刚用过${alt.length ? `，可换 ${alt.map((r) => r.c.id + "★新").join(" / ")}` : ""}`);
    }
  });
  const mine = new Set(shots.map((s) => s.type).filter((t) => t !== "outro" && t !== "talking-head-stage"));
  const fresh = [...mine].filter((id) => statsOf(id, { ledger }).fresh);
  console.log(`\n合计：${shots.length} 镜，其中 ${weak} 镜判定「应该新增组件」；用到 ${mine.size} 种组件，其中 ${fresh.length} 个从未上过片（要求 ≥${ledger.rules.minFresh}）${fresh.length < ledger.rules.minFresh ? " ⚠" : " ✓"}`);
  console.log("注：判定依据是「画面意图 ≠ 现有组件语义」，与台词文字无关——所以每条镜头都应写 intent。★新 = 从未上过片的候选，优先用它们。");
  process.exit(0);
}

const VALUED_ARG = new Set(["--storyboard", "--avoid", "--n"]);
const consumed = new Set();
for (let i = 0; i < args.length; i++) if (VALUED_ARG.has(args[i]) && args[i + 1]) consumed.add(i + 1);
const q = args.filter((a, i) => !a.startsWith("--") && !consumed.has(i)).join(" ");
if (!q && !has("--fresh")) {
  console.log('用法：node scripts/pick.mjs "语义描述" | --storyboard <file> | --list | --fresh ["语义"] | --recent [--n 3] | --avoid a,b');
  process.exit(0);
}

let pool = poolAll.filter((c) => !avoid.has(c.id));
if (has("--fresh")) {
  pool = pool.filter((c) => statsOf(c.id, { ledger }).fresh);
  console.log(`只在从未上过片的 ${pool.length} 个组件里选（台账：${ledger.videos.length} 条片）\n`);
  if (!pool.length) {
    console.log("⇒ 全部正片组件都上过片了。这时候要么按本次语义新增组件，要么把老组件的 motion.enter 换掉。");
    process.exit(0);
  }
}
const ranked = pool.map((c) => ({ c, v: score(q, c) })).sort((a, b) => b.v - a.v).slice(0, has("--fresh") ? 10 : 6);
console.log(`查询：「${q || "（--fresh：不限语义）"}」\n`);
console.log(`  ${pad("id", 22)} ${pad("吻合", 6)}  ${pad("用量", 16)} ${pad("动效", 20)} 适用`);
for (const { c, v } of ranked) {
  const bar = v >= GOOD ? "✓" : v >= OK ? "~" : " ";
  const t = usageTag(c.id);
  const note = (t.fresh ? "★" : t.recentIn.length >= 2 ? "⚠" : t.recentN ? "·" : " ") + " " + usageNote(t);
  console.log(`${bar} ${pad(c.id, 23)} ${pad(String(v), 6)}  ${pad(note, 16)} ${pad(c.motion?.kind || "—", 20)} ${(c.use || c.tags.join("、")).replace(/\s+/g, " ").slice(0, 34)}`);
}
const top = ranked[0];
console.log("");
console.log("  用量标记：★ 从未上过片（优先）· ⚠ 近片出现在 ≥2 条里（换组件）· · 只在 1 条近片出现过（可复用，但换 motion.enter）");
if (top.v >= GOOD) {
  const t = usageTag(top.c.id);
  const alt = ranked.filter((r) => r.c.id !== top.c.id && r.v >= GOOD * 0.75 && statsOf(r.c.id, { ledger }).fresh).slice(0, 2);
  console.log(`⇒ 「${top.c.id}」可以直接用${t.fresh ? "，而且它从未上过片——就用它" : ""}。`);
  if (!t.fresh && t.recentN) console.log(`  ⚠ 但它${usageNote(t)}。${alt.length ? `同一语义里 ${alt.map((r) => r.c.id + "（★新）").join(" / ")} 还没上过片，先考虑它们。` : "没有别的贴合候选，那就换 motion.enter。"}`);
} else if (top.v >= OK) console.log(`⇒ 「${top.c.id}」勉强能用，但语义不够贴。按「新增组件判定」的低于阈值原则，建议新增一个更准的组件。`);
else console.log(`⇒ 现有组件都不贴合（最高 ${top.v}）。**应该新增组件**：把这段语义提炼成一个新组件，它会成为下一个片子的资产。`);
