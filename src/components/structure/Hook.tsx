import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeIn, noise1, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({ title: z.string(), sub: z.string().optional() });
type D = z.infer<typeof schema>;

// opening: shockwave + title slams through a hyperspace burst
const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2 - 20;
  // 标题原生从 2.4 倍砸到位：rise + from:2.4 复刻同一曲线；速度线/冲击波是持续爆发，不接
  const slam = enterAt(frame, 8, { fallback: "rise", dur: 16, from: 2.4 });
  const sub = enterAt(frame, 26, { fallback: "rise", dur: 18 });
  const shake = frame > 10 && frame < 24 ? noise1(frame * 2.3, seed) * 14 * (1 - (frame - 10) / 14) : 0;
  const wave = prog(frame, 12, 30);
  const fs = fitFont(data.title, 1600, 128);
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="hk" std={10} />
        {new Array(70).fill(0).map((_, i) => {
          const a = (i / 70) * Math.PI * 2;
          const p = easeIn(prog(frame, (i % 7) * 1.5, 26));
          const r0 = 60 + p * 700;
          const r1 = r0 + 40 + p * 220;
          return <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0 * 0.6} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1 * 0.6} stroke={i % 5 ? t.primary : t.accent} strokeOpacity={(1 - p) * 0.8} strokeWidth={2} />;
        })}
        <ellipse cx={cx} cy={cy} rx={wave * 1100} ry={wave * 480} fill="none" stroke={t.primary} strokeOpacity={(1 - wave) * 0.9} strokeWidth={4} filter="url(#hk)" />
        <ellipse cx={cx} cy={cy} rx={wave * 700} ry={wave * 300} fill="none" stroke={t.secondary} strokeOpacity={(1 - wave) * 0.6} strokeWidth={2} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy - fs * 0.7,
          textAlign: "center",
          fontFamily: t.font.title,
          fontWeight: 900,
          fontSize: fs,
          color: t.text,
          whiteSpace: "nowrap",
          transform: `translate(${shake}px, ${shake * 0.5}px) translate(${slam.dx}px, ${slam.dy}px) scale(${slam.scale})`,
          opacity: slam.opacity,
          clipPath: slam.clip,
          textShadow: `0 0 40px ${alpha(t.primary, 0.9)}, 0 0 100px ${alpha(t.primary, 0.4)}, ${-4 * (1 - clamp(slam.p))}px 0 ${t.secondary}`,
        }}
      >
        {data.title}
      </div>
      {data.sub && (
        <div style={{ position: "absolute", left: 0, right: 0, top: cy + fs * 0.75, textAlign: "center", fontFamily: t.font.body, fontSize: 40, fontWeight: 600, color: t.dim, letterSpacing: 6, opacity: sub.opacity }}>
          {data.sub}
        </div>
      )}
    </>
  );
};

export const Hook: CompDef<D> = {
  id: "hook",
  name: "开场冲击",
  layer: "structure",
  variants: 1,
  minSec: 2.5,
  maxSec: 6,
  tags: [],
  motion: { kind: "超空间速度线放射+冲击波扩散，大字从远处砸入并抖动", energy: 3 },
  desc: "冲击波 + 速度线，标题放大砸入并抖动",
  use: "没有真人口播时的开场标题（有口播时开场用 talking-head-stage）",
  schema,
  example: { title: "一个人，就是一家公司", sub: "AI 时代的超级个体" },
  C,
};
