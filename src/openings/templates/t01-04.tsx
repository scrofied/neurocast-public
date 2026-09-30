import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { CharPop, Counter, Slam, Stamp, Strike } from "../../lib/cine/Type";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { cam, idxOf, ink, spread, Stage, tpl } from "./kit";

// ============ T01 反问质疑：大问号砸下 → 问句逐字弹出 → 答案红章 ============
// “为什么你发了 100 条视频还是没流量？” “你真的会用 AI 吗？”
const s01 = z.object({
  q: z.string().default("为什么").describe("砸下来的疑问词（2~4 字）"),
  line: z.string().default("你越努力越没流量").describe("问句主体（≤10 字）"),
  hl: z.string().default("没流量").describe("主体里要烧成强调色的词"),
  answer: z.string().default("方向错了").describe("最后盖下的答案/判词"),
  lineAt: z.number().default(10).describe("问句开始逐字弹出（锚点）"),
  lineEndAt: z.number().default(40),
  answerAt: z.number().default(58).describe("答案红章（锚点）"),
});
export const T01Question = tpl<z.infer<typeof s01>>({
  id: "op-t01-question",
  name: "模板 · 反问质疑（问号砸下 + 红章答案）",
  hook: "反问质疑",
  desc: "闪白 + 巨大问号在人脸旁砸下旋转，疑问词砸字，问句逐字弹出、强调词变色叮一声，最后红章盖下答案 + 画面抖动",
  use: "文案第一句是反问/质疑：“为什么…？”“你真的…吗？”“凭什么…？”",
  techniques: ["首帧大字", "闪白+冲击音", "巨型问号", "逐字弹出", "叮+强调色", "红章答案", "抖动"],
  schema: s01,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const qm = easeOutBack(prog(frame, 0, 12));
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 12, len: 10 }, { at: d.answerAt, amp: 18, len: 14 }]} exit="left">
        <Scrim side="left" size={0.62} strength={0.72} />
        <Flash frame={frame} at={0} len={8} peak={0.5} />
        <div style={{ position: "absolute", left: 1280, top: 60, ...ink(620, t.accent, t.font.title, 22), opacity: 0.92, transform: `rotate(${(1 - qm) * 50 + Math.sin(frame / 10) * 4}deg) scale(${0.3 + 0.7 * qm})`, transformOrigin: "center" }}>?</div>
        <div style={{ position: "absolute", left: 96, top: 170 }}>
          <Slam frame={frame} at={0} text={d.q} size={220} color={t.text} font={t.font.title} from={1.4} len={6} blur={3} minOpacity={0.85} strokeW={12} style={{ transformOrigin: "left center" }} />
          <div style={{ position: "relative", marginTop: 26, display: "inline-block" }}>
            <CharPop frame={frame} at={0} text={d.line} cues={spread(d.line, d.lineAt, d.lineEndAt)} size={96} color={t.text} hl={idxOf(d.line, d.hl)} hlColor={t.accent} font={t.font.title} strokeW={9} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 120, top: 640 }}>
          <Stamp frame={frame} at={d.answerAt} text={d.answer} size={120} color={t.bad} font={t.font.title} rotate={-7} />
        </div>
        <Sfx name="impact" at={0} volume={0.5} />
        <Sfx name="ding" at={Math.round((d.lineAt + d.lineEndAt) / 2)} volume={0.35} />
        <Sfx name="stamp" at={d.answerAt} volume={0.55} />
        <Sfx name="whoosh" at={dur - 10} volume={0.25} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: 0, amt: 0.1 }, { at: d.answerAt, amt: 0.06 }], hits: [{ at: 0, amp: 10, len: 10 }, { at: d.answerAt, amp: 16, len: 12 }] }),
});

