import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  cells: z.number().int().min(10).max(40).default(24).describe("日历格子数（天/小时格子，铺满凝成顶）"),
  ceilingValue: z.string().default("月入 3 万").describe("天花板写的那行字"),
  curveLabel: z.string().default("收入").describe("上升曲线的名字"),
  breakTop: z.boolean().default(false).describe("是否演「把顶掀碎」（第二拍）"),
  fillAt: z.number().optional().describe("格子开始铺的时刻"),
  hitAt: z.number().optional().describe("撞顶的时刻（锚点，如“天花板”）"),
  breakAt: z.number().optional().describe("顶被砸碎的时刻（锚点，如“拆掉”）、"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const cells = data.cells;
  const fillAt = cueOr(data.fillAt, 6);
  const fillEnd = Math.round(dur * (data.breakTop ? 0.42 : 0.66));
  const hitAt = cueOr(data.hitAt, fillEnd + 12);
  const breakAt = cueOr(data.breakAt, hitAt + 34);
  const cols = full ? 8 : 6;
  const rows = Math.ceil(cells / cols);
  const gridW = full ? W * 0.42 : W * 0.52;
  const cellW = gridW / cols;
  const cellH = full ? 54 : 32;
  const gridX = full ? W * 0.1 : W * 0.06;
  const gridTop = full ? H * 0.62 - rows * cellH : H * 0.66 - rows * cellH;
  const ceilY = gridTop;
  const filled = cells; // all cells eventually fill
  const fillK = clamp((frame - fillAt) / Math.max(1, fillEnd - fillAt));
  const nFilled = Math.round(fillK * cells);
  // the ceiling: a glowing bar that grows across the top of the filled cells
  const ceilGrow = easeInOut(prog(frame, fillEnd - 8, 24));
  const hit = frame >= hitAt;
  const hitK = easeOut(prog(frame, hitAt, 10));
  // revenue curve climbs and slams into the ceiling
  const curveW = full ? W * 0.44 : W * 0.5;
  const curveX = full ? W * 0.52 : W * 0.46;
  const curveTop = full ? H * 0.28 : H * 0.2;
  const curveH = full ? H * 0.34 : H * 0.26;
  const rise = easeOut(prog(frame, fillAt + 10, Math.max(20, fillEnd - fillAt - 10)));
  // before the hit the curve stops at the ceiling; after breaking it keeps climbing
  const capK = hit && data.breakTop ? prog(frame, breakAt, 24) : 0;
  const curveY = curveTop + curveH * (1 - Math.min(1, rise * (1 + capK * 1.2)));
  const bounce = hit && !data.breakTop ? Math.max(0, 1 - (frame - hitAt) / 10) : 0;
  const sh = hitShake(frame, [hitAt, breakAt], full ? (data.breakTop ? 24 : 14) : 7, 14, seed);
  // fragments when the ceiling breaks
  const shards = data.breakTop && hit && frame >= breakAt ? Array.from({ length: 14 }, (_, i) => {
    const p = easeOut(prog(frame, breakAt, 26));
    const a = ((i / 14) * Math.PI) - Math.PI / 2;
    return { x: Math.cos(a) * p * (full ? 420 : 210), y: -Math.abs(Math.sin(a)) * p * (full ? 300 : 150) + p * p * (full ? 320 : 160), r: (i - 7) * p * 40, s: 1 - p, i };
  }) : [];

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* calendar cells filling up */}
        {Array.from({ length: cells }, (_, i) => {
          const on = i < nFilled;
          const c = i % cols;
          const r = Math.floor(i / cols);
          const p = on ? easeOutBack(prog(frame, fillAt + (i / cells) * (fillEnd - fillAt), 10)) : 0;
          return (
            <div key={i} style={{ position: "absolute", left: gridX + c * cellW, top: gridTop + r * cellH, width: cellW - 6, height: cellH - 6, borderRadius: 6, background: on ? `linear-gradient(180deg, ${alpha(t.primary, 0.55)}, ${alpha(t.primary, 0.25)})` : alpha(t.text, 0.06), border: `1.5px solid ${on ? alpha(t.primary, 0.85) : alpha(t.text, 0.16)}`, transform: `scale(${on ? p : 1})`, boxShadow: on ? `0 0 12px ${alpha(t.primary, 0.4)}` : undefined }} />
          );
        })}
        {/* the glowing ceiling */}
        {ceilGrow > 0 && (
          <>
            <div style={{ position: "absolute", left: gridX - 10, top: ceilY - (full ? 20 : 12), width: (gridW + 20) * ceilGrow, height: full ? 12 : 7, borderRadius: 6, background: `linear-gradient(90deg, ${t.gold}, ${t.accent})`, boxShadow: `0 0 26px ${alpha(t.gold, 0.8)}` }} />
            <div style={{ position: "absolute", left: gridX, top: ceilY - (full ? 78 : 44), width: gridW, textAlign: "center", opacity: ceilGrow, transform: `scale(${lerp(0.8, 1, easeOutBack(prog(frame, fillEnd, 16)))})`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.ceilingValue, gridW, full ? 40 : 20, 13), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 20px ${alpha(t.gold, 0.7)}` }}>
              {data.ceilingValue}
            </div>
          </>
        )}
        {/* break shards */}
        {shards.map((s) => (
          <div key={s.i} style={{ position: "absolute", left: gridX + gridW / 2 + s.x, top: ceilY + s.y, width: full ? 40 : 22, height: full ? 12 : 7, borderRadius: 3, background: t.gold, opacity: s.s, transform: `rotate(${s.r}deg)` }} />
        ))}
        {/* revenue curve */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <GlowDefs id="tc" std={6} user />
          <line x1={curveX} y1={curveTop + curveH} x2={curveX + curveW} y2={curveTop + curveH} stroke={alpha(t.text, 0.25)} strokeWidth={2} />
          <line x1={curveX} y1={curveTop} x2={curveX} y2={curveTop + curveH} stroke={alpha(t.text, 0.25)} strokeWidth={2} />
          {/* the ceiling line continues across the chart */}
          {ceilGrow > 0 && <line x1={curveX} y1={lerp(curveTop + curveH, gridTop, 0.5)} x2={curveX + curveW * ceilGrow} y2={lerp(curveTop + curveH, gridTop, 0.5)} stroke={t.gold} strokeWidth={3} strokeDasharray="10 8" filter="url(#tc)" />}
          {/* the climbing curve */}
          <path
            d={(() => {
              const pts: string[] = [];
              for (let i = 0; i <= 40; i++) {
                const k = i / 40;
                const x = curveX + curveW * k * Math.min(1, rise * 1.15 + capK * 0.35);
                const lim = lerp(curveTop + curveH, gridTop, 0.5);
                const yRaw = curveTop + curveH - (curveTop + curveH - curveTop) * Math.min(1, rise * 1.25 * (k > 0.55 ? 1 : k / 0.55));
                const y = data.breakTop && capK > 0 ? yRaw : Math.max(lim, Math.min(curveTop + curveH, yRaw));
                pts.push(`${x},${Math.min(curveTop + curveH, y)}`);
              }
              return `M${pts.join(" L")}`;
            })()}
            fill="none"
            stroke={hit && !data.breakTop ? t.bad : t.primary}
            strokeWidth={6}
            strokeLinecap="round"
            filter="url(#tc)"
          />
          {/* impact burst at the ceiling */}
          {hit && frame < hitAt + 26 && (
            <>
              <circle cx={curveX + curveW * 0.86} cy={lerp(curveTop + curveH, gridTop, 0.5)} r={easeOut(prog(frame, hitAt, 24)) * (full ? 120 : 60)} fill="none" stroke={alpha(t.bad, 1 - prog(frame, hitAt, 24))} strokeWidth={5} />
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2;
                const r = easeOut(prog(frame, hitAt, 22)) * (full ? 90 : 45);
                return <circle key={i} cx={curveX + curveW * 0.86 + Math.cos(a) * r} cy={lerp(curveTop + curveH, gridTop, 0.5) + Math.sin(a) * r} r={(full ? 9 : 5) * (1 - prog(frame, hitAt, 22))} fill={t.bad} />;
              })}
            </>
          )}
        </svg>
        <div style={{ position: "absolute", left: curveX, top: curveTop - (full ? 46 : 24), fontFamily: t.font.mono, fontSize: full ? 22 : 13, letterSpacing: 4, color: t.primary, opacity: easeOut(prog(frame, fillAt, 12)) }}>{data.curveLabel}</div>
        {/* hammer when the ceiling is broken */}
        {data.breakTop && hit && frame >= breakAt - 14 && (() => {
          const k = easeIn(prog(frame, breakAt - 14, 12));
          const hx = curveX + curveW * 0.86;
          const hy = lerp(curveTop - (full ? 260 : 130), lerp(curveTop + curveH, gridTop, 0.5) - (full ? 60 : 30), k);
          return (
            <div style={{ position: "absolute", left: hx, top: hy, transform: `translate(-50%,-50%) rotate(${lerp(-40, 10, k)}deg)`, opacity: 1 - prog(frame, breakAt + 16, 12) }}>
              <Icon name="tool" size={full ? 110 : 56} color={t.accent} />
            </div>
          );
        })()}
      </div>
      <Sfx name="tick" at={fillAt} volume={0.2} />
      <Sfx name="impact" at={hitAt} volume={data.breakTop ? 0.3 : 0.45} />
      {data.breakTop && <Sfx name="glitch" at={breakAt} volume={0.4} />}
      {data.breakTop && <Sfx name="success" at={breakAt + 16} volume={0.32} />}
    </>
  );
};

export const TimeCeiling: CompDef<D> = {
  id: "time-ceiling",
  name: "收入天花板",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["天花板", "上限", "封顶", "撞顶", "拆掉"],
  motion: { kind: "日历格逐格填满凝成发光顶 → 收入曲线攀升撞顶弹回闪红 → 锤子掀碎顶", energy: 3 },
  desc: "日历/工时格子一格格填满，在顶上凝成一道发光的横梁（写着数额）；右边的收入曲线一路攀升、砰地撞在那道顶上被弹回并闪红；第二拍一把锤子把顶砸碎，碎片四散、曲线继续往上冲",
  use: "讲上限被封住：收入天花板 = 时间、按时长算钱天花板在自己身上、累死累活也上不去、把顶拆掉",
  panel: true,
  schema,
  example: { cells: 24, ceilingValue: "月入 3 万", curveLabel: "收入", breakTop: true },
  C,
};
