import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeOut, prog } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { Glass, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  code: z.string(),
  lang: z.string().optional(),
  file: z.string().optional(),
  title: z.string().optional(),
  highlight: z.array(z.number()).optional(),
});
type D = z.infer<typeof schema>;

const KW = /\b(const|let|var|function|return|if|else|for|while|import|from|export|def|class|async|await|new|in|of|print|True|False|None|true|false|null)\b/g;

const tokenize = (line: string, t: ReturnType<typeof useTheme>) => {
  const out: { s: string; c: string }[] = [];
  const re = /(\/\/.*|#.*)|("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(\.\d+)?\b)|(\b[A-Za-z_]\w*(?=\())|(\b[A-Za-z_]\w*\b)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const s = m[0];
    let c = t.text;
    if (m[1]) c = t.dim;
    else if (m[2]) c = t.accent;
    else if (m[3]) c = t.secondary;
    else if (m[5]) c = t.primary;
    else if (m[6]) c = KW.test(s) ? t.secondary : t.text;
    KW.lastIndex = 0;
    out.push({ s, c });
  }
  return out;
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const lines = data.code.replace(/\t/g, "  ").split("\n").slice(0, 16);
  const total = lines.reduce((a, l) => a + l.length, 0);
  const typeDur = Math.min(dur * 0.6, Math.max(30, total * 0.9));
  const typed = Math.floor(clamp(prog(frame, 14, typeDur)) * total);
  const w = 1180;
  const lh = 44;
  const h = Math.max(360, lines.length * lh + 130);
  const left = variant === 1 ? width - w - 140 : (width - w) / 2;
  const top = (height - h) / 2 + 50;
  // 窗口原生是回弹放大 + 淡入（0.85→1）→ rise + from:0.85，e.scale 与原生 scale 完全等价
  const eW = enterAt(frame, 0, { fallback: "rise", dur: 22, from: 0.85 });
  const tilt = variant === 2 ? 14 : variant === 1 ? -10 : 8;
  const done = typed >= total;
  const hi = new Set((data.highlight ?? []).map((n) => n - 1));
  const hiP = easeOut(prog(frame, 14 + typeDur + 6, 16));

  let remain = typed;
  let caretLine = 0;
  let caretCol = 0;
  const rendered = lines.map((l, i) => {
    const n = Math.max(0, Math.min(l.length, remain));
    if (remain > 0 || i === 0) {
      caretLine = i;
      caretCol = n;
    }
    remain -= l.length;
    return l.slice(0, n);
  });

  return (
    <>
      <div style={{ position: "absolute", left, top, width: w, height: h, transform: `perspective(2000px) translate(${eW.dx}px, ${eW.dy}px) rotateY(${tilt * (1 - eW.p * 0.6)}deg) rotateX(${4 * (1 - eW.p)}deg) scale(${eW.scale})`, clipPath: eW.clip, opacity: clamp(eW.p) }}>
        <Glass style={{ inset: 0 }}>
          <div style={{ height: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", borderBottom: `1px solid ${alpha(t.primary, 0.2)}` }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, opacity: 0.85 }} />
            ))}
            <div style={{ marginLeft: 18, fontFamily: t.font.mono, fontSize: 18, color: t.dim }}>{data.file ?? `main.${data.lang ?? "py"}`}</div>
            <div style={{ marginLeft: "auto", fontFamily: t.font.mono, fontSize: 14, color: done ? t.primary : t.accent, letterSpacing: 2 }}>{done ? "● READY" : "● TYPING"}</div>
          </div>
          <div style={{ padding: "22px 0" }}>
            {rendered.map((l, i) => {
              const isHi = hi.has(i);
              return (
                <div key={i} style={{ position: "relative", height: lh, display: "flex", alignItems: "center", fontFamily: t.font.mono, fontSize: 28, whiteSpace: "pre" }}>
                  {isHi && <div style={{ position: "absolute", left: 0, top: 3, bottom: 3, width: `${hiP * 100}%`, background: alpha(t.primary, 0.14), borderLeft: `3px solid ${t.primary}` }} />}
                  <div style={{ width: 70, textAlign: "right", paddingRight: 22, color: alpha(t.dim, 0.6), fontSize: 20 }}>{i + 1}</div>
                  <div style={{ position: "relative" }}>
                    {tokenize(l, t).map((tk, j) => (
                      <span key={j} style={{ color: tk.c, textShadow: tk.c === t.text ? undefined : `0 0 10px ${alpha(tk.c, 0.5)}` }}>
                        {tk.s}
                      </span>
                    ))}
                    {i === caretLine && <span style={{ display: "inline-block", width: 3, height: 32, marginLeft: 2, verticalAlign: "middle", background: t.primary, opacity: Math.floor(frame / 8) % 2 || !done ? 1 : 0, boxShadow: `0 0 10px ${t.primary}` }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </Glass>
      </div>
      {data.title && <Headline kicker={`CODE · ${(data.lang ?? "python").toUpperCase()}`} title={data.title} frame={frame} x={variant === 1 ? 120 : 120} y={60} size={46} />}
    </>
  );
};

export const CodeEditor: CompDef<D> = {
  id: "code",
  name: "代码编辑器打字",
  layer: "info",
  variants: 3,
  minSec: 4,
  maxSec: 12,
  tags: ["代码", "写代码", "函数", "脚本", "命令", "Python", "JavaScript"],
  motion: { kind: "编辑器窗口回弹入场 + 代码逐字打字 + 光标闪烁", energy: 2 },
  desc: "代码编辑器窗口，代码逐行打字并语法高亮",
  use: "讲稿里用 ``` 包起来的代码块",
  schema,
  example: { code: 'import anthropic\nclient = anthropic.Anthropic()\nmsg = client.messages.create(\n  model="claude-sonnet-5",\n  messages=[{"role":"user","content":"你好"}]\n)\nprint(msg.content)', lang: "py", highlight: [4] },
  C,
};
