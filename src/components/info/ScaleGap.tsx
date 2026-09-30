import React from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const boost = z.object({ text: z.string(), at: z.number().optional() });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  big: z.object({ label: z.string(), value: z.string(), at: z.number().optional(), boosts: z.array(boost).max(3).default([]).describe("大号为什么能爆：基础盘、推流…") }),
  small: z.object({ label: z.string(), value: z.string(), at: z.number().optional(), verdict: z.string().optional().describe("小号的下场，如“平台：不感兴趣”"), verdictAt: z.number().optional() }),
  ratio: z.string().optional().describe("两者差距的标注，如“×10000”"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const bigAt = cueOr(data.big.at, 4);
  const smallAt = cueOr(data.small.at, dur * 0.5);
  const verdictAt = cueOr(data.small.verdictAt, smallAt + 40);
  const boosts = data.big.boosts;
  const bCues = listCues(boosts, bigAt + 20, Math.max(bigAt + 30, smallAt - 20));
  const bx = width * 0.33;
  const by = height * 0.54;
  const R = 270;
  const gb = easeOutBack(prog(frame, bigAt, 22));
  const sxp = width * 0.78;
  const syp = height * 0.62;
  const gs = easeOutBack(prog(frame, smallAt, 16));
  const dim = easeOut(prog(frame, verdictAt, 14));
  const pulse = 1 + Math.sin(frame / 6) * 0.12;
  const orbit = frame * 0.012;
  return (
    <>
      <Heading kicker={data.kicker ?? "SCALE"} title={data.title} frame={frame} width={width} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="sg" std={14} />
        <GlowDefs id="sg2" std={5} user />
        <defs>
          <radialGradient id="sgBig" cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor={alpha(t.primary, 0.75)} />
            <stop offset="0.6" stopColor={alpha(t.secondary, 0.35)} />
            <stop offset="1" stopColor={alpha(t.bg2, 0.2)} />
          </radialGradient>
        </defs>
        {/* algorithm push: streaks rushing up behind the big account */}
        {frame > (bCues[bCues.length - 1] ?? bigAt + 20) &&
          new Array(18).fill(0).map((_, i) => {
            const k = ((frame * 0.035 + i / 18) % 1);
            const x = bx - R * 0.9 + ((i * 97) % 100) / 100 * R * 1.8;
            const y = by + R * 1.1 - k * R * 2.6;
            return <line key={i} x1={x} y1={y} x2={x} y2={y + 70} stroke={t.accent} strokeOpacity={0.55 * Math.sin(k * Math.PI)} strokeWidth={3} strokeLinecap="round" />;
          })}
        <circle cx={bx} cy={by} r={R * gb} fill="url(#sgBig)" stroke={t.primary} strokeWidth={3} filter="url(#sg)" opacity={0.95} />
        {[1.12, 1.26].map((k, i) => (
          <circle key={i} cx={bx} cy={by} r={R * k * gb} fill="none" stroke={alpha(t.primary, 0.25 - i * 0.08)} strokeWidth={2} strokeDasharray="6 12" transform={`rotate(${frame * (i ? -0.3 : 0.4)} ${bx} ${by})`} />
        ))}
        {/* measuring bracket between the two */}
        {data.ratio && frame > smallAt + 10 && (
          <g opacity={easeOut(prog(frame, smallAt + 10, 14))}>
            <line x1={bx + R + 30} y1={by} x2={sxp - 50} y2={syp} stroke={alpha(t.text, 0.4)} strokeWidth={2} strokeDasharray="4 8" />
          </g>
        )}
        <circle cx={sxp} cy={syp} r={20 * gs * (dim > 0 ? 1 : pulse)} fill={alpha(t.text, 0.85 - dim * 0.6)} filter="url(#sg2)" />
        {dim === 0 && gs > 0.5 && <circle cx={sxp} cy={syp} r={20 + ((frame * 1.2) % 50)} fill="none" stroke={alpha(t.text, 0.5 * (1 - ((frame * 1.2) % 50) / 50))} strokeWidth={2} />}
      </svg>
      <div style={{ position: "absolute", left: bx - R, top: by - 70, width: R * 2, textAlign: "center", opacity: clamp(gb), transform: `scale(${Math.max(0.01, gb)})` }}>
        <div style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: 44, color: t.text }}>{data.big.label}</div>
        <div style={{ marginTop: 6, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.big.value, R * 1.7, 72, 30), color: t.gold, textShadow: `0 0 30px ${alpha(t.gold, 0.7)}` }}>{data.big.value}</div>
      </div>
      {boosts.map((b, i) => {
        const p = easeOutBack(prog(frame, bCues[i], 16));
        if (frame < bCues[i]) return null;
        const a = -Math.PI * 0.75 + i * (Math.PI * 0.6) + Math.sin(orbit + i) * 0.05;
        const px = bx + Math.cos(a) * (R + 90);
        const py = by + Math.sin(a) * (R + 60);
        return (
          <div key={i} style={{ position: "absolute", left: px, top: py, transform: `translate(-50%,-50%) scale(${p})`, padding: "12px 24px", borderRadius: 99, background: alpha(t.accent, 0.16), border: `2px solid ${t.accent}`, boxShadow: `0 0 26px ${alpha(t.accent, 0.4)}`, display: "flex", alignItems: "center", gap: 10, fontFamily: t.font.body, fontWeight: 800, fontSize: 32, color: t.text, whiteSpace: "nowrap" }}>
            <Icon name={i === 0 ? "users" : "up"} size={30} color={t.accent} />
            {b.text}
            <Sfx name="pop" at={bCues[i]} volume={0.3} />
          </div>
        );
      })}
      {frame >= smallAt && (
        <div style={{ position: "absolute", left: sxp - 240, top: syp - 150, width: 480, textAlign: "center", opacity: clamp(gs) * (1 - dim * 0.45) }}>
          <div style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: 40, color: t.text }}>{data.small.label}</div>
          <div style={{ marginTop: 4, fontFamily: t.font.title, fontWeight: 900, fontSize: 40, color: t.dim }}>{data.small.value}</div>
        </div>
      )}
      {data.ratio && frame > smallAt + 10 && (
        <div style={{ position: "absolute", left: (bx + R + sxp) / 2 - 90, top: (by + syp) / 2 - 64, width: 180, textAlign: "center", fontFamily: t.font.mono, fontWeight: 900, fontSize: 40, color: t.text, opacity: easeOut(prog(frame, smallAt + 14, 14)) }}>{data.ratio}</div>
      )}
      {data.small.verdict && frame >= verdictAt && (
        <div style={{ position: "absolute", left: sxp, top: syp + 70, transform: `translate(-50%,0) scale(${easeOutBack(prog(frame, verdictAt, 14))})`, padding: "12px 26px", borderRadius: 14, background: alpha(t.bad, 0.16), border: `2px solid ${t.bad}`, display: "flex", alignItems: "center", gap: 10, fontFamily: t.font.body, fontWeight: 900, fontSize: 34, color: t.bad, whiteSpace: "nowrap", boxShadow: `0 0 30px ${alpha(t.bad, 0.4)}` }}>
          <Icon name="x" size={30} color={t.bad} stroke={3} />
          {data.small.verdict}
        </div>
      )}
      <Sfx name="impact" at={bigAt} volume={0.3} />
      <Sfx name="tick" at={smallAt} volume={0.4} />
      {data.small.verdict && <Sfx name="stamp" at={verdictAt} volume={0.35} />}
    </>
  );
};

export const ScaleGap: CompDef<D> = {
  id: "scale-gap",
  name: "体量悬殊对比",
  layer: "info",
  variants: 1,
  minSec: 4,
  maxSec: 16,
  tags: ["大博主", "小号", "新号", "差距", "粉丝", "推流"],
  desc: "左边一颗巨大的发光球（大号：几百万粉丝），基础盘/推流标签环绕、背后流量光束上涌；右边一个小亮点（新号：几百粉丝），最后被判“平台：不感兴趣”",
  use: "强弱/大小/资源差距悬殊的对比：大博主 vs 新号、大厂 vs 个人、头部 vs 长尾",
  schema,
  example: {
    big: { label: "大博主", value: "几百万粉丝", at: 4, boosts: [{ text: "粉丝基础盘", at: 30 }, { text: "算法强力推流", at: 60 }] },
    small: { label: "你的新号", value: "几百粉丝", at: 100, verdict: "平台：不感兴趣", verdictAt: 140 },
    ratio: "×10000",
  },
  C,
};
