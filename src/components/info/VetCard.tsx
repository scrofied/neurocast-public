import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const rule = z.object({
  name: z.string().describe("标准的名字，如“敢不敢亮账本”“有多少真实客户”“多久能回本”"),
  judge: z.string().optional().describe("判据小字，如“截图能验就算过”"),
  at: z.number().optional(),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  subject: z.string().describe("被审的对象：这个账号 / 这门课 / 我的报价 / 那个人"),
  subjectNote: z.string().optional(),
  rules: z.array(rule).min(1).max(4).describe("我先立下的几条标准"),
  marks: z.array(z.union([z.boolean(), z.null()])).optional().describe("被审对象对每条标准的判定：true 过 / false 不过 / null 待定"),
  subjectAt: z.number().optional().describe("对象被拉到卡旁的时刻"),
  markAt: z.number().optional().describe("开始逐条打分的时刻"),
  stamp: z.string().optional().describe("结论章：可验 / 割你 / 值得跟"),
  stampAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.rules.length;
  const cardX = full ? W * 0.1 : W * 0.04;
  const cardW = full ? W * 0.32 : W * 0.42;
  const cardTop = full ? H * 0.24 : H * 0.12;
  const rowH = full ? Math.min(96, (H * 0.44) / n) : 54;
  const cardH = 96 + rowH * n;
  const subjX = full ? W * 0.56 : W * 0.5;
  const subjW = full ? W * 0.3 : W * 0.42;
  const subjH = full ? H * 0.42 : H * 0.26;
  const subjTop = cardTop + (cardH - subjH) / 2;
  const ruleCues = data.rules.map((r, i) => cueOr(r.at, 8 + i * Math.round(Math.max(14, (dur * 0.34) / n))));
  const subjectAt = cueOr(data.subjectAt, ruleCues[n - 1] + 20);
  const markAt = cueOr(data.markAt, subjectAt + 18);
  const marks = data.marks ?? data.rules.map(() => null);
  const stampAt = cueOr(data.stampAt, markAt + n * 14 + 18);
  const subjP = easeInOut(prog(frame, subjectAt, 20));
  const sh = hitShake(frame, [stampAt], full ? 12 : 6, 12, seed);
  // beam from a rule row to the subject while it is being judged
  const beam = (() => {
    const i = Math.floor((frame - markAt) / 14);
    if (i < 0 || i >= n) return null;
    const k = clamp((frame - markAt - i * 14) / 14);
    return { i, k };
  })();

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* the blank card is erected first, then rules are carved in */}
        <div style={{ position: "absolute", left: cardX, top: cardTop, width: cardW, height: cardH, transform: `perspective(900px) rotateY(${lerp(-18, 0, easeOut(prog(frame, 0, 18)))}deg)`, transformOrigin: "0% 50%", borderRadius: 18, background: `linear-gradient(160deg, ${alpha(t.primary, 0.16)}, ${alpha(t.bg2, 0.95)})`, border: `3px solid ${alpha(t.primary, 0.7)}`, boxShadow: `0 0 40px ${alpha(t.primary, 0.25)}` }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 68, borderBottom: `2px solid ${alpha(t.primary, 0.35)}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.mono, fontSize: full ? 20 : 13, letterSpacing: 5, color: t.primary }}>标 准 卡</div>
          {data.rules.map((r, i) => {
            const c = ruleCues[i];
            if (frame < c) return null;
            const p = easeOut(prog(frame, c, 12));
            const fs = fitFont(r.name, cardW - 80, rowH * 0.44, 12);
            return (
              <div key={i} style={{ position: "absolute", left: 20, right: 20, top: 78 + i * rowH, height: rowH - 8, opacity: p, transform: `translateX(${(1 - p) * -30}px)`, display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${alpha(t.text, 0.12)}` }}>
                <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: fs * 0.9, color: t.accent }}>{String(i + 1).padStart(2, "0")}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap" }}>{r.name}</div>
                  {r.judge && <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: fs * 0.62, color: t.dim, whiteSpace: "nowrap" }}>{r.judge}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {/* subject card slides in from the right */}
        {frame >= subjectAt && (
          <div style={{ position: "absolute", left: lerp(W + subjW, subjX, subjP), top: subjTop, width: subjW, height: subjH, borderRadius: 18, background: `linear-gradient(160deg, ${alpha(t.accent, 0.18)}, ${alpha(t.bg2, 0.95)})`, border: `3px solid ${alpha(t.accent, 0.8)}`, boxShadow: `0 0 40px ${alpha(t.accent, 0.3)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ fontFamily: t.font.mono, fontSize: full ? 18 : 12, letterSpacing: 4, color: t.accent }}>被 审 对 象</div>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.subject, subjW * 0.8, full ? 46 : 24, 14), color: t.text, whiteSpace: "nowrap" }}>{data.subject}</div>
            {data.subjectNote && <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: full ? 22 : 13, color: t.dim, whiteSpace: "nowrap" }}>{data.subjectNote}</div>}
          </div>
        )}
        {/* judgement beams + check marks on the subject */}
        {beam && full && (() => {
          const ry = cardTop + 78 + beam.i * rowH + (rowH - 8) / 2;
          const my = subjTop + ((beam.i + 0.5) / n) * subjH;
          return (
            <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <path d={`M${cardX + cardW},${ry} C${cardX + cardW + 120},${ry} ${subjX - 100},${my} ${subjX},${my}`} stroke={t.accent} strokeWidth={4} fill="none" opacity={0.5 + 0.5 * Math.sin(beam.k * Math.PI)} style={{ filter: `drop-shadow(0 0 10px ${t.accent})` }} />
            </svg>
          );
        })()}
        {data.marks &&
          data.marks.map((m, i) => {
            const c = markAt + i * 14;
            if (frame < c + 8) return null;
            const my = subjTop + ((i + 0.5) / n) * subjH;
            const col = m === null ? t.gold : m ? t.primary : t.bad;
            return (
              <div key={i} style={{ position: "absolute", left: subjX + subjW + (full ? 22 : 10), top: my, transform: `translateY(-50%) scale(${easeOutBack(prog(frame, c + 8, 12))})`, width: full ? 54 : 30, height: full ? 54 : 30, borderRadius: "50%", background: alpha(col, 0.2), border: `3px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", color: col, fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 28 : 16, boxShadow: `0 0 18px ${alpha(col, 0.6)}` }}>
                {m === null ? "?" : m ? "✓" : "✗"}
              </div>
            );
          })}
        {/* verdict stamp */}
        {data.stamp && frame >= stampAt && (() => {
          const p = easeOut(prog(frame, stampAt, 7));
          const fs = fitFont(data.stamp, subjW * 1.1, full ? 96 : 44, 24);
          return (
            <div style={{ position: "absolute", left: subjX + subjW / 2, top: subjTop + subjH / 2, transform: `translate(-50%,-50%) rotate(${lerp(-14, -8, p)}deg) scale(${2 - p})`, opacity: clamp(p * 1.6), padding: `${fs * 0.16}px ${fs * 0.44}px`, border: `${Math.max(4, fs * 0.09)}px solid ${t.bad}`, borderRadius: fs * 0.2, background: "rgba(0,0,0,.5)", fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.bad, whiteSpace: "nowrap", textShadow: `0 0 26px ${alpha(t.bad, 0.7)}` }}>
              {data.stamp}
            </div>
          );
        })()}
      </div>
      {ruleCues.map((c, i) => (
        <Sfx key={`r${i}`} name="click" at={c} volume={0.3} />
      ))}
      <Sfx name="swish" at={subjectAt} volume={0.3} />
      {data.marks &&
        data.marks.map((m, i) => (
          <Sfx key={`m${i}`} name={m === false ? "glitch" : m === null ? "tick" : "ding"} at={markAt + i * 14 + 8} volume={m === false ? 0.3 : 0.26} />
        ))}
      {data.stamp && <Sfx name="stamp" at={stampAt} volume={0.5} />}
    </>
  );
};

export const VetCard: CompDef<D> = {
  id: "vet-card",
  name: "鉴伪卡（先立标准，再审对象）",
  layer: "info",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["标准", "筛", "对标", "鉴定", "敢不敢", "存疑"],
  motion: { kind: "空白卡立起 → 标准逐条刻入 → 对象滑入 → 光束逐条连过去打钩打叉 → 结论章盖下", energy: 2 },
  desc: "先立一张空白标准卡，随配音把几条标准逐条刻上去（每条还能带判据小字）；被审的对象（账号/课/报价）从右边滑进来，一道道光束按顺序连到对象上，逐条打 ✓ / ✗ / ?，最后卡片正中盖上结论章（可验 / 割你）",
  use: "先立规矩再检验：我给你三条标准，你拿去筛所有人——包括我；这个账号三条标准逐条对；敢不敢亮账本；五条标准看你该不该买",
  panel: true,
  schema,
  example: { subject: "这门课", subjectNote: "999 元 · 20 小时", rules: [{ name: "敢不敢亮账本", judge: "真实数据可截图" }, { name: "有没有真实客户", judge: "能联系到人" }, { name: "多久能回本", judge: "给出具体路径" }], marks: [true, true, null], stamp: "再看看" },
  C,
};
