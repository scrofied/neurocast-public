import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeIn, easeOut, lerp, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { GlowDefs, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  input: z.string().optional(),
  output: z.string().optional(),
  chip: z.string().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2 + 60;
  const input = data.input ?? "帮我写一份周报";
  const output = data.output ?? "结构化结果 ✓";
  const chars = Array.from(input);
  // 芯片原生是回弹长大入场（scale 0→1，easeOutBack）
  const eChip = enterAt(frame, 0, { fallback: "rise", dur: 20, from: 0 });
  const suck0 = 18;
  const suckDur = Math.max(20, Math.min(40, dur * 0.3));
  const procEnd = suck0 + suckDur + 20;
  const outP = easeOut(prog(frame, procEnd, 22));
  // 结果原生是从左边 120px 推入 + 淡入（slide-l 的 p 就是 easeOut 进度，dist 换算成同样的 120px）
  const eOut = enterAt(frame, procEnd, { fallback: "slide-l", dur: 22, dist: 120 / 240 });
  const heat = clamp(prog(frame, suck0, suckDur + 20)) * (1 - outP * 0.6);
  const size = 320;
  const leftX = variant === 1 ? cx - 620 : cx - 640;
  const pins = 9;

  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="pc" std={7} />
        {/* traces */}
        {new Array(pins).fill(0).map((_, i) => {
          const y = cy - size / 2 + 20 + (i * (size - 40)) / (pins - 1);
          const flowIn = prog(frame, suck0 + i, suckDur);
          const flowOut = prog(frame, procEnd + i * 1.5, 24);
          return (
            <g key={i}>
              <path d={`M${cx - size / 2},${y} H${cx - size / 2 - 80} L${cx - size / 2 - 130},${y + (i - 4) * 14} H${leftX + 200}`} fill="none" stroke={t.primary} strokeOpacity={0.18} strokeWidth={2} />
              <path
                d={`M${cx - size / 2},${y} H${cx - size / 2 - 80} L${cx - size / 2 - 130},${y + (i - 4) * 14} H${leftX + 200}`}
                fill="none"
                stroke={t.primary}
                strokeWidth={2.5}
                strokeDasharray="40 600"
                strokeDashoffset={lerp(0, -640, flowIn) - 40}
                opacity={flowIn > 0 && flowIn < 1 ? 1 : 0}
                filter="url(#pc)"
                transform={`rotate(180 ${(cx - size / 2 + leftX + 200) / 2} ${y})`}
              />
              <path d={`M${cx + size / 2},${y} H${cx + size / 2 + 80} L${cx + size / 2 + 130},${y + (i - 4) * 14} H${cx + 560}`} fill="none" stroke={t.accent} strokeOpacity={0.18} strokeWidth={2} />
              <path
                d={`M${cx + size / 2},${y} H${cx + size / 2 + 80} L${cx + size / 2 + 130},${y + (i - 4) * 14} H${cx + 560}`}
                fill="none"
                stroke={t.accent}
                strokeWidth={2.5}
                strokeDasharray="40 600"
                strokeDashoffset={-flowOut * 600}
                opacity={flowOut > 0 && flowOut < 1 ? 1 : 0}
                filter="url(#pc)"
              />
            </g>
          );
        })}
      </svg>
      {/* chip */}
      <div
        style={{
          position: "absolute",
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          borderRadius: 26,
          transform: `perspective(1200px) translate(${eChip.dx}px, ${eChip.dy}px) rotateX(${18 - heat * 8}deg) rotateY(${-16 + heat * 10}deg) scale(${eChip.scale})`,
          opacity: eChip.opacity,
          clipPath: eChip.clip,
          background: `radial-gradient(circle at 50% 45%, ${alpha(t.primary, 0.25 + heat * 0.45)}, ${alpha(t.bg2, 0.95)} 70%)`,
          border: `2px solid ${alpha(t.primary, 0.6 + heat * 0.4)}`,
          boxShadow: `0 0 ${40 + heat * 80}px ${alpha(t.primary, 0.3 + heat * 0.4)}, inset 0 0 40px ${alpha(t.primary, 0.2)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div style={{ position: "absolute", inset: 22, border: `1px solid ${alpha(t.primary, 0.35)}`, borderRadius: 14 }} />
        <div style={{ fontFamily: t.font.mono, fontWeight: 700, fontSize: 42, color: t.text, textShadow: `0 0 18px ${t.primary}` }}>{data.chip ?? "LLM"}</div>
        <div style={{ fontFamily: t.font.mono, fontSize: 13, color: t.dim, marginTop: 8, letterSpacing: 3 }}>{heat > 0.2 && outP < 1 ? `PROCESSING ${Math.floor(heat * 99)}%` : "READY"}</div>
      </div>
      {/* input chars get sucked into chip */}
      {chars.map((c, i) => {
        const p = easeIn(prog(frame, suck0 + i * (suckDur / chars.length) * 0.6, suckDur * 0.55));
        const appear = easeOut(prog(frame, 2 + i * 1.2, 10));
        const sx = leftX + i * 40;
        const sy = cy - 20;
        const x = lerp(sx, cx - 16, p);
        const y = lerp(sy, cy - 20, p) - Math.sin(p * Math.PI) * 60 * ((i % 3) - 1);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontFamily: t.font.body,
              fontWeight: 700,
              fontSize: 38,
              color: t.text,
              opacity: appear * (1 - p),
              transform: `scale(${1 - p * 0.7})`,
              textShadow: `0 0 12px ${alpha(t.primary, 0.8)}`,
            }}
          >
            {c}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: cx + 200,
          top: cy - 36,
          width: 560,
          textAlign: "right",
          fontFamily: t.font.body,
          fontWeight: 800,
          fontSize: 40,
          color: t.accent,
          opacity: eOut.p,
          transform: `translate(${eOut.dx}px, ${eOut.dy}px)`,
          filter: `blur(${(1 - eOut.p) * 10}px)`,
          textShadow: `0 0 24px ${alpha(t.accent, 0.6)}`,
        }}
      >
        {output}
      </div>
      <Headline kicker={data.kicker ?? "PROMPT → MODEL"} title={data.title} frame={frame} />
    </>
  );
};

export const PromptChip: CompDef<D> = {
  id: "prompt",
  name: "提示词吸入芯片",
  layer: "metaphor",
  variants: 2,
  minSec: 4,
  maxSec: 9,
  tags: ["提示词", "Prompt", "指令", "输入", "问它", "告诉它", "喂给", "输出", "生成"],
  motion: { kind: "提示词逐字被吸进芯片（芯片发热运转）→ 右侧结果滑出", energy: 2 },
  desc: "一句提示词化作芯片插进 LLM 模块，模块运转后吐出结果",
  use: "“给模型一句话就出结果”的抽象表达；要展示指令原文、逐字打出时用 chat-command",
  schema,
  example: { title: "一句话，交给 AI", input: "帮我做一份竞品分析", output: "10 页报告 ✓" },
  C,
};
