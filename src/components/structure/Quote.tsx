import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeOut, prog } from "../../lib/anim";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../types";

const schema = z.object({ text: z.string(), emphasis: z.array(z.string()).optional(), kicker: z.string().optional() });
type D = z.infer<typeof schema>;

// big statement: characters ignite one by one, emphasised words burn in accent colour
const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { width } = useVideoConfig();
  const text = data.text;
  const emph = data.emphasis ?? [];
  const mask = new Array(text.length).fill(false);
  for (const e of emph) {
    let i = text.indexOf(e);
    while (e && i >= 0) {
      for (let k = 0; k < e.length; k++) mask[i + k] = true;
      i = text.indexOf(e, i + e.length);
    }
  }
  const chars = Array.from(text);
  const len = chars.length;
  const perLine = len <= 12 ? len : len <= 26 ? Math.ceil(len / 2) : Math.ceil(len / 3);
  const fs = Math.min(120, (width - 300) / Math.max(4, perLine));
  const lines: string[][] = [];
  for (let i = 0; i < len; i += perLine) lines.push(chars.slice(i, i + perLine));
  const speed = Math.max(1, Math.min(3, (dur * 0.5) / len));
  let idx = 0;
  return (
    <>
      <div style={{ position: "absolute", left: 150, right: 150, top: "50%", transform: "translateY(-50%)", textAlign: variant === 1 ? "left" : "center" }}>
        <div style={{ fontFamily: t.font.mono, fontSize: 20, letterSpacing: 8, color: t.primary, marginBottom: 30, opacity: easeOut(prog(frame, 0, 12)) }}>{data.kicker ?? "// KEY INSIGHT"}</div>
        {lines.map((ln, li) => (
          <div key={li} style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, lineHeight: 1.3, whiteSpace: "nowrap" }}>
            {ln.map((c) => {
              const i = idx++;
              const p = easeOut(prog(frame, 6 + i * speed, 10));
              const isE = mask[i];
              const burn = isE ? clamp(prog(frame, 6 + i * speed + 8, 10)) : 0;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    color: isE ? t.accent : t.text,
                    opacity: 0.08 + p * 0.92,
                    transform: `translateY(${(1 - p) * 20}px)`,
                    textShadow: p > 0.1 ? `0 0 ${isE ? 30 + burn * 30 : 18}px ${alpha(isE ? t.accent : t.primary, isE ? 0.8 : 0.45)}` : "none",
                    filter: `blur(${(1 - p) * 6}px)`,
                  }}
                >
                  {c === " " ? " " : c}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
};

export const Quote: CompDef<D> = {
  id: "quote",
  name: "金句点燃",
  layer: "structure",
  variants: 2,
  minSec: 3,
  maxSec: 7,
  tags: ["记住", "本质", "核心", "关键", "一句话", "说白了", "真正"],
  desc: "一句话大字逐字点燃，强调词烧成强调色（变体 1 左对齐）",
  use: "金句、结论、观点总结（10~26 字）；更短更冲的反问/吐槽用 punch-text",
  schema,
  example: { text: "工具不会淘汰你，会用工具的人会", emphasis: ["会用工具的人"] },
  C,
};
