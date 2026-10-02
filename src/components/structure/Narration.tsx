import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeOutBack, rng } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Glass } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// fallback shot for plain narration: keywords orbit in 3D-ish depth, current key phrase in focus
const schema = z.object({ keywords: z.array(z.string()).min(1).max(6), line: z.string().optional() });
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const kws = data.keywords;
  const n = kws.length;
  const per = dur / n;
  const cur = Math.min(n - 1, Math.floor(frame / per));
  const cx = width / 2;
  const cy = height / 2 + 10;
  const r = rng(seed + 21);
  const lineIn = enterAt(frame, 8, { fallback: "rise", dur: 16 });
  return (
    <>
      {kws.map((k, i) => {
        const a = (i / n) * Math.PI * 2 + frame * 0.004 + r();
        const isCur = i === cur;
        const focusP = isCur ? easeOutBack(clamp((frame - i * per) / 14)) : 0;
        const orbitR = 520;
        const depth = Math.sin(a);
        const ox = cx + Math.cos(a) * orbitR;
        const oy = cy + depth * 190;
        const x = ox + (cx - ox) * focusP;
        const y = oy + (cy - oy) * focusP;
        const s = (0.55 + (depth + 1) * 0.18) * (1 - focusP) + focusP * 1.0;
        const fs = isCur ? fitFont(k, 1300, 110) : 44;
        const appear = enterAt(frame, i * 3, { fallback: "rise", dur: 14, seed: i }); // 环绕位置是主体轨迹，只接淡入
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%,-50%) scale(${s}) translate(${appear.dx}px, ${appear.dy}px)`,
              fontFamily: t.font.title,
              fontWeight: 900,
              fontSize: fs,
              whiteSpace: "nowrap",
              color: isCur ? t.text : alpha(t.text, 0.35 + (depth + 1) * 0.15),
              opacity: appear.opacity,
              filter: isCur ? undefined : `blur(${(1 - (depth + 1) / 2) * 3}px)`,
              textShadow: isCur ? `0 0 40px ${alpha(t.primary, 0.8)}` : undefined,
              zIndex: isCur ? 10 : Math.round((depth + 1) * 4),
            }}
          >
            {variant === 1 && isCur ? <span style={{ color: t.primary }}>「</span> : null}
            {k}
            {variant === 1 && isCur ? <span style={{ color: t.primary }}>」</span> : null}
          </div>
        );
      })}
      {data.line && (
        <Glass style={{ left: cx - 700, width: 1400, top: height - 330, height: 90, display: "flex", alignItems: "center", justifyContent: "center", opacity: lineIn.opacity, transform: `translate(${lineIn.dx}px, ${lineIn.dy}px)`, clipPath: lineIn.clip }} corners={false}>
          <div style={{ fontFamily: t.font.body, fontSize: 34, fontWeight: 600, color: t.text, padding: "0 40px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.line}</div>
        </Glass>
      )}
    </>
  );
};

export const Narration: CompDef<D> = {
  id: "narration",
  name: "关键词轨道（通用叙述）",
  layer: "structure",
  variants: 2,
  minSec: 3,
  maxSec: 9,
  tags: [],
  motion: { kind: "关键词在 3D 轨道上环绕，当前词拉到中心放大", energy: 2 },
  desc: "几个关键词在 3D 轨道上环绕，当前词拉到中心放大",
  use: "兜底：普通叙述、没有更贴切的画面时（写分镜时尽量少用）",
  schema,
  example: { keywords: ["效率", "成本", "规模"], line: "AI 改变的不是工具，是生产关系" },
  C,
};
