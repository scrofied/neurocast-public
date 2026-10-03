// 移植自 yihui-dev/awesome-opus5-5-videos（MIT）里 @verbove 的 prompt verbove-268381：
// 一镜到底的界面演进——同一个圆角框只改尺寸/圆角/描边色来换状态，内容永不交叉淡出，真光标驱动整条序列。
// https://x.com/verbove
//
// 原规则（这条是全库最值钱的）我按中文重述了一遍，实现都在下面：
//   全程同一个形状、不切镜；用闭式弹簧、只留一点点过冲；
//   内容在容器开始形变之后才进、下一次形变之前就出（文字不交叉）；
//   标签指示器的前后沿各接一条弹簧，走位时才会「拉伸」；相机推近让每个状态铺满画面；
//   禁止从暗色直接淡成强调色——改成把一个小强调色元素在状态之间搬动。
//
// 中文改造：讲「我从 A 页面点进去变成 B 页面再导出 C」这类流程。每一格都必须是**真截图**：
// 没给 src 就演 MissingAsset 占位，绝不拿代码画的假界面冒认真东西。
import React from "react";
import { z } from "zod";
import { Img, OffthreadVideo, useVideoConfig } from "remotion";
import { clamp, easeIn, easeInOut, easeOut, hash, lerp, prog } from "../../lib/anim";
import { assetUrl, MissingAsset, hasAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { env } from "../../lib/cine/motion";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const morphState = z.object({
  src: z.string().describe("这个状态的真截图（相对 public/），如 assets/arena-rank-overall.png"),
  label: z.string().describe("这一步在干什么（≤8 字），如「打开榜单」"),
  at: z.number().optional().describe("切到这个状态的时刻（锚点台词原文或帧）；缺省 = 整段均分"),
  click: z.object({ x: z.number(), y: z.number() }).optional().describe("光标在这一步点的位置（0~1 相对这张截图，左上角为原点）；不写 = 停在上一处点击"),
  zoom: z.number().optional().describe("这一步相机推近倍数，1 = 不推（1~2.2）"),
  focusX: z.number().optional().describe("相机推近的对焦点横坐标（0~1 相对截图），缺省 0.5"),
  focusY: z.number().optional().describe("相机推近的对焦点纵坐标（0~1 相对截图），缺省 0.5"),
  aspect: z.number().optional().describe("这张截图的宽高比（宽/高），管线会自动探测并注入"),
  kind: z.string().optional().describe("素材类型，管线注入：image / video"),
});
const schema = z.object({
  kicker: z.string().optional().describe("左上角小标签，如 ONE TAKE"),
  title: z.string().optional().describe("标题：一句话说清这条流程，如「从榜单点进对战再导出」"),
  states: z.array(morphState).min(2).max(6).describe("2~6 个真截图状态；同一个框在它们之间连续变形（一镜到底）"),
  source: sourceSchema,
});
type D = z.infer<typeof schema>;

const LEAD = 6; // 框先开始形变，内容晚 LEAD 帧才进
const RADS = [26, 46, 18, 34, 22, 42]; // 每个状态的圆角不同 → 形变读得出来
const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

// 闭式欠阻尼弹簧（step response）：t 用秒，zeta<1 只有一点点过冲。
// 纯帧数函数，不用 useSpring、不用 CSS transition，每帧都是时间解析式。
const sp = (t: number, zeta = 0.7, omega = 9) => {
  if (!(t > 0)) return 0;
  const z = clamp(zeta, 0.05, 0.995);
  const wd = omega * Math.sqrt(1 - z * z);
  const e = Math.exp(-z * omega * Math.min(t, 4));
  return 1 - e * (Math.cos(wd * t) + ((z * omega) / wd) * Math.sin(wd * t));
};

const rgb = (c: string): number[] => {
  const s = c.replace("#", "");
  const f = s.length === 3 ? s.split("").map((x) => x + x).join("") : s;
  const n = parseInt(f.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [56, 243, 255];
};
// 描边色在两个状态色之间**连续**插值（规则：不许从黑直接淡进强调色）
const mixC = (a: string, b: string, t: number, al = 1) => {
  const x = rgb(a);
  const y = rgb(b);
  const k = clamp(t);
  return `rgba(${Math.round(lerp(x[0], y[0], k))},${Math.round(lerp(x[1], y[1], k))},${Math.round(lerp(x[2], y[2], k))},${al})`;
};

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const { fps } = useVideoConfig();
  const n = d.states.length;

  // 每个状态的入场时刻（= 那一次点击生效的时刻）：显式 at 优先，否则整段均分；强制单调
  const raw = listCues(d.states.map((s) => ({ at: s.at })), 6, Math.max(48, dur - 26));
  const cues: number[] = [];
  for (let i = 0; i < n; i++) cues.push(Math.max(raw[i], i ? cues[i - 1] + 16 : 4));

  let k = -1;
  for (let i = 0; i < n; i++) if (frame >= cues[i]) k = i;
  if (k < 0) k = 0;

  // 三条独立弹簧：框体（一点点过冲）/ 指示器后沿 / 指示器前沿 —— 前后沿速率不同才会「拉伸」
  const p = sp((frame - cues[k]) / fps, 0.68, 9.5);
  const pL = sp((frame - cues[k]) / fps, 0.9, 6.2);
  const pR = sp((frame - cues[k]) / fps, 0.55, 12.5);

  const COLS = [t.primary, t.secondary, t.gold, t.accent, t.primary, t.secondary];
  const maxW = Math.min(width - 300, 1360);
  const maxH = height - 340;
  const geoOf = (i: number) => {
    const s = d.states[i];
    const ar = s.aspect && s.aspect > 0.05 ? s.aspect : 16 / 10;
    let w = Math.min(maxW, maxH * ar);
    let h = w / ar;
    if (h > maxH) {
      h = maxH;
      w = h * ar;
    }
    return {
      w,
      h,
      r: RADS[i % RADS.length],
      col: COLS[i % COLS.length],
      zoom: clamp(s.zoom ?? 1, 1, 2.2),
      fx: s.focusX ?? 0.5,
      fy: s.focusY ?? 0.5,
    };
  };
  const geoPrev = (i: number) => {
    if (i <= 0) {
      const g = geoOf(0);
      return { ...g, w: g.w * 0.52, h: g.h * 0.52, r: 72, zoom: 1, fx: 0.5, fy: 0.5 };
    }
    return geoOf(i - 1);
  };

  const g0 = geoPrev(k);
  const g1 = geoOf(k);
  const bw = lerp(g0.w, g1.w, p);
  const bh = lerp(g0.h, g1.h, p);
  const rad = lerp(g0.r, g1.r, p);
  const zoom = lerp(g0.zoom, g1.zoom, p);
  const fxc = lerp(g0.fx, g1.fx, p);
  const fyc = lerp(g0.fy, g1.fy, p);
  const cx = width / 2;
  const cy = height / 2 + 30;
  const bx = cx - bw / 2;
  const by = cy - bh / 2;

  // 内容窗：框开始形变 LEAD 帧后才进，下一次形变前 10 帧就出 → 文字永不交叉
  const inP = easeOut(prog(frame, cues[k] + LEAD, 12));
  const nextStart = k + 1 < n ? cues[k + 1] : Infinity;
  const outP = k + 1 < n ? easeIn(prog(frame, nextStart - 10, 8)) : 0;
  const vis = clamp(inP * (1 - outP));

  // 真光标：从上一次点击飞到这一次，到达时刻 = 切换前 3 帧，然后按下（涟漪 + click 音效）
  const cN = (i: number) => {
    const s = d.states[clamp(i, 0, n - 1)];
    return s.click ?? { x: 0.5, y: 0.55 };
  };
  const from = cN(k);
  const to = k + 1 < n ? cN(k + 1) : from;
  const tFrom = cues[k] + LEAD + 2;
  const tTo = k + 1 < n ? cues[k + 1] - 3 : dur;
  const tp = k + 1 < n ? easeInOut(prog(frame, tFrom, Math.max(8, tTo - tFrom))) : 1;
  const cux = lerp(from.x, to.x, tp) * bw;
  const cuy = lerp(from.y, to.y, tp) * bh;

  // 强调色元素在状态之间「搬动」，而不是把整个框染成强调色
  const csPrev = CORNERS[(Math.max(0, k) + (k === 0 ? 0 : 1)) % 4];
  const csCur = CORNERS[(k + 1 + (hash(d.states[k].src) % 2) * 2) % 4];
  const mk = 34 + 12 * Math.sin(frame / 9);
  const mx = lerp(csPrev[0] === 0 ? mk : bw - mk, csCur[0] === 0 ? mk : bw - mk, p);
  const my = lerp(csPrev[1] === 0 ? mk : bh - mk, csCur[1] === 0 ? mk : bh - mk, p);

  // 底部状态轨道：两端各接一条弹簧 → 走位时前导拉伸
  const trackW = Math.min(780, width - 380);
  const trackX = cx - trackW / 2;
  const trackY = height - 170; // 再往上抬：底部留给逐字字幕，轨道和状态名不能被压住
  const seg = trackW / n;
  const eL = lerp(Math.max(0, k - 1) * seg, k * seg, pL);
  const eR = lerp(Math.min(n, k + 1) * seg, Math.min(n, k + 2) * seg, pR);
  const iw = Math.max(10, eR - eL);

  const e = enterAt(frame, cues[0], { fallback: "rise", dur: 20, from: 0.9, dist: 0.5 });
  const eLab = enterAt(frame, cues[k] + LEAD + 2, { fallback: "drop", dur: 12, dist: 0.5 });

  const st = d.states[k];
  const live = 0.55 + 0.45 * Math.sin(frame / 6);
  const src = st.src;
  const isVideo = st.kind === "video";

  return (
    <>
      <Heading kicker={d.kicker ?? "ONE TAKE"} title={d.title} frame={frame} width={width} />
      <div
        style={{
          position: "absolute",
          left: bx,
          top: by,
          width: bw,
          height: bh,
          borderRadius: rad,
          overflow: "hidden",
          background: alpha(t.bg, 0.96),
          border: `3px solid ${mixC(g0.col, g1.col, p, 0.9)}`,
          boxShadow: `0 0 70px ${mixC(g0.col, g1.col, p, 0.32)}, 0 40px 130px rgba(0,0,0,.72)`,
          transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale})`,
          clipPath: e.clip,
          opacity: clamp(e.opacity),
        }}
      >
        {/* 相机：同一个元素连续推近，对焦点跟着状态走（不切镜） */}
        <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: `${fxc * 100}% ${fyc * 100}%` }}>
          <div style={{ position: "absolute", inset: 0, opacity: vis, transform: `scale(${lerp(1.035, 1, inP)})`, clipPath: `inset(0 ${(1 - inP) * 100}% 0 0)` }}>
            {hasAsset(src) ? (
              isVideo ? (
                <OffthreadVideo src={assetUrl(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <Img src={assetUrl(src)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )
            ) : (
              // 讲稿点名这一步的截图却没给文件：演「缺素材」，不拿代码画的假界面冒认真东西
              <MissingAsset field="states[].src" hint="这一格得是真截图：界面演进不能画假的" w={bw} h={bh} frame={frame} at={cues[k] + LEAD} />
            )}
          </div>

          {st.label && (
            <div style={{ position: "absolute", left: 22, top: 20, maxWidth: bw * 0.52, padding: "9px 18px", borderRadius: 999, background: alpha(t.bg, 0.8), border: `2px solid ${mixC(g0.col, g1.col, p, 0.75)}`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(st.label, bw * 0.46, 26, 18), color: t.text, whiteSpace: "nowrap", opacity: vis * eLab.opacity, transform: `translateY(${eLab.dy}px)`, boxShadow: `0 0 26px ${mixC(g0.col, g1.col, p, 0.3)}` }}>
              {st.label}
            </div>
          )}

          <div style={{ position: "absolute", right: 0, bottom: 18, paddingRight: 20, opacity: vis }}>
            <SourceBadge source={d.source} frame={frame} />
          </div>

          {/* 被强调色「搬过去」的小方块 + 停留时轻呼吸 */}
          <div style={{ position: "absolute", left: mx - 9, top: my - 9, width: 18, height: 18, borderRadius: 5, background: t.accent, boxShadow: `0 0 ${18 + 10 * Math.sin(frame / 7)}px ${alpha(t.accent, 0.85)}`, transform: `rotate(${45 * p}deg)`, opacity: 0.9 }} />

          {/* 点击涟漪：两道扩散环 + 实心点 */}
          {[0, 1, 2].map((j) => {
            const eAt = j === 2 ? cues[k] : cues[k] - 4;
            const rr = env(frame, eAt, 3 + j * 2, 2, 13);
            if (rr <= 0) return null;
            const size = j === 2 ? 20 : 34 + j * 34;
            return (
              <div
                key={j}
                style={{
                  position: "absolute",
                  left: cux - size / 2,
                  top: cuy - size / 2,
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  border: `${j === 2 ? 0 : 3}px solid ${alpha(t.accent, rr * (j === 2 ? 0.9 : 0.55))}`,
                  background: j === 2 ? alpha(t.accent, rr * 0.9) : "transparent",
                  opacity: rr,
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {/* 真光标（反缩放，保证相机推近时它不会变成一块板） */}
          <svg
            width={46}
            height={46}
            viewBox="0 0 40 40"
            style={{
              position: "absolute",
              left: cux - 6,
              top: cuy - 4,
              transform: `scale(${1 / zoom})`,
              transformOrigin: "8px 6px",
              filter: `drop-shadow(0 4px 10px rgba(0,0,0,.65)) drop-shadow(0 0 10px ${alpha(t.accent, 0.6)})`,
              opacity: clamp(e.opacity * 1.4),
              pointerEvents: "none",
            }}
          >
            <path d="M6 4 L6 34 L14 26 L20 40 L26 37 L20 24 L32 24 Z" fill="#ffffff" stroke="#10151d" strokeWidth={2.4} strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* 状态轨道：走到哪一格、拉伸多少，都是弹簧算出来的 */}
      <div style={{ position: "absolute", left: trackX, top: trackY, width: trackW, height: 6, borderRadius: 3, background: alpha(t.dim, 0.28), opacity: e.opacity }}>
        <div style={{ position: "absolute", left: eL, top: -2, width: iw, height: 10, borderRadius: 6, background: `linear-gradient(90deg, ${mixC(g0.col, g1.col, p, 0.95)}, ${alpha(t.accent, 0.9)})`, boxShadow: `0 0 22px ${alpha(t.accent, 0.55)}` }} />
      </div>
      {d.states.map((s, i) => (
        <div key={i} style={{ position: "absolute", left: trackX + seg * (i + 0.5), top: trackY - 44, transform: "translateX(-50%)", fontFamily: i === k ? t.font.title : t.font.mono, fontWeight: 900, fontSize: i === k ? 22 : 18, letterSpacing: i === k ? 1 : 3, color: i === k ? t.text : alpha(t.dim, 0.75), opacity: frame >= cues[i] ? (i === k ? 1 : 0.75) : 0.34 * live + 0.1, whiteSpace: "nowrap" }}>
          {i + 1}·{s.label}
        </div>
      ))}

      <Sfx name="impact" at={cues[0]} volume={0.34} />
      {cues.map((c, i) => (i === 0 ? null : <Sfx key={i} name="click" at={c} volume={0.34} />))}
    </>
  );
};

export const ScreenMorph: CompDef<D> = {
  id: "screen-morph",
  name: "一镜到底界面演进（真截图连续形变）",
  layer: "screen",
  variants: 3,
  minSec: 6,
  maxSec: 24,
  tags: ["流程", "界面", "点进去", "导出", "一镜到底", "操作路径", "演进"],
  motion: { kind: "同一个圆角框连续改尺寸/圆角/描边色换状态，真光标飞行点击，相机跟着推近", energy: 3 },
  desc: "2~6 张真截图当作同一个界面的不同状态：框体用闭式弹簧连续形变（不切镜、不交叉淡出），内容在框开始形变 6 帧后才进、下一次形变前就出；光标从上一次点击位置飞到下一次点击位置并按下（涟漪 + click），底部状态轨道指示器前后沿各接一条弹簧所以会拉伸，强调色元素在角之间搬动而不是整块染色",
  use: "讲「我在这页点进去 → 变成这页 → 再导出这一页」这类真实操作流程。凡是界面演进都用它，别再一张张卡片翻页地假装 UI。states[].src 必须是真截图，缺了会渲染 MissingAsset；要写来源就挂 source",
  schema,
  assetFields: ["states[].src"],
  example: {
    kicker: "ONE TAKE",
    title: "从榜单点进 LiveBench",
    states: [
      { src: "assets/arena-rank-overall.png", label: "打开榜单", aspect: 2.13, click: { x: 0.3, y: 0.36 }, zoom: 1 },
      { src: "assets/arena-rank-agentic.png", label: "换到 AGENTIC", aspect: 2.13, click: { x: 0.16, y: 0.2 }, zoom: 1.18, focusX: 0.34, focusY: 0.3 },
      { src: "assets/arena-livebench.png", label: "导出结果", aspect: 2.13, click: { x: 0.8, y: 0.76 }, zoom: 1.1, focusX: 0.66, focusY: 0.7 },
    ],
    source: { platform: "LMArena", url: "lmarena.ai", capturedAt: "2026-09-30" },
  },
  C,
};
