import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, noise1, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  nodes: z.array(z.string()).length(2).describe("正确顺序：[先, 后]，如 [\"市场需求\", \"产品\"]"),
  steps: z.array(z.string()).length(2).default(["先有", "再做"]),
  note: z.string().optional().describe("翻转前的说明，如“生意的逻辑”"),
  flipAt: z.number().optional().describe("翻转时刻（锚点，如“倒过来”）"),
  flipNote: z.string().optional().describe("翻转后红字，如“很多博主 · 倒过来了”"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: bw, height: bh } = useBox();
  const full = bw >= 900;
  const flipAt = cueOr(data.flipAt, dur * 0.6);
  const fp = easeInOut(prog(frame, flipAt, 20));
  const flipped = frame >= flipAt + 10;
  const shake = frame >= flipAt && frame < flipAt + 14 ? noise1(frame * 3.3, seed) * 12 * (1 - (frame - flipAt) / 14) : 0;
  // layout: vertical in narrow panels, horizontal full-screen
  const vertical = !full;
  const cx = bw / 2;
  const cy = full ? bh / 2 + 50 : bh / 2 + 10;
  const span = vertical ? Math.min(bh * 0.52, 420) : Math.min(bw * 0.42, 820);
  const r = vertical ? Math.min(bw * 0.3, 96) : 150;
  const A = { x: vertical ? cx : cx - span / 2, y: vertical ? cy - span / 2 : cy };
  const B = { x: vertical ? cx : cx + span / 2, y: vertical ? cy + span / 2 : cy };
  // nodes orbit around the midpoint while swapping
  const ang = Math.PI * fp;
  const rot = (p: { x: number; y: number }, s: number) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const c = Math.cos(ang * s);
    const si = Math.sin(ang * s);
    const depth = vertical ? 0.55 : 0.45;
    return { x: cx + dx * c - dy * si * depth, y: cy + dx * si * depth + dy * c };
  };
  const pa = rot(A, 1);
  const pb = rot(B, 1);
  const col = flipped ? t.bad : t.primary;
  const inA = easeOutBack(prog(frame, 4, 18));
  const inB = easeOutBack(prog(frame, 14, 18));
  const arrowP = easeOut(prog(frame, 22, 16));
  const node = (p: { x: number; y: number }, label: string, step: string, k: number, lead: boolean) => {
    const fs = fitFont(label, r * 1.6, vertical ? 34 : 50, 16);
    return (
      <div style={{ position: "absolute", left: p.x - r + shake, top: p.y - r, width: r * 2, height: r * 2, transform: `scale(${k})` }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle at 40% 35%, ${alpha(lead ? col : t.secondary, 0.35)}, ${alpha(t.bg2, 0.95)} 70%)`,
            border: `3px solid ${alpha(lead ? col : t.secondary, 0.9)}`,
            boxShadow: `0 0 40px ${alpha(lead ? col : t.secondary, 0.45)}`,
          }}
        />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, textAlign: "center", lineHeight: 1.15, padding: 10 }}>{label}</div>
        <div style={{ position: "absolute", left: "50%", top: -8, transform: "translate(-50%,-100%)", fontFamily: t.font.mono, fontSize: vertical ? 15 : 20, letterSpacing: 3, color: alpha(t.text, 0.7), whiteSpace: "nowrap", opacity: 1 - fp }}>{step}</div>
      </div>
    );
  };
  // arrow from the node currently in "first" position to the other
  const first = flipped ? pb : pa;
  const second = flipped ? pa : pb;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ax1 = first.x + ux * (r + 14);
  const ay1 = first.y + uy * (r + 14);
  const ax2 = second.x - ux * (r + 22);
  const ay2 = second.y - uy * (r + 22);
  const midFade = 1 - Math.sin(Math.PI * fp) * 0.95;
  const tip = { x: ax1 + (ax2 - ax1) * arrowP, y: ay1 + (ay2 - ay1) * arrowP };
  const head = 18;
  const xMark = easeOutBack(prog(frame, flipAt + 12, 14));
  return (
    <>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={bw} />
      <svg width={bw} height={bh} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <GlowDefs id="lf" std={6} user />
        <g opacity={midFade}>
          <line x1={ax1 + shake} y1={ay1} x2={tip.x + shake} y2={tip.y} stroke={col} strokeWidth={5} strokeLinecap="round" filter="url(#lf)" />
          {arrowP > 0.9 && (
            <polygon
              points={`${tip.x + ux * 6 + shake},${tip.y + uy * 6} ${tip.x - ux * head - uy * head * 0.6 + shake},${tip.y - uy * head + ux * head * 0.6} ${tip.x - ux * head + uy * head * 0.6 + shake},${tip.y - uy * head - ux * head * 0.6}`}
              fill={col}
              filter="url(#lf)"
            />
          )}
          {!flipped &&
            [0, 1, 2].map((k) => {
              const q = ((frame / 28 + k / 3) % 1) * arrowP;
              return <circle key={k} cx={ax1 + (ax2 - ax1) * q} cy={ay1 + (ay2 - ay1) * q} r={5} fill={t.text} opacity={0.8 * (1 - q)} />;
            })}
        </g>
      </svg>
      {node(pa, data.nodes[0], data.steps[0], inA, !flipped)}
      {node(pb, data.nodes[1], data.steps[1], inB, flipped)}
      {flipped && (
        <div style={{ position: "absolute", left: (ax1 + ax2) / 2 - 34 + shake, top: (ay1 + ay2) / 2 - 34, width: 68, height: 68, borderRadius: "50%", background: t.bad, boxShadow: `0 0 30px ${t.bad}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${xMark})` }}>
          <Icon name="x" size={40} color="#fff" stroke={3.4} />
        </div>
      )}
      {data.note && !flipped && (
        <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? cy + span / 2 + r + 26 : cy + r + 60, textAlign: "center", fontFamily: t.font.body, fontWeight: 700, fontSize: vertical ? 22 : 34, color: t.dim, opacity: easeOut(prog(frame, 26, 14)) * (1 - fp) }}>{data.note}</div>
      )}
      {data.flipNote && flipped && (
        <div style={{ position: "absolute", left: 0, right: 0, top: vertical ? cy + span / 2 + r + 22 : cy + r + 56, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: vertical ? 28 : 46, color: t.bad, textShadow: `0 0 20px ${alpha(t.bad, 0.6)}`, opacity: easeOut(prog(frame, flipAt + 14, 12)) }}>
          {data.flipNote}
        </div>
      )}
      <Sfx name="glitch" at={flipAt} volume={0.35} />
      <Sfx name="impact" at={flipAt + 12} volume={0.3} />
    </>
  );
};

export const LogicFlip: CompDef<D> = {
  id: "logic-flip",
  name: "逻辑倒置（先后顺序翻转）",
  layer: "info",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["倒过来", "搞反了", "本末倒置", "顺序", "先…再…"],
  desc: "两个发光节点 A→B 表示正确顺序，说到“倒过来”时两个节点绕中心互换位置，箭头变红、打叉，下方红字点题",
  use: "“先有 A 再有 B，但很多人反过来了”这类顺序被搞反、因果倒置的论述",
  panel: true,
  schema,
  example: { nodes: ["市场需求", "产品"], steps: ["先有", "再做"], note: "做生意的逻辑", flipAt: 90, flipNote: "很多博主 · 倒过来了" },
  C,
};
