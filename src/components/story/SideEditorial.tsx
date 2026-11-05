import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";

const item = z.object({
  text: z.string().describe("左侧动作或要点，不超过10字"),
  note: z.string().optional(),
  icon: z.string().optional(),
  tone: z.enum(["key", "accent", "warn"]).optional(),
  at: z.number().optional(),
});
const schema = z.object({
  kicker: z.string().optional(),
  title: z.string().describe("左侧大标题，用换行分两行"),
  items: z.array(item).min(1).max(4),
  metric: z.string().describe("右侧大数字或短结论，1~4字符"),
  unit: z.string().optional(),
  note: z.string().optional(),
  stamp: z.object({ text: z.string(), sub: z.string().optional(), at: z.number().optional(), tone: z.enum(["key", "accent", "warn"]).optional() }).optional(),
  outAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const enterAt = useEnter(variant);
  const outAt = cueOr(d.outAt, dur - 12);
  const out = easeIn(prog(frame, outAt, 12));
  const layer = { opacity: 1 - out, transform: `translateY(${out * -24}px)` } as const;
  const colOf = (tone?: string) => tone === "warn" ? t.bad : tone === "accent" ? t.accent : t.primary;
  const panel = (side: "left" | "right") => ({
    position: "absolute" as const,
    left: side === "left" ? W * 0.038 : W * 0.72,
    top: H * 0.14,
    width: W * 0.25,
    height: H * 0.64,
    borderRadius: 20,
    background: `linear-gradient(155deg, ${alpha(t.primary, 0.13)}, ${alpha(t.bg, 0.88)} 62%)`,
    border: `1.5px solid ${alpha(t.primary, 0.42)}`,
    boxShadow: `0 24px 70px rgba(0,0,0,.42), inset 0 0 44px ${alpha(t.primary, 0.06)}`,
    backdropFilter: "blur(10px)",
  });
  const titleLines = d.title.split("\n");
  const metricAt = 10;
  const metricK = easeOutBack(prog(frame, metricAt, 15));
  const stampAt = cueOr(d.stamp?.at, dur - 34);
  const stampK = easeOutBack(prog(frame, stampAt, 12));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", ...layer }}>
      <div style={panel("left")}>
        <div style={{ position: "absolute", left: 26, top: 24, color: t.primary, fontFamily: t.font.mono, fontSize: 17, letterSpacing: 3 }}>{d.kicker ?? "// FIELD NOTE"}</div>
        <div style={{ position: "absolute", left: 26, top: 74, width: W * 0.25 - 52 }}>
          {titleLines.map((line, i) => {
            const e = enterAt(frame, 4 + i * 6, { fallback: "slide-l", dur: 13 });
            return <div key={i} style={{ opacity: e.opacity, transform: `translateX(${e.dx}px)`, color: t.text, fontFamily: t.font.title, fontWeight: 900, fontSize: 48, lineHeight: 1.14, whiteSpace: "nowrap", textShadow: `0 3px 18px ${alpha(t.bg, 0.9)}` }}>{line}</div>;
          })}
        </div>
        <div style={{ position: "absolute", left: 26, right: 26, top: 196, height: 2, background: `linear-gradient(90deg, ${t.primary}, transparent)`, transform: `scaleX(${easeOut(prog(frame, 8, 16))})`, transformOrigin: "left" }} />
        <div style={{ position: "absolute", left: 22, right: 22, top: 220, bottom: 22, display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
          {d.items.map((it, i) => {
            const at = cueOr(it.at, 16 + i * 16);
            const e = enterAt(frame, at, { fallback: "rise", dur: 12 });
            const col = colOf(it.tone);
            return (
              <div key={i} style={{ minHeight: 70, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13, borderRadius: 13, background: alpha(col, 0.09), border: `1px solid ${alpha(col, 0.35)}`, opacity: e.opacity, transform: `translateY(${e.dy}px) scale(${e.scale})` }}>
                <Icon name={it.icon ?? (it.tone === "warn" ? "warn" : "check")} size={28} color={col} stroke={2.4} />
                <div>
                  <div style={{ color: t.text, fontFamily: t.font.title, fontWeight: 800, fontSize: 27, lineHeight: 1.15 }}>{it.text}</div>
                  {it.note && <div style={{ marginTop: 4, color: t.dim, fontSize: 16 }}>{it.note}</div>}
                </div>
                <Sfx name={it.tone === "warn" ? "impact" : "pop"} at={at} volume={0.2} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={panel("right")}>
        <div style={{ position: "absolute", left: 26, top: 24, color: t.primary, fontFamily: t.font.mono, fontSize: 17, letterSpacing: 3 }}>// KEY POINT</div>
        <div style={{ position: "absolute", left: 20, right: 20, top: 100, textAlign: "center", opacity: clamp(metricK * 2), transform: `scale(${0.55 + 0.45 * metricK})` }}>
          <div style={{ color: t.text, fontFamily: t.font.title, fontWeight: 900, fontSize: d.metric.length > 3 ? 112 : 168, lineHeight: 1, textShadow: `0 0 44px ${alpha(t.primary, 0.42)}` }}>{d.metric}</div>
          {d.unit && <div style={{ marginTop: 14, color: t.primary, fontFamily: t.font.title, fontWeight: 900, fontSize: 34, letterSpacing: 3 }}>{d.unit}</div>}
          {d.note && <div style={{ margin: "22px auto 0", maxWidth: 360, color: t.dim, fontSize: 23, lineHeight: 1.45 }}>{d.note}</div>}
        </div>
        {d.stamp && frame >= stampAt && (
          <div style={{ position: "absolute", left: 38, right: 38, bottom: 44, padding: "20px 18px", textAlign: "center", borderRadius: 16, background: alpha(colOf(d.stamp.tone), 0.15), border: `3px solid ${alpha(colOf(d.stamp.tone), 0.82)}`, opacity: clamp(stampK * 2), transform: `scale(${0.6 + 0.4 * stampK}) rotate(-3deg)`, boxShadow: `0 0 34px ${alpha(colOf(d.stamp.tone), 0.24)}` }}>
            <div style={{ color: colOf(d.stamp.tone), fontFamily: t.font.title, fontWeight: 900, fontSize: 43 }}>{d.stamp.text}</div>
            {d.stamp.sub && <div style={{ marginTop: 6, color: t.text, fontSize: 19 }}>{d.stamp.sub}</div>}
          </div>
        )}
        <Sfx name="impact" at={metricAt} volume={0.28} />
        {d.stamp && <Sfx name="stamp" at={stampAt} volume={0.36} />}
      </div>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.45 }}>
        <path d={`M${W * 0.29},${H * 0.32} C${W * 0.38},${H * 0.26} ${W * 0.62},${H * 0.26} ${W * 0.71},${H * 0.32}`} fill="none" stroke={alpha(t.primary, 0.35)} strokeWidth={2} strokeDasharray="6 12" strokeDashoffset={-frame * 1.4} />
      </svg>
    </div>
  );
};

export const SideEditorial: CompDef<D> = {
  id: "side-editorial",
  name: "真人两侧编辑台（over 层）",
  layer: "overlay",
  variants: 1,
  minSec: 2,
  maxSec: 12,
  tags: ["真人全屏", "两侧", "编辑台", "大数字", "要点", "over"],
  motion: { kind: "左侧标题与动作逐条写入，右侧大数字冲击和结论章", energy: 2 },
  desc: "真人全屏时，左侧编辑台式大标题与逐条动作，右侧大数字或短结论加印章；中间留人脸，底部留字幕",
  use: "真人回到全屏讲章节结论、权限成本、风险编号和最终建议；与 side-caps 轮换，避免整条片都是同一种胶囊",
  schema,
  example: { kicker: "// 01 · 核心结论", title: "三个死结\n逐一拆开", items: [{ text: "超级 App" }, { text: "平台利益" }, { text: "生态割裂" }], metric: "3", unit: "个死结", note: "不是模型能力问题", stamp: { text: "根本解不开" } },
  C,
};
