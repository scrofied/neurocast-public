import { z } from "zod";

// ── 调色 / 字体 ──────────────────────────────────────────────────────
// look = 一套电影调色（底色、主光、强调、危险色、颗粒、暗角）。每个模板都能换 look，
// 同一个模板换 look + 换文案 = 一条全新的开场。

export type Look = {
  bg: string; // 底色（最暗处）
  bg2: string; // 次暗（光晕中心）
  ink: string; // 主文字
  key: string; // 主光色
  accent: string; // 强调色（钩子词）
  danger: string; // 危险 / 否定
  gold: string; // 高亮 / 结论
  dim: string; // 次要文字
  grain: number; // 胶片颗粒 0~1
  vignette: number; // 暗角 0~1
};

export const LOOKS: Record<string, Look> = {
  // 黑金：高级、商业、结论感
  noir: { bg: "#050505", bg2: "#17130c", ink: "#f5efe4", key: "#ffd27a", accent: "#ffb23e", danger: "#ff4a4a", gold: "#ffd36b", dim: "#8f877a", grain: 0.5, vignette: 0.75 },
  // 冰蓝：科技、冷静
  ice: { bg: "#02060c", bg2: "#071a2c", ink: "#eef8ff", key: "#7fe3ff", accent: "#38f3ff", danger: "#ff5d6c", gold: "#ffe08a", dim: "#7f98b3", grain: 0.35, vignette: 0.65 },
  // 血红：警告、危机、扎心
  blood: { bg: "#070203", bg2: "#2a0508", ink: "#fff1ee", key: "#ff5b4a", accent: "#ff2e3b", danger: "#ff2e3b", gold: "#ffd36b", dim: "#b38a86", grain: 0.55, vignette: 0.8 },
  // 赛博：AI、未来、潮
  neon: { bg: "#05030d", bg2: "#1d0a36", ink: "#f6f0ff", key: "#b18cff", accent: "#ff4fd8", danger: "#ff4a6e", gold: "#5ef5ff", dim: "#9a8cbc", grain: 0.4, vignette: 0.7 },
  // 酸性：反常识、年轻、冲
  acid: { bg: "#030703", bg2: "#0c2410", ink: "#f2ffe8", key: "#c6ff3d", accent: "#d8ff2e", danger: "#ff4a4a", gold: "#d8ff2e", dim: "#8fb38a", grain: 0.45, vignette: 0.7 },
  // 纸白：浅色干货风（亮底黑字）
  paper: { bg: "#f2ede4", bg2: "#ffffff", ink: "#111111", key: "#ff5a1f", accent: "#ff5a1f", danger: "#e02424", gold: "#ff9f1c", dim: "#6b665e", grain: 0.25, vignette: 0.35 },
};
export type LookName = keyof typeof LOOKS;

// 每个模板用 lookEnum.default("xxx") 指定自己的默认调色
export const lookEnum = z.enum(["noir", "ice", "blood", "neon", "acid", "paper"]).describe("调色：noir 黑金 / ice 冰蓝 / blood 血红 / neon 赛博 / acid 酸性 / paper 纸白");
export const resolveLook = (name?: string, over?: Partial<Look>): Look => ({ ...(LOOKS[name ?? "noir"] ?? LOOKS.noir), ...(over ?? {}) });

// hex 颜色混合（t=0 → a，t=1 → b）
export const mixHex = (a: string, b: string, t: number) => {
  const p = (h: string) => {
    const s = h.replace("#", "");
    const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const x = p(a);
  const y = p(b);
  const k = Math.min(1, Math.max(0, t));
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
};

// 粗体中文字体栈（Windows 自带优先；Mac/Linux 回落到苹方/思源）
// ProSans = 随包带的 Noto Sans SC 可变字体（stage.tsx 加载），保证任何机器都有 900 字重
export const FONT = {
  heavy: '"ProSans","Microsoft YaHei UI","Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif',
  title: '"ProSans","Microsoft YaHei UI","Microsoft YaHei","PingFang SC",sans-serif',
  num: '"Bahnschrift","DIN Alternate","Segoe UI","Arial Narrow",sans-serif',
  mono: '"Cascadia Code",Consolas,"SF Mono",monospace',
  latin: '"Segoe UI Black","Arial Black","Helvetica Neue",sans-serif',
};

export const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
export const isLight = (hex: string) => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150;
};
