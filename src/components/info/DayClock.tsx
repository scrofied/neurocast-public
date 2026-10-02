import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { GlowDefs, Heading } from "../../lib/ui";
import { useEnter, type EnterState } from "../../lib/enter";
import type { CompDef, CompProps } from "../types";

const end = z.object({ label: z.string(), time: z.string().describe("HH:MM"), event: z.string().optional(), at: z.number().optional() });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  from: end.describe("起点，如 早上 08:00 挖到痛点"),
  to: end.describe("终点，如 晚饭前 18:00 已发布"),
});
type D = z.infer<typeof schema>;

const mins = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const a0 = cueOr(data.from.at, 8);
  const a1 = cueOr(data.to.at, Math.max(a0 + 30, dur * 0.7));
  const k = easeInOut(prog(frame, a0 + 6, Math.max(10, a1 - a0 - 6)));
  const cx = width / 2;
  const cy = height - 250;
  const R = 700;
  // the sun stays above the horizon (169° -> 11°) so it never covers the end labels
  const ang = Math.PI * (0.94 - 0.88 * k);
  const sx = cx + Math.cos(ang) * R;
  const sy = cy - Math.sin(ang) * R * 0.78;
  const m = Math.round(mins(data.from.time) + (mins(data.to.time) - mins(data.from.time)) * k);
  const clock = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  // 起终点的事件旗原生是从 0 回弹弹出（scale 0→1）；from:0 保住这个基线
  const eFrom = enterAt(frame, a0, { fallback: "rise", dur: 16, from: 0 });
  const eTo = enterAt(frame, a1, { fallback: "rise", dur: 16, from: 0 });
  const dusk = k;
  const arc = `M${cx - R},${cy} A${R},${R * 0.78} 0 0 1 ${cx + R},${cy}`;
  const pin = (x: number, y: number, e: z.infer<typeof end>, ent: EnterState, gold: boolean) =>
    e.event && ent.p > 0 ? (
      <div style={{ position: "absolute", left: x, top: y - 150, transform: `translate(-50%,0) scale(${ent.scale}) translate(${ent.dx}px, ${ent.dy}px)`, opacity: ent.opacity, transformOrigin: "center bottom", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ padding: "12px 24px", borderRadius: 16, background: alpha(gold ? t.gold : t.primary, 0.18), border: `2px solid ${gold ? t.gold : t.primary}`, boxShadow: `0 0 30px ${alpha(gold ? t.gold : t.primary, 0.4)}`, display: "flex", alignItems: "center", gap: 10, fontFamily: t.font.title, fontWeight: 900, fontSize: 36, color: gold ? t.gold : t.text, whiteSpace: "nowrap" }}>
          <Icon name={gold ? "send" : "shovel"} size={32} color={gold ? t.gold : t.primary} />
          {e.event}
        </div>
        <div style={{ width: 3, height: 60, background: gold ? t.gold : t.primary }} />
      </div>
    ) : null;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(t.secondary, 0.12 * (1 - dusk))}, ${alpha(t.accent, 0.16 * dusk)} 70%, transparent)`, opacity: easeOut(prog(frame, 0, 20)) }} />
      <Heading kicker={data.kicker ?? "SAME DAY"} title={data.title} frame={frame} width={width} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="dc" std={14} />
        <path d={arc} fill="none" stroke={alpha(t.text, 0.18)} strokeWidth={3} strokeDasharray="6 10" />
        <path d={arc} fill="none" stroke={t.accent} strokeWidth={5} pathLength={1} strokeDasharray={`${k} 1`} />
        <line x1={cx - R - 60} y1={cy} x2={cx + R + 60} y2={cy} stroke={alpha(t.primary, 0.4)} strokeWidth={2} />
        <circle cx={sx} cy={sy} r={70} fill={alpha(t.accent, 0.25)} filter="url(#dc)" />
        <circle cx={sx} cy={sy} r={44} fill={t.accent} filter="url(#dc)" />
        {new Array(12).fill(0).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 + frame * 0.02;
          return <line key={i} x1={sx + Math.cos(a) * 58} y1={sy + Math.sin(a) * 58} x2={sx + Math.cos(a) * 80} y2={sy + Math.sin(a) * 80} stroke={t.accent} strokeWidth={4} strokeLinecap="round" opacity={0.8} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: cy - 330, textAlign: "center", fontFamily: t.font.mono, fontWeight: 700, fontSize: 150, color: t.text, textShadow: `0 0 40px ${alpha(t.accent, 0.5)}`, letterSpacing: 6, opacity: easeOut(prog(frame, 2, 14)) }}>{clock}</div>
      {[
        [cx - R, data.from],
        [cx + R, data.to],
      ].map(([x, e], i) => (
        <div key={i} style={{ position: "absolute", left: (x as number) - 150, width: 300, top: cy + 20, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: 44, color: t.text }}>
          {(e as z.infer<typeof end>).label}
          <div style={{ fontFamily: t.font.mono, fontSize: 26, color: t.dim, fontWeight: 400 }}>{(e as z.infer<typeof end>).time}</div>
        </div>
      ))}
      {pin(cx - R * 0.62, cy, data.from, eFrom, false)}
      {pin(cx + R * 0.62, cy, data.to, eTo, true)}
      <Sfx name="pop" at={a0} volume={0.3} />
      <Sfx name="whoosh" at={a0 + 6} volume={0.2} />
      <Sfx name="ding" at={a1} volume={0.35} />
    </>
  );
};

export const DayClock: CompDef<D> = {
  id: "day-clock",
  name: "一天之内（时间压缩）",
  layer: "info",
  variants: 1,
  minSec: 2,
  maxSec: 8,
  tags: ["早上", "晚上", "当天", "一天", "晚饭前", "效率", "马上"],
  motion: { kind: "太阳沿弧线从早走到晚 + 时钟数字滚动，起终点事件旗弹出", energy: 2 },
  desc: "太阳沿一天的弧线从早上走到傍晚，中间数字时钟滚动，起点插旗“挖到痛点”，终点金色插旗“已发布”",
  use: "从 A 时刻到 B 时刻就做完了（时间压缩、效率）：早上想到晚上上线、上午开会下午交付、9 点提需求 11 点出方案",
  schema,
  example: { from: { label: "早上", time: "08:00", event: "挖到痛点", at: 8 }, to: { label: "晚饭前", time: "18:00", event: "已发布", at: 90 } },
  C,
};
