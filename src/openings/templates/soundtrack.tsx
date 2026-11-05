import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { clamp } from "../../lib/anim";
import { useSfxEnabled } from "../../lib/sfx";
import { PRO_SFX, type ProSfxName } from "../pro/kit/sfx";

export type OpeningSound = "quiet" | "foley" | "pulse" | "impact";
type Cue = { name: ProSfxName; at: number; volume: number; frames?: number };

export const OpeningSoundtrack: React.FC<{ sound: OpeningSound; proofAt: number; payoffAt: number; dur: number }> = ({ sound, proofAt, payoffAt, dur }) => {
  const on = useSfxEnabled();
  const { fps } = useVideoConfig();
  if (!on || sound === "quiet") return null;
  const cues: Cue[] = sound === "foley" ? [
    { name: "shutter", at: 0, volume: 0.18 },
    { name: "click", at: proofAt, volume: 0.22 },
    { name: "type", at: payoffAt, volume: 0.24 },
  ] : sound === "pulse" ? [
    { name: "drone", at: 0, volume: 0.08, frames: Math.max(1, proofAt - 6) },
    { name: "heart", at: proofAt, volume: 0.16 },
    { name: "sub", at: payoffAt, volume: 0.16 },
  ] : [
    { name: "slam", at: 0, volume: 0.26 },
    { name: "click", at: proofAt, volume: 0.2 },
    { name: "boom", at: payoffAt, volume: 0.22 },
  ];
  return <>{cues.filter((c) => c.at >= 0 && c.at < dur).map((c, i) => {
    const from = Math.round(c.at);
    const len = Math.max(1, Math.min(Math.round(dur) - from, Math.round(c.frames ?? Math.ceil(PRO_SFX[c.name] * fps))));
    return <Sequence key={i} from={from} durationInFrames={len} layout="none" name={`opening:${sound}:${c.name}`}>
      <Audio src={staticFile(`pro/sfx/${c.name}.wav`)} volume={(f) => c.volume * clamp((len - 1 - f) / Math.min(6, len))} />
    </Sequence>;
  })}</>;
};
