import React from "react";
import { z } from "zod";
import { clamp, E, fitSize, mix, shake, useClock } from "./kit/core";
import { Flash, LightLeak, Ring, Sparks } from "./kit/fx";
import { rgba } from "./kit/look";
import { Sfx } from "./kit/sfx";
import { Backdrop, common, PersonMedia, PRO_FONT, ProRoot } from "./kit/stage";
import { Big, gradientInk } from "./kit/type";
import type { ProOpening } from "./types";

// ═══ PRO-03 光圈片名 · Iris Title ═══════════════════════════════════════
// 第 3 招「蒙版缩圈 + 开篇主题」的电影片头版：
//   0.0s  画面被机械光圈（六片叶片）包住，叶片一格一格咔哒收紧，强制聚焦到人脸
//   …     光圈外围是带刻度的 HUD 圈，转动、读数跳动（f/1.4 → f/16）
//   lock  收到最小时「咔」锁定 → 闪光，光圈外侧亮起一圈，片名从光圈两侧展开（字距从大到正常）
//   …     副标题 + 期数 / 系列名补位；最后光圈猛地打开、片名放大淡出（交给正片）
// 适合：主题揭示 / 系列片头 / 任何要 1 秒说清“这条讲什么”的开场

const schema = z
  .object({
    ...common("ice"),
    title: z.string().default("AI 四步法").describe("片名 / 主题（光圈锁定后展开）"),
    sub: z.string().default("20 分钟做出你的第一个小软件").describe("副标题"),
    tag: z.string().default("EP.01").describe("左上角期数 / 系列名（可留空）"),
    lockAt: z.number().default(1.3).describe("光圈锁定 + 片名出现的时刻（秒）"),
    steps: z.number().int().default(4).describe("光圈分几格咔哒收紧（2~6）"),
    irisMin: z.number().default(0.3).describe("光圈收到最小时的半径（相对短边，0.2~0.45）"),
    openAt: z.number().optional().describe("光圈重新打开的时刻（秒，缺省 = 结束前 0.5s）"),
  })
  .prefault({});
type D = z.infer<typeof schema>;

// 六片叶片光圈：每片是一个大四边形，绕中心排列；开口半径 r
const Blades: React.FC<{ cx: number; cy: number; r: number; rot: number; R: number; color: string; edge: string; u: number }> = ({ cx, cy, r, rot, R, color, edge, u }) => {
  const n = 6;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rot;
    // 叶片内边缘是开口六边形的一条边（略微旋转 → 看起来像真光圈）
    const a0 = a - Math.PI / n;
    const a1 = a + Math.PI / n;
    const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r];
    const p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
    const p2 = [cx + Math.cos(a1 + 0.5) * R, cy + Math.sin(a1 + 0.5) * R];
    const p3 = [cx + Math.cos(a0 - 0.2) * R, cy + Math.sin(a0 - 0.2) * R];
    out.push(<polygon key={i} points={[p0, p1, p2, p3].map((q) => q.join(",")).join(" ")} fill={color} stroke={edge} strokeWidth={2 * u} />);
    // 叶片内刃的高光（开口边缘那条亮线）
    if (edge !== "none") out.push(<line key={`h${i}`} x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke={rgba("#ffffff", 0.55)} strokeWidth={2.5 * u} />);
  }
  return <>{out}</>;
};

