import React from "react";
import type { z } from "zod";
import { easeIn, easeInOut, easeOut, prog } from "../../lib/anim";
import { drift, punch, shakes } from "../../lib/cine/motion";
import { outline } from "../../lib/cine/Type";
import type { Cam, CompDef, CompProps } from "../../components/types";

// Shared kit for the opening TEMPLATES (src/openings/templates/). Unlike the per-script openings,
// templates are generic: every word comes from data, every change sits on an anchor (xxxAt, frames
// relative to the opening start). Most are transparent overlays above the person layer; selfBg
// templates (op-tunnel) draw their own opaque stage and cover the shot underneath.

export type Hit = { at: number; amp?: number; len?: number };
export type Exit = "left" | "right" | "up" | "zoom" | "fade";

// constant drift + hit shakes + exit move over the last `outLen` frames
export const Stage: React.FC<{ frame: number; dur: number; seed: number; hits?: Hit[]; exit?: Exit; outLen?: number; children: React.ReactNode }> = ({ frame, dur, seed, hits = [], exit = "fade", outLen = 10, children }) => {
  const out = easeIn(prog(frame, dur - outLen, outLen));
  const dr = drift(frame, 6, 0.05, seed);
  const h = shakes(frame, hits, seed);
  const ex = { left: `translateX(${-out * 280}px)`, right: `translateX(${out * 280}px)`, up: `translateY(${-out * 200}px)`, zoom: `scale(${1 + out * 0.25})`, fade: `scale(${1 - out * 0.06})` }[exit];
  return <div style={{ position: "absolute", inset: 0, opacity: 1 - out, transform: `translate(${dr.x + h.x}px, ${dr.y + h.y}px) rotate(${h.r}deg) ${ex}` }}>{children}</div>;
};

// heavy outlined type that reads on any talking-head frame
export const ink = (size: number, color: string, font: string, strokeW = Math.max(6, size * 0.075)): React.CSSProperties => ({
  fontFamily: font,
  fontWeight: 900,
  fontSize: size,
  lineHeight: 1.05,
  color,
  whiteSpace: "nowrap",
  ...outline("#000", strokeW),
});

// camera helper for the person layer under the overlay.
// Also carries the "person layer owns the frame" fields (opacity / clip / radius / box) that the
// 5 opening tricks need: 推镜（zoomFrom→zoomTo）、收圈（clip）、延后入画（opacity）、容器变形（radius/box）.
export const cam = (
  f: number,
  dur: number,
  o: {
    punches?: { at: number; amt?: number }[];
    hits?: Hit[];
    zoomTo?: number;
    zoomFrom?: number;
    zoomAt?: number;
    zoomLen?: number;
    desatAt?: number;
    desatUntil?: number;
    desat?: number;
    tint?: string;
    tintAt?: number;
    tintOp?: number;
    blurAt?: number;
    blurUntil?: number;
    // 人像层整体：0 让真人先不出场（第5招「人物延后入画」）
    opacity?: number;
    // CSS clip-path：第3招收圈 circle(r% at x y)、第2招形态突变 inset(...)
    clip?: string;
    // 人像窗口圆角 / 位置尺寸（相对 1920x1080 的比例）
    radius?: number;
    box?: { x?: number; y?: number; w?: number; h?: number };
    mirror?: boolean;
    x?: number;
    y?: number;
  },
): Cam => {
  const fade = 1 - easeInOut(prog(f, dur - 12, 12));
  let z = 1;
  for (const p of o.punches ?? []) z *= punch(f, p.at, p.amt ?? 0.08, 16, 0.35);
  if (o.zoomTo !== undefined) {
    const from = o.zoomFrom ?? 1;
    const at = o.zoomAt ?? 0;
    const len = o.zoomLen ?? dur;
    z *= from + (o.zoomTo - from) * easeInOut(prog(f, at, len));
  }
  const s = shakes(f, o.hits ?? [], 3);
  const win = (a?: number, b?: number) => (a === undefined ? 0 : easeOut(prog(f, a, 6)) * (b === undefined ? 1 : 1 - easeOut(prog(f, b, 8))));
  const d = win(o.desatAt, o.desatUntil) * (o.desat ?? 0.7) * fade;
  const bl = win(o.blurAt, o.blurUntil) * fade;
  const tn = (o.tintAt === undefined ? 0 : easeOut(prog(f, o.tintAt, 6))) * fade;
  const fl: string[] = [];
  if (d > 0.001) fl.push(`grayscale(${d}) contrast(${1 + 0.12 * d})`);
  if (bl > 0.001) fl.push(`blur(${bl * 7}px) brightness(${1 - bl * 0.35})`);
  return {
    zoom: 1 + (z - 1) * fade,
    x: (s.x + (o.x ?? 0)) * fade,
    y: (s.y + (o.y ?? 0)) * fade,
    rot: s.r * fade,
    filter: fl.join(" ") || undefined,
    tint: o.tint,
    tintOpacity: (o.tintOp ?? 0.3) * tn,
    opacity: o.opacity,
    clip: o.clip,
    radius: o.radius,
    box: o.box,
    mirror: o.mirror,
  };
};

// per-char cues spread evenly from a to b
export const spread = (text: string, a: number, b: number) => {
  const n = Array.from(text).length;
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / Math.max(1, n - 1));
};

// index list of `part` inside `text` (for CharPop highlight)
export const idxOf = (text: string, part?: string) => {
  if (!part) return [];
  const k = text.indexOf(part);
  if (k < 0) return [];
  const s = Array.from(text.slice(0, k)).length;
  return Array.from(part).map((_, i) => s + i);
};

// deterministic pseudo random in [0,1)
export const rnd = (i: number, seed = 0) => {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const tpl = <D,>(o: {
  id: string;
  name: string;
  hook: string;
  desc: string;
  use: string;
  techniques: string[];
  schema: z.ZodType<D>;
  example?: Partial<D>;
  assetFields?: string[];
  minSec?: number;
  maxSec?: number;
  sec?: number;
  selfBg?: boolean;
  chapter?: boolean;
  C: React.FC<CompProps<D>>;
  camera?: (data: D, frame: number, dur: number) => Cam;
}): CompDef<D> => ({
  id: o.id,
  name: o.name,
  layer: "opening",
  variants: 1,
  minSec: o.minSec ?? 2,
  maxSec: o.maxSec ?? 4,
  tags: ["开场模板", o.hook],
  desc: o.desc,
  use: o.use,
  schema: o.schema,
  example: o.example ?? {},
  ...(o.assetFields?.length ? { assetFields: o.assetFields } : {}),
  C: o.C,
  camera: o.camera,
  opening: { script: "template", hook: o.hook, techniques: o.techniques, template: true, sec: o.sec, ...(o.selfBg ? { selfBg: true } : {}), ...(o.chapter ? { chapter: true } : {}) },

});
