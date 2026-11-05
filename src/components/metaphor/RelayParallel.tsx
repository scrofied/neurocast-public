import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 接力 + 并行：一条有前后关系的任务链按顺序传光点，另一条互不依赖的任务同时自己推进，
// 最后汇合。叙事动作 =「能串的都串上，能并的都并跑」。

const task = z.object({ label: z.string(), at: z.number().optional().describe("这一步开始/接力的时刻（锚点）") });
const schema = z.object({
  kicker: z.string().optional(),
  title: z.string().optional(),
  chain: z.array(task).min(2).max(4).describe("上面的顺序接力链（前一步做完下一步才开始）"),
  lanes: z.array(task).min(1).max(3).describe("下面互不依赖、同时推进的任务（每条一个泳道）"),
  startAt: z.number().optional().describe("光点出发的时刻（锚点）"),
  parAt: z.number().optional().describe("泳道同时起跑的时刻（锚点）"),
  verdict: z.string().optional().describe("汇合后砸出的结论章"),
});
type D = z.infer<typeof schema>;

const Node: React.FC<{ x: number; y: number; label: string; col: string; bg: string; lit: number; done: boolean }> = ({ x, y, label, col, bg, lit, done }) => (
  <div style={{ position: "absolute", left: x - 118, top: y - 34, width: 236, height: 68, borderRadius: 14, background: bg, border: `3px solid ${alpha(col, 0.4 + lit * 0.6)}`, boxShadow: lit > 0.05 ? `0 0 ${24 * lit}px ${alpha(col, 0.55 * lit)}` : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transform: `scale(${1 + lit * 0.06})` }}>
    <span style={{ fontSize: fitFont(label, 190, 27, 16), color: done ? col : alpha("#fff", 0.85), fontWeight: 800, whiteSpace: "nowrap" }}>{label}</span>
    {done && <span style={{ color: col, fontSize: 26, fontWeight: 900 }}>✓</span>}
  </div>
);

const Wire: React.FC<{ x1: number; y1: number; x2: number; y2: number; col: string; p: number; dash?: boolean }> = ({ x1, y1, x2, y2, col, p, dash }) => {
  const w = Math.abs(x2 - x1) + 8, h = Math.abs(y2 - y1) + 8;
  const ax = x1 < x2 ? 4 : w - 4, ay = y1 < y2 ? 4 : h - 4, bx = x1 < x2 ? w - 4 : 4, by = y1 < y2 ? h - 4 : 4;
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: Math.min(x1, x2) - 4, top: Math.min(y1, y2) - 4 }}>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={alpha(col, 0.7)} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={dash ? "0.06 0.06" : `${p} 1`} strokeDashoffset={dash ? -p * 0.5 : 0} opacity={dash ? p : 1} />
    </svg>
  );
};

const Dot: React.FC<{ x: number; y: number; col: string; show: boolean }> = ({ x, y, col, show }) => show && (
  <div style={{ position: "absolute", left: x - 11, top: y - 11, width: 22, height: 22, borderRadius: "50%", background: col, boxShadow: `0 0 22px ${col}` }} />
);

