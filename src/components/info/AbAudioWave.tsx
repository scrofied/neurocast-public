import React from "react";
import { z } from "zod";
import { easeInOut, lerp, noise1, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const clip = z.object({
  label: z.string().describe("一开始标的身份：真人的声音 / 我的声音 / 原唱"),
  reveal: z.string().describe("反转后的判词：其实是 AI / 全是合成的"),
  color: z.enum(["good", "bad"]).default("bad"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  clips: z.array(clip).min(2).max(3).describe("两条（或三条）并排的声波"),
  revealAt: z.number().optional().describe("同时撕标改判的时刻（锚点，如“其实全是 AI”）"),
  verdict: z.string().optional().describe("结论，如“你根本听不出来”"),
  verdictAt: z.number().optional(),
  playAt: z.number().optional().describe("声波开始播放抖动的时刻"),
});
type D = z.infer<typeof schema>;

// a waveform as an SVG path; seeded so each clip has its own shape but is stable across frames
const wavePath = (w: number, h: number, seed: number, frame: number, playing: number) => {
  const mid = h / 2;
  const pts: string[] = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const t = i / steps;
    // envelope: louder in the middle
    const env = 0.35 + 0.65 * Math.sin(t * Math.PI);
    const amp = env * (0.35 + 0.65 * Math.abs(noise1(i * 0.35 + seed, seed)));
    const wob = playing * Math.sin(frame * 0.35 + i * 0.5 + seed) * 0.25;
    const y = mid - (amp + wob * 0.5) * mid * 0.92;
    pts.push(`${x},${y}`);
  }
  for (let i = steps; i >= 0; i--) {
    const x = (i / steps) * w;
    const t = i / steps;
    const env = 0.35 + 0.65 * Math.sin(t * Math.PI);
    const amp = env * (0.35 + 0.65 * Math.abs(noise1(i * 0.35 + seed, seed)));
    const wob = playing * Math.sin(frame * 0.35 + i * 0.5 + seed) * 0.25;
    const y = mid + (amp + wob * 0.5) * mid * 0.92;
    pts.push(`${x},${y}`);
  }
  return `M${pts.join(" L")} Z`;
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.clips.length;
  const playAt = cueOr(data.playAt, 6);
  const revealAt = cueOr(data.revealAt, Math.round(dur * 0.62));
  const verdictAt = cueOr(data.verdictAt, revealAt + 28);
  const playing = frame >= playAt ? 1 : 0;
  const rowH = full ? Math.min(230, (H * 0.52) / n) : 120;
  const top = full ? H * 0.26 : H * 0.16;
  const left = full ? W * 0.1 : W * 0.06;
  const waveW = full ? W * 0.5 : W * 0.52;
  const sh = hitShake(frame, [revealAt], full ? 12 : 6, 16, seed);
  // the tear: after reveal the old label is ripped off diagonally
  const tearK = frame >= revealAt ? easeInOut(prog(frame, revealAt, 18)) : 0;
  // playhead sweeping each wave while it "plays"
  const headX = playing ? ((frame - playAt) * (full ? 9 : 5)) % waveW : 0;
  // 底部结论：原生从 0 回弹放大 → rise + from:0
  const eV = enterAt(frame, verdictAt, { fallback: "rise", dur: 14, from: 0 });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="aw" std={6} user />
          {data.clips.map((c, i) => {
            const y = top + i * (rowH + (full ? 26 : 12));
            const isBad = c.color === "bad";
            const col = frame >= revealAt ? (isBad ? t.bad : t.primary) : t.dim;
            return (
              <g key={i}>
                {/* baseline */}
                <line x1={left} y1={y + rowH / 2} x2={left + waveW} y2={y + rowH / 2} stroke={alpha(t.text, 0.18)} strokeWidth={2} />
                {/* the waveform */}
                <path d={wavePath(waveW, rowH * 0.8, seed + i * 13, frame, playing)} transform={`translate(${left} ${y + rowH * 0.1})`} fill={alpha(col, 0.22)} stroke={col} strokeWidth={2.5} style={{ filter: `drop-shadow(0 0 10px ${alpha(col, 0.55)})` }} />
                {/* playhead */}
                {playing && (
                  <line x1={left + headX} y1={y + 6} x2={left + headX} y2={y + rowH - 6} stroke={t.accent} strokeWidth={3} opacity={0.85} style={{ filter: `drop-shadow(0 0 8px ${t.accent})` }} />
                )}
              </g>
            );
          })}
        </svg>
        {/* clip labels: the original tag gets torn off and replaced */}
        {data.clips.map((c, i) => {
          const y = top + i * (rowH + (full ? 26 : 12));
          const isBad = c.color === "bad";
          const newCol = isBad ? t.bad : t.primary;
          const fs = full ? 30 : 16;
          const lx = left + waveW + (full ? 40 : 18);
          const lw = full ? W * 0.24 : W * 0.3;
          // 原生入场：标签淡入（无位移/缩放），所以只接 opacity
          const eL = enterAt(frame, playAt + i * 4, { fallback: "rise", dur: 12 });
          return (
            <React.Fragment key={i}>
              {/* original label */}
              <div style={{ position: "absolute", left: lx, top: y + rowH * 0.5 - (full ? 26 : 14), width: lw, height: full ? 52 : 28, transform: `translateX(${-tearK * (full ? 90 : 45)}px) rotate(${tearK * -22}deg)`, transformOrigin: "0 50%", opacity: (1 - tearK) * eL.opacity, borderRadius: 10, background: alpha(t.text, 0.1), border: `2px solid ${alpha(t.dim, 0.7)}`, display: "flex", alignItems: "center", justifyContent: "center", gap: full ? 10 : 5 }}>
                <Icon name="mic" size={full ? 24 : 13} color={t.dim} />
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.dim, whiteSpace: "nowrap" }}>{c.label}</span>
              </div>
              {/* torn edge */}
              {tearK > 0 && tearK < 1 && (
                <svg width={lw} height={rowH} style={{ position: "absolute", left: lx, top: y, opacity: 1 - tearK }}>
                  <path d={`M0,${rowH * 0.5 - 26} l${lw * tearK},${34 * tearK} l0,-12 l-${lw * tearK},-${34 * tearK} Z`} fill={alpha(t.bad, 0.5)} />
                </svg>
              )}
              {/* revealed verdict */}
              {frame >= revealAt + 6 && (() => {
                // 原生：判词条从 0 回弹放大盖章 → rise + from:0 保住基线
                const eR = enterAt(frame, revealAt + 6 + i * 5, { fallback: "rise", dur: 16, from: 0 });
                return (
                  <div style={{ position: 'absolute', left: lx, top: y + rowH * 0.5 - (full ? 30 : 16), width: lw, height: full ? 60 : 32, transform: `scale(${eR.scale}) rotate(${lerp(6, -3, eR.p)}deg) translate(${eR.dx}px, ${eR.dy}px)`, transformOrigin: "0 50%", clipPath: eR.clip, opacity: eR.opacity, borderRadius: 10, background: alpha(newCol, 0.18), border: `3px solid ${newCol}`, boxShadow: `0 0 28px ${alpha(newCol, 0.6)}`, display: "flex", alignItems: "center", justifyContent: "center", gap: full ? 10 : 5 }}>
                    <Icon name={isBad ? "bot" : "check"} size={full ? 26 : 14} color={newCol} />
                    <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(c.reveal, lw - (full ? 70 : 40), fs, 12), color: newCol, whiteSpace: "nowrap" }}>{c.reveal}</span>
                  </div>
                );
              })()}
            </React.Fragment>
          );
        })}
        {/* question mark before the reveal */}
        {frame < revealAt && frame >= playAt + 20 && (
          <div style={{ position: "absolute", left: left + waveW + (full ? 40 : 18) + 40, top: top + rowH * 0.5 - (full ? 40 : 22), fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 84 : 42, color: alpha(t.gold, 0.5 + 0.5 * Math.sin(frame / 6)) }}>?</div>
        )}
        {data.verdict && frame >= verdictAt && (
          <div style={{ position: "absolute", left: W / 2, top: top + n * (rowH + (full ? 26 : 12)) + (full ? 20 : 10), transform: `translateX(-50%) translate(${eV.dx}px, ${eV.dy}px) scale(${eV.scale})`, clipPath: eV.clip, opacity: eV.opacity, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.8, full ? 50 : 25, 15), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 24px ${alpha(t.gold, 0.6)}, 0 3px 0 #000` }}>{data.verdict}</div>
        )}
      </div>
      {data.clips.map((_, i) => (
        <Sfx key={i} name="bubbles" at={playAt + i * 6} volume={0.16} />
      ))}
      <Sfx name="glitch" at={revealAt} volume={0.42} />
      <Sfx name="stamp" at={revealAt + 8} volume={0.35} />
      {data.verdict && <Sfx name="ding" at={verdictAt} volume={0.34} />}
    </>
  );
};

export const AbAudioWave: CompDef<D> = {
  id: "ab-audio-wave",
  name: "双声波形盲测（其实是 AI）",
  layer: "info",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["声音", "波形", "克隆", "听不出来", "真人", "盲测"],
  motion: { kind: "两条波形同时播放抖动 + 播放头扫过 → 原标签被撕掉 → 反转判词盖章", energy: 2 },
  desc: "上下两条真实的声波一起播放、播放头扫过，右边各挂着一个身份标签（真人的声音 / 我的声音）；讲到揭晓那一刻，标签被斜着撕掉，换成烫金或红框的反转判词（其实是 AI），波形颜色随之改变",
  use: "讲 AI 语音克隆、真伪难辨：两个「我」的声音波形 → 全是 AI → 怎么克隆的；你根本听不出来哪个是真的",
  panel: true,
  schema,
  example: { clips: [{ label: "真人的声音", reveal: "其实是 AI", color: "bad" }, { label: "我的声音", reveal: "也是 AI", color: "bad" }], verdict: "耳朵已经不管用了" },
  C,
};
