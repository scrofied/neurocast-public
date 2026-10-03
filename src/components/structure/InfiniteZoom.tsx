// 移植自 yihui-dev/awesome-opus5-5-videos（MIT）里 @koldo2k 的 prompt koldo2k-778767：
// 循环式「无限缩放」——摄像机从一个景观飞进下一个景观，靠的是穿过物体上的一个「洞口」，每层指数推近。
// https://x.com/koldo2k
//
// 中文改造：穿门无限缩放。从一张**真图**（截图/照片）里某个「洞口」（一个圆形按钮、一张卡片、一个 logo）
// 穿过去，进入下一张真图，再穿过去。3~5 个世界，loop 时末帧回到首帧，能成环。
// 每一层都必须是真文件：没有 src 就演 MissingAsset，绝不拿代码画的假画面冒充「穿进去了」。
// 适合开场（「我们把这张图放大看」）和结尾（回环收束）。
import React from "react";
import { z } from "zod";
import { Img, OffthreadVideo, useVideoConfig } from "remotion";
import { clamp, easeIn, easeInOut, easeOut, lerp, prog } from "../../lib/anim";
import { assetUrl, hasAsset, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const world = z.object({
  src: z.string().describe("这一层的真图（相对 public/）：截图/照片/海报，必须是外部文件"),
  label: z.string().optional().describe("这一层的小标签（≤8 字），如「主界面」「设置里」"),
  portal: z
    .object({
      x: z.number().min(0).max(1).default(0.5).describe("洞心横坐标（0~1 相对图，缺省正中）"),
      y: z.number().min(0).max(1).default(0.5).describe("洞心纵坐标（0~1 相对图）"),
      r: z.number().min(0.02).max(0.6).default(0.12).describe("洞口半径（0~1 相对图宽）"),
    })
    .default({ x: 0.5, y: 0.5, r: 0.12 })
    .describe("穿出去的「洞口」：下一层从这个洞里长出来"),
  at: z.number().optional().describe("穿过这个洞口的时刻（锚点台词原文或帧）；缺省 = 整段均分"),
  aspect: z.number().optional().describe("这张图的宽高比（宽/高），管线会自动探测并注入"),
  kind: z.string().optional().describe("素材类型，管线注入：image / video"),
});
const schema = z.object({
  kicker: z.string().optional().describe("左上角小标签，如 INFINITE ZOOM"),
  title: z.string().optional().describe("标题，如「我们把这张图一直放大」"),
  worlds: z.array(world).min(2).max(5).describe("2~5 个世界，一层穿进一层；顺序 = 穿越顺序"),
  loop: z.boolean().optional().describe("末帧回到首帧（循环用：最后一层穿回首图）"),
  source: sourceSchema,
});
type D = z.infer<typeof schema>;

// 每个世界放大 G 倍再穿门：指数插值才有「恒速感」，线性推近会一顿一顿
const G = 7.2;
const SEAM = 0.2; // 穿门占一段的 20%

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const { fps } = useVideoConfig();
  const n = d.worlds.length;
  const loop = !!d.loop;
  const L = loop ? n + 1 : n; // loop：把首图当作第 n 层再穿一次

  const raw = listCues(Array.from({ length: L }, (_, i) => ({ at: d.worlds[i % n].at })), 8, Math.max(60, dur - 44));
  const cues: number[] = [];
  for (let i = 0; i < L; i++) cues.push(Math.max(raw[i], i ? cues[i - 1] + 18 : 6));

  // 全局对数缩放坐标 u：段内线性、跨段连续 → scale = G^（层内进度）恒速推近
  let uo = 0;
  if (frame >= cues[L - 1]) {
    const after = clamp((frame - cues[L - 1]) / Math.max(1, dur - cues[L - 1]));
    uo = L - 1 + after * (loop ? 0.02 : 0.45); // loop：停在「回到首图」的那一帧附近才好接环
  } else {
    let k0 = 0;
    for (let i = 0; i < L; i++) if (frame >= cues[i]) k0 = i;
    uo = k0 + prog(frame, cues[k0], Math.max(1, cues[k0 + 1] - cues[k0]));
  }

  const boxW = width;
  const boxH = height;
  const coverOf = (ar: number) => {
    const a = ar && ar > 0.05 ? ar : 16 / 10;
    let W = boxW;
    let H = W / a;
    if (H < boxH) {
      H = boxH;
      W = H * a;
    }
    return { W, H };
  };
  const diag = Math.hypot(width, height);

  const e = enterAt(frame, cues[0], { fallback: "zoom-through", dur: 18, from: 1.35, dist: 0.4 });
  const eLab = enterAt(frame, cues[0] + 12, { fallback: "rise", dur: 14, dist: 0.5 });
  const kCur = Math.max(0, Math.min(L - 1, Math.floor(uo)));

  const layers: React.ReactNode[] = [];
  for (let k = 0; k < L; k++) {
    const q = uo - k; // 这一层的层内进度：0 = 刚穿进来铺满取景框，1 = 该穿门了
    if (q < -0.001 || q > 1.12) continue;
    const w = d.worlds[k % n];
    const { W, H } = coverOf(w.aspect ?? 16 / 10);
    const seamP = clamp(q / SEAM);
    // 摄像机从图心推向这一层的洞口（越接近穿门推得越实），恒定对数速率
    const eConv = Math.pow(easeInOut(clamp(q / 0.92)), 1.6);
    const focx = lerp(0.5, w.portal.x, eConv);
    const focy = lerp(0.5, w.portal.y, eConv);
    const sc = Math.pow(G, q) * lerp(0.88, 1, seamP);
    const portalPx = { x: W * w.portal.x, y: H * w.portal.y };
    const left = width / 2 - portalPx.x;
    const top = height / 2 - portalPx.y;
    const prev = k > 0 ? d.worlds[(k - 1) % n] : null;
    const prevCover = prev ? coverOf(prev.aspect ?? 16 / 10) : { W: width };
    const r0 = clamp(prev ? prev.portal.r * prevCover.W / Math.max(1, sc) : 0, 46, diag * 0.5);
    const dr = diag * 2.1 - r0;
    const clip = k === 0 || seamP >= 1 ? undefined : `circle(${(r0 + dr * easeOut(seamP)).toFixed(1)}px at ${(width / 2).toFixed(1)}px ${(height / 2).toFixed(1)}px)`;
    const outOp = 1 - easeIn(clamp((q - 1) / 0.14));
    const inOp = k === 0 ? 1 : clamp(seamP * 5);
    const live = q < 0.2 ? e.opacity : 1;
    const src = hasAsset(w.src) ? assetUrl(w.src) : undefined;

    layers.push(
      <div
        key={k}
        style={{
          position: "absolute",
          left,
          top,
          width: W,
          height: H,
          transform: `scale(${sc})`,
          transformOrigin: `${focx * 100}% ${focy * 100}%`,
          clipPath: clip,
          opacity: clamp(outOp * inOp * live),
        }}
      >
        {src ? (
          w.kind === "video" ? (
            <OffthreadVideo src={src} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          )
        ) : (
          // 这一层没给真图：演「缺素材」，别用代码画的假画面冒充穿进去的那一层
          <MissingAsset field="worlds[].src" hint="无限缩放的每一层都得是真图，穿进假画面等于骗人" w={W} h={H} frame={frame} at={cues[k]} />
        )}
      </div>,
    );
  }

  // 当前层的「门」：稳定期轻轻呼吸，穿门前被推近放大
  const cur = d.worlds[kCur % n];
  const qCur = uo - kCur;
  const curCover = coverOf(cur.aspect ?? 16 / 10);
  const curSc = Math.pow(G, qCur) * lerp(0.88, 1, clamp(qCur / SEAM));
  const eConvCur = Math.pow(easeInOut(clamp(qCur / 0.92)), 1.6);
  const focCur = { x: lerp(0.5, cur.portal.x, eConvCur), y: lerp(0.5, cur.portal.y, eConvCur) };
  const pmx = width / 2 + (cur.portal.x - focCur.x) * curCover.W * curSc;
  const pmy = height / 2 + (cur.portal.y - focCur.y) * curCover.H * curSc;
  const pmr = cur.portal.r * curCover.W * curSc;
  const pmOp = qCur < 0.1 ? easeOut(prog(qCur, 0.02, 0.12)) : 1 - easeIn(clamp((qCur - 0.7) / 0.25));

  const curW = d.worlds[kCur % n];
  const lblOp = (1 - easeIn(clamp((qCur - 0.3) / 0.3))) * (1 - easeOut(clamp((qCur - 0.72) / 0.3)));

  return (
    <>
      <Headline kicker={d.kicker ?? "INFINITE ZOOM"} title={d.title} frame={frame} y={64} size={44} />
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale})`, clipPath: e.clip, opacity: e.opacity }}>
          {layers}
        </div>

        {/* 穿门用的圆环：告诉观众「接下来从这里出去」 */}
        {pmOp > 0.01 && (
          <div style={{ position: "absolute", left: pmx - pmr, top: pmy - pmr, width: pmr * 2, height: pmr * 2, borderRadius: "50%", border: `3px dashed ${alpha(t.accent, 0.75)}`, boxShadow: `0 0 36px ${alpha(t.accent, 0.35)}, inset 0 0 30px ${alpha(t.accent, 0.2)}`, opacity: clamp(pmOp) * (0.6 + 0.4 * Math.sin(frame / 8)), transform: `rotate(${(frame / 3) % 360}deg)` }} />
        )}

        {/* 每层稳定后弹小标签 */}
        {curW.label && lblOp > 0.01 && (
          <div style={{ position: "absolute", left: 96, top: height - 205, display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 20px", borderRadius: 999, background: alpha(t.bg, 0.82), border: `2px solid ${alpha(t.primary, 0.7)}`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(curW.label, 620, 27, 18), color: t.text, whiteSpace: "nowrap", opacity: lblOp * eLab.opacity, transform: `translate(${eLab.dx}px, ${eLab.dy}px)`, boxShadow: `0 0 26px ${alpha(t.primary, 0.3)}` }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: t.accent, boxShadow: `0 0 10px ${t.accent}` }} />
            {`0${(kCur % n) + 1}`} · {curW.label}
          </div>
        )}

        {/* 真图就得写清出处：右下角角标卡在字幕上方 */}
        <div style={{ position: "absolute", right: 96, bottom: 200, opacity: e.opacity }}>
          <SourceBadge source={d.source} frame={frame} />
        </div>

        {/* 越穿越深：左上一个层级计数，观众知道还在往里走 */}
        <div style={{ position: "absolute", right: 96, top: 72, fontFamily: t.font.mono, fontSize: 20, letterSpacing: 4, color: alpha(t.dim, 0.9), opacity: e.opacity }}>
          DEPTH {String(Math.min(L, kCur + 1)).padStart(2, "0")} / {String(L).padStart(2, "0")}
        </div>

        {/* 四角轻压暗：视线收到中心 */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse ${diag * 0.62}px ${height * 0.62}px at 50% 50%, transparent 52%, ${alpha("#000000", 0.55)} 100%)` }} />
      </div>

      {cues.map((c, i) => (i === 0 ? null : <Sfx key={i} name="whoosh" at={c} volume={0.32} />))}
      <Sfx name="impact" at={cues[0]} volume={0.3} />
    </>
  );
};

