import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Figure, gait, mixPose, POSES } from "../../lib/figure";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const lane = z.object({
  name: z.string().describe("这条跑道上的人：同行 / 你 / 用了 AI 的人"),
  speed: z.number().describe("相对速度，1 = 基准；最快的那条会先冲线"),
  hero: z.boolean().optional().describe("主角跑道：发光 + 速度线"),
  tag: z.string().optional().describe("冲线 / 结束时挂在人头上的短标签：1 周、还在观望"),
  boostAt: z.number().optional().describe("这条跑道突然加速的时刻（锚点，比如“用上 AI 之后”）"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  lanes: z.array(lane).min(2).max(4),
  goal: z.string().optional().describe("终点线上写的字：第一单 / 上线 / 年入百万"),
  startAt: z.number().optional().describe("发令起跑的时刻（锚点）"),
  gapAt: z.number().optional().describe("量出差距、盖“领先 N”的时刻（锚点）"),
  gapLabel: z.string().optional().describe("差距标签：领先 11 周"),
});
type D = z.infer<typeof schema>;

// raw distance (arbitrary units) a lane has covered at frame f: 8-frame ease off the blocks,
// boost multiplies speed by 2.4 after boostAt. Callers normalise so the leader hits the line on time.
const BOOST = 2.4;
const rawDist = (f: number, start: number, speed: number, boostAt?: number) => {
  const run = (a: number, b: number) => Math.max(0, Math.min(f, b) - a);
  const warm = (x: number) => (x < 8 ? (x * x) / 16 : x - 4);
  if (boostAt !== undefined && boostAt > start) {
    const pre = run(start, boostAt);
    return speed * warm(pre) + speed * BOOST * run(boostAt, Infinity);
  }
  return speed * warm(run(start, Infinity));
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const lanes = data.lanes;
  const n = lanes.length;
  const startAt = cueOr(data.startAt, Math.round(dur * 0.1));
  const gapAt = cueOr(data.gapAt, Math.round(dur * 0.72));
  const finishAt = Math.max(startAt + 30, gapAt - 8); // leader breaks the tape just before the gap is measured
  const boosts = lanes.map((l) => (l.boostAt !== undefined ? cueOr(l.boostAt, 0) : undefined));
  // normalise: whoever is furthest at finishAt covers exactly 1
  const endRaw = lanes.map((l, i) => rawDist(finishAt, startAt, l.speed, boosts[i]));
  const lead = Math.max(...endRaw, 1e-6);
  const leaderIdx = endRaw.indexOf(lead);
  const dist = (i: number, f: number) => clamp(rawDist(Math.min(f, finishAt), startAt, lanes[i].speed, boosts[i]) / lead);

  // track geometry
  const top = full ? H * 0.24 : H * 0.14;
  const bottom = full ? H * 0.8 : H * 0.9;
  const laneH = (bottom - top) / n;
  const x0 = full ? W * 0.1 : W * 0.08; // start line
  const x1 = full ? W * 0.86 : W * 0.9; // finish line
  const figH = Math.min(laneH * 0.78, full ? 150 : 90);
  const sh = hitShake(frame, [finishAt], 8, 10);
  const enter = easeOut(prog(frame, 0, 14));
  const goalFont = full ? 30 : 18;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* lanes */}
        {lanes.map((l, i) => {
          const y = top + laneH * i;
          const k = easeOut(prog(frame, i * 4, 14));
          return (
            <g key={i} opacity={k}>
              <rect x={x0 - 30} y={y + 4} width={(x1 - x0 + 90) * k} height={laneH - 8} rx={10} fill={alpha(l.hero ? t.primary : t.text, l.hero ? 0.08 : 0.035)} stroke={alpha(l.hero ? t.primary : t.dim, 0.35)} strokeWidth={1.5} />
              {/* distance ticks scrolling under the hero to sell speed */}
              {Array.from({ length: 14 }, (_, q) => {
                const tx = x0 + ((x1 - x0) / 14) * q;
                return <line key={q} x1={tx} y1={y + laneH - 14} x2={tx} y2={y + laneH - 6} stroke={alpha(t.dim, 0.5)} strokeWidth={2} />;
              })}
            </g>
          );
        })}
        {/* start + finish lines */}
        <line x1={x0} y1={top} x2={x0} y2={bottom} stroke={alpha(t.text, 0.45 * enter)} strokeWidth={3} strokeDasharray="8 8" />
        {Array.from({ length: Math.ceil((bottom - top) / 18) }, (_, q) => (
          <rect key={q} x={x1 + (q % 2) * 9} y={top + q * 18} width={9} height={18} fill={alpha(t.text, 0.75 * enter)} />
        ))}
      </svg>
      {/* runners */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {lanes.map((l, i) => {
          const y = top + laneH * i + laneH - 16; // feet
          const d = dist(i, frame);
          const x = lerp(x0 + 20, x1 - 10, d);
          const moving = frame >= startAt && frame < finishAt && d < 1;
          // current speed -> stride rate (hero after boost strides faster)
          const boosted = boosts[i] !== undefined && frame >= (boosts[i] as number);
          const spd = l.speed * (boosted ? BOOST : 1);
          const phase = (frame - startAt) * 0.16 * Math.min(2.2, 0.55 + spd * 0.35);
          const pose = moving ? gait(phase, 0.6) : mixPose(POSES.stand, POSES.cheer, i === leaderIdx && frame >= finishAt ? easeOut(prog(frame, finishAt, 10)) : 0);
          const hero = !!l.hero;
          const c = hero ? t.primary : i === leaderIdx ? t.gold : t.text;
          const trail = hero && moving ? clamp((spd - 1) / 3) : 0;
          return (
            <g key={i}>
              {/* speed streaks behind fast runners */}
              {trail > 0 &&
                Array.from({ length: 5 }, (_, q) => {
                  const yy = y - figH * (0.25 + q * 0.13);
                  const len = (60 + q * 22) * trail * (full ? 1.4 : 0.8);
                  return <line key={q} x1={x - 30 - len} y1={yy} x2={x - 26} y2={yy} stroke={alpha(t.primary, 0.55 - q * 0.08)} strokeWidth={3} strokeLinecap="round" />;
                })}
              {/* boost flash */}
              {boosts[i] !== undefined && frame >= (boosts[i] as number) && frame < (boosts[i] as number) + 14 && (
                <circle cx={x} cy={y - figH / 2} r={figH * (0.4 + prog(frame, boosts[i] as number, 14) * 0.9)} fill="none" stroke={alpha(t.primary, 1 - prog(frame, boosts[i] as number, 14))} strokeWidth={5} />
              )}
              <Figure x={x} y={y} h={figH} pose={pose} color={c} glow={hero ? t.primary : undefined} dim={!hero && i !== leaderIdx && frame > finishAt ? 0.35 : 0} />
            </g>
          );
        })}
      </svg>
      {/* lane labels + tags (HTML for crisp CJK) */}
      {lanes.map((l, i) => {
        const y = top + laneH * i;
        const fs = fitFont(l.name, full ? W * 0.16 : W * 0.3, full ? 26 : 16, 12);
        const d = dist(i, frame);
        const x = lerp(x0 + 20, x1 - 10, d);
        const tagK = l.tag ? easeOutBack(prog(frame, finishAt + 4 + i * 5, 12)) : 0;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: x0 - 20, top: y + 10, fontFamily: t.font.title, fontWeight: 800, fontSize: fs, color: l.hero ? t.primary : t.dim, whiteSpace: "nowrap", opacity: easeOut(prog(frame, i * 4 + 6, 12)), textShadow: "0 2px 0 #000" }}>
              {l.name}
            </div>
            {l.tag && tagK > 0 && (
              <div style={{ position: "absolute", left: Math.min(x + figH * 0.35, W - 170), top: y + laneH * 0.3, transform: `scale(${tagK})`, transformOrigin: "0 50%", padding: full ? "4px 14px" : "2px 8px", borderRadius: 8, background: alpha(t.bg, 0.8), border: `2px solid ${l.hero ? t.primary : t.dim}`, fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 26 : 15, color: l.hero ? t.primary : t.text, whiteSpace: "nowrap" }}>
                {l.tag}
              </div>
            )}
          </React.Fragment>
        );
      })}
      {data.goal && (
        <div style={{ position: "absolute", left: x1 - 60, top: top - (full ? 52 : 30), width: 150, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: goalFont, color: t.gold, whiteSpace: "nowrap", opacity: enter, textShadow: "0 2px 0 #000" }}>
          {data.goal}
        </div>
      )}
      {/* gap measure: from the slowest runner to the finish line, drawn under the track */}
      {(() => {
        const ds = lanes.map((_, i) => dist(i, finishAt));
        const slow = ds.indexOf(Math.min(...ds));
        const xs = lerp(x0 + 20, x1 - 10, ds[slow]);
        const k = easeInOut(prog(frame, gapAt, 16));
        if (k <= 0) return null;
        const yy = bottom + (full ? 26 : 14);
        const xe = lerp(xs, x1, k);
        const label = data.gapLabel ?? "";
        return (
          <>
            <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <line x1={xs} y1={yy - 12} x2={xs} y2={yy + 12} stroke={t.bad} strokeWidth={4} />
              <line x1={xs} y1={yy} x2={xe} y2={yy} stroke={t.bad} strokeWidth={4} />
              {k >= 1 && <line x1={x1} y1={yy - 12} x2={x1} y2={yy + 12} stroke={t.bad} strokeWidth={4} />}
              <line x1={xs} y1={top + laneH * slow + laneH - 16} x2={xs} y2={yy} stroke={alpha(t.bad, 0.5)} strokeWidth={2} strokeDasharray="6 6" />
            </svg>
            {label && (
              <div style={{ position: "absolute", left: (xs + x1) / 2, top: yy + 8, transform: `translate(-50%, 0) scale(${easeOutBack(prog(frame, gapAt + 10, 12))})`, fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 44 : 22, color: t.bad, whiteSpace: "nowrap", textShadow: "0 3px 0 #000" }}>
                {label}
              </div>
            )}
          </>
        );
      })()}
      <Sfx name="whoosh" at={startAt} volume={0.25} />
      {boosts.map((b, i) => (b !== undefined ? <Sfx key={i} name="swish" at={b} volume={0.3} /> : null))}
      <Sfx name="ding" at={finishAt} volume={0.35} />
      <Sfx name="stamp" at={gapAt + 10} volume={0.3} />
    </>
  );
};

