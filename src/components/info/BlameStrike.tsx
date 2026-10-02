import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  wrongs: z
    .array(z.object({ text: z.string(), at: z.number().optional().describe("这块牌子立起来的时刻（锚点，卡“不是”后面那个词）"), strikeAt: z.number().optional().describe("被劈开的时刻；缺省 = 立起后 0.6 秒") }))
    .min(1)
    .max(4)
    .describe("流行的错误解释（一条对一个“不是”）"),
  verdict: z.string().describe("真正的原因，短：如“缺工具链”"),
  verdictAt: z.number().optional().describe("真因砸下的时刻（锚点，卡“是”后面那个词）"),
  verdictNote: z.string().optional().describe("真因下面的小字"),
  style: z.enum(["slash", "shatter", "topple"]).default("slash").describe("slash 一刀劈成两半 / shatter 碎成块 / topple 被推倒"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.wrongs.length;
  const G = H * (full ? 0.74 : 0.7);
  const bw = Math.min(full ? 380 : W * 0.8, (W * 0.86) / n - 30);
  const bh = full ? Math.min(250, H * 0.24) : 110;
  const gap = (W - n * bw) / (n + 1);
  const standCues: number[] = [];
  const strikeCues: number[] = [];
  data.wrongs.forEach((w, i) => {
    const s = Math.max(i ? standCues[i - 1] + 6 : 0, cueOr(w.at, 10 + i * 34));
    standCues.push(s);
    strikeCues.push(Math.max(s + 8, cueOr(w.strikeAt, s + 18)));
  });
  const verdictAt = Math.max(strikeCues[n - 1] + 10, cueOr(data.verdictAt, strikeCues[n - 1] + 24));
  const land = verdictAt + 9;
  const sh = hitShake(frame, [...strikeCues.map((c) => c + 2), land], 16, 12, seed);
  // 真因重牌原生是加速坠地（easeIn）→ slam 的 p 与原生一致；坠落的位移仍走 vY，不再叠加 dy 免得翻倍
  const eV = enterAt(frame, verdictAt, { fallback: "slam", dur: 9 });
  const vIn = eV.p;
  // 小字原生是纯淡入
  const eNote = enterAt(frame, land + 6, { fallback: "rise", dur: 12 });
  const vW = Math.min(W * 0.72, fitFont(data.verdict, W * 0.66, full ? 120 : 48) * (Array.from(data.verdict).length + 1.2));
  const vH = full ? 200 : 90;
  const vFs = fitFont(data.verdict, vW * 0.86, full ? 120 : 48, 20);
  const vY = lerp(-vH - 40, G - vH, vIn);
  const squash = frame >= land ? 1 - 0.12 * Math.exp(-(frame - land) / 3) * Math.cos((frame - land) / 1.6) : 1;
  const glowK = frame >= land ? 0.6 + 0.4 * Math.sin((frame - land) / 6) : 0;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* floor */}
        <div style={{ position: "absolute", left: W * 0.05, right: W * 0.05, top: G, height: 4, background: alpha(t.primary, 0.6), boxShadow: `0 0 18px ${alpha(t.primary, 0.6)}` }} />
        {/* cracks when the verdict lands */}
        {frame >= land && (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
            {[-1, 1].map((d) =>
              [0, 1, 2].map((k) => {
                const p = easeOut(prog(frame, land, 10 + k * 3));
                const len = (vW * 0.35 + k * 90) * p;
                return <path key={`${d}${k}`} d={`M${W / 2 + d * vW * 0.3},${G} l${d * len * 0.4},${8 + k * 10} l${d * len * 0.35},${-4 + k * 6} l${d * len * 0.25},${12 + k * 4}`} stroke={alpha(t.gold, 0.8 - k * 0.2)} strokeWidth={4 - k} fill="none" />;
              })
            )}
          </svg>
        )}
        {data.wrongs.map((w, i) => {
          const x = gap + i * (bw + gap);
          const st = standCues[i];
          const sk = strikeCues[i];
          if (frame < st) return null;
          // 牌子原生是从地面 scaleY 长起来（easeOutBack）→ rise 的 p 与原生等价
          const eb = enterAt(frame, st, { fallback: "rise", dur: 12 });
          const up = eb.p;
          const fs = fitFont(w.text, bw * 0.84, full ? 58 : 30, 16);
          const struck = frame >= sk + 4;
          const since = frame - (sk + 4);
          const face = (clip?: string, extra?: React.CSSProperties, key?: string) => (
            <div
              key={key}
              style={{
                position: "absolute",
                inset: 0,
                clipPath: clip,
                borderRadius: 16,
                background: `linear-gradient(160deg, ${alpha(t.text, 0.2)}, ${alpha(t.bg2, 0.95)})`,
                border: `3px solid ${struck ? t.bad : alpha(t.text, 0.55)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: fs,
                color: t.text,
                whiteSpace: "nowrap",
                ...extra,
              }}
            >
              <span style={{ fontSize: fs * 0.42, color: t.bad, marginRight: fs * 0.2, fontWeight: 800 }}>不是</span>
              {w.text}
            </div>
          );
          // the slash line across the board
          const slashP = easeOut(prog(frame, sk, 5));
          const slashO = 1 - prog(frame, sk + 8, 8);
          let body: React.ReactNode;
          if (!struck) body = face();
          else if (data.style === "topple") {
            const k = easeIn(prog(frame, sk + 4, 14));
            body = face(undefined, { transformOrigin: "100% 100%", transform: `rotate(${k * 90}deg)`, filter: `grayscale(${k}) brightness(${1 - k * 0.5})` });
          } else if (data.style === "shatter") {
            const cells = [0, 1, 2, 3, 4, 5];
            body = cells.map((c) => {
              const cx = c % 3;
              const cy = Math.floor(c / 3);
              const vx = (cx - 1) * 9 + (c % 2 ? 3 : -3);
              const vy = -10 - cy * 3 + (c % 3) * 2;
              const tt = Math.max(0, since);
              return face(`polygon(${cx * 33.3}% ${cy * 50}%, ${(cx + 1) * 33.3}% ${cy * 50}%, ${(cx + 1) * 33.3}% ${(cy + 1) * 50}%, ${cx * 33.3}% ${(cy + 1) * 50}%)`, { transform: `translate(${vx * Math.min(tt, 12)}px, ${Math.min(vy * tt + 0.9 * tt * tt, bh * (1 - cy * 0.5) - bh * 0.25)}px) rotate(${(c - 2.5) * Math.min(tt, 12) * 3}deg)`, filter: `grayscale(${clamp(tt / 20)}) brightness(${1 - clamp(tt / 20) * 0.5})` }, `s${c}`);
            });
          } else {
            const tt = Math.max(0, since);
            body = (
              <>
                {face("polygon(0 0, 100% 0, 100% 30%, 0 70%)", { transformOrigin: "0% 70%", transform: `translate(${-easeOut(clamp(tt / 14)) * bw * 0.12}px, ${easeIn(clamp(tt / 12)) * bh * 0.3}px) rotate(${-easeIn(clamp(tt / 12)) * 64}deg)`, filter: `grayscale(${clamp(tt / 20)}) brightness(${1 - clamp(tt / 20) * 0.5})` }, "a")}
                {face("polygon(0 70%, 100% 30%, 100% 100%, 0 100%)", { transformOrigin: "100% 100%", transform: `translate(${easeOut(clamp(tt / 14)) * bw * 0.08}px, 0) rotate(${easeIn(clamp(tt / 10)) * 12}deg)`, filter: `grayscale(${clamp(tt / 20)}) brightness(${1 - clamp(tt / 20) * 0.5})` }, "b")}
              </>
            );
          }
          return (
            <div key={i} style={{ position: "absolute", left: x, top: G - bh, width: bw, height: bh, transformOrigin: "50% 100%", transform: `translate(${eb.dx}px, ${eb.dy}px) scaleY(${clamp(up, 0, 1.2)})`, clipPath: eb.clip, opacity: 1 - 0.65 * prog(frame, verdictAt, 10) }}>
              {/* post */}
              {body}
              {frame >= sk && slashO > 0 && (
                <svg width={bw + 80} height={bh + 80} style={{ position: "absolute", left: -40, top: -40, overflow: "visible" }}>
                  <line x1={0} y1={40 + bh * 0.7 + (40 / bw) * bh * 0.4} x2={(bw + 80) * slashP} y2={lerp(40 + bh * 0.7 + (40 / bw) * bh * 0.4, 40 + bh * 0.3 - (40 / bw) * bh * 0.4, slashP)} stroke={t.bad} strokeWidth={full ? 16 : 8} strokeLinecap="round" opacity={slashO} style={{ filter: `drop-shadow(0 0 14px ${t.bad})` }} />
                </svg>
              )}
            </div>
          );
        })}
        {/* the real cause crashes in */}
        {frame >= verdictAt && (
          <div
            style={{
              position: "absolute",
              left: W / 2 - vW / 2,
              top: vY,
              width: vW,
              height: vH,
              transformOrigin: "50% 100%",
              transform: `scale(${2 - squash}, ${squash}) translate(${eV.dx}px, 0)`,
              clipPath: eV.clip,
              borderRadius: 22,
              background: `linear-gradient(180deg, ${alpha(t.gold, 0.35)}, ${alpha(t.bg2, 0.95)})`,
              border: `5px solid ${t.gold}`,
              boxShadow: `0 0 ${40 + 50 * glowK}px ${alpha(t.gold, 0.35 + 0.35 * glowK)}, inset 0 0 40px ${alpha(t.gold, 0.25)}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: vFs * 0.4, color: t.gold }}>是</span>
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: vFs, color: t.text, whiteSpace: "nowrap", textShadow: `0 0 26px ${alpha(t.gold, 0.8)}` }}>{data.verdict}</span>
            </div>
          </div>
        )}
        {data.verdictNote && frame >= land + 6 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: G + 26, textAlign: "center", fontFamily: t.font.body, fontWeight: 800, fontSize: full ? 36 : 20, color: t.gold, opacity: eNote.opacity }}>{data.verdictNote}</div>
        )}
        {/* dust burst */}
        {frame >= land &&
          frame < land + 24 &&
          Array.from({ length: 16 }, (_, k) => {
            const d = k < 8 ? -1 : 1;
            const p = easeOut(prog(frame, land, 22));
            const a = ((k % 8) / 8) * 0.9 + 0.1;
            return <div key={k} style={{ position: "absolute", left: W / 2 + d * (vW / 2 - 10) + d * p * (80 + a * 180), top: G - 8 - Math.sin(a * Math.PI) * p * 90 + p * p * 40, width: 10 + (k % 3) * 5, height: 10 + (k % 3) * 5, borderRadius: "50%", background: alpha(t.gold, 0.7 * (1 - p)) }} />;
          })}
      </div>
      {standCues.map((c, i) => (
        <Sfx key={`u${i}`} name="pop" at={c} volume={0.26} />
      ))}
      {strikeCues.map((c, i) => (
        <Sfx key={`s${i}`} name={data.style === "shatter" ? "glitch" : "swipe"} at={c} volume={0.42} />
      ))}
      {verdictAt >= 30 && <Sfx name="riser" at={Math.max(0, verdictAt - 36)} volume={0.14} />}
      <Sfx name="impact" at={land} volume={0.5} />
      <Sfx name="ding" at={land + 4} volume={0.3} />
    </>
  );
};

export const BlameStrike: CompDef<D> = {
  id: "blame-strike",
  name: "连环劈掉假因 → 真因砸下",
  layer: "info",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["不是", "而是", "才不是", "别怪", "真正原因", "反转", "排比否定"],
  motion: { kind: "牌子立起 → 一刀劈开坠落 → 重物砸地裂开", energy: 3 },
  desc: "地面上一排立着的牌子（每块写一个流行的错误解释），说到哪条哪块被一道红刀劈成两半坠落（或碎成块 / 被推倒）；全部清空后，真因做成一块金色重牌从天上砸进空出来的中间，地面裂纹 + 尘土 + 震屏",
  use: "“不是 X，不是 Y，是 Z”的反转拍：没单不是不努力、不是没天赋，是缺工具链；号废了不是限流、不是运气，是定位错了；学不会不是笨，是方法不对",
  panel: true,
  schema,
  example: { wrongs: [{ text: "不努力" }, { text: "英语差" }, { text: "没天赋" }], verdict: "缺工具链", verdictNote: "你的时间全花在没结果的事上", style: "slash" },
  C,
};
