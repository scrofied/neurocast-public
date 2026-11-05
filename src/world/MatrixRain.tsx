import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useTheme } from "../lib/theme";

// 3D 代码雨：换自 swap2「连续世界」的做法（eng.py 的 Field3D + 透视相机）。
// 这里不搬 Python 绘制，而是用 Three.js 的 Points + 字形图集复刻机制：
//   · 每列一个速度/相位，字头下落、字尾上拖；
//   · 相机不动，字场沿 z 轴循环滚动，配合 World 的 travel 产生穿越感；
//   · 字形用 canvas 预生成 8×8 图集，片元里按 gl_PointCoord 采样，一个 draw call 画完。
// 不写死绿色：颜色吃主题 primary，所以 matrix / aurora / violet 皮肤都能用。
const ATLAS_COLS = 8;
const ATLAS_SIZE = 512;
const CELL = ATLAS_SIZE / ATLAS_COLS;
const TRAIL = 16;
const COLUMNS = 1200;
const COUNT = COLUMNS * TRAIL;
const SPAN_Y = 2600;
const SPAN_Z = 3500;

const BASE_GLYPHS = Array.from("アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン");
const EXTRA = Array.from("0123456789<>/\\|=+-*:.¦");
const GLYPHS = [...BASE_GLYPHS, ...EXTRA].slice(0, 64);

const makeAtlas = () => {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = ATLAS_SIZE;
  c.height = ATLAS_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 50px "MS Gothic", "Yu Gothic", monospace';
  GLYPHS.forEach((ch, i) => {
    const x = (i % ATLAS_COLS) * CELL;
    const y = Math.floor(i / ATLAS_COLS) * CELL;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, CELL, CELL);
    ctx.clip();
    ctx.fillText(ch, x + CELL / 2, y + CELL / 2 + 2);
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
};

const mulberry = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const VERT = `
uniform float uTime;
uniform float uTravel;
attribute float aSpeed;
attribute float aTrail;
attribute float aGlyph;
attribute float aSeed;
varying float vGlyph;
varying float vAlpha;
varying float vHead;

void main() {
  vec3 p = position;
  // 字头下落，字尾（aTrail=1）在字头上方拖出轨迹
  p.y = mod(p.y - uTime * aSpeed * 260.0, ${SPAN_Y.toFixed(1)}) - ${(SPAN_Y / 2).toFixed(1)};
  p.y += aTrail * 24.0;
  // 字场沿 z 循环，travel 越大越像在往前穿；相机在 z=400，所以只放在相机前方
  p.z = mod(p.z + uTravel, ${SPAN_Z.toFixed(1)}) - ${SPAN_Z.toFixed(1)} + 300.0;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(68.0 * (300.0 / max(depth, 1.0)), 2.0, 72.0);

  vGlyph = mod(aGlyph + floor(uTime * 5.0 + aSeed * 40.0), ${ATLAS_COLS * ATLAS_COLS}.0);
  vHead = 1.0 - step(0.02, aTrail);
  float depthFade = 1.0 - smoothstep(300.0, 3000.0, depth);
  vAlpha = (1.0 - aTrail * 0.72) * (0.45 + 0.55 * aSeed) * depthFade;
  vAlpha *= 1.0 + 0.35 * vHead;
  if (depth < 1.0) vAlpha = 0.0;
}
`;

const FRAG = `
uniform sampler2D uAtlas;
uniform vec3 uColor;
uniform vec3 uHeadColor;
varying float vGlyph;
varying float vAlpha;
varying float vHead;

void main() {
  vec2 cell = vec2(mod(vGlyph, ${ATLAS_COLS}.0), floor(vGlyph / ${ATLAS_COLS}.0));
  // gl_PointCoord 原点在左上，纹理 UV 原点在左下，y 翻一次
  vec2 local = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
  vec2 uv = (cell + local) / ${ATLAS_COLS}.0;
  float a = texture2D(uAtlas, uv).a * vAlpha;
  if (a < 0.02) discard;
  vec3 col = mix(uColor, uHeadColor, vHead);
  gl_FragColor = vec4(col, a);
}
`;

export const MatrixRain: React.FC<{ travel: number; seed: number }> = ({ travel, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();
  const atlas = useMemo(makeAtlas, []);
  const geometry = useMemo(() => {
    const rng = mulberry(seed * 9301 + 49297);
    const pos = new Float32Array(COUNT * 3);
    const speed = new Float32Array(COUNT);
    const trail = new Float32Array(COUNT);
    const glyph = new Float32Array(COUNT);
    const gseed = new Float32Array(COUNT);
    for (let c = 0; c < COLUMNS; c++) {
      const x = (rng() - 0.5) * 3000;
      const z = -SPAN_Z + 300 + rng() * SPAN_Z;
      const sp = 0.35 + rng() * 0.95;
      const colSeed = Math.floor(rng() * 64);
      const y0 = (rng() - 0.5) * SPAN_Y;
      for (let k = 0; k < TRAIL; k++) {
        const i = c * TRAIL + k;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y0;
        pos[i * 3 + 2] = z;
        speed[i] = sp;
        trail[i] = k / (TRAIL - 1);
        glyph[i] = (colSeed + k * 7) % 64;
        gseed[i] = rng();
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    g.setAttribute("aTrail", new THREE.BufferAttribute(trail, 1));
    g.setAttribute("aGlyph", new THREE.BufferAttribute(glyph, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(gseed, 1));
    return g;
  }, [seed]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTravel: { value: 0 },
      uAtlas: { value: atlas },
      uColor: { value: new THREE.Color(t.primary) },
      uHeadColor: { value: new THREE.Color("#e8fff2") },
    }),
    [atlas, t.primary],
  );

  uniforms.uTime.value = frame / fps;
  uniforms.uTravel.value = travel;
  uniforms.uColor.value.set(t.primary);
  if (!atlas) return null;

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
