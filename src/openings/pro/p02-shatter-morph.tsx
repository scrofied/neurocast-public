import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, E, fitSize, h1, mix, noise, shake, useClock } from "./kit/core";
import { Flash, Ring, Sparks, SpeedLines } from "./kit/fx";
import { rgba } from "./kit/look";
import { Sfx } from "./kit/sfx";
import { Backdrop, common, PersonMedia, PRO_FONT, ProRoot } from "./kit/stage";
import { Big, Chars, gradientInk } from "./kit/type";
import type { ProOpening } from "./types";

// ═══ PRO-02 碎屏突变 · Shatter Morph ════════════════════════════════════
// 第 2 招「出其不意 + 按节奏变形」：画面形态突变打破预期，变形卡在语音节奏上。
//   0.0s  闪白 + 砸字：第一句（大家以为的说法）在画面下方
//   crack 说到转折词的那一刻：画面出现裂纹 + 玻璃声 + 定格
//   shatter 整个画面碎成几十块玻璃，沿各自方向飞散、翻转、带着画面内容
//   morph 碎片在空中重组成「倾斜的竖条分屏」（形态变了），中间一道强光缝
//   punch 第二句（真相/反转）砸在光缝上，冲击环 + 火花
// 适合：反常识型 / 转折型：“都说 A，其实 B”“这不是 X，这是 Y”

const schema = z
  .object({
    ...common("acid"),
    line1: z.string().default("你以为这是教程").describe("第一句：大家以为的（转折前）"),
    line2: z.string().default("其实是印钞机").describe("第二句：真相 / 反转（碎屏后砸出）"),
    hl: z.string().default("印钞机").describe("第二句里要发光的词"),
    crackAt: z.number().default(1.0).describe("裂开时刻（秒）—— 卡在转折词上，如“其实”"),
    punchAt: z.number().default(1.75).describe("第二句砸出时刻（秒）"),
    tilt: z.number().default(-8).describe("重组后分屏的倾斜角度"),
  })
  .prefault({});
type D = z.infer<typeof schema>;

// Voronoi-ish 碎片：用三角网格 + 抖动顶点，按到裂心距离决定飞出顺序
type Shard = { pts: [number, number][]; cx: number; cy: number; d: number; i: number };
const buildShards = (W: number, H: number, ox: number, oy: number, seed: number): Shard[] => {
  const cols = 7;
  const rows = 5;
  const P: [number, number][][] = [];
  for (let r = 0; r <= rows; r++) {
    P.push([]);
    for (let c = 0; c <= cols; c++) {
      const edgeX = c === 0 || c === cols;
      const edgeY = r === 0 || r === rows;
      const jx = edgeX ? 0 : (h1(r * 31 + c, seed) - 0.5) * (W / cols) * 0.8;
      const jy = edgeY ? 0 : (h1(r * 17 + c * 7, seed + 1) - 0.5) * (H / rows) * 0.8;
      P[r].push([(c / cols) * W + jx, (r / rows) * H + jy]);
    }
  }
  const out: Shard[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const a = P[r][c];
      const b = P[r][c + 1];
      const cc = P[r + 1][c + 1];
      const dd = P[r + 1][c];
      const tris: [number, number][][] = h1(r * 9 + c, seed + 2) > 0.5 ? [[a, b, cc], [a, cc, dd]] : [[a, b, dd], [b, cc, dd]];
      for (const tri of tris) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        out.push({ pts: tri, cx, cy, d: Math.hypot(cx - ox, cy - oy), i: out.length });
      }
    }
  return out;
};

