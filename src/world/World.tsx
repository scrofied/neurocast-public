import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { rng, noise1 } from "../lib/anim";
import { useTheme } from "../lib/theme";
import type { Shot } from "../types";
import { MatrixRain } from "./MatrixRain";
import { OasisBackdrop } from "./OasisBackdrop";

// camera travel: slow drift + a speed burst at every shot boundary (the "flight" transition)
const useTravel = (shots: Shot[], frame: number) => {
  return useMemo(() => {
    let z = 0;
    for (const s of shots) {
      if (s.start > frame) break;
      const local = Math.min(frame - s.start, s.dur);
      // burst lasts ~22 frames, covers 260 units
      const b = Math.min(local, 22) / 22;
      z += 260 * (1 - Math.pow(1 - b, 3));
      z += local * 0.9;
    }
    return z;
  }, [shots, frame]);
};

const Stars: React.FC<{ seed: number; color: string; color2: string; count: number }> = ({ seed, color, color2, count }) => {
  const geo = useMemo(() => {
    const r = rng(seed);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(color2);
    const w = new THREE.Color("#ffffff");
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * 1600;
      pos[i * 3 + 1] = (r() - 0.5) * 900;
      pos[i * 3 + 2] = -r() * 3000;
      const k = r();
      const c = k < 0.5 ? w : k < 0.8 ? c1 : c2;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [seed, color, color2, count]);
  return (
    <points geometry={geo}>
      <pointsMaterial size={2.4} vertexColors transparent opacity={0.9} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

const Floaters: React.FC<{ seed: number; color: string; travel: number; frame: number }> = ({ seed, color, travel, frame }) => {
  const items = useMemo(() => {
    const r = rng(seed + 99);
    return new Array(26).fill(0).map((_, i) => ({
      x: (r() < 0.5 ? -1 : 1) * (260 + r() * 520),
      y: (r() - 0.5) * 520,
      z: -r() * 3000,
      s: 12 + r() * 36,
      kind: Math.floor(r() * 3),
      spin: (r() - 0.5) * 0.03,
      i,
    }));
  }, [seed]);
  return (
    <group>
      {items.map((it) => {
        let z = it.z + (travel % 3000);
        if (z > 200) z -= 3000;
        return (
          <mesh key={it.i} position={[it.x, it.y + noise1(frame / 90 + it.i, 3) * 20, z]} rotation={[frame * it.spin, frame * it.spin * 1.3, 0]}>
            {it.kind === 0 ? <icosahedronGeometry args={[it.s, 0]} /> : it.kind === 1 ? <octahedronGeometry args={[it.s, 0]} /> : <torusGeometry args={[it.s, it.s * 0.08, 6, 24]} />}
            <meshBasicMaterial color={color} wireframe transparent opacity={0.28} />
          </mesh>
        );
      })}
    </group>
  );
};

const Grid: React.FC<{ color: string; bg: string; travel: number; y: number }> = ({ color, bg, travel, y }) => {
  const off = travel % 100;
  // pre-mix toward background so the grid reads as atmosphere, not foreground
  const c = useMemo(() => "#" + new THREE.Color(color).lerp(new THREE.Color(bg), 0.55).getHexString(), [color, bg]);
  return (
    <group position={[0, y, -1200 + off]}>
      <gridHelper args={[6000, 60, c, c]} />
    </group>
  );
};

const Tunnel: React.FC<{ color: string; color2: string; travel: number; frame: number }> = ({ color, color2, travel, frame }) => {
  const rings = 24;
  const gap = 140;
  return (
    <group>
      {new Array(rings).fill(0).map((_, i) => {
        let z = -i * gap + (travel % gap);
        return (
          <mesh key={i} position={[0, 0, z - 200]} rotation={[0, 0, i * 0.3 + frame * 0.002]}>
            <torusGeometry args={[620, 1.2, 4, 6]} />
            <meshBasicMaterial color={i % 3 === 0 ? color2 : color} transparent opacity={0.35 * (1 - i / rings)} />
          </mesh>
        );
      })}
    </group>
  );
};

export const World: React.FC<{ shots: Shot[]; seed: number; variant: string }> = ({ shots, seed, variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = useTheme();
  const travel = useTravel(shots, frame);
  const starZ = travel % 3000;
  const sway = noise1(frame / 140, seed) * 0.05;
  const bob = noise1(frame / 170, seed + 5) * 0.03;
  const matrix = variant === "matrix";
  // 组件自带 Stage3D 时用 world:"none" 关掉全局背景，避免两个 WebGL 画布同时渲染。
  if (variant === "none") return null;
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 60, near: 1, far: 5000, position: [0, 0, 400] }} style={{ position: "absolute", inset: 0 }}>
      {variant === "oasis" ? (
        <OasisBackdrop travel={travel} seed={seed} />
      ) : (
        <>
      <fog attach="fog" args={[t.bg, 600, 3200]} />
      <group rotation={[bob, sway, 0]}>
        {!matrix && (
          <>
            <group position={[0, 0, starZ]}>
              <Stars seed={seed} color={t.primary} color2={t.secondary} count={2600} />
            </group>
            <group position={[0, 0, starZ - 3000]}>
              <Stars seed={seed} color={t.primary} color2={t.secondary} count={2600} />
            </group>
          </>
        )}
        {matrix && <MatrixRain travel={travel} seed={seed} />}
        {variant === "grid" && (
          <>
            <Grid color={t.primary} bg={t.bg} travel={travel} y={-330} />
            <Grid color={t.secondary} bg={t.bg} travel={travel} y={330} />
          </>
        )}
        {variant === "tunnel" && <Tunnel color={t.primary} color2={t.secondary} travel={travel} frame={frame} />}
        {variant === "stars" && (
          <group position={[520, -260, -1400]} rotation={[1.2, 0.2, frame * 0.0015]}>
            <mesh>
              <sphereGeometry args={[260, 32, 24]} />
              <meshBasicMaterial color={t.bg2} />
            </mesh>
            <mesh>
              <sphereGeometry args={[262, 24, 16]} />
              <meshBasicMaterial color={t.primary} wireframe transparent opacity={0.12} />
            </mesh>
            {[380, 430, 470].map((r, i) => (
              <mesh key={r}>
                <ringGeometry args={[r, r + 6 + i * 4, 96]} />
                <meshBasicMaterial color={i === 1 ? t.secondary : t.primary} transparent opacity={0.28 - i * 0.06} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        )}
        {!matrix && <Floaters seed={seed} color={t.primary} travel={travel} frame={frame} />}
      </group>
        </>
      )}
    </ThreeCanvas>
  );
};
