// Generate CATALOG.md from the component registry (the single source of truth).
// node scripts/catalog.mjs   -> CATALOG.md
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ENTER_KINDS, TRANSITIONS } from "./lib/motion.mjs";
import { loadRegistry } from "./lib/registry-node.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reg = await loadRegistry();

const LAYER = { structure: "结构", info: "信息图", story: "叙事场景", product: "产品/工具演示", metaphor: "概念隐喻", screen: "截图录屏", overlay: "叠加", fx: "特效", opening: "专属开场（每条视频一个，不复用）" };
const isCue = (k) => k === "at" || k === "until" || /[a-z]At$/.test(k);

const typeOf = (s, key = "") => {
  if (!s) return "any";
  if (isCue(key)) return "锚点";
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" \\| ");
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.anyOf || s.oneOf) return (s.anyOf || s.oneOf).map((x) => typeOf(x)).join(" \\| ");
  if (s.type === "array") {
    const range = s.minItems !== undefined || s.maxItems !== undefined ? ` (${s.minItems ?? 0}–${s.maxItems ?? "∞"})` : "";
    const inner = typeOf(s.items);
    return `${/[{|]/.test(inner) ? `[${inner}]` : `${inner}[]`}${range}`;
  }
  if (s.type === "object") {
    if (!s.properties) return "object";
    const req = new Set(s.required || []);
    return `{ ${Object.entries(s.properties).map(([k, v]) => `${k}${req.has(k) ? "" : "?"}: ${typeOf(v, k)}`).join(", ")} }`;
  }
  if (s.type === "integer") return "int";
  return s.type || "any";
};

const fields = (def) => {
  let js;
  try {
    js = z.toJSONSchema(def.schema, { unrepresentable: "any", io: "input" });
  } catch (e) {
    return `（schema 无法导出：${e.message}）`;
  }
  const req = new Set(js.required || []);
  const rows = Object.entries(js.properties || {}).map(([k, v]) => {
    const d = [v.description, v.default !== undefined ? `默认 ${JSON.stringify(v.default)}` : ""].filter(Boolean).join("；");
    return `| \`${k}\`${req.has(k) ? " **必填**" : ""} | ${typeOf(v, k)} | ${d.replace(/\|/g, "\\|")} |`;
  });
  return ["| 字段 | 类型 | 说明 |", "|---|---|---|", ...rows].join("\n");
};

const byLayer = {};
for (const c of reg.list) (byLayer[c.layer] ??= []).push(c);

