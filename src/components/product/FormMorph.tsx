import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeOut, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { makeTrack, press as pressPulse, snapBeat } from "../../lib/spring";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading, textEm } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 出处：opus-5-5-motion-gallery/v07-ui-morph / @zero（twoclipping），X 经 YouMind 收录 2026-09-24 https://youmind.com/video-prompts/ui-morphing-motion-template-11361
// 片库整理：小红书 AI伐木工（jinhanbuilds/opus-5-5-motion-gallery）；逐条机制对照见 docs/OPUS55_ANIMATIONS.md 一·c。
// 移植自 opus-5-5-motion-gallery/v07-ui-morph。它最反常规的一点是：**全片一个形状，一次镜头都不切**，
// 从按钮一路变成加载环 → 灵动岛 → 播放器 → 滑块 → 开关 → 图表 → 命令条 → 提示条。
// 三条让它「看起来高级」的机制照搬过来了：
//   1) 每个参数各走一条闭式弹簧（几何 w=17/ζ=0.78 有轻微过冲；**颜色 ζ=1 临界阻尼**，
//      不过冲就不会闪过脏中间色；镜头比几何早 0.04s，观感上是「镜头去接它」而不是「形状被推大」）；
//   2) **zoom 反比补偿尺寸**：形状单位宽 168 还是 340，屏幕上始终约 550px —— 变形时主体大小不变，
//      观众的注意力不会被尺寸变化抢走，注意力留在「它变成了什么」上；
//   3) 内容层用交叠窗口淡入淡出，且**淡入淡出时带失焦**（blur 随 alpha 反比），一镜到底才不穿帮。

const KINDS = ["button", "ring", "check", "island", "player", "bar", "toggle", "tabs", "chart", "cmd", "list", "toast"] as const;
type Kind = (typeof KINDS)[number];

const DEFAULTS: Record<Kind, { w: number; h: number; r: number; tone: "ink" | "accent" | "soft" }> = {
  button: { w: 168, h: 56, r: 28, tone: "ink" },
  ring: { w: 56, h: 56, r: 28, tone: "soft" },
  check: { w: 64, h: 64, r: 32, tone: "accent" },
  island: { w: 212, h: 60, r: 30, tone: "ink" },
  player: { w: 360, h: 176, r: 24, tone: "soft" },
  bar: { w: 320, h: 48, r: 24, tone: "soft" },
  toggle: { w: 96, h: 56, r: 28, tone: "ink" },
  tabs: { w: 338, h: 56, r: 16, tone: "soft" },
  chart: { w: 338, h: 300, r: 20, tone: "soft" },
  cmd: { w: 340, h: 52, r: 16, tone: "ink" },
  list: { w: 340, h: 220, r: 20, tone: "ink" },
  toast: { w: 236, h: 48, r: 24, tone: "accent" },
};

const state = z.object({
  kind: z.enum(KINDS).describe("这个形态长什么样：button 按钮 / ring 转圈 / check 打勾 / island 灵动岛 / player 播放器 / bar 进度条 / toggle 开关 / tabs 标签 / chart 图表 / cmd 命令条 / list 列表 / toast 提示条"),
  label: z.string().max(14).optional().describe("写在形体里的字（≤14 字，它是形状的一部分，不是说明）"),
  note: z.string().max(22).optional().describe("形体下方的小字说明，讲「这一步在干什么」"),
  at: z.number().optional().describe("变成这个形态的时刻（台词锚点）；缺省 = 按节拍网格往后排"),
  w: z.number().min(40).max(400).optional().describe("宽度（UI 单位，不写用该形态的默认值）"),
  h: z.number().min(40).max(320).optional(),
  r: z.number().min(0).max(200).optional().describe("圆角（UI 单位，不写用默认；方形就写 0）"),
  tone: z.enum(["ink", "accent", "soft"]).optional().describe("底色：ink 墨底亮字 / accent 强调色 / soft 浅底墨字"),
});
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  states: z.array(state).min(3).max(8).describe("3~8 个形态，按顺序一镜到底变过去"),
  bpm: z.number().min(60).max(150).optional().describe("节拍（默认 120）。没写 at 时形态就吸附到拍点上"),
  verdict: z.string().optional().describe("收束大字（形体退场后出现）"),
});
type D = z.infer<typeof schema>;

