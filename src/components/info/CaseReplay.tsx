import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const ev = z.object({
  time: z.string().describe("时间点：凌晨 3 点 / 第 3 天 / 2008 年"),
  title: z.string().describe("这件事是什么，短"),
  note: z.string().optional().describe("补充一行，如“打了 40 分钟电话”"),
  icon: z.string().optional(),
  at: z.number().optional().describe("这一格滑入的时刻（锚点）"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  scale: z.enum(["hour", "day", "year"]).default("hour").describe("时间粒度：hour 一天内 / day 一周内 / year 多年发展史"),
  events: z.array(ev).min(2).max(6),
  outcome: z.string().optional().describe("最后的结果条，如“复盘后流程重写”"),
  outcomeAt: z.number().optional(),
  hlCurrent: z.boolean().default(true).describe("当前事件放大发光，走过的变暗"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.events.length;
  const cues = data.events.map((e, i) => cueOr(e.at, 10 + i * Math.round(Math.max(18, (dur * 0.66) / n))));
  const outcomeAt = cueOr(data.outcomeAt, cues[n - 1] + 24);
  const railY = full ? H * 0.52 : H * 0.48;
  const left = full ? W * 0.08 : W * 0.05;
  const right = full ? W * 0.92 : W * 0.95;
  const span = right - left;
  const sh = hitShake(frame, cues, full ? 7 : 4, 10, seed);
  // current event = last one that has arrived
  let cur = -1;
  for (let i = 0; i < n; i++) if (frame >= cues[i]) cur = i;
  const railP = easeOut(prog(frame, 4, 18));
  // 结论奖牌原生是从 0 回弹放大落位 → rise + from:0 保住基线
  const eOut = enterAt(frame, outcomeAt, { fallback: "rise", dur: 14, from: 0 });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="cr" std={6} user />
          {/* the rail grows left to right as events arrive */}
          <line x1={left} y1={railY} x2={left + span * railP * clamp((cur + 1) / n + 0.12)} y2={railY} stroke={t.primary} strokeWidth={full ? 6 : 4} strokeLinecap="round" filter="url(#cr)" />
          <line x1={left} y1={railY} x2={right} y2={railY} stroke={alpha(t.text, 0.16)} strokeWidth={2} strokeDasharray="8 10" />
          {/* nodes */}
          {data.events.map((e, i) => {
            const x = n === 1 ? left : left + (span * i) / (n - 1);
            const arrived = frame >= cues[i];
            const isCur = i === cur && data.hlCurrent;
            // 节点原生是 easeOutBack 弹出（半径长大）→ rise 的 p 与之一致；节点钉在轨道上，不额外加位移
            const en = enterAt(frame, cues[i], { fallback: "rise", dur: 12, seed: i });
            const p = arrived ? en.p : 0;
            const col = isCur ? t.accent : arrived ? t.primary : t.dim;
            return (
              <g key={i}>
                <circle cx={x} cy={railY} r={(full ? (isCur ? 30 : 20) : isCur ? 17 : 11) * (0.4 + 0.6 * p)} fill={alpha(col, arrived ? 0.9 : 0.2)} stroke={col} strokeWidth={3} style={{ filter: arrived ? `drop-shadow(0 0 ${isCur ? 20 : 10}px ${alpha(col, 0.8)})` : undefined }} />
                {/* stem up to the card */}
                {arrived && <line x1={x} y1={railY - (full ? 20 : 11)} x2={x} y2={lerp(railY - (full ? 20 : 11), railY - (full ? 150 : 84), p)} stroke={col} strokeWidth={2.5} opacity={0.7} />}
              </g>
            );
          })}
        </svg>
        {/* event cards float above the rail */}
        {data.events.map((e, i) => {
          const x = n === 1 ? left : left + (span * i) / (n - 1);
          const c = cues[i];
          if (frame < c) return null;
          // 原生：卡片从上方 -26px 落下并回弹到位 → drop 的 p 同为 easeOutBack，dist 把 150px 折成原生 26px
          const ec = enterAt(frame, c, { fallback: "drop", dur: 14, dist: 26 / 150, seed: i });
          const p = ec.p;
          const isCur = i === cur && data.hlCurrent;
          const passed = i < cur;
          const col = isCur ? t.accent : passed ? t.primary : t.dim;
          const cw = full ? Math.min(300, span / n - 16) : Math.min(190, span / n - 8);
          const ic = e.icon ?? guessIcon(e.title) ?? "clock";
          return (
            <div key={i} style={{ position: "absolute", left: x - cw / 2, top: railY - (full ? 150 : 84) - (full ? 130 : 74), width: cw, height: full ? 130 : 74, transform: `translate(${ec.dx}px, ${ec.dy}px) scale(${p * (isCur ? 1.06 : 1) * ec.scale})`, clipPath: ec.clip, transformOrigin: "50% 100%", opacity: clamp(p * 1.3) * (passed ? 0.72 : 1), borderRadius: 14, background: isCur ? alpha(t.accent, 0.12) : alpha(t.bg2, 0.92), border: `2.5px solid ${col}`, boxShadow: isCur ? `0 0 26px ${alpha(t.accent, 0.5)}` : undefined, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: full ? 6 : 3, padding: full ? 12 : 6 }}>
              <Icon name={ic} size={full ? 32 : 18} color={col} />
              <div style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 20 : 12, color: col, whiteSpace: "nowrap" }}>{e.time}</div>
              <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(e.title, cw - 20, full ? 26 : 14, 11), color: t.text, whiteSpace: "nowrap" }}>{e.title}</div>
              {e.note && <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: fitFont(e.note, cw - 20, full ? 17 : 10, 9), color: t.dim, whiteSpace: "nowrap" }}>{e.note}</div>}
            </div>
          );
        })}
        {/* outcome banner under the rail */}
        {data.outcome && frame >= outcomeAt && (
          <div style={{ position: "absolute", left: W / 2, top: railY + (full ? 70 : 38), transform: `translateX(-50%) translate(${eOut.dx}px, ${eOut.dy}px) scale(${eOut.scale})`, clipPath: eOut.clip, opacity: eOut.opacity, display: "flex", alignItems: "center", gap: full ? 14 : 7, padding: `${full ? 10 : 5}px ${full ? 28 : 14}px`, borderRadius: 30, background: alpha(t.gold, 0.14), border: `3px solid ${t.gold}`, boxShadow: `0 0 30px ${alpha(t.gold, 0.5)}` }}>
            <Icon name="award" size={full ? 32 : 17} color={t.gold} />
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.outcome, W * 0.7, full ? 40 : 20, 13), color: t.gold, whiteSpace: "nowrap" }}>{data.outcome}</span>
          </div>
        )}
        {full && (
          <div style={{ position: "absolute", left: left, top: railY + (full ? 132 : 70), fontFamily: t.font.mono, fontSize: 18, letterSpacing: 4, color: t.dim }}>
            {data.scale === "hour" ? "同一天" : data.scale === "day" ? "同一周" : "这几年"}
          </div>
        )}
      </div>
      {cues.map((c, i) => (
        <Sfx key={i} name="whoosh" at={c} volume={0.22} />
      ))}
      {data.outcome && <Sfx name="success" at={outcomeAt} volume={0.34} />}
    </>
  );
};

export const CaseReplay: CompDef<D> = {
  id: "case-replay",
  name: "事件回放（时间轴串事件）",
  layer: "info",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["回放", "时间轴", "凌晨三点", "第几天", "复盘", "经过"],
  motion: { kind: "轨道随事件向左推进 · 事件卡逐格滑入 · 当前卡放大发光", energy: 2 },
  desc: "一条横向时间轨道，随着讲到每件事，一枚时间节点亮起、上方滑入事件卡（时间 + 标题 + 小注 + 图标），当前的卡放大发光、走过的变暗；最后在轨道下方落一条结论奖牌",
  use: "按时间顺序讲一段经过：凌晨 3 点告警 → 白天救火 → 月底复盘；这一周发生了什么；一个项目从立项到上线；也可以当“这几年”的发展史用（scale=year）",
  panel: true,
  schema,
  example: { scale: "hour", events: [{ time: "凌晨 3 点", title: "服务器报警", note: "一个人爬起来修", icon: "warn" }, { time: "早上 9 点", title: "同事接着救火", note: "没人知道原因", icon: "fire" }, { time: "月底", title: "复盘重写流程", note: "从此不再半夜响", icon: "doc" }], outcome: "从救火变成不再着火" },
  C,
};
