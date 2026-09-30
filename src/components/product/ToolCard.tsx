import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cnNum, cueOr, listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const tool = z.object({
  name: z.string(),
  icon: z.string().optional().describe("图标名，如 browser / chart / fire"),
  downloads: z.number().optional().describe("下载量（数字），卡片上计数滚动"),
  display: z.string().optional().describe("下载量显示文字，缺省自动转成 87万 / 9.6万"),
  role: z.string().optional().describe("一句话职责，如“给 AI 用的浏览器”"),
  tags: z.array(z.string()).max(3).optional(),
  at: z.number().optional().describe("卡片出现时刻（阵列模式）"),
});
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  hub: z.string().optional().describe("左上角的平台名，如 Skill Hub"),
  tools: z.array(tool).min(1).max(4),
  focus: z.number().int().optional().describe("聚焦第几个（0 起）；不填 = 并排阵列"),
  total: z.object({ value: z.string(), label: z.string(), at: z.number().optional() }).optional().describe("右上角总量徽章，如 100万+ 人下载"),
  badges: z.array(z.object({ text: z.string(), icon: z.string().optional(), at: z.number().optional() })).max(3).optional().describe("醒目的属性徽章，如“免密钥”"),
  footer: z.object({ text: z.string(), at: z.number().optional() }).optional(),
});
type D = z.infer<typeof schema>;

