import React from "react";
import { z } from "zod";
import { easeIn, easeInOut, easeOut, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { hitShake, StampBox } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  doorLabel: z.string().describe("门楣上的牌子：大厂入口 / 校招通道 / 第一份工作"),
  inside: z.array(z.object({ text: z.string(), at: z.number().optional().describe("锚点") })).optional().describe("门缝里透出的一线场景（≤2 条，讲到才亮）"),
  closeAt: z.number().optional().describe("卷帘开始往下落的时刻（锚点）"),
  doneAt: z.number().optional().describe("帘子到底、光收尽的时刻（锚点）"),
  verdict: z.string().optional(),
  verdictAt: z.number().optional().describe("锚点"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const closeAt = cueOr(data.closeAt, Math.round(dur * 0.18));
  const doneAt = cueOr(data.doneAt, Math.round(dur * 0.72));
  const vAt = cueOr(data.verdictAt, Math.min(dur - 12, doneAt + 24));

  const dw = full ? W * 0.34 : W * 0.5;
  const dh = full ? H * 0.74 : H * 0.6;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2 - (full ? H * 0.02 : 0);
  const floorY = dy + dh;

  // shutter: roller box at top, curtain descends; light under it narrows, then dies
  const p = easeInOut(prog(frame, closeAt, Math.max(10, doneAt - closeAt)));
  const shut = frame < closeAt ? 0 : p * dh;
  const gapH = dh - shut;
  const dead = frame >= doneAt ? easeIn(prog(frame, doneAt, 16)) : 0; // 到底后余光明灭收尽
  const glow = frame < closeAt ? 1 : Math.max(0, 1 - p) * (1 - dead * 0.9);
  const flick = frame >= doneAt && dead < 1 ? 0.7 + 0.3 * Math.sin(frame * 1.6) : 1;
  const sh = hitShake(frame, [doneAt], 10, 12);

  const eLabel = enterAt(frame, closeAt, { fallback: "rise", dur: 14 });
  const inside = (data.inside ?? []).slice(0, 2);

  return (
    <>
      <svg
        width={W}
        height={H}
        style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}
      >
        {/* 房间压暗，只剩门口的光 */}
        <rect x={0} y={0} width={W} height={H} fill={alpha(t.bg, 0.25 + 0.45 * (1 - glow) + 0.3 * dead)} />
        {/* 地面光斑：随帘子下落收窄 */}
        <polygon
          points={`${dx + dw * 0.1},${floorY} ${dx + dw * 0.9},${floorY} ${dx + dw * 1.35},${H} ${dx - dw * 0.35},${H}`}
          fill={alpha(t.gold, 0.1 * glow * flick)}
        />
        {/* 门框 + 门内透光 */}
        <rect x={dx} y={dy} width={dw} height={dh} fill={alpha(t.gold, 0.22 * glow * flick)} />
        {glow > 0.05 && inside.map((it, i) => {
          const ia = cueOr(it.at, closeAt);
          if (frame < ia) return null;
          const ip = easeOut(prog(frame, ia, 10)) * glow;
          const iy = dy + dh * (0.32 + i * 0.2);
          return (
            <g key={i} opacity={ip}>
              <rect x={dx + dw * 0.18} y={iy - 12} width={dw * 0.64} height={26} rx={6} fill={alpha(t.bg, 0.55)} />
              <text x={dx + dw / 2} y={iy + 6} textAnchor="middle" fontFamily={t.font.title} fontWeight={900} fontSize={fitFont(it.text, dw * 0.6, full ? 19 : 15, 12)} fill={t.text}>
                {it.text}
              </text>
            </g>
          );
        })}
        {/* 卷帘：横条板逐片压下 */}
        {shut > 1 && (
          <>
            <rect x={dx - 6} y={dy - 14} width={dw + 12} height={22} rx={5} fill={alpha(t.text, 0.16)} stroke={alpha(t.text, 0.25)} strokeWidth={1.5} />
            <rect x={dx} y={dy} width={dw} height={shut} fill={alpha(t.primary, 0.14)} />
            {Array.from({ length: Math.max(1, Math.ceil(shut / (full ? 22 : 16))) }).map((_, i) => {
              const y = dy + i * (full ? 22 : 16);
              if (y > dy + shut - 2) return null;
              return <line key={i} x1={dx} y1={y} x2={dx + dw} y2={y} stroke={alpha(t.bg, 0.5)} strokeWidth={2} />;
            })}
            <rect x={dx - 3} y={dy + shut - 5} width={dw + 6} height={10} rx={3} fill={t.primary} opacity={0.9} />
            <rect x={dx - 3} y={dy + shut - 5} width={dw + 6} height={10} rx={3} fill="none" stroke={alpha(t.bg, 0.35)} strokeWidth={1.5} />
          </>
        )}
        {/* 门楣牌 */}
        <g opacity={eLabel.p}>
          <rect x={dx - 8} y={dy - (full ? 54 : 40)} width={dw + 16} height={full ? 36 : 26} rx={8} fill={alpha(t.bg, 0.72)} stroke={alpha(t.primary, 0.55)} strokeWidth={2} />
          <text x={dx + dw / 2} y={dy - (full ? 30 : 22)} textAnchor="middle" fontFamily={t.font.title} fontWeight={900} fontSize={fitFont(data.doorLabel, dw, full ? 21 : 15, 12)} fill={t.gold}>
            {data.doorLabel}
          </text>
        </g>
        {/* 门框立柱 */}
        <rect x={dx - 8} y={dy - 14} width={8} height={dh + 28} fill={alpha(t.text, 0.22)} />
        <rect x={dx + dw} y={dy - 14} width={8} height={dh + 28} fill={alpha(t.text, 0.22)} />
      </svg>
      {data.verdict && (
        <StampBox frame={frame} at={vAt} text={data.verdict} color={t.bad} x={W / 2} y={floorY + (full ? 44 : 26)} size={full ? 40 : 26} maxW={W * 0.7} rot={-2} />
      )}
      <Sfx name="whoosh" at={closeAt} volume={0.22} />
      <Sfx name="impact" at={doneAt} volume={0.3} />
    </>
  );
};

export const ShutterClose: CompDef<D> = {
  id: "shutter-close",
  name: "慢 shutter 关窗（门在悄悄关）",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 12,
  tags: ["门", "关闭", "入口", "机会", "通道", "关死"],
  motion: { kind: "卷帘沿门框缓缓压下，门缝光收窄、熄灭，最后余光收尽", energy: 2 },
  desc: "房间压暗，中间一道发着暖光的门（门楣挂着 doorLabel），门内透出 inside 的场景标签；一道卷帘从门顶缓缓往下压，横条板逐片落下，底下的光缝越来越窄；帘子到底（doneAt）时门内光闪烁后熄灭，地面光斑消失；最后 verdict 盖章",
  use: "讲「机会之门在悄悄关闭」但不是轰然砸死：应届生进大厂的那扇门正在悄悄关死、新创作者入口一点点收窄、某条职业通道没人再开——比 gate-weld（焊死）更安静、更渐进的那一种",
  schema,
  example: { doorLabel: "大厂入口", inside: [{ text: "应届生的第一工位" }], closeAt: 20, doneAt: 90, verdict: "门没锁，只是不再开" },
  C,
};
