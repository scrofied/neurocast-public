import React from "react";
import { clamp } from "../anim";

// full-frame light wash ("闪白"). Peaks instantly at `at`, decays over `len` frames.
// Put it BELOW text layers so frame 0 can already show the headline on top of the flash.
export const Flash: React.FC<{ frame: number; at: number; len?: number; peak?: number; color?: string; blend?: React.CSSProperties["mixBlendMode"] }> = ({
  frame,
  at,
  len = 9,
  peak = 0.85,
  color = "#ffffff",
  blend,
}) => {
  if (frame < at || frame > at + len) return null;
  const k = clamp(1 - (frame - at) / len);
  return <div style={{ position: "absolute", inset: 0, background: color, opacity: peak * k * k, mixBlendMode: blend, pointerEvents: "none" }} />;
};

// expanding shock ring from a point — reads as an impact without covering the face
export const RingBurst: React.FC<{ frame: number; at: number; x: number; y: number; color: string; len?: number; maxR?: number; width?: number }> = ({
  frame,
  at,
  x,
  y,
  color,
  len = 16,
  maxR = 420,
  width = 10,
}) => {
  if (frame < at || frame > at + len) return null;
  const p = (frame - at) / len;
  const r = maxR * (1 - Math.pow(1 - p, 3));
  return (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        border: `${Math.max(1, width * (1 - p))}px solid ${color}`,
        opacity: 1 - p,
        boxShadow: `0 0 ${30 * (1 - p)}px ${color}`,
        pointerEvents: "none",
      }}
    />
  );
};

// radial speed lines burst (漫画速度线) around a focus point
export const SpeedLines: React.FC<{ frame: number; at: number; x: number; y: number; color: string; len?: number; count?: number; inner?: number; seed?: number }> = ({
  frame,
  at,
  x,
  y,
  color,
  len = 14,
  count = 28,
  inner = 260,
  seed = 1,
}) => {
  if (frame < at || frame > at + len) return null;
  const p = (frame - at) / len;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 1 - p }}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.sin(i * 12.9898 + seed) * 0.08;
        const r0 = inner + p * 180 + (Math.sin(i * 78.233 + seed) * 0.5 + 0.5) * 80;
        const r1 = r0 + 180 + (Math.sin(i * 3.7 + seed) * 0.5 + 0.5) * 260;
        return <line key={i} x1={x + Math.cos(a) * r0} y1={y + Math.sin(a) * r0} x2={x + Math.cos(a) * r1} y2={y + Math.sin(a) * r1} stroke={color} strokeWidth={2 + (i % 3) * 2} strokeLinecap="round" />;
      })}
    </svg>
  );
};

// side / bottom darkening so white headline text stays legible on a bright room
export const Scrim: React.FC<{ side: "left" | "right" | "bottom" | "top"; size?: number; strength?: number; color?: string; opacity?: number }> = ({
  side,
  size = 0.45,
  strength = 0.6,
  color = "0,0,0",
  opacity = 1,
}) => {
  const dir = { left: "90deg", right: "270deg", bottom: "0deg", top: "180deg" }[side];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: clamp(opacity),
        background: `linear-gradient(${dir}, rgba(${color},${strength}) 0%, rgba(${color},${strength * 0.55}) ${size * 55}%, rgba(${color},0) ${size * 100}%)`,
        pointerEvents: "none",
      }}
    />
  );
};
