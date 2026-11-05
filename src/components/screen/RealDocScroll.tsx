import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeInOut, easeOut, lerp, prog } from "../../lib/anim";
import { assetUrl, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { fitFont } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 真东西的「体量感」：一张真长截图（表格 / 文档 / 代码 / 文章）从头滚到尾，
// 讲到哪一行就停在哪一行并把它高亮出来。和 ui-replica（代码画的假界面）相对 ——
// 这里上的是真文件，观众看到的是「他真的有 63 条脚本」。
const stop = z.object({
  y: z.number().describe("停到原图的哪个纵向位置（0~1，0=顶）"),
  label: z.string().optional().describe("停住时右边的说明，如「第 37 行：报价单」"),
  h: z.number().default(0.06).describe("高亮条高度（占原图高度的比例，0~1）"),
  at: z.number().optional().describe("什么时候停（锚点或帧）"),
});
const schema = z.object({
  src: z.string().optional().describe("长截图（相对 public/）：整页表格/文档/代码/文章"),
  pages: z.array(z.string()).max(8).optional().describe("多页模式：每页一张图（PDF 逐页导出的截图），按 stops 翻页"),
  aspect: z.number().optional().describe("原图宽高比（宽/高）；长截图一般 0.3~0.5，不给就由引擎按文件实测"),
  title: z.string().optional(),
  kicker: z.string().optional(),
  meta: z.string().optional().describe("右上角体量标注，如「63 条 · 2.4 万字」——写真的数字"),
  stops: z.array(stop).max(4).optional().describe("按讲序停哪几处；不写就匀速滚完"),
  speed: z.number().default(1).describe("没写 stops 时的滚动比例（1=片尾正好滚到底）"),
  highlight: z.enum(["band", "box", "none"]).default("band").describe("停住时怎么标：横条 / 方框 / 不高亮"),
  source: sourceSchema,
  at: z.number().optional(),
});
type D = z.infer<typeof schema>;

const HOLD = 16; // 停住讲的帧数

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const pages = data.pages ?? [];
  const multi = pages.length > 0;
  const src = multi ? undefined : data.src;
  const ar = data.aspect ?? (multi ? 1.4 : 0.44);

  // 画面：左边讲标题，中间放文档，右边一列进度轨 + 停住的说明
  const labelW = 420;
  const railW = 300;
  const fw = Math.min(width - labelW - railW - 140, multi ? 1080 : 860);
  const imgH = fw / Math.max(ar, 0.05); // 按显示宽度铺满后原图有多长
  const fh = Math.min(height - 250, imgH);
  const fx = labelW + 40;
  const fy = (height - fh) / 2 + 30;
  const maxScroll = Math.max(0, imgH - fh);
  const center = (iy: number) => clamp(iy * imgH - fh / 2, 0, maxScroll); // 让停住的那行落在窗口中间

  const start = data.at ?? 4;
  const stops = data.stops ?? [];
  const cues = listCues(stops.map((s) => ({ at: s.at })), start + 22, Math.max(start + 70, dur - 30));
  const targets = stops.map((s) => center(s.y));

  let scroll = 0;
  let held = -1;
  if (!stops.length) {
    scroll = maxScroll * clamp(prog(frame, start, Math.max(1, dur - start - 12)) * data.speed);
  } else if (frame < cues[0]) {
    scroll = lerp(0, targets[0], easeInOut(prog(frame, start, Math.max(12, cues[0] - start))));
  } else {
    held = cues.filter((c) => frame >= c).length - 1;
    const next = targets[held + 1] ?? maxScroll;
    const to = cues[held + 1] ?? dur - 12;
    scroll = lerp(targets[held], next, easeInOut(prog(frame, cues[held] + HOLD, Math.max(12, to - cues[held] - HOLD))));
  }

  const page = multi
    ? Math.min(pages.length - 1, stops.length ? Math.max(0, held) : Math.floor(prog(frame, start, Math.max(1, dur - start - 12)) * pages.length))
    : 0;
  const railP = multi ? (pages.length ? (page + 1) / pages.length : 1) : maxScroll > 0 ? scroll / maxScroll : 1;
  const shown = held >= 0 ? stops[held] : undefined;
  const stopP = held >= 0 ? easeOut(prog(frame, cues[held], 14)) : 0;

  const bandH = Math.max(12, (multi ? fh : imgH) * (shown?.h ?? 0.06));
  const bandTop = shown ? (multi ? fh * shown.y : shown.y * imgH - scroll) - bandH / 2 : 0;
  const bandOn = shown && data.highlight !== "none" && bandTop > -bandH && bandTop < fh;

  const e = enterAt(frame, start, { fallback: "rise", dur: 20, from: 0.94 });
  const has = multi ? pages.length > 0 : !!src;

  return (
    <>
      <div style={{ position: "absolute", left: 84, top: Math.max(30, fy - 8), width: labelW - 40, opacity: e.opacity, transform: `translateY(${e.dy}px)` }}>
        {data.kicker && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: t.font.mono, fontSize: 20, letterSpacing: 6, color: t.primary }}>
            <span style={{ width: 40, height: 2, background: t.primary, boxShadow: `0 0 10px ${t.primary}` }} />
            {data.kicker}
          </div>
        )}
        {data.title && <div style={{ marginTop: 14, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.title, labelW - 60, 52, 30), lineHeight: 1.25, color: t.text }}>{data.title}</div>}
        {data.meta && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 22, padding: "10px 18px", borderRadius: 999, background: alpha(t.primary, 0.12), border: `1.5px solid ${alpha(t.primary, 0.5)}`, fontFamily: t.font.mono, fontSize: 20, color: t.text }}>
            <Icon name="layers" size={20} color={t.primary} />
            {data.meta}
          </div>
        )}
        {shown?.label && (
          <div style={{ marginTop: 26, fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(shown.label, labelW - 60, 27, 19), lineHeight: 1.4, color: t.accent, opacity: stopP, transform: `translateX(${(1 - stopP) * 18}px)` }}>
            → {shown.label}
          </div>
        )}
        {multi && (
          <div style={{ marginTop: 20, fontFamily: t.font.mono, fontSize: 19, color: t.dim }}>
            第 {page + 1} / {pages.length} 页
          </div>
        )}
      </div>

      {/* 文档本体 */}
      <div
        style={{
          position: "absolute",
          left: fx,
          top: fy,
          width: fw,
          height: fh,
          borderRadius: 16,
          overflow: "hidden",
          background: "#fbfcfe",
          border: `1.5px solid ${alpha(t.primary, 0.4)}`,
          boxShadow: `0 0 60px ${alpha(t.primary, 0.18)}, 0 34px 110px rgba(0,0,0,.7)`,
          transform: `scale(${e.scale}) translate(${e.dx}px, ${e.dy}px)`,
          opacity: clamp(e.opacity),
        }}
      >
        {!has && <MissingAsset field={multi ? "pages" : "src"} hint="这里要一张真的长截图或逐页导出图" w={fw} h={fh} frame={frame} at={start} />}
        {multi && <Img src={assetUrl(pages[page])} style={{ position: "absolute", inset: 0, width: fw, height: fh, objectFit: "contain" }} />}
        {!multi && src && (
          <div style={{ position: "absolute", left: 0, top: -scroll, width: fw, height: imgH }}>
            <Img src={assetUrl(src)} style={{ width: "100%", height: "100%", objectFit: "fill", display: "block" }} />
          </div>
        )}
        {/* 停住时的高亮：横条或方框 */}
        {bandOn && (
          <div
            style={{
              position: "absolute",
              left: data.highlight === "band" ? 0 : 22,
              right: data.highlight === "band" ? 0 : 22,
              top: bandTop,
              width: data.highlight === "band" ? fw : undefined,
              height: bandH,
              background: alpha(t.accent, 0.16 * stopP),
              border: `${2 + 2 * stopP}px solid ${alpha(t.accent, stopP)}`,
              borderRadius: 8,
              boxShadow: `0 0 34px ${alpha(t.accent, 0.5 * stopP)}`,
            }}
          />
        )}
        {/* 滚到哪儿了：窗口内的细进度条 */}
        {!multi && maxScroll > 0 && (
          <div style={{ position: "absolute", right: 6, top: 8, width: 4, height: fh - 16, borderRadius: 2, background: alpha(t.dim, 0.35) }}>
            <div style={{ position: "absolute", left: 0, top: (fh - 46) * railP, width: 4, height: 38, borderRadius: 2, background: t.primary, boxShadow: `0 0 12px ${t.primary}` }} />
          </div>
        )}
        {/* SourceBadge 自己是绝对定位且从容器顶往下长：直接 bottom:12 会让整块胶囊掉到
            容器底边之外，被上面的 overflow:hidden 整个裁掉 —— 靠 y=-36 顶回内侧。
            长文档的容器底边（fy+fh 最晚到 height-95）会压进逐字字幕带（bottom 52 + 50 字），
            角标正好被字幕盖住 —— 容器低到字幕带附近时把角标往上让开一行。 */}
        <div style={{ position: "absolute", right: 14, bottom: fy + fh > height - 130 ? 62 : 12, width: 1, height: 1 }}>
          <SourceBadge source={data.source} frame={frame} y={-36} />
        </div>
      </div>

      {/* 右侧进度轨：每停一次打一个刻度 */}
      <div style={{ position: "absolute", left: fx + fw + 44, top: fy + 6, width: railW - 60 }}>
        <div style={{ position: "relative", width: 6, height: fh - 24, background: alpha(t.line, 0.85), borderRadius: 3 }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 6, height: (fh - 24) * railP, borderRadius: 3, background: `linear-gradient(180deg, ${t.primary}, ${alpha(t.primary, 0.4)})`, boxShadow: `0 0 18px ${alpha(t.primary, 0.6)}` }} />
          {stops.map((s, i) => (
            <div key={i} style={{ position: "absolute", left: -5, top: multi ? ((fh - 24) * i) / Math.max(1, stops.length - 1) : (fh - 24) * clamp(s.y), width: 16, height: 3, background: frame >= (cues[i] ?? Infinity) ? t.accent : alpha(t.dim, 0.7) }} />
          ))}
        </div>
      </div>

      <Sfx name="swipe" at={start + 2} volume={0.26} />
      {cues.slice(0, held + 1).map((c, i) => (
        <Sfx key={i} name="tick" at={c} volume={0.24} />
      ))}
    </>
  );
};