export const InfiniteZoom: CompDef<D> = {
  id: "infinite-zoom",
  name: "穿门无限缩放（真图一层穿一层）",
  layer: "structure",
  variants: 2,
  minSec: 5,
  maxSec: 20,
  tags: ["放大", "钻进去", "层层", "开场", "结尾", "循环", "视角"],
  motion: { kind: "连续指数推镜穿过图上「洞口」，下一层从洞里放大出来", energy: 3 },
  desc: "2~5 张真图（截图/照片）层层相套：摄像机以恒定的对数速率推近，穿过当前层上标好的 portal 洞口，下一层从这个洞里放大出来（穿门瞬间上一层继续放大铺满并淡出，clipPath circle 半径同步增长），稳定期弹该层小标签，穿门处配 whoosh；loop = true 时最后一层穿回首图，末帧≈首帧可成环",
  use: "开场「我们把这张图一直放大看」，或结尾回环收束（产品截图 → 点进设置页 → 再钻进某个开关）。凡是「一层套一层、视角一路走到底」的句子用它。注意每层都得是真图：portal 指的是真图上的一个洞（圆形按钮/卡片/logo），代码画的假界面不能替代",
  schema,
  assetFields: ["worlds[].src"],
  example: {
    kicker: "INFINITE ZOOM",
    title: "把这张榜单一路钻进去",
    worlds: [
      { src: "assets/arena-rank-overall.png", label: "总排行榜", aspect: 2.13, portal: { x: 0.3, y: 0.36, r: 0.1 } },
      { src: "assets/demo-shot.png", label: "单个模型页", aspect: 1400 / 3200, portal: { x: 0.5, y: 0.16, r: 0.14 } },
      { src: "assets/arena-livebench.png", label: "跑分细节", aspect: 2.13, portal: { x: 0.68, y: 0.58, r: 0.11 } },
    ],
  },
  C,
};
