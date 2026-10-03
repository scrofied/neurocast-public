// 移植自 yihui-dev/awesome-opus5-5-videos（MIT）里 @ror-fly 的 prompt ror-fly-880547：
// https://x.com/ror-fly/status/2103807415218880547
// 原机制：一杯鸡尾酒从空杯到成品，按配方逐味倒入，每味带着用量落进杯中、液面同步上涨。
// 已改成配音时间轴驱动的讲解镜头，参数化：讲「一个结论由哪几部分构成」（一条提示词由 3 部分组成、
// 成本由 3 块构成、一套 SOP 三味料）时，每说到一味就落进容器一次，最后砸出结论。
import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeIn, easeInOut, easeOut, hash, prog } from "../../lib/anim";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { Slam } from "../../lib/cine/Type";
import { fitFont, GlowDefs, Headline, textEm } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const item = z.object({
  label: z.string().describe("这一味的名字，如「角色设定」「算力成本」"),
  amount: z.number().describe("这一味的量；全配方自动归一（液面高度=累计占比，不需要自己凑 100）"),
  note: z.string().optional().describe("清单里这条后面的小注，如「决定语气」"),
  at: z.number().optional().describe("这一味倒入的时刻（锚点（台词原文）或帧）；缺省=按台词均匀铺开"),
  color: z.string().optional().describe("这一味的颜色（#hex），缺省按主题色轮转"),
});

const schema = z.object({
  title: z.string().optional().describe("镜头标题，左上 Headline"),
  kicker: z.string().optional().describe("标题上方小标签，缺省 RECIPE"),
  vessel: z.enum(["glass", "box", "tank"]).default("glass").describe("容器形状：glass 上宽下窄杯 / box 圆角方箱 / tank 胶囊罐"),
  unit: z.string().optional().describe("数值单位，跟在每味 amount 后面，如 %、份、成、元"),
  items: z.array(item).min(2).max(6).describe("往容器里依次加入的几味（2~6 味）"),
  result: z.string().optional().describe("倒完后砸在容器上方的结论大字"),
  resultAt: z.number().optional().describe("结论登场时刻（锚点（台词原文）或帧）；缺省=最后一味倒完 +20 帧"),
});
type D = z.infer<typeof schema>;

