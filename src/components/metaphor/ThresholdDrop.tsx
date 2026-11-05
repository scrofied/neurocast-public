import React from "react";
import { z } from "zod";
import { clamp, easeInOut, lerp, noise1, prog } from "../../lib/anim";
import { StampBox } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Figure, gait } from "../../lib/figure";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  bar: z.string().default("门槛").describe("横杆上写的字，也就是正在往下掉的那个东西：门槛 / 学费 / 成本 / 行业准入"),
  levels: z
    .array(z.object({ text: z.string(), at: z.number().optional().describe("杆子降到这一格、把这个要求甩在身后的时刻（锚点）") }))
    .min(2)
    .max(4)
    .describe("从高到低一格一个要求；被杆子降过去之后留在原处变灰"),
  walkText: z.string().optional().describe("走过杆子那个小人头顶的字，如「你」「上过班的人」"),
  passAt: z.number().optional().describe("小人抬脚跨过杆子的时刻（锚点）"),
  verdict: z.string().optional().describe("落在画面下方空带上的结论，如「几乎所有人都能跨」"),
  verdictAt: z.number().optional().describe("结论落下的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.levels.length;
  // fallback: spread the level drops over the middle 60% of the shot
  const cues = data.levels.map((l, i) => cueOr(l.at, 6 + ((i + 1) / (n + 1)) * Math.max(20, dur * 0.6)));
  const ground = full ? H * 0.74 : H * 0.8;
  const topY = full ? H * 0.3 : H * 0.23;
  const lowY = ground - (full ? 44 : 28);
  const step = (lowY - topY) / n;
  const barY = topY + data.levels.reduce((acc, _l, i) => acc + step * easeInOut(prog(frame, cues[i], 24)), 0);
  const xL = W * 0.26;
  const xR = W * 0.78;
  const barX = (xL + xR) / 2;
  const walkDur = full ? 58 : 46;
  const walkFrom = Math.max(4, cues[n - 1] + 18);
  const pass = cueOr(data.passAt, walkFrom);
  const wk = prog(frame, pass, walkDur);
  const fx = lerp(W * 0.04, W * 0.96, wk);
  const hopR = full ? 170 : 110;
  const hopQ = wk > 0 && wk < 1 ? clamp(1 - Math.abs(fx - barX) / hopR) : 0;
  const lift = hopQ * hopQ * (3 - 2 * hopQ) * (ground - lowY + 18);
  const crossAt = pass + walkDur * ((barX - W * 0.04) / (W * 0.92));
  const wob = frame > crossAt && frame < crossAt + 22 ? noise1(frame * 1.6, seed) * (1 - (frame - crossAt) / 22) * 3.4 : 0;
  const vAt = cueOr(data.verdictAt, crossAt + 16);
  // 立柱与地面原生是从下往上长（easeInOut 进度）：wipe 的 p 同样是单调进度，观感一致
  const eFrame = enterAt(frame, 0, { fallback: "wipe", dur: 16 }).p;
  const figH = full ? Math.min(180, H * 0.2) : 96;
  const fs = full ? 40 : 20;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {/* ground */}
        <line x1={W * 0.06} y1={ground} x2={W * 0.94} y2={ground} stroke={alpha(t.primary, 0.6 * eFrame)} strokeWidth={4} />
        {/* two posts + the notches each level sits on */}
        {[xL, xR].map((px, i) => (
          <g key={i}>
            <rect x={px - 5} y={lerp(ground, topY - 46, eFrame)} width={10} height={(ground - (topY - 46)) * eFrame} rx={5} fill={alpha(t.dim, 0.9)} />
            {data.levels.map((_l, k) => (
              <rect key={k} x={px - 13} y={topY + step * k - 3} width={26} height={6} rx={3} fill={alpha(t.primary, 0.55 * eFrame)} />
            ))}
          </g>
        ))}
        {/* height ruler on the left */}
        {data.levels.map((_l, k) => (
          <line key={k} x1={xL - 58} y1={topY + step * k} x2={xL - 24} y2={topY + step * k} stroke={alpha(t.dim, 0.5)} strokeWidth={2} strokeDasharray="5 5" />
        ))}
        {/* the bar itself: what it says rides it all the way down */}
        <g transform={`rotate(${wob} ${barX} ${barY})`}>
          <rect x={xL} y={barY - 6} width={xR - xL} height={12} rx={6} fill={alpha(t.primary, 0.95)} style={{ filter: `drop-shadow(0 0 16px ${alpha(t.primary, 0.8)})` }} />
          <rect x={xL - 16} y={barY - 10} width={16} height={20} rx={4} fill={t.gold} />
          <rect x={xR} y={barY - 10} width={16} height={20} rx={4} fill={t.gold} />
        </g>
        {/* walking figure */}
        {wk > 0 && wk < 1 && <Figure x={fx} y={ground - lift} h={figH} pose={gait((frame - pass) * 0.13, 0)} color={t.text} glow={t.primary} />}
      </svg>
      {/* the bar's own word, riding it down */}
      <div
        style={{
          position: "absolute",
          left: barX - 200,
          top: barY + (full ? 16 : 8),
          width: 400,
          textAlign: "center",
          fontFamily: t.font.title,
          fontWeight: 900,
          fontSize: full ? 34 : 18,
          letterSpacing: 2,
          color: t.primary,
          whiteSpace: "nowrap",
          textShadow: `0 0 18px ${alpha(t.primary, 0.7)}`,
        }}
      >
        {data.bar} ▼
      </div>
      {/* one requirement per rung: bright until the bar drops past it, then left behind as ghost */}
      {data.levels.map((l, i) => {
        const k = easeInOut(prog(frame, cues[i], 24));
        const y = topY + step * i;
        const cleared = k > 0.5;
        // 每格要求文字原生是淡入上浮进场；rise 的 p/opacity/dy 正好覆盖
        const e = enterAt(frame, i * 5 + 2, { fallback: "rise", dur: 14, seed: i });
        const size = fitFont(l.text, full ? W * 0.42 : W * 0.7, fs, 13);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: barX - W * 0.28,
              top: y - (full ? 52 : 30),
              width: W * 0.56,
              textAlign: "center",
              opacity: e.opacity * lerp(1, 0.34, k),
              transform: `translate(${e.dx}px, ${e.dy}px) scale(${lerp(1, 0.94, k)})`,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                position: "relative",
                display: "inline-block",
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: size,
                color: cleared ? t.dim : i === n - 1 && k < 1 ? t.gold : t.text,
                whiteSpace: "nowrap",
                textShadow: cleared ? "none" : `0 2px 10px ${alpha("#000000", 0.9)}`,
              }}
            >
              {l.text}
              {cleared && <span style={{ position: "absolute", left: -4, right: -4, top: "52%", height: 3, background: alpha(t.bad, 0.85), transform: "rotate(-1.5deg)" }} />}
            </span>
          </div>
        );
      })}
      {/* who walks through */}
      {data.walkText && wk > 0 && wk < 1 && (
        <div
          style={{
            position: "absolute",
            left: fx - 130,
            top: ground - lift - figH - (full ? 46 : 26),
            width: 260,
            textAlign: "center",
            fontFamily: t.font.title,
            fontWeight: 900,
            fontSize: full ? 30 : 17,
            color: t.gold,
            whiteSpace: "nowrap",
            textShadow: `0 0 16px ${alpha(t.gold, 0.7)}`,
          }}
        >
          {data.walkText}
        </div>
      )}
      {data.verdict && <StampBox frame={frame} at={vAt} text={data.verdict} color={t.gold} x={W / 2} y={ground + (full ? 62 : 40)} size={full ? 60 : 30} maxW={W * 0.8} rot={-1.5} />}
      {data.levels.map((_l, i) => (
        <Sfx key={i} name="swish" at={cues[i] + 4} volume={0.26} />
      ))}
      {wk > 0 && <Sfx name="pop" at={crossAt} volume={0.3} />}
      {data.verdict && <Sfx name="stamp" at={vAt + 2} volume={0.34} />}
    </>
  );
};

