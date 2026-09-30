import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { CharPop, Slam, Stamp, Wipe } from "../../lib/cine/Type";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { cam, idxOf, ink, rnd, spread, Stage, tpl } from "./kit";

// ============ T05 悬念锁：马赛克 + 锁 → “看到最后”→ 锁晃动 ============
// “最后一个方法 90% 的人都不知道”
const s05 = z.object({
  line: z.string().default("最后一个方法").describe("被藏起来的东西"),
  secret: z.string().default("没人告诉你").describe("锁下面的一句"),
  cta: z.string().default("看到最后").describe("右下角提示"),
  lockAt: z.number().default(16).describe("锁砸下（锚点）"),
  rattleAt: z.number().default(44).describe("锁开始晃（锚点，如“不知道”）"),
});
export const T05Suspense = tpl<z.infer<typeof s05>>({
  id: "op-t05-suspense",
  name: "模板 · 悬念锁（马赛克遮挡 + 锁头晃动）",
  hook: "悬念",
  desc: "首帧大字 + 一块发光马赛克挡在人脸旁（像素抖动），锁头砸在上面，说到关键处锁晃动冒火花，右下角“看到最后 ▼”箭头呼吸",
  use: "开头卖关子：“最后一个方法才是重点”“我不建议你看到最后”“这个秘密…”",
  techniques: ["首帧大字", "马赛克遮挡", "锁头砸下", "锁头晃动", "riser 悬念音", "看到最后提示"],
  schema: s05,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const lk = easeOutBack(prog(frame, d.lockAt, 10));
    const rat = frame >= d.rattleAt ? Math.sin(frame * 1.6) * 10 * (1 - prog(frame, d.rattleAt + 24, 10)) : 0;
    const cells = 12;
    const mx = 1180;
    const my = 180;
    const cw = 52;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.lockAt, amp: 12, len: 10 }]} exit="fade">
        <Scrim side="left" size={0.6} strength={0.7} />
        <Flash frame={frame} at={0} len={8} peak={0.45} />
        <div style={{ position: "absolute", left: 96, top: 200 }}>
          <Slam frame={frame} at={0} text={d.line} size={160} color={t.text} font={t.font.title} from={1.35} len={6} blur={3} minOpacity={0.85} strokeW={12} style={{ transformOrigin: "left center" }} />
          <div style={{ marginTop: 30 }}>
            <Wipe frame={frame} at={d.lockAt + 6} text={d.secret} size={96} color={t.accent} font={t.font.title} len={10} edge={t.accent} />
          </div>
        </div>
        {/* mosaic block */}
        <div style={{ position: "absolute", left: mx, top: my, width: cells * cw, height: cells * cw, borderRadius: 24, overflow: "hidden", border: `5px solid ${t.primary}`, boxShadow: `0 0 50px ${alpha(t.primary, 0.6)}`, opacity: easeOut(prog(frame, 0, 6)), transform: `scale(${0.8 + 0.2 * easeOutBack(prog(frame, 0, 10))})` }}>
          {Array.from({ length: cells * cells }, (_, i) => {
            const v = rnd(i + Math.floor(frame / 3) * 7, seed);
            return <div key={i} style={{ position: "absolute", left: (i % cells) * cw, top: Math.floor(i / cells) * cw, width: cw, height: cw, background: `hsl(${200 + v * 60}, 60%, ${18 + v * 30}%)` }} />;
          })}
        </div>
        {frame >= d.lockAt && (
          <div style={{ position: "absolute", left: mx + (cells * cw) / 2 - 130, top: my + (cells * cw) / 2 - 150, width: 260, height: 300, transform: `rotate(${rat}deg) scale(${lk * (1 + 0.8 * (1 - lk))})`, transformOrigin: "50% 20%" }}>
            <div style={{ position: "absolute", left: 60, top: 0, width: 140, height: 150, borderRadius: "70px 70px 0 0", border: "26px solid #ffcf5c", borderBottom: "none", boxShadow: "0 0 0 6px #000" }} />
            <div style={{ position: "absolute", left: 0, top: 120, width: 260, height: 180, borderRadius: 30, background: "linear-gradient(160deg,#ffd970,#e6a100)", border: "8px solid #000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="lock" size={100} color="#000" stroke={2.6} />
            </div>
          </div>
        )}
        {frame >= d.rattleAt && frame < d.rattleAt + 30 && <RingBurst frame={frame} at={d.rattleAt} x={mx + (cells * cw) / 2} y={my + (cells * cw) / 2 + 60} color="#ffcf5c" maxR={300} len={14} />}
        <div style={{ position: "absolute", right: 120, bottom: 150, display: "flex", alignItems: "center", gap: 14, ...ink(64, t.accent, t.font.title, 7), opacity: easeOut(prog(frame, d.rattleAt, 8)), transform: `translateY(${Math.sin(frame / 5) * 8}px)` }}>
          {d.cta}
          <span style={{ fontSize: 56 }}>▼</span>
        </div>
        <Sfx name="impact" at={0} volume={0.45} />
        <Sfx name="stamp" at={d.lockAt} volume={0.5} />
        <Sfx name="riser" at={Math.max(0, d.rattleAt - 30)} volume={0.2} />
        <Sfx name="glitch" at={d.rattleAt} volume={0.35} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { zoomTo: 1.08, punches: [{ at: 0, amt: 0.08 }], hits: [{ at: d.lockAt, amp: 10, len: 10 }] }),
});

