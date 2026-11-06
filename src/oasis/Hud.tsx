import React from "react";
import { Img, OffthreadVideo, Sequence } from "remotion";
import { assetUrl } from "../lib/asset";
import { alpha, useTheme } from "../lib/theme";
import { clamp, eOutBack, eOutCubic, eOutExpo, flicker, lin, mix, p, rnd, useT } from "./time";

export const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const Brackets: React.FC<{ color?: string; size?: number; th?: number; inset?: number; opacity?: number }> = ({ color, size = 22, th = 2, inset = -6, opacity = 1 }) => {
  const t = useTheme();
  const col = color ?? t.primary;
  const s: React.CSSProperties = { position: "absolute", width: size, height: size, borderColor: col, borderStyle: "solid", opacity, filter: `drop-shadow(0 0 6px ${hexA(col, 0.8)})` };
  return (
    <>
      <div style={{ ...s, left: inset, top: inset, borderWidth: `${th}px 0 0 ${th}px` }} />
      <div style={{ ...s, right: inset, top: inset, borderWidth: `${th}px ${th}px 0 0` }} />
      <div style={{ ...s, left: inset, bottom: inset, borderWidth: `0 0 ${th}px ${th}px` }} />
      <div style={{ ...s, right: inset, bottom: inset, borderWidth: `0 ${th}px ${th}px 0` }} />
    </>
  );
};

