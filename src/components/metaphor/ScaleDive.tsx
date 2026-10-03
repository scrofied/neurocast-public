// 移植自 yihui-dev/awesome-opus5-5-videos（MIT）里 @acoramaa 的 prompt acoramaa-053577：
// 从书桌上那台机器一路 zoom 到 CPU 里的一个原子，中途绝不切镜；右边一把对数比例尺全程跟着读数（1 m → 2 nm）。
// https://x.com/acoramaa
//
// 中文改造：连续尺度下钻 + 右侧对数比例尺。讲「问题往下钻一层是什么」「你的请求穿过哪几层」。
// 与已有的 teardown-lens 的区别：那个是离散炸开几层贴标签，这个必须**连续、不切镜**，
// 而且比例尺读数实时跟着 log10 尺度一起滑。纯代码几何（套盒 + 网格/环/斜纹），不贴任何假截图。
import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, hash, lerp, noise1, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const diveLayer = z.object({
  label: z.string().describe("这一层是什么：桌面 / 机箱 / 芯片 / 晶体管 / 原子"),
  note: z.string().optional().describe("这一层的一行小字说明（≤16 字），钻到底时显示"),
  scale: z.number().positive().describe("这一层的尺度（米，可写 0.3 / 0.01 / 1e-6；比例尺按 log10 插值）"),
  at: z.number().optional().describe("穿到这一层的时刻（锚点台词原文或帧）；缺省 = 整段均分"),
  color: z.string().optional().describe("这一层的描边色（hex），缺省按 主色 → 次色 → 强调色 → 金 轮换"),
});
const schema = z.object({
  kicker: z.string().optional().describe("左上角小标签，如 SCALE DIVE"),
  title: z.string().optional().describe("标题：一句要往下钻的话"),
  layers: z.array(diveLayer).min(3).max(6).describe("3~6 层，从大到小一层套一层（scale 必须递减）"),
  unitFrom: z.string().optional().describe("比例尺顶端的单位标注，如「1 m」；缺省按第一层的尺度自动生成"),
  endNote: z.string().optional().describe("钻到底时底部出现的结论大字"),
  endAt: z.number().optional().describe("结论大字出现的时刻（锚点或帧），缺省 = 到最后一层后 26 帧"),
});
type D = z.infer<typeof schema>;

// 尺度格式化：按数量级挑单位，读起来像人话（0.3 → 30 cm / 1e-2 → 1 cm / 1e-6 → 1 µm / 2e-9 → 2 nm）
const UNITS: [string, number][] = [
  ["km", 1e3],
  ["m", 1],
  ["cm", 1e-2],
  ["mm", 1e-3],
  ["µm", 1e-6],
  ["nm", 1e-9],
  ["pm", 1e-12],
  ["fm", 1e-15],
];
const fmtScale = (v: number) => {
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (Math.log10(v) > 4) return `${v.toExponential(1)} m`;
  let i = 0;
  while (i < UNITS.length - 1 && v < UNITS[i][1]) i++;
  while (i < UNITS.length - 1 && v / UNITS[i][1] >= 1000) i++;
  const r = v / UNITS[i][1];
  const txt = r >= 100 ? String(Math.round(r)) : String(+r.toFixed(r >= 10 ? 1 : 2));
  return `${txt} ${UNITS[i][0]}`;
};

