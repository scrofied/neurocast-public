import type { EnterKind } from "./lib/enter";

// shot.motion：分镜级的动效声明（storyboard.json 里每条镜头可写 motion 字段）
export type Motion = {
  /** 元素入场语法；不写则按该组件第几次出现自动轮转 */
  enter?: EnterKind;
  /** 1 克制 / 2 标准 / 3 强冲击 */
  energy?: number;
};

export type Shot = {
  id: string;
  type: string;
  variant: number;
  start: number; // frame
  dur: number; // frames
  chapter: number;
  text: string;
  data: Record<string, any>;
  transition: string;
  // 形状连续转场（zoom）时，下一镜从本镜画面「哪个位置」钻出来：[中心x, 中心y, 宽, 高]，0~1 归一化。
  // 挂在入场那一镜上（和 transition 同侧），写的是上一镜画面里的洞。不写则用画面中上的一块。
  through?: [number, number, number, number];
  motion?: Motion;
  hideCaptions?: boolean;
};

// t: absolute start frame of every displayed char (karaoke highlight follows the real voice)
export type Caption = { start: number; end: number; text: string; t?: number[]; hl?: [number, number][] };

export type Chapter = { title: string; start: number; end: number };

// audio clips on the master timeline; trimBefore/trimAfter in frames of the source
export type AudioClip = { src: string; from: number; trimBefore?: number; trimAfter?: number; volume?: number; name?: string };

// 全片后期层强度（storyboard/input 的 meta.post；engine/PostPass.tsx 消费）
export type PostSettings = {
  /** 颗粒强度，0 关掉；默认 0.07 */
  grain?: number;
  /** 暗角强度 0~1；默认 0.95 */
  vign?: number;
  /** 扫描线 0~1；默认 1 */
  scan?: number;
  /** RGB 通道分离倍率：0 完全不撕裂色彩（保守片子），默认 1 */
  chroma?: number;
  /** 横条错位撕裂倍率：0 关掉画面撕裂，默认 1 */
  tear?: number;
  /** 硬切那一帧打不打白闪；默认 true */
  flashOnCut?: boolean;
};

export type Timeline = {
  meta: {
    title: string;
    seed: number;
    skin: string;
    font: string;
    world: string;
    fps: number;
    width: number;
    height: number;
    mirror: boolean;
    audio?: string | null; // legacy single track starting at frame 0
    bgm?: string | null;
    showCaptions: boolean;
    sfx?: boolean;
    chapterFlash?: boolean;
    // 全片后期层：不写用默认（观感和老片子一致）
    post?: PostSettings;
    // muted talking-head clip: full screen for `full` frames, then a picture-in-picture box
    presenter?: { src: string; poster?: string; frames: number; offset: number; rate?: number; full: number; focusX: number; focusY: number; hideFrom?: number };
  };
  durationInFrames: number;
  chapters: Chapter[];
  shots: Shot[];
  captions: Caption[];
  audioClips?: AudioClip[];
  // per-script opening for TTS-only films (storyboard.opening): transparent overlay above the presenter, frames
  opening?: { type: string; at?: number; until?: number; data?: Record<string, any> };
};

export type ShotProps = {
  shot: Shot;
  frame: number; // local frame within the shot
  dur: number;
};
