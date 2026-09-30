import React from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  topic: z.string().describe("中心的话题/痛点"),
  takes: z.array(z.object({ text: z.string(), heat: z.string().optional() })).min(3).max(8).describe("网上已有的做法（被扫描到，标“已饱和”）"),
  scanAt: z.number().optional().describe("开始扫描（锚点，如“先看看”）"),
  pick: z.object({ label: z.string().default("值得你做的角度"), text: z.string(), at: z.number().optional() }).describe("挑出来的新角度（锚点，如“角度”）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const cx = width * 0.36;
  const cy = height * 0.54;
  const R = 300;
  const scanAt = cueOr(data.scanAt, 12);
  const pickAt = cueOr(data.pick.at, dur * 0.7);
  const sweepA = frame < scanAt ? -Math.PI / 2 : -Math.PI / 2 + ((frame - scanAt) / 36) * Math.PI * 2;
  const takes = data.takes;
  const n = takes.length;
  const pos = takes.map((_, i) => {
    const a = -Math.PI / 2 + (i + 0.5) * ((Math.PI * 2) / n);
    const rr = R * (0.62 + ((i * 37) % 30) / 100);
    return { a, x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.9 };
  });
  // each take appears when the sweep first passes its angle (one turn = 36 frames)
  const seen = (a: number) => scanAt + ((a + Math.PI / 2) / (Math.PI * 2)) * 36;
  const pk = easeOutBack(prog(frame, pickAt, 20));
  const core = easeOutBack(prog(frame, 2, 18));
  const gx = width * 0.77;
  const gy = cy - 40;
  return (
    <>
      <Heading kicker={data.kicker ?? "TOPIC SCAN"} title={data.title} frame={frame} width={width} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="tr" std={8} user />
        <defs>
          <radialGradient id="trBg" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={alpha(t.primary, 0.14)} />
            <stop offset="1" stopColor={alpha(t.primary, 0)} />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R * 1.1} fill="url(#trBg)" />
        {[0.35, 0.65, 1].map((k) => (
          <circle key={k} cx={cx} cy={cy} r={R * k} fill="none" stroke={alpha(t.primary, 0.28)} strokeWidth={1.5} strokeDasharray={k === 1 ? undefined : "4 8"} />
        ))}
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke={alpha(t.primary, 0.15)} />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke={alpha(t.primary, 0.15)} />
        {frame >= scanAt && frame < pickAt + 10 &&
          new Array(14).fill(0).map((_, k) => {
            const a0 = sweepA - (k / 14) * 0.9;
            const a1 = sweepA - ((k + 1) / 14) * 0.9;
            return <path key={k} d={`M${cx},${cy} L${cx + Math.cos(a0) * R},${cy + Math.sin(a0) * R} A${R},${R} 0 0 0 ${cx + Math.cos(a1) * R},${cy + Math.sin(a1) * R} Z`} fill={t.primary} opacity={0.22 * (1 - k / 14)} />;
          })}
        {frame >= scanAt && frame < pickAt + 10 && <line x1={cx} y1={cy} x2={cx + Math.cos(sweepA) * R} y2={cy + Math.sin(sweepA) * R} stroke={t.primary} strokeWidth={3} filter="url(#tr)" />}
        {frame >= pickAt && <path d={`M${cx},${cy} C${(cx + gx) / 2},${cy - 160} ${(cx + gx) / 2},${gy} ${gx - 250},${gy}`} fill="none" stroke={t.gold} strokeWidth={3} strokeDasharray="8 8" strokeDashoffset={-frame * 2} opacity={clamp(pk)} filter="url(#tr)" />}
      </svg>
      {takes.map((tk, i) => {
        const p = pos[i];
        const s = seen(p.a);
        const on = frame >= s;
        const q = on ? easeOutBack(prog(frame, s, 12)) : 0;
        if (!on) return null;
        return (
          <div key={i} style={{ position: "absolute", left: p.x, top: p.y, transform: `translate(-50%,-50%) scale(${q})`, padding: "10px 18px", borderRadius: 14, background: alpha(t.bg2, 0.92), border: `1.5px solid ${alpha(t.dim, 0.55)}`, fontFamily: t.font.body, fontWeight: 700, fontSize: 24, color: alpha(t.text, 0.8), whiteSpace: "nowrap", opacity: frame >= pickAt ? 0.4 : 1 }}>
            {tk.text}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontFamily: t.font.mono, fontSize: 18, color: t.dim }}>
              <Icon name="fire" size={16} color={t.accent} />
              {tk.heat ?? "已有 1w+ 条"}
              <span style={{ marginLeft: 6, padding: "0 8px", borderRadius: 6, background: alpha(t.bad, 0.2), color: t.bad }}>已饱和</span>
            </div>
            <Sfx name="tick" at={s} volume={0.25} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) scale(${core})`, padding: "18px 30px", borderRadius: 20, background: `linear-gradient(135deg, ${alpha(t.primary, 0.35)}, ${alpha(t.secondary, 0.3)})`, border: `2px solid ${t.primary}`, boxShadow: `0 0 40px ${alpha(t.primary, 0.5)}`, display: "flex", alignItems: "center", gap: 12, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.topic, 380, 40, 22), color: t.text, whiteSpace: "nowrap" }}>
        <Icon name="target" size={36} color={t.primary} />
        {data.topic}
      </div>
      {frame >= pickAt && (
        <div style={{ position: "absolute", left: gx - 250, top: gy - 130, width: 520, transform: `scale(${pk})`, transformOrigin: "left center", padding: "28px 34px", borderRadius: 26, background: `linear-gradient(150deg, ${alpha(t.gold, 0.25)}, ${alpha(t.bg2, 0.95)})`, border: `3px solid ${t.gold}`, boxShadow: `0 0 70px ${alpha(t.gold, 0.5)}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: t.font.body, fontWeight: 800, fontSize: 28, color: t.gold }}>
            <Icon name="spark" size={30} color={t.gold} fill={t.gold} />
            {data.pick.label}
          </div>
          <div style={{ marginTop: 14, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.pick.text, 420, 52, 24), color: t.text, lineHeight: 1.25, whiteSpace: "nowrap" }}>{data.pick.text}</div>
        </div>
      )}
      <Sfx name="swish" at={scanAt} volume={0.25} />
      <Sfx name="ding" at={pickAt} volume={0.35} />
    </>
  );
};

export const TopicRadar: CompDef<D> = {
  id: "topic-radar",
  name: "选题雷达（找差异化角度）",
  layer: "product",
  variants: 1,
  minSec: 3,
  maxSec: 12,
  tags: ["选题", "角度", "差异化", "网上已经", "竞品", "搜索"],
  desc: "中心是你的话题，雷达扫过时周围冒出网上已有的做法（标热度和“已饱和”），最后一张金色卡片弹出“值得你做的角度”",
  use: "调研已有内容/竞品后找空白、差异化角度；“先看看网上发成什么样了，再挑出还值得做的角度”",
  schema,
  example: {
    topic: "发了没流量",
    takes: [{ text: "10 个涨粉技巧" }, { text: "算法机制揭秘" }, { text: "爆款标题公式" }, { text: "起号避坑指南" }, { text: "投流教程" }],
    scanAt: 10,
    pick: { label: "值得你做的角度", text: "新号 7 天真实起号记录", at: 120 },
  },
  C,
};