export const Scanlines: React.FC<{ opacity?: number; gap?: number }> = ({ opacity = 0.12, gap = 3 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      opacity,
      backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.9) 1px, transparent 1px, transparent ${gap}px)`,
    }}
  />
);

export const HudBox: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  t0: number;
  t1?: number;
  color?: string;
  label?: string;
  tag?: string;
  bg?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number;
  seed?: number;
  header?: boolean;
  transform?: string;
}> = ({ x, y, w, h, t0, t1 = 1e9, color, label, tag, bg, children, style, pad = 0, seed = 1, header = true, transform = "" }) => {
  const th = useTheme();
  const t = useT();
  const col = color ?? th.primary;
  if (t < t0 || t > t1 + 0.01) return null;
  const openX = p(t, t0, t0 + 0.22, eOutExpo);
  const openY = p(t, t0 + 0.12, t0 + 0.38, eOutExpo);
  const out = p(t, t1 - 0.25, t1, eOutCubic);
  const sx = openX * (1 - out * 0.15);
  const sy = Math.max(0.012, openY) * (1 - out);
  const op = flicker(t, t0, 0.35, seed) * (1 - out);
  const hh = header && label ? 34 : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: op, transform: `${transform} scale(${sx}, ${sy})`, transformOrigin: "center", ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: bg ?? `linear-gradient(180deg, ${hexA("#0b1a2e", 0.78)} 0%, ${hexA("#050a14", 0.82)} 100%)`,
          border: `1.5px solid ${hexA(col, 0.75)}`,
          boxShadow: `0 0 24px ${hexA(col, 0.35)}, inset 0 0 40px ${hexA(col, 0.12)}`,
        }}
      />
      <Brackets color={col} />
      {hh > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: hh,
            background: `linear-gradient(90deg, ${hexA(col, 0.35)}, ${hexA(col, 0.05)})`,
            borderBottom: `1px solid ${hexA(col, 0.6)}`,
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            fontFamily: th.font.mono,
            fontSize: 15,
            letterSpacing: 3,
            color: th.text,
            gap: 12,
          }}
        >
          <div style={{ width: 8, height: 8, background: col, boxShadow: `0 0 10px ${col}` }} />
          <span style={{ whiteSpace: "nowrap" }}>{label}</span>
          <span style={{ marginLeft: "auto", fontFamily: th.font.mono, fontSize: 13, color: hexA(col, 0.9), letterSpacing: 1 }}>{tag}</span>
        </div>
      )}
      <div style={{ position: "absolute", left: pad, top: hh + pad, right: pad, bottom: pad, overflow: "hidden" }}>{children}</div>
      <Scanlines opacity={0.1} />
    </div>
  );
};

export const HoloMedia: React.FC<{
  src: string;
  video?: boolean;
  vstart?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  t0: number;
  t1?: number;
  color?: string;
  label?: string;
  tag?: string;
  fit?: "cover" | "contain";
  rotY?: number;
  rotX?: number;
  z?: number;
  filter?: string;
  children?: React.ReactNode;
  seed?: number;
  persp?: number;
  imgStyle?: React.CSSProperties;
  playbackRate?: number;
  intro?: boolean;
}> = ({ intro = true, src, video, vstart = 0, x, y, w, h, t0, t1 = 1e9, color, label, tag, fit = "cover", rotY = 0, rotX = 0, z = 0, filter, children, seed = 3, persp = 1800, imgStyle, playbackRate = 1 }) => {
  const th = useTheme();
  const col = color ?? th.primary;
  const t = useT();
  const mediaSrc = assetUrl(src);
  if (t < t0 - 0.01 || t > t1 + 0.01) return null;
  const k = intro ? p(t, t0, t0 + 0.5, eOutExpo) : 1;
  const out = intro ? p(t, t1 - 0.3, t1, eOutCubic) : 0;
  const op = intro ? flicker(t, t0, 0.3, seed) * (1 - out) : 1;
  const gl = intro ? clamp(1 - (t - t0) / 0.35) + out : clamp(1 - (t - t0) / 0.15) * 0.6;
  const slices = gl > 0.02 ? 5 : 0;
  const hh = label ? 34 : 0;
  const media = (clip?: string, dx = 0) =>
    video ? (
      <Sequence from={Math.round(t0 * 30)} layout="none">
        <OffthreadVideo
          src={mediaSrc}
          muted
          startFrom={Math.round(vstart * 30)}
          playbackRate={playbackRate}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, filter, clipPath: clip, transform: `translateX(${dx}px)`, ...imgStyle }}
        />
      </Sequence>
    ) : (
      <Img src={mediaSrc} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, filter, clipPath: clip, transform: `translateX(${dx}px)`, ...imgStyle }} />
    );
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, perspective: persp, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          opacity: op,
          transform: `translateZ(${z + (1 - k) * -600}px) rotateY(${rotY + (1 - k) * 18}deg) rotateX(${rotX}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "#000", border: `1.5px solid ${hexA(col, 0.8)}`, boxShadow: `0 0 40px ${hexA(col, 0.35)}, 0 30px 80px rgba(0,0,0,0.6)` }} />
        {hh > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: -hh - 6,
              height: hh,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: th.font.mono,
              fontSize: 15,
              letterSpacing: 3,
              color: th.text,
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ width: 8, height: 8, background: col, boxShadow: `0 0 10px ${col}` }} />
            {label}
            {tag && <span style={{ fontFamily: th.font.mono, fontSize: 13, color: col, letterSpacing: 1, marginLeft: 8 }}>{tag}</span>}
          </div>
        )}
        <div style={{ position: "absolute", inset: 2, overflow: "hidden" }}>
          {slices === 0
            ? media()
            : Array.from({ length: slices }).map((_, i) => {
                const a = (i / slices) * 100;
                const b = ((i + 1) / slices) * 100;
                const dx = (rnd(i * 3.1 + Math.floor(t * 30)) - 0.5) * 80 * gl;
                return <React.Fragment key={i}>{media(`inset(${a}% 0 ${100 - b}% 0)`, dx)}</React.Fragment>;
              })}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${hexA(col, 0.1)}, transparent 30%, transparent 70%, ${hexA(col, 0.12)})` }} />
          <Scanlines opacity={0.14} />
          {children}
        </div>
        <Brackets color={col} size={28} inset={-10} />
      </div>
    </div>
  );
};

export const Rolling: React.FC<{ from: number; to: number; t0: number; t1: number; fmt?: (n: number) => string; style?: React.CSSProperties }> = ({ from, to, t0, t1, fmt, style }) => {
  const t = useT();
  const v = mix(from, to, p(t, t0, t1, eOutCubic));
  const s = fmt ? fmt(v) : Math.round(v).toLocaleString("en-US");
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{s}</span>;
};

export const ItemCard: React.FC<{
  x: number;
  y: number;
  t0: number;
  t1?: number;
  w?: number;
  rarity: string;
  color: string;
  name: string;
  sub?: string;
  rows?: [string, React.ReactNode, string?][];
  footer?: React.ReactNode;
  seed?: number;
  scale?: number;
  anchor?: "left" | "center";
}> = ({ x, y, t0, t1 = 1e9, w = 380, rarity, color, name, sub, rows = [], footer, seed = 2, scale = 1, anchor = "left" }) => {
  const th = useTheme();
  const t = useT();
  if (t < t0 || t > t1 + 0.01) return null;
  const k = p(t, t0, t0 + 0.35, eOutBack);
  const out = p(t, t1 - 0.2, t1);
  const op = flicker(t, t0, 0.3, seed) * (1 - out);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        opacity: op,
        transform: `translate(${anchor === "center" ? -50 : 0}%, 0) scale(${scale * mix(0.6, 1, k)}) translateY(${(1 - k) * 20}px)`,
        transformOrigin: "top left",
        background: `linear-gradient(160deg, ${hexA("#0d1830", 0.92)}, ${hexA("#05080f", 0.92)})`,
        border: `1.5px solid ${hexA(color, 0.9)}`,
        boxShadow: `0 0 30px ${hexA(color, 0.4)}, inset 0 0 30px ${hexA(color, 0.12)}`,
        fontFamily: th.font.body,
        color: th.text,
      }}
    >
      <div style={{ height: 5, background: color, boxShadow: `0 0 16px ${color}` }} />
      <div style={{ padding: "14px 20px 16px" }}>
        <div style={{ fontFamily: th.font.mono, fontSize: 13, letterSpacing: 4, color }}>{rarity}</div>
        <div style={{ fontFamily: th.font.title, fontWeight: 800, fontSize: 34, marginTop: 4, textShadow: `0 0 18px ${hexA(color, 0.6)}` }}>{name}</div>
        {sub && <div style={{ fontFamily: th.font.body, fontSize: 18, color: alpha(th.text, 0.7), marginTop: 2 }}>{sub}</div>}
        {rows.length > 0 && <div style={{ height: 1, background: hexA(color, 0.4), margin: "12px 0 8px" }} />}
        {rows.map(([a, b, c], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 21, lineHeight: "32px", opacity: lin(t, t0 + 0.15 + i * 0.08, t0 + 0.3 + i * 0.08) }}>
            <span style={{ fontFamily: th.font.body, color: alpha(th.text, 0.72), fontSize: 19 }}>{a}</span>
            <span style={{ fontFamily: th.font.mono, fontWeight: 700, color: c ?? th.text, fontSize: 24 }}>{b}</span>
          </div>
        ))}
        {footer}
      </div>
      <Brackets color={color} size={14} inset={-5} />
    </div>
  );
};

export const Achievement: React.FC<{ x: number; y: number; t0: number; t1: number; color?: string; top: string; main: string; icon?: React.ReactNode; w?: number }> = ({ x, y, t0, t1, color, top, main, icon, w = 620 }) => {
  const th = useTheme();
  const col = color ?? th.gold;
  const t = useT();
  if (t < t0 || t > t1) return null;
  const k = p(t, t0, t0 + 0.45, eOutExpo);
  const out = p(t, t1 - 0.3, t1);
  const sweep = lin(t, t0 + 0.2, t0 + 0.9);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: 104,
        transform: `translateX(-50%) scaleX(${k}) translateY(${-out * 30}px)`,
        opacity: 1 - out,
        background: `linear-gradient(90deg, ${hexA("#140f02", 0.9)}, ${hexA("#2a1d02", 0.92)} 50%, ${hexA("#140f02", 0.9)})`,
        border: `2px solid ${col}`,
        boxShadow: `0 0 50px ${hexA(col, 0.55)}, inset 0 0 30px ${hexA(col, 0.2)}`,
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "0 28px",
        overflow: "hidden",
      }}
    >
      <div style={{ width: 64, height: 64, flex: "0 0 64px", display: "flex", alignItems: "center", justifyContent: "center", clipPath: "polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)", background: col }}>{icon}</div>
      <div>
        <div style={{ fontFamily: th.font.mono, fontSize: 15, letterSpacing: 5, color: col }}>{top}</div>
        <div style={{ fontFamily: th.font.title, fontWeight: 800, fontSize: 36, color: "#fff7dd", textShadow: `0 0 16px ${hexA(col, 0.8)}`, whiteSpace: "nowrap" }}>{main}</div>
      </div>
      <div style={{ position: "absolute", top: 0, bottom: 0, width: 120, left: `${mix(-20, 120, sweep)}%`, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)", transform: "skewX(-20deg)" }} />
    </div>
  );
};

export const Meter: React.FC<{ w: number; v: number; color: string; h?: number; segments?: number }> = ({ w, v, color, h = 14, segments = 24 }) => (
  <div style={{ display: "flex", gap: 3, width: w }}>
    {Array.from({ length: segments }).map((_, i) => {
      const on = i / segments < v;
      return <div key={i} style={{ flex: 1, height: h, background: on ? color : hexA(color, 0.12), boxShadow: on ? `0 0 8px ${hexA(color, 0.8)}` : "none" }} />;
    })}
  </div>
);

export const Tag: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color, style }) => {
  const th = useTheme();
  const col = color ?? th.primary;
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: th.font.mono,
        fontSize: 14,
        letterSpacing: 2,
        color: col,
        border: `1px solid ${hexA(col, 0.7)}`,
        padding: "3px 10px",
        background: hexA(col, 0.08),
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const GlitchText: React.FC<{ text: string; t0: number; t1?: number; size: number; color?: string; font?: string; weight?: number; style?: React.CSSProperties; spacing?: number; glow?: string }> = ({ text, t0, t1 = 1e9, size, color, font, weight = 900, style, spacing = 0, glow }) => {
  const th = useTheme();
  const col = color ?? th.text;
  const gl = glow ?? th.primary;
  const t = useT();
  if (t < t0 || t > t1) return null;
  const g = clamp(1 - (t - t0) / 0.4) + p(t, t1 - 0.2, t1);
  const j = Math.floor(t * 30);
  const ox = (rnd(j * 1.3) - 0.5) * 18 * g;
  const oy = (rnd(j * 2.7) - 0.5) * 6 * g;
  const op = flicker(t, t0, 0.3, 5) * (1 - p(t, t1 - 0.2, t1));
  return (
    <div
      style={{
        fontFamily: font ?? th.font.title,
        fontWeight: weight,
        fontSize: size,
        color: col,
        letterSpacing: spacing,
        whiteSpace: "nowrap",
        opacity: op,
        transform: `translate(${ox}px, ${oy}px)`,
        textShadow: `${-3 * g - 1}px 0 0 ${hexA(th.secondary, 0.7 * g + 0.15)}, ${3 * g + 1}px 0 0 ${hexA(th.primary, 0.7 * g + 0.15)}, 0 0 28px ${hexA(gl, 0.65)}`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
