import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, lerp, noise1, prog, rng } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Figure, mixPose, POSES } from "../../lib/figure";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  person: z.string().default("你").describe("站在镜子前的人"),
  blurIn: z.string().default("脑子里一团浆糊").describe("镜子里照出来的糊状态"),
  clearOut: z.string().default("说得清清楚楚").describe("把话说清楚之后镜子里变成的样子"),
  askAt: z.number().optional().describe("对着镜子提问 / 按下提交的时刻"),
  turnAt: z.number().optional().describe("镜中由糊转清的时刻（锚点，如“说清楚之后”）"),
  note: z.string().optional().describe("镜子旁挂的一句，如“它只是一面镜子”"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const askAt = cueOr(data.askAt, Math.round(dur * 0.2));
  const turnAt = cueOr(data.turnAt, Math.round(dur * 0.6));
  const G = full ? H * 0.8 : H * 0.76;
  const mirrorW = full ? W * 0.3 : W * 0.34;
  const mirrorH = full ? H * 0.56 : H * 0.4;
  // 镜子原来放在 0.54W，右侧「它吐出来的」卡片（0.24W）会被推出画面外（1653+461>1920）。
  // 整条场景左移到 0.42W：镜子 806~1382，卡片 1422~1883 正好留在画内，人形仍在 x≈357 不压标题。
  const mx = W * (full ? 0.42 : 0.52);
  const my = G - mirrorH;
  const figH = mirrorH * 0.82;
  const figX = mx - mirrorW * 0.78;
  const clearK = frame >= turnAt ? easeInOut(prog(frame, turnAt, 22)) : 0;
  const sh = hitShake(frame, [turnAt], full ? 8 : 4, 12, seed);
  // the tangled blob in the mirror: a knot of lines that straightens out
  const knot = React.useMemo(() => {
    const r = rng(seed + 3);
    return Array.from({ length: 16 }, (_, i) => ({ a: r() * Math.PI * 2, r: 0.2 + r() * 0.7, s: 0.4 + r() * 0.6, i }));
  }, [seed]);
  const blobPath = (clear: number) => {
    const cx = mx + mirrorW / 2;
    const cy = my + mirrorH * 0.46;
    const pts: string[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      // tangled: noise-perturbed radius; clear: a clean circle
      const wob = (1 - clear) * (0.35 + 0.3 * noise1(i * 0.7 + frame * 0.02, seed));
      const r = mirrorW * 0.24 * (1 + wob);
      pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r * 0.9}`);
    }
    return `M${pts.join(" L")} Z`;
  };
  // the person's pose: leaning in to ask, then standing back satisfied
  const lean = frame >= askAt && frame < turnAt ? easeInOut(prog(frame, askAt, 16)) : frame >= turnAt ? 1 - easeOut(prog(frame, turnAt, 18)) : 0;
  const pose = mixPose(POSES.stand, { ...POSES.stand, lean: 14, head: 8, ls: 40, rs: 30, le: 60, re: 50 }, lean);
  const bubbleText = clearK > 0.5 ? data.clearOut : data.blurIn;
  // 人物标签淡入 / 结果卡从 0 弹出 / 旁注淡入 = 元素入场；乱麻理顺、镜面转金是隐喻主体不动
  const ePerson = enterAt(frame, 4, { fallback: "rise", dur: 12 });
  const eCard = enterAt(frame, askAt, { fallback: "rise", dur: 14, from: 0 });
  const eNote = enterAt(frame, turnAt + 10, { fallback: "rise", dur: 12 });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="mr2" std={9} user />
          <line x1={0} y1={G} x2={W} y2={G} stroke={alpha(t.primary, 0.5)} strokeWidth={3} filter="url(#mr2)" />
          {/* mirror frame: an upright oval */}
          <ellipse cx={mx + mirrorW / 2} cy={my + mirrorH / 2} rx={mirrorW / 2} ry={mirrorH / 2} fill={alpha(t.bg2, 0.5)} stroke={clearK > 0.5 ? t.gold : t.dim} strokeWidth={full ? 10 : 6} style={{ filter: `drop-shadow(0 0 ${18 + clearK * 20}px ${alpha(clearK > 0.5 ? t.gold : t.dim, 0.5)})` }} />
          {/* the reflection: tangled blob → clean circle */}
          <clipPath id="mrc">
            <ellipse cx={mx + mirrorW / 2} cy={my + mirrorH / 2} rx={mirrorW / 2 - 6} ry={mirrorH / 2 - 6} />
          </clipPath>
          <g clipPath="url(#mrc)">
            <path d={blobPath(clearK)} fill={alpha(clearK > 0.5 ? t.primary : t.bad, 0.22)} stroke={clearK > 0.5 ? t.primary : t.bad} strokeWidth={4} style={{ filter: `drop-shadow(0 0 12px ${alpha(clearK > 0.5 ? t.primary : t.bad, 0.7)})` }} />
            {/* tangled threads inside the blob */}
            {knot.map((k) => {
              const cx = mx + mirrorW / 2 + Math.cos(k.a) * mirrorW * 0.22 * k.r;
              const cy = my + mirrorH * 0.46 + Math.sin(k.a) * mirrorW * 0.2 * k.r;
              const len = mirrorW * 0.16 * k.s * (1 - clearK * 0.85);
              const rot = k.a * 40 + frame * (1 - clearK) * 0.6;
              return <line key={k.i} x1={cx - Math.cos(rot) * len} y1={cy - Math.sin(rot) * len} x2={cx + Math.cos(rot) * len} y2={cy + Math.sin(rot) * len} stroke={alpha(clearK > 0.5 ? t.primary : t.bad, 0.5 * (1 - clearK * 0.6))} strokeWidth={2.5} strokeLinecap="round" />;
            })}
            {/* clean concentric rings once it clears */}
            {clearK > 0.4 && [0.5, 0.72].map((k, i) => (
              <ellipse key={i} cx={mx + mirrorW / 2} cy={my + mirrorH * 0.46} rx={mirrorW * 0.24 * k} ry={mirrorW * 0.22 * k} fill="none" stroke={alpha(t.primary, 0.4 * (clearK - 0.4) * 1.6)} strokeWidth={2} />
            ))}
          </g>
          <circle cx={figX} cy={G} r={0} fill="none" />
        </svg>
        {/* the person */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <Figure x={figX} y={G} h={figH} pose={pose} color={t.text} glow={t.primary} />
        </svg>
        {/* label above the person */}
        <div style={{ position: "absolute", left: figX, top: G - figH - (full ? 70 : 38), transform: `translateX(-50%) translate(${ePerson.dx}px, ${ePerson.dy}px)`, fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 28 : 15, color: t.text, whiteSpace: "nowrap", opacity: ePerson.opacity, textShadow: "0 2px 0 #000" }}>{data.person}</div>
        {/* the result card the mirror spits out */}
        {frame >= askAt && (
          <div style={{ position: "absolute", left: Math.min(mx + mirrorW + (full ? 40 : 18), W - (full ? W * 0.24 : W * 0.32) - 16), top: my + mirrorH * 0.3, width: full ? W * 0.24 : W * 0.32, transform: `translate(${eCard.dx}px, ${eCard.dy}px) scale(${eCard.scale}) translateX(${(1 - clearK) * (full ? 30 : 15)}px)`, opacity: eCard.opacity, transformOrigin: "0 50%", borderRadius: 14, background: alpha(t.bg, 0.88), border: `3px solid ${clearK > 0.5 ? t.primary : t.bad}`, boxShadow: `0 0 26px ${alpha(clearK > 0.5 ? t.primary : t.bad, 0.5)}`, padding: full ? "16px 22px" : "8px 11px" }}>
            <div style={{ fontFamily: t.font.mono, fontSize: full ? 17 : 10, letterSpacing: 3, color: t.dim, marginBottom: full ? 8 : 4 }}>它吐出来的</div>
            {/* the output is fuzzy while the input is fuzzy */}
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(bubbleText, (full ? W * 0.24 : W * 0.32) - (full ? 44 : 22), full ? 30 : 15, 12), color: t.text, lineHeight: 1.3, filter: `blur(${(1 - clearK) * 3}px)`, opacity: 0.6 + clearK * 0.4 }}>{bubbleText}</div>
          </div>
        )}
        {data.note && frame >= turnAt && (
          <div style={{ position: "absolute", left: mx + mirrorW / 2, top: my + mirrorH + (full ? 30 : 14), transform: `translateX(-50%) translate(${eNote.dx}px, ${eNote.dy}px)`, opacity: eNote.opacity, fontFamily: t.font.body, fontWeight: 800, fontSize: full ? 26 : 14, color: t.gold, whiteSpace: "nowrap" }}>{data.note}</div>
        )}
        {/* ask pulse at the mirror when the question goes in */}
        {frame >= askAt && frame < askAt + 24 && (
          <div style={{ position: "absolute", left: mx + mirrorW / 2, top: my + mirrorH / 2, transform: `translate(-50%,-50%) scale(${1 + prog(frame, askAt, 24) * 1.6})`, width: mirrorW, height: mirrorH, borderRadius: "50%", border: `4px solid ${alpha(t.accent, 1 - prog(frame, askAt, 24))}` }} />
        )}
      </div>
      <Sfx name="whoosh" at={askAt} volume={0.28} />
      <Sfx name="glitch" at={askAt + 4} volume={0.24} />
      <Sfx name="sparkle" at={turnAt} volume={0.36} />
      <Sfx name="ding" at={turnAt + 12} volume={0.3} />
    </>
  );
};

export const MirrorReveal: CompDef<D> = {
  id: "mirror-reveal",
  name: "AI 是镜子（照出你思维的糊）",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["镜子", "照出", "原形毕露", "浆糊", "说清楚", "诚实"],
  motion: { kind: "人俯身照镜 → 镜中乱麻团扭动 + 结果卡发糊 → 说清后乱麻理顺成圆环、结果卡变清晰", energy: 2 },
  desc: "一个人俯身站到镜子前，镜子里映出的不是脸而是一团扭动的乱麻（思维不清），镜旁同步吐出一张模糊的结果卡；把话说清楚那一刻，镜里的乱麻理顺成干净的同心圆、镜框转金，结果卡也变清晰",
  use: "讲「你的输出取决于你的输入」：AI 是最诚实的一面镜子、脑子里一丁点浆糊它就让你原形毕露、说不清楚就别怪它写得烂",
  panel: true,
  schema,
  example: { person: "你", blurIn: "随便写点乱七八糟的", clearOut: "背景、对象、要什么，一次说清", note: "它只是一面镜子" },
  C,
};

