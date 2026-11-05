import React from "react";
import { z } from "zod";
import { useBox } from "../../lib/box";
import { alpha, useTheme } from "../../lib/theme";
import { clamp, easeOut, lerp, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { GlowDefs, Headline } from "../../lib/ui";
import { Sfx } from "../../lib/sfx";
import type { CompDef, CompProps } from "../types";

// feed-gauge：一边是「料」，一边是「干活的那个」。料喂进去它才转，料断了它就停。
// 不写任何数字——只讲「够 / 不够」的关系，用在没有实测读数的段落也不心虚。
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  fuel: z.string().describe("供的是什么：算力、预算、时间、人手"),
  worker: z.string().describe("被喂的那个：AI、这台机器、这个项目"),
  fullNote: z.string().optional().describe("吃饱了的状态条，如「有力气干活」"),
  emptyNote: z.string().optional().describe("断料时的状态条，如「服务器繁忙，请稍后再试」"),
  fillAt: z.number().optional().describe("开始供能的帧（锚点）；缺省 = 第 10 帧"),
  starveAt: z.number().optional().describe("掉进红区的帧（锚点）；不写就全程吃饱"),
  note: z.string().optional().describe("最下方空带上的结论条"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const mirror = variant % 2 === 1;

  const fillAt = Number.isFinite(data.fillAt) ? (data.fillAt as number) : 10;
  const starveAt = Number.isFinite(data.starveAt) ? (data.starveAt as number) : Number.POSITIVE_INFINITY;
  const starving = Number.isFinite(starveAt);

  const fillP = prog(frame, fillAt, 46);
  const drainP = starving ? prog(frame, starveAt, 34) : 0;
  const level = clamp(0.06 + 0.86 * easeOut(fillP) - 0.74 * drainP, 0, 1);
  const red = starving && drainP > 0.15;
  const flowOn = clamp(fillP * 1.6 - 0.2) * (1 - clamp(drainP * 1.3 - 0.2));

  // 转子：供能后匀速转，断料按惯性收敛到停下（纯时间的函数，可逐帧复现）
  const V = 3.4;
  const K = 0.1;
  const since = Math.max(frame - fillAt, 0);
  const spin = frame < fillAt ? 0 : starving && frame > starveAt ? V * (starveAt - fillAt) + (V / K) * (1 - Math.exp(-K * (frame - starveAt))) : V * since;
  const beat = 0.5 + 0.5 * Math.sin(frame / 9);

  const band = H * 0.34;
  const boxH = Math.min(H * 0.3, 300);
  const tankW = Math.min(W * 0.13, 230);
  const macW = Math.min(W * 0.17, 310);
  const tankX = mirror ? W * 0.7 : W * 0.2;
  const macX = mirror ? W * 0.26 : W * 0.72;
  const tubeA = mirror ? tankX - tankW / 2 : tankX + tankW / 2;
  const tubeB = mirror ? macX + macW / 2 : macX - macW / 2;
  const tubeLen = Math.max(40, Math.abs(tubeB - tubeA));
  const tubeY = band + boxH / 2;

  const eRig = enterAt(frame, 4, { fallback: "assemble", dur: 20 });
  const noteAt = starving ? starveAt + 30 : fillAt + 60;
  const eNote = enterAt(frame, noteAt, { fallback: "wipe", dur: 16 });

  const fuelCol = red ? t.bad : t.primary;
  const status = (text: string, on: number, col: string, key: string) =>
    on <= 0.01 ? null : (
      <div
        key={key}
        style={{
          position: "absolute",
          left: macX - macW * 0.95,
          top: band + boxH + 26,
          width: macW * 1.9,
          textAlign: "center",
          opacity: on,
          fontFamily: t.font.title,
          fontWeight: 900,
          fontSize: Math.min(34, 2100 / Math.max(12, text.length)),
          color: col,
          whiteSpace: "nowrap",
          textShadow: `0 0 24px ${alpha(col, 0.45)}`,
        }}
      >
        {text}
      </div>
    );

  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="fg" std={8} user />
        <g opacity={eRig.opacity} transform={`translate(${eRig.dx} ${eRig.dy})`}>
          {/* 料仓 */}
          <rect x={tankX - tankW / 2} y={band} width={tankW} height={boxH} rx={18} fill={alpha(t.bg2, 0.85)} stroke={alpha(fuelCol, 0.85)} strokeWidth={3} />
          <rect x={tankX - tankW / 2 + 8} y={band + boxH - 8 - (boxH - 16) * level} width={tankW - 16} height={(boxH - 16) * level} rx={10} fill={alpha(fuelCol, 0.5)} filter="url(#fg)" />
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={tankX - tankW / 2} y1={band + boxH * g} x2={tankX + tankW / 2} y2={band + boxH * g} stroke={alpha(t.dim, 0.4)} strokeWidth={1.5} strokeDasharray="5 8" />
          ))}
          {/* 红区那条线 */}
          <line x1={tankX - tankW / 2} y1={band + boxH * 0.26} x2={tankX + tankW / 2} y2={band + boxH * 0.26} stroke={alpha(t.bad, 0.7)} strokeWidth={2.5} />

          {/* 管道 */}
          <rect x={Math.min(tubeA, tubeB)} y={tubeY - 15} width={Math.abs(tubeB - tubeA)} height={30} rx={15} fill={alpha(t.glass, 0.9)} stroke={alpha(fuelCol, 0.5)} />
          {new Array(7).fill(0).map((_, k) => {
            if (flowOn <= 0.02) return null;
            const raw = ((frame * (tubeLen / 60) + (k * tubeLen) / 7) % tubeLen + tubeLen) % tubeLen;
            const x = lerp(tubeA, tubeB, raw / tubeLen);
            return <rect key={k} x={x - 9} y={tubeY - 9} width={18} height={18} rx={4} fill={fuelCol} opacity={flowOn * 0.9} filter="url(#fg)" />;
          })}

          {/* 干活的那个 */}
          <rect x={macX - macW / 2} y={band} width={macW} height={boxH} rx={20} fill={alpha(t.bg2, 0.9)} stroke={alpha(red ? t.bad : t.secondary, 0.85)} strokeWidth={3} filter={red ? undefined : "url(#fg)"} />
          <g transform={`translate(${macX} ${band + boxH / 2 - 12}) rotate(${spin})`}>
            {new Array(8).fill(0).map((_, k) => (
              <rect key={k} x={-4} y={-88} width={8} height={34} rx={4} fill={alpha(red ? t.bad : t.primary, 0.85)} transform={`rotate(${k * 45})`} />
            ))}
            <circle r={54} fill="none" stroke={alpha(red ? t.bad : t.primary, 0.9)} strokeWidth={4} />
            <circle r={92} fill="none" stroke={alpha(t.dim, 0.4)} strokeWidth={2} strokeDasharray="4 10" />
          </g>
          <circle cx={macX} cy={band + boxH / 2 - 12} r={20 + beat * 8 * flowOn} fill={alpha(red ? t.bad : t.accent, 0.35 + 0.4 * flowOn)} filter="url(#fg)" />
          {/* 出力条：不给数字，只给「还剩多少劲」 */}
          <rect x={macX - macW / 2 + 26} y={band + boxH - 46} width={macW - 52} height={16} rx={8} fill={alpha(t.dim, 0.25)} />
          <rect x={macX - macW / 2 + 26} y={band + boxH - 46} width={(macW - 52) * level} height={16} rx={8} fill={fuelCol} filter="url(#fg)" />
        </g>
      </svg>

      <div style={{ position: "absolute", left: tankX - tankW, top: band + boxH + 26, width: tankW * 2, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: 32, color: alpha(fuelCol, 0.95), opacity: eRig.opacity }}>{data.fuel}</div>
      <div style={{ position: "absolute", left: macX - macW / 2, top: band - 54, width: macW, textAlign: "center", fontFamily: t.font.body, fontWeight: 800, fontSize: 26, letterSpacing: 2, color: alpha(t.text, 0.8), opacity: eRig.opacity }}>{data.worker}</div>
      {status(data.fullNote ?? "有力气干活", (1 - clamp(drainP * 1.4 - 0.2)) * clamp(prog(frame, fillAt + 14, 20) * 1.5), alpha(t.text, 0.95), "full")}
      {status(data.emptyNote ?? "那一刻它没吃饱", starving ? clamp(drainP * 1.6 - 0.2) : 0, t.bad, "empty")}

      {data.note && (
        <div
          style={{
            position: "absolute",
            left: W * 0.16,
            width: W * 0.68,
            top: H * 0.79 + eNote.dy,
            opacity: eNote.opacity,
            clipPath: eNote.clip,
            textAlign: "center",
            fontFamily: t.font.title,
            fontWeight: 900,
            fontSize: Math.min(36, 2300 / Math.max(12, data.note.length)),
            color: t.accent,
            whiteSpace: "nowrap",
            textShadow: `0 0 26px ${alpha(t.accent, 0.45)}`,
          }}
        >
          {data.note}
        </div>
      )}

      <Sfx name="bubbles" at={fillAt} volume={0.26} />
      {starving ? <Sfx name="click" at={starveAt} volume={0.34} /> : null}
      {data.note ? <Sfx name="ding" at={noteAt} volume={0.28} /> : null}
      <Headline kicker={data.kicker} title={data.title} frame={frame} />
    </>
  );
};

