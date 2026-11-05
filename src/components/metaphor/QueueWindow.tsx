import React from "react";
import { z } from "zod";
import { clamp, easeOut, lerp, prog } from "../../lib/anim";
import { StampBox } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Figure, gait, mixPose, POSES } from "../../lib/figure";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const win = z.object({
  label: z.string().describe("这个窗口叫什么：老窗口 / 某某赛道 / 上一个平台"),
  note: z.string().optional().describe("窗口下面那行小字，如「排了 40 分钟」「刚开张」"),
  queue: z.number().optional().describe("这条队一开始排了几个人；老窗口写 4~7，新窗口写 0~1"),
  open: z.boolean().optional().describe("true = 刚开的那个新窗口：发光、队最短，小人往它跑"),
  at: z.number().optional().describe("这个窗口（和它的队伍）出现的时刻（锚点）"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  windows: z.array(win).min(2).max(4).describe("并排的窗口，第一个在最左"),
  hero: z.string().optional().describe("跑过去那个小人头顶的字，如「你」"),
  runAt: z.number().optional().describe("小人开始往新窗口跑的时刻（锚点，如「跑过去」）"),
  rushAt: z.number().optional().describe("人群开始涌进来排队的时刻（锚点，如「都看见」）"),
  verdict: z.string().optional().describe("最后盖下的结论，如「你还是得排」"),
  verdictAt: z.number().optional().describe("结论落下的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const ws = data.windows;
  const m = ws.length;
  const oi = Math.max(0, ws.findIndex((w) => w.open));
  const bandTop = full ? H * 0.2 : H * 0.15;
  const bandH = full ? H * 0.14 : H * 0.12;
  const qy0 = bandTop + bandH + (full ? 62 : 40);
  const rowGap = full ? 36 : 24;
  const baseH = full ? 56 : 32;
  const xs = ws.map((_w, i) => W * (0.5 + (i - (m - 1) / 2) * (0.8 / m)));
  const cues = ws.map((w, i) => cueOr(w.at, i * 4 + 2));
  const qLen = (i: number) => {
    const q = Math.max(0, Math.round(ws[i].queue ?? (ws[i].open ? 1 : 5)));
    return Math.min(q, Math.floor(prog(frame, cues[i], q * 3 + 6) * (q + 1)));
  };
  const heroSlot = qLen(oi);
  const runAt = cueOr(data.runAt, Math.round(dur * 0.34));
  const runDur = full ? 48 : 40;
  const runP = easeOut(prog(frame, runAt, runDur));
  const arrived = frame >= runAt + runDur - 4;
  const tailY = qy0 + heroSlot * rowGap;
  const hx = lerp(W * 0.5, xs[oi], runP);
  const hy = lerp(H * 1.02, tailY, runP);
  const rushAt = cueOr(data.rushAt, runAt + runDur + 26);
  const RUSH = 5;
  const rushIn = (k: number) => easeOut(prog(frame, rushAt + k * 9, 22));
  const rushCount = ws.length ? Array.from({ length: RUSH }, (_, k) => rushIn(k)).filter((p) => p > 0.5).length : 0;
  const nNow = qLen(oi) + (arrived ? 1 : 0) + rushCount;
  const vAt = cueOr(data.verdictAt, rushAt + 54);
  // 柜台原生是从上往下压入画；slide 的 p 同为单调进度，观感不变
  const eCounter = enterAt(frame, 0, { fallback: "slide-l", dur: 16 }).p;
  const queuePose = (i: number, k: number) => mixPose(POSES.stand, POSES.turn, 0.5 + 0.5 * Math.sin(i * 2.1 + k * 1.3));

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {/* the counter body */}
        <rect x={W * 0.06} y={bandTop} width={W * 0.88 * eCounter} height={bandH} rx={full ? 16 : 8} fill={alpha(t.bg2, 0.92)} stroke={alpha(t.primary, 0.55)} strokeWidth={3} />
        <line x1={W * 0.06} y1={bandTop + bandH} x2={W * 0.06 + W * 0.88 * eCounter} y2={bandTop + bandH} stroke={alpha(t.primary, 0.85)} strokeWidth={5} style={{ filter: `drop-shadow(0 0 14px ${alpha(t.primary, 0.7)})` }} />
        {ws.map((w, i) => {
          const isNew = !!w.open;
          const e = enterAt(frame, cues[i], { fallback: "rise", dur: 14, seed: i });
          const ww = full ? W * 0.15 : W * 0.19;
          const wh = bandH * 0.62;
          const col = isNew ? t.gold : t.dim;
          return (
            <g key={i} opacity={e.opacity} transform={`translate(${e.dx} ${e.dy})`}>
              <rect x={xs[i] - ww / 2} y={bandTop + bandH * 0.19} width={ww} height={wh} rx={full ? 10 : 6} fill={alpha(isNew ? t.gold : t.text, isNew ? 0.22 : 0.08)} stroke={alpha(col, isNew ? 0.95 : 0.45)} strokeWidth={isNew ? 4 : 2} style={isNew ? { filter: `drop-shadow(0 0 20px ${alpha(t.gold, 0.75)})` } : undefined} />
              {/* light spilling out of an open window */}
              {isNew && <polygon points={`${xs[i] - ww / 2},${bandTop + bandH * 0.19 + wh} ${xs[i] + ww / 2},${bandTop + bandH * 0.19 + wh} ${xs[i] + ww * 0.9},${qy0 + rowGap * 1.4} ${xs[i] - ww * 0.9},${qy0 + rowGap * 1.4}`} fill={alpha(t.gold, 0.1)} />}
            </g>
          );
        })}
        {/* queues: closer people are drawn bigger */}
        {ws.map((w, i) => {
          const q = qLen(i);
          return Array.from({ length: q }, (_x, k) => {
            const isNew = !!w.open;
            // the open window's tail is where the hero stands, so skip that slot once he is there
            if (i === oi && arrived && k === heroSlot) return null;
            const y = qy0 + k * rowGap;
            const h = lerp(baseH * 0.82, baseH * 1.25, q > 1 ? k / (q - 1) : 1);
            return <Figure key={`${i}-${k}`} x={xs[i] + Math.sin(i * 3.1 + k) * (full ? 9 : 5)} y={y} h={h} pose={queuePose(i, k)} color={isNew ? t.gold : t.text} dim={isNew ? 0 : 0.35} opacity={0.9} />;
          });
        })}
        {/* the crowd that arrives after the hero */}
        {Array.from({ length: RUSH }, (_x, k) => {
          const p = rushIn(k);
          if (p <= 0) return null;
          const slot = heroSlot + 1 + k;
          const y = lerp(H * 1.04, qy0 + slot * rowGap, p);
          const h = lerp(baseH * 0.82, baseH * 1.25, clamp(slot / (heroSlot + RUSH + 1)));
          return <Figure key={`r${k}`} x={xs[oi] + Math.sin(k * 2.3) * (full ? 11 : 6)} y={y} h={h} pose={gait((frame - rushAt - k * 9) * 0.16, 0.55)} color={t.text} dim={0.1} />;
        })}
        {/* the hero running to the new window */}
        {frame >= runAt &&
          (arrived ? (
            <Figure x={xs[oi]} y={tailY} h={baseH * 1.25} pose={POSES.stand} color={t.gold} glow={t.gold} />
          ) : (
            <Figure x={hx} y={hy} h={lerp(baseH * 0.7, baseH * 1.25, runP)} pose={gait((frame - runAt) * 0.2, 1)} color={t.primary} glow={t.primary} />
          ))}
      </svg>
      {/* window labels */}
      {ws.map((w, i) => {
        const e = enterAt(frame, cues[i] + 4, { fallback: "rise", dur: 12, seed: i });
        const isNew = !!w.open;
        return (
          <div key={i} style={{ position: "absolute", left: xs[i] - W * 0.11, top: bandTop - (full ? 54 : 34), width: W * 0.22, textAlign: "center", opacity: e.opacity, transform: `translate(${e.dx}px, ${e.dy}px)` }}>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(w.label, W * 0.2, full ? 32 : 17, 12), color: isNew ? t.gold : t.dim, whiteSpace: "nowrap", textShadow: isNew ? `0 0 16px ${alpha(t.gold, 0.7)}` : "none" }}>{w.label}</div>
            {w.note && <div style={{ fontFamily: t.font.body, fontSize: full ? 19 : 12, color: t.dim, whiteSpace: "nowrap", marginTop: 2 }}>{w.note}</div>}
          </div>
        );
      })}
      {/* head count on the new window's line */}
      <div
        style={{
          position: "absolute",
          left: xs[oi] + (full ? 74 : 40),
          top: qy0 + rowGap * 0.5 - (full ? 24 : 14),
          padding: full ? "4px 16px" : "2px 8px",
          borderRadius: 999,
          border: `2px solid ${alpha(t.gold, 0.9)}`,
          background: alpha("#000000", 0.45),
          fontFamily: t.font.title,
          fontWeight: 900,
          fontSize: full ? 28 : 16,
          color: t.gold,
          whiteSpace: "nowrap",
          opacity: frame >= cues[oi] ? 1 : 0,
        }}
      >
        {nNow} 人
      </div>
      {data.hero && frame >= runAt && frame < runAt + runDur + 6 && (
        <div style={{ position: "absolute", left: hx - 90, top: hy - (full ? 110 : 66), width: 180, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 32 : 18, color: t.primary, whiteSpace: "nowrap", textShadow: `0 0 16px ${alpha(t.primary, 0.8)}` }}>{data.hero}</div>
      )}
      {data.verdict && <StampBox frame={frame} at={vAt} text={data.verdict} color={t.bad} x={W / 2} y={H * (full ? 0.82 : 0.86)} size={full ? 58 : 30} maxW={W * 0.76} rot={-1.5} />}
      <Sfx name="whoosh" at={runAt} volume={0.3} />
      <Sfx name="ding" at={runAt + runDur} volume={0.32} />
      <Sfx name="bubbles" at={rushAt} volume={0.24} />
      {data.verdict && <Sfx name="stamp" at={vAt + 2} volume={0.34} />}
    </>
  );
};

