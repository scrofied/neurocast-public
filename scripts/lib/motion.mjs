// ─────────────────────────────────────────────────────────────────────────────
// 动效枚举的唯一权威副本（脚本侧）
//
// ⚠ ENTER_KINDS 必须与 src/lib/enter.tsx 保持一致；make.mjs 启动时会比对两处，
//   不一致直接报错。改一处必须同步另一处。
// ─────────────────────────────────────────────────────────────────────────────

/** 元素入场语法（与 src/lib/enter.tsx 的 ENTER_KINDS 同步） */
export const ENTER_KINDS = ["rise", "slam", "slide-l", "slide-r", "wipe", "assemble", "zoom-through", "drop"];

/** 镜头级转场（与 src/engine/ShotFrame.tsx 的实现一一对应） */
export const TRANSITIONS = ["fly", "warp", "iris", "glitch", "fade", "cut"];

const TRANSITION_SFX = { fly: "whoosh", warp: "whoosh", iris: "swish", glitch: "glitch" };

export const isEnterKind = (v) => ENTER_KINDS.includes(v);
export const isTransition = (v) => TRANSITIONS.includes(v);
export const sfxForTransition = (v) => TRANSITION_SFX[v];

/**
 * 同一组件第 n 次出现时自动错开一种入场语法。
 * 这是「单变体组件被复用时也长得不一样」的兜底：分镜没写 motion.enter 时才用。
 */
export const autoEnterFor = (type, n) => {
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  return ENTER_KINDS[(h + n) % ENTER_KINDS.length];
};

/** 校验分镜 shot 里的 motion 字段，返回问题列表（空数组 = 合法） */
export const validateMotion = (m, where) => {
  const issues = [];
  if (m == null) return issues;
  if (typeof m !== "object" || Array.isArray(m)) {
    issues.push(`${where}：motion 必须是对象，形如 { "enter": "slam", "transition": "cut", "energy": 3 }`);
    return issues;
  }
  const known = new Set(["enter", "transition", "energy"]);
  for (const k of Object.keys(m)) if (!known.has(k)) issues.push(`${where}：motion.${k} 不是可识别字段（可用：enter, transition, energy）`);
  if (m.enter !== undefined && !isEnterKind(m.enter)) issues.push(`${where}：motion.enter「${m.enter}」不存在（可用：${ENTER_KINDS.join("、")}）`);
  if (m.transition !== undefined && !isTransition(m.transition)) issues.push(`${where}：motion.transition「${m.transition}」不存在（可用：${TRANSITIONS.join("、")}）`);
  if (m.energy !== undefined && ![1, 2, 3].includes(m.energy)) issues.push(`${where}：motion.energy 必须是 1 / 2 / 3（当前 ${JSON.stringify(m.energy)}）`);
  return issues;
};

/** 渲染侧（TSX）与脚本侧的 ENTER_KINDS 必须完全一致；返回错误字符串或 null */
export const checkKindParity = (tsxSource, scriptList = ENTER_KINDS) => {
  const m = String(tsxSource).match(/ENTER_KINDS\s*=\s*\[([^\]]+)\]/);
  if (!m) return "无法从 src/lib/enter.tsx 里解析 ENTER_KINDS";
  const list = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const a = list.join(",");
  const b = scriptList.join(",");
  return a === b ? null : `ENTER_KINDS 两处不一致：src/lib/enter.tsx = [${a}]，scripts/lib/motion.mjs = [${b}]`;
};