export const FeedGauge: CompDef<D> = {
  id: "feed-gauge",
  name: "供能与罢工",
  layer: "metaphor",
  variants: 2,
  minSec: 4,
  maxSec: 12,
  tags: ["供能", "吃饭", "不够", "罢工", "资源", "投入产出", "卡住", "成本"],
  motion: { kind: "料仓液位涨落 + 颗粒沿管道持续送料 + 转子随供能转停", energy: 2 },
  desc:
    "左边一个料仓（带刻度但没有数字），中间管道往里送料，右边那台会转的机器就是被喂的那个。料涨上来机器开始转、状态条写「有力气干活」；料掉到红区那条线以下，转子靠惯性停下、机器边框和出力条转红、状态条换成断料那句话。变体 1 左右镜像。全程不出现任何数字。",
  use:
    "讲「投入不够，表现就塌」：算力不足所以排队、预算砍了项目就停、人手不够排期就断、时间没喂够活就做不完；也讲「它不是坏了，是那一刻没吃饱」这种把故障翻译成资源状态的句子。要讲「谁喂谁、喂多少决定跑多快」用它，别用它讲两个东西对比大小。",
  schema,
  example: {
    kicker: "第一层",
    title: "先吃饱，才有力气干活",
    fuel: "算力",
    worker: "AI",
    fullNote: "有力气干活",
    emptyNote: "服务器繁忙，请稍后再试",
    note: "不是它坏了，是那一刻它没吃饱",
  },
  C,
};
