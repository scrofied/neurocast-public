import React from "react";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, easeOutQuint, lerp, prog } from "./anim";

// ─────────────────────────────────────────────────────────────────────────────
// 元素入场语法层（分镜可控的动效）
//
// 背景：改造前 86% 的组件各自手写 `easeOutBack(prog(frame, at, 12))` + scale(0.9→1)，
// 于是不管镜头语义是什么，画面元素的出现方式都是同一套「回弹放大淡入」——这是
// 观感重复的根因。本文件把它抽成一层可切换的语法。
//
// 用法（组件侧）：
//   const enterAt = useEnter(variant);
//   const e = enterAt(frame, at);                       // kind 由镜头 motion.enter 决定
//   <div style={{ opacity: e.opacity, transform: `translate(-50%,-50%) scale(${e.scale}) translate(${e.dx}px,${e.dy}px)` }} />
//
// 优先级：shot.motion.enter（分镜显式声明）> 按 variant 轮转 > "rise"（＝原有外观，向后兼容）
//
// ⚠ 改 ENTER_KINDS 必须同步改 scripts/lib/motion.mjs（make.mjs 启动时会比对两处，不一致直接报错）
// ─────────────────────────────────────────────────────────────────────────────

export const ENTER_KINDS = ["rise", "slam", "slide-l", "slide-r", "wipe", "assemble", "zoom-through", "drop"] as const;
export type EnterKind = (typeof ENTER_KINDS)[number];

/** 镜头级动效声明（分镜 storyboard.json 的 shot.motion） */
export type MotionSpec = {
  /** 元素入场语法；不写则按 variant 轮转 */
  enter?: EnterKind;
  /** 1 克制 / 2 标准 / 3 强冲击；同时影响位移幅度与时长 */
  energy?: number;
};

export type EnterState = {
  /** 0→1 原始进度（已按 kind 各自缓动） */
  p: number;
  opacity: number;
  scale: number;
  /** px，相对组件自身定位 */
  dx: number;
  dy: number;
  /** deg */
  rot: number;
  /** wipe 专用：clip-path 值，其他 kind 为 undefined */
  clip?: string;
  /** 入场是否已结束 */
  done: boolean;
};

export type EnterOpts = {
  /** 强制指定，覆盖镜头声明（组件一般不用） */
  kind?: EnterKind;
  /** 组件原生默认入场：仅当分镜没写 motion.enter 时生效，用来保住组件原本的观感基线 */
  fallback?: EnterKind;
  /** 帧数，默认 14（再按 energy 缩放） */
  dur?: number;
  energy?: number;
  /** 位移幅度系数，默认按 energy 推导 */
  dist?: number;
  /** assemble 用它生成确定性的散开方向 */
  seed?: number;
  /** 起始缩放，覆盖 kind 默认值 */
  from?: number;
};

const hash01 = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** 纯函数版：给定帧与出场时刻，返回该元素的入场分量 */
export const enter = (frame: number, at: number, opts: EnterOpts = {}): EnterState => {
  const kind: EnterKind = opts.kind ?? "rise";
  const en = clamp(opts.energy ?? 2, 1, 3);
  const dur = Math.max(6, Math.round((opts.dur ?? 14) * (en === 1 ? 0.8 : en === 3 ? 1.2 : 1)));
  const amp = opts.dist ?? (en === 1 ? 0.6 : en === 3 ? 1.5 : 1);
  const raw = prog(frame, at, dur);
  const base: EnterState = { p: raw, opacity: 1, scale: 1, dx: 0, dy: 0, rot: 0, done: raw >= 1 };

  switch (kind) {
    case "slam": {
      // 加速坠入，由大缩小砸到位
      const p = easeIn(raw);
      return { ...base, p, opacity: clamp(raw * 2.4), scale: lerp(opts.from ?? 2.2, 1, p), dy: lerp(-240 * amp, 0, p) };
    }
    case "slide-l":
    case "slide-r": {
      // 从一侧推入
      const p = easeOut(raw);
      const dir = kind === "slide-l" ? -1 : 1;
      return { ...base, p, opacity: clamp(raw * 1.4), scale: lerp(0.97, 1, p), dx: lerp(dir * 240 * amp, 0, p) };
    }
    case "wipe": {
      // 遮罩擦除，元素本身不位移
      const p = easeInOut(raw);
      return { ...base, p, clip: `inset(0 ${(1 - p) * 100}% 0 0)` };
    }
    case "assemble": {
      // 零件从各自方向聚拢拼装（seed 不同则方向不同）
      const p = easeOut(raw);
      const inv = 1 - p;
      const sx = hash01(opts.seed ?? 0);
      const sy = hash01((opts.seed ?? 0) + 17);
      return {
        ...base,
        p,
        opacity: clamp(raw * 1.6),
        scale: lerp(1.1, 1, p),
        dx: (sx - 0.5) * 2 * 90 * amp * inv,
        dy: (sy - 0.5) * 2 * 60 * amp * inv,
        rot: (sx - 0.5) * 2 * 7 * inv,
      };
    }
    case "zoom-through": {
      // 从远处穿屏而来
      const p = easeOutQuint(raw);
      return { ...base, p, opacity: clamp(raw * 2.6), scale: lerp(opts.from ?? 3.2, 1, p) };
    }
    case "drop": {
      // 落下并停住（带一次回弹）
      const p = easeOutBack(raw);
      return { ...base, p, opacity: clamp(raw * 1.9), dy: lerp(-150 * amp, 0, p) };
    }
    default: {
      // rise —— 与 NeuroCast 原有的 easeOutBack 回弹淡入等价，保证迁移不改变外观
      const p = easeOutBack(raw);
      return { ...base, p, opacity: clamp(p * 1.4), scale: lerp(opts.from ?? 0.9, 1, p), dy: lerp(22 * amp, 0, p) };
    }
  }
};

/** 没有分镜声明时，按 variant 轮转一种入场语法（单变体组件被复用时也能不重样） */
export const enterKindForVariant = (variant: number): EnterKind => ENTER_KINDS[Math.abs(variant) % ENTER_KINDS.length];

const MotionCtx = React.createContext<MotionSpec>({});

/** 由引擎注入当前镜头的 motion 声明 */
export const MotionProvider: React.FC<{ spec?: MotionSpec; children: React.ReactNode }> = ({ spec, children }) => (
  <MotionCtx.Provider value={spec ?? {}}>{children}</MotionCtx.Provider>
);

export const useMotionSpec = (): MotionSpec => React.useContext(MotionCtx);

/**
 * 组件侧的入口。传入自己的 variant，返回一个 (frame, at, opts?) => EnterState。
 * kind 解析优先级：opts.kind（强制）> 镜头 motion.enter > opts.fallback（组件原生默认）> variant 轮转 > "rise"
 *
 * 关键：镜头声明始终压过组件默认——这正是「分镜能改动画」的落点。
 */
export const useEnter = (variant?: number) => {
  const spec = useMotionSpec();
  return React.useCallback(
    (frame: number, at: number, opts: EnterOpts = {}) =>
      enter(frame, at, {
        ...opts,
        kind: opts.kind ?? spec.enter ?? opts.fallback ?? (variant !== undefined ? enterKindForVariant(variant) : "rise"),
        energy: opts.energy ?? spec.energy,
      }),
    [spec, variant]
  );
};
