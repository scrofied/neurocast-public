import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rng } from "../lib/anim";
import { useTheme } from "../lib/theme";

// OASIS 霓虹世界：把 svb 工程（D:/qord/.qoder/live/svb）里的
// NeonGrid / Sky / Skyline / Dust 四层背景搬成 neurocast 的全局 world。
// 关键点：
//   · 网格线和楼窗都是 shader 程序化生成，不依赖贴图，镜头怎么动都不穿帮；
//   · 巨城是 InstancedMesh，一次 draw call 画 280 栋楼；
//   · 相机在 OasisBackdrop 里按时间缓慢漂移，给 2D 组件一个真实的空间底。
// Bloom 由 PostPass/CSS 层负责；这里只负责“世界本身”。

const gridVS = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const gridFS = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uBase;
uniform vec3 uFogColor;
uniform float uScroll;
uniform float uCell;
uniform vec3 uCam;
uniform float uFogDist;
uniform float uIntensity;
uniform float uPulse;
uniform float uPulseAmt;
varying vec3 vW;

float gline(vec2 p, float w) {
  vec2 fw = fwidth(p);
  vec2 g = abs(fract(p - 0.5) - 0.5) / fw;
  float l = 1.0 - min(min(g.x, g.y) / w, 1.0);
  float aa = 1.0 - smoothstep(0.25, 0.9, max(fw.x, fw.y));
  return l * aa;
}

void main() {
  vec2 p = vW.xz / uCell;
  p.y += uScroll;
  float l1 = gline(p, 1.0);
  float l2 = gline(p / 4.0, 1.7);
  float d = length(vW.xz - uCam.xz);
  float wave = exp(-pow((d - uPulse) * 0.35, 2.0)) * uPulseAmt;
  vec3 col = uBase + uColor * l1 * 0.32 + uColor * l2 * 0.85 + uColor2 * (l1 * 0.6 + l2) * wave * 2.5;
  float f = clamp(d / uFogDist, 0.0, 1.0);
  col = mix(col * uIntensity, uFogColor, pow(f, 0.7));
  gl_FragColor = vec4(col, 1.0);
}`;

const skyVS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const skyFS = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uGlowAmt;
varying vec3 vDir;
void main() {
  float h = normalize(vDir).y;
  vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.45, h));
  col += uGlow * exp(-abs(h - 0.01) * 22.0) * uGlowAmt;
  col += uGlow * exp(-abs(h) * 5.0) * 0.18 * uGlowAmt;
  if (h < -0.02) col = mix(col, uTop * 0.5, smoothstep(-0.02, -0.2, h));
  gl_FragColor = vec4(col, 1.0);
}`;

