// 移植自 yihui-dev/awesome-opus5-5-videos（MIT）里 @rush3rx 的 prompt rush3rx-342153：
// https://x.com/rush3rx
// 原机制：「A dead planet to a breathable one, one camera, no cuts.」——机位一动不动，
// 同一画面随进度连续演化，靠场景本身的变化讲时间跨度。
// 已改成配音时间轴驱动的讲解镜头，参数化：讲「逐步演变」（行业从冷到热、账号从 0 到 1、
// 流程从手工到自动化）。补 before-after 只有两张对撞卡、讲不了中间过程的空白。
import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, lerp, noise1, prog, rng, smooth } from "../../lib/anim";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { outline } from "../../lib/cine/Type";
import { fitFont, Headline, fmtNum } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const stage = z.object({
  label: z.string().describe("阶段名，如「 manual 手工期」「起号期」"),
  note: z.string().optional().describe("这一阶段的一句话说明，显示在阶段轨道下方"),
  at: z.number().optional().describe("进入这一阶段的时刻（锚点（台词原文）或帧）；缺省=按台词均匀铺开"),
});

const schema = z.object({
  title: z.string().optional().describe("镜头标题，左上 Headline"),
  kicker: z.string().optional().describe("标题上方小标签，缺省 ONE TAKE"),
  stages: z.array(stage).min(2).max(6).describe("同镜头里依次进入的阶段（2~6 个），画面按它们的锚点分段连续演化"),
  metric: z
    .object({
      label: z.string().describe("这个数字是什么，如「月收入」「自动化覆盖率」"),
      from: z.number().describe("起始值（progress=0 时的读数）"),
      to: z.number().describe("终值（progress=1 时的读数）"),
      unit: z.string().optional().describe("单位，如 %、元、篇"),
    })
    .describe("跟着画面一起变的数字：按 progress 连续插值滚动，不是跳到下一个数"),
  sky: z.enum(["warm", "cool"]).default("cool").describe("演化终点的色温：cool 收成主题青绿 / warm 收成金色"),
});
type D = z.infer<typeof schema>;

