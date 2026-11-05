import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Sfx } from "../../lib/sfx";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 指挥官派活链路：AI 当指挥官拆任务卡 → 工作台把卡变指令 → 命令行入口 → 对应 AI 工具；
// handoff 模式：一个工具做完 → 成果写进文件夹 → 文件位置交给下一位（不用复制粘贴）。
// 叙事动作 =「中枢把活分给多个执行者，用文件交接」，任何多智能体编排 / 流水线 / 派活题材都能用。

const node = z.object({ label: z.string(), sub: z.string().optional() });
const schema = z.object({
  kicker: z.string().optional(),
  title: z.string().optional(),
  mode: z.enum(["dispatch", "handoff"]).default("dispatch").describe("dispatch = 指挥官拆卡派活；handoff = 成果写文件夹交给下一位"),
  from: node.describe("起点节点（dispatch：指挥官；handoff：做完的那位）"),
  to: z.array(node).min(1).max(3).describe("终点节点（执行工具 / 下一位）"),
  cards: z.array(z.object({ text: z.string(), at: z.number().optional().describe("这张任务卡生成的时刻（锚点）") })).max(4).optional().describe("指挥官拆出的任务卡（dispatch 模式）"),
  cmd: z.string().default("> 发给对应 AI 工具").describe("命令行入口打出的指令文本（dispatch）"),
  buildAt: z.number().optional().describe("任务卡开始从指挥官吐出（锚点）"),
  sendAt: z.number().optional().describe("卡变成指令、发出去（锚点）"),
  runAt: z.number().optional().describe("工具开始干活（锚点）"),
  file: z.string().default("成果.md").describe("交接的文件名（handoff）"),
  doneAt: z.number().optional().describe("上一位做完（锚点，handoff）"),
  fileAt: z.number().optional().describe("成果写进文件夹（锚点，handoff）"),
  nextAt: z.number().optional().describe("下一位直接读文件（锚点，handoff）"),
  result: z.string().optional().describe("最后砸出的结论章，如「不用复制粘贴」"),
});
type D = z.infer<typeof schema>;

const Box: React.FC<{ x: number; y: number; w: number; h: number; label: string; sub?: string; col: string; bg: string; lit?: number; r?: number }> = ({ x, y, w, h, label, sub, col, bg, lit = 0, r = 18 }) => (
  <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: r, background: bg, border: `${3 + lit * 2}px solid ${alpha(col, 0.55 + lit * 0.45)}`, boxShadow: lit > 0 ? `0 0 ${26 * lit}px ${alpha(col, 0.6 * lit)}` : "0 10px 30px rgba(0,0,0,.35)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, transform: `scale(${1 + lit * 0.04})` }}>
    <span style={{ fontFamily: "var(--font-title)", fontWeight: 900, fontSize: fitFont(label, w - 30, 40, 20), color: col, whiteSpace: "nowrap" }}>{label}</span>
    {sub && <span style={{ fontSize: 22, color: alpha("#fff", 0.62), whiteSpace: "nowrap" }}>{sub}</span>}
  </div>
);

const Wire: React.FC<{ x1: number; y1: number; x2: number; y2: number; col: string; p: number; dash?: boolean }> = ({ x1, y1, x2, y2, col, p, dash }) => {
  const w = Math.abs(x2 - x1) + 8, h = Math.abs(y2 - y1) + 8;
  const ax = x1 < x2 ? 4 : w - 4, ay = y1 < y2 ? 4 : h - 4, bx = x1 < x2 ? w - 4 : 4, by = y1 < y2 ? h - 4 : 4;
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: Math.min(x1, x2) - 4, top: Math.min(y1, y2) - 4 }}>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={alpha(col, 0.75)} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={dash ? "0.06 0.06" : `${p} 1`} strokeDashoffset={dash ? -p * 0.5 : 0} opacity={dash ? p : 1} />
    </svg>
  );
};

