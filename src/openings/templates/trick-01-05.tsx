import React from "react";
import { z } from "zod";
import { easeInOut, easeOut, prog } from "../../lib/anim";
import { Flash, Scrim } from "../../lib/cine/Flash";
import { CharPop, Slam } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { cam, idxOf, ink, spread, Stage, tpl } from "./kit";

// ============ 第1招 慢慢放大 + 做悬疑 ============
// 机制：持续推镜制造压迫感，同时不给答案（画面里的字只提问，不给结论）
// 适合：悬念型 / 揭露型文案

const s01 = z.object({
  hook: z.string().default("为什么越努力越没结果").describe("开场悬念句（只提问，不给答案）"),
  hl: z.string().default("越努力").describe("要强调的词"),
  zoomTo: z.number().default(1.22).describe("推到多近（1.15~1.3 压迫感最强）"),
  question: z.string().default("").describe("补一句更小的追问，可留空"),
});
export const Trick01ZoomSuspense = tpl<z.infer<typeof s01>>({
  id: "trick-01-zoom-suspense",
  name: "第1招 · 慢慢放大 + 做悬疑",
  hook: "悬念推镜",
  desc: "人物画面从 1.0 全程缓慢推近到 1.2 倍（持续压迫感），悬念问句逐字弹出、强调词变色，全程不给答案",
  use: "悬念型、揭露型开场：“为什么…”“最后一个方法…”“我赌你不知道…”",
  techniques: ["持续推镜", "逐字弹出", "强调色", "不给答案"],
  schema: s01,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const faceIn = easeOut(prog(frame, 0, 10));
    return (
      <Stage frame={frame} dur={dur} seed={seed} exit="fade">
        <Scrim side="bottom" size={0.5} strength={0.66} />
        <div style={{ position: "absolute", left: 110, bottom: 210, opacity: faceIn }}>
          <CharPop frame={frame} at={4} text={d.hook} cues={spread(d.hook, 4, Math.max(20, dur - 20))} size={92} color={t.text} hl={idxOf(d.hook, d.hl)} hlColor={t.accent} font={t.font.title} strokeW={9} />
        </div>
        {d.question && (
          <div style={{ position: "absolute", left: 116, bottom: 130, opacity: easeOut(prog(frame, dur * 0.55, 12)) }}>
            <span style={{ ...ink(40, t.dim, t.font.body, 5) }}>{d.question}</span>
          </div>
        )}
        <Sfx name="riser" at={0} volume={0.2} />
      </Stage>
    );
  },
  // 这一招的核心：镜头全程不停推近
  camera: (d, f, dur) => cam(f, dur, { zoomFrom: 1, zoomTo: d.zoomTo, zoomAt: 0, zoomLen: dur }),
});

// ============ 第2招 出其不意 + 按节奏变形 ============
// 机制：画面形态突变打破预期，且变形卡在语音节奏上（每次变形都挂在锚点上）
// 适合：反常识型 / 转折型文案

const s02 = z.object({
  line: z.string().default("这不是教程").describe("第一句"),
  line2: z.string().default("这是印钞机").describe("突变后的第二句"),
  morphAt: z.number().default(40).describe("形态突变时刻（锚点，卡在语音节奏上）"),
  shape: z.enum(["circle", "wide", "tilt"]).default("circle").describe("人像容器突然变成什么形状"),
  color: z.string().default("").describe("突变后画面偏色（留空则不变）"),
});
export const Trick02MorphRhythm = tpl<z.infer<typeof s02>>({
  id: "trick-02-morph-rhythm",
  name: "第2招 · 出其不意 + 按节奏变形",
  hook: "形态突变",
  desc: "前半段正常全屏讲第一句；说到关键词那一刻人像容器突然变形（变成圆形/宽幅/倾斜），画面一震 + 闪白，第二句砸出",
  use: "反常识型、转折型：“这叫教程？其实这是印钞机”“你以为 A，其实是 B”",
  techniques: ["容器形态突变", "卡语音节奏", "闪白+震动", "强调句"],
  schema: s02,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const after = frame >= d.morphAt;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: d.morphAt, amp: 16, len: 12 }]}>
        <Flash frame={frame} at={d.morphAt} len={8} peak={0.45} />
        <div style={{ position: "absolute", left: 0, right: 0, top: after ? 780 : 300, textAlign: "center" }}>
          {!after ? (
            <Slam frame={frame} at={0} text={d.line} size={92} color={t.text} font={t.font.title} from={1.4} len={6} blur={3} minOpacity={0.85} strokeW={9} />
          ) : (
            <Slam frame={frame} at={d.morphAt} text={d.line2} size={116} color={t.accent} font={t.font.title} from={1.9} len={7} strokeW={11} />
          )}
        </div>
        <Sfx name="glitch" at={d.morphAt} volume={0.4} />
        <Sfx name="impact" at={d.morphAt} volume={0.5} />
      </Stage>
    );
  },
  // 这一招的核心：人像容器在锚点处变形
  camera: (d, f, dur) => {
    const p = easeInOut(prog(f, d.morphAt, 14));
    const base = cam(f, dur, { hits: [{ at: d.morphAt, amp: 14, len: 12 }], tint: d.color || undefined, tintAt: d.color ? d.morphAt : undefined, tintOp: 0.25 });
    if (d.shape === "circle") {
      const r = 100 - p * 68; // 100% 满幅 → 收到人脸区域
      return { ...base, clip: `circle(${r}% at 50% 42%)`, radius: 0 };
    }
    if (d.shape === "wide") {
      return { ...base, clip: `inset(${(1 - p) * 26}% 0 ${(1 - p) * 26}% 0)`, radius: 0 };
    }
    return { ...base, rot: (base.rot ?? 0) + p * -4, zoom: (base.zoom ?? 1) * (1 - p * 0.12), radius: p * 40, clip: `inset(${p * 12}% ${p * 26}% ${p * 12}% ${p * 26}%)` };
  },
});

