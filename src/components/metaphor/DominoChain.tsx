import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, noise1, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  steps: z.array(z.object({ text: z.string(), at: z.number().optional().describe("这一块倒下的时刻（锚点）") })).min(3).max(7).describe("连锁反应的每一步，从起因到结果"),
  pushAt: z.number().optional().describe("第一块被推倒的时刻（锚点）；没给每块的 at 时后面自动接连倒"),
  result: z.string().optional().describe("最后砸出来的结果大字，如“账号废了”“订单翻倍”"),
  tone: z.enum(["bad", "good"]).default("bad").describe("bad = 崩塌（红），good = 好的连锁（金）"),
});
type D = z.infer<typeof schema>;

const Ring: React.FC<{ x: number; y: number; p: number; col: string }> = ({ x, y, p, col }) => (
  <div style={{ position: "absolute", left: x - 90 * p, top: y - 90 * p, width: 180 * p, height: 180 * p, borderRadius: "50%", border: `4px solid ${col}`, opacity: 1 - p }} />
);

const C: React.FC<CompProps<D>> =({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const full = width >= 900;
  const n = data.steps.length;
  const push = cueOr(data.pushAt, 16);
  const gap = Math.max(6, Math.min(14, (dur * 0.6 - push) / n));
  // each block falls at its own cue, never before the previous one has started to fall
  const cues: number[] = [];
  data.steps.forEach((s, i) => cues.push(Math.max(i ? cues[i - 1] + 5 : 0, cueOr(s.at, push + i * gap))));
  const done = cues[n - 1] + 12;
  const col = data.tone === "good" ? t.gold : t.bad;
  const ground = full ? height * 0.72 : height * 0.7;
  const span = width * (full ? 0.8 : 0.9);
  // blocks sit close enough that each one, pivoting on its right foot, lands on the next;
  // the row (incl. the last block lying flat) is centred in the frame
  const bh = full ? Math.min(340, height * 0.34) : Math.min(170, height * 0.36);
  const bw = full ? 64 : 28;
  const step = Math.min(bh * 0.8 + bw, (span - bh - bw) / Math.max(1, n - 1));
  const rowW = (n - 1) * step + bw + bh;
  const x0 = (width - rowW) / 2 - step / 2 + bw / 2;
  const lean = (Math.asin(clamp((step - bw) / bh, 0, 0.98)) * 180) / Math.PI;
  const shakeK = frame >= done && frame < done + 14 ? 1 - (frame - done) / 14 : 0;
  const shx = noise1(frame * 2.9, seed) * 22 * shakeK;
  const res = easeOutBack(prog(frame, done, 14));
  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${shx}px)` }}>
        <div style={{ position: "absolute", left: (width - rowW) / 2 - 40, width: rowW + 80, top: ground, height: 4, background: alpha(t.primary, 0.7), boxShadow: `0 0 18px ${alpha(t.primary, 0.7)}` }} />
        {data.steps.map((s, i) => {
          const f = easeIn(prog(frame, cues[i], 9));
          // lands against the next block, the last one falls flat
          const ang = f * (i === n - 1 ? 90 : lean);
          const fallen = frame >= cues[i];
          const x = x0 + step * i + step / 2;
          const k = clamp(0.4 + 0.6 * easeOut(prog(frame, i * 3, 12)));
          const label = fitFont(s.text, full ? step * 0.92 : step * 1.1, full ? 40 : 18, 12);
          return (
            <React.Fragment key={i}>
              <div
                style={{
                  position: "absolute",
                  left: x - bw / 2,
                  top: ground - bh,
                  width: bw,
                  height: bh,
                  transformOrigin: "right bottom",
                  transform: `rotate(${ang}deg) scale(${k})`,
                  borderRadius: 10,
                  background: fallen ? `linear-gradient(180deg, ${alpha(col, 0.9)}, ${alpha(col, 0.45)})` : `linear-gradient(180deg, ${alpha(t.primary, 0.55)}, ${alpha(t.bg2, 0.95)})`,
                  border: `2px solid ${fallen ? col : t.primary}`,
                  boxShadow: `0 0 ${fallen ? 30 : 14}px ${alpha(fallen ? col : t.primary, 0.5)}`,
                }}
              />
              {/* impact ring where the block hits */}
              {frame >= cues[i] + 8 && frame < cues[i] + 22 && (
                <Ring x={i === n - 1 ? x + bw / 2 + bh : x + step - bw / 2} y={i === n - 1 ? ground : ground - bh * Math.cos((lean * Math.PI) / 180)} p={prog(frame, cues[i] + 8, 14)} col={col} />
              )}
              <div
                style={{
                  position: "absolute",
                  left: x - 150,
                  width: 300,
                  top: ground + 18,
                  textAlign: "center",
                  fontFamily: t.font.title,
                  fontWeight: 900,
                  fontSize: label,
                  color: fallen ? col : t.text,
                  opacity: easeOut(prog(frame, Math.min(cues[i] - 4, i * 4 + 6), 10)),
                  whiteSpace: "nowrap",
                  textShadow: "0 2px 8px rgba(0,0,0,.8)",
                }}
              >
                {s.text}
              </div>
            </React.Fragment>
          );
        })}
        {data.result && res > 0 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: ground - bh - (full ? 130 : 70), textAlign: "center" }}>
            <span
              style={{
                display: "inline-block",
                transform: `scale(${res}) rotate(-3deg)`,
                padding: full ? "10px 34px" : "4px 14px",
                border: `${full ? 5 : 3}px solid ${col}`,
                borderRadius: 14,
                background: alpha("#000000", 0.35),
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: fitFont(data.result, width * 0.7, full ? 80 : 34, 18),
                color: col,
                whiteSpace: "nowrap",
                textShadow: `0 0 24px ${alpha(col, 0.7)}`,
              }}
            >
              {data.result}
            </span>
          </div>
        )}
      </div>
      {cues.map((c, i) => (
        <Sfx key={i} name="click" at={c + 8} volume={0.3 + (i / n) * 0.15} />
      ))}
      {data.result && <Sfx name={data.tone === "good" ? "success" : "impact"} at={done} volume={0.45} />}
    </>
  );
};

export const DominoChain: CompDef<D> = {
  id: "domino-chain",
  name: "多米诺连锁反应",
  layer: "metaphor",
  variants: 1,
  minSec: 2.5,
  maxSec: 9,
  tags: ["连锁反应", "多米诺", "一步错步步错", "崩塌", "导致", "蝴蝶效应"],
  desc: "一排发光骨牌，每块下面写一步；说到哪步哪块倒下撞倒下一块（变红/金 + 冲击环 + 咔哒声），最后一块倒地时画面一震、砸出结果大字",
  use: "一件小事一步步引发大结果：第一步搞反→内容没人看→账号没权重→放弃；一个好习惯→连锁收益；供应链断一环→全线停工",
  panel: true,
  schema,
  example: { steps: [{ text: "先做产品" }, { text: "没人需要" }, { text: "没有流量" }, { text: "账号废了" }], result: "第一步就错了", tone: "bad" },
  C,
};
