import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, prog, rng } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  material: z.enum(["doc", "card", "note", "logo"]).default("doc").describe("堆的是什么：doc 文档页 / card 单据卡片 / note 便签 / logo 工具图标"),
  label: z.string().optional().describe("每一张上写的字（doc/card/note），如“合同”“报价单”"),
  logos: z.array(z.string()).optional().describe("logo 模式：图标名或工具名（按文字猜图标）"),
  volume: z.number().default(104).describe("总量数字，如 104"),
  unit: z.string().default("页"),
  endless: z.boolean().default(true).describe("计数器最后跳成 “104/∞”（永远翻不完）"),
  pileAt: z.number().optional().describe("开始往下砸材料的时刻（锚点）"),
  crushAt: z.number().optional().describe("压扁的时刻（锚点，如“AI”“其实只要”）；不给 = 不压，只演堆成山"),
  crusher: z.string().default("AI").describe("压下来的那块板上的字"),
  payoff: z.array(z.object({ text: z.string(), at: z.number().optional() })).max(4).default([]).describe("压扁后剩下的 2~4 行能照做的短句"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const pileAt = cueOr(data.pileAt, 6);
  const hasCrush = data.crushAt !== undefined || data.payoff.length > 0;
  const crushAt = hasCrush ? cueOr(data.crushAt, dur * 0.55) : dur + 999;
  const fillEnd = Math.min(crushAt - 4, dur - 4);
  const G = H * (full ? 0.86 : 0.84);
  const cx = full ? W * 0.42 : W / 2;
  const pw = full ? Math.min(420, W * 0.24) : W * 0.6;
  const th = full ? 22 : 12; // thickness of one item in the stack
  const N = Math.ceil((G + 40) / th) + 6; // enough to rise off the top of the frame
  const items = useMemo(() => {
    const r = rng(seed + 11);
    return Array.from({ length: N }, () => ({ dx: (r() - 0.5) * pw * 0.14, rot: (r() - 0.5) * 7, fromX: (r() - 0.5) * W * 0.5, tone: r() }));
  }, [seed, N, pw, W]);
  // drop times accelerate: item k lands at pileAt + span * (k/N)^0.55
  const span = Math.max(20, fillEnd - pileAt);
  const landT = (k: number) => pileAt + span * Math.pow(k / N, 0.5);
  const FALL = 8;
  const landed = items.filter((_, k) => frame >= landT(k) + FALL).length;
  // camera: once the pile rises above ~45% of the screen, pull back so we see it going through the roof
  const topY = G - landed * th;
  const cam = 0; void topY;
  const camS = 1 - cam;
  const cntK = clamp((frame - pileAt) / span);
  const cnt = Math.round(data.volume * Math.pow(cntK, 0.8));
  const infinite = data.endless && frame >= fillEnd - 6;
  // crush
  const cr = easeIn(prog(frame, crushAt, 10));
  const slabY = lerp(-H * 0.3, G - th * 1.6, cr);
  const crushed = frame >= crushAt + 10;
  const flat = crushed ? easeOut(prog(frame, crushAt + 10, 8)) : 0;
  const pCues = listCues(data.payoff, crushAt + 24, Math.min(dur - 16, crushAt + 24 + data.payoff.length * 16));
  const slabLift = easeInOut(prog(frame, crushAt + 18, 14));
  const sh = hitShake(frame, [crushAt + 10], 26, 16, seed);
  const logos = data.logos?.length ? data.logos : ["chat", "doc", "globe", "bot", "chart", "grid", "search", "film"];
  const col = (k: number) => (data.material === "note" ? [t.gold, t.accent, t.primary][k % 3] : data.material === "card" ? [t.primary, t.secondary, t.accent][k % 3] : t.text);

  const renderItem = (k: number, x: number, y: number, rot: number, o = 1) => {
    const it = items[k];
    const c = col(k);
    if (data.material === "logo") {
      const s = th * 3.2;
      return (
        <div key={k} style={{ position: "absolute", left: x - s / 2, top: y - s + th, width: s, height: s, borderRadius: s * 0.26, background: alpha(t.bg2, 0.95), border: `2px solid ${alpha(t.primary, 0.6)}`, transform: `rotate(${rot * 3}deg)`, opacity: o, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={guessIcon(logos[k % logos.length]) ?? logos[k % logos.length]} size={s * 0.6} color={[t.primary, t.accent, t.secondary, t.gold][k % 4]} />
        </div>
      );
    }
    return (
      <div
        key={k}
        style={{
          position: "absolute",
          left: x - pw / 2,
          top: y,
          width: pw,
          height: th,
          transform: `rotate(${rot}deg)`,
          opacity: o,
          borderRadius: data.material === "note" ? 2 : 4,
          background: data.material === "doc" ? `linear-gradient(180deg, ${alpha(c, 0.95 - it.tone * 0.2)}, ${alpha(c, 0.7)})` : alpha(c, 0.85 - it.tone * 0.25),
          borderBottom: `2px solid ${alpha("#000", 0.35)}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 14,
          overflow: "hidden",
        }}
      >
        {data.label && full && <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: th * 0.7, color: alpha(t.bg, 0.7), whiteSpace: "nowrap" }}>{data.label}</span>}
        {data.material === "doc" && <div style={{ marginLeft: 12, flex: 1, height: 2, background: alpha(t.bg, 0.25), marginRight: 16 }} />}
      </div>
    );
  };

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${(cx / W) * 100}% ${(G / H) * 100}%`, transform: `scale(${camS})` }}>
          <div style={{ position: "absolute", left: cx - pw, width: pw * 2, top: G, height: 4, background: alpha(t.primary, 0.7), boxShadow: `0 0 16px ${alpha(t.primary, 0.7)}` }} />
          {!crushed &&
            items.map((it, k) => {
              const lt = landT(k);
              if (frame < lt) return null;
              const f = easeIn(prog(frame, lt, FALL));
              const restY = G - (k + 1) * th;
              const y = lerp(-H * 0.9, restY, f);
              const x = cx + lerp(it.fromX, it.dx, f);
              // squeeze under the slab while it comes down
              const sq = cr > 0 ? clamp((slabY + th * 2 - y) / th, 0, 1) : 0;
              if (sq >= 1) return null;
              return renderItem(k, x, y, it.rot * (1 - f * 0.4), 1);
            })}
          {/* the squashed result: a thin glowing slab */}
          {crushed && (
            <div style={{ position: "absolute", left: cx - pw * 0.6, width: pw * 1.2, top: G - th * 1.2 * (1 - flat * 0.3), height: th * 1.2, borderRadius: 6, background: `linear-gradient(90deg, ${t.gold}, ${t.accent})`, boxShadow: `0 0 ${30 + 20 * flat}px ${alpha(t.gold, 0.7)}` }} />
          )}
          {/* crusher slab */}
          {frame >= crushAt && (
            <div style={{ position: "absolute", left: cx - pw * 0.75, width: pw * 1.5, top: slabY - H * 0.35 - slabLift * H * 0.8, height: H * 0.35, opacity: 1 - slabLift, borderRadius: 18, background: `linear-gradient(180deg, ${alpha(t.primary, 0.25)}, ${alpha(t.primary, 0.75)})`, border: `4px solid ${t.primary}`, boxShadow: `0 0 50px ${alpha(t.primary, 0.6)}`, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 30 }}>
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.crusher, pw * 1.3, full ? 110 : 50), color: t.text, textShadow: `0 0 20px ${t.primary}`, whiteSpace: "nowrap" }}>{data.crusher}</span>
            </div>
          )}
        </div>
        {/* counter */}
        {frame >= pileAt && !crushed && (
          <div style={{ position: "absolute", right: full ? W * 0.06 : 20, top: full ? H * 0.3 : H * 0.12, textAlign: "right", fontFamily: t.font.title, fontWeight: 900, color: infinite ? t.bad : t.text, textShadow: "0 4px 18px rgba(0,0,0,.8)" }}>
            <div style={{ fontSize: full ? 30 : 16, color: t.dim, fontWeight: 700 }}>已翻到</div>
            <div style={{ fontSize: full ? 150 : 60, lineHeight: 1, fontVariantNumeric: "tabular-nums", transform: infinite ? `scale(${1 + 0.06 * Math.sin(frame / 2)})` : undefined }}>
              {cnt}
              <span style={{ fontSize: full ? 60 : 26, color: t.dim }}>/{infinite ? "∞" : data.volume}</span>
            </div>
            <div style={{ fontSize: full ? 40 : 18, color: t.dim }}>{data.unit}</div>
          </div>
        )}
        {/* payoff lines rise out of the flattened slab */}
        {data.payoff.map((p, i) => {
          const c = pCues[i];
          if (frame < c) return null;
          const k = easeOutBack(prog(frame, c, 14));
          const rowH = full ? 92 : 48;
          const top0 = G - th * 3 - data.payoff.length * (rowH + 18);
          const yy = lerp(G - th * 2, top0 + i * (rowH + 18), k);
          const bw = full ? Math.min(W * 0.5, 820) : W * 0.84;
          return (
            <div key={i} style={{ position: "absolute", left: (full ? cx : W / 2) - bw / 2, top: yy, width: bw, height: rowH, borderRadius: 16, background: alpha(t.bg, 0.88), border: `3px solid ${t.gold}`, boxShadow: `0 0 22px ${alpha(t.gold, 0.4)}`, display: "flex", alignItems: "center", gap: 18, padding: "0 26px", opacity: clamp(k * 1.5) }}>
              <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: rowH * 0.42, color: t.gold }}>{i + 1}</span>
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(p.text, bw - 110, rowH * 0.5, 16), color: t.text, whiteSpace: "nowrap" }}>{p.text}</span>
            </div>
          );
        })}
      </div>
      {Array.from({ length: 10 }, (_, k) => {
        const idx = Math.floor((k / 10) * Math.min(N, 40));
        return <Sfx key={k} name="swipe" at={landT(idx) + FALL} volume={0.14 + k * 0.012} />;
      })}
      {data.endless && <Sfx name="glitch" at={fillEnd - 6} volume={0.25} />}
      {hasCrush && crushAt < dur && <Sfx name="impact" at={crushAt + 10} volume={0.55} />}
      {pCues.map((c, i) => (
        <Sfx key={`p${i}`} name="pop" at={c} volume={0.32} />
      ))}
    </>
  );
};

export const PileCrush: CompDef<D> = {
  id: "pile-crush",
  name: "堆成山 · 一板压扁",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["堆成山", "几百页", "千页", "太多了", "看不完", "乱成一团", "工具墙", "信息过载"],
  motion: { kind: "材料越砸越快堆出画面 + 计数器狂跳 → 巨板压扁 → 短句升起", energy: 3 },
  desc: "文档页 / 单据 / 便签 / 工具图标从天上一张张砸下来，越来越快，堆到顶出画面（镜头往后拉），计数器狂跳停在 104/∞；然后一块写着“AI”的巨板轰然压下，整堆被压成一条发光薄板，从里面升起 2~4 行能照做的短句",
  use: "量级过载：被 104 页官方指南劝退、堆成山的待审合同、几十个 AI 工具的工具墙、乱成一团的客户笔记——以及“其实你只需要这 3 条”的收束",
  panel: true,
  schema,
  example: { material: "doc", label: "官方指南", volume: 104, unit: "页", crusher: "AI 帮你读", payoff: [{ text: "注册拿 API Key" }, { text: "复制这段配置" }, { text: "跑通第一个请求" }] },
  C,
};
