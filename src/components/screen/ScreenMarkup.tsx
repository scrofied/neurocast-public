import React from "react";
import { z } from "zod";
import { OffthreadVideo } from "remotion";
import { assetSrc, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { fitFont } from "../../lib/ui";
import { clamp, easeInOut, easeOut, prog } from "../../lib/anim";
import type { CompDef, CompProps } from "../types";

// ═══ 在真录屏上一处处画圈标注：画面不剪、不缩放、不压暗 ═══════════════════
// 用途：整段都在讲同一块真实屏幕（后台/大屏/控制台）时，观众要的是「一直看得见那块屏」，
// 而不是被反复剪切、推近。所以这一层只做两件事：原速播录屏 + 讲到哪儿就在哪儿画一个圈、挂一句话。
// 和 evidence-zoom 的分工：evidence-zoom 是「凑近看这一处」（会推镜、会压暗区外）；
//   screen-markup 是「屏不动，笔在上面走」（零缩放、零压暗、可挂十几处，按台词逐处点亮）。
const mark = z.object({
  x: z.number().describe("圈区左上角横坐标（0~1，相对录屏画面）"),
  y: z.number().describe("圈区左上角纵坐标（0~1）"),
  w: z.number().default(0.2).describe("圈区宽（0~1）"),
  h: z.number().default(0.08).describe("圈区高（0~1）"),
  label: z.string().optional().describe("挂在圈旁边的一句话（≤10 字）"),
  at: z.number().optional().describe("什么时候画这个圈（台词锚点/帧）"),
  style: z.enum(["ellipse", "box", "bracket"]).optional().describe("ellipse 圈（默认）/ box 方框 / bracket 横跨一条的括号"),
  tone: z.enum(["key", "accent", "warn"]).optional().describe("配色：key 主色 / accent 强调 / warn 警示"),
});
const schema = z.object({
  src: z.string().describe("真录屏（相对 public/）：一段连续播完，素材比镜头短会自动放慢补满"),
  kind: z.enum(["image", "video"]).optional(),
  aspect: z.number().optional().describe("宽高比（管线自动带）"),
  frames: z.number().optional().describe("录屏总帧数（管线实测后自动填）"),
  from: z.number().default(0).describe("从录屏第几秒开始播（整段一镜到底时用，避免每条镜头都从 0 秒重放）"),
  speed: z.number().min(0.4).max(2).default(1).describe("录屏播放倍速"),
  marks: z.array(mark).min(1).max(14).describe("按讲的顺序排，一镜最多 14 处"),
  kicker: z.string().optional().describe("左上角 mono 小标（例：// 指挥舱 · 今天）"),
  title: z.string().optional().describe("左上角一句话（≤12 字，只在开头出现一次）"),
  source: sourceSchema,
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data: d, frame: f, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const src = assetSrc(d.src);
  const inAt = enterAt(f, 0, { fallback: "rise", dur: 14 });

  // 圈的时刻：写了锚点用锚点，没写就在这一镜里均分；同镜内严格递增
  const ats = d.marks.map((m, i) => (typeof m.at === "number" ? m.at : Math.round(((dur - 20) * (i + 1)) / (d.marks.length + 1))));
  for (let i = 1; i < ats.length; i++) ats[i] = Math.max(ats[i], ats[i - 1] + 10);
  const endAt = cueOr(undefined, dur - 10);
  let cur = -1;
  for (let i = 0; i < ats.length; i++) if (f >= ats[i]) cur = i;

  // 录屏比这一镜短：放慢补满，不放黑
  const vf = d.frames ?? 0;
  const need = Math.max(1, dur);
  const rate = clamp((vf > 0 && vf - Math.round(d.from * 30) < need ? Math.max(0.5, (vf - Math.round(d.from * 30)) / need) : 1) * (d.speed ?? 1), 0.4, 2);

  const colorOf = (tone?: string) => (tone === "warn" ? t.bad : tone === "accent" ? t.accent : t.primary);
  const px = (m: (typeof d.marks)[number]) => ({
    cx: (m.x + m.w / 2) * W,
    cy: (m.y + m.h / 2) * H,
    rx: (m.w * W) / 2,
    ry: (m.h * H) / 2,
  });
  const label = (m: (typeof d.marks)[number], i: number) => {
    if (!m.label) return null;
    const { cx, cy, ry } = px(m);
    const right = m.x + m.w < 0.62;
    // 圈在画面下半时，标签一律挂到圈的上方，绝不落到 y≥905 的字幕带
    const above = cy + ry > 830;
    const y = above ? Math.min(cy - ry - 46, 884) : Math.max(cy - 20, 110);
    const w = Math.max(150, m.label.length * 26 + 46);
    const x = right ? Math.min(cx + (m.w * W) / 2 + 26, W - w - 30) : Math.max(cx - (m.w * W) / 2 - w - 26, 30);
    const p = easeOut(clamp((f - ats[i] - 8) / 12));
    return (
      <div key={`l${i}`} style={{ position: "absolute", left: x, top: y, opacity: p, transform: `translateY(${(1 - p) * 12}px)`, pointerEvents: "none" }}>
        <div
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: 12,
            background: "rgba(6,4,12,.82)",
            border: `1.5px solid ${alpha(colorOf(m.tone), 0.85)}`,
            boxShadow: `0 0 26px ${alpha(colorOf(m.tone), 0.35)}`,
            fontFamily: t.font.title,
            fontWeight: 800,
            fontSize: fitFont(m.label, w - 40, 30, 20),
            letterSpacing: 1.2,
            color: "#fff7ee",
            whiteSpace: "nowrap",
          }}
        >
          {m.label}
        </div>
        <div style={{ position: "absolute", left: right ? -24 : w + 4, top: 22, width: 24, height: 2, background: alpha(colorOf(m.tone), 0.75) }} />
      </div>
    );
  };

  const shape = (m: (typeof d.marks)[number], i: number) => {
    const { cx, cy, rx, ry } = px(m);
    const local = f - ats[i];
    const active = i === cur;
    // 只保留当前这一个：上一个在 10 帧内淡掉，避免十几个圈叠成一张网
    const gone = i < cur ? 1 - easeInOut(clamp((f - ats[cur]) / 10)) : 1;
    const p = easeInOut(clamp(local / 15));
    if (gone <= 0.02) return null;
    const col = colorOf(m.tone);
    const op = (active ? 0.82 + 0.18 * Math.sin(f / 8) : 1) * gone * p;
    if (m.style === "bracket") {
      const w = rx * 2;
      return (
        <g key={`s${i}`} opacity={op}>
          <path
            d={`M ${cx - rx} ${cy - ry} L ${cx - rx} ${cy - ry - 16} L ${cx + rx} ${cy - ry - 16} L ${cx + rx} ${cy - ry}`}
            fill="none"
            stroke={col}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeDasharray={w * 2.4}
            strokeDashoffset={w * 2.4 * (1 - p)}
            style={{ filter: `drop-shadow(0 0 12px ${alpha(col, 0.75)})` }}
          />
        </g>
      );
    }
    if (m.style === "box") {
      const per = (rx * 2 + ry * 2) * 2;
      return (
        <rect
          key={`s${i}`}
          x={cx - rx}
          y={cy - ry}
          width={rx * 2}
          height={ry * 2}
          rx={12}
          fill="none"
          stroke={col}
          strokeWidth={4.5}
          strokeDasharray={per}
          strokeDashoffset={per * (1 - p)}
          opacity={op}
          style={{ filter: `drop-shadow(0 0 12px ${alpha(col, 0.7)})` }}
        />
      );
    }
    const per = Math.PI * (rx + ry) * 2.2;
    return (
      <ellipse
        key={`s${i}`}
        cx={cx}
        cy={cy}
        rx={rx + 14}
        ry={ry + 12}
        fill="none"
        stroke={col}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={per}
        strokeDashoffset={per * (1 - p)}
        opacity={op}
        transform={`rotate(-1.6 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 14px ${alpha(col, 0.8)})` }}
      />
    );
  };

  const kIn = easeOut(clamp((f - 2) / 14));
  const tIn = easeOut(clamp((f - 6) / 16));

  return (
    <>
      <div style={{ position: "absolute", inset: 0, opacity: inAt.opacity }}>
        {!src ? (
          <MissingAsset field="src" hint="这一层要一段真录屏：整段原速播，圈点在它上面画" w={W} h={H} frame={f} />
        ) : (
          <OffthreadVideo src={src} muted playbackRate={rate} trimBefore={Math.round((d.from ?? 0) * 30)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
        {/* 顶部一条极淡的压暗，只为让左上角的小标读得清，不动素材本身 */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 150, background: "linear-gradient(180deg, rgba(4,3,9,.62), rgba(4,3,9,0))" }} />
      </div>

      {(d.kicker || d.title) && (
        <div style={{ position: "absolute", left: 46, top: 108, opacity: Math.max(kIn, tIn) * inAt.opacity }}>
          {d.kicker && (
            <div style={{ fontFamily: t.font.mono, fontSize: 17, letterSpacing: 2.6, color: alpha(t.primary, 0.95), opacity: kIn }}>{d.kicker}</div>
          )}
          {d.title && (
            <div style={{ marginTop: 8, fontFamily: t.font.title, fontWeight: 900, fontSize: 40, letterSpacing: 1.5, color: "#fff7ee", textShadow: "0 3px 18px rgba(0,0,0,.85)", opacity: tIn, transform: `translateY(${(1 - tIn) * 14}px)`, whiteSpace: "nowrap" }}>
              {d.title}
            </div>
          )}
        </div>
      )}

      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {d.marks.map((m, i) => (i <= cur && f < endAt ? shape(m, i) : null))}
      </svg>
      {d.marks.map((m, i) => (i === cur && m.label && f < endAt ? label(m, i) : null))}

      {d.marks.map((m, i) => (
        <Sfx key={`x${i}`} name="pop" at={ats[i]} volume={0.18} />
      ))}

      <div style={{ position: "absolute", right: 26, bottom: 200, width: 1, height: 1 }}>
        <SourceBadge source={d.source} frame={f} y={-34} />
      </div>
    </>
  );
};

export const ScreenMarkup: CompDef<D> = {
  id: "screen-markup",
  name: "真录屏上画圈标注（不剪不缩放）",
  layer: "screen",
  variants: 3,
  minSec: 6,
  maxSec: 90,
  tags: ["这块屏", "讲到哪圈到哪", "后台", "大屏", "标注", "一镜到底"],
  motion: { kind: "录屏原速一直播 → 讲到哪一处就在哪一处描出圈/框/括号 → 标签从侧面顶进来 → 上一处淡掉", energy: 2 },
  desc: "一整段真录屏原速铺满画面，中间不剪切、不推近、不压暗；按台词在画面上逐处画圈并挂一句短标签，最多 14 处。用 from 指定从录屏第几秒起播，多条镜头能接同一段素材的不同窗口。",
  use: "整段话都在讲同一块真实屏幕（后台、大屏、控制台、看板）时用它：观众要的是「一直看得见那块屏」，反复切镜或推近反而看不清全貌。讲「这一格/这三个出口/这块挂了」这类指点画面的句子，就加一个 mark。要凑近看某一行小字才换 evidence-zoom。",
  schema,
  assetFields: ["src"],
  example: {
    kicker: "// 指挥舱 · 今天",
    title: "讲到哪，圈到哪",
    src: "assets/deck_a.mp4",
    from: 4,
    marks: [
      { x: 0.26, y: 0.09, w: 0.17, h: 0.09, label: "你 · 只拍板", at: 20 },
      { x: 0.33, y: 0.26, w: 0.19, h: 0.11, label: "CEO Agent", at: 70, tone: "accent" },
      { x: 0.02, y: 0.4, w: 0.95, h: 0.2, label: "七个 Agent", at: 130, style: "bracket" },
    ],
    source: { platform: "本机大屏", capturedAt: "2026-10-26", author: "我录屏" },
  },
  C,
};