// 圆角矩形路径：box/tank 都用它（tank 把半径给到半宽就成了胶囊）
const rrect = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + rr},${y} H${x + w - rr} A${rr},${rr} 0 0 1 ${x + w},${y + rr} V${y + h - rr} A${rr},${rr} 0 0 1 ${x + w - rr},${y + h} H${x + rr} A${rr},${rr} 0 0 1 ${x},${y + h - rr} V${y + rr} A${rr},${rr} 0 0 1 ${x + rr},${y} Z`;
};
// 杯子：上宽下窄梯形 + 底部圆角
const cup = (cx: number, top: number, bottom: number, ht: number, hb: number, r: number) =>
  `M${cx - ht},${top} L${cx + ht},${top} L${cx + hb},${bottom - r} Q${cx + hb},${bottom} ${cx + hb - r},${bottom} L${cx - hb + r},${bottom} Q${cx - hb},${bottom} ${cx - hb},${bottom - r} Z`;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();

  const n = d.items.length;
  const amts = d.items.map((x) => Math.max(0.0001, x.amount));
  const total = amts.reduce((s, a) => s + a, 0);
  const frac = amts.map((a) => a / total);
  // 液面是「每味占比 × 该味倒入进度」的和：连续函数，没有台阶跳变
  const cues = listCues(d.items, 18, Math.max(40, Math.round(dur * 0.62)));
  const gap = n > 1 ? (cues[n - 1] - cues[0]) / (n - 1) : 24;
  const pourDur = clamp(gap * 0.85, 12, 30);
  const resultAt = cueOr(d.resultAt, Math.round(cues[n - 1] + pourDur + 20));

  const PAL = [t.primary, t.accent, t.secondary, t.gold, t.text, t.bad];
  const colorOf = (i: number) => d.items[i].color ?? PAL[i % PAL.length];

  const cx = variant === 1 ? width * 0.34 : width * 0.33;
  const vy0 = height * 0.36;
  const vy1 = height * 0.88;
  const vh = vy1 - vy0;
  const hw = Math.min(width * 0.115, 178);
  const span = vh * 0.88; // 100% 对应的液柱高度，顶部留一点余量

  const rise = frac.map((f, i) => f * easeInOut(prog(frame, cues[i], pourDur)));
  const lvl = rise.reduce((s, r) => s + r, 0);
  const cum = frac.map((_, i) => frac.slice(0, i).reduce((s, f) => s + f, 0)); // 这一味底部占比
  const surface = vy1 - lvl * span;
  // 倒入中途水面最激动，用 sin 叠加两个波长做轻微波动
  const agitation = frac.reduce((m, _, i) => Math.max(m, Math.sin(prog(frame, cues[i], pourDur) * Math.PI)), 0);
  const amp = 1.6 + agitation * 5;

  const shapeD =
    d.vessel === "glass"
      ? cup(cx, vy0, vy1, hw, hw * 0.56, 26)
      : d.vessel === "tank"
        ? rrect(cx - hw * 0.8, vy0, hw * 1.6, vh, hw * 0.8)
        : rrect(cx - hw * 0.92, vy0, hw * 1.84, vh, 26);
  const rimRx = d.vessel === "glass" ? hw : d.vessel === "tank" ? hw * 0.8 : hw * 0.92;

  // 分层渐变：每一味一段实色（offset 0=杯底），液面上升时分层自然显影
  let acc = 0;
  const stops = frac.map((f, i) => {
    const o0 = acc;
    acc += f;
    return { o0, o1: acc, c: colorOf(i) };
  });

  const wave: string[] = [];
  for (let x = cx - hw - 40; x <= cx + hw + 40; x += 18) {
    wave.push(`${x},${surface + Math.sin(x / 58 + frame / 7) * amp + Math.sin(x / 21 - frame / 11) * amp * 0.45}`);
  }
  const waveD = `M${cx - hw - 40},${vy1 + 6} L${wave.join(" L")} L${cx + hw + 40},${vy1 + 6} Z`;

  // 容器本体的入场 = 分镜 motion.enter 的落点；from:1 只淡入不缩放（缩放会带着液面几何一起晃）
  const eVessel = enterAt(frame, 6, { fallback: "rise", dur: 16, from: 1, dist: 0.5 });
  const done = clamp(prog(frame, resultAt, 10));
  const listX = variant === 1 ? cx + hw + 46 : width * 0.56;
  const listW = width - listX - 64;

  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: eVessel.opacity, transform: `translate(${eVessel.dx}px, ${eVessel.dy}px) scale(${eVessel.scale})`, clipPath: eVessel.clip }}>
        <GlowDefs id="fbg" std={10} />
        <defs>
          <clipPath id="fbc">
            <path d={shapeD} />
          </clipPath>
          <linearGradient id="fbl" gradientUnits="userSpaceOnUse" x1={cx} y1={vy1} x2={cx} y2={vy1 - span}>
            {stops.map((s, i) => (
              <React.Fragment key={i}>
                <stop offset={s.o0} stopColor={s.c} />
                <stop offset={s.o1} stopColor={s.c} />
              </React.Fragment>
            ))}
          </linearGradient>
        </defs>

        {/* 刻度：读数就在杯壁上，观众才知道现在到几成 */}
        {[0, 0.25, 0.5, 0.75, 1].map((k) => {
          const y = vy1 - k * span;
          return (
            <g key={k} opacity={0.55}>
              <line x1={cx - hw - 26} x2={cx - hw - 6} y1={y} y2={y} stroke={alpha(t.dim, 0.7)} strokeWidth={2} />
              <text x={cx - hw - 32} y={y + 7} textAnchor="end" fill={t.dim} fontSize={19} fontFamily={t.font.mono}>
                {k * 100}
              </text>
            </g>
          );
        })}

        <path d={shapeD} fill={alpha(t.bg2, 0.5)} stroke={alpha(t.primary, 0.55)} strokeWidth={4} filter={done > 0 ? "url(#fbg)" : undefined} />
        <g clipPath="url(#fbc)">
          <path d={waveD} fill="url(#fbl)" opacity={0.82} />
          <path d={waveD} fill="none" stroke={alpha(t.text, 0.55)} strokeWidth={3} />
          {/* 杯壁高光 */}
          <path d={shapeD} fill="none" stroke={alpha("#ffffff", 0.16)} strokeWidth={14} />
        </g>
        {/* 杯口 */}
        <ellipse cx={cx} cy={vy0} rx={rimRx} ry={14} fill={alpha(t.bg, 0.35)} stroke={alpha(t.primary, 0.7)} strokeWidth={3} />
        {lvl > 0.02 && <ellipse cx={cx} cy={surface} rx={hw * 0.86} ry={9} fill={alpha(t.text, 0.14)} stroke={alpha(t.text, 0.5)} strokeWidth={2} />}
      </svg>

      {/* 每一味：从杯口上方掉进来（easeIn 加速），落到当时的液面上 */}
      {d.items.map((x, i) => {
        const lead = 12;
        const start = cues[i] - lead;
        if (frame < start || frame >= cues[i] + 3) return null;
        const p = easeIn(prog(frame, start, lead));
        const landY = vy1 - cum[i] * span;
        const y = vy0 - 132 + (landY - (vy0 - 132)) * p;
        const fs = 26;
        const pw = textEm(x.label) * fs + 150;
        const rot = ((hash(x.label) % 16) - 8) * (1 - p);
        const c = colorOf(i);
        return (
          <div key={i}>
            <div
              style={{
                position: "absolute",
                left: cx - pw / 2,
                top: y - 24,
                width: pw,
                height: 48,
                borderRadius: 24,
                background: alpha(c, 0.9),
                border: `2px solid ${alpha(t.text, 0.5)}`,
                boxShadow: `0 0 26px ${alpha(c, 0.6)}`,
                transform: `rotate(${rot}deg)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: fs,
                color: t.bg,
                whiteSpace: "nowrap",
              }}
            >
              {x.label}
              <span style={{ fontFamily: t.font.mono, fontWeight: 700, fontSize: 22 }}>
                {x.amount}
                {d.unit ?? ""}
              </span>
            </div>
            {/* 入水涟漪 */}
            {frame >= cues[i] && frame < cues[i] + 26 &&
              [0, 1].map((k) => {
                const rp = (frame - cues[i]) / 26;
                const rw = 30 + rp * (hw * 1.5) - k * 24;
                return rw > 4 ? <div key={k} style={{ position: "absolute", left: cx - rw / 2, top: landY - 8 * rp, width: rw, height: 16, borderRadius: "50%", border: `2px solid ${alpha(t.text, (1 - rp) * 0.7)}` }} /> : null;
              })}
            {/* 倒水的水柱 */}
            {frame >= cues[i] && frame < cues[i] + pourDur && (
              <div style={{ position: "absolute", left: cx - 5, top: vy0 - 60, width: 10, height: Math.max(0, surface - vy0 + 60), borderRadius: 6, background: `linear-gradient(180deg, ${alpha(c, 0.9)}, ${alpha(c, 0.3)})`, opacity: 0.5 + 0.5 * Math.sin(frame / 3) }} />
            )}
          </div>
        );
      })}

      {/* 清单：变体 0 = 右侧逐条点亮；变体 1 = 引线指向杯壁上自己那一层 */}
      {d.items.map((x, i) => {
        const on = frame >= cues[i];
        const eRow = enterAt(frame, cues[i], { fallback: "slide-r", dur: 12, seed: i });
        const c = colorOf(i);
        const bandY = vy1 - (cum[i] + frac[i] / 2) * span;
        const y = variant === 1 ? bandY - 20 : 210 + i * 108;
        if (variant === 1)
          return (
            <div key={i} style={{ position: "absolute", left: listX, top: y, width: listW, opacity: on ? eRow.opacity : 0.28, transform: `translate(${eRow.dx}px, ${eRow.dy}px)`, clipPath: eRow.clip }}>
              <svg width={34} height={40} style={{ position: "absolute", left: -40, top: 10 }}>
                <line x1={0} y1={8} x2={30} y2={8} stroke={alpha(c, on ? 0.9 : 0.3)} strokeWidth={2} />
              </svg>
              <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(x.label, listW, 34, 18), color: on ? t.text : t.dim, whiteSpace: "nowrap" }}>
                {x.label} <span style={{ fontFamily: t.font.mono, fontSize: 24, color: on ? c : t.dim }}>{x.amount}{d.unit ?? ""}</span>
              </div>
              {x.note && <div style={{ marginTop: 4, fontFamily: t.font.body, fontSize: 22, color: t.dim, whiteSpace: "nowrap" }}>{x.note}</div>}
            </div>
          );
        return (
          <div key={i} style={{ position: "absolute", left: listX, top: y, width: listW, opacity: eRow.opacity, transform: `translate(${eRow.dx}px, ${eRow.dy}px)`, clipPath: eRow.clip }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: on ? c : alpha(t.dim, 0.3), boxShadow: on ? `0 0 18px ${alpha(c, 0.8)}` : undefined }} />
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(x.label, listW * 0.6, 40, 20), color: on ? t.text : alpha(t.text, 0.35), whiteSpace: "nowrap" }}>{x.label}</span>
              <span style={{ fontFamily: t.font.mono, fontWeight: 700, fontSize: 30, color: on ? c : t.dim }}>{Math.round(frac[i] * 100)}%</span>
            </div>
            {/* 占比条：随这一味的倒入进度生长 */}
            <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: alpha(t.text, 0.1), width: listW * 0.82 }}>
              <div style={{ height: 8, borderRadius: 4, width: listW * 0.82 * (on ? rise[i] / frac[i] : 0), background: c, boxShadow: `0 0 14px ${alpha(c, 0.7)}` }} />
            </div>
            {x.note && <div style={{ marginTop: 8, fontFamily: t.font.body, fontSize: 24, color: t.dim }}>{x.note}</div>}
          </div>
        );
      })}

      {d.result && frame >= resultAt && (
        <div style={{ position: "absolute", left: cx - 560, top: vy0 - 210, width: 1120, display: "flex", justifyContent: "center" }}>
          <Slam frame={frame} at={resultAt} text={d.result} size={fitFont(d.result, 1000, 92, 36)} color={t.text} stroke={t.bg} strokeW={6} font={t.font.title} from={1.9} len={9} blur={12} minOpacity={0.2} />
        </div>
      )}

      <Headline kicker={d.kicker ?? "配方 · 逐味加入"} title={d.title} frame={frame} />
      {cues.map((c, i) => (
        <Sfx key={i} name="pop" at={Math.round(c)} volume={0.22} />
      ))}
      {d.result && <Sfx name="impact" at={resultAt} volume={0.5} />}
      {d.result && <Sfx name="ding" at={resultAt + 12} volume={0.3} />}
    </>
  );
};

