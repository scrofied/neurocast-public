import React, { useMemo } from "react";
import * as THREE from "three";
import { V3 } from "./Stage3D";
import { rnd } from "./time";

const cubeVS = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vWN;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = mv.xyz; vN = normalMatrix * normal; vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}`;
const cubeFS = /* glsl */ `
uniform vec3 uBase; uniform vec3 uRimColor; uniform float uRim; uniform vec3 uSeamColor; uniform float uSeam; uniform float uTime; uniform float uOpacity; uniform float uScan;
varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vWN;
float ln(float x, float w) { return 1.0 - smoothstep(0.0, w, abs(x)); }
void main() {
  vec3 n = normalize(vN);
  float fres = pow(1.0 - abs(dot(n, normalize(-vV))), 3.5);
  vec2 u = vUv;
  vec2 b = min(u, 1.0 - u);
  float w = 0.010;
  float seam = ln(min(b.x, b.y) - 0.07, w) * 0.9;
  seam += ln(u.x - 0.5, w) * step(0.07, b.y) * 0.55;
  seam += ln(u.y - 0.5, w) * step(0.07, b.x) * 0.55;
  seam += ln(u.x - 0.27, w * 0.7) * step(0.6, u.y) * step(u.y, 0.93) * 0.45;
  seam += ln(u.y - 0.27, w * 0.7) * step(0.6, u.x) * step(u.x, 0.93) * 0.45;
  seam += ln(u.x - 0.73, w * 0.7) * step(0.07, u.y) * step(u.y, 0.4) * 0.45;
  float flow = 0.55 + 0.45 * sin((u.x * 1.3 + u.y) * 18.0 - uTime * 5.0);
  float top = 0.5 + 0.5 * vWN.y;
  vec3 col = uBase * (0.7 + 0.5 * top);
  col += uRimColor * fres * uRim;
  col += uSeamColor * clamp(seam, 0.0, 1.0) * uSeam * flow;
  float scan = exp(-pow((u.y - fract(uTime * 0.35)) * 30.0, 2.0)) * uScan;
  col += uRimColor * scan * 0.6;
  gl_FragColor = vec4(col, uOpacity);
}`;

export const GlowEdges: React.FC<{ size: number; color: string; intensity?: number; th?: number }> = ({ size, color, intensity = 3, th = 0.03 }) => {
  const s = size / 2;
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, fog: false }), []);
  mat.color.set(color).multiplyScalar(intensity);
  const edges: { p: V3; d: V3 }[] = [];
  for (const a of [-s, s])
    for (const b of [-s, s]) {
      edges.push({ p: [0, a, b], d: [size + th, th, th] });
      edges.push({ p: [a, 0, b], d: [th, size + th, th] });
      edges.push({ p: [a, b, 0], d: [th, th, size + th] });
    }
  return (
    <group>
      {edges.map((e, i) => (
        <mesh key={i} position={e.p} material={mat}>
          <boxGeometry args={e.d} />
        </mesh>
      ))}
    </group>
  );
};

export const BotCube: React.FC<{
  size?: number;
  position?: V3;
  rotation?: V3;
  scale?: number;
  time: number;
  seam?: number;
  seamColor?: string;
  rim?: number;
  rimColor?: string;
  edgeColor?: string;
  edge?: number;
  scan?: number;
  opacity?: number;
}> = ({ size = 2, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, time, seam = 0.4, seamColor = "#ffc83d", rim = 0.55, rimColor = "#36f1ff", edgeColor = "#ffc83d", edge = 3, scan = 0, opacity = 1 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: cubeVS,
        fragmentShader: cubeFS,
        transparent: true,
        uniforms: {
          uBase: { value: new THREE.Color("#05060c") },
          uRimColor: { value: new THREE.Color() },
          uRim: { value: 0.5 },
          uSeamColor: { value: new THREE.Color() },
          uSeam: { value: 0.5 },
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uScan: { value: 0 },
        },
      }),
    [],
  );
  const u = mat.uniforms;
  u.uRimColor.value.set(rimColor);
  u.uRim.value = rim;
  u.uSeamColor.value.set(seamColor).multiplyScalar(2.2);
  u.uSeam.value = seam;
  u.uTime.value = time;
  u.uOpacity.value = opacity;
  u.uScan.value = scan;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh material={mat}>
        <boxGeometry args={[size, size, size]} />
      </mesh>
      {edge > 0 && <GlowEdges size={size} color={edgeColor} intensity={edge} th={size * 0.016} />}
    </group>
  );
};

export const GlowRing: React.FC<{ radius: number; tube?: number; color: string; intensity?: number; position?: V3; rotation?: V3; arc?: number; opacity?: number }> = ({
  radius,
  tube = 0.04,
  color,
  intensity = 3,
  position = [0, 0, 0],
  rotation = [-Math.PI / 2, 0, 0],
  arc = Math.PI * 2,
  opacity = 1,
}) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, fog: false }), []);
  mat.color.set(color).multiplyScalar(intensity);
  mat.opacity = opacity;
  if (arc <= 0.001) return null;
  return (
    <mesh position={position} rotation={rotation} material={mat}>
      <torusGeometry args={[radius, tube, 8, 160, arc]} />
    </mesh>
  );
};

export const Pad: React.FC<{ position?: V3; radius?: number; color?: string; intensity?: number; opacity?: number }> = ({ position = [0, 0, 0], radius = 2, color = "#36f1ff", intensity = 1, opacity = 1 }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#070a14", metalness: 0.7, roughness: 0.35, transparent: true }), []);
  mat.opacity = opacity;
  return (
    <group position={position}>
      <mesh material={mat} position={[0, -0.12, 0]}>
        <cylinderGeometry args={[radius, radius * 1.06, 0.24, 6]} />
      </mesh>
      <GlowRing radius={radius} tube={0.025} color={color} intensity={2.5 * intensity} position={[0, 0.01, 0]} opacity={opacity} />
      <GlowRing radius={radius * 0.8} tube={0.012} color={color} intensity={1.6 * intensity} position={[0, 0.01, 0]} opacity={opacity} />
    </group>
  );
};

export const Crystal: React.FC<{ position?: V3; scale?: number; time: number; color?: string; intensity?: number; opacity?: number }> = ({ position = [0, 0, 0], scale = 1, time, color = "#36f1ff", intensity = 1, opacity = 1 }) => {
  const inner = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true }), []);
  const wire = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, wireframe: true, transparent: true }), []);
  inner.color.set(color).multiplyScalar(1.6 * intensity);
  inner.opacity = 0.55 * opacity;
  wire.color.set(color).multiplyScalar(3 * intensity);
  wire.opacity = opacity;
  return (
    <group position={position} scale={scale} rotation={[time * 0.4, time * 0.9, 0]}>
      <mesh material={inner}>
        <icosahedronGeometry args={[0.6, 0]} />
      </mesh>
      <mesh material={wire} scale={1.35}>
        <icosahedronGeometry args={[0.6, 1]} />
      </mesh>
    </group>
  );
};

const beamVS = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying float vY;
void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`;
const beamFS = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
varying vec3 vN; varying vec3 vV; varying float vY;
void main() {
  float f = abs(dot(normalize(vN), normalize(-vV)));
  float core = pow(f, 2.5);
  float fade = pow(1.0 - vY, 1.6) * smoothstep(0.0, 0.03, vY);
  float flow = 0.75 + 0.25 * sin(vY * 40.0 - uTime * 12.0);
  float a = core * fade * flow * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

export const Beam: React.FC<{ position?: V3; height?: number; radius?: number; color?: string; intensity?: number; opacity?: number; time?: number }> = ({ position = [0, 0, 0], height = 30, radius = 0.6, color = "#ffc83d", intensity = 1.5, opacity = 1, time = 0 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVS,
        fragmentShader: beamFS,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 1 }, uTime: { value: 0 } },
      }),
    [],
  );
  mat.uniforms.uColor.value.set(color).multiplyScalar(intensity);
  mat.uniforms.uOpacity.value = opacity;
  mat.uniforms.uTime.value = time;
  return (
    <mesh position={[position[0], position[1] + height / 2, position[2]]} material={mat}>
      <cylinderGeometry args={[radius * 1.2, radius, height, 40, 1, true]} />
    </mesh>
  );
};

