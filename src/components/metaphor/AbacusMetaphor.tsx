import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 算盘隐喻：拨一下才动一下（被动工具） → 不问也自己动（主动代理）
// 珠子是真的按「一格」位移，停下后完全静止——静止本身就是「你不问，它不动」的语义。
const schema = z.object({
  kicker: z.string().default("PASSIVE TOOL"),
  title: z.string().default("你拨一下，它才动一下"),
  pokeAt: z.number().optional().describe("指针拨珠的时刻"),
  stopAt: z.number().optional().describe("珠子停住的时刻"),
  autoAt: z.number().optional().describe("切到「自己动」的时刻"),
  autoTitle: z.string().default("不问，它自己动"),
  autoNote: z.string().default("任务在云端继续跑"),
});
type D = z.infer<typeof schema>;

const RODS = 9;
const BEADS = 5;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const poke = cueOr(d.pokeAt, Math.round(dur * 0.28));
  const stop = cueOr(d.stopAt, poke + 14);
  const auto = cueOr(d.autoAt, Math.round(dur * 0.66));
  const autoK = easeOut(prog(frame, auto, 16));

  const fx = W * 0.14, fy = H * 0.24, fw = W * 0.72, fh = H * 0.5;
  const rodGap = fw / RODS;
  const beadW = rodGap * 0.66, beadH = fh * 0.1;
  const pokeCol = Math.floor(RODS / 2);
  const pokeBead = 2;

  // 指针：从右下飞到目标珠子，拨完停住
  const fly = easeInOut(prog(frame, poke - 22, 20));
  const px = W * 0.5 + (fx + rodGap * (pokeCol + 0.5) - W * 0.5) * fly;
  const py = H * 0.88 + (fy + fh * 0.42 - H * 0.88) * fly;
  const hit = prog(frame, poke, 3) * (1 - prog(frame, poke + 10, 8));
  const moved = easeOutBack(prog(frame, poke + 2, 10));
  const stopGlow = 1 - prog(frame, stop, 16);

  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 45%, ${alpha(t.primary, 0.16)}, ${t.bg} 66%)`, fontFamily: t.font.title }}>
      <div style={{ position: "absolute", left: W * 0.06, top: H * 0.09, color: t.primary, fontFamily: t.font.mono, fontSize: 20, letterSpacing: 5, opacity: 1 - autoK }}>{d.kicker}</div>
      <div style={{ position: "absolute", left: W * 0.06, top: H * 0.14, width: W * 0.6, color: t.text, fontSize: fitFont(d.title, W * 0.6, 74, 40), fontWeight: 900, opacity: 1 - autoK, transform: `translateY(${(1 - easeOut(prog(frame, 4, 12))) * 18}px)` }}>{d.title}</div>

      {/* 算盘框 */}
      <div style={{ position: "absolute", left: fx, top: fy, width: fw, height: fh, borderRadius: 18, background: `linear-gradient(160deg, ${alpha(t.bg2, 0.95)}, ${alpha(t.bg, 0.9)})`, border: `3px solid ${alpha(t.primary, 0.55)}`, boxShadow: `0 0 60px ${alpha(t.primary, 0.18)}, inset 0 0 60px ${alpha(t.primary, 0.06)}`, opacity: 1 - autoK * 0.55 }} />
      <div style={{ position: "absolute", left: fx, top: fy + fh * 0.16, width: fw, height: 3, background: alpha(t.primary, 0.45) }} />
      {new Array(RODS).fill(0).map((_, r) => {
        const x = fx + rodGap * (r + 0.5);
        return (
          <div key={r}>
            <div style={{ position: "absolute", left: x - 1.5, top: fy + 12, width: 3, height: fh - 24, background: alpha(t.text, 0.18) }} />
            {new Array(BEADS).fill(0).map((_, b) => {
              const isPoke = r === pokeCol && b === pokeBead;
              const y0 = fy + fh * 0.26 + b * (fh * 0.16);
              const drop = isPoke ? moved * fh * 0.13 : 0;
              const glow = isPoke ? (1 - stopGlow) * 0.9 : 0;
              return (
                <div key={b} style={{
                  position: "absolute", left: x - beadW / 2, top: y0 + drop, width: beadW, height: beadH, borderRadius: "50%",
                  background: `radial-gradient(circle at 38% 30%, ${alpha(isPoke ? t.accent : t.primary, 0.95)}, ${alpha(isPoke ? t.accent : t.primary, 0.35)})`,
                  border: `1.5px solid ${alpha(isPoke ? t.accent : t.primary, 0.9)}`,
                  boxShadow: `0 0 ${10 + glow * 26}px ${alpha(isPoke ? t.accent : t.primary, 0.25 + glow * 0.5)}`,
                }} />
              );
            })}
          </div>
        );
      })}

      {/* 指针 + 点击涟漪 */}
      {frame < auto + 6 && (
        <>
          <div style={{ position: "absolute", left: px - 26, top: py - 26, width: 52, height: 52, opacity: 0.95 }}>
            <svg viewBox="0 0 52 52" width={52} height={52}>
              <path d="M10 4 L10 40 L20 31 L27 46 L34 43 L27 29 L41 29 Z" fill={t.text} stroke={t.bg} strokeWidth={3} />
            </svg>
          </div>
          {hit > 0.01 && <div style={{ position: "absolute", left: px - 40 - hit * 50, top: py - 40 - hit * 50, width: 80 + hit * 100, height: 80 + hit * 100, borderRadius: "50%", border: `3px solid ${alpha(t.accent, hit)}`, opacity: hit }} />}
        </>
      )}

      {/* 停住之后的静止提示 */}
      {frame >= stop && frame < auto + 10 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: fy + fh + 30, textAlign: "center", color: t.dim, fontSize: 34, letterSpacing: 3, opacity: clamp(prog(frame, stop, 12)) * (1 - autoK) }}>
          你不推，它就停在这一格
        </div>
      )}

      {/* 第二段：不问也自己动 */}
      {frame >= auto && (
        <div style={{ position: "absolute", right: W * 0.08, top: H * 0.3, width: W * 0.24, opacity: autoK }}>
          <div style={{ position: "relative", width: 220, height: 220, margin: "0 auto" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${alpha(t.accent, 0.5 - i * 0.12)}`, transform: `scale(${1 + i * 0.22 + Math.sin(frame / 18 + i) * 0.03})` }} />
            ))}
            <div style={{ position: "absolute", inset: 70, borderRadius: "50%", background: alpha(t.accent, 0.22), border: `3px solid ${alpha(t.accent, 0.9)}`, boxShadow: `0 0 40px ${alpha(t.accent, 0.55)}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.text, fontWeight: 900, fontSize: 26 }}>AGENT</div>
            {[0, 1, 2].map((i) => {
              const a = frame / 26 + (i * Math.PI * 2) / 3;
              return <div key={i} style={{ position: "absolute", left: 110 + Math.cos(a) * 132 - 9, top: 110 + Math.sin(a) * 132 - 9, width: 18, height: 18, borderRadius: 9, background: t.gold, boxShadow: `0 0 16px ${t.gold}` }} />;
            })}
          </div>
          <div style={{ marginTop: 24, textAlign: "center", color: t.text, fontSize: 46, fontWeight: 900 }}>{d.autoTitle}</div>
          <div style={{ marginTop: 8, textAlign: "center", color: t.dim, fontSize: 24 }}>{d.autoNote}</div>
        </div>
      )}

      <Sfx name="click" at={poke} volume={0.32} />
      <Sfx name="pop" at={poke + 4} volume={0.26} />
      <Sfx name="ding" at={auto} volume={0.3} />
    </div>
  );
};

export const AbacusMetaphor: CompDef<D> = {
  id: "abacus-metaphor",
  name: "算盘隐喻：拨一下才动",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 12,
  tags: ["算盘", "被动", "主动", "代理", "隐喻"],
  motion: { kind: "指针飞入拨珠→珠子只动一格→停住→切换到自转节点", energy: 3 },
  desc: "算盘珠被拨一格后彻底停住，直译「你不问它不动」；后半段切到自发脉冲的代理节点",
  use: "解释「被动工具 vs 主动代理」「拨一下动一下」这类对比",
  schema,
  example: { pokeAt: 40, stopAt: 60, autoAt: 150 },
  C,
};
