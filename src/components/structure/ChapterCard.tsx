import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Title } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({ index: z.number(), total: z.number(), title: z.string() });
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, variant }) => {
  const t = useTheme();
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;
  const numP = easeOutBack(prog(frame, 0, 20));
  const lineP = easeInOut(prog(frame, 6, 24));
  const num = String(data.index + 1).padStart(2, "0");
  const fs = fitFont(data.title, 1400, 92);
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="cc" std={8} />
        {variant === 0 ? (
          <>
            <circle cx={cx} cy={cy - 60} r={230} fill="none" stroke={alpha(t.primary, 0.25)} strokeWidth={2} pathLength={1} strokeDasharray={`${lineP} 1`} transform={`rotate(-90 ${cx} ${cy - 60})`} />
            <circle cx={cx} cy={cy - 60} r={250} fill="none" stroke={t.primary} strokeWidth={3} pathLength={1} strokeDasharray={`${lineP * 0.3} 1`} strokeDashoffset={-frame * 0.01} filter="url(#cc)" />
          </>
        ) : (
          <>
            <line x1={cx - 700 * lineP} y1={cy + 90} x2={cx + 700 * lineP} y2={cy + 90} stroke={t.primary} strokeWidth={2} filter="url(#cc)" />
            {new Array(9).fill(0).map((_, i) => (
              <rect key={i} x={cx - 700 * lineP + i * 175 * lineP - 3} y={cy + 84} width={6} height={12} fill={t.primary} opacity={lineP} />
            ))}
          </>
        )}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: variant === 0 ? cy - 210 : cy - 260, textAlign: "center", fontFamily: t.font.mono, fontWeight: 700, fontSize: 220, color: "transparent", WebkitTextStroke: `2px ${t.primary}`, opacity: clamp(numP), transform: `scale(${numP})`, textShadow: `0 0 50px ${alpha(t.primary, 0.5)}` }}>
        {num}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: cy + 110, textAlign: "center", fontFamily: t.font.mono, fontSize: 22, letterSpacing: 10, color: t.dim, opacity: easeOut(prog(frame, 8, 16)) }}>
        {`CHAPTER ${num} / ${String(data.total).padStart(2, "0")}`}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: cy + 150, display: "flex", justifyContent: "center" }}>
        <Title text={data.title} frame={frame} delay={10} size={fs} style={{ position: "relative" }} />
      </div>
    </>
  );
};

export const ChapterCard: CompDef<D> = {
  id: "chapter",
  name: "章节标题卡",
  layer: "structure",
  variants: 2,
  minSec: 2,
  maxSec: 3,
  tags: [],
  desc: "大号章节编号 + 章节标题的过场卡",
  use: "无配音估算模式的章节过场（有配音时章节由顶部 HUD 闪现，不占时长，一般不用它）",
  schema,
  example: { index: 1, total: 4, title: "为什么 Agent 会取代 App" },
  C,
};
