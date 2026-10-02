import React, { useLayoutEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, noise1, prog, rng } from "../../lib/anim";
import { sampleText } from "../../lib/particles";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fmtNum, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  value: z.number(),
  unit: z.string().optional(),
  prefix: z.string().optional(),
  label: z.string().optional(),
  kicker: z.string().optional(),
  decimals: z.number().int().min(0).max(3).optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const dec = data.decimals ?? (Number.isInteger(data.value) ? 0 : 1);
  const finalStr = `${data.prefix ?? ""}${fmtNum(data.value, dec)}${data.unit ?? ""}`;
  const fontSize = Math.min(300, 1500 / Math.max(2, Array.from(finalStr).length * 0.62));
  const targets = useMemo(() => sampleText(finalStr, t.font.title, fontSize, 2600, 5), [finalStr, fontSize, t.font.title]);
  const seeds = useMemo(() => {
    const r = rng(seed + 77);
    return targets.map(() => ({ a: r() * Math.PI * 2, d: 500 + r() * 900, delay: r() * 22, sz: 1.2 + r() * 2.2, c: r() }));
  }, [targets, seed]);

  const cx = width / 2;
  const cy = height / 2 + 40;
  const gather = 38;
  const count = easeOut(prog(frame, 0, gather + 6));
  const shown = data.value * count;
  const settled = prog(frame, gather + 4, 12);
  // 粒子旋入凝聚是组件的身份证，不接 motion（换掉就没特色了）；
  // 接的是它身后的「数字落定」与「说明文字」，这两处分镜可控
  const eNum = enterAt(frame, gather + 4, { fallback: "rise", dur: 12 });
  const eLabel = enterAt(frame, gather, { fallback: "rise", dur: 16 });

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < targets.length; i++) {
      const s = seeds[i];
      const p = easeInOut(prog(frame, s.delay, gather - 6));
      const swirl = (1 - p) * 2.2;
      const sx = cx + Math.cos(s.a + swirl) * s.d;
      const sy = cy + Math.sin(s.a + swirl) * s.d * 0.6;
      const jitter = settled > 0 ? noise1(frame / 20 + i, seed) * 1.2 : 0;
      const x = sx + (cx + targets[i].x - sx) * p + jitter;
      const y = sy + (cy + targets[i].y - sy) * p;
      const col = s.c < 0.7 ? t.primary : s.c < 0.9 ? t.text : t.accent;
      ctx.fillStyle = alpha(col, 0.35 + p * 0.6);
      const r = s.sz * (1 + (1 - p) * 0.8);
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
  }, [frame, targets, seeds, width, height, t]);

  const solid = clamp(settled);
  return (
    <>
      {variant === 1 && (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={cx} cy={cy} r={260 + i * 70 + Math.sin(frame / 20 + i) * 6} fill="none" stroke={t.primary} strokeOpacity={0.12 + solid * 0.1} strokeDasharray={`${4 + i * 4} ${12 + i * 6}`} transform={`rotate(${frame * (i % 2 ? -0.4 : 0.3)} ${cx} ${cy})`} />
          ))}
        </svg>
      )}
      <canvas ref={ref} width={width} height={height} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy - fontSize * 0.65,
          height: fontSize * 1.3,
          lineHeight: `${fontSize * 1.3}px`,
          textAlign: "center",
          fontFamily: t.font.title,
          fontWeight: 900,
          fontSize,
          color: t.text,
          opacity: eNum.opacity * 0.92,
          textShadow: `0 0 40px ${alpha(t.primary, 0.7)}, 0 0 90px ${alpha(t.primary, 0.35)}`,
          letterSpacing: 0,
          whiteSpace: "nowrap",
        }}
      >
        {`${data.prefix ?? ""}${fmtNum(solid < 1 ? shown : data.value, dec)}${data.unit ?? ""}`}
      </div>
      {data.label && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: cy + fontSize * 0.7 + 10,
            textAlign: "center",
            fontFamily: t.font.body,
            fontSize: 40,
            fontWeight: 700,
            color: t.dim,
            opacity: eLabel.opacity,
            transform: `translate(${eLabel.dx}px, ${eLabel.dy}px)`,
            letterSpacing: 4,
          }}
        >
          {data.label}
        </div>
      )}
      <Headline kicker={data.kicker ?? "KEY METRIC"} frame={frame} />
    </>
  );
};

export const ParticleNumber: CompDef<D> = {
  id: "number",
  name: "粒子凝聚数字",
  layer: "info",
  variants: 2,
  minSec: 3,
  maxSec: 7,
  tags: ["数字", "百分比", "倍", "万", "亿", "增长", "提升", "数据"],
  motion: { kind: "粒子旋入凝聚 + 数值滚动", energy: 2 },
  desc: "几千个粒子从四周旋入凝聚成一个大数字，数值滚动到位，下方说明",
  use: "单个关键数字 / 百分比 / 倍数（多个同单位数值用 growth）",
  schema,
  example: { value: 87, unit: "%", label: "的重复工作可以交给 AI" },
  C,
};
