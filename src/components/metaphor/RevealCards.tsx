import React from "react";
import { z } from "zod";
import { easeIn, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const card = z.object({ text: z.string().describe("牌面上的结论，短"), note: z.string().optional(), icon: z.string().optional(), at: z.number().optional().describe("翻开这张的时刻（锚点）") });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  cards: z.array(card).min(1).max(4).describe("桌上扣着、逐张翻开的牌"),
  keyCard: card.optional().describe("压轴底牌：最后从天上重重拍到桌中间"),
  keyAt: z.number().optional().describe("底牌拍下的时刻（锚点，如“底牌”）"),
  dealAt: z.number().optional().describe("发牌时刻（牌滑到桌上）"),
});
type D = z.infer<typeof schema>;

const Face: React.FC<{ c: z.infer<typeof card>; w: number; h: number; col: string; big?: boolean }> = ({ c, w, h, col, big }) => {
  const t = useTheme();
  const ic = c.icon ?? guessIcon(c.text);
  const fs = fitFont(c.text, w * 0.84, big ? h * 0.2 : h * 0.16, 18);
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: w * 0.08, background: `linear-gradient(160deg, ${alpha(col, 0.28)}, ${t.bg2} 70%)`, border: `3px solid ${col}`, boxShadow: `0 0 ${big ? 60 : 24}px ${alpha(col, big ? 0.7 : 0.35)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: h * 0.05, backfaceVisibility: "hidden" }}>
      <div style={{ position: "absolute", left: w * 0.08, top: h * 0.05, fontFamily: t.font.mono, fontSize: h * 0.07, color: col, fontWeight: 800 }}>♠</div>
      <div style={{ position: "absolute", right: w * 0.08, bottom: h * 0.05, fontFamily: t.font.mono, fontSize: h * 0.07, color: col, fontWeight: 800, transform: "rotate(180deg)" }}>♠</div>
      {ic && <Icon name={ic} size={h * (big ? 0.24 : 0.2)} color={col} />}
      <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap", textShadow: `0 0 12px ${alpha(col, 0.6)}` }}>{c.text}</div>
      {c.note && <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: fitFont(c.note, w * 0.84, h * 0.075, 12), color: t.dim, whiteSpace: "nowrap" }}>{c.note}</div>}
    </div>
  );
};

const Back: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const t = useTheme();
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: w * 0.08, transform: "rotateY(180deg)", backfaceVisibility: "hidden", background: `repeating-linear-gradient(45deg, ${alpha(t.secondary, 0.55)} 0 ${w * 0.05}px, ${alpha(t.secondary, 0.25)} ${w * 0.05}px ${w * 0.1}px), ${t.bg2}`, border: `3px solid ${alpha(t.secondary, 0.9)}`, boxShadow: `inset 0 0 0 ${w * 0.05}px ${alpha(t.bg, 0.6)}` }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: w * 0.36, height: w * 0.36, transform: "translate(-50%,-50%) rotate(45deg)", border: `3px solid ${alpha(t.text, 0.5)}`, background: alpha(t.bg, 0.5) }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontFamily: t.font.title, fontWeight: 900, fontSize: w * 0.2, color: alpha(t.text, 0.7) }}>?</div>
    </div>
  );
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.cards.length;
  const key = data.keyCard;
  const dealAt = cueOr(data.dealAt, 4);
  const keyAt = cueOr(data.keyAt, key ? Math.round(dur * 0.72) : dur + 99);
  const cues = listCues(data.cards, dealAt + 22, key ? keyAt - 24 : dur * 0.7);
  const cw = full ? Math.min(250, (W * 0.8) / Math.max(n, 3) - 30) : Math.min(150, (W * 0.9) / n - 14);
  const ch = cw * 1.42;
  const gap = full ? 34 : 14;
  const rowW = n * cw + (n - 1) * gap;
  const tableY = full ? H * 0.56 : H * 0.55;
  const sh = hitShake(frame, [keyAt], full ? 16 : 8, 12, 5);
  // once the key card lands the row slides apart to make room in the middle
  const part = key ? easeInOut(prog(frame, keyAt - 10, 14)) : 0;
  const kw = cw * 1.3;
  const kh = kw * 1.42;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* felt table in perspective */}
        <div style={{ position: "absolute", left: "50%", top: tableY - ch * 0.2, width: W * 1.1, height: H * 0.75, transform: "translateX(-50%) perspective(900px) rotateX(58deg)", transformOrigin: "50% 0%", borderRadius: "50% 50% 0 0 / 22% 22% 0 0", background: `radial-gradient(ellipse at 50% 20%, ${alpha(t.primary, 0.22)}, ${alpha(t.bg2, 0.9)} 55%, transparent 80%)`, border: `2px solid ${alpha(t.primary, 0.3)}` }} />
        {/* spotlight */}
        <div style={{ position: "absolute", left: W / 2 - W * 0.35, top: 0, width: W * 0.7, height: H, background: `radial-gradient(ellipse at 50% 60%, ${alpha(t.text, 0.08)}, transparent 60%)` }} />
        {data.cards.map((c, i) => {
          const deal = easeOut(prog(frame, dealAt + i * 4, 16));
          const baseX = W / 2 - rowW / 2 + i * (cw + gap);
          const side = i < n / 2 ? -1 : 1;
          const off = key ? side * part * (kw / 2 + gap) : 0;
          const x = lerp(W / 2 - cw / 2, baseX + off, deal);
          const y = lerp(-ch * 1.4, tableY - ch / 2, deal);
          const fl = easeInOut(prog(frame, cues[i], 12));
          const lift = Math.sin(fl * Math.PI) * 30;
          const lit = frame >= cues[i] + 6;
          const dimK = key ? prog(frame, keyAt, 10) * 0.45 : 0;
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y - lift, width: cw, height: ch, perspective: 1000, opacity: deal > 0 ? 1 - dimK : 0 }}>
              <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateY(${180 - fl * 180}deg) rotateZ(${lerp(side * 14, (i - (n - 1) / 2) * 2, deal)}deg)` }}>
                <Face c={c} w={cw} h={ch} col={lit ? t.primary : t.dim} />
                <Back w={cw} h={ch} />
              </div>
            </div>
          );
        })}
        {key && frame >= keyAt - 10 && (() => {
          const k = prog(frame, keyAt - 10, 10);
          const y = lerp(-kh * 1.6, tableY - kh / 2 - 10, easeIn(k));
          const s = lerp(1.9, 1, easeIn(k));
          const glow = 0.6 + 0.4 * Math.sin(frame * 0.15);
          return (
            <>
              {frame >= keyAt && <div style={{ position: "absolute", left: W / 2 - kw, top: tableY - kh * 0.1, width: kw * 2, height: kh * 0.6, borderRadius: "50%", background: `radial-gradient(ellipse, ${alpha(t.gold, 0.4 * glow)}, transparent 70%)` }} />}
              {frame >= keyAt && frame < keyAt + 18 && <div style={{ position: "absolute", left: W / 2 - kw * prog(frame, keyAt, 18) * 1.6, top: tableY - kw * prog(frame, keyAt, 18) * 0.5, width: kw * 3.2 * prog(frame, keyAt, 18), height: kw * prog(frame, keyAt, 18), borderRadius: "50%", border: `4px solid ${alpha(t.gold, 1 - prog(frame, keyAt, 18))}` }} />}
              <div style={{ position: "absolute", left: W / 2 - kw / 2, top: y, width: kw, height: kh, transform: `scale(${s}) rotate(${lerp(-12, -2, k)}deg)` }}>
                <Face c={key} w={kw} h={kh} col={t.gold} big />
              </div>
              {frame >= keyAt + 8 && <div style={{ position: "absolute", left: W / 2, top: tableY - kh / 2 - (full ? 64 : 34), transform: `translateX(-50%) scale(${easeOutBack(prog(frame, keyAt + 8, 12))})`, fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 30 : 18, letterSpacing: 6, color: t.gold }}>底 牌</div>}
            </>
          );
        })()}
      </div>
      {data.cards.map((c, i) => (
        <Sfx key={`s${i}`} name="swish" at={cues[i]} volume={0.3} />
      ))}
      <Sfx name="swipe" at={dealAt} volume={0.25} />
      {key && <Sfx name="riser" at={Math.max(0, keyAt - 46)} volume={0.2} />}
      {key && <Sfx name="impact" at={keyAt} volume={0.5} />}
      {key && <Sfx name="ding" at={keyAt + 8} volume={0.3} />}
    </>
  );
};

export const RevealCards: CompDef<D> = {
  id: "reveal-cards",
  name: "亮底牌（逐张翻牌 + 压轴拍下）",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 9,
  tags: ["底牌", "亮底牌", "翻牌", "摊牌", "揭晓", "王牌", "杀手锏"],
  motion: { kind: "发牌滑入 → 3D 翻牌 → 金色底牌从天上拍下震桌", energy: 3 },
  desc: "聚光灯下一张牌桌，一排扣着的牌滑上桌，随配音逐张 3D 翻开（每张一个结论/要点）；最后一张金色底牌从画面上方重重拍到桌子正中，其余牌向两边让开、变暗，桌面冲击环 + 震屏",
  use: "逐条揭晓 + 压轴结论：二十秒我直接亮底牌、同行的保本底牌逐张摊开、35 岁真正的翻盘底牌、三个隐藏福利最后一个最狠",
  panel: true,
  schema,
  example: { cards: [{ text: "不讲语法" }, { text: "不装环境" }, { text: "不写代码" }], keyCard: { text: "只教你提需求", note: "今天唯一要学的" } },
  C,
};

