import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, easeIn, lerp, prog, rng } from "../../lib/anim";
import { hitShake, StampBox } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { guessIcon, Icon } from "../../lib/icons";
import { RingBurst } from "../../lib/cine/Flash";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const behindItem = z.object({
  text: z.string().describe("门后那个东西的名字（如“应届生”“实习生”）"),
  icon: z.string().optional().describe("图标名，缺省按文字猜"),
  at: z.number().optional().describe("它出现在门后的时刻（锚点）"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  doorLabel: z.string().optional().describe("挂在闸门上的牌子，如“招聘通道”“新手流量”"),
  gateAt: z.number().optional().describe("闸门轰然落下的时刻（锚点）"),
  weldAt: z.number().optional().describe("焊枪开始沿门框游走的时刻（锚点）"),
  sealText: z.string().default("焊死").describe("封条章上的字，默认“焊死”"),
  sealAt: z.number().optional().describe("封条章盖下的时刻（锚点）"),
  behind: z.array(behindItem).max(3).default([]).describe("门后渐暗消失的东西（0~3 个），各自 at 出现、焊完后淡出"),
  verdict: z.string().optional().describe("最后砸出的结论大字"),
  verdictAt: z.number().optional().describe("结论砸出的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;

  // ── 时间轴（锚点优先，缺省按 dur 比例自动错开） ──
  const gateAt = Math.min(cueOr(data.gateAt, 8), dur * 0.4);
  const land = gateAt + 16; // 闸门砸到位
  const weldAt = Math.max(cueOr(data.weldAt, Math.max(land + 16, dur * 0.44)), land + 8);
  const sealAt = Math.min(cueOr(data.sealAt, weldAt + 64), dur - 28);
  const weldSpan = Math.max(24, sealAt - weldAt - 12); // 焊枪走完四边
  const doneAt = weldAt + weldSpan;
  const vAt = Math.min(cueOr(data.verdictAt, sealAt + 16), dur - 12);
  const behindCues = listCues(data.behind, 3, Math.max(18, weldAt - 14));
  const fadeK = easeIn(prog(frame, doneAt + 4, 24)); // 焊完后门后的东西渐暗消失

  // ── 几何：透视通道 + 尽头一扇格栅闸门（全部按 useBox 比例算） ──
  const cx = W * 0.5;
  const F = H * 0.835; // 通道近端下沿（1080 时 902，安全区内）
  const dw = Math.min(W * 0.34, 660);
  const dh = H * 0.42;
  const y0 = H * 0.245;
  const y1 = y0 + dh;
  const x0 = cx - dw / 2;
  const x1 = cx + dw / 2;
  const fx0 = x0 - 10;
  const fy0 = y0 - 10;
  const fx1 = x1 + 10;
  const fy1 = y1 + 10;
  const nx0 = W * 0.03;
  const nx1 = W * 0.97;
  const ny0 = H * 0.11;

  const gateP = easeIn(prog(frame, gateAt, 16));
  const gateOff = lerp(-dh * 1.9, 0, gateP); // 闸门从天而降砸进框里
  const wk = prog(frame, weldAt, weldSpan); // 焊枪沿四边游走 0→1
  const sh = hitShake(frame, [land, sealAt], full ? 16 : 8, 14, seed);

  const jit = useMemo(() => {
    const r = rng(seed + 13);
    return Array.from({ length: 16 }, () => ({ dx: r() - 0.5, v: r(), rot: r() - 0.5 }));
  }, [seed]);

  // 焊枪位置：上 → 右 → 下 → 左 一圈
  const perW = fx1 - fx0;
  const perH = fy1 - fy0;
  const per = 2 * (perW + perH);
  const torch = (s: number) => {
    if (s < perW) return { x: fx0 + s, y: fy0 };
    s -= perW;
    if (s < perH) return { x: fx1, y: fy0 + s };
    s -= perH;
    if (s < perW) return { x: fx1 - s, y: fy1 };
    s -= perW;
    return { x: fx0, y: fy1 - s };
  };
  const tp = torch(clamp(wk, 0, 0.999) * per);
  // 已焊住的缝：走过的边整条点亮，当前边点亮走过的部分
  const seams: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (frame >= weldAt) {
    const s = wk * per;
    if (s > 0) seams.push({ x1: fx0, y1: fy0, x2: fx0 + Math.min(s, perW), y2: fy0 });
    if (s > perW) seams.push({ x1: fx1, y1: fy0, x2: fx1, y2: fy0 + Math.min(s - perW, perH) });
    if (s > perW + perH) seams.push({ x1: fx1, y1: fy1, x2: fx1 - Math.min(s - perW - perH, perW), y2: fy1 });
    if (s > 2 * perW + perH) seams.push({ x1: fx0, y1: fy1, x2: fx0, y2: fy1 - Math.min(s - 2 * perW - perH, perH) });
  }
  const weldDone = frame >= doneAt;

  const eStage = enterAt(frame, 0, { fallback: "rise", dur: 18 }); // 通道进场
  const bars = Math.max(5, Math.round(dw / (full ? 92 : 48)));

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px) scale(${eStage.scale}) translate(${eStage.dx}px, ${eStage.dy}px)`, transformOrigin: `${cx}px ${H * 0.5}px`, opacity: eStage.opacity, clipPath: eStage.clip }}>
        {/* 透视通道 */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="gw-line" std={6} user />
          <polygon points={`${nx0},${F} ${x0},${y1} ${x1},${y1} ${nx1},${F}`} fill={alpha(t.bg2, 0.85)} stroke={alpha(t.primary, 0.3)} strokeWidth={2} />
          <polygon points={`${nx0},${ny0} ${x0},${y0} ${x1},${y0} ${nx1},${ny0}`} fill={alpha(t.bg2, 0.5)} stroke={alpha(t.primary, 0.22)} strokeWidth={2} />
          <polygon points={`${nx0},${ny0} ${x0},${y0} ${x0},${y1} ${nx0},${F}`} fill={alpha(t.bg, 0.66)} stroke={alpha(t.primary, 0.26)} strokeWidth={2} />
          <polygon points={`${nx1},${ny0} ${x1},${y0} ${x1},${y1} ${nx1},${F}`} fill={alpha(t.bg, 0.66)} stroke={alpha(t.primary, 0.26)} strokeWidth={2} />
          {/* 地面导向线：通道深处一排，制造透视 */}
          {[0.25, 0.45, 0.62, 0.78, 0.9].map((kk, i) => {
            const yy = lerp(F, y1, kk);
            const xl = lerp(nx0, x0, kk);
            const xr = lerp(nx1, x1, kk);
            return <line key={i} x1={xl} y1={yy} x2={xr} y2={yy} stroke={alpha(t.dim, 0.3 - i * 0.03)} strokeWidth={2} strokeDasharray="14 12" />;
          })}
          <line x1={nx0} y1={F} x2={x0} y2={y1} stroke={alpha(t.primary, 0.45)} strokeWidth={3} filter="url(#gw-line)" />
          <line x1={nx1} y1={F} x2={x1} y2={y1} stroke={alpha(t.primary, 0.45)} strokeWidth={3} filter="url(#gw-line)" />
        </svg>

        {/* 门后的东西：各自 at 出现，焊完后渐暗消失（画在闸门下层，被格栅压着） */}
        {data.behind.map((b, i) => {
          const c = behindCues[i];
          if (frame < c || fadeK >= 1) return null;
          const e = enterAt(frame, c, { fallback: "rise", dur: 14, seed: i });
          const j = jit[i * 3 % 16];
          const bx = cx + ((i - (data.behind.length - 1) / 2) * dw * 0.34 || 0) + j.dx * dw * 0.12;
          const by = y0 + dh * (0.34 + i * 0.22);
          const ic = b.icon ?? guessIcon(b.text) ?? "user";
          const fs = fitFont(b.text, dw * 0.42, full ? 24 : 14, 10);
          return (
            <div
              key={`h${i}`}
              style={{
                position: "absolute",
                left: bx,
                top: by,
                transform: `translate(-50%,-50%) scale(${e.scale}) translate(${e.dx}px, ${e.dy}px)`,
                clipPath: e.clip,
                opacity: clamp(e.p * 1.5) * e.opacity * (1 - fadeK),
                filter: `blur(${fadeK * 6}px)`,
                display: "flex",
                alignItems: "center",
                gap: full ? 8 : 4,
                padding: `${full ? 6 : 3}px ${full ? 16 : 9}px`,
                borderRadius: 30,
                background: alpha(t.bg, 0.7),
                border: `2px solid ${alpha(t.dim, 0.6)}`,
                whiteSpace: "nowrap",
              }}
            >
              <Icon name={ic} size={full ? 24 : 13} color={t.dim} />
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: alpha(t.text, 0.85) }}>{b.text}</span>
            </div>
          );
        })}

        {/* 门框 + 格栅闸门 + 牌子 + 焊缝 + 焊枪 */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="gw-weld" std={7} user />
          <rect x={fx0} y={fy0} width={fx1 - fx0} height={fy1 - fy0} fill={alpha(t.bg, 0.25)} stroke={alpha(t.text, 0.55)} strokeWidth={10} />
          <g transform={`translate(0 ${gateOff})`}>
            {Array.from({ length: bars }, (_, i) => {
              const bx = x0 + (dw * (i + 0.5)) / bars;
              return <line key={i} x1={bx} y1={y0} x2={bx} y2={y1} stroke={alpha(t.primary, 0.92)} strokeWidth={full ? 9 : 5} strokeLinecap="round" />;
            })}
            {[0.18, 0.5, 0.82].map((kk, i) => (
              <line key={`c${i}`} x1={x0} y1={y0 + dh * kk} x2={x1} y2={y0 + dh * kk} stroke={alpha(t.secondary, 0.9)} strokeWidth={full ? 7 : 4} />
            ))}
            {/* 挂在门上的牌子，随闸门一起砸下来 */}
            {data.doorLabel && (() => {
              const pw = Math.min(dw * 0.86, full ? 420 : 200);
              const ph = full ? 58 : 32;
              return (
                <g>
                  <rect x={cx - pw / 2} y={y0 + dh * 0.06} width={pw} height={ph} rx={10} fill={alpha(t.gold, 0.16)} stroke={t.gold} strokeWidth={3} />
                  <text x={cx} y={y0 + dh * 0.06 + ph * 0.68} textAnchor="middle" fontFamily={t.font.title} fontWeight={900} fontSize={fitFont(data.doorLabel, pw - 30, full ? 34 : 17, 11)} fill={t.gold}>
                    {data.doorLabel}
                  </text>
                </g>
              );
            })()}
          </g>
          {/* 焊住的缝：走过的边框一段段亮起来 */}
          {seams.map((s, i) => (
            <line key={`w${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={weldDone ? alpha(t.gold, 0.75 + 0.25 * Math.sin(frame / 4)) : t.gold} strokeWidth={7} strokeLinecap="round" filter="url(#gw-weld)" />
          ))}
          {/* 焊枪：一个亮点 + 一小截枪杆，沿门框游走 */}
          {frame >= weldAt && !weldDone && (
            <g>
              <line x1={tp.x + 16} y1={tp.y + 26} x2={tp.x + 2} y2={tp.y + 4} stroke={alpha(t.text, 0.8)} strokeWidth={5} strokeLinecap="round" />
              <circle cx={tp.x} cy={tp.y} r={full ? 9 : 5} fill="#fff" filter="url(#gw-weld)" />
            </g>
          )}
        </svg>

        {/* 焊点火花：accent/gold 两色向上溅、被重力拉回来 */}
        {frame >= weldAt && frame <= doneAt + 8 &&
          !weldDone &&
          Array.from({ length: 14 }, (_, j) => {
            const jn = jit[j % 16];
            const cyc = 20;
            const ph = (((frame - weldAt) * 1.7 + j * 3.1) % cyc) / cyc;
            const ang = -Math.PI / 2 + jn.dx * 2.4;
            const spd = (0.45 + jn.v) * (full ? 120 : 56);
            const sx = tp.x + Math.cos(ang) * spd * ph;
            const sy = tp.y + Math.sin(ang) * spd * ph + ph * ph * (full ? 90 : 44);
            return (
              <div
                key={`sp${j}`}
                style={{
                  position: "absolute",
                  left: sx,
                  top: sy,
                  width: (full ? 7 : 4) * (1 - ph * 0.5),
                  height: (full ? 7 : 4) * (1 - ph * 0.5),
                  borderRadius: "50%",
                  background: j % 2 ? t.gold : t.accent,
                  boxShadow: `0 0 10px ${j % 2 ? t.gold : t.accent}`,
                  opacity: 1 - ph,
                }}
              />
            );
          })}

        {/* 闸门砸到位的冲击环 */}
        <RingBurst frame={frame} at={land} x={cx} y={y1 - 6} color={t.primary} maxR={full ? 320 : 160} width={8} />

        {/* 四边焊完 → 盖封条章 → verdict 砸出 */}
        <StampBox frame={frame} at={sealAt} text={data.sealText} color={t.bad} x={cx} y={(y0 + y1) / 2} size={full ? 80 : 38} maxW={dw * 1.1} rot={-7} />
        {data.verdict && <StampBox frame={frame} at={vAt} text={data.verdict} color={t.gold} x={cx} y={H * 0.78} size={full ? 60 : 30} maxW={W * 0.72} rot={2} />}
      </div>

      <Sfx name="whoosh" at={gateAt} volume={0.3} />
      <Sfx name="impact" at={land} volume={0.45} />
      {data.behind.map((_, i) => (
        <Sfx key={`h${i}`} name="pop" at={behindCues[i]} volume={0.2} />
      ))}
      {[1, 2, 3].map((k) => (
        <Sfx key={`w${k}`} name="pop" at={weldAt + (k * weldSpan) / 4} volume={0.2} />
      ))}
      <Sfx name="stamp" at={sealAt} volume={0.35} />
      {data.verdict && <Sfx name="ding" at={vAt} volume={0.32} />}
    </>
  );
};

export const GateWeld: CompDef<D> = {
  id: "gate-weld",
  name: "闸门焊死",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 12,
  tags: ["闸门", "焊死", "封闭", "入口", "通道", "没有下次"],
  motion: { kind: "透视通道尽头的格栅闸门轰然落下（震动+冲击环）→ 焊枪沿门框四边游走喷火花 → 盖封条章 → 门后的东西渐暗消失", energy: 3 },
  desc: "一条透视通道尽头立着格栅闸门，门牌写着 doorLabel；gateAt 闸门从天而降砸进框里、震出冲击环；weldAt 起焊枪沿门框四边游走，喷 accent/gold 两色火花、走过的边焊成发光的缝；四边焊完盖下封条章（sealText，默认「焊死」）；门后 behind[] 的东西各自 at 出现、焊完后渐暗消失；最后 verdict 砸出",
  use: "讲通道被永久封闭：招聘闸门对新人焊死、平台关闭新创作者入口、预算通道被封、晋升名额清零、行业下车门直接焊死",
  schema,
  example: {
    title: "关上的门",
    kicker: "新人处境",
    doorLabel: "招聘通道",
    behind: [{ text: "应届生" }, { text: "实习生" }],
    verdict: "这道门，直接焊死",
  },
  C,
};
