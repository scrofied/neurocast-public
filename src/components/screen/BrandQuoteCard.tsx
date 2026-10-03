import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeOut, prog } from "../../lib/anim";
import { assetUrl } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { cueOr, typed } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { fitFont } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 引用一条原文：真 logo（或真图标文件）+ 原话 + 出处。
// 和 quote（金句点燃）的区别：金句是你自己说的话，这一张是「别人写的原文」，
// 所以它必须带出处，否则和编的没差别。
const schema = z.object({
  brand: z.string().optional().describe("出处产品的叫法（Claude / 飞书 / Remotion…），有真 logo 就上真的"),
  icon: z.string().optional().describe("没有真 logo 时指定的通用图标名，或直接给 src"),
  src: z.string().optional().describe("原文截图（文档/README/公告页面），相对 public/"),
  quote: z.string().describe("原话，逐字打出来"),
  cite: z.string().optional().describe("出处一行写什么：文件名 / 章节 / 「官方文档 · Models」"),
  title: z.string().optional(),
  kicker: z.string().optional(),
  at: z.number().optional().describe("卡片进来的时刻（锚点或帧）"),
  source: sourceSchema,
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const at = cueOr(data.at, 4);
  const e = enterAt(frame, at, { fallback: "rise", dur: 18, from: 0.94 });
  const out = easeOut(prog(frame, dur - 10, 10));
  const hasImg = !!data.src;
  const cardW = Math.min(1360, width - 260);
  const cardH = Math.min(hasImg ? 560 : 420, height - 320);
  const x = (width - cardW) / 2;
  const y = height / 2 - cardH / 2 + 50;
  const imgW = hasImg ? cardW * 0.42 : 0;
  const textW = cardW - imgW - 90;
  const typeFrom = at + 16;
  const typeTo = Math.max(typeFrom + 20, dur - 26);

  return (
    <>
      <div style={{ position: "absolute", left: 96, top: Math.max(28, y - 92), opacity: e.opacity, transform: `translateY(${e.dy}px)` }}>
        {data.kicker && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: t.font.mono, fontSize: 20, letterSpacing: 6, color: t.primary }}>
            <span style={{ width: 40, height: 2, background: t.primary, boxShadow: `0 0 10px ${t.primary}` }} />
            {data.kicker}
          </div>
        )}
        {data.title && <div style={{ marginTop: 8, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.title, 1100, 50, 30), color: t.text }}>{data.title}</div>}
      </div>

      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: cardW,
          height: cardH,
          borderRadius: 24,
          overflow: "hidden",
          display: "flex",
          background: alpha(t.bg, 0.94),
          border: `2px solid ${alpha(t.primary, 0.55)}`,
          boxShadow: `0 0 70px ${alpha(t.primary, 0.2)}, 0 36px 110px rgba(0,0,0,.7)`,
          transform: `scale(${e.scale}) translate(${e.dx}px, ${e.dy}px)`,
          clipPath: e.clip,
          opacity: clamp(e.opacity * (1 - out * 0.6)),
        }}
      >
        {data.src && (
          <div style={{ width: imgW, position: "relative", borderRight: `1.5px solid ${alpha(t.line, 0.8)}`, overflow: "hidden" }}>
            <Img src={assetUrl(data.src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: `saturate(${0.9 + 0.2 * e.p})` }} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent 55%, ${alpha(t.bg, 0.85)})` }} />
          </div>
        )}

        <div style={{ flex: 1, padding: "34px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 出处标识：有真 logo 用真的，没有就退成通用图标 */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Icon name={data.brand || data.icon} size={40} color={t.primary} />
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 26, color: t.text }}>{data.brand || data.cite || "原文"}</div>
            <div style={{ marginLeft: "auto", fontFamily: t.font.mono, fontSize: 16, letterSpacing: 2, color: t.dim }}>QUOTE</div>
          </div>

          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: -14, top: -34, fontFamily: t.font.title, fontSize: 92, color: alpha(t.primary, 0.28) }}>“</span>
            <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: fitFont(data.quote, textW - 40, 38, 24), lineHeight: 1.55, color: t.text }}>
              {typed(data.quote, frame, typeFrom, typeTo)}
              {frame < typeTo && Math.floor(frame / 8) % 2 === 0 && <span style={{ color: t.primary }}>▍</span>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
            {data.cite && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRadius: 999, background: alpha(t.primary, 0.12), border: `1.5px solid ${alpha(t.primary, 0.4)}`, fontFamily: t.font.mono, fontSize: 18, color: t.text }}>
                <Icon name="doc" size={20} color={t.primary} />
                {data.cite}
              </div>
            )}
            <div style={{ marginLeft: "auto" }}>
              <SourceBadge source={data.source} frame={frame} y={0} />
            </div>
          </div>
        </div>
      </div>

      <Sfx name="impact" at={at + 2} volume={0.4} />
      <Sfx name="tick" at={typeFrom} volume={0.22} />
    </>
  );
};

export const BrandQuoteCard: CompDef<D> = {
  id: "brand-quote-card",
  name: "带真标识的原文卡",
  layer: "screen",
  variants: 3,
  minSec: 3,
  maxSec: 16,
  tags: ["原文", "引用", "官方", "文档", "出处", "公告", "设定"],
  motion: { kind: "卡片带透视进场，原话逐字打出，光标闪烁", energy: 2 },
  desc: "左边原文截图（可省）、右边「真 logo + 原话逐字 + 出处标签 + 来源角标」的引用卡。讲的东西是别人写的，不是自己编的",
  use: "「官方文档写的是……」「README 里原话是……」「公告里就说了一句……」——凡是转述某个产品/文档原文的句子。brand 写产品名（有真 logo 会上真的），cite 写文件/章节，source 写平台和采集日期",
  schema,
  assetFields: ["src"],
  example: {
    kicker: "FROM THE DOC",
    brand: "Remotion",
    cite: "官方文档 · Calculating on a timeline",
    quote: "Everything is a function of the current frame.",
    source: { platform: "remotion.dev", url: "remotion.dev/docs", capturedAt: "2026-09-28" },
  },
  C,
};
