import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { CharPop, Slam, Stamp, Wipe } from "../../lib/cine/Type";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { cam, idxOf, ink, rnd, spread, Stage, tpl } from "./kit";

// ============ T17 新闻快讯：BREAKING 红条 + 滚动字幕 + 台标 ============
// “重磅！OpenAI 刚刚发布了…”
const s17 = z.object({
  tag: z.string().default("重磅").describe("红条上的大字"),
  headline: z.string().default("AI 行业刚刚变天了").describe("主标题"),
  ticker: z.string().default("最新消息 · 全网首发 · 一条视频讲清楚 · ").describe("底部滚动条"),
  live: z.string().default("LIVE"),
  headAt: z.number().default(3).describe("主标题擦出（锚点）"),
});
export const T17News = tpl<z.infer<typeof s17>>({
  id: "op-t17-news",
  name: "模板 · 新闻快讯（BREAKING 红条 + 滚动字幕）",
  hook: "热点快讯",
  desc: "首帧新闻台包装：红色“重磅”块从左侧冲出 + 闪烁 LIVE，主标题白底条擦出，底部红色滚动字幕持续走，人像轻推镜头像主播",
  use: "开头是热点/新发布/大事件：“重磅！…刚刚发布”“突发”“行业变天了”",
  techniques: ["首帧新闻包装", "红块冲出", "LIVE 闪烁", "标题擦出", "滚动字幕", "主播推镜"],
  schema: s17,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const tagP = 0.6 + 0.4 * easeOut(prog(frame, 0, 5));
    const headP = easeOut(prog(frame, d.headAt, 12));
    const tick = (frame * 9) % 1600;
    const Y = 720;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 8, len: 8 }]} exit="fade">
        <div style={{ position: "absolute", left: 0, right: 0, top: Y - 20, bottom: 0, background: "linear-gradient(180deg, transparent, rgba(0,0,0,.55))" }} />
        <Flash frame={frame} at={0} len={8} peak={0.45} />
        <div style={{ position: "absolute", right: 70, top: 110, display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", background: "#e8122d", border: "4px solid #000", ...ink(40, "#fff", t.font.mono, 0), opacity: Math.floor(frame / 12) % 2 ? 1 : 0.6 }}>
          ● {d.live}
        </div>
        <div style={{ position: "absolute", left: 0, top: Y, height: 140, width: 360 * tagP, background: "#e8122d", borderTop: "6px solid #000", borderBottom: "6px solid #000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <span style={ink(96, "#fff", t.font.title, 8)}>{d.tag}</span>
        </div>
        <div style={{ position: "absolute", left: 360, top: Y, height: 140, width: 1460 * headP, background: "#fff", borderTop: "6px solid #000", borderBottom: "6px solid #000", display: "flex", alignItems: "center", padding: "0 40px", overflow: "hidden" }}>
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 88, color: "#111", whiteSpace: "nowrap" }}>{d.headline}</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: Y + 150, height: 70, background: "#111", borderBottom: "4px solid #e8122d", overflow: "hidden", opacity: easeOut(prog(frame, 6, 8)) }}>
          <div style={{ position: "absolute", top: 12, left: -tick, whiteSpace: "nowrap", fontFamily: t.font.body, fontWeight: 800, fontSize: 38, color: "#fff" }}>{d.ticker.repeat(6)}</div>
        </div>
        <Sfx name="impact" at={0} volume={0.45} />
        <Sfx name="swish" at={d.headAt} volume={0.35} />
        <Sfx name="ding" at={d.headAt + 10} volume={0.3} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { zoomTo: 1.08, punches: [{ at: 0, amt: 0.05 }] }),
});