const out = [
  "# 组件资产目录（CATALOG）",
  "",
  "> 本文件由 `node scripts/catalog.mjs` 从 `src/components/registry.ts` 自动生成，**不要手改**。新增/修改组件后重新生成。",
  "",
  `当前共 **${reg.list.length}** 个组件。写分镜时按「适用」选组件，按字段表填 data。`,
  "",
  "- **锚点**：类型写着「锚点」的字段（`at`、`until`、`xxxAt`）填台词里的原文片段，如 `\"at\": \"封面\"`，管线会换算成那个词说出口的帧；也可填秒数（相对本镜头开始）。`\"文字$\"` = 这几个字说完的时刻，`\"文字+0.3\"` = 往后偏 0.3 秒。",
  "- **可放侧栏**：能作为 `talking-head-stage` 的 `left/right` 小组件。",
  "- **自动隐藏字幕**：画面本身就显示了台词（对话、指令、冲击大字），默认不再叠底部字幕；分镜里写 `\"captions\": true` 可强制打开。",
  `- **动效（每条镜头都能声明）**：\`"motion": { "enter": "${ENTER_KINDS[1]}", "transition": "cut", "energy": 3 }\`。\`enter\` = 元素入场语法（${ENTER_KINDS.join(" / ")}）；\`transition\` = 镜头转场（${TRANSITIONS.join(" / ")}）；\`energy\` = 1~3 强度。**不写也会自动错开**（同一组件第 2 次出现自动换一种入场），但显式写才能让运动与台词语义对齐。`,
  "- **动效列怎么用**：把「动效」读成「这一镜画面里什么东西在动、怎么动」。连续几镜不要用同一种（都是元素聚合 / 都是路径推进 就会显得重复）。",
  "",
  "## 新增组件判定（写分镜时就要做）",
  "",
  "组件库的价值在于**每条片子都长出几个新资产**，所以判定阈值**故意压低**：",
  "",
  "| 情况 | 处理 |",
  "|---|---|",
  "| 现有组件完全表达不了这个语义 | **必须新增** |",
  "| 现有组件表达得不够准（要拐弯、要凑、要改字段含义） | **也应当新增** ← 阈值低在这里 |",
  "| 现有组件差一点点（改个 data 就贴） | 不新增，直接用 |",
  "| 现有组件完全合适 | 不新增 |",
  "",
  "**每条片子的下限：至少新增 2 个组件。** 不新增说明这片的语义全在已有覆盖内，或者判得太松。",
  "",
  "判定流程：",
  "",
  "1. 写分镜时给每条镜头写 `intent` —— 一句话说「这一镜画面要做什么」（不是台词，是画面意图）",
  "2. 跑 `node scripts/pick.mjs --storyboard <分镜文件>` 看吻合度",
  "3. 吻合度低于 4.5 的，问一句：**现有组件里有没有一个能不改一字就表达它？** 没有 → 新增",
  "4. 新增后跑 `node scripts/catalog.mjs` 登记进本目录",
  "",
  "新增组件的质量要求：",
  "",
  "- **按叙事动作定义，不按题材**：不是「讲电商的组件」，而是「把琐碎经历提炼成可售卖的资产」。题材的东西无法复用。",
  "- **内容全参数化**：所有文字/数值从 `data` 走，不许写死。",
  "- **能说出 3 个不相关题材的用法**，写进 `use` 字段——说不出来说明它太窄，不值得进库。",
  "- **画面必须有动作**：纯静态排版不算组件（那正是「PPT 感」的来源）。",
  "- **接入动效层**：`const enterAt = useEnter(variant)`，入场用 `enterAt(frame, at, { fallback: \"…\" })`；`fallback` 保住你的原生基线，分镜写 `motion.enter` 时才被覆盖。",
  "- **标 `motion: { kind, energy }`**：让它在选型时能按「动感」被挑出来。",
  "- `node scripts/motion-audit.mjs` 可查还有哪些老组件没接入动效层（迁移队列）。",
  "",
  "## 速查",
  "",
  "| id | 名称 | 动效 | 适用 |",
  "|---|---|---|---|",
  ...reg.list.map(
    (c) =>
      `| \`${c.id}\` | ${c.name} | ${(c.motion ? c.motion.kind : "—").replace(/\|/g, "\\|")} | ${(c.use || c.tags.join("、") || "").replace(/\|/g, "\\|")} |`
  ),
  "",
];
for (const [layer, list] of Object.entries(byLayer)) {
  out.push(`## ${LAYER[layer] || layer}`, "");
  for (const c of list) {
    const flags = [`${c.minSec}–${c.maxSec}s`, `变体 ${c.variants}`, c.motion ? `动效 ${c.motion.kind}｜强度 ${c.motion.energy}` : "动效 未标注", c.panel ? "可放侧栏" : "", c.hideCaptions ? "自动隐藏字幕" : ""].filter(Boolean).join(" · ");
    out.push(`### \`${c.id}\` ${c.name}`, "", `${flags}`, "");
    if (c.desc) out.push(`**画面**：${c.desc}`, "");
    if (c.use) out.push(`**适用**：${c.use}`, "");
    if (c.tags?.length) out.push(`**常见说法**：${c.tags.join("、")}`, "");
    out.push(fields(c), "", "<details><summary>示例 data</summary>", "", "```json", JSON.stringify(c.example, null, 1), "```", "", "</details>", "");
  }
}
const file = path.join(ROOT, "CATALOG.md");
fs.writeFileSync(file, out.join("\n"));
console.log(`✓ ${file}（${reg.list.length} 个组件）`);
