import { clamp, easeOut, noise1, prog } from "../anim";

// Camera-ish helpers for openings. Every function takes absolute frames and returns plain numbers,
// so they can drive any transform (text, overlay layer, the talking-head window).

// decaying hand-held shake after a hit: { x, y, r } in px / deg
export const shake = (frame: number, at: number, amp = 18, len = 12, seed = 0) => {
  if (frame < at || frame > at + len) return { x: 0, y: 0, r: 0 };
  const k = 1 - (frame - at) / len;
  const a = amp * k * k;
  return { x: noise1(frame * 1.7, seed) * a, y: noise1(frame * 1.9, seed + 3) * a, r: noise1(frame * 1.3, seed + 7) * a * 0.06 };
};

// several hits summed (e.g. every stamp in an opening)
export const shakes = (frame: number, hits: { at: number; amp?: number; len?: number }[], seed = 0) =>
  hits.reduce(
    (o, h, i) => {
      const s = shake(frame, h.at, h.amp, h.len, seed + i * 11);
      return { x: o.x + s.x, y: o.y + s.y, r: o.r + s.r };
    },
    { x: 0, y: 0, r: 0 },
  );

// punch-in: quick zoom spike that settles to `rest` (1 + amount * (1 - hold)) — "推镜头"
export const punch = (frame: number, at: number, amount = 0.08, len = 16, hold = 0.5) => {
  if (frame < at) return 1;
  const up = easeOut(prog(frame, at, 4));
  const down = easeOut(prog(frame, at + 4, len));
  return 1 + amount * (up - down * (1 - hold));
};

// 0..1 envelope: fast attack, hold, release — for anything that should blink in and out
export const env = (frame: number, at: number, attack: number, hold: number, release: number) => {
  if (frame < at) return 0;
  if (frame < at + attack) return (frame - at) / Math.max(1, attack);
  if (frame < at + attack + hold) return 1;
  return clamp(1 - (frame - at - attack - hold) / Math.max(1, release));
};

// constant idle drift so nothing is ever perfectly still ("画面始终在动")
export const drift = (frame: number, amp = 6, speed = 0.03, seed = 0) => ({
  x: noise1(frame * speed, seed) * amp,
  y: noise1(frame * speed, seed + 5) * amp,
});
