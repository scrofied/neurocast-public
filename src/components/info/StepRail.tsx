import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  mode: z.enum(["nodes", "bar"]).optional().describe("nodes 节点链（默认，圆点串成一条）；bar 单条进度条按百分比推进"),
  steps: z.array(z.string()).min(2).max(6).describe("每一步的短名：登录 → 建库 → 选表 → 出报告"),
  stepAt: z.array(z.number()).optional().describe("每一步点亮的时刻（锚点数组，严格跟“第一步/然后/最后”）"),
  percent: z.number().optional().describe("bar 模式：目标百分比 0~100"),
  percentLabel: z.string().optional().describe("bar 模式右侧大字，如“80%”"),
  threshold: z.object({ value: z.number(), label: z.string(), at: z.number().optional() }).optional().describe("阈值处的旗子，如“80% 的人卡在这”"),
  settleAt: z.number().optional().describe("进度到达终点的时刻"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.steps.length;
  const mode = data.mode ?? "nodes";
  // bottom rail: sits above the subtitle safe area
  const railY = full ? H * 0.855 : H * 0.9;
  const pad = full ? W * 0.06 : W * 0.05;
  const x0 = pad;
  const x1 = W - pad;
  const total = Math.max(24, dur - 12);
  const stepCues = data.steps.map((_, i) => Math.max(i ? 6 : 0, cueOr(data.stepAt?.[i], Math.round((total * (i + 0.35)) / n))));
  // which step is "current": the last one that has started
  let cur = -1;
  for (let i = 0; i < n; i++) if (frame >= stepCues[i]) cur = i;
  const settle = cueOr(data.settleAt, Math.round(total * 0.94));
  // bar fill: advance to the next step's position while the current one is active
  const segP = cur >= 0 ? easeIn(prog(frame, stepCues[cur], Math.max(10, (stepCues[cur + 1] ?? settle) - stepCues[cur]))) : 0;
  const fillP = cur < 0 ? 0 : ((cur + (frame >= settle ? 1 : segP)) / n) - 1 / n + segP / n;
  const pct = Math.round(lerp(0, data.percent ?? 100, clamp((cur + segP) / Math.max(1, n - 0)) ));
  const sh = hitShake(frame, [settle], full ? 8 : 4, 10, seed);
  const th = data.threshold;
  const thX = th ? lerp(x0, x1, clamp(th.value / 100)) : 0;
  const eTh = enterAt(frame, cueOr(th?.at, Math.round(total * 0.6)), { fallback: "rise", dur: 14 });
  const thP = th ? eTh.p : 0;
  const eTitle = enterAt(frame, 4, { fallback: "slide-r", dur: 14 });
  const eDone = enterAt(frame, settle, { fallback: "rise", dur: 12 });

  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* top-left title, small: this component is a persistent rail, not a full screen */}
        {(data.title || data.kicker) && full && (
          <div style={{ position: "absolute", left: pad, top: H * 0.1, opacity: eTitle.p, transform: `translate(${eTitle.dx}px, ${eTitle.dy}px)`, clipPath: eTitle.clip }}>
            {data.kicker && <div style={{ fontFamily: t.font.mono, fontSize: 18, letterSpacing: 5, color: t.primary }}>{data.kicker}</div>}
            {data.title && <div style={{ marginTop: 6, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.title, W * 0.5, 46, 22), color: t.text, whiteSpace: "nowrap" }}>{data.title}</div>}
          </div>
        )}
        {/* rail base */}
        <div style={{ position: "absolute", left: x0, top: railY, width: x1 - x0, height: full ? 8 : 5, borderRadius: 4, background: alpha(t.text, 0.12), overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${clamp(fillP) * 100}%`, background: `linear-gradient(90deg, ${t.primary}, ${t.accent})`, boxShadow: `0 0 18px ${alpha(t.primary, 0.7)}` }} />
        </div>
        {mode === "nodes" &&
          data.steps.map((s, i) => {
            const x = lerp(x0, x1, n === 1 ? 0 : i / (n - 1));
            const on = frame >= stepCues[i];
            const isCur = i === cur;
            const eN = enterAt(frame, stepCues[i], { fallback: "rise", dur: 12 });
            const p = eN.p;
            const fs = fitFont(s, (x1 - x0) / n - 18, full ? 26 : 15, 11);
            return (
              <div key={i} style={{ position: "absolute", left: x, top: railY + (full ? 4 : 2.5), transform: "translate(-50%, -50%)" }}>
                <div style={{ width: full ? (isCur ? 40 : 26) : isCur ? 22 : 15, height: full ? (isCur ? 40 : 26) : isCur ? 22 : 15, borderRadius: "50%", background: on ? (isCur ? t.accent : t.primary) : alpha(t.text, 0.18), border: `3px solid ${on ? t.accent : alpha(t.text, 0.3)}`, boxShadow: on ? `0 0 ${isCur ? 26 : 12}px ${alpha(t.accent, 0.75)}` : undefined, transform: `scale(${on ? p : 1})${on ? ` translate(${eN.dx}px, ${eN.dy}px)` : ""}`, clipPath: on ? eN.clip : undefined, display: "flex", alignItems: "center", justifyContent: "center", transition: "none" }}>
                  {frame >= stepCues[i] + 10 && i < cur && <Icon name="check" size={full ? 20 : 12} color={t.bg} stroke={4} />}
                </div>
                <div style={{ position: "absolute", left: "50%", top: full ? -58 : -36, transform: `translateX(-50%)${on ? ` translate(${eN.dx}px, ${eN.dy}px)` : ""}`, fontFamily: t.font.title, fontWeight: isCur ? 900 : 700, fontSize: fs, color: on ? (isCur ? t.accent : t.text) : t.dim, whiteSpace: "nowrap", opacity: on ? 1 : 0.5, textShadow: "0 2px 0 #000" }}>
                  {i + 1}. {s}
                </div>
              </div>
            );
          })}
        {mode === "bar" && (
          <div style={{ position: "absolute", right: W - x1, top: railY - (full ? 96 : 52), display: "flex", alignItems: "baseline", gap: 8, fontFamily: t.font.title, fontWeight: 900, color: t.accent, textShadow: "0 3px 0 #000" }}>
            <span style={{ fontSize: full ? 96 : 46, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{data.percentLabel ?? `${pct}%`}</span>
          </div>
        )}
        {th && (
          <>
            <div style={{ position: "absolute", left: thX, top: railY - (full ? 78 : 44), transform: `translateX(-50%) scale(${thP}) translate(${eTh.dx}px, ${eTh.dy}px)`, clipPath: eTh.clip, transformOrigin: "50% 100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ padding: full ? "4px 16px" : "2px 9px", borderRadius: 8, background: alpha(t.bad, 0.9), fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 24 : 14, color: "#fff", whiteSpace: "nowrap" }}>{th.label}</div>
              <div style={{ width: 4, height: full ? 26 : 14, background: t.bad }} />
            </div>
            <div style={{ position: "absolute", left: thX - 2, top: railY - 2, width: 4, height: full ? 14 : 8, background: t.bad }} />
          </>
        )}
        {/* finished banner */}
        {frame >= settle && (
          <div style={{ position: "absolute", left: x1, top: railY - (full ? 120 : 66), transform: `translateX(-50%) scale(${eDone.p}) translate(${eDone.dx}px, ${eDone.dy}px)`, clipPath: eDone.clip, fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 28 : 16, color: t.primary, letterSpacing: 4 }}>
            ✓ DONE
          </div>
        )}
      </div>
      {stepCues.map((c, i) => (
        <Sfx key={i} name="tick" at={c} volume={0.3} />
      ))}
      {frame >= settle && <Sfx name="success" at={settle} volume={0.35} />}
    </>
  );
};

export const StepRail: CompDef<D> = {
  id: "step-rail",
  name: "步骤轨（底部推进条 / 进度条）",
  layer: "info",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["第一步", "然后", "最后", "步骤", "进度", "流程", "80%"],
  motion: { kind: "轨道填充推进 + 节点逐个点亮打钩 + 阈值旗子弹出", energy: 2 },
  desc: "底部一条常驻的推进轨：nodes 模式是圆点串成的节点链，活跃节点放大发光、走完的打钩变灰、没到的半透明，顶上写每步名字；bar 模式是一条进度条按百分比填充，右下角大字百分比，可在阈值处插一面红旗（80% 的人卡在这）",
  use: "讲一套按顺序的流程：登录 → 建库 → 选表 → 出报告、三步跑完还剩一步、80% 的人卡在第三步；也适合做「进度条」这种纯进度表达",
  panel: true,
  schema,
  example: { mode: "nodes", steps: ["登录拿 Key", "建自己的库", "贴上文件", "问出答案"], title: "四步就够" },
  C,
};
