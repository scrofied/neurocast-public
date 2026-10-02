import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import { useEnter } from "../../lib/enter";
import type { CompDef, CompProps } from "../types";

const check = z.object({
  name: z.string().describe("刻度名：投入产出比 / 回本周期 / 有没有人买"),
  verdict: z.union([z.boolean(), z.null()]).optional().describe("这一格的判定：true 过 / false 不过 / null 待测"),
  note: z.string().optional().describe("读数小字，如“3 个月”"),
  at: z.number().optional(),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  object: z.string().describe("被量的东西：这门课 / 这个坑 / 我的报价 / 这个人"),
  objectNote: z.string().optional(),
  checks: z.array(check).min(1).max(5).describe("尺子上的刻度，逐条压上去量"),
  verdict: z.string().optional().describe("最后的读数结论，如“坑深 3 万”"),
  verdictAt: z.number().optional(),
  dropAt: z.number().optional().describe("尺子压下来的时刻"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.checks.length;
  const dropAt = cueOr(data.dropAt, 10);
  const cues = data.checks.map((c, i) => Math.max(dropAt + 8, cueOr(c.at, dropAt + 12 + i * Math.round(Math.max(14, (dur * 0.55) / n)))));
  const verdictAt = cueOr(data.verdictAt, cues[n - 1] + 24);
  // the object sits on the left, the ruler drops onto it from above
  const objW = full ? W * 0.32 : W * 0.4;
  const objH = full ? H * 0.42 : H * 0.26;
  const objX = full ? W * 0.1 : W * 0.06;
  const objY = full ? H * 0.36 : H * 0.26;
  const ruleW = full ? W * 0.44 : W * 0.5;
  const ruleX = objX + objW * 0.92;
  const ruleTop = full ? H * 0.22 : H * 0.14;
  const rowH = full ? Math.min(104, (H * 0.5) / n) : 58;
  const ruleH = 60 + rowH * n;
  const dropP = easeInOut(prog(frame, dropAt, 18));
  const ruleY = lerp(ruleTop - (full ? 300 : 160), ruleTop, dropP);
  const sh = hitShake(frame, [dropAt + 18], full ? 12 : 6, 14, seed);
  // scanning highlight sweeps down the ruler as it measures
  const scanY = ruleTop + 60 + clamp((frame - dropAt - 18) / Math.max(30, cues[n - 1] - dropAt)) * rowH * n;
  // 「尺子从上方压下」是隐喻主体的运动轨迹，保持原样不接动效层；
  // 这里接的是被测对象卡（原生 0.94→1 淡入）与最后的读数（原生从 0 回弹弹出）
  const eObj = enterAt(frame, 0, { fallback: "rise", dur: 14, from: 0.94 });
  const eVerdict = enterAt(frame, verdictAt, { fallback: "rise", dur: 14, from: 0 });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* object being measured */}
        <div style={{ position: "absolute", left: objX, top: objY, width: objW, height: objH, borderRadius: 18, background: `linear-gradient(160deg, ${alpha(t.accent, 0.2)}, ${alpha(t.bg2, 0.95)})`, border: `3px solid ${alpha(t.accent, 0.8)}`, boxShadow: `0 0 40px ${alpha(t.accent, 0.3)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, opacity: eObj.opacity, transform: `translate(${eObj.dx}px, ${eObj.dy}px) scale(${eObj.scale})` }}>
          <div style={{ fontFamily: t.font.mono, fontSize: full ? 18 : 12, letterSpacing: 4, color: t.accent }}>待 测</div>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.object, objW * 0.82, full ? 48 : 24, 14), color: t.text, whiteSpace: "nowrap" }}>{data.object}</div>
          {data.objectNote && <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: full ? 22 : 13, color: t.dim, whiteSpace: "nowrap" }}>{data.objectNote}</div>}
        </div>
        {/* caliper arms reaching from the ruler to the object */}
        {dropP > 0.9 && (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {data.checks.map((c, i) => {
              const c0 = cues[i];
              if (frame < c0) return null;
              const p = easeOut(prog(frame, c0, 12));
              const y = ruleY + 60 + i * rowH + rowH / 2;
              const col = c.verdict === false ? t.bad : c.verdict === true ? t.primary : t.gold;
              return <line key={i} x1={objX + objW} y1={y} x2={lerp(objX + objW, ruleX, p)} y2={y} stroke={col} strokeWidth={3} strokeDasharray="7 7" opacity={0.85} style={{ filter: `drop-shadow(0 0 6px ${col})` }} />;
            })}
          </svg>
        )}
        {/* the ruler */}
        <div style={{ position: "absolute", left: ruleX, top: ruleY, width: ruleW, height: ruleH, borderRadius: 16, background: `linear-gradient(180deg, ${alpha(t.text, 0.14)}, ${alpha(t.bg2, 0.92)})`, border: `3px solid ${alpha(t.text, 0.7)}`, boxShadow: `0 20px 60px rgba(0,0,0,.6)`, overflow: "hidden", backdropFilter: "blur(6px)" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 60, borderBottom: `2px solid ${alpha(t.text, 0.3)}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.mono, fontSize: full ? 22 : 14, letterSpacing: 6, color: t.text }}>量 一 量</div>
          {/* tick marks down the left edge, like a real ruler */}
          <svg width={60} height={ruleH} style={{ position: "absolute", left: 0, top: 0 }}>
            <GlowDefs id="mr" std={4} user />
            {Array.from({ length: Math.floor(ruleH / 12) }, (_, i) => (
              <line key={i} x1={0} y1={i * 12} x2={i % 5 === 0 ? 26 : 14} y2={i * 12} stroke={alpha(t.text, i % 5 === 0 ? 0.7 : 0.35)} strokeWidth={i % 5 === 0 ? 2.5 : 1.5} />
            ))}
          </svg>
          {data.checks.map((c, i) => {
            const c0 = cues[i];
            if (frame < c0) return null;
            // 刻度行原生是从右边 30px 推进来 + 回弹淡入
            const eRow = enterAt(frame, c0, { fallback: "slide-r", dur: 14, dist: 0.125, seed: i });
            const col = c.verdict === false ? t.bad : c.verdict === true ? t.primary : t.gold;
            const mark = c.verdict === false ? "✗" : c.verdict === true ? "✓" : "?";
            const fs = fitFont(c.name, ruleW - 190, rowH * 0.4, 13);
            const y = 60 + i * rowH;
            return (
              <div key={i} style={{ position: "absolute", left: 56, right: 16, top: y, height: rowH - 6, transform: `translate(${eRow.dx}px, ${eRow.dy}px)`, opacity: eRow.opacity, display: "flex", alignItems: "center", gap: full ? 14 : 8, borderBottom: `1px solid ${alpha(t.text, 0.12)}` }}>
                <div style={{ width: full ? 44 : 26, height: full ? 44 : 26, borderRadius: "50%", background: alpha(col, 0.2), border: `2.5px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", color: col, fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 24 : 14, boxShadow: `0 0 16px ${alpha(col, 0.55)}`, flexShrink: 0 }}>{mark}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap" }}>{c.name}</div>
                  {c.note && <div style={{ fontFamily: t.font.mono, fontWeight: 800, fontSize: fs * 0.72, color: col, whiteSpace: "nowrap" }}>{c.note}</div>}
                </div>
              </div>
            );
          })}
          {/* scan sweep */}
          {frame >= dropAt + 18 && frame < cues[n - 1] + 10 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: scanY, height: 3, background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`, boxShadow: `0 0 18px ${t.accent}` }} />
          )}
        </div>
        {/* verdict reading */}
        {data.verdict && frame >= verdictAt && (
          <div style={{ position: "absolute", left: ruleX, top: ruleY + ruleH + (full ? 36 : 18), transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`, opacity: eVerdict.opacity, transformOrigin: "0 50%", display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontFamily: t.font.mono, fontSize: full ? 24 : 14, letterSpacing: 4, color: t.dim }}>读数</span>
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.44, full ? 76 : 34, 18), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 26px ${alpha(t.gold, 0.7)}, 0 3px 0 #000` }}>{data.verdict}</span>
          </div>
        )}
      </div>
      <Sfx name="whoosh" at={dropAt} volume={0.3} />
      <Sfx name="stamp" at={dropAt + 18} volume={0.35} />
      {cues.map((c, i) => (
        <Sfx key={i} name={data.checks[i].verdict === false ? "glitch" : "tick"} at={c} volume={0.28} />
      ))}
      {data.verdict && <Sfx name="ding" at={verdictAt} volume={0.35} />}
    </>
  );
};

export const MeasureRuler: CompDef<D> = {
  id: "measure-ruler",
  name: "拿尺子量一量",
  layer: "info",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["量一量", "尺子", "刻度", "标准", "多深", "读数"],
  motion: { kind: "尺子从上方压下 → 刻度逐条判定打钩打叉 → 卡尺连到对象 → 读数定格", energy: 2 },
  desc: "一把带刻度的透明尺从上方压到被量的对象上，尺上写着几条标准，随配音逐条亮出判定（✓ / ✗ / ?）和读数小字，一条条虚线卡尺从尺子连到对象；量完在尺下给出读数",
  use: "拿标准去量一个东西：量一量这个坑到底有多深、三条标准逐条对、用这把尺子筛一遍、验收的几条硬指标",
  panel: true,
  schema,
  example: { object: "这个坑", objectNote: "报名的课", checks: [{ name: "投入产出比", verdict: false, note: "ROI < 1" }, { name: "回本周期", verdict: true, note: "3 个月" }, { name: "有没有人买", verdict: null, note: "待验证" }], verdict: "坑深 3 万" },
  C,
};
