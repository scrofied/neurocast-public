import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { CharPop, Counter, Slam, Stamp } from "../../lib/cine/Type";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { cam, idxOf, ink, rnd, spread, Stage, tpl } from "./kit";

// ============ T09 爆料揭秘：机密文件夹 → 封条撕开 → 内容曝光 ============
// “今天给大家揭秘一个行业内幕”
const s09 = z.object({
  file: z.string().default("行业内幕").describe("文件夹上的字"),
  seal: z.string().default("绝密").describe("封条"),
  reveal: z.string().default("没人会告诉你").describe("撕开后露出的大字"),
  hl: z.string().default("没人"),
  tearAt: z.number().default(30).describe("封条撕开（锚点，如“揭秘”）"),
});
export const T09Reveal = tpl<z.infer<typeof s09>>({
  id: "op-t09-reveal",
  name: "模板 · 爆料揭秘（绝密档案撕封条）",
  hook: "揭秘爆料",
  desc: "首帧一份印着红章“绝密”的档案夹甩到人脸旁，说到揭秘时封条撕成两半飞出、档案翻开发光、大字从里面弹出",
  use: "开头爆料：“揭秘…内幕”“这是平台不会告诉你的”“行业里没人敢说的”",
  techniques: ["首帧道具", "绝密红章", "封条撕开", "档案发光", "大字弹出", "推镜头"],
  schema: s09,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const inP = easeOutBack(prog(frame, 0, 10));
    const tear = easeOut(prog(frame, d.tearAt, 12));
    const open = easeOutBack(prog(frame, d.tearAt + 4, 14));
    const X = 1200;
    const Y = 260;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.tearAt, amp: 16, len: 12 }]} exit="right">
        <Scrim side="right" size={0.62} strength={0.7} />
        <Scrim side="left" size={0.5} strength={0.55} />
        <div style={{ position: "absolute", left: X, top: Y, width: 620, height: 460, transform: `translateX(${(1 - inP) * 600}px) rotate(${-6 + (1 - inP) * 20}deg)` }}>
          {/* back cover (opens) */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 18, background: "#c9a063", border: "8px solid #000", boxShadow: open > 0 ? `0 0 ${80 * open}px ${alpha(t.accent, 0.8)}` : "0 20px 40px rgba(0,0,0,.6)" }} />
          <div style={{ position: "absolute", left: 40, top: -50, width: 240, height: 70, borderRadius: "18px 18px 0 0", background: "#c9a063", border: "8px solid #000", borderBottom: "none" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: 18, background: "linear-gradient(160deg,#e3bb7a,#b88a4c)", border: "8px solid #000", transformOrigin: "left center", transform: `perspective(1400px) rotateY(${-100 * open}deg)`, backfaceVisibility: "hidden", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60 }}>
            <div style={{ ...ink(110, "#3a2208", t.font.title, 0), textShadow: "none" }}>{d.file}</div>
          </div>
          {/* seal halves */}
          {[-1, 1].map((s) => (
            <div key={s} style={{ position: "absolute", left: s < 0 ? 140 : 310, top: 250, width: 170, height: 150, overflow: "hidden", transform: `translate(${s * tear * 420}px, ${tear * 260}px) rotate(${s * tear * 70}deg)`, opacity: 1 - tear * 0.8 }}>
              <div style={{ position: "absolute", left: s < 0 ? 0 : -170, top: 0, width: 340, height: 150, display: "flex", alignItems: "center", justifyContent: "center", border: `9px solid ${t.bad}`, borderRadius: 14, background: "rgba(255,255,255,.2)", transform: "rotate(-10deg)", ...ink(96, t.bad, t.font.title, 0), textShadow: "none" }}>{d.seal}</div>
            </div>
          ))}
        </div>
        {frame >= d.tearAt + 6 && (
          <div style={{ position: "absolute", left: 96, top: 380 }}>
            <CharPop frame={frame} at={0} text={d.reveal} cues={spread(d.reveal, d.tearAt + 6, d.tearAt + 26)} size={130} color={t.text} hl={idxOf(d.reveal, d.hl)} hlColor={t.accent} font={t.font.title} strokeW={11} />
          </div>
        )}
        <Sfx name="swipe" at={0} volume={0.4} />
        <Sfx name="stamp" at={4} volume={0.45} />
        <Sfx name="glitch" at={d.tearAt} volume={0.35} />
        <Sfx name="sparkle" at={d.tearAt + 4} volume={0.35} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: d.tearAt, amt: 0.08 }], zoomTo: 1.05 }),
});

