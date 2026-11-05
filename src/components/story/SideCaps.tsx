import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../types";

// ═══ 真人两侧要点（over 层）═══════════════════════════════════════════════
// 正片中途「真人重新全屏讲几句」时用的动效层：分镜给那一镜写 presenter:"full" + over，
// 引擎把真人从右上角小窗推回全屏，这一层画在他**两侧** —— 左列要点胶囊逐条卡词弹出，
// 右侧一枚盖章卡砸住这句话。中间留给人脸，顶部留给 HUD，底部留给字幕，一概不占。
// 和 side-brand-fx 的区别：那个比的是「A 指挥 B」两方关系（要两个真 logo），这个只是
// 把讲话人身边贴几条他正在说的要点，任何题材都能用。
const cap = z.object({
  text: z.string().describe("胶囊文字，≤10 字（这是给扫一眼的人看的，不是字幕）"),
  at: z.number().optional().describe("弹出的时刻（台词锚点或帧）；缺省 = 按顺序排在上一条之后 12 帧"),
  tone: z.enum(["key", "accent", "warn"]).optional().describe("配色：key 主色 / accent 强调 / warn 警示红"),
});
const schema = z.object({
  left: z.array(cap).max(4).optional().describe("真人左侧要点胶囊（最多 4 条，自上而下）"),
  right: z.array(cap).max(4).optional().describe("真人右侧要点胶囊"),
  stamp: z
    .object({
      text: z.string().describe("章面上的大字，≤6 字"),
      sub: z.string().optional().describe("章下面一行小字"),
      at: z.number().optional().describe("盖章时刻（锚点）"),
      tone: z.enum(["key", "accent", "warn"]).optional(),
    })
    .optional()
    .describe("右侧盖章卡：说到那个词时「啪」一下扣上去，带冲击环"),
  outAt: z.number().optional().describe("整层收起的时刻（锚点）；缺省 = 镜头结束前 14 帧"),
});
type D = z.infer<typeof schema>;

