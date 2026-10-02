import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  events: z.array(z.object({ time: z.string(), text: z.string() })).min(2).max(8),
});
type D = z.infer<typeof schema>;

// camera tracks along a long rail; past events recede, the current one is spotlit
const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const ev = data.events;
  const n = ev.length;
  const gap = 520;
  const per = Math.max(20, (dur - 24) / n);
  const idxF = clamp((frame - 10) / per, 0, n - 1);
  const i0 = Math.floor(idxF);
  const frac = idxF - i0;
  const cam = (i0 + easeInOut(clamp(frac * 1.6))) * gap;
  const cy = height / 2 + 60;
  const railY = cy;
  const originX = width * 0.38;
  const current = Math.round(idxF);

  const eCounter = enterAt(frame, 6, { fallback: "rise", dur: 20 });
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="tl" std={6} />
        <line x1={0} y1={railY} x2={width} y2={railY} stroke={alpha(t.primary, 0.2)} strokeWidth={2} />
        <line x1={0} y1={railY} x2={originX + Math.min(cam, (n - 1) * gap) - cam + (frac > 0 ? 0 : 0)} y2={railY} stroke={t.primary} strokeWidth={4} filter="url(#tl)" />
        {new Array(80).fill(0).map((_, k) => {
          const x = originX + k * 52 - (cam % 52) - 520;
          return <line key={k} x1={x} y1={railY - (k % 5 === 0 ? 14 : 6)} x2={x} y2={railY + (k % 5 === 0 ? 14 : 6)} stroke={alpha(t.primary, 0.3)} />;
        })}
      </svg>
      {ev.map((e, i) => {
        const x = originX + i * gap - cam;
        const dist = Math.abs(i - idxF);
        const focus = clamp(1 - dist);
        const passed = i <= idxF + 0.05;
        // 事件节点原生是回弹弹入（dot scale + 卡片淡入）；分镜写 motion.enter 才换
        const en = enterAt(frame, 10 + i * per - 12, { fallback: "rise", dur: 18, from: 0 });
        const up = variant === 1 ? i % 2 === 0 : true;
        const scale = 0.72 + focus * 0.38;
        const tf = fitFont(e.text, 440, 34, 22);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: x - 18,
                top: railY - 18,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: passed ? t.primary : t.bg2,
                border: `3px solid ${passed ? t.text : alpha(t.primary, 0.5)}`,
                boxShadow: passed ? `0 0 ${20 + focus * 30}px ${t.primary}` : "none",
                transform: `scale(${en.scale}) translate(${en.dx}px, ${en.dy}px)`,
                clipPath: en.clip,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x - 230,
                width: 460,
                top: up ? railY - 60 - 210 * scale : railY + 50,
                height: 210 * scale,
                opacity: clamp(en.p) * (0.35 + focus * 0.65),
                transform: `scale(${scale}) translate(${en.dx}px, ${en.dy}px)`,
                clipPath: en.clip,
                transformOrigin: up ? "50% 100%" : "50% 0%",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: up ? "flex-end" : "flex-start",
              }}
            >
              <div style={{ fontFamily: t.font.mono, fontWeight: 700, fontSize: 64, color: focus > 0.5 ? t.primary : t.dim, textShadow: focus > 0.5 ? `0 0 30px ${alpha(t.primary, 0.8)}` : undefined }}>{e.time}</div>
              <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: tf, color: t.text, marginTop: 8, lineHeight: 1.35 }}>{e.text}</div>
            </div>
            <div style={{ position: "absolute", left: x - 1, top: up ? railY - 50 : railY + 18, width: 2, height: 32, background: alpha(t.primary, 0.3 + focus * 0.7) }} />
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", right: 120, bottom: 150, fontFamily: t.font.mono, fontSize: 18, color: t.dim, letterSpacing: 3, opacity: eCounter.opacity, transform: `translate(${eCounter.dx}px, ${eCounter.dy}px)`, clipPath: eCounter.clip }}>
        {`EVENT ${String(current + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`}
      </div>
      <Headline kicker={data.kicker ?? "TIMELINE"} title={data.title} frame={frame} />
    </>
  );
};

export const Timeline: CompDef<D> = {
  id: "timeline",
  name: "时间轨道推进",
  layer: "info",
  variants: 2,
  minSec: 5,
  maxSec: 14,
  tags: ["年", "月", "时间", "历史", "发展", "发布", "那时候", "后来"],
  motion: { kind: "镜头沿时间轨道推进，事件节点依次回弹点亮", energy: 2 },
  desc: "时间轴上的年份节点依次点亮，镜头沿轴推进",
  use: "按年份/时间顺序讲发展历程",
  schema,
  example: { title: "三年，AI 走了多远", events: [{ time: "2022", text: "ChatGPT 发布" }, { time: "2024", text: "多模态普及" }, { time: "2026", text: "Agent 接管工作流" }] },
  C,
};