const rgb = (h: string) => {
  const s = h.replace("#", "");
  const f = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// 颜色随 progress 连续插值（组件的身份证就是「没有硬切」，所以一切色彩都必须混出来）
const mix = (a: string, b: string, k: number) => {
  const A = rgb(a);
  const B = rgb(b);
  const t = clamp(k);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const n = d.stages.length;
  const cues = listCues(d.stages, 14, Math.max(40, Math.round(dur * 0.82)));

  // progress：阶段锚点分段插值，段内 smooth，段与段首尾相接 ⇒ 全局连续、无跳变
  let pi = 0;
  while (pi < n - 2 && frame >= cues[pi + 1]) pi++;
  const segLen = n > 1 ? Math.max(8, cues[pi + 1] - cues[pi]) : dur;
  const p = n === 1 ? 1 : frame <= cues[0] ? 0 : frame >= cues[n - 1] ? 1 : (pi + smooth(prog(frame, cues[pi], segLen))) / (n - 1);

  const alive = d.sky === "warm" ? t.gold : t.primary;
  const horizonY = height * lerp(0.6, 0.5, p);
  const sceneTop = height * 0.2;

  // 远近两层视差元素：位置/大小/出生阈值全部由 seed 决定（Remotion 每帧必须是时间的纯函数）
  const r = rng(seed * 977 + n * 31 + 7);
  const layer = (count: number, scale: number) =>
    Array.from({ length: count }, (_, i) => ({
      i,
      x: 0.02 + r() * 0.96,
      h: (0.6 + r() * 0.8) * scale,
      w: (0.7 + r() * 0.6) * scale,
      thr: r() * 0.62,
      ph: r() * 6.28,
    }));
  const far = layer(14, 0.62);
  const near = layer(9, 1);

  // 恒速缓慢推镜：任何时刻画面都在动
  const push = 1 + 0.05 * prog(frame, 0, dur);
  const drift = noise1(frame / 90, seed) * 8;
  // 原生是一镜到底的推镜，缩放会带着地平线一起晃 ⇒ from:1，motion.enter 只接位移/淡入/擦除
  const eScene = enterAt(frame, 2, { fallback: "rise", dur: 20, from: 1, dist: 0.4 });

  const dec = Number.isInteger(d.metric.from) && Number.isInteger(d.metric.to) ? 0 : 1;
  const mv = lerp(d.metric.from, d.metric.to, p);
  // 当前阶段 = 最后一个已经到点的锚点（不能用 pi：末段结束时要停在最后一档）
  let active = 0;
  for (let i = 0; i < n; i++) if (frame >= cues[i]) active = i;
  const nextCue = active < n - 1 ? cues[active + 1] : cues[active] + segLen;
  const railX0 = width * 0.08;
  const railX1 = width * 0.92;
  const railY = height * 0.855; // 底部留给字幕：轨道在上、阶段名也写在轨道上方
  const railW = railX1 - railX0;

  const tree = (el: { x: number; h: number; w: number; thr: number; ph: number; i: number }, groundY: number, unit: number, dim: number) => {
    const gp = clamp((p - el.thr) / 0.26);
    if (gp <= 0.001) return null;
    const x = el.x * width;
    const th = unit * el.h * (0.25 + 0.75 * gp);
    const float = Math.sin(frame / 26 + el.ph) * 1.6 * gp;
    const trunk = mix(mix(t.bg, t.bad, 0.4), mix(t.dim, alive, 0.35), p);
    const leaf = mix(t.bad, alive, clamp(p * 1.15));
    const cr = unit * el.w * 0.22 * gp;
    return (
      <g key={el.i} transform={`translate(${x} ${groundY + float})`} opacity={0.35 + 0.65 * gp * (1 - dim)}>
        <rect x={-unit * 0.022} y={-th} width={unit * 0.044} height={th} rx={unit * 0.02} fill={trunk} />
        {cr > 2 && (
          <>
            <circle cx={0} cy={-th} r={cr} fill={alpha(leaf, 0.85)} />
            <circle cx={-cr * 0.7} cy={-th + cr * 0.5} r={cr * 0.7} fill={alpha(leaf, 0.6)} />
            <circle cx={cr * 0.72} cy={-th + cr * 0.42} r={cr * 0.62} fill={alpha(leaf, 0.7)} />
          </>
        )}
      </g>
    );
  };

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: eScene.opacity,
          transform: `translate(${eScene.dx + drift}px, ${eScene.dy}px) scale(${push * eScene.scale})`,
          transformOrigin: "50% 62%",
          clipPath: eScene.clip,
        }}
      >
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="ie-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={mix(mix(t.bg, t.bad, 0.22), mix(t.bg, alive, 0.3), p)} />
              <stop offset="70%" stopColor={mix(mix(t.bg2, t.bad, 0.28), mix(t.bg2, alive, 0.42), p)} />
              <stop offset="100%" stopColor={mix(t.bg2, alive, p * 0.5)} />
            </linearGradient>
            <radialGradient id="ie-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={alpha(mix(t.bad, alive, p), lerp(0.22, 0.75, p))} />
              <stop offset="100%" stopColor={alpha(mix(t.bad, alive, p), 0)} />
            </radialGradient>
            <linearGradient id="ie-ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={mix(mix(t.bg, t.bad, 0.2), mix(t.bg2, alive, 0.3), p)} />
              <stop offset="100%" stopColor={mix(t.bg, alive, p * 0.16)} />
            </linearGradient>
          </defs>

          <rect x={0} y={0} width={width} height={height} fill="url(#ie-sky)" />
          {/* 太阳：从地平线下连续升起到高空 */}
          <circle cx={width * 0.74} cy={horizonY - lerp(-70, height * 0.3, p)} r={height * 0.42} fill="url(#ie-glow)" />
          <circle cx={width * 0.74} cy={horizonY - lerp(-70, height * 0.3, p)} r={lerp(26, 54, p)} fill={mix(t.bad, alive, clamp(p * 1.2))} opacity={lerp(0.35, 1, p)} />

          {/* 远山两层：视差靠不同推移量做，不切镜 */}
          <path d={`M0,${horizonY} L${width * 0.22},${horizonY - height * 0.12} L${width * 0.46},${horizonY} L${width * 0.68},${horizonY - height * 0.15} L${width * 0.9},${horizonY} L${width},${horizonY - height * 0.05} L${width},${height} L0,${height} Z`} fill={alpha(mix(t.bg2, t.bad, 0.3), 0.75)} transform={`translate(${-drift * 0.4} 0)`} />
          <rect x={0} y={horizonY} width={width} height={height - horizonY} fill="url(#ie-ground)" />

          {/* 地平线亮度随 progress 抬升 */}
          <line x1={0} x2={width} y1={horizonY} y2={horizonY} stroke={alpha(mix(t.bad, alive, p), lerp(0.3, 0.9, p))} strokeWidth={2 + p * 2} />
          <rect x={0} y={horizonY - 26 * p} width={width} height={26 * p} fill={alpha(mix(t.bad, alive, p), 0.28)} />

          {/* 远层（小、慢）与近层（大、快）：元素逐个连续长出来，密度自然变高 */}
          <g transform={`translate(${-drift * 0.5} 0)`}>
            {far.map((el) => tree(el, horizonY + height * 0.03, height * 0.1, 0.35))}
          </g>
          <g transform={`translate(${-drift * 1.1} 0)`}>
            {near.map((el) => tree(el, sceneTop + height * 0.46, height * 0.19, 0))}
          </g>

          {/* 风里才有东西飘：粒子密度跟着 p 涨 */}
          {Array.from({ length: 10 }, (_, i) => {
            const ph = i * 1.7;
            const x = ((frame * (1.2 + (i % 3)) + i * 260) % (width + 200)) - 100;
            const y = sceneTop + height * 0.1 + ((i * 97) % (height * 0.34)) + Math.sin(frame / 22 + ph) * 10;
            return <circle key={i} cx={x} cy={y} r={2 + (i % 3)} fill={alpha(alive, 0.5 * p)} />;
          })}
        </svg>
      </div>

      {/* 右上角：跟着一起变的数字（连续插值，Counter 的写法但不限定时窗） */}
      <div style={{ position: "absolute", right: 110, top: 84, textAlign: "right" }}>
        <div style={{ fontFamily: t.font.mono, fontSize: 22, letterSpacing: 4, color: alpha(mix(t.bad, alive, p), 0.9), marginBottom: 6 }}>{d.metric.label}</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", fontFamily: t.font.title, fontWeight: 900, color: t.text, whiteSpace: "nowrap", ...outline(t.bg, 7) }}>
          <span style={{ fontSize: fitFont(`${fmtNum(mv, dec)}${d.metric.unit ?? ""}`, 700, 110, 44), fontVariantNumeric: "tabular-nums", textShadow: `0 0 34px ${alpha(mix(t.bad, alive, p), 0.7)}` }}>{fmtNum(mv, dec)}</span>
          {d.metric.unit && <span style={{ fontSize: 44, marginLeft: 10, color: mix(t.bad, alive, p) }}>{d.metric.unit}</span>}
        </div>
      </div>

      {/* 底部阶段轨道：节点到位就把进度推到底，段内仍是连续滑动 */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <line x1={railX0} x2={railX1} y1={railY} y2={railY} stroke={alpha(t.dim, 0.4)} strokeWidth={3} />
        <line x1={railX0} x2={railX0 + railW * p} y1={railY} y2={railY} stroke={alive} strokeWidth={6} strokeLinecap="round" />
        {d.stages.map((_, i) => {
          const x = railX0 + (railW * i) / Math.max(1, n - 1);
          const on = frame >= cues[i];
          return (
            <g key={i}>
              <circle cx={x} cy={railY} r={on ? 11 : 7} fill={on ? alive : alpha(t.dim, 0.5)} />
              {on && <circle cx={x} cy={railY} r={11 + (Math.sin(frame / 12 + i) + 1) * 4} fill="none" stroke={alpha(alive, 0.4)} strokeWidth={2} />}
            </g>
          );
        })}
        <circle cx={railX0 + railW * p} cy={railY} r={16} fill="none" stroke={alpha(alive, 0.8)} strokeWidth={3} />
      </svg>
      {d.stages.map((s, i) => {
        const x = railX0 + (railW * i) / Math.max(1, n - 1);
        const on = frame >= cues[i];
        const eRail = enterAt(frame, cues[i], { fallback: "rise", dur: 12, seed: i });
        return (
          <div key={i} style={{ position: "absolute", left: Math.min(width - 220, Math.max(90, x)) - 110, width: 220, top: railY - 54, textAlign: "center", opacity: on ? eRail.opacity : 0.22, transform: `translateY(${eRail.dy}px) scale(${on ? 1 : 0.94})`, clipPath: eRail.clip, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(s.label, 210, i === active && on ? 36 : 28, 18), color: on && i === active ? t.text : t.dim, whiteSpace: "nowrap", textShadow: on && i === active ? `0 0 22px ${alpha(alive, 0.7)}` : undefined }}>
            {s.label}
          </div>
        );
      })}
      {d.stages[active]?.note && frame >= cues[active] && (
        <div style={{ position: "absolute", left: 0, right: 0, top: railY - 112, textAlign: "center", fontFamily: t.font.body, fontSize: 30, fontWeight: 700, color: alpha(t.text, 0.85), opacity: clamp(prog(frame, cues[active], 8)) * (1 - clamp(prog(frame, nextCue - 8, 8)) * 0.85) }}>
          {d.stages[active].note}
        </div>
      )}

      <Headline kicker={d.kicker ?? "一镜到底 · 无切换"} title={d.title} frame={frame} />
      {cues.map((c, i) => i > 0 && <Sfx key={i} name="tick" at={Math.round(c)} volume={0.24} />)}
      <Sfx name="sparkle" at={Math.round(cues[n - 1])} volume={0.28} />
    </>
  );
};

