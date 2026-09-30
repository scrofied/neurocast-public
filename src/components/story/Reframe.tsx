import React from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const side = z.object({
  label: z.string().describe("这一侧是谁的视角，如 你 · 工位上 / 想入行的新人"),
  icon: z.string().optional(),
  items: z.array(z.object({ text: z.string(), at: z.number().optional() })).min(1).max(3),
  at: z.number().optional().describe("这一侧点亮的时刻（锚点，如“新人眼里”）"),
});
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  you: side.describe("你自己这一侧：被当成负担的东西"),
  them: side.describe("另一群人这一侧：同一件东西在他们眼里值钱"),
  revealAt: z.number().optional().describe("视角翻转的时刻（锚点，如“新人眼里”）；缺省用 them.at"),
  verdict: z.string().optional().describe("翻转后的结论，如 换个视角，全是资产"),
  verdictAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const youCues = listCues(data.you.items, 6, Math.max(24, dur * 0.3));
  const revealAt = cueOr(data.revealAt ?? data.them.at, Math.max(youCues[youCues.length - 1] + 16, dur * 0.46));
  const themCues = listCues(data.them.items, revealAt + 12, revealAt + 46);
  const verdictAt = cueOr(data.verdictAt, themCues[themCues.length - 1] + 18);

  const px = width * 0.062;
  const pw = width * 0.37;
  const py = height * 0.3;
  const ph = height * 0.44;
  const qx = width * 0.568;
  const cx = width * 0.5;
  const cy = py + ph * 0.42;

  const rv = easeOut(prog(frame, revealAt, 16));
  const sweep = easeOut(prog(frame, revealAt, 20));
  const vd = easeOutBack(prog(frame, verdictAt, 12));
  const seedAngle = frame * 0.9;

  return (
    <>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />

      {/* the lens between the two readings */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="rfCone" cx="0%" cy="50%" r="100%">
            <stop offset="0" stopColor={alpha(t.gold, 0.42 * rv)} />
            <stop offset="1" stopColor={alpha(t.gold, 0)} />
          </radialGradient>
        </defs>
        {/* the beam that turns the same thing into something else */}
        <polygon points={`${cx},${cy} ${width},${cy - ph * 0.75} ${width},${cy + ph * 0.75}`} fill="url(#rfCone)" opacity={rv} />
        <circle cx={cx} cy={cy} r={86} fill={alpha(t.bg, 0.9)} stroke={rv > 0.5 ? t.gold : "#6b6b80"} strokeWidth={4} style={{ filter: `drop-shadow(0 0 ${30 * rv}px ${alpha(t.gold, 0.7)})` }} />
        <circle cx={cx} cy={cy} r={104} fill="none" stroke={alpha(rv > 0.5 ? t.gold : t.primary, 0.4)} strokeWidth={2} strokeDasharray="10 14" strokeDashoffset={-seedAngle} />
      </svg>
      <div style={{ position: "absolute", left: cx - 44, top: cy - 44, width: 88, height: 88, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="eye" size={54} color={rv > 0.5 ? t.gold : "#9aa3ad"} stroke={1.9} />
      </div>

      {/* your side: grey, a burden */}
      <div
        style={{
          position: "absolute",
          left: px,
          top: py,
          width: pw,
          minHeight: ph,
          padding: "28px 30px",
          borderRadius: 20,
          background: "rgba(38,38,48,.86)",
          border: "2px solid #6b6b80",
          opacity: easeOut(prog(frame, 2, 14)) * (1 - rv * 0.2),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: t.font.body, fontWeight: 800, fontSize: 28, color: "#c9ced6" }}>
          <Icon name={data.you.icon ?? "user"} size={34} color="#c9ced6" stroke={1.8} />
          <span style={{ whiteSpace: "nowrap" }}>{data.you.label}</span>
        </div>
        {data.you.items.map((it, i) => {
          const p = easeOutBack(prog(frame, youCues[i], 12));
          if (frame < youCues[i]) return null;
          return (
            <div
              key={i}
              style={{
                marginTop: 24,
                padding: "18px 22px",
                borderRadius: 14,
                background: "rgba(24,24,32,.8)",
                border: "2px solid #5c5c70",
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: fitFont(it.text, pw - 100, 44, 22),
                color: "#b9bfc9",
                whiteSpace: "nowrap",
                transform: `translateX(${(1 - p) * -40}px)`,
                opacity: Math.min(1, p),
              }}
            >
              {it.text}
            </div>
          );
        })}
      </div>

      {/* their side: same thing, now worth money */}
      <div
        style={{
          position: "absolute",
          left: qx,
          top: py,
          width: pw,
          minHeight: ph,
          padding: "28px 30px",
          borderRadius: 20,
          background: rv > 0.02 ? `linear-gradient(155deg, ${alpha(t.gold, 0.16)}, ${alpha(t.bg2, 0.94)} 62%)` : alpha(t.bg, 0.6),
          border: `3px solid ${rv > 0.02 ? alpha(t.gold, 0.5 + 0.45 * rv) : "#3a3a48"}`,
          boxShadow: rv > 0.1 ? `0 0 ${44 * rv}px ${alpha(t.gold, 0.35)}` : undefined,
          opacity: easeOut(prog(frame, 2, 14)),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: t.font.body, fontWeight: 800, fontSize: 28, color: rv > 0.4 ? t.gold : "#7c7c90", transition: "none" }}>
          <Icon name={data.them.icon ?? "users"} size={34} color={rv > 0.4 ? t.gold : "#7c7c90"} stroke={1.8} />
          <span style={{ whiteSpace: "nowrap" }}>{data.them.label}</span>
        </div>
        {rv < 0.25 && <div style={{ marginTop: 42, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: 190, lineHeight: 1, color: alpha("#ffffff", 0.07 * (1 - rv * 3)) }}>?</div>}
        {data.them.items.map((it, i) => {
          const p = easeOutBack(prog(frame, themCues[i], 14));
          if (frame < themCues[i]) return null;
          const flip = clamp((frame - themCues[i]) / 14);
          return (
            <div
              key={i}
              style={{
                marginTop: 24,
                padding: "18px 22px",
                borderRadius: 14,
                background: `linear-gradient(120deg, ${alpha(t.gold, 0.22)}, ${alpha(t.bg, 0.86)})`,
                border: `2px solid ${t.gold}`,
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: fitFont(it.text, pw - 100, 44, 22),
                color: t.text,
                whiteSpace: "nowrap",
                transform: `perspective(900px) rotateY(${(1 - flip) * -78}deg) translateX(${(1 - p) * 30}px)`,
                transformOrigin: "left center",
                opacity: Math.min(1, p * 1.4),
                boxShadow: `0 0 22px ${alpha(t.gold, 0.28)}`,
              }}
            >
              {it.text}
            </div>
          );
        })}
        {/* light sweep across the panel */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 20, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-20%", bottom: "-20%", left: `${sweep * 118 - 18}%`, width: 90, background: `linear-gradient(90deg, transparent, ${alpha("#ffffff", 0.5 * (1 - sweep))}, transparent)`, opacity: sweep < 1 ? 1 : 0 }} />
        </div>
      </div>

      {data.verdict && frame >= verdictAt - 4 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: py + ph + 46,
            textAlign: "center",
            fontFamily: t.font.title,
            fontWeight: 900,
            fontSize: fitFont(data.verdict, 1300, 62, 32),
            color: t.gold,
            opacity: clamp(vd * 2),
            transform: `scale(${0.9 + 0.1 * vd})`,
            textShadow: `0 0 30px ${alpha(t.gold, 0.6)}`,
          }}
        >
          {data.verdict}
        </div>
      )}

      {youCues.map((c, i) => (
        <Sfx key={`y${i}`} name="pop" at={c} volume={0.26} />
      ))}
      <Sfx name="whoosh" at={revealAt} volume={0.3} />
      {themCues.map((c, i) => (
        <Sfx key={`t${i}`} name="ding" at={c} volume={0.24} />
      ))}
      {data.verdict && <Sfx name="success" at={verdictAt} volume={0.34} />}
    </>
  );
};

export const Reframe: CompDef<D> = {
  id: "reframe",
  name: "换个视角（同一件事，两边两种价值）",
  layer: "story",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["视角", "换位", "你以为", "别人眼里", "值钱", "排雷指南"],
  desc: "左边灰色面板写你自己的视角（烦心事、踩过的坑），中间一只眼睛透镜，说到关键处一道金光扫过右侧面板：同一件东西在另一群人眼里发光并被翻转亮出（排雷指南、避坑清单），最后砸出结论",
  use: "同一件事换个人看就值钱：你的坑是别人的排雷指南、你的日常是别人的刚需、你的抱怨是别人的需求、你的经验是新人的导航（you / them / verdict 全可改）",
  schema,
  example: {
    kicker: "看到差距了吗？",
    you: { label: "你 · 工位上", items: [{ text: "烦心事" }, { text: "踩过的坑" }] },
    them: { label: "想入行的新人", items: [{ text: "排雷指南" }, { text: "避坑清单" }] },
    verdict: "换个视角，全是资产",
  },
  C,
};
