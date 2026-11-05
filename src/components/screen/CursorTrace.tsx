// 移植自 yihui-dev/awesome-opus5-5-videos（MIT）里 @ehsanik 的 prompt ehsanik-162993：
// 用鼠标移动 + JS 画笔把刚做过的事一笔笔画出来，视频里保留每一次鼠标轨迹。
// https://x.com/ehsanik
//
// 中文改造：在**真截图**上「把结论圈出来、画出来」——光标拖着笔沿参数化路径一笔笔画出
// 圈选 / 下划线 / 箭头 / 方框 / 批注线，画到哪、话说到哪（每一笔一个锚点）。
// 与已有的 evidence-zoom 互补：那个是「圈选 + 推近放大」，这个强调「手在画」的过程感，
// 适合推导、对账、指出图里的一处细节。底图必须是真文件，缺了就整块演 MissingAsset 并且不画笔画。
import React from "react";
import { z } from "zod";
import { Img, OffthreadVideo } from "remotion";
import { clamp, easeIn, easeInOut, easeOut, lerp, noise1, prog } from "../../lib/anim";
import { assetUrl, hasAsset, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const stroke = z.object({
  shape: z.enum(["circle", "underline", "arrow", "box", "free"]).describe("这一笔的形状：circle 圈选 / underline 下划线 / arrow 箭头 / box 方框 / free 一段弧形批注线"),
  x: z.number().describe("起点横坐标（0~1 相对底图，左上角为原点）"),
  y: z.number().describe("起点纵坐标（0~1）"),
  w: z.number().describe("这笔画的宽（0~1 相对底图）"),
  h: z.number().describe("这笔画的高（0~1 相对底图）"),
  at: z.number().optional().describe("这一笔开始的时刻（锚点台词原文或帧）；缺省 = 整段均分"),
  color: z.string().optional().describe("这一笔的颜色（hex），缺省按 强调色 → 金 → 主色 轮换"),
  label: z.string().optional().describe("这一笔画完弹出的批注（≤12 字）"),
  labelAt: z.number().optional().describe("批注弹出的时刻（锚点或帧），缺省 = 这一笔画完 + 4 帧"),
});
const schema = z.object({
  kicker: z.string().optional().describe("左上角小标签，如 TRACED BY HAND"),
  title: z.string().optional().describe("标题：一句要推导的话"),
  src: z.string().describe("底图：真截图/照片（相对 public/），必须是外部文件，不接受代码画的界面"),
  aspect: z.number().optional().describe("底图宽高比（宽/高），管线会自动探测并注入"),
  kind: z.string().optional().describe("底图素材类型，管线注入：image / video"),
  focus: z
    .array(z.object({ x: z.number(), y: z.number(), label: z.string().optional() }))
    .max(5)
    .optional()
    .describe("OCR 探到的候选位置（管线注入）：落笔前先在图上轻轻点一下这些位置"),
  strokes: z.array(stroke).min(1).max(6).describe("按讲的顺序一笔笔画，1~6 笔；每笔一个锚点"),
  conclusion: z.string().optional().describe("全部画完后砸出来的大字结论"),
  conclusionAt: z.number().optional().describe("结论砸出的时刻（锚点或帧），缺省 = 最后一笔画完 + 12 帧"),
  source: sourceSchema,
});
type D = z.infer<typeof schema>;

type Pt = { x: number; y: number };
const N = 72; // 每条路径的采样点数：笔尖定位和抖动都靠它

// 椭圆/曲线的采样点数用较小的 N 也够（这里统一重采样到 N 附近，索引即进度）
const sub = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

// 把参数化几何采样成点列：一条路径一次构建，纯函数、无 Math.random
const buildPts = (shape: string, x: number, y: number, w: number, h: number, seed: number): Pt[] => {
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (shape === "circle") {
    const rx = Math.max(18, w / 2 + 18);
    const ry = Math.max(13, h / 2 + 13);
    const a0 = -2.15;
    const n = 80;
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const th = i / n;
      const a = a0 + th * (Math.PI * 2 + 0.5); // 终点超过一圈：手绘的「重合」
      const wob = 1 + noise1(th * 9, seed) * 0.035;
      pts.push({ x: cx + Math.cos(a) * rx * wob, y: cy + Math.sin(a) * ry * wob });
    }
    return pts;
  }
  if (shape === "underline") {
    const n = 40;
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const th = i / n;
      pts.push({ x: x + w * th, y: y + h + 12 + Math.sin(th * Math.PI) * 7 + noise1(th * 6, seed) * 2.6 });
    }
    return pts;
  }
  if (shape === "box") {
    const c: Pt[] = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
    const per = 18;
    const pts: Pt[] = [];
    for (let i = 0; i < 4; i++) {
      const a = c[i];
      const b = c[(i + 1) % 4];
      for (let j = 0; j < per; j++) pts.push(sub(a, b, j / per));
    }
    const back = sub(c[0], c[1], 0.16);
    for (let j = 0; j <= 8; j++) pts.push(sub(c[0], back, j / 8)); // 起笔多描一点，像手写
    return pts;
  }
  if (shape === "arrow") {
    const tip: Pt = { x: x + w, y: y + h };
    const sta: Pt = { x, y };
    const n = 30;
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const th = i / n;
      const base = sub(sta, tip, th);
      const nx = -(tip.y - sta.y);
      const ny = tip.x - sta.x;
      const len = Math.max(1, Math.hypot(nx, ny));
      const bend = Math.sin(th * Math.PI) * 9 + noise1(th * 5, seed) * 2;
      pts.push({ x: base.x + (nx / len) * bend, y: base.y + (ny / len) * bend });
    }
    const ang = Math.atan2(tip.y - sta.y, tip.x - sta.x);
    const L = Math.max(16, Math.hypot(tip.x - sta.x, tip.y - sta.y) * 0.11);
    const b1: Pt = { x: tip.x - Math.cos(ang - 0.5) * L, y: tip.y - Math.sin(ang - 0.5) * L };
    const b2: Pt = { x: tip.x - Math.cos(ang + 0.5) * L, y: tip.y - Math.sin(ang + 0.5) * L };
    return pts.concat([b1, tip, b2]); // 回笔两下画出箭头
  }
  // free：带一段弧度的批注线（斜体划线 / 涂鸦式强调）
  const n = 44;
  const pts: Pt[] = [];
  const nx = -h;
  const ny = w;
  const len = Math.max(1, Math.hypot(nx, ny));
  for (let i = 0; i <= n; i++) {
    const th = i / n;
    const base = sub({ x, y }, { x: x + w, y: y + h }, th);
    const bend = Math.sin(th * Math.PI) * Math.min(42, Math.hypot(w, h) * 0.28) + noise1(th * 7, seed) * 3;
    pts.push({ x: base.x + (nx / len) * bend, y: base.y + (ny / len) * bend });
  }
  return pts;
};