export const InplaceEvolve: CompDef<D> = {
  id: "inplace-evolve",
  name: "一镜到底原位演化",
  layer: "info",
  variants: 1,
  minSec: 5,
  maxSec: 16,
  tags: ["演变", "从冷到热", "起步", "逐步", "过程", "成长", "变化", "时间跨度"],
  motion: { kind: "同一机位恒速缓推 + 场景色彩/密度/地平线随进度连续演化，底部阶段轨道推进，右上角数字连续滚动", energy: 2 },
  desc: "一整个场景（天空渐变 + 太阳升起 + 远近两层几何元素 + 地平线）不切镜、不对比卡，色彩从灰红连续过渡到主题青绿，元素逐个数出来；底部阶段轨道随锚点推进，右上角数字按 progress 连续插值",
  use: "讲一段有中间过程的演变：行业从没人用到人人用、账号从 0 到 10 万粉、流程从手工到自动化（before-after 只有两张卡对撞、讲不出「怎么变过来」时用它）",
  schema,
  example: {
    title: "一个号是怎么长起来的",
    kicker: "一镜到底",
    stages: [{ label: "0 粉", note: "发了 20 条没人看" }, { label: "试错期", note: "换选题、换开头" }, { label: "第一条爆" }, { label: "稳定日更" }],
    metric: { label: "粉丝数", from: 0, to: 128000, unit: "粉" },
    sky: "cool",
  },
  C,
};
