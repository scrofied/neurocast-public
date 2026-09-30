import { clamp, easeOut, easeOutBack, prog } from "./anim";

// Cues are frame offsets inside the shot, resolved by the planner from anchor words in the 文案
// (e.g. { at: "封面" } becomes the frame where "封面" is spoken). Components fall back to a stagger.
export const cueOr = (at: number | undefined, fallback: number) => (typeof at === "number" && Number.isFinite(at) ? Math.max(0, at) : fallback);

// sequential cues for a list: explicit `at` wins, otherwise spread items over [from, to]
export const listCues = (items: { at?: number }[], from: number, to: number) => {
  const n = items.length;
  const step = n > 1 ? (to - from) / (n - 1) : 0;
  return items.map((it, i) => cueOr(it.at, from + i * step));
};

export const appear = (frame: number, at: number, len = 14) => easeOut(prog(frame, at, len));
export const pop = (frame: number, at: number, len = 16) => easeOutBack(prog(frame, at, len));
export const after = (frame: number, at: number) => frame >= at;

// typewriter: how many chars of `text` are visible if typing starts at `at` and must finish by `done`
export const typed = (text: string, frame: number, at: number, done: number) => {
  const chars = Array.from(text);
  const k = clamp((frame - at) / Math.max(1, done - at));
  return chars.slice(0, Math.round(k * chars.length)).join("");
};

// compact Chinese number: 870000 -> 87万, 96000 -> 9.6万, 1200000 -> 120万
export const cnNum = (v: number) => {
  if (Math.abs(v) >= 1e8) return `${+(v / 1e8).toFixed(1)}亿`;
  if (Math.abs(v) >= 1e4) return `${+(v / 1e4).toFixed(v >= 1e5 ? 0 : 1)}万`;
  return String(Math.round(v));
};
