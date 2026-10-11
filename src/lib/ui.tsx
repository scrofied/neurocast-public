import React from "react";
import { alpha, useTheme } from "./theme";
import { easeOut, prog } from "./anim";

export const Glass: React.FC<{
  style?: React.CSSProperties;
  children?: React.ReactNode;
  glow?: string;
  corners?: boolean;
  blur?: boolean;
}> = ({ style, children, glow, corners = true, blur = true }) => {
  const t = useTheme();
  const g = glow ?? t.primary;
  return (
    <div
      style={{
        position: "absolute",
        background: `linear-gradient(145deg, ${alpha(g, 0.1)}, ${t.glass} 40%, ${alpha(t.bg, 0.6)})`,
        border: `1px solid ${alpha(g, 0.35)}`,
        borderRadius: 18,
        boxShadow: `0 0 40px ${alpha(g, 0.12)}, inset 0 0 30px ${alpha(g, 0.06)}, inset 0 1px 0 ${alpha("#ffffff", 0.12)}`,
        backdropFilter: blur ? "blur(14px)" : undefined,
        overflow: "hidden",
        ...style,
      }}
    >
      {corners && <Corners color={g} />}
      {children}
    </div>
  );
};

export const Corners: React.FC<{ color: string; size?: number; inset?: number }> = ({ color, size = 18, inset = 8 }) => {
  const b = `2px solid ${color}`;
  const base: React.CSSProperties = { position: "absolute", width: size, height: size, opacity: 0.9 };
  return (
    <>
      <div style={{ ...base, left: inset, top: inset, borderLeft: b, borderTop: b }} />
      <div style={{ ...base, right: inset, top: inset, borderRight: b, borderTop: b }} />
      <div style={{ ...base, left: inset, bottom: inset, borderLeft: b, borderBottom: b }} />
      <div style={{ ...base, right: inset, bottom: inset, borderRight: b, borderBottom: b }} />
    </>
  );
};

export const HudLabel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; color?: string }> = ({ children, style, color }) => {
  const t = useTheme();
  return (
    <div
      style={{
        position: "absolute",
        fontFamily: t.font.mono,
        fontSize: 18,
        letterSpacing: 4,
        color: color ?? t.primary,
        textTransform: "uppercase",
        opacity: 0.85,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Title: React.FC<{ text: string; frame: number; delay?: number; size?: number; style?: React.CSSProperties; color?: string }> = ({
  text,
  frame,
  delay = 0,
  size = 64,
  style,
  color,
}) => {
  const t = useTheme();
  const chars = Array.from(text);
  return (
    <div style={{ position: "absolute", fontFamily: t.font.title, fontWeight: 800, fontSize: size, color: color ?? t.text, letterSpacing: 2, whiteSpace: "nowrap", ...style }}>
      {chars.map((c, i) => {
        const p = easeOut(prog(frame, delay + i * 1.6, 14));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: p,
              transform: `translateY(${(1 - p) * 30}px) scale(${0.8 + 0.2 * p})`,
              filter: `blur(${(1 - p) * 8}px)`,
              textShadow: `0 0 ${24 * p}px ${alpha(t.primary, 0.55)}`,
            }}
          >
            {c === " " ? " " : c}
          </span>
        );
      })}
    </div>
  );
};

// SVG glow filter defs, include once per svg.
// user=true: filter region in user space — needed for perfectly horizontal/vertical lines, whose
// zero-height bounding box would otherwise make an objectBoundingBox filter swallow them entirely
export const GlowDefs: React.FC<{ id?: string; std?: number; user?: boolean }> = ({ id = "glow", std = 6, user = false }) => (
  <defs>
    <filter id={id} {...(user ? { filterUnits: "userSpaceOnUse", x: -200, y: -200, width: 4000, height: 3000 } : { x: "-50%", y: "-50%", width: "200%", height: "200%" })}>
      <feGaussianBlur stdDeviation={std} result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

export const Scan: React.FC<{ frame: number; color: string; speed?: number; style?: React.CSSProperties }> = ({ frame, color, speed = 3, style }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      height: 120,
      top: `${((frame * speed) % 140) - 20}%`,
      background: `linear-gradient(180deg, transparent, ${alpha(color, 0.12)}, transparent)`,
      pointerEvents: "none",
      ...style,
    }}
  />
);

// top-left heading used by most shots
// capW：大字的可用宽度。默认按整屏排（1500），但右侧要让给一块画面时得传进来，
// 否则 nowrap 的 Title 会一路铺过头像墙/取景框上面。
export const Headline: React.FC<{ kicker?: string; title?: string; frame: number; x?: number; y?: number; size?: number; align?: "left" | "center"; capW?: number }> = ({
  kicker,
  title,
  frame,
  x = 120,
  y = 96,
  size = 54,
  align = "left",
  capW = 1500,
}) => {
  const t = useTheme();
  const p = easeOut(prog(frame, 2, 18));
  const center = align === "center";
  const wrap: React.CSSProperties = center ? { left: 0, right: 0, textAlign: "center" } : { left: x };
  return (
    <>
      {kicker && (
        <div style={{ position: "absolute", top: y, ...wrap, fontFamily: t.font.mono, fontSize: 20, letterSpacing: 6, color: t.primary, opacity: p }}>
          <span style={{ display: "inline-block", width: 36 * p, height: 2, background: t.primary, verticalAlign: "middle", marginRight: 14, boxShadow: `0 0 10px ${t.primary}` }} />
          {kicker}
        </div>
      )}
      {title && (
        <div style={{ position: "absolute", top: y + 34, ...wrap }}>
          <Title text={title} frame={frame} delay={5} size={fitFont(title, capW, size)} style={{ position: "relative" }} />
        </div>
      )}
    </>
  );
};

export const textEm =(s: string) => {
  let w = 0;
  for (const c of Array.from(s)) w += /[\u0000-ÿ]/.test(c) ? (c === " " ? 0.3 : 0.58) : 1;
  return w;
};
export const fitFont = (s: string, maxW: number, base: number, min = 20) => Math.max(min, Math.min(base, maxW / Math.max(1, textEm(s))));

// Headline that adapts to the box: full-size shots get the standard top-left headline,
// side panels (compact boxes) get a small header with padding
export const Heading: React.FC<{ kicker?: string; title?: string; frame: number; width: number; align?: "left" | "center"; capW?: number }> = ({ kicker, title, frame, width, align = "left", capW }) => {
  const t = useTheme();
  if (width >= 900) return <Headline kicker={kicker} title={title} frame={frame} align={align} capW={capW} />;
  const p = easeOut(prog(frame, 2, 16));
  return (
    <div style={{ position: "absolute", left: 22, right: 22, top: 18, opacity: p, textAlign: align }}>
      {kicker && <div style={{ fontFamily: t.font.mono, fontSize: 14, letterSpacing: 4, color: t.primary }}>{kicker}</div>}
      {title && <div style={{ marginTop: 6, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(title, width - 44, 30, 16), color: t.text, lineHeight: 1.2 }}>{title}</div>}
    </div>
  );
};

export const fmtNum =(v: number, decimals: number) => {
  const s = v.toFixed(decimals);
  const [i, d] = s.split(".");
  const withSep = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return d ? `${withSep}.${d}` : withSep;
};
