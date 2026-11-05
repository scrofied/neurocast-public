import React from "react";
import { z } from "zod";
import { useBox } from "../../lib/box";
import { alpha, useTheme } from "../../lib/theme";
import { clamp, prog, easeOut } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { GlowDefs, Headline } from "../../lib/ui";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { Figure, POSES, mixPose } from "../../lib/figure";
import { cueOr } from "../../lib/cue";
import type { CompDef, CompProps } from "../types";

// reach-gap：伸手去够，但隔着一层玻璃，够不到你那边的东西。
// 语义是「能力上限不在聪明不聪明，在碰不碰得到」——装上手脚 ≠ 能拿到你本地/内部的东西。
const itemSchema = z.object({
  label: z.string().describe("玻璃那边那摞东西叫什么（≤8 字）：本地文件夹 / 公司合同…"),
  icon: z.string().optional().describe("图标名（doc/box/browser/grid…）"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  from: z.string().default("它").describe("伸手那一方的名字（≤4 字），写在人脚下"),
  wallLabel: z.string().default("你的电脑").describe("玻璃上那行竖着的字（≤6 字）"),
  items: z.array(itemSchema).min(2).max(4).describe("玻璃那边摞着的东西，从下往上排"),
  reachAt: z.number().optional().describe("开始伸手往前够的帧（锚点）"),
  blockAt: z.number().optional().describe("手撞上玻璃的时刻（锚点）"),
  blocked: z.string().optional().describe("撞上之后砸出来的那句结论（≤16 字）"),
  note: z.string().optional().describe("左侧一行小字，讲为什么够不到"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const compact = W < 900;

  const items = data.items ?? [];
  const reachAt = cueOr(data.reachAt, 6);
  const blockAt = cueOr(data.blockAt, reachAt + 42);
  const walkP = easeOut(prog(frame, reachAt, Math.max(8, blockAt - reachAt)));
  const hit = prog(frame, blockAt, 10);
  const afterHit = clamp(prog(frame, blockAt, 26));

  // ---- 几何
  const G = H * (compact ? 0.76 : 0.8);
  const figH = H * (compact ? 0.32 : 0.42);
  const wallX = W * (compact ? 0.56 : 0.6);
  const topY = H * 0.17;
  const startX = W * 0.2;
  const stopX = wallX - figH * 0.3;
  const fx = startX + (stopX - startX) * walkP;
  // 撞上之后：手弹回来一点 + 高频抖动（不是继续往前压）
  const shake = afterHit > 0 ? Math.sin((frame - blockAt) * 1.5) * 5 * Math.exp(-(frame - blockAt) / 9) : 0;
  const recoil = -afterHit * 10;
  const pose = mixPose(POSES.stand, POSES.reach, clamp(walkP * 1.2));

  const eNote = enterAt(frame, blockAt + 8, { fallback: "slide-l", dur: 16 });
  const eItems = items.map((_, i) => enterAt(frame, 4 + i * 5, { fallback: "rise", dur: 14 }));
  const cardW = Math.min(compact ? 200 : 268, (W - wallX - (compact ? 40 : 70)));
  const cardH = compact ? 46 : 58;
  const cardX = wallX + (compact ? 26 : 44);
  const cardY = (i: number) => G - (i + 1) * (cardH + 14);
  const pulse = 0.55 + 0.45 * Math.sin(frame / 14);

  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="rg" std={7} user />
        {/* 地面 */}
        <line x1={compact ? 20 : 60} y1={G + 8} x2={W - (compact ? 20 : 60)} y2={G + 8} stroke={alpha(t.dim, 0.5)} strokeWidth={2} strokeDasharray="10 12" />
        {/* 玻璃后面那摞东西：一直是暗的，因为够不到 */}
        {items.map((it, i) => {
          const eo = eItems[i];
          return (
            <g key={i} opacity={eo.opacity} transform={`translate(${eo.dx} ${eo.dy})`}>
              <rect x={cardX} y={cardY(i)} width={cardW} height={cardH} rx={10} fill={alpha(t.dim, 0.1)} stroke={alpha(t.dim, 0.6)} strokeWidth={2} />
            </g>
          );
        })}
        {/* 玻璃：一条竖着的发光边界 + 斜向高光 */}
        <g>
          <rect x={wallX - 16} y={topY} width={32} height={G + 8 - topY} fill={alpha(t.secondary, 0.1)} />
          <line x1={wallX} y1={topY} x2={wallX} y2={G + 8} stroke={alpha(t.secondary, 0.85)} strokeWidth={4} filter="url(#rg)" />
          {[0.22, 0.46, 0.7].map((k, i) => (
            <line key={i} x1={wallX - 9} y1={topY + (G - topY) * k} x2={wallX + 9} y2={topY + (G - topY) * k - 26} stroke={alpha(t.text, 0.28)} strokeWidth={2} />
          ))}
        </g>
        {/* 伸手的人 */}
        <g opacity={1} transform={`translate(${fx + shake + recoil} 0)`}>
          <Figure x={0} y={G} h={figH} pose={pose} color={t.text} glow={t.primary} face={1} />
        </g>
        {/* 撞上的涟漪：从手碰到玻璃那一点扩出去的两道弧 */}
        {hit > 0 &&
          [0, 1].map((k) => {
            const p = clamp(prog(frame, blockAt + k * 5, 22));
            if (p <= 0) return null;
            return (
              <path
                key={k}
                d={`M ${wallX - 26 * Math.sin(p * 1.1)} ${G - figH * 0.72 - 26 * p} Q ${wallX} ${G - figH * 0.72} ${wallX - 26 * Math.sin(p * 1.1)} ${G - figH * 0.72 + 26 * p}`}
                fill="none" stroke={alpha(t.accent, 0.8 * (1 - p))} strokeWidth={4} filter="url(#rg)"
              />
            );
          })}
        {/* 手碰不到的那条缝：玻璃上标一段虚线，说明「差的是这一步」 */}
        {afterHit > 0 && (
          <g opacity={afterHit}>
            <line x1={fx + figH * 0.2} y1={G - figH * 0.72} x2={wallX - 6} y2={G - figH * 0.72} stroke={alpha(t.dim, 0.8)} strokeWidth={3} strokeDasharray="8 8" />
          </g>
        )}
      </svg>

      {/* 玻璃上的竖字 */}
      <div style={{ position: "absolute", left: wallX - 74, top: topY + 10, width: 52, fontFamily: t.font.title, fontWeight: 900, fontSize: compact ? 20 : 26, lineHeight: 1.25, color: alpha(t.secondary, 0.95), letterSpacing: 2, writingMode: "vertical-rl", textShadow: `0 0 20px ${alpha(t.secondary, 0.5)}` }}>
        {data.wallLabel}
      </div>

      {/* 那摞东西的名字 */}
      {items.map((it, i) => {
        const eo = eItems[i];
        return (
          <div key={i} style={{ position: "absolute", left: cardX + 14, top: cardY(i), width: cardW - 28, height: cardH, display: "flex", alignItems: "center", gap: 10, opacity: eo.opacity }}>
            {it.icon && <Icon name={it.icon} size={cardH * 0.46} color={alpha(t.dim, 0.95)} />}
            <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: compact ? 18 : 22, color: alpha(t.text, 0.8), whiteSpace: "nowrap", letterSpacing: 1 }}>{it.label}</span>
          </div>
        );
      })}

      {/* 脚下主体名 */}
      <div style={{ position: "absolute", left: Math.max(compact ? 8 : 24, fx - 110), top: G + 16, width: 220, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: compact ? 24 : 30, color: t.text, letterSpacing: 2, whiteSpace: "nowrap" }}>
        {data.from}
      </div>

      {/* 左侧小字：为什么够不到 */}
      {data.note && (
        <div style={{ position: "absolute", left: compact ? 12 : 56, top: G - figH * 1.02, width: compact ? W * 0.42 : W * 0.3, fontFamily: t.font.body, fontWeight: 700, fontSize: compact ? 17 : 22, lineHeight: 1.35, color: alpha(t.dim, 0.95), opacity: eNote.opacity }}>
          {data.note}
        </div>
      )}

      {/* 撞上后砸出来的结论：盖在玻璃上（不占底部字幕带，也不压脚下的主体名） */}
      {data.blocked && (
        <div
          style={{
            position: "absolute", left: wallX - (compact ? 150 : 210), top: G - figH * 1.02, width: compact ? 300 : 420,
            padding: compact ? "8px 10px" : "12px 16px", boxSizing: "border-box",
            opacity: eB(frame, blockAt).o, transform: `scale(${eB(frame, blockAt).s}) rotate(-5deg)`, textAlign: "center",
            fontFamily: t.font.title, fontWeight: 900, fontSize: compact ? 22 : 30, color: t.accent, whiteSpace: "nowrap",
            border: `3px solid ${alpha(t.accent, 0.85)}`, borderRadius: 8, background: alpha(t.bg, 0.55),
            textShadow: `0 0 26px ${alpha(t.accent, 0.45 * pulse)}`,
          }}
        >
          {data.blocked}
        </div>
      )}

      {frame >= blockAt && frame < blockAt + 3 ? <Sfx name="stamp" at={blockAt} volume={0.4} /> : null}
      <Headline kicker={data.kicker} title={data.title} frame={frame} />
    </>
  );
};