// 黑描边：真人画面亮一片，字没有描边就直接糊掉
const ink = { textShadow: "0 2px 0 rgba(0,0,0,.9), 0 0 16px rgba(0,0,0,.85), 0 0 3px rgba(0,0,0,.9)" } as const;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const outAt = cueOr(d.outAt, dur - 14);
  const outK = easeIn(prog(frame, outAt, 12)); // 1 = 已经完全滑出两侧
  const toneOf = (x?: string) => (x === "warn" ? t.bad : x === "accent" ? t.accent : t.primary);

  // 一列胶囊：自上而下排，每条按锚点弹出，之后一直轻微浮动（画面不能静止超过 2.5s）
  const column = (caps: D["left"], side: "l" | "r") => {
    if (!caps?.length) return null;
    let prev = 0;
    const cw = W * 0.235;
    const x = side === "l" ? W * 0.052 : W - W * 0.052 - cw;
    const top = H * 0.3;
    const step = H * 0.115;
    return caps.map((c, i) => {
      const at = cueOr(c.at, prev + 8 + i * 12);
      prev = at;
      const e = enterAt(frame, at, { fallback: side === "l" ? "slide-l" : "slide-r", dur: 13, dist: 1.1 });
      const op = e.opacity * (1 - outK);
      const col = toneOf(c.tone);
      const drift = Math.sin((frame - at) / 22 + i * 1.7) * 4;
      const lead = clamp((frame - at) / 10); // 出场那一拍亮一下头
      // 引线/光点挂在胶囊靠人那一侧。computed key 在 CSSProperties 上不好过类型，直接按侧给两个对象
      const link: React.CSSProperties = side === "l" ? { right: -46 } : { left: -46 };
      const dot: React.CSSProperties = side === "l" ? { right: -54 } : { left: -54 };
      return (
        <div
          key={`${side}${i}`}
          style={{
            position: "absolute",
            left: x + (side === "l" ? -1 : 1) * 90 * outK + e.dx * 0.35,
            top: top + i * step + drift + e.dy,
            width: cw,
            opacity: op,
            transform: `scale(${e.scale})`,
            pointerEvents: "none",
          }}
        >
          {/* 指向讲话人的一道引线 */}
          <div style={{ position: "absolute", top: 26, ...link, width: 46, height: 2, background: `linear-gradient(${side === "l" ? "90deg" : "270deg"}, ${alpha(col, 0.75)}, ${alpha(col, 0)})`, opacity: e.p, transform: `scaleX(${easeOut(e.p)})`, transformOrigin: side === "l" ? "right" : "left" }} />
          <div style={{ position: "absolute", top: 18, ...dot, width: 11, height: 11, borderRadius: 6, background: col, boxShadow: `0 0 ${10 + 16 * lead}px ${col}`, opacity: e.p }} />
          <div
            style={{
              padding: "15px 22px",
              borderRadius: 16,
              background: "linear-gradient(150deg, rgba(10,8,20,0.74), rgba(6,4,14,0.55))",
              border: `1.6px solid ${alpha(col, 0.5 + 0.4 * lead)}`,
              boxShadow: `0 0 ${18 + 22 * lead}px ${alpha(col, 0.3)}, inset 0 0 22px rgba(255,255,255,0.04)`,
              fontFamily: t.font.title,
              fontWeight: 900,
              fontSize: 33,
              letterSpacing: 1.5,
              color: "#fff",
              textAlign: side === "l" ? "left" : "right",
              ...ink,
            }}
          >
            {c.text}
          </div>
          <Sfx name={c.tone === "warn" ? "impact" : "tick"} at={at} volume={c.tone === "warn" ? 0.3 : 0.26} />
        </div>
      );
    });
  };

  // 右侧盖章卡：斜着一扣，扣上瞬间一圈冲击环
  const stamp = () => {
    const s = d.stamp;
    if (!s) return null;
    const at = cueOr(s.at, dur * 0.55);
    const col = toneOf(s.tone);
    const k = easeOutBack(clamp((frame - at) / 13));
    if (k <= 0.001) return null;
    const op = k * (1 - outK);
    const sw = W * 0.185;
    const sh = sw * 0.62;
    const sx = W - W * 0.06 - sw;
    const sy = H * 0.3 + (d.right?.length ?? 0) * H * 0.115 + H * 0.02;
    const ring = clamp((frame - at) / 16);
    return (
      <div style={{ position: "absolute", left: sx + 120 * outK, top: sy, width: sw, height: sh, opacity: op, transform: `scale(${0.5 + 0.5 * k}) rotate(${-7 + 7 * (1 - k)}deg)`, pointerEvents: "none" }}>
        {ring > 0 && ring < 1 && <div style={{ position: "absolute", inset: -10, borderRadius: 22, border: `3px solid ${alpha(col, 0.8 * (1 - ring))}`, transform: `scale(${1 + ring * 0.5})` }} />}
        <div style={{ position: "absolute", inset: 0, borderRadius: 18, background: alpha(col, 0.16), border: `2.5px solid ${alpha(col, 0.85)}`, boxShadow: `0 0 34px ${alpha(col, 0.4)}, inset 0 0 30px ${alpha(col, 0.14)}` }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: sw * 0.2, letterSpacing: 2, color: "#fff", ...ink }}>{s.text}</div>
          {s.sub && <div style={{ fontFamily: t.font.body, fontSize: sw * 0.082, color: alpha("#fff", 0.82), letterSpacing: 1, ...ink }}>{s.sub}</div>}
        </div>
        <Sfx name="stamp" at={at} volume={0.34} />
      </div>
    );
  };

  return (
    <>
      {column(d.left, "l")}
      {column(d.right, "r")}
      {stamp()}
    </>
  );
};

export const SideCaps: CompDef<D> = {
  id: "side-caps",
  name: "真人两侧要点（over 层）",
  layer: "overlay",
  variants: 1,
  minSec: 1.8,
  maxSec: 8,
  tags: ["真人全屏", "两侧", "要点", "盖章", "over"],
  motion: { kind: "两侧玻璃胶囊逐条卡词弹出 + 引线点亮，右侧盖章卡斜着一扣", energy: 2 },
  desc: "真人全屏讲话时，左右两侧各贴最多 4 条要点胶囊（按锚点逐条弹出、之后一直轻浮），右侧可再砸一枚盖章卡收这句话；中间留给人脸、上下留给 HUD 与字幕",
  use: "凡是「真人回到镜头前讲道理」的段落：给方法列 2~4 条要点、给提醒盖一个章、给清单逐条点名（配方的、健身的、避坑的、流程的都行）。分镜要写 presenter:\"full\"（真人推回全屏）+ over:true，这一镜画在真人两侧",
  schema,
  example: {
    left: [{ text: "先给结论", at: 4 }, { text: "一句一个信息", at: 22, tone: "accent" }],
    right: [{ text: "术语配人话", at: 34 }],
    stamp: { text: "别让他猜", sub: "规矩写死", at: 50 },
  },
  C,
};