// ============ T06 身份点名：定位框锁定人脸 → 标签 → “说的就是你” ============
// “如果你是一个普通上班族…”
const s06 = z.object({
  who: z.string().default("普通上班族").describe("点名的人群"),
  tags: z.array(z.string()).max(3).default(["没背景", "没资源", "想搞副业"]).describe("人群标签，逐个弹出"),
  line: z.string().default("这条视频就是给你的").describe("最后一句"),
  lockAt: z.number().default(6).describe("定位框锁定人脸（锚点）"),
  tagAt: z.number().default(22),
  lineAt: z.number().default(52),
});
export const T06Callout = tpl<z.infer<typeof s06>>({
  id: "op-t06-callout",
  name: "模板 · 身份点名（瞄准框锁定 + 人群标签）",
  hook: "身份点名",
  desc: "四角瞄准框从全屏收拢锁定人脸（滴滴锁定声），身份大字贴在框边，人群标签从框上逐个弹出，最后一句“说的就是你”擦出",
  use: "开头点名目标人群：“如果你是宝妈/上班族/新手博主…”“这条视频只给…看”",
  techniques: ["瞄准框锁定", "锁定音", "身份大字", "标签逐个弹出", "擦出结论", "人脸推近"],
  schema: s06,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const k = easeInOut(prog(frame, d.lockAt, 12));
    const fx = 740;
    const fy = 90;
    const fw = 460;
    const fh = 500;
    const x = fx * k;
    const y = fy * k;
    const w = 1920 + (fw - 1920) * k;
    const h = 1080 + (fh - 1080) * k;
    const locked = frame >= d.lockAt + 12;
    const col = locked ? t.bad : t.primary;
    const L = 70;
    const b = `10px solid ${col}`;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: d.lockAt + 12, amp: 10, len: 8 }]} exit="fade">
        <Scrim side="left" size={0.4} strength={0.55} />
        <Scrim side="right" size={0.4} strength={0.55} />
        <div style={{ position: "absolute", left: x, top: y, width: w, height: h, filter: `drop-shadow(0 0 12px ${alpha(col, 0.8)})` }}>
          {[
            { left: 0, top: 0, borderLeft: b, borderTop: b },
            { right: 0, top: 0, borderRight: b, borderTop: b },
            { left: 0, bottom: 0, borderLeft: b, borderBottom: b },
            { right: 0, bottom: 0, borderRight: b, borderBottom: b },
          ].map((s, i) => (
            <div key={i} style={{ position: "absolute", width: L, height: L, ...s }} />
          ))}
          {locked && <div style={{ position: "absolute", left: "50%", top: "50%", width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: 15, border: `5px solid ${col}`, opacity: Math.floor(frame / 5) % 2 ? 1 : 0.4 }} />}
        </div>
        <div style={{ position: "absolute", left: 96, top: 110, display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ ...ink(90, locked ? t.bad : t.primary, t.font.title, 0), opacity: Math.floor(frame / 6) % 2 ? 1 : 0.5 }}>●</span>
          <Slam frame={frame} at={0} text={d.who} size={120} color={t.text} font={t.font.title} from={1.4} len={6} blur={3} minOpacity={0.9} strokeW={11} style={{ transformOrigin: "left center" }} />
        </div>
        <Flash frame={frame} at={0} len={8} peak={0.4} />
        {d.tags.map((tg, i) => {
          const at = d.tagAt + i * 7;
          if (frame < at) return null;
          const p = easeOutBack(prog(frame, at, 10));
          const side = i % 2 === 0 ? fx - 440 : fx + fw + 40;
          return (
            <div key={i} style={{ position: "absolute", left: side, top: fy + 120 + i * 150, padding: "14px 30px", borderRadius: 18, background: alpha(t.bg, 0.85), border: `4px solid ${t.primary}`, ...ink(58, t.text, t.font.title, 0), transform: `scale(${p})`, boxShadow: `0 0 20px ${alpha(t.primary, 0.5)}` }}>
              # {tg}
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 0, right: 0, top: 850, display: "flex", justifyContent: "center" }}>
          <Wipe frame={frame} at={d.lineAt} text={d.line} size={96} color={t.accent} font={t.font.title} len={10} edge={t.accent} />
        </div>
        <Sfx name="impact" at={0} volume={0.4} />
        <Sfx name="tick" at={d.lockAt + 2} volume={0.3} />
        <Sfx name="tick" at={d.lockAt + 7} volume={0.3} />
        <Sfx name="ding" at={d.lockAt + 12} volume={0.4} />
        {d.tags.map((_, i) => (
          <Sfx key={i} name="pop" at={d.tagAt + i * 7} volume={0.3} />
        ))}
        <Sfx name="swish" at={d.lineAt} volume={0.3} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: d.lockAt + 12, amt: 0.12 }] }),
});

