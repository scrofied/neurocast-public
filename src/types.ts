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
  motion?: Motion;
  hideCaptions?: boolean;
};

// t: absolute start frame of every displayed char (karaoke highlight follows the real voice)
export type Caption = { start: number; end: number; text: string; t?: number[]; hl?: [number, number][] };

export type Chapter = { title: string; start: number; end: number };

// audio clips on the master timeline; trimBefore/trimAfter in frames of the source
export type AudioClip = { src: string; from: number; trimBefore?: number; trimAfter?: number; volume?: number; name?: string };

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
