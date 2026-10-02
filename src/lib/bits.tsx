import React from "react";
import { clamp, easeOut, easeOutBack, noise1, prog } from "./anim";
import { alpha, useTheme } from "./theme";
import { fitFont } from "./ui";

// Small shared pieces for the 2026-10 component batch (stamps, chips, ticks, shake).

/** 结论章：从 2 倍砸下到 1，带旋转；at 之前不渲染 */
export const StampBox: React.FC<{ frame: number; at: number; text: string; color: string; x: number; y: number; size?: number; maxW?: number; rot?: number; anchor?: "center" | "left" }> = ({ frame, at, text, color, x, y, size = 76, maxW = 700, rot = -6, anchor = "center" }) => {
  const t = useTheme();
  if (frame < at) return null;
  const p = easeOut(prog(frame, at, 7));
  const s = 2 - p;
  const fs = fitFont(text, maxW, size, 24);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(${anchor === "center" ? "-50%" : "0"}, -50%) rotate(${rot}deg) scale(${s})`,
        transformOrigin: anchor === "center" ? "50% 50%" : "0 50%",
        opacity: clamp(p * 2),
        padding: `${fs * 0.14}px ${fs * 0.4}px`,
        border: `${Math.max(3, fs * 0.08)}px solid ${color}`,
        borderRadius: fs * 0.18,
        background: "rgba(0,0,0,.45)",
        fontFamily: t.font.title,
        fontWeight: 900,
        fontSize: fs,
        color,
        whiteSpace: "nowrap",
        textShadow: `0 0 24px ${alpha(color, 0.7)}`,
        boxShadow: `0 0 30px ${alpha(color, 0.35)}`,
      }}
    >
      {text}
    </div>
  );
};

/** 圆形 ✓ / ✗ 标记（SVG 外的 div 版），pop 入场 */
export const Mark: React.FC<{ frame: number; at: number; ok: boolean | null; x: number; y: number; size?: number }> = ({ frame, at, ok, x, y, size = 56 }) => {
  const t = useTheme();
  if (frame < at) return null;
  const p = easeOutBack(prog(frame, at, 10));
  const c = ok === null ? t.gold : ok ? t.primary : t.bad;
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: "50%", background: alpha(c, 0.18), border: `3px solid ${c}`, transform: `scale(${p})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 18px ${alpha(c, 0.55)}` }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        {ok === null ? <path d="M9 9a3 3 0 1 1 4 2.8c-.8.4-1 1-1 1.7M12 17.5v.01" /> : ok ? <polyline points="20 6 9 17 4 12" /> : <path d="M18 6L6 18M6 6l12 12" />}
      </svg>
    </div>
  );
};

/** 衰减抖动（px），hits 为若干冲击时刻 */
export const hitShake = (frame: number, hits: number[], amp = 14, len = 10, seed = 0) => {
  let x = 0;
  let y = 0;
  hits.forEach((h, i) => {
    if (frame < h || frame > h + len) return;
    const k = 1 - (frame - h) / len;
    x += noise1(frame * 2.7, seed + i * 7) * amp * k * k;
    y += noise1(frame * 3.1, seed + i * 7 + 3) * amp * k * k;
  });
  return { x, y };
};

/** 胶囊标签 */
export const Pill: React.FC<{ text: string; color: string; size?: number; style?: React.CSSProperties; solid?: boolean }> = ({ text, color, size = 30, style, solid }) => {
  const t = useTheme();
  return (
    <div style={{ position: "absolute", padding: `${size * 0.22}px ${size * 0.6}px`, borderRadius: size, background: solid ? color : alpha(t.bg, 0.82), border: `2px solid ${color}`, boxShadow: `0 0 16px ${alpha(color, 0.45)}`, fontFamily: t.font.title, fontWeight: 900, fontSize: size, color: solid ? t.bg : t.text, whiteSpace: "nowrap", ...style }}>
      {text}
    </div>
  );
};