export const RealDocScroll: CompDef<D> = {
  id: "real-doc-scroll",
  name: "真表格·文档滚动（停住高亮）",
  layer: "screen",
  variants: 3,
  minSec: 4,
  maxSec: 20,
  tags: ["表格", "文档", "代码", "长文", "清单", "我的", "全部", "翻"],
  motion: { kind: "整页匀速上滚，讲到哪一行停住并高亮，右侧进度轨跟着走", energy: 2 },
  desc: "一张真长截图（表格/文档/代码/文章）从头滚到尾，按 stops 停在具体行上高亮；给 pages 就是逐页翻。左侧可挂真实体量（63 条 · 2.4 万字）",
  use: "「这是我全部 63 条脚本」「代码就这么长」「那本手册 40 页」「表格拉不到底」——凡是用体量说服人的句子。别用 ui-replica 的假编辑器替代，这里上真的",
  schema,
  assetFields: ["src", "pages[]"],
  example: {
    kicker: "THE REAL FILE",
    title: "我这两个月的脚本全在这",
    src: "assets/demo-shot.png",
    aspect: 0.44,
    meta: "63 条 · 2.4 万字",
    stops: [
      { y: 0.12, h: 0.05, label: "第 8 条：评论区挖选题", at: 30 },
      { y: 0.52, h: 0.05, label: "第 41 条：AI 帮我剪片子", at: 78 },
    ],
    source: { platform: "我自己的脚本库", capturedAt: "2026-10-01" },
  },
  C,
};
