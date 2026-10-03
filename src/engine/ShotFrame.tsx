import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { alpha, useTheme } from "../lib/theme";
import { clamp, easeIn, easeInOut, easeOutQuint, lerp, noise1, prog } from "../lib/anim";

const ENTER = 18;
const EXIT = 12;
// every shot is rendered this many frames past its end so its exit crosses the next shot's entry
export const OVERLAP = 12;
export const TRANSITIONS = ["fly", "warp", "iris", "glitch", "fade", "cut", "flood", "zoom", "push", "wipe", "grid"] as const;

// ---------------------------------------------------------------------------
// 形状连续转场（移植自 opus-video-skills · kinetic-reel 的 trZoom / trPush / trWipe / trGrid，
// MIT (c) 2026 tuzhechen2005，源自 John Heibel 的 ClaudeAnimationBase；见 docs/OPUS55_ANIMATIONS.md）
// 思路：上一镜不淡出、不剪走，下一镜从上一镜画面里「那个形状」里长出来盖满全屏。
// 我们的镜头本来就重叠 OVERLAP 帧，所以 A/B 两侧能用同一个 k 各自算：
//   A 侧（本镜的尾巴）：由「下一镜的 transition」决定怎么做几何变换；
//   B 侧（本镜的开头）：由「本镜的 transition」决定 clip/mask 怎么揭开。
// 两侧同帧、同参数，视觉上就是同一扇门在放大。
// ---------------------------------------------------------------------------
export const CONTINUITY = ["zoom", "push", "wipe", "grid"] as const;
export const isContinuity = (t?: string) => !!t && (CONTINUITY as readonly string[]).includes(t);

// through = 「洞」在上一镜画面的哪儿：[中心x, 中心y, 宽, 高]，0~1 归一化。
// 没写就用画面中间偏上的一块——上一镜没有明显可钻的形状时，也比硬切有连续性。
export type Through = [number, number, number, number];
const DEF_THROUGH: Through = [0.5, 0.44, 0.26, 0.3];
const PUSH_DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

const ioExpo = (x: number) => {
  const v = clamp(x);
  if (v === 0) return 0;
  if (v === 1) return 1;
  return v < 0.5 ? Math.pow(2, 20 * v - 10) / 2 : (2 - Math.pow(2, -20 * v + 10)) / 2;
};
const seg = (x: number, a: number, b: number) => clamp((x - a) / Math.max(1e-6, b - a));
const poly = (x0: number, y0: number, x1: number, y1: number) =>
  `polygon(${Math.round(x0)}px ${Math.round(y0)}px, ${Math.round(x1)}px ${Math.round(y0)}px, ${Math.round(x1)}px ${Math.round(y1)}px, ${Math.round(x0)}px ${Math.round(y1)}px)`;

// trZoom 的几何：把上一镜的洞放大到铺满全屏（A 侧推进、B 侧在洞里显形）
const zoomGeom = (k: number, W: number, H: number, r: Through) => {
  const cx = r[0] * W;
  const cy = r[1] * H;
  const rw = Math.max(8, r[2] * W);
  const rh = Math.max(8, r[3] * H);
  const e = ioExpo(k);
  const s = Math.pow(Math.max(W / rw, H / rh), e);
  return { e, cx, cy, rw, rh, s, px: lerp(cx, W / 2, e), py: lerp(cy, H / 2, e) };
};

const GRID_COLS = 16;
const GRID_ROWS = 9;

// 网格溶解的揭开蒙版：沿对角线依次把格子放开。用 data-URI 蒙版而不是 <mask> 引用，
// 因为无头 Chrome 对 HTML 元素上的 SVG mask 引用支持不一，data-URI 是稳的。
const gridMask = (k: number, W: number, H: number) => {
  const cw = W / GRID_COLS;
  const ch = H / GRID_ROWS;
  let cells = "";
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const d = (c + r) / (GRID_COLS + GRID_ROWS - 2);
      if (seg(k, d * 0.6, d * 0.6 + 0.4) < 0.5) continue;
      cells += `%3Crect x='${Math.round(c * cw)}' y='${Math.round(r * ch)}' width='${Math.ceil(cw) + 1}' height='${Math.ceil(ch) + 1}'/%3E`;
    }
  }
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'%3E%3Cg fill='%23ffffff'%3E${cells}%3C/g%3E%3C/svg%3E")`;
};

