import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog, rng } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { IconPaths } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  icon: z.string().optional().describe("你做出来的东西：图标名（src/lib/icons，如 doc / video / tool / chart / bot），缺省 = 一把剑"),
  label: z.string().default("削铁如泥").describe("产品旁的金色标签（你引以为傲的卖点）"),
  labelAt: z.number().optional(),
  streetAt: z.number().optional().describe("路人开始走过的时刻（锚点，如“满大街”）"),
  ask: z.string().default("喂，你需不需要削铁啊？").describe("你向路人推销的话"),
  askAt: z.number().optional().describe("推销气泡出现时刻（锚点，如“喂”）"),
  reply: z.string().default("……").describe("路人的反应"),
  crowd: z.number().int().min(1).max(6).default(4),
});
type D = z.infer<typeof schema>;

const Figure: React.FC<{ x: number; y: number; s: number; color: string; step: number; opacity?: number }> = ({ x, y, s, color, step, opacity = 1 }) => {
  const bob = Math.abs(Math.sin(step)) * 6 * s;
  return (
    <g transform={`translate(${x},${y - bob}) scale(${s})`} opacity={opacity}>
      <circle cx={0} cy={-150} r={24} fill={color} />
      <rect x={-30} y={-120} width={60} height={92} rx={26} fill={color} />
      <rect x={-22 + Math.sin(step) * 8} y={-40} width={16} height={46} rx={8} fill={color} />
      <rect x={6 - Math.sin(step) * 8} y={-40} width={16} height={46} rx={8} fill={color} />
    </g>
  );
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const forgeEnd = Math.min(62, dur * 0.3);
  const labelAt = cueOr(data.labelAt, forgeEnd - 10);
  const streetAt = cueOr(data.streetAt, dur * 0.42);
  const askAt = cueOr(data.askAt, dur * 0.62);
  const ground = height - 190;
  // sword: forged in the air, tilts towards the street when you start selling it
  const sx = width * 0.5;
  const sy = height * 0.6;
  const tilt = -12 + 32 * easeInOut(prog(frame, askAt - 6, 18));
  const reveal = easeInOut(prog(frame, 4, forgeEnd - 4)); // 0..1 blade revealed from guard to tip
  const bladeLen = 420;
  const edgeY = -bladeLen * reveal;
  const strikes = [10, 24, 38, 52].filter((s) => s < forgeEnd);
  const gleam = prog(frame, forgeEnd + 2, 16);
  const sparks = useMemo(() => {
    const r = rng(seed + 5);
    return new Array(46).fill(0).map(() => ({ born: 4 + r() * (forgeEnd - 6), a: -Math.PI / 2 + (r() - 0.5) * 2.6, v: 5 + r() * 9, life: 12 + r() * 12 }));
  }, [seed, forgeEnd]);
  const r2 = useMemo(() => rng(seed + 11), [seed]);
  const walkers = useMemo(() => new Array(data.crowd).fill(0).map((_, i) => ({ speed: 8.5 + r2() * 2.5, gap: 250 + r2() * 90, s: 0.9 + r2() * 0.2, i })), [data.crowd, r2]);
  const label = easeOutBack(prog(frame, labelAt, 16));
  const ask = easeOutBack(prog(frame, askAt, 16));
  const you = easeOut(prog(frame, 6, 18));
  const youX = width * 0.33;
  return (
    <>
      <Heading kicker={data.kicker ?? "闭门造车"} title={data.title} frame={frame} width={width} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="sw" std={7} />
        <GlowDefs id="sw2" std={16} />
        <defs>
          <linearGradient id="steel" x1="0" x2="1">
            <stop offset="0" stopColor="#8f9bb0" />
            <stop offset="0.5" stopColor="#f2f6ff" />
            <stop offset="1" stopColor="#7d889c" />
          </linearGradient>
          <clipPath id="bladeClip" clipPathUnits="userSpaceOnUse">
            <rect x={-60} y={edgeY - 4} width={120} height={bladeLen + 10} />
          </clipPath>
        </defs>
        {/* street */}
        <line x1={0} y1={ground} x2={width} y2={ground} stroke={alpha(t.primary, 0.35 * easeOut(prog(frame, streetAt - 20, 20)))} strokeWidth={2} strokeDasharray="14 10" />
        <g transform={`translate(${sx},${sy}) rotate(${tilt})`}>
          <ellipse cx={0} cy={-bladeLen * 0.45} rx={140} ry={bladeLen * 0.62} fill={alpha(t.gold, 0.06 + 0.06 * reveal)} filter="url(#sw2)" />
          {!data.icon && (
          <>
          <g clipPath="url(#bladeClip)">
            <polygon points={`0,${-bladeLen} 24,${-bladeLen + 64} 24,0 -24,0 -24,${-bladeLen + 64}`} fill="url(#steel)" />
            <line x1={0} y1={-bladeLen + 40} x2={0} y2={-8} stroke={alpha("#ffffff", 0.9)} strokeWidth={2} />
            {gleam > 0 && gleam < 1 && <rect x={-26} y={-bladeLen * gleam - 30} width={52} height={60} fill={alpha("#ffffff", 0.85 * Math.sin(gleam * Math.PI))} filter="url(#sw)" />}
          </g>
          {reveal > 0 && reveal < 1 && <ellipse cx={0} cy={edgeY} rx={38} ry={10} fill={t.gold} filter="url(#sw)" opacity={0.95} />}
          <rect x={-86} y={0} width={172} height={22} rx={10} fill={t.gold} filter="url(#sw)" />
          <rect x={-15} y={22} width={30} height={122} rx={8} fill="#3a2a18" stroke={t.gold} strokeWidth={2} />
          {[40, 66, 92, 118].map((y) => (
            <line key={y} x1={-15} y1={y} x2={15} y2={y + 10} stroke={alpha(t.gold, 0.7)} strokeWidth={3} />
          ))}
          <circle cx={0} cy={160} r={20} fill={t.gold} filter="url(#sw)" />
          </>
          )}
          {data.icon && (
            // any product: a glowing card built up from the bottom while sparks fly
            <g clipPath="url(#bladeClip)">
              <rect x={-170} y={-bladeLen + 30} width={340} height={bladeLen - 40} rx={40} fill={alpha(t.bg2, 0.95)} stroke={t.gold} strokeWidth={4} filter="url(#sw)" />
              <g transform={`translate(${-120},${-bladeLen / 2 - 110}) scale(10)`}>
                <g fill="none" stroke={t.gold} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <IconPaths name={data.icon} />
                </g>
              </g>
              {gleam > 0 && gleam < 1 && <rect x={-170} y={-bladeLen * gleam - 30} width={340} height={60} fill={alpha("#ffffff", 0.5 * Math.sin(gleam * Math.PI))} filter="url(#sw)" />}
            </g>
          )}
          {sparks.map((p, i) => {
            const age = frame - p.born;
            if (age < 0 || age > p.life) return null;
            const ey = -bladeLen * easeInOut(clamp((p.born - 4) / Math.max(1, forgeEnd - 8)));
            const x = Math.cos(p.a) * p.v * age;
            const y = ey + Math.sin(p.a) * p.v * age + 0.35 * age * age;
            const k = 1 - age / p.life;
            return <line key={i} x1={x} y1={y} x2={x - Math.cos(p.a) * 12 * k} y2={y - Math.sin(p.a) * 12 * k} stroke={i % 3 ? t.gold : "#ffffff"} strokeWidth={2.4} opacity={k} />;
          })}
          {strikes.map((s, i) => {
            const k = clamp((frame - s) / 8);
            if (k <= 0 || k >= 1) return null;
            const ey = -bladeLen * easeInOut(clamp((s - 4) / Math.max(1, forgeEnd - 8)));
            return <circle key={i} cx={0} cy={ey} r={20 + k * 70} fill="none" stroke="#ffffff" strokeWidth={4 * (1 - k)} opacity={1 - k} />;
          })}
        </g>
        {/* you, proudly holding the product */}
        <Figure x={youX} y={ground} s={1.25} color={alpha(t.primary, 0.9)} step={0} opacity={you} />
        {/* passers-by walk right to left and do not stop */}
        {frame >= streetAt &&
          walkers.map((w) => {
            const x = width + 60 + w.i * w.gap - (frame - streetAt) * w.speed * (frame > askAt + 20 ? 1.3 : 1);
            if (x < -120 || x > width + 200) return null;
            const near = Math.abs(x - (sx + 220)) < 340;
            return (
              <g key={w.i}>
                <Figure x={x} y={ground} s={w.s} color={alpha(t.dim, 0.75)} step={(frame - streetAt) * 0.22 + w.i} />
                {frame > askAt + 8 && near && (
                  <g transform={`translate(${x},${ground - 210 * w.s})`} opacity={easeOut(prog(frame, askAt + 8 + w.i * 4, 10))}>
                    <rect x={-44} y={-42} width={88} height={48} rx={24} fill={alpha(t.bg2, 0.95)} stroke={alpha(t.dim, 0.6)} />
                    <text x={0} y={-10} textAnchor="middle" fill={t.text} fontFamily={t.font.body} fontSize={26} fontWeight={700}>
                      {data.reply}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
      </svg>
      {/* selling point label: left of the blade so the tilt never crosses it */}
      <div
        style={{
          position: "absolute",
          right: width - sx + 150,
          top: sy - 360,
          transform: `scale(${label}) rotate(-4deg)`,
          transformOrigin: "right center",
          opacity: clamp(label),
          padding: "10px 24px",
          border: `2px solid ${t.gold}`,
          borderRadius: 14,
          background: alpha(t.gold, 0.12),
          color: t.gold,
          fontFamily: t.font.title,
          fontWeight: 900,
          fontSize: 46,
          letterSpacing: 4,
          textShadow: `0 0 20px ${alpha(t.gold, 0.8)}`,
          boxShadow: `0 0 30px ${alpha(t.gold, 0.35)}`,
          whiteSpace: "nowrap",
        }}
      >
        {data.label}
      </div>
      {/* the sales pitch */}
      {frame >= askAt && (
        <div
          style={{
            position: "absolute",
            right: width - youX - 40,
            top: ground - 330,
            transform: `scale(${ask})`,
            transformOrigin: "right bottom",
            maxWidth: 620,
            padding: "18px 30px",
            borderRadius: 28,
            borderBottomRightRadius: 6,
            background: `linear-gradient(135deg, ${alpha(t.primary, 0.3)}, ${alpha(t.bg2, 0.95)})`,
            border: `2px solid ${t.primary}`,
            boxShadow: `0 0 40px ${alpha(t.primary, 0.4)}`,
            fontFamily: t.font.body,
            fontWeight: 800,
            fontSize: fitFont(data.ask, 560, 44, 26),
            color: t.text,
            whiteSpace: "nowrap",
          }}
        >
          {data.ask}
        </div>
      )}
      {strikes.map((s) => (
        <Sfx key={s} name="click" at={s} volume={0.4} />
      ))}
      <Sfx name="sparkle" at={forgeEnd + 2} volume={0.3} />
      <Sfx name="pop" at={askAt} volume={0.35} />
    </>
  );
};

export const SwordForge: CompDef<D> = {
  id: "sword-forge",
  name: "闭门造车（做了没人要）",
  layer: "story",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["闭门造车", "自嗨", "没人要", "先做产品", "推销", "需求错位"],
  desc: "火花中造出一个发光的产品（缺省是一把剑，`icon` 可换成文档/视频/工具/App 等任何东西）+ 金色卖点标签，路人从右往左走过、头顶冒“……”，你推销的气泡无人理会",
  use: "先埋头做、再去找人要，结果没人需要：自嗨写的深度文章、没人用的 App、没市场的产品、没人报名的课程",
  schema,
  example: { label: "削铁如泥", ask: "喂，你需不需要削铁啊？", streetAt: 80, askAt: 120, reply: "……", crowd: 4 },
  C,
};
