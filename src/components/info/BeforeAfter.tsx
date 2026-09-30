import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, noise1, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const item = z.object({ text: z.string(), at: z.number().optional() });
const side = z.object({ label: z.string(), icon: z.string().optional(), items: z.array(item).min(1).max(4), at: z.number().optional() });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  before: side.describe("以前/传统/人工：items 逐条出现（锚点）"),
  after: side.describe("现在/AI：at = 说到“现在”的时刻"),
  verdict: z.string().optional().describe("底部一句总结"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const afterAt = cueOr(data.after.at, dur * 0.55);
  const bCues = listCues(data.before.items, cueOr(data.before.at, 8) + 6, Math.max(20, afterAt - 16));
  const aCues = listCues(data.after.items, afterAt + 10, Math.max(afterAt + 14, dur * 0.85));
  const ap = easeOutBack(prog(frame, afterAt, 18));
  const beforeDim = easeInOut(prog(frame, afterAt, 16));
  const hit = frame >= afterAt && frame < afterAt + 14 ? noise1(frame * 3, seed) * 10 * (1 - (frame - afterAt) / 14) : 0;
  const single = data.before.items.length === 1 && data.after.items.length === 1;
  const maxN = Math.max(data.before.items.length, data.after.items.length);
  const itemFs = single ? 72 : maxN <= 2 ? 56 : 48;
  // card height follows the content, centred in the free area under the headline
  const ch = Math.min(height - 250 - 190, 190 + maxN * itemFs * 1.75 + (single ? 60 : 0));
  const top = 250 + (height - 250 - 190 - ch) / 2;
  const cw = 740;
  const lx = width / 2 - cw - 60;
  const rx = width / 2 + 60;
  const card = (s: z.infer<typeof side>, x: number, good: boolean, cues: number[], k: number) => {
    const col = good ? t.primary : t.bad;
    const fs = itemFs;
    return (
      <div style={{ position: "absolute", left: x, top, width: cw, height: ch, borderRadius: 28, background: `linear-gradient(160deg, ${alpha(col, good ? 0.2 : 0.1)}, ${t.glass} 45%, ${alpha(t.bg, 0.7)})`, border: `2px solid ${alpha(col, good ? 0.9 : 0.45)}`, boxShadow: good ? `0 0 80px ${alpha(col, 0.35)}` : undefined, overflow: "hidden", ...(good ? { transform: `translateX(${(1 - clamp(ap)) * 260}px) scale(${0.9 + 0.1 * ap})`, opacity: clamp(ap * 1.4) } : { transform: `scale(${1 - beforeDim * 0.06}) translateX(${hit}px)`, opacity: 1 - beforeDim * 0.45, filter: `saturate(${1 - beforeDim * 0.8})` }) }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, background: col, boxShadow: `0 0 24px ${col}` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "44px 50px 0" }}>
          {s.icon && (
            <div style={{ width: 92, height: 92, borderRadius: 24, background: alpha(col, 0.18), border: `2px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={s.icon} size={54} color={col} stroke={2.2} />
            </div>
          )}
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 64, color: good ? t.text : alpha(t.text, 0.85), letterSpacing: 4 }}>{s.label}</div>
        </div>
        <div style={{ padding: single ? "70px 50px 0" : "40px 50px 0" }}>
          {s.items.map((it, i) => {
            const at = cues[i];
            if (frame < at) return null;
            const p = easeOut(prog(frame, at, 12));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: single ? 0 : fs * 0.55, opacity: p, transform: `translateX(${(1 - p) * (good ? 40 : -40)}px)` }}>
                <div style={{ flex: "none", width: fs * 0.9, height: fs * 0.9, borderRadius: "50%", background: alpha(col, 0.18), border: `2px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={good ? "check" : "x"} size={fs * 0.5} color={col} stroke={3} />
                </div>
                <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(it.text, cw - 180, fs, 24), color: t.text, whiteSpace: "nowrap" }}>{it.text}</div>
                <Sfx name={good ? "pop" : "tick"} at={at} volume={0.3} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <>
      <Heading kicker={data.kicker ?? "BEFORE / AFTER"} title={data.title} frame={frame} width={width} />
      {card(data.before, lx, false, bCues, 0)}
      {frame >= afterAt - 2 && card(data.after, rx, true, aCues, 1)}
      <div style={{ position: "absolute", left: width / 2 - 44, top: top + ch / 2 - 44, width: 88, height: 88, borderRadius: 44, background: t.bg, border: `3px solid ${frame >= afterAt ? t.primary : alpha(t.dim, 0.5)}`, boxShadow: frame >= afterAt ? `0 0 40px ${alpha(t.primary, 0.7)}` : undefined, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 + Math.sin(frame / 7) * 0.05})`, zIndex: 3 }}>
        <Icon name="arrowRight" size={46} color={frame >= afterAt ? t.primary : t.dim} stroke={3} />
      </div>
      {data.verdict && (
        <div style={{ position: "absolute", left: 0, right: 0, top: top + ch + 30, textAlign: "center", fontFamily: t.font.body, fontWeight: 800, fontSize: 38, color: t.text, opacity: easeOut(prog(frame, aCues[aCues.length - 1] + 12, 14)) }}>{data.verdict}</div>
      )}
      <Sfx name="impact" at={afterAt} volume={0.35} />
    </>
  );
};

export const BeforeAfter: CompDef<D> = {
  id: "before-after",
  name: "以前 vs 现在",
  layer: "info",
  variants: 1,
  minSec: 2,
  maxSec: 12,
  tags: ["以前", "现在", "过去", "如今", "传统", "人工", "AI"],
  desc: "左卡“以前”逐条列出麻烦（✕），说到“现在”时右卡带冲击砸进来，左卡变灰退后，右卡逐条 ✓",
  use: "“以前得…现在只要…”“过去人工…现在 AI…”的前后对比（按讲话节奏，不是同时出现）",
  schema,
  example: {
    before: { label: "以前", icon: "tool", items: [{ text: "装采集插件", at: 8 }, { text: "学爬虫", at: 30 }, { text: "担心账号被封", at: 52 }] },
    after: { label: "现在", icon: "bot", at: 90, items: [{ text: "只说一句话" }, { text: "坐着看它干活" }] },
  },
  C,
};
