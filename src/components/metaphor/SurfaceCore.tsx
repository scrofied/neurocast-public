import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  surface: z.array(z.string()).min(2).max(6).describe("上面那排一直在换的东西：去年那个工具 / 今年这个 / 明年那个"),
  core: z.string().describe("底下始终不动的那条内核：把需求说清楚 / 判断力 / 行业认知"),
  coreNote: z.string().optional(),
  lockAt: z.number().optional().describe("内核点亮定格的时刻（锚点，如“方法不变”）"),
  swapSpeed: z.number().default(1).describe("上面换得有多快"),
  verdict: z.string().optional(),
  verdictAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.surface.length;
  const lockAt = cueOr(data.lockAt, Math.round(dur * 0.5));
  const verdictAt = cueOr(data.verdictAt, lockAt + 28);
  const top = full ? H * 0.3 : H * 0.2;
  const beltH = full ? 150 : 84;
  const coreTop = full ? H * 0.62 : H * 0.6;
  const coreH = full ? 130 : 72;
  const sh = hitShake(frame, [lockAt], full ? 8 : 4, 12, seed);
  // the surface belt: cards slide through continuously, faster after lockAt to contrast with the still core
  const speed = (full ? 7 : 4) * data.swapSpeed * (frame >= lockAt ? 1.6 : 1);
  const beltW = W * 1.2;
  const beltX = -W * 0.1;
  const slotW = full ? 320 : 180;
  const shift = (frame * speed) % slotW;
  const count = Math.ceil(beltW / slotW) + 2;
  // 内核点亮：原生是 easeOutBack scale 0→1（rise 等价），只消费 e.p/e.scale，不加位移
  const eCore = enterAt(frame, lockAt, { fallback: "rise", dur: 16, from: 0 });
  const locked = frame >= lockAt;
  // 两个说明标签：淡入入场
  const eLblTop = enterAt(frame, 4, { fallback: "rise", dur: 14 });
  const eLblCore = enterAt(frame, lockAt, { fallback: "rise", dur: 14 });
  // 结论文字：原生回弹放大入场（rise+from:0 与基线一致）；新元素，位移通道一并接上
  const eVerdict = enterAt(frame, verdictAt, { fallback: "rise", dur: 14, from: 0 });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* the belt */}
        <div style={{ position: "absolute", left: 0, right: 0, top: top, height: beltH, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: beltX - shift, top: 0, display: "flex", gap: full ? 26 : 14 }}>
            {Array.from({ length: count }, (_, i) => {
              const label = data.surface[i % n];
              const fresh = i % n === Math.floor((frame * speed) / slotW) % n;
              const col = fresh && !locked ? t.accent : t.dim;
              return (
                <div key={i} style={{ width: slotW, height: beltH, borderRadius: 16, background: alpha(t.bg2, 0.9), border: `2.5px solid ${alpha(col, 0.75)}`, boxShadow: fresh && !locked ? `0 0 26px ${alpha(t.accent, 0.35)}` : undefined, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: full ? 10 : 5, opacity: frame >= lockAt ? 0.75 : 1 }}>
                  <Icon name="tool" size={full ? 36 : 19} color={col} />
                  <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(label, slotW - (full ? 40 : 20), full ? 28 : 15, 11), color: t.text, whiteSpace: "nowrap" }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* belt rollers */}
        {[0, 1].map((i) => (
          <div key={i} style={{ position: "absolute", left: W / 2 - (full ? 200 : 110) + i * (full ? 400 : 220), top: top + beltH + (full ? 14 : 7), width: full ? 34 : 18, height: full ? 34 : 18, borderRadius: "50%", border: `3px solid ${alpha(t.dim, 0.7)}` }}>
            <div style={{ position: "absolute", left: "50%", top: 2, width: 2, height: "45%", background: alpha(t.dim, 0.8), transformOrigin: "50% 100%", transform: `rotate(${frame * speed * 2}deg)` }} />
          </div>
        ))}
        {/* label: what keeps changing */}
        <div style={{ position: "absolute", left: full ? W * 0.06 : 12, top: top - (full ? 54 : 28), fontFamily: t.font.mono, fontSize: full ? 22 : 12, letterSpacing: 4, color: t.dim, opacity: eLblTop.opacity }}>一直在换的</div>
        {/* the core: a still, glowing bar */}
        <div style={{ position: "absolute", left: W * 0.1, top: coreTop, width: W * 0.8, height: coreH, transform: `scale(${locked ? eCore.scale : 1})`, borderRadius: 18, background: `linear-gradient(90deg, ${alpha(t.gold, 0.22)}, ${alpha(t.gold, 0.12)})`, border: `3px solid ${t.gold}`, boxShadow: `0 0 ${locked ? 40 : 16}px ${alpha(t.gold, locked ? 0.55 : 0.25)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: full ? 6 : 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: full ? 14 : 7 }}>
            <Icon name="lock" size={full ? 30 : 16} color={t.gold} />
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.core, W * 0.7, full ? 44 : 22, 14), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 20px ${alpha(t.gold, 0.6)}` }}>{data.core}</span>
          </div>
          {data.coreNote && <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: full ? 21 : 12, color: alpha(t.gold, 0.85), whiteSpace: "nowrap" }}>{data.coreNote}</div>}
        </div>
        <div style={{ position: "absolute", left: full ? W * 0.06 : 12, top: coreTop + coreH + (full ? 14 : 7), fontFamily: t.font.mono, fontSize: full ? 22 : 12, letterSpacing: 4, color: t.gold, opacity: eLblCore.opacity }}>始终不动的</div>
        {/* vertical comparison guides showing the core never moves while the belt does */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <GlowDefs id="svc" std={7} user />
          {locked && [0.28, 0.72].map((k, i) => (
            <line key={i} x1={W * k} y1={top + beltH * 0.5} x2={W * k} y2={coreTop + coreH / 2} stroke={alpha(t.gold, 0.5)} strokeWidth={3} strokeDasharray="10 10" opacity={eCore.p} />
          ))}
          {locked && <line x1={W * 0.1} y1={coreTop + coreH / 2} x2={W * 0.9} y2={coreTop + coreH / 2} stroke={t.gold} strokeWidth={3} filter="url(#svc)" opacity={eCore.p * 0.5} />}
        </svg>
        {data.verdict && frame >= verdictAt && (
          <div style={{ position: "absolute", left: W / 2, top: coreTop + coreH + (full ? 78 : 40), transform: `translateX(-50%) translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.7, full ? 50 : 25, 15), color: t.text, whiteSpace: "nowrap", textShadow: "0 3px 0 #000" }}>{data.verdict}</div>
        )}
      </div>
      <Sfx name="swish" at={0} volume={0.12} />
      <Sfx name="impact" at={lockAt} volume={0.35} />
      <Sfx name="ding" at={lockAt + 10} volume={0.34} />
      {data.verdict && <Sfx name="stamp" at={verdictAt} volume={0.32} />}
    </>
  );
};

export const SurfaceCore: CompDef<D> = {
  id: "surface-vs-core",
  name: "换皮不换骨（上面在换，底下不动）",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["换皮", "内核", "方法不变", "工具会变", "底层"],
  motion: { kind: "上层传送带快速滑过工具卡 · 下层金色内核静止发光 · 锁扣落定", energy: 2 },
  desc: "上面一条传送带不停地把「工具卡」一张张滑过去、越走越快（去年那个、今年这个、明年那个），下面一条金色的内核横条从头到尾一动不动，锁定那一刻亮起光晕、上下用虚线连起来对比「换」和「不换」",
  use: "讲方法比工具重要：工具会变方法不变、外壳一直换内核还是那套、追新工具不如练判断力",
  panel: true,
  schema,
  example: { surface: ["去年的爆款工具", "今年的新宠", "明年又换一个"], core: "把需求说清楚", coreNote: "这个十年没过时", verdict: "追工具的人一直在换，练方法的人一直在赚" },
  C,
};