const R = 2.4; // 每往里一层，静止尺寸缩 1/R；穿过时再放大 R 倍 → 连续不切镜
const BASE = 1900; // 归一化基准（单位盒 = 1×1 经 scale 变换）
const AR = 1.5; // 套盒宽高比

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const n = d.layers.length;

  const raw = listCues(d.layers.map((l) => ({ at: l.at })), 10, Math.max(62, dur - 40));
  const cues: number[] = [];
  for (let i = 0; i < n; i++) cues.push(Math.max(raw[i], i ? cues[i - 1] + 20 : 8));
  const endAt = cueOr(d.endAt, cues[n - 1] + 26);

  const lgs = d.layers.map((l) => Math.log10(l.scale));

  // u = 连续的小数层位（不切镜的关键：整数部分是「现在在哪一层」，小数部分是「穿到哪一步了」）
  let u = 0;
  if (n > 1) {
    if (frame < cues[0]) {
      u = -0.4 * easeOut(prog(frame, 2, Math.max(6, cues[0] - 2)));
    } else {
      let k0 = 0;
      for (let i = 0; i < n; i++) if (frame >= cues[i]) k0 = i;
      if (k0 >= n - 1) u = n - 1 + prog(frame, cues[n - 1], Math.max(10, dur - cues[n - 1] - 10)) * 0.42;
      else u = k0 + easeInOut(prog(frame, cues[k0] + 12, Math.max(10, cues[k0 + 1] - cues[k0] - 16)));
    }
  }
  const ki = Math.max(0, Math.min(n - 1, Math.floor(u)));
  const lgNow = n < 2 ? lgs[0] : u >= n - 1 ? lgs[n - 1] : lerp(lgs[Math.max(0, ki)], lgs[Math.min(n - 1, ki + 1)], clamp(u - ki));
  const nowScale = Math.pow(10, lgNow);

  const cx = width * (full ? 0.4 : 0.5);
  const cy = height * 0.52;
  const rx = width - (full ? 130 : 60);
  const rTop = height * 0.2;
  const rBot = height * 0.8;
  const padT = lgs[0] + 0.2;
  const padB = lgs[n - 1] - 0.2;
  const yOf = (lg: number) => lerp(rTop, rBot, clamp((padT - lg) / Math.max(0.001, padT - padB)));

  const COLS = [t.primary, t.secondary, t.accent, t.gold];
  const colOf = (i: number) => d.layers[i].color ?? COLS[i % COLS.length];
  const sizeOf = (i: number) => BASE * Math.pow(R, u - i - 1);

  const eBox = enterAt(frame, cues[0] - 4, { fallback: "rise", dur: 18, from: 0.88, dist: 0.4 });
  const eRul = enterAt(frame, cues[0] + 2, { fallback: "slide-r", dur: 16, dist: 0.5 });
  const eLab = enterAt(frame, cues[ki], { fallback: "rise", dur: 14, dist: 0.6 });
  const eEnd = enterAt(frame, endAt, { fallback: "drop", dur: 16, dist: 0.7 });
  const dec = d.layers[ki];
  const qCur = u - ki;
  const settled = qCur < 0.35;

  const boxes = d.layers
    .map((l, i) => {
      const q = u - i;
      if (q < -0.12 || q > 1.5) return null;
      const size = sizeOf(i);
      const baseSize = BASE * Math.pow(R, -i); // 这一层刚进来（q=0）时有多大
      const clipSize = Math.max(60, baseSize * eBox.scale);
      // 穿越那一下给一点手抖式的错位（纯帧数函数，不用随机）
      const j = q > 0.7 && q < 1.2 ? 1 - Math.abs(q - 0.95) / 0.25 : 0;
      const jx = noise1(frame * 0.8, hash(l.label)) * 7 * j;
      const jy = noise1(frame * 0.9, hash(l.label) + 5) * 5 * j;
      const op = (q < 0 ? easeOut(clamp((q + 0.12) / 0.12)) : 1) * (1 - easeIn(clamp((q - 0.85) / 0.55)));
      if (op <= 0.01) return null;
      const col = colOf(i);
      const rot = noise1(i * 3.1, hash(l.label)) * 1.4;
      const bw = size;
      const bh = size / AR;
      const tex: React.ReactNode[] = [];
      if (variant === 0) {
        for (let g = 1; g < 4; g++) {
          tex.push(<line key={`v${g}`} x1={-0.5 + g / 4} y1={-0.5 / AR} x2={-0.5 + g / 4} y2={0.5 / AR} />);
          tex.push(<line key={`h${g}`} x1={-0.5} y1={-0.5 / AR + (g / 4) * (1 / AR)} x2={0.5} y2={-0.5 / AR + (g / 4) * (1 / AR)} />);
        }
      } else if (variant === 1) {
        tex.push(<rect key="r1" x={-0.34} y={-0.34 / AR} width={0.68} height={0.68 / AR} rx={0.05} fill="none" />);
        tex.push(<rect key="r2" x={-0.18} y={-0.18 / AR} width={0.36} height={0.36 / AR} rx={0.04} fill="none" />);
      } else {
        for (let g = 0; g < 6; g++) {
          const a = -0.5 + (g / 6) * 1.0;
          tex.push(<line key={`d${g}`} x1={a} y1={-0.5 / AR} x2={a + 0.5 / AR} y2={0.5 / AR} />);
        }
      }
      // 穿过当前盒时，把它和下一个盒的角连起来 → 看得见的「隧道」
      const next = i + 1 < n ? sizeOf(i + 1) : null;
      const linkOp = next ? 1 - easeIn(clamp((q - 1.05) / 0.4)) : 0;
      const links: React.ReactNode[] = [];
      if (next && q > 0.55 && linkOp > 0.02) {
        const nw = next;
        const nh = next / AR;
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            links.push(<line key={`${sx}${sy}`} x1={(sx * bw) / 2} y1={(sy * bh) / 2} x2={(sx * nw) / 2} y2={(sy * nh) / 2} />);
          }
        }
      }
      return (
        <g
          key={i}
          opacity={clamp(op)}
          transform={`translate(${cx + jx} ${cy + jy}) rotate(${rot}) scale(${size}) translate(${-size / 2} ${-size / (2 * AR)})`}
          stroke={alpha(col, 0.9)}
          strokeWidth={2.4}
          fill="none"
          vectorEffect="non-scaling-stroke"
        >
          <g clipPath={`rect(${(-clipSize / 2).toFixed(1)}px ${(-clipSize / (2 * AR)).toFixed(1)}px ${clipSize.toFixed(1)}px ${(clipSize / AR).toFixed(1)}px)`}>
            <rect x={0} y={0} width={1} height={1 / AR} rx={0.045} fill={alpha(col, 0.05)} />
            <g stroke={alpha(col, 0.34)} strokeWidth={1.4} vectorEffect="non-scaling-stroke">
              {tex}
            </g>
            {/* 四角括角：一眼看出这是个「能穿过去的窗口」 */}
            {variant !== 1 && (
              <g stroke={alpha(col, 0.95)} strokeWidth={3.2} vectorEffect="non-scaling-stroke">
                {[
                  [0, 0, 0.12, 0.12 / AR],
                  [1, 0, -0.12, 0.12 / AR],
                  [1, 1 / AR, -0.12, -0.12 / AR],
                  [0, 1 / AR, 0.12, -0.12 / AR],
                ].map((p, ci) => (
                  <polyline key={ci} points={`${p[0]},${p[1]} ${p[0] + p[2]},${p[1]} ${p[0] + p[2] * 0.14},${p[1]} ${p[0]},${p[1] + p[3]}`} fill="none" />
                ))}
              </g>
            )}
            {links.length > 0 && (
              <g stroke={alpha(t.accent, 0.5 * linkOp)} strokeWidth={1.6} strokeDasharray="6 8" vectorEffect="non-scaling-stroke" transform={`translate(${0.5} ${0.5 / AR})`}>
                {links.map((ln, li) => React.cloneElement(ln as React.ReactElement<any>, { key: li }))}
              </g>
            )}
          </g>
        </g>
      );
    })
    .filter(Boolean);

  // 比例尺刻度：每个数量级一条线，旁边读数
  const tickDecades: number[] = [];
  for (let e = Math.ceil(padB); e <= Math.floor(padT); e++) tickDecades.push(e);
  const cursorY = yOf(lgNow);

  return (
    <>
      <Heading kicker={d.kicker ?? "SCALE DIVE"} title={d.title} frame={frame} width={width} />

      <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: eBox.opacity, transform: `translate(${eBox.dx}px, ${eBox.dy}px) scale(${eBox.scale})`, clipPath: eBox.clip }}>
        {boxes}
        {/* 中心准星：不管穿到哪一层，视线都钉在这里 */}
        <circle cx={cx} cy={cy} r={3 + 2 * Math.sin(frame / 6)} fill={alpha(t.accent, 0.85)} />
      </svg>

      {/* 右侧对数比例尺：游标连续下滑，读数实时跟着尺度走 */}
      <div style={{ position: "absolute", right: full ? 60 : 20, top: 0, width: full ? 260 : 180, height, opacity: eRul.opacity, transform: `translate(${eRul.dx}px, ${eRul.dy}px)`, pointerEvents: "none" }}>
        <svg width={full ? 260 : 180} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
          <line x1={28} y1={rTop} x2={28} y2={rBot} stroke={alpha(t.primary, 0.45)} strokeWidth={2} />
          {tickDecades.map((e) => {
            const y = yOf(e);
            const v = Math.pow(10, e);
            const passed = lgNow <= e + 0.0001;
            return (
              <g key={e}>
                <line x1={28} y1={y} x2={passed ? 60 : 46} y2={y} stroke={alpha(passed ? t.accent : t.dim, 0.8)} strokeWidth={passed ? 2.5 : 1.6} />
                <text x={68} y={y + 6} fill={passed ? t.text : t.dim} fontSize={full ? 19 : 15} fontFamily={t.font.mono} opacity={0.9}>
                  {fmtScale(v)}
                </text>
              </g>
            );
          })}
          {tickDecades.map((e) => {
            const y = yOf(e + 0.5);
            return <line key={`m${e}`} x1={28} y1={y} x2={38} y2={y} stroke={alpha(t.dim, 0.45)} strokeWidth={1.2} />;
          })}
          {/* 走过的区段染色 */}
          <line x1={28} y1={yOf(lgs[0])} x2={28} y2={cursorY} stroke={t.primary} strokeWidth={4} style={{ filter: `drop-shadow(0 0 12px ${alpha(t.primary, 0.7)})` }} />
          <g transform={`translate(28 ${cursorY})`}>
            <polygon points="0,0 16,-9 16,9" fill={t.accent} style={{ filter: `drop-shadow(0 0 10px ${alpha(t.accent, 0.8)})` }} />
            <circle cx={0} cy={0} r={7} fill={alpha(t.accent, 0.3)} stroke={t.accent} strokeWidth={2} />
          </g>
        </svg>
        <div style={{ position: "absolute", left: 0, top: rTop - 46, width: "100%", fontFamily: t.font.mono, fontSize: 16, letterSpacing: 3, color: alpha(t.dim, 0.9) }}>
          {d.unitFrom ?? fmtScale(d.layers[0].scale)}
        </div>
        <div style={{ position: "absolute", left: 44, top: cursorY - 22, width: "100%", fontFamily: t.font.mono, fontWeight: 700, fontSize: full ? 34 : 24, color: t.accent, textShadow: `0 0 18px ${alpha(t.accent, 0.6)}`, whiteSpace: "nowrap" }}>
          {fmtScale(nowScale)}
        </div>
      </div>

      {/* 当前层的名字与说明：每穿一层换一次，读数就在旁边。结论落地时它让位（底部只留一句话） */}
      {!(d.endNote && frame >= endAt) && (
        <div style={{ position: "absolute", left: full ? 96 : 26, top: height - 250, width: full ? 620 : 420, opacity: eLab.opacity, transform: `translate(${eLab.dx}px, ${eLab.dy}px)`, pointerEvents: "none" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontFamily: t.font.mono, fontSize: 20, letterSpacing: 3, color: colOf(ki) }}>
              {String(ki + 1).padStart(2, "0")}/{String(n).padStart(2, "0")}
            </span>
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(dec.label, full ? 520 : 360, 46, 24), color: t.text, textShadow: `0 0 24px ${alpha(colOf(ki), 0.5)}` }}>{dec.label}</span>
          </div>
          {dec.note && settled && (
            <div style={{ marginTop: 12, fontFamily: t.font.body, fontWeight: 700, fontSize: fitFont(dec.note, full ? 560 : 380, 24, 17), lineHeight: 1.4, color: alpha(t.dim, 0.95), opacity: easeOut(prog(frame, cues[ki] + 8, 12)) }}>
              {dec.note}
            </div>
          )}
          <div style={{ marginTop: 14, fontFamily: t.font.mono, fontSize: 22, color: alpha(t.text, 0.75) }}>{fmtScale(dec.scale)}</div>
        </div>
      )}

      {d.endNote && frame >= endAt && (
        <div style={{ position: "absolute", left: 0, right: 0, top: height - 240, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(d.endNote, width - 360, 54, 28), color: t.gold, textShadow: `0 0 30px ${alpha(t.gold, 0.6)}, 0 4px 0 rgba(0,0,0,.55)`, transform: `translateY(${eEnd.dy}px) scale(${eEnd.scale})`, opacity: eEnd.opacity, pointerEvents: "none" }}>
          {d.endNote}
        </div>
      )}

      <Sfx name="impact" at={cues[0]} volume={0.3} />
      {cues.map((c, i) => (i === 0 ? null : <Sfx key={i} name="whoosh" at={c - 3} volume={0.3} />))}
      {cues.map((c, i) => (i === 0 ? null : <Sfx key={`t${i}`} name="tick" at={c + 10} volume={0.22} />))}
      {d.endNote && <Sfx name="ding" at={endAt} volume={0.34} />}
    </>
  );
};

