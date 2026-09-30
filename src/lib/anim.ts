export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const prog = (f: number, start: number, dur: number) => clamp((f - start) / Math.max(1, dur));
export const smooth = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp(t), 5);
export const easeIn = (t: number) => Math.pow(clamp(t), 3);
export const easeInOut = (t: number) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  t = clamp(t);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const rng = (seed: number) => {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// deterministic pseudo-noise in [-1,1]
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const r = (n: number) => {
    const s = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  return lerp(r(i), r(i + 1), smooth(f));
};

export type Vec3 = { x: number; y: number; z: number };
export const rotY = (p: Vec3, a: number): Vec3 => ({
  x: p.x * Math.cos(a) + p.z * Math.sin(a),
  y: p.y,
  z: -p.x * Math.sin(a) + p.z * Math.cos(a),
});
export const rotX = (p: Vec3, a: number): Vec3 => ({
  x: p.x,
  y: p.y * Math.cos(a) - p.z * Math.sin(a),
  z: p.y * Math.sin(a) + p.z * Math.cos(a),
});
// perspective projection; camera at z = -dist looking +z
export const project = (p: Vec3, cx: number, cy: number, fov = 900, dist = 900) => {
  const z = p.z + dist;
  const s = fov / Math.max(1, z);
  return { x: cx + p.x * s, y: cy + p.y * s, s, z };
};
