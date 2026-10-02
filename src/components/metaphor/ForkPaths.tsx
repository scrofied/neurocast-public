import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Figure, gait, mixPose, POSES } from "../../lib/figure";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const path = z.object({
  name: z.string().describe("这条岔路的走法/选择"),
  result: z.string().describe("结局"),
  metric: z.string().optional().describe("结局的数据，如“年入 6 万”“越做越累”"),
  tone: z.enum(["good", "bad"]).default("bad"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  startAction: z.string().describe("共同起点上做的同一个动作，如“同样用 AI”“同样是写文章”"),
  splitWord: z.string().optional().describe("分水岭，写在岔口上，如“判断权”“有没有自己的库”"),
  pathA: path,
  pathB: path,
  startAt: z.number().optional().describe("小人从起点出发的时刻"),
  splitAt: z.number().optional().describe("在岔口分开的时刻（锚点，如“差别在”）"),
  resultAt: z.number().optional().describe("两边结局同时揭晓的时刻"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const startAt = cueOr(data.startAt, 6);
  const splitAt = cueOr(data.splitAt, Math.round(dur * 0.4));
  const resultAt = cueOr(data.resultAt, splitAt + Math.round((dur - splitAt) * 0.55));
  const G = full ? H * 0.74 : H * 0.72;
  const x0 = W * (full ? 0.08 : 0.06);
  const forkX = W * (full ? 0.42 : 0.4);
  const y0 = G;
  const yUp = full ? H * 0.3 : H * 0.26;
  const yDn = full ? H * 0.74 : H * 0.72;
  const xEnd = W * (full ? 0.86 : 0.9);
  // the walker advances along the trunk then takes one branch
  const trunkK = clamp((frame - startAt) / Math.max(1, splitAt - startAt));
  const branchK = frame >= splitAt ? clamp((frame - splitAt) / Math.max(1, resultAt - splitAt)) : 0;
  const figH = full ? 116 : 64;
  const trunkX = lerp(x0, forkX, easeInOut(trunkK));
  const walkerPose = frame < resultAt ? gait((frame - startAt) / 20, 0.15) : mixPose(POSES.stand, POSES.cheer, data.pathA.tone === "good" ? easeOut(prog(frame, resultAt, 12)) : 0);
  // trail marks left behind along whichever path was taken
  const trail: { x: number; y: number }[] = [];
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const along = k * (frame - startAt);
    const total = splitAt - startAt + (resultAt - splitAt);
    const pos = (() => {
      const tk = clamp(along / Math.max(1, splitAt - startAt));
      if (along <= splitAt - startAt) return { x: lerp(x0, forkX, easeInOut(tk)), y: y0 };
      const bk = clamp((along - (splitAt - startAt)) / Math.max(1, resultAt - splitAt));
      return { x: lerp(forkX, xEnd, bk), y: lerp(y0, yUp, bk) };
    })();
    if (along > 0 && along < total) trail.push(pos);
  }
  const sh = hitShake(frame, [splitAt, resultAt], full ? 10 : 5, 12, seed);

  const branch = (p: typeof data.pathA, up: boolean) => {
    const yEnd = up ? yUp : yDn;
    const col = p.tone === "good" ? t.gold : t.bad;
    const k = up ? branchK : branchK;
    const xNow = lerp(forkX, xEnd, easeInOut(k));
    const yNow = lerp(y0, yEnd, easeInOut(k));
    const fs = full ? 34 : 18;
    return (
      <g key={p.name}>
        {/* the road */}
        <path d={`M${forkX},${y0} C${lerp(forkX, xEnd, 0.35)},${y0} ${lerp(forkX, xEnd, 0.6)},${yEnd} ${xEnd},${yEnd}`} fill="none" stroke={alpha(col, 0.9)} strokeWidth={full ? 8 : 5} strokeLinecap="round" strokeDasharray={`${(full ? 700 : 400) * easeOut(prog(frame, splitAt + (up ? 0 : 6), 20))} 3000`} style={{ filter: `drop-shadow(0 0 10px ${alpha(col, 0.6)})` }} />
        {frame >= splitAt && (
          <>
            <Figure x={xNow} y={yNow} h={figH} pose={frame >= resultAt ? mixPose(POSES.stand, up ? POSES.proud : POSES.slump, easeOut(prog(frame, resultAt, 14))) : walkerPose} color={t.text} glow={col} />
            {/* end card */}
            {frame >= resultAt && (() => {
              const rp = easeOutBack(prog(frame, resultAt + (up ? 0 : 6), 14));
              const cw = full ? W * 0.3 : W * 0.4;
              const cx = xEnd - cw * 0.2;
              const cy = yEnd + (up ? -(full ? 90 : 50) : full ? 30 : 16);
              return (
                <foreignObject x={cx} y={cy} width={cw} height={full ? 150 : 84}>
                  <div style={{ transform: `scale(${rp})`, transformOrigin: "0 50%", display: "inline-flex", flexDirection: "column", gap: 4, padding: `${full ? 12 : 6}px ${full ? 24 : 12}px`, borderRadius: 14, background: alpha(t.bg, 0.88), border: `3px solid ${col}`, boxShadow: `0 0 30px ${alpha(col, 0.5)}` }}>
                    <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(p.result, cw - 40, fs, 13), color: col, whiteSpace: "nowrap" }}>{p.result}</span>
                    {p.metric && <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: fs * 0.72, color: t.text, whiteSpace: "nowrap" }}>{p.metric}</span>}
                  </div>
                </foreignObject>
              );
            })()}
            {/* path label along the road */}
            <foreignObject x={lerp(forkX, xEnd, 0.45)} y={lerp(y0, yEnd, 0.45) + (up ? -(full ? 46 : 26) : full ? 14 : 8)} width={full ? 300 : 170} height={full ? 44 : 26}>
              <div style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: full ? 24 : 13, color: alpha(t.text, 0.75), whiteSpace: "nowrap", opacity: easeOut(prog(frame, splitAt + 6, 14)) }}>{p.name}</div>
            </foreignObject>
          </>
        )}
      </g>
    );
  };

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="fp" std={7} user />
          {/* trunk */}
          <line x1={x0} y1={y0} x2={lerp(x0, forkX, easeOut(trunkK))} y2={y0} stroke={t.primary} strokeWidth={full ? 10 : 6} strokeLinecap="round" filter="url(#fp)" />
          {/* trail dots */}
          {trail.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={full ? 5 : 3} fill={alpha(t.primary, 0.35)} />
          ))}
          {/* the fork with the split-word plaque */}
          {frame >= splitAt - 10 && (
            <g opacity={easeOut(prog(frame, splitAt - 10, 12))}>
              <circle cx={forkX} cy={y0} r={full ? 16 : 9} fill={t.bg} stroke={t.gold} strokeWidth={4} style={{ filter: `drop-shadow(0 0 14px ${t.gold})` }} />
            </g>
          )}
          {branch(data.pathA, true)}
          {branch(data.pathB, false)}
        </svg>
        {/* the shared start banner */}
        <div style={{ position: "absolute", left: x0 - (full ? 20 : 10), top: y0 + (full ? 26 : 14), opacity: easeOut(prog(frame, 4, 14)) }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: full ? 10 : 5, padding: `${full ? 8 : 4}px ${full ? 20 : 10}px`, borderRadius: 24, background: alpha(t.primary, 0.14), border: `2px solid ${t.primary}` }}>
            <Icon name="play" size={full ? 22 : 12} color={t.primary} />
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 28 : 15, color: t.text, whiteSpace: "nowrap" }}>{data.startAction}</span>
          </div>
        </div>
        {/* the fork plaque */}
        {data.splitWord && frame >= splitAt - 10 && (
          <div style={{ position: "absolute", left: forkX, top: y0 - (full ? 130 : 70), transform: `translateX(-50%) scale(${easeOutBack(prog(frame, splitAt - 6, 14))})`, padding: `${full ? 8 : 4}px ${full ? 22 : 11}px`, borderRadius: 12, background: alpha(t.bg, 0.9), border: `3px solid ${t.gold}`, boxShadow: `0 0 26px ${alpha(t.gold, 0.6)}`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.splitWord, W * (full ? 0.3 : 0.5), full ? 40 : 20, 13), color: t.gold, whiteSpace: "nowrap" }}>
            {data.splitWord}
          </div>
        )}
      </div>
      <Sfx name="whoosh" at={startAt} volume={0.2} />
      <Sfx name="stamp" at={splitAt} volume={0.4} />
      <Sfx name="ding" at={resultAt} volume={0.35} />
      <Sfx name="glitch" at={resultAt + 8} volume={0.25} />
    </>
  );
};

export const ForkPaths: CompDef<D> = {
  id: "fork-paths",
  name: "同一动作，两种结局",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["岔路", "分水岭", "两种结局", "差别在", "同样的"],
  motion: { kind: "同一条路出发 → 岔口分成上下两条发光路 → 两个结局卡同时揭晓", energy: 2 },
  desc: "一个小人从同一条路出发，走到中间的岔口分成上下两条发光的路，岔口上立着分水岭的牌子（写在分岔的那句判断）；两条路各长出一个结局卡（一条金一条红），小人在其中一条上继续走并抵达结局",
  use: "同样是 X，两种结局：同样用 AI 两种下场，差别在判断权；同样发内容，有没有自己的库完全不一样；一个动作两种命运",
  panel: true,
  schema,
  example: { startAction: "同样用 AI 写内容", splitWord: "有没有自己的判断", pathA: { name: "拿 AI 当草稿，自己改", result: "越做越值钱", metric: "年入 60 万", tone: "good" }, pathB: { name: "直接复制粘贴", result: "越做越像别人", metric: "账号做废", tone: "bad" } },
  C,
};