// ============ T07 前后对比：画面左右劈开 BEFORE / AFTER ============
// “三个月前我还是 0 粉丝，现在 10 万”
const s07 = z.object({
  before: z.object({ label: z.string(), value: z.string() }).default({ label: "3 个月前", value: "0 粉丝" }),
  after: z.object({ label: z.string(), value: z.string() }).default({ label: "现在", value: "10 万粉" }),
  line: z.string().default("我只做对了一件事"),
  splitAt: z.number().default(22).describe("画面劈开、右侧 AFTER 出现（锚点，如“现在”）"),
  lineAt: z.number().default(50),
});
export const T07BeforeAfter = tpl<z.infer<typeof s07>>({
  id: "op-t07-before-after",
  name: "模板 · 前后对比（画面劈开 BEFORE/AFTER）",
  hook: "前后对比",
  desc: "首帧左半边压灰写着 BEFORE + 惨淡数值，说到“现在”时一道光刃从上到下劈开画面，右半边金色 AFTER + 数值砸下，中间箭头冲击，底部一句钩子",
  use: "开头晒对比/逆袭：“3 个月前 0 粉，现在 10 万”“以前 3 小时，现在 3 分钟”“月薪 3 千到 3 万”",
  techniques: ["首帧大字", "左灰右金", "光刃劈开", "数值砸下", "箭头冲击", "钩子句"],
  schema: s07,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const sp = easeOut(prog(frame, d.splitAt, 8));
    const av = easeOutBack(prog(frame, d.splitAt + 4, 12));
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 8, len: 8 }, { at: d.splitAt, amp: 18, len: 12 }]} exit="fade">
        <div style={{ position: "absolute", left: 0, top: 0, width: 960, height: 1080, background: "linear-gradient(90deg, rgba(20,20,24,.75), rgba(20,20,24,.35))", backdropFilter: "grayscale(1)" }} />
        <div style={{ position: "absolute", left: 80, top: 190 }}>
          <div style={{ ...ink(44, "#bbb", t.font.mono, 5), letterSpacing: 10 }}>BEFORE</div>
          <Slam frame={frame} at={0} text={d.before.label} size={96} color="#ddd" font={t.font.title} from={1.3} len={6} blur={2} minOpacity={0.85} strokeW={9} />
          <div style={{ ...ink(170, "#9aa", t.font.title), marginTop: 10 }}>{d.before.value}</div>
        </div>
        {frame >= d.splitAt && (
          <>
            <div style={{ position: "absolute", left: 950, top: 0, width: 20, height: 1080 * sp, background: "#fff", boxShadow: `0 0 40px #fff, 0 0 90px ${t.accent}` }} />
            <div style={{ position: "absolute", right: 0, top: 0, width: 960, height: 1080, background: `linear-gradient(270deg, ${alpha(t.accent, 0.35)}, transparent)`, opacity: sp }} />
            <div style={{ position: "absolute", left: 1090, top: 190, transform: `scale(${av})`, transformOrigin: "left top" }}>
              <div style={{ ...ink(44, t.accent, t.font.mono, 5), letterSpacing: 10 }}>AFTER</div>
              <div style={ink(96, t.text, t.font.title)}>{d.after.label}</div>
              <div style={{ ...ink(190, t.accent, t.font.title), marginTop: 10 }}>{d.after.value}</div>
            </div>
            <div style={{ position: "absolute", left: 890, top: 600, width: 140, height: 140, borderRadius: 70, background: t.accent, border: "8px solid #000", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${easeOutBack(prog(frame, d.splitAt + 6, 10))})`, ...ink(90, "#000", t.font.title, 0) }}>→</div>
          </>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", justifyContent: "center" }}>
          <CharPop frame={frame} at={0} text={d.line} cues={spread(d.line, d.lineAt, Math.min(dur - 14, d.lineAt + 18))} size={92} color={t.text} font={t.font.title} strokeW={9} />
        </div>
        <Sfx name="impact" at={0} volume={0.4} />
        <Sfx name="swish" at={d.splitAt} volume={0.4} />
        <Sfx name="impact" at={d.splitAt + 4} volume={0.45} />
        <Sfx name="success" at={d.splitAt + 8} volume={0.3} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: d.splitAt, amt: 0.08 }], hits: [{ at: d.splitAt, amp: 14, len: 12 }] }),
});

// ============ T08 警告禁止：红色警报条 + STOP 牌 ============
// “千万别再这样用 AI 了”
const s08 = z.object({
  warn: z.string().default("千万别").describe("警告大字"),
  line: z.string().default("再这样写简历了").describe("后面的内容"),
  hl: z.string().default("这样"),
  stop: z.string().default("STOP").describe("禁止牌上的字"),
  lineAt: z.number().default(14),
  stopAt: z.number().default(40).describe("禁止牌砸下（锚点）"),
});
export const T08Warning = tpl<z.infer<typeof s08>>({
  id: "op-t08-warning",
  name: "模板 · 警告禁止（红色警报 + 禁止牌）",
  hook: "警告",
  desc: "首帧画面边缘红色警报闪烁、黄黑警戒条从上下滑入，“千万别”砸字抖动，内容逐字弹出，红色八角禁止牌带冲击砸在人脸旁",
  use: "开头警告/劝退：“千万别…”“再这样做就完了”“这 3 个坑一定要避开”",
  techniques: ["首帧大字", "红色警报闪烁", "警戒条", "逐字弹出", "禁止牌砸下", "强抖动"],
  schema: s08,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const blink = 0.35 + 0.35 * (Math.floor(frame / 5) % 2);
    const bar = easeOut(prog(frame, 0, 8));
    const st = easeOutBack(prog(frame, d.stopAt, 10));
    const stripe = (top: number) => (
      <div style={{ position: "absolute", left: 0, right: 0, top, height: 54, transform: `translateX(${(1 - bar) * (top ? 1920 : -1920)}px)`, background: "repeating-linear-gradient(-45deg, #ffcf00 0 44px, #111 44px 88px)", backgroundPositionX: frame * 6, borderTop: "4px solid #000", borderBottom: "4px solid #000" }} />
    );
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 14, len: 10 }, { at: d.stopAt, amp: 20, len: 14 }]} exit="fade">
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 220px rgba(255,20,40,${blink})` }} />
        <Scrim side="left" size={0.6} strength={0.65} />
        {stripe(96)}
        {stripe(930)}
        <div style={{ position: "absolute", left: 96, top: 230 }}>
          <Slam frame={frame} at={0} text={d.warn} size={200} color={t.bad} font={t.font.title} from={1.5} len={6} blur={3} minOpacity={0.9} strokeW={13} style={{ transformOrigin: "left center" }} />
          <div style={{ marginTop: 20 }}>
            <CharPop frame={frame} at={0} text={d.line} cues={spread(d.line, d.lineAt, d.lineAt + 22)} size={100} color={t.text} hl={idxOf(d.line, d.hl)} hlColor={t.accent} font={t.font.title} strokeW={9} />
          </div>
        </div>
        {frame >= d.stopAt && (
          <div style={{ position: "absolute", left: 1300, top: 240, width: 420, height: 420, transform: `rotate(${(1 - st) * -30 + 8}deg) scale(${st * (1 + 0.6 * (1 - st))})` }}>
            <div style={{ position: "absolute", inset: 0, background: "#000", clipPath: "polygon(29% 0,71% 0,100% 29%,100% 71%,71% 100%,29% 100%,0 71%,0 29%)" }} />
            <div style={{ position: "absolute", inset: 14, background: "#e8122d", clipPath: "polygon(29% 0,71% 0,100% 29%,100% 71%,71% 100%,29% 100%,0 71%,0 29%)", display: "flex", alignItems: "center", justifyContent: "center", ...ink(120, "#fff", t.font.title, 0) }}>{d.stop}</div>
          </div>
        )}
        <Sfx name="glitch" at={0} volume={0.35} />
        <Sfx name="impact" at={0} volume={0.45} />
        <Sfx name="stamp" at={d.stopAt} volume={0.6} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { tint: "#3a0006", tintAt: 0, tintOp: 0.25, punches: [{ at: 0, amt: 0.08 }, { at: d.stopAt, amt: 0.06 }], hits: [{ at: d.stopAt, amp: 18, len: 12 }] }),
});
