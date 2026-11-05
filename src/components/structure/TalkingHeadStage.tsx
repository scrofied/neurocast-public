import React, { useMemo } from "react";
import { z } from "zod";
import { Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { clamp, easeInOut, easeOut, prog } from "../../lib/anim";
import { Box, useBox } from "../../lib/box";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { Corners } from "../../lib/ui";
import { LOOKUP } from "../lookup";
import type { Cam, CompDef, CompProps } from "../types";

const item = z.object({
  type: z.string().describe("侧栏里放的组件 id，如 phone-feed / bullet-cards / logic-flip / number"),
  at: z.number().optional().describe("出现时刻：分镜里写锚点文字或秒，渲染时为帧"),
  until: z.number().optional().describe("消失时刻；缺省 = 下一项出现或镜头结束"),
  data: z.record(z.string(), z.any()).default({}),
});
const schema = z.object({
  video: z.string().describe("口播视频（管线从 [口播: x.mp4] 自动填入）"),
  videoFrames: z.number().optional().describe("视频帧数（管线自动填入）"),
  audioUntil: z.number().optional().describe("口播原声在第几帧静音（管线自动填入，避免和后面的配音重叠）"),
  focusX: z.number().min(0).max(1).default(0.52).describe("人物在原画面里的水平中心 0~1"),
  focusY: z.number().min(0).max(1).default(0.42),
  title: z.string().optional().describe("左下角标题条"),
  kicker: z.string().optional(),
  intro: z.number().optional().describe("开头全屏保持的帧数，默认 24，之后收进中间舞台"),
  shrinkAt: z.number().optional().describe("真人收进中间舞台的时刻（锚点/秒）；有专属开场时用它让开场全屏播完 2~3 秒，优先于 intro"),
  opening: item.optional().describe("本条视频专属开场：{type: 开场组件 id(layer=opening), at, until, data}。透明画布叠在真人画面上层"),
  inserts: z.array(item).default([]).describe("口播段中途的整屏插图（同样是透明覆盖层）：讲到某句时把一张截图/图表盖满画面举证，讲完撤走露出真人"),
  mute: z.boolean().default(false).describe("静音本条口播视频的音轨（整片改用外部音源时用）"),
  hide: z.array(z.object({ at: z.number(), until: z.number() })).default([]).describe("整段隐藏真人与侧栏的台词区间；用于整屏动效插入层"),
  full: z.array(z.object({ at: z.number(), until: z.number() })).default([]).describe("真人重新切回全屏的台词区间；区间结束后回到两侧动效舞台"),
  win: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional().describe("自定义真人窗口（默认居中 1040x836）；给大画面人物用"),
  panelW: z.number().default(350).describe("侧栏宽度"),
  bare: z.boolean().default(false).describe("侧栏去掉玻璃底与边框，内容直接浮在背景上（更接近参考博主的动效排布）"),
  leftLabel: z.string().optional(),
  rightLabel: z.string().optional(),
  left: z.array(item).default([]),
  right: z.array(item).default([]),
});
type D = z.infer<typeof schema>;
type Item = z.infer<typeof item>;

// stage layout on a 1920x1080 frame
const WIN = { x: 440, y: 104, w: 1040, h: 836 };
const PANEL = { y: 132, w: 350, h: 792 };
const LEFT_X = 58;
const RIGHT_X = 1920 - 58 - 350;

const SlotItem: React.FC<{ it: Item; dur: number; side: "left" | "right"; seed: number; w: number; h: number }> = ({ it, dur, side, seed, w, h }) => {
  const f = useCurrentFrame();
  const def = LOOKUP[it.type];
  const data = useMemo(() => {
    if (!def) return it.data;
    const r = def.schema.safeParse(it.data ?? {});
    return r.success ? r.data : it.data;
  }, [def, it.data]);
  if (!def) return null;
  const pin = easeOut(prog(f, 0, 14));
  const pout = easeInOut(prog(f, dur - 10, 10));
  const dx = (side === "left" ? -1 : 1) * ((1 - pin) * 24 + pout * 18);
  const C = def.C;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: pin * (1 - pout), transform: `translateX(${dx}px)`, filter: pin < 1 || pout > 0 ? `blur(${(1 - pin) * 6 + pout * 6}px)` : undefined }}>
      <Box width={w} height={h}>
        <C data={data} frame={f} dur={dur} variant={0} seed={seed} text="" />
      </Box>
    </div>
  );
};

