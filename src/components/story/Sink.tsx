import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, prog, rng } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  post: z.string().default("我的新视频").describe("沉下去的那条内容"),
  views: z.string().default("播放 0"),
  label: z.string().default("石沉大海"),
  dropAt: z.number().optional().describe("落水时刻，默认第 14 帧"),
  sinkAt: z.number().optional().describe("开始下沉的时刻（锚点，如“石沉大海”）；之前卡片浮在水面上"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const surf = height * 0.5;
  const drop = cueOr(data.dropAt, 14);
  const sinkAt = Math.max(drop + 6, cueOr(data.sinkAt, drop + 6));
  const cx = width * 0.5;
  const cw = 420;
  const chh = 250;
  const falling = frame < drop;
  const fall = easeIn(prog(frame, drop - 14, 14));
  const sinkP = easeIn(prog(frame, sinkAt, Math.max(30, dur - sinkAt)));
  const float = frame < sinkAt ? Math.sin((frame - drop) / 9) * 6 : 0;
  const y = falling ? -chh + (surf - chh * 0.55 + chh) * fall : surf - chh * 0.55 + float + sinkP * (height * 0.62);
  const depth = falling ? 0 : clamp((y - (surf - chh * 0.55)) / (height * 0.5));
  const rot = falling ? -8 + 8 * fall : Math.sin((frame - drop) / 14) * 4 + depth * 10;
  const since = frame - drop;
  const bubbles = useMemo(() => {
    const r = rng(seed + 3);
    return new Array(26).fill(0).map(() => ({ born: r() * 1, dx: (r() - 0.5) * 300, sz: 4 + r() * 12, sp: 1.5 + r() * 2.5 }));
  }, [seed]);
  const eLabel = enterAt(frame, sinkAt + 2, { fallback: "rise", dur: 18, dist: 40 / 22 });
  const wavePath = (amp: number, ph: number, k: number) => {
    let d = `M0,${surf}`;
    for (let x = 0; x <= width; x += 40) {
      const ripple = since > 0 ? Math.sin((Math.abs(x - cx) - since * 14) / 30) * 14 * Math.exp(-since / 30) * Math.exp(-Math.abs(x - cx) / 500) : 0;
      d += ` L${x},${surf + Math.sin(x / 120 * k + ph) * amp + ripple}`;
    }
    return d;
  };
  return (
    <>
      <Heading kicker={data.kicker ?? "NO REACH"} title={data.title} frame={frame} width={width} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="skWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={alpha(t.primary, 0.32)} />
            <stop offset="0.35" stopColor={alpha(t.secondary, 0.14)} />
            <stop offset="1" stopColor={alpha(t.bg, 0.95)} />
          </linearGradient>
        </defs>
        <path d={`${wavePath(8, frame / 18, 1)} L${width},${height} L0,${height} Z`} fill="url(#skWater)" />
      </svg>
      {/* the post */}
      <div
        style={{
          position: "absolute",
          left: cx - cw / 2,
          top: y,
          width: cw,
          height: chh,
          transform: `rotate(${rot}deg)`,
          opacity: 1 - depth * 0.75,
          filter: `blur(${depth * 5}px) brightness(${1 - depth * 0.6})`,
          borderRadius: 20,
          overflow: "hidden",
          border: `2px solid ${alpha(t.primary, 0.6)}`,
          background: `linear-gradient(150deg, ${alpha(t.primary, 0.35)}, ${t.bg2})`,
          boxShadow: `0 20px 60px rgba(0,0,0,.5)`,
        }}
      >
        <div style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)" }}>
          <Icon name="play" size={80} color="#fff" fill={alpha("#ffffff", 0.3)} />
        </div>
        <div style={{ position: "absolute", left: 22, bottom: 18, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.post, cw - 200, 36, 20), color: "#fff" }}>{data.post}</div>
        <div style={{ position: "absolute", right: 16, bottom: 16, padding: "6px 14px", borderRadius: 99, background: alpha(t.bad, 0.85), color: "#fff", fontFamily: t.font.mono, fontWeight: 700, fontSize: 22 }}>{data.views}</div>
      </div>
      {/* water over the sinking part */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <path d={`${wavePath(8, frame / 18, 1)} L${width},${height} L0,${height} Z`} fill={alpha(t.bg2, 0.45)} />
        <path d={wavePath(8, frame / 18, 1)} fill="none" stroke={alpha(t.primary, 0.9)} strokeWidth={3} />
        <path d={wavePath(5, frame / 11 + 2, 1.7)} fill="none" stroke={alpha(t.primary, 0.35)} strokeWidth={2} transform="translate(0,26)" />
        {since > 0 &&
          [0, 1, 2].map((k) => {
            const q = clamp((since - k * 6) / 36);
            if (q <= 0 || q >= 1) return null;
            return <ellipse key={k} cx={cx} cy={surf} rx={80 + q * 520} ry={10 + q * 40} fill="none" stroke={t.primary} strokeOpacity={(1 - q) * 0.8} strokeWidth={3} />;
          })}
        {since > 0 &&
          new Array(14).fill(0).map((_, i) => {
            const q = clamp(since / 22);
            if (q >= 1) return null;
            const a = Math.PI + (i / 13) * Math.PI;
            const d = 60 + q * 220;
            return <circle key={i} cx={cx + Math.cos(a) * d} cy={surf + Math.sin(a) * d * 0.9 + q * q * 140} r={6 * (1 - q)} fill={t.text} opacity={1 - q} />;
          })}
        {frame > sinkAt + 4 &&
          bubbles.map((b, i) => {
            const k = frame - sinkAt - 4;
            const age = (k - i * 3) % 60;
            if (age < 0 || k < i * 3) return null;
            const bx = cx + b.dx + Math.sin(age / 6 + i) * 8;
            const by = y + chh / 2 - age * b.sp;
            if (by < surf + 6) return null;
            return <circle key={i} cx={bx} cy={by} r={b.sz * 0.5} fill="none" stroke={alpha(t.text, 0.55)} strokeWidth={1.5} />;
          })}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: surf - 330, textAlign: "center", opacity: eLabel.opacity }}>
        {Array.from(data.label).map((c, i) => (
          <span key={i} style={{ display: "inline-block", fontFamily: t.font.title, fontWeight: 900, fontSize: 130, color: t.text, letterSpacing: 18, transform: `translateY(${Math.sin(frame / 10 + i * 0.9) * 8 + eLabel.dy}px)`, textShadow: `0 0 40px ${alpha(t.primary, 0.6)}` }}>
            {c}
          </span>
        ))}
      </div>
      <Sfx name="impact" at={drop} volume={0.25} />
      <Sfx name="bubbles" at={sinkAt} volume={0.4} />
    </>
  );
};

export const Sink: CompDef<D> = {
  id: "sink",
  name: "石沉大海",
  layer: "story",
  variants: 1,
  minSec: 2,
  maxSec: 8,
  tags: ["石沉大海", "没流量", "0播放", "没人看", "发出去没反应"],
  motion: { kind: "视频卡片坠落砸水并下沉（涟漪水花气泡）+ 上方大字淡入上浮", energy: 2 },
  desc: "你的视频卡片从天而降砸进水面（涟漪+水花），然后慢慢沉底变暗，气泡上浮，卡片上“播放 0”，上方大字波动",
  use: "投入了却没有回响：发了没人看的视频、投了没回音的简历、上线没人用的功能、砸进去没水花的广告费（post / views / label 全可改）",
  schema,
  example: { post: "我的新视频", views: "播放 0", label: "石沉大海" },
  C,
};