// 交叠淡入淡出窗口（v07 的 env：0.2s 进 / 0.12s 出，窗口刻意互相压住）
const env = (s: number, a: number, b: number) => Math.min(easeOut(prog(s, a, a + 0.2)), 1 - prog(s, b - 0.12, b));

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const bpm = data.bpm ?? 120;
  const n = data.states.length;

  // 形态时刻：显式锚点优先，没写就吸附到拍点（保留 v07「一切落在拍上」的骨架）
  const D_total = Math.max(3, dur / fps);
  const gap = (D_total * 0.72) / Math.max(1, n);
  const times = data.states.map((st, i) => (typeof st.at === "number" ? st.at / fps : snapBeat(Math.min(D_total * 0.86, 0.6 + i * gap), bpm)));
  const s = frame / fps;

  // 单位尺寸 → 像素：zoom 与尺寸互为反比，所以屏幕宽度恒定（这就是「变形时不抢注意力」的数学）
  const maxH = Math.max(...data.states.map((st) => st.h ?? DEFAULTS[st.kind].h));
  const capW = Math.min(width * (full ? 0.56 : 0.92), full ? 980 : 460);
  const capH = full ? height - 250 - 190 : height * 0.62;
  const PX = Math.min(capW / 300, capH / (maxH * 1.02));
  const cx = full ? Math.round(width * 0.66) : Math.round(width / 2);
  const cy = full ? 250 + capH / 2 : Math.round(height * 0.44);

  // 三条独立弹簧：几何（略过冲）、颜色（临界阻尼）、镜头（临界阻尼且尺寸反比补偿）
  const first = data.states[0];
  const col = (k: "w" | "h" | "r" | "zoom") =>
    makeTrack(
      k === "zoom" ? 300 / (first.w ?? DEFAULTS[first.kind].w) : (first[k] ?? DEFAULTS[first.kind][k]),
      data.states.map((st, i) => ({ t: times[i], v: k === "zoom" ? 300 / (st.w ?? DEFAULTS[st.kind].w) : (st[k] ?? DEFAULTS[st.kind][k]), w: k === "zoom" ? 9 : 17, z: k === "zoom" ? 1 : 0.78 })),
    );
  const W = col("w");
  const H = col("h");
  const R = col("r");
  const Z = col("zoom");
  const toneOf = (st?: z.infer<typeof state>) => (st?.tone ?? DEFAULTS[st?.kind ?? "button"].tone) as "ink" | "accent" | "soft";
  const toneHex = (k: "ink" | "accent" | "soft") => (k === "ink" ? t.bg2 : k === "accent" ? t.accent : alpha(t.text, 1));
  // 颜色不能走带过冲的弹簧：用临界阻尼的独立轨道（0→1）在两色间插值
  const CT = makeTrack(0, data.states.map((st, i) => ({ t: times[i], v: i, w: 30, z: 1 })));
  const cIdx = CT(s);
  const cLo = Math.max(0, Math.min(n - 1, Math.floor(cIdx)));
  const cHi = Math.max(0, Math.min(n - 1, Math.ceil(cIdx)));
  const cK = clamp(cIdx - cLo);
  const boxBg = cLo === cHi ? toneHex(toneOf(data.states[cLo])) : blend(toneHex(toneOf(data.states[cLo])), toneHex(toneOf(data.states[cHi])), cK);
  const inkOn = cK < 0.5 ? toneOf(data.states[cLo]) : toneOf(data.states[cHi]);
  const fg = inkOn === "accent" || inkOn === "ink" ? t.text : t.bg2;

  const pz = 1 - data.states.reduce((a, st, i) => a + pressPulse(s, times[i] - 0.04, 0.05), 0);
  const wPx = W(s) * PX * Z(s) * pz;
  const hPx = H(s) * PX * Z(s) * pz;

  const eVerdict = enterAt(frame, Math.max(...times) * fps + 20, { fallback: "slam", dur: 16 });
  const beatN = Math.floor(s / (60 / bpm));
  const beatTotal = Math.max(4, Math.round((D_total * 0.9) / (60 / bpm)));

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}

      {/* 节拍 HUD：一排点，当前拍变大 —— 提醒观众这一切都在拍上 */}
      {full && (
        <div style={{ position: "absolute", left: 96, bottom: 200, display: "flex", gap: 16, alignItems: "center" }}>
          {Array.from({ length: Math.min(beatTotal, 28) }, (_, i) => (
            <span key={i} style={{ width: i === beatN ? 12 : 7, height: i === beatN ? 12 : 7, borderRadius: "50%", background: i === beatN ? t.accent : alpha(t.dim, 0.55) }} />
          ))}
          <span style={{ fontFamily: t.font.mono, fontSize: 22, color: t.dim, marginLeft: 10 }}>{bpm} BPM</span>
        </div>
      )}

      {/* 那个一路变形的形体 */}
      <div
        style={{
          position: "absolute",
          left: cx - wPx / 2,
          top: cy - hPx / 2,
          width: wPx,
          height: hPx,
          borderRadius: R(s) * PX,
          background: boxBg,
          boxShadow: `0 ${8}px ${26}px ${alpha(t.bg, 0.55)}, 0 0 ${30}px ${alpha(t.primary, 0.14)}`,
          overflow: "hidden",
          color: fg,
        }}
      >
        {data.states.map((st, i) => {
          const e = env(s, times[i] - (i === 0 ? 2 : 0.1), times[i] + gap * 0.98 + 0.1);
          if (e <= 0.01) return null;
          // 内容层按**这个形态自己的**镜头比例画（不是当前正在变形的比例）。
          // 用实时比例会出事故：形状变成小圆环时 zoom=5.4，上一态那几个字会被放大到 300px 糊满屏。
          const def = DEFAULTS[st.kind];
          const uw = st.w ?? def.w;
          const uh = st.h ?? def.h;
          const zi = 300 / uw;
          return (
            <div key={i} style={{ position: "absolute", left: "50%", top: "50%", width: uw * PX * zi, height: uh * PX * zi, transform: "translate(-50%,-50%)", opacity: e, filter: e > 0.3 ? `blur(${(1 - e) * 7}px)` : undefined }}>
              <Inner kind={st.kind} label={st.label} s={s} frame={frame} fps={fps} w={uw * PX * zi} h={uh * PX * zi} unit={PX * zi} fg={fg} tone={toneOf(st)} primary={t.primary} accent={t.accent} dim={t.dim} font={t.font} />
            </div>
          );
        })}
      </div>

      {/* 每个形态下方的小字说明：同一时刻只显示当前那一态，否则交叠窗口会把两句话叠成一团 */}
      {(() => {
        const wins = data.states.map((_, i) => env(s, times[i], times[i] + gap * 0.98));
        const cur = wins.indexOf(Math.max(...wins));
        const st = data.states[cur];
        const e = wins[cur];
        if (!st?.note || e <= 0.05 || s > Math.max(...times) + 0.05) return null;
        return (
          <div style={{ position: "absolute", left: 0, right: 0, top: Math.min(cy + hPx / 2 + 26, height - (full ? 230 : 130)), textAlign: "center", opacity: e }}>
            <span style={{ fontFamily: t.font.mono, fontSize: full ? 26 : 16, color: alpha(t.accent, 0.9), letterSpacing: 1, padding: "6px 16px", borderRadius: 999, border: `1.5px solid ${alpha(t.accent, 0.4)}`, whiteSpace: "nowrap" }}>{st.note}</span>
          </div>
        );
      })()}

      {data.verdict && (
        <div style={{ position: "absolute", left: 0, right: 0, top: full ? height * 0.72 : height - 120, textAlign: "center", opacity: eVerdict.opacity, transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`, clipPath: eVerdict.clip }}>
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, width * 0.7, full ? 74 : 30, 16), color: t.accent, textShadow: `0 0 28px ${alpha(t.accent, 0.45)}` }}>{data.verdict}</span>
        </div>
      )}

      {times.map((tm, i) => (
        <Sfx key={i} name={i === 0 ? "click" : "tick"} at={tm * fps} volume={0.22} />
      ))}
    </>
  );
};

// 两色插值（主题色都是 #rrggbb / rgba()，rgba 走 alpha() 那条路时退化成硬切）
const blend = (a: string, b: string, k: number) => {
  const p = (s: string) => (s.startsWith("#") ? s.replace("#", "").match(/.{2}/g)!.map((x) => parseInt(x, 16)) : null);
  const [x, y] = [p(a), p(b)];
  if (!x || !y) return k < 0.5 ? a : b;
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`;
};

// 内部画法：每个 kind 一个分支，画在「形状局部坐标」里（宽高 = 传进来的像素值）
const Inner: React.FC<{
  kind: Kind;
  label?: string;
  s: number;
  frame: number;
  fps: number;
  w: number;
  h: number;
  unit: number;
  fg: string;
  tone: string;
  primary: string;
  accent: string;
  dim: string;
  font: { title: string; body: string; mono: string };
}> = ({ kind, label, s, w, h, unit, fg, tone, primary, accent, dim, font }) => {
  const U = unit; // 1 个 UI 单位 = 多少像素（随 zoom 变，保证内部元素跟着形状一起缩放）
  // label 是「写在形状里的字」：字号随形状放大，但必须按可用宽度封顶，否则 14 字会撑破形状
  const lf = (base: number, avail: number, txt?: string) => Math.min(base * U, Math.max(9, avail / Math.max(0.6, textEm(txt ?? label ?? ""))));
  const cell = (children: React.ReactNode, pad = 20) => (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: pad * U, padding: `0 ${pad * U}px` }}>{children}</div>
  );
  const text = (size = 26, weight = 700, mono = false) => (
    <span style={{ fontFamily: mono ? font.mono : font.title, fontWeight: weight, fontSize: lf(size, w - 44 * U), color: fg, whiteSpace: "nowrap", letterSpacing: -0.4 * U }}>{label}</span>
  );
  const k = (a: number, b: number) => clamp((s - a) / Math.max(0.001, b - a));

  switch (kind) {
    case "button":
      return cell(<span style={{ fontFamily: font.title, fontWeight: 800, fontSize: lf(26, w - 44 * U), color: fg, letterSpacing: -0.5 * U, margin: "0 auto" }}>{label}</span>);
    case "ring": {
      const r = Math.min(w, h) / 2 - 8 * U;
      const p = k(0, 0.9);
      return (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          <circle cx={w / 2} cy={h / 2} r={r} fill="none" stroke={alpha(fg, 0.2)} strokeWidth={6 * U} />
          <circle cx={w / 2} cy={h / 2} r={r} fill="none" stroke={primary} strokeWidth={6 * U} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * r}`} strokeDashoffset={-2 * Math.PI * r * (0.25 + p * 0.75)} transform={`rotate(-90 ${w / 2} ${h / 2})`} />
        </svg>
      );
    }
    case "check": {
      const p = easeOut(k(0, 0.34)) * (w * 0.42 + h * 0.5);
      const x = w / 2, y = h / 2, sc = Math.min(w, h) / 60;
      return (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          <polyline points={`${x - 12 * sc},${y + 1 * sc} ${x - 3 * sc},${y + 10 * sc} ${x + 14 * sc},${y - 11 * sc}`} fill="none" stroke={fg} strokeWidth={6 * sc} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${p} 999`} />
        </svg>
      );
    }
    case "island":
      return cell(
        <>
          {[0.3, 0.62, 0.44, 0.8, 0.5].map((a, i) => (
            <span key={i} style={{ width: 7 * U, height: (0.24 + 0.76 * (0.5 + 0.5 * Math.sin(s * (6 + i * 2) + i))) * h * 0.62, borderRadius: 4 * U, background: i % 2 ? accent : fg, opacity: 0.9 }} />
          ))}
          <span style={{ fontFamily: font.mono, fontSize: lf(18, w - 120 * U, label ?? "正在听"), color: alpha(fg, 0.75) }}>{label ?? "正在听"}</span>
        </>,
        14,
      );
    case "player": {
      const pr = 0.2 + 0.62 * clamp((s % 6) / 6);
      return cell(
        <>
          <span style={{ width: 92 * U, height: 92 * U, borderRadius: 16 * U, background: `linear-gradient(135deg, ${alpha(primary, 0.85)}, ${alpha(accent, 0.6)})`, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font.title, fontWeight: 800, fontSize: lf(24, w - 160 * U, label ?? "正在播放"), color: fg, whiteSpace: "nowrap", overflow: "hidden" }}>{label ?? "正在播放"}</div>
            <div style={{ marginTop: 12 * U, height: 6 * U, borderRadius: 4, background: alpha(fg, 0.22) }}>
              <div style={{ width: `${pr * 100}%`, height: "100%", borderRadius: 4, background: accent }} />
            </div>
            <div style={{ marginTop: 8 * U, fontFamily: font.mono, fontSize: 16 * U, color: alpha(fg, 0.7) }}>0:{String(Math.floor(pr * 59)).padStart(2, "0")}</div>
          </div>
        </>,
        22,
      );
    }
    case "bar": {
      const v = 0.32 + 0.5 * clamp((s % 5) / 5);
      return cell(
        <div style={{ position: "relative", flex: 1, height: 8 * U, borderRadius: 6, background: alpha(fg, 0.22) }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v * 100}%`, borderRadius: 6, background: accent }} />
          <div style={{ position: "absolute", left: `calc(${v * 100}% - ${13 * U}px)`, top: -13 * U, width: 26 * U, height: 26 * U, borderRadius: "50%", background: fg, boxShadow: `0 3px 10px ${alpha(fg, 0.4)}` }} />
        </div>,
        26,
      );
    }
    case "toggle": {
      const on = clamp((s % 3.2) / 1.6);
      return cell(
        <div style={{ position: "relative", width: w - 26 * U, height: h - 22 * U, borderRadius: 999, background: alpha(fg, 0.2), marginLeft: 13 * U }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${on * 100}%`, borderRadius: 999, background: accent, opacity: on > 0.02 ? 1 : 0 }} />
          <div style={{ position: "absolute", top: 3 * U, left: `${on * (w - 26 * U - 26 * U)}px`, width: 26 * U, height: 26 * U, borderRadius: "50%", background: on > 0.5 ? fg : alpha(fg, 0.85), boxShadow: `0 2px 8px ${alpha(fg, 0.35)}` }} />
        </div>,
        0,
      );
    }
    case "tabs":
      return cell(
        <>
          {(label ? label.split(/[、,\/]/) : ["日", "周", "年"]).slice(0, 3).map((tab, i) => {
            const on = Math.floor((s % 4) / 1.4) === i;
            return (
              <span key={i} style={{ flex: 1, textAlign: "center", padding: `${10 * U}px 0`, borderRadius: 12 * U, background: on ? accent : "transparent", fontFamily: font.title, fontWeight: 800, fontSize: 24 * U, color: on ? fg : alpha(fg, 0.6) }}>
                {tab}
              </span>
            );
          })}
        </>,
        12,
      );
    case "chart": {
      const dr = easeOut(k(0, 0.75));
      const pts = Array.from({ length: 24 }, (_, i) => {
        const x = (i / 23) * (w - 60 * U) + 30 * U;
        const y = h - 60 * U - (0.18 + 0.62 * (0.5 + 0.5 * Math.sin(i * 0.55)) * (i / 23 + 0.35)) * (h - 130 * U);
        return `${x},${y}`;
      });
      const cut = Math.max(0, pts.length - 1) * dr;
      const shown = pts.slice(0, Math.floor(cut) + 1);
      const num = Math.round(8214 * dr).toLocaleString("en-US");
      return (
        <>
          <div style={{ position: "absolute", left: 30 * U, top: 22 * U, fontFamily: font.mono, fontSize: 44 * U, fontWeight: 700, color: fg }}>{num}</div>
          <div style={{ position: "absolute", left: 30 * U, top: 74 * U, fontFamily: font.body, fontSize: 18 * U, color: dim }}>{label ?? "近 30 天"}</div>
          <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
            <polyline points={shown.join(" ")} fill="none" stroke={accent} strokeWidth={5 * U} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>
      );
    }
    case "cmd":
      return cell(
        <>
          <span style={{ fontFamily: font.mono, fontSize: 22 * U, color: alpha(fg, 0.8), border: `1.5px solid ${alpha(fg, 0.4)}`, borderRadius: 8 * U, padding: `${2 * U}px ${8 * U}px` }}>⌘K</span>
          <span style={{ fontFamily: font.body, fontSize: lf(24, w - 128 * U, label ?? "输入命令"), color: fg }}>{label ?? "输入命令"}</span>
          <span style={{ width: 2 * U, height: 26 * U, background: accent, opacity: Math.floor(s * 4) % 2 === 0 ? 1 : 0 }} />
        </>,
        18,
      );
    case "list":
      return (
        <div style={{ position: "absolute", inset: 0, padding: `${18 * U}px ${24 * U}px` }}>
          {(label ? label.split(/[、,\/]/).slice(0, 4) : ["新建项目", "分享链接", "导出成片", "打开设置"]).map((row, i) => {
            const on = clamp(1 - Math.abs(Math.floor((s % 4) / 1) - i) * 0.6);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 * U, height: (h - 36 * U) / 4 - 6 * U, padding: `0 ${14 * U}px`, borderRadius: 10 * U, background: on > 0.9 ? accent : "transparent", fontFamily: font.body, fontSize: 22 * U, color: on > 0.9 ? fg : alpha(fg, 0.75) }}>
                <span style={{ width: 8 * U, height: 8 * U, borderRadius: "50%", background: on > 0.9 ? fg : dim }} />
                {row}
              </div>
            );
          })}
        </div>
      );
    case "toast":
      return cell(
        <>
          <span style={{ width: 30 * U, height: 30 * U, borderRadius: "50%", background: tone === "accent" ? fg : accent, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontFamily: font.body, fontWeight: 700, fontSize: lf(22, w - 104 * U, label ?? "已复制分享链接"), color: fg }}>{label ?? "已复制分享链接"}</span>
        </>,
        22,
      );
    default:
      return cell(text());
  }
};

