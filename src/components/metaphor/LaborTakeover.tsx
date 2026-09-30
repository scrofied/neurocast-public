import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { GlowDefs, Heading, fitFont, textEm } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  jobs: z.array(z.string()).min(2).max(6).default(["写周报", "做报表", "审合同"]).describe("被一件件接管的任务（人头顶的卡片）"),
  workerLabel: z.string().default("人工 · 1 件/小时").describe("左侧人排下方的标注"),
  aiLabel: z.string().default("AI").describe("右侧核心的标注"),
  rate: z.string().default("10x").describe("吞吐爆发后显示的倍数"),
  stamp: z.string().default("被替代").describe("最后砸下去的强调字"),
  aiAt: z.number().optional().describe("AI 核心点亮的时刻（锚点，如“AI”）"),
  takeAt: z.number().optional().describe("第一件活被抽走（锚点）"),
  lastAt: z.number().optional().describe("最后一件活被抽走（锚点）"),
  speedAt: z.number().optional().describe("吞吐爆发、数字滚动（锚点，如“十倍”）"),
  stampAt: z.number().optional().describe("砸章时刻（锚点，如“替代”）"),
});
type D = z.infer<typeof schema>;

// workers in a row; an AI core wakes up on the right and takes each job chip, one by one —
// the chip flies over and gets absorbed, the worker goes grey and slouches; then throughput
// explodes (counter rolls), and a stamp drops
const C: React.FC<CompProps<D>> = ({ data, frame }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const jobs = data.jobs;
  const n = jobs.length;
  const aiAt = cueOr(data.aiAt, 16);
  const takeAt = cueOr(data.takeAt, aiAt + 22);
  const lastAt = cueOr(data.lastAt, takeAt + (n - 1) * 26);
  const speedAt = cueOr(data.speedAt, lastAt + 24);
  const stampAt = cueOr(data.stampAt, speedAt + 46);
  const cues = listCues(jobs.map(() => ({})), takeAt, lastAt);

  const BY = H * 0.72; // ground line of the worker row
  const xL = W * 0.09;
  const xR = W * 0.48;
  const wx = jobs.map((_, i) => xL + ((xR - xL) * (i + 0.5)) / n);
  const chipY = BY - 236;
  const CX = W * 0.755;
  const CY = H * 0.5;
  const R = 148;

  const coreIn = easeOutBack(prog(frame, aiAt - 8, 16));
  const flash = Math.max(0, ...cues.map((c) => (frame >= c + 16 ? 1 - (frame - c - 16) / 10 : 0))); // pulse on each absorption
  const rot = 2 * frame + (frame > speedAt ? (frame - speedAt) * (frame - speedAt) * 0.45 : 0);
  const boost = easeOut(prog(frame, speedAt, 20));
  const doneCount = jobs.length + Math.max(0, Math.floor((frame - speedAt) * 0.9 * jobs.length));
  const stampScale = frame >= stampAt ? 2 - easeOut(prog(frame, stampAt, 7)) : 2;
  const anyTaken = frame >= cues[0] + 16;

  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="lt" std={7} />
        {/* ground */}
        <line x1={xL - 60} y1={BY} x2={xR + 60} y2={BY} stroke={alpha(t.dim, 0.5)} strokeWidth={3} />
        {/* worker silhouettes */}
        {jobs.map((_, i) => {
          const g = easeOut(prog(frame, cues[i] + 16, 10)); // taken → grey
          const col = g > 0.5 ? alpha(t.dim, 0.45) : t.text;
          const droop = g * 10;
          return (
            <g key={i} transform={`translate(${wx[i]}, ${BY})`}>
              <path d="M -58 0 Q -58 -78 0 -78 Q 58 -78 58 0 Z" fill={alpha(g > 0.5 ? t.dim : t.primary, 0.18)} stroke={col} strokeWidth={4} />
              <circle cx={0} cy={-112 + droop} r={34} fill={alpha(g > 0.5 ? t.dim : t.primary, 0.18)} stroke={col} strokeWidth={4} />
              {g > 0.6 && (
                <g opacity={clamp((g - 0.6) * 3)} stroke={t.bad} strokeWidth={7} strokeLinecap="round">
                  <line x1={-15} y1={-190 + droop} x2={15} y2={-160 + droop} />
                  <line x1={15} y1={-190 + droop} x2={-15} y2={-160 + droop} />
                </g>
              )}
            </g>
          );
        })}
        {/* empty chip slots above workers */}
        {jobs.map((_, i) => {
          const g = easeOut(prog(frame, cues[i] + 16, 10));
          return g > 0.3 ? <rect key={i} x={wx[i] - 74} y={chipY - 34} width={148} height={68} rx={14} fill="none" stroke={alpha(t.dim, 0.35 * g)} strokeWidth={3} strokeDasharray="10 10" /> : null;
        })}
        {/* AI core */}
        {frame >= aiAt - 8 && (
          <g transform={`translate(${CX}, ${CY}) scale(${coreIn})`}>
            <g transform={`rotate(${rot})`}>
              <circle r={R + 52} fill="none" stroke={alpha(t.primary, 0.6)} strokeWidth={4} strokeDasharray="26 34" filter="url(#lt)" />
            </g>
            <circle r={R + 52 + flash * 46} fill="none" stroke={alpha(t.accent, 0.7 - flash * 0.5)} strokeWidth={6} />
            <circle r={R} fill={alpha(t.bg2, 0.92)} stroke={t.primary} strokeWidth={5} filter="url(#lt)" />
            <circle r={R} fill={alpha(t.primary, 0.06 + flash * 0.22)} />
            {/* hexagon inside */}
            <polygon
              points={new Array(6).fill(0).map((_, i) => { const a = (Math.PI / 3) * i - Math.PI / 6; return `${Math.cos(a) * 88},${Math.sin(a) * 88}`; }).join(" ")}
              fill="none"
              stroke={alpha(t.secondary, 0.8)}
              strokeWidth={4}
            />
          </g>
        )}
        {/* beams from taken chips into the core */}
        {cues.map((c, i) => {
          const p = easeInOut(prog(frame, c, 16));
          if (p <= 0 || p >= 1) return null;
          const x = wx[i] + (CX - wx[i]) * p;
          const y = chipY + (CY - chipY) * p - Math.sin(p * Math.PI) * 130;
          return <circle key={i} cx={x} cy={y} r={16} fill={t.accent} filter="url(#lt)" opacity={1 - p * 0.3} />;
        })}
      </svg>

      {/* job chips (HTML, on top of svg) */}
      {jobs.map((j, i) => {
        const p = easeInOut(prog(frame, cues[i], 16));
        const taken = p >= 1;
        if (taken && frame > cues[i] + 22) return null;
        const x = wx[i] + (CX - wx[i]) * p;
        const y = chipY + (CY - chipY) * p - Math.sin(p * Math.PI) * 130;
        const cw = textEm(j) * 34 + 46;
        const scale = 1 - p * 0.45;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - (p > 0 ? cw * scale : cw) / 2,
              top: y - 34,
              width: cw * scale > 1 ? cw : cw * scale,
              height: 68,
              borderRadius: 14,
              background: p > 0 ? alpha(t.accent, 0.2) : alpha(t.bg2, 0.9),
              border: `2.5px solid ${p > 0 ? t.accent : t.primary}`,
              boxShadow: p > 0 ? `0 0 ${18 + p * 30}px ${alpha(t.accent, 0.7)}` : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: t.font.body,
              fontWeight: 800,
              fontSize: fitFont(j, cw - 20, 34, 22),
              color: t.text,
              whiteSpace: "nowrap",
              transform: `scale(${scale})`,
              transformOrigin: "center",
              opacity: taken ? 1 - (frame - cues[i] - 16) / 6 : 1,
            }}
          >
            {j}
          </div>
        );
      })}

      {/* labels */}
      <div style={{ position: "absolute", left: xL - 40, top: BY + 30, fontFamily: t.font.mono, fontSize: 26, letterSpacing: 2, color: t.dim, opacity: easeOut(prog(frame, 8, 12)), transition: "none" }}>
        <span style={{ color: anyTaken ? t.bad : t.dim }}>{data.workerLabel}</span>
      </div>
      {frame >= aiAt && (
        <div style={{ position: "absolute", left: CX - 160, width: 320, top: CY + R + 90, textAlign: "center", opacity: clamp(coreIn * 1.4) }}>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 40, color: t.primary, letterSpacing: 4 }}>{data.aiLabel}</div>
          {boost > 0.01 && (
            <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 24px", borderRadius: 30, background: alpha(t.bg2, 0.85), border: `2px solid ${t.accent}`, boxShadow: `0 0 30px ${alpha(t.accent, 0.4)}`, transform: `scale(${0.8 + 0.2 * boost})` }}>
              <Icon name="zap" size={30} color={t.accent} stroke={2.6} />
              <span style={{ fontFamily: t.font.mono, fontWeight: 800, fontSize: 34, color: t.accent }}>{data.rate}</span>
            </div>
          )}
        </div>
      )}
      {/* throughput counter */}
      {frame >= speedAt && (
        <div style={{ position: "absolute", right: W * 0.06, top: H * 0.16, textAlign: "right", opacity: boost, transform: `translateY(${(1 - boost) * 30}px)` }}>
          <div style={{ fontFamily: t.font.mono, fontSize: 24, letterSpacing: 3, color: t.dim }}>TASKS DONE</div>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 96, color: t.accent, textShadow: `0 0 26px ${alpha(t.accent, 0.6)}` }}>{doneCount}</div>
        </div>
      )}
      {/* stamp */}
      {frame >= stampAt && (
        <div
          style={{
            position: "absolute",
            left: xL - 40,
            top: H * 0.27,
            width: 560,
            textAlign: "center",
            transform: `rotate(-6deg) scale(${stampScale})`,
            padding: "12px 0",
            border: `7px solid ${t.accent}`,
            borderRadius: 18,
            background: "rgba(0,0,0,.45)",
            fontFamily: t.font.title,
            fontWeight: 900,
            fontSize: fitFont(data.stamp, 480, 96, 48),
            color: t.accent,
            whiteSpace: "nowrap",
            textShadow: `0 0 24px ${alpha(t.accent, 0.6)}`,
            WebkitTextStroke: "4px #000",
            paintOrder: "stroke fill",
          }}
        >
          {data.stamp}
        </div>
      )}
      <Heading kicker={data.kicker ?? "DISPLACEMENT"} title={data.title} frame={frame} width={W} />

      <Sfx name="whoosh" at={aiAt} volume={0.3} />
      <Sfx name="ding" at={aiAt + 4} volume={0.28} />
      {cues.map((c, i) => (
        <Sfx key={i} name="pop" at={c + 16} volume={0.3} />
      ))}
      <Sfx name="glitch" at={lastAt + 18} volume={0.25} />
      <Sfx name="riser" at={Math.max(0, speedAt - 40)} volume={0.22} />
      <Sfx name="success" at={speedAt} volume={0.35} />
      <Sfx name="stamp" at={stampAt + 2} volume={0.45} />
    </>
  );
};

export const LaborTakeover: CompDef<D> = {
  id: "labor-takeover",
  name: "AI 一件件接管人的活（劳动力被替代）",
  layer: "metaphor",
  variants: 1,
  minSec: 5,
  maxSec: 16,
  tags: ["替代", "接管", "裁员", "自动化", "产能", "人工", "失业", "效率碾压"],
  desc: "一排打工人头顶各自的任务卡，右侧 AI 核心点亮后把任务卡一张张抽走（人变灰低头打✕），最后 AI 吞吐爆发数字狂跳，砸下结论章",
  use: "AI 正在替代/接管某种人力工作、人的活被 AI 一件件拿走、产能被碾压式反超；也可换成「旧工具被新方案逐个替代」「外包流程被自动化接管」等 A 被 B 替代的叙事（jobs / workerLabel / rate / stamp 全走参数）",
  schema,
  example: { title: "AI 正在接管这些活", jobs: ["写周报", "做报表", "审合同"], aiAt: 12, takeAt: 34, lastAt: 96, speedAt: 122, stampAt: 170 },
  C,
};
