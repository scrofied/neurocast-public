import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const node = z.object({ text: z.string(), icon: z.string().optional().describe("图标名，缺省按文字猜"), at: z.number().optional().describe("这一环点亮的时刻（锚点）") });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  nodes: z.array(node).min(3).max(6).describe("循环里的每一环，按顺序：如 需求 → 内容 → 流量 → 反馈"),
  center: z.string().optional().describe("中心的字，如“增长飞轮”"),
  spinAt: z.number().optional().describe("开始加速的时刻（锚点，如“越转越快”）；缺省 = 最后一环点亮后"),
  boost: z.string().optional().describe("加速后弹出的结论，如“越转越快”"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const n = data.nodes.length;
  const cues = listCues(data.nodes, 10, Math.max(40, dur * 0.55));
  const spinAt = cueOr(data.spinAt, (cues[n - 1] ?? 40) + 20);
  const cx = width / 2;
  const cy = full ? height / 2 + 40 : height / 2;
  const R = full ? Math.min(330, height * 0.3) : Math.min(width * 0.36, 130);
  const nr = full ? 78 : 42;
  // angular position: slow idle drift, then accelerates after spinAt (integrated speed, so no jump)
  const acc = Math.max(0, frame - spinAt);
  // ramps to 12°/frame over 40 frames, then holds
  const rot = frame * 0.15 + (acc < 40 ? 0.15 * acc * acc : 240 + 12 * (acc - 40));
  const spinK = clamp(acc / 40);
  const lit = (i: number) => easeOutBack(prog(frame, cues[i], 14));
  const allLit = frame >= (cues[n - 1] ?? 0);
  // 结论徽章原生是回弹放大弹出（easeOutBack prog 16 帧）；分镜写 motion.enter 才换
  const eBoost = enterAt(frame, spinAt + 18, { fallback: "rise", dur: 16, from: 0 });
  // 中心标题原生只有淡入，位移接上后 slide/wipe 之类才落到画面上
  const eCenter = enterAt(frame, 6, { fallback: "rise", dur: 14 });
  const pos = (i: number) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  };
  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="fw" std={8} />
        {/* the ring: dashes stream faster as the wheel speeds up */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={alpha(t.primary, 0.18)} strokeWidth={full ? 26 : 14} />
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke={allLit ? t.accent : t.primary}
          strokeOpacity={0.8}
          strokeWidth={full ? 6 : 4}
          strokeDasharray={`${18 + spinK * 60} 22`}
          strokeDashoffset={-rot * 3}
          filter="url(#fw)"
        />
        {/* arcs between lit nodes (the loop closes when the last one lights) */}
        {data.nodes.map((_, i) => {
          const p = easeInOut(prog(frame, cues[i] + 6, 14));
          if (p <= 0) return null;
          const a0 = -90 + (360 / n) * i + 12;
          const a1 = a0 + (360 / n - 24) * p;
          const rad = (d: number) => (d * Math.PI) / 180;
          const x0 = cx + Math.cos(rad(a0)) * R;
          const y0 = cy + Math.sin(rad(a0)) * R;
          const x1 = cx + Math.cos(rad(a1)) * R;
          const y1 = cy + Math.sin(rad(a1)) * R;
          const ah = rad(a1 + 90);
          return (
            <g key={i}>
              <path d={`M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}`} fill="none" stroke={t.primary} strokeWidth={full ? 8 : 5} strokeLinecap="round" filter="url(#fw)" />
              {p > 0.95 && <polygon points={`${x1 + Math.cos(ah) * 16},${y1 + Math.sin(ah) * 16} ${x1 + Math.cos(ah + 2.4) * 14},${y1 + Math.sin(ah + 2.4) * 14} ${x1 + Math.cos(ah - 2.4) * 14},${y1 + Math.sin(ah - 2.4) * 14}`} fill={t.primary} />}
            </g>
          );
        })}
        {/* energy pulses riding the loop once it spins */}
        {spinK > 0 &&
          [0, 1, 2].map((k) => {
            const a = ((rot * 2 + k * 120) * Math.PI) / 180 - Math.PI / 2;
            return <circle key={k} cx={cx + Math.cos(a) * R} cy={cy + Math.sin(a) * R} r={(full ? 12 : 7) * spinK} fill={t.accent} filter="url(#fw)" />;
          })}
      </svg>
      {data.nodes.map((nd, i) => {
        const p = pos(i);
        const k = lit(i);
        const on = frame >= cues[i];
        const ic = nd.icon ?? guessIcon(nd.text);
        const fs = fitFont(nd.text, full ? 260 : 120, full ? 38 : 22, 16);
        return (
          <div key={i} style={{ position: "absolute", left: p.x - nr, top: p.y - nr, width: nr * 2, height: nr * 2, transform: `scale(${0.6 + 0.4 * clamp(k)})`, opacity: on ? 1 : 0.35 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: on ? `radial-gradient(circle, ${alpha(t.primary, 0.35)}, ${alpha(t.bg2, 0.95)} 70%)` : alpha(t.bg2, 0.8),
                border: `3px solid ${on ? t.primary : alpha(t.dim, 0.5)}`,
                boxShadow: on ? `0 0 ${30 + spinK * 30}px ${alpha(t.primary, 0.6)}` : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {ic ? <Icon name={ic} size={nr * 0.9} color={on ? t.text : t.dim} /> : <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: nr * 0.9, color: on ? t.text : t.dim }}>{i + 1}</span>}
            </div>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: nr * 2 + 8,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: fs,
                color: on ? t.text : t.dim,
                textShadow: "0 2px 8px rgba(0,0,0,.8)",
              }}
            >
              {nd.text}
            </div>
          </div>
        );
      })}
      {data.center && (
        <div style={{ position: "absolute", left: cx - R * 0.7, width: R * 1.4, top: cy - 40, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.center, R * 1.3, full ? 56 : 28, 16), color: allLit ? t.accent : t.text, opacity: eCenter.opacity, transform: `translate(${eCenter.dx}px, ${eCenter.dy}px)`, textShadow: `0 0 24px ${alpha(allLit ? t.accent : t.primary, 0.6)}` }}>
          {data.center}
        </div>
      )}
      {data.boost && eBoost.p > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: cy + (full ? 50 : 30), textAlign: "center" }}>
          <span style={{ display: "inline-block", transform: `translate(${eBoost.dx}px, ${eBoost.dy}px) scale(${eBoost.scale})`, opacity: eBoost.opacity, clipPath: eBoost.clip, padding: full ? "8px 22px" : "4px 12px", borderRadius: 12, background: alpha(t.accent, 0.18), border: `2px solid ${t.accent}`, fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 34 : 20, color: t.accent, whiteSpace: "nowrap" }}>{data.boost}</span>
        </div>
      )}
      {cues.map((c, i) => (
        <Sfx key={i} name="pop" at={c} volume={0.3} />
      ))}
      <Sfx name="riser" at={spinAt} volume={0.25} />
      {data.boost && <Sfx name="ding" at={spinAt + 18} volume={0.35} />}
    </>
  );
};

export const Flywheel: CompDef<D> = {
  id: "flywheel",
  name: "增长飞轮（循环越转越快）",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["循环", "飞轮", "正反馈", "越来越", "滚雪球", "闭环"],
  motion: { kind: "环上光带随转速加快、节点逐一点亮闭合成环，结论徽章回弹弹出", energy: 3 },
  desc: "3~6 个图标节点围成一个环，说到哪环哪环点亮、箭头弧线连到下一环；最后一环点亮后闭环，环上光带加速流动、能量光点越绕越快，弹出结论",
  use: "A 带来 B、B 又带来 C、最后回到 A 的循环/正反馈：内容→粉丝→数据→更好的内容；用户→数据→模型→更多用户；恶性循环也行（boost 写“越陷越深”）",
  panel: true,
  schema,
  example: { center: "增长飞轮", nodes: [{ text: "真实需求" }, { text: "爆款内容" }, { text: "精准粉丝" }, { text: "更多评论" }], boost: "越转越快" },
  C,
};
