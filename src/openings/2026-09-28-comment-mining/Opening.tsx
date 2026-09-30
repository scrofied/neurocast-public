import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { drift, punch, shakes } from "../../lib/cine/motion";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { CharPop, Slam, Stamp, Strike } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";

// 《从评论区挖掘爆款选题》专属开场（2026-09-28）
// 钩子 = 痛点反问：「为什么自己觉得重要的话题，观众根本不关心？」
// 0f   闪白 + 「为什么」砸字 + 速度线 + 推镜头        （形态 1）
// 自己 逐字弹出「自己觉得重要的话题」，「重要」叮一声 + 光环（形态 2）
// 观众 标题上移变暗，右侧一排观众头像依次弹出          （形态 3）
// 不关心 红章「根本不关心」盖下 + 划掉「重要」+ 画面抖动褪色（形态 4）
// 收尾 整层缩走，真人收进中间舞台                    （形态 5，由 talking-head-stage 的 shrinkAt 接）
const schema = z.object({
  q: z.string().default("为什么"),
  line: z.string().default("自己觉得重要的话题"),
  hl: z.string().default("重要"),
  aud: z.string().default("观众"),
  verdict: z.string().default("根本不关心"),
  lineAt: z.number().default(10).describe("「自己」开口：逐字弹出开始"),
  hitAt: z.number().default(27).describe("「重要」：叮 + 光环"),
  lineEndAt: z.number().default(46).describe("「题」：这一行弹完"),
  audAt: z.number().default(55).describe("「观众」：头像出场"),
  rootAt: z.number().default(64).describe("「根本」：头像开始变灰"),
  notAt: z.number().default(74).describe("「不关心」：盖章 + 抖动 + 褪色"),
});
type D = z.infer<typeof schema>;

const AVATARS = 5;

// char cues: chars before the highlight spread from lineAt to hitAt, the rest from hitAt to lineEndAt
const lineCues = (d: D) => {
  const chars = Array.from(d.line);
  const h = Math.max(0, d.line.indexOf(d.hl));
  const hi = Array.from(d.line.slice(0, h)).length;
  return chars.map((_, i) => (i < hi ? d.lineAt + ((d.hitAt - d.lineAt) * i) / Math.max(1, hi) : d.hitAt + ((d.lineEndAt - d.hitAt) * (i - hi)) / Math.max(1, chars.length - hi - 1)));
};

