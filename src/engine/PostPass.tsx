import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, prog } from "../lib/anim";
import { alpha, useTheme } from "../lib/theme";
import type { PostSettings, Shot, Timeline } from "../types";
import { OVERLAP } from "./ShotFrame";

// ---------------------------------------------------------------------------
// 全片后期层（移植自 opus-video-skills · kinetic-reel 的 post pass，MIT (c) 2026 tuzhechen2005 /
// 源自 John Heibel 的 ClaudeAnimationBase，见 docs/OPUS55_ANIMATIONS.md）。
// 原片是一段 GLSL：slice（横条错位撕裂）→ split（RGB 三通道分离）→ grain → vignette → flash。
// Remotion 的画面是 DOM，拿不到「合成后的像素纹理」，所以这里用等价物：
//   · slice / split → 挂在镜头组外面的 SVG 滤镜（feTurbulence+feComponentTransfer 出硬边条带 →
//     feDisplacementMap 只沿 X 位移；再 feColorMatrix 拆三通道 + feOffset + feComposite 相加）
//   · grain / vignette / flash → 纯 DOM 覆盖层（本来就是这个成本最低的做法）
// 关键约定（和原片一样）：后期量不是常数，而是**卡在转场那一刻的包络**——稳定期 split/slice 归零，
// 画面干净；只有换镜的一瞬间撕裂。这样 filter 也只在少数帧上生效，不至于每帧全屏重绘。
// ---------------------------------------------------------------------------

// 强度的唯一权威定义在 src/types.ts 的 PostSettings（storyboard 的 meta.post 就是它），
// 这里只是给引擎侧一个短名字，别处再写一份字段就会漂移。
export type PostCfg = PostSettings;

export type Fx = { split: number; slice: number; flash: number; flashCol: string; seed: number };

// 每种转场的后期权重：越靠「物理感」强的转场撕裂越重；fade 不加任何后期（软切就该干净）
const FX_W: Record<string, { split: number; slice: number; flash: number }> = {
  glitch: { split: 0.012, slice: 0.5, flash: 0 },
  zoom: { split: 0.01, slice: 0.12, flash: 0 },
  push: { split: 0.012, slice: 0.1, flash: 0 },
  wipe: { split: 0.005, slice: 0.18, flash: 0 },
  grid: { split: 0.004, slice: 0.22, flash: 0 },
  matrix: { split: 0.007, slice: 0.12, flash: 0 },
  warp: { split: 0.008, slice: 0.08, flash: 0 },
  fly: { split: 0.006, slice: 0, flash: 0 },
  iris: { split: 0.004, slice: 0, flash: 0 },
  flood: { split: 0.003, slice: 0.06, flash: 0 },
  fade: { split: 0, slice: 0, flash: 0 },
  cut: { split: 0, slice: 0, flash: 0.08 },
};

// 原片：FX.flash = max(FX.flash, .08) 只在硬切那一帧
export const fxAt = (shots: Shot[], frame: number, cfg: PostCfg = {}, opening = false): Fx => {
  const fx: Fx = { split: 0, slice: 0, flash: 0, flashCol: "#ffffff", seed: 0 };
  const ch = cfg.chroma ?? 1;
  const tr = cfg.tear ?? 1;
  for (let i = 1; i < shots.length; i++) {
    const s = shots[i];
    // 重叠窗 = 本镜入场的前 OVERLAP 帧（上一镜的尾巴正好盖在这段上）
    if (frame < s.start || frame >= s.start + OVERLAP) continue;
    const w = FX_W[s.transition] || { split: 0.006, slice: 0.08, flash: 0 };
    const spike = Math.sin(Math.PI * prog(frame, s.start, OVERLAP)); // 进 0 → 峰值 → 出 0
    fx.split = Math.max(fx.split, w.split * spike * ch);
    fx.slice = Math.max(fx.slice, w.slice * spike * tr);
    fx.seed = i;
    if (w.flash && cfg.flashOnCut !== false && frame === s.start) fx.flash = w.flash;
  }
  // 首帧不闪不拆：开场第 0 帧必须干净（母 skill 的开场红线）
  if (frame < (opening ? 2 : 1)) {
    fx.split = 0;
    fx.slice = 0;
    fx.flash = 0;
  }
  return fx;
};

