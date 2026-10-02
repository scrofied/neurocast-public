import React from "react";
import { z } from "zod";
import { clamp, easeIn, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  mustSolve: z.array(z.string()).min(1).max(4).describe("左边：必须马上解决的痛（刚需），如“账单到期”“客户催货”"),
  niceToHave: z.array(z.string()).min(1).max(4).describe("右边：可有可无的（伪需求），如“PPT 更花哨”“头像更好看”"),
  painLabel: z.string().optional().describe("痛点的统一叫法，如“真需求”"),
  pillAt: z.number().optional().describe("药片落下的时刻"),
  verdict: z.string().optional().describe("结论，如“先卖止痛药”"),
  verdictAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const nL = data.mustSolve.length;
  const nR = data.niceToHave.length;
  const splitX = W * 0.5;
  const top = full ? H * 0.24 : H * 0.14;
  const G = full ? H * 0.78 : H * 0.8;
  const pillAt = cueOr(data.pillAt, Math.round(dur * 0.42));
  const verdictAt = cueOr(data.verdictAt, pillAt + 40);
  const sh = hitShake(frame, [pillAt], full ? 8 : 4, 12, seed);
  const panH = full ? H * 0.4 : H * 0.3;
  const panW = full ? W * 0.36 : W * 0.44;
  const painXs = Array.from({ length: nL }, (_, i) => W * (full ? 0.27 : 0.26));
  const painYs = Array.from({ length: nL }, (_, i) => top + (panH * (i + 0.5)) / nL);
  // 两侧标题淡入 / 结论从 0 弹出 = 元素入场；药片下落、痛点脉动、积灰结网是主体/持续动画不动
  const eLabL = enterAt(frame, 4, { fallback: "rise", dur: 14 });
  const eLabR = enterAt(frame, 4, { fallback: "rise", dur: 14 });
  const eVerdict = enterAt(frame, verdictAt, { fallback: "rise", dur: 14, from: 0 });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* split line */}
        <div style={{ position: "absolute", left: splitX - 1, top: top - (full ? 30 : 16), width: 2, height: panH + (full ? 60 : 32), background: alpha(t.text, 0.22) }} />

        {/* ── LEFT: red, throbbing pain ── */}
        <div style={{ position: "absolute", left: 0, top: top - (full ? 66 : 36), width: splitX, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 40 : 20, color: t.bad, opacity: eLabL.opacity, textShadow: `0 0 18px ${alpha(t.bad, 0.6)}` }}>
          {data.painLabel ?? "必须马上解决"}
        </div>
        {data.mustSolve.map((p, i) => {
          const c = cueOr(undefined, 8 + i * 10);
          if (frame < c) return null;
          const ePain = enterAt(frame, c, { fallback: "rise", dur: 12, from: 0, seed: i });
          // the pain throbs harder until a pill lands on it
          const cured = frame >= pillAt + 10 + i * 4;
          const cureK = cured ? clamp((frame - pillAt - 10 - i * 4) / 8) : 0;
          const beat = 1 + (cured ? 0 : 0.09 * Math.sin((frame - c) * 0.55));
          const fs = fitFont(p, W * (full ? 0.3 : 0.36), full ? 40 : 19, 11);
          return (
            <div key={i} style={{ position: "absolute", left: painXs[i], top: painYs[i], transform: `translate(-50%,-50%) translate(${ePain.dx}px, ${ePain.dy}px) scale(${ePain.scale * beat * (1 - cureK * 0.12)})`, display: "flex", alignItems: "center", gap: full ? 12 : 6, padding: `${full ? 10 : 5}px ${full ? 24 : 12}px`, borderRadius: 14, background: alpha(t.bad, 0.16 * (1 - cureK)), border: `3px solid ${alpha(t.bad, 0.85 * (1 - cureK) + 0.15)}`, boxShadow: `0 0 ${28 * (1 - cureK)}px ${alpha(t.bad, 0.6 * (1 - cureK))}`, opacity: 1 - cureK * 0.45 }}>
              <Icon name="fire" size={fs * 0.9} color={t.bad} />
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap", textDecoration: cured ? "line-through" : undefined }}>{p}</span>
            </div>
          );
        })}
        {/* falling pill */}
        {frame >= pillAt - 8 && (() => {
          const k = easeIn(prog(frame, pillAt - 8, 10));
          const x = W * (full ? 0.27 : 0.26);
          const y = lerp(top - (full ? 140 : 80), painYs[0], k);
          if (frame > pillAt + 6) return null;
          return <div style={{ position: "absolute", left: x, top: y + 40, transform: "translate(-50%,-50%) rotate(-18deg)", width: full ? 34 : 18, height: full ? 88 : 46, borderRadius: full ? 18 : 9, background: `linear-gradient(180deg, ${t.primary} 50%, #eaf6ff 50%)`, boxShadow: `0 0 24px ${alpha(t.primary, 0.8)}` }} />;
        })()}
        {/* heal flash */}
        {frame >= pillAt && frame < pillAt + 22 && (
          <div style={{ position: "absolute", left: painXs[0], top: painYs[0], transform: `translate(-50%,-50%) scale(${1 + prog(frame, pillAt, 22) * 2.4})`, width: full ? 120 : 60, height: full ? 120 : 60, borderRadius: "50%", border: `5px solid ${alpha(t.primary, 1 - prog(frame, pillAt, 22))}` }} />
        )}

        {/* ── RIGHT: grey, gathering dust ── */}
        <div style={{ position: "absolute", left: splitX, top: top - (full ? 66 : 36), width: splitX, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 40 : 20, color: t.dim, opacity: eLabR.opacity }}>
          可有可无
        </div>
        {data.niceToHave.map((p, i) => {
          const c = cueOr(undefined, 12 + i * 12);
          if (frame < c) return null;
          const eNice = enterAt(frame, c, { fallback: "rise", dur: 12, from: 0, seed: i });
          // dust accumulates on top of it
          const dust = clamp((frame - c) / 60);
          const fs = fitFont(p, W * (full ? 0.3 : 0.36), full ? 36 : 18, 10);
          const y = top + (panH * (i + 0.5)) / nR;
          return (
            <React.Fragment key={i}>
              <div style={{ position: "absolute", left: splitX + W * (full ? 0.23 : 0.22), top: y, transform: `translate(-50%,-50%) translate(${eNice.dx}px, ${eNice.dy}px) scale(${eNice.scale})`, display: "flex", alignItems: "center", gap: full ? 12 : 6, padding: `${full ? 10 : 5}px ${full ? 24 : 12}px`, borderRadius: 14, background: alpha(t.text, 0.05), border: `2px solid ${alpha(t.dim, 0.5)}`, opacity: 0.55 + 0.45 * (1 - dust * 0.5) }}>
                <Icon name="box" size={fs * 0.9} color={t.dim} />
                <span style={{ fontFamily: t.font.title, fontWeight: 800, fontSize: fs, color: t.dim, whiteSpace: "nowrap" }}>{p}</span>
                {/* dust settles on the card itself */}
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: full ? 14 : 8, borderRadius: 14, background: `linear-gradient(180deg, ${alpha("#b9a88a", 0.55 * dust)}, transparent)`, pointerEvents: "none" }} />
              </div>
              {/* spider web in the corner */}
              {dust > 0.5 && i === 0 && (
                <svg width={full ? 120 : 70} height={full ? 90 : 52} style={{ position: "absolute", left: splitX + panW / 2 - (full ? 120 : 70), top: top - (full ? 20 : 10), opacity: (dust - 0.5) * 1.6 }}>
                  {Array.from({ length: 4 }, (_, q) => <line key={q} x1={0} y1={0} x2={(full ? 120 : 70) * (q % 2 ? 1 : 0.8)} y2={((full ? 90 : 52) * (q + 1)) / 4} stroke={alpha("#cfd8dd", 0.5)} strokeWidth={1.4} />)}
                  {Array.from({ length: 3 }, (_, q) => <path key={q} d={`M${(full ? 120 : 70) * 0.25} ${(full ? 90 : 52) * 0.12} Q ${(full ? 120 : 70) * 0.5} ${(full ? 90 : 52) * (0.2 + q * 0.24)} ${(full ? 120 : 70) * 0.75} ${(full ? 90 : 52) * 0.12}`} fill="none" stroke={alpha("#cfd8dd", 0.42)} strokeWidth={1.2} />)}
                </svg>
              )}
            </React.Fragment>
          );
        })}

        {data.verdict && frame >= verdictAt && (
          <div style={{ position: "absolute", left: 0, right: 0, top: G + (full ? 20 : 10), textAlign: "center", transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`, opacity: eVerdict.opacity, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.7, full ? 62 : 30, 16), color: t.bad, whiteSpace: "nowrap", textShadow: `0 0 26px ${alpha(t.bad, 0.6)}, 0 3px 0 #000` }}>{data.verdict}</div>
        )}
      </div>
      {data.mustSolve.map((_, i) => (
        <Sfx key={`m${i}`} name="pop" at={8 + i * 10} volume={0.24} />
      ))}
      <Sfx name="ding" at={pillAt + 10} volume={0.4} />
      {data.niceToHave.map((_, i) => (
        <Sfx key={`n${i}`} name="tick" at={12 + i * 12} volume={0.18} />
      ))}
      {data.verdict && <Sfx name="stamp" at={verdictAt} volume={0.4} />}
    </>
  );
};

export const Painkiller: CompDef<D> = {
  id: "painkiller",
  name: "止痛药 vs 保健品",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["刚需", "伪需求", "止痛药", "保健品", "真需求", "可有可无"],
  motion: { kind: "痛点脉动 → 药片落下击中即灭 → 保健品侧积灰结网", energy: 2 },
  desc: "左右分屏：左边红色的痛点在跳动（账单到期/客户催货），一颗药片落下正中痛点、痛立刻灭掉并划线；右边的需求卡片静静摆着、慢慢积上灰层、角落结出蛛网；底部结论",
  use: "分辨刚需和伪需求：找必须马上解决的止痛药，别卖可有可无的保健品；这个功能是刚需还是自嗨；先解决谁的什么问题",
  panel: true,
  schema,
  example: { mustSolve: ["账单到期", "客户催货"], niceToHave: ["界面更花哨", "头像更好看"], verdict: "先卖止痛药" },
  C,
};
