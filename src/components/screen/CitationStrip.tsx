import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeOut, prog } from "../../lib/anim";
import { assetUrl } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 出处清单：一条结论来自哪几处。每条 = 真截图缩略 + 标题 + 可辨识的地址 + 时间。
// 存在的理由：地址栏写假的域名比不写更伤信任；这里地址是字段，写不出真地址就别上这条。
const cite = z.object({
  title: z.string().describe("这份材料叫什么：榜单名 / 文章标题 / 文档名"),
  url: z.string().describe("真地址，只写域名+短路径（写不出真地址就不该用这个组件）"),
  date: z.string().optional().describe("采集/发布时间，如 2026-09-30"),
  src: z.string().optional().describe("缩略图：那张截图/页面（相对 public/）"),
  note: z.string().optional().describe("它支撑了哪句话"),
  at: z.number().optional(),
});
const schema = z.object({
  kicker: z.string().optional(),
  title: z.string().optional(),
  items: z.array(cite).min(1).max(4),
  at: z.number().optional().describe("第一条进来的时刻"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const n = data.items.length;
  const start = data.at ?? 6;
  const cues = listCues(data.items.map((c) => ({ at: c.at })), start, Math.max(start + 24, dur - 12));
  const rowH = Math.min(190, (height - 420) / n);
  const w = Math.min(1420, width - 240);
  const x = (width - w) / 2;
  const y0 = height / 2 - (n * rowH) / 2 + 60;

  return (
    <>
      <Heading kicker={data.kicker ?? "SOURCES"} title={data.title} frame={frame} width={width} />
      {data.items.map((c, i) => {
        const e = enterAt(frame, cues[i], { fallback: i % 2 ? "slide-r" : "slide-l", dur: 16 });
        const top = y0 + i * rowH;
        const hot = frame >= cues[i] && frame < cues[i] + 22;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top,
              width: w,
              height: rowH - 16,
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "0 26px",
              borderRadius: 18,
              background: alpha(hot ? t.bg2 : t.bg, 0.9),
              border: `1.5px solid ${alpha(hot ? t.primary : t.line, hot ? 0.9 : 0.55)}`,
              boxShadow: hot ? `0 0 50px ${alpha(t.primary, 0.3)}` : "none",
              transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale})`,
              clipPath: e.clip,
              opacity: clamp(e.opacity),
            }}
          >
            <div style={{ width: 34, flex: "none", fontFamily: t.font.mono, fontSize: 22, color: alpha(t.primary, 0.9) }}>[{i + 1}]</div>
            {c.src && (
              <div style={{ width: 150, height: rowH - 46, flex: "none", borderRadius: 10, overflow: "hidden", border: `1.5px solid ${alpha(t.line, 0.9)}` }}>
                <Img src={assetUrl(c.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left" }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(c.title, w - 420, 30, 20), color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, fontFamily: t.font.mono, fontSize: 19, color: alpha(t.text, 0.78) }}>
                <Icon name="lock" size={17} color={t.dim} />
                {c.url}
              </div>
              {c.note && <div style={{ marginTop: 6, fontFamily: t.font.body, fontSize: 18, color: t.dim }}>{c.note}</div>}
            </div>
            {c.date && (
              <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, background: alpha(t.primary, 0.12), border: `1.5px solid ${alpha(t.primary, 0.4)}`, fontFamily: t.font.mono, fontSize: 17, color: t.text }}>
                <Icon name="clock" size={17} color={t.primary} />
                {c.date}
              </div>
            )}
          </div>
        );
      })}
      <Sfx name="swipe" at={start} volume={0.28} />
      {cues.slice(1, Math.max(1, cues.filter((c) => frame >= c).length)).map((c, i) => (
        <Sfx key={i} name="tick" at={c} volume={0.2} />
      ))}
    </>
  );
};

export const CitationStrip: CompDef<D> = {
  id: "citation-strip",
  name: "出处清单（真地址 + 时间）",
  layer: "screen",
  variants: 3,
  minSec: 3,
  maxSec: 14,
  tags: ["出处", "来源", "参考", "证据", "数据", "引用", "榜单"],
  motion: { kind: "逐条从左右两侧推入，讲到哪条哪条发光", energy: 2 },
  desc: "一屏列 1-4 条出处：编号 + 真截图缩略 + 材料名 + 可辨识的真地址 + 采集时间，当前那条发光",
  use: "「数据来自这几处」「我参考的是这几个来源」「这张榜、这篇文档、这个公告」——凡是给结论找凭据的句子。url 必须是真地址，写不出就别用这个组件",
  schema,
  assetFields: ["items[].src"],
  example: {
    kicker: "SOURCES",
    title: "结论都来自这几处",
    items: [
      { title: "LMArena 总榜", url: "lmarena.ai/leaderboard", date: "2026-09-30", src: "assets/arena-rank-overall.png", note: "支撑「换排序就换第一」" },
      { title: "Agentic Coding 子榜", url: "lmarena.ai/leaderboard", date: "2026-09-30", src: "assets/arena-rank-agentic.png", note: "支撑「写代码能力另算」" },
    ],
  },
  C,
};