// ============ T02 数字冲击：计数器狂滚 → 定格放大 → 单位 + 解释 ============
// “90% 的人都不知道…” “一条视频赚了 3 万”
const s02 = z.object({
  from: z.number().default(0),
  to: z.number().default(90).describe("最终数字"),
  decimals: z.number().default(0),
  prefix: z.string().default("").describe("数字前缀，如 ¥ / +"),
  unit: z.string().default("%").describe("单位"),
  line: z.string().default("的人都用错了 AI").describe("数字下面的一句（≤12 字）"),
  hl: z.string().default("用错了"),
  landAt: z.number().default(24).describe("数字定格（锚点，数字说出口的时刻）"),
  lineAt: z.number().default(34),
});
export const T02Number = tpl<z.infer<typeof s02>>({
  id: "op-t02-number",
  name: "模板 · 数字冲击（计数狂滚 + 定格砸下）",
  hook: "数字冲击",
  desc: "第 0 帧巨大数字从 0 狂滚（滴答声 + 抖动模糊），说到数字那一刻定格放大、冲击环 + 叮，下面擦出解释句，人脸推镜头",
  use: "开头就是一个数字：“90% 的人…”“3 天涨粉 1 万”“月入 3 万”“只要 20 分钟”",
  techniques: ["首帧大字", "数字滚动", "定格放大", "冲击环", "滴答声", "推镜头", "逐字弹出"],
  schema: s02,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const land = frame >= d.landAt;
    const blur = land ? 0 : 4 * (1 - prog(frame, d.landAt - 8, 8));
    const pop = land ? 1 + 0.18 * (1 - easeOut(prog(frame, d.landAt, 10))) : 1;
    const ticks: number[] = [];
    for (let f = 1; f < d.landAt; f += 3) ticks.push(f);
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 8, len: 8 }, { at: d.landAt, amp: 16, len: 12 }]} exit="zoom">
        <Scrim side="left" size={0.66} strength={0.75} />
        <Flash frame={frame} at={d.landAt} len={8} peak={0.45} />
        <div style={{ position: "absolute", left: 90, top: 150, display: "flex", alignItems: "baseline", transformOrigin: "left center", transform: `scale(${pop})`, filter: blur > 0.1 ? `blur(${blur}px)` : undefined }}>
          {d.prefix && <span style={ink(160, t.accent, t.font.title)}>{d.prefix}</span>}
          <Counter frame={frame} at={0} from={d.from} to={d.to} len={Math.max(8, d.landAt)} decimals={d.decimals} suffix={d.unit} size={330} suffixScale={0.42} color={t.accent} font={t.font.title} strokeW={14} />
        </div>
        <RingBurst frame={frame} at={d.landAt} x={420} y={330} color={t.accent} maxR={420} len={16} />
        <div style={{ position: "absolute", left: 100, top: 560 }}>
          <CharPop frame={frame} at={0} text={d.line} cues={spread(d.line, d.lineAt, Math.min(dur - 16, d.lineAt + 24))} size={92} color={t.text} hl={idxOf(d.line, d.hl)} hlColor={t.bad} font={t.font.title} strokeW={9} />
        </div>
        {ticks.map((f) => (
          <Sfx key={f} name="tick" at={f} volume={0.16} />
        ))}
        <Sfx name="impact" at={d.landAt} volume={0.5} />
        <Sfx name="ding" at={d.landAt + 2} volume={0.35} />
        <Sfx name="whoosh" at={dur - 10} volume={0.25} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { zoomTo: 1.06, punches: [{ at: d.landAt, amt: 0.1 }], hits: [{ at: d.landAt, amp: 14, len: 12 }] }),
});

// ============ T03 反常识：常识句 → 划掉 → 反转句盖上 ============
// “努力就会有结果？错！”
const s03 = z.object({
  myth: z.string().default("越努力越成功").describe("大家以为的常识"),
  truth: z.string().default("方向比努力重要").describe("反转后的真相"),
  tag: z.string().default("错！").describe("否定大字"),
  strikeAt: z.number().default(28).describe("划掉常识（锚点，如“错”）"),
  truthAt: z.number().default(44).describe("真相砸入（锚点）"),
});
export const T03Myth = tpl<z.infer<typeof s03>>({
  id: "op-t03-myth",
  name: "模板 · 反常识（常识被划掉 → 真相砸入）",
  hook: "反常识",
  desc: "首帧砸出一句常识（带引号、绿勾），说到“错”时红线划掉 + 绿勾翻成红叉 + 故障抖动，真相大字从下方砸上来烧成强调色",
  use: "开头推翻一个常识：“都说…其实…”“努力就有结果？错”“别再…了”",
  techniques: ["首帧大字", "常识→划掉", "勾变叉", "故障抖动", "真相砸入", "强调色"],
  schema: s03,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const struck = frame >= d.strikeAt;
    const g = struck && frame < d.strikeAt + 8 ? (frame % 2 ? 1 : -1) * 12 : 0;
    const tr = easeOutBack(prog(frame, d.truthAt, 12));
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.strikeAt, amp: 16, len: 10 }, { at: d.truthAt, amp: 10, len: 8 }]} exit="up">
        <Scrim side="left" size={0.64} strength={0.72} />
        <Flash frame={frame} at={0} len={8} peak={0.45} />
        <Flash frame={frame} at={d.strikeAt} len={6} peak={0.35} color={t.bad} />
        <div style={{ position: "absolute", left: 96, top: 170, transform: `translateX(${g}px)`, opacity: 1 - 0.45 * easeOut(prog(frame, d.truthAt, 10)) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <div style={{ width: 130, height: 130, borderRadius: 65, background: struck ? t.bad : "#2fd07a", border: "8px solid #000", display: "flex", alignItems: "center", justifyContent: "center", transform: `rotateY(${struck ? 180 * (1 - easeOut(prog(frame, d.strikeAt, 8))) : 0}deg)` }}>
              <Icon name={struck ? "x" : "check"} size={86} color="#fff" stroke={3.6} />
            </div>
            <div style={{ position: "relative" }}>
              <Slam frame={frame} at={0} text={`“${d.myth}”`} size={128} color={struck ? alpha(t.text, 0.7) : t.text} font={t.font.title} from={1.3} len={6} blur={3} minOpacity={0.85} strokeW={10} />
              <Strike frame={frame} at={d.strikeAt} color={t.bad} thickness={20} len={6} />
            </div>
          </div>
          {struck && <div style={{ ...ink(170, t.bad, t.font.title), marginTop: 10, marginLeft: 160, transform: `scale(${easeOutBack(prog(frame, d.strikeAt, 8))})`, transformOrigin: "left center" }}>{d.tag}</div>}
        </div>
        {frame >= d.truthAt && (
          <div style={{ position: "absolute", left: 96, top: 640, ...ink(124, t.accent, t.font.title, 11), transform: `translateY(${(1 - tr) * 120}px) scale(${0.7 + 0.3 * tr})`, transformOrigin: "left bottom", opacity: clamp(tr * 2) }}>{d.truth}</div>
        )}
        <Sfx name="impact" at={0} volume={0.45} />
        <Sfx name="glitch" at={d.strikeAt} volume={0.4} />
        <Sfx name="stamp" at={d.strikeAt + 2} volume={0.45} />
        <Sfx name="ding" at={d.truthAt} volume={0.4} />
        <Sfx name="whoosh" at={dur - 10} volume={0.25} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: 0, amt: 0.08 }, { at: d.truthAt, amt: 0.06 }], hits: [{ at: d.strikeAt, amp: 16, len: 10 }], desatAt: d.strikeAt, desatUntil: d.truthAt, desat: 0.6 }),
});

