import React from "react";
import { clamp, easeIn, easeOut, easeOutBack, prog } from "../anim";

// Big-type primitives for openings. All text gets a thick outline + drop shadow so it reads
// on top of a bright talking-head frame without a background box.

type Base = { frame: number; at: number; size: number; color: string; stroke?: string; strokeW?: number; font: string; weight?: number; style?: React.CSSProperties };

export const outline = (stroke = "#000", w = 8): React.CSSProperties => ({
  WebkitTextStroke: `${w}px ${stroke}`,
  paintOrder: "stroke fill",
  textShadow: `0 6px 0 ${stroke}, 0 12px 30px rgba(0,0,0,.55)`,
});

// whole line slams in from big + blurred to rest ("砸字"). Visible fully on its first frame when at <= frame.
// blur / minOpacity set how it looks on the very first frame (keep them low for a frame-0 headline)
export const Slam: React.FC<Base & { text: string; from?: number; len?: number; out?: number; outLen?: number; blur?: number; minOpacity?: number }> = ({
  frame,
  at,
  text,
  size,
  color,
  stroke = "#000",
  strokeW = 8,
  font,
  weight = 900,
  from = 1.9,
  len = 7,
  out,
  outLen = 6,
  blur = 10,
  minOpacity = 0.35,
  style,
}) => {
  if (frame < at) return null;
  const p = easeOut(prog(frame, at, len));
  const o = out !== undefined ? easeIn(prog(frame, out, outLen)) : 0;
  if (o >= 1) return null;
  const s = from + (1 - from) * p + o * 0.25;
  return (
    <div
      style={{
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.05,
        color,
        whiteSpace: "nowrap",
        transform: `scale(${s})`,
        opacity: (minOpacity + (1 - minOpacity) * p) * (1 - o),
        filter: p < 1 && blur > 0 ? `blur(${(1 - p) * blur}px)` : o > 0 ? `blur(${o * 8}px)` : undefined,
        ...outline(stroke, strokeW),
        ...style,
      }}
    >
      {text}
    </div>
  );
};

// characters pop one by one, each on its own cue (per-char karaoke punch)
export const CharPop: React.FC<Base & { text: string; cues: number[]; hl?: number[]; hlColor?: string; out?: number; outLen?: number }> = ({
  frame,
  text,
  cues,
  size,
  color,
  stroke = "#000",
  strokeW = 8,
  font,
  weight = 900,
  hl = [],
  hlColor,
  out,
  outLen = 6,
  style,
}) => {
  const chars = Array.from(text);
  const o = out !== undefined ? easeIn(prog(frame, out, outLen)) : 0;
  if (o >= 1) return null;
  return (
    <div style={{ display: "flex", fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.05, whiteSpace: "nowrap", opacity: 1 - o, ...style }}>
      {chars.map((ch, i) => {
        const at = cues[Math.min(i, cues.length - 1)] ?? 0;
        const p = easeOutBack(prog(frame, at, 8));
        const vis = frame >= at;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: hl.includes(i) ? hlColor ?? color : color,
              opacity: vis ? 1 : 0,
              transform: `translateY(${(1 - p) * 40 - o * 20}px) scale(${vis ? 0.4 + 0.6 * p : 0.4})`,
              ...outline(stroke, strokeW),
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// horizontal wipe reveal of a text line (clip-path), with a bright leading edge
export const Wipe: React.FC<Base & { text: string; len?: number; edge?: string }> = ({ frame, at, text, size, color, stroke = "#000", strokeW = 7, font, weight = 900, len = 10, edge, style }) => {
  if (frame < at) return null;
  const p = easeOut(prog(frame, at, len));
  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.05, color, whiteSpace: "nowrap", clipPath: `inset(-20% ${(1 - p) * 100}% -20% -5%)`, ...outline(stroke, strokeW) }}>{text}</div>
      {edge && p < 1 && <div style={{ position: "absolute", top: "-10%", bottom: "-10%", left: `${p * 100}%`, width: 6, background: edge, boxShadow: `0 0 24px ${edge}` }} />}
    </div>
  );
};

// rubber-stamp: rotated bordered label that lands with overshoot ("盖章")
export const Stamp: React.FC<Base & { text: string; rotate?: number; pad?: number }> = ({ frame, at, text, size, color, font, weight = 900, rotate = -8, pad = 0.28, style }) => {
  if (frame < at) return null;
  const p = prog(frame, at, 7);
  const s = p < 1 ? 2.2 - 1.3 * easeIn(p) + (p > 0.8 ? (p - 0.8) * 0.5 : 0) : 1;
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${size * pad * 0.5}px ${size * pad}px`,
        border: `${Math.max(4, size * 0.08)}px solid ${color}`,
        borderRadius: size * 0.12,
        color,
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        transform: `rotate(${rotate}deg) scale(${s})`,
        opacity: clamp(p * 3),
        background: "rgba(0,0,0,.35)",
        boxShadow: `0 0 0 3px rgba(0,0,0,.4), 0 10px 40px rgba(0,0,0,.5)`,
        textShadow: "0 3px 10px rgba(0,0,0,.6)",
        ...style,
      }}
    >
      {text}
    </div>
  );
};

// strike-through bar drawn across its parent (position the parent relative)
export const Strike: React.FC<{ frame: number; at: number; color: string; len?: number; thickness?: number; angle?: number }> = ({ frame, at, color, len = 8, thickness = 14, angle = -4 }) => {
  if (frame < at) return null;
  const p = easeOut(prog(frame, at, len));
  return (
    <div
      style={{
        position: "absolute",
        left: "-4%",
        top: "50%",
        width: `${108 * p}%`,
        height: thickness,
        marginTop: -thickness / 2,
        background: color,
        borderRadius: thickness,
        transform: `rotate(${angle}deg)`,
        transformOrigin: "left center",
        boxShadow: `0 0 20px ${color}, 0 3px 0 rgba(0,0,0,.6)`,
      }}
    />
  );
};

// rolling counter that lands on `value` (e.g. 0.5 秒)
export const Counter: React.FC<Base & { from: number; to: number; len?: number; decimals?: number; suffix?: string; suffixScale?: number }> = ({
  frame,
  at,
  from,
  to,
  len = 14,
  decimals = 0,
  suffix = "",
  suffixScale = 0.45,
  size,
  color,
  stroke = "#000",
  strokeW = 9,
  font,
  weight = 900,
  style,
}) => {
  if (frame < at) return null;
  const p = easeOut(prog(frame, at, len));
  const v = from + (to - from) * p;
  const pop = 1 + 0.12 * (1 - easeOut(prog(frame, at + len, 8))) * (frame >= at + len ? 1 : 0);
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontFamily: font, fontWeight: weight, color, whiteSpace: "nowrap", transform: `scale(${pop})`, ...outline(stroke, strokeW), ...style }}>
      <span style={{ fontSize: size, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{v.toFixed(decimals)}</span>
      {suffix && <span style={{ fontSize: size * suffixScale, marginLeft: size * 0.06 }}>{suffix}</span>}
    </div>
  );
};