// ============ 第3招 蒙版收圈 + 开篇主题 ============
// 机制：用遮罩收圈强制聚焦，同时预告本片主题
// 适合：聚焦型 / 主题揭示型文案

const s03 = z.object({
  theme: z.string().default("AI 四步法").describe("本片主题（收圈到最小时出现）"),
  sub: z.string().default("20 分钟做出第一个小软件").describe("副标题"),
  irisTo: z.number().default(26).describe("光圈收到多小（百分比，越小越聚焦）"),
  holdAt: z.number().default(34).describe("收圈完成的时刻（锚点），主题此刻亮起"),
});
export const Trick03MaskFocus = tpl<z.infer<typeof s03>>({
  id: "trick-03-mask-focus",
  name: "第3招 · 蒙版缩圈 + 开篇主题",
  hook: "遮罩收圈",
  desc: "画面外圈被黑暗遮罩包住并向中心收圈（强制聚焦到人脸），收到最小时主题大字点亮、副标题补上，是「本片要讲什么」的预告",
  use: "聚焦型、主题揭示型：任何需要 1 秒内说清“这条视频讲什么”的开场",
  techniques: ["遮罩收圈", "强制聚焦", "主题预告", "叮音点亮"],
  schema: s03,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const on = easeOut(prog(frame, d.holdAt, 12));
    return (
      <Stage frame={frame} dur={dur} seed={seed} exit="fade">
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, textAlign: "center", opacity: on, transform: `translateY(${(1 - on) * 26}px)` }}>
          <span style={{ ...ink(96, t.text, t.font.title, 10) }}>{d.theme}</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 290, textAlign: "center", opacity: easeOut(prog(frame, d.holdAt + 14, 12)) }}>
          <span style={{ ...ink(46, t.accent, t.font.body, 6) }}>{d.sub}</span>
        </div>
        <Sfx name="whoosh" at={0} volume={0.3} />
        <Sfx name="ding" at={d.holdAt} volume={0.45} />
      </Stage>
    );
  },
  // 这一招的核心：遮罩从满幅收到一个圆圈，聚焦到人脸
  camera: (d, f, dur) => {
    const p = easeInOut(prog(f, 4, Math.max(10, d.holdAt - 4)));
    const r = 100 - (100 - d.irisTo) * p;
    return cam(f, dur, { zoomFrom: 1.02, zoomTo: 1.12, zoomAt: d.holdAt, zoomLen: 20, clip: `circle(${r}% at 50% 42%)` });
  },
});

// ============ 第4招 身后飞个大标题 + 抠像 + 副标题 ============
// 机制：人物抠像成主体，大标题从身后飞入，副标题补位
// 适合：真人口播 / 观点输出

