import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeInOut, easeOut, prog } from "../../lib/anim";
import { assetUrl, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 多张真截图并排：前后对比 / 两个工具同一任务 / 有无某能力。
// 和 versus（概念对撞）的区别：versus 比的是想法，这里比的是两张真的东西。
const pane = z.object({
  src: z.string().describe("截图路径（相对 public/）"),
  label: z.string().describe("这张是什么：改之前 / Claude / 装了 skill"),
  aspect: z.number().optional().describe("图片宽高比，不写按 16/10"),
  note: z.string().optional().describe("图下方一行小字"),
  source: sourceSchema,
  at: z.number().optional().describe("这屏进来的时刻"),
});
const schema = z.object({
  kicker: z.string().optional(),
  title: z.string().optional(),
  panes: z.array(pane).min(2).max(3),
  verdict: z.string().optional().describe("底部结论条，如「同一句话，差 6 倍成本」"),
  syncAt: z.number().optional().describe("讲到哪个词时两边同时高亮同一区域（锚点或帧）"),
  region: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional().describe("同步高亮的区域（0~1 归一化，两张图同一位置时用）"),
  at: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const n = data.panes.length;
  const start = data.at ?? 4;
  const cues = listCues(data.panes.map((p, i) => ({ at: p.at ?? start + i * 10 })), start, Math.max(start + 30, dur - 20));
  const syncAt = cueOr(data.syncAt, dur * 0.6);
  const sp = easeInOut(prog(frame, syncAt, 16));
  const gap = 34;
  const availW = width - 200;
  const pw = (availW - gap * (n - 1)) / n;
  const ph = Math.min(pw * 0.66, 520);
  const x0 = 100;
  const y0 = height / 2 - ph / 2 + 40;

  return (
    <>
      <Heading kicker={data.kicker ?? "SIDE BY SIDE"} title={data.title} frame={frame} width={width} />
      {data.panes.map((p, i) => {
        const e = enterAt(frame, cues[i], { fallback: i === 0 ? "slide-l" : i === n - 1 ? "slide-r" : "rise", dur: 18 });
        const x = x0 + i * (pw + gap);
        const ar = p.aspect ?? 16 / 10;
        const ih = pw / ar;
        const on = sp > 0.05;
        const reg = data.region ?? { x: 0.1, y: 0.12, w: 0.8, h: 0.5 };
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y0, width: pw, height: ph, transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale})`, clipPath: e.clip, opacity: clamp(e.opacity) }}>
            <div style={{ position: "relative", width: pw, height: ph, borderRadius: 18, overflow: "hidden", background: "#0b0f17", border: `1.5px solid ${alpha(on ? t.primary : t.line, on ? 0.85 : 0.55)}`, boxShadow: on ? `0 0 50px ${alpha(t.primary, 0.28)}` : "0 24px 70px rgba(0,0,0,.6)" }}>
              {p.src ? (
                <Img src={assetUrl(p.src)} style={{ position: "absolute", left: 0, top: Math.max(0, (ph - ih) / 2), width: pw, height: ih, objectFit: "cover" }} />
              ) : (
                // 讲稿点名了这张图却还没截图：演占位，不拿代码画的假界面冒认真结果（空路径上屏还会让渲染 404 崩掉）
                <MissingAsset field="panes[].src" hint="对比的每一格都得是真截图，画出来的不算数" w={pw} h={ph} frame={frame} at={cues[i]} />
              )}
              {/* 同步高亮：讲到那一句时，两边同一区域一起亮起来 */}
              {data.region && (
                <div
                  style={{
                    position: "absolute",
                    left: `${reg.x * 100}%`,
                    top: `${reg.y * 100}%`,
                    width: `${reg.w * 100}%`,
                    height: `${reg.h * 100}%`,
                    borderRadius: 10,
                    border: `${2 + 2 * sp}px solid ${t.accent}`,
                    boxShadow: `0 0 ${30 * sp}px ${alpha(t.accent, 0.7)}`,
                    background: `rgba(0,0,0,${0.5 * (1 - sp)})`,
                    opacity: sp,
                  }}
                />
              )}
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: `linear-gradient(180deg, transparent, ${alpha(t.bg, 0.92)})`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(p.label, pw - 90, 24, 18), color: t.text }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: i === 0 ? t.bad : t.primary }} />
                {p.label}
              </div>
              <div style={{ position: "absolute", right: 16, bottom: 62, width: 1, height: 1 }}>
                <SourceBadge source={p.source} frame={frame} />
              </div>
            </div>
            {p.note && <div style={{ marginTop: 12, fontFamily: t.font.body, fontSize: 19, color: t.dim, textAlign: "center" }}>{p.note}</div>}
          </div>
        );
      })}

      {/* 中间的对照轴：两张屏之间拉一道，读者知道是「同一件事的两种结果」 */}
      {n === 2 && (
        <div style={{ position: "absolute", left: x0 + pw + gap / 2 - 1, top: y0 + 10, width: 2, height: ph - 20, background: `linear-gradient(180deg, transparent, ${alpha(t.primary, 0.6)}, transparent)`, opacity: easeOut(prog(frame, cues[1], 18)) }} />
      )}

      {data.verdict &&
        (() => {
          const e = enterAt(frame, Math.max(cues[n - 1] + 8, dur * 0.72), { fallback: "drop", dur: 16, from: 0 });
          const wv = Math.min(760, width - 300);
          return (
            <div
              style={{
                position: "absolute",
                left: (width - wv) / 2,
                top: y0 + ph + 34,
                width: wv,
                padding: "14px 22px",
                borderRadius: 999,
                textAlign: "center",
                background: alpha(t.primary, 0.14),
                border: `1.5px solid ${alpha(t.primary, 0.6)}`,
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: fitFont(data.verdict, wv - 80, 28, 20),
                color: t.text,
                transform: `translateY(${e.dy}px) scale(${e.scale})`,
                opacity: e.opacity,
              }}
            >
              {data.verdict}
            </div>
          );
        })()}
      <Sfx name="impact" at={cues[0]} volume={0.36} />
      <Sfx name="swipe" at={cues[n - 1]} volume={0.32} />
      {data.region && <Sfx name="tick" at={syncAt} volume={0.3} />}
    </>
  );
};

export const ScreenVersus: CompDef<D> = {
  id: "screen-versus",
  name: "真截图并排对比",
  layer: "screen",
  variants: 3,
  minSec: 4,
  maxSec: 16,
  tags: ["对比", "前后", "两个", "同一", "差别", "评测", "结果"],
  motion: { kind: "两屏从左右对撞推入，讲到关键差异词时同一区域同步高亮", energy: 3 },
  desc: "2-3 张真截图并排放，中间一道对照轴；写 region 后，讲到 syncAt 那个词时两张图的同一区域一起框亮，底部可挂一句结论",
  use: "「改之前长这样，改之后长这样」「同一句话，两个模型给出的结果」「装了 skill / 没装」——凡是拿两张真图比高下的句子。每张图都能带自己的 source 来源角标",
  schema,
  assetFields: ["panes[].src"],
  example: {
    kicker: "SIDE BY SIDE",
    title: "同一句提示词，两张真结果",
    panes: [
      { src: "assets/arena-rank-overall.png", label: "按总排", aspect: 2.13, source: { platform: "LMArena", capturedAt: "2026-09-30" } },
      { src: "assets/arena-rank-agentic.png", label: "按写代码", aspect: 2.13, source: { platform: "LMArena", capturedAt: "2026-09-30" } },
    ],
    region: { x: 0.06, y: 0.28, w: 0.88, h: 0.22 },
    syncAt: 60,
    verdict: "换个排序，第一就换了",
  },
  C,
};
