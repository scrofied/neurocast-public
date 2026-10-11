import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter, type EnterState } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { Img } from "remotion";
import { assetUrl } from "../../lib/asset";
import type { CompDef, CompProps } from "../types";

// 真人全屏讲话时叠在真人「两侧」的品牌图标动效层（over 镜头：渲染在 presenter 层之上）。
// 左卡 = 指挥者（如 Codex），右卡 = 执行者（如 WorkBuddy），说到「控制」时一道能量束
// 从左卡射到右卡并持续派发包 —— 把「A 控制 B 干活」这句话直接画在真人两边。
const brand = z.object({
  src: z.string().describe("真实官方图标文件（svg/png，走 assetFields）"),
  label: z.string().describe("图标下的品牌名，如 Codex"),
  note: z.string().optional().describe("小字标签，如 指挥官 / 干活的"),
  at: z.number().optional().describe("这一侧弹出的时刻（锚点，如“codex”）；缺省 = 镜头开始"),
});
const schema = z.object({
  left: brand.describe("真人左侧：发号施令的一方"),
  right: brand.describe("真人右侧：被指挥干活的一方"),
  beamAt: z.number().optional().describe("能量束从左侧射向右下的时刻（锚点，如“控制”）"),
  beamText: z.string().optional().describe("能量束中段的小胶囊文案，如 派活"),
  outAt: z.number().optional().describe("两侧一起收起的时刻（锚点，如“干活$”）；缺省 = 镜头结束前 12 帧"),
});
type D = z.infer<typeof schema>;

const outline = { textShadow: "0 2px 0 rgba(0,0,0,.85), 0 0 14px rgba(0,0,0,.7)" } as const;