const s04 = z.object({
  lead: z.string().default("我劝你").describe("标题上半句（小）"),
  title: z.string().default("别再手写周报了").describe("大标题（从身后飞入放大）"),
  sub: z.string().default("一个人也能干完一个团队的活").describe("副标题（最后补位）"),
  flyAt: z.number().default(14).describe("大标题飞入时刻（锚点）"),
  subAt: z.number().default(34).describe("副标题补位时刻（锚点）"),
});
export const Trick04TitleBehind = tpl<z.infer<typeof s04>>({
  id: "trick-04-title-behind",
  name: "第4招 · 身后飞个大标题 + 抠像 + 副标题",
  hook: "分层飞入",
  desc: "人物保持主体（半透明景深把人像托到前景），大标题从人物身后由远及近飞入放大，最后副标题从下方补位 —— 字在身后、人在前面",
  use: "真人口播、观点输出：需要一句大标题压住画面的开场",
  techniques: ["人像前置（景深）", "标题从身后飞入", "副标题补位", "推镜"],
  schema: s04,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const fly = easeOut(prog(frame, d.flyAt, 22));
    const sub = easeOut(prog(frame, d.subAt, 14));
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: d.flyAt, amp: 10, len: 10 }]}>
        {/* 人像下压暗 + 向内收，让“身后”的层次读出来 */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 46%, transparent 22%, ${alpha(t.bg, 0.9)} 68%)`, opacity: 0.55 + fly * 0.3 }} />
        {/* 大标题层：由远及近（scale 从 0.35 拉到 1.05，透明度跟着起来） */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center" }}>
          <span style={{ ...ink(150, t.accent, t.font.title, 15), display: "inline-block", transform: `scale(${0.35 + fly * 0.7}) rotate(${(1 - fly) * -4}deg)`, opacity: 0.15 + fly * 0.85, textShadow: `0 0 ${40 * fly}px ${alpha(t.accent, 0.7)}` }}>{d.title}</span>
        </div>
        {d.lead && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 210, textAlign: "center", opacity: easeOut(prog(frame, 2, 10)) }}>
            <span style={{ ...ink(60, t.text, t.font.title, 7) }}>{d.lead}</span>
          </div>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 200, textAlign: "center", opacity: sub, transform: `translateY(${(1 - sub) * 40}px)` }}>
          <span style={{ ...ink(52, t.text, t.font.body, 6) }}>{d.sub}</span>
        </div>
        <Sfx name="whoosh" at={d.flyAt} volume={0.45} />
        <Sfx name="ding" at={d.subAt} volume={0.35} />
      </Stage>
    );
  },
  // 人像稍微推近、上半身抬高一点，形成“人在前、字在后”的视差
  camera: (d, f, dur) => cam(f, dur, { zoomFrom: 1, zoomTo: 1.1, zoomAt: d.flyAt, zoomLen: 26, y: -20 * easeOut(prog(f, d.flyAt, 26)) }),
});

// ============ 第5招 文字干货先出现，找好节奏再露脸 ============
// 机制：先出文字给「获得感」，人物延后 0.2–1 秒入画
// 适合：干货型 / 知识型文案

const s05 = z.object({
  points: z.array(z.string()).min(2).max(4).default(["不写代码", "不装环境", "双击就能跑"]).describe("先甩出来的干货要点"),
  delay: z.number().default(9).describe("人物延后出画的帧数（0.2~1 秒 = 6~30 帧）"),
  title: z.string().default("").describe("可选的标题，留空则不显示"),
});
export const Trick05InfoFirst = tpl<z.infer<typeof s05>>({
  id: "trick-05-info-first",
  name: "第5招 · 文字干货先出现，再露脸",
  hook: "信息前置",
  desc: "第 0 帧先砸出干货要点（此时人还没出现，画面是暗底 + 文字），延后 0.2~1 秒人物画面才淡入 —— 先用信息抓住人，再露脸",
  use: "干货型、知识型：“3 个方法”“不写代码也能做”“记住这几点”",
  techniques: ["人声/信息前置", "人物延后入画", "逐条弹出", "淡入"],
  schema: s05,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const n = d.points.length;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 12, len: 8 }]}>
        <Flash frame={frame} at={0} len={6} peak={0.5} />
        <div style={{ position: "absolute", left: 110, top: 300, display: "flex", flexDirection: "column", gap: 26 }}>
          {d.points.map((p, i) => {
            const at = 2 + i * 6;
            if (frame < at) return null;
            const k = easeOut(prog(frame, at, 10));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, transform: `translateX(${(1 - k) * -60}px)`, opacity: k }}>
                <span style={{ ...ink(58, t.primary, t.font.mono, 0), opacity: 0.9 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ ...ink(78, t.text, t.font.title, 8) }}>{p}</span>
              </div>
            );
          })}
        </div>
        {d.title && (
          <div style={{ position: "absolute", left: 110, top: 180, opacity: easeOut(prog(frame, 0, 8)) }}>
            <span style={{ ...ink(44, t.dim, t.font.body, 5) }}>{d.title}</span>
          </div>
        )}
        {d.points.map((_, i) => (
          <Sfx key={i} name="pop" at={2 + i * 6} volume={0.3} />
        ))}
        <Sfx name="ding" at={2} volume={0.35} />
      </Stage>
    );
  },
  // 这一招的核心：人物在 delay 帧内完全不出场，之后淡入
  camera: (d, f, dur) => {
    const p = easeOut(prog(f, d.delay, 12));
    return cam(f, dur, { opacity: p, zoomFrom: 1, zoomTo: 1.06, zoomAt: d.delay, zoomLen: 24 });
  },
});