// ============ T18 画面冻结放大镜：人脸定格 → 放大镜扫过关键物 → 标注 ============
// “你看我身后这台电脑…” / 开头指向画面里某个东西
const s18 = z.object({
  lead: z.string().default("注意看").describe("首帧大字"),
  x: z.number().min(0).max(1).default(0.12).describe("要放大的东西在画面里的水平位置 0~1"),
  y: z.number().min(0).max(1).default(0.72),
  label: z.string().default("就是它").describe("放大镜旁的标注"),
  line: z.string().default("让我一年省下 200 小时").describe("底部一句"),
  zoomAt: z.number().default(16).describe("放大镜落下（锚点）"),
  lineAt: z.number().default(40),
});
export const T18Magnify = tpl<z.infer<typeof s18>>({
  id: "op-t18-magnify",
  name: "模板 · 放大镜聚焦（画面里的关键物）",
  hook: "细节聚焦",
  desc: "首帧“注意看”砸字 + 画面四周压暗，一个放大镜圆框从人脸滑到画面里的关键物上（真实放大底下的真人画面），箭头 + 标注弹出，底部擦出一句",
  use: "开头让观众看画面里某个东西：“注意看我身后…”“这台电脑…”“这个小东西让我…”（x/y 填它在画面里的位置）",
  techniques: ["首帧大字", "四周压暗", "放大镜（真实放大画面）", "箭头标注", "擦出结论"],
  schema: s18,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const m = easeInOut(prog(frame, d.zoomAt - 10, 14));
    const tx = d.x * 1920;
    const ty = d.y * 1080;
    const mx = 960 + (tx - 960) * m;
    const my = 420 + (ty - 420) * m;
    const R = 190;
    const lab = easeOutBack(prog(frame, d.zoomAt + 6, 10));
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }]} exit="fade">
        {/* darkness with a hole where the glass is */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${mx}px ${my}px, transparent ${R}px, rgba(0,0,0,.62) ${R + 40}px)` }} />
        <div style={{ position: "absolute", left: mx - R, top: my - R, width: R * 2, height: R * 2, borderRadius: "50%", border: "14px solid #111", boxShadow: `0 0 0 6px ${t.accent}, 0 0 40px ${alpha(t.accent, 0.6)}, inset 0 0 40px rgba(255,255,255,.25)` }} />
        <div style={{ position: "absolute", left: mx + R * 0.62, top: my + R * 0.62, width: 50, height: 190, background: "linear-gradient(90deg,#333,#111)", border: "6px solid #000", borderRadius: 20, transform: "rotate(-45deg)", transformOrigin: "top center" }} />
        {frame >= d.zoomAt + 6 && (
          <div style={{ position: "absolute", left: tx + (tx > 960 ? -R - 460 : R + 60), top: ty - R - 60, transform: `scale(${lab})`, transformOrigin: tx > 960 ? "right bottom" : "left bottom", ...ink(96, t.accent, t.font.title) }}>
            {tx > 960 ? `${d.label} →` : `← ${d.label}`}
          </div>
        )}
        <div style={{ position: "absolute", left: 96, top: 130 }}>
          <Slam frame={frame} at={0} text={d.lead} size={170} color={t.text} font={t.font.title} from={1.4} len={6} blur={3} minOpacity={0.9} strokeW={12} style={{ transformOrigin: "left center" }} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 880, display: "flex", justifyContent: "center" }}>
          <Wipe frame={frame} at={d.lineAt} text={d.line} size={88} color={t.text} font={t.font.title} len={12} edge={t.accent} />
        </div>
        <Sfx name="impact" at={0} volume={0.4} />
        <Sfx name="swish" at={d.zoomAt - 10} volume={0.3} />
        <Sfx name="ding" at={d.zoomAt + 6} volume={0.4} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  // the glass actually magnifies: the whole person layer punches toward the target point
  camera: (d, f, dur) => {
    const base = cam(f, dur, { punches: [{ at: 0, amt: 0.06 }] });
    const m = easeInOut(prog(f, d.zoomAt - 10, 14)) * (1 - easeInOut(prog(f, dur - 12, 12)));
    const z = 1 + 0.45 * m;
    return { ...base, zoom: (base.zoom ?? 1) * z, x: (base.x ?? 0) - (d.x - 0.5) * 1920 * (z - 1) * 0.9, y: (base.y ?? 0) - (d.y - 0.5) * 1080 * (z - 1) * 0.9 };
  },
});

// ============ T19 挑战打赌：押注筹码 + “做不到我…” ============
// “如果看完你还学不会，我直播吃键盘”
const s19 = z.object({
  bet: z.string().default("看完还学不会").describe("条件"),
  promise: z.string().default("我直播吃键盘").describe("承诺/赌注"),
  chip: z.string().default("我赌").describe("筹码上的字"),
  promiseAt: z.number().default(34).describe("承诺砸下（锚点）"),
});
export const T19Bet = tpl<z.infer<typeof s19>>({
  id: "op-t19-bet",
  name: "模板 · 挑战打赌（筹码砸桌 + 承诺盖章）",
  hook: "挑战打赌",
  desc: "首帧金色筹码一叠从上方砸下（“我赌”）+ 冲击环，条件句逐字弹出，说到赌注时大红承诺字带印章边框砸下 + 画面剧烈一震",
  use: "开头立 flag/打赌/挑战：“看完还不会我…”“我赌你做不到”“7 天挑战…”",
  techniques: ["首帧筹码道具", "筹码叠落", "冲击环", "逐字弹出", "承诺盖章", "剧烈抖动"],
  schema: s19,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const X = 1380;
    const Y = 620;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 2, amp: 10, len: 8 }, { at: d.promiseAt, amp: 22, len: 14 }]} exit="left">
        <Scrim side="left" size={0.6} strength={0.72} />
        <Scrim side="bottom" size={0.35} strength={0.5} />
        <Flash frame={frame} at={0} len={8} peak={0.4} />
        {Array.from({ length: 6 }, (_, i) => {
          const at = i * 2;
          const p = easeIn(prog(frame, at, 6));
          const y = Y - i * 34 - (1 - p) * 700;
          if (frame < at) return null;
          return <div key={i} style={{ position: "absolute", left: X, top: y, width: 300, height: 80, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 35%, #ffe38a, #d99a00 70%)", border: "7px solid #000", boxShadow: "inset 0 -12px 0 rgba(0,0,0,.25)" }} />;
        })}
        <div style={{ position: "absolute", left: X, top: Y - 5 * 34 - 110, width: 300, textAlign: "center", ...ink(90, t.gold, t.font.title), opacity: easeOut(prog(frame, 12, 6)) }}>{d.chip}</div>
        <RingBurst frame={frame} at={2} x={X + 150} y={Y + 40} color={t.gold} maxR={300} len={14} />
        <div style={{ position: "absolute", left: 96, top: 220 }}>
          <Slam frame={frame} at={0} text={d.bet} size={130} color={t.text} font={t.font.title} from={1.4} len={6} blur={3} minOpacity={0.9} strokeW={11} style={{ transformOrigin: "left center" }} />
        </div>
        <div style={{ position: "absolute", left: 110, top: 480 }}>
          <Stamp frame={frame} at={d.promiseAt} text={d.promise} size={130} color={t.bad} font={t.font.title} rotate={-5} />
        </div>
        {[0, 2, 4, 6, 8, 10].map((f) => (
          <Sfx key={f} name="click" at={f + 5} volume={0.3} />
        ))}
        <Sfx name="impact" at={2} volume={0.45} />
        <Sfx name="stamp" at={d.promiseAt} volume={0.6} />
        <Sfx name="impact" at={d.promiseAt} volume={0.4} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: d.promiseAt, amt: 0.1 }], hits: [{ at: d.promiseAt, amp: 20, len: 14 }] }),
});

// ============ T20 故障闯入：信号故障撕裂 → 真人从噪点里“闯”出来 ============
// 任何需要“打断刷屏”的强开场：“停一下！”“先别划走”
const s20 = z.object({
  stop: z.string().default("先别划走").describe("故障里闪出的大字"),
  line: z.string().default("这条能帮你省 100 小时").describe("稳定后的一句"),
  hl: z.string().default("100 小时"),
  clearAt: z.number().default(18).describe("信号恢复、人脸清晰（锚点）"),
  lineAt: z.number().default(30),
});
export const T20Glitch = tpl<z.infer<typeof s20>>({
  id: "op-t20-glitch",
  name: "模板 · 故障闯入（信号撕裂 → 真人闯出）",
  hook: "打断刷屏",
  desc: "首帧满屏 RGB 撕裂 + 雪花噪点 + 横向错位条（故障声），“先别划走”在故障里闪烁，信号一恢复人脸猛推清晰，下方一句钩子逐字弹出",
  use: "通用强打断开场：“停！先别划走”“等一下”“你刷到这条是有原因的”——任何需要立刻抓住注意力的文案",
  techniques: ["首帧故障撕裂", "雪花噪点", "RGB 错位", "故障闪字", "信号恢复推镜", "钩子逐字"],
  schema: s20,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const noisy = frame < d.clearAt;
    const k = 1 - prog(frame, d.clearAt - 6, 6);
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: d.clearAt, amp: 14, len: 10 }]} exit="fade">
        {noisy && (
          <>
            <div style={{ position: "absolute", inset: 0, opacity: 0.55 * k, backgroundImage: `repeating-linear-gradient(${(frame * 37) % 180}deg, rgba(255,255,255,.35) 0 2px, transparent 2px 5px)`, mixBlendMode: "overlay" }} />
            {Array.from({ length: 9 }, (_, i) => {
              const y = rnd(i + frame * 3, seed) * 1080;
              const h = 16 + rnd(i + frame * 5, seed) * 70;
              const dx = (rnd(i + frame * 7, seed) - 0.5) * 240;
              const col = ["rgba(255,0,60,.45)", "rgba(0,255,230,.4)", "rgba(255,255,255,.3)"][i % 3];
              return <div key={i} style={{ position: "absolute", left: dx, right: -dx, top: y, height: h, background: col, mixBlendMode: "screen", opacity: k }} />;
            })}
          </>
        )}
        <Flash frame={frame} at={d.clearAt} len={6} peak={0.55} />
        {noisy && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 360, textAlign: "center", opacity: Math.floor(frame / 2) % 3 === 0 ? 0.35 : 1 }}>
            <span style={{ ...ink(200, "#fff", t.font.title, 14), position: "relative", display: "inline-block" }}>
              <span style={{ position: "absolute", left: -10, top: 0, color: "rgba(255,0,60,.9)", WebkitTextStroke: "0", textShadow: "none", mixBlendMode: "screen" }}>{d.stop}</span>
              <span style={{ position: "absolute", left: 10, top: 0, color: "rgba(0,255,230,.9)", WebkitTextStroke: "0", textShadow: "none", mixBlendMode: "screen" }}>{d.stop}</span>
              {d.stop}
            </span>
          </div>
        )}
        {!noisy && (
          <>
            <Scrim side="bottom" size={0.45} strength={0.65} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center" }}>
              <span style={{ ...ink(130, t.text, t.font.title), display: "inline-block", transform: `scale(${1 + 0.3 * (1 - easeOut(prog(frame, d.clearAt, 8)))})` }}>{d.stop}</span>
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, top: 820, display: "flex", justifyContent: "center" }}>
              <CharPop frame={frame} at={0} text={d.line} cues={spread(d.line, d.lineAt, d.lineAt + 20)} size={88} color={t.text} hl={idxOf(d.line, d.hl)} hlColor={t.accent} font={t.font.title} strokeW={9} />
            </div>
          </>
        )}
        <Sfx name="glitch" at={0} volume={0.45} />
        <Sfx name="glitch" at={8} volume={0.35} />
        <Sfx name="impact" at={d.clearAt} volume={0.5} />
        <Sfx name="ding" at={d.lineAt + 10} volume={0.3} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => {
    const base = cam(f, dur, { punches: [{ at: d.clearAt, amt: 0.14 }] });
    const noisy = f < d.clearAt;
    return {
      ...base,
      x: (base.x ?? 0) + (noisy ? (rnd(f, 3) - 0.5) * 60 : 0),
      filter: noisy ? `contrast(1.6) saturate(0.4) hue-rotate(${(f * 40) % 360}deg) blur(${1 + rnd(f, 5) * 2}px)` : base.filter,
      tint: noisy ? "#001a1a" : base.tint,
      tintOpacity: noisy ? 0.4 : base.tintOpacity,
    };
  },
});
