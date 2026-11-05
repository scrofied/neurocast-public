import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, lerp, prog, rng } from "../../lib/anim";
import { hitShake, StampBox } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { RingBurst } from "../../lib/cine/Flash";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const commitItem = z.object({
  hash: z.string().describe("短哈希，写真 git log 里的那串（如 201fe9b）"),
  msg: z.string().describe("提交说明（真 git log 里的那句话）"),
  at: z.number().optional().describe("这条提交落到轨道上的时刻（锚点）"),
  bad: z.boolean().optional().describe("true = 就是这条改乱了：标红、被倒带划掉"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  branch: z.string().default("main").describe("轨道顶部的分支名"),
  dropAt: z.number().optional().describe("第一条提交落下的时刻（锚点）"),
  badAt: z.number().optional().describe("出问题那条被点红的时刻（锚点）"),
  rewindAt: z.number().optional().describe("倒带指针开始往回走的时刻（锚点）"),
  revertMsg: z.string().default("Revert 上一次改动").describe("撤回后新节点上写的提交说明"),
  sealText: z.string().default("已撤回").describe("盖在撤回节点上的章"),
  sealAt: z.number().optional().describe("章盖下的时刻（锚点）"),
  verdict: z.string().optional().describe("最后砸出的结论大字"),
  verdictAt: z.number().optional().describe("结论砸出的时刻（锚点）"),
  commits: z.array(commitItem).min(2).max(6).describe("从旧到新的提交（2~6 条），其中一条标 bad"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;

  const n = data.commits.length;
  const dropAt = cueOr(data.dropAt, 6);
  const cues = listCues(data.commits, dropAt, Math.max(dropAt + 10, dur * 0.42));
  const badIdx = Math.max(0, data.commits.findIndex((c) => c.bad));
  const badAt = Math.min(cueOr(data.badAt, cues[badIdx] + 14), dur - 46);
  const rewindAt = Math.max(cueOr(data.rewindAt, badAt + 22), badAt + 10);
  const travel = full ? 22 : 16; // 倒带走回上一条用的帧数
  const revertAt = rewindAt + travel + 4;
  const sealAt = Math.min(cueOr(data.sealAt ?? undefined, revertAt + 10), dur - 8);
  const vAt = Math.min(cueOr(data.verdictAt ?? undefined, sealAt + 12), dur - 6);

  // ── 几何：左侧一条提交轨道，右侧卡片；撤回节点排在最下面 ──
  const railX = W * (full ? 0.3 : 0.24);
  const top = H * (full ? 0.24 : 0.3);
  const gap = (H * (full ? 0.5 : 0.44)) / n;
  const yOf = (i: number) => top + i * gap;
  const cardX = railX + (full ? 54 : 26);
  const cardW = Math.min(W * (full ? 0.44 : 0.56), full ? 780 : 460);
  const cardH = gap * (full ? 0.62 : 0.6);
  const nodeR = full ? 13 : 7;
  const struck = frame >= rewindAt + travel * 0.55; // 划掉坏提交
  const sh = hitShake(frame, [badAt, revertAt], full ? 14 : 7, 12, seed);
  const jit = React.useMemo(() => {
    const r = rng(seed + 7);
    return Array.from({ length: 12 }, () => r() - 0.5);
  }, [seed]);

  // 倒带指针：从坏节点走回它的上一条
  const rw = easeInOut(prog(frame, rewindAt, travel));
  const rwY = lerp(yOf(badIdx), yOf(Math.max(0, badIdx - 1)), rw);
  const rwOn = frame >= rewindAt && frame < revertAt + 6;

  const stage = enterAt(frame, 0, { fallback: "rise", dur: 18 });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px) scale(${stage.scale})`, opacity: stage.opacity, clipPath: stage.clip }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="cr-glow" std={6} user />
          {/* 轨道 */}
          <line x1={railX} y1={yOf(0) - gap * 0.5} x2={railX} y2={yOf(n - 1) + gap * 0.4} stroke={alpha(t.dim, 0.5)} strokeWidth={full ? 5 : 3} />
          <line x1={railX} y1={yOf(0) - gap * 0.5} x2={railX} y2={yOf(n - 1) + gap * 0.4} stroke={alpha(t.primary, 0.55)} strokeWidth={full ? 3 : 2} strokeDasharray="10 12" strokeDashoffset={-frame * 1.2} />
          {/* 分支标签 */}
          <g>
            <rect x={railX - (full ? 118 : 62)} y={yOf(0) - gap * 0.5 - (full ? 34 : 20)} width={full ? 108 : 58} height={full ? 30 : 18} rx={full ? 15 : 9} fill={alpha(t.primary, 0.16)} stroke={alpha(t.primary, 0.7)} strokeWidth={2} />
            <text x={railX - (full ? 64 : 33)} y={yOf(0) - gap * 0.5 - (full ? 13 : 8)} textAnchor="middle" fontFamily="monospace" fontWeight={700} fontSize={full ? 19 : 11} fill={t.primary}>
              {data.branch}
            </text>
          </g>
          {/* 节点连线 + 节点 */}
          {data.commits.map((c, i) => {
            if (frame < cues[i]) return null;
            const e = enterAt(frame, cues[i], { fallback: "slide-l", dur: 12, seed: i + 1 });
            const isBad = i === badIdx;
            const col = isBad && frame >= badAt ? t.bad : t.primary;
            const dim = isBad && struck ? 0.34 : 1;
            return (
              <g key={`n${i}`} opacity={e.opacity * dim}>
                <line x1={railX} y1={yOf(i)} x2={cardX - (full ? 16 : 8)} y2={yOf(i)} stroke={alpha(col, 0.55)} strokeWidth={full ? 3 : 2} />
                <circle cx={railX} cy={yOf(i)} r={nodeR} fill={isBad && frame >= badAt ? t.bad : t.bg2} stroke={col} strokeWidth={full ? 4 : 2} filter={isBad && frame >= badAt ? "url(#cr-glow)" : undefined} />
              </g>
            );
          })}
          {/* 撤回节点（倒带走到位之后才出现） */}
          {frame >= revertAt &&
            (() => {
              const e = enterAt(frame, revertAt, { fallback: "drop", dur: 12 });
              return (
                <g opacity={e.opacity}>
                  <line x1={railX} y1={yOf(n - 1) + gap * 0.4} x2={railX} y2={yOf(n - 1) + gap * 0.9} stroke={alpha(t.gold, 0.8)} strokeWidth={full ? 5 : 3} />
                  <circle cx={railX} cy={yOf(n - 1) + gap * 0.9} r={nodeR * 1.15} fill={t.gold} stroke="#fff" strokeWidth={full ? 3 : 2} filter="url(#cr-glow)" />
                </g>
              );
            })()}
        </svg>

        {/* 提交卡片 */}
        {data.commits.map((c, i) => {
          if (frame < cues[i]) return null;
          const e = enterAt(frame, cues[i], { fallback: "slide-l", dur: 14, seed: i + 1 });
          const isBad = i === badIdx;
          const badOn = isBad && frame >= badAt;
          const dim = isBad && struck ? 0.3 : 1;
          const border = badOn ? t.bad : isBad ? t.accent : alpha(t.dim, 0.7);
          const fs = fitFont(c.msg, cardW - (full ? 150 : 74), full ? 30 : 15, 11);
          return (
            <div
              key={`c${i}`}
              style={{
                position: "absolute",
                left: cardX,
                top: yOf(i) - cardH / 2,
                width: cardW,
                height: cardH,
                borderRadius: full ? 14 : 8,
                background: alpha(badOn ? t.bad : t.bg2, badOn ? 0.16 : 0.78),
                border: `${full ? 3 : 2}px solid ${border}`,
                boxShadow: badOn ? `0 0 ${full ? 34 : 16}px ${alpha(t.bad, 0.4)}` : undefined,
                display: "flex",
                alignItems: "center",
                gap: full ? 14 : 7,
                padding: `0 ${full ? 20 : 10}px`,
                opacity: e.opacity * dim,
                filter: struck ? `grayscale(${clamp((frame - rewindAt) / travel)})` : undefined,
                transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale})`,
                transition: "none",
              }}
            >
              <Icon name={badOn ? "warn" : "hash"} size={full ? 26 : 13} color={badOn ? t.bad : t.dim} />
              <span style={{ fontFamily: "monospace", fontSize: full ? 22 : 12, color: alpha(t.text, 0.6), letterSpacing: 1 }}>{c.hash}</span>
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap", overflow: "hidden" }}>{c.msg}</span>
              {/* 划掉坏提交的那一道线 */}
              {isBad && frame >= rewindAt && (
                <div style={{ position: "absolute", left: 8, top: "50%", height: full ? 5 : 3, width: (cardW - 16) * easeOut(prog(frame, rewindAt, travel)), background: t.bad, boxShadow: `0 0 12px ${t.bad}` }} />
              )}
            </div>
          );
        })}

        {/* 「就是这条」红标 */}
        {frame >= badAt && !struck && (
          <div style={{ position: "absolute", left: cardX + cardW + (full ? 18 : 8), top: yOf(badIdx) - (full ? 22 : 12), opacity: clamp((frame - badAt) / 8) }}>
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 30 : 15, color: t.bad, textShadow: "0 2px 10px rgba(0,0,0,.7)" }}>改乱了</span>
          </div>
        )}

        {/* 撤回卡片 */}
        {frame >= revertAt &&
          (() => {
            const e = enterAt(frame, revertAt, { fallback: "rise", dur: 14 });
            const fs = fitFont(data.revertMsg, cardW - (full ? 120 : 60), full ? 30 : 15, 11);
            return (
              <div
                style={{
                  position: "absolute",
                  left: cardX,
                  top: yOf(n - 1) + gap * 0.9 - cardH / 2,
                  width: cardW,
                  height: cardH,
                  borderRadius: full ? 14 : 8,
                  background: alpha(t.gold, 0.14),
                  border: `${full ? 3 : 2}px solid ${t.gold}`,
                  display: "flex",
                  alignItems: "center",
                  gap: full ? 14 : 7,
                  padding: `0 ${full ? 20 : 10}px`,
                  opacity: e.opacity,
                  transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale})`,
                  boxShadow: `0 0 ${full ? 40 : 18}px ${alpha(t.gold, 0.35)}`,
                }}
              >
                <Icon name="check" size={full ? 26 : 13} color={t.gold} />
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: t.text, whiteSpace: "nowrap", overflow: "hidden" }}>{data.revertMsg}</span>
              </div>
            );
          })()}

        {/* 倒带指针：一个往回走的 ◀ 拖一条光尾 */}
        {rwOn && (
          <div style={{ position: "absolute", left: railX - (full ? 92 : 48), top: rwY - (full ? 22 : 11), width: full ? 76 : 40, height: full ? 44 : 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 22, background: alpha(t.primary, 0.9), boxShadow: `0 0 ${full ? 30 : 14}px ${t.primary}` }}>
            <Icon name="up" size={full ? 20 : 11} color="#06121a" />
            <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: full ? 17 : 10, color: "#06121a" }}>REW</span>
          </div>
        )}

        {/* 冲击环 + 章 + 结论 */}
        <RingBurst frame={frame} at={badAt} x={railX} y={yOf(badIdx)} color={t.bad} maxR={full ? 200 : 100} width={7} />
        <RingBurst frame={frame} at={revertAt} x={railX} y={yOf(n - 1) + gap * 0.9} color={t.gold} maxR={full ? 240 : 120} width={8} />
        <StampBox frame={frame} at={sealAt} text={data.sealText} color={t.gold} x={cardX + cardW * 0.5} y={yOf(n - 1) + gap * 0.9} size={full ? 62 : 30} maxW={cardW * 0.9} rot={-6} />
        {data.verdict && <StampBox frame={frame} at={vAt} text={data.verdict} color={t.primary} x={W * 0.5} y={H * (full ? 0.88 : 0.84)} size={full ? 54 : 26} maxW={W * 0.72} rot={1} />}
      </div>

      <Sfx name="pop" at={dropAt} volume={0.22} />
      {cues.slice(1).map((c, i) => (
        <Sfx key={`p${i}`} name="pop" at={c} volume={0.2} />
      ))}
      <Sfx name="impact" at={badAt} volume={0.4} />
      <Sfx name="swish" at={rewindAt} volume={0.3} />
      <Sfx name="whoosh" at={revertAt} volume={0.3} />
      <Sfx name="stamp" at={sealAt} volume={0.34} />
      {data.verdict && <Sfx name="ding" at={vAt} volume={0.32} />}
    </>
  );
};

export const CommitRewind: CompDef<D> = {
  id: "commit-rewind",
  name: "提交历史倒带撤回",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 14,
  tags: ["git", "提交", "历史", "记录", "撤回", "回滚", "时光机", "改乱了"],
  motion: { kind: "提交卡片一条条滑进左侧轨道（节点逐个点亮）→ 出问题那条标红震动 + 冲击环 → REW 倒带指针沿轨道走回上一条、红划掉坏提交 → 金色 Revert 节点砸出 + 盖章 → verdict 大字", energy: 3 },
  desc: "一条竖向提交轨道：commits[] 从旧到新各自 at 滑入（hash + 说明），标 bad 的那条在 badAt 变红震动、右上角飘「改乱了」；rewindAt 起一个 REW 倒带指针沿轨道走回上一条，同时一道红线划掉坏提交并把它压成灰；走到位后底部砸出金色 Revert 节点（revertMsg）+ 冲击环 + sealText 章；最后 verdict 砸在下方",
  use: "讲「每一次改动都有记录、改错了能退回」：版本历史、备份快照、数据库迁移回滚、剪辑工程找回上一版、AI 改乱文件后一条指令撤回",
  schema,
  example: {
    kicker: "自带时光机",
    title: "每次改动都留着",
    branch: "main",
    commits: [
      { hash: "1507c96", msg: "初始：建立个人 AI 档案仓库" },
      { hash: "13b6fcf", msg: "新增：硬规矩（文案·报价·改文件）" },
      { hash: "0d7ca30", msg: "整理：把改文件那节缩短一点", bad: true },
    ],
    revertMsg: 'Revert "整理：把改文件那节缩短一点"',
    sealText: "已撤回",
    verdict: "一条指令，当场退回",
  },
  C,
};
