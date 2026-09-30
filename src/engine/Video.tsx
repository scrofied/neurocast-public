import React, { useMemo } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BY_ID } from "../components/registry";
import type { Cam, CompDef } from "../components/types";
import { easeIn, easeInOut, prog } from "../lib/anim";
import { Box } from "../lib/box";
import { alpha, ThemeProvider, useTheme } from "../lib/theme";
import { Sfx, SfxProvider, type SfxName } from "../lib/sfx";
import type { Shot, Timeline } from "../types";
import { World } from "../world/World";
import { Captions, PostFx, ProgressHud } from "./Hud";
import { OVERLAP, ShotFrame } from "./ShotFrame";

const TRANSITION_SFX: Record<string, SfxName | undefined> = { fly: "whoosh", warp: "whoosh", iris: "swish", glitch: "glitch" };

const src = (p: string) => (/^https?:/.test(p) ? p : staticFile(p));

// apply the component's zod defaults at render time too (Gallery examples, nested panel items)
export const withDefaults = (def: CompDef, data: any) => {
  const r = def.schema.safeParse(data ?? {});
  return r.success ? r.data : data;
};

const ShotView: React.FC<{ shot: Shot; seed: number }> = ({ shot, seed }) => {
  const f = useCurrentFrame();
  const def = BY_ID[shot.type] ?? BY_ID.narration;
  const data = useMemo(() => withDefaults(def, shot.data), [def, shot.data]);
  const C = def.C;
  const tsfx = TRANSITION_SFX[shot.transition];
  return (
    <ShotFrame frame={f} dur={shot.dur} transition={shot.transition} seed={seed + shot.start}>
      <C data={data} frame={f} dur={shot.dur} variant={shot.variant % Math.max(1, def.variants)} seed={seed + shot.start} text={shot.text} />
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
  const end = Math.min(p.offset + p.frames - 1, p.hideFrom ?? Infinity);
  // before the clip's own first frame there is nothing to show — without this the black
  // container fills the screen for `offset` frames (a black flash on frame 0)
  if (f >= end || f < p.offset) return null;
  const k = easeInOut(prog(f, p.full, 22));
  const out = easeIn(prog(f, end - 12, 12));
  const px = width - PIP.w - PIP.right;
  const py = PIP.top;
  const cam: Cam = opening?.def.camera && f >= opening.from && f < opening.to ? opening.def.camera(opening.data, f - opening.from, opening.to - opening.from) : {};
  // while an opening is driving the person, it owns the frame: no PiP box, and the person
  // follows the opening's box/shape instead of shrinking into the corner window
  const driving = f >= (opening?.from ?? -1) && f < (opening?.to ?? -1);
  const zoom = (cam.zoom ?? 1) * (driving ? 1 : 1 + 0.35 * k);
  const rec = Math.floor(f / 18) % 2 === 0;
  return (
    <div
      style={{
        position: "absolute",
        left: px * (driving ? 0 : k),
        top: py * (driving ? 0 : k),
        width: driving ? width : width + (PIP.w - width) * k,
        height: driving ? height : height + (PIP.h - height) * k,
        borderRadius: 22 * (driving ? 0 : k),
        overflow: "hidden",
        background: driving ? "transparent" : "#000",
        opacity: 1 - out,
        transform: `scale(${1 - out * 0.12})`,
        boxShadow: !driving && k > 0.01 ? `0 0 0 2px ${alpha(t.primary, 0.8 * k)}, 0 0 ${40 * k}px ${alpha(t.primary, 0.35 * k)}, 0 20px 50px rgba(0,0,0,${0.6 * k})` : undefined,
        ...(driving ? camStyle(cam) : {}),
      }}
    >
      <div style={{ position: "absolute", inset: 0, ...camInner(cam, p.focusX, p.focusY), transformOrigin: driving ? "50% 45%" : `${p.focusX * 100}% ${p.focusY * 100}%` }}>
        <Sequence from={p.offset} layout="none">
          <OffthreadVideo src={src(p.src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${p.focusX * 100}% ${p.focusY * 100}%` }} />
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

// per-script opening of a TTS-only film: transparent full-frame overlay above the presenter
const OpeningOverlay: React.FC<{ o: OpeningLive; seed: number }> = ({ o, seed }) => {
  const f = useCurrentFrame();
  const C = o.def.C;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Box width={1920} height={1080}>
        <C data={o.data} frame={f} dur={o.to - o.from} variant={0} seed={seed} text="" />
      </Box>
    </div>
  );
};

export const Video: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const { meta, shots, chapters, captions, durationInFrames, audioClips } = timeline;
  const op = timeline.opening;
  const odef = op ? BY_ID[op.type] : undefined;
  const opening = useMemo<OpeningLive | null>(() => {
    if (!op || !odef) return null;
    const from = Math.max(0, Math.round(op.at ?? 0));
    const to = Math.round(op.until ?? from + 75);
    return to > from ? { def: odef, data: withDefaults(odef, op.data), from, to } : null;
  }, [op, odef]);
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
          <AbsoluteFill style={{ transform: meta.mirror ? "scaleX(-1)" : undefined }}>
            <World shots={shots} seed={meta.seed} variant={meta.world} />
          </AbsoluteFill>
          {shots.map((s) => (
            // overlap so exit and entry transitions cross
            <Sequence key={s.id} from={s.start} durationInFrames={s.dur + OVERLAP} name={`${s.type}:${s.text.slice(0, 12)}`}>
              <ShotView shot={{ ...s, dur: s.dur + OVERLAP }} seed={meta.seed} />
            </Sequence>
          ))}
          <PostFx seed={meta.seed} />
          {meta.presenter && <PresenterLayer p={meta.presenter} opening={opening} />}
          {opening && (
            <Sequence from={opening.from} durationInFrames={opening.to - opening.from} name={`opening:${opening.def.id}`} layout="none">
              <OpeningOverlay o={opening} seed={meta.seed + 101} />
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
