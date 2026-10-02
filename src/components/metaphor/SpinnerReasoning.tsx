import React from "react";
import { z } from "zod";
import { clamp, easeOut, lerp, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  task: z.string().default("这个任务").describe("在等什么，如“让它想清楚方案”"),
  fastLabel: z.string().default("快的那个").describe("左边：秒回的那个"),
  fastResult: z.string().default("一句套话").describe("它吐出来的东西"),
  slowLabel: z.string().default("慢的那个").describe("右边：转圈很久的那个"),
  slowResult: z.string().default("能直接用的方案").describe("它吐出来的东西"),
  waitAt: z.number().optional().describe("开始转圈计时的时刻"),
  revealAt: z.number().optional().describe("两边同时吐结果的时刻（锚点，如“值得等”）"),
  verdict: z.string().optional().describe("结论，如“慢不是故障”"),
  verdictAt: z.number().optional(),
  waitText: z.string().default("慢不是故障，是它在想").describe("等待时中间那行字"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const waitAt = cueOr(data.waitAt, Math.round(dur * 0.12));
  const revealAt = cueOr(data.revealAt, Math.round(dur * 0.62));
  const verdictAt = cueOr(data.verdictAt, revealAt + 30);
  const panelW = full ? W * 0.36 : W * 0.42;
  const panelH = full ? H * 0.46 : H * 0.32;
  const gap = full ? W * 0.06 : W * 0.04;
  const lx = W / 2 - gap / 2 - panelW;
  const rx = W / 2 + gap / 2;
  const top = full ? H * 0.24 : H * 0.14;
  const fastDone = revealAt;
  const slowDone = revealAt;
  const sh = hitShake(frame, [revealAt], full ? 10 : 5, 12, seed);
  // the slow side's "answer" is a visibly bigger block of content
  const slowBarCount = 9;
  const fastBarCount = 2;

  const spinner = (x: number, y: number, r: number, on: boolean, col: string) => (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2 }}>
      <svg width={r * 2} height={r * 2} style={{ transform: `rotate(${frame * (on ? 7 : 2)}deg)` }}>
        <circle cx={r} cy={r} r={r - 5} fill="none" stroke={alpha(col, 0.22)} strokeWidth={6} />
        <circle cx={r} cy={r} r={r - 5} fill="none" stroke={col} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${(r - 5) * 1.1} ${(r - 5) * 8}`} />
      </svg>
    </div>
  );

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* seconds counter */}
        {frame >= waitAt && frame < revealAt && (
          <div style={{ position: "absolute", left: W / 2, top: top - (full ? 74 : 38), transform: "translateX(-50%)", fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 46 : 22, color: t.accent, fontVariantNumeric: "tabular-nums", textShadow: `0 0 22px ${alpha(t.accent, 0.6)}` }}>
            {((frame - waitAt) / 30).toFixed(1)}s
          </div>
        )}
        {[0, 1].map((side) => {
          const isSlow = side === 1;
          const x = side ? rx : lx;
          const label = side ? data.slowLabel : data.fastLabel;
          const result = side ? data.slowResult : data.fastResult;
          const done = isSlow ? slowDone : fastDone;
          const shown = frame >= done;
          const col = isSlow ? t.gold : t.dim;
          const bars = isSlow ? slowBarCount : fastBarCount;
          // 面板浮现：淡入 + 26px 上浮，正好是 rise 的原生形状（dist 把 22px 基准配回 26px）
          const ePanel = enterAt(frame, 6 + side * 5, { fallback: "rise", dur: 14, dist: 26 / 22 });
          // 「吐结果」时的整块淡入是入场；逐行内容生长(bp)保留原生
          const eRes = enterAt(frame, done, { fallback: "rise", dur: 12 });
          return (
            <React.Fragment key={side}>
              <div style={{ position: "absolute", left: x, top, width: panelW, height: panelH, borderRadius: 18, background: alpha(t.bg2, 0.9), border: `2.5px solid ${alpha(col, 0.7)}`, boxShadow: shown && isSlow ? `0 0 40px ${alpha(t.gold, 0.4)}` : undefined, opacity: ePanel.opacity, transform: `translateY(${ePanel.dy}px)` }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: full ? 62 : 34, borderBottom: `2px solid ${alpha(col, 0.35)}`, display: "flex", alignItems: "center", paddingLeft: full ? 22 : 11, gap: full ? 10 : 5 }}>
                  <Icon name={isSlow ? "bot" : "zap"} size={full ? 26 : 14} color={col} />
                  <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 26 : 14, color: t.text, whiteSpace: "nowrap" }}>{label}</span>
                </div>
                {/* body: spinner then result */}
                <div style={{ position: "absolute", left: 0, right: 0, top: full ? 62 : 34, bottom: 0, opacity: shown ? eRes.opacity : 1 }}>
                  {!shown && spinner(panelW / 2, (panelH - (full ? 62 : 34)) / 2, full ? 44 : 24, frame >= waitAt, col)}
                  {shown && (
                    <div style={{ position: "absolute", left: full ? 22 : 11, right: full ? 22 : 11, top: full ? 20 : 10 }}>
                      {/* result rendered as content lines: the slow one has a lot more */}
                      <div style={{ display: "flex", alignItems: "center", gap: full ? 10 : 5, marginBottom: full ? 14 : 7 }}>
                        <Icon name="check" size={full ? 24 : 13} color={isSlow ? t.gold : t.dim} stroke={4} />
                        <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(result, panelW - (full ? 60 : 30), full ? 30 : 16, 12), color: isSlow ? t.gold : t.dim, whiteSpace: "nowrap" }}>{result}</span>
                      </div>
                      {Array.from({ length: bars }, (_, b) => {
                        const bp = easeOut(prog(frame, done + 6 + b * 3, 10));
                        return <div key={b} style={{ height: full ? 12 : 7, marginBottom: full ? 10 : 5, borderRadius: 4, background: alpha(isSlow ? t.gold : t.dim, 0.28), width: `${(isSlow ? 92 - b * 4 : 40 - b * 8) * bp}%` }} />;
                      })}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {/* the wait line */}
        {frame >= waitAt && frame < revealAt && (
          <div style={{ position: "absolute", left: 0, right: 0, top: top + panelH + (full ? 40 : 20), textAlign: "center", opacity: enterAt(frame, waitAt + 20, { fallback: "rise", dur: 18 }).opacity, fontFamily: t.font.body, fontWeight: 800, fontSize: full ? 30 : 16, color: t.dim, whiteSpace: "nowrap" }}>{data.waitText}</div>
        )}
        {data.verdict && frame >= verdictAt && (
          <div style={{ position: "absolute", left: W / 2, top: top + panelH + (full ? 84 : 42), transform: `translateX(-50%) scale(${enterAt(frame, verdictAt, { fallback: "rise", dur: 14 }).p})`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.7, full ? 52 : 26, 15), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 24px ${alpha(t.gold, 0.6)}, 0 3px 0 #000` }}>{data.verdict}</div>
        )}
        {/* task line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: top - (full ? 130 : 68), textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.task, W * 0.6, full ? 40 : 20, 13), color: t.text, whiteSpace: "nowrap", opacity: enterAt(frame, 4, { fallback: "rise", dur: 14 }).opacity }}>{data.task}</div>
      </div>
      <Sfx name="click" at={waitAt} volume={0.26} />
      <Sfx name="riser" at={Math.max(0, revealAt - 46)} volume={0.16} />
      <Sfx name="ding" at={revealAt} volume={0.35} />
      <Sfx name="sparkle" at={revealAt + 14} volume={0.3} />
      {data.verdict && <Sfx name="stamp" at={verdictAt} volume={0.32} />}
    </>
  );
};

export const SpinnerReasoning: CompDef<D> = {
  id: "spinner-reasoning",
  name: "转圈即思考（慢的反而更好）",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["转圈", "等待", "思考", "慢", "值得等", "深度"],
  motion: { kind: "两边同时开始转圈 + 中间秒表走秒 → 快的一边先吐一行 → 慢的一边吐出一大块 → 结论", energy: 2 },
  desc: "左右两块对话框同时开始转圈加载，中间一个秒表在走秒；快到某个点，左边「快的那个」先吐出一行套话就停了，右边「慢的那个」继续转，直到揭晓时吐出一大块能直接用的内容 —— 内容块明显更大，结论落在「值得等」",
  use: "解释「等」的价值：慢不是故障，是深度思考；为什么有的任务值得等；同样的问题两个模型结果差多少",
  panel: true,
  schema,
  example: { task: "让它出个完整方案", fastLabel: "秒回的那个", fastResult: "一句套话", slowLabel: "想了一会儿的那个", slowResult: "能直接用的方案", verdict: "慢不是故障，是它在想" },
  C,
};
