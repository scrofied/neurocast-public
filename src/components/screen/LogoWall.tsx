import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeOut, lerp, prog } from "../../lib/anim";
import { assetUrl } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon, guessIcon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import { findBrand } from "../../lib/brands";
import type { CompDef, CompProps } from "../types";

// 真标识方阵：文案点名了一串具体产品/平台时，上它们自己的 logo，而不是一排通用线条图标。
// brand 字段直接写文案里的叫法（"Claude" / "剪映" / "小红书"），只要 public/brands/ 里有文件
// 并且跑过 `node scripts/brands.mjs sync`，就会出真标识；没登记的产品自动退回猜的通用图标。
const item = z.object({
  brand: z.string().describe("产品/平台的叫法，照文案写：Claude、剪映、小红书、LMArena……"),
  note: z.string().optional().describe("牌子下面那行小字：它的定位或你用它干什么"),
  src: z.string().optional().describe("没有登记 logo 时，可给一张真图标文件（相对 public/）"),
  at: z.number().optional().describe("这枚亮起来的时刻（台词锚点或帧）；不写按顺序均分"),
});
const schema = z.object({
  kicker: z.string().optional(),
  title: z.string().optional(),
  items: z.array(item).min(2).max(9),
  layout: z.enum(["grid", "arc", "row"]).default("grid").describe("grid 方阵 / row 一行 / arc 弧形（少而大时用）"),
  highlight: z.string().optional().describe("讲到哪个牌子时放大它（写 brand 名或台词锚点）；给了 at 就按 at 走"),
  at: z.number().optional().describe("整面墙开始点亮的时刻"),
});
type D = z.infer<typeof schema>;

// 没登记真标识的产品退回通用线条图标。但 note 里点到「别家牌子」时不能借那家的真标识——
// 1-1 踩过：brand「豆包」没有 logo，note 写「知识大量来自抖音」，于是把抖音的真标识挂到了豆包卡上（张冠李戴）。
// 所以只允许从 note 借「通用图标」，brand:xxx 这种真标识一律不借。
const markOf = (it: z.infer<typeof item>) => {
  if (findBrand(it.brand)) return it.brand;
  if (it.src) return undefined;
  const own = guessIcon(it.brand);
  if (own) return own;
  const fromNote = guessIcon(it.note ?? "");
  return fromNote && !fromNote.startsWith("brand:") ? fromNote : undefined;
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const n = data.items.length;
  const start = data.at ?? 6;
  const cues = listCues(data.items.map((it) => ({ at: it.at })), start, Math.max(start + 20, dur - 14));
  // 当前被点名的那枚：显式 highlight 命中名字，否则就是「最近点亮的那一枚」
  const lastOn = cues.filter((c) => frame >= c).length - 1;
  const hl = data.highlight;
  const named = hl ? data.items.findIndex((it) => it.brand === hl || hl.includes(it.brand)) : -1;
  const active = frame >= (cues[named] ?? Infinity) && named >= 0 ? named : lastOn;

  const cols = data.layout === "row" ? Math.min(n, 5) : data.layout === "arc" ? Math.min(n, 4) : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const cellW = Math.min(360, (width - 220) / cols);
  const cellH = Math.min(300, (height - 360) / rows);
  const totalW = cols * cellW;
  const ox = (width - totalW) / 2 + cellW / 2;
  const oy = height / 2 - ((rows - 1) * cellH) / 2 + 40;

  return (
    <>
      <Heading kicker={data.kicker ?? "THE STACK"} title={data.title} frame={frame} width={width} />
      {data.items.map((it, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const arc = data.layout === "arc" ? -Math.sin(((col + 0.5) / cols) * Math.PI) * 90 : 0;
        const cx = ox + col * cellW;
        const cy = oy + row * cellH + arc;
        const on = frame >= (cues[i] ?? start);
        const e = enterAt(frame, cues[i] ?? start, { fallback: "assemble", dur: 14, seed: i * 7 + 3 });
        const isActive = i === active && on;
        const p = easeOut(prog(frame, cues[i] ?? start, 16));
        const dim = active >= 0 && !isActive ? 0.42 : 1;
        const s = lerp(1, 1.16, isActive ? easeOut(prog(frame, cues[i] ?? start, 18)) : 0);
        const size = Math.min(cellW, cellH) * 0.42;
        const brand = findBrand(it.brand);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: cellW - 26,
              height: cellH - 26,
              transform: `translate(-50%, -50%) scale(${e.scale * s}) translate(${e.dx}px, ${e.dy}px)`,
              clipPath: e.clip,
              opacity: clamp(e.opacity * dim),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              padding: "18px 16px",
              borderRadius: 20,
              background: alpha(isActive ? t.bg2 : t.bg, isActive ? 0.9 : 0.62),
              border: `1.5px solid ${alpha(isActive ? t.primary : t.line, isActive ? 0.9 : 0.5)}`,
              boxShadow: isActive ? `0 0 60px ${alpha(t.primary, 0.35)}, inset 0 0 40px ${alpha(t.primary, 0.08)}` : "none",
              transition: "none",
            }}
          >
            <div style={{ height: size, display: "flex", alignItems: "center", justifyContent: "center", filter: isActive ? `drop-shadow(0 0 16px ${alpha(t.primary, 0.5)})` : "none" }}>
              {it.src && !brand ? (
                <Img src={assetUrl(it.src)} style={{ height: size, objectFit: "contain" }} />
              ) : (
                <Icon name={markOf(it) ?? "spark"} size={size} color={isActive ? t.primary : t.text} />
              )}
            </div>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(it.brand, cellW - 60, 30, 18), color: isActive ? t.text : alpha(t.text, 0.86), textAlign: "center", lineHeight: 1.15 }}>
              {brand?.label ?? it.brand}
            </div>
            {it.note && (
              <div style={{ fontFamily: t.font.body, fontSize: 17, color: t.dim, textAlign: "center", lineHeight: 1.3, opacity: p, maxHeight: 46, overflow: "hidden" }}>{it.note}</div>
            )}
          </div>
        );
      })}
      <Sfx name="tick" at={start} volume={0.26} />
      {cues.slice(0, Math.max(0, lastOn)).map((c, i) => (
        <Sfx key={i} name="tick" at={c + 1} volume={0.2} />
      ))}
    </>
  );
};

export const LogoWall: CompDef<D> = {
  id: "logo-wall",
  name: "真标识方阵（逐个点亮）",
  layer: "screen",
  variants: 3,
  minSec: 3,
  maxSec: 14,
  tags: ["产品", "工具", "平台", "接入", "生态", "选型", "对比"],
  motion: { kind: "逐枚聚拢点亮，讲到那枚放大发光、其余压暗", energy: 2 },
  desc: "把文案里点名的几个产品/平台排成方阵，每个用自己的真 logo（public/brands/ 里有的话），讲到哪一枚哪枚放大发光、其余压暗",
  use: "「这几个工具都能干」「市面上有 X/Y/Z」「它接入了 A、B、C」「我筛下来的就这几家」——凡是点名一串具体产品的句子。brand 写文案里的叫法，没登记 logo 的可以用 src 给真图标文件",
  schema,
  assetFields: ["items[].src"],
  example: {
    kicker: "THE STACK",
    title: "我就留了这几个",
    layout: "grid",
    items: [
      { brand: "Claude", note: "写长文和代码", at: 8 },
      { brand: "剪映", note: "口播和字幕", at: 30 },
      { brand: "小红书", note: "选题和评论区", at: 52 },
      { brand: "GitHub", note: "存脚本和素材", at: 74 },
    ],
  },
  C,
};
