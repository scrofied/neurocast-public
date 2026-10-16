import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeOut } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, fmtNum, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 出处：opus-5-5-motion-gallery/w05-escapement / Promptslove（博客《Claude Opus 5.5 评测 Test 1》2026-09）https://promptslove.com/blog/claude-opus-5-5-review/
// 片库整理：小红书 AI伐木工（jinhanbuilds/opus-5-5-motion-gallery）；逐条机制对照见 docs/OPUS55_ANIMATIONS.md 一·c。
// 移植自 opus-5-5-motion-gallery/w05-escapement（那是 three.js + 400vh 滚动的交互网页，
// 搬不动，搬的是它的**数学**）：
//   1) 齿数比递推角速度：k[last] = 1，k[i] = −(N[i+1]/N[i])·k[i+1] ⇒ **每一级的转速是被齿数算出来的**，
//      不是手填的动画速度。所以「这一级转六圈，末级才转一圈」这句话在画面上是真的。
//   2) 相位对齐：off = 中心连线角 + π − 半个齿距 ⇒ 相邻两轮的牙齿真的嵌进对方的齿缝里，
//      而不是两个自转的圆盘叠在一起。
//   3) 间歇运动写成**分段闭式函数**（不是状态机）：每拍只有前 22% 的时间里在走（三次缓出），
//      其余时间完全锁死 —— 这就是擒纵「咔、咔」的来源，任意一帧都能独立求值。
// 3D 降级成俯视 + 金属感描边（真 3D 在这里不值钱，咬合与转速才是信息量）。

const gear = z.object({
  name: z.string().max(8).describe("这一级叫什么，如 发条 / 一轮 / 擒纵"),
  teeth: z.number().min(10).max(96).describe("齿数。**转速由齿数比算出来**，所以这里要写你真的想对比的那个数"),
});
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  gears: z.array(gear).min(2).max(5).describe("2~5 级传动链，从动力端写到输出端"),
  rpm: z.number().min(1).max(60).optional().describe("动力端转速（每分钟圈数），默认 9"),
  beat: z.number().min(0.5).max(8).optional().describe("每秒拍数。写了就变成擒纵式的**间歇运动**（走一下、停一下），不写就连续匀速转"),
  verdict: z.string().max(20).optional().describe("结论条，如「差一齿，整条都错」"),
});
type D = z.infer<typeof schema>;

