import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { GlowDefs, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({ title: z.string().optional(), kicker: z.string().optional(), stations: z.array(z.string()).min(2).max(4).optional(), input: z.string().optional(), output: z.string().optional() });
type D = z.infer<typeof schema>;

// conveyor belt with robotic arms stamping each item as it passes
const C: React.FC<CompProps<D>> = ({ data, frame, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const st = data.stations ?? ["理解", "生成", "校对"];
  const n = st.length;
  const beltY = height / 2 + 170;
  const L = 140;
  const R = width - 140;
  const stX = st.map((_, i) => L + ((R - L) * (i + 1)) / (n + 1));
  const speed = 4.2;
  const spacing = 300;
  const items = new Array(8).fill(0).map((_, k) => {
    const x = L - 200 + ((frame * speed + k * spacing) % (R - L + 400));
    const stage = stX.filter((sx) => x > sx).length;
    return { x, stage, k };
  });
  // IN/OUT 读数原生是淡入（easeOut prog），接进统一入场语法
  const eRead = enterAt(frame, 8, { fallback: "rise", dur: 16 });
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="al" std={6} />
        <rect x={L} y={beltY} width={R - L} height={30} rx={15} fill={alpha(t.primary, 0.1)} stroke={alpha(t.primary, 0.5)} />
        {new Array(60).fill(0).map((_, i) => {
          const x = L + ((i * 30 + frame * speed) % (R - L));
          return <line key={i} x1={x} x2={x - 10} y1={beltY + 4} y2={beltY + 26} stroke={alpha(t.primary, 0.35)} strokeWidth={2} />;
        })}
        {stX.map((sx, i) => {
          // arm stamps when an item is under it
          const near = Math.min(...items.map((it) => Math.abs(it.x - sx)));
          const stamp = clamp(1 - near / 60);
          const armY = beltY - 300 + stamp * 150;
          return (
            <g key={i}>
              <rect x={sx - 60} y={beltY - 420} width={120} height={40} rx={8} fill={alpha(t.bg2, 0.9)} stroke={t.primary} />
              <line x1={sx} y1={beltY - 380} x2={sx} y2={armY} stroke={t.primary} strokeWidth={10} strokeLinecap="round" />
              <line x1={sx} y1={beltY - 380} x2={sx} y2={armY} stroke={t.text} strokeWidth={2} />
              <rect x={sx - 44} y={armY} width={88} height={26} rx={6} fill={stamp > 0.7 ? t.accent : t.primary} filter={stamp > 0.7 ? "url(#al)" : undefined} />
              {stamp > 0.85 && <circle cx={sx} cy={beltY - 40} r={60 * stamp} fill="none" stroke={t.accent} strokeOpacity={0.6} />}
            </g>
          );
        })}
      </svg>
      {stX.map((sx, i) => (
        <div key={i} style={{ position: "absolute", left: sx - 60, width: 120, top: beltY - 414, textAlign: "center", fontFamily: t.font.body, fontWeight: 800, fontSize: 24, color: t.text }}>
          {st[i]}
        </div>
      ))}
      {items.map((it) => {
        const done = it.stage >= n;
        const col = done ? t.accent : it.stage > 0 ? t.primary : t.dim;
        const sz = 70 + it.stage * 8;
        return (
          <div
            key={it.k}
            style={{
              position: "absolute",
              left: it.x - sz / 2,
              top: beltY - sz - 4,
              width: sz,
              height: sz,
              borderRadius: done ? sz / 2 : 10 - it.stage * 2,
              background: alpha(col, 0.25),
              border: `2px solid ${col}`,
              boxShadow: done ? `0 0 30px ${alpha(t.accent, 0.8)}` : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: t.font.mono,
              fontSize: 22,
              fontWeight: 800,
              color: t.text,
              transform: `rotate(${done ? 0 : 45 - it.stage * 15}deg)`,
            }}
          >
            {done ? "✓" : ""}
          </div>
        );
      })}
      {/* IN/OUT 读数位置固定（不靠 e.p 插值），入场位移/擦除接在这里 */}
      <div style={{ position: "absolute", left: L, top: beltY + 60, fontFamily: t.font.mono, fontSize: 22, color: t.dim, letterSpacing: 3, opacity: eRead.opacity, transform: `translate(${eRead.dx}px, ${eRead.dy}px)`, clipPath: eRead.clip }}>{`IN · ${data.input ?? "原始需求"}`}</div>
      <div style={{ position: "absolute", right: 140, top: beltY + 60, fontFamily: t.font.mono, fontSize: 22, color: t.accent, letterSpacing: 3, opacity: eRead.opacity, transform: `translate(${eRead.dx}px, ${eRead.dy}px)`, clipPath: eRead.clip }}>{`OUT · ${data.output ?? "成品"} · ${Math.floor(frame / 10)} pcs`}</div>
      <Headline kicker={data.kicker ?? "AUTOMATION"} title={data.title} frame={frame} />
    </>
  );
};

export const AssemblyLine: CompDef<D> = {
  id: "assembly",
  name: "自动化流水线",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["自动化", "批量", "流水线", "自动", "一键", "规模化", "量产", "工厂"],
  motion: { kind: "传送带持续滚动送料，机械臂经过工位时下压盖章，工件逐站变形", energy: 2 },
  desc: "传送带上的原料依次经过几个工位，被加工成成品",
  use: "自动化流水线、批量生产、一键量产",
  schema,
  example: { title: "内容生产变成流水线", stations: ["选题", "写稿", "出片"], input: "热点", output: "视频" },
  C,
};
