import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const lane = z.object({
  say: z.string().describe("这一版的说法（原文，会逐字打出来）"),
  result: z.string().describe("这版说法得到的结果"),
  score: z.string().optional().describe("评分词，如“能用”“勉强”“完美”"),
  best: z.boolean().optional().describe("最好的一版：最后放大定格"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  lanes: z.array(lane).min(2).max(4),
  verdict: z.string().optional().describe("结论，如“差的就是这几个字”"),
  verdictAt: z.number().optional(),
  typeAt: z.number().optional().describe("开始逐字打说法原文的时刻"),
  resultAt: z.number().optional().describe("结果卡展开的时刻"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.lanes.length;
  const typeAt = cueOr(data.typeAt, 8);
  const typeLen = full ? 40 : 30;
  const resultAt = cueOr(data.resultAt, typeAt + typeLen + 10);
  const verdictAt = cueOr(data.verdictAt, resultAt + 30);
  const bestIdx = data.lanes.findIndex((l) => l.best);
  const best = bestIdx >= 0 ? bestIdx : 0;
  const laneH = full ? Math.min(214, (H * 0.62) / n) : 96;
  const top = full ? H * 0.22 : H * 0.14;
  const left = full ? W * 0.08 : W * 0.05;
  const sayW = full ? W * 0.42 : W * 0.48;
  const resW = full ? W * 0.32 : W * 0.42;
  const resX = left + sayW + (full ? 40 : 16);
  const sh = hitShake(frame, [verdictAt], full ? 10 : 5, 12, seed);
  // the winner scales up once decided
  const zoom = bestIdx >= 0 && frame >= verdictAt ? easeOut(prog(frame, verdictAt, 18)) : 0;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* lane frames first */}
        {data.lanes.map((l, i) => {
          const y = top + i * (laneH + (full ? 18 : 8));
          const p = easeOut(prog(frame, i * 3, 14));
          const isBest = i === best && zoom > 0;
          const col = l.best ? t.gold : t.dim;
          return (
            <div key={i} style={{ position: "absolute", left: left, top: y, width: sayW + resW + (full ? 40 : 16), height: laneH, transform: `scale(${1 + (isBest ? zoom * (bestIdx >= 0 ? 0.05 : 0) : 0)}) translateX(${(1 - p) * -40}px)`, transformOrigin: "0 50%", opacity: clamp(p * 1.4), borderRadius: 16, background: isBest ? alpha(t.gold, 0.08 * zoom) : alpha(t.text, 0.04), border: `2px solid ${isBest ? alpha(t.gold, 0.4 + 0.6 * zoom) : alpha(t.text, 0.14)}`, boxShadow: isBest ? `0 0 ${30 * zoom}px ${alpha(t.gold, 0.4)}` : undefined }}>
              <div style={{ position: "absolute", left: full ? 18 : 8, top: full ? 14 : 6, fontFamily: t.font.mono, fontSize: full ? 18 : 11, letterSpacing: 3, color: col }}>{String.fromCharCode(65 + i)}</div>
            </div>
          );
        })}
        {/* typed original text */}
        {data.lanes.map((l, i) => {
          const y = top + i * (laneH + (full ? 18 : 8));
          const chars = Array.from(l.say);
          const k = clamp((frame - typeAt - i * 4) / typeLen);
          const shown = chars.slice(0, Math.round(k * chars.length)).join("");
          const fs = fitFont(l.say, sayW - (full ? 50 : 24), laneH * 0.24, 12);
          return (
            <div key={i} style={{ position: "absolute", left: left + (full ? 44 : 22), top: y + laneH * 0.5, width: sayW, transform: "translateY(-50%)", fontFamily: t.font.body, fontWeight: 800, fontSize: fs, color: t.text, lineHeight: 1.3, opacity: easeOut(prog(frame, typeAt + i * 4, 8)) }}>
              {shown}
              {k < 1 && <span style={{ opacity: 0.7 }}>|</span>}
            </div>
          );
        })}
        {/* result cards unfold */}
        {data.lanes.map((l, i) => {
          const c = resultAt + i * 6;
          if (frame < c) return null;
          const y = top + i * (laneH + (full ? 18 : 8));
          const p = easeOutBack(prog(frame, c, 14));
          const isBest = l.best;
          const col = isBest ? t.gold : t.dim;
          const fs = fitFont(l.result, resW - (full ? 50 : 24), laneH * 0.26, 12);
          return (
            <div key={i} style={{ position: "absolute", left: resX, top: y + (full ? 14 : 8), width: resW, height: laneH - (full ? 28 : 16), transform: `perspective(800px) rotateY(${lerp(-80, 0, p)}deg)`, transformOrigin: "0% 50%", borderRadius: 14, background: isBest ? `linear-gradient(150deg, ${alpha(t.gold, 0.28)}, ${alpha(t.bg2, 0.95)})` : alpha(t.bg, 0.85), border: `2.5px solid ${isBest ? t.gold : alpha(t.dim, 0.6)}`, boxShadow: isBest && frame >= verdictAt ? `0 0 ${34 * zoom}px ${alpha(t.gold, 0.6)}` : undefined, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: full ? 8 : 4, opacity: clamp(p * 1.3) }}>
              <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: isBest ? t.gold : t.text, whiteSpace: "nowrap" }}>{l.result}</div>
              {l.score && <div style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 22 : 12, letterSpacing: 2, color: isBest ? t.gold : t.dim }}>{l.score}</div>}
              {isBest && frame >= verdictAt && <div style={{ position: "absolute", right: full ? 14 : 6, top: full ? 10 : 4, fontFamily: t.font.mono, fontSize: full ? 18 : 11, color: t.gold, opacity: zoom }}>最准的一版</div>}
            </div>
          );
        })}
        {/* connector arrows from each saying to its result */}
        {frame >= resultAt && (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {data.lanes.map((l, i) => {
              const y = top + i * (laneH + (full ? 18 : 8)) + laneH / 2;
              const p = easeOut(prog(frame, resultAt + i * 6, 12));
              const col = l.best ? t.gold : alpha(t.dim, 0.6);
              const xEnd = resX;
              const xStart = left + sayW;
              return (
                <g key={i} opacity={p}>
                  <line x1={xStart} y1={y} x2={lerp(xStart, xEnd - 10, p)} y2={y} stroke={col} strokeWidth={3} />
                  <polygon points={`${lerp(xStart, xEnd - 10, p)},${y - 9} ${lerp(xStart, xEnd - 10, p)},${y + 9} ${xEnd},${y}`} fill={col} />
                </g>
              );
            })}
          </svg>
        )}
        {data.verdict && frame >= verdictAt && (
          <div style={{ position: "absolute", left, top: top + n * (laneH + (full ? 18 : 8)) + (full ? 22 : 10), transform: `scale(${easeOutBack(prog(frame, verdictAt, 14))})`, transformOrigin: "0 50%", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.7, full ? 54 : 26, 15), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 24px ${alpha(t.gold, 0.6)}, 0 3px 0 #000` }}>{data.verdict}</div>
        )}
      </div>
      {data.lanes.map((_, i) => (
        <Sfx key={`t${i}`} name="typing" at={typeAt + i * 4} volume={0.18} />
      ))}
      {data.lanes.map((_, i) => (
        <Sfx key={`r${i}`} name="pop" at={resultAt + i * 6} volume={0.28} />
      ))}
      {data.verdict && <Sfx name="ding" at={verdictAt} volume={0.36} />}
    </>
  );
};

export const VersionLanes: CompDef<D> = {
  id: "version-lanes",
  name: "同一句话的 N 个版本（逐版对比）",
  layer: "info",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["几个说法", "同一句话", "改一版", "对比", "版本"],
  motion: { kind: "多条泳道立起 → 说法逐字打出 → 结果卡 3D 翻出并箭头接入 → 最佳一版放大定格", energy: 2 },
  desc: "N 条泳道上下排开，每条左边逐字打出一种说法原文，右边翻出对应的结果卡（带评分词）；箭头从说法连到结果；最后最好那一版整条镀金放大，盖章「最准的一版」",
  use: "同一件事的几种说法/几个版本逐版对比：三版提问并排看结果、同一句话两种说法两种回报、改了几个字效果差十倍",
  panel: true,
  schema,
  example: { lanes: [{ say: "帮我写个文案", result: "一堆套话", score: "没法用" }, { say: "写一条卖课的朋友圈，对象是想转行的宝妈，要真实案例", result: "能直接发", score: "能用", best: true }], verdict: "差的就是这几个字" },
  C,
};