export const RaceLanes: CompDef<D> = {
  id: "race-lanes",
  name: "同一起跑线赛跑（速度差拉开）",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["赛跑", "竞争", "速度差", "领先", "落后", "同行"],
  motion: { kind: "多条跑道同时起跑 · 快的人拖出速度线（可中途加速爆闪）· 冲线欢呼 · 红色量尺量出差距", energy: 3 },
  desc: "2~4 条跑道同时起跑，每条一个小人按各自速度跑（快的拖速度线，可以中途 boost 加速爆闪），领先者冲线举手欢呼，其余变暗；随后一把红色量尺从最慢的人量到终点线，标出差距",
  use: "同一起跑线，速度差拉开：用 AI 的同行已经跑远了、先上车的人甩开后来者、新旧两种做法的效率差、三个人三种策略谁先到；支持中途有人突然加速（boostAt）",
  panel: true,
  schema,
  example: {
    lanes: [{ name: "传统做法", speed: 1, tag: "3 个月" }, { name: "用了 AI 的同行", speed: 1.4, hero: true, tag: "1 周", boostAt: 50 }, { name: "你", speed: 1.2, tag: "还在观望" }],
    goal: "第一单",
    gapLabel: "差了 11 周",
    title: "同样起跑，差距在拉开",
  },
  C,
};