const Avatar: React.FC<{ x: number; y: number; s: number; p: number; gray: number; away: number; color: string }> = ({ x, y, s, p, gray, away, color }) => {
  if (p <= 0) return null;
  const c = color;
  return (
    <svg
      width={s}
      height={s * 1.15}
      viewBox="0 0 100 115"
      style={{ position: "absolute", left: x - s / 2, top: y - s / 2, transform: `translateX(${away * 70}px) rotate(${away * 14}deg) scale(${0.3 + 0.7 * p})`, opacity: clamp(p * 2) * (1 - away * 0.55), filter: `grayscale(${gray}) brightness(${1 - gray * 0.35}) drop-shadow(0 6px 10px rgba(0,0,0,.6))` }}
    >
      <circle cx="50" cy="34" r="24" fill={c} stroke="#000" strokeWidth="5" />
      <path d="M8,112 C8,78 26,64 50,64 C74,64 92,78 92,112 Z" fill={c} stroke="#000" strokeWidth="5" />
      {/* eyes look away once they stop caring */}
      <circle cx={42 + away * 10} cy="33" r="4" fill="#000" />
      <circle cx={58 + away * 10} cy="33" r="4" fill="#000" />
    </svg>
  );
};

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const font = t.font.title;
  const out = easeIn(prog(frame, dur - 12, 12));
  const dr = drift(frame, 7, 0.05, seed);
  const hit = shakes(frame, [{ at: 0, amp: 12, len: 10 }, { at: d.notAt, amp: 18, len: 14 }], seed);
  // headline block moves up and dims when the audience comes in
  const up = easeOut(prog(frame, d.audAt, 12));
  const cues = lineCues(d);
  const hlStart = Array.from(d.line.slice(0, Math.max(0, d.line.indexOf(d.hl)))).length;
  const hlIdx = Array.from(d.hl).map((_, k) => hlStart + k);
  const gray = easeOut(prog(frame, d.rootAt, 10));
  const away = easeOut(prog(frame, d.notAt + 2, 14));
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - out, transform: `translate(${dr.x + hit.x}px, ${dr.y + hit.y}px) rotate(${hit.r}deg) scale(${1 - out * 0.08})` }}>
      <Scrim side="left" size={0.62} strength={0.7} />
      <Scrim side="right" size={0.4} strength={0.55} opacity={easeOut(prog(frame, d.audAt - 4, 10))} />
      <Flash frame={frame} at={0} len={10} peak={0.75} />
      <Flash frame={frame} at={d.notAt} len={8} peak={0.4} color={t.bad} />
      <SpeedLines frame={frame} at={0} x={960} y={420} color={alpha("#ffffff", 0.9)} len={12} seed={seed} />

      {/* 形态 1+2: question word + per-char line */}
      <div style={{ position: "absolute", left: 96, top: 120, transformOrigin: "left top", transform: `translateY(${-up * 40}px) scale(${1 - up * 0.18})`, opacity: 1 - up * 0.35 }}>
        <div style={{ transformOrigin: "left center" }}>
          <Slam frame={frame} at={0} text={d.q} size={230} color={t.text} font={font} from={1.35} len={6} blur={3} minOpacity={0.85} strokeW={12} style={{ transformOrigin: "left center" }} />
        </div>
        <div style={{ position: "relative", marginTop: 24, display: "inline-block" }}>
          <CharPop frame={frame} at={0} text={d.line} cues={cues} size={104} color={t.text} hl={hlIdx} hlColor={t.accent} font={font} strokeW={10} />
          <Strike frame={frame} at={d.notAt + 3} color={t.bad} thickness={16} len={7} />
        </div>
      </div>
      <RingBurst frame={frame} at={d.hitAt} x={96 + 104 * (hlStart + 1)} y={120 + 240 + 24 + 55} color={t.accent} maxR={260} len={16} />

      {/* 形态 3: the audience */}
      <div style={{ position: "absolute", left: 1330, top: 250, width: 520, height: 420 }}>
        <div style={{ position: "absolute", left: 0, top: -10, fontFamily: font, fontWeight: 900, fontSize: 64, color: t.primary, opacity: easeOut(prog(frame, d.audAt, 8)), transform: `translateX(${(1 - easeOut(prog(frame, d.audAt, 8))) * 60}px)`, WebkitTextStroke: "8px #000", paintOrder: "stroke fill" }}>{d.aud}</div>
        {Array.from({ length: AVATARS }, (_, i) => {
          const at = d.audAt + i * 2;
          const col = i % 3 === 0 ? t.primary : i % 3 === 1 ? t.secondary : t.accent;
          return <Avatar key={i} x={70 + (i % 3) * 170 + (i >= 3 ? 85 : 0)} y={150 + (i >= 3 ? 170 : 0)} s={138} p={easeOutBack(prog(frame, at, 10))} gray={gray} away={away * (0.7 + (i % 2) * 0.3)} color={col} />;
        })}
      </div>

      {/* 形态 4: the verdict stamp */}
      <div style={{ position: "absolute", left: 1100, top: 700 }}>
        <Stamp frame={frame} at={d.notAt} text={d.verdict} size={104} color={t.bad} font={font} rotate={-7} />
      </div>

      <Sfx name="impact" at={0} volume={0.5} />
      <Sfx name="ding" at={d.hitAt} volume={0.4} />
      <Sfx name="swipe" at={d.audAt} volume={0.35} />
      <Sfx name="stamp" at={d.notAt} volume={0.55} />
      <Sfx name="whoosh" at={dur - 12} volume={0.25} />
    </div>
  );
};

export const OpeningCommentMining: CompDef<D> = {
  id: "opening-comment-mining",
  name: "开场 · 从评论区挖掘爆款选题",
  layer: "opening",
  variants: 1,
  minSec: 2,
  maxSec: 4,
  tags: ["开场", "痛点反问"],
  desc: "闪白砸字「为什么」→ 逐字弹出「自己觉得重要的话题」→ 观众头像出场 → 红章「根本不关心」+ 划掉「重要」+ 画面褪色抖动",
  use: "只给《从评论区挖掘爆款选题》用（开场不重样）",
  noGallery: true,
  schema,
  example: {},
  C,
  // drives the person video under the overlay: punch-in on the first frame and on 重要, shake + desaturate on 不关心
  camera: (d, f, dur) => {
    const fade = 1 - easeInOut(prog(f, dur - 12, 12));
    const z = punch(f, 0, 0.12, 18, 0.3) * punch(f, d.hitAt, 0.05, 12, 0.4) * (1 + 0.02 * prog(f, 0, dur));
    const s = shakes(f, [{ at: 0, amp: 10, len: 10 }, { at: d.notAt, amp: 20, len: 14 }], 3);
    const desat = easeOut(prog(f, d.notAt, 6)) * fade;
    return {
      zoom: 1 + (z - 1) * fade,
      x: s.x * fade,
      y: s.y * fade,
      rot: s.r * fade,
      filter: desat > 0.001 ? `grayscale(${0.8 * desat}) contrast(${1 + 0.12 * desat})` : undefined,
      tint: "#3a0010",
      tintOpacity: 0.35 * desat,
    };
  },
  opening: {
    script: "examples/comment-mining",
    hook: "痛点反问",
    techniques: ["首帧大字", "闪白+冲击音", "推镜头", "逐字弹出", "叮+光环强调", "观众头像", "红章盖印", "划掉关键词", "褪色抖动", "5 次形态变化"],
  },
};
