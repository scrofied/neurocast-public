import React, { useMemo } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BY_ID } from "../components/registry";
import type { Cam, CompDef } from "../components/types";
import { easeIn, easeInOut, easeOut, lerp, prog } from "../lib/anim";
import { Box } from "../lib/box";
import { MotionProvider } from "../lib/enter";
import { alpha, ThemeProvider, useTheme } from "../lib/theme";
import { Sfx, SfxProvider, useSfxEnabled, type SfxName } from "../lib/sfx";
import type { Shot, Timeline } from "../types";
import { World } from "../world/World";
import { Captions, ProgressHud } from "./Hud";
import { fxAt, postCfgOf, PostDefs, PostOverlays, postFilter } from "./PostPass";
import { OVERLAP, ShotFrame } from "./ShotFrame";

// 转场音效：形状连续转场里 zoom/push 是「整块画面在动」→ whoosh；wipe/grid 是「扫过去/一格格铺开」→ swish / glitch
const TRANSITION_SFX: Record<string, SfxName | undefined> = {
  fly: "whoosh", warp: "whoosh", iris: "swish", glitch: "glitch", flood: "impact",
  zoom: "whoosh", push: "swish", wipe: "swish", grid: "glitch",
};

const src = (p: string) => (/^https?:/.test(p) ? p : staticFile(p));

// apply the component's zod defaults at render time too (Gallery examples, nested panel items)
export const withDefaults = (def: CompDef, data: any) => {
  const r = def.schema.safeParse(data ?? {});
  return r.success ? r.data : data;
};

