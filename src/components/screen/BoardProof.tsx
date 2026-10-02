import React from "react";
import { z } from "zod";
import { Img, staticFile } from "remotion";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { Corners, fitFont } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 整屏举证：把一张真截图放大盖满画面当证据。给 2 张时用「竖直滑切」换到下一张
// （同一张榜换个排序 → 红框里的名次变了），讲完自动撤走露出真人。
// 既可当 talking-head-stage 的 inserts 用（口播进行到某句时插入），也可单独成镜。
const board = z.object({
  src: z.string().describe("截图路径（相对 public/），如 assets/arena-rank-overall.png"),
  note: z.string().optional().describe("这张图按什么排 / 在讲什么，显示在卡片左上角，如「按 OVERALL 排」"),
});
const schema = z.object({
  kicker: z.string().optional().describe("卡片外的小标签"),
  title: z.string().optional(),
  boards: z.array(board).min(1).max(2).describe("1 张=静态举证；2 张=在 swapAt 处竖直滑切换图"),
  aspect: z.number().default(2.13).describe("截图宽高比，卡片按它出尺寸"),
  badge: z.string().optional().describe("右上角徽章，如 LIVE"),
  centerX: z.number().min(0.2).max(0.8).default(0.5).describe("卡片水平中心（0~1）；presenter 模式下真人小窗占右上角，把它左移避开"),
  inAt: z.number().optional().describe("卡片砸入的时刻（锚点或秒，相对本插图起点）"),
  swapAt: z.number().optional().describe("换到第二张的时刻（锚点或秒）"),
  outAt: z.number().optional().describe("撤走的时刻；缺省=本段结束前 12 帧（自动接上真人）"),
  zoom: z.number().default(0.05).describe("停留期间的缓推量，0=完全静止"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const enterAt = useEnter(variant);
  const t = useTheme();
  const { width, height } = useBox();
  const n = d.boards.length;

  const inAt = cueOr(d.inAt, 4);
  const outAt = cueOr(d.outAt, Math.max(inAt + 30, dur - 12));
  const swapAt = cueOr(d.swapAt, inAt + (outAt - inAt) * 0.55);

  // 原生是「从 0.58 放大到位 + 透视翻转」；用 from 保住这个基线，分镜写 motion.enter 才换
  const eIn = enterAt(frame, inAt, { fallback: "rise", dur: 16, from: 0.58 });
  const eTag = enterAt(frame, inAt, { fallback: "rise", dur: 12, dist: 0.6 });
  const outP = easeOut(prog(frame, outAt, 11));
  const slide = easeInOut(prog(frame, swapAt, 13)) * (n > 1 ? 1 : 0);
  const glitch = frame >= swapAt && frame < swapAt + 15 ? 1 - (frame - swapAt) / 15 : 0;
  const sweep = prog(frame, inAt + 8, Math.max(14, outAt - inAt - 10));
  const hold = prog(frame, inAt + 18, Math.max(20, outAt - inAt - 20));

  const bw = Math.min(1331, 780 * d.aspect);
  const bh = bw / d.aspect;
  const bx = width * d.centerX - bw / 2;
  const by = 484 - bh / 2;
  const live = 0.55 + 0.45 * Math.sin(frame / 5);
  const showNote = d.boards.map((b) => b.note).filter(Boolean).length > 0;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: bx + (1 - eIn.p) * bw * 0.16,
          top: by + (1 - eIn.p) * bh * 0.12,
          width: bw,
          height: bh,
          borderRadius: 24,
          overflow: "hidden",
          background: alpha(t.bg, 0.97),
          border: `3px solid ${alpha(t.primary, 0.85)}`,
          boxShadow: `0 0 ${80 * (1 - outP)}px ${alpha(t.primary, 0.5)}, 0 40px 130px rgba(0,0,0,.75)`,
          transform: `perspective(1500px) scale(${eIn.scale}) rotateX(${(1 - eIn.p) * 9}deg) scale(${(1 + d.zoom * hold) * (1 - outP * 0.12)})`,
          opacity: Math.min(1, eIn.p * 1.8) * (1 - outP),
        }}
      >
        {/* 竖向叠两张：滑切读起来就是「同一张榜被重新排序」 */}
        <div style={{ position: "absolute", left: 0, top: 0, width: bw, height: bh * n, transform: `translateY(${-slide * bh}px)` }}>
          {d.boards.map((b, i) => <Img key={i} src={staticFile(b.src)} style={{ width: "100%", height: bh, objectFit: "cover", display: "block" }} />)}
        </div>

        {/* 停留期间镜头在动 */}
        <div style={{ position: "absolute", left: 0, right: 0, top: `${sweep * 108 - 6}%`, height: 120, background: `linear-gradient(180deg, transparent, ${alpha("#ffffff", 0.14)}, transparent)`, pointerEvents: "none" }} />
        {[0, 1].map((k) => {
          const p = (sweep * 1.35 + k * 0.5) % 1;
          return <div key={k} style={{ position: "absolute", left: 0, right: 0, top: `${p * 100}%`, height: 4, background: alpha(t.accent, 0.5), boxShadow: `0 0 22px ${t.accent}`, opacity: 0.45 + 0.55 * Math.sin(frame / 4 + k), pointerEvents: "none" }} />;
        })}
        {glitch > 0 &&
          [0, 1, 2].map((k) => (
            <div key={`g${k}`} style={{ position: "absolute", left: 0, right: 0, top: `${(0.2 + k * 0.3 + Math.sin(frame * 0.9 + k) * 0.04) * 100}%`, height: 6 + k * 4, background: alpha(k % 2 ? t.primary : "#ffffff", 0.5 * glitch), transform: `translateX(${(k % 2 ? 1 : -1) * 28 * glitch}px)`, pointerEvents: "none" }} />
          ))}

        {/* 左上角：这张图按什么排（跟着滑切一起换） */}
        {showNote && (
          <div style={{ position: "absolute", left: 0, top: 0, width: bw, height: bh * n, transform: `translateY(${-slide * bh}px)` }}>
            {d.boards.map((b, i) =>
              b.note ? (
                <div key={i} style={{ position: "absolute", left: 22, top: i * bh + 20, padding: "8px 18px", borderRadius: 999, background: alpha(t.bg, 0.82), border: `2px solid ${alpha(t.primary, 0.7)}`, fontFamily: t.font.body, fontWeight: 800, fontSize: 24, color: t.text, whiteSpace: "nowrap" }}>
                  {b.note}
                </div>
              ) : null,
            )}
          </div>
        )}

        {d.badge && (
          <div style={{ position: "absolute", right: 22, top: 20, display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", borderRadius: 999, background: alpha(t.bg, 0.75), border: `1.5px solid ${alpha(t.bad, 0.7)}`, fontFamily: t.font.mono, fontSize: 18, letterSpacing: 2, color: t.text, opacity: live }}>
            <span style={{ width: 11, height: 11, borderRadius: 6, background: t.bad }} />
            {d.badge}
          </div>
        )}
        <Corners color={alpha(t.primary, 0.85)} size={22} inset={12} />
      </div>

      {(d.kicker || d.title) && (
        <div style={{ position: "absolute", left: 96, top: Math.max(20, by - 88), opacity: eTag.opacity * (1 - outP), transform: `translateY(${eTag.dy}px)` }}>
          {d.kicker && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: t.font.mono, fontSize: 20, letterSpacing: 6, color: t.primary }}>
              <span style={{ width: 40, height: 2, background: t.primary, boxShadow: `0 0 10px ${t.primary}` }} />
              {d.kicker}
            </div>
          )}
          {d.title && <div style={{ marginTop: 8, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(d.title, 1200, 52, 28), color: t.text, whiteSpace: "nowrap", textShadow: `0 0 24px ${alpha(t.primary, 0.6)}` }}>{d.title}</div>}
        </div>
      )}

      <Sfx name="impact" at={inAt} volume={0.5} />
      {n > 1 && <Sfx name="glitch" at={swapAt} volume={0.4} />}
      {n > 1 && <Sfx name="tick" at={Math.round((inAt + swapAt) / 2)} volume={0.26} />}
      <Sfx name="swipe" at={outAt} volume={0.32} />
    </>
  );
};

export const BoardProof: CompDef<D> = {
  id: "board-proof",
  name: "整屏截图举证",
  layer: "screen",
  variants: 1,
  minSec: 2,
  maxSec: 20,
  tags: ["截图", "榜单", "举证", "排名", "真实数据"],
  motion: { kind: "整屏砸入（透视缩放）+ 竖直滑切 + 扫描线", energy: 2 },
  desc: "把一张真截图放大盖满画面当证据（边框 + 扫描线 + 高亮带 + LIVE），给 2 张时竖直滑切换图（同一张榜换个排序，左上角标签跟着换），讲完自动撤走露出真人",
  use: "用真实截图证明一个会变/会涨会跌的东西：大模型榜单换个排序就换第一、后台数据看板前后对比、价格页调整前后的截图、搜索结果页的变化（boards / aspect / swapAt 全可改）",
  schema,
  example: {
    kicker: "同一张榜，换个排序",
    boards: [
      { src: "assets/arena-rank-overall.png", note: "按 OVERALL 排" },
      { src: "assets/arena-rank-agentic.png", note: "按 AGENTIC CODING 排" },
    ],
    aspect: 2.13,
    badge: "LIVE",
  },
  C,
};
