// 动效接入审计 + 迁移队列
//   node scripts/motion-audit.mjs           概览 + 待迁移清单
//   node scripts/motion-audit.mjs --queue   只出迁移队列（按收益排序）
//
// 背景：动效层建好之后，只有「接了 useEnter 的组件」才会响应 shot.motion.enter。
// 没接的老组件仍然用各自硬编码的 easeOutBack，分镜改了也不动——这个脚本就是
// 把「谁还没接、接了收益多大」摆出来，避免改造烂尾。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTER_KINDS } from "./lib/motion.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "src/components");

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".tsx")) files.push(p);
  }
};
walk(DIR);

const rows = [];
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  const id = (s.match(/id:\s*"([a-z0-9-]+)"/) || [])[1];
  if (!id) continue;
  rows.push({
    id,
    file: path.relative(ROOT, f),
    wired: /\buseEnter\b/.test(s), // 接了动效层 → 响应 shot.motion.enter
    tagged: /^ {2}motion:\s*\{/m.test(s), // 有动效元数据 → 出现在 CATALOG 动效列
    hand: (s.match(/easeOutBack\(prog\(/g) || []).length, // 仍在硬编码的入场处
    variants: Number((s.match(/variants:\s*(\d+)/) || [])[1] || 1),
  });
}

const wired = rows.filter((r) => r.wired);
const tagged = rows.filter((r) => r.tagged);
const todo = rows
  .filter((r) => !r.wired)
  .sort((a, b) => b.hand - a.hand || a.id.localeCompare(b.id));

if (process.argv.includes("--queue")) {
  console.log("# 迁移队列（按硬编码入场处数排序，越多说明越该先接）");
  for (const r of todo) console.log(`${r.id}\t${r.hand}\t${r.variants}\t${r.file}`);
  process.exit(0);
}

console.log(`动效接入审计  ·  ${rows.length} 个正片组件\n`);
console.log(`  已接动效层（响应 shot.motion.enter）: ${wired.length}`);
console.log(`  有动效元数据（进 CATALOG 动效列） : ${tagged.length}`);
console.log(`  待迁移                            : ${todo.length}\n`);

console.log(`可用的入场语法（${ENTER_KINDS.length} 种）：${ENTER_KINDS.join(" / ")}\n`);

if (wired.length) {
  console.log("已接：");
  for (const r of wired) console.log(`  ✓ ${r.id}${r.tagged ? "" : "（缺动效元数据）"}`);
  console.log("");
}

console.log(`待迁移（按硬编码入场处数排序，前 20）：`);
console.log("  id                      硬编码处  变体  文件");
for (const r of todo.slice(0, 20)) {
  console.log(`  ${r.id.padEnd(22)}  ${String(r.hand).padStart(6)}  ${String(r.variants).padStart(4)}  ${r.file}`);
}
if (todo.length > 20) console.log(`  … 其余 ${todo.length - 20} 个见 --queue`);
console.log("");
console.log("迁移后：写分镜时 shot.motion.enter 才会对它们生效；未迁移的只受 transition 影响。");
