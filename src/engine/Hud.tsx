import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, easeOut, prog } from "../lib/anim";
import { alpha, useTheme } from "../lib/theme";
import type { Caption, Chapter } from "../types";

export const ProgressHud: React.FC<{ chapters: Chapter[]; total: number; title: string; flash?: boolean }> = ({ chapters, total, title, flash = true }) => {
  const f = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const t = useTheme();
  const ci = Math.max(0, chapters.findIndex((c) => f >= c.start && f < c.end));
  const L = 120;
  const W = width - 240;
  const pos = clamp(f / total);
  const sec = Math.floor(f / fps);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const fade = easeOut(prog(f, 10, 20));
  // chapter change: the label swells and a light sweep runs along the bar for ~2s
  const since = f - (chapters[ci]?.start ?? 0);
  const fl = flash && ci > 0 && since >= 0 && since < 64 ? Math.sin(clamp(since / 64) * Math.PI) : 0;
  const sweep = flash && ci > 0 && since >= 0 && since < 40 ? since / 40 : -1;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 80, opacity: fade, fontFamily: t.font.mono, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: L, top: 26, fontSize: 17, letterSpacing: 3, color: t.dim, display: "flex", gap: 18, alignItems: "center", transformOrigin: "left center", transform: `scale(${1 + fl * 0.45})` }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: t.primary, boxShadow: `0 0 10px ${t.primary}`, opacity: Math.floor(f / 15) % 2 ? 1 : 0.4 }} />
        <span style={{ color: t.primary }}>{`CH ${String(ci + 1).padStart(2, "0")}/${String(chapters.length).padStart(2, "0")}`}</span>
        <span style={{ color: t.text, fontFamily: t.font.body, fontWeight: 700, letterSpacing: 1, fontSize: 20, textShadow: fl > 0 ? `0 0 ${18 * fl}px ${alpha(t.primary, 0.9)}` : undefined }}>{chapters[ci]?.title || title}</span>
      </div>
      <div style={{ position: "absolute", right: L, top: 26, fontSize: 17, letterSpacing: 3, color: t.dim }}>{`${mm}:${ss}`}</div>
      <div style={{ position: "absolute", left: L, width: W, top: 60, height: 4 }}>
        {chapters.map((c, i) => {
          const x = (c.start / total) * W;
          const w = ((c.end - c.start) / total) * W - 6;
          const fill = clamp((f - c.start) / Math.max(1, c.end - c.start));
          const active = i === ci;
          return (
            <div key={i} style={{ position: "absolute", left: x, width: Math.max(4, w), top: 0, height: active ? 4 : 3, background: alpha(t.primary, 0.18), borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${fill * 100}%`, height: "100%", background: active ? t.primary : alpha(t.primary, 0.7), boxShadow: active ? `0 0 10px ${t.primary}` : undefined }} />
            </div>
          );
        })}
        {sweep >= 0 && <div style={{ position: "absolute", left: sweep * W - 120, top: -2, width: 240, height: 8, background: `linear-gradient(90deg, transparent, ${alpha(t.text, 0.9)}, transparent)`, filter: "blur(2px)", opacity: 1 - sweep }} />}
        <div style={{ position: "absolute", left: pos * W - 5, top: -3, width: 10, height: 10, borderRadius: 5, background: t.text, boxShadow: `0 0 12px ${t.primary}` }} />
      </div>
    </div>
  );
};

// karaoke captions: every char lights up at the frame it is actually spoken (t[]),
// numbers / latin terms / storyboard keywords (hl ranges) burn in the accent colour
export const Captions: React.FC<{ captions: Caption[]; hidden?: (f: number) => boolean }> = ({ captions, hidden }) => {
  const f = useCurrentFrame();
  const t = useTheme();
  const c = captions.find((x) => f >= x.start && f < x.end);
  if (!c || hidden?.(f)) return null;
  const chars = Array.from(c.text);
  const lit = c.t ? chars.reduce((n, _, i) => (f >= (c.t![i] ?? Infinity) ? i + 1 : n), 0) : Math.floor(clamp((f - c.start) / Math.max(1, c.end - c.start)) * chars.length * 1.05);
  const isHl = (i: number) => !!c.hl?.some(([a, b]) => i >= a && i < b);
  const pin = easeOut(prog(f, c.start, 6));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 52, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          // ≤12 字一行 + 黑描边：no heavy box, readable on a bright talking-head frame too
          padding: "6px 26px",
          borderRadius: 12,
          background: `linear-gradient(90deg, transparent, ${alpha(t.bg, 0.32)} 18%, ${alpha(t.bg, 0.32)} 82%, transparent)`,
          fontFamily: t.font.body,
          fontWeight: 900,
          fontSize: 50,
          letterSpacing: 2,
          WebkitTextStroke: "7px #000",
          paintOrder: "stroke fill",
          opacity: pin,
          transform: `translateY(${(1 - pin) * 10}px)`,
          whiteSpace: "nowrap",
        }}
      >
        {chars.map((ch, i) => {
          const on = i < lit;
          const hl = isHl(i);
          const col = hl ? t.accent : t.text;
          return (
            <span key={i} style={{ color: on ? col : alpha(col, 0.5), textShadow: on && i >= lit - 2 ? `0 3px 0 #000, 0 0 18px ${alpha(hl ? t.accent : t.primary, 0.9)}` : "0 3px 0 #000, 0 4px 10px rgba(0,0,0,.8)" }}>
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// film grain + vignette + subtle scanlines for the premium look
export const PostFx: React.FC<{ seed: number }> = ({ seed }) => {
  const f = useCurrentFrame();
  const t = useTheme();
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 45%, transparent 55%, ${alpha(t.bg, 0.85)} 100%)`, pointerEvents: "none" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 3px)",
          pointerEvents: "none",
        }}
      />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.07, mixBlendMode: "overlay", pointerEvents: "none" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={(f + seed) % 97} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </>
  );
};
