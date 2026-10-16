import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeIn, easeOut, lerp, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Rise } from "../../lib/rise";
import { Sfx } from "../../lib/sfx";
import { eoX, eioX } from "../../lib/spring";
import { alpha, useTheme } from "../../lib/theme";
import { textEm, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 出处：opus-5-5-motion-gallery/v08-kinetic-type《BUILD THE FLOOR》/ @TechHalla，X 经 YouMind 收录 2026-09-25 https://youmind.com/video-prompts/kinetic-typography-speech-film-11293
// 片库整理：小红书 AI伐木工（jinhanbuilds/opus-5-5-motion-gallery）；逐条机制对照见 docs/OPUS55_ANIMATIONS.md 一·c。
// 移植自 opus-5-5-motion-gallery/v08-kinetic-type《BUILD THE FLOOR》。
// 它的赌注很大：**画面上没有图形，只有文字**，但每一句都改变画面的结构，
// 最后一句真的站在前面那些字搭出来的「地板」上。承重的字（WAIT→WEIGHT→ROOM→FLOOR）
// 全部参与几何，说话的字只是被读出来。三条照搬：
//   1) 字号由**目标宽度反解**（fitFont 就是 v08 的 fit()），构件边界由字高反推 ⇒ 换任何文案都自洽；
//   2) 坠落用物理算：grav = 2·Δh/Δt²，保证「说到那句的时刻」正好落地，不是估的；
//   3) 落地的震屏是确定性衰减 sin（5·e^(-16τ)·sin(70τ)），比随机抖屏干净得多。

const line = z.object({
  text: z.string().max(24).describe("说的一句话（≤24 字，它是被读出来的，不参与承重）"),
  at: z.number().optional().describe("这句出现的时刻（锚点）"),
});
const schema = z.object({
  hang: z.string().max(6).describe("被吊着的词 —— 先悬着、摆动、然后坠落，如「等待」「加班」"),
  floor: z.string().max(8).describe("坠落后摊开当地板的词，如「三年等待」。它撑满画面宽度，成为地基"),
  pillars: z.array(z.string().max(8)).min(1).max(2).describe("竖着长出来的柱子（1~2 根），如「没人看」「还得上班」"),
  beam: z.string().max(6).describe("最后落下来的横梁上抠出的字，如「地板」「门槛」"),
  lines: z.array(line).min(1).max(4).describe("说话的句子：第一句在结构之前，后面的句子站在地基上"),
  verdict: z.string().max(16).describe("站在梁上的最后一句（结论）"),
  kicker: z.string().optional(),
  title: z.string().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const s = frame / fps;

  const GUT = full ? 96 : 20;
  const W = width - GUT * 2;
  const BASE = height - 175; // 地面（逐字字幕带之上）
  const TOP = full ? 250 : 96; // 顶部留给标题，这块「文字工地」只能在标题之下展开
  const AVAIL = Math.max(220, BASE - TOP);

  // 竖向预算自下而上算，每一块都留在画面里（换任何文案都不越界）：
  //   地基（floor）→ 柱子（pillars）→ 横梁（beam）→ 结论（verdict）站在梁上
  const fSize = Math.min(W / Math.max(1, textEm(data.floor)), AVAIL * 0.3);
  const FT = BASE - fSize * 1.08; // 地基顶：整块字都在地面线以上
  const CH = Math.min(AVAIL * 0.3, 240);
  const CT = FT - CH;
  const DH = clamp(AVAIL * 0.12, 50, 96);
  const DT = CT - DH;
  const pFs = (p: string) => Math.min(CH / Math.max(1, textEm(p)), full ? 92 : 40);
  const pW = Math.max(...data.pillars.map((p) => pFs(p) * 1.35));
  const VW = Math.min(full ? 86 : 34, (W - pW * 2) / Math.max(1, textEm(data.verdict)));

  const tHang = cueOr(data.lines[0] ? (data.lines[0].at ?? 0) + 26 : 26, Math.round(dur * 0.1));
  const tSnap = Math.round(dur * 0.34);
  const tLand = tSnap + Math.round(fps * 0.45);
  const tMorph = tLand + 6;
  const tPillar = tLand + Math.round(fps * 0.9);
  const cues = listCues(data.lines, 10, Math.max(40, dur * 0.5));
  const lineAt = (i: number) => cueOr(data.lines[i].at, i === 0 ? 10 : Math.round(lerp(cues[1] ?? tMorph, tPillar + 40, i / Math.max(1, data.lines.length - 1))));
  const tBeam = Math.round(dur * 0.7);
  const tVerdict = tBeam + Math.round(fps * 0.55);

  // ── 悬挂：绕顶端支点摆动，绳子随画面收窄 ──────────────────────────────────
  const hangSize = Math.min(W * 0.32 / Math.max(1, textEm(data.hang)), 150);
  const hangCap = hangSize * 0.82;
  const hx = GUT + W * 0.62;
  const hangTop0 = TOP + 40;
  const tSnapS = tSnap / fps;
  const tLandS = tLand / fps;
  const grav = (2 * (FT - hangCap - hangTop0)) / Math.max(0.01, tLandS - tSnapS) ** 2;
  const hangAng = 0.02 * Math.sin((s - tSnapS) * 2.6) * prog(s, tHang / fps, 0.5) * (1 - prog(s, tSnapS - 0.5, tSnapS));
  const topY = s < tSnapS ? hangTop0 : s < tLandS ? hangTop0 + 0.5 * grav * (s - tSnapS) ** 2 : FT - hangCap;
  const hold = Math.max(0, Math.min(s, tSnapS) - tHang / fps);
  const cordRetract = 1 - eoX(prog(s, tSnapS, tSnapS + 0.35));

  // ── 落地 / 落梁的确定性震屏 ───────────────────────────────────────────────
  const tau1 = s - tLandS;
  const tau2 = s - tBeam / fps - 0.28;
  const shake = (tau1 > 0 && tau1 < 0.35 ? 5 * Math.exp(-tau1 * 16) * Math.sin(tau1 * 70) : 0) + (tau2 > 0 && tau2 < 0.35 ? 3 * Math.exp(-tau2 * 18) * Math.sin(tau2 * 70) : 0);

  const morphK = eioX(prog(s, tMorph / fps, tMorph / fps + 0.5));
  const landK = easeOut(prog(frame, tMorph, 22));
  const pillarK = (i: number) => 1 - Math.exp(-prog(s, tPillar / fps + i * 0.18, tPillar / fps + i * 0.18 + 0.9) * 4);
  const beamY = lerp(-DH - 60, DT, easeIn(prog(s, tBeam / fps, tBeam / fps + 0.28)));
  const eVerdict = enterAt(frame, tVerdict, { fallback: "rise", dur: 18 });

  const speak = (size: number) => ({ fontFamily: t.font.body, fontWeight: 400, fontSize: size, color: t.text });
  const lineSize = Math.min(full ? 58 : 26, (CH * 0.7) / Math.max(1, data.lines.length - 1));
  const lineX = (i: number) => GUT + pW + (i % 2 ? 66 : 30); // 站在地基上的句子要避开两侧柱子
  const lineW = W - (pW + 66) * 2;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}

      <div style={{ position: "absolute", inset: 0, transform: `translateY(${shake}px)` }}>
        {/* 说话的第一句：结构还不存在，它只是被读出来 */}
        {data.lines[0] && <Rise text={data.lines[0].text} frame={frame} at={cues[0]} size={lineSize} color={t.text} font={t.font.body} weight={400} style={{ left: GUT, top: TOP, maxWidth: W * 0.52 }} />}

        {/* 吊着的词 + 绳子 + 「已经忍了几秒」的实时读数 */}
        {frame < tMorph && (
          <>
            <div style={{ position: "absolute", left: hx, top: hangTop0 - 6, width: 2, height: Math.max(0, topY - hangTop0 + 6) * cordRetract, background: alpha(t.accent, 0.8) }} />
            <div
              style={{
                position: "absolute",
                left: hx - hangSize / 2,
                top: topY,
                width: hangSize,
                height: hangSize * 1.1,
                transformOrigin: `${hangSize / 2}px ${-(topY - hangTop0)}px`,
                transform: `rotate(${hangAng}rad)`,
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: hangSize,
                lineHeight: 1.05,
                color: t.text,
                whiteSpace: "nowrap",
                textAlign: "center",
              }}
            >
              {data.hang}
            </div>
            <div style={{ position: "absolute", left: hx + hangSize * 0.62, top: topY + hangSize * 0.2, fontFamily: t.font.mono, fontSize: full ? 24 : 14, color: t.accent }}>
              悬着 {hold.toFixed(2)}s
            </div>
          </>
        )}

        {/* 地基：坠落后横向摊开成 floor 那句词，宽度由 fitFont 反解 */}
        <div style={{ position: "absolute", left: GUT, right: GUT, top: FT, height: fSize * 1.05, overflow: "hidden" }}>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fSize, lineHeight: 1.05, color: t.text, textAlign: "center", whiteSpace: "nowrap", transform: `scaleX(${lerp(0.34, 1, morphK)})`, transformOrigin: "50% 100%", opacity: landK }}>
            {data.floor}
          </div>
        </div>

        {/* 柱子：竖排文字从地基里长出来（writing-mode 竖排，中文天然是柱子） */}
        {data.pillars.map((p, i) => {
          const k = pillarK(i);
          if (k <= 0.01) return null;
          const fs = pFs(p);
          const px = i === 0 ? GUT : width - GUT - fs * 1.35;
          return (
            <div key={i} style={{ position: "absolute", left: px, top: CT, width: fs * 1.35, height: CH, overflow: "hidden" }}>
              <div style={{ writingMode: "vertical-rl", textOrientation: "upright", fontFamily: t.font.title, fontWeight: 900, fontSize: fs, lineHeight: 1.02, color: t.text, height: CH, display: "flex", alignItems: "flex-end", transform: `translateY(${(1 - k) * CH}px)` }}>
                {p}
              </div>
            </div>
          );
        })}

        {/* 站在地基上的句子：逐句往上叠，字号由可用高度反算 */}
        {data.lines.slice(1).map((ln, i) => {
          const at = lineAt(i + 1);
          const y = FT - (i + 1) * lineSize * 1.25 - 12;
          return <Rise key={i} text={ln.text} frame={frame} at={at} size={lineSize} color={alpha(t.text, 0.92)} font={t.font.body} weight={400} style={{ left: lineX(i), top: y - lineSize * 1.3, maxWidth: lineW }} />;
        })}

        {/* 横梁：实心色条 + 抠字 */}
        {frame >= tBeam && (
          <div style={{ position: "absolute", left: GUT, right: GUT, top: beamY, height: DH, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 14px 40px ${alpha(t.accent, 0.3)}` }}>
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: Math.min(DH * 0.66, W / Math.max(1, textEm(data.beam))), color: t.bg, letterSpacing: "0.16em", whiteSpace: "nowrap" }}>{data.beam}</span>
          </div>
        )}

        {/* 结论：站在梁上，不退场 */}
        {frame >= tVerdict && (
          <div style={{ position: "absolute", left: GUT, right: GUT, top: DT - VW * 1.22, opacity: eVerdict.opacity, transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`, clipPath: eVerdict.clip, textAlign: "center" }}>
            <span style={{ ...speak(VW), fontWeight: 900, fontFamily: t.font.title, color: t.text }}>{data.verdict}</span>
          </div>
        )}

        {/* 右侧标高刻度：把「字在承重」这件事说破 */}
        {full && (
          <div style={{ position: "absolute", right: 24, top: CT - DH, width: 150, height: BASE - (CT - DH), opacity: clamp((s - tPillar / fps) * 1.2) }}>
            {[
              { y: FT, v: "±0" },
              { y: CT, v: `+${Math.round(CH)}` },
              { y: DT, v: `+${Math.round(CH + DH)}` },
            ].map((m, i) => (
              <div key={i} style={{ position: "absolute", right: 0, top: m.y - (CT - DH) - 9, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                <span style={{ fontFamily: t.font.mono, fontSize: 18, color: alpha(t.accent, 0.85) }}>{m.v}</span>
                <span style={{ width: 18, height: 1.5, background: alpha(t.accent, 0.6) }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <Sfx name="swish" at={tSnap} volume={0.3} />
      <Sfx name="impact" at={tLand} volume={0.5} />
      <Sfx name="whoosh" at={tBeam - 12} volume={0.3} />
      <Sfx name="stamp" at={tBeam} volume={0.45} />
    </>
  );
};

export const TextStructure: CompDef<D> = {
  id: "text-structure",
  name: "文字搭地板（前面的话托住最后一句）",
  layer: "metaphor",
  variants: 1,
  minSec: 6,
  maxSec: 16,
  tags: ["铺垫", "代价", "积累", "托住", "地基", "门槛", "全靠这些"],
  motion: { kind: "悬挂的词摆动画落→物理坠落摊成地基→竖排词长出柱子→横梁砸下→结论站在梁上（含确定性震屏与标高读数）", energy: 3 },
  desc: "画面只有文字，但每句换一次画面语法：一个词被绳子吊在半空轻轻摆动（旁边实时读「悬着几秒」），到点绳断，按重力公式坠落、正好砸在地面线上；砸中瞬间整幅画面震一下，那个词横向摊开成撑满宽度的**地基**；两侧的竖排词从地基里长出来当**柱子**；一根实心横梁带着抠出来的字砸下搭在柱顶；最后一句结论**站在这根梁上**不退场。右缘有 ±0 / +柱高 / +梁高的工程标高刻度",
  use: "讲「正因为前面那些，最后一句才站得住」：你的三年经验是地板、踩过的坑托起这个报价、加班和没人看搭起今天的门槛、前面那些铺垫让结论成立。**hang 与 floor 最好有字面关系**（等待→三年等待、加班→三年加班），坠落摊开那一刻才有「同一个东西变厚了」的感觉。全片只用一次，它太重了",
  schema,
  example: {
    kicker: "都说要坚持",
    title: "坚持靠的不是热情",
    hang: "等待",
    floor: "三年等待",
    pillars: ["没人看", "还得上班"],
    beam: "地板",
    lines: [{ text: "我们总被告知要再等等" }, { text: "等的时候没人夸你" }, { text: "可等过的日子不会消失" }],
    verdict: "它托住了今天这句",
  },
  C,
};
