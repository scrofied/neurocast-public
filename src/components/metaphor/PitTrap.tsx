import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Figure, gait, mixPose, POSES } from "../../lib/figure";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  pits: z
    .array(z.object({ text: z.string().describe("坑名，刻在陷阱盖上"), result: z.string().optional().describe("掉下去的后果，如“白干三个月”"), at: z.number().optional().describe("这个坑翻开的时刻（锚点，卡坑名）") }))
    .min(1)
    .max(4),
  victim: z.boolean().default(true).describe("第一个坑有人掉下去（演一遍“踩坑”）"),
  safeLine: z.string().optional().describe("绕开所有坑的正确走法，如“先验证再投入”"),
  safeAt: z.number().optional().describe("安全路线亮起的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

// a perspective road running from the bottom of the frame to a vanishing point; pits sit on it
// in depth order. Road coordinates: u in [-1,1] across, v in [0,1] from near to far.
const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.pits.length;
  const vpY = H * 0.26;
  const nearY = H * 1.02;
  const nearHalf = W * (full ? 0.46 : 0.6);
  const farHalf = W * 0.05;
  const proj = (u: number, v: number) => {
    const d = Math.pow(v, 0.8);
    const y = lerp(nearY, vpY, d);
    const half = lerp(nearHalf, farHalf, d);
    return { x: W / 2 + u * half, y, s: half / nearHalf };
  };
  const cues: number[] = [];
  data.pits.forEach((p, i) => cues.push(Math.max(i ? cues[i - 1] + 10 : 8, cueOr(p.at, 14 + i * 30))));
  const safeAt = Math.max(cues[n - 1] + 16, cueOr(data.safeAt, cues[n - 1] + 34));
  // pit layout: alternate sides, receding
  const pits = data.pits.map((p, i) => ({ ...p, u: n === 1 ? 0 : (i % 2 ? 0.36 : -0.36), v: 0.2 + (i / Math.max(1, n)) * 0.62 }));
  // the victim walks up the road into pit 0 — it opens under their feet
  const walkEnd = cues[0] + 4;
  const walkK = easeInOut(prog(frame, 0, Math.max(10, walkEnd)));
  const p0 = pits[0];
  const vv = lerp(0.02, p0.v, walkK);
  const uu = lerp(0, p0.u, walkK);
  const fallK = easeIn(prog(frame, walkEnd, 16));
  const sh = hitShake(frame, cues.map((c) => c + 2), 10, 10, seed);
  // safe path: weave between pits
  const safeK = easeInOut(prog(frame, safeAt, 26));
  const path: { u: number; v: number }[] = [{ u: 0, v: 0 }];
  pits.forEach((p) => path.push({ u: p.u > 0 ? -0.55 : p.u < 0 ? 0.55 : 0.62, v: p.v }));
  path.push({ u: 0, v: 0.98 });
  const pathPts = path.map((q) => proj(q.u, q.v));
  const segLen = pathPts.slice(1).map((q, i) => Math.hypot(q.x - pathPts[i].x, q.y - pathPts[i].y));
  const totalLen = segLen.reduce((a, b) => a + b, 0);
  const d = pathPts.map((q, i) => `${i ? "L" : "M"}${q.x},${q.y}`).join(" ");
  // walker on the safe path (second pass) — their position at safeK
  const along = (k: number) => {
    let L = k * totalLen;
    for (let i = 0; i < segLen.length; i++) {
      if (L <= segLen[i] || i === segLen.length - 1) {
        const f = clamp(L / segLen[i]);
        return { u: lerp(path[i].u, path[i + 1].u, f), v: lerp(path[i].v, path[i + 1].v, f) };
      }
      L -= segLen[i];
    }
    return path[path.length - 1];
  };
  const sw = along(safeK);
  const roadEdges = [-1, 1].map((s) => {
    const a = proj(s, 0);
    const b = proj(s, 1);
    return `M${a.x},${a.y} L${b.x},${b.y}`;
  });
  const dashes = Array.from({ length: 14 }, (_, i) => {
    const v0 = ((i + ((frame * 0.02) % 1)) / 14) as number;
    const a = proj(0, v0);
    const b = proj(0, Math.min(1, v0 + 0.03));
    return { a, b };
  });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="ptRoad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor={alpha(t.primary, 0.22)} />
              <stop offset="1" stopColor={alpha(t.primary, 0.02)} />
            </linearGradient>
            <radialGradient id="ptHole" cx="0.5" cy="0.4" r="0.6">
              <stop offset="0" stopColor="#000" />
              <stop offset="0.8" stopColor="#050505" />
              <stop offset="1" stopColor={alpha(t.bad, 0.6)} />
            </radialGradient>
          </defs>
          <path d={`M${proj(-1, 0).x},${proj(-1, 0).y} L${proj(-1, 1).x},${proj(-1, 1).y} L${proj(1, 1).x},${proj(1, 1).y} L${proj(1, 0).x},${proj(1, 0).y} Z`} fill="url(#ptRoad)" />
          {roadEdges.map((e, i) => (
            <path key={i} d={e} stroke={alpha(t.primary, 0.7)} strokeWidth={4} fill="none" />
          ))}
          {dashes.map((q, i) => (
            <line key={i} x1={q.a.x} y1={q.a.y} x2={q.b.x} y2={q.b.y} stroke={alpha(t.text, 0.25)} strokeWidth={6 * q.a.s} />
          ))}
          {/* pits, far ones first */}
          {[...pits.keys()].reverse().map((i) => {
            const p = pits[i];
            const c = proj(p.u, p.v);
            const rw = 0.26 * nearHalf * c.s * (full ? 1 : 1.2);
            const rh = rw * 0.34;
            const open = easeOut(prog(frame, cues[i], 12));
            // the lid flips up and back like a trapdoor
            const lidK = easeOutBack(prog(frame, cues[i], 14));
            const warn = frame >= cues[i] ? 0.6 + 0.4 * Math.sin((frame - cues[i]) / 4) : 0;
            return (
              <g key={i}>
                <ellipse cx={c.x} cy={c.y} rx={rw * open} ry={rh * open} fill="url(#ptHole)" stroke={alpha(t.bad, warn)} strokeWidth={4} style={{ filter: frame >= cues[i] ? `drop-shadow(0 0 ${14 * warn}px ${t.bad})` : undefined }} />
                {/* lid */}
                <g transform={`translate(${c.x} ${c.y - rh * 0.1}) scale(1 ${lerp(1, -0.9, clamp(lidK))}) translate(0 ${-rh * lidK * 0.9})`}>
                  <ellipse cx={0} cy={0} rx={rw * 1.02} ry={rh * 1.02} fill={alpha(t.bg2, 0.98)} stroke={alpha(t.dim, 0.8)} strokeWidth={3} />
                </g>
              </g>
            );
          })}
          {/* safe line */}
          {frame >= safeAt && <path d={d} fill="none" stroke={t.primary} strokeWidth={full ? 12 : 7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${totalLen * safeK} ${totalLen}`} style={{ filter: `drop-shadow(0 0 12px ${t.primary})` }} />}
          {/* victim */}
          {data.victim && frame < walkEnd + 20 && (() => {
            const c = proj(uu, vv);
            const h = (full ? H * 0.34 : H * 0.28) * c.s;
            const pose = frame < walkEnd ? gait(frame / 14, 0.1) : mixPose(POSES.stand, POSES.fall, clamp(fallK * 2));
            const sinkY = fallK * h * 1.3;
            return (
              <g clipPath={frame >= walkEnd ? "url(#ptClip)" : undefined}>
                <defs>
                  <clipPath id="ptClip">
                    <rect x={0} y={0} width={W} height={proj(p0.u, p0.v).y} />
                  </clipPath>
                </defs>
                <Figure x={c.x} y={c.y + sinkY} h={h} pose={pose} face={1} color={frame >= walkEnd ? t.bad : t.text} glow={t.primary} opacity={1 - fallK * 0.4} />
              </g>
            );
          })()}
          {/* safe walker */}
          {frame >= safeAt && (() => {
            const c = proj(sw.u, sw.v);
            const h = (full ? H * 0.3 : H * 0.24) * c.s;
            return <Figure x={c.x} y={c.y} h={h} pose={gait(frame / 12, 0.25)} face={1} color={t.primary} glow={t.primary} />;
          })()}
        </svg>
        {/* labels on pits */}
        {pits.map((p, i) => {
          const c = proj(p.u, p.v);
          if (frame < cues[i] - 2) return null;
          const k = easeOutBack(prog(frame, cues[i], 14));
          const fs = fitFont(p.text, W * 0.24, (full ? 54 : 26) * Math.max(0.6, c.s * 1.4), 16);
          const side = p.u >= 0 ? 1 : -1;
          const lx = c.x + side * (full ? W * 0.2 : W * 0.18) * Math.max(0.6, c.s * 1.3);
          return (
            <div key={i} style={{ position: "absolute", left: lx, top: c.y, transform: `translate(${side > 0 ? "0" : "-100%"}, -50%) scale(${k})`, transformOrigin: side > 0 ? "0 50%" : "100% 50%", textAlign: side > 0 ? "left" : "right" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 20px", borderRadius: 12, background: alpha(t.bg, 0.85), border: `3px solid ${t.bad}`, boxShadow: `0 0 18px ${alpha(t.bad, 0.5)}` }}>
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs * 0.8, color: t.bad }}>!</span>
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap" }}>{p.text}</span>
              </div>
              {p.result && <div style={{ marginTop: 6, fontFamily: t.font.body, fontWeight: 800, fontSize: fs * 0.55, color: t.bad, whiteSpace: "nowrap", opacity: easeOut(prog(frame, cues[i] + 8, 10)) }}>→ {p.result}</div>}
            </div>
          );
        })}
        {data.safeLine && frame >= safeAt + 10 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: full ? H * 0.12 + 60 : H * 0.1, textAlign: "center", opacity: easeOut(prog(frame, safeAt + 10, 12)) }}>
            <span style={{ display: "inline-block", padding: "10px 34px", borderRadius: 40, background: alpha(t.bg, 0.85), border: `3px solid ${t.primary}`, boxShadow: `0 0 28px ${alpha(t.primary, 0.55)}`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.safeLine, W * 0.7, full ? 56 : 26, 16), color: t.primary, whiteSpace: "nowrap" }}>✓ {data.safeLine}</span>
          </div>
        )}
      </div>
      {cues.map((c, i) => (
        <Sfx key={i} name="stamp" at={c} volume={0.34} />
      ))}
      {data.victim && <Sfx name="whoosh" at={walkEnd} volume={0.3} />}
      <Sfx name="success" at={safeAt + 10} volume={0.32} />
    </>
  );
};

export const PitTrap: CompDef<D> = {
  id: "pit-trap",
  name: "避坑现场（路上的坑 + 安全路线）",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["坑", "踩坑", "避坑", "雷", "排雷", "死穴", "陷阱", "别踩"],
  motion: { kind: "透视路面 · 陷阱盖翻开 · 人掉下去 · 安全线绕行", energy: 2 },
  desc: "一条透视的路伸向远方，一个小人往前走，脚下陷阱盖翻开掉了下去；随后路上其他陷阱盖按配音逐个翻开，旁边挂出坑名和后果；最后一条绿色安全线从脚下亮起、左右绕开所有坑通到远处，一个发光小人沿着它走过去",
  use: "可枚举的 2~4 个坑：最后提醒两个坑、新手最容易踩的三个雷、签合同的隐形死穴、选品的几个陷阱；可带“正确走法”",
  panel: true,
  schema,
  example: { pits: [{ text: "先囤货", result: "压死现金流" }, { text: "只看销量", result: "卷进价格战" }, { text: "不算退货", result: "越卖越亏" }], safeLine: "先小批量测款", victim: true },
  C,
};