const poly = (pts: Pt[]) => pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
const at = (pts: Pt[], u: number): Pt => {
  const f = clamp(u) * (pts.length - 1);
  const i = Math.floor(f);
  const j = Math.min(pts.length - 1, i + 1);
  const t = f - i;
  return { x: lerp(pts[i].x, pts[j].x, t), y: lerp(pts[i].y, pts[j].y, t) };
};

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const ar = d.aspect && d.aspect > 0.05 ? d.aspect : 16 / 10;
  const boxW = Math.min(width - 250, 1320);
  // 底图下边界：有结论句时抬到 height-235（结论挂在 height-225，两者不能叠），没有结论句再往下吃满；
  // 无论哪种，底图都不许越过 y935 那条逐字字幕带
  const bottomCap = height - (d.conclusion ? 235 : 175);
  const boxH = Math.min(bottomCap - 235, boxW / ar);
  const sw = Math.min(boxW, boxH * ar);
  const sh = sw / ar;
  const fx = (width - sw) / 2;
  const fy = 235;

  const start = 4;
  const cues = listCues(d.strokes.map((s) => ({ at: s.at })), start + 18, Math.max(start + 60, dur - 40));
  const doneOf = (i: number) => {
    const px = Math.max(40, Math.hypot(d.strokes[i].w * sw, d.strokes[i].h * sh));
    const du = Math.round(clamp(px / 46, 14, 22)); // 每笔 14~22 帧画完
    const next = i + 1 < d.strokes.length ? cues[i + 1] : dur;
    return { du: Math.max(du, cues[i] + du >= next ? Math.max(8, next - cues[i] - 4) : du), end: cues[i] + du };
  };
  const last = d.strokes.length - 1;
  const concAt = cueOr(d.conclusionAt, doneOf(last).end + 12);

  const COLS = [t.accent, t.gold, t.primary, t.secondary];
  const px = (v: number) => fx + v * sw;
  const py = (v: number) => fy + v * sh;

  const src = assetUrl(d.src);
  const isVideo = d.kind === "video";
  const e = enterAt(frame, start, { fallback: "rise", dur: 20, from: 0.93, dist: 0.5 });

  // 批注位置一次算完（渲染只管画）。三件事：
  //  1) 下边界两道闸 —— 字幕带顶 height-145；有结论句时结论句自己挂在 height-225，别压它；
  //  2) 笔迹在底部放不下就翻到笔迹上方；
  //  3) 同一帧里两条批注撞在一起（笔迹挨得近就会撞）就按出现顺序往下让位。
  const CH = 62;
  const labels = hasAsset(d.src)
    ? (() => {
        const lim = (d.conclusion ? height - 225 : height - 145) - CH;
        const out: { i: number; label: string; la: number; lx: number; ly: number; wl: number; col: string }[] = [];
        d.strokes.forEach((s, i) => {
          if (!s.label) return;
          const la = cueOr(s.labelAt, doneOf(i).end + 4);
          if (frame < la) return;
          const pts = buildPts(s.shape, px(s.x), py(s.y), s.w * sw, s.h * sh, i * 13 + 5);
          const nib = at(pts, 0.985);
          const wl = Math.max(200, Math.min(430, s.label.length * 30 + 76));
          const right = nib.x < width * 0.6;
          const lx = right ? clamp(nib.x + 34, 0, width - wl - 16) : clamp(nib.x - 34 - wl, 16, width - wl - 16);
          const below = s.shape === "underline" ? fy + sh + 22 : nib.y - 26;
          let ly = clamp(below > lim ? nib.y - 26 - CH - 10 : below, fy + 6, lim);
          const hit = () => out.some((p) => lx < p.lx + p.wl && lx + wl > p.lx && ly < p.ly + CH && ly + CH > p.ly);
          for (let g = 0; g < 6 && hit(); g++) ly = clamp(ly + CH + 10, fy + 6, lim);
          out.push({ i, label: s.label, la, lx, ly, wl, col: s.color ?? COLS[i % COLS.length] });
        });
        return out;
      })()
    : [];

  return (
    <>
      <Heading kicker={d.kicker ?? "TRACED BY HAND"} title={d.title} frame={frame} width={width} />

      {/* 底图：真截图本体，入场语法挂在这里 */}
      <div
        style={{
          position: "absolute",
          left: fx,
          top: fy,
          width: sw,
          height: sh,
          borderRadius: 14,
          overflow: "hidden",
          border: `1.5px solid ${alpha(t.primary, 0.5)}`,
          boxShadow: `0 32px 110px rgba(0,0,0,.7), 0 0 60px ${alpha(t.primary, 0.16)}`,
          transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale})`,
          clipPath: e.clip,
          opacity: clamp(e.opacity),
        }}
      >
        {hasAsset(d.src) ? (
          isVideo ? (
            <OffthreadVideo src={src} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          )
        ) : (
          <MissingAsset field="src" hint="cursor-trace 要在真截图上画：画在假界面上等于骗人" w={sw} h={sh} frame={frame} at={start} />
        )}
        {/* 来源角标：SourceBadge 自己是 absolute + top:y，外面这个 1×1 盒子只当锚点。
            直接写 bottom:10 会让角标从底边往下长，被容器的 overflow:hidden 整个裁掉
            （1-2 的 RAGFlow 那镜就是这么把「真实素材」弄丢的）——靠 y=-36 顶回容器内侧。 */}
        <div style={{ position: "absolute", right: 16, bottom: 14, width: 1, height: 1 }}>
          <SourceBadge source={d.source} frame={frame} y={-36} />
        </div>
      </div>

      {/* 没给真截图时不画笔画：宁缺毋假 */}
      {hasAsset(d.src) && (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {(d.focus ?? []).map((f, i) => {
            const p = easeOut(prog(frame, start + 6 + i * 3, 10));
            if (p <= 0) return null;
            const r = 12 + 26 * (1 - p);
            return (
              <g key={`f${i}`} opacity={0.5 * p}>
                <circle cx={px(f.x)} cy={py(f.y)} r={r} fill="none" stroke={alpha(t.primary, 0.6)} strokeWidth={1.5} strokeDasharray="4 5" />
                <line x1={px(f.x) - 9} y1={py(f.y)} x2={px(f.x) + 9} y2={py(f.y)} stroke={alpha(t.primary, 0.5)} strokeWidth={1.5} />
                <line x1={px(f.x)} y1={py(f.y) - 9} x2={px(f.x)} y2={py(f.y) + 9} stroke={alpha(t.primary, 0.5)} strokeWidth={1.5} />
              </g>
            );
          })}
          {d.strokes.map((s, i) => {
            const info = doneOf(i);
            const p = easeInOut(clamp((frame - cues[i]) / info.du));
            if (p <= 0) return null;
            const col = s.color ?? COLS[i % COLS.length];
            const pts = buildPts(s.shape, px(s.x), py(s.y), s.w * sw, s.h * sh, i * 13 + 5);
            const pathD = poly(pts);
            const u = Math.min(p, 0.985);
            const nib = at(pts, u);
            const trail = at(pts, Math.max(0, u - 0.035));
            const jit = frame < info.end ? 1 : 0.45;
            const tip = { x: nib.x + noise1(frame * 0.9, i * 7) * 1.6 * jit, y: nib.y + noise1(frame * 1.1, i * 7 + 3) * 1.6 * jit };
            const vis = 1 - easeIn(prog(frame, info.end + 66, 18));
            return (
              <g key={i} opacity={vis}>
                <path d={pathD} fill="none" stroke={alpha(col, 0.22)} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${p} 1`} style={{ filter: `blur(7px)` }} />
                <path d={pathD} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${p} 1`} />
                {frame < info.end + 4 && (
                  <>
                    <line x1={trail.x} y1={trail.y} x2={tip.x} y2={tip.y} stroke={alpha(col, 0.5)} strokeWidth={3} strokeLinecap="round" />
                    <circle cx={tip.x} cy={tip.y} r={13} fill={alpha(col, 0.22)} />
                    <circle cx={tip.x} cy={tip.y} r={5} fill={col} />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* 批注：这一笔画完才弹出来，跟画面里正在画的笔一起走（位置见上面 labels） */}
      {labels.map(({ i, label, la, lx, ly, wl, col }) => {
        const el = enterAt(frame, la, { fallback: "drop", dur: 14, from: 0, dist: 0.6 });
        return (
          <div key={`l${i}`} style={{ position: "absolute", left: lx, top: ly, width: wl, padding: "12px 18px", borderRadius: 14, background: alpha(t.bg, 0.92), border: `2px solid ${col}`, boxShadow: `0 0 30px ${alpha(col, 0.4)}`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(label, wl - 44, 27, 18), color: t.text, transform: `translateY(${el.dy}px) scale(${el.scale})`, opacity: el.opacity, pointerEvents: "none" }}>
            {label}
          </div>
        );
      })}

      {d.conclusion && hasAsset(d.src) && frame >= concAt && (() => {
        const ec = enterAt(frame, concAt, { fallback: "slam", dur: 16, dist: 0.7 });
        const fs = fitFont(d.conclusion, width - 420, 58, 30);
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top: height - 225, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.gold, textShadow: `0 0 30px ${alpha(t.gold, 0.6)}, 0 4px 0 rgba(0,0,0,.55)`, transform: `translateY(${ec.dy}px) scale(${ec.scale})`, opacity: ec.opacity, pointerEvents: "none" }}>
            {d.conclusion}
          </div>
        );
      })()}

      <Sfx name="impact" at={start + 2} volume={0.3} />
      {hasAsset(d.src) &&
        d.strokes.map((_, i) => (
          <Sfx key={i} name={i % 2 ? "swish" : "whoosh"} at={cues[i]} volume={0.24} />
        ))}
      {d.conclusion && hasAsset(d.src) && <Sfx name="stamp" at={concAt} volume={0.36} />}
    </>
  );
};

export const CursorTrace: CompDef<D> = {
  id: "cursor-trace",
  name: "在真截图上手绘圈画（光标拖着笔）",
  layer: "screen",
  variants: 3,
  minSec: 5,
  maxSec: 20,
  tags: ["画出来", "圈这里", "推导", "对账", "看这一处", "批注", "手写"],
  motion: { kind: "笔尖沿路径逐帧画出圈/线/箭头，画完弹批注，末尾砸结论", energy: 2 },
  desc: "一张真截图当底，光标拖着笔沿参数化路径一笔笔画出圈选/下划线/箭头/方框/弧形批注线（strokeDasharray 按帧推进 + 笔尖跟随 + 手绘抖动），每笔一个锚点、画完弹批注，全部画完砸出结论大字；没有 src 时整块渲染 MissingAsset 且一笔不画",
  use: "「这笔账是这样推的」「你自己看这一列」「这里少了一个负号」——凡是要在真图上手 pointing 的推导/对账句子。跟 evidence-zoom 的区别：evidence-zoom 是圈完推近放大，这个保留「手在画」的过程感。strokes 坐标 0~1 归一化，可让 OCR 先给 focus 候选",
  schema,
  assetFields: ["src"],
  example: {
    kicker: "TRACED BY HAND",
    title: "这笔账是怎么对不上的",
    src: "assets/demo-shot.png",
    aspect: 1400 / 3200,
    strokes: [
      { shape: "circle", x: 0.14, y: 0.07, w: 0.62, h: 0.06, label: "总额在这里", at: 22 },
      { shape: "underline", x: 0.2, y: 0.17, w: 0.52, h: 0.018, color: "#ffcf5c", label: "扣掉这一行", at: 54 },
      { shape: "arrow", x: 0.34, y: 0.24, w: 0.26, h: 0.06, label: "差 3.7 万", at: 88 },
    ],
    conclusion: "问题出在第二行",
    source: { platform: "我自己的对账表", capturedAt: "2026-10-01" },
  },
  C,
};
