import React, { useMemo } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BY_ID } from "../components/registry";
import type { Cam, CompDef } from "../components/types";
import { easeIn, easeInOut, easeOut, lerp, prog } from "../lib/anim";
import { Box } from "../lib/box";
import { MotionProvider } from "../lib/enter";
import { alpha, ThemeProvider, useTheme } from "../lib/theme";
import { Sfx, SfxProvider, type SfxName } from "../lib/sfx";
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
  // 真录屏原样全屏（screen + frameStyle "full"）：画面逐帧静止，不加环境慢推镜/漂移
  const steady = shot.type === "screen" && (data as { frameStyle?: string })?.frameStyle === "full";
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
      <MotionProvider spec={shot.motion}>
        <C data={data} frame={f} dur={shot.dur} variant={shot.variant % Math.max(1, def.variants)} seed={seed + shot.start} text={shot.text} />
      </MotionProvider>
      {tsfx && shot.start > 0 && <Sfx name={tsfx} at={0} volume={0.16} />}
    </ShotFrame>
  );
};

const Backdrop: React.FC = () => {
  const t = useTheme();
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 60%, ${t.bg2} 0%, ${t.bg} 70%)` }} />;
};

type PresenterMeta = NonNullable<Timeline["meta"]["presenter"]>;
type OpeningLive = { def: CompDef; data: any; from: number; to: number };

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
  const end = Math.min(p.offset + p.frames / rate - 1, p.hideFrom ?? Infinity);
  if (f >= end) return null;
  // the person's lips are delayed by `offset` to match the TTS (Sequence from={offset}); during the
  // first `offset` frames the clip has no frame yet, so we hold its poster (first frame) to cover the
  // shot underneath instead of exposing it.
  const k = p.full <= 0 ? 1 : easeInOut(prog(f, p.full, 22));
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
      : { x: px * k, y: py * k, w: width + (PIP.w - width) * k, h: height + (PIP.h - height) * k, r: 22 * k };
  const zoom = (cam.zoom ?? 1) * (driving ? 1 : st ? 1 + 0.35 * sm : 1 + 0.35 * k);
  const rec = Math.floor(f / 18) % 2 === 0;
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
        opacity: (1 - out) * inOp,
        transform: `scale(${1 - out * 0.12})`,
        boxShadow: !driving && k > 0.01 ? `0 0 0 2px ${alpha(t.primary, 0.8 * k)}, 0 0 ${40 * k}px ${alpha(t.primary, 0.35 * k)}, 0 20px 50px rgba(0,0,0,${0.6 * k})` : undefined,
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
      {!driving && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(t.bg, 0.04)}, ${alpha(t.bg, 0.3 * k)})`, mixBlendMode: "multiply" }} />}
      {!driving && k > 0.5 && (
        <div style={{ position: "absolute", left: 14, top: 12, display: "flex", alignItems: "center", gap: 8, fontFamily: t.font.mono, fontSize: 14, letterSpacing: 3, color: "#fff", opacity: k, textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, background: rec ? t.bad : alpha(t.bad, 0.35), boxShadow: rec ? `0 0 10px ${t.bad}` : undefined }} />
          LIVE
        </div>
      )}
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
    return to > from ? { def: odef, data: withDefaults(odef, op.data), from, to } : null;
  }, [op, odef]);
  // 开场驱动真人层时（全屏 + camera 右移让字），正片镜头整层不渲染：
  // 否则 camera.x 露出的那条边缘会把底下镜头的大字残影透出来（开场期间正片本来就压在全屏真人下面）
  // 例外：presenter.full<=0 = 真人从第 0 帧就在角落小窗，没有全屏遮挡，正片镜头必须照常渲染（开场大字叠在上面）
  const openingDriving = !!opening && !!meta.presenter && meta.presenter.full > 0 && f >= opening.from && f < opening.to;
  // 后期量只在换镜的 12 帧重叠窗上有峰值，稳定帧返回全 0 → 滤镜根本不挂载
  const fx = fxAt(shots, f, post, !!opening);
  const hideAt = (f: number) => {
    if (opening && f >= opening.from && f < opening.to) return true;
    const s = shots.find((x) => f >= x.start && f < x.start + x.dur);
    // a per-script opening already puts the spoken words on screen as big type
    const op = s?.data?.opening;
    if (op?.type && f - s!.start >= (op.at ?? 0) && f - s!.start < (op.until ?? 0)) return true;
    return !!s?.hideCaptions;
  };
  return (
    <ThemeProvider skin={meta.skin} font={meta.font}>
      <SfxProvider enabled={meta.sfx !== false}>
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Backdrop />
          <PostDefs fx={fx} width={width} height={height} />
          {/* 撕裂/RGB 分离挂在这一层：只包背景+镜头组，HUD 与字幕不进滤镜（否则逐字字幕会被扯花） */}
          <AbsoluteFill style={postFilter(fx)}>
            <AbsoluteFill style={{ transform: meta.mirror ? "scaleX(-1)" : undefined }}>
              <World shots={shots} seed={meta.seed} variant={meta.world} />
            </AbsoluteFill>
            {!openingDriving &&
              shots.map((s, i) =>
                s.over ? null : (
                // overlap so exit and entry transitions cross
                <Sequence key={s.id} from={s.start} durationInFrames={s.dur + OVERLAP} name={`${s.type}:${s.text.slice(0, 12)}`}>
                  <ShotView shot={{ ...s, dur: s.dur + OVERLAP }} next={shots[i + 1]} seed={meta.seed} />
                </Sequence>
              ))}
          </AbsoluteFill>
          <PostOverlays fx={fx} cfg={post} seed={meta.seed} />
          {meta.presenter && <PresenterLayer p={meta.presenter} opening={opening} />}
          {shots.map((s) =>
            s.over ? (
              <Sequence key={`ov${s.id}`} from={s.start} durationInFrames={s.dur} name={`over:${s.type}`}>
                <OverShot shot={s} seed={meta.seed} />
              </Sequence>
            ) : null,
          )}
          {opening && (
            <Sequence from={opening.from} durationInFrames={opening.to - opening.from} name={`opening:${opening.def.id}`} layout="none">
              <OpeningOverlay o={opening} seed={meta.seed + 101} hasPresenter={!!meta.presenter} />
            </Sequence>
          )}
          <ProgressHud chapters={chapters} total={durationInFrames} title={meta.title} flash={meta.chapterFlash !== false} />
          {meta.showCaptions && <Captions captions={captions} hidden={hideAt} />}
          {audioClips?.map((a, i) => (
            <Sequence key={`a${i}`} from={a.from} name={a.name ?? `audio ${i}`} layout="none">
              <Audio src={src(a.src)} trimBefore={a.trimBefore} trimAfter={a.trimAfter} volume={a.volume ?? 1} />
            </Sequence>
          ))}
          {meta.audio && !audioClips?.length && <Audio src={src(meta.audio)} />}
          {/* bgm sits ~-17 dB under the voice (spec: -12 ~ -18 dB) */}
          {meta.bgm && <Audio src={src(meta.bgm)} volume={0.14} loop />}
        </AbsoluteFill>
      </SfxProvider>
    </ThemeProvider>
  );
};