const Dot: React.FC<{ x: number; y: number; col: string; s?: number }> = ({ x, y, col, s = 1 }) => s > 0 && (
  <div style={{ position: "absolute", left: x - 11 * s, top: y - 11 * s, width: 22 * s, height: 22 * s, borderRadius: "50%", background: col, boxShadow: `0 0 22px ${col}`, opacity: clamp(s) }} />
);

const C: React.FC<CompProps<D>> = ({ data, frame, variant }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const W = width, H = height;
  const yMid = H * 0.56;
  const cards = data.cards ?? [];
  const n = cards.length;
  const col = t.primary, gold = t.gold;
  const enterAt = useEnter(variant);
  const e = enterAt(frame, 0);
  const layer = {
    position: "absolute" as const,
    inset: 0,
    opacity: e.opacity,
    transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale}) rotate(${e.rot}deg)`,
    transformOrigin: "50% 50%",
    clipPath: e.clip,
  };

  if (data.mode === "dispatch") {
    // 指挥官(左) → 工作台(中) → 命令行(右下条) → 工具(右列)
    const A = { x: W * 0.17, y: yMid - 40 };
    const B = { x: W * 0.44, y: yMid - 40 };
    const term = { x: W * 0.62, y: yMid + 120, w: W * 0.3, h: 92 };
    const tools = data.to.map((to, i) => ({ x: W * 0.85, y: yMid - 130 + i * 120, ...to }));
    const build = cueOr(data.buildAt, 14);
    const cardCues = cards.map((c, i) => Math.max(build + i * 8, cueOr(c.at, build + i * 8)));
    const send = cueOr(data.sendAt, Math.max(build + 10, (cardCues[n - 1] ?? build) + 14));
    const run = cueOr(data.runAt, send + 16);
    const wire1 = clamp(easeOut(prog(frame, build - 4, 10)));
    const wire2 = clamp(easeOut(prog(frame, send, 10)));
    const wire3 = clamp(easeOut(prog(frame, run - 6, 10)));
    const typedCmd = data.cmd.slice(0, Math.max(0, Math.floor((frame - send - 4) / 2)));
    // 卡片：从指挥官吐出 → 飞向工作台 → 消失（变成指令）
    return (
      <div style={layer}>
        <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />
        <Wire x1={A.x + 130} y1={A.y} x2={B.x - 130} y2={B.y} col={col} p={wire1} />
        <Wire x1={B.x + 60} y1={B.y + 60} x2={term.x - term.w / 2 + 20} y2={term.y} col={col} p={wire2} />
        {tools.map((to, i) => <Wire key={i} x1={term.x + term.w / 2 - 20} y1={term.y} x2={to.x - 120} y2={to.y} col={col} p={wire3} dash />)}
        <Box x={A.x} y={A.y} w={260} h={128} label={data.from.label} sub={data.from.sub ?? "指挥官"} col={gold} bg={alpha(t.bg2, 0.9)} lit={frame >= build - 6 && frame < build + 10 ? 1 : 0.25} />
        <Box x={B.x} y={B.y} w={240} h={116} label="工作台" sub="任务卡 → 指令" col={col} bg={alpha(t.bg2, 0.9)} lit={frame >= send - 6 && frame < send + 10 ? 1 : frame >= send ? 0.4 : 0} />
        {/* 命令行入口 */}
        <div style={{ position: "absolute", left: term.x - term.w / 2, top: term.y - term.h / 2, width: term.w, height: term.h, borderRadius: 14, background: "#0b0f14", border: `2px solid ${alpha(col, 0.5)}`, boxShadow: "0 14px 40px rgba(0,0,0,.5)", display: "flex", alignItems: "center", padding: "0 26px", opacity: frame >= send ? clamp(easeOut(prog(frame, send, 8))) : 0, transform: `scale(${0.9 + 0.1 * clamp(easeOut(prog(frame, send, 8)))})` }}>
          <span style={{ fontFamily: "Consolas,monospace", fontSize: 30, color: col, fontWeight: 700 }}>{typedCmd || "▌"}</span>
        </div>
        {tools.map((to, i) => <Box key={i} x={to.x} y={to.y} w={230} h={96} label={to.label} sub={to.sub} col={col} bg={alpha(t.bg2, 0.9)} lit={frame >= run + i * 4 ? 0.6 : 0} />)}
        {/* 任务卡：吐出 → 飞进工作台 */}
        {cards.map((c, i) => {
          const a = cardCues[i];
          if (frame < a) return null;
          const fly = clamp(easeInOut(prog(frame, a + 8, 12)));
          const x = A.x + (B.x - A.x) * fly;
          const y = A.y - 90 + i * 26 + (B.y - 60 - (A.y - 90 + i * 26)) * fly;
          const s = 1 - fly * 0.25;
          return (
            <div key={i} style={{ position: "absolute", left: x - 150 * s, top: y - 26 * s, width: 300 * s, height: 52 * s, borderRadius: 10, background: alpha(gold, 0.14), border: `2px solid ${alpha(gold, 0.7)}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: 1 - clamp(prog(frame, a + 18, 6)), transform: `rotate(${(i - n / 2) * 3 * (1 - fly)}deg)` }}>
              <span style={{ fontSize: fitFont(c.text, 250 * s, 24 * s, 12), color: gold, fontWeight: 700, whiteSpace: "nowrap" }}>任务卡 · {c.text}</span>
            </div>
          );
        })}
        <Sfx name="pop" at={build} volume={0.3} />
        {cards.map((_, i) => <Sfx key={i} name="swipe" at={cardCues[i] + 8} volume={0.22} />)}
        <Sfx name="typing" at={send + 4} volume={0.3} />
        <Sfx name="click" at={run} volume={0.3} />
      </div>
    );
  }

  // ── handoff：做完的一位 → 文件夹（写入成果）→ 下一位读文件 ──
  const A = { x: W * 0.18, y: yMid };
  const F = { x: W * 0.5, y: yMid };
  const to = data.to[0];
  const B = { x: W * 0.82, y: yMid };
  const done = cueOr(data.doneAt, 10);
  const file = cueOr(data.fileAt, done + 16);
  const next = cueOr(data.nextAt, file + 18);
  const stampF = data.result ? next + 12 : 1e9;
  const w1 = clamp(easeOut(prog(frame, file - 6, 8)));
  const w2 = clamp(easeOut(prog(frame, next - 6, 8)));
  const pkt = clamp(easeInOut(prog(frame, file, 12))); // A → 文件夹
  const pkt2 = clamp(easeInOut(prog(frame, next, 12))); // 文件夹 → B
  const eRes = clamp(easeOut(prog(frame, stampF, 10)));
  return (
    <div style={layer}>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />
      <Wire x1={A.x + 130} y1={A.y} x2={F.x - 120} y2={F.y} col={col} p={w1} dash />
      <Wire x1={F.x + 120} y1={F.y} x2={B.x - 130} y2={B.y} col={col} p={w2} dash />
      <Box x={A.x} y={A.y} w={260} h={120} label={data.from.label} sub={data.from.sub ?? "已完成"} col={frame >= done ? t.primary : alpha("#fff", 0.7)} bg={alpha(t.bg2, 0.9)} lit={frame >= done && frame < done + 10 ? 1 : 0.15} />
      {frame >= done && <div style={{ position: "absolute", left: A.x - 22, top: A.y - 110, color: t.primary, fontSize: 44, fontWeight: 900, opacity: clamp(easeOut(prog(frame, done, 8))) }}>✓</div>}
      {/* 文件夹 */}
      <div style={{ position: "absolute", left: F.x - 110, top: F.y - 92, width: 220, height: 184, opacity: frame >= file - 8 ? clamp(easeOut(prog(frame, file - 8, 8))) : 0.25 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 110, height: 34, borderRadius: "12px 16px 0 0", background: alpha(gold, 0.8) }} />
        <div style={{ position: "absolute", left: 0, top: 26, width: 220, height: 158, borderRadius: 16, background: alpha(gold, 0.28), border: `3px solid ${alpha(gold, 0.85)}`, boxShadow: frame >= file ? `0 0 34px ${alpha(gold, 0.5)}` : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 26, color: gold, fontWeight: 800, whiteSpace: "nowrap" }}>{data.file}</span>
        </div>
      </div>
      <Box x={B.x} y={B.y} w={260} h={120} label={to.label} sub={to.sub ?? "直接读文件"} col={col} bg={alpha(t.bg2, 0.9)} lit={frame >= next ? 0.7 : 0} />
      {/* 文件光点：A→文件夹，文件夹→B */}
      {frame >= file - 12 && pkt < 1 && <Dot x={A.x + 130 + (F.x - 120 - A.x - 130) * pkt} y={yMid} col={gold} />}
      {frame >= next - 12 && pkt2 < 1 && <Dot x={F.x + 120 + (B.x - 130 - F.x - 120) * pkt2} y={yMid} col={gold} />}
      {/* 「文件位置」标签 */}
      {frame >= next - 4 && frame < next + 30 && (
        <div style={{ position: "absolute", left: (F.x + B.x) / 2 - 88, top: yMid - 78, padding: "8px 22px", borderRadius: 999, background: alpha(t.bg, 0.8), border: `2px solid ${alpha(col, 0.8)}`, color: "#fff", fontSize: 26, fontWeight: 700, opacity: clamp(easeOut(prog(frame, next - 4, 8))) }}>文件位置</div>
      )}
      {data.result && eRes > 0 && (
        <div style={{ position: "absolute", left: W / 2 - 240, top: yMid + 150, width: 480, textAlign: "center", transform: `scale(${0.55 + 0.45 * easeOut(eRes)}) rotate(-4deg)`, opacity: clamp(eRes * 3) }}>
          <span style={{ display: "inline-block", padding: "14px 40px", borderRadius: 16, border: `6px double ${gold}`, background: alpha(t.bg, 0.55), boxShadow: `0 0 40px ${alpha(gold, 0.35)}`, color: gold, fontFamily: "var(--font-title)", fontWeight: 900, fontSize: 52, whiteSpace: "nowrap" }}>{data.result}</span>
        </div>
      )}
      <Sfx name="success" at={done} volume={0.35} />
      <Sfx name="pop" at={file} volume={0.35} />
      <Sfx name="swipe" at={next} volume={0.28} />
      {data.result && <Sfx name="stamp" at={stampF} volume={0.45} />}
    </div>
  );
};

export const AgentRelay: CompDef<D> = {
  id: "agent-relay",
  name: "指挥官派活·文件交接",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 16,
  tags: ["多智能体", "派活", "编排", "交接", "命令行", "工作台"],
  desc: "dispatch：指挥官节点吐出任务卡→飞进工作台→工作台生成命令行指令→发给右侧执行工具；handoff：做完的工具打勾→成果文件光点写进文件夹→「文件位置」交给下一位直接读",
  use: "AI 编排/自动化流水线：一个模型指挥其他模型干活、成果用文件交接不用复制粘贴；CI/CD 派单、外包团队协作隐喻、多机器人分工",
  motion: { kind: "任务卡从指挥官吐出、飞进工作台变指令，光点沿连线传给执行工具；交接模式文件光点进文件夹再交给下一位", energy: 2 },
  schema,
  example: {
    kicker: "原理",
    title: "AI 负责分工，程序负责交接",
    mode: "dispatch",
    from: { label: "Codex" },
    cards: [{ text: "整理卖点" }, { text: "制作网页" }, { text: "检查排版" }],
    to: [{ label: "WorkBuddy" }, { label: "Qoder" }],
    cmd: "> 把指令发给对应工具",
  },
  C,
};
