import React, { createContext, useContext } from "react";
import { Audio, Sequence, staticFile } from "remotion";

// 音效文件在 public/sfx/<name>.wav。现在这些是**真实音效**，由 scripts/sfx.mjs 走
// vendor/sound（猫学长开源的 sfx-sources skill）从 Mixkit 与 Freesound 的 CC0 素材取的，
// 不是 scripts/gen_sfx.py 程序合成的那批（那批已备份到 public/sfx_synth_backup/）。
// 下面的数字是每条音效的**实测帧数**，由 `node scripts/sfx.mjs table` 刷新，别手改；
// 每条的来源、许可、裁切点记录在 public/sfx/manifest.json。
// 组件里这样用：<Sfx name="pop" at={cue} />
export const SFX = {
  impact: 36,
  ding: 27,
  stamp: 18,
  whoosh: 18,
  swish: 12,
  swipe: 11,
  pop: 9,
  click: 5,
  tick: 4,
  riser: 54,
  glitch: 15,
  typing: 36,
  bubbles: 18,
  sparkle: 30,
  success: 30,
} as const;
export type SfxName = keyof typeof SFX;

const VOL = {"impact":0.5,"ding":0.4,"stamp":0.45,"whoosh":0.26,"swish":0.2,"swipe":0.2,"pop":0.3,"click":0.28,"tick":0.24,"riser":0.24,"glitch":0.3,"typing":0.22,"bubbles":0.26,"sparkle":0.28,"success":0.35};

const SfxCtx = createContext(true);
export const SfxProvider: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({ enabled, children }) => <SfxCtx.Provider value={enabled}>{children}</SfxCtx.Provider>;
export const useSfxEnabled = () => useContext(SfxCtx);

// 默认音量按 cue 走（砸点响一点、转场轻一点），组件里显式传 volume 时以传入值为准。
export const Sfx: React.FC<{ name: SfxName; at: number; volume?: number }> = ({ name, at, volume }) => {
  const on = useContext(SfxCtx);
  if (!on || !Number.isFinite(at) || at < 0) return null;
  return (
    <Sequence from={Math.round(at)} durationInFrames={SFX[name] + 6} name={`sfx:${name}`} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume ?? VOL[name] ?? 0.35} />
    </Sequence>
  );
};
