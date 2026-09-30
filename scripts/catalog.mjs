// Generate CATALOG.md from the component registry (the single source of truth).
// node scripts/catalog.mjs   -> CATALOG.md
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
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
  "",
  "## 速查",
  "",
  "| id | 名称 | 适用 |",
  "|---|---|---|",
  ...reg.list.map((c) => `| \`${c.id}\` | ${c.name} | ${(c.use || c.tags.join("、") || "").replace(/\|/g, "\\|")} |`),
  "",
];
for (const [layer, list] of Object.entries(byLayer)) {
  out.push(`## ${LAYER[layer] || layer}`, "");
  for (const c of list) {
    const flags = [`${c.minSec}–${c.maxSec}s`, `变体 ${c.variants}`, c.panel ? "可放侧栏" : "", c.hideCaptions ? "自动隐藏字幕" : ""].filter(Boolean).join(" · ");
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
