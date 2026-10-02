import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Figure, gait, mixPose, POSES } from "../../lib/figure";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  dailyTask: z.string().default("一天一趟挑水").describe("挑水那侧写的动作"),
  dailyIncome: z.string().default("日入 100").describe("挑水侧的读数"),
  wells: z.array(z.object({ text: z.string(), icon: z.string().optional() })).min(1).max(4).describe("挖出来的井（资产）：内容 / 系统 / 客户名单"),
  wellIncome: z.string().default("日入 2000").describe("挖井侧的读数"),
  flowLabel: z.string().default("睡后也在产").describe("水管上方浮出的字"),
  digAt: z.number().optional().describe("开始挖的时刻"),
  waterAt: z.number().optional().describe("见水的时刻（锚点，如“挖到水”）"),
  stopAt: z.number().optional().describe("挑水的人停下来的时刻（水位归零）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const digAt = cueOr(data.digAt, 24);
  const waterAt = cueOr(data.waterAt, Math.round(dur * 0.5));
  const stopAt = cueOr(data.stopAt, waterAt + 26);
  const G = full ? H * 0.72 : H * 0.68;
  const halfW = W / 2;
  const sh = hitShake(frame, [waterAt], full ? 12 : 6, 14, seed);

  // ── left: the water carrier ──
  const figH = full ? 132 : 74;
  const tripLen = 62;
  const trips = Math.max(1, Math.floor((stopAt - 10) / tripLen));
  const walking = frame >= 10 && frame < stopAt;
  const tripPhase = walking ? (frame - 10) / tripLen : 0;
  const tripIdx = Math.floor(tripPhase);
  const within = tripPhase - tripIdx;
  const fwd = tripIdx % 2 === 0;
  const carryX = walking ? lerp(halfW * 0.16, halfW * 0.62, fwd ? within : 1 - within) : halfW * 0.16;
  // the trough fills as trips complete, then empties once he stops
  const doneTrips = walking ? tripIdx : trips;
  const troughK = walking ? clamp(doneTrips / Math.max(1, trips)) * 0.55 + (within * 0.45) : 0;
  const emptyK = frame >= stopAt ? easeInOut(prog(frame, stopAt, Math.max(20, dur - stopAt))) : 0;
  const level = clamp(troughK * (1 - emptyK));
  const carryPose = walking ? mixPose({ ...gait((frame - 10) / 22, 0.1), ls: 92, le: -22, rs: 96, re: -18 }, gait((frame - 10) / 22, 0.1), 0.35) : frame >= stopAt ? mixPose(POSES.stand, POSES.slump, clamp(emptyK * 2)) : POSES.stand;

  // ── right: the well digger ──
  const diggerH = full ? 132 : 74;
  const digging = frame >= digAt && frame < waterAt;
  const digCycle = ((frame - digAt) / 26) % 1;
  const digPose = digging ? mixPose(POSES.dig, POSES.digUp, clamp(digCycle * 2)) : frame >= waterAt ? POSES.proud : POSES.stand;
  const digDepth = clamp((frame - digAt) / Math.max(1, waterAt - digAt));
  const wellW = full ? 170 : 96;
  const wellX = halfW + W * (full ? 0.2 : 0.24);
  const wellTop = G - (full ? 150 : 84) * digDepth;
  // water flows once hit
  const flowK = frame >= waterAt ? easeOut(prog(frame, waterAt, 20)) : 0;
  const dugK = frame >= waterAt ? clamp((frame - waterAt) / 60) : 0;
  const income = dugK;
  // sweeping dirt particles while digging
  const dirt = digging ? Array.from({ length: 6 }, (_, i) => {
    const p = ((frame - digAt) / 26 + i / 6) % 1;
    return { x: wellX - (full ? 60 : 34) - p * (full ? 90 : 48), y: G - (full ? 40 : 22) - Math.sin(p * Math.PI) * (full ? 70 : 38), o: 1 - p };
  }) : [];

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="codWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={alpha(t.primary, 0.75)} />
              <stop offset="1" stopColor={alpha(t.primary, 0.35)} />
            </linearGradient>
          </defs>
          <GlowDefs id="cod" std={6} user />
          {/* divider */}
          <line x1={halfW} y1={full ? H * 0.2 : H * 0.12} x2={halfW} y2={G + 40} stroke={alpha(t.text, 0.16)} strokeWidth={2} strokeDasharray="8 10" />
          <line x1={0} y1={G} x2={W} y2={G} stroke={alpha(t.primary, 0.5)} strokeWidth={3} filter="url(#cod)" />
          {/* LEFT: trough */}
          <rect x={halfW * 0.06} y={G - (full ? 60 : 34)} width={full ? 120 : 68} height={full ? 60 : 34} rx={6} fill={alpha(t.text, 0.12)} stroke={alpha(t.text, 0.4)} strokeWidth={2} />
          {level > 0.01 && <rect x={halfW * 0.06 + 4} y={G - (full ? 60 : 34) + (full ? 56 : 30) * (1 - level)} width={(full ? 120 : 68) - 8} height={(full ? 56 : 30) * level} rx={4} fill="url(#codWater)" />}
          {/* RIGHT: the well */}
          <ellipse cx={wellX} cy={wellTop} rx={wellW / 2} ry={wellW / 5.4} fill="#05060a" stroke={alpha(t.text, 0.5)} strokeWidth={3} />
          <path d={`M${wellX - wellW / 2},${wellTop} L${wellX - wellW / 2},${G} L${wellX + wellW / 2},${G} L${wellX + wellW / 2},${wellTop} Z`} fill={alpha(t.text, 0.08)} stroke={alpha(t.text, 0.45)} strokeWidth={3} />
          {/* water inside the well */}
          {flowK > 0 && <ellipse cx={wellX} cy={wellTop + (full ? 30 : 16) * (1 - dugK * 0.8)} rx={(wellW / 2 - 8) * flowK} ry={(wellW / 5.4 - 4) * flowK} fill="url(#codWater)" style={{ filter: `drop-shadow(0 0 16px ${alpha(t.primary, 0.8)})` }} />}
          {/* pipe out of the well */}
          {flowK > 0 && (
            <path d={`M${wellX + wellW / 2},${wellTop + (full ? 40 : 22)} h ${(full ? 210 : 120) * flowK} v ${full ? 110 : 62} `} fill="none" stroke={alpha(t.primary, 0.5)} strokeWidth={full ? 26 : 14} strokeLinecap="round" />
          )}
          {digging && dirt.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={full ? 9 : 5} fill={alpha("#c9a86a", d.o)} />)}
        </svg>
        {/* left figure */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <Figure x={carryX} y={G} h={figH} pose={carryPose} color={t.text} glow={t.primary} dim={emptyK * 0.4} />
          {/* water jar on the shoulder */}
          {walking && <circle cx={carryX + figH * 0.34} cy={G - figH * 0.62} r={figH * 0.12} fill={alpha(t.primary, 0.75)} />}
          <Figure x={wellX - (full ? 130 : 76)} y={G} h={diggerH} pose={digPose} color={frame >= waterAt ? t.gold : t.text} glow={frame >= waterAt ? t.gold : t.primary} />
        </svg>
        {/* labels */}
        <div style={{ position: "absolute", left: 0, top: full ? H * 0.22 : H * 0.14, width: halfW, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 36 : 19, color: t.dim, opacity: easeOut(prog(frame, 4, 14)) }}>{data.dailyTask}</div>
        <div style={{ position: "absolute", left: halfW, top: full ? H * 0.22 : H * 0.14, width: halfW, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 36 : 19, color: t.gold, opacity: easeOut(prog(frame, 4, 14)) }}>先挖一口井</div>
        {/* income readouts */}
        <div style={{ position: "absolute", left: 0, top: G + (full ? 30 : 16), width: halfW, textAlign: "center" }}>
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.dailyIncome, halfW * 0.6, full ? 54 : 26, 15), color: level > 0.05 ? t.primary : t.dim, whiteSpace: "nowrap", transition: "none" }}>{data.dailyIncome}</span>
          {frame >= stopAt && <div style={{ marginTop: 6, fontFamily: t.font.body, fontWeight: 800, fontSize: full ? 26 : 14, color: t.bad, opacity: easeOut(prog(frame, stopAt + 16, 12)) }}>停下来就没有了</div>}
        </div>
        <div style={{ position: "absolute", left: halfW, top: G + (full ? 30 : 16), width: halfW, textAlign: "center" }}>
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.wellIncome, halfW * 0.6, full ? 54 : 26, 15), color: income > 0.05 ? t.gold : t.dim, whiteSpace: "nowrap" }}>{data.wellIncome}</span>
          {/* wells light up as they are "paid for" by the flow */}
          <div style={{ marginTop: full ? 14 : 6, display: "flex", justifyContent: "center", gap: full ? 14 : 7 }}>
            {data.wells.map((w, i) => {
              const on = frame >= waterAt + 14 + i * 12;
              const p = on ? easeOutBack(prog(frame, waterAt + 14 + i * 12, 12)) : 0;
              const ic = w.icon ?? guessIcon(w.text) ?? "shovel";
              return (
                <div key={i} style={{ transform: `scale(${p})`, display: "flex", alignItems: "center", gap: full ? 8 : 4, padding: `${full ? 5 : 3}px ${full ? 14 : 7}px`, borderRadius: 20, background: alpha(t.gold, 0.14), border: `2px solid ${alpha(t.gold, 0.8)}` }}>
                  <Icon name={ic} size={full ? 22 : 12} color={t.gold} />
                  <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: full ? 22 : 12, color: t.gold, whiteSpace: "nowrap" }}>{w.text}</span>
                </div>
              );
            })}
          </div>
        </div>
        {frame >= waterAt && (
          <div style={{ position: "absolute", left: wellX + wellW / 2 + (full ? 20 : 10), top: wellTop - (full ? 60 : 32), opacity: easeOut(prog(frame, waterAt + 6, 12)), fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 30 : 15, color: t.primary, whiteSpace: "nowrap", textShadow: `0 0 16px ${alpha(t.primary, 0.6)}` }}>{data.flowLabel}</div>
        )}
      </div>
      <Sfx name="swish" at={10} volume={0.14} />
      <Sfx name="tick" at={stopAt} volume={0.3} />
      {frame >= digAt && <Sfx name="swish" at={digAt} volume={0.2} />}
      <Sfx name="impact" at={waterAt} volume={0.4} />
      <Sfx name="success" at={waterAt + 16} volume={0.35} />
      {data.wells.map((_, i) => (
        <Sfx key={i} name="pop" at={waterAt + 14 + i * 12} volume={0.28} />
      ))}
    </>
  );
};