// ============ T04 痛点扎心：黑白 + 痛点气泡围攻 → 大字“是不是你” ============
// “每天加班到 11 点，工资还是 5000？”
const s04 = z.object({
  pains: z.array(z.string()).min(2).max(5).default(["天天加班", "工资不涨", "被裁员", "学不动了"]).describe("围上来的痛点气泡"),
  line: z.string().default("说的是不是你？").describe("最后的大字"),
  hl: z.string().default("你"),
  painAt: z.number().default(4).describe("第一个痛点出现（锚点）"),
  gap: z.number().default(8).describe("痛点之间隔几帧（没给锚点时）"),
  lineAt: z.number().default(48).describe("大字砸下（锚点）"),
});
export const T04Pain = tpl<z.infer<typeof s04>>({
  id: "op-t04-pain",
  name: "模板 · 痛点扎心（黑白画面 + 痛点气泡围攻）",
  hook: "痛点扎心",
  desc: "画面瞬间褪成黑白压暗，一个个红色痛点气泡从四周砸到人脸周围（每个一声咚、画面一震），最后大字“说的是不是你？”砸下，强调词变红",
  use: "开头连续列痛点、戳用户：“天天加班、工资不涨、学不动了…”“是不是你？”",
  techniques: ["首帧黑白", "痛点气泡围攻", "每个一震", "压暗", "大字点名", "红色强调"],
  schema: s04,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const spots = [
      [150, 200, -8],
      [1380, 170, 6],
      [120, 620, 5],
      [1420, 600, -6],
      [760, 90, 3],
    ];
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={d.pains.map((_, i) => ({ at: d.painAt + i * d.gap, amp: 8, len: 6 })).concat([{ at: d.lineAt, amp: 18, len: 12 }])} exit="fade">
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(0,0,0,.7) 100%)" }} />
        {d.pains.map((p, i) => {
          const at = d.painAt + i * d.gap;
          if (frame < at) return null;
          const k = easeOutBack(prog(frame, at, 8));
          const [x, y, r] = spots[i % spots.length];
          const dim = easeOut(prog(frame, d.lineAt, 8)) * 0.5;
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, padding: "18px 34px", borderRadius: 26, background: t.bad, border: "7px solid #000", ...ink(66, "#fff", t.font.title, 0), textShadow: "0 3px 0 rgba(0,0,0,.5)", transform: `rotate(${r}deg) scale(${k * (1 + 1.2 * (1 - k))})`, opacity: 1 - dim, boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
              {p}
            </div>
          );
        })}
        {frame >= d.lineAt && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center" }}>
            <Slam frame={frame} at={d.lineAt} text={d.line} size={150} color={t.text} font={t.font.title} from={2} len={7} strokeW={13} />
          </div>
        )}
        {d.pains.map((_, i) => (
          <Sfx key={i} name="impact" at={d.painAt + i * d.gap} volume={0.28} />
        ))}
        <Sfx name="stamp" at={d.lineAt} volume={0.55} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { desatAt: -6, desat: 0.95, tint: "#1a0008", tintAt: 0, tintOp: 0.3, punches: [{ at: d.lineAt, amt: 0.08 }], hits: [{ at: d.lineAt, amp: 14, len: 12 }] }),
});