export const FillBuild: CompDef<D> = {
  id: "fill-build",
  name: "配方累加填充",
  layer: "info",
  variants: 2,
  minSec: 4,
  maxSec: 14,
  tags: ["组成", "由几部分", "配方", "三味料", "构成", "占比", "搭建", "加进去"],
  motion: { kind: "每味从杯口掉进容器、液面按累计占比连续上涨（带水波与涟漪），清单逐条点亮，倒完结论大字砸下", energy: 2 },
  desc: "中央一个容器（杯/方箱/胶囊罐）带刻度，按配音逐味掉落入水、液面连续上升到该味的累计占比，右侧（或引线指向液层）清单逐条点亮，倒完容器发光并砸出结论大字",
  use: "讲「一个东西由哪几部分构成、各占多少」：一条提示词由角色+任务+格式三部分组成、成本由算力/人力/带宽三块构成、一套流程三味料缺一不可；amount 只填相对量，占比与液面自动归一",
  schema,
  example: {
    title: "一条能用的提示词",
    kicker: "三味料",
    vessel: "glass",
    unit: "成",
    items: [
      { label: "角色设定", amount: 3, note: "决定语气和立场" },
      { label: "任务拆解", amount: 4, note: "决定它做什么" },
      { label: "输出格式", amount: 3, note: "决定你怎么验收" },
    ],
    result: "缺一味，就不是能用的提示词",
  },
  C,
};