const C: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const enterAt = useEnter(0);
  const { width: W, height: H } = useBox();
  const lAt = cueOr(data.left.at, 4);
  const rAt = cueOr(data.right.at, lAt + 14);
  const beamAt = cueOr(data.beamAt, rAt + 10);
  const outAt = cueOr(data.outAt, dur - 12);

  const cw = W * 0.156; // 卡片宽 ~300
  const ch = cw * 1.12;
  const cy = H * 0.44;
  const lx = W * 0.132; // 左卡中心
  const rx = W * 0.868;

  const outK = easeIn(prog(frame, outAt, 10)); // 1 = 完全收起（10 帧内收完，赶在镜头结束前）
  // 入场固定 slam（隐喻主体：图标砸到真人两侧），但收敛幅度：小缩放 + 短下落，幽灵帧不遮顶部 HUD
  const el = enterAt(frame, lAt, { kind: "slam", fallback: "slam", dur: 12, from: 1.55, dist: 0.34 });
  const er = enterAt(frame, rAt, { kind: "slam", fallback: "slam", dur: 12, from: 1.55, dist: 0.34 });

  const card = (b: { src: string; label: string; note?: string }, e: EnterState, cx: number, side: -1 | 1, at: number) => {
    const op = e.opacity * (1 - outK);
    if (op <= 0.004) return null;
    const pop = clamp((frame - at) / 18); // 出场光环
    const drift = Math.sin((frame - at) / 26) * 5; // 常动
    return (
      <div style={{ position: "absolute", left: cx - cw / 2, top: cy + drift - ch / 2, width: cw, height: ch, opacity: op, transform: `scale(${e.scale}) translate(${e.dx + side * 46 * outK}px, ${e.dy}px)` }}>
        {/* 出场冲击环 */}
        {pop > 0 && pop < 1 && (
          <div style={{ position: "absolute", inset: -8, borderRadius: 34, border: `3px ${alpha(t.primary, 0.85 * (1 - pop))} solid`, transform: `scale(${1 + pop * 0.55})`, boxShadow: `0 0 ${30 * (1 - pop)}px ${alpha(t.primary, 0.5 * (1 - pop))}` }} />
        )}
        <div style={{ position: "absolute", inset: 0, borderRadius: 26, background: "linear-gradient(160deg, rgba(16,10,32,0.72), rgba(8,4,18,0.6))", border: `2px ${alpha(t.primary, 0.55)} solid`, boxShadow: `0 0 34px ${alpha(t.primary, 0.22)}, inset 0 0 26px rgba(255,255,255,0.04)`, backdropFilter: "blur(6px)" }} />
        {b.src && <Img src={assetUrl(b.src)} style={{ position: "absolute", left: cw / 2 - cw * 0.29, top: ch * 0.1, width: cw * 0.58, height: cw * 0.58, borderRadius: cw * 0.14, objectFit: "cover", filter: `drop-shadow(0 6px 18px rgba(0,0,0,.55)) drop-shadow(0 0 16px ${alpha(t.primary, 0.35)})` }} />}
        <div style={{ position: "absolute", left: 0, right: 0, top: ch * 0.1 + cw * 0.58 + 12, textAlign: "center", color: "#fff", fontWeight: 900, fontSize: W * 0.023, letterSpacing: 1, ...outline }}>{b.label}</div>
        {b.note && (
          <div style={{ position: "absolute", left: 0, right: 0, top: ch * 0.1 + cw * 0.58 + 12 + W * 0.031, textAlign: "center" }}>
            <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, background: alpha(t.accent, 0.16), border: `1.5px ${alpha(t.accent, 0.55)} solid`, color: "#fff", fontSize: W * 0.0125, fontWeight: 700, ...outline }}>{b.note}</span>
          </div>
        )}
      </div>
    );
  };

  // 能量束：左卡右缘 → 右卡左缘，一条下坠的二次贝塞尔（从真人胸前掠过）
  const bx0 = lx + cw / 2 + 6, bx1 = rx - cw / 2 - 6, by = cy + ch * 0.42, qy = cy + H * 0.2;
  const bez = (u: number): [number, number] => {
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return [a * bx0 + b * ((bx0 + bx1) / 2) + c * bx1, a * by + b * qy + c * by];
  };
  const draw = easeOut(prog(frame, beamAt, 16)) * (1 - outK);
  const path = (() => {
    if (draw <= 0.004) return "";
    const N = 28;
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) {
      const [x, y] = bez((i / N) * draw);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  })();
  // 派发包：束画完后沿曲线循环跑（间隔 14 帧）
  const packets: { u: number; x: number; y: number }[] = [];
  if (draw >= 0.999 && frame > beamAt + 16) {
    for (let k = 0; k < 3; k++) {
      const u = ((frame - beamAt - 16 - k * 14) % 42) / 42;
      if (u > 0.02 && u < 0.98) {
        const [x, y] = bez(u);
        packets.push({ u, x, y });
      }
    }
  }
  const mid = bez(0.5);
  const pillK = easeOutBack(prog(frame, beamAt + 18, 12)) * (1 - outK);

  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {path && (
          <>
            <path d={path} fill="none" stroke={alpha(t.primary, 0.28 * (1 - outK))} strokeWidth={13} strokeLinecap="round" />
            <path d={path} fill="none" stroke={alpha(t.primary, 0.95 * (1 - outK))} strokeWidth={4} strokeLinecap="round" strokeDasharray="16 12" strokeDashoffset={-frame * 1.6} style={{ filter: `drop-shadow(0 0 10px ${t.primary})` }} />
          </>
        )}
        {packets.map((p, i) => (
          <g key={i} opacity={1 - outK}>
            <circle cx={p.x} cy={p.y} r={13} fill={t.gold} style={{ filter: `drop-shadow(0 0 12px ${t.gold})` }} />
            <circle cx={p.x} cy={p.y} r={5} fill="#1a1206" />
          </g>
        ))}
        {path && draw >= 0.999 && pillK > 0.01 && data.beamText && (
          <g opacity={pillK}>
            <rect x={mid[0] - 62} y={mid[1] + 14} width={124} height={40} rx={20} fill={alpha(t.bg, 0.82)} stroke={alpha(t.gold, 0.8)} strokeWidth={2} />
            <text x={mid[0]} y={mid[1] + 41} textAnchor="middle" fill="#fff" fontSize={22} fontWeight={800} style={{ letterSpacing: 2 }}>{data.beamText}</text>
          </g>
        )}
      </svg>
      {card(data.left, el, lx, -1, lAt)}
      {card(data.right, er, rx, 1, rAt)}
      <Sfx name="impact" at={lAt} volume={0.3} />
      <Sfx name="ding" at={rAt} volume={0.26} />
      <Sfx name="whoosh" at={beamAt} volume={0.3} />
    </>
  );
};

export const SideBrandFx: CompDef<D> = {
  id: "side-brand-fx",
  name: "真人两侧品牌图标（over 层）",
  layer: "overlay",
  variants: 1,
  minSec: 1.5,
  maxSec: 6,
  tags: ["真人全屏", "两侧", "品牌图标", "控制", "派活", "over"],
  motion: { kind: "两侧玻璃卡砸出 + 能量束从左射到右 + 金色派发包循环跑", energy: 3 },
  desc: "真人全屏讲话时，左右两侧各弹出一张玻璃卡（真实官方图标 + 品牌名 + 小标签），说到「控制」时一道能量束从左卡射到右卡，金色数据包沿束循环跑过去；收窗前两侧一起滑出",
  use: "「用 A 控制 B 干活」这类点名的两方关系，且这段时间真人正全屏讲话：把两个真实产品图标放在真人两侧做动效（分镜需写 over:true，镜头渲染在真人层之上）",
  schema,
  assetFields: ["left.src", "right.src"],
  example: {
    left: { src: "codex.svg", label: "Codex", note: "指挥官" },
    right: { src: "workbuddy.png", label: "WorkBuddy", note: "干活的" },
    beamText: "派活",
  },
  C,
};
