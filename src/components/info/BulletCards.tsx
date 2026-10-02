import React from "react";
import { z } from "zod";
import { clamp, easeOut, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const itemS = z.object({
  text: z.string(),
  sub: z.string().optional(),
  tone: z.enum(["good", "bad", "warn", "info", "neutral"]).default("neutral").describe("good=对/推荐 bad=错/痛点 warn=注意 info=说明"),
  icon: z.string().optional().describe("图标名，见 lib/icons.tsx；缺省按 tone"),
  at: z.number().optional().describe("出现时刻（锚点）"),
  strike: z.boolean().optional().describe("出现后被红线划掉（被否定的做法）"),
});
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  items: z.array(itemS).min(1).max(6),
});
type D = z.infer<typeof schema>;

const TONE_ICON = { good: "check", bad: "x", warn: "warn", info: "info", neutral: "spark" } as const;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: bw, height: bh } = useBox();
  const full = bw >= 900;
  const items = data.items;
  const n = items.length;
  const cues = listCues(items, 8, Math.max(12, dur * 0.55));
  const toneCol = (tone: string) => (tone === "good" ? t.primary : tone === "bad" ? t.bad : tone === "warn" ? t.accent : tone === "info" ? t.secondary : t.primary);
  const areaTop = full ? 250 : data.title || data.kicker ? 96 : 26;
  const areaH = full ? 620 : bh - areaTop - 40;
  const gap = full ? 22 : 14;
  const ch = Math.min(full ? 132 : 108, (areaH - gap * (n - 1)) / n);
  const cw = full ? Math.min(1100, bw - 400) : bw - 32;
  const ic = Math.min(ch * 0.52, full ? 70 : 50);
  const textW = cw - ic - (full ? 30 + 26 + 20 : 16 + 12 + 12);
  const x0 = (bw - cw) / 2;
  const y0 = areaTop + (areaH - (ch * n + gap * (n - 1))) / 2;
  const latest = cues.reduce((k, c, i) => (frame >= c ? i : k), -1);
  return (
    <>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={bw} />
      {items.map((it, i) => {
        const at = cues[i];
        if (frame < at) return null;
        // 原生：卡片从左侧 -80/-40px 滑入 + 轻微放大 + 淡入 → slide-l，dist 折算成原生的位移量
        const ei = enterAt(frame, at, { fallback: "slide-l", dur: 16, dist: full ? 80 / 240 : 40 / 240, seed: i });
        const col = toneCol(it.tone);
        const fresh = i === latest ? 1 - clamp((frame - at) / 26) : 0;
        const strike = it.strike ? easeOut(prog(frame, at + 12, 12)) : 0;
        const fs = fitFont(it.text, textW, full ? 50 : 34, 16);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x0,
              top: y0 + i * (ch + gap),
              width: cw,
              height: ch,
              borderRadius: 18,
              background: `linear-gradient(100deg, ${alpha(col, 0.16 + fresh * 0.14)}, ${t.glass} 45%, ${alpha(t.bg, 0.55)})`,
              border: `1.5px solid ${alpha(col, 0.35 + fresh * 0.5)}`,
              boxShadow: `0 0 ${24 + fresh * 30}px ${alpha(col, 0.12 + fresh * 0.3)}`,
              transform: `translate(${ei.dx}px, ${ei.dy}px) scale(${ei.scale})`,
              clipPath: ei.clip,
              opacity: ei.opacity * (strike ? 1 - strike * 0.35 : 1),
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: col, boxShadow: `0 0 16px ${col}` }} />
            <div style={{ flex: "none", marginLeft: full ? 30 : 16, width: ic, height: ic, borderRadius: "50%", border: `2px solid ${col}`, background: alpha(col, 0.14), display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={it.icon ?? TONE_ICON[it.tone]} size={ic * 0.55} color={col} stroke={2.6} />
            </div>
            <div style={{ marginLeft: full ? 26 : 12, marginRight: 12, position: "relative", minWidth: 0 }}>
              <div style={{ position: "relative", display: "inline-block", fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap", lineHeight: 1.2 }}>
                {it.text}
                {strike > 0 && <div style={{ position: "absolute", left: -4, top: "54%", height: 4, width: `${strike * 104}%`, background: t.bad, boxShadow: `0 0 10px ${t.bad}`, borderRadius: 2 }} />}
              </div>
              {it.sub && <div style={{ marginTop: 6, fontFamily: t.font.body, fontSize: full ? 26 : 17, color: t.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.sub}</div>}
            </div>
            <Sfx name="pop" at={at} volume={0.3} />
            {it.strike && <Sfx name="swish" at={at + 12} volume={0.25} />}
          </div>
        );
      })}
    </>
  );
};

export const BulletCards: CompDef<D> = {
  id: "bullet-cards",
  name: "要点逐条出现",
  layer: "info",
  variants: 1,
  minSec: 2,
  maxSec: 12,
  tags: ["要点", "清单", "痛点", "原因", "列举"],
  motion: { kind: "卡片逐条从左侧滑入 + 最新一条高亮脉冲 + 否定项被红线划掉", energy: 2 },
  desc: "玻璃卡片一条条滑入（跟着说到的那个词出现），左侧色条+图标表示对/错/注意，可让否定项被红线划掉",
  use: "列举原因、痛点、注意事项、以前的麻烦做法；也适合放进口播侧栏做“字幕式要点”",
  panel: true,
  schema,
  example: {
    title: "以前挖评论有多难",
    items: [
      { text: "装采集插件", tone: "bad", at: 10 },
      { text: "学爬虫", tone: "bad", at: 40 },
      { text: "天天担心账号被封", tone: "warn", at: 70, strike: true },
    ],
  },
  C,
};
