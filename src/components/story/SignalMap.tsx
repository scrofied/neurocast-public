import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, prog, rng } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fmtNum, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  count: z.object({ value: z.number(), suffix: z.string().optional(), label: z.string().optional() }).optional().describe("计数器，如 10000+ 真实的人"),
  signals: z.array(z.string()).min(3).max(10).describe("冒出来的求助/需求原话"),
  label: z.string().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const cx = width / 2;
  const cy = height / 2 + 60;
  const nodes = useMemo(() => {
    const r = rng(seed + 29);
    return new Array(150).fill(0).map(() => {
      // points on a sphere
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return { x: s * Math.cos(th), y: u * 0.62, z: s * Math.sin(th), ph: r() * 200, big: r() < 0.12 };
    });
  }, [seed]);
  const rot = frame * 0.006;
  const R = 520;
  const proj = nodes.map((n) => {
    const x = n.x * Math.cos(rot) - n.z * Math.sin(rot);
    const z = n.x * Math.sin(rot) + n.z * Math.cos(rot);
    const s = 1 / (1.7 - z * 0.7);
    return { sx: cx + x * R * s, sy: cy + n.y * R * s, z, s };
  });
  const links = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
        if (d < 0.06) out.push([i, j]);
      }
    return out;
  }, [nodes]);
  const sigs = data.signals;
  const sigNodes = sigs.map((_, i) => (i * 37 + 11) % nodes.length);
  const period = Math.max(24, (dur - 20) / sigs.length);
  const count = data.count ? Math.round(data.count.value * easeOut(prog(frame, 6, Math.min(80, dur * 0.7)))) : 0;
  return (
    <>
      <Heading kicker={data.kicker ?? "REAL SIGNALS"} title={data.title} frame={frame} width={width} />
      <div style={{ position: "absolute", left: cx - R * 0.72, top: cy - R * 0.62, width: R * 1.44, height: R * 1.24, borderRadius: "50%", background: `radial-gradient(ellipse at 50% 50%, ${alpha(t.primary, 0.14)}, ${alpha(t.secondary, 0.06)} 55%, transparent 72%)`, opacity: easeOut(prog(frame, 0, 20)) }} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {links.map(([a, b], i) => {
          const pa = proj[a];
          const pb = proj[b];
          const vis = clamp((pa.z + pb.z) / 2 + 0.6);
          return <line key={i} x1={pa.sx} y1={pa.sy} x2={pb.sx} y2={pb.sy} stroke={t.primary} strokeOpacity={0.24 * vis * easeOut(prog(frame, 0, 20))} strokeWidth={1.3} />;
        })}
        {proj.map((p, i) => {
          const n = nodes[i];
          const blink = ((frame + n.ph) % 90) / 90;
          const pulse = blink < 0.3 && p.z > -0.2;
          return (
            <g key={i}>
              <circle cx={p.sx} cy={p.sy} r={(n.big ? 5.5 : 3.4) * p.s * 1.6} fill={pulse ? t.accent : t.primary} opacity={0.45 + 0.55 * clamp(p.z + 0.8)} />
              {pulse && frame > 10 && <circle cx={p.sx} cy={p.sy} r={6 + blink * 60 * p.s} fill="none" stroke={t.accent} strokeWidth={2} opacity={(1 - blink / 0.3) * 0.7} />}
            </g>
          );
        })}
      </svg>
      {sigs.map((s, i) => {
        const at = 10 + i * period;
        const life = frame - at;
        if (life < 0) return null;
        const p = proj[sigNodes[i]];
        const q = easeOutBack(prog(frame, at, 14));
        const fade = 1 - clamp((life - period * 2.2) / 20);
        if (fade <= 0) return null;
        const left = p.sx > cx;
        return (
          <div key={i} style={{ position: "absolute", left: p.sx + (left ? 24 : -24), top: p.sy - 30, transform: `translate(${left ? 0 : -100}%, -50%) scale(${q})`, transformOrigin: left ? "left center" : "right center", opacity: fade, padding: "10px 20px", borderRadius: 16, background: alpha(t.bg2, 0.92), border: `2px solid ${alpha(t.accent, 0.8)}`, boxShadow: `0 0 26px ${alpha(t.accent, 0.35)}`, display: "flex", alignItems: "center", gap: 10, fontFamily: t.font.body, fontWeight: 800, fontSize: 30, color: t.text, whiteSpace: "nowrap" }}>
            <Icon name="help" size={28} color={t.accent} />
            {s}
            <Sfx name="pop" at={at} volume={0.22} />
          </div>
        );
      })}
      {data.count && (
        <div style={{ position: "absolute", left: 120, top: 220, opacity: easeOut(prog(frame, 4, 14)) }}>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 96, color: t.text, textShadow: `0 0 40px ${alpha(t.accent, 0.5)}` }}>
            {fmtNum(count, 0)}
            <span style={{ color: t.accent }}>{data.count.suffix ?? "+"}</span>
          </div>
          {data.count.label && <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 32, color: t.dim, display: "flex", alignItems: "center", gap: 10 }}><Icon name="signal" size={30} color={t.accent} />{data.count.label}</div>}
        </div>
      )}
      {data.label && <div style={{ position: "absolute", right: 120, top: 240, fontFamily: t.font.mono, fontSize: 26, letterSpacing: 8, color: t.accent, opacity: easeOut(prog(frame, 20, 14)) }}>{data.label}</div>}
    </>
  );
};

export const SignalMap: CompDef<D> = {
  id: "signal-map",
  name: "需求信号地图",
  layer: "story",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["成千上万", "真实的人", "呼救", "需求", "信号", "用户"],
  desc: "一颗缓慢旋转的网络星球，节点不断亮起脉冲，求助原话（“求新手教程”“为什么我没流量”）从节点弹出，左上计数器滚动",
  use: "大量信号散落各处、到处都在发生：用户的需求原话、各地的订单、全网的讨论、各城市的求职者（signals 换成任何原话）",
  schema,
  example: { count: { value: 10000, suffix: "+", label: "条真实的呼救信号" }, signals: ["求新手教程", "为什么我没流量？", "有没有人教教我", "剪辑太难了", "起号卡住了"] },
  C,
};
