import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const piece = z.object({ text: z.string(), icon: z.string().optional(), at: z.number().optional().describe("这一块飞入咬合的时刻") });

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  pieces: z.array(piece).min(2).max(6).describe("环上的每一块，按顺序：拆解 → 筛选 → 分析 → 装配"),
  center: z.string().optional().describe("环中心的字，如“四步闭环”"),
  closeAt: z.number().optional().describe("最后一块到位、整环点亮旋转的时刻（锚点）"),
  verdict: z.string().optional().describe("结论，如“缺一环就不成立”"),
  verdictAt: z.number().optional(),
  gapAt: z.number().optional().describe("抽掉一块演示“缺一环”的时刻；给了就把 highlight 那块抽出来"),
  highlight: z.number().optional().describe("被抽出演示的那一块序号"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.pieces.length;
  const cues = listCues(data.pieces, 8, Math.max(30, dur * 0.55));
  const closeAt = cueOr(data.closeAt, cues[n - 1] + 22);
  const verdictAt = cueOr(data.verdictAt, closeAt + 26);
  const cx = full ? W * 0.42 : W * 0.5;
  const cy = full ? H * 0.5 + 20 : H * 0.46;
  const R = full ? Math.min(270, H * 0.26) : Math.min(W * 0.3, 120);
  const arc = (Math.PI * 2) / n;
  // each piece is an arc segment; it flies in from its own direction and locks
  const gapIdx = data.gapAt !== undefined ? data.highlight ?? 0 : -1;
  const gapK = gapIdx >= 0 ? easeInOut(prog(frame, cueOr(data.gapAt, 0), 18)) : 0;
  // whole ring spins once closed (slow, continuous)
  const spin = frame >= closeAt ? (frame - closeAt) * 0.35 : 0;
  const sh = hitShake(frame, [closeAt], full ? 12 : 6, 14, seed);
  const icon = (i: number) => data.pieces[i].icon ?? guessIcon(data.pieces[i].text);
  // an arc path for segment i
  const seg = (i: number, pad: number) => {
    const a0 = i * arc - Math.PI / 2 + pad + (spin * Math.PI) / 180;
    const a1 = (i + 1) * arc - Math.PI / 2 - pad + (spin * Math.PI) / 180;
    const r = R;
    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
  };

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="ra" std={9} user />
          {/* ghost ring so the shape is readable before pieces arrive */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={alpha(t.text, 0.12)} strokeWidth={full ? 44 : 24} strokeDasharray="10 14" />
          {data.pieces.map((p, i) => {
            const c = cues[i];
            const inP = frame >= c ? easeOutBack(prog(frame, c, 16)) : 0;
            const pulled = i === gapIdx ? gapK : 0;
            if (inP <= 0) return null;
            const mid = (i + 0.5) * arc - Math.PI / 2 + (spin * Math.PI) / 180;
            const fromX = cx + Math.cos(mid) * (R + (full ? 420 : 220));
            const fromY = cy + Math.sin(mid) * (R + (full ? 420 : 220));
            // fly in along the radius, then (if pulled) fly back out
            const tx = Math.cos(mid) * (full ? 200 : 100) * pulled;
            const ty = Math.sin(mid) * (full ? 200 : 100) * pulled;
            const dx = lerp(fromX - cx, 0, inP) + tx;
            const dy = lerp(fromY - cy, 0, inP) + ty;
            const col = pulled > 0.1 ? t.bad : i < (frame >= closeAt ? n : cues.findIndex((x) => frame < x) < 0 ? n : cues.findIndex((x) => frame < x)) ? t.primary : t.dim;
            return (
              <g key={i} transform={`translate(${dx} ${dy}) rotate(${lerp(-40, 0, inP) * (i % 2 ? 1 : -1)})`} opacity={1 - pulled * 0.85}>
                <path d={seg(i, 0.06)} fill="none" stroke={col} strokeWidth={full ? 40 : 22} strokeLinecap="round" opacity={0.28} />
                <path d={seg(i, 0.06)} fill="none" stroke={col} strokeWidth={full ? 12 : 7} strokeLinecap="round" filter={i < n && frame >= cues[i] ? "url(#ra)" : undefined} />
                {/* tooth that meshes with the next piece */}
                <circle cx={cx + Math.cos((i + 1) * arc - Math.PI / 2 + 0.09 + (spin * Math.PI) / 180) * R} cy={cy + Math.sin((i + 1) * arc - Math.PI / 2 + 0.09 + (spin * Math.PI) / 180) * R} r={full ? 11 : 6} fill={t.bg} stroke={col} strokeWidth={3} />
              </g>
            );
          })}
          {/* center label */}
          {data.center && frame >= closeAt && (
            <g opacity={easeOut(prog(frame, closeAt, 14))}>
              <circle cx={cx} cy={cy} r={R * 0.42} fill={alpha(t.accent, 0.1)} stroke={alpha(t.accent, 0.5)} strokeWidth={3} />
            </g>
          )}
        </svg>
        {/* piece labels ride outside the ring */}
        {data.pieces.map((p, i) => {
          const c = cues[i];
          if (frame < c) return null;
          const pulled = i === gapIdx ? gapK : 0;
          const mid = (i + 0.5) * arc - Math.PI / 2 + (spin * Math.PI) / 180;
          const lx = cx + Math.cos(mid) * (R + (full ? 118 : 62)) + Math.cos(mid) * (full ? 120 : 70) * pulled;
          const ly = cy + Math.sin(mid) * (R + (full ? 118 : 62)) + Math.sin(mid) * (full ? 120 : 70) * pulled;
          const ic = icon(i);
          const fs = fitFont(p.text, full ? 220 : 120, full ? 26 : 14, 11);
          return (
            <div key={i} style={{ position: "absolute", left: lx, top: ly, transform: `translate(-50%,-50%) scale(${easeOutBack(prog(frame, c + 6, 14)) * (1 - pulled * 0.2)})`, display: "flex", alignItems: "center", gap: full ? 10 : 5, padding: `${full ? 6 : 3}px ${full ? 16 : 8}px`, borderRadius: 30, background: alpha(t.bg, 0.88), border: `2px solid ${pulled > 0.1 ? t.bad : t.primary}`, boxShadow: `0 0 20px ${alpha(pulled > 0.1 ? t.bad : t.primary, 0.5)}`, whiteSpace: "nowrap" }}>
              {ic && <Icon name={ic} size={full ? 24 : 13} color={pulled > 0.1 ? t.bad : t.primary} />}
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap" }}>{p.text}</span>
            </div>
          );
        })}
        {data.center && frame >= closeAt && (
          <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) scale(${easeOutBack(prog(frame, closeAt, 16))})`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.center, R * 0.8, full ? 46 : 22, 14), color: t.accent, whiteSpace: "nowrap", textShadow: `0 0 22px ${alpha(t.accent, 0.7)}` }}>{data.center}</div>
        )}
        {data.verdict && frame >= verdictAt && (
          <div style={{ position: "absolute", left: cx, top: cy + R + (full ? 120 : 62), transform: `translateX(-50%) scale(${easeOutBack(prog(frame, verdictAt, 14))})`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.6, full ? 48 : 24, 15), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 24px ${alpha(t.gold, 0.6)}, 0 3px 0 #000` }}>{data.verdict}</div>
        )}
      </div>
      {cues.map((c, i) => (
        <Sfx key={i} name="swish" at={c} volume={0.26} />
      ))}
      <Sfx name="impact" at={closeAt} volume={0.3} />
      <Sfx name="success" at={closeAt + 10} volume={0.32} />
      {gapIdx >= 0 && <Sfx name="glitch" at={cueOr(data.gapAt, 0)} volume={0.32} />}
      {data.verdict && <Sfx name="ding" at={verdictAt} volume={0.32} />}
    </>
  );
};

export const RingAssembly: CompDef<D> = {
  id: "ring-assembly",
  name: "环形拼图（缺一环就不成立）",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["闭环", "缺一环", "拼图", "环", "缺一不可", "咬合"],
  motion: { kind: "一块块弧段从外圈飞入咬合并齐 → 整环发光缓慢旋转 → 抽掉一块演示缺口", energy: 2 },
  desc: "一圈由几段弧形拼块组成的环，每段从画面外沿半径方向飞进来咬合到位（每段外侧挂一个环节名），最后一块到位时整环点亮、缓慢旋转、中心浮出名字；可选把某一块抽出去，演示「缺一环就不成立」",
  use: "讲一个闭环或一套完整链路：四步闭环（拆解→筛选→分析→装配）；这个流程缺任何一环都跑不通；配套的东西少一样就废",
  panel: true,
  schema,
  example: { pieces: [{ text: "拆解" }, { text: "筛选" }, { text: "分析" }, { text: "装配" }], center: "四步闭环", verdict: "缺一环就不成立" },
  C,
};
