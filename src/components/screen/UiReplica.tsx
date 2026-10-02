import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const act = z.object({
  click: z.string().optional().describe("点哪一个（按 UI 里的名字，如“运行”“导出”）"),
  type: z.string().optional().describe("输入/打印这一行字"),
  at: z.number().optional().describe("这个动作发生的时刻（锚点）"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  app: z.enum(["editor", "terminal", "timeline", "chat"]).default("editor").describe("界面预设：editor 代码编辑器 / terminal 终端 / timeline 剪辑时间线 / chat 聊天窗口"),
  windowTitle: z.string().describe("标题栏上的字：Cursor / Codex / 剪映 / 微信"),
  sidebar: z.array(z.string()).max(7).default([]).describe("左侧栏的条目（文件列表 / 工具栏 / 会话列表）"),
  lines: z.array(z.string()).max(12).default([]).describe("内容区逐行打出来的内容（代码 / 终端输出 / 聊天消息）"),
  buttons: z.array(z.string()).max(4).default([]).describe("内容区右下角的按钮（第一个会被光标点中）"),
  highlight: z.string().optional().describe("高亮哪个按钮"),
  actions: z.array(act).max(6).default([]).describe("按顺序发生的动作：点某处 / 打某行字"),
  caption: z.string().optional().describe("底部一句旁白，如“它正在读你的代码”"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const acts = data.actions.length ? data.actions : [];
  const cues = acts.map((a, i) => cueOr(a.at, 14 + i * Math.round(Math.max(14, (dur * 0.6) / Math.max(1, acts.length)))));
  const winW = full ? W * 0.74 : W * 0.9;
  const winH = full ? H * 0.62 : H * 0.72;
  const winX = (W - winW) / 2;
  const winY = full ? H * 0.16 : H * 0.1;
  const barH = full ? 52 : 30;
  const sideW = data.sidebar.length ? (full ? 230 : 100) : 0;
  const app = data.app;
  const inP = easeOut(prog(frame, 0, 16));
  // typed content: each line types in, staggered from the first action
  const typeStart = cues[0] ?? 12;
  const perLine = Math.max(8, Math.min(26, Math.round((dur * 0.6) / Math.max(1, data.lines.length))));
  const shownLines = data.lines.map((l, i) => {
    const at = typeStart + i * perLine;
    const k = clamp((frame - at) / Math.max(6, perLine * 0.7));
    return { text: Array.from(l).slice(0, Math.round(k * Array.from(l).length)).join(""), done: k >= 1, at };
  });
  // cursor: moves to each action's target, clicks (scale pulse), then types
  const cursor = (() => {
    let x = winX + winW * 0.55;
    let y = winY + winH * 0.5;
    let click = 0;
    acts.forEach((a, i) => {
      const c = cues[i];
      const t0 = Math.max(0, c - 10);
      const k = easeInOut(prog(frame, t0, 10));
      // target: the highlighted button (if named) or the typing area
      const isButton = data.buttons.some((b) => b === a.click);
      const bx = data.buttons.length ? winX + winW - (full ? 200 : 70) - data.buttons.indexOf(a.click ?? "") * (full ? 150 : 80) : winX + winW * 0.6;
      const by = winY + winH - (full ? 44 : 26);
      const tx = isButton ? bx : winX + sideW + (full ? 60 : 26);
      const ty = isButton ? by : winY + barH + (full ? 40 : 20) + shownLines.length * (full ? 30 : 17);
      if (frame >= t0) {
        x = lerp(x, tx, k);
        y = lerp(y, ty, k);
      }
      // click pulse right at the cue (only when he is actually clicking something)
      if (isButton && frame >= c && frame < c + 10) click = 1 - (frame - c) / 10;
    });
    return { x, y, click };
  })();

  const buttonsY = winY + winH - (full ? 70 : 34);

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      {/* window */}
      <div style={{ position: "absolute", left: winX, top: lerp(winY + 60, winY, inP), width: winW, height: winH, opacity: inP, borderRadius: 16, background: alpha(t.bg2, 0.96), border: `2.5px solid ${alpha(t.primary, 0.55)}`, boxShadow: `0 30px 80px rgba(0,0,0,.6), 0 0 40px ${alpha(t.primary, 0.18)}`, overflow: "hidden" }}>
        {/* title bar */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: barH, background: alpha(t.primary, 0.1), borderBottom: `2px solid ${alpha(t.primary, 0.3)}`, display: "flex", alignItems: "center", paddingLeft: full ? 20 : 10, gap: full ? 14 : 7 }}>
          {["#ff5d6c", "#ffcf5c", "#3dffa8"].map((c, i) => (
            <div key={i} style={{ width: full ? 15 : 8, height: full ? 15 : 8, borderRadius: "50%", background: c, opacity: 0.85 }} />
          ))}
          <span style={{ marginLeft: full ? 12 : 6, fontFamily: t.font.mono, fontWeight: 700, fontSize: full ? 22 : 12, color: alpha(t.text, 0.85), whiteSpace: "nowrap" }}>{data.windowTitle}</span>
          {app === "editor" && <span style={{ marginLeft: "auto", marginRight: full ? 20 : 10, fontFamily: t.font.mono, fontSize: full ? 17 : 10, color: t.dim, whiteSpace: "nowrap" }}>main.tsx</span>}
        </div>
        {/* sidebar */}
        {sideW > 0 && (
          <div style={{ position: "absolute", left: 0, top: barH, bottom: 0, width: sideW, background: alpha(t.bg, 0.7), borderRight: `1.5px solid ${alpha(t.text, 0.12)}`, padding: full ? "14px 12px" : "7px 6px", display: "flex", flexDirection: "column", gap: full ? 8 : 4 }}>
            {data.sidebar.map((s, i) => {
              const active = i === 0;
              const p = easeOut(prog(frame, 8 + i * 4, 10));
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: full ? 8 : 4, padding: `${full ? 5 : 2}px ${full ? 10 : 5}px`, borderRadius: 7, background: active ? alpha(t.primary, 0.16) : "transparent", opacity: p }}>
                  <Icon name={app === "chat" ? "user" : "doc"} size={full ? 17 : 9} color={active ? t.primary : t.dim} />
                  <span style={{ fontFamily: t.font.body, fontWeight: active ? 800 : 600, fontSize: fitFont(s, sideW - (full ? 60 : 30), full ? 19 : 10, 8), color: active ? t.text : t.dim, whiteSpace: "nowrap" }}>{s}</span>
                </div>
              );
            })}
          </div>
        )}
        {/* content area */}
        <div style={{ position: "absolute", left: sideW, right: 0, top: barH, bottom: full ? 90 : 46, padding: full ? "18px 24px" : "9px 12px", overflow: "hidden" }}>
          {app === "chat"
            ? shownLines.map((l, i) => {
                if (!l.text) return null;
                const mine = i % 2 === 1;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: full ? 12 : 6 }}>
                    <div style={{ maxWidth: "76%", padding: `${full ? 9 : 4}px ${full ? 16 : 8}px`, borderRadius: 12, background: mine ? alpha(t.primary, 0.22) : alpha(t.text, 0.09), border: `1.5px solid ${alpha(mine ? t.primary : t.dim, 0.5)}`, fontFamily: t.font.body, fontWeight: 700, fontSize: full ? 21 : 11, color: t.text, whiteSpace: "nowrap" }}>{l.text}</div>
                  </div>
                );
              })
            : shownLines.map((l, i) => {
                if (!l.text) return null;
                const isPrompt = l.text.startsWith("$") || l.text.startsWith(">");
                return (
                  <div key={i} style={{ fontFamily: t.font.mono, fontSize: full ? 22 : 12, lineHeight: full ? 1.55 : 1.4, color: isPrompt ? t.primary : app === "terminal" ? alpha(t.text, 0.88) : alpha(t.text, 0.9), whiteSpace: "pre", marginBottom: full ? 4 : 2 }}>
                    {l.text}
                    {!l.done && <span style={{ opacity: 0.75 }}>▌</span>}
                  </div>
                );
              })}
          {/* timeline preset draws clip blocks */}
          {app === "timeline" && (
            <div style={{ marginTop: full ? 20 : 10 }}>
              {[0, 1, 2].map((r) => (
                <div key={r} style={{ position: "relative", height: full ? 42 : 22, marginBottom: full ? 8 : 4, background: alpha(t.text, 0.06), borderRadius: 6 }}>
                  {Array.from({ length: 3 }, (_, c) => {
                    const cw = (winW - sideW - (full ? 48 : 24)) / 3 - (full ? 8 : 4);
                    const on = frame >= 20 + r * 8 + c * 6;
                    return <div key={c} style={{ position: "absolute", left: c * (cw + (full ? 8 : 4)), top: 2, width: cw, height: full ? 38 : 18, borderRadius: 5, background: on ? `linear-gradient(90deg, ${alpha(t.secondary, 0.7)}, ${alpha(t.primary, 0.5)})` : alpha(t.text, 0.1), transform: `scaleX(${on ? easeOutBack(prog(frame, 20 + r * 8 + c * 6, 10)) : 0})`, transformOrigin: "0 50%" }} />;
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* buttons */}
        {data.buttons.length > 0 && (
          <div style={{ position: "absolute", left: sideW, right: full ? 24 : 12, top: buttonsY, display: "flex", justifyContent: "flex-end", gap: full ? 14 : 7 }}>
            {data.buttons.map((b, i) => {
              const isHl = data.highlight === b || (acts.some((a) => a.click === b) && frame >= (cues[acts.findIndex((a) => a.click === b)] ?? 0));
              const p = easeOut(prog(frame, 10 + i * 3, 10));
              return (
                <div key={i} style={{ padding: `${full ? 8 : 4}px ${full ? 22 : 11}px`, borderRadius: 8, background: isHl ? t.primary : alpha(t.text, 0.1), border: `2px solid ${isHl ? t.primary : alpha(t.dim, 0.5)}`, boxShadow: isHl ? `0 0 24px ${alpha(t.primary, 0.7)}` : undefined, fontFamily: t.font.title, fontWeight: 800, fontSize: full ? 21 : 11, color: isHl ? t.bg : t.text, whiteSpace: "nowrap", opacity: p }}>{b}</div>
              );
            })}
          </div>
        )}
      </div>
      {/* the cursor */}
      <div style={{ position: "absolute", left: cursor.x, top: cursor.y, transform: `translate(-50%,-50%) scale(${1 - cursor.click * 0.3})`, pointerEvents: "none" }}>
        <svg width={full ? 40 : 22} height={full ? 48 : 26} viewBox="0 0 20 24">
          <path d="M2,2 L2,20 L7,15 L10.5,22 L13,21 L9.5,14 L16,14 Z" fill="#fff" stroke="#000" strokeWidth={1.6} />
        </svg>
        {cursor.click > 0 && <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: full ? 70 : 38, height: full ? 70 : 38, borderRadius: "50%", border: `3px solid ${alpha(t.accent, cursor.click)}` }} />}
      </div>
      {data.caption && (
        <div style={{ position: "absolute", left: 0, right: 0, top: winY + winH + (full ? 28 : 14), textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.caption, W * 0.8, full ? 38 : 19, 13), color: t.accent, whiteSpace: "nowrap", opacity: easeOut(prog(frame, 12, 14)), textShadow: `0 0 18px ${alpha(t.accent, 0.5)}` }}>{data.caption}</div>
      )}
      <Sfx name="click" at={8} volume={0.24} />
      {acts.map((a, i) => (
        <Sfx key={i} name={a.click ? "click" : "typing"} at={cues[i]} volume={a.click ? 0.32 : 0.18} />
      ))}
    </>
  );
};

export const UiReplica: CompDef<D> = {
  id: "ui-replica",
  name: "仿制界面（没有录屏时用）",
  layer: "screen",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["界面", "软件", "编辑器", "终端", "剪映", "正在读代码"],
  motion: { kind: "窗口立起 → 侧栏/内容逐行打字 → 鼠标按锚点滑动点击 → 按钮高亮", energy: 2 },
  desc: "程序化画出一个程序窗口（标题栏 + 侧栏 + 内容区），内容按配音逐行打出来，鼠标光标滑到指定按钮上点击、那一下按钮高亮发光；四种预设：代码编辑器 / 终端 / 剪辑时间线 / 聊天窗口 —— 手上没有录屏时用它顶替",
  use: "讲到某个具体软件但没素材：Cursor 写代码一闪而过、Codex 终端执行、剪映时间线加 AI 按钮、聊天窗口里 AI 正在读你的代码（有真实截图/录屏时优先用 screen）",
  panel: false,
  schema,
  example: { app: "editor", windowTitle: "Cursor", sidebar: ["main.tsx", "utils.ts", "config.json"], lines: ["// 把这段贴进去就能跑", "const app = createAgent({", "  model: 'claude',", "  tools: [readFile, writeFile],", "});"], buttons: ["运行", "部署"], highlight: "运行", actions: [{ click: "运行", at: 40 }], caption: "它正在读你的代码" },
  C,
};
