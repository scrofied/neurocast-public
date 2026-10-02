// 选型助手：写分镜时判断「这个语义，现有组件够不够用」
//   node scripts/pick.mjs "把琐碎经历提炼成可售卖的资产"
//   node scripts/pick.mjs --storyboard examples/xxx/storyboard.json     逐镜体检，标出该新增组件的位置
//   node scripts/pick.mjs --list                                        列出全部组件的动效与适用
//
// 设计意图：组件的价值是语义资产。当现有组件「表达不准确」而不是「完全表达不了」时，
// 就应该新增——阈值故意压低，让每条片子都能长出几个新组件。本工具只负责把
// 「不够贴合」显式指出来，不让它被含糊过去。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./lib/registry-node.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 判定阈值：低于 LOW 说明「现有组件撑不住这个语义」，应当新增组件
const GOOD = 7; // 直接可用
const OK = 4.5; // 勉强，可改造或考虑新增
const LOW = 4.5; // 以下 = 应该新增

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
const pool = reg.list.filter((c) => c.layer !== "opening");

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};

if (args.includes("--list")) {
  for (const c of pool) console.log(`${c.id}\t${c.motion?.kind || "—"}\t${c.variants}\t${c.use || c.tags.join("、")}`);
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
    const ranked = pool.map((c) => ({ c, v: score(line, c) })).sort((a, b) => b.v - a.v);
    const mine = ranked.find((r) => r.c.id === s.type);
    const myV = mine ? mine.v : 0;
    const near = ranked.filter((r) => r.v > 0).slice(0, 3);
    if (myV < LOW) {
      weak++;
      console.log(`  ⚠ s${i} ${s.type}  ←「${line}」吻合度 ${myV}`);
      console.log(`     更接近的：${near.length ? near.map((r) => `${r.c.id}(${r.v})`).join(" / ") : "没有语义接近的"}`);
      console.log(`     ⇒ 现有组件都撑不住这个语义，应当新增一个（见 CATALOG.md 顶部「新增组件判定」）`);
    } else if (myV < GOOD) {
      console.log(`  · s${i} ${s.type}  勉强（${myV}）←「${line}」`);
    }
  });
  console.log(`\n合计：${shots.length} 镜，其中 ${weak} 镜判定「应该新增组件」。`);
  console.log("注：判定依据是「画面意图 ≠ 现有组件语义」，与台词文字无关——所以每条镜头都应写 intent。");
  process.exit(0);
}

const q = args.filter((a) => !a.startsWith("--")).join(" ");
if (!q) {
  console.log("用法：node scripts/pick.mjs \"语义描述\" | --storyboard <file> | --list");
  process.exit(0);
}

const ranked = pool.map((c) => ({ c, v: score(q, c) })).sort((a, b) => b.v - a.v).slice(0, 6);
console.log(`查询：「${q}」\n`);
console.log("  id                      吻合  动效                          适用");
for (const { c, v } of ranked) {
  const bar = v >= GOOD ? "✓" : v >= OK ? "~" : " ";
  console.log(`  ${bar} ${c.id.padEnd(20)} ${String(v).padStart(5)}  ${(c.motion?.kind || "—").padEnd(28)} ${(c.use || c.tags.join("、")).slice(0, 40)}`);
}
const top = ranked[0];
console.log("");
if (top.v >= GOOD) console.log(`⇒ 「${top.c.id}」可以直接用。`);
else if (top.v >= OK) console.log(`⇒ 「${top.c.id}」勉强能用，但语义不够贴。按「新增组件判定」的低于阈值原则，建议新增一个更准的组件。`);
else console.log(`⇒ 现有组件都不贴合（最高 ${top.v}）。**应该新增组件**：把这段语义提炼成一个新组件，它会成为下一个片子的资产。`);
