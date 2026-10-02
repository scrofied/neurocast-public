import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeIn, easeOut, easeOutBack, noise1, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Glass, GlowDefs, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const side = z.object({ label: z.string(), points: z.array(z.string()).max(4).optional() });
const schema = z.object({ title: z.string().optional(), kicker: z.string().optional(), left: side, right: side });
type D = z.infer<typeof schema>;

// two slabs rush in, collide in the middle (shockwave), then separate to show details
const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2 + 70;
  const rush = easeIn(prog(frame, 0, 14));
  const back = easeOutBack(prog(frame, 16, 22));
  const hit = frame >= 14 && frame < 30 ? 1 - (frame - 14) / 16 : 0;
  const shake = hit > 0 ? noise1(frame * 3, seed) * 18 * hit : 0;
  const pw = 640;
  const ph = 460;
  const sep = frame < 14 ? (1 - rush) * 900 : back * 60;
  const lx = cx - pw - sep + (frame < 14 ? 0 : 0) - 20 + (frame < 14 ? pw / 2 - 10 : 0) * 0;
  const leftX = frame < 14 ? cx - pw - (1 - rush) * 900 : cx - pw - 30 * back - 10;
  const rightX = frame < 14 ? cx + (1 - rush) * 900 : cx + 30 * back + 10;
  const wave = prog(frame, 14, 24);
  const ring = variant === 1;
  // VS 章原生回弹弹入（0→1）；定型的旋转角度属于组件内容，保持原生进度
  const eVs = enterAt(frame, 16, { fallback: "rise", dur: 16, from: 0 });

  const panel = (d: z.infer<typeof side>, x: number, good: boolean, delay: number) => {
    const col = good ? t.primary : t.secondary;
    const pts = d.points ?? [];
    return (
      <Glass glow={col} style={{ left: x, top: cy - ph / 2 + shake, width: pw, height: ph, transform: `perspective(1600px) rotateY(${good ? -6 : 6}deg)` }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: col, boxShadow: `0 0 30px ${col}` }} />
        <div style={{ padding: "48px 50px 0" }}>
          <div style={{ fontFamily: t.font.mono, fontSize: 18, letterSpacing: 5, color: col }}>{good ? "OPTION B" : "OPTION A"}</div>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(d.label, pw - 100, 64), color: t.text, marginTop: 10, textShadow: `0 0 24px ${alpha(col, 0.6)}` }}>{d.label}</div>
          <div style={{ marginTop: 26 }}>
            {pts.map((p, i) => {
              // 要点原生逐条从面板内侧滑入（左板 -40 / 右板 +40）
              const ep = enterAt(frame, delay + i * 6, { fallback: good ? "slide-r" : "slide-l", dur: 14, dist: 40 / 240 });
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, opacity: ep.opacity, transform: `translate(${ep.dx}px, ${ep.dy}px)`, fontFamily: t.font.body, fontSize: 30, color: alpha(t.text, 0.9), fontWeight: 600 }}>
                  <span style={{ color: col, fontSize: 22 }}>{good ? "✓" : "✕"}</span>
                  {p}
                </div>
              );
            })}
          </div>
        </div>
      </Glass>
    );
  };

  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="vs" std={10} />
        {frame >= 14 && (
          <>
            {ring ? (
              <circle cx={cx} cy={cy} r={wave * 700} fill="none" stroke={t.accent} strokeOpacity={(1 - wave) * 0.9} strokeWidth={5} filter="url(#vs)" />
            ) : (
              <rect x={cx - 3 - wave * 40} y={cy - ph / 2 - wave * 200} width={6 + wave * 80} height={ph + wave * 400} fill={t.accent} opacity={(1 - wave) * 0.7} filter="url(#vs)" />
            )}
            {new Array(24).fill(0).map((_, i) => {
              const a = (i / 24) * Math.PI * 2;
              const r = wave * (300 + (i % 4) * 90);
              return <circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r * 0.7} r={3} fill={t.accent} opacity={1 - wave} />;
            })}
          </>
        )}
      </svg>
      {panel(data.left, leftX, false, 30)}
      {panel(data.right, rightX, true, 36)}
      <div
        style={{
          position: "absolute",
          left: cx - 60,
          top: cy - 60,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: t.bg,
          border: `3px solid ${t.accent}`,
          boxShadow: `0 0 50px ${alpha(t.accent, 0.8)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: t.font.mono,
          fontWeight: 900,
          fontSize: 44,
          color: t.accent,
          transform: `scale(${eVs.scale}) rotate(${(1 - clamp(prog(frame, 16, 16))) * 180}deg)`,
        }}
      >
        VS
      </div>
      <Headline kicker={data.kicker ?? "COMPARE"} title={data.title} frame={frame} />
    </>
  );
};

export const VersusClash: CompDef<D> = {
  id: "versus",
  name: "对比对撞",
  layer: "info",
  variants: 2,
  minSec: 4,
  maxSec: 10,
  tags: ["对比", "区别", "vs", "VS", "以前", "现在", "传统", "而是", "不是", "相比"],
  motion: { kind: "双板从两侧加速对撞（冲击波+抖动）弹开，要点逐条滑入，VS 章回弹定型", energy: 3 },
  desc: "两块面板从两侧冲来对撞（冲击波），弹开后展示左右要点",
  use: "两种方案/观点同时摆出来比（A vs B）；有先后节奏的“以前…现在…”用 before-after",
  schema,
  example: { title: "传统做法 vs AI 做法", left: { label: "人工剪辑", points: ["3 小时一条", "依赖经验"] }, right: { label: "AI 自动出片", points: ["3 分钟一条", "批量不重样"] } },
  C,
};
