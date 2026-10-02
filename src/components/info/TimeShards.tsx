import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const block = z.object({ text: z.string(), hours: z.number().optional().describe("占掉几个小时"), at: z.number().optional() });
const shard = z.object({ text: z.string().describe("这块碎时间能干什么，如“回一封询盘”"), at: z.number().optional() });

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  occupied: z.array(block).min(1).max(6).describe("一天被哪些整块的事占掉：夜班 8 小时 / 通勤 2 小时 / 带娃 4 小时"),
  shards: z.array(shard).min(1).max(5).describe("剩下的碎时间能拿来干什么"),
  payoff: z.string().optional().describe("拼接完成后的结果，如“一天多出 200 块”"),
  payoffAt: z.number().optional(),
  assembleAt: z.number().optional().describe("碎片开始拼合的时刻"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const nOcc = data.occupied.length;
  const totalH = data.occupied.reduce((a, b) => a + (b.hours ?? 2), 0);
  const occCues = data.occupied.map((o, i) => cueOr(o.at, 8 + i * Math.round(Math.max(12, (dur * 0.32) / nOcc))));
  const occupyEnd = occCues[nOcc - 1] + 16;
  const assembleAt = cueOr(data.assembleAt, occupyEnd + 18);
  const shardCues = data.shards.map((s, i) => cueOr(s.at, assembleAt + 14 + i * Math.round(Math.max(12, (dur * 0.4) / data.shards.length))));
  const payoffAt = cueOr(data.payoffAt, shardCues[data.shards.length - 1] + 22);
  const sh = hitShake(frame, [payoffAt], full ? 10 : 5, 12, seed);

  // ── the day as a 24h strip ──
  const cols = 24;
  const barX = full ? W * 0.08 : W * 0.04;
  const barW = full ? W * 0.84 : W * 0.92;
  const barY = full ? H * 0.26 : H * 0.16;
  const barH = full ? 66 : 36;
  const cellW = barW / cols;
  // each occupied block claims its hours in order from hour 0
  const claims: { from: number; to: number; i: number }[] = [];
  let cur = 0;
  data.occupied.forEach((o, i) => {
    const h = o.hours ?? 2;
    claims.push({ from: cur, to: cur + h, i });
    cur += h;
  });
  // the gaps between claims are the shards: split the remaining hours among the shards
  const freeSpans: { from: number; to: number }[] = [];
  let p = 0;
  claims.forEach((c) => {
    if (c.from > p) freeSpans.push({ from: p, to: c.from });
    p = c.to;
  });
  if (p < 24) freeSpans.push({ from: p, to: 24 });
  const freeTotal = freeSpans.reduce((a, s) => a + (s.to - s.from), 0);
  const nSh = data.shards.length;
  // a shard i sits in free space, drifting out of the bar and reassembling into a pipeline
  const shardHome = (i: number) => {
    // distribute shards over the free spans proportionally
    let acc = 0;
    const target = ((i + 0.5) / nSh) * freeTotal;
    for (const s of freeSpans) {
      const len = s.to - s.from;
      if (target <= acc + len) {
        const h = s.from + (target - acc);
        return { h, left: barX + h * cellW };
      }
      acc += len;
    }
    const last = freeSpans[freeSpans.length - 1];
    return { h: last.to - 0.5, left: barX + (last.to - 0.5) * cellW };
  };
  const stackY = full ? H * 0.62 : H * 0.6;
  const shardW = full ? Math.min(300, W * 0.2) : W * 0.4;
  const shardH = full ? 76 : 44;
  const stackX = full ? W * 0.3 : W * 0.1;
  const piped = frame >= assembleAt;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* the 24h bar */}
        <div style={{ position: "absolute", left: barX, top: barY, width: barW, height: barH, borderRadius: 10, background: alpha(t.text, 0.07), border: `2px solid ${alpha(t.text, 0.18)}`, overflow: "hidden" }}>
          {/* hour ticks */}
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} style={{ position: "absolute", left: i * cellW, top: 0, bottom: 0, width: 1, background: alpha(t.text, i % 6 === 0 ? 0.3 : 0.1) }} />
          ))}
        </div>
        {/* hour labels every 6 */}
        {full && [0, 6, 12, 18, 24].map((h) => (
          <div key={h} style={{ position: "absolute", left: barX + Math.min(h, 23.6) * cellW, top: barY + barH + 8, transform: "translateX(-50%)", fontFamily: t.font.mono, fontSize: 18, color: t.dim }}>{String(h).padStart(2, "0")}:00</div>
        ))}
        {/* occupied blocks fill in */}
        {claims.map((c, k) => {
          const cc = occCues[k];
          if (frame < cc) return null;
          const p = easeOut(prog(frame, cc, 12));
          const w = (c.to - c.from) * cellW * p;
          const o = data.occupied[k];
          const fs = fitFont(`${o.text}${o.hours ? ` ${o.hours}h` : ""}`, (c.to - c.from) * cellW - 14, barH * 0.36, 11);
          return (
            <div key={k} style={{ position: "absolute", left: barX + c.from * cellW, top: barY + 4, width: w, height: barH - 8, borderRadius: 7, background: `repeating-linear-gradient(135deg, ${alpha(t.bad, 0.42)} 0 12px, ${alpha(t.bad, 0.24)} 12px 24px)`, border: `2px solid ${alpha(t.bad, 0.8)}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap", textShadow: "0 2px 0 #000", opacity: p }}>{o.text}{o.hours ? ` ${o.hours}h` : ""}</span>
            </div>
          );
        })}
        {/* the gaps glow */}
        {frame >= occupyEnd && freeSpans.map((s, i) => {
          const p = easeOut(prog(frame, occupyEnd + i * 4, 12));
          return <div key={i} style={{ position: "absolute", left: barX + s.from * cellW, top: barY + 4, width: (s.to - s.from) * cellW * p, height: barH - 8, borderRadius: 7, background: `linear-gradient(180deg, ${alpha(t.primary, 0.55)}, ${alpha(t.primary, 0.2)})`, border: `2px solid ${t.primary}`, boxShadow: `0 0 18px ${alpha(t.primary, 0.6)}` }} />;
        })}
        {/* shards drift out of the gaps and stack */}
        {data.shards.map((s, i) => {
          const c = shardCues[i];
          if (frame < c) return null;
          const p = easeOutBack(prog(frame, c, 14));
          const home = shardHome(i);
          const from = { x: home.left, y: barY + barH / 2 };
          const to = { x: stackX, y: stackY + i * (shardH + 12) };
          const ic = guessIcon(s.text) ?? "clock";
          return (
            <div key={i} style={{ position: "absolute", left: lerp(from.x, to.x, p), top: lerp(from.y, to.y, p) - shardH / 2, width: shardW, height: shardH, borderRadius: 12, background: alpha(t.bg, 0.9), border: `2px solid ${t.primary}`, boxShadow: `0 0 20px ${alpha(t.primary, 0.5)}`, display: "flex", alignItems: "center", gap: full ? 12 : 6, padding: `0 ${full ? 16 : 8}px`, transform: `scale(${0.6 + 0.4 * p})` }}>
              <Icon name={ic} size={shardH * 0.45} color={t.primary} />
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(s.text, shardW - shardH * 0.9, shardH * 0.38, 11), color: t.text, whiteSpace: "nowrap" }}>{s.text}</span>
            </div>
          );
        })}
        {/* pipeline spine that the shards plug into */}
        {piped && (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            <path d={`M${stackX + shardW} ${stackY + shardH / 2} H ${stackX + shardW + (full ? 90 : 40)}`} stroke={t.accent} strokeWidth={4} opacity={easeOut(prog(frame, assembleAt, 14))} strokeLinecap="round" />
            <path d={`M${stackX + shardW + (full ? 90 : 40)} ${stackY + shardH / 2} V ${stackY + ((nSh - 1) * (shardH + 12) + shardH / 2)}`} stroke={alpha(t.accent, 0.6)} strokeWidth={4} opacity={easeOut(prog(frame, assembleAt, 14))} strokeLinecap="round" />
          </svg>
        )}
        {data.payoff && frame >= payoffAt && (
          <div style={{ position: "absolute", left: stackX, top: stackY + nSh * (shardH + 12) + (full ? 30 : 14), transform: `scale(${easeOutBack(prog(frame, payoffAt, 14))})`, transformOrigin: "0 50%", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.payoff, W * 0.5, full ? 66 : 30, 18), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 26px ${alpha(t.gold, 0.7)}, 0 3px 0 #000` }}>{data.payoff}</span>
          </div>
        )}
      </div>
      {occCues.map((c, i) => (
        <Sfx key={`o${i}`} name="tick" at={c} volume={0.24} />
      ))}
      <Sfx name="sparkle" at={occupyEnd} volume={0.3} />
      {shardCues.map((c, i) => (
        <Sfx key={`s${i}`} name="pop" at={c} volume={0.32} />
      ))}
      {data.payoff && <Sfx name="success" at={payoffAt} volume={0.35} />}
    </>
  );
};

export const TimeShards: CompDef<D> = {
  id: "time-shards",
  name: "捡碎时间（一天被切碎后剩下的那几块）",
  layer: "info",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["碎时间", "碎片化", "被家务切碎", "下夜班", "没时间", "一天"],
  motion: { kind: "24 小时条被整块占满 → 缝隙发亮 → 碎片飘出拼进流水线 → 结果跳出", energy: 2 },
  desc: "一条 24 小时的横条，被夜班/通勤/带娃这些整块的事一段段涂黑占满（每块标几小时），中间剩下的缝隙发亮；随后缝隙里飘出一块块碎片（每块写它能干的小事），落到左边拼成一条流水线，最后跳出结果数字",
  use: "讲时间被切碎 —— 被家务切成碎片的一天、用的还是下夜班后的碎时间、碎时间也能接单、碎片任务交给 AI 跑",
  panel: true,
  schema,
  example: { occupied: [{ text: "夜班", hours: 8 }, { text: "通勤", hours: 2 }, { text: "带娃", hours: 4 }], shards: [{ text: "回一封询盘" }, { text: "改一句文案" }, { text: "发一条视频" }], payoff: "一天多出 200 块" },
  C,
};