export const NeonBox: React.FC<{ position?: V3; rotation?: V3; size: V3; color: string; intensity?: number; opacity?: number }> = ({ position = [0, 0, 0], rotation = [0, 0, 0], size, color, intensity = 2, opacity = 1 }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, fog: false }), []);
  mat.color.set(color).multiplyScalar(intensity);
  mat.opacity = opacity;
  return (
    <mesh position={position} rotation={rotation} material={mat}>
      <boxGeometry args={size} />
    </mesh>
  );
};

export const NeonLine: React.FC<{ a: V3; b: V3; color: string; th?: number; intensity?: number; opacity?: number; k?: number }> = ({ a, b, color, th = 0.03, intensity = 2.5, opacity = 1, k = 1 }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, fog: false }), []);
  mat.color.set(color).multiplyScalar(intensity);
  mat.opacity = opacity;
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), k);
  const len = va.distanceTo(vb);
  if (len < 1e-4) return null;
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vb.clone().sub(va).normalize());
  return (
    <mesh position={mid} quaternion={q} material={mat}>
      <boxGeometry args={[th, th, len]} />
    </mesh>
  );
};

export const Coins: React.FC<{ count: number; state: (i: number) => { p: V3; r: V3; s: number } | null; emissive?: number }> = ({ count, state, emissive = 0.6 }) => {
  const mesh = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.13, 0.13, 0.03, 28);
    const mat = new THREE.MeshStandardMaterial({ color: "#ffcf4a", metalness: 0.85, roughness: 0.28, emissive: new THREE.Color("#ff9d1a"), emissiveIntensity: emissive });
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.frustumCulled = false;
    return im;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  (mesh.material as any).emissiveIntensity = emissive;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const st = state(i);
    if (!st) m4.makeScale(0.0001, 0.0001, 0.0001);
    else {
      e.set(...st.r);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(...st.p), q, new THREE.Vector3(st.s, st.s, st.s));
    }
    mesh.setMatrixAt(i, m4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return <primitive object={mesh} />;
};

export const fountain = (origin: V3, t: number, t0: number, opts: { spread?: number; up?: number; g?: number; life?: number; rate?: number; seed?: number } = {}) => {
  const { spread = 3, up = 7, g = 9, life = 2.2, rate = 40, seed = 1 } = opts;
  return (i: number) => {
    const born = t0 + i / rate;
    const age = t - born;
    if (age < 0 || age > life) return null;
    const a = rnd(i * 1.7 + seed) * Math.PI * 2;
    const sp = spread * (0.3 + rnd(i * 2.9 + seed) * 0.7);
    const vy = up * (0.7 + rnd(i * 3.3 + seed) * 0.5);
    const p: V3 = [origin[0] + Math.cos(a) * sp * age, origin[1] + vy * age - 0.5 * g * age * age, origin[2] + Math.sin(a) * sp * age];
    const s = Math.min(1, age * 6) * (age > life - 0.3 ? (life - age) / 0.3 : 1);
    return { p, r: [age * 8 + i, age * 5, i] as V3, s };
  };
};