const ShotView: React.FC<{ shot: Shot; next?: Shot; seed: number }> = ({ shot, next, seed }) => {
  const f = useCurrentFrame();
  const def = BY_ID[shot.type] ?? BY_ID.narration;
  const data = useMemo(() => withDefaults(def, shot.data), [def, shot.data]);
  const C = def.C;
  const tsfx = TRANSITION_SFX[shot.transition];
  // opening 是引擎保留键：不能从 withDefaults 之后取，否则没在 schema 里声明它的组件会被 zod 丢掉
  const op = (shot.data as { opening?: { type?: string; at?: number; until?: number; data?: Record<string, any> } } | undefined)?.opening;
  const opDef = op?.type ? BY_ID[op.type] : undefined;
  const opFrom = op ? Math.max(0, Math.round(op.at ?? 0)) : 0;
  const opTo = op
    ? Math.round(op.until ?? opFrom + Math.round((opDef?.opening?.sec ?? 2.5) * 30))
    : 0;
  // 镜级 opening 由 ShotView 统一渲染；talking-head-stage 自己在组件内部叠真人，避免重复
  const opActive = shot.type !== "talking-head-stage" && !!opDef && opTo > opFrom && f >= opFrom && f < opTo;
  const opSelfBg = !!opDef?.opening?.selfBg;
  const OpC = opDef?.C as React.FC<any> | undefined;
  const opData = useMemo(() => (opDef && op ? withDefaults(opDef, op.data) : null), [opDef, op]);
  const sfxOn = useSfxEnabled();
  const stage = op && opSelfBg && f >= opFrom && f < opTo;
  const steady = !!stage || (shot.type === "screen" && (data as { frameStyle?: string })?.frameStyle === "full");
  return (
    <ShotFrame
      frame={f}
      dur={shot.dur}
      transition={shot.transition}
      seed={seed + shot.start}
      nextTransition={next?.transition}
      variant={shot.variant}
      nextVariant={next?.variant}
      through={shot.through}
      nextThrough={next?.through}
      steady={steady}
    >
      <SfxProvider enabled={sfxOn && !(opActive && opSelfBg)}>
        <MotionProvider spec={shot.motion}>
          <C data={data} frame={f} dur={shot.dur} variant={shot.variant % Math.max(1, def.variants)} seed={seed + shot.start} text={shot.text} />
        </MotionProvider>
      </SfxProvider>
      {opActive && opDef && OpC && opData && (
        <SfxProvider enabled={sfxOn}>
          <div style={{ position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none" }}>
            <OpC data={opData} frame={f - opFrom} dur={opTo - opFrom} variant={0} seed={seed + shot.start + 101} text="" />
          </div>
        </SfxProvider>
      )}
      {tsfx && shot.start > 0 && <Sfx name={tsfx} at={0} volume={0.16} />}
    </ShotFrame>
  );
};

const Backdrop: React.FC = () => {
  const t = useTheme();
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 60%, ${t.bg2} 0%, ${t.bg} 70%)` }} />;
};

type PresenterMeta = NonNullable<Timeline["meta"]["presenter"]>;
type OpeningLive = { def: CompDef; data: any; from: number; to: number; captions: boolean };

// resolve a Cam into the style/transform an opening wants on the person layer
const camStyle = (cam: Cam): React.CSSProperties => {
  const b = cam.box;
  const st: React.CSSProperties = {};
  if (b) {
    const x = (b.x ?? 0) * 1920;
    const y = (b.y ?? 0) * 1080;
    const w = (b.w ?? 1) * 1920;
    const h = (b.h ?? 1) * 1080;
    st.left = x;
    st.top = y;
    st.width = w;
    st.height = h;
    st.right = "auto";
    st.bottom = "auto";
  }
  if (cam.clip) st.clipPath = cam.clip;
  if (cam.radius !== undefined) st.borderRadius = cam.radius;
  if (cam.opacity !== undefined) st.opacity = Math.max(0, Math.min(1, cam.opacity));
  return st;
};

const camInner = (cam: Cam, focusX: number, focusY: number): React.CSSProperties => ({
  transform: `translate(${cam.x ?? 0}px, ${cam.y ?? 0}px) scale(${cam.zoom ?? 1}) rotate(${cam.rot ?? 0}deg)${cam.mirror ? " scaleX(-1)" : ""}`,
  transformOrigin: `${focusX * 100}% ${focusY * 100}%`,
  filter: cam.filter,
});

// picture-in-picture window the presenter shrinks into after the full-screen opening (top-right, under the HUD, clear of captions)
const PIP = { w: 260, h: 330, right: 34, top: 110 };

// muted talking-head clip over a TTS-only film: full screen for `full` frames, then a small window until the clip ends
const PresenterLayer: React.FC<{ p: PresenterMeta; opening: OpeningLive | null }> = ({ p, opening }) => {
  const f = useCurrentFrame();
  const t = useTheme();
  const { width, height } = useVideoConfig();
  const rate = p.rate ?? 1; // 真人语速与 TTS 不完全一致：线性拟合给一个 ~±3% 的播放速率，配合 offset 让口型全程跟住
  // showFrom：小窗延迟出场（如第一句要全屏铺素材，真人从第二句才入画）；出场后 10 帧淡入
  if (p.showFrom != null && f < p.showFrom) return null;
  const inOp = p.showFrom != null ? easeOut(prog(f, p.showFrom, 10)) : 1;
  // gaps：[[起, 止]] 帧区间内真人层整层缺席（讲「纯界面/纯素材」的段落不必留一张脸）。
  // 进出各 8 帧淡入淡出，不做硬切。
  const gaps = p.gaps ?? [];
  if (gaps.some(([a, b]) => f >= a && f < b)) return null;
  let gapFade = 1;
  for (const [a, b] of gaps) {
    // gapCut：缺席起点硬切（不做 8 帧淡出）。真人全屏切到「纯素材墙」时，8 帧淡出会在墙上
    // 叠一张半透明的大脸 → 脏。硬切是 B-roll 的正常剪法；回来时仍保留 8 帧淡入。
    if (f >= a - 8 && f < a && !p.gapCut) gapFade = Math.min(gapFade, 1 - easeOut(prog(f, a - 8, 8)));
    else if (f >= b && f < b + 8) gapFade = Math.min(gapFade, easeOut(prog(f, b, 8)));
  }
  if (gapFade <= 0.001) return null;
  const end = Math.min(p.offset + p.frames / rate - 1, p.hideFrom ?? Infinity);
  if (f >= end) return null;
  // the person's lips are delayed by `offset` to match the TTS (Sequence from={offset}); during the
  // first `offset` frames the clip has no frame yet, so we hold its poster (first frame) to cover the
  // shot underneath instead of exposing it.
  const k = p.full <= 0 ? 1 : easeInOut(prog(f, p.full, 22));
  // fulls：正片中途「真人再全屏讲几句」的窗口（分镜里给那一镜写 presenter:"full"，make.mjs 汇成窗口）。
  // 展开/收起各 22 帧**包在窗口内部**（不像开场那样往两边溢），所以它和 gaps 不会打架：
  // 窗口外 k=1 照常小窗，窗口里从角上推到全屏、讲完再收回角上。
  const env = (a: number, b: number) => {
    if (f < a || f >= b) return 1;
    const r = Math.min(22, Math.max(2, Math.floor((b - a) / 3)));
    if (f < a + r) return 1 - easeInOut(prog(f, a, r));
    if (f >= b - r) return easeInOut(prog(f, b - r, r));
    return 0;
  };
  const kFull = (p.fulls ?? []).reduce((m, [a, b]) => Math.min(m, env(a, b)), 1);
  const kk = Math.min(k, kFull);
  const out = easeIn(prog(f, end - 12, 12));
  // corner:"left" → 左下角小窗（避开底部字幕：上抬到字幕安全区之上）；默认右上角 HUD 下方
  const px = p.corner === "left" ? 34 : width - PIP.w - PIP.right;
  const py = p.corner === "left" ? height - PIP.h - 158 : PIP.top;
  const cam: Cam = opening?.def.camera && f >= opening.from && f < opening.to ? opening.def.camera(opening.data, f - opening.from, opening.to - opening.from) : {};
  // while an opening is driving the person, it owns the frame: no PiP box, and the person
  // follows the opening's box/shape instead of shrinking into the corner window.
  // BUT presenter.full still wins: once f reaches `full` the person shrinks to the PiP even if
  // the opening overlay keeps playing (opening 动画叠在收窗后的画面上方继续)。
  const driving = f >= (opening?.from ?? -1) && f < (opening?.to ?? -1) && f < p.full;
  // stage：时段内真人窗固定在给定矩形（左右布局的左列），to 之后 18 帧缓动收进 corner 小窗
  const st = p.stage;
  const sm = st ? (f < st.to ? 0 : easeInOut(prog(f, st.to, 18))) : 0;
  const geo = driving
    ? { x: 0, y: 0, w: width, h: height, r: 0 }
    : st
      ? { x: lerp(st.x, px, sm), y: lerp(st.y, py, sm), w: lerp(st.w, PIP.w, sm), h: lerp(st.h, PIP.h, sm), r: 22 }
      : { x: px * kk, y: py * kk, w: width + (PIP.w - width) * kk, h: height + (PIP.h - height) * kk, r: 22 * kk };
  const zoom = (cam.zoom ?? 1) * (driving ? 1 : st ? 1 + 0.35 * sm : 1 + 0.35 * kk);
  return (
    <div
      style={{
        position: "absolute",
        left: geo.x,
        top: geo.y,
        width: geo.w,
        height: geo.h,
        borderRadius: geo.r,
        overflow: "hidden",
        background: driving ? "transparent" : "#000",
        opacity: (1 - out) * inOp * gapFade,
        transform: `scale(${1 - out * 0.12})`,
        boxShadow: !driving && kk > 0.01 ? `0 0 0 2px ${alpha(t.primary, 0.8 * kk)}, 0 0 ${40 * kk}px ${alpha(t.primary, 0.35 * kk)}, 0 20px 50px rgba(0,0,0,${0.6 * kk})` : undefined,
        ...(driving ? camStyle(cam) : {}),
      }}
    >
      <div style={{ position: "absolute", inset: 0, ...camInner(cam, p.focusX, p.focusY), transformOrigin: driving ? "50% 45%" : `${p.focusX * 100}% ${p.focusY * 100}%` }}>
        {f < p.offset && (p.poster ? (
          <img src={src(p.poster)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${p.focusX * 100}% ${p.focusY * 100}%` }} />
        ) : (
          <OffthreadVideo src={src(p.src)} muted startFrom={0} endAt={1} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${p.focusX * 100}% ${p.focusY * 100}%` }} />
        ))}
        <Sequence from={p.offset} layout="none">
          <OffthreadVideo src={src(p.src)} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${p.focusX * 100}% ${p.focusY * 100}%` }} />
        </Sequence>
      </div>
      {cam.tint && (cam.tintOpacity ?? 0) > 0.001 && <div style={{ position: "absolute", inset: 0, background: cam.tint, opacity: cam.tintOpacity, mixBlendMode: "multiply" }} />}
      {!driving && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(t.bg, 0.04)}, ${alpha(t.bg, 0.3 * kk)})`, mixBlendMode: "multiply" }} />}
    </div>
  );
};

// per-script opening of a TTS-only film: transparent full-frame overlay above the presenter.
// presenter=false（还没录真人口播）时把标记传给开场组件：由它自己画不透明背景，首帧不留残帧。
const OpeningOverlay: React.FC<{ o: OpeningLive; seed: number; hasPresenter: boolean }> = ({ o, seed, hasPresenter }) => {
  const f = useCurrentFrame();
  const C = o.def.C as React.FC<any>;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Box width={1920} height={1080}>
        <C data={o.data} frame={f} dur={o.to - o.from} variant={0} seed={seed} text="" presenter={hasPresenter} />
      </Box>
    </div>
  );
};

// over 镜头：渲染在真人层「之上」的全幅透明叠加（storyboard 里 over:true）。
// 典型用法 = 真人全屏讲话时在他两侧放动效（side-brand-fx）；不走转场/后期滤镜组，避免把真人画面盖进撕裂层。
const OverShot: React.FC<{ shot: Shot; seed: number }> = ({ shot, seed }) => {
  const f = useCurrentFrame();
  const def = BY_ID[shot.type];
  if (!def) return null;
  const C = def.C as React.FC<any>;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Box width={1920} height={1080}>
        <C data={withDefaults(def, shot.data)} frame={f} dur={shot.dur} variant={shot.variant} seed={seed} text={shot.text} />
      </Box>
    </AbsoluteFill>
  );
};

// 镜级「待核」角标：右下角一枚小胶囊，说明这一镜的口径没核实到官方来源。
// 只做画面标注、不动解说词——这是「未核实项只做角标」这条口径的落地口子。
// 位置压在字幕带（bottom 52 + 50px 字）之上，别和逐字字幕打架。
// 素材出处角标（SourceBadge）也贴在右下角同一带上（infinite-zoom / real-doc-scroll 实测会压住 URL 尾巴），
// 所以这一镜只要带 source，本角标就再抬高一档，两条小字各占一行。
const hasSourceBadge = (v: any, depth = 0): boolean => {
  if (!v || depth > 4) return false;
  if (Array.isArray(v)) return v.some((x) => hasSourceBadge(x, depth + 1));
  if (typeof v !== "object") return false;
  for (const [k, x] of Object.entries(v)) {
    if (k === "source" && x && typeof x === "object") return true;
    if (x && typeof x === "object" && hasSourceBadge(x, depth + 1)) return true;
  }
  return false;
};
const CaveatBadge: React.FC<{ text: string; f: number; dur: number; lift?: boolean }> = ({ text, f, dur, lift }) => {
  const t = useTheme();
  const inP = easeOut(prog(f, 10, 12));
  const outP = easeIn(prog(f, dur - 14, 12));
  const o = inP * (1 - outP);
  if (o <= 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        // 抬升值必须**高于**素材来源角标的那一行：evidence-zoom 的 SourceBadge 反解后落在
        // 距底 215 一带（占 215~255），原来 lift=208 只比它低 7px，两枚胶囊横着叠在一起，
        // 出处 URL 的尾巴被待核角标盖掉（1-14 s2 实测）。抬到 268 → 让开整行。
        bottom: lift ? 268 : 150,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 18px",
        borderRadius: 999,
        background: alpha(t.bg, 0.72),
        border: `1px solid ${alpha(t.dim, 0.5)}`,
        fontFamily: t.font.mono,
        fontSize: 19,
        letterSpacing: 1.5,
        color: alpha(t.dim, 0.95),
        opacity: o,
        transform: `translateY(${(1 - inP) * 10}px)`,
        pointerEvents: "none",
        textShadow: "0 1px 6px rgba(0,0,0,.7)",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 4, background: t.dim, opacity: 0.85 }} />
      {text}
    </div>
  );
};

export const Video: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const { meta, shots, chapters, captions, durationInFrames, audioClips } = timeline;
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const post = useMemo(() => postCfgOf(meta), [meta]);
  const op = timeline.opening;
  const odef = op ? BY_ID[op.type] : undefined;
  const opening = useMemo<OpeningLive | null>(() => {
    if (!op || !odef) return null;
    const from = Math.max(0, Math.round(op.at ?? 0));
    const to = Math.round(op.until ?? from + 75);
    return to > from ? { def: odef, data: withDefaults(odef, op.data), from, to, captions: op.captions === true } : null;
  }, [op, odef]);
  // 开场驱动真人层时（全屏 + camera 右移让字），正片镜头整层不渲染：
  // 否则 camera.x 露出的那条边缘会把底下镜头的大字残影透出来（开场期间正片本来就压在全屏真人下面）
  // 例外：presenter.full<=0 = 真人从第 0 帧就在角落小窗，没有全屏遮挡，正片镜头必须照常渲染（开场大字叠在上面）
  // 例外 2：开场还没完但真人已收进小窗（f >= presenter.full）——全屏遮挡没了，正片素材必须立刻露出来，
  //        否则收窗到开场结束之间会是一段只有星空的空窗（素材型视频最忌这个空窗）。
  const openingDriving = !!opening && !!meta.presenter && meta.presenter.full > 0 && f >= opening.from && f < Math.min(opening.to, meta.presenter.full);
  const covered = !!(opening?.def.opening?.selfBg && f >= opening.from && f < opening.to);
  const bodySfx = meta.sfx !== false && !covered;
  const selfBgActive = covered || shots.some((s) => {
    const local = s.data.opening;
    return local && BY_ID[local.type]?.opening?.selfBg && f >= s.start + (local.at ?? 0) && f < Math.min(s.start + s.dur, s.start + (local.until ?? 150));
  });
  // 后期量只在换镜的 12 帧重叠窗上有峰值，稳定帧返回全 0 → 滤镜根本不挂载
  const fx = fxAt(shots, f, post, !!opening);
  // 本镜的「待核」角标（分镜条目 caveat）：跟着镜头进出，不跟转场撕裂层
  const cshot = shots.find((x) => !!x.caveat && f >= x.start && f < x.start + x.dur);
  const caveat = cshot ? { text: cshot.caveat as string, f: f - cshot.start, dur: cshot.dur, lift: hasSourceBadge(cshot.data) } : null;
  const hideAt = (f: number) => {
    // 默认开场仍不显示字幕；仅本片显式 opening.captions=true 时，复用已按 caption_hide 脱敏的逐字轨。
    if (opening && f >= opening.from && f < opening.to) return !opening.captions;
    const s = shots.find((x) => f >= x.start && f < x.start + x.dur);
    // a per-script opening already puts the spoken words on screen as big type
    const op = s?.data?.opening;
    if (op?.type && op.data?.showCaptions !== true && f - s!.start >= (op.at ?? 0) && f - s!.start < (op.until ?? 0)) return true;
    return !!s?.hideCaptions;
  };
  // 本镜字幕抬升（分镜 captionLift）：录屏里录制器悬浮条压在底部字幕带上时，把字幕抬到它上面
  const capLift = (() => {
    const s = shots.find((x) => f >= x.start && f < x.start + x.dur);
    return Number.isFinite(s?.captionLift as number) ? (s!.captionLift as number) : 0;
  })();
  // 全屏素材镜头（组件声明 bare:true）：这一镜期间顶部章节 HUD、右下角标一律不上屏。
  // 素材上叠我们自己的小字（章节条/角落标签）在机器审核里就是「无效水印」的样子，
  // 素材自己单独检测又是通过的 —— 所以素材镜头只留底部字幕。
  const bareShot = shots.some((s) => !s.over && BY_ID[s.type]?.bare && f >= s.start && f < s.start + s.dur);
  return (
    <ThemeProvider skin={meta.skin} font={meta.font}>
      <SfxProvider enabled={meta.sfx !== false}>
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Backdrop />
          <PostDefs fx={fx} width={width} height={height} />
          {/* 撕裂/RGB 分离挂在这一层：只包背景+镜头组，HUD 与字幕不进滤镜（否则逐字字幕会被扯花） */}
          <AbsoluteFill style={selfBgActive ? undefined : postFilter(fx)}>
            <AbsoluteFill style={{ transform: meta.mirror ? "scaleX(-1)" : undefined }}>
              <World shots={shots} seed={meta.seed} variant={meta.world} />
            </AbsoluteFill>
            {!openingDriving &&
              shots.map((s, i) =>
                s.over ? null : (
                // overlap so exit and entry transitions cross
                <Sequence key={s.id} from={s.start} durationInFrames={s.dur + OVERLAP} name={`${s.type}:${s.text.slice(0, 12)}`}>
                  <SfxProvider enabled={bodySfx}><ShotView shot={{ ...s, dur: s.dur + OVERLAP }} next={shots[i + 1]} seed={meta.seed} /></SfxProvider>
                </Sequence>
              ))}
          </AbsoluteFill>
          {!selfBgActive && <PostOverlays fx={fx} cfg={post} seed={meta.seed} />}
          {meta.presenter && <PresenterLayer p={meta.presenter} opening={opening} />}
          {shots.map((s) =>
            s.over ? (
              <Sequence key={`ov${s.id}`} from={s.start} durationInFrames={s.dur} name={`over:${s.type}`}>
                <SfxProvider enabled={bodySfx}><OverShot shot={s} seed={meta.seed} /></SfxProvider>
              </Sequence>
            ) : null,
          )}
          {opening && (
            <Sequence from={opening.from} durationInFrames={opening.to - opening.from} name={`opening:${opening.def.id}`} layout="none">
              <OpeningOverlay o={opening} seed={meta.seed + 101} hasPresenter={!!meta.presenter} />
            </Sequence>
          )}
          {!selfBgActive && !bareShot && <ProgressHud chapters={chapters} total={durationInFrames} title={meta.title} flash={meta.chapterFlash !== false} />}
          {caveat && !bareShot && <CaveatBadge text={caveat.text} f={caveat.f} dur={caveat.dur} lift={caveat.lift} />}
          {meta.showCaptions && <Captions captions={captions} hidden={hideAt} lift={capLift} />}
          {audioClips?.map((a, i) => (
            <Sequence key={`a${i}`} from={a.from} name={a.name ?? `audio ${i}`} layout="none">
              <Audio src={src(a.src)} trimBefore={a.trimBefore} trimAfter={a.trimAfter} volume={a.volume ?? 1} />
            </Sequence>
          ))}
          {meta.audio && !audioClips?.length && <Audio src={src(meta.audio)} />}
          {meta.bgm && <Audio src={src(meta.bgm)} volume={(frame) => {
            const duck = meta.bgmDuck?.length
              ? meta.bgmDuck[Math.max(0, Math.min(meta.bgmDuck.length - 1, Math.round(frame)))] ?? 1
              : 1;
            const local = shots.find((s) => s.data.opening?.type && frame >= s.start + (s.data.opening.at ?? 0) && frame < s.start + (s.data.opening.until ?? 150));
            const active = opening && frame >= opening.from && frame < opening.to ? { data: opening.data, from: opening.from, to: opening.to } : local ? { data: local.data.opening.data, from: local.start + (local.data.opening.at ?? 0), to: local.start + (local.data.opening.until ?? 150) } : null;
            if (!active) return 0.14 * duck;
            const level = active.data?.sound === "quiet" ? 0 : 0.06;
            return (level + (0.14 - level) * easeInOut(prog(frame, active.to - 12, 12))) * duck;
          }} loop loopVolumeCurveBehavior="extend" />}
        </AbsoluteFill>
      </SfxProvider>
    </ThemeProvider>
  );
};
