import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, prog } from "../../lib/anim";
import { alpha, useTheme } from "../../lib/theme";
import { GlowDefs, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  points: z.array(z.object({ label: z.string(), value: z.number() })).min(2).max(10),
  unit: z.string().optional(),
});
type D = z.infer<typeof schema>;

// line grows like a living organism; a comet head rides the tip, values pop at each node
const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { width, height } = useVideoConfig();
  const pts = data.points;
  const n = pts.length;
  const L = 240;
  const R = width - 240;
  const T = 300;
  const B = height - 190;
  const max = Math.max(...pts.map((p) => p.value)) * 1.12;
  const P = pts.map((p, i) => ({ x: L + ((R - L) * i) / (n - 1), y: B - ((B - T) * p.value) / max }));
  const grow = easeInOut(prog(frame, 8, Math.min(dur * 0.65, 30 + n * 10)));
  const headIdx = grow * (n - 1);
  const d = P.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `C${P[i - 1].x + (p.x - P[i - 1].x) / 2},${P[i - 1].y} ${P[i - 1].x + (p.x - P[i - 1].x) / 2},${p.y} ${p.x},${p.y}`)).join(" ");
  const area = `${d} L${R},${B} L${L},${B} Z`;
  const hi = Math.floor(headIdx);
  const f = headIdx - hi;
  const hp = hi >= n - 1 ? P[n - 1] : { x: P[hi].x + (P[hi + 1].x - P[hi].x) * f, y: P[hi].y + (P[hi + 1].y - P[hi].y) * (f * f * (3 - 2 * f)) };
  const clipW = hp.x;

  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="gc" std={8} />
        <defs>
          <linearGradient id="gcf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={t.primary} stopOpacity={0} />
          </linearGradient>
          <clipPath id="gcc">
            <rect x={0} y={0} width={clipW} height={height} />
          </clipPath>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={L} x2={R} y1={T + ((B - T) * i) / 4} y2={T + ((B - T) * i) / 4} stroke={alpha(t.primary, 0.1)} strokeDasharray="3 9" />
        ))}
        <line x1={L} x2={R} y1={B} y2={B} stroke={alpha(t.primary, 0.4)} />
        <g clipPath="url(#gcc)">
          {variant === 0 && <path d={area} fill="url(#gcf)" />}
          {variant === 1 &&
            P.map((p, i) => <rect key={i} x={p.x - 28} y={p.y} width={56} height={B - p.y} rx={6} fill={alpha(t.primary, 0.18)} stroke={alpha(t.primary, 0.5)} />)}
          <path d={d} fill="none" stroke={t.primary} strokeWidth={5} filter="url(#gc)" />
        </g>
        {grow > 0.01 && grow < 0.999 && (
          <>
            <circle cx={hp.x} cy={hp.y} r={30} fill={alpha(t.accent, 0.2)} />
            <circle cx={hp.x} cy={hp.y} r={10} fill={t.accent} filter="url(#gc)" />
          </>
        )}
        {P.map((p, i) => {
          const on = headIdx >= i - 0.01;
          const pop = on ? easeOut(clamp((headIdx - i + 0.01) * 4)) : 0;
          return (
            <g key={i} opacity={on ? 1 : 0.25}>
              <circle cx={p.x} cy={p.y} r={7 + pop * 3} fill={on ? t.text : t.dim} stroke={t.primary} strokeWidth={3} />
              <text x={p.x} y={B + 44} textAnchor="middle" fill={t.dim} fontSize={24} fontFamily={t.font.body}>
                {pts[i].label}
              </text>
              <text x={p.x} y={p.y - 26 - pop * 8} textAnchor="middle" fill={i === n - 1 ? t.accent : t.text} fontSize={i === n - 1 ? 44 : 30} fontWeight={800} fontFamily={t.font.mono} opacity={pop}>
                {pts[i].value}
                {data.unit ?? ""}
              </text>
            </g>
          );
        })}
      </svg>
      <Headline kicker={data.kicker ?? "GROWTH"} title={data.title} frame={frame} />
    </>
  );
};

export const GrowthCurve: CompDef<D> = {
  id: "growth",
  name: "增长曲线生长",
  layer: "info",
  variants: 2,
  minSec: 4,
  maxSec: 10,
  tags: ["增长", "趋势", "曲线", "上涨", "翻倍", "逐年", "变化", "数据"],
  desc: "增长曲线逐点画出，节点标数值",
  use: "同一单位的多个数值随时间变化的趋势",
  schema,
  example: { title: "用户增长", points: [{ label: "1月", value: 12 }, { label: "3月", value: 30 }, { label: "6月", value: 88 }, { label: "9月", value: 240 }], unit: "万" },
  C,
};
