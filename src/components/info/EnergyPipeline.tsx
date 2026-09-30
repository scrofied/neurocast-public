import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeOut, easeOutBack, prog } from "../../lib/anim";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  steps: z.array(z.string()).min(2).max(6),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { width, height } = useVideoConfig();
  const steps = data.steps;
  const n = steps.length;
  const span = Math.min(1560, 330 * n);
  const x0 = (width - span) / 2 + span / n / 2;
  const gap = span / n;
  const cy = height / 2 + 70;
  // variant 1: zigzag
  const pts = steps.map((_, i) => ({ x: x0 + i * gap, y: cy + (variant === 1 ? (i % 2 ? 90 : -90) : 0) }));
  const per = Math.max(14, (dur - 30) / (n + 0.5));
  const flow = (frame - 12) / per; // index position of energy head
  const d = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `C${pts[i - 1].x + gap / 2},${pts[i - 1].y} ${p.x - gap / 2},${p.y} ${p.x},${p.y}`)).join(" ");
  const totalLen = gap * (n - 1) * (variant === 1 ? 1.12 : 1);
  const headFrac = clamp(flow / Math.max(1, n - 1));

  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="ep" std={8} />
        <path d={d} fill="none" stroke={alpha(t.primary, 0.15)} strokeWidth={16} strokeLinecap="round" />
        <path d={d} fill="none" stroke={alpha(t.primary, 0.3)} strokeWidth={2} strokeDasharray="6 10" strokeDashoffset={-frame * 2} />
        <path d={d} fill="none" stroke={t.primary} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={`${headFrac} 1`} filter="url(#ep)" />
        {/* energy pulses travelling along finished part */}
        {[0, 1, 2, 3].map((k) => {
          const f = ((frame / 50 + k / 4) % 1) * headFrac;
          return headFrac > 0.05 ? <path key={k} d={d} fill="none" stroke={t.accent} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={`0.012 1`} strokeDashoffset={-f} filter="url(#ep)" /> : null;
        })}
      </svg>
      {pts.map((p, i) => {
        const reached = flow >= i - 0.02;
        const hit = clamp((flow - i + 0.3) * 3);
        const appear = easeOutBack(prog(frame, 2 + i * 4, 18));
        const col = reached ? t.primary : t.dim;
        const ring = reached ? (frame - (12 + i * per)) : -1;
        const label = steps[i];
        const fs = fitFont(label, gap - 40, 34, 20);
        return (
          <React.Fragment key={i}>
            {ring >= 0 && ring < 30 && (
              <div style={{ position: "absolute", left: p.x - 60 - ring * 2, top: p.y - 60 - ring * 2, width: 120 + ring * 4, height: 120 + ring * 4, borderRadius: "50%", border: `2px solid ${alpha(t.primary, 1 - ring / 30)}` }} />
            )}
            <div
              style={{
                position: "absolute",
                left: p.x - 58,
                top: p.y - 58,
                width: 116,
                height: 116,
                borderRadius: variant === 2 ? 22 : "50%",
                transform: `scale(${appear * (1 + hit * 0.06)}) rotate(${variant === 2 ? 45 : 0}deg)`,
                background: `radial-gradient(circle, ${alpha(col, reached ? 0.45 : 0.1)}, ${alpha(t.bg2, 0.9)} 70%)`,
                border: `2px solid ${alpha(col, reached ? 1 : 0.4)}`,
                boxShadow: reached ? `0 0 40px ${alpha(t.primary, 0.6)}` : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ transform: `rotate(${variant === 2 ? -45 : 0}deg)`, fontFamily: t.font.mono, fontWeight: 700, fontSize: 38, color: reached ? t.text : t.dim }}>{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div
              style={{
                position: "absolute",
                left: p.x - gap / 2,
                width: gap,
                top: variant === 1 && i % 2 === 0 ? p.y - 150 : p.y + 82,
                textAlign: "center",
                fontFamily: t.font.body,
                fontWeight: 800,
                fontSize: fs,
                color: reached ? t.text : alpha(t.text, 0.4),
                opacity: easeOut(prog(frame, 6 + i * 4, 16)),
                textShadow: reached ? `0 0 16px ${alpha(t.primary, 0.6)}` : undefined,
              }}
            >
              {label}
            </div>
          </React.Fragment>
        );
      })}
      <Headline kicker={data.kicker ?? `PIPELINE · ${n} STEPS`} title={data.title} frame={frame} />
    </>
  );
};

export const EnergyPipeline: CompDef<D> = {
  id: "flow",
  name: "能量流程管线",
  layer: "info",
  variants: 3,
  minSec: 4,
  maxSec: 12,
  tags: ["第一步", "第二步", "步骤", "流程", "首先", "然后", "最后", "接着"],
  desc: "能量沿管线流动，依次点亮 N 个步骤节点（变体：直线 / 之字 / 菱形）",
  use: "第一步…第二步…、首先…然后…最后… 的操作流程",
  schema,
  example: { title: "三步搞定", steps: ["丢讲稿", "自动分镜", "渲染成片"] },
  C,
};