// 结论条的入场：撞上后 8 帧内从 1.25 缩到 1，透明度跟上
const eB = (frame: number, blockAt: number) => {
  const p = easeOut(prog(frame, blockAt + 8, 14));
  return { o: p, s: 1.25 - 0.25 * p };
};
export const ReachGap: CompDef<D> = {
  id: "reach-gap",
  name: "隔着一层玻璃，够不到你的东西",
  layer: "metaphor",
  variants: 2,
  minSec: 3,
  maxSec: 10,
  tags: ["够不到", "本地文件", "隐私", "边界", "缺工具", "碰不到", "隔着一层", "上限"],
  motion: { kind: "无脸人物伸手往前够，撞上玻璃后弹回并抖动，涟漪从触点扩开", energy: 3 },
  desc:
    "左边一具无脸剪影伸手往右够，中间一条竖着的发光边界（玻璃，上面竖着写「你的电脑」这类字），右边摞着两三张暗卡片（本地文件夹、公司合同…）。手在到达玻璃那一刻停住：弹回一点、高频抖动、触点扩出两道涟漪、砸出一句结论。全程卡片都是暗的——它拿不到。",
  use:
    "讲「不是它不聪明，是它碰不到你这一侧」：大模型装上手脚也读不到你电脑里的文件、公司内部的合同、你自己的资料；也讲权限/隐私边界、云端模型进不了本地目录、在线工具读不了你的私有数据。凡是「差的就是这一步 / 中间隔着一层」的句子用它，别用 versus-clash（那个是两个方案比大小）。",
  schema,
  example: {
    kicker: "别误会",
    title: "装上手脚，也碰不到你这一侧",
    from: "它",
    wallLabel: "你的电脑",
    items: [
      { label: "本地文件夹", icon: "box" },
      { label: "公司合同", icon: "doc" },
      { label: "内部资料", icon: "grid" },
    ],
    reachAt: 8,
    blockAt: 46,
    blocked: "他碰不到你电脑里的文件",
    note: "云端那一侧再能干，也没有你这一侧的数据",
  },
  C,
};