// 齿轮轮廓：每个齿 5 个点（齿根→齿顶→齿根）
const gearPath = (N: number, rTip: number, rRoot: number) => {
  const p = (2 * Math.PI) / N;
  let d = "";
  for (let i = 0; i < N; i++) {
    const a0 = i * p;
    const pts: [number, number][] = [
      [a0, rRoot],
      [a0 + 0.2 * p, rRoot],
      [a0 + 0.32 * p, rTip],
      [a0 + 0.68 * p, rTip],
      [a0 + 0.8 * p, rRoot],
    ];
    pts.forEach(([a, r], j) => {
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      d += `${i === 0 && j === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    });
  }
  return `${d}Z`;
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const s = frame / fps;

  const N = data.gears.map((g) => Math.round(g.teeth));
  const n = N.length;
  // 齿比递推（输出端为 1）
  const k = new Array(n).fill(1);
  for (let i = n - 2; i >= 0; i--) k[i] = -(N[i + 1] / N[i]) * k[i + 1];

  // 布局：沿一条略微上下交替的链排开，先按「齿数=半径」算原始位置，再整体缩放进画面
  const raw = N.map((v) => v / 2);
  const pos = [{ x: 0, y: 0 }];
  for (let i = 1; i < n; i++) {
    const al = (i % 2 ? 0.3 : -0.3) + (i > 1 ? 0.08 * i : 0);
    const dist = raw[i - 1] + raw[i];
    pos.push({ x: pos[i - 1].x + Math.cos(al) * dist, y: pos[i - 1].y + Math.sin(al) * dist });
  }
  const xs = pos.map((p, i) => p.x - raw[i]);
  const xs2 = pos.map((p, i) => p.x + raw[i]);
  const ys = pos.map((p, i) => p.y - raw[i]);
  const ys2 = pos.map((p, i) => p.y + raw[i]);
  const bw = Math.max(...xs2) - Math.min(...xs);
  const bh = Math.max(...ys2) - Math.min(...ys);
  // 版面自上而下分四条带：Heading（~250）→ 读数条 → 齿轮带 → 结论，最底下 height-175 是逐字字幕带不能碰。
  // 齿轮不再挂各自的标签（大轮的标签会顶到标题、小轮的会压住摆轮），读数集中到顶部一条等分栅格，
  // 顺序与配色都和传动链从左到右一一对应，需要时用虚线引线连回各自的齿轮。
  const pad = full ? 96 : 16;
  const barY = full ? 250 : 92;
  const barH = full ? 86 : 46;
  const gap = full ? 12 : 5;
  const colW = (width - pad * 2 - gap * (n - 1)) / n;
  const chainTop = barY + barH + (full ? 20 : 8);
  const chainBottom = height - (full ? 196 : 132);
  const availW = width - pad * 2;
  const availH = Math.max(110, chainBottom - chainTop);
  const SC = Math.min(availW / bw, availH / bh) * 0.94;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  // 链条扁平 ⇒ 右边常常剩一大片空。够空就把结论条立在那儿（顺便当空白配重），此时链条靠左、把整片空白让给它；
  // 否则链条居中，结论条回落到画面底部
  const freeW = availW - bw * SC;
  const verdictRight = !!data.verdict && full && freeW > 400;
  const offX = verdictRight ? pad : pad + Math.max(0, freeW / 2);
  const offY = chainTop + Math.max(0, (availH - bh * SC) / 2);
  const place = pos.map((p, i) => ({
    x: offX + (p.x - minX) * SC,
    y: offY + (p.y - minY) * SC,
    r: raw[i] * SC,
  }));
  const verdictBox = verdictRight
    ? { left: offX + bw * SC + 34, top: offY + (availH - 170) / 2, width: Math.min(freeW - 64, width - pad - (offX + bw * SC + 34)) }
    : { left: 0, top: undefined, width: width };

  // 主转角：动力端按 rpm 匀速，或者写成擒纵（每拍走半个齿、其余时间锁死）
  const rpm = data.rpm ?? 9;
  const STEP = Math.PI / N[n - 1]; // 半个齿的弧度
  const q = data.beat ? s * data.beat : 0;
  const steps = Math.floor(q) - 1 + easeOut(clamp((q - Math.floor(q)) / 0.22)); // 前 22% 走完，剩下停住
  const phi = data.beat ? (STEP * steps) / k[n - 1] : ((2 * Math.PI * rpm) / 60 / k[0]) * s;
  const rate = data.beat ? (STEP * data.beat) / k[n - 1] : (2 * Math.PI * rpm) / 60 / k[0];
  const rot = (i: number) => {
    const al = i === 0 ? 0 : Math.atan2(pos[i].y - pos[i - 1].y, pos[i].x - pos[i - 1].x);
    const pitch = (2 * Math.PI) / N[i];
    const off = al + Math.PI - 0.5 * pitch; // 相位对齐：本齿嵌进对方的齿缝
    return (off + k[i] * phi) * 57.29578;
  };
  const rpmOf = (i: number) => (Math.abs(k[i] * rate) * 60) / (2 * Math.PI);

  const eVerdict = enterAt(frame, Math.round(dur * 0.86), { fallback: "slam", dur: 16 });
  const tones = [t.accent, t.primary, t.secondary, t.gold, t.text];

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}

      {/* 顶部读数条：每级的名字 + 齿数 + 实时圈数。列序 = 链序，配色 = 齿圈描边色 */}
      <div style={{ position: "absolute", left: pad, top: barY, width: availW, height: barH, display: "flex", gap }}>
        {place.map((_, i) => {
          const born = enterAt(frame, 6 + i * 9, { fallback: "rise", dur: 14, seed: i });
          const tone = tones[i % tones.length];
          return (
            <div key={i} style={{ flex: 1, minWidth: 0, borderLeft: `${full ? 4 : 2}px solid ${tone}`, background: alpha(t.bg2, 0.5), borderRadius: full ? 14 : 8, paddingTop: full ? 11 : 6, opacity: born.opacity, transform: `translate(${born.dx}px, ${born.dy}px)` }}>
              <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.gears[i].name, colW - (full ? 30 : 12), full ? 30 : 14, 10), color: tone, paddingLeft: full ? 18 : 8, whiteSpace: "nowrap", lineHeight: 1.1 }}>{data.gears[i].name}</div>
              <div style={{ fontFamily: t.font.mono, fontSize: full ? 20 : 11, color: t.dim, paddingLeft: full ? 18 : 8, marginTop: full ? 4 : 2, whiteSpace: "nowrap" }}>
                {N[i]}齿 {fmtNum(rpmOf(i), 2)}圈/分
              </div>
            </div>
          );
        })}
      </div>

      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {/* 读数条 → 齿轮的引线，只在两者离得远、不点自明的时候画 */}
        {place.map((p, i) => {
          const born = enterAt(frame, 6 + i * 9, { fallback: "assemble", dur: 16, seed: i * 7 + 3 });
          const cx = pad + i * (colW + gap) + colW / 2;
          const ty = p.y - p.r;
          if (born.p < 0.9 || Math.abs(cx - p.x) < 60 || ty - (barY + barH) < 26) return null;
          return <line key={`l${i}`} x1={cx} y1={barY + barH} x2={p.x} y2={ty} stroke={alpha(tones[i % tones.length], 0.35)} strokeWidth={full ? 2 : 1} strokeDasharray="6 10" />;
        })}
        {place.map((p, i) => {
          const born = enterAt(frame, 6 + i * 9, { fallback: "assemble", dur: 16, seed: i * 7 + 3 });
          if (born.p <= 0) return null;
          const rt = p.r;
          const rr = p.r * 0.86;
          return (
            <g key={i} transform={`translate(${p.x},${p.y}) rotate(${rot(i)}) scale(${born.scale})`} opacity={born.opacity}>
              <path d={gearPath(N[i], rt, rr)} fill={alpha(t.bg2, 0.9)} stroke={tones[i % tones.length]} strokeWidth={full ? 3 : 2} />
              <circle r={rt * 0.3} fill="none" stroke={alpha(tones[i % tones.length], 0.5)} strokeWidth={full ? 3 : 2} />
              <circle r={rt * 0.08} fill={tones[i % tones.length]} />
              {[0, 1, 2, 3].map((a) => (
                <line key={a} x1={Math.cos((a * Math.PI) / 2) * rt * 0.3} y1={Math.sin((a * Math.PI) / 2) * rt * 0.3} x2={Math.cos((a * Math.PI) / 2) * rt * 0.8} y2={Math.sin((a * Math.PI) / 2) * rt * 0.8} stroke={alpha(tones[i % tones.length], 0.35)} strokeWidth={full ? 5 : 3} />
              ))}
            </g>
          );
        })}
        {/* 摆轮 + 游丝：只有写成擒纵（beat）时才有，它才是「走一下停一下」的那个原因 */}
        {data.beat &&
          (() => {
            const bx = place[n - 1].x;
            const R = Math.min(place[n - 1].r * 0.9, full ? 92 : 44);
            // 挂在末级下方，但不许掉进字幕带
            const by = Math.min(place[n - 1].y + place[n - 1].r + (full ? 128 : 58), chainBottom - R - 4);
            const sw = ((200 * Math.sin(2 * Math.PI * data.beat * s)) * Math.PI) / 180;
            const spiral = Array.from({ length: 120 }, (_, j) => {
              const u = j / 119;
              const rr = R * (0.32 + 0.68 * u);
              const aa = u * Math.PI * 2 * 5 + sw * (1 - u);
              return `${(Math.cos(aa) * rr).toFixed(1)},${(Math.sin(aa) * rr).toFixed(1)}`;
            }).join(" ");
            return (
              <g transform={`translate(${bx},${by})`} opacity={clamp((frame - 20) / 14)}>
                <circle r={R} fill="none" stroke={alpha(t.gold, 0.5)} strokeWidth={full ? 4 : 2} />
                <line x1={-R} y1={0} x2={R} y2={0} stroke={alpha(t.gold, 0.5)} strokeWidth={full ? 4 : 2} transform={`rotate(${(sw * 180) / Math.PI})`} />
                <polyline points={spiral} fill="none" stroke={alpha(t.primary, 0.7)} strokeWidth={full ? 2.5 : 1.5} />
              </g>
            );
          })()}
      </svg>

      {data.verdict && (
        <div style={{ position: "absolute", left: verdictBox.left, right: verdictRight ? undefined : 0, top: verdictBox.top, width: verdictBox.width, textAlign: verdictRight ? "left" : "center", bottom: verdictRight ? undefined : full ? 104 : 24, opacity: eVerdict.opacity, transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`, clipPath: eVerdict.clip }}>
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, verdictRight ? verdictBox.width : width * 0.8, full ? 60 : 24, 14), color: t.accent, lineHeight: 1.25, display: "inline-block" }}>{data.verdict}</span>
        </div>
      )}

      {data.beat ? (
        <Sfx name="tick" at={Math.round((1 / data.beat) * fps)} volume={0.2} />
      ) : (
        <Sfx name="riser" at={8} volume={0.2} />
      )}
      {data.verdict && <Sfx name="stamp" at={Math.round(dur * 0.86)} volume={0.4} />}
    </>
  );
};

