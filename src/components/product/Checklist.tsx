import React from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  items: z.array(z.object({ text: z.string(), icon: z.string().optional(), at: z.number().optional().describe("点亮打勾的时刻（锚点=说到这一项）") })).min(2).max(6),
  done: z.object({ text: z.string(), at: z.number().optional() }).optional().describe("全部完成后的横幅，如“一条全配齐”"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const items = data.items;
  const n = items.length;
  const cues = listCues(items, 12, Math.max(20, dur * 0.65));
  const doneAt = data.done ? cueOr(data.done.at, cues[n - 1] + 18) : Infinity;
  const tw = Math.min(260, (width - 260 - (n - 1) * 28) / n);
  const th = tw * 1.12;
  const total = n * tw + (n - 1) * 28;
  const x0 = (width - total) / 2;
  const y0 = height / 2 - th / 2 - 30;
  const doneN = cues.filter((c) => frame >= c + 6).length;
  // linear: every item contributes its own 10-frame fill
  const pct = cues.reduce((a, c) => a + clamp((frame - c) / 10), 0) / n;
  const dp = easeOutBack(prog(frame, doneAt, 18));
  return (
    <>
      <Heading kicker={data.kicker ?? "ALL-IN-ONE"} title={data.title} frame={frame} width={width} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="ck" std={6} user />
        <line x1={x0 + tw / 2} y1={y0 + th / 2} x2={x0 + total - tw / 2} y2={y0 + th / 2} stroke={alpha(t.primary, 0.2)} strokeWidth={6} />
        <line x1={x0 + tw / 2} y1={y0 + th / 2} x2={x0 + tw / 2 + (total - tw) * clamp((doneN - 1) / Math.max(1, n - 1))} y2={y0 + th / 2} stroke={t.primary} strokeWidth={6} filter="url(#ck)" opacity={doneN > 0 ? 1 : 0} />
        {[0, 1, 2, 3].map((k) => {
          const q = (frame / 40 + k / 4) % 1;
          return <circle key={k} cx={x0 + tw / 2 + (total - tw) * q} cy={y0 + th / 2} r={5} fill={t.text} opacity={0.6 * Math.sin(q * Math.PI)} />;
        })}
      </svg>
      {items.map((it, i) => {
        const at = cues[i];
        const appear = easeOutBack(prog(frame, 2 + i * 3, 16));
        const lit = frame >= at;
        const lp = easeOutBack(prog(frame, at, 14));
        const icon = it.icon ?? guessIcon(it.text) ?? "check";
        return (
          <div key={i} style={{ position: "absolute", left: x0 + i * (tw + 28), top: y0, width: tw, height: th, transform: `scale(${appear * (lit ? 1 + 0.06 * Math.sin(clamp((frame - at) / 14) * Math.PI) : 0.94)})`, opacity: clamp(appear * 1.4) * (lit ? 1 : 0.55), borderRadius: 26, background: lit ? `linear-gradient(160deg, ${alpha(t.primary, 0.3)}, ${alpha(t.bg2, 0.95)})` : alpha(t.bg2, 0.85), border: `2px solid ${alpha(t.primary, lit ? 0.9 : 0.25)}`, boxShadow: lit ? `0 0 40px ${alpha(t.primary, 0.4)}` : undefined, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
            <div style={{ width: tw * 0.42, height: tw * 0.42, borderRadius: tw * 0.12, background: lit ? t.primary : alpha(t.primary, 0.12), display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={icon} size={tw * 0.24} color={lit ? t.bg : t.primary} stroke={2.2} />
            </div>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(it.text, tw - 30, 40, 20), color: lit ? t.text : t.dim, whiteSpace: "nowrap" }}>{it.text}</div>
            {lit && (
              <div style={{ position: "absolute", right: -14, top: -14, width: 52, height: 52, borderRadius: 26, background: t.primary, boxShadow: `0 0 20px ${t.primary}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${lp})` }}>
                <Icon name="check" size={32} color={t.bg} stroke={3.4} />
              </div>
            )}
            <Sfx name="tick" at={at} volume={0.4} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: x0, width: total, top: y0 + th + 50 }}>
        <div style={{ height: 14, borderRadius: 7, background: alpha(t.primary, 0.12), overflow: "hidden" }}>
          <div style={{ width: `${pct * 100}%`, height: "100%", background: `linear-gradient(90deg, ${t.primary}, ${t.secondary})`, boxShadow: `0 0 14px ${t.primary}` }} />
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontFamily: t.font.mono, fontSize: 24, color: t.dim }}>
          <span>{`${doneN}/${n}`}</span>
          <span style={{ color: t.primary }}>{`${Math.round(pct * 100)}%`}</span>
        </div>
      </div>
      {data.done && frame >= doneAt && (
        <div style={{ position: "absolute", left: 0, right: 0, top: y0 - 150, display: "flex", justifyContent: "center" }}>
          <div style={{ transform: `scale(${dp})`, padding: "16px 44px", borderRadius: 20, background: `linear-gradient(90deg, ${alpha(t.gold, 0.25)}, ${alpha(t.gold, 0.1)})`, border: `3px solid ${t.gold}`, boxShadow: `0 0 50px ${alpha(t.gold, 0.55)}`, display: "flex", alignItems: "center", gap: 16, fontFamily: t.font.title, fontWeight: 900, fontSize: 56, color: t.gold, whiteSpace: "nowrap" }}>
            <Icon name="check" size={52} color={t.gold} stroke={3.4} />
            {data.done.text}
          </div>
        </div>
      )}
      {data.done && <Sfx name="success" at={doneAt} volume={0.35} />}
    </>
  );
};

export const Checklist: CompDef<D> = {
  id: "checklist",
  name: "一条龙交付清单",
  layer: "product",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["一条龙", "全配齐", "全套", "一键", "封面", "正文", "标签", "分镜"],
  desc: "一排交付物图块（自动配图标：封面/正文/标签/分镜/成片…），说到哪项哪项点亮打勾，进度条走满，最后金色横幅“一条全配齐”",
  use: "一个工具/流程把多项产出全包了；“从 A、B、C 一直到 D，一条全配齐”",
  schema,
  example: { items: [{ text: "封面" }, { text: "正文" }, { text: "话题标签" }, { text: "分镜" }, { text: "口播成片" }], done: { text: "一条全配齐" } },
  C,
};