export const ScaleDive: CompDef<D> = {
  id: "scale-dive",
  name: "连续尺度下钻（对数比例尺跟读）",
  layer: "metaphor",
  variants: 3,
  minSec: 5,
  maxSec: 18,
  tags: ["往下钻", "尺度", "一层套一层", "放大", "纳米", "穿过哪几层", "细节"],
  motion: { kind: "套盒连续放大穿过（不切镜）+ 右侧对数比例尺游标连续下滑实时读数", energy: 3 },
  desc: "3~6 层从大到小的尺度（0.8 m → 2 nm）：每层画成一个会穿过去的圆角套盒（描边 + 四角括角 + 网格/环/斜纹几何纹理），当前层连续指数放大铺满画面并穿过、下一层从中心长出来，两层之间画出隧道连线；右边一把竖向对数比例尺，刻度按 log10 分布，高亮游标随尺度连续下滑，旁边用中文数量级实时读数（1 m / 30 cm / 1 µm / 2 nm）",
  use: "「问题往下钻一层是什么」「你的请求穿过哪几层」「这台机器里数到原子还剩什么」——凡是用尺度层级说服人的句子。跟 teardown-lens 的区别：那个离散炸层贴标签，这个必须一镜到底连续下钻、且比例尺跟着走。纯几何动画，不需要素材",
  schema,
  example: {
    kicker: "SCALE DIVE",
    title: "你的请求一路钻到哪里",
    layers: [
      { label: "我的桌面", note: "一份提示词敲下去", scale: 0.8 },
      { label: "机箱里的 SSD", note: "上下文先进这里", scale: 0.05 },
      { label: "CPU die", note: "再变成电信号", scale: 1e-3 },
      { label: "晶体管", note: "上千个一起开关", scale: 2e-8 },
    ],
    endNote: "一次回答 = 穿过五个数量级",
  },
  C,
};
