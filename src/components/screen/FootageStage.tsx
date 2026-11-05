import React from "react";
import { z } from "zod";
import { AbsoluteFill, Img, OffthreadVideo, Sequence } from "remotion";
import { clamp, easeInOut, easeOut, prog } from "../../lib/anim";
import { assetSrc, assetUrl, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../types";

// ═══ 素材舞台：真实片段镶进一块会动的版面里 ═══════════════════════════════
// 参考片那套「深色编辑台」语法：画面里先是一块深紫黑的台面（细网格 + 斜光 + 角标），
// 真素材装进一块 16:9 的面板，面板只占约三分之二；另一侧是 mono 小标、两行大标题、
// 编号要点与一枚小章。面板按镜头 motion.enter 入场；换段时在面板内部擦除/闪白；
// 面板顶部外侧一行细标（红点 · 现场素材 / 机位 / 时长），出处角标也放在框外。
// 素材上不叠字、不加假浏览器条、不加假鼠标：标题与出处全部留在面板之外。
const clip = z.object({
  src: z.string().describe("真实素材（截图/录屏/现场片段），相对 public/"),
  kind: z.enum(["image", "video"]).optional().describe("图片还是视频：prepAssets 探过会自动填，别手写"),
  aspect: z.number().optional().describe("素材宽高比（管线自动带）"),
  frames: z.number().optional().describe("视频总帧数（管线实测后自动填，别手写）"),
  at: z.number().optional().describe("这一段从本镜第几帧开始（台词锚点/秒由引擎换算）"),
  fit: z.enum(["cover", "contain"]).default("cover").describe("面板内铺法；界面截图用 contain 看全"),
  zoom: z.number().default(1.035).describe("静帧在段内缓推的量；视频不推"),
  speed: z.number().min(0.3).max(2.5).default(1).describe("视频倍速；素材比段短时管线会自动放慢补满"),
  enter: z.enum(["wipe-l", "wipe-r", "wipe-up", "iris", "flash", "cut"]).optional().describe("换到这一段时面板内部的入场"),
  cut: z.enum(["t", "b", "l", "r", "tb", "lr"]).optional().describe("把素材自烧的边带推出面板（同 asset-full 口径）"),
  cutBy: z.number().min(0.02).max(0.3).optional().describe("每条边推出比例，默认 0.1"),
});
const point = z.object({
  text: z.string().describe("舞台侧栏的一句短标签（≤12 字）"),
  note: z.string().optional().describe("下面一行小注（≤16 字）"),
  icon: z.string().optional().describe("左侧的小图标名（film/search/grid/browser/phone/tool/check/spark…）"),
  at: z.number().optional().describe("出现时刻（台词锚点/帧）；缺省按顺序排在后面"),
  tone: z.enum(["key", "accent", "warn"]).optional(),
});
const schema = z.object({
  kicker: z.string().default("真实素材").describe("侧栏顶部一行 mono 小标"),
  title: z.string().default("").describe("侧栏主标题，用 \\n 分两行（每行 ≤8 字）"),
  index: z.string().default("").describe("角落编号，如 01 / 04"),
  look: z.enum(["event", "screen", "model", "doc"]).default("screen").describe("舞台气质：event 现场暖光 / screen 屏幕冷光 / model 模型切换 / doc 文档"),
  layout: z.enum(["left", "right"]).default("right").describe("面板放哪一侧；标题与要点自动去另一侧"),
  clips: z.array(clip).min(1).max(8).describe("按顺序在面板里换的真实片段；换段点写在 clips[].at"),
  points: z.array(point).max(4).optional().describe("侧栏要点，逐条卡词出现"),
  tag: z.string().optional().describe("侧栏底部一枚小章（≤8 字）"),
  source: sourceSchema,
});
type D = z.infer<typeof schema>;

const CREAM = "#fff5e8";
const LINE = "rgba(255,245,232,.16)";

const C: React.FC<CompProps<D>> = ({ data: d, frame: f, dur, variant }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const enterAt = useEnter(variant);
  const leave = easeInOut(prog(f, Math.max(1, dur - 12), 12));
  const n = d.clips.length;

  // 面板几何：65% 宽、16:9，右侧/左侧留出侧栏。字幕带 y>930 一律不占。
  const ph = Math.min(H * 0.655, (W * 0.655) / (16 / 9));
  const pw = ph * (16 / 9);
  const sidePad = W * 0.045;
  const px = d.layout === "right" ? W - pw - sidePad : sidePad;
  const py = H * 0.175;
  const sideX = d.layout === "right" ? sidePad : W - sidePad - W * 0.225;
  const sideW = W * 0.225;
  const drift = Math.sin(f / 52) * 5 + Math.sin(f / 23) * 1.6;
  const accent = d.look === "event" ? "#ff8a3d" : d.look === "model" ? t.primary : d.look === "doc" ? "#9fd7ff" : t.primary;
  const white = d.look === "event" ? "#ffb547" : accent;

  // 换段时基（同 asset-full）：写了锚点就用，没写就在本镜里均分。
  const starts = d.clips.map((c, i) => (typeof c.at === "number" ? Math.round(c.at) : Math.round(((dur - 6) * i) / Math.max(1, n))));
  for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + 8);
  // 第一段素材的起点就是整块版面的出场点：开场垫在它上面时，版面不会提前在暗处演完。
  const baseAt = Math.max(0, starts[0] ?? 0);
  const panelIn = enterAt(f, baseAt, { fallback: d.look === "event" ? "slide-r" : "wipe", dur: 18, dist: 1.1 });
  const win = starts.map((s, i) => {
    const from = clamp(s, 0, Math.max(1, dur - 8));
    const to = i + 1 < starts.length ? clamp(Math.max(starts[i + 1], from + 8), from + 8, dur) : dur;
    return { from, to, slot: Math.max(8, to - from) };
  });
  const active = Math.max(0, starts.filter((s) => f >= s).length - 1);

  // 版面进场：mono 小标逐字打出 → 标题两行上擦 → 细线长出 → 面板入场
  const typed = Math.max(0, Math.round(clamp((f - baseAt - 2) / 14) * d.kicker.length));
  const blink = Math.sin(f / 6) > 0;
  const titleLines = (d.title || "").split("\n");
  const ruleIn = easeInOut(prog(f, baseAt + 12, 12));
  const tagAt = Math.max(baseAt + 16, dur - 34);

  const points = d.points ?? [];
  let prev = baseAt + 18;
  const pointViews = points.map((p, i) => {
    const at = typeof p.at === "number" ? p.at : prev + 12 + i * 10;
    prev = at;
    const pIn = easeOut(clamp((f - at) / 11));
    return { p, at, pIn };
  });

  const clipNode = (c: (typeof d.clips)[number], i: number) => {
    const { from, slot } = win[i];
    const isVideo = c.kind === "video";
    const src = assetSrc(c.src);
    const vf = c.frames ?? 0;
    const rate = clamp((vf > 0 && vf < slot ? Math.max(0.55, vf / slot) : 1) * (c.speed ?? 1), 0.3, 3);
    const kin = 1 + Math.max(0, (c.zoom ?? 1.035) - 1) * easeInOut(prog(f - from, 0, slot));
    const ep = easeInOut(prog(f - from, 0, 11));
    const ec = c.enter ?? "cut";
    const enterStyle: React.CSSProperties =
      ec === "wipe-l" ? { clipPath: `inset(0 ${100 * (1 - ep)}% 0 0)` }
      : ec === "wipe-r" ? { clipPath: `inset(0 0 0 ${100 * (1 - ep)}%)` }
      : ec === "wipe-up" ? { clipPath: `inset(${100 * (1 - ep)}% 0 0 0)` }
      : ec === "iris" ? { clipPath: `circle(${72 * ep}% at 50% 50%)` }
      : {};
    const two = c.cut === "tb" || c.cut === "lr";
    const cb = Math.min(c.cutBy ?? 0.1, two ? 0.28 : 0.45);
    const cutScale = c.cut ? 1 / (1 - (two ? 2 * cb : cb)) : 1;
    const origin = c.cut === "t" ? "50% 100%" : c.cut === "b" ? "50% 0%" : c.cut === "l" ? "100% 50%" : c.cut === "r" ? "0% 50%" : "50% 50%";
    // 上一段要多活 12 帧垫在下面：不然下一段的 11 帧擦除是「从黑面板上擦出来」，
    // 换段瞬间会闪一下全黑的面板（看着像花屏/黑帧）。
    const bleed = i + 1 < starts.length ? Math.min(12, Math.max(0, dur - (from + slot))) : 0;
    return (
      <Sequence key={i} from={from} durationInFrames={slot + bleed} name={`footage:${c.src.split("/").pop()}`}>
        <div style={{ position: "absolute", inset: 0, ...enterStyle }}>
          {!src ? (
            <MissingAsset field="clips[].src" hint="这里要放真实截图/录屏/现场片段" w={pw} h={ph} frame={f} />
          ) : isVideo ? (
            <div style={{ position: "absolute", inset: 0, transform: `scale(${cutScale})`, transformOrigin: origin }}>
              <OffthreadVideo src={src} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: c.fit, display: "block" }} />
            </div>
          ) : (
            <div style={{ position: "absolute", inset: 0, transform: `scale(${kin * cutScale})`, transformOrigin: origin }}>
              <Img src={assetUrl(c.src)} style={{ width: "100%", height: "100%", objectFit: c.fit, display: "block" }} />
            </div>
          )}
        </div>
        {i > 0 && ec === "flash" && (
          <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.5 * (1 - clamp(prog(f - from, 0, 7))) }} />
        )}
      </Sequence>
    );
  };

  return (
    <AbsoluteFill style={{ background: "#08060f", overflow: "hidden" }}>
      {/* ── 台面：深紫黑 + 细网格 + 两团环境光 ── */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(116deg, #08060f 0%, #0d0817 46%, #130a22 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(58% 76% at 84% 20%, ${alpha(accent, 0.14)} 0%, rgba(0,0,0,0) 70%), radial-gradient(52% 66% at 6% 82%, rgba(120,70,220,.16) 0%, rgba(0,0,0,0) 72%)` }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.6 }}>
        <defs>
          <pattern id="fsgrid" width="72" height="72" patternUnits="userSpaceOnUse" patternTransform={`translate(${(f * 0.18) % 72} ${(f * 0.1) % 72})`}>
            <path d="M72 0H0V72" fill="none" stroke={alpha(CREAM, 0.045)} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#fsgrid)" />
        <line x1={0} y1={H * 0.82} x2={W} y2={H * 0.82} stroke={alpha(CREAM, 0.06)} strokeWidth="1" />
        <line x1={W * 0.32} y1={0} x2={W * 0.32} y2={H} stroke={alpha(CREAM, 0.05)} strokeWidth="1" />
      </svg>
      {/* 三条缓慢漂移的斜光，保证空镜一直在动 */}
      {[0, 1, 2].map((i) => {
        const yy = H * 0.16 + i * H * 0.31 + Math.sin(f / 60 + i * 2) * 24;
        return <div key={i} style={{ position: "absolute", left: -W * 0.2, top: yy, width: W * 1.5, height: 1.5, background: `linear-gradient(90deg, rgba(0,0,0,0), ${alpha(accent, 0.1 - i * 0.022)}, rgba(0,0,0,0))`, transform: "rotate(-11deg)" }} />;
      })}

      {/* ── 面板 ── */}
      <div
        style={{
          position: "absolute",
          left: px,
          top: py,
          width: pw,
          height: ph,
          opacity: leave > 0 ? 1 - leave : panelIn.opacity,
          transform: `translate(${panelIn.dx + leave * (d.layout === "left" ? -120 : 120)}px, ${panelIn.dy + drift}px) scale(${(0.985 + 0.015 * panelIn.p) * panelIn.scale}) rotate(${panelIn.rot * 0.4}deg)`,
          transformOrigin: "center center",
          clipPath: panelIn.clip,
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "#05040a", border: `1px solid ${alpha(CREAM, 0.22)}`, boxShadow: `0 30px 80px rgba(0,0,0,.6), 0 0 44px ${alpha(accent, 0.08)}`, overflow: "hidden" }}>
          {d.clips.map(clipNode)}
          {/* 面板内只有两根角标线，不压画面内容 */}
          <div style={{ position: "absolute", left: 0, top: 0, width: 34, height: 34, borderTop: `2px solid ${alpha(white, 0.9)}`, borderLeft: `2px solid ${alpha(white, 0.9)}`, opacity: 0.65 }} />
          <div style={{ position: "absolute", right: 0, bottom: 0, width: 34, height: 34, borderBottom: `2px solid ${alpha(white, 0.9)}`, borderRight: `2px solid ${alpha(white, 0.9)}`, opacity: 0.65 }} />
          {/* 入场时扫过面板的一道窄光 */}
          {panelIn.p < 1 && <div style={{ position: "absolute", top: 0, bottom: 0, width: 160, left: `${-20 + panelIn.p * 120}%`, background: `linear-gradient(90deg, rgba(0,0,0,0), ${alpha("#fff", 0.16)}, rgba(0,0,0,0))`, transform: "skewX(-14deg)" }} />}
        </div>
      </div>

      {/* 面板外的细标行：左「红点 · 现场素材 / 屏幕实机」右「本段时长」；出处 badge 也在框外 */}
      <div style={{ position: "absolute", left: px, top: py - 34, width: pw, display: "flex", alignItems: "center", justifyContent: "space-between", opacity: panelIn.opacity * (1 - leave), fontFamily: t.font.mono }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 16, letterSpacing: 2, color: alpha(CREAM, 0.62) }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: d.look === "event" ? "#ff5d6c" : accent, boxShadow: `0 0 10px ${d.look === "event" ? "#ff5d6c" : accent}`, opacity: d.look === "event" ? 0.55 + 0.45 * Math.sin(f / 7) : 1 }} />
          {d.look === "event" ? "现场素材" : d.look === "model" ? "模型实机" : d.look === "doc" ? "文档实拍" : "屏幕实机"}
          <span style={{ opacity: 0.35 }}>/</span>
          <span style={{ color: alpha(CREAM, 0.4) }}>{d.index || String(active + 1).padStart(2, "0")}</span>
        </div>
        <div style={{ fontSize: 15, letterSpacing: 1.6, color: alpha(CREAM, 0.38) }}>{d.source ? "" : `${String(Math.floor(dur / 30)).padStart(2, "0")}:${String(Math.floor((dur % 30) * 2)).padStart(2, "0")} · REC`}</div>
      </div>
      <div style={{ position: "absolute", left: px + pw - 420, top: py - 44, width: 420, display: "flex", justifyContent: "flex-end", opacity: panelIn.opacity * (1 - leave) }}>
        <SourceBadge source={d.source} frame={f} align="left" />
      </div>

      {/* ── 侧栏：mono 小标 / 两行大标题 / 编号要点 / 小章 ── */}
      <div style={{ position: "absolute", left: sideX, top: H * 0.135, width: sideW, opacity: 1 - leave * 0.25 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: t.font.mono, fontSize: 17, letterSpacing: 2.4, color: alpha(accent, 0.95), textShadow: "0 2px 12px rgba(0,0,0,.8)" }}>
          <span style={{ width: 7, height: 7, background: accent, display: "inline-block" }} />
          {d.kicker.slice(0, typed)}
          <span style={{ display: "inline-block", width: 9, height: 15, background: accent, opacity: blink ? 0.9 : 0.1 }} />
        </div>
        <div style={{ marginTop: 12 }}>
          {titleLines.map((ln, i) => {
            const p = easeOut(clamp((f - baseAt - 6 - i * 5) / 12));
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, fontFamily: t.font.title, fontWeight: 900, fontSize: 48, lineHeight: 1.14, letterSpacing: 1, color: CREAM, textShadow: "0 3px 18px rgba(0,0,0,.75)", whiteSpace: "nowrap" }}>
                {ln}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 110, height: 3, background: accent, transformOrigin: "left", transform: `scaleX(${ruleIn})` }} />
          <div style={{ width: 6, height: 6, borderRadius: 3, background: accent, opacity: ruleIn }} />
        </div>

        {/* 编号要点：细横线分行的清单，不是发光胶囊 */}
        <div style={{ marginTop: 26, borderTop: `1px solid ${LINE}` }}>
          {pointViews.map(({ p, at, pIn }, i) => {
            const col = p.tone === "warn" ? t.bad : p.tone === "accent" ? accent : white;
            const isActive = d.look === "model" && points.length === n && i === active;
            return (
              <div key={i} style={{ position: "relative", padding: "13px 0 13px 0", borderBottom: `1px solid ${LINE}`, opacity: pIn, transform: `translateX(${(1 - pIn) * 26}px)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: t.font.mono, fontSize: 13, letterSpacing: 1.4, color: alpha(col, isActive ? 1 : 0.75), width: 24 }}>{String(i + 1).padStart(2, "0")}</span>
                  {p.icon && <span style={{ color: isActive ? accent : alpha(col, 0.9), display: "inline-flex" }}><Icon name={p.icon} size={19} /></span>}
                  <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 23, color: isActive ? "#fff" : alpha(CREAM, 0.94), letterSpacing: 0.5, textShadow: "0 2px 10px rgba(0,0,0,.7)" }}>{p.text}</span>
                  {isActive && <span style={{ marginLeft: "auto", width: 6, height: 6, background: accent, boxShadow: `0 0 8px ${accent}` }} />}
                </div>
                {p.note && <div style={{ marginTop: 5, paddingLeft: 58, fontFamily: t.font.mono, fontSize: 13, letterSpacing: 0.8, color: alpha(CREAM, 0.46), lineHeight: 1.45 }}>{p.note}</div>}
                <div style={{ position: "absolute", left: 0, bottom: -1, height: 1.5, width: `${pIn * 100}%`, background: alpha(col, isActive ? 0.7 : 0.28) }} />
                <Sfx name="tick" at={at} volume={0.18} />
              </div>
            );
          })}
        </div>

        {d.tag && (
          <div style={{ marginTop: 20, display: "inline-block", padding: "7px 15px", border: `2px solid ${alpha(accent, 0.85)}`, color: accent, fontFamily: t.font.title, fontWeight: 900, fontSize: 19, letterSpacing: 2, opacity: easeOut(clamp((f - tagAt) / 11)), transform: `rotate(-3deg) scale(${0.92 + 0.08 * easeOut(clamp((f - tagAt) / 11))})` }}>{d.tag}</div>
        )}
      </div>

      {/* 侧栏底部：细进度 + 场次（字幕带之上） */}
      <div style={{ position: "absolute", left: sideX, top: H * 0.855, width: sideW, display: "flex", alignItems: "center", gap: 9, opacity: 0.8 }}>
        <span style={{ fontFamily: t.font.mono, fontSize: 12.5, letterSpacing: 2, color: alpha(CREAM, 0.4) }}>TRAE · STAGE</span>
        <span style={{ width: 52, height: 2, background: alpha(CREAM, 0.13) }}>
          <span style={{ display: "block", width: `${clamp(f / Math.max(1, dur)) * 100}%`, height: "100%", background: alpha(accent, 0.8) }} />
        </span>
        <span style={{ fontFamily: t.font.mono, fontSize: 12.5, letterSpacing: 2, color: alpha(CREAM, 0.4) }}>{String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
      </div>

      <Sfx name="swish" at={baseAt} volume={0.18} />
    </AbsoluteFill>
  );
};

export const FootageStage: CompDef<D> = {
  id: "footage-stage",
  name: "素材舞台",
  layer: "screen",
  variants: 4,
  minSec: 2,
  maxSec: 22,
  tags: ["真实素材", "非全屏", "舞台", "面板", "现场", "录屏", "编辑台"],
  motion: { kind: "深色编辑台：mono 小标打出 → 大标题上擦 → 素材装入 2/3 面板，换段在框内擦除", energy: 2 },
  bare: true,
  desc:
    "把真实片段装进一块 16:9 的面板，面板只占画面约三分之二，另一侧是 mono 小标、两行大标题、编号要点与小章。台面有细网格、斜光与场次进度；面板按镜头 motion.enter 入场，换段在面板内部擦除或闪白。素材上不叠字，出处放在面板外。",
  use:
    "讲现场活动、模型切换、仓库演示、产品界面时，既要把真片段放给观众看，又不想让它铺满整屏：现场用 look:event，工具/仓库用 look:screen，模型对比用 look:model（侧栏要点跟着当前片段高亮），文档用 look:doc。",
  schema,
  assetFields: ["clips[].src"],
  example: {
    kicker: "// 现场记录",
    title: "开发者\n怎么用",
    index: "01 / 03",
    look: "event",
    layout: "right",
    clips: [{ src: "assets/stock/pexels/desk-night.mp4", kind: "video", at: 0, fit: "cover", zoom: 1.035, speed: 1 }],
    points: [{ text: "现场组队", at: 8, icon: "users" }, { text: "直接上手", at: 30, icon: "tool", tone: "accent" }],
    tag: "真实现场",
  },
  noGallery: true,
  C,
};
