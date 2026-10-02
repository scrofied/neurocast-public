import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, noise1, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  big: z.array(z.object({ text: z.string(), at: z.number().optional() })).min(1).max(3).describe("贪大的目标（巨大的球），如 商城、外卖平台"),
  verdict: z.string().optional().describe("贪大的下场，红章，如“找死”"),
  verdictAt: z.number().optional(),
  small: z.object({ text: z.string(), icon: z.string().optional(), at: z.number().optional() }).describe("缩小后的目标：说到这里大球全部坍缩成它"),
  meter: z.object({ label: z.string(), from: z.number(), to: z.number() }).default({ label: "一次跑通率", from: 8, to: 92 }).describe("右侧成功率仪表：贪大时低，缩小后涨满"),
  meterAt: z.number().optional().describe("仪表开始上涨的时刻（锚点，如“成功率”）；缺省 = 坍缩后马上涨"),
  examples: z.array(z.object({ text: z.string(), icon: z.string().optional(), at: z.number().optional() })).max(3).default([]).describe("小目标的具体例子，在小方块下面逐个弹出"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const n = data.big.length;
  const bCues = listCues(data.big, 6, Math.max(20, dur * 0.3));
  const smallAt = cueOr(data.small.at, dur * 0.55);
  const verdictAt = cueOr(data.verdictAt, Math.min(smallAt - 14, bCues[n - 1] + 30));
  const s = easeInOut(prog(frame, smallAt, 26));
  const cx = width * 0.4;
  const cy = height * 0.56;
  const R = Math.min(250, height * 0.26);
  const slots = n === 1 ? [[0, 0]] : n === 2 ? [[-1, 0.1], [1, -0.1]] : [[-1.2, 0.2], [0, -0.25], [1.2, 0.2]];
  // meter
  const mx = width * 0.82;
  const mTop = height * 0.26;
  const mH = height * 0.5;
  const low = data.meter.from;
  const meterAt = cueOr(data.meterAt, smallAt + 10);
  const val = low + (data.meter.to - low) * easeOut(prog(frame, meterAt, 30));
  const exs = data.examples;
  const eCues = listCues(exs, smallAt + 34, Math.max(smallAt + 50, meterAt - 10));
  // 仪表框与读数原生只有淡入、位置固定 → 位移/擦除交给入场语法
  const eMeter = enterAt(frame, 8, { fallback: "rise", dur: 14 });
  const meterIn = eMeter.opacity;
  const lowAlarm = frame < smallAt && frame >= bCues[0] + 10 && Math.floor(frame / 8) % 2 === 0;
  // 小方块与红章的弹出缩放是入场（落点固定，可以叠加位移）；坍缩(s)、数值上涨(val)、脉动光晕是主体/持续动画
  const eGem = enterAt(frame, smallAt + 18, { fallback: "rise", dur: 16 });
  const gem = eGem.p;
  const eStamp = enterAt(frame, verdictAt, { fallback: "rise", dur: 9 });
  const vp = eStamp.p;
  const eSmallLbl = enterAt(frame, smallAt + 22, { fallback: "rise", dur: 12 });
  return (
    <>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />
      {data.big.map((b, i) => {
        // 球是按 p 从 0 长出来的（r = R * p）：尺寸/位置已由 e.p 驱动，再叠 dx/dy 会变成两倍动
        const p = enterAt(frame, bCues[i], { fallback: "rise", dur: 18, seed: i }).p;
        if (frame < bCues[i]) return null;
        const [sx, sy] = slots[i];
        const wob = noise1(frame * 0.05, seed + i * 7) * 8;
        const x = cx + sx * R * 1.05 * (1 - s);
        const y = cy + sy * R * (1 - s) + wob;
        const r = R * (n > 2 ? 0.7 : 0.85) * p * (1 - s) + 6 * s;
        const o = 1 - easeOut(prog(frame, smallAt + 14, 10));
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", opacity: o, background: `radial-gradient(circle at 35% 30%, ${alpha(t.secondary, 0.55)}, ${alpha(t.bg2, 0.9)} 70%)`, border: `3px solid ${alpha(t.secondary, 0.8)}`, boxShadow: `0 0 60px ${alpha(t.secondary, 0.4)}` }} />
            {s < 0.6 && (
              <div style={{ position: "absolute", left: x - 260, width: 520, top: y - 40, textAlign: "center", opacity: o * (1 - s * 1.6), fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(b.text, r * 1.6, 74, 30), color: t.text, whiteSpace: "nowrap", textShadow: "0 4px 18px rgba(0,0,0,.7)" }}>{b.text}</div>
            )}
          </React.Fragment>
        );
      })}
      {data.verdict && frame >= verdictAt && s < 0.5 && (
        <div style={{ position: "absolute", left: cx - 200, width: 400, top: cy + R * 0.55, textAlign: "center", opacity: 1 - s * 2 }}>
          <span style={{ display: "inline-block", transform: `translate(${eStamp.dx}px, ${eStamp.dy}px) rotate(-8deg) scale(${vp < 1 ? 2 - vp : 1})`, padding: "8px 30px", border: `6px solid ${t.bad}`, borderRadius: 14, background: "rgba(0,0,0,.45)", fontFamily: t.font.title, fontWeight: 900, fontSize: 84, color: t.bad, textShadow: `0 0 24px ${alpha(t.bad, 0.7)}` }}>{data.verdict}</span>
        </div>
      )}
      {/* collapse into one small, sharp target */}
      {frame >= smallAt + 12 && (
        <>
          <div style={{ position: "absolute", left: cx - 90, top: cy - 90, width: 180, height: 180, borderRadius: 40, transform: `translate(${eGem.dx}px, ${eGem.dy}px) scale(${gem}) rotate(${(1 - gem) * 40}deg)`, background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`, boxShadow: `0 0 ${60 + 20 * Math.sin(frame / 6)}px ${alpha(t.primary, 0.7)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={data.small.icon ?? "tool"} size={110} color={t.bg} stroke={2.4} />
          </div>
          <div style={{ position: "absolute", left: cx - 400, width: 800, top: cy + 130, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.small.text, 760, 64, 30), color: t.text, opacity: eSmallLbl.opacity, transform: `translate(${eSmallLbl.dx}px, ${eSmallLbl.dy}px)`, clipPath: eSmallLbl.clip, whiteSpace: "nowrap", textShadow: `0 0 24px ${alpha(t.primary, 0.6)}` }}>{data.small.text}</div>
        </>
      )}
      {exs.map((e, i) => {
        if (frame < eCues[i]) return null;
        const eEx = enterAt(frame, eCues[i], { fallback: "rise", dur: 12, seed: i });
        const p = eEx.p;
        const w = 380;
        const total = exs.length * w + (exs.length - 1) * 30;
        return (
          <div key={i} style={{ position: "absolute", left: cx - total / 2 + i * (w + 30), top: cy + 215, width: w, height: 74, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", borderRadius: 16, background: alpha(t.bg, 0.85), border: `2px solid ${t.accent}`, transform: `translate(${eEx.dx}px, ${eEx.dy}px) scale(${p})`, clipPath: eEx.clip, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(e.text, w - 100, 36, 20), color: t.text, whiteSpace: "nowrap", boxShadow: `0 0 20px ${alpha(t.accent, 0.35)}` }}>
            <Icon name={e.icon ?? "target"} size={38} color={t.accent} />
            {e.text}
          </div>
        );
      })}
      {frame >= smallAt + 12 && frame < smallAt + 40 && (
        <div style={{ position: "absolute", left: cx - 40 - (frame - smallAt - 12) * 10, top: cy - 40 - (frame - smallAt - 12) * 10, width: 80 + (frame - smallAt - 12) * 20, height: 80 + (frame - smallAt - 12) * 20, borderRadius: "50%", border: `4px solid ${alpha(t.primary, 1 - (frame - smallAt - 12) / 28)}` }} />
      )}
      {/* success meter */}
      <div style={{ position: "absolute", left: mx - 50, top: mTop, width: 100, height: mH, borderRadius: 50, border: `3px solid ${alpha(lowAlarm ? t.bad : t.primary, 0.7)}`, background: alpha(t.bg, 0.6), overflow: "hidden", opacity: meterIn, transform: `translate(${eMeter.dx}px, ${eMeter.dy}px)`, clipPath: eMeter.clip }}>
        <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, height: `calc(${clamp(val / 100) * 100}% - 16px)`, minHeight: 12, borderRadius: 42, background: val > 50 ? `linear-gradient(0deg, ${t.primary}, ${t.accent})` : t.bad, boxShadow: `0 0 30px ${alpha(val > 50 ? t.primary : t.bad, 0.7)}` }} />
      </div>
      <div style={{ position: "absolute", left: mx - 160, width: 320, top: mTop + mH + 18, textAlign: "center", opacity: meterIn, transform: `translate(${eMeter.dx}px, ${eMeter.dy}px)` }}>
        <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 86, lineHeight: 1, color: val > 50 ? t.accent : t.bad, fontVariantNumeric: "tabular-nums", textShadow: "0 4px 16px rgba(0,0,0,.6)" }}>{Math.round(val)}%</div>
        <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 28, color: t.dim, marginTop: 6 }}>{data.meter.label}</div>
      </div>
      {bCues.map((c, i) => (
        <Sfx key={i} name="pop" at={c} volume={0.3} />
      ))}
      {data.verdict && <Sfx name="stamp" at={verdictAt} volume={0.5} />}
      <Sfx name="whoosh" at={smallAt} volume={0.3} />
      <Sfx name="success" at={smallAt + 20} volume={0.35} />
      {eCues.map((c, i) => (
        <Sfx key={`e${i}`} name="pop" at={c} volume={0.3} />
      ))}
      <Sfx name="ding" at={meterAt} volume={0.35} />
    </>
  );
};

export const ScopeShrink: CompDef<D> = {
  id: "scope-shrink",
  name: "目标缩小 · 成功率变高",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 12,
  tags: ["缩小目标", "别贪心", "小目标", "降维", "聚焦", "MVP"],
  motion: { kind: "野心球逐颗弹出涨大 → 红章拍下 → 全部坍缩成一颗旋转落定发光小方块，右侧成功率仪表涨满", energy: 3 },
  desc: "几个巨大的“野心球”（商城 / 外卖平台）撑满画面，右侧成功率仪表红色报警、盖章“找死”；说到小目标时大球全部坍缩成一颗发光小方块（指甲刀），仪表一路涨满",
  use: "目标越小越容易成功：新手做产品先做 MVP、减肥先定小目标、创业先打一个细分市场、学习先攻一个章节（big / small / meter 全可改）",
  schema,
  example: { big: [{ text: "商城" }, { text: "外卖平台" }], verdict: "找死", small: { text: "一个微小痛点", icon: "tool" }, examples: [{ text: "批量改图片名", icon: "image" }, { text: "核对表格金额", icon: "chart" }], meter: { label: "一次跑通率", from: 8, to: 92 } },
  C,
};