const bldVS = /* glsl */ `
attribute vec3 aCol;
attribute float aSeed;
varying vec2 vUv;
varying vec3 vCol;
varying float vSeed;
varying vec3 vScale;
varying float vDepth;
void main() {
  vUv = uv;
  vCol = aCol;
  vSeed = aSeed;
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const bldFS = /* glsl */ `
uniform vec3 uFog;
uniform float uFogFar;
uniform float uLit;
varying vec2 vUv;
varying vec3 vCol;
varying float vSeed;
varying vec3 vScale;
varying float vDepth;
void main() {
  vec2 e2 = min(vUv, 1.0 - vUv) / fwidth(vUv);
  float edge = 1.0 - min(min(e2.x, e2.y) / 1.2, 1.0);
  vec2 wp = vUv * vec2(vScale.x * 1.6, vScale.y * 1.2);
  vec2 cell = floor(wp);
  vec2 f = fract(wp);
  float win = step(0.25, f.x) * step(f.x, 0.7) * step(0.3, f.y) * step(f.y, 0.62);
  float on = step(0.72, fract(sin(dot(cell + vSeed * 13.0, vec2(12.9898, 78.233))) * 43758.5453));
  float top = smoothstep(0.985, 1.0, vUv.y);
  vec3 col = vec3(0.012, 0.016, 0.035);
  col += vCol * edge * 0.9;
  col += vCol * win * on * 0.55 * uLit;
  col += vCol * top * 1.5;
  float fg = clamp(vDepth / uFogFar, 0.0, 1.0);
  col = mix(col, uFog, pow(fg, 1.4));
  gl_FragColor = vec4(col, 1.0);
}`;

const dustVS = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uSize;
varying float vA;
void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.6 + aSeed * 40.0) * 0.35;
  p.x += cos(uTime * 0.4 + aSeed * 23.0) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.35 + aSeed) * (300.0 / max(0.5, -mv.z));
  gl_Position = projectionMatrix * mv;
  vA = (0.35 + 0.65 * fract(aSeed * 7.31)) * (0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 50.0));
}`;
const dustFS = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(uColor * a * vA * uOpacity, 1.0);
}`;

export const NeonGrid: React.FC<{
  center: [number, number, number];
  color: string;
  color2: string;
  base: string;
  fogColor: string;
  scroll: number;
  cell: number;
  fogDist: number;
  intensity?: number;
  pulse?: number;
  pulseAmt?: number;
}> = ({ center, color, color2, base, fogColor, scroll, cell, fogDist, intensity = 1, pulse = -100, pulseAmt = 0 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: gridVS,
        fragmentShader: gridFS,
        uniforms: {
          uColor: { value: new THREE.Color() },
          uColor2: { value: new THREE.Color() },
          uBase: { value: new THREE.Color() },
          uFogColor: { value: new THREE.Color() },
          uScroll: { value: 0 },
          uCell: { value: 2 },
          uCam: { value: new THREE.Vector3() },
          uFogDist: { value: 140 },
          uIntensity: { value: 1 },
          uPulse: { value: 0 },
          uPulseAmt: { value: 0 },
        },
        fog: false,
      }),
    [],
  );
  mat.uniforms.uColor.value.set(color);
  mat.uniforms.uColor2.value.set(color2);
  mat.uniforms.uBase.value.set(base);
  mat.uniforms.uFogColor.value.set(fogColor);
  mat.uniforms.uScroll.value = scroll;
  mat.uniforms.uCell.value = cell;
  mat.uniforms.uCam.value.set(...center);
  mat.uniforms.uFogDist.value = fogDist;
  mat.uniforms.uIntensity.value = intensity;
  mat.uniforms.uPulse.value = pulse;
  mat.uniforms.uPulseAmt.value = pulseAmt;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={center} material={mat} frustumCulled={false}>
      <planeGeometry args={[900, 900]} />
    </mesh>
  );
};

export const SkyDome: React.FC<{ center: [number, number, number]; top: string; horizon: string; glow: string; glowAmt: number }> = ({ center, top, horizon, glow, glowAmt }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVS,
        fragmentShader: skyFS,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uGlow: { value: new THREE.Color() },
          uGlowAmt: { value: 0.6 },
        },
      }),
    [],
  );
  mat.uniforms.uTop.value.set(top);
  mat.uniforms.uHorizon.value.set(horizon);
  mat.uniforms.uGlow.value.set(glow);
  mat.uniforms.uGlowAmt.value = glowAmt;
  return (
    <mesh position={center} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[520, 32, 16]} />
    </mesh>
  );
};

export const Skyline: React.FC<{ center: [number, number, number]; seed: number; palette: string[]; fogColor: string; lit?: number }> = ({ center, seed, palette, fogColor, lit = 1 }) => {
  const mesh = useMemo(() => {
    const count = 280;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const cols = new Float32Array(count * 3);
    const sds = new Float32Array(count);
    const mat = new THREE.ShaderMaterial({
      vertexShader: bldVS,
      fragmentShader: bldFS,
      uniforms: { uFog: { value: new THREE.Color() }, uFogFar: { value: 420 }, uLit: { value: 1 } },
      fog: false,
    });
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.frustumCulled = false;
    const rand = rng(seed * 17 + 3);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 150 * (0.8 + rand() * 0.6);
      const h = 9 + Math.pow(rand(), 2.2) * 95;
      const w = 4 + rand() * 10;
      const d = 4 + rand() * 10;
      q.setFromAxisAngle(up, rand() * Math.PI);
      m4.compose(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), q, new THREE.Vector3(w, h, d));
      im.setMatrixAt(i, m4);
      c.set(palette[Math.floor(rand() * palette.length)]);
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
      sds[i] = rand();
    }
    geo.setAttribute("aCol", new THREE.InstancedBufferAttribute(cols, 3));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(sds, 1));
    im.instanceMatrix.needsUpdate = true;
    return im;
  }, [seed, palette]);
  const mat = mesh.material as any;
  mat.uniforms.uFog.value.set(fogColor);
  mat.uniforms.uLit.value = lit;
  return <primitive object={mesh} position={center} />;
};

export const Dust: React.FC<{ center: [number, number, number]; time: number; color: string; seed: number; opacity?: number; size?: number }> = ({ center, time, color, seed, opacity = 0.8, size = 1.4 }) => {
  const { geo, mat } = useMemo(() => {
    const count = 1400;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sd = new Float32Array(count);
    const rand = rng(seed * 91 + 7);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * 120;
      pos[i * 3 + 1] = (rand() - 0.5) * 26;
      pos[i * 3 + 2] = (rand() - 0.5) * 200;
      sd[i] = rand();
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(sd, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: dustVS,
      fragmentShader: dustFS,
      uniforms: { uTime: { value: 0 }, uSize: { value: 1.4 }, uColor: { value: new THREE.Color() }, uOpacity: { value: 0.8 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    return { geo: g, mat: m };
  }, [seed]);
  mat.uniforms.uTime.value = time;
  mat.uniforms.uColor.value.set(color);
  mat.uniforms.uOpacity.value = opacity;
  mat.uniforms.uSize.value = size;
  return <points geometry={geo} material={mat} position={center} frustumCulled={false} />;
};

export const OasisBackdrop: React.FC<{ travel: number; seed: number }> = ({ travel, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const t2 = useTheme();
  const { camera } = useThree();
  // 相机缓慢漂移：2D 组件不动，世界在动，比“整张背景平移”更像真实空间。
  const cx = Math.sin(t * 0.07) * 7;
  const cy = 6.2 + Math.sin(t * 0.11) * 0.45;
  const cz = 38 + Math.sin(t * 0.05) * 4;
  camera.position.set(cx, cy, cz);
  camera.lookAt(0, 4.2, -90);
  if (camera instanceof THREE.PerspectiveCamera && camera.fov !== 52) {
    camera.fov = 52;
    camera.near = 0.1;
    camera.far = 1600;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  const palette = [t2.primary, t2.secondary, t2.accent, t2.primary, t2.secondary];
  return (
    <>
      <SkyDome center={[cx, 0, cz - 20]} top={t2.bg} horizon={t2.bg2} glow={t2.secondary} glowAmt={0.6} />
      <Skyline center={[0, -0.05, -260]} seed={seed} palette={palette} fogColor={t2.bg2} />
      <NeonGrid center={[0, 0, -130]} color={t2.primary} color2={t2.secondary} base={t2.bg} fogColor={t2.bg2} scroll={t * 0.35 + travel * 0.003} cell={2.2} fogDist={180} />
      <Dust center={[0, 8, -30]} time={t} color={t2.primary} seed={seed + 5} />
    </>
  );
};