const Panel: React.FC<{ items: Item[]; x: number; side: "left" | "right"; show: number; dur: number; label?: string; seed: number; w: number; h: number; y: number; bare?: boolean }> = ({ items, x, side, show, dur, label, seed, w, h, y, bare }) => {
  const t = useTheme();
  const sorted = [...items].map((it, i) => ({ ...it, at: it.at ?? i * 90 })).sort((a, b) => a.at! - b.at!);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: show,
        transform: `translateX(${(side === "left" ? -1 : 1) * (1 - show) * 40}px)`,
        borderRadius: bare ? 0 : 22,
        background: bare ? "transparent" : `linear-gradient(160deg, ${alpha(t.primary, 0.07)}, ${alpha(t.bg, 0.55)} 55%)`,
        border: bare ? undefined : `1px solid ${alpha(t.primary, 0.22)}`,
        boxShadow: bare ? undefined : `inset 0 0 40px ${alpha(t.primary, 0.05)}`,
        overflow: "hidden",
      }}
    >
      {!bare && <Corners color={alpha(t.primary, 0.8)} size={16} inset={10} />}
      {label && !bare && <div style={{ position: "absolute", left: 24, bottom: 16, fontFamily: t.font.mono, fontSize: 13, letterSpacing: 4, color: alpha(t.primary, 0.7) }}>{label}</div>}
      {sorted.map((it, i) => {
        const from = Math.max(0, Math.round(it.at!));
        const next = sorted[i + 1]?.at;
        const to = Math.round(it.until ?? (next !== undefined ? next + 6 : dur));
        if (to <= from) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={to - from} layout="none">
            <SlotItem it={it} dur={to - from} side={side} seed={seed + i * 13} w={w} h={h} />
          </Sequence>
        );
      })}
    </div>
  );
};

// the per-script opening: full-frame transparent overlay above the person + panels, below HUD/captions
const OpeningLayer: React.FC<{ it: Item; dur: number; seed: number; text: string }> = ({ it, dur, seed, text }) => {
  const f = useCurrentFrame();
  const def = LOOKUP[it.type];
  const data = useMemo(() => (def ? withData(def, it.data) : it.data), [def, it.data]);
  if (!def) return null;
  const C = def.C;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Box width={1920} height={1080}>
        <C data={data} frame={f} dur={dur} variant={0} seed={seed} text={text} />
      </Box>
    </div>
  );
};

const withData = (def: CompDef, d: any) => {
  const r = def.schema.safeParse(d ?? {});
  return r.success ? r.data : d;
};

const openRange = (o: Item | undefined, dur: number) => {
  if (!o) return null;
  const from = Math.max(0, Math.round(o.at ?? 0));
  const to = Math.min(dur, Math.round(o.until ?? from + 150));
  return to > from ? { from, to } : null;
};

