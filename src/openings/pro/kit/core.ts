import { useCurrentFrame, useVideoConfig } from "remotion";

// ── PRO 开场工具包 · 核心 ──────────────────────────────────────────────
// 这个目录（src/openings/pro/）是独立资产：只依赖 remotion / react / zod，
// 不依赖 NeuroCast 的引擎、主题或组件库。所有时间单位都是「秒」。

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const E = {
  out: (t: number) => 1 - Math.pow(1 - clamp(t), 3),
  out5: (t: number) => 1 - Math.pow(1 - clamp(t), 5),
  in: (t: number) => Math.pow(clamp(t), 3),
  in2: (t: number) => Math.pow(clamp(t), 2),
  inOut: (t: number) => {
    t = clamp(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
  expo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t))),
  expoIn: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * (clamp(t) - 1))),
  back: (t: number, s = 1.70158) => {
    const x = clamp(t) - 1;
    return 1 + (s + 1) * x * x * x + s * x * x;
  },
  // 阻尼弹簧 0→1（约 0.26 处冲到 1.2，再回落）
  spring: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(12 * t)),
};

// deterministic pseudo random [0,1)
export const h1 = (i: number, s = 0) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// smooth value noise [-1,1]
export const noise = (x: number, s = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const k = f * f * (3 - 2 * f);
  return mix(h1(i, s) * 2 - 1, h1(i + 1, s) * 2 - 1, k);
};

// 时钟：模板里只用秒。duration 由模板 props 决定（独立渲染 = 合成时长；嵌进别的工程 = 那一段的长度）
export const useClock = (duration?: number) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const dur = duration ?? durationInFrames / fps;
  const W = width;
  const H = height;
  const u = Math.min(W, H) / 1080; // 尺寸单位：1080 短边 = 1
  const portrait = H > W;
  const p = (at: number, len: number) => clamp((t - at) / Math.max(1e-6, len));
  return { frame, fps, t, dur, W, H, u, portrait, p };
};
export type Clock = ReturnType<typeof useClock>;

// 衰减抖动（镜头被砸了一下）
export type Hit = { at: number; amp?: number; len?: number };
export const shake = (t: number, hits: Hit[], seed = 0) => {
  let x = 0;
  let y = 0;
  let r = 0;
  hits.forEach((h, i) => {
    const len = h.len ?? 0.4;
    if (t < h.at || t > h.at + len) return;
    const k = 1 - (t - h.at) / len;
    const a = (h.amp ?? 18) * k * k;
    x += noise(t * 55, seed + i * 7) * a;
    y += noise(t * 61, seed + i * 7 + 3) * a;
    r += noise(t * 43, seed + i * 7 + 5) * a * 0.05;
  });
  return { x, y, r };
};

// 推镜冲击：快速放大再回落到 hold 比例
export const punch = (t: number, at: number, amt = 0.08, len = 0.5, hold = 0.4) => {
  if (t < at) return 1;
  const up = E.out((t - at) / 0.12);
  const down = E.out((t - at - 0.12) / len);
  return 1 + amt * (up - down * (1 - hold));
};

// 起音 attack 秒线性升到 1，再按 decay 秒指数衰减（光效、闪光、冲击）
export const ad = (t: number, at: number, attack = 0.04, decay = 0.35) =>
  t < at ? 0 : t < at + attack ? (t - at) / Math.max(1e-6, attack) : Math.exp((-(t - at - attack) / Math.max(1e-6, decay)) * 2.3);

// 衰减脉冲包络（心跳、闪光）：at 之后指数衰减
export const pulse = (t: number, at: number, k = 7) => (t >= at ? Math.exp(-(t - at) * k) : 0);
export const pulses = (t: number, ats: number[], k = 7) => ats.reduce((s, a) => s + pulse(t, a, k), 0);

// 文字宽度估算（em）：中文 1，英文/数字 0.58，空格 0.3
export const ems = (s: string) => Array.from(s).reduce((w, c) => w + (/[\u0000-ÿ]/.test(c) ? (c === " " ? 0.3 : 0.58) : 1), 0);
// 在 maxW 像素里放下 text 的字号
export const fitSize = (text: string, maxW: number, max: number, min = 12) => Math.max(min, Math.min(max, maxW / Math.max(1, ems(text))));

// 太长就在标点处断成两行
export const wrap2 = (s: string, maxEms: number): string[] => {
  if (s.includes("\n")) return s.split("\n").slice(0, 3);
  if (ems(s) <= maxEms) return [s];
  const chars = Array.from(s);
  const mid = chars.length / 2;
  let best = -1;
  chars.forEach((c, i) => {
    if (/[，,、；;：:！!？? ]/.test(c) && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  });
  const k = best >= 0 ? best + 1 : Math.ceil(mid);
  return [chars.slice(0, k).join("").trim(), chars.slice(k).join("").trim()].filter(Boolean);
};