// ============ T10 倒计时紧迫：巨大倒计时 + 进度条烧完 ============
// “只需要 3 分钟…” “最后 3 天…”
const s10 = z.object({
  from: z.number().default(3).describe("倒数起点"),
  unit: z.string().default("分钟"),
  line: z.string().default("学会这个技巧").describe("倒计时下面一句"),
  endAt: z.number().default(48).describe("倒数到 0 / 砸出结论的时刻（锚点）"),
  end: z.string().default("GO!").describe("倒数结束时的大字"),
});
export const T10Countdown = tpl<z.infer<typeof s10>>({
  id: "op-t10-countdown",
  name: "模板 · 倒计时紧迫（巨型倒数 + 燃烧进度条）",
  hook: "时间紧迫",
  desc: "首帧巨大数字 3→2→1 每下一砸（心跳声 + 画面脉冲），底部红色进度条像引线一样燃烧，归零时爆出结论大字 + 闪白",
  use: "开头强调时间短或紧迫：“只要 3 分钟”“最后 3 天”“5 秒钟教会你”“倒计时开始”",
  techniques: ["首帧大字", "巨型倒数", "心跳脉冲", "引线进度条", "归零爆字", "闪白"],
  schema: s10,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const n = Math.max(1, Math.round(d.from));
    const step = d.endAt / n;
    const k = Math.min(n - 1, Math.floor(frame / step));
    const cur = n - k;
    const local = frame - k * step;
    const beat = easeOut(prog(local, 0, 6));
    const ended = frame >= d.endAt;
    const burn = clamp(frame / d.endAt);
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={Array.from({ length: n }, (_, i) => ({ at: Math.round(i * step), amp: 10, len: 6 })).concat([{ at: d.endAt, amp: 20, len: 12 }])} exit="zoom">
        <Scrim side="left" size={0.62} strength={0.7} />
        <Flash frame={frame} at={d.endAt} len={8} peak={0.6} />
        {!ended && (
          <div style={{ position: "absolute", left: 110, top: 110, display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ ...ink(460, t.accent, t.font.title, 18), transform: `scale(${1.5 - 0.5 * beat})`, transformOrigin: "left bottom", display: "inline-block", opacity: 0.6 + 0.4 * beat }}>{cur}</span>
            <span style={ink(110, t.text, t.font.title)}>{d.unit}</span>
          </div>
        )}
        {ended && (
          <div style={{ position: "absolute", left: 100, top: 180 }}>
            <Slam frame={frame} at={d.endAt} text={d.end} size={300} color={t.accent} font={t.font.title} from={2} len={7} strokeW={16} style={{ transformOrigin: "left center" }} />
          </div>
        )}
        <div style={{ position: "absolute", left: 110, top: 670 }}>
          <CharPop frame={frame} at={0} text={d.line} cues={spread(d.line, 4, 22)} size={96} color={t.text} font={t.font.title} strokeW={9} />
        </div>
        <div style={{ position: "absolute", left: 110, top: 830, width: 1000, height: 30, borderRadius: 15, background: "rgba(0,0,0,.6)", border: "4px solid #000", overflow: "hidden" }}>
          <div style={{ width: `${(1 - burn) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${t.bad}, ${t.accent})` }} />
        </div>
        {!ended && <div style={{ position: "absolute", left: 110 + 1000 * (1 - burn) - 26, top: 818, width: 52, height: 52, borderRadius: 26, background: "radial-gradient(circle,#fff,#ffcf5c 40%,rgba(255,80,0,0) 70%)", transform: `scale(${1 + 0.3 * Math.sin(frame)})` }} />}
        {Array.from({ length: n }, (_, i) => (
          <Sfx key={i} name="impact" at={Math.round(i * step)} volume={0.32} />
        ))}
        <Sfx name="riser" at={Math.max(0, d.endAt - 40)} volume={0.18} />
        <Sfx name="ding" at={d.endAt} volume={0.45} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => {
    const n = Math.max(1, Math.round(d.from));
    return cam(f, dur, { punches: Array.from({ length: n }, (_, i) => ({ at: Math.round((i * d.endAt) / n), amt: 0.04 })).concat([{ at: d.endAt, amt: 0.1 }]) });
  },
});

