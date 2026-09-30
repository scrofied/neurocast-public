import React from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, noise1, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  text: z.string().describe("一句短狠的话，建议 ≤ 10 字"),
  emphasis: z.array(z.string()).optional().describe("要烧成强调色的词"),
  sub: z.string().optional(),
  kicker: z.string().optional(),
  style: z.enum(["slam", "stamp", "glitch"]).optional().describe("缺省按变体：0 砸下 1 盖章 2 故障"),
  hitAt: z.number().optional().describe("砸下的时刻，默认第 4 帧"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, variant, seed }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const style = data.style ?? (["slam", "stamp", "glitch"] as const)[variant % 3];
  const hit = cueOr(data.hitAt, 4);
  const cx = width / 2;
  const cy = height / 2 - 10;
  const chars = Array.from(data.text);
  const mask = chars.map(() => false);
  for (const e of data.emphasis ?? []) {
    let i = data.text.indexOf(e);
    while (e && i >= 0) {
      for (let k = 0; k < Array.from(e).length; k++) mask[Array.from(data.text.slice(0, i)).length + k] = true;
      i = data.text.indexOf(e, i + e.length);
    }
  }
  const fs = fitFont(data.text, width - 360, 190, 60);
  const p = prog(frame, hit - 8, 8); // approach
  const land = frame >= hit;
  const since = frame - hit;
  const shakeK = land && since < 18 ? 1 - since / 18 : 0;
  const shx = noise1(frame * 2.7, seed) * 26 * shakeK;
  const shy = noise1(frame * 3.1, seed + 9) * 16 * shakeK;
  const flash = land && since < 8 ? 1 - since / 8 : 0;
  const breathe = land ? 1 + Math.sin(since / 14) * 0.008 : 1;
  let scale = 1;
  let rot = 0;
  let op = 1;
  if (style === "slam") {
    scale = land ? 1 + 0.12 * Math.exp(-since / 3) * Math.cos(since * 0.9) : 2.6 - 1.6 * easeOut(p);
    op = land ? 1 : clamp(p * 1.4);
  } else if (style === "stamp") {
    scale = land ? 1 : 1.9 - 0.9 * p * p;
    rot = -7;
    op = land ? 1 : clamp(p * 2);
  } else {
    scale = 1;
    op = clamp(prog(frame, hit - 6, 6) * 2);
  }
  const glitchK = style === "glitch" && since < 16 ? 1 - Math.max(0, since) / 16 : 0;
  const ab = (land ? Math.exp(-since / 5) : 1) * 10;
  const wave = land ? prog(frame, hit, 22) : 0;
  const sub = easeOut(prog(frame, hit + 12, 14));
  const textEl = (dx: number, color?: string, o = 1) => (
    <div style={{ position: "absolute", left: 0, right: 0, top: cy - fs * 0.62, textAlign: "center", whiteSpace: "nowrap", fontFamily: t.font.title, fontWeight: 900, fontSize: fs, lineHeight: 1.25, transform: `translateX(${dx}px)`, opacity: o }}>
      {chars.map((c, i) => (
        <span key={i} style={{ color: color ?? (mask[i] ? t.accent : t.text), textShadow: color ? undefined : `0 0 40px ${alpha(mask[i] ? t.accent : t.primary, 0.75)}` }}>
          {c}
        </span>
      ))}
    </div>
  );
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: alpha("#ffffff", 0.22 * flash) }} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {land &&
          new Array(56).fill(0).map((_, i) => {
            const a = (i / 56) * Math.PI * 2;
            const k = clamp(since / 16);
            const r0 = 260 + k * 600;
            const r1 = r0 + 90 + (i % 5) * 40;
            return <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0 * 0.55} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1 * 0.55} stroke={i % 4 ? t.primary : t.accent} strokeOpacity={(1 - k) * 0.7} strokeWidth={3} />;
          })}
        {land && <ellipse cx={cx} cy={cy} rx={wave * 1100} ry={wave * 460} fill="none" stroke={t.primary} strokeOpacity={(1 - wave) * 0.8} strokeWidth={5} />}
      </svg>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${shx}px, ${shy}px) rotate(${rot}deg) scale(${scale * breathe})`, opacity: op }}>
        {style === "stamp" && (
          <div
            style={{
              position: "absolute",
              left: cx - (Math.min(width - 300, fs * (chars.length + 1.2))) / 2,
              top: cy - fs * 0.85,
              width: Math.min(width - 300, fs * (chars.length + 1.2)),
              height: fs * 1.7,
              border: `${Math.max(6, fs * 0.06)}px solid ${t.bad}`,
              borderRadius: 24,
              boxShadow: `0 0 40px ${alpha(t.bad, 0.5)}, inset 0 0 40px ${alpha(t.bad, 0.25)}`,
            }}
          />
        )}
        {textEl(-ab, alpha(t.secondary, 0.55))}
        {textEl(ab, alpha(t.accent, 0.35))}
        {glitchK > 0
          ? [0, 1, 2, 3].map((k) => (
              <div key={k} style={{ position: "absolute", inset: 0, clipPath: `inset(${k * 25}% 0 ${75 - k * 25}% 0)`, transform: `translateX(${noise1(frame * 5 + k * 7, seed) * 60 * glitchK}px)` }}>
                {textEl(0)}
              </div>
            ))
          : textEl(0)}
      </div>
      {data.kicker && <div style={{ position: "absolute", left: 0, right: 0, top: cy - fs * 0.62 - 70, textAlign: "center", fontFamily: t.font.mono, fontSize: 22, letterSpacing: 10, color: t.primary, opacity: easeOut(prog(frame, hit + 4, 12)) }}>{data.kicker}</div>}
      {data.sub && (
        <div style={{ position: "absolute", left: 0, right: 0, top: cy + fs * 0.75, textAlign: "center", fontFamily: t.font.body, fontWeight: 700, fontSize: 42, color: t.dim, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>{data.sub}</div>
      )}
      <Sfx name={style === "stamp" ? "stamp" : style === "glitch" ? "glitch" : "impact"} at={hit} volume={0.45} />
    </>
  );
};

export const PunchText: CompDef<D> = {
  id: "punch-text",
  name: "冲击大字",
  layer: "structure",
  variants: 3,
  minSec: 1,
  maxSec: 4,
  tags: ["反问", "吐槽", "拉倒吧", "瞎胡闹", "扎心"],
  desc: "一句短话砸进画面：放大落下+镜头抖动+色散+冲击波（变体：砸下 / 红框盖章 / 故障撕裂），强调词烧成强调色",
  use: "短促有力的反问、吐槽、结论、转折（1~3 秒），例如“这不是瞎胡闹吗？”“快拉倒吧”",
  hideCaptions: true,
  schema,
  example: { text: "这不是瞎胡闹吗？", emphasis: ["瞎胡闹"] },
  C,
};
