import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, lerp, prog, rng } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { springF } from "../../lib/spring";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 出处：opus-5-5-motion-gallery/v02-app-launch / Scale My Vibe Code（博客）2026-09 https://scalemyvibe.dev/blog/opus-5-5-initial-thoughts-and-prompting-advice/
// 片库整理：小红书 AI伐木工（jinhanbuilds/opus-5-5-motion-gallery）；逐条机制对照见 docs/OPUS55_ANIMATIONS.md 一·c。
// 移植自 opus-5-5-motion-gallery/v02-app-launch 的 S2「Sorts itself.」
// 关键三条（照搬机制，尺寸按我们的安全区重算）：
//   1) 卡片先**堆成一摞**（带确定性抖动），不是一张张凭空出现 —— 先给观众「这是一坨麻烦」；
//   2) 飞入用 easeInOut + **抛物线抬升 sin(πe)**，抬升量同时驱动 scale 与阴影深度，
//      卡片才像被扔过去的而不是平移过去的；
//   3) 落地才把「自动标签」淡进来、计数器 +1 —— 说服力在「先乱后治 + 实时统计」。

const item = z.object({
  text: z.string().describe("条目的原话，短一点（卡片宽度有限）"),
  to: z.string().optional().describe("归到哪一列（写列名；不写就按顺序轮着分）"),
  icon: z.string().optional().describe("条目图标名，缺省按文字猜"),
  at: z.number().optional().describe("这张卡片堆进来的时刻（锚点）；缺省 = 均匀排在开头"),
});
const col = z.object({
  name: z.string().describe("列名，如 待办 / 工作 / 灵感"),
  tag: z.string().optional().describe("落进这列的卡片上自动贴的标签，如 #重复劳动"),
});
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  columns: z.array(col).min(2).max(4).describe("2~4 个去处，写列名（和 items[].to 对应）"),
  items: z.array(item).min(4).max(9).describe("先堆成一摞的杂乱条目，再逐张归位"),
  sortAt: z.number().optional().describe("开始自动归类的时刻（锚点，如「它自己就分好了」那句）；缺省 = 堆完之后"),
  note: z.string().optional().describe("分完后的结论条，如「一条都没漏」"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const n = data.items.length;
  const cols = data.columns;

  const pileCues = listCues(data.items.map((it) => ({ at: it.at })), 8, Math.max(26, Math.round(dur * 0.24)));
  const sortAt = cueOr(data.sortAt, (pileCues[n - 1] ?? 30) + 12);
  const FLY = Math.max(16, Math.min(26, Math.round(dur * 0.09)));
  // 飞一张的间隔：必须保证最后一张「落地 + 结论入场」都排在时长内，否则结尾的话还没说完镜头就切了
  const fly = Math.max(7, Math.min(26, Math.floor((dur - 34 - FLY - sortAt) / Math.max(1, n - 1))));
  const flyAt = (i: number) => sortAt + i * fly;
  const lastLand = flyAt(n - 1) + FLY;

  // 版面：整屏时左边留给结论，看板占右 62%；侧栏时看板铺满
  const bx = full ? Math.round(width * 0.36) : 10;
  const bw = width - bx - (full ? 96 : 10);
  const by = full ? 210 : 14;
  const bh = height - by - 175;
  const gap = full ? 26 : 10;
  const cw = (bw - gap * (cols.length - 1)) / cols.length;
  const head = full ? 62 : 34;
  const ch = Math.min(full ? 96 : 46, Math.max(full ? 56 : 30, (bh - head - 90) / Math.max(1, Math.ceil(n / cols.length)) - 12));
  const slotH = ch + (full ? 14 : 7);
  const cx0 = bx + bw / 2;
  const cy0 = by + head * 0.5 + 6;

  const rd = rng(seed || 7);
  const jit = (i: number) => ({ dx: (rd() - 0.5) * (full ? 56 : 26), dy: i * (full ? 11 : 6) + (rd() - 0.5) * 10, rot: (rd() - 0.5) * 0.16 });
  const J = data.items.map((_, i) => jit(i));

  // 归属：写了列名按列名，没写就轮着分
  const owner = (i: number) => {
    const named = cols.findIndex((c) => c.name === data.items[i].to);
    return named >= 0 ? named : i % cols.length;
  };
  const slot = (i: number) => data.items.slice(0, i).filter((_, k) => owner(k) === owner(i)).length;
  const tone = (k: number) => [t.primary, t.accent, t.secondary, t.gold][k % 4];

  // 已落地数（计数器只统计真正落定的，跟口播「七条全部分好」对得上）
  const landedIn = (k: number) => data.items.reduce((a, it, i) => a + (owner(i) === k && frame >= flyAt(i) + FLY ? 1 : 0), 0);
  const landedAll = data.items.reduce((a, _, i) => a + (frame >= flyAt(i) + FLY ? 1 : 0), 0);

  const eNote = enterAt(frame, lastLand + 14, { fallback: "rise", dur: 18 });

  const posOf = (i: number) => {
    const k = owner(i);
    const to = { x: bx + k * (cw + gap) + cw / 2, y: by + head + 18 + slot(i) * slotH + ch / 2 };
    const from = { x: cx0 + J[i].dx, y: cy0 + J[i].dy };
    if (frame < flyAt(i)) return { ...from, e: 0, lift: 0 };
    const e = easeInOut(clamp((frame - flyAt(i)) / FLY));
    const lift = Math.sin(Math.PI * e);
    return { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) - lift * (full ? 70 : 26), e, lift };
  };

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}

      {/* 列容器：空列也有底色，观众才知道卡片要飞去哪 */}
      {cols.map((c, k) => {
        const open = easeOut(prog(frame, sortAt - 10 + k * 4, 16));
        const cnt = landedIn(k);
        return (
          <div key={k} style={{ position: "absolute", left: bx + k * (cw + gap), top: by, width: cw, height: bh, opacity: open }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: full ? 20 : 10, background: alpha(t.bg2, 0.5), border: `2px solid ${alpha(tone(k), 0.22 + (cnt > 0 ? 0.3 : 0))}` }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: head, display: "flex", alignItems: "center", gap: full ? 10 : 5, padding: `0 ${full ? 18 : 8}px`, borderBottom: `2px solid ${alpha(tone(k), 0.3)}` }}>
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(c.name, cw - 110, full ? 32 : 17, 11), color: tone(k), whiteSpace: "nowrap" }}>{c.name}</span>
              <span style={{ marginLeft: "auto", fontFamily: t.font.mono, fontWeight: 700, fontSize: full ? 26 : 15, color: cnt > 0 ? t.text : t.dim }}>{cnt}</span>
            </div>
          </div>
        );
      })}

      {/* 收件箱：堆在最上面的时候写着「未分拣 n」，分完自动淡出 */}
      <div style={{ position: "absolute", left: cx0 - (full ? 150 : 80), top: by - (full ? 40 : 18), width: full ? 300 : 160, textAlign: "center", fontFamily: t.font.mono, fontSize: full ? 24 : 14, color: t.dim, opacity: clamp(1 - landedAll / Math.max(1, n)) }}>
        未分拣 {n - landedAll}
      </div>

      {data.items.map((it, i) => {
        const p = posOf(i);
        const inPile = frame < flyAt(i);
        const appear = springF(frame, pileCues[i], 30, 12, 0.8); // 堆进来时带一点弹簧过冲
        if (appear <= 0.01) return null;
        const k = owner(i);
        const fs = fitFont(it.text, full ? 200 : 110, full ? 30 : 16, 12);
        const ic = it.icon ?? guessIcon(it.text);
        const landed = p.e >= 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x - cw / 2 + (inPile ? 0 : 0),
              top: p.y - ch / 2,
              width: inPile ? (full ? 220 : 120) : cw - (full ? 34 : 12),
              height: ch,
              transform: `rotate(${(inPile ? J[i].rot * (1 - p.e) : 0) * 57.3}deg) scale(${lerp(0.85, 1, appear) + p.lift * 0.06})`,
              opacity: clamp(appear * 1.2),
              borderRadius: full ? 14 : 8,
              background: landed ? alpha(tone(k), 0.14) : alpha(t.glass, 0.95),
              border: `2px solid ${landed ? alpha(tone(k), 0.65) : alpha(t.dim, 0.45)}`,
              boxShadow: `0 ${4 + p.lift * 14}px ${8 + p.lift * 22}px ${alpha(t.bg, 0.4 + p.lift * 0.3)}`,
              display: "flex",
              alignItems: "center",
              gap: full ? 12 : 6,
              padding: `0 ${full ? 16 : 8}px`,
            }}
          >
            {ic && full && <Icon name={ic} size={30} color={landed ? tone(k) : t.dim} />}
            <span style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: fs, color: t.text, lineHeight: 1.15 }}>{it.text}</span>
            {cols[k]?.tag && (
              <span style={{ position: "absolute", right: full ? 10 : 4, top: -((full ? 14 : 8)), fontFamily: t.font.mono, fontSize: full ? 18 : 11, color: tone(k), opacity: landed ? 1 : 0 }}>
                {cols[k].tag}
              </span>
            )}
          </div>
        );
      })}

      {data.note && (
        <div style={{ position: "absolute", left: full ? 96 : 10, right: full ? undefined : 10, width: full ? Math.round(width * 0.24) : undefined, top: full ? height * 0.52 : height - 90, opacity: eNote.opacity, transform: `translate(${eNote.dx}px, ${eNote.dy}px) scale(${eNote.scale})`, clipPath: eNote.clip }}>
          <div style={{ padding: full ? "18px 24px" : "8px 12px", borderRadius: 16, background: alpha(t.accent, 0.12), border: `2px solid ${alpha(t.accent, 0.6)}` }}>
            <div style={{ fontFamily: t.font.mono, fontSize: full ? 22 : 13, color: t.dim }}>已归档 {landedAll}/{n}</div>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.note, full ? 420 : 180, full ? 44 : 22, 14), color: t.accent, marginTop: 6 }}>{data.note}</div>
          </div>
        </div>
      )}

      <Sfx name="pop" at={8} volume={0.25} />
      {data.items.map((_, i) => (
        <Sfx key={i} name={i === n - 1 ? "ding" : "tick"} at={flyAt(i) + FLY} volume={0.28} />
      ))}
    </>
  );
};

