import React from "react";
import { clamp, easeIn, prog } from "./anim";
import { eoX } from "./spring";

// 逐字升起 / 逐字退场（移植自 opus-5-5-motion-gallery/v02 的 rise() 与 v03 的「每词独立遮窗」）
//
// 为什么单独做成一个原语：库里所有文字组件以前都是「整块淡入 + 轻微位移」，而这两条 demo 的做法是
// **每一个字是一条独立的、被遮罩盒裁住的动画**——字从自己的窗口下沿升起（eoX 指数缓出，
// 所以先窜到位再沉降，天然带「卡」感），退场时整行向上飞出去。字号越大越震撼，150px 的标题
// 用它是砸下来的，用淡入就是 PPT。
//
// 用法：<Rise text="三年等待" frame={frame} at={60} size={140} ... />
// 注意 size 是像素字号，容器高度按 size*1.3 算，父级给 left/top 定位即可。

export const Rise: React.FC<{
  text: string;
  frame: number;
  /** 第一个字起飞的帧 */
  at: number;
  /** 每字错峰帧数 */
  stagger?: number;
  /** 单字行程帧数 */
  len?: number;
  size: number;
  color: string;
  font: string;
  weight?: number;
  align?: "left" | "center";
  letterSpacing?: number;
  /** 整行向上退场的起始帧 */
  out?: number;
  outLen?: number;
  style?: React.CSSProperties;
}> = ({ text, frame, at, stagger = 1.4, len = 14, size, color, font, weight = 900, align = "left", letterSpacing = -0.02, out, outLen = 8, style }) => {
  const chars = Array.from(text);
  const exit = out !== undefined ? easeIn(prog(frame, out, outLen)) : 0;
  return (
    <div style={{ position: "absolute", display: "flex", justifyContent: align === "center" ? "center" : "flex-start", height: size * 1.3, overflow: "hidden", lineHeight: 1, ...style }}>
      {chars.map((c, i) => {
        const enter = 1 - eoX(clamp((frame - (at + i * stagger)) / len));
        const dy = enter * size * 1.3 - exit * size * 1.35;
        return (
          <span key={i} style={{ display: "inline-block", fontFamily: font, fontWeight: weight, fontSize: size, color, letterSpacing: `${letterSpacing}em`, whiteSpace: "pre", transform: `translateY(${dy}px)` }}>
            {c}
          </span>
        );
      })}
    </div>
  );
};

/** 逐词落拍的行（v03 hook 的写法：每个词一个遮窗，词与词之间留 gap，落点吸附到拍上） */
export const RiseWords: React.FC<{
  words: string[];
  times: number[];
  frame: number;
  size: number;
  color: string;
  font: string;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ words, times, frame, size, color, font, weight = 800, style }) => (
  <div style={{ position: "absolute", display: "flex", gap: size * 0.26, alignItems: "baseline", ...style }}>
    {words.map((wd, i) => (
      <span key={i} style={{ display: "inline-block", height: size * 1.22, overflow: "hidden", lineHeight: 1 }}>
        <span
          style={{
            display: "inline-block",
            fontFamily: font,
            fontWeight: weight,
            fontSize: size,
            color,
            whiteSpace: "pre",
            transform: `translateY(${(1 - eoX(clamp((frame - times[i]) / Math.max(1, size * 0.012 + 14)))) * size}px)`,
          }}
        >
          {wd}
        </span>
      </span>
    ))}
  </div>
);
