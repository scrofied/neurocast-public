import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, noise1, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Figure, figJoints, gait, mixPose, POSES, type Pose } from "../../lib/figure";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  role: z.string().describe("人设/职业，如“外贸新人”“高三班主任”“夜班护士”"),
  roleNote: z.string().optional().describe("人设下面的小字处境，如“入行第 3 个月”"),
  roleAt: z.number().optional().describe("人设标签弹出（锚点，一般卡职业名）"),
  mode: z.enum(["desk", "screen", "shuttle"]).default("desk").describe("desk = 伏案处理一沓材料；screen = 盯着屏幕反复刷新；shuttle = 在两个地方之间来回跑"),
  prop: z.object({ label: z.string(), icon: z.string().optional() }).default({ label: "报价单" }).describe("折磨他的那件东西（desk：一张张材料；screen：屏幕上的内容）"),
  screenText: z.string().optional().describe("screen 模式屏幕上的大字，如“0 封新邮件”"),
  stations: z.array(z.string()).length(2).default(["后厨", "前台"]).describe("shuttle 模式两头的地方"),
  clock: z.object({ from: z.string().default("18:00"), to: z.string().default("23:40") }).default({ from: "18:00", to: "23:40" }).describe("墙上时钟从几点转到几点（HH:MM）"),
  clockAt: z.number().optional().describe("时钟开始快转的时刻（锚点，卡“晚上十点”这类时间词）"),
  counter: z.object({ prefix: z.string().default("第"), from: z.number().default(1), to: z.number().default(37), unit: z.string().default("份") }).optional().describe("角落计数器：每干完一轮跳一次，如 第 1 → 37 份"),
  loops: z.number().int().min(2).max(6).default(4).describe("同一动作循环几遍（一遍比一遍快）"),
  endPose: z.enum(["none", "slump", "despair"]).default("slump").describe("最后的姿势：瘫倒 / 抱头 / 不变"),
  endAt: z.number().optional().describe("瘫倒/抱头的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

const minutes = (s: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? (+m[1] % 24) * 60 + +m[2] : 18 * 60;
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const roleAt = cueOr(data.roleAt, 10);
  const loopStart = Math.max(8, Math.min(roleAt + 6, dur * 0.2));
  const endAt = data.endPose === "none" ? dur + 99 : cueOr(data.endAt, dur * 0.78);
  const loopEnd = Math.min(endAt, dur - 6);
  // geometric loop lengths: each pass is ~28% faster than the last
  const n = data.loops;
  const ratio = 0.72;
  const total = Array.from({ length: n }, (_, i) => Math.pow(ratio, i)).reduce((a, b) => a + b, 0);
  const unit = Math.max(6, (loopEnd - loopStart) / total);
  const starts: number[] = [];
  let acc = loopStart;
  for (let i = 0; i < n; i++) {
    starts.push(acc);
    acc += unit * Math.pow(ratio, i);
  }
  const loopIdx = starts.reduce((k, s, i) => (frame >= s ? i : k), -1);
  const inLoop = loopIdx >= 0 && frame < acc;
  const lp = inLoop ? clamp((frame - starts[loopIdx]) / (unit * Math.pow(ratio, loopIdx))) : loopIdx >= n - 1 && frame >= acc ? 1 : 0;
  const doneLoops = starts.filter((s, i) => frame >= s + unit * Math.pow(ratio, i)).length;

  // clock
  const clockAt = cueOr(data.clockAt, loopStart);
  const m0 = minutes(data.clock.from);
  let m1 = minutes(data.clock.to);
  if (m1 <= m0) m1 += 24 * 60;
  const clockK = easeInOut(prog(frame, clockAt, Math.max(20, loopEnd - clockAt)));
  const now = lerp(m0, m1, clockK);
  const hh = Math.floor(now / 60) % 24;
  const mm = Math.floor(now % 60);
  const dark = clamp(0.5 - 0.5 * Math.cos(((((now / 60) % 24) - 12) / 12) * Math.PI));
  const tired = clamp(doneLoops / n) * 0.6 + (frame >= endAt ? 0.3 : 0);

  const G = H * 0.8; // floor
  const h = Math.min(H * 0.44, W * 0.25);
  const mode = data.mode;
  const fx = mode === "shuttle" ? 0 : W * 0.36;
  const deskX0 = fx + h * 0.2;
  const deskX1 = fx + h * 1.02;
  const deskY = G - h * 0.44;

  // ── pose ──
  let pose: Pose = mode === "screen" ? POSES.stare : POSES.work;
  let px = fx;
  let face: 1 | -1 = 1;
  let sheet: { x: number; y: number; r: number; o: number } | null = null;
  const inX = deskX1 - h * 0.14;
  const doneX = fx + h * 0.62;
  if (mode === "desk" && inLoop) {
    const reach = easeInOut(prog(lp, 0, 0.22));
    const back = easeInOut(prog(lp, 0.22, 0.12));
    const toss = easeInOut(prog(lp, 0.78, 0.14));
    const writing = lp > 0.34 && lp < 0.78;
    const scrib = writing ? Math.sin(frame * (1.6 + loopIdx * 0.5)) * 7 : 0;
    pose = { ...POSES.work, rs: lerp(62, 86, reach - back) + toss * 18, re: lerp(30, 4, reach - back) - toss * 10 + scrib, lean: 12 + (reach - back) * 10 };
    // the sheet travels: in-pile → under the hand → done pile
    const hand = figJoints(pose, h).rHand;
    const hx = fx + hand.x;
    if (lp < 0.34) {
      const k = easeInOut(prog(lp, 0.12, 0.22));
      sheet = { x: lerp(inX, hx, k), y: deskY - 6 - Math.sin(k * Math.PI) * h * 0.08, r: lerp(-4, 2, k), o: 1 };
    } else if (lp < 0.78) sheet = { x: hx - 10, y: deskY - 6, r: 2, o: 1 };
    else {
      const k = easeInOut(prog(lp, 0.8, 0.2));
      sheet = { x: lerp(hx - 10, doneX, k), y: deskY - 6 - Math.sin(k * Math.PI) * h * 0.12, r: lerp(2, -8, k), o: 1 };
    }
  } else if (mode === "screen" && inLoop) {
    // lean in toward the screen, then sag back on "still nothing"
    const inK = Math.sin(lp * Math.PI);
    pose = { ...POSES.stare, lean: 26 + inK * 10, head: 18 + inK * 6 };
  } else if (mode === "shuttle") {
    const aX = W * 0.2;
    const bX = W * 0.8;
    const run = clamp(0.4 + loopIdx * 0.2, 0, 1);
    if (inLoop) {
      const k = easeInOut(lp);
      const fwd = loopIdx % 2 === 0;
      px = fwd ? lerp(aX, bX, k) : lerp(bX, aX, k);
      face = fwd ? 1 : -1;
      pose = gait(frame / lerp(16, 8, run), run);
    } else {
      const atB = doneLoops % 2 === 1;
      px = frame < loopStart ? aX : atB ? bX : aX;
      face = atB ? -1 : 1;
      pose = POSES.stand;
    }
  }
  // collapse at the end
  if (data.endPose !== "none" && frame >= endAt - 8) {
    const k = easeOutBack(prog(frame, endAt - 4, 14));
    const target = data.endPose === "slump" ? (mode === "shuttle" ? { ...POSES.slump, drop: 0.36, lean: -8, head: 40 } : POSES.slump) : POSES.despair;
    pose = mixPose(pose, target, clamp(k));
  }

  // ── counter ──
  const cnt = data.counter;
  const cntVal = cnt ? Math.round(lerp(cnt.from, cnt.to, doneLoops / n)) : 0;
  const cntBump = cnt ? Math.max(0, ...starts.map((s, i) => { const e = s + unit * Math.pow(ratio, i); return frame >= e ? 1 - clamp((frame - e) / 8) : 0; })) : 0;

  // 人设标签原生是头顶原位回弹弹出（0→过冲→1，无位移）
  const eRole = enterAt(frame, roleAt, { fallback: "rise", dur: 14, from: 0, dist: 0 });
  const head = figJoints(pose, h).head;
  const tagX = px + head.x * face;
  const tagY = G + head.y - h * 0.2;
  const shake = frame >= endAt && frame < endAt + 10 ? noise1(frame * 2.3, seed) * 8 * (1 - (frame - endAt) / 10) : 0;
  const winX = W * 0.07;
  const winY = H * 0.2;
  const winW = W * 0.17;
  const winH = H * 0.34;
  const sky = `linear-gradient(180deg, #050818, ${alpha(t.secondary, 0.4)})`;
  const daySky = "linear-gradient(180deg, #6fb6ff, #ffcf8a)";
  const moonY = lerp(winY + winH * 0.9, winY + winH * 0.28, dark);
  const clkX = W * 0.84;
  const clkY = H * 0.36;
  const clkR = Math.min(118, H * 0.11);
  const hA = ((now / 60) % 12) * 30;
  const mA = (now % 60) * 6;
  const lampOn = dark > 0.45;
  const pile = (x: number, count: number, key: string, col: string) =>
    Array.from({ length: count }, (_, i) => (
      <rect key={`${key}${i}`} x={x - h * 0.13 + noise1(i * 3.1, seed) * 5} y={deskY - 8 - i * 7} width={h * 0.26} height={8} rx={2} fill={i % 2 ? alpha(col, 0.9) : alpha(col, 0.7)} stroke={alpha("#000", 0.3)} strokeWidth={1} />
    ));
  const inCount = 14 + ((frame / 6) | 0) % 2; // a pile that never goes down
  const doneCount = Math.min(12, doneLoops * 2 + 2);

  return (
    <>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${shake}px)` }}>
        {/* window with the sky turning to night */}
        {mode !== "shuttle" && (
          <div style={{ position: "absolute", left: winX, top: winY, width: winW, height: winH, borderRadius: 10, overflow: "hidden", border: `6px solid ${alpha(t.primary, 0.35)}`, background: sky, boxShadow: `0 0 40px ${alpha(t.primary, 0.12)}` }}>
            <div style={{ position: "absolute", inset: 0, background: daySky, opacity: 1 - dark }} />
            <div style={{ position: "absolute", left: winW * 0.62, top: moonY - winY, width: 54, height: 54, borderRadius: "50%", background: dark > 0.5 ? "#f4f1d8" : "#fff3b0", boxShadow: `0 0 30px ${dark > 0.5 ? "#f4f1d8" : "#ffd36b"}` }} />
            {dark > 0.55 && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ position: "absolute", left: `${(i * 37) % 90 + 5}%`, top: `${(i * 23) % 50 + 6}%`, width: 3, height: 3, borderRadius: 2, background: "#fff", opacity: (dark - 0.55) * 2 * (0.5 + 0.5 * Math.sin(frame / 6 + i)) }} />)}
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 6, background: alpha(t.primary, 0.35) }} />
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 6, background: alpha(t.primary, 0.35) }} />
          </div>
        )}
        {/* wall clock */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <circle cx={clkX} cy={clkY} r={clkR} fill={alpha(t.bg2, 0.9)} stroke={dark > 0.6 ? t.bad : t.primary} strokeWidth={6} style={{ filter: `drop-shadow(0 0 14px ${alpha(dark > 0.6 ? t.bad : t.primary, 0.6)})` }} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return <line key={i} x1={clkX + Math.sin(a) * clkR * 0.8} y1={clkY - Math.cos(a) * clkR * 0.8} x2={clkX + Math.sin(a) * clkR * 0.92} y2={clkY - Math.cos(a) * clkR * 0.92} stroke={t.dim} strokeWidth={i % 3 ? 3 : 6} />;
          })}
          <line x1={clkX} y1={clkY} x2={clkX + Math.sin((hA * Math.PI) / 180) * clkR * 0.5} y2={clkY - Math.cos((hA * Math.PI) / 180) * clkR * 0.5} stroke={t.text} strokeWidth={9} strokeLinecap="round" />
          <line x1={clkX} y1={clkY} x2={clkX + Math.sin((mA * Math.PI) / 180) * clkR * 0.76} y2={clkY - Math.cos((mA * Math.PI) / 180) * clkR * 0.76} stroke={t.accent} strokeWidth={5} strokeLinecap="round" />
          <circle cx={clkX} cy={clkY} r={9} fill={t.accent} />
        </svg>
        <div style={{ position: "absolute", left: clkX - 160, width: 320, top: clkY + clkR + 16, textAlign: "center", fontFamily: t.font.mono, fontWeight: 700, fontSize: 52, color: dark > 0.6 ? t.bad : t.text, letterSpacing: 4, textShadow: `0 0 18px ${alpha(dark > 0.6 ? t.bad : t.primary, 0.6)}` }}>
          {String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}
        </div>

        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="psLamp" cx="0.5" cy="0" r="1">
              <stop offset="0" stopColor={alpha(t.gold, 0.55)} />
              <stop offset="1" stopColor={alpha(t.gold, 0)} />
            </radialGradient>
          </defs>
          <line x1={0} y1={G} x2={W} y2={G} stroke={alpha(t.primary, 0.6)} strokeWidth={3} />
          {mode === "shuttle" ? (
            data.stations.map((s, i) => {
              const sx = i ? W * 0.8 : W * 0.2;
              const hit = inLoop && ((loopIdx % 2 === 0 && i === 1) || (loopIdx % 2 === 1 && i === 0)) ? clamp((lp - 0.85) * 6) : 0;
              return (
                <g key={i}>
                  <rect x={sx - h * 0.42} y={G - h * 0.62} width={h * 0.84} height={h * 0.62} rx={16} fill={alpha(t.bg2, 0.9)} stroke={alpha(i ? t.accent : t.primary, 0.7 + hit * 0.3)} strokeWidth={4} />
                  <rect x={sx - h * 0.42} y={G - h * 0.62} width={h * 0.84} height={h * 0.12} rx={12} fill={alpha(i ? t.accent : t.primary, 0.35)} />
                </g>
              );
            })
          ) : (
            <g>
              {/* chair */}
              <path d={`M${fx - h * 0.2},${G - h * 0.24} L${fx + h * 0.08},${G - h * 0.24} M${fx - h * 0.2},${G - h * 0.24} L${fx - h * 0.26},${G - h * 0.66} M${fx - h * 0.16},${G - h * 0.24} L${fx - h * 0.16},${G} M${fx + h * 0.04},${G - h * 0.24} L${fx + h * 0.04},${G}`} stroke={alpha(t.dim, 0.8)} strokeWidth={10} strokeLinecap="round" fill="none" />
              {/* desk */}
              <rect x={deskX0} y={deskY} width={deskX1 - deskX0} height={14} rx={4} fill={alpha(t.primary, 0.55)} />
              <line x1={deskX0 + 20} y1={deskY + 14} x2={deskX0 + 20} y2={G} stroke={alpha(t.primary, 0.45)} strokeWidth={8} />
              <line x1={deskX1 - 20} y1={deskY + 14} x2={deskX1 - 20} y2={G} stroke={alpha(t.primary, 0.45)} strokeWidth={8} />
              {/* lamp */}
              <path d={`M${deskX0 + h * 0.34},${deskY} L${deskX0 + h * 0.3},${deskY - h * 0.5} L${deskX0 + h * 0.46},${deskY - h * 0.62}`} stroke={alpha(t.dim, 0.9)} strokeWidth={6} fill="none" />
              <path d={`M${deskX0 + h * 0.38},${deskY - h * 0.66} l${h * 0.16},0 l${h * 0.04},${h * 0.08} l${-h * 0.24},0 z`} fill={t.gold} opacity={lampOn ? 1 : 0.5} />
              {lampOn && <path d={`M${deskX0 + h * 0.36},${deskY - h * 0.58} L${deskX0 + h * 0.62},${deskY - h * 0.58} L${deskX0 + h * 0.9},${deskY} L${deskX0 - h * 0.04},${deskY} Z`} fill="url(#psLamp)" opacity={clamp((dark - 0.45) * 3) * (0.85 + 0.15 * Math.sin(frame / 3))} />}
              {mode === "desk" && pile(inX, inCount, "in", t.text)}
              {mode === "desk" && pile(doneX, doneCount, "dn", t.primary)}
              {mode === "screen" && (
                <g>
                  <rect x={fx + h * 0.5} y={deskY - h * 0.46} width={h * 0.5} height={h * 0.34} rx={10} fill={alpha(t.bg, 0.95)} stroke={t.primary} strokeWidth={4} style={{ filter: `drop-shadow(0 0 18px ${alpha(t.primary, 0.6)})` }} />
                  <rect x={fx + h * 0.72} y={deskY - h * 0.12} width={h * 0.06} height={h * 0.12} fill={alpha(t.primary, 0.5)} />
                  {inLoop && lp < 0.55 && <circle cx={fx + h * 0.75} cy={deskY - h * 0.2} r={h * 0.035} fill="none" stroke={t.primary} strokeWidth={4} strokeDasharray={`${h * 0.12} ${h * 0.2}`} transform={`rotate(${frame * 18} ${fx + h * 0.75} ${deskY - h * 0.2})`} />}
                </g>
              )}
            </g>
          )}
          {sheet && (
            <g transform={`translate(${sheet.x} ${sheet.y}) rotate(${sheet.r})`} opacity={sheet.o}>
              <rect x={-h * 0.13} y={-5} width={h * 0.26} height={10} rx={2} fill={t.text} />
            </g>
          )}
          <Figure x={px} y={G} h={h} pose={pose} face={face} color={t.text} glow={t.primary} dim={tired} />
        </svg>

        {/* things that are text: screen text, station labels, the sheet being worked on */}
        {mode === "screen" && (
          <div style={{ position: "absolute", left: fx + h * 0.5, top: deskY - h * 0.46, width: h * 0.5, height: h * 0.34, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Icon name={data.prop.icon ?? guessIcon(data.prop.label) ?? "send"} size={h * 0.07} color={t.dim} />
            {(!inLoop || lp >= 0.55) && <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.screenText ?? `0 ${data.prop.label}`, h * 0.46, h * 0.075, 14), color: t.bad, whiteSpace: "nowrap" }}>{data.screenText ?? `0 ${data.prop.label}`}</div>}
          </div>
        )}
        {mode === "shuttle" &&
          data.stations.map((s, i) => (
            <div key={i} style={{ position: "absolute", left: (i ? W * 0.8 : W * 0.2) - h * 0.42, width: h * 0.84, top: G - h * 0.44, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(s, h * 0.76, h * 0.16, 20), color: t.text, whiteSpace: "nowrap" }}>
              {s}
            </div>
          ))}
        {mode === "desk" && (
          <div style={{ position: "absolute", left: inX - 160, width: 320, top: G + 20, textAlign: "center", fontFamily: t.font.body, fontWeight: 800, fontSize: 30, color: t.dim, whiteSpace: "nowrap" }}>
            <Icon name={data.prop.icon ?? guessIcon(data.prop.label) ?? "doc"} size={30} color={t.dim} style={{ verticalAlign: "-5px", marginRight: 8 }} />
            {data.prop.label} · 越堆越高
          </div>
        )}
        {/* role tag over the head */}
        {frame >= roleAt && (
          <div style={{ position: "absolute", left: tagX, top: tagY, transform: `translate(-50%, -100%) translate(${eRole.dx}px, ${eRole.dy}px) scale(${eRole.scale})`, opacity: eRole.opacity, transformOrigin: "50% 100%", textAlign: "center" }}>
            <div style={{ padding: "10px 28px", borderRadius: 14, background: alpha(t.bg, 0.85), border: `3px solid ${t.accent}`, boxShadow: `0 0 24px ${alpha(t.accent, 0.5)}`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.role, 520, 52, 26), color: t.text, whiteSpace: "nowrap" }}>{data.role}</div>
            {data.roleNote && <div style={{ marginTop: 8, fontFamily: t.font.body, fontWeight: 700, fontSize: 28, color: t.accent, whiteSpace: "nowrap" }}>{data.roleNote}</div>}
            <div style={{ margin: "0 auto", width: 3, height: 26, background: t.accent }} />
          </div>
        )}
        {/* counter */}
        {cnt && frame >= loopStart && (
          <div style={{ position: "absolute", right: W * 0.05, top: H * 0.1 + 20, display: "flex", alignItems: "baseline", gap: 8, fontFamily: t.font.title, fontWeight: 900, color: t.text, transform: `scale(${1 + cntBump * 0.18})`, transformOrigin: "right center", textShadow: "0 4px 18px rgba(0,0,0,.7)" }}>
            <span style={{ fontSize: 40, color: t.dim }}>{cnt.prefix}</span>
            <span style={{ fontSize: 110, lineHeight: 1, color: cntBump > 0 ? t.accent : t.text, fontVariantNumeric: "tabular-nums" }}>{cntVal}</span>
            <span style={{ fontSize: 44, color: t.dim }}>{cnt.unit}</span>
          </div>
        )}
      </div>
      {/* the room goes dark as the night goes on (lamp and figure stay readable) */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at ${((fx + h * 0.4) / W) * 100}% 70%, transparent 25%, rgba(0,0,0,${0.5 * dark}) 75%)`, pointerEvents: "none" }} />
      <Sfx name="pop" at={roleAt} volume={0.3} />
      {starts.map((s, i) => (
        <Sfx key={i} name={mode === "shuttle" ? "swish" : mode === "screen" ? "click" : "swipe"} at={s + (mode === "desk" ? unit * Math.pow(ratio, i) * 0.8 : 0)} volume={0.22 + i * 0.03} />
      ))}
      {cnt && starts.map((s, i) => <Sfx key={`c${i}`} name="tick" at={s + unit * Math.pow(ratio, i)} volume={0.26} />)}
      {data.endPose !== "none" && endAt < dur && <Sfx name="impact" at={endAt} volume={0.3} />}
    </>
  );
};