const C: React.FC<CompProps<D>> = ({ data, frame, variant }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const W = width, H = height;
  const col = t.primary, gold = t.gold;
  const enterAt = useEnter(variant);
  const e = enterAt(frame, 0);
  const layer = {
    position: "absolute" as const,
    inset: 0,
    opacity: e.opacity,
    transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale}) rotate(${e.rot}deg)`,
    transformOrigin: "50% 50%",
    clipPath: e.clip,
  };
  const cn = data.chain.length;
  const ln = data.lanes.length;
  const x0 = W * 0.16, x1 = W * 0.84;
  const stepX = (x1 - x0) / Math.max(1, cn - 1 + 0.6);
  const chainY = H * 0.42;
  const laneTop = H * 0.62;
  const laneGap = Math.min(96, (H * 0.8) - laneTop) / Math.max(1, ln);
  const start = cueOr(data.startAt, 12);
  const par = cueOr(data.parAt, start + 6);
  // 接力链：每段走完 16 帧，节点 at 可锚词
  const seg = 16;
  const cues: number[] = [];
  const arrive: number[] = [];
  data.chain.forEach((c, i) => {
    const cue = Math.max(i ? arrive[i - 1] + 3 : 0, cueOr(c.at, start + i * seg));
    cues.push(cue);
    arrive.push(cue + seg);
  });
  const chainDone = arrive[cn - 1];
  // 泳道：par 起跑，长度与接力链总时长相当（同时推进）
  const laneDur = Math.max(20, chainDone - par + 4);
  const merge = Math.max(chainDone, par + laneDur) + 6;
  const eVer = data.verdict ? clamp(easeOut(prog(frame, merge + 6, 10))) : 0;
  return (
    <div style={layer}>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />
      {/* 接力链 */}
      {data.chain.map((c, i) => {
        const a = cues[i], b = arrive[i];
        const p = clamp(easeInOut(prog(frame, a, seg)));
        const nx = x0 + stepX * (i + 1);
        const px = x0 + stepX * i;
        return (
          <React.Fragment key={`c${i}`}>
            {i < cn - 1 && <Wire x1={px + 122} y1={chainY} x2={nx - 122} y2={chainY} col={col} p={clamp(easeOut(prog(frame, a - 2, 6)))} />}
            <Node x={px} y={chainY} label={c.label} col={col} bg={alpha(t.bg2, 0.9)} lit={frame >= a && frame < a + 10 ? 1 : frame >= a ? 0.35 : 0} done={frame >= b} />
            {i === cn - 1 && (
              <Node x={x0 + stepX * cn} y={chainY} label="汇合" col={gold} bg={alpha(t.bg2, 0.9)} lit={frame >= chainDone ? 0.8 : 0} done={frame >= chainDone} />
            )}
            {i < cn - 1 && <Dot x={px + 122 + (nx - 122 - px - 122) * p} y={chainY} col={gold} show={frame >= a && frame <= b} />}
          </React.Fragment>
        );
      })}
      {/* 并行泳道 */}
      {data.lanes.map((c, i) => {
        const y = laneTop + laneGap * (i + 0.5);
        const p = clamp(easeInOut(prog(frame, par, laneDur)));
        const ex = x0 + stepX * cn;
        return (
          <React.Fragment key={`l${i}`}>
            <Wire x1={x0 - 118 + 4} y1={y} x2={ex - 118} y2={y} col={col} p={clamp(easeOut(prog(frame, par - 2, 6)))} dash />
            <Node x={x0} y={y} label={c.label} col={col} bg={alpha(t.bg2, 0.9)} lit={frame >= par && frame < par + 10 ? 1 : frame >= par ? 0.35 : 0} done={p >= 1} />
            {p > 0 && p < 1 && <Dot x={x0 - 114 + (ex - 118 - x0 + 114) * p} y={y} col={gold} show />}
            {p >= 1 && <Wire x1={ex - 118} y1={y} x2={ex - 20} y2={chainY + 40} col={col} p={1} dash />}
          </React.Fragment>
        );
      })}
      {/* 结论章 */}
      {data.verdict && eVer > 0 && (
        <div style={{ position: "absolute", left: W / 2 - 260, top: H * 0.16, width: 520, textAlign: "center", transform: `scale(${0.55 + 0.45 * easeOut(eVer)}) rotate(-3deg)`, opacity: clamp(eVer * 3) }}>
          <span style={{ display: "inline-block", padding: "12px 36px", borderRadius: 16, border: `6px double ${gold}`, background: alpha(t.bg, 0.55), boxShadow: `0 0 40px ${alpha(gold, 0.35)}`, color: gold, fontFamily: "var(--font-title)", fontWeight: 900, fontSize: 46, whiteSpace: "nowrap" }}>{data.verdict}</span>
        </div>
      )}
      <Sfx name="pop" at={start} volume={0.3} />
      {cues.slice(1).map((a, i) => <Sfx key={i} name="click" at={a} volume={0.28} />)}
      <Sfx name="swipe" at={par} volume={0.3} />
      {data.verdict && <Sfx name="stamp" at={merge + 6} volume={0.45} />}
    </div>
  );
};

export const RelayParallel: CompDef<D> = {
  id: "relay-parallel",
  name: "顺序接力 + 并行推进",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 14,
  tags: ["并行", "流水线", "依赖", "调度", "效率"],
  desc: "上排任务节点按顺序接力（金色光点沿连线走到下一个才亮），下排互不依赖的泳道同时起跑、光点并排推进，全部到达后汇合、结论章砸出",
  use: "讲调度策略：有前后关系的按顺序做、能同时做的同时做；多任务并行、流水线优化、等待时间压缩",
  motion: { kind: "金色光点沿接力链逐站传递，下排泳道光点同时起跑，全部到达后汇合并砸出结论章", energy: 2 },
  schema,
  example: {
    kicker: "调度",
    title: "该串的串，该并的并",
    chain: [{ label: "整理资料" }, { label: "制作网页" }, { label: "检查验收" }],
    lanes: [{ label: "另一件事也在走" }],
    verdict: "同时推进",
  },
  C,
};