const prog0 = (f: number, from = 0) => clamp((f - from) / 14);

export const GearTrain: CompDef<D> = {
  id: "gear-train",
  name: "齿比咬合（每一级转多快是算出来的）",
  layer: "metaphor",
  variants: 1,
  minSec: 5,
  maxSec: 14,
  tags: ["传动", "环环相扣", "机制", "链条", "放大", "逐级", "牵一发动全身", "精密"],
  motion: { kind: "齿轮按齿数比反向递推转动、齿缝互相咬合（相位对齐），写 beat 时变成每拍走半齿再锁死的间歇运动 + 摆轮游丝往复", energy: 2 },
  desc: "2~5 级齿轮从左到右沿一条略上下交替的链排开，每片按「齿数=半径」画真齿形，**相邻两轮齿缝互锁**（相位对齐公式），转速由齿数比 k[i] = −N[i+1]/N[i]·k[i+1] 递推出来，方向自动交替；顶部一条等分读数条标着每级的名字、齿数和**实时圈数**，离得远的用虚线引回自己那片轮。给了 beat 就不是匀速转，而是走半齿、锁死、再走半齿（擒纵），末级下方多一个来回摆的摆轮和螺旋游丝；链条扁平时右侧会留出一块空白，结论条就立在那儿",
  use: "讲环环相扣、逐级放大的机制：内容→推荐→粉丝怎么一级级咬合传动、一个环节错半齿整条线全偏、把小额放大成大额要过几级、模型的参数怎么一级级传下去、上下游互相牵制。**teeth 要写真想对比的数**（36 齿对 12 齿就是 3 倍），别为了好看乱填。beat 用来表达「它不是连贯的，是一卡一卡的」：审批、结账、发薪日、一天只走一步",
  schema,
  example: {
    kicker: "为什么慢",
    title: "这条链要过四道工序",
    gears: [{ name: "选题", teeth: 72 }, { name: "写稿", teeth: 48 }, { name: "录制", teeth: 28 }, { name: "剪辑", teeth: 12 }],
    beat: 2.5,
    verdict: "末级慢，是前面每一级传的",
  },
  C,
};
