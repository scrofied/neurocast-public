import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeOut, prog, rng } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { sourceSchema, SourceBadge } from "../../lib/source";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, fmtNum, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 出处：opus-5-5-motion-gallery/v05-transformer / @宝玉（dotey），X 经 YouMind 收录 2026-09-26 https://youmind.com/video-prompts/transformer-explainer-video-11391
// 片库整理：小红书 AI伐木工（jinhanbuilds/opus-5-5-motion-gallery）；逐条机制对照见 docs/OPUS55_ANIMATIONS.md 一·c。
// 移植自 opus-5-5-motion-gallery/v05-transformer 的六段式：分词 → 嵌入 → Q/K/V → 注意力 → 公式 → 预测。
// 搬的是**讲解结构与画法**：注意力用「从焦点词元飞出的弧线」表达，弧线粗细与透明度都∝权重，
// 百分比直接标在弧上；softmax 用一排归一后的横条。
// 一条红线先焊在组件里：**权重不是从真模型里抓的，就必须打上「示意」水印**，
// 只有给了 source（真截图/真读数出处）才允许去掉，并自动挂来源角标。这是本库的信任度口径。

const token = z.object({
  text: z.string().max(10).describe("一个词元（写你希望观众读到的切法，如 「它」「小猫」）"),
});
const next = z.object({
  word: z.string().max(8).describe("候选的下一个词"),
  p: z.number().min(0.01).max(0.99).describe("概率（0~1，这一排会被归一）"),
});
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  tokens: z.array(token).min(3).max(8).describe("3~8 个词元"),
  focus: z.number().min(0).max(7).describe("焦点词元的下标（讲「它」在找谁，通常是被理解的那个代词）"),
  weights: z.array(z.number().min(0).max(1)).min(3).max(8).describe("每个词元分到的注意力（会归一成 100%）。**没有真实出处就是编的**，画面会自动打「示意」"),
  scores: z.array(z.number().min(0)).max(8).optional().describe("可选：softmax 之前的点积分数（q·k/√d），画在弧线上更有说服力"),
  next: z.array(next).min(2).max(4).optional().describe("结尾的预测：下一个词的 top 2~4 个候选及概率"),
  hint: z.string().max(18).optional().describe("水印文字，默认「示意权重 · 非真实读数」"),
  source: sourceSchema.describe("真出处（真截图/实测读数的来源）：给了就不打示意水印，并自动挂来源角标"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const n = data.tokens.length;
  const F = Math.min(data.focus, n - 1);

  const sum = data.weights.reduce((a, b) => a + b, 0) || 1;
  const W = data.weights.map((w) => w / sum);
  const cands = data.next ?? [];
  const hasNext = cands.length > 0;
  const rd = rng(data.tokens.length * 17 + 3);
  const vocab = data.tokens.map(() => Math.floor(1000 + rd() * 89000));

  const pad = full ? 110 : 18;
  const availW = width - pad * 2;
  const cw = Math.min(full ? 178 : 96, availW / n - (full ? 16 : 6));
  const X = (i: number) => pad + (availW / n) * (i + 0.5);
  const topY = full ? 420 : 150;
  const chipH = full ? 76 : 46;
  const vecTop = topY + chipH + (full ? 30 : 12);
  const vecH = full ? 150 : 88;
  const barY = vecTop + vecH + (full ? 34 : 12);

  // 六个阶段按时长比例推进（v05 的六段式骨架，分镜不用填时刻）
  const seg = (a: number, b: number) => clamp(prog(frame, dur * a, dur * (b - a)));
  const sTok = seg(0.02, 0.2);
  const sVec = seg(0.2, 0.34);
  const sQKV = seg(0.36, 0.52);
  const sAtt = seg(0.54, 0.78);
  const sNext = seg(0.8, 0.96);
  const attPer = (i: number) => clamp((sAtt - (i / n) * 0.25) / 0.7);

  const hasSource = !!(data.source && (data.source.url || data.source.platform || data.source.capturedAt || data.source.author));
  const fake = !hasSource;
  const showVerdict = sAtt > 0.9 && (!hasNext || sNext <= 0.05);
  const eVerdict = enterAt(frame, Math.round(dur * 0.76), { fallback: "rise", dur: 14 });
  const tone = [t.accent, t.primary, t.secondary];
  const qkv = ["Q 我在找什么", "K 我有什么特征", "V 我能给什么"];

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}

      {sNext <= 0 && (
        <div style={{ position: "absolute", left: pad, top: full ? 218 : 76, fontFamily: t.font.mono, fontSize: full ? 24 : 13, color: t.dim }}>
          {sQKV > 0 ? "④ 注意力：q 和每个 k 做点积 → softmax 成权重" : sVec > 0 && sQKV <= 0 ? "③ 每个向量分裂成 Q / K / V 三份" : sTok > 0.6 ? "② 每个词元变成一个向量" : "① 句子先被切成词元 token"}
        </div>
      )}

      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {/* 词元条 */}
        {data.tokens.map((tk, i) => {
          const k = clamp((sTok * n - i) / 1.2);
          if (k <= 0) return null;
          const isF = i === F && sAtt > 0;
          return (
            <g key={i} opacity={k} transform={`translate(0,${(1 - easeOut(k)) * 30})`}>
              <rect x={X(i) - cw / 2} y={topY} width={cw} height={chipH} rx={full ? 14 : 8} fill={alpha(isF ? t.accent : t.bg2, isF ? 0.24 : 0.9)} stroke={isF ? t.accent : alpha(t.line, 0.9)} strokeWidth={isF ? 3 : 1.5} />
              <text x={X(i)} y={topY + chipH * 0.56} textAnchor="middle" fontFamily={t.font.title} fontWeight={900} fontSize={fitFont(tk.text, cw - 14, full ? 36 : 18, 11)} fill={isF ? t.accent : t.text}>
                {tk.text}
              </text>
              {full && (
                <text x={X(i)} y={topY + chipH + 22} textAnchor="middle" fontFamily={t.font.mono} fontSize={19} fill={alpha(t.dim, 0.9)}>
                  #{vocab[i]}
                </text>
              )}
            </g>
          );
        })}

        {/* 向量 → Q/K/V 三份 */}
        {data.tokens.map((_, i) => {
          const k = clamp((sVec * n - i) / 1.4);
          if (k <= 0) return null;
          const cols = sQKV > 0 ? 3 : 1;
          const wUnit = (cw * 0.8) / (sQKV > 0 ? 3.6 : 1.4);
          return (
            <g key={i} opacity={k}>
              {Array.from({ length: cols }, (_, c) => {
                const x = X(i) - (cols * wUnit * 1.2) / 2 + c * wUnit * 1.2;
                const rows = Math.max(4, Math.floor(vecH / (full ? 26 : 16)));
                return (
                  <g key={c}>
                    {Array.from({ length: rows }, (_, r) => {
                      const v = 0.5 + 0.5 * Math.sin(r * 1.7 + i * 2.3 + c * 0.9);
                      return <rect key={r} x={x} y={vecTop + (r * vecH) / rows} width={wUnit} height={vecH / rows - 3} rx={3} fill={alpha(tone[c], 0.18 + v * 0.6)} />;
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* 注意力弧线：从焦点词元飞向每个词元，粗细与不透明度 ∝ 权重 */}
        {sAtt > 0 &&
          W.map((w, i) => {
            if (i === F || attPer(i) <= 0.02) return null;
            const p = easeOut(attPer(i));
            const fx = X(F);
            const tx = X(i);
            const sc = data.scores?.[i];
            const apex = topY - 14;
            const h = Math.min(full ? 150 : 72, Math.abs(tx - fx) * 0.2 + 26);
            const d = `M${fx},${apex} Q${(fx + tx) / 2},${apex - h * 2} ${tx},${apex}`;
            const L = Math.abs(tx - fx) + h * 2.2;
            const tipX = (1 - p) * (1 - p) * fx + 2 * (1 - p) * p * ((fx + tx) / 2) + p * p * tx;
            const tipY = (1 - p) * (1 - p) * apex + 2 * (1 - p) * p * (apex - h * 2) + p * p * apex;
            return (
              <g key={i} opacity={0.35 + Math.min(0.65, w * 1.4)}>
                <path d={d} fill="none" stroke={alpha(t.accent, 0.16)} strokeWidth={1.5 + w * (full ? 26 : 12)} strokeLinecap="round" />
                <path d={d} fill="none" stroke={t.accent} strokeWidth={1.5 + w * (full ? 26 : 12)} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - p)} />
                {p < 0.98 && <circle cx={tipX} cy={tipY} r={full ? 9 : 5} fill={t.accent} />}
                {p > 0.85 && (
                  <text x={(fx + tx) / 2} y={apex - h / 2 - 14} textAnchor="middle" fontFamily={t.font.mono} fontWeight={700} fontSize={full ? 26 : 14} fill={t.accent}>
                    {(w * 100).toFixed(0)}%
                    {sc !== undefined ? `  q·k=${sc.toFixed(1)}` : ""}
                  </text>
                )}
              </g>
            );
          })}

        {/* softmax 横条：预测的概率条一出现就让位（同一件事不画两遍） */}
        {sAtt > 0.35 && sNext < 0.72 &&
          W.map((w, i) => {
            const p = clamp((sAtt - 0.35) / 0.5);
            return (
              <g key={i} opacity={1 - clamp(sNext * 1.4)}>
                <rect x={X(i) - cw * 0.4} y={barY} width={cw * 0.8} height={full ? 10 : 6} rx={4} fill={alpha(t.dim, 0.25)} />
                <rect x={X(i) - cw * 0.4} y={barY} width={cw * 0.8 * w * p} height={full ? 10 : 6} rx={4} fill={i === F ? t.text : t.accent} />
              </g>
            );
          })}
      </svg>

      {/* Q/K/V 图例（预测一出现就让位给它，避免下区叠字） */}
      {sQKV > 0.2 && full && sNext <= 0 && (
        <div style={{ position: "absolute", left: pad, bottom: 250, display: "flex", gap: 26, opacity: clamp((sQKV - 0.2) / 0.5) }}>
          {qkv.map((q, c) => (
            <span key={c} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: t.font.mono, fontSize: 21, color: tone[c] }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: tone[c] }} />
              {q}
            </span>
          ))}
          <span style={{ fontFamily: t.font.mono, fontSize: 21, color: t.dim }}>softmax(QKᵀ/√d)·V</span>
        </div>
      )}

      {/* 预测：下一个词的候选概率 */}
      {sNext > 0 && hasNext && (
        <div style={{ position: "absolute", left: pad, right: pad, bottom: full ? 220 : 100, opacity: clamp(sNext * 1.4) }}>
          {cands.map((nx, i) => {
            const p = easeOut(clamp((sNext * cands.length - i) / 1.2));
            const total = cands.reduce((a, b) => a + b.p, 0) || 1;
            const v = nx.p / total;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: full ? 12 : 6 }}>
                <span style={{ width: full ? 150 : 90, textAlign: "right", fontFamily: t.font.title, fontWeight: i === 0 ? 900 : 400, fontSize: full ? 32 : 17, color: i === 0 ? t.accent : t.dim }}>{nx.word}</span>
                <span style={{ width: full ? 420 : 200, height: full ? 18 : 10, borderRadius: 8, background: alpha(t.dim, 0.22) }}>
                  <span style={{ display: "block", width: `${v * 100 * p}%`, height: "100%", borderRadius: 8, background: i === 0 ? t.accent : alpha(t.primary, 0.7) }} />
                </span>
                <span style={{ fontFamily: t.font.mono, fontSize: full ? 26 : 14, color: t.text }}>{fmtNum(v * 100, 1)}%</span>
                {i === 0 && p > 0.9 && <span style={{ fontFamily: t.font.body, fontSize: full ? 24 : 13, color: t.dim }}>← 它选中了这个</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* 示意水印 / 真来源角标 —— 信任度红线在这里落地 */}
      <div style={{ position: "absolute", right: full ? 96 : 12, top: full ? 218 : 76, display: "flex", alignItems: "center", gap: 12 }}>
        {fake ? (
          <span style={{ fontFamily: t.font.mono, fontSize: full ? 22 : 12, color: t.dim, border: `1.5px dashed ${alpha(t.dim, 0.7)}`, borderRadius: 999, padding: "6px 14px" }}>{data.hint ?? "示意权重 · 非真实读数"}</span>
        ) : (
          <div style={{ position: "relative", width: 300, height: 34 }}>
            <SourceBadge source={data.source} frame={frame} />
          </div>
        )}
      </div>

      {showVerdict && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: full ? 185 : 92, textAlign: "center", opacity: eVerdict.opacity, transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px)` }}>
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(`「${data.tokens[F].text}」最看重「${data.tokens[W.indexOf(Math.max(...W))].text}」`, width * 0.8, full ? 54 : 22, 14), color: t.text }}>
            「{data.tokens[F].text}」最看重「{data.tokens[W.indexOf(Math.max(...W))].text}」
          </span>
        </div>
      )}

      <Sfx name="pop" at={Math.round(dur * 0.06)} volume={0.25} />
      <Sfx name="swish" at={Math.round(dur * 0.55)} volume={0.28} />
      <Sfx name="ding" at={Math.round(dur * 0.86)} volume={0.3} />
    </>
  );
};

export const AttnWeights: CompDef<D> = {
  id: "attn-weights",
  name: "注意力弧线（一个词怎么找到另一个词）",
  layer: "info",
  variants: 1,
  minSec: 6,
  maxSec: 16,
  tags: ["注意力", "大模型怎么读", "上下文", "指代", "token", "词元", "Transformer", "为什么会看错"],
  motion: { kind: "词元逐个立起 → 长成向量列 → 分裂成 Q/K/V 三列 → 从焦点词元飞出弧线（粗细∝权重、百分比标注）→ softmax 横条 → 候选词概率条", energy: 2 },
  desc: "把一句话拆成词元摆在顶上（下面标着示意编号），讲到「变成向量」时长出一列列彩色格子，讲到 Q/K/V 时每列再分裂成三份并出图例；然后焦点词元（默认那个代词）向其它词元飞出弧线，**弧线粗细和亮度等于它分到的注意力**，百分比标在弧顶，底下一排 softmax 横条同步归一；结尾可选 top 候选词的概率条，最高的一条被选中并写出一句结论。右上角没有真出处就自动挂「示意权重 · 非真实读数」的虚线水印",
  use: "讲大模型内部怎么读一句话：为什么「它」能知道指谁、上下文窗口在看哪些词、为什么长句会看漏、提示词里把关键词放前面更被重视、幻觉是怎么「看错地方」的。weights 是**观众要信的数字**：有真读数（实测截图/论文）就填 source，没有就让它挂着示意水印，别嘴硬说成真值",
  hideCaptions: false,
  schema,
  example: {
    kicker: "它凭什么知道",
    title: "「它」在看哪一个词",
    tokens: [{ text: "小猫" }, { text: "因为" }, { text: "太饿" }, { text: "所以" }, { text: "它" }, { text: "扑向" }, { text: "鱼" }],
    focus: 4,
    weights: [0.46, 0.05, 0.17, 0.02, 0.08, 0.04, 0.18],
    next: [{ word: "猫", p: 0.62 }, { word: "鱼", p: 0.21 }, { word: "人", p: 0.17 }],
  },
  C,
};