export const QueueWindow: CompDef<D> = {
  id: "queue-window",
  name: "新窗口队最短",
  layer: "metaphor",
  variants: 1,
  minSec: 5,
  maxSec: 18,
  tags: ["新窗口", "队最短", "红利期", "早期", "上车", "人少", "排队", "先来后到"],
  motion: { kind: "并排窗口各挂着长短不一的队伍，新开的窗口发光且队最短；无脸小人从画面下方一路跑过去站进队尾，随后人群从镜头外涌来把这条队排长，人数角标实时跳，最后盖结论章", energy: 3 },
  desc: "一条发光柜台并排 2~4 个窗口，每个窗口前站着一列无脸小人（越靠前画得越大）；老窗口队伍很长，标了 open 的那个刚开张、只有一两个人。说到「跑过去」时主角小人从画面下方一路跑进这条短队，说到「所有人都看见」时一批人从镜头外挤进来排队、人数角标往上跳，最后砸下结论章",
  use: "凡是「早期进场人少、等大家都看见就要排队」的红利叙述：新平台刚开时流量便宜、新版本刚上线最便宜、一个赛道刚开始没对手、一个岗位刚出现时门槛最低、内测期名额最少。也能反过来讲窗口关上的代价。",
  panel: true,
  schema,
  example: {
    windows: [{ label: "老窗口", note: "排了 40 分钟", queue: 6 }, { label: "老窗口", note: "排了 25 分钟", queue: 5 }, { label: "新窗口", note: "刚开", queue: 1, open: true }],
    hero: "你",
    verdict: "等所有人都看见，你还是得排",
  },
  C,
};