// resolve a Cam into the style/transform an opening wants on the person window
const camBox = (cam: Cam): React.CSSProperties => {
  const b = cam.box;
  const st: React.CSSProperties = {};
  if (b) {
    st.left = (b.x ?? 0) * 1920;
    st.top = (b.y ?? 0) * 1080;
    st.width = (b.w ?? 1) * 1920;
    st.height = (b.h ?? 1) * 1080;
  }
  if (cam.clip) st.clipPath = cam.clip;
  if (cam.radius !== undefined) st.borderRadius = cam.radius;
  if (cam.opacity !== undefined) st.opacity = Math.max(0, Math.min(1, cam.opacity));
  return st;
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed, text }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const intro = data.shrinkAt ?? data.intro ?? 24;
  const WB = data.win ?? WIN;
  const PW = data.panelW ?? PANEL.w;
  const LX = data.win ? 36 : LEFT_X;
  const RX = 1920 - LX - PW;
  const PY = data.win ? data.win.y : PANEL.y;
  const PH = data.win ? Math.max(320, 1080 - PY - 44) : PANEL.h;
  const op = data.opening;
  const odef = op ? LOOKUP[op.type] : undefined;
  const orange = openRange(op, dur);
  const odata = useMemo(() => (odef && op ? withData(odef, op.data) : undefined), [odef, op]);
  const opening = !!(odef?.camera && orange && frame >= orange.from && frame < orange.to);
  const fullNow = data.full.some((r) => frame >= r.at && frame < r.until);
  const hiddenNow = (data.hide ?? []).some((r) => frame >= r.at && frame < r.until);
  const cam: Cam = opening ? odef!.camera!(odata, frame - orange!.from, orange!.to - orange!.from) : {};
  // an opening that drives the person suppresses the shrink: it owns the window shape for its window
  // 收缩（舞台框）是本组件自己那层的入场：只取 e.p 顶替原生进度（fallback=wipe → easeInOut，基线不变），
  // 不消费 dx/dy/clip，避免给窗口凭空加位移；分镜写 motion.enter 时由它改这段节奏。
  const eStage = enterAt(frame, intro, { fallback: "wipe", dur: 26 });
  const k = opening || fullNow ? 0 : eStage.p;
  const x = WB.x * k;
  const y = WB.y * k;
  const w = width + (WB.w - width) * k;
  const h = height + (WB.h - height) * k;
  const radius = 26 * k;
  // 侧栏槽位（两侧玻璃栏的淡入）也是本组件自己那层的入场：只取 e.p 顶替原生 easeOut 进度
  // （fallback=slide-r 的 p 即 easeOut，基线一致），位移仍由 Panel 原生 (1-show) 计算，不额外叠加。
  const eSlot = enterAt(frame, intro + 12, { fallback: "slide-r", dur: 20 });
  const covered = !!(odef?.opening?.selfBg && orange && frame >= orange.from && frame < orange.to);
  const show = eSlot.p * (opening || covered || fullNow || hiddenNow ? 0 : 1);
  const vf = data.videoFrames ?? Infinity;
  const last = Math.max(0, Math.floor(vf) - 2);
  const src = /^https?:/.test(data.video) ? data.video : staticFile(data.video);
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: `${data.focusX * 100}% ${data.focusY * 100}%` };
  const lt = easeOut(prog(frame, intro + 30, 18)) * (1 - easeInOut(prog(frame, intro + 170, 16)));
  const rec = Math.floor(frame / 18) % 2 === 0;
  return (
    <>
      <div
        style={{
          position: "absolute",
          opacity: hiddenNow ? 0 : 1,
          left: opening ? 0 : x,
          top: opening ? 0 : y,
          width: opening ? "100%" : w,
          height: opening ? "100%" : h,
          borderRadius: opening ? 0 : radius,
          overflow: opening && cam.clip ? "visible" : "hidden",
          boxShadow: !opening && k > 0.01 ? `0 0 0 2px ${alpha(t.primary, 0.75 * k)}, 0 0 ${60 * k}px ${alpha(t.primary, 0.35 * k)}, 0 30px 80px rgba(0,0,0,${0.55 * k})` : undefined,
          background: opening ? "transparent" : "#000",
          ...(opening ? camBox(cam) : {}),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: cam.zoom || cam.x || cam.y || cam.rot || cam.mirror ? `translate(${cam.x ?? 0}px, ${cam.y ?? 0}px) scale(${cam.zoom ?? 1}) rotate(${cam.rot ?? 0}deg)${cam.mirror ? " scaleX(-1)" : ""}` : undefined,
            transformOrigin: opening ? "50% 45%" : `${data.focusX * 100}% ${data.focusY * 100}%`,
            filter: cam.filter,
          }}
        >
          {frame < last ? (
            <OffthreadVideo src={src} style={style} volume={(f) => (data.mute ? 0 : data.audioUntil !== undefined && f >= data.audioUntil ? 0 : 1)} />
          ) : (
            <Freeze frame={last}>
              <OffthreadVideo src={src} style={style} muted />
            </Freeze>
          )}
        </div>
        {cam.tint && (cam.tintOpacity ?? 0) > 0.001 && <div style={{ position: "absolute", inset: 0, background: cam.tint, opacity: cam.tintOpacity, mixBlendMode: "multiply" }} />}
        {/* cool grade so the bright room sits inside the dark sci-fi frame */}
        {!opening && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(t.bg, 0.05)}, ${alpha(t.bg, 0.28)})`, mixBlendMode: "multiply" }} />}
        {!opening && <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${120 * k}px ${alpha(t.bg, 0.55 * k)}` }} />}
        {!opening && k > 0.5 && <Corners color={t.primary} size={26} inset={14} />}
        <div style={{ position: "absolute", right: 22, top: 18, display: "flex", alignItems: "center", gap: 10, fontFamily: t.font.mono, fontSize: 16, letterSpacing: 3, color: "#fff", opacity: k, textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: rec ? t.bad : alpha(t.bad, 0.35), boxShadow: rec ? `0 0 10px ${t.bad}` : undefined }} />
          REC
        </div>
        {(data.title || data.kicker) && lt > 0.01 && (
          <div style={{ position: "absolute", left: 34, bottom: 34, opacity: lt, transform: `translateX(${(1 - lt) * -40}px)` }}>
            <div style={{ display: "inline-block", padding: "6px 14px", background: t.primary, color: t.bg, fontFamily: t.font.mono, fontSize: 16, fontWeight: 700, letterSpacing: 3 }}>{data.kicker ?? "NEUROCAST"}</div>
            {data.title && (
              <div style={{ marginTop: 6, padding: "10px 20px", background: alpha(t.bg, 0.78), borderLeft: `4px solid ${t.primary}`, fontFamily: t.font.title, fontWeight: 900, fontSize: 40, color: t.text, backdropFilter: "blur(8px)" }}>{data.title}</div>
            )}
          </div>
        )}
      </div>
      {show > 0.01 && (
        <>
          <Panel items={data.left} x={LX} side="left" show={show} dur={dur} label={data.leftLabel} seed={seed} w={PW} h={PH} y={PY} bare={data.bare} />
          <Panel items={data.right} x={RX} side="right" show={show} dur={dur} label={data.rightLabel} seed={seed + 7} w={PW} h={PH} y={PY} bare={data.bare} />
          <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: show }}>
            {[
              [LX + PW, PY + 60, WB.x, WB.y + 90],
              [RX, PY + 60, WB.x + WB.w, WB.y + 90],
            ].map(([x1, y1, x2, y2], i) => (
              <path key={i} d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`} fill="none" stroke={alpha(t.primary, 0.35)} strokeWidth={1.5} strokeDasharray="3 7" strokeDashoffset={-frame * 1.2} />
            ))}
          </svg>
        </>
      )}
      <div style={{ position: "absolute", left: WB.x, top: WB.y + WB.h + 10, width: WB.w, height: 2, opacity: show, background: `linear-gradient(90deg, transparent, ${alpha(t.primary, clamp(0.3 + 0.2 * Math.sin(frame / 12)))}, transparent)` }} />
      {op && orange && (
        <Sequence from={orange.from} durationInFrames={orange.to - orange.from} layout="none">
          <OpeningLayer it={op} dur={orange.to - orange.from} seed={seed + 101} text={text} />
        </Sequence>
      )}
      {data.inserts.map((ins, i) => {
        const r = openRange(ins, dur);
        if (!r) return null;
        return (
          <Sequence key={`ins${i}`} from={r.from} durationInFrames={r.to - r.from} layout="none">
            <OpeningLayer it={ins} dur={r.to - r.from} seed={seed + 211 + i * 17} text="" />
          </Sequence>
        );
      })}
    </>
  );
};

export const TalkingHeadStage: CompDef<D> = {
  id: "talking-head-stage",
  name: "真人口播舞台（两侧动画）",
  layer: "structure",
  variants: 1,
  minSec: 3,
  maxSec: 260,
  tags: ["口播", "真人", "开场"],
  motion: { kind: "真人从全屏收进中间发光舞台框，两侧玻璃侧栏随之滑入", energy: 2 },
  desc: "开头 1 秒真人全屏，随后收进中间发光窗口；左右两块玻璃侧栏按讲话节奏依次放入小组件（手机信息流、要点卡、逻辑翻转、数字等）",
  use: "真人口播片段（[口播: x.mp4]）。侧栏内容要跟他当时说的话对应，用 at 锚点卡住节奏",
  schema,
  example: {
    video: "assets/demo-talk.mp4",
    focusX: 0.52,
    focusY: 0.42,
    title: "从评论区挖掘爆款选题",
    left: [{ type: "phone-feed", at: 30, data: { swipeAt: 150 } }],
    right: [{ type: "bullet-cards", at: 40, data: { items: [{ text: "你觉得重要", tone: "good" }, { text: "观众不关心", tone: "bad", at: 70 }] } }],
  },
  C,
};