const C: React.FC<{ data: D; duration?: number }> = ({ data: d, duration }) => {
  const { t, dur, W, H, u, p } = useClock(duration);
  const Lk = d.lockAt;
  const openAt = d.openAt ?? dur - 0.5;
  return (
    <ProRoot d={d}>
      {(L) => {
        const fx = (d.person?.focusX ?? 0.5) * W;
        const fy = (d.person?.focusY ?? 0.42) * H;
        // 光圈中心 = 人脸（focusX/Y 指的是原画面里人脸的位置）；纯图形时偏上一点给片名留位置
        const cx = d.person ? fx : W / 2;
        const cy = d.person ? fy : H * 0.38;
        const Rfull = Math.hypot(W, H) * 0.75;
        const rMin = d.irisMin * Math.min(W, H);
        // 收紧：分 steps 格，每格先快后停（机械感），最后一格在 lockAt 落定
        const n = Math.max(2, Math.min(6, d.steps));
        const stepAts = Array.from({ length: n }, (_, i) => 0.12 + ((Lk - 0.12) * i) / (n - 1 || 1)).map((x, i, a) => (i === a.length - 1 ? Lk : x));
        let close = 0;
        stepAts.forEach((a, i) => (close += E.out5(clamp((t - a) / 0.14)) / n));
        const rIris = mix(Rfull * 0.62, rMin, close);
        // 打开：猛地张开到全屏
        const open = E.expoIn(clamp((t - openAt) / 0.45));
        const r = mix(rIris, Rfull, open);
        const rot = -close * 0.9 + open * 0.6;
        const sh = shake(t, [{ at: Lk, amp: 14 * u, len: 0.3 }, ...stepAts.slice(0, -1).map((a) => ({ at: a, amp: 4 * u, len: 0.12 }))], 6);
        // 镜头：随光圈收紧推近
        const zoom = 1 + 0.1 * close + 0.12 * E.out(p(Lk, dur - Lk)) + 0.08 * open;
        // 光圈读数
        const fstops = ["1.4", "2.8", "5.6", "8", "11", "16"];
        const fi = Math.min(fstops.length - 1, Math.round(close * (fstops.length - 1)));
        const titleK = E.out5(p(Lk, 0.55));
        const ts = fitSize(d.title, W * 0.8, 190 * u);
        const subK = E.out(p(Lk + 0.35, 0.45));
        const hudOn = (1 - open) * E.out(p(0, 0.3));
        // 片名的位置：光圈下方（不挡脸）
        const blockH = ts * 1.1 + (d.sub ? 44 * u * 1.4 + 30 * u : 0) + 16 * u;
        const titleY = Math.min(H - blockH - 50 * u, cy + rMin + 34 * u);
        return (
          <>
            <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
              {d.person ? <PersonMedia person={d.person} cam={{ zoom, filter: `contrast(1.08) saturate(${1 - 0.25 * close * (1 - open)})` }} /> : <Backdrop look={L} t={t} />}
            </div>
            {/* 光圈叶片 */}
            <svg width={W} height={H} style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
              <defs>
                {/* 拉丝金属：线性渐变 + 细纹 */}
                <linearGradient id="pro3blade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#2a2f36" />
                  <stop offset="0.45" stopColor="#0c0f13" />
                  <stop offset="0.55" stopColor="#1b2028" />
                  <stop offset="1" stopColor="#050608" />
                </linearGradient>
                <pattern id="pro3brush" width={6 * u} height={6 * u} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                  <line x1="0" y1="0" x2="0" y2={6 * u} stroke={rgba("#ffffff", 0.05)} strokeWidth={1.2 * u} />
                </pattern>
                <radialGradient id="pro3sheen" cx={cx} cy={cy} r={Rfull * 0.7} gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor={rgba(L.key, 0.0)} />
                  <stop offset={Math.min(0.95, (r / (Rfull * 0.7)) * 1.02)} stopColor={rgba(L.key, 0.0)} />
                  <stop offset={Math.min(0.97, (r / (Rfull * 0.7)) * 1.08)} stopColor={rgba(L.key, 0.35)} />
                  <stop offset={Math.min(0.99, (r / (Rfull * 0.7)) * 1.45)} stopColor={rgba(L.key, 0.0)} />
                </radialGradient>
              </defs>
              <Blades cx={cx} cy={cy} r={r} rot={rot} R={Rfull * 1.4} color={"url(#pro3blade)"} edge={rgba("#9fb3c8", 0.55)} u={u} />
              <Blades cx={cx} cy={cy} r={r} rot={rot} R={Rfull * 1.4} color={"url(#pro3brush)"} edge="none" u={u} />
              {/* 开口附近叶片被内部光照亮 */}
              <circle cx={cx} cy={cy} r={Rfull * 0.7} fill="url(#pro3sheen)" />
              {/* 开口内沿发光 */}
              <circle cx={cx} cy={cy} r={r * 1.02} fill="none" stroke={rgba(L.key, 0.5 + 0.5 * E.out(p(Lk, 0.2)) * (1 - E.out(p(Lk + 0.2, 0.6))))} strokeWidth={(2 + 8 * E.out(p(Lk, 0.1)) * (1 - E.out(p(Lk + 0.1, 0.5)))) * u} style={{ filter: `drop-shadow(0 0 ${12 * u}px ${L.key})` }} />
            </svg>
            {/* HUD 刻度圈 */}
            <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: hudOn }}>
              <g transform={`translate(${cx},${cy}) rotate(${t * 18 - close * 60})`}>
                {Array.from({ length: 72 }, (_, i) => {
                  const a = (i / 72) * Math.PI * 2;
                  const big = i % 6 === 0;
                  const rr = r + 26 * u;
                  return <line key={i} x1={Math.cos(a) * rr} y1={Math.sin(a) * rr} x2={Math.cos(a) * (rr + (big ? 22 : 10) * u)} y2={Math.sin(a) * (rr + (big ? 22 : 10) * u)} stroke={rgba(L.key, big ? 0.9 : 0.4)} strokeWidth={(big ? 2.5 : 1.2) * u} />;
                })}
              </g>
              <g transform={`translate(${cx},${cy}) rotate(${-t * 10})`}>
                <circle r={r + 64 * u} fill="none" stroke={rgba(L.key, 0.25)} strokeWidth={1.2 * u} strokeDasharray={`${40 * u} ${18 * u}`} />
              </g>
            </svg>
            {/* 读数 */}
            <div style={{ position: "absolute", left: cx + r * 0.72 + 70 * u, top: cy - r * 0.72 - 20 * u, opacity: hudOn, fontFamily: '"Cascadia Code",Consolas,monospace', color: L.key, fontSize: 26 * u, lineHeight: 1.5, textShadow: `0 0 12px ${L.key}` }}>
              <div style={{ fontSize: 44 * u, fontWeight: 700 }}>f/{fstops[fi]}</div>
              <div style={{ opacity: 0.7 }}>FOCUS {t >= Lk ? "LOCK" : "···"}</div>
            </div>
            {d.tag && (
              <div style={{ position: "absolute", left: 70 * u, top: 60 * u, display: "flex", alignItems: "center", gap: 14 * u, opacity: E.out(p(0.1, 0.4)) * (1 - open), fontFamily: PRO_FONT, fontWeight: 800, fontSize: 30 * u, letterSpacing: "0.25em", color: L.ink }}>
                <span style={{ width: 14 * u, height: 14 * u, borderRadius: 7 * u, background: L.danger, boxShadow: `0 0 12px ${L.danger}`, opacity: Math.floor(t * 3) % 2 ? 1 : 0.35 }} />
                {d.tag}
              </div>
            )}

            {/* 片名：从光圈中线向两边展开（字距收拢）*/}
            {t >= Lk && (
              <div style={{ position: "absolute", left: 0, right: 0, top: titleY, display: "flex", flexDirection: "column", alignItems: "center", opacity: 1 - E.out(p(openAt, 0.35)), transform: `scale(${1 + 0.25 * E.in(p(openAt, 0.45))})` }}>
                <div style={{ position: "relative", clipPath: `inset(-20% ${(1 - titleK) * 50}% -20% ${(1 - titleK) * 50}%)` }}>
                  <Big text={d.title} size={ts} tracking={mix(0.6, 0.06, titleK)} style={{ ...gradientInk("#ffffff", L.key, 180), filter: `drop-shadow(0 ${6 * u}px 0 ${rgba("#000", 0.85)}) drop-shadow(0 0 ${30 * u}px ${rgba(L.key, 0.7)})` }} />
                </div>
                {/* 片名下的光线 */}
                <div style={{ marginTop: 10 * u, height: 3 * u, width: W * 0.5 * titleK, background: `linear-gradient(90deg, transparent, ${L.key}, transparent)`, boxShadow: `0 0 20px ${L.key}` }} />
                {d.sub && <div style={{ marginTop: 18 * u, fontFamily: PRO_FONT, fontWeight: 700, fontSize: 44 * u, color: L.ink, letterSpacing: "0.14em", opacity: subK, transform: `translateY(${(1 - subK) * 16 * u}px)`, textShadow: "0 3px 14px rgba(0,0,0,.95)" }}>{d.sub}</div>}
              </div>
            )}

            {/* 首帧红线：闪白从 0.55 压到 0.3 —— 第 0 帧必须看得清画面，不能是一片白 */}
            <Flash t={t} at={0} len={0.18} peak={0.3} />
            <Flash t={t} at={Lk} len={0.3} peak={0.55} color={L.key} />
            <Ring t={t} at={Lk} x={cx} y={cy} color={L.key} r={rMin * 2.6} w={8 * u} len={0.6} />
            <Sparks t={t} at={Lk} x={cx} y={cy + rMin} color={L.key} n={34} speed={900 * u} len={0.8} gravity={700 * u} size={u} seed={3} />
            <LightLeak t={t} at={openAt - 0.1} len={0.9} color={L.key} color2={L.accent} W={W} H={H} strength={0.55} from="right" />

            <Sfx name="boom" at={0} vol={0.45} />
            {stepAts.map((a, i) => (
              <Sfx key={i} name={i === stepAts.length - 1 ? "shutter" : "click"} at={a} vol={i === stepAts.length - 1 ? 0.75 : 0.55} />
            ))}
            <Sfx name="boom" at={Lk} vol={0.65} />
            <Sfx name="ding" at={Lk + 0.06} vol={0.5} />
            <Sfx name="shimmer" at={Lk + 0.1} vol={0.3} />
            <Sfx name="whip" at={openAt} vol={0.5} />
          </>
        );
      }}
    </ProRoot>
  );
};

export const P03IrisTitle: ProOpening<D> = {
  id: "pro-03-iris-title",
  name: "PRO 03 · 光圈片名",
  trick: "第3招 蒙版缩圈 + 开篇主题",
  hook: "主题揭示 / 系列片头",
  desc: "六片金属叶片的机械光圈把画面包住，一格一格咔哒收紧、聚焦到人脸，外围 HUD 刻度圈转动、读数 f/1.4→f/16；锁定瞬间闪光 + 咚 + 叮，片名从中线向两侧展开（字距收拢）、副标题补位；最后光圈猛地张开交给正片",
  use: "任何需要 1 秒说清“这条讲什么”的开场：系列片头、教程主题、观点主题；“今天教你…”“XX 四步法”",
  defaultSec: 3.4,
  schema,
  example: {},
  C,
};