export const CarryOrDig: CompDef<D> = {
  id: "carry-or-dig",
  name: "挑水 vs 挖井（时间型 vs 资产型）",
  layer: "metaphor",
  variants: 1,
  minSec: 5,
  maxSec: 10,
  tags: ["挑水", "挖井", "资产", "睡后收入", "时间换钱", "复利"],
  motion: { kind: "左边来回挑水水位反复归零 → 右边埋头挖井见水 → 水管自动流出、井逐个点亮", energy: 2 },
  desc: "左右对照：左边一个小人一趟趟往返挑水，水槽的水涨涨落落，一停下来立刻见底变暗；右边一个小人埋头刨地（尘土飞溅），挖到水后水管自动流出、井口水位不断上涨，一口口「井」（内容/系统/客户名单）逐个点亮，两边各挂日收入读数",
  use: "讲两类收入的差别：挑水的日入一百，挖井的日入两千；你只是把水桶换大了一点，还是在挑水；资产型收入 vs 时间型收入",
  panel: true,
  schema,
  example: { dailyTask: "接一单干一单", dailyIncome: "日入 100", wells: [{ text: "内容", icon: "film" }, { text: "系统", icon: "grid" }, { text: "客户名单", icon: "users" }], wellIncome: "日入 2000", flowLabel: "睡后也在产" },
  C,
};