const px = (v: number) => Math.round(v * 100) / 100;

// 滤镜本体：只在真有后期量的帧挂上去，否则返回 undefined（零成本）
export const postFilter = (fx: Fx): React.CSSProperties | undefined =>
  fx.split > 0.0006 || fx.slice > 0.004 ? { filter: `url(#nc-post)` } : undefined;

export const PostDefs: React.FC<{ fx: Fx; width: number; height: number }> = ({ fx, width, height }) => {
  if (fx.split <= 0.0006 && fx.slice <= 0.004) return null;
  // 撕裂：位移幅度对齐原片的 uv 偏移（±.08 * slice），条带数对齐原片的 28 行
  const shift = px(0.16 * width * fx.slice);
  const bands = px(28 / Math.max(1, height));
  const sp = px(fx.split * width);
  const spY = px(fx.split * width * 0.15);
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="nc-post" x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
          {fx.slice > 0.004 && (
            <>
              {/* 只沿纵轴变化的噪声 → feFuncR discrete 二值化 → 硬边横条，每条整体左右错位 */}
              <feTurbulence type="fractalNoise" baseFrequency={`0 ${bands}`} numOctaves={1} seed={fx.seed + 3} result="nz" />
              <feComponentTransfer in="nz" result="qb">
                <feFuncR type="discrete" tableValues="0 1" />
                <feFuncG type="linear" slope="0" intercept="0.5" />
              </feComponentTransfer>
              {/* 位移图的 alpha 必须是满的，否则 feDisplacementMap 会把画面吃掉 */}
              <feColorMatrix in="qb" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="map" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale={shift} xChannelSelector="R" yChannelSelector="G" result="tear" />
            </>
          )}
          {fx.split > 0.0006 ? (
            <>
              <feColorMatrix in={fx.slice > 0.004 ? "tear" : "SourceGraphic"} type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cR" />
              <feColorMatrix in={fx.slice > 0.004 ? "tear" : "SourceGraphic"} type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cG" />
              <feColorMatrix in={fx.slice > 0.004 ? "tear" : "SourceGraphic"} type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB" />
              <feOffset in="cR" dx={sp} dy={spY} result="oR" />
              <feOffset in="cB" dx={-sp} dy={-spY} result="oB" />
              <feComposite in="oR" in2="cG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg" />
              <feComposite in="rg" in2="oB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rgb" />
            </>
          ) : null}
        </filter>
      </defs>
    </svg>
  );
};

// 覆盖层：颗粒 / 扫描线 / 暗角 / 闪白。镜头组之外，HUD 与字幕也在它们之上（和原片顺序一致）
export const PostOverlays: React.FC<{ fx: Fx; cfg?: PostCfg; seed: number }> = ({ fx, cfg, seed }) => {
  const f = useCurrentFrame();
  const t = useTheme();
  const grain = cfg?.grain ?? 0.07;
  const vign = cfg?.vign ?? 0.95;
  const scan = cfg?.scan ?? 1;
  const vg = clamp(vign) * 0.9;
  return (
    <>
      {vg > 0.01 && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 45%, transparent 55%, ${alpha(t.bg, vg)} 100%)`, pointerEvents: "none" }} />}
      {scan > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `repeating-linear-gradient(0deg, ${alpha("#ffffff", 0.018 * scan)} 0px, ${alpha("#ffffff", 0.018 * scan)} 1px, transparent 1px, transparent 3px)`,
            pointerEvents: "none",
          }}
        />
      )}
      {grain > 0.001 && (
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: grain, mixBlendMode: "overlay", pointerEvents: "none" }}>
          <filter id="nc-grain">
            {/* seed 跟帧号走：原片的 grain 是 h(uv*res + time*61.7)，逐帧换噪 */}
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={(f + seed) % 97} />
          </filter>
          <rect width="100%" height="100%" filter="url(#nc-grain)" />
        </svg>
      )}
      {fx.flash > 0.001 && <div style={{ position: "absolute", inset: 0, background: fx.flashCol, opacity: clamp(fx.flash), pointerEvents: "none" }} />}
    </>
  );
};

// 时间轴 → meta.post 的读法（storyboard/input 都能带；老片子没写就用默认值）
export const postCfgOf = (meta: Timeline["meta"]): PostCfg => meta.post || {};