export const ThresholdDrop: CompDef<D> = {
  id: "threshold-drop",
  name: "横杆一路往下降（门槛在降）",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 14,
  tags: ["门槛", "在降", "越来越低", "准入", "要求", "普通人也能", "门槛低到"],
  motion: { kind: "跳高横杆按配音一格一格往下掉，甩在身后的旧要求变灰划掉，杆降到贴地时无脸小人抬脚跨过去，杆子被踩得晃一下，最后盖结论章", energy: 3 },
  desc: "两根立柱架着一根发光横杆，杆上写着正在下降的那个东西；每一格挂一个旧要求，配音说到哪格杆就降到哪格，被降过去的那格留在原处变灰划掉；杆子降到贴近地面时，一个无脸小人从侧面走过来抬脚跨过去（杆子晃一下），底部空带盖上结论章",
  use: "凡是「某个门槛/成本一路往下掉，掉到最后普通人都能进」的论述：AI 编程的门槛在降、短视频投流的起步价在降、行业准入要求一降再降、学费从几万降到几百、算力成本降到个人承受得起。反过来也能讲门槛在涨（把 levels 的顺序倒过来写）。",
  panel: true,
  schema,
  example: {
    bar: "门槛",
    levels: [{ text: "会写代码" }, { text: "会配环境" }, { text: "会看报错" }],
    walkText: "上过班的你",
    verdict: "低到几乎所有人都能跨",
  },
  C,
};
