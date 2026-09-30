import React, { useMemo } from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { easeOut, noise1, project, prog, rng, rotX, rotY } from "../../lib/anim";
import { alpha, useTheme } from "../../lib/theme";
import { GlowDefs, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({ title: z.string().optional(), kicker: z.string().optional(), input: z.string().optional(), output: z.string().optional() });
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const { width, height } = useVideoConfig();
  const layers = variant === 1 ? [4, 7, 9, 7, 3] : [5, 8, 8, 4];
  const nodes = useMemo(() => {
    const r = rng(seed + 11);
    const out: { x: number; y: number; z: number; l: number }[] = [];
    layers.forEach((n, li) => {
      for (let i = 0; i < n; i++) {
        out.push({ x: (li - (layers.length - 1) / 2) * (layers.length > 4 ? 290 : 340), y: (i - (n - 1) / 2) * 92, z: (r() - 0.5) * 180, l: li });
      }
    });
    return out;
  }, [seed, variant]);
  const edges = useMemo(() => {
    const e: [number, number][] = [];
    const r = rng(seed + 5);
    for (let a = 0; a < nodes.length; a++)
      for (let b = 0; b < nodes.length; b++) if (nodes[b].l === nodes[a].l + 1 && r() < 0.62) e.push([a, b]);
    return e;
  }, [nodes]);

  const cx = width / 2 + (variant === 2 ? 180 : 0);
  const cy = height / 2 + 50;
  const ang = -0.5 + frame * 0.006 + (variant === 2 ? 0.4 : 0);
  const tilt = 0.18 + noise1(frame / 100, seed) * 0.05;
  const P = nodes.map((n) => project(rotX(rotY(n, ang), tilt), cx, cy, 1150, 1100));
  const build = easeOut(prog(frame, 4, 40));
  const wave = (frame / 26) % (layers.length + 1.5);
  const inTxt = data.input ?? "INPUT";
  const outTxt = data.output ?? "OUTPUT";

  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="nng" std={5} />
        {edges.map(([a, b], i) => {
          const pa = P[a];
          const pb = P[b];
          const la = nodes[a].l;
          const vis = build * (la < build * layers.length ? 1 : 0);
          const active = Math.max(0, 1 - Math.abs(wave - la - 0.5) * 1.6);
          return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={active > 0.2 ? t.primary : t.dim} strokeOpacity={vis * (0.28 + active * 0.6)} strokeWidth={1.4 + active * 2} />;
        })}
        {edges.map(([a, b], i) => {
          const la = nodes[a].l;
          const k = wave - la;
          if (k < 0 || k > 1 || i % 2) return null;
          const pa = P[a];
          const pb = P[b];
          const x = pa.x + (pb.x - pa.x) * k;
          const y = pa.y + (pb.y - pa.y) * k;
          return <circle key={"p" + i} cx={x} cy={y} r={5.5} fill={t.accent} filter="url(#nng)" />;
        })}
        {P.map((p, i) => {
          const n = nodes[i];
          const on = Math.max(0, 1 - Math.abs(wave - n.l) * 1.3);
          const appear = easeOut(prog(frame, 4 + n.l * 7 + (i % 5), 16));
          const r = (12 + on * 8) * p.s;
          return (
            <g key={i} opacity={appear}>
              <circle cx={p.x} cy={p.y} r={r * 2.4} fill={alpha(t.primary, 0.08 + on * 0.25)} />
              <circle cx={p.x} cy={p.y} r={r} fill={on > 0.3 ? t.primary : t.bg2} stroke={t.primary} strokeWidth={1.5} filter={on > 0.3 ? "url(#nng)" : undefined} />
            </g>
          );
        })}
      </svg>
      {(() => {
        const first = P.filter((_, i) => nodes[i].l === 0);
        const last = P.filter((_, i) => nodes[i].l === layers.length - 1);
        const fx = Math.min(...first.map((p) => p.x)) - 60;
        const lx = Math.max(...last.map((p) => p.x)) + 60;
        const pin = easeOut(prog(frame, 10, 20));
        const pout = easeOut(prog(frame, 50, 20));
        return (
          <>
            <div style={{ position: "absolute", left: fx - 260, top: cy - 30, width: 240, textAlign: "right", fontFamily: t.font.mono, fontSize: 26, color: t.text, opacity: pin }}>
              <div style={{ fontSize: 14, color: t.dim, letterSpacing: 4 }}>INPUT</div>
              {inTxt}
            </div>
            <div style={{ position: "absolute", left: lx + 20, top: cy - 30, width: 300, fontFamily: t.font.mono, fontSize: 26, color: t.accent, opacity: pout, textShadow: `0 0 18px ${alpha(t.accent, 0.6)}` }}>
              <div style={{ fontSize: 14, color: t.dim, letterSpacing: 4 }}>OUTPUT</div>
              {outTxt}
            </div>
          </>
        );
      })()}
      <Headline kicker={data.kicker ?? "NEURAL NETWORK"} title={data.title} frame={frame} />
    </>
  );
};

export const NeuralNet: CompDef<D> = {
  id: "neural",
  name: "神经网络信号流",
  layer: "metaphor",
  variants: 3,
  minSec: 4,
  maxSec: 10,
  tags: ["模型", "大模型", "神经网络", "AI", "训练", "推理", "参数", "LLM", "GPT", "深度学习"],
  desc: "多层神经网络，信号从输入（你的问题）逐层点亮传到输出（答案）",
  use: "解释大模型/神经网络怎么工作；不要只因为出现“AI”两个字就用",
  schema,
  example: { title: "大模型是怎么思考的", input: "你的问题", output: "答案" },
  C,
};
