import React from "react";
import { z } from "zod";
import { useBox } from "../../lib/box";
import { alpha, useTheme } from "../../lib/theme";
import { clamp, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { GlowDefs, Headline } from "../../lib/ui";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import type { CompDef, CompProps } from "../types";

// tier-stack：一摞层级块，讲到哪一层哪一层点亮，没讲到的层是虚线空位。
// 和 pyramid-base 的分工：那个是「底座被切掉，上面站不住」（破坏），这个是「自底向上逐层盖起来」（递进/结构导览）。
const tierSchema = z.object({
  name: z.string().describe("这一层叫什么（≤8 字）"),
  note: z.string().optional().describe("这一层的一句话说明，画在塔右侧的空带里"),
  icon: z.string().optional().describe("图标名，见 src/lib/icons.tsx（zap/layers/bot/tool…）"),
  at: z.number().optional().describe("点亮这一层的帧（台词锚点）。不写 = 这一层还没讲到，留虚线空位；前面已经讲过的层要显式写 0"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  tiers: z.array(tierSchema).min(2).max(5).describe("自底向上排，第一项是最底层"),
  feedLabel: z.string().optional().describe("塔左侧那颗向上箭头的字，如「下一层托住上一层」"),
  feedAt: z.number().optional().describe("传导标记出现的时刻（锚点）；缺省 = 第二层点亮时"),
  verdict: z.string().optional().describe("停在塔底下方空带上的结论条（别压着塔）"),
  verdictAt: z.number().optional().describe("结论条落下的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();

  const tiers = data.tiers ?? [];
  const n = tiers.length;
  const compact = W < 900;

  // ---- 时间：at = 点亮这一层的帧；不写 = 这一层还没讲到，保持虚线空位
  const litAt = tiers.map((tr) => (Number.isFinite(tr.at) ? (tr.at as number) : Number.POSITIVE_INFINITY));
  const litP = litAt.map((a) => prog(frame, a, 22));
  const topLit = litP.reduce((acc, p, i) => (p > 0.5 ? i : acc), -1);
  const lastCue = litAt.filter((a) => Number.isFinite(a));

  // ---- 几何：塔在左 2/3，说明条在右空带，结论条在塔底空带
  const areaTop = H * 0.155;
  const areaBot = H * 0.775;
  const gap = compact ? 12 : 22;
  const slabH = Math.min(compact ? 92 : 140, (areaBot - areaTop - (n - 1) * gap) / n);
  const gH = n * slabH + (n - 1) * gap;
  const startY = areaTop + (areaBot - areaTop - gH) / 2;
  const tierY = (i: number) => startY + (n - 1 - i) * (slabH + gap);

  const taper = variant % 2 === 1 ? 0 : 1;
  const baseW = W * (compact ? 0.82 : 0.42);
  const cx = compact ? W / 2 : W * 0.37;
  const wOf = (i: number) => baseW * (taper ? 1 - 0.09 * i : 1);

  // 常动：整座塔轻轻呼吸 + 一条亮带沿塔往上爬（保证没有静止帧）
  const breathe = Math.sin(frame / 26) * 3;
  const climb = ((frame * 2.4) % (gH + 90)) - 45;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 15);

  const eTower = enterAt(frame, 6, { fallback: "rise", dur: 18 });
  const sortedCues = [...lastCue].sort((a, b) => a - b);
  const vdAt = Number.isFinite(data.verdictAt) ? (data.verdictAt as number) : (sortedCues[sortedCues.length - 1] ?? 0) + 26;
  const eVerd = enterAt(frame, vdAt, { fallback: "drop", dur: 16 });
  const faAt = Number.isFinite(data.feedAt) ? (data.feedAt as number) : sortedCues[1] ?? sortedCues[0] ?? 0;
  const feedOn = clamp(prog(frame, faAt, 16)) * (topLit >= 1 ? 1 : 0);

  const noteX = compact ? 20 : W * 0.6;
  const noteW = compact ? W - 40 : W * 0.36;
  const feedAx = cx - baseW / 2 - (compact ? 26 : 52);
  const feedW = Math.max(110, feedAx - 38);

  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="ts" std={7} user />
        {/* 中轴：一条贯穿上下的层级导轨 */}
        <g transform={`translate(0 ${breathe})`} opacity={eTower.opacity}>
          <line x1={cx} y1={startY - 26} x2={cx} y2={startY + gH + 26} stroke={alpha(t.primary, 0.22)} strokeWidth={2} strokeDasharray="6 10" filter="url(#ts)" />
          {tiers.map((_, i) => {
            const y = tierY(i);
            const w = wOf(i);
            const lp = litP[i];
            const on = lp > 0.5;
            const eo = enterAt(frame, 8 + i * 5, { fallback: "rise", dur: 16 });
            const midX = cx;
            const midY = y + slabH / 2;
            const s = clamp(eo.scale * (0.96 + lp * 0.04), 0.2, 3);
            return (
              <g
                key={i}
                opacity={eo.opacity}
                transform={`translate(${eo.dx + midX} ${eo.dy + (1 - lp) * 12 + midY}) scale(${s}) translate(${-midX} ${-midY})`}
              >
                <rect
                  x={cx - w / 2}
                  y={y}
                  width={w}
                  height={slabH}
                  rx={compact ? 10 : 14}
                  fill={alpha(t.primary, 0.04 + lp * 0.2)}
                  stroke={on ? t.primary : alpha(t.dim, 0.55)}
                  strokeWidth={on ? 3 : 2}
                  strokeDasharray={on ? undefined : "14 10"}
                  filter={on ? "url(#ts)" : undefined}
                  opacity={on ? 1 : 0.75}
                />
                {on && (
                  <rect
                    x={cx - w / 2}
                    y={y}
                    width={w}
                    height={slabH}
                    rx={compact ? 10 : 14}
                    fill="none"
                    stroke={alpha(t.accent, 0.5 * pulse)}
                    strokeWidth={2}
                  />
                )}
                {/* 层底的一条亮边：点亮时才有 */}
                {on && <rect x={cx - w / 2 + 16} y={y + slabH - 6} width={(w - 32) * lp} height={4} rx={2} fill={alpha(t.accent, 0.85)} />}
              </g>
            );
          })}
          {/* 往上爬的光带 */}
          <rect x={cx - baseW / 2 - 8} y={startY + gH - climb} width={baseW + 16} height={3} fill={alpha(t.secondary, 0.35)} filter="url(#ts)" />
        </g>

        {/* 左侧向上传导标记 */}
        {data.feedLabel && feedOn > 0 && topLit >= 1 && (
          <g opacity={feedOn} transform={`translate(0 ${breathe})`}>
            {(() => {
              const gy = (tierY(topLit) + slabH + tierY(topLit - 1)) / 2;
              const ax = feedAx;
              return (
                <>
                  <line x1={ax} y1={gy + 26} x2={ax} y2={gy - 26} stroke={t.accent} strokeWidth={4} strokeLinecap="round" filter="url(#ts)" />
                  <path d={`M ${ax - 11} ${gy - 20} L ${ax} ${gy - 36} L ${ax + 11} ${gy - 20} Z`} fill={t.accent} />
                </>
              );
            })()}
          </g>
        )}
      </svg>

      {/* 块内文字：序号 + 层名 */}
      {tiers.map((tr, i) => {
        const y = tierY(i) + breathe;
        const w = wOf(i);
        const lp = litP[i];
        const on = lp > 0.5;
        const eo = enterAt(frame, 8 + i * 5, { fallback: "rise", dur: 16 });
        const size = Math.min(compact ? 26 : 42, (compact ? 26 : 42) * (tr.name.length > 7 ? 0.78 : 1));
        return (
          <div key={i} style={{ position: "absolute", left: cx - w / 2 + eo.dx, top: y + eo.dy, width: w, height: slabH, display: "flex", alignItems: "center", gap: 16, padding: "0 26px", boxSizing: "border-box", opacity: eo.opacity }}>
            <div style={{ fontFamily: t.font.mono, fontSize: size * 0.52, fontWeight: 800, color: on ? alpha(t.accent, 0.95) : alpha(t.dim, 0.8), letterSpacing: 1, width: size * 1.1 }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            {tr.icon && !compact && <Icon name={tr.icon} size={size * 0.82} color={on ? t.primary : alpha(t.dim, 0.75)} />}
            <div
              style={{
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: size,
                color: on ? t.text : alpha(t.dim, 0.8),
                whiteSpace: "nowrap",
                letterSpacing: 1,
                textShadow: on ? `0 0 22px ${alpha(t.primary, 0.45)}` : "none",
              }}
            >
              {tr.name}
            </div>
          </div>
        );
      })}

      {/* 右侧空带：每层的说明，跟着点亮出现 */}
      {!compact &&
        tiers.map((tr, i) => {
          if (!tr.note) return null;
          const lp = litP[i];
          if (lp <= 0.02) return null;
          return (
            <div key={i} style={{ position: "absolute", left: noteX, top: tierY(i) + breathe, width: noteW, height: slabH, display: "flex", alignItems: "center", opacity: clamp(lp * 1.2 - 0.1) }}>
              <div style={{ width: 5, alignSelf: "stretch", margin: "14px 0", background: alpha(t.primary, 0.85), boxShadow: `0 0 16px ${alpha(t.primary, 0.7)}` }} />
              <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 30, lineHeight: 1.35, color: alpha(t.text, 0.92), padding: "0 22px" }}>{tr.note}</div>
            </div>
          );
        })}

      {/* 传导标记的字 */}
      {data.feedLabel && feedOn > 0 && topLit >= 1 && (
        <div
          style={{
            position: "absolute",
            left: compact ? 8 : 24,
            top: (tierY(topLit) + slabH + tierY(topLit - 1)) / 2 + breathe - 16,
            width: feedW,
            fontFamily: t.font.body,
            fontWeight: 800,
            fontSize: compact ? 18 : 23,
            lineHeight: 1.3,
            color: alpha(t.accent, 0.95),
            textAlign: "right",
            opacity: feedOn,
          }}
        >
          {data.feedLabel}
        </div>
      )}

      {/* 结论条：停在塔底下方空带，不压塔 */}
      {data.verdict && (
        <div
          style={{
            position: "absolute",
            left: compact ? 20 : cx - baseW / 2,
            width: compact ? W - 40 : baseW,
            top: areaBot + 22 + eVerd.dy,
            opacity: eVerd.opacity,
            clipPath: eVerd.clip,
            transform: `scale(${eVerd.scale})`,
            textAlign: "center",
            fontFamily: t.font.title,
            fontWeight: 900,
            fontSize: compact ? 24 : 34,
            color: t.accent,
            whiteSpace: "nowrap",
            textShadow: `0 0 26px ${alpha(t.accent, 0.5)}`,
          }}
        >
          {data.verdict}
        </div>
      )}

      {litAt.map((a, i) => (a > 4 ? <Sfx key={i} name="pop" at={a} volume={0.32} /> : null))}
      {data.verdict ? <Sfx name="ding" at={vdAt} volume={0.3} /> : null}
      <Headline kicker={data.kicker} title={data.title} frame={frame} />
    </>
  );
};

export const TierStack: CompDef<D> = {
  id: "tier-stack",
  name: "层级塔逐层点亮",
  layer: "structure",
  variants: 2,
  minSec: 3,
  maxSec: 16,
  tags: ["层级", "结构", "递进", "分层", "底座", "往上", "第几层", "地基"],
  motion: { kind: "分层块自底向上逐层点亮，未讲的层留虚线空位，一条光带沿塔常爬", energy: 2 },
  desc: "一摞 2~5 层的层级块：讲到哪一层，那一层从虚线空位变成实心发光块、右侧同步出现这层的说明；没讲到的层还是虚影，观众看得见「上面还有几层」。塔左侧可挂一颗向上传导的箭头，结论条停在塔底下方的空带里，不压主体。变体 0 上窄下宽（塔），变体 1 等宽（架子）。",
  use:
    "讲「先有 A 才有 B、一层托一层」的结构递进：AI 的四层结构、一个产品的能力分层、学习路径的先修后修、预算从底层成本往上长、组织里执行层喂给决策层。凡是「这是第 N 层」「往上走一层」的旁白都贴。和 pyramid-base 分开用：那个讲底座被切掉后上面站不住，这个讲结构怎么盖起来。",
  schema,
  example: {
    kicker: "四层结构",
    title: "从下往上数",
    tiers: [
      { name: "算力", note: "最底下这层是电和芯片", icon: "zap", at: 12 },
      { name: "大模型", note: "有了算力才长出大脑", icon: "spark", at: 78 },
      { name: "AIGC 工具", note: "写文案、生图、生视频", icon: "tool", at: 150 },
      { name: "智能体", note: "一句话替你把活干完", icon: "bot", at: 222 },
    ],
    feedLabel: "下一层托住上一层",
    verdict: "分清层级，才知道该用哪一层",
  },
  C,
};