// ============ T11 金钱收益：金币雨 + 收益数字 + 到账提示 ============
// “靠这个副业我一个月多赚了 3 万”
const s11 = z.object({
  amount: z.number().default(30000),
  prefix: z.string().default("¥"),
  line: z.string().default("一个月多赚的").describe("金额上面的小字"),
  notice: z.string().default("收款到账").describe("手机到账通知"),
  landAt: z.number().default(26).describe("金额定格（锚点）"),
});
export const T11Money = tpl<z.infer<typeof s11>>({
  id: "op-t11-money",
  name: "模板 · 金钱收益（金币雨 + 到账通知）",
  hook: "收益诱惑",
  desc: "首帧金币从天而降砸满画面边缘，右上角弹出手机到账通知，金额数字从 0 狂滚到定格、金光扫过，叮叮收钱声",
  use: "开头晒收益/结果：“一个月多赚 3 万”“这条视频带来 1000 单”“省下 5 万块”",
  techniques: ["首帧金币雨", "到账通知", "金额滚动", "金光扫过", "收钱音", "推镜头"],
  schema: s11,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const notice = easeOutBack(prog(frame, 4, 12));
    const sweep = prog(frame, d.landAt, 14);
    const coins = 26;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: d.landAt, amp: 14, len: 10 }]} exit="fade">
        <Scrim side="left" size={0.6} strength={0.7} />
        {Array.from({ length: coins }, (_, i) => {
          const x = rnd(i, seed) < 0.5 ? rnd(i + 3, seed) * 700 : 1300 + rnd(i + 5, seed) * 620;
          const sp = 18 + rnd(i + 7, seed) * 14;
          const y = -120 + ((frame + rnd(i + 9, seed) * 40) * sp) % 1300;
          const s = 60 + rnd(i + 11, seed) * 60;
          const spin = Math.abs(Math.cos(frame * 0.3 + i));
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#fff3b0,#ffcf3a 45%,#c98a00)", border: "4px solid #7a4d00", transform: `scaleX(${0.25 + 0.75 * spin})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: s * 0.55, color: "#7a4d00" }}>
              {spin > 0.5 ? "¥" : ""}
            </div>
          );
        })}
        <div style={{ position: "absolute", right: 90, top: 110, width: 560, padding: "22px 26px", borderRadius: 28, background: "rgba(250,250,252,.95)", boxShadow: "0 20px 50px rgba(0,0,0,.5)", display: "flex", gap: 20, alignItems: "center", transform: `translateY(${(1 - notice) * -200}px)`, opacity: clamp(notice * 2) }}>
          <div style={{ width: 84, height: 84, borderRadius: 20, background: "#1aad19", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="award" size={54} color="#fff" stroke={2.4} />
          </div>
          <div>
            <div style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: 30, color: "#222" }}>{d.notice}</div>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 44, color: "#1aad19" }}>
              +{d.prefix}
              {d.amount.toLocaleString("en-US")}
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 100, top: 250 }}>
          <div style={ink(84, t.text, t.font.title)}>{d.line}</div>
          <div style={{ position: "relative", display: "flex", alignItems: "baseline", marginTop: 10, overflow: "hidden", paddingRight: 30 }}>
            <span style={ink(140, t.gold, t.font.title)}>{d.prefix}</span>
            <Counter frame={frame} at={0} from={0} to={d.amount} len={Math.max(8, d.landAt)} size={180} color={t.gold} font={t.font.title} strokeW={14} />
            {sweep > 0 && sweep < 1 && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${sweep * 120 - 20}%`, width: 120, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)", transform: "skewX(-20deg)", mixBlendMode: "overlay" }} />}
          </div>
        </div>
        <Sfx name="pop" at={4} volume={0.35} />
        <Sfx name="sparkle" at={0} volume={0.3} />
        {[6, 12, 18].map((f) => (
          <Sfx key={f} name="tick" at={f} volume={0.2} />
        ))}
        <Sfx name="ding" at={d.landAt} volume={0.45} />
        <Sfx name="success" at={d.landAt + 4} volume={0.3} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: 0, amt: 0.06 }, { at: d.landAt, amt: 0.08 }] }),
});

// ============ T12 结果先行：定格 → 倒带 → “怎么做到的” ============
// 先抛结果：“这个网站是我 20 分钟做出来的”
const s12 = z.object({
  result: z.string().default("20 分钟做出来的").describe("结果大字"),
  hl: z.string().default("20 分钟"),
  rewind: z.string().default("怎么做到的？").describe("倒带后的问句"),
  freezeAt: z.number().default(24).describe("画面定格 + 倒带（锚点）"),
  askAt: z.number().default(50),
});
export const T12Rewind = tpl<z.infer<typeof s12>>({
  id: "op-t12-rewind",
  name: "模板 · 结果先行（定格 + VHS 倒带）",
  hook: "结果先行",
  desc: "首帧结果大字砸下，随后画面定格（快门声 + 白框），出现 VHS 倒带 ◀◀ 和扫描噪点、时间码倒着滚，最后问句“怎么做到的？”砸出",
  use: "开头先抛结果再倒叙：“这个网站是我 20 分钟做的”“我是怎么做到的？让我们倒回去”",
  techniques: ["首帧大字", "定格快门", "VHS 倒带", "时间码倒滚", "扫描噪点", "问句砸出"],
  schema: s12,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const fr = frame >= d.freezeAt;
    const rw = fr && frame < d.askAt;
    const tc = Math.max(0, 20 * 60 - (frame - d.freezeAt) * 37);
    const mm = String(Math.floor(tc / 60)).padStart(2, "0");
    const ss = String(tc % 60).padStart(2, "0");
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.askAt, amp: 14, len: 10 }]} exit="left">
        <Scrim side="left" size={0.62} strength={0.72} />
        <Flash frame={frame} at={0} len={8} peak={0.45} />
        <Flash frame={frame} at={d.freezeAt} len={5} peak={0.7} />
        <div style={{ position: "absolute", left: 96, top: 200, transform: rw ? `translateX(${Math.sin(frame * 3) * 6}px)` : undefined }}>
          <Slam frame={frame} at={0} text={d.result} size={140} color={t.text} font={t.font.title} from={1.35} len={6} blur={3} minOpacity={0.85} strokeW={11} style={{ transformOrigin: "left center" }} />
        </div>
        {fr && (
          <>
            <div style={{ position: "absolute", inset: 30, border: "6px solid #fff", borderRadius: 10, opacity: 0.85 }} />
            <div style={{ position: "absolute", left: 70, top: 70, display: "flex", alignItems: "center", gap: 20, ...ink(64, "#fff", t.font.mono, 6), opacity: Math.floor(frame / 6) % 2 ? 1 : 0.5 }}>
              {rw ? "◀◀ REWIND" : "▶ PLAY"}
            </div>
            <div style={{ position: "absolute", right: 70, top: 70, ...ink(60, "#fff", t.font.mono, 6) }}>{`00:${mm}:${ss}`}</div>
          </>
        )}
        {rw &&
          Array.from({ length: 6 }, (_, i) => {
            const y = ((frame * 47 + i * 191) % 1080) | 0;
            return <div key={i} style={{ position: "absolute", left: 0, right: 0, top: y, height: 6 + (i % 3) * 5, background: "rgba(255,255,255,.35)", mixBlendMode: "overlay" }} />;
          })}
        {frame >= d.askAt && (
          <div style={{ position: "absolute", left: 96, top: 520 }}>
            <Slam frame={frame} at={d.askAt} text={d.rewind} size={150} color={t.accent} font={t.font.title} from={1.9} len={7} strokeW={12} style={{ transformOrigin: "left center" }} />
          </div>
        )}
        <Sfx name="impact" at={0} volume={0.45} />
        <Sfx name="click" at={d.freezeAt} volume={0.5} />
        <Sfx name="glitch" at={d.freezeAt + 2} volume={0.35} />
        <Sfx name="riser" at={d.freezeAt + 2} volume={0.16} />
        <Sfx name="impact" at={d.askAt} volume={0.45} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => {
    const base = cam(f, dur, { punches: [{ at: 0, amt: 0.08 }, { at: d.askAt, amt: 0.08 }], desatAt: d.freezeAt, desatUntil: d.askAt, desat: 0.8 });
    const rw = f >= d.freezeAt && f < d.askAt;
    return { ...base, x: (base.x ?? 0) + (rw ? Math.sin(f * 2.3) * 8 : 0), filter: [base.filter, rw ? "sepia(0.35) hue-rotate(-10deg)" : ""].filter(Boolean).join(" ") || undefined };
  },
});