// 同一批格子的前半拍：先亮起强调色小方块，再被画面顶替（原片 trGrid 就是这个两段式）
const GridPops: React.FC<{ k: number; W: number; H: number; col: string }> = ({ k, W, H, col }) => {
  const cw = W / GRID_COLS;
  const ch = H / GRID_ROWS;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const d = (c + r) / (GRID_COLS + GRID_ROWS - 2);
      const kk = seg(k, d * 0.6, d * 0.6 + 0.4);
      if (kk <= 0) continue;
      const x = c * cw;
      const y = r * ch;
      if (kk < 0.5) {
        const s = kk * 2;
        cells.push(<rect key={`${c}-${r}`} x={x + (cw * (1 - s)) / 2} y={y + (ch * (1 - s)) / 2} width={cw * s} height={ch * s} fill={col} />);
      } else {
        cells.push(<rect key={`${c}-${r}`} x={x} y={y} width={cw} height={ch} fill={col} opacity={2 - kk * 2} />);
      }
    }
  }
  if (!cells.length) return null;
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{cells}</svg>;
};

// Wraps every shot: entry/exit transition + continuous slow camera move so no frame is static.
// "cut": no entry animation (e.g. the talking-head opening must be visible from frame 0), soft exit.
export const ShotFrame: React.FC<{
  frame: number;
  dur: number;
  transition: string;
  seed: number;
  children: React.ReactNode;
  /** 下一镜的入场转场：决定本镜尾巴 12 帧怎么「被穿出去」 */
  nextTransition?: string;
  /** 本镜自己的变体：push 用它选推进方向（0→右 1→下 2→左 3→上） */
  variant?: number;
  /** 下一镜的变体：A 侧 push 要和下一镜用同一个方向 */
  nextVariant?: number;
  /** 本镜入场要钻的洞（在上一镜画面里） */
  through?: Through;
  /** 本镜出场被钻的洞（= 下一镜的 through） */
  nextThrough?: Through;
}> = ({ frame, dur, transition, seed, children, nextTransition, variant, nextVariant, through, nextThrough }) => {
  const t = useTheme();
  const { width: W, height: H } = useVideoConfig();
  const pin = transition === "cut" ? 1 : easeOutQuint(prog(frame, 0, ENTER));
  const pout = easeIn(prog(frame, dur - EXIT, EXIT));
  const life = clamp(frame / Math.max(1, dur));
  const cam = 1 + life * 0.045;
  const dx = noise1(frame / 80, seed) * 10;
  const dy = noise1(frame / 95, seed + 7) * 6;
  const rz = noise1(frame / 120, seed + 3) * 0.4;

  const kIn = prog(frame, 0, EXIT);
  const kOut = prog(frame, dur - EXIT, EXIT);
  const entering = frame < EXIT;
  const leaving = frame >= dur - EXIT;

  let style: React.CSSProperties = {};
  let overlay: React.ReactNode = null;

  if (entering && transition === "zoom") {
    // B 侧：不做任何变换，只把画面裁在「正在放大的洞」里，并快速显形
    const g = zoomGeom(kIn, W, H, through || DEF_THROUGH);
    style = { clipPath: poly(g.px - (g.rw * g.s) / 2, g.py - (g.rh * g.s) / 2, g.px + (g.rw * g.s) / 2, g.py + (g.rh * g.s) / 2), opacity: clamp(g.e * 2.2 - 0.2) };
  } else if (entering && transition === "push") {
    const [ux, uy] = PUSH_DIRS[Math.max(0, Math.round(variant ?? 0)) % 4];
    style = { transform: `translate(${ux * W * (1 - ioExpo(kIn))}px, ${uy * H * (1 - ioExpo(kIn))}px)` };
  } else if (entering && transition === "wipe") {
    const e = easeInOut(kIn);
    const x = e * (W + 40);
    style = { clipPath: poly(0, 0, x, H) };
    overlay = <div style={{ position: "absolute", left: x - 4, top: 0, width: 8, height: "100%", background: t.accent, boxShadow: `0 0 26px ${alpha(t.accent, 0.85)}`, opacity: 1 - Math.abs(0.5 - e) * 0.8 }} />;
  } else if (entering && transition === "grid") {
    const e = easeInOut(kIn);
    const m = gridMask(e, W, H);
    style = { WebkitMaskImage: m, maskImage: m, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "100% 100%", maskSize: "100% 100%" };
    overlay = <GridPops k={e} W={W} H={H} col={alpha(t.accent, 0.9)} />;
  } else if (leaving && nextTransition === "zoom") {
    // A 侧：本镜正被下一镜「从自己身上钻出去」——满不透明，只做几何推进
    const g = zoomGeom(kOut, W, H, nextThrough || DEF_THROUGH);
    style = { transform: `translate(${g.px}px, ${g.py}px) scale(${g.s}) translate(${-g.cx}px, ${-g.cy}px)`, transformOrigin: "0 0" };
  } else if (leaving && nextTransition === "push") {
    const [ux, uy] = PUSH_DIRS[Math.max(0, Math.round(nextVariant ?? 0)) % 4];
    style = { transform: `translate(${-ux * W * ioExpo(kOut)}px, ${-uy * H * ioExpo(kOut)}px)` };
  } else if (leaving && (nextTransition === "wipe" || nextTransition === "grid")) {
    // 原片 trWipe / trGrid 都是 drawImage(A, 0, 0) 先打底：上一镜整幅停住当底，下一镜盖上来
    style = {};
  } else if (isContinuity(transition)) {
    // 形状连续但不在窗口里（稳定期，或下一镜不是连续转场）：只留一个很软的收尾，不加额外动画
    style = { opacity: 1 - pout * 0.6 };
  } else if (transition === "cut" || transition === "fade") {
    style = { opacity: pin * (1 - pout), transform: `scale(${1 + pout * 0.06})`, filter: pout > 0.01 ? `blur(${pout * 10}px)` : undefined };
  } else if (transition === "fly") {
    const s = 0.55 + 0.45 * pin + pout * 0.9;
    style = { transform: `scale(${s})`, opacity: pin * (1 - pout), filter: `blur(${(1 - pin) * 14 + pout * 18}px)` };
  } else if (transition === "warp") {
    style = {
      transform: `perspective(1600px) rotateY(${(1 - pin) * -38 + pout * 32}deg) translateX(${(1 - pin) * 260 - pout * 300}px) scale(${0.9 + 0.1 * pin})`,
      opacity: pin * (1 - pout),
      filter: `blur(${(1 - pin) * 8 + pout * 10}px)`,
    };
  } else if (transition === "iris") {
    const r = pin * 120 * (1 - pout * 0.999);
    style = { clipPath: `circle(${r}% at 50% 48%)`, transform: `scale(${1.15 - 0.15 * pin})` };
    overlay = (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "48%",
          width: 0,
          height: 0,
          boxShadow: `0 0 0 ${r * 11}px transparent, 0 0 60px 6px ${alpha(t.primary, (1 - pin) * 0.8 + pout * 0.8)}`,
          borderRadius: "50%",
        }}
      />
    );
  } else if (transition === "flood") {
    // 一块黑形状涨满吞掉上一场，再收缩成一颗圆点把下一场「吐」出来。
    // 不剪、不淡出：下一场是从上一场里长出来的（移植自 @twoclipping 的 keynote 一镜到底规则）。
    // 镜头有 12 帧重叠，所以上一镜的 cov→1 与本镜的 cov→0 在时间上是连续的同一块黑。
    const cov = Math.max(1 - pin, pout);
    style = { filter: cov > 0.02 ? `blur(${cov * 5}px)` : undefined, transform: `scale(${1 + cov * 0.03})` };
    if (cov > 0.004) {
      const round = 6 + 44 * (1 - cov); // 满屏时接近方形，退场末了收成圆点
      overlay = (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div
            style={{
              width: 2500,
              height: 2500,
              borderRadius: `${round}%`,
              background: "#04060b",
              transform: `scale(${0.02 + 0.98 * cov})`,
              boxShadow: `0 0 90px 30px rgba(0,0,0,.85), 0 0 0 2px ${alpha(t.primary, 0.5 * (1 - cov))}`,
            }}
          />
        </div>
      );
    }
  } else {
    // glitch
    const g = (1 - pin) + pout;
    const j = g > 0.02 ? noise1(frame * 3.1, seed) * 40 * g : 0;
    style = { transform: `translateX(${j}px) skewX(${j * 0.08}deg)`, opacity: clamp(pin * 1.4) * (1 - pout), filter: g > 0.02 ? `hue-rotate(${j * 3}deg) contrast(${1 + g * 0.6})` : undefined };
    if (g > 0.05)
      overlay = (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${((noise1(frame * 1.7 + i * 11, seed) + 1) / 2) * 100}%`,
                height: 4 + i * 5,
                background: alpha(i % 2 ? t.primary : t.secondary, 0.55 * g),
                transform: `translateX(${noise1(frame * 2 + i, seed) * 120}px)`,
                mixBlendMode: "screen",
              }}
            />
          ))}
        </>
      );
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill style={style}>
        <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${cam}) rotate(${rz}deg)` }}>{children}</AbsoluteFill>
      </AbsoluteFill>
      {overlay}
    </AbsoluteFill>
  );
};
