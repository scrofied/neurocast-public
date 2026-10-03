// ─────────────────────────────────────────────────────────────────────────────
// 动效枚举的唯一权威副本（脚本侧）
//
// ⚠ ENTER_KINDS 必须与 src/lib/enter.tsx 保持一致；make.mjs 启动时会比对两处，
//   不一致直接报错。改一处必须同步另一处。
// ─────────────────────────────────────────────────────────────────────────────

/** 元素入场语法（与 src/lib/enter.tsx 的 ENTER_KINDS 同步） */
export const ENTER_KINDS = ["rise", "slam", "slide-l", "slide-r", "wipe", "assemble", "zoom-through", "drop"];

/** 镜头级转场（与 src/engine/ShotFrame.tsx 的实现一一对应） */
export const TRANSITIONS = ["fly", "warp", "iris", "glitch", "fade", "cut", "flood", "zoom", "push", "wipe", "grid"];

/**
 * 形状连续转场：上一镜不淡出、不剪走，下一镜从上一镜画面里的一个形状长出来盖满全屏。
 * 这四种要「上一镜 + 下一镜」两边配合才成立，所以分镜里写在**入场**那一镜上。
 */
export const CONTINUITY = ["zoom", "push", "wipe", "grid"];

const TRANSITION_SFX = {
  fly: "whoosh", warp: "whoosh", iris: "swish", glitch: "glitch", flood: "impact",
  // zoom/push 是整块画面在动 → whoosh；wipe/grid 是扫过去 / 一格格铺开 → swish / glitch
  zoom: "whoosh", push: "swish", wipe: "swish", grid: "glitch",
};

export const isEnterKind = (v) => ENTER_KINDS.includes(v);
export const isTransition = (v) => TRANSITIONS.includes(v);
export const isContinuity = (v) => CONTINUITY.includes(v);
export const sfxForTransition = (v) => TRANSITION_SFX[v];

/**
 * shot.through = [中心x, 中心y, 宽, 高]，0~1 归一化：zoom 转场时「洞」在上一镜画面的哪儿。
 * 非法就返回 null（调用方给警告，然后按默认位置钻）。
 */
export const normThrough = (v) => {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const v4 = v.map((x) => Number(x));
  if (v4.some((x) => !Number.isFinite(x) || x < 0 || x > 1)) return null;
  if (v4[2] <= 0.01 || v4[3] <= 0.01) return null;
  return v4;
};

/** 全片后期层强度（src/engine/PostPass.tsx 消费）；倍率类可以到 2，其余 0~1 */
const POST_RANGE = { grain: [0, 1], vign: [0, 1], scan: [0, 1], chroma: [0, 2], tear: [0, 2] };

export const normPost = (v, warn = () => {}) => {
  if (v == null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) {
    warn(`post 必须是对象，形如 { "grain": 0.05, "tear": 0 }（可用：${Object.keys(POST_RANGE).join("、")}、flashOnCut），已忽略`);
    return undefined;
  }
  const out = {};
  for (const k of Object.keys(v)) {
    if (k === "flashOnCut") {
      out[k] = !!v[k];
      continue;
    }
    const rg = POST_RANGE[k];
    if (!rg) {
      warn(`post.${k} 不是可识别字段（可用：${Object.keys(POST_RANGE).join("、")}、flashOnCut），已忽略`);
      continue;
    }
    const n = Number(v[k]);
    if (!Number.isFinite(n)) {
      warn(`post.${k} 必须是数字（当前 ${JSON.stringify(v[k])}），已忽略`);
      continue;
    }
    out[k] = Math.min(rg[1], Math.max(rg[0], n));
  }
  return Object.keys(out).length ? out : undefined;
};

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

/**
 * 转场列表同样两处各一份（src/engine/ShotFrame.tsx / 这里）。
 * 漏同步的后果比 enter 更隐蔽：分镜写了个渲染层不认识的 transition，会掉进 glitch 兜底分支，
 * 画面「能动」但完全不是你要的转场，静默错到底。启动时比对，不一致直接报错。
 */
export const checkTransitionParity = (tsxSource, scriptList = TRANSITIONS) => {
  const m = String(tsxSource).match(/TRANSITIONS\s*=\s*\[([^\]]+)\]/);
  if (!m) return "无法从 src/engine/ShotFrame.tsx 里解析 TRANSITIONS";
  const list = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const a = list.join(",");
  const b = scriptList.join(",");
  return a === b ? null : `TRANSITIONS 两处不一致：src/engine/ShotFrame.tsx = [${a}]，scripts/lib/motion.mjs = [${b}]`;
};
