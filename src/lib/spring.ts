import { clamp } from "./anim";

// ─────────────────────────────────────────────────────────────────────────────
// 移植自 opus-5-5-motion-gallery 的运动底座（机制照搬，写法改成纯函数 / React 友好）
// 台账与署名见 docs/OPUS55_ANIMATIONS.md 第三节。
//
// 为什么需要这一层：这批 demo 之所以「看起来高级」，不是画得多，而是三件事——
//   1) 一切位移用**闭式弹簧**（有解析解的阻尼振动），不是 cubic-bezier 近似；
//   2) 多参数联动时**每个参数一条独立弹簧**（几何慢、颜色临界阻尼不过冲、镜头略领先），
//      于是形变时主体尺寸不变、中间色不脏；
//   3) 要循环的片子，所有周期都取**整倍频**，t=0 与 t=D 严格相等，接缝看不出来。
// 这三条以前散落在各个组件里各写一遍，这里收成一个可复用的底座。
// ─────────────────────────────────────────────────────────────────────────────

/** 指数缓出（v02/v03 的入场范式：瞬间到位再沉降，天然「卡」在拍上） */
export const eoX = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)));
/** 指数缓入 */
export const eiX = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * (clamp(x) - 1)));
/** 指数两端缓动（大跨度变形用它，中段速度快） */
export const eioX = (x: number) => {
  const c = clamp(x);
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c < 0.5 ? Math.pow(2, 20 * c - 10) / 2 : (2 - Math.pow(2, -20 * c + 10)) / 2;
};
/** 三次缓入缓出（v14 的模型自变量插值用它，比 expo 温和，适合物理量） */
export const cubicIO = (x: number) => {
  const c = clamp(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

/**
 * 阻尼弹簧的阶跃响应（t 秒，w 固有频率，z 阻尼比）。
 * z>=1 临界阻尼不过冲 —— 颜色、读数必须用它，否则中间会闪过脏色/跳数。
 * 有解析解 ⇒ 任意时刻可求值，正好对上逐帧渲染，不需要状态机。
 */
export const spring = (t: number, w = 17, z = 0.78) => {
  if (t <= 0) return 0;
  if (z >= 1) {
    const e = Math.exp(-w * t);
    return 1 - e * (1 + w * t);
  }
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
};

/** 帧版的 spring：给绝对帧与起始帧，内部换算成秒 */
export const springF = (frame: number, at: number, fps: number, w = 17, z = 0.78) => spring((frame - at) / fps, w, z);

export type TrackStep = { t: number; v: number; w?: number; z?: number };

/**
 * 周期化弹簧轨道：一串「时刻 → 目标值」事件，值按闭式弹簧逐级追过去。
 * 传 period（秒）时加上镜像项 S(t−ti)+S(t−ti+D)−1，于是 v(0)=v(D)=末值回到 base 时
 * **首尾严格相等**，整条时间线无缝循环，且任何一帧都能独立求值（不用累积状态）。
 * 这就是 v07 一个形状能连续变形八种 UI 还不切镜头的全部秘密。
 */
export const makeTrack = (base: number, events: TrackStep[], period = 0) => {
  const steps: { t: number; d: number; w: number; z: number }[] = [];
  let prev = base;
  for (const ev of [...events].sort((a, b) => a.t - b.t)) {
    steps.push({ t: ev.t, d: ev.v - prev, w: ev.w ?? 17, z: ev.z ?? 0.78 });
    prev = ev.v;
  }
  return (t: number) => {
    let v = base;
    for (const s of steps) v += s.d * (spring(t - s.t, s.w, s.z) + (period > 0 ? spring(t - s.t + period, s.w, s.z) - 1 : 0));
    return v;
  };
};

/** 多参数联动：几何走默认弹簧，颜色走临界阻尼，镜头略领先（时刻减 lead 秒） */
export const trackSet = <K extends string>(base: Record<K, number>, keys: { t: number; v: Partial<Record<K, number>> }[], period = 0) => {
  const out = {} as Record<K, (t: number) => number>;
  (Object.keys(base) as K[]).forEach((k) => {
    out[k] = makeTrack(base[k], keys.filter((e) => typeof e.v[k] === "number").map((e) => ({ t: e.t, v: e.v[k] as number })), period);
  });
  return out;
};

/** 橡皮筋：越界 e 被拖出多远，resist 是阻力尺度，永远拖不到 asymptote 之外（v07 的「拖过头还在拉」） */
export const rubber = (e: number, resist = 92) => (e <= 0 ? 0 : resist * (1 - Math.exp(-e / resist)));

/** 按下挤压：一个 0→0.045→0 的短脉冲，乘在 scale 上（多次点击可累加） */
export const press = (t: number, at: number, amount = 0.045) =>
  amount * Math.max(0, spring(t - at + 0.04, 30, 1) - spring(t - at - 0.08, 22, 0.8));

// ── 节拍：BPM 网格 ───────────────────────────────────────────────────────────
export const beatSec = (bpm: number) => 60 / Math.max(1, bpm);
/** 把任意秒数吸到拍子上（往下一拍，留一点余量免得和上一拍撞车） */
export const snapBeat = (t: number, bpm: number, lead = 0.06) => Math.ceil((t + lead) / beatSec(bpm)) * beatSec(bpm);
/** 第几拍（给 HUD 打点用） */
export const beatIndex = (t: number, bpm: number) => Math.floor(t / beatSec(bpm));

// ── 无缝循环三件套 ───────────────────────────────────────────────────────────
/** 整倍频振荡：mult 取整数 ⇒ D 秒后相位回到原点，循环处不跳 */
export const harm = (t: number, D: number, mult: number, phase = 0) => Math.sin((2 * Math.PI * Math.round(mult) * t) / D + phase);
/** 虚线流动：offset 在 D 秒内走过的距离必须是 dash 周期的整数倍，接缝才闭得上 */
export const dashFlow = (t: number, D: number, cycles: number, dashPeriod: number) => (Math.round(cycles) * dashPeriod * t) / D;
/** 循环时间距离：t 到相位 c（周期 D）的最短距离，跨 0 点也算得通 */
export const circDist = (t: number, c: number, D: number) => {
  const d = Math.abs(((t - c) % D + D) % D);
  return Math.min(d, D - d);
};
/** 环绕窗口：标签在 [a, a+len] 这段相位里淡入淡出，a 可以跨过 0 点（v19 的蒸发标签就是这么接上循环的） */
export const wrapWin = (t: number, a: number, len: number, D: number, fade = 0.35) => {
  const u = (((t - a) % D) + D) % D;
  if (u > len) return 0;
  const sm = (x: number) => {
    const c = clamp(x);
    return c * c * (3 - 2 * c);
  };
  return sm(u / fade) * sm((len - u) / fade);
};
/** 粒子生命相位：寿命 L 必须整除 D，出生/死亡包络 sin(πu) 在接缝处恒为 0 */
export const lifeU = (t: number, L: number, phase = 0) => (((t / L + phase) % 1) + 1) % 1;

// ── 颜色：morph 时逐通道插值（记得配临界阻尼的轨道，才不过冲） ────────────────
const hex2rgb = (h: string) => {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mixHex = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex2rgb(a);
  const [r2, g2, b2] = hex2rgb(b);
  const k = clamp(t);
  const c = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
};

// ── 路径：航点 → Catmull-Rom 折线（v19 的水流/支流就是这么来的） ─────────────
export type Pt = { x: number; y: number };
export const spline = (pts: Pt[], per = 12): Pt[] => {
  if (pts.length < 3) return pts;
  const p = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b, c, d] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * b.x + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3),
        y: 0.5 * (2 * b.y + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};
export const atPath = (path: Pt[], u: number): Pt => {
  const x = clamp(u) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(x));
  const f = x - i;
  return { x: path[i].x + (path[i + 1].x - path[i].x) * f, y: path[i].y + (path[i + 1].y - path[i].y) * f };
};

// ── 子帧运动模糊：同一场景在快门窗口里采 n 次，权重 1/i 谐波叠加 ──────────────
// 用法：samples(t, 8, 1/45).map((s, i) => <div style={{ opacity: 1/(i+1), ...draw(s) }} />)
// 只在**快速横扫**的那一段开（v03 只在 0.6s 的 whip 上用），静止时开只会糊。
export const samples = (t: number, n = 8, span = 1 / 45) =>
  Array.from({ length: n }, (_, i) => ({ t: t + (i / (n - 1) - 0.5) * span, w: 1 / (i + 1) }));
