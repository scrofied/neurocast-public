import React from "react";
import { useCurrentFrame } from "remotion";
import { clamp, E, h1 } from "./core";
import { rgba } from "./look";

// ── 光效 / 画面质感 ────────────────────────────────────────────────────
// 全部是绝对定位的全幅层，按秒驱动（t = 当前秒）。

const full: React.CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

// 闪光：at 瞬间到峰值，len 秒内平方衰减
export const Flash: React.FC<{ t: number; at: number; len?: number; peak?: number; color?: string; blend?: React.CSSProperties["mixBlendMode"] }> = ({ t, at, len = 0.3, peak = 0.8, color = "#fff", blend }) => {
  if (t < at || t > at + len) return null;
  const k = 1 - (t - at) / len;
  return <div style={{ ...full, background: color, opacity: peak * k * k, mixBlendMode: blend }} />;
};

// 胶片颗粒（每帧换种子）
export const Grain: React.FC<{ amount: number; dark?: boolean }> = ({ amount, dark = true }) => {
  const f = useCurrentFrame();
  if (amount <= 0) return null;
  const id = `g${f % 7}`;
  return (
    <svg width="100%" height="100%" style={{ ...full, opacity: amount * (dark ? 0.16 : 0.1), mixBlendMode: "overlay" }}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 7} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
};

// 暗角
export const Vignette: React.FC<{ amount: number; color?: string; inner?: number }> = ({ amount, color = "#000", inner = 0.42 }) =>
  amount <= 0 ? null : <div style={{ ...full, background: `radial-gradient(ellipse at 50% 50%, transparent ${inner * 100}%, ${rgba(color, clamp(amount))} 100%)` }} />;

// 一侧压暗（让字在亮画面上读得清）
export const Scrim: React.FC<{ side: "left" | "right" | "top" | "bottom"; size?: number; strength?: number; color?: string; opacity?: number }> = ({ side, size = 0.5, strength = 0.75, color = "#000", opacity = 1 }) => {
  const dir = { left: "90deg", right: "270deg", top: "180deg", bottom: "0deg" }[side];
  return <div style={{ ...full, opacity: clamp(opacity), background: `linear-gradient(${dir}, ${rgba(color, strength)} 0%, ${rgba(color, strength * 0.6)} ${size * 50}%, ${rgba(color, 0)} ${size * 100}%)` }} />;
};

// 漏光：两团模糊的暖光从一侧扫过（screen 混合）
export const LightLeak: React.FC<{ t: number; at: number; len?: number; color: string; color2?: string; from?: "left" | "right"; strength?: number; W: number; H: number }> = ({ t, at, len = 1.2, color, color2, from = "left", strength = 0.85, W, H }) => {
  if (t < at || t > at + len) return null;
  const p = (t - at) / len;
  const a = Math.sin(Math.PI * clamp(p)) * strength;
  const s = from === "left" ? 1 : -1;
  const x = W / 2 + s * (-0.75 + 1.5 * E.inOut(p)) * W * 0.6;
  return (
    <div style={{ ...full, mixBlendMode: "screen", opacity: a }}>
      <div style={{ position: "absolute", left: x - W * 0.35, top: -H * 0.25, width: W * 0.7, height: H * 1.5, borderRadius: "50%", background: `radial-gradient(ellipse, ${rgba(color, 0.95)}, ${rgba(color, 0)} 65%)`, filter: `blur(${W * 0.03}px)`, transform: `rotate(${18 * s}deg)` }} />
      <div style={{ position: "absolute", left: x - W * 0.12 + s * W * 0.16, top: H * 0.1, width: W * 0.24, height: H * 0.9, borderRadius: "50%", background: `radial-gradient(ellipse, ${rgba(color2 ?? "#ffffff", 0.9)}, transparent 60%)`, filter: `blur(${W * 0.02}px)` }} />
    </div>
  );
};

// 冲击环
export const Ring: React.FC<{ t: number; at: number; x: number; y: number; color: string; len?: number; r?: number; w?: number }> = ({ t, at, x, y, color, len = 0.55, r = 500, w = 8 }) => {
  if (t < at || t > at + len) return null;
  const p = (t - at) / len;
  const R = r * E.out5(p);
  return <div style={{ position: "absolute", left: x - R, top: y - R, width: R * 2, height: R * 2, borderRadius: "50%", border: `${Math.max(0.5, w * (1 - p))}px solid ${color}`, opacity: 1 - p, boxShadow: `0 0 ${40 * (1 - p)}px ${color}, inset 0 0 ${30 * (1 - p)}px ${color}`, pointerEvents: "none" }} />;
};