const Card: React.FC<{ tl: z.infer<typeof tool>; i: number; w: number; h: number; big: boolean; frame: number; at: number; hot: boolean }> = ({ tl, i, w, h, big, frame, at, hot }) => {
  const t = useTheme();
  const count = easeOut(prog(frame, at + 6, big ? 34 : 26));
  const col = hot ? t.accent : t.primary;
  const dl = tl.downloads !== undefined ? (count < 1 ? cnNum(tl.downloads * count) : tl.display ?? cnNum(tl.downloads)) : tl.display;
  const ic = big ? 150 : 104;
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: 28, background: `linear-gradient(160deg, ${alpha(col, 0.16)}, ${t.glass} 40%, ${alpha(t.bg, 0.7)})`, border: `2px solid ${alpha(col, hot ? 0.9 : 0.4)}`, boxShadow: `0 0 ${hot ? 70 : 30}px ${alpha(col, hot ? 0.4 : 0.14)}`, overflow: "hidden" }}>
      <div style={{ position: "absolute", right: 26, top: 6, fontFamily: t.font.mono, fontWeight: 900, fontSize: big ? 150 : 110, color: "transparent", WebkitTextStroke: `2px ${alpha(col, 0.35)}` }}>{String(i + 1).padStart(2, "0")}</div>
      <div style={{ position: "absolute", left: big ? 50 : 34, top: big ? 50 : 36, width: ic, height: ic, borderRadius: ic * 0.26, background: `linear-gradient(135deg, ${col}, ${alpha(t.secondary, 0.9)})`, boxShadow: `0 10px 40px ${alpha(col, 0.5)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={tl.icon ?? "box"} size={ic * 0.52} color={t.bg} stroke={2.4} />
      </div>
      <div style={{ position: "absolute", left: big ? 50 : 34, right: 30, top: big ? 240 : 168 }}>
        <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(tl.name, w - 80, big ? 72 : 46, 24), color: t.text, whiteSpace: "nowrap", textShadow: `0 0 24px ${alpha(col, 0.5)}` }}>{tl.name}</div>
        {tl.role && <div style={{ marginTop: big ? 14 : 10, fontFamily: t.font.body, fontWeight: 700, fontSize: fitFont(tl.role, w - 80, big ? 38 : 26, 16), color: t.dim, whiteSpace: "nowrap" }}>{tl.role}</div>}
      </div>
      {dl && (
        <div style={{ position: "absolute", left: big ? 50 : 34, bottom: big ? 110 : 84, display: "flex", alignItems: "baseline", gap: 10 }}>
          <Icon name="download" size={big ? 44 : 30} color={col} stroke={2.6} />
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: big ? 104 : 60, color: t.text, textShadow: `0 0 30px ${alpha(col, 0.6)}` }}>{dl}</span>
          <span style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: big ? 34 : 24, color: t.dim }}>次下载</span>
        </div>
      )}
      {tl.tags && (
        <div style={{ position: "absolute", left: big ? 50 : 34, bottom: big ? 42 : 30, display: "flex", gap: 10 }}>
          {tl.tags.map((g) => (
            <span key={g} style={{ padding: "4px 14px", borderRadius: 99, border: `1.5px solid ${alpha(col, 0.6)}`, color: col, fontFamily: t.font.body, fontWeight: 700, fontSize: big ? 26 : 19 }}>{g}</span>
          ))}
        </div>
      )}
    </div>
  );
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const tools = data.tools;
  const n = tools.length;
  const focus = data.focus;
  const lineup = focus === undefined || focus < 0 || focus >= n;
  const cues = listCues(tools, 6, Math.min(40, dur * 0.3));
  const cy = height / 2 + 50;
  const cw = Math.min(480, (width - 300) / n - 30);
  const chh = 540;
  const gap = 36;
  const total = n * cw + (n - 1) * gap;
  const x0 = (width - total) / 2;
  const fin = easeInOut(prog(frame, 0, 22));
  const totalAt = data.total ? cueOr(data.total.at, 20) : Infinity;
  const footAt = data.footer ? cueOr(data.footer.at, dur * 0.65) : Infinity;
  return (
    <>
      <Heading kicker={data.kicker ?? (data.hub ? data.hub.toUpperCase() : "TOOLS")} title={data.title} frame={frame} width={width} />
      {tools.map((tl, i) => {
        if (lineup) {
          const at = cues[i];
          const p = easeOutBack(prog(frame, at, 20));
          if (frame < at) return null;
          return (
            <div key={i} style={{ position: "absolute", left: x0 + i * (cw + gap), top: cy - chh / 2, width: cw, height: chh, transform: `perspective(1400px) translateY(${(1 - clamp(p)) * 120}px) rotateX(${(1 - clamp(p)) * 30}deg) scale(${0.9 + 0.1 * p})`, opacity: clamp(p * 1.5) }}>
              <Card tl={tl} i={i} w={cw} h={chh} big={false} frame={frame} at={at} hot={false} />
              <Sfx name="pop" at={at} volume={0.3} />
            </div>
          );
        }
        // focus mode: the chosen card flies to the centre, neighbours sit dimmed at the sides, farther ones fade out behind
        const rel = i - focus!;
        const isF = rel === 0;
        const far = Math.abs(rel) >= 2;
        const bw = isF ? 760 : 400;
        const bh = isF ? 660 : 470;
        const x = isF ? width / 2 - bw / 2 : rel < 0 ? 150 - (far ? 170 : 0) : width - 150 - bw + (far ? 170 : 0);
        const y = cy - bh / 2 + (isF ? 0 : 20);
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: bw, height: bh, zIndex: isF ? 5 : far ? 0 : 1, opacity: isF ? clamp(fin * 1.4) : (far ? 0.14 : 0.38) * fin, filter: isF ? undefined : `blur(${far ? 4 : 2}px) saturate(0.6)`, transform: isF ? `scale(${0.8 + 0.2 * easeOutBack(prog(frame, 0, 22))})` : `perspective(1200px) rotateY(${rel < 0 ? 18 : -18}deg) scale(${far ? 0.8 : 0.92})` }}>
            <Card tl={tl} i={i} w={bw} h={bh} big={isF} frame={frame} at={isF ? 4 : -100} hot={isF} />
          </div>
        );
      })}
      {data.hub && (
        <div style={{ position: "absolute", left: 120, top: 200, display: "flex", alignItems: "center", gap: 14, fontFamily: t.font.mono, fontWeight: 700, fontSize: 30, color: t.primary, opacity: lineup ? easeOut(prog(frame, 2, 14)) : 0 }}>
          <Icon name="grid" size={32} color={t.primary} />
          {data.hub}
        </div>
      )}
      {data.total && frame >= totalAt && (
        <div style={{ position: "absolute", right: 120, top: 150, transform: `scale(${easeOutBack(prog(frame, totalAt, 16))})`, transformOrigin: "right center", textAlign: "right" }}>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 78, color: t.gold, textShadow: `0 0 30px ${alpha(t.gold, 0.6)}` }}>{data.total.value}</div>
          <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 28, color: t.dim }}>{data.total.label}</div>
        </div>
      )}
      {(data.badges ?? []).map((b, i) => {
        const at = cueOr(b.at, 30 + i * 12);
        if (frame < at) return null;
        return (
          <div key={i} style={{ position: "absolute", left: (data.hub ? 440 : 120) + i * 260, top: 186, transform: `rotate(-4deg) scale(${easeOutBack(prog(frame, at, 14))})`, transformOrigin: "left center", padding: "10px 24px", borderRadius: 14, border: `3px solid ${t.primary}`, background: alpha(t.primary, 0.15), color: t.primary, fontFamily: t.font.title, fontWeight: 900, fontSize: 38, display: "flex", alignItems: "center", gap: 10, boxShadow: `0 0 30px ${alpha(t.primary, 0.45)}`, whiteSpace: "nowrap" }}>
            <Icon name={b.icon ?? "unlock"} size={36} color={t.primary} stroke={2.6} />
            {b.text}
            <Sfx name="stamp" at={at} volume={0.35} />
          </div>
        );
      })}
      {data.footer && frame >= footAt && (
        <div style={{ position: "absolute", left: 0, right: 0, top: cy + chh / 2 + 40, textAlign: "center", fontFamily: t.font.body, fontWeight: 800, fontSize: 38, color: t.text, opacity: easeOut(prog(frame, footAt, 14)), transform: `translateY(${(1 - easeOut(prog(frame, footAt, 14))) * 20}px)` }}>{data.footer.text}</div>
      )}
      {!lineup && <Sfx name="whoosh" at={2} volume={0.2} />}
      {!lineup && <Sfx name="tick" at={40} volume={0.3} />}
    </>
  );
};

export const ToolCard: CompDef<D> = {
  id: "tool-card",
  name: "工具/产品卡（下载量滚动）",
  layer: "product",
  variants: 1,
  minSec: 2,
  maxSec: 10,
  tags: ["推荐", "工具", "Skill", "插件", "App", "下载量", "第一个", "第二个"],
  desc: "应用商店风的发光卡片：图标、名字、一句话职责、下载量计数滚动、标签。阵列模式并排飞入；focus 模式把第 N 张放大居中、其余虚化到两侧",
  use: "盘点/推荐工具、插件、Skill、产品；“第一个…第二个…”逐个介绍时每个用一次 focus",
  schema,
  example: {
    hub: "Skill Hub",
    tools: [
      { name: "Agent Browser", icon: "browser", downloads: 870000, role: "给 AI 用的浏览器", tags: ["挖评论"] },
      { name: "Data Analysis", icon: "chart", downloads: 96000, role: "把评论洗干净", tags: ["清洗"] },
      { name: "热点选题", icon: "fire", downloads: 92000, role: "从痛点到成片", tags: ["收尾"] },
    ],
    total: { value: "100万+", label: "人下载", at: 50 },
    badges: [{ text: "免密钥", icon: "unlock", at: 80 }],
  },
  C,
};
