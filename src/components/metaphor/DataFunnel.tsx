import React, { useLayoutEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { rng } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  stages: z.array(z.object({ label: z.string(), value: z.string().optional() })).min(2).max(5),
});
type D = z.infer<typeof schema>;

// particles rain into a glowing funnel; each stage filters a portion out sideways
const C: React.FC<CompProps<D>> = ({ data, frame, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const st = data.stages;
  const n = st.length;
  const cx = width / 2 - 150;
  const top = 250;
  const bottom = height - 130;
  const H = (bottom - top) / n;
  const w0 = 760;
  const wAt = (y: number) => w0 * (1 - ((y - top) / (bottom - top)) * 0.78);
  const parts = useMemo(() => {
    const r = rng(seed + 44);
    return new Array(900).fill(0).map(() => ({ x: (r() - 0.5), t0: r() * 200, spd: 2.2 + r() * 2.5, exit: Math.floor(r() * (n + 1.5)), dir: r() < 0.5 ? -1 : 1 }));
  }, [seed, n]);

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    for (const p of parts) {
      const life = frame - p.t0 * 0.35;
      if (life < 0) continue;
      let y = top - 120 + ((life * p.spd) % (bottom - top + 200));
      const stage = Math.floor((y - top) / H);
      let x = cx + p.x * wAt(Math.max(top, y)) * 0.92;
      let a = 0.8;
      let col = t.primary;
      if (stage >= p.exit && p.exit < n) {
        const ey = top + p.exit * H + H * 0.5;
        const k = Math.max(0, y - ey);
        x += p.dir * k * 2.2;
        y = ey + k * 0.3;
        a = Math.max(0, 0.7 - k / 200);
        col = t.dim;
      } else if (stage >= n - 1) col = t.accent;
      ctx.fillStyle = alpha(col, a);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }, [frame, parts, width, height, t]);

  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {st.map((_, i) => {
          const y0 = top + i * H;
          const y1 = y0 + H - 12;
          const a = wAt(y0) / 2;
          const b = wAt(y1) / 2;
          // 分层逐条弹出：原生 opacity 就是 easeOutBack 入场进度，e.p（rise）与之等价
          const e = enterAt(frame, i * 6, { fallback: "rise", dur: 18, seed: i });
          return (
            <polygon
              key={i}
              points={`${cx - a},${y0} ${cx + a},${y0} ${cx + b},${y1} ${cx - b},${y1}`}
              fill={alpha(i === n - 1 ? t.accent : t.primary, 0.06 + i * 0.03)}
              stroke={alpha(i === n - 1 ? t.accent : t.primary, 0.8)}
              strokeWidth={2}
              opacity={e.p}
              style={{ filter: `drop-shadow(0 0 12px ${alpha(t.primary, 0.5)})`, clipPath: e.clip }}
            />
          );
        })}
      </svg>
      <canvas ref={ref} width={width} height={height} style={{ position: "absolute", inset: 0 }} />
      {st.map((s, i) => {
        const y = top + i * H + H / 2 - 30;
        // 数值标签原生从右侧 40px 滑入+淡入，slide-r dist≈40/240 与基线一致
        const e = enterAt(frame, 10 + i * 8, { fallback: "slide-r", dur: 16, dist: 0.17 });
        return (
          <div key={i} style={{ position: "absolute", left: cx + wAt(top + i * H) / 2 + 40, top: y, opacity: e.opacity, transform: `translate(${e.dx}px, ${e.dy}px)`, display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontFamily: t.font.mono, fontSize: 44, fontWeight: 800, color: i === n - 1 ? t.accent : t.primary }}>{s.value ?? ""}</span>
            <span style={{ fontFamily: t.font.body, fontSize: fitFont(s.label, 420, 34), fontWeight: 700, color: t.text }}>{s.label}</span>
          </div>
        );
      })}
      <Headline kicker={data.kicker ?? "FUNNEL"} title={data.title} frame={frame} />
    </>
  );
};

export const DataFunnel: CompDef<D> = {
  id: "funnel",
  name: "粒子漏斗筛选",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["漏斗", "转化", "筛选", "过滤", "留存", "流量", "成交"],
  motion: { kind: "粒子雨落入漏斗、逐层被筛向两侧喷出，漏斗分层弹出、数值标签右侧滑入", energy: 2 },
  desc: "发光漏斗，粒子逐层流下，每层标数值（播放→点击→加微信→成交）",
  use: "转化漏斗、层层递减的数量",
  schema,
  example: { title: "10 万播放，最后剩下多少客户", stages: [{ label: "播放", value: "10万" }, { label: "点进主页", value: "3000" }, { label: "加微信", value: "200" }, { label: "成交", value: "18" }] },
  C,
};
