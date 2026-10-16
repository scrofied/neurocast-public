import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, lerp, prog, rng } from "../../lib/anim";
import { hitShake, StampBox } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const baseItem = z.object({
  text: z.string().describe("这块底座上写的字（一个基础岗位 / 一层地基）"),
  icon: z.string().optional().describe("图标名，缺省按文字猜"),
  at: z.number().optional().describe("这块底座进场的时刻（锚点）"),
});
const midItem = z.object({
  text: z.string().describe("中层能力块上写的字"),
  at: z.number().optional().describe("中层块进场的时刻（锚点）"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  base: z.array(baseItem).min(2).max(5).describe("塔底的底座块，一块一块进场，排成塔底一层（必填，2~5 块）"),
  mid: z.array(midItem).max(3).default([]).describe("中层能力块，底座之后逐块进场（0~3 块）"),
  top: z
    .object({
      label: z.string().describe("塔尖上的字（站在塔尖的核心能力/顶端角色）"),
      note: z.string().optional().describe("塔尖里的小字补充"),
      at: z.number().optional().describe("塔尖落位的时刻（锚点）"),
    })
    .optional()
    .describe("塔尖（骨干）"),
  axeLabel: z.string().default("AI").describe("光刃上写的字：切掉底座的那股力量，默认 AI"),
  cutAt: z.number().optional().describe("光刃开始横扫塔底的时刻（锚点）"),
  verdict: z.string().optional().describe("结论大字，如“底座没了，塔尖就是幻觉”"),
  verdictAt: z.number().optional().describe("结论大字砸下的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;

  // ── 时间轴：显式锚点优先，缺省按 dur 比例自动错开 ──
  const baseCues = listCues(data.base, 6, dur * 0.22);
  const midCues = listCues(data.mid, dur * 0.26, dur * 0.33);
  const topAt = cueOr(data.top?.at, dur * 0.36);
  const litAt = topAt + 10;
  const sweep = Math.round(clamp(dur * 0.08, 12, 24));
  const cutAt = Math.min(cueOr(data.cutAt, Math.max(dur * 0.55, litAt + 16)), dur - 34);
  const sinkStart = cutAt + sweep + 2;
  const vAt = Math.min(cueOr(data.verdictAt, Math.max(sinkStart + 12, dur * 0.78)), dur - 14);

  // ── 几何：金字塔 = 底层块一排 + 中层 + 三角塔尖，全部按 useBox 比例算 ──
  const G = H * 0.795; // 地平线（贴安全区上沿：1080 时 859，塔体再往下都不越过 935）
  const cx = W * (full ? 0.44 : 0.5);
  const bw = W * (full ? 0.46 : 0.82); // 塔底宽
  const bh = H * (full ? 0.118 : 0.12); // 一层的高度
  const gp = bw * 0.02; // 块间距
  const nb = data.base.length;
  const nm = data.mid.length;
  const blockW = (bw - (nb - 1) * gp) / nb;
  const mw = bw * 0.72;
  const midW = nm ? (mw - (nm - 1) * gp) / nm : 0;
  const topW = bw * 0.44;
  const topH = bh * 1.55;
  const topBase = G - bh * (nm ? 2 : 1); // 塔尖底边所在层

  const jit = useMemo(() => {
    const r = rng(seed + 7);
    return Array.from({ length: 16 }, () => ({ dx: r() - 0.5, v: r(), rot: r() - 0.5 }));
  }, [seed]);

  // 光刃横扫：tip 位置随 sweepK 从左到右；每块底座在刃尖扫到自己时开始碎裂坠落
  const xa = cx - bw / 2 - bw * 0.14;
  const xb = cx + bw / 2 + bw * 0.14;
  const sk = prog(frame, cutAt, sweep);
  const tipX = lerp(xa, xb, easeInOut(sk));
  const cutY = G - bh * 0.5;
  const fallAt = (i: number) => {
    const xc = cx - bw / 2 + i * (blockW + gp) + blockW / 2;
    return cutAt + sweep * clamp((xc - xa) / (xb - xa));
  };

  const lit = prog(frame, litAt, 12); // 整体点亮 0→1
  const sink = easeOut(prog(frame, sinkStart, 20)); // 塔体下沉 0→1
  const dy = sink * bh; // 掉进被切掉的底层高度
  const tilt = sink * (full ? 6 : 4) + (sink >= 1 ? Math.sin((frame - sinkStart) / 22) * 0.7 : 0); // 倾斜 + 停稳后余晃
  const drift = frame >= litAt && sink === 0 ? Math.sin((frame - litAt) / 15) * (full ? 4 : 2) : 0; // 亮起来后的常动
  const sh = hitShake(frame, [cutAt, sinkStart + 14], full ? 12 : 6, 12, seed);

  const baseX = (i: number) => cx - bw / 2 + i * (blockW + gp);
  const midX = (j: number) => cx - mw / 2 + j * (midW + gp);

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="pb-ground" std={6} user />
          <line x1={W * 0.04} y1={G} x2={W * 0.96} y2={G} stroke={alpha(t.primary, 0.5)} strokeWidth={3} filter="url(#pb-ground)" />
        </svg>

        {/* 整座塔（drift 常动挂在塔组上，碎裂的底座、下沉的中上层都在里面） */}
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${drift}px)` }}>
          {/* ── 底座层：一块块进场，刃尖扫过后碎裂滑落出画面 ── */}
          {data.base.map((b, i) => {
            const c = baseCues[i];
            if (frame < c) return null;
            const e = enterAt(frame, c, { fallback: "rise", dur: 15, seed: i });
            const x = baseX(i);
            const fk = prog(frame, fallAt(i), 32);
            const dir = x + blockW / 2 <= cx ? -1 : 1;
            const fall = `translate(${easeIn(fk) * dir * bw * 0.9}px, ${easeIn(fk) * H * 0.42}px) rotate(${dir * 52 * fk}deg)`;
            const ic = b.icon ?? guessIcon(b.text) ?? "box";
            const fs = fitFont(b.text, blockW - (full ? 40 : 22), full ? 23 : 14, 9);
            return (
              <React.Fragment key={`b${i}`}>
                <div
                  style={{
                    position: "absolute",
                    left: x,
                    top: G - bh,
                    width: blockW,
                    height: bh,
                    opacity: e.opacity * (1 - clamp(fk * 2.8 - 0.9)),
                    transform: `scale(${e.scale}) translate(${e.dx}px, ${e.dy}px)${fk > 0 ? ` ${fall}` : ""}`,
                    clipPath: e.clip,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      clipPath: "polygon(7% 0, 93% 0, 100% 100%, 0 100%)",
                      background: `linear-gradient(180deg, ${alpha(t.primary, 0.14 + 0.3 * lit * e.p)}, ${alpha(t.bg2, 0.92)} 90%)`,
                      borderTop: `2px solid ${alpha(t.primary, 0.35 + 0.55 * lit * e.p)}`,
                      boxShadow: fk > 0 ? `0 0 26px ${alpha(t.bad, 0.55)}` : `inset 0 0 ${18 * lit}px ${alpha(t.primary, 0.25)}`,
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      gap: full ? 8 : 4,
                      paddingBottom: bh * 0.12,
                    }}
                  >
                    <Icon name={ic} size={bh * (full ? 0.34 : 0.3)} color={fk > 0.1 ? t.bad : t.primary} />
                    <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap" }}>{b.text}</span>
                  </div>
                </div>
                {/* 碎裂飞出的小三角块 */}
                {fk > 0.02 &&
                  fk < 0.9 &&
                  Array.from({ length: 3 }, (_, q) => {
                    const j = jit[(i * 3 + q) % 16];
                    const kk = easeOut(clamp(fk * 1.8));
                    const sx = x + blockW / 2 + j.dx * bw * 0.55 * kk + dir * (12 + q * 22) * kk;
                    const sy = G - bh * 0.45 - (30 + j.v * 70) * kk + kk * kk * H * 0.22;
                    return (
                      <div
                        key={`s${i}-${q}`}
                        style={{
                          position: "absolute",
                          left: sx,
                          top: sy,
                          width: full ? 18 : 10,
                          height: full ? 18 : 10,
                          background: alpha(q % 2 ? t.bad : t.gold, 0.9),
                          clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
                          opacity: 1 - clamp(fk * 1.7),
                          transform: `rotate(${j.v * 420 * fk}deg)`,
                        }}
                      />
                    );
                  })}
              </React.Fragment>
            );
          })}

          {/* ── 中上层：切掉底座后整体下沉 + 倾斜（transform-origin 在塔底中心） ── */}
          <div style={{ position: "absolute", inset: 0, transform: `translateY(${dy}px) rotate(${tilt}deg)`, transformOrigin: `${cx}px ${G}px` }}>
            {data.mid.map((m, j) => {
              const c = midCues[j];
              if (frame < c) return null;
              const e = enterAt(frame, c, { fallback: "rise", dur: 15, seed: j + 5 });
              const x = midX(j);
              const fs = fitFont(m.text, midW - (full ? 24 : 14), full ? 21 : 13, 9);
              return (
                <div
                  key={`m${j}`}
                  style={{
                    position: "absolute",
                    left: x,
                    top: G - 2 * bh,
                    width: midW,
                    height: bh,
                    opacity: e.opacity,
                    transform: `scale(${e.scale}) translate(${e.dx}px, ${e.dy}px) rotate(${e.rot}deg)`,
                    clipPath: e.clip,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0 100%)",
                      background: `linear-gradient(180deg, ${alpha(t.secondary, 0.18 + 0.26 * lit * e.p)}, ${alpha(t.bg2, 0.9)})`,
                      borderTop: `2px solid ${alpha(t.secondary, 0.35 + 0.5 * lit * e.p)}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: full ? 6 : 3,
                    }}
                  >
                    <Icon name={guessIcon(m.text) ?? "layers"} size={bh * (full ? 0.3 : 0.26)} color={t.secondary} />
                    <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap" }}>{m.text}</span>
                  </div>
                </div>
              );
            })}

            {data.top && (() => {
              const c = topAt;
              if (frame < c) return null;
              // 塔尖原生是从天上落下扣上（drop），分镜 motion.enter 可覆盖
              const e = enterAt(frame, c, { fallback: "drop", dur: 16 });
              const fs = fitFont(data.top.label, topW * 0.78, full ? 26 : 15, 10);
              const nfs = fitFont(data.top.note ?? "", topW * 0.86, full ? 16 : 10, 8);
              return (
                <div
                  style={{
                    position: "absolute",
                    left: cx - topW / 2,
                    top: topBase - topH,
                    width: topW,
                    height: topH,
                    opacity: e.opacity,
                    transform: `scale(${e.scale}) translate(${e.dx}px, ${e.dy}px) rotate(${e.rot}deg)`,
                    clipPath: e.clip,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
                      background: `linear-gradient(180deg, ${alpha(t.gold, 0.3 + 0.45 * lit * e.p)}, ${alpha(t.gold, 0.1)})`,
                      filter: lit > 0 && frame < sinkStart ? `drop-shadow(0 0 ${14 * lit}px ${alpha(t.gold, 0.7)})` : undefined,
                    }}
                  />
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: topH * 0.09, textAlign: "center" }}>
                    <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap", textShadow: `0 0 16px ${alpha(t.gold, 0.8)}` }}>{data.top.label}</div>
                    {data.top.note && full && (
                      <div style={{ marginTop: 3, fontFamily: t.font.body, fontWeight: 700, fontSize: nfs, color: t.dim, whiteSpace: "nowrap" }}>{data.top.note}</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── 光刃：写着 axeLabel，贴着塔底横扫 ── */}
        {frame >= cutAt && sk < 1 && (
          <>
            <div
              style={{
                position: "absolute",
                left: Math.max(xa, tipX - W * 0.18),
                top: cutY - 2,
                width: Math.max(0, tipX - Math.max(xa, tipX - W * 0.18)),
                height: 4,
                background: `linear-gradient(90deg, transparent, ${alpha(t.accent, 0.75)})`,
                boxShadow: `0 0 18px ${alpha(t.accent, 0.6)}`,
              }}
            />
            <div style={{ position: "absolute", left: tipX, top: cutY, transform: "translate(-50%,-50%)" }}>
              <div style={{ width: full ? 9 : 6, height: bh * 1.7, margin: "0 auto", borderRadius: 8, background: `linear-gradient(180deg, ${t.accent}, #fff 50%, ${t.accent})`, boxShadow: `0 0 26px ${t.accent}, 0 0 60px ${alpha(t.accent, 0.5)}` }} />
              <div style={{ position: "absolute", left: "50%", top: -bh * 0.85, transform: "translateX(-50%)", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.axeLabel, W * 0.2, full ? 34 : 18, 12), color: t.accent, whiteSpace: "nowrap", textShadow: `0 0 18px ${alpha(t.accent, 0.9)}, 0 3px 0 #000` }}>{data.axeLabel}</div>
            </div>
          </>
        )}

        {/* 塌落的尘土 */}
        {frame >= sinkStart &&
          prog(frame, sinkStart, 36) < 1 &&
          Array.from({ length: 9 }, (_, q) => {
            const j = jit[(q * 5 + 3) % 16];
            const k = prog(frame, sinkStart + q * 2, 30);
            return (
              <div
                key={`d${q}`}
                style={{
                  position: "absolute",
                  left: cx + j.dx * bw * 1.25 - k * j.dx * bw * 0.3,
                  top: G - k * H * 0.055 * (0.4 + j.v),
                  width: (full ? 16 : 9) * (0.5 + j.v),
                  height: (full ? 16 : 9) * (0.5 + j.v),
                  borderRadius: "50%",
                  background: alpha(t.dim, 0.4),
                  opacity: (1 - k) * 0.7,
                }}
              />
            );
          })}

        {/* 结论砸章 */}
        {data.verdict && <StampBox frame={frame} at={vAt} text={data.verdict} color={t.bad} x={full ? W * 0.78 : W * 0.5} y={full ? H * 0.44 : H * 0.62} size={full ? 64 : 32} maxW={full ? W * 0.34 : W * 0.8} rot={-4} />}
      </div>

      {baseCues.map((c, i) => (
        <Sfx key={`bp${i}`} name="pop" at={c} volume={0.25} />
      ))}
      {midCues.map((c, i) => (
        <Sfx key={`mp${i}`} name="pop" at={c} volume={0.22} />
      ))}
      {data.top && <Sfx name="sparkle" at={litAt} volume={0.24} />}
      <Sfx name="glitch" at={cutAt} volume={0.4} />
      <Sfx name="impact" at={sinkStart + 10} volume={0.38} />
      {data.verdict && <Sfx name="ding" at={vAt} volume={0.32} />}
    </>
  );
};

