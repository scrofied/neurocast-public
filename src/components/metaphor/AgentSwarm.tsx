import React, { useMemo } from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { easeOut, easeOutBack, noise1, prog, rng } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  center: z.string().optional(),
  agents: z.array(z.string()).max(8).optional(),
});
type D = z.infer<typeof schema>;

const ICONS = ["◆", "▲", "●", "■", "✦", "⬢", "◈", "✚"];

const C: React.FC<CompProps<D>> = ({ data, frame, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const agents = (data.agents && data.agents.length ? data.agents : ["检索", "规划", "编码", "审查", "执行"]).slice(0, 8);
  const n = agents.length;
  const cx = width / 2;
  const cy = height / 2 + 60;
  const R = variant === 1 ? 420 : 390;
  const pos = agents.map((_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + frame * 0.0035 * (variant === 2 ? -1 : 1);
    const ry = variant === 1 ? 0.5 : 0.62;
    return { x: cx + Math.cos(a) * R * 1.35, y: cy + Math.sin(a) * R * ry + noise1(frame / 40 + i, seed) * 10, a };
  });
  const r = useMemo(() => rng(seed + 3), [seed]);
  const pairs = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) out.push([i, (i + 2) % n]);
    return out;
  }, [n]);
  // 核心圆与中心字原生是回弹长大/淡入；环绕、脉冲、能量包是持续动画，保持原生
  const eCore = enterAt(frame, 2, { fallback: "rise", dur: 22, from: 0 });
  const cycle = 36;
  const active = Math.floor(frame / cycle) % n;
  const k = (frame % cycle) / cycle;

  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="ag" std={6} />
        <ellipse cx={cx} cy={cy} rx={R * 1.35} ry={R * 0.6} fill="none" stroke={alpha(t.primary, 0.18)} strokeDasharray="4 10" />
        {pos.map((p, i) => {
          const on = easeOut(prog(frame, 8 + i * 5, 16));
          return <line key={"s" + i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={t.primary} strokeOpacity={0.25 * on} strokeWidth={1.2} strokeDasharray="2 6" strokeDashoffset={-frame * 1.5} />;
        })}
        {variant !== 1 &&
          pairs.map(([a, b], i) => {
            const pa = pos[a];
            const pb = pos[b];
            const on = easeOut(prog(frame, 30 + i * 4, 20));
            return <path key={"c" + i} d={`M${pa.x},${pa.y} Q${cx},${cy - 40} ${pb.x},${pb.y}`} fill="none" stroke={t.secondary} strokeOpacity={0.22 * on} strokeWidth={1} />;
          })}
        {(() => {
          // packet travelling core -> active agent -> core
          const p = pos[active];
          const go = k < 0.5 ? k * 2 : 2 - k * 2;
          const x = cx + (p.x - cx) * go;
          const y = cy + (p.y - cy) * go;
          return <circle cx={x} cy={y} r={7} fill={k < 0.5 ? t.primary : t.accent} filter="url(#ag)" />;
        })()}
        <circle cx={cx} cy={cy} r={100 * eCore.p} fill={alpha(t.primary, 0.16)} stroke={t.primary} strokeWidth={3} filter="url(#ag)" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={cx} cy={cy} r={100 + ((frame * 1.4 + i * 40) % 120)} fill="none" stroke={t.primary} strokeOpacity={0.5 * (1 - ((frame * 1.4 + i * 40) % 120) / 120)} strokeWidth={2} />
        ))}
      </svg>
      {/* 核心圆的半径是 100*eCore.p 长大的（入场即生长），不叠加位移；中心字位置固定，位移接在这里 */}
      <div style={{ position: "absolute", left: cx - 150, top: cy - 30, width: 300, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: 44, color: t.text, opacity: eCore.p, transform: `translate(${eCore.dx}px, ${eCore.dy}px)`, clipPath: eCore.clip, textShadow: `0 0 24px ${t.primary}` }}>
        {data.center ?? "AGENT"}
      </div>
      {pos.map((p, i) => {
        // Agent 节点卡原生逐个回弹弹出（0→1）；轨道位移/脉冲是持续动画，保持原生
        // 卡片的 left/top 来自轨道（不是 e.p 插值），所以入场位移接在 transform 末尾
        const e = enterAt(frame, 8 + i * 5, { fallback: "rise", dur: 18, from: 0, seed: i });
        const isActive = i === active;
        const pulse = isActive ? Math.sin(k * Math.PI) : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x - 115,
              top: p.y - 50,
              width: 230,
              height: 100,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${alpha(isActive ? t.accent : t.primary, 0.18 + pulse * 0.2)}, ${t.glass})`,
              border: `1.5px solid ${alpha(isActive ? t.accent : t.primary, 0.5 + pulse * 0.5)}`,
              boxShadow: `0 0 ${20 + pulse * 40}px ${alpha(isActive ? t.accent : t.primary, 0.25 + pulse * 0.4)}`,
              transform: `scale(${e.scale * (1 + pulse * 0.08)}) translate(${e.dx}px, ${e.dy}px)`,
              clipPath: e.clip,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "0 18px",
              fontFamily: t.font.body,
              color: t.text,
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            <span style={{ color: isActive ? t.accent : t.primary, fontSize: 24 }}>{ICONS[i % ICONS.length]}</span>
            <span style={{ whiteSpace: "nowrap", fontSize: fitFont(agents[i], 160, 34, 18) }}>{agents[i]}</span>
            <span style={{ position: "absolute", right: 10, top: 8, fontFamily: t.font.mono, fontSize: 11, color: t.dim }}>{`#0${i + 1}`}</span>
          </div>
        );
      })}
      <Headline kicker={data.kicker ?? "MULTI-AGENT"} title={data.title} frame={frame} />
    </>
  );
};

export const AgentSwarm: CompDef<D> = {
  id: "agents",
  name: "多 Agent 协作",
  layer: "metaphor",
  variants: 3,
  minSec: 4,
  maxSec: 10,
  tags: ["Agent", "智能体", "协作", "分工", "多个", "团队", "调度", "工作流", "Skill", "插件", "工具"],
  motion: { kind: "核心回弹长大，节点逐个弹入并沿轨道环绕，能量包往返传递", energy: 2 },
  desc: "中心核心 + 环绕的节点（Agent/工具/平台），能量包在核心和节点间往返",
  use: "多个 Agent/工具协作分工；一个东西接入多个平台（center=Skill，agents=平台名）",
  schema,
  example: { title: "一个人指挥一支 AI 团队", center: "你", agents: ["调研", "写稿", "剪辑", "发布"] },
  C,
};
