import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import { useEnter } from "../../lib/enter";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  main: z.object({ label: z.string(), text: z.string(), result: z.string().optional() }).describe("正例：正确做法 + 它的结果"),
  bad: z.object({ label: z.string(), text: z.string(), result: z.string().optional() }).describe("反例：错误做法 + 它的结果"),
  badAt: z.number().optional().describe("反例从右侧滑入的时刻"),
  compareAt: z.number().optional().describe("两条结果箭头对应出来的时刻"),
  verdict: z.string().optional(),
  verdictAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const badAt = cueOr(data.badAt, Math.round(dur * 0.3));
  const compareAt = cueOr(data.compareAt, badAt + 34);
  const verdictAt = cueOr(data.verdictAt, compareAt + 26);
  const sh = hitShake(frame, [badAt], full ? 10 : 5, 14, seed);
  const cardW = full ? W * 0.32 : W * 0.42;
  const cardH = full ? H * 0.36 : H * 0.24;
  const mainX = full ? W * 0.1 : W * 0.05;
  const mainY = full ? H * 0.28 : H * 0.2;
  const badX = full ? W * 0.56 : W * 0.52;
  const badY = mainY;
  const cmp = easeOut(prog(frame, compareAt, 16));
  // 正例卡原生是淡入 + 从下方 30px 起；反例卡原生是从画面右侧推进来
  const eMain = enterAt(frame, 0, { fallback: "rise", dur: 14, dist: 1.36 });
  const eBad = enterAt(frame, badAt, { fallback: "slide-r", dur: 20, dist: (W + cardW - badX) / 240 });
  const eVerdict = enterAt(frame, verdictAt, { fallback: "rise", dur: 14, from: 0 });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* main sample */}
        <div style={{ position: "absolute", left: mainX, top: mainY, width: cardW, height: cardH, borderRadius: 18, background: `linear-gradient(160deg, ${alpha(t.primary, 0.18)}, ${alpha(t.bg2, 0.95)})`, border: `3px solid ${t.primary}`, boxShadow: `0 0 40px ${alpha(t.primary, 0.35)}`, opacity: eMain.opacity, transform: `translate(${eMain.dx}px, ${eMain.dy}px)`, display: "flex", flexDirection: "column", padding: full ? 26 : 14, gap: full ? 14 : 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="check" size={full ? 30 : 18} color={t.primary} stroke={4} />
            <span style={{ fontFamily: t.font.mono, fontSize: full ? 20 : 13, letterSpacing: 3, color: t.primary }}>{data.main.label}</span>
          </div>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.main.text, cardW - (full ? 60 : 30), full ? 40 : 20, 13), color: t.text, lineHeight: 1.35 }}>{data.main.text}</div>
          {data.main.result && <div style={{ marginTop: "auto", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.main.result, cardW - (full ? 60 : 30), full ? 34 : 17, 12), color: t.primary, whiteSpace: "nowrap" }}>{data.main.result}</div>}
        </div>
        {/* bad example slides in with a red edge */}
        {frame >= badAt - 4 && (
          <div style={{ position: "absolute", left: badX, top: badY, width: cardW, height: cardH, borderRadius: 18, background: `linear-gradient(160deg, ${alpha(t.bad, 0.14)}, ${alpha(t.bg2, 0.95)})`, border: `3px dashed ${t.bad}`, boxShadow: `0 0 40px ${alpha(t.bad, 0.3)}`, opacity: eBad.opacity, transform: `translate(${eBad.dx}px, ${eBad.dy}px)`, filter: `grayscale(${0.35 * eBad.p})`, display: "flex", flexDirection: "column", padding: full ? 26 : 14, gap: full ? 14 : 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="x" size={full ? 30 : 18} color={t.bad} stroke={4} />
              <span style={{ fontFamily: t.font.mono, fontSize: full ? 20 : 13, letterSpacing: 3, color: t.bad }}>{data.bad.label}</span>
            </div>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.bad.text, cardW - (full ? 60 : 30), full ? 40 : 20, 13), color: alpha(t.text, 0.8), lineHeight: 1.35 }}>{data.bad.text}</div>
            {data.bad.result && <div style={{ marginTop: "auto", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.bad.result, cardW - (full ? 60 : 30), full ? 34 : 17, 12), color: t.bad, whiteSpace: "nowrap" }}>{data.bad.result}</div>}
          </div>
        )}
        {/* result arrows: both point down to their outcomes and get compared */}
        {frame >= compareAt && (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {[{ x: mainX + cardW / 2, c: t.primary, d: 0 }, { x: badX + cardW / 2, c: t.bad, d: 6 }].map((a, i) => {
              const y0 = mainY + cardH;
              const y1 = y0 + (full ? 110 : 60) * cmp;
              return <g key={i} opacity={cmp}>
                <line x1={a.x} y1={y0} x2={a.x} y2={y1} stroke={a.c} strokeWidth={4} style={{ filter: `drop-shadow(0 0 8px ${a.c})` }} />
                <polygon points={`${a.x - 12},${y1} ${a.x + 12},${y1} ${a.x},${y1 + 18}`} fill={a.c} />
              </g>;
            })}
            {/* the gap between the two outcomes is bracketed */}
            <line x1={mainX + cardW / 2} y1={mainY + cardH + (full ? 122 : 66)} x2={lerp(mainX + cardW / 2, badX + cardW / 2, cmp)} y2={mainY + cardH + (full ? 122 : 66)} stroke={t.gold} strokeWidth={4} strokeDasharray="10 8" />
          </svg>
        )}
        {data.verdict && frame >= verdictAt && (
          <div style={{ position: "absolute", left: W / 2, top: mainY + cardH + (full ? 150 : 84), transform: `translateX(-50%) scale(${eVerdict.scale}) translate(${eVerdict.dx}px, ${eVerdict.dy}px)`, opacity: eVerdict.opacity, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.7, full ? 58 : 28, 16), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 26px ${alpha(t.gold, 0.6)}, 0 3px 0 #000` }}>{data.verdict}</div>
        )}
      </div>
      <Sfx name="swish" at={badAt} volume={0.32} />
      <Sfx name="ding" at={compareAt} volume={0.28} />
      {data.verdict && <Sfx name="stamp" at={verdictAt} volume={0.4} />}
    </>
  );
};

export const CounterExample: CompDef<D> = {
  id: "counter-example",
  name: "正例 + 反例对照",
  layer: "info",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["反例", "错误示范", "对比", "正确做法", "避雷"],
  motion: { kind: "正例先立 → 反例红边滑入灰化 → 两条结果箭头落下并拉出差距", energy: 2 },
  desc: "正例卡片先在左边立起来（✓ + 做法 + 结果），随后反例从右边滑进来、打上红色虚线边并整体灰化（✗ + 错误做法 + 结果）；两条结果箭头同时落下，中间用金色虚线量出差距，底部结论",
  use: "一个正确一个错误地对照：错误提问 → 垃圾结果；同样的需求两种问法；这样发客户会跑，那样发客户会回",
  panel: true,
  schema,
  example: { main: { label: "正确问法", text: "把客户的问题、背景、想要的格式一次说清", result: "直接能用的方案" }, bad: { label: "错误问法", text: "就一句“帮我写个工作汇报”", result: "一堆废话" }, verdict: "差的不是模型，是问法" },
  C,
};
