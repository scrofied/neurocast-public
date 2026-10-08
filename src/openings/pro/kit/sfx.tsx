import React, { createContext, useContext } from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";

// ── 资源路径 + 音效 ──────────────────────────────────────────────────
// 资源都在 public/pro/ 下（sfx/、demo/、jobs/）。
// 独立渲染（scripts/pro/render.mjs）时 publicDir = public/pro → base ""；
// 放进别的 Remotion 工程、publicDir 是整个 public/ 时 → base "pro/"（默认）。

const BaseCtx = createContext<string>("pro/");
export const ProAssetBase: React.FC<{ base: string; children: React.ReactNode }> = ({ base, children }) => <BaseCtx.Provider value={base}>{children}</BaseCtx.Provider>;
// 例外：`jobs/…`、`assets/…` 这类路径是「相对整个 public/」的 —— 接进 NeuroCast 后，
// 分镜里的真人素材由 scripts/lib/timed.mjs 拷进 public/jobs/<任务>/ 并写成 jobs/<任务>/aN.mp4。
// 这种路径不能再拼 base（否则找的是 public/pro/jobs/…，渲染时 404）。
const ROOT_REL = /^(jobs|assets|brands|opening-assets)\//;
export const useAsset = () => {
  const base = useContext(BaseCtx);
  return (p: string) => {
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    const rel = p.replace(/^\/+/, "");
    return staticFile(ROOT_REL.test(rel) ? rel : `${base}${rel}`.replace(/^\/+/, ""));
  };
};

// 音效时长（秒）。文件由 scripts/pro/gen_sfx.py 合成，同名替换成自己的素材即可。
export const PRO_SFX = {
  boom: 2.2, // 咚：低频冲击 + 混响（开场第一帧、大字落地）
  ding: 2.4, // 叮：明亮钟声（强调词、点亮）
  heart: 0.8, // 心跳 lub-dub（悬疑）
  swell: 1.8, // 反向镲上扬，戛然而止（放在冲击前）
  whip: 0.42, // 甩镜空气声（形态切换、飞入）
  shutter: 0.45, // 光圈叶片（机械快门）
  click: 0.12, // 单次机械咔哒
  slam: 0.7, // 砸字
  glitch: 0.42, // 数字故障
  tick: 0.07, // UI 滴答
  sub: 1.6, // 超低频下潜（紧张释放）
  shimmer: 1.3, // 闪光粒子尾音
  glass: 1.2, // 玻璃碎裂
  drone: 4.0, // 低频张力铺底（自带淡入淡出）
  type: 0.06, // 轻敲键
} as const;
export type ProSfxName = keyof typeof PRO_SFX;

const SfxCtx = createContext<{ on: boolean; vol: number }>({ on: true, vol: 1 });
export const SfxScope: React.FC<{ on: boolean; vol: number; children: React.ReactNode }> = ({ on, vol, children }) => <SfxCtx.Provider value={{ on, vol }}>{children}</SfxCtx.Provider>;

// <Sfx name="boom" at={1.2} vol={0.6} />  —— at 是秒（相对开场开始）
export const Sfx: React.FC<{ name: ProSfxName; at: number; vol?: number }> = ({ name, at, vol = 0.5 }) => {
  const { fps } = useVideoConfig();
  const s = useContext(SfxCtx);
  const asset = useAsset();
  if (!s.on || !Number.isFinite(at) || at < 0) return null;
  return (
    <Sequence from={Math.round(at * fps)} durationInFrames={Math.ceil(PRO_SFX[name] * fps) + 2} layout="none" name={`sfx:${name}`}>
      <Audio src={asset(`sfx/${name}.wav`)} volume={Math.min(1, vol * s.vol)} />
    </Sequence>
  );
};
