import React from "react";
import { clamp, E, h1 } from "./core";
import { FONT, rgba } from "./look";

// ── 排版 ────────────────────────────────────────────────────────────────
// 开场大字：粗、描边兜底、可发光、可渐变填充、可逐字动画。

export const stroke = (color = "#000", w = 8): React.CSSProperties => ({ WebkitTextStroke: `${w}px ${color}`, paintOrder: "stroke fill" });

// 渐变填充文字（background-clip: text）
export const gradientInk = (from: string, to: string, angle = 180): React.CSSProperties => ({
  backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});

// 立体挤出（叠多层阴影）
export const extrude = (color: string, depth = 10, dx = 0, dy = 1, glow?: string): string => {
  const s = Array.from({ length: depth }, (_, i) => `${dx * (i + 1)}px ${dy * (i + 1)}px 0 ${color}`);
  if (glow) s.push(`0 0 60px ${glow}`);
  return s.join(", ");
};

type TextProps = {
  text: string;
  size: number;
  color?: string;
  font?: string;
  weight?: number;
  glow?: string; // 发光色
  glowR?: number;
  outline?: number; // 描边宽度（px），0 = 不描边
  outlineColor?: string;
  tracking?: number; // em
  style?: React.CSSProperties;
};

// 一整行大字
export const Big: React.FC<TextProps> = ({ text, size, color = "#fff", font = FONT.heavy, weight = 900, glow, glowR = 40, outline = 0, outlineColor = "#000", tracking = 0, style }) => (
  <div
    style={{
      fontFamily: font,
      fontWeight: weight,
      fontSize: size,
      lineHeight: 1.08,
      color,
      letterSpacing: `${tracking}em`,
      whiteSpace: "nowrap",
      textShadow: glow ? `0 0 ${glowR}px ${glow}, 0 0 ${glowR * 0.3}px ${glow}` : undefined,
      ...(outline > 0 ? stroke(outlineColor, outline) : {}),
      ...style,
    }}
  >
    {text}
  </div>
);

// 逐字动画：每个字一个起始秒数，render 返回该字的附加样式（k = 该字 0→1 进度）
export const Chars: React.FC<
  TextProps & {
    t: number;
    at: number; // 第一个字出现的秒
    per: number; // 每字间隔秒
    len?: number; // 每字动画时长
    hl?: [number, number]; // 高亮区间 [起, 止)（字序号）
    hlColor?: string;
    hlGlow?: string;
    anim?: "pop" | "drop" | "blur" | "type" | "rise";
    /** 首帧红线：>0 时整句第 0 帧就在位（暗色可读），逐字只做「点亮」不做位移/缩放。0 = 逐字浮现（旧行为） */
    floor?: number;
    seed?: number;
  }
> = ({ text, t, at, per, len = 0.28, size, color = "#fff", font = FONT.heavy, weight = 900, glow, glowR = 36, outline = 0, outlineColor = "#000", tracking = 0, hl, hlColor, hlGlow, anim = "pop", floor = 0, seed = 0, style }) => {
  const chars = Array.from(text);
  return (
    <div style={{ display: "flex", fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.08, whiteSpace: "nowrap", letterSpacing: `${tracking}em`, ...style }}>
      {chars.map((c, i) => {
        const s0 = at + i * per;
        const k = clamp((t - s0) / len);
        const on = t >= s0;
        const isHl = !!hl && i >= hl[0] && i < hl[1];
        const g = isHl ? hlGlow ?? glow : glow;
        let tf = "";
        let op = on ? 1 : 0;
        let fl: string | undefined;
        if (anim === "pop") tf = `translateY(${(1 - E.back(k, 2.2)) * size * 0.45}px) scale(${0.3 + 0.7 * E.back(k, 2.2)})`;
        if (anim === "drop") tf = `translateY(${-(1 - E.out(k)) * size * 0.9}px) rotate(${(1 - E.out(k)) * (h1(i, seed) - 0.5) * 30}deg)`;
        if (anim === "rise") {
          tf = `translateY(${(1 - E.out5(k)) * size * 0.6}px)`;
          op = on ? E.out(k * 1.6) : 0;
        }
        if (anim === "blur") {
          tf = `scale(${1.6 - 0.6 * E.out5(k)})`;
          op = on ? E.out(k) : 0;
          fl = k < 1 ? `blur(${(1 - E.out(k)) * size * 0.12}px)` : undefined;
        }
        if (anim === "type") tf = "";
        if (floor > 0) {
          // 点亮模式：字从一开始就占位可读，扫过的只是亮度
          tf = "";
          fl = undefined;
          op = clamp(floor + (1 - floor) * E.out(k * 1.4));
        }
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              color: isHl ? hlColor ?? color : color,
              opacity: op,
              transform: tf,
              filter: fl,
              textShadow: g ? `0 0 ${glowR}px ${g}, 0 0 ${glowR * 0.3}px ${g}` : undefined,
              ...(outline > 0 ? stroke(outlineColor, outline) : {}),
            }}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
};

// 重影错位（RGB 分离）：k 0~1 强度
export const Chroma: React.FC<{ k: number; px: number; children: React.ReactNode; a?: string; b?: string }> = ({ k, px, children, a = "#ff2a6d", b = "#22e3ff" }) => {
  if (k <= 0.01) return <>{children}</>;
  const d = px * k;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${-d}px, 0)`, opacity: 0.85, filter: `drop-shadow(0 0 0 ${a})`, mixBlendMode: "screen", color: a }}>
        <div style={{ filter: `brightness(0) saturate(100%)`, opacity: 0 }}>{children}</div>
      </div>
      <div style={{ position: "relative", textShadow: `${-d}px 0 0 ${rgba(a, 0.9)}, ${d}px 0 0 ${rgba(b, 0.9)}` }}>{children}</div>
    </div>
  );
};

// 计数器（数字滚动到 to）
export const Count: React.FC<{ t: number; at: number; len: number; from?: number; to: number; decimals?: number; size: number; color: string; font?: string; style?: React.CSSProperties }> = ({ t, at, len, from = 0, to, decimals = 0, size, color, font = FONT.num, style }) => {
  const k = E.expo(clamp((t - at) / len));
  const v = from + (to - from) * k;
  return <span style={{ fontFamily: font, fontWeight: 900, fontSize: size, color, fontVariantNumeric: "tabular-nums", lineHeight: 1, ...style }}>{v.toFixed(decimals)}</span>;
};