const C: React.FC<{ data: D; duration?: number }> = ({ data: d, duration }) => {
  const { t, dur, W, H, u, p } = useClock(duration);
  const A = d.crackAt;
  const B = d.punchAt;
  const ox = W * 0.5;
  const oy = H * 0.46;
  const shards = useMemo(() => buildShards(W, H, ox, oy, 7), [W, H, ox, oy]);
  const maxD = Math.hypot(W, H) * 0.6;
  return (
    <ProRoot d={d}>
      {(L) => {
        const exit = E.in(p(dur - 0.4, 0.4));
        const sh = shake(t, [{ at: 0, amp: 12 * u, len: 0.3 }, { at: A, amp: 22 * u, len: 0.35 }, { at: B, amp: 30 * u, len: 0.5 }], 2);
        // 0→A 正常；A 定格 + 裂纹；A+0.12 开始碎飞；B-0.25 起碎片重组成分屏
        const fly = clamp((t - A - 0.12) / Math.max(0.2, B - A - 0.12)); // 0..1
        const settle = E.out5(clamp((t - (B - 0.28)) / 0.32)); // 碎片回到分屏位置
        const shattered = t >= A + 0.12;
        const frozen = t >= A;
        const zoomIn = 1 + 0.06 * E.out(p(0, A));
        const media = (cam?: any) => (d.person ? <PersonMedia person={d.person} cam={{ zoom: zoomIn, ...cam }} freeze={frozen ? A : undefined} /> : <Backdrop look={L} t={Math.min(t, A)} />);
        const s1 = fitSize(d.line1, W * 0.8, 110 * u);
        const s2 = fitSize(d.line2, W * 0.86, 170 * u);
        const hlI = d.line2.indexOf(d.hl);
        const hlR: [number, number] | undefined = hlI >= 0 ? [Array.from(d.line2.slice(0, hlI)).length, Array.from(d.line2.slice(0, hlI)).length + Array.from(d.hl).length] : undefined;
        // 分屏：三条倾斜的竖条，各自显示画面的一部分（重组后的新形态）
        const strips = [
          { x0: 0.0, x1: 0.36 },
          { x0: 0.36, x1: 0.66 },
          { x0: 0.66, x1: 1.0 },
        ];
        const tilt = d.tilt;
        return (
          <>
            {/* 1. 碎之前：整幅画面 */}
            {!shattered && (
              <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px) rotate(${sh.r}deg)` }}>
                {media()}
              </div>
            )}
            {/* 1b. 裂纹（定格后 0.12s 内长出来） */}
            {frozen && !shattered && (
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                {shards.map((s, i) => {
                  const k = clamp((t - A) / 0.1 - s.d / maxD);
                  if (k <= 0) return null;
                  return <polygon key={i} points={s.pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={rgba("#ffffff", 0.85 * k)} strokeWidth={1.4 * u} />;
                })}
                <circle cx={ox} cy={oy} r={60 * u * E.out(p(A, 0.1))} fill={rgba("#fff", 0.35)} />
              </svg>
            )}

            {/* 2. 碎片：每片 clip 出画面的那一块，飞散 → 重组 */}
            {shattered && settle < 1 && (
              <div style={{ position: "absolute", inset: 0, opacity: 1 - settle }}>
                {shards.map((s) => {
                  const r1 = h1(s.i, 11);
                  const r2 = h1(s.i, 12);
                  const r3 = h1(s.i, 13);
                  const dirX = (s.cx - ox) / Math.max(1, s.d);
                  const dirY = (s.cy - oy) / Math.max(1, s.d);
                  const delay = (s.d / maxD) * 0.12;
                  const f = E.out(clamp((fly - delay) / (1 - delay)));
                  const dist = (180 + r1 * 520) * u * f;
                  const tx = dirX * dist + (r2 - 0.5) * 120 * u * f;
                  const ty = dirY * dist + (r3 - 0.5) * 120 * u * f + 160 * u * f * f;
                  const rz = (r1 - 0.5) * 140 * f;
                  const rx = (r2 - 0.5) * 120 * f;
                  const ry = (r3 - 0.5) * 120 * f;
                  const sc = 1 - 0.25 * f;
                  const poly = `polygon(${s.pts.map((q) => `${q[0]}px ${q[1]}px`).join(",")})`;
                  return (
                    <div key={s.i} style={{ position: "absolute", inset: 0, clipPath: poly, transformOrigin: `${s.cx}px ${s.cy}px`, transform: `perspective(${1400 * u}px) translate(${tx}px, ${ty}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`, filter: `brightness(${1 + 0.6 * Math.abs(Math.sin(rz * 0.05)) * f})` }}>
                      {media()}
                      {/* 玻璃边缘高光 */}
                      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                        <polygon points={s.pts.map((q) => q.join(",")).join(" ")} fill={rgba("#ffffff", 0.08 * f)} stroke={rgba("#ffffff", 0.9)} strokeWidth={2.5 * u} />
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. 重组：倾斜竖条分屏 */}
            {t >= B - 0.28 && (
              <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px) scale(${1 + exit * 0.08})`, opacity: 1 - exit }}>
                <div style={{ position: "absolute", inset: 0, background: L.bg }} />
                {strips.map((st, i) => {
                  const k = E.out5(clamp((t - (B - 0.28) - i * 0.06) / 0.34));
                  // 两边从下往上、中间从上往下滑入（错位感）
                  const yIn = (1 - k) * (i === 1 ? -1 : 1) * H * 1.1;
                  const gap = 10 * u;
                  const x0 = st.x0 * W + (i > 0 ? gap : 0);
                  const x1 = st.x1 * W - (i < 2 ? gap : 0);
                  const skew = Math.tan((tilt * Math.PI) / 180) * H;
                  // 多画一截，保证斜边在上下都盖满
                  const clip = `polygon(${x0 + skew * 0.6}px ${-H * 0.1}px, ${x1 + skew * 0.6}px ${-H * 0.1}px, ${x1 - skew * 0.6}px ${H * 1.1}px, ${x0 - skew * 0.6}px ${H * 1.1}px)`;
                  // 三条画面各不相同：左 = 冷灰远景，中 = 人脸特写，右 = 高饱和偏色
                  const camI = [
                    { zoom: zoomIn * 1.0, x: -W * 0.06, filter: "grayscale(0.85) brightness(0.62) contrast(1.2)" },
                    { zoom: zoomIn * 1.55 + 0.05 * E.out(p(B, dur - B)), filter: "contrast(1.08) saturate(1.1)" },
                    { zoom: zoomIn * 1.15, x: W * 0.08, filter: "saturate(1.5) brightness(1.05) hue-rotate(-8deg)" },
                  ][i];
                  return (
                    <div key={i} style={{ position: "absolute", inset: 0, clipPath: clip, transform: `translateY(${yIn}px)` }}>
                      {media(camI)}
                      {i === 0 && <div style={{ position: "absolute", inset: 0, background: rgba(L.bg, 0.35) }} />}
                      {i === 2 && <div style={{ position: "absolute", inset: 0, background: rgba(L.accent, 0.22), mixBlendMode: "color" }} />}
                    </div>
                  );
                })}
                {/* 竖条之间的光缝 */}
                {[0.36, 0.66].map((x, i) => {
                  const skew = Math.tan((tilt * Math.PI) / 180) * H;
                  const k = E.out(p(B - 0.1 + i * 0.05, 0.3));
                  return (
                    <svg key={i} width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
                      <line x1={x * W + skew / 2} y1={0} x2={x * W - skew / 2} y2={H} stroke={L.accent} strokeWidth={6 * u * k} opacity={k} />
                      <line x1={x * W + skew / 2} y1={0} x2={x * W - skew / 2} y2={H} stroke={rgba(L.accent, 0.5)} strokeWidth={40 * u * k} opacity={k * 0.5} style={{ filter: `blur(${14 * u}px)` }} />
                    </svg>
                  );
                })}
              </div>
            )}

            {/* 第一句：底部砸字（第 0 帧可见），裂开时跟着碎掉 */}
            {!shattered && (
              <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.7, display: "flex", justifyContent: "center", transform: `translate(${sh.x}px, ${sh.y}px)` }}>
                <div style={{ position: "relative", padding: `${10 * u}px ${36 * u}px`, transform: `scale(${mix(1.25, 1, E.out5(p(0, 0.18)))}) rotate(${frozen ? noise(t * 50, 3) * 2 : 0}deg)` }}>
                  <div style={{ position: "absolute", inset: 0, background: rgba("#000", 0.72), transform: "skewX(-10deg)" }} />
                  <Big text={d.line1} size={s1} color={L.ink} style={{ position: "relative" }} />
                  {/* 转折前一瞬，划掉第一句 */}
                  <div style={{ position: "absolute", left: "2%", top: "52%", height: 10 * u, width: `${96 * E.out(p(A - 0.02, 0.1))}%`, background: L.danger, boxShadow: `0 0 20px ${L.danger}`, transform: "rotate(-3deg)", transformOrigin: "left" }} />
                </div>
              </div>
            )}

            {/* 第二句：砸在中间光缝上 */}
            {t >= B && (
              <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.64, display: "flex", justifyContent: "center", opacity: 1 - exit, transform: `rotate(${tilt * 0.4}deg)` }}>
                <div style={{ position: "relative", padding: `${14 * u}px ${54 * u}px`, transform: `scale(${mix(2.2, 1, E.out5(p(B, 0.2)))})`, filter: `blur(${(1 - E.out(p(B, 0.15))) * 14}px)` }}>
                  <div style={{ position: "absolute", inset: 0, background: L.bg, transform: "skewX(-12deg)", boxShadow: `0 0 0 ${4 * u}px ${L.accent}, 0 0 ${60 * u}px ${rgba(L.accent, 0.6)}` }} />
                  <div style={{ position: "absolute", left: -18 * u, top: -18 * u, bottom: -18 * u, width: 14 * u, background: L.accent, transform: "skewX(-12deg)", boxShadow: `0 0 30px ${L.accent}` }} />
                  <div style={{ position: "relative" }}>
                    <Chars text={d.line2} t={t} at={B} per={0.0} len={0.2} anim="pop" size={s2} color={L.ink} hl={hlR} hlColor={L.accent} hlGlow={rgba(L.accent, 0.9)} glowR={30 * u} />
                  </div>
                  {/* 高亮词扫光 */}
                  {hlR && <div style={{ position: "absolute", inset: 0, ...gradientInk("transparent", "transparent"), background: `linear-gradient(110deg, transparent ${E.inOut(p(B + 0.2, 0.6)) * 160 - 40}%, ${rgba("#fff", 0.5)} ${E.inOut(p(B + 0.2, 0.6)) * 160 - 28}%, transparent ${E.inOut(p(B + 0.2, 0.6)) * 160 - 16}%)`, mixBlendMode: "overlay" }} />}
                </div>
              </div>
            )}

            {/* 首帧红线：闪白从 0.7 压到 0.3 —— 第 0 帧必须看得清画面，不能是一片白 */}
            <Flash t={t} at={0} len={0.18} peak={0.3} />
            <Flash t={t} at={A} len={0.12} peak={0.6} />
            <Flash t={t} at={B} len={0.28} peak={0.85} color={L.accent} />
            <SpeedLines t={t} at={B} x={W / 2} y={H * 0.64 + s2 * 0.5} color={rgba(L.ink, 0.85)} W={W} inner={s2 * 2.2} />
            <Ring t={t} at={B} x={W / 2} y={H * 0.64 + s2 * 0.5} color={L.accent} r={W * 0.5} w={10 * u} />
            <Sparks t={t} at={A + 0.1} x={ox} y={oy} color="#ffffff" n={70} speed={1800 * u} len={0.9} gravity={1600 * u} size={u} seed={5} />
            <Sparks t={t} at={B} x={W / 2} y={H / 2} color={L.accent} n={40} speed={1200 * u} len={0.8} size={u} seed={8} />

            <Sfx name="slam" at={0} vol={0.55} />
            <Sfx name="boom" at={0} vol={0.35} />
            <Sfx name="click" at={A - 0.02} vol={0.6} />
            <Sfx name="glass" at={A + 0.08} vol={0.75} />
            <Sfx name="whip" at={A + 0.15} vol={0.5} />
            <Sfx name="swell" at={Math.max(0, B - 1.6)} vol={0.3} />
            <Sfx name="whip" at={B - 0.28} vol={0.45} />
            <Sfx name="boom" at={B} vol={0.85} />
            <Sfx name="slam" at={B} vol={0.55} />
            <Sfx name="ding" at={B + 0.12} vol={0.35} />
          </>
        );
      }}
    </ProRoot>
  );
};

export const P02ShatterMorph: ProOpening<D> = {
  id: "pro-02-shatter-morph",
  name: "PRO 02 · 碎屏突变",
  trick: "第2招 出其不意 + 按节奏变形",
  hook: "反常识 / 转折",
  desc: "第一句砸在画面下方；说到转折词时画面定格出裂纹、玻璃碎成几十块带着画面翻飞；碎片在空中重组成倾斜的三竖条分屏（左冷右热、中间光缝），第二句（真相）砸在光缝上 + 冲击环 + 火花",
  use: "“你以为…其实…”“这不是 A，这是 B”“都说努力有用？错”——前后两句意思翻转",
  defaultSec: 3.4,
  schema,
  example: {},
  C,
};