export const PyramidBase: CompDef<D> = {
  id: "pyramid-base",
  name: "金字塔底座（切掉地基）",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 24,
  tags: ["金字塔", "底座", "切掉", "基础层", "人才梯队", "地基"],
  motion: { kind: "分层块逐层进场塔在长 → 写着 axeLabel 的光刃横扫塔底 → 底座碎裂滑落出画面、塔体下沉倾斜 → 结论砸章", energy: 3 },
  desc: "一座由分层块组成的金字塔：底座块一块块进场排成塔底，中层块和塔尖（label+note）随后落位，整座塔亮起来轻轻常动；cutAt 一道写着 axeLabel 的光刃贴着塔底横扫过去，底座块碎裂、滑落出画面，塔体下沉并倾斜，最后 verdict 大字砸下",
  use: "讲「底层被切掉、上面站不住」：AI 切掉初级岗位这个底座、平台砍掉小创作者层、组织裁掉执行层、基础学科没人学顶端却想要诺奖",
  schema,
  example: {
    title: "被切掉的底座",
    kicker: "人才梯队",
    base: [{ text: "实习生" }, { text: "应届生" }, { text: "初级运营" }, { text: "外包执行" }],
    mid: [{ text: "项目经验" }, { text: "资深骨干" }],
    top: { label: "顶尖操盘手", note: "全是底座喂出来的" },
    axeLabel: "AI",
    verdict: "底座没了，塔尖就是幻觉",
  },
  C,
};
