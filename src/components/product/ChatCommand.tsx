import React from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { useBox } from "../../lib/box";
import { cueOr, listCues, typed } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const line = z.object({ text: z.string(), at: z.number().optional() });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  app: z.string().default("AI 助手").describe("窗口标题，如 Agent Browser"),
  appIcon: z.string().optional(),
  prompt: z.string().optional().describe("一整句指令（跟着说话打字）"),
  typeAt: z.number().optional().describe("开始打字的时刻（锚点）"),
  doneAt: z.number().optional().describe("打完的时刻（锚点，缺省按字数估）"),
  lines: z.array(line).max(5).optional().describe("分条指令：每条在说到它时打出来，适合“下这条死命令：①…②…③…”"),
  reply: z.string().optional().describe("AI 的回复"),
  replyAt: z.number().optional(),
  steps: z.array(line).max(5).optional().describe("AI 执行步骤，逐个打勾"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const enterAt = useEnter(variant);
  const t = useTheme();
  const { width, height } = useBox();
  const wx = 230;
  const wy = data.title ? 235 : 185;
  const ww = width - 460;
  const wh = height - wy - 150;
  const typeAt = cueOr(data.typeAt, 10);
  const lines = data.lines ?? [];
  const lcues = listCues(lines, typeAt, Math.max(typeAt + 20, dur * 0.7));
  const promptChars = data.prompt ? Array.from(data.prompt).length : 0;
  const doneAt = cueOr(data.doneAt, typeAt + Math.max(20, promptChars * 2.2));
  const lastLine = lines.length ? lcues[lcues.length - 1] + 18 : doneAt;
  const replyAt = cueOr(data.replyAt, (data.prompt ? doneAt : lastLine) + 10);
  const steps = data.steps ?? [];
  const scues = listCues(steps, replyAt + 16, Math.max(replyAt + 30, dur - 20));
  // 窗口与气泡的入场交给动效层（原生是轻微放大淡入，用 fallback 保住这个基线）
  const eWin = enterAt(frame, 0, { fallback: "rise", dur: 18, dist: 0.5 });
  const typingNow = data.prompt ? frame >= typeAt && frame < doneAt : lines.some((_, i) => frame >= lcues[i] && frame < lcues[i] + 16);
  const caret = Math.floor(frame / 8) % 2 === 0;
  const eBubble = enterAt(frame, typeAt - 4, { fallback: "rise", dur: 10, dist: 0.7 });
  const fsPrompt = data.prompt ? fitFont(data.prompt.slice(0, 26), ww * 0.62, 44, 28) : 40;
  const typingSfx: number[] = [];
  if (data.prompt) for (let f = typeAt; f < doneAt - 10; f += 40) typingSfx.push(f);
  return (
    <>
      <Heading kicker={data.kicker ?? "COMMAND"} title={data.title} frame={frame} width={width} />
      <div style={{ position: "absolute", left: wx, top: wy, width: ww, height: wh, borderRadius: 26, background: `linear-gradient(170deg, ${alpha(t.bg2, 0.95)}, ${alpha(t.bg, 0.92)})`, border: `1.5px solid ${alpha(t.primary, 0.4)}`, boxShadow: `0 0 60px ${alpha(t.primary, 0.18)}, 0 30px 80px rgba(0,0,0,.5)`, overflow: "hidden", transform: `translate(${eWin.dx}px, ${eWin.dy}px) scale(${eWin.scale})`, opacity: eWin.opacity }}>
        <div style={{ height: 78, display: "flex", alignItems: "center", gap: 16, padding: "0 30px", borderBottom: `1px solid ${alpha(t.primary, 0.18)}`, background: alpha(t.primary, 0.05) }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={data.appIcon ?? "bot"} size={28} color={t.bg} stroke={2.4} />
          </div>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 32, color: t.text }}>{data.app}</div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontFamily: t.font.body, fontSize: 22, color: t.dim }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: t.primary, boxShadow: `0 0 8px ${t.primary}` }} />
            {typingNow ? "你正在输入…" : "在线"}
          </div>
        </div>
        {/* your message (typed live) */}
        {frame >= typeAt - 4 && (
          <div style={{ position: "absolute", right: 36, top: 110, maxWidth: ww * 0.74, padding: "22px 30px", borderRadius: 26, borderTopRightRadius: 6, background: `linear-gradient(135deg, ${alpha(t.primary, 0.32)}, ${alpha(t.secondary, 0.22)})`, border: `2px solid ${alpha(t.primary, 0.7)}`, opacity: eBubble.opacity, transform: `translate(${eBubble.dx}px, ${eBubble.dy}px)` }}>
            {data.prompt && (
              <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: fsPrompt, lineHeight: 1.45, color: t.text }}>
                {typed(data.prompt, frame, typeAt, doneAt)}
                {frame < doneAt + 6 && caret && <span style={{ color: t.primary }}>▍</span>}
              </div>
            )}
            {lines.map((ln, i) => {
              const at = lcues[i];
              if (frame < at) return null;
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16, marginTop: i ? 16 : 0, opacity: easeOut(prog(frame, at, 8)) }}>
                  <span style={{ flex: "none", width: 44, height: 44, borderRadius: 22, background: t.primary, color: t.bg, fontFamily: t.font.mono, fontWeight: 900, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(ln.text, ww * 0.62, 40, 24), lineHeight: 1.35, color: t.text, whiteSpace: "nowrap" }}>
                    {typed(ln.text, frame, at, at + 14)}
                  </span>
                  <Sfx name="typing" at={at} volume={0.25} />
                </div>
              );
            })}
          </div>
        )}
        {/* AI reply + steps */}
        {(data.reply || steps.length > 0) && frame >= replyAt && (
          <div style={{ position: "absolute", left: 36, bottom: 140, maxWidth: ww * 0.6, display: "flex", gap: 16, alignItems: "flex-start", opacity: easeOut(prog(frame, replyAt, 10)) }}>
            <div style={{ flex: "none", width: 56, height: 56, borderRadius: 28, background: alpha(t.secondary, 0.3), border: `2px solid ${t.secondary}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="bot" size={30} color={t.text} />
            </div>
            <div style={{ padding: "18px 26px", borderRadius: 22, borderTopLeftRadius: 6, background: t.glass, border: `1.5px solid ${alpha(t.secondary, 0.5)}` }}>
              {data.reply && <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 32, color: t.text }}>{data.reply}</div>}
              {steps.map((s, i) => {
                const at = scues[i];
                if (frame < at) return null;
                const done = frame >= at + 12;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, fontFamily: t.font.body, fontWeight: 700, fontSize: 28, color: done ? t.text : t.dim, opacity: easeOut(prog(frame, at, 8)) }}>
                    {done ? <Icon name="check" size={28} color={t.primary} stroke={3} /> : <span style={{ width: 22, height: 22, margin: 3, borderRadius: 11, border: `3px solid ${alpha(t.primary, 0.3)}`, borderTopColor: t.primary, transform: `rotate(${frame * 20}deg)` }} />}
                    {s.text}
                    <Sfx name="tick" at={at + 12} volume={0.35} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* input bar */}
        <div style={{ position: "absolute", left: 30, right: 30, bottom: 28, height: 84, borderRadius: 20, background: alpha(t.bg, 0.7), border: `1.5px solid ${alpha(t.primary, typingNow ? 0.8 : 0.3)}`, display: "flex", alignItems: "center", padding: "0 26px", gap: 16 }}>
          <span style={{ fontFamily: t.font.body, fontSize: 28, color: t.dim, flex: 1 }}>{typingNow ? "" : "给我一句命令…"}{typingNow && caret ? "▍" : ""}</span>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: frame >= (data.prompt ? doneAt : lastLine) && frame < (data.prompt ? doneAt : lastLine) + 8 ? t.accent : t.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="send" size={30} color={t.bg} stroke={2.6} />
          </div>
        </div>
      </div>
      {typingSfx.map((f) => (
        <Sfx key={f} name="typing" at={f} volume={0.22} />
      ))}
      <Sfx name="click" at={data.prompt ? doneAt : lastLine} volume={0.4} />
      {(data.reply || steps.length > 0) && <Sfx name="pop" at={replyAt} volume={0.3} />}
    </>
  );
};

export const ChatCommand: CompDef<D> = {
  id: "chat-command",
  name: "给 AI 下指令（对话框打字）",
  layer: "product",
  variants: 1,
  minSec: 3,
  maxSec: 14,
  tags: ["命令", "指令", "提示词", "跟它说", "一句话"],
  motion: { kind: "逐字打字 + 逐条打勾", energy: 2 },
  desc: "AI 对话窗口：你的指令跟着配音逐字打出（或分条 ①②③ 在说到时打出），点击发送后 AI 回复并逐项打勾执行",
  use: "“你给它一句命令：……”“下这条死命令：……”——展示具体对 AI 说了什么",
  hideCaptions: true,
  schema,
  example: {
    app: "Agent Browser",
    appIcon: "browser",
    prompt: "把这个视频下面点赞最高的 500 条评论，全部导成文本",
    typeAt: 10,
    doneAt: 110,
    reply: "收到，开始执行",
    steps: [{ text: "打开视频页面" }, { text: "加载全部评论" }, { text: "导出文本" }],
  },
  C,
};
