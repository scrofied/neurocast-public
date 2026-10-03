import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeOut, hash, lerp, prog } from "../../lib/anim";
import { assetSrc } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 真人头像墙：讲「有多少人」「这些人都来了」的时候，上一排真头像。
// 拿不到头像也必须诚实地退化成「真名首字母」，并在底部如实报有几张是真图 ——
// 用假剪影冒充真人，比不放头像更伤信任。
const face = z.object({
  name: z.string().describe("网名/真名：缺头像时取它的字当头像"),
  src: z.string().optional().describe("真头像或真人照片（相对 public/）"),
  tag: z.string().optional().describe("一行身份或他说过的话，如「做了 3 年运营」"),
  at: z.number().optional().describe("这枚头像进来的时刻"),
});
const schema = z.object({
  kicker: z.string().optional(),
  title: z.string().optional(),
  items: z.array(face).min(2).max(14),
  layout: z.enum(["grid", "row", "scatter"]).default("grid").describe("grid 方阵 / row 一行 / scatter 错落（人多时用）"),
  note: z.string().optional().describe("底部一行统计，如「评论区 214 条，这里放前 12 位」"),
  at: z.number().optional(),
});
type D = z.infer<typeof schema>;

const initialOf = (name: string) => {
  const clean = name.replace(/^@/, "").trim();
  const cjk = clean.match(/[\u4e00-\u9fa5]/);
  return (cjk ? cjk[0] : clean.slice(0, 2) || "?").toUpperCase();
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const n = data.items.length;
  const start = data.at ?? 6;
  const cues = listCues(data.items.map((it) => ({ at: it.at })), start, Math.max(start + 20, dur - 16));
  const scatter = data.layout === "scatter";
  const cols = data.layout === "row" ? Math.min(n, 8) : scatter ? Math.min(n, 5) : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const cellW = Math.min(300, (width - 240) / cols);
  const cellH = Math.min(260, (height - 380) / rows);
  const d = Math.min(cellW * 0.62, cellH * 0.6, 170);
  const ox = (width - cols * cellW) / 2 + cellW / 2;
  const oy = height / 2 - ((rows - 1) * cellH) / 2 + 44;
  const realCount = data.items.filter((it) => !!it.src).length;

  return (
    <>
      <Heading kicker={data.kicker ?? "REAL PEOPLE"} title={data.title} frame={frame} width={width} />
      {data.items.map((it, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const jx = scatter ? ((hash(`${it.name}${i}`) % 1000) / 1000 - 0.5) * cellW * 0.5 : 0;
        const jy = scatter ? ((hash(`${i}${it.name}`) % 1000) / 1000 - 0.5) * cellH * 0.34 : 0;
        const cx = ox + col * cellW + jx;
        const cy = oy + row * cellH + jy;
        const e = enterAt(frame, cues[i] ?? start, { fallback: "assemble", dur: 14, seed: i * 13 + 5 });
        const p = easeOut(prog(frame, cues[i] ?? start, 16));
        const lit = frame >= (cues[i] ?? start) && frame < (cues[i] ?? start) + 26;
        const s = lerp(0.86, 1, p) * (lit ? 1.08 : 1);
        const src = assetSrc(it.src);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: cellW - 20,
              transform: `translate(-50%, -50%) scale(${s * e.scale}) translate(${e.dx}px, ${e.dy}px)`,
              clipPath: e.clip,
              opacity: clamp(e.opacity),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                position: "relative",
                width: d,
                height: d,
                borderRadius: d * 0.28,
                overflow: "hidden",
                background: src ? "#0b0f17" : `linear-gradient(135deg, ${alpha(t.primary, 0.32)}, ${alpha(t.bg2, 0.9)})`,
                border: `2px solid ${alpha(lit ? t.primary : t.line, lit ? 0.95 : 0.6)}`,
                boxShadow: lit ? `0 0 46px ${alpha(t.primary, 0.45)}` : `0 14px 40px rgba(0,0,0,.55)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {src ? (
                <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: d * 0.42, color: alpha(t.text, 0.95) }}>{initialOf(it.name)}</span>
              )}
              {!src && (
                <div style={{ position: "absolute", left: 8, bottom: 7, display: "flex", alignItems: "center", gap: 5, fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1, color: alpha(t.text, 0.62) }}>
                  <Icon name="user" size={13} color={alpha(t.text, 0.62)} />
                  姓名占位
                </div>
              )}
            </div>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(it.name, cellW - 34, 24, 16), color: t.text, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", maxWidth: cellW - 24 }}>{it.name}</div>
            {it.tag && (
              <div style={{ fontFamily: t.font.body, fontSize: 16, color: t.dim, textAlign: "center", lineHeight: 1.3, opacity: p, maxHeight: 42, overflow: "hidden" }}>{it.tag}</div>
            )}
          </div>
        );
      })}

      {(data.note || realCount !== n) && (
        <div style={{ position: "absolute", left: width / 2, bottom: 96, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderRadius: 999, background: alpha(t.bg, 0.8), border: `1.5px solid ${alpha(t.primary, 0.45)}`, fontFamily: t.font.mono, fontSize: 18, color: alpha(t.text, 0.9), opacity: easeOut(prog(frame, cues[Math.min(n - 1, 0)] + 10, 16)) }}>
          <Icon name="users" size={19} color={t.primary} />
          {data.note ?? `${n} 位真人`}
          <span style={{ opacity: 0.45 }}>|</span>
          真头像 {realCount}/{n}
        </div>
      )}
      <Sfx name="tick" at={start} volume={0.24} />
      {cues.slice(1, cues.filter((c) => frame >= c).length).map((c, i) => (
        <Sfx key={i} name="tick" at={c} volume={0.18} />
      ))}
    </>
  );
};

export const PhotoWall: CompDef<D> = {
  id: "photo-wall",
  name: "真人头像墙（缺图诚实降级）",
  layer: "story",
  variants: 3,
  minSec: 3,
  maxSec: 16,
  tags: ["人", "粉丝", "学员", "客户", "同学", "评论", "团队", "报名"],
  motion: { kind: "头像逐枚聚拢进场，讲到哪枚哪枚放大发光", energy: 2 },
  desc: "一排或一方阵的真人头像，逐个点亮；有真头像用真图，没有的退成「真名首字母」方块，底部如实标注真头像几张",
  use: "「有 300 多个人在跟」「这几位同学交的作业」「我拉的群里都是真人」——凡是拿「人」当证据的句子。src 给真头像截图；宁可写姓名占位也别用假剪影",
  schema,
  assetFields: ["items[].src"],
  example: {
    kicker: "REAL PEOPLE",
    title: "跟我做这个流程的人",
    layout: "grid",
    items: [
      { name: "@阿桂做号", src: "assets/demo-square.png", tag: "改了 3 版提示词", at: 8 },
      { name: "@老陈的剪辑台", tag: "两周涨了 4000 粉", at: 26 },
      { name: "@Momo", tag: "第一次做口播", at: 44 },
      { name: "@数据不撒谎", tag: "把榜单搬进周报", at: 62 },
    ],
    note: "评论区挑的前 4 位",
  },
  C,
};
