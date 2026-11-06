import { useCurrentFrame } from "remotion";
const FPS = 30;

export const useT = () => useCurrentFrame() / FPS;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lin = (t: number, a: number, b: number) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export const eOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const eInCubic = (x: number) => x * x * x;
export const eInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const eInExpo = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
export const eOutBack = (x: number, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
export const eOutElastic = (x: number) => {
  const c4 = (2 * Math.PI) / 3;
  return x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
};

/** eased progress from a to b */
export const p = (t: number, a: number, b: number, ease: (x: number) => number = eOutCubic) => ease(lin(t, a, b));

/** envelope: fade in over fin after a, fade out over fout before b */
export const env = (t: number, a: number, b: number, fin = 0.25, fout = 0.25) =>
  Math.min(fin <= 0 ? (t >= a ? 1 : 0) : lin(t, a, a + fin), fout <= 0 ? (t <= b ? 1 : 0) : 1 - lin(t, b - fout, b));

export const fract = (x: number) => x - Math.floor(x);
export const rnd = (i: number) => fract(Math.sin(i * 12.9898 + 78.233) * 43758.5453);
export const rndr = (i: number, a: number, b: number) => a + (b - a) * rnd(i);

/** impulse that decays: 0 before `at`, peaks 1 at `at` */
export const hit = (t: number, at: number, decay = 0.25) => (t < at ? 0 : Math.exp(-(t - at) / decay));

/** flicker on entry */
export const flicker = (t: number, a: number, dur = 0.35, seed = 1) => {
  if (t < a) return 0;
  if (t > a + dur) return 1;
  const k = Math.floor((t - a) * 60);
  const r = rnd(k * 7.13 + seed * 3.7);
  return r > 0.45 ? 1 : 0.15 + r;
};

export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return mix(rnd(i + seed * 101.3), rnd(i + 1 + seed * 101.3), u) * 2 - 1;
};

export const sec = (s: number) => Math.round(s * FPS);
