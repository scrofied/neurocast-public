import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { easeOut, easeOutBack, prog } from "../../lib/anim";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({ title: z.string().optional(), cta: z.string().optional(), recap: z.array(z.string()).max(5).optional() });
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame }) => {
  const t = useTheme();
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const rec = data.recap ?? [];
  const btn = easeOutBack(prog(frame, 24 + rec.length * 6, 18));
  const title = data.title ?? "下期见";
  return (
    <>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="ot" std={10} />
        {[0, 1, 2, 3].map((i) => {
          const r = 200 + ((frame * 3 + i * 90) % 360);
          return <circle key={i} cx={cx} cy={height - 250} r={r} fill="none" stroke={t.primary} strokeOpacity={0.3 * (1 - (r - 200) / 360)} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(title, 1500, 84), color: t.text, opacity: easeOut(prog(frame, 0, 16)), textShadow: `0 0 30px ${alpha(t.primary, 0.6)}` }}>{title}</div>
      <div style={{ position: "absolute", left: cx - 520, width: 1040, top: 310 }}>
        {rec.map((r, i) => {
          const p = easeOut(prog(frame, 12 + i * 6, 14));
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20, opacity: p, transform: `translateX(${(1 - p) * -60}px)`, fontFamily: t.font.body, fontWeight: 700, fontSize: 34, color: t.text }}>
              <span style={{ fontFamily: t.font.mono, color: t.primary, fontSize: 26 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1, height: 1, maxWidth: 40, background: t.primary }} />
              {r}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: cx - 230,
          top: height - 300,
          width: 460,
          height: 100,
          borderRadius: 50,
          background: `linear-gradient(90deg, ${t.primary}, ${t.secondary})`,
          boxShadow: `0 0 60px ${alpha(t.primary, 0.7)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: t.font.title,
          fontWeight: 900,
          fontSize: 40,
          color: t.bg,
          transform: `scale(${btn * (1 + Math.sin(frame / 6) * 0.03)})`,
        }}
      >
        {data.cta ?? "关注 · 下期更硬核"}
      </div>
    </>
  );
};

export const Outro: CompDef<D> = {
  id: "outro",
  name: "结尾回顾+关注",
  layer: "structure",
  variants: 1,
  minSec: 4,
  maxSec: 8,
  tags: [],
  desc: "结尾：标题 + 逐条回顾要点 + 呼吸发光的关注按钮",
  use: "最后一句（关注/评论区留言等 CTA），放在最后一个镜头",
  schema,
  example: { title: "今天讲了 3 件事", recap: ["Agent 是什么", "怎么搭", "怎么赚钱"], cta: "关注我 · 带你用 AI" },
  C,
};