export const KanbanSort: CompDef<D> = {
  id: "kanban-sort",
  name: "自动分拣（一摞乱条自己归位）",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 12,
  tags: ["整理", "分类", "归档", "自动化", "打标", "分拣", "收拾"],
  motion: { kind: "条目堆成一摞→逐张抛物线飞入分列、落地贴标签并计数", energy: 2 },
  desc: "看板：2~4 列空容器先亮出名字，右侧条目一张张堆成一摞（歪着压在一起），说到「自动归类」那刻起逐张甩进对应列——飞行途中抬起、放大、投影变深，落地才贴上该列的自动标签、列头计数器 +1，顶部「未分拣 n」同步递减，最后弹结论条",
  use: "讲「不用自己动手整理」的分类型场景：AI 把评论按意图分成三类、一堆任务自动归到 工作/生活/灵感、几十条反馈分到 已解决/待排期/重复、把混在一起的素材按用途分拣。items 写**原话**（越具体越可信），columns 写**去处**。注意：列是代码画的假界面，别拿它冒充某个软件的真截图",
  panel: true,
  schema,
  example: {
    kicker: "以前手动拖",
    title: "现在它自己分好",
    columns: [{ name: "待办", tag: "#今天做" }, { name: "工作", tag: "#能接单" }, { name: "灵感", tag: "#先存着" }],
    items: [{ text: "帮我剪条 30 秒的" }, { text: "这个月接单报价多少" }, { text: "把评论区扒成选题" }, { text: "周末想试试知识视频" }, { text: "客户要一份课程大纲" }, { text: "顺手写个抓取脚本" }],
    note: "六条，一条没漏",
  },
  C,
};