export const PersonaScene: CompDef<D> = {
  id: "persona-scene",
  name: "处境人设（工位受难现场）",
  layer: "story",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["人设", "处境", "如果你是", "熬夜", "加班", "新人", "老板", "两头跑", "盯着"],
  motion: { kind: "人物循环动作越来越快 + 时钟快转 + 房间变暗", energy: 2 },
  desc: "一个无脸人物剪影在自己的工位：伏案一张张处理材料（右边那沓永远不见少）/ 盯着屏幕反复刷新 / 在两个地方之间来回跑；同一动作一遍比一遍快，墙上时钟转到深夜、窗外天黑、台灯亮起、人越来越暗，角落计数器每轮跳一次，最后瘫倒或抱头。头顶弹出人设标签",
  use: "口播第一句报出「职业 + 折磨他的那件活」或给观众画像：晚上十点还在改卷子的老师（desk）、盯着空邮箱的外贸新人（screen）、在后厨和前台两头跑的老板（shuttle）、下夜班瘫倒的护士",
  schema,
  example: {
    role: "外贸新人",
    roleNote: "入行第 3 个月",
    mode: "desk",
    prop: { label: "报价单", icon: "doc" },
    clock: { from: "19:00", to: "23:40" },
    counter: { prefix: "第", from: 1, to: 37, unit: "份" },
    loops: 4,
    endPose: "slump",
  },
  C,
};