export const FormMorph: CompDef<D> = {
  id: "form-morph",
  name: "一形到底（同一个形状连续变身）",
  layer: "product",
  variants: 1,
  minSec: 5,
  maxSec: 14,
  tags: ["形态", "变身", "一镜到底", "界面", "操作流程", "演化", "从…变成…"],
  motion: { kind: "单一圆角形体一镜到底连续变形（弹簧轨道驱动宽高/圆角/颜色/镜头），内部内容交叠淡入带失焦", energy: 3 },
  desc: "画面中央只有一个圆角形体，它按台词一镜到底地变成 3~8 种界面形态（按钮→转圈→打勾→录音岛→播放器→进度条→开关→标签→图表→命令条→列表→提示条）：宽/高/圆角各走一条带轻微过冲的弹簧，颜色走临界阻尼（不闪脏中间色），镜头比形状早 0.04 秒迎上去；因为 zoom 与尺寸互为反比，**变形全程屏幕上的大小基本不变**，观众只看到「它变成了什么」。左下有一排节拍点在跟拍",
  use: "讲一个东西在不同阶段换面孔，或把一段操作流程压缩成一句话：一个问题框怎么变成搜索、变成筛选、变成设置；同一个提示词从输入框变成按钮变成报表；工具从「能聊天」长成「能干活」。也适合当「产品进化」的收尾镜头。**它是纯代码假界面**：讲的是概念就用它，一旦要说「我实际就是这么点的」必须换 screen-morph（真截图）",
  panel: true,
  schema,
  example: {
    kicker: "同一个东西",
    title: "一路换了六张面孔",
    states: [
      { kind: "button", label: "开始", note: "先是一个按钮" },
      { kind: "ring", note: "点了就转圈" },
      { kind: "island", label: "正在听", note: "变成一句话的入口" },
      { kind: "bar", note: "变成进度" },
      { kind: "toggle", note: "变成一个开关" },
      { kind: "chart", label: "近 30 天", note: "最后变成一张报表" },
    ],
    verdict: "它早就不是一个按钮了",
  },
  C,
};
