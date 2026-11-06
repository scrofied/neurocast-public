import React, { useEffect, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  ChromaticAberrationEffect,
} from "postprocessing";
const W = 1920;
const H = 1080;

export type V3 = [number, number, number];
export type Cam = { pos: V3; look: V3; fov?: number; roll?: number };

const CameraRig: React.FC<{ cam: Cam }> = ({ cam }) => {
  const { camera } = useThree();
  const c = camera as any;
  c.position.set(...cam.pos);
  const roll = cam.roll ?? 0;
  c.up.set(Math.sin(roll), Math.cos(roll), 0);
  c.lookAt(...cam.look);
  const fov = cam.fov ?? 45;
  if (c.fov !== fov) c.fov = fov;
  c.near = 0.1;
  c.far = 1600;
  c.aspect = W / H;
  c.updateProjectionMatrix();
  c.updateMatrixWorld();
  return null;
};

const Post: React.FC<{ bloom: number; threshold: number; radius: number; ca: number }> = ({ bloom, threshold, radius, ca }) => {
  const { gl, scene, camera } = useThree();
  const { composer, bloomFx, caFx } = useMemo(() => {
    const comp = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    comp.addPass(new RenderPass(scene, camera));
    const b = new BloomEffect({ intensity: bloom, luminanceThreshold: threshold, luminanceSmoothing: 0.3, mipmapBlur: true, radius });
    const v = new VignetteEffect({ darkness: 0.62, offset: 0.28 });
    const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0004), radialModulation: true, modulationOffset: 0.25 });
    comp.addPass(new EffectPass(camera, b, chroma, v));
    comp.setSize(W, H);
    return { composer: comp, bloomFx: b, caFx: chroma };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);
  bloomFx.intensity = bloom;
  bloomFx.luminanceMaterial.threshold = threshold;
  caFx.offset.set(0.0006 + ca * 0.006, 0.0004 + ca * 0.003);
  useEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => composer.render(), 1);
  return null;
};

export const Stage3D: React.FC<{
  cam: Cam;
  bg?: string;
  fog?: [number, number];
  fogColor?: string;
  bloom?: number;
  threshold?: number;
  radius?: number;
  ca?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ cam, bg = "#03040a", fog = [20, 220], fogColor, bloom = 1.25, threshold = 0.22, radius = 0.75, ca = 0, children, style }) => {
  return (
    <ThreeCanvas
      width={W}
      height={H}
      style={{ position: "absolute", left: 0, top: 0, ...style }}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false, depth: true }}
      camera={{ fov: cam.fov ?? 45, position: cam.pos, near: 0.1, far: 1600 }}
    >
      <CameraRig cam={cam} />
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[fogColor ?? bg, fog[0], fog[1]]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 10, 6]} intensity={1.6} color="#bfe9ff" />
      <directionalLight position={[-8, 3, -4]} intensity={1.2} color="#ff5fd8" />
      {children}
      <Post bloom={bloom} threshold={threshold} radius={radius} ca={ca} />
    </ThreeCanvas>
  );
};

const _cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 1600);
const _v = new THREE.Vector3();
export const project = (cam: Cam, pt: V3): { x: number; y: number; z: number; visible: boolean } => {
  _cam.fov = cam.fov ?? 45;
  _cam.aspect = W / H;
  _cam.position.set(...cam.pos);
  const roll = cam.roll ?? 0;
  _cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  _cam.lookAt(...cam.look);
  _cam.updateProjectionMatrix();
  _cam.updateMatrixWorld();
  _v.set(...pt).project(_cam);
  return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H, z: _v.z, visible: _v.z < 1 };
};

export const glow = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

export type CamKey = [number, V3, V3, number?];
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const camKeys = (t: number, keys: CamKey[], roll = 0): Cam => {
  if (t <= keys[0][0]) return { pos: keys[0][1], look: keys[0][2], fov: keys[0][3] ?? 45, roll };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b[0]) {
      const k = ease((t - a[0]) / (b[0] - a[0]));
      const m = (u: V3, v: V3): V3 => [u[0] + (v[0] - u[0]) * k, u[1] + (v[1] - u[1]) * k, u[2] + (v[2] - u[2]) * k];
      return { pos: m(a[1], b[1]), look: m(a[2], b[2]), fov: (a[3] ?? 45) + ((b[3] ?? 45) - (a[3] ?? 45)) * k, roll };
    }
  }
  const l = keys[keys.length - 1];
  return { pos: l[1], look: l[2], fov: l[3] ?? 45, roll };
};
