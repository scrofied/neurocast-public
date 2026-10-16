import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeInOut, lerp } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { harm } from "../../lib/spring";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 出处：opus-5-5-motion-gallery/v18-noise-cancelling / iArt.ai 博客 2026-09-24 https://www.iart.ai/blog/ai-javascript-animation
// 片库整理：小红书 AI伐木工（jinhanbuilds/opus-5-5-motion-gallery）；逐条机制对照见 docs/OPUS55_ANIMATIONS.md 一·c。
// 移植自 opus-5-5-motion-gallery/v18-noise-cancelling。三个机制搬过来了，画幅从 9:16 改成 16:9 的左右分栏：
//   1) **行波**：y = s(t − x/V)，波是往右走的，不是整条一起抖 ⇒ 观众看得见「声音在传」；
//   2) **连续反相**：第二路乘 cos(π·flip)（flip 从 0 走到 1），波形是**原地翻过去**的，
//      而不是「先画一条正的再换一张反的」——这一步是整个讲解的说服力所在；
//   3) **抵消锋面**：求和那一路 = 泄漏 + (x ≤ front ? −泄漏 : 0)，白色合成波随一条锋面从喇叭扫到鼓膜，
//      「抵消也需要时间」被画成了看得见的东西。
// 噪声函数 s(τ) 用三个正弦叠加，周期取整数倍于本片时长 ⇒ 循环时接缝处严丝合缝（harm 就是干这个的）。

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  noise: z.string().max(14).describe("第一路：要被抵消的东西，如「评论里的噪音」"),
  anti: z.string().max(14).describe("第二路：反着来那份，如「AI 的反向回应」"),
  sum: z.string().max(14).describe("第三路：叠出来的结果，如「他实际听到的」"),
  leak: z.number().min(0.1).max(1).optional().describe("被动挡掉的比例（0.45 = 壳子先吃掉一半），默认 0.45"),
  flipAt: z.number().optional().describe("开始反相的时刻（锚点，如「反过来再说一遍」）"),
  frontAt: z.number().optional().describe("抵消锋面出发的时刻（锚点，如「两边正好抵消」）"),
  verdict: z.string().max(18).optional().describe("结论条，如「安静不是没有声音」"),
  limit: z.string().max(26).optional().describe("局限说明（讲到「突发的高频还是漏了」时用）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const D_sec = dur / fps;
  const s = frame / fps;

  const leak = data.leak ?? 0.45;
  const flipAt = cueOr(data.flipAt, Math.round(dur * 0.42));
  const frontAt = cueOr(data.frontAt, Math.round(dur * 0.66));
  const flip = easeInOut(clamp((s - flipAt / fps) / (0.9)));
  const front = lerp(0.02, 1.06, easeInOut(clamp((s - frontAt / fps) / 0.9)));

  // 三路波形共用同一个噪声函数；周期取整数倍于时长 ⇒ 循环无缝
  const noise = (tau: number) =>
    0.62 * Math.sin(harmPhase(tau, D_sec, 28)) + 0.25 * Math.sin(harmPhase(tau, D_sec, 67) + 1.3) + 0.13 * Math.sin(harmPhase(tau, D_sec, 43) + 0.4);
  const V = 0.34; // 波在「一路宽度」里每秒走 0.34 路

  const card = { x: full ? 96 : 14, y: full ? 250 : 92, w: width - (full ? 192 : 28), h: height - (full ? 250 : 92) - 250 };
  const rowH = card.h / 3;
  const labels = [data.noise, data.anti, data.sum];

  const rows = [0, 1, 2].map((r) => {
    const N = full ? 110 : 60;
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const tau = s - (u * card.w) / (V * card.w);
      const base = leak * noise(tau);
      let y: number;
      if (r === 0) y = base;
      else if (r === 1) y = base * Math.cos(Math.PI * flip); // 连续反相：+1 → −1
      else y = u <= front ? base - base : base; // 锋面左边抵消成 0，右边还是泄漏
      const idle = harm(s, D_sec, 2, r) * 0.006;
      pts.push(`${(card.x + u * card.w).toFixed(1)},${(card.y + rowH * (r + 0.5) - y * rowH * 0.42 + idle * rowH).toFixed(1)}`);
    }
    return pts.join(" ");
  });

  const eVerdict = enterAt(frame, Math.round(dur * 0.86), { fallback: "slam", dur: 16 });
  const eLimit = enterAt(frame, Math.round(dur * 0.9), { fallback: "rise", dur: 14 });
  const calm = clamp((front - 0.15) / 0.7);
  const verdictOn = frame >= Math.round(dur * 0.86); // 收束大字一出来，信号链那行小字就让位（同一行会打架）

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}

      {/* 左侧：源头 → 壳 → 耳朵，三个小图标把「谁在响、谁在反着说、谁在听」交代清楚 */}
      {full && !verdictOn && (
        <div style={{ position: "absolute", left: 96, top: card.y + card.h + 22, display: "flex", gap: 30, alignItems: "center", fontFamily: t.font.mono, fontSize: 22, color: t.dim }}>
          <span style={{ color: t.bad }}>● 源头 {data.noise}</span>
          <span>→ 反相 ×{(Math.cos(Math.PI * flip)).toFixed(2)}</span>
          <span style={{ color: calm > 0.8 ? t.primary : t.dim }}>→ 接收端 剩余 {(100 * leak * (1 - calm)).toFixed(0)}%</span>
        </div>
      )}

      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2].map((r) => (
          <g key={r}>
            <rect x={card.x - 20} y={card.y + rowH * r + 8} width={card.w + 40} height={rowH - 16} rx={14} fill={alpha(t.bg2, 0.55)} stroke={alpha(t.line, 0.6)} strokeWidth={1.5} />
            <line x1={card.x} y1={card.y + rowH * (r + 0.5)} x2={card.x + card.w} y2={card.y + rowH * (r + 0.5)} stroke={alpha(t.dim, 0.3)} strokeWidth={1} strokeDasharray="5 9" />
            <polyline points={rows[r]} fill="none" stroke={r === 0 ? t.bad : r === 1 ? t.primary : t.text} strokeWidth={full ? 4 : 2.5} strokeLinejoin="round" strokeOpacity={r === 2 ? 0.55 + 0.45 * clamp(flip) : 0.95} />
          </g>
        ))}
        {/* 抵消锋面：一条竖线把「已经安静」和「还在响」切开 */}
        {frame >= frontAt && (
          <>
            <line x1={card.x + front * card.w} y1={card.y + rowH * 2 + 8} x2={card.x + front * card.w} y2={card.y + rowH * 3 - 8} stroke={t.accent} strokeWidth={3} strokeOpacity={0.85} />
            <circle cx={card.x + front * card.w} cy={card.y + rowH * 2.5} r={9} fill={t.accent} />
          </>
        )}
      </svg>

      {labels.map((lb, r) => (
        <div key={r} style={{ position: "absolute", left: card.x - 12, top: card.y + rowH * r + 14, fontFamily: t.font.body, fontSize: full ? 24 : 14, color: r === 0 ? t.bad : r === 1 ? t.primary : t.text }}>
          {lb}
        </div>
      ))}

      {data.verdict && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: full ? 180 : 190, textAlign: "center", opacity: eVerdict.opacity, transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`, clipPath: eVerdict.clip }}>
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, width * 0.82, full ? 62 : 26, 15), color: t.accent }}>{data.verdict}</span>
        </div>
      )}
      {data.limit && (
        <div style={{ position: "absolute", right: full ? 96 : 14, top: card.y - (full ? 46 : 30), opacity: eLimit.opacity, transform: `translate(${eLimit.dx}px, ${eLimit.dy}px)` }}>
          <span style={{ fontFamily: t.font.mono, fontSize: full ? 22 : 13, color: t.dim, border: `1.5px solid ${alpha(t.dim, 0.5)}`, borderRadius: 999, padding: "6px 16px" }}>{data.limit}</span>
        </div>
      )}

      <Sfx name="bubbles" at={10} volume={0.2} />
      <Sfx name="swish" at={flipAt} volume={0.3} />
      <Sfx name="riser" at={frontAt} volume={0.25} />
      {data.verdict && <Sfx name="ding" at={Math.round(dur * 0.86)} volume={0.35} />}
    </>
  );
};

// 第 mult 个整倍频的相位：mult 取整 ⇒ 播完 D 秒正好回到起点（循环不跳）
const harmPhase = (tau: number, D: number, mult: number) => (2 * Math.PI * Math.round(mult) * tau) / D;

export const WaveCancel: CompDef<D> = {
  id: "wave-cancel",
  name: "反相抵消（两路波叠成一条直线）",
  layer: "metaphor",
  variants: 1,
  minSec: 5,
  maxSec: 14,
  tags: ["抵消", "对冲", "以毒攻毒", "降噪", "互相抵消", "内耗", "负向"],
  motion: { kind: "三路行波随时间右行，第二路按 cos(π·flip) 原地翻相，第三路由抵消锋面从源头扫到末端压成直线", energy: 2 },
  desc: "三条示波器一行：第一路是原噪声（红，行波往右传播），第二路在讲到「反着来」时**原地连续翻转**成正弦的镜像（青，靠 cos(π·flip) 插值而不是换一张图），第三路是叠出来的结果——一条亮色的「抵消锋面」从左边扫到右边，扫过的地方波形被压成一条直线，没扫到的地方还在响。左上角有个「剩余 x%」的实时读数",
  use: "讲两件等量反向的东西互相吃掉：负面评论被官方澄清抵消、两个内耗的团队互相拖平、涨的那部分被跌的那部分抹掉、主动降噪/以毒攻毒/对冲。**flipAt 与 frontAt 一定要挂锚点**，翻转和扫过必须发生在说到那句话的时刻。limit 用来交代「突发的高频还是漏了」（原片就是用处理延迟讲局限的）",
  schema,
  example: {
    kicker: "降噪是怎么做到的",
    title: "它没有关掉声音",
    noise: "外面的噪音",
    anti: "耳机反着放一遍",
    sum: "你实际听到的",
    verdict: "安静是叠出来的",
    limit: "突发的高频还是会漏",
  },
  C,
};