// 火花 / 碎屑爆散（带重力）
export const Sparks: React.FC<{ t: number; at: number; x: number; y: number; color: string; n?: number; speed?: number; len?: number; seed?: number; size?: number; gravity?: number }> = ({ t, at, x, y, color, n = 36, speed = 900, len = 0.9, seed = 1, size = 1, gravity = 900 }) => {
  if (t < at || t > at + len) return null;
  const dt = t - at;
  const k = 1 - dt / len;
  return (
    <svg width="100%" height="100%" style={full}>
      {Array.from({ length: n }, (_, i) => {
        const a = h1(i, seed) * Math.PI * 2;
        const v = speed * (0.35 + h1(i, seed + 1) * 0.65);
        const drag = (1 - Math.exp(-dt * 3)) / 3;
        const px = x + Math.cos(a) * v * drag;
        const py = y + Math.sin(a) * v * drag + 0.5 * gravity * dt * dt;
        const vx = Math.cos(a) * v * Math.exp(-dt * 3);
        const vy = Math.sin(a) * v * Math.exp(-dt * 3) + gravity * dt;
        const L = 0.028;
        return <line key={i} x1={px} y1={py} x2={px - vx * L} y2={py - vy * L} stroke={color} strokeWidth={(1.5 + h1(i, seed + 2) * 3) * size} strokeLinecap="round" opacity={k * (0.5 + h1(i, seed + 3) * 0.5)} />;
      })}
    </svg>
  );
};

// 浮尘（空气里的光粒子，常驻）
export const Dust: React.FC<{ t: number; W: number; H: number; color?: string; n?: number; seed?: number; opacity?: number }> = ({ t, W, H, color = "#fff", n = 40, seed = 3, opacity = 0.5 }) => (
  <svg width="100%" height="100%" style={{ ...full, mixBlendMode: "screen" }}>
    {Array.from({ length: n }, (_, i) => {
      const sp = 8 + h1(i, seed) * 24;
      const x = (h1(i, seed + 1) * W + Math.sin(t * 0.4 + i) * 30 + t * sp) % W;
      const y = (h1(i, seed + 2) * H - t * sp * 0.6 + H * 10) % H;
      const r = 0.8 + h1(i, seed + 3) * 2.2;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.7 + h1(i, seed + 4)) + i));
      return <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={opacity * tw * (r > 2.4 ? 0.5 : 1)} />;
    })}
  </svg>
);

// 宽银幕遮幅：k 0→1 上下黑边从 0 长到目标比例
export const Letterbox: React.FC<{ k: number; W: number; H: number; ratio?: number; color?: string }> = ({ k, W, H, ratio = 2.39, color = "#000" }) => {
  const bar = Math.max(0, (H - W / ratio) / 2) * clamp(k);
  if (bar <= 0.5) return null;
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: color }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: color }} />
    </>
  );
};

// 速度线（放射）
export const SpeedLines: React.FC<{ t: number; at: number; x: number; y: number; color: string; len?: number; n?: number; inner?: number; seed?: number; W: number }> = ({ t, at, x, y, color, len = 0.45, n = 30, inner = 280, seed = 2, W }) => {
  if (t < at || t > at + len) return null;
  const p = (t - at) / len;
  return (
    <svg width="100%" height="100%" style={{ ...full, opacity: 1 - p }}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + h1(i, seed) * 0.12;
        const r0 = inner + p * W * 0.1 + h1(i, seed + 1) * 60;
        const r1 = r0 + W * (0.1 + h1(i, seed + 2) * 0.18);
        return <line key={i} x1={x + Math.cos(a) * r0} y1={y + Math.sin(a) * r0} x2={x + Math.cos(a) * r1} y2={y + Math.sin(a) * r1} stroke={color} strokeWidth={1.5 + (i % 3) * 1.5} strokeLinecap="round" />;
      })}
    </svg>
  );
};

// 扫描光条（横向一道亮带扫过某个区域）
export const Sweep: React.FC<{ t: number; at: number; len?: number; color?: string; angle?: number }> = ({ t, at, len = 0.7, color = "#fff", angle = 20 }) => {
  if (t < at || t > at + len) return null;
  const p = E.inOut((t - at) / len);
  return <div style={{ ...full, mixBlendMode: "overlay", background: `linear-gradient(${90 + angle}deg, transparent ${p * 140 - 30}%, ${rgba(color, 0.85)} ${p * 140 - 15}%, transparent ${p * 140}%)` }} />;
};
