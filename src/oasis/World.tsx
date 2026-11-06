import React from "react";
import { useTheme } from "../lib/theme";
import { Cam } from "./Stage3D";
import { Dust, NeonGrid, SkyDome, Skyline } from "../world/OasisBackdrop";

// 场景级 OASIS 世界：Stage3D 已经管相机，这里只管天空/巨城/网格/尘埃。
// 和全局 world:"oasis" 的区别：这是每个 3D 场景自己的世界，可以跟着 cam 变。
export const OasisWorld: React.FC<{
  cam: Cam;
  t: number;
  glow?: string;
  grid?: string;
  grid2?: string;
  horizon?: string;
  gridY?: number;
  gridIntensity?: number;
  fogDist?: number;
  city?: boolean;
  cityLit?: number;
  dust?: number;
  seed?: number;
  pulse?: number;
  pulseAmt?: number;
  cell?: number;
  scroll?: number;
}> = ({
  cam,
  t,
  glow,
  grid,
  grid2,
  horizon,
  gridY = 0,
  gridIntensity = 1,
  fogDist = 180,
  city = true,
  cityLit = 1,
  dust = 1,
  seed = 11,
  pulse = -100,
  pulseAmt = 0,
  cell = 2.2,
  scroll,
}) => {
  const th = useTheme();
  const cGlow = glow ?? th.secondary;
  const cGrid = grid ?? th.primary;
  const cGrid2 = grid2 ?? th.secondary;
  const cHorizon = horizon ?? th.bg2;
  const lookZ = cam.look[2];
  const palette = [th.primary, th.secondary, th.accent, th.primary, th.secondary];
  return (
    <>
      <SkyDome center={[cam.pos[0], 0, cam.pos[2]]} top={th.bg} horizon={cHorizon} glow={cGlow} glowAmt={0.55} />
      {city && <Skyline center={[cam.look[0], gridY - 0.05, lookZ - 100]} seed={seed} palette={palette} fogColor={cHorizon} lit={cityLit} />}
      <NeonGrid
        center={[cam.look[0], gridY, lookZ - 40]}
        color={cGrid}
        color2={cGrid2}
        base={th.bg}
        fogColor={cHorizon}
        scroll={scroll ?? t * 0.34}
        cell={cell}
        fogDist={fogDist}
        intensity={gridIntensity}
        pulse={pulse}
        pulseAmt={pulseAmt}
      />
      {dust > 0 && <Dust center={[cam.look[0], 8, lookZ]} time={t} color={th.primary} seed={seed + 5} opacity={0.75 * dust} />}
    </>
  );
};
