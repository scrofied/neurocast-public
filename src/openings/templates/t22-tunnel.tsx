import React, { useLayoutEffect, useRef } from "react";
import { useVideoConfig } from "remotion";
import { z } from "zod";
import { easeIn, easeInOut, easeOut, prog } from "../../lib/anim";
import { alpha, useTheme } from "../../lib/theme";
import { Sfx } from "../../lib/sfx";
import { tpl } from "./kit";

// 章节隧道 / 代码雨通道：换自 swap2 的 chapter_tunnel（eng.py + common.py）。
// 上游是 3D 相机穿过代码雨走廊、标题在尽头由远及近；这里用 2D canvas 做透视投影，
// 不依赖 WebGL，也不跟全片 World 抢 ThreeCanvas。自背景，盖在正片之上 2~3 秒。
const sTunnel = z.object({
  num: z.string().default("01").describe("章节编号，如 01"),
  title: z.string().default("原理解析").describe("章节中文标题"),
  sub: z.string().default("CHAPTER 01 // PRINCIPLE").describe("英文小标"),
  color: z.string().optional().describe("主色（#RRGGBB）；缺省用主题 primary"),
});

const h01 = (n: number, seed: number) => {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(61,255,168,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const TunnelCanvas: React.FC<{ frame: number; W: number; H: number; seed: number; color: string }> = ({ frame, W, H, seed, color }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const t = frame / 30;
    const cx = W * 0.5;
    const cy = H * 0.46;
    ctx.clearRect(0, 0, W, H);

    // 透视线：从中心向外冲的短线，越近越亮
    ctx.lineCap = "round";
    for (let i = 0; i < 170; i++) {
      const ang = h01(i + 3, seed) * Math.PI * 2;
      const z = (h01(i + 91, seed) + t * 0.16) % 1;
      const near = 24 + z * z * 980;
      const far = near + 70 + 280 * z;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang) * 0.68;
      ctx.strokeStyle = rgba(color, 0.08 + z * 0.5);
      ctx.lineWidth = 1 + z * 2.4;
      ctx.beginPath();
      ctx.moveTo(cx + dx * near, cy + dy * near);
      ctx.lineTo(cx + dx * far, cy + dy * far);
      ctx.stroke();
    }

    // 字雨：沿同样的径向分布，越近字号越大
    const glyphs = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 260; i++) {
      const ang = h01(i + 17, seed) * Math.PI * 2;
      const z = (h01(i + 53, seed) + t * 0.2) % 1;
      const r = 30 + z * z * 1300;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r * 0.68;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      const size = 9 + z * 34;
      ctx.font = `700 ${size}px "MS Gothic", "Yu Gothic", monospace`;
      ctx.fillStyle = rgba(color, 0.1 + z * 0.75);
      const gi = Math.floor(h01(i + Math.floor(t * 7), seed) * glyphs.length);
      ctx.fillText(glyphs[gi], x, y);
    }

    // 中心压暗，保证标题可读；边缘留出字雨
    const g = ctx.createRadialGradient(cx, cy, 60, cx, cy, Math.max(W, H) * 0.62);
    g.addColorStop(0, "rgba(0, 10, 6, 0.92)");
    g.addColorStop(0.45, "rgba(0, 8, 5, 0.55)");
    g.addColorStop(1, "rgba(0, 6, 4, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 极轻的横向扫描线
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }, [frame, W, H, seed, color]);
  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
};

export const OpTunnel = tpl<z.infer<typeof sTunnel>>({
  id: "op-tunnel",
  name: "模板 · 章节隧道（代码雨通道 → 3D 标题）",
  hook: "章节过场",
  desc: "代码雨从画面中心向外冲成一条透视通道，章节编号/标题在通道尽头由远及近、最后落定成可读的大字；自带深色舞台，2~3 秒后交出正片",
  use: "长视频的章节过场、课程模块切换、上下半场分隔；不适合 15 秒以内短片（会打断钩子）",
  techniques: ["代码雨透视通道", "中心压暗", "3D 标题推近", "章节编号", "落地音效"],
  minSec: 2.2,
  maxSec: 4,
  sec: 2.6,
  selfBg: true,
  chapter: true,
  schema: sTunnel,
  example: { num: "01", title: "原理解析", sub: "CHAPTER 01 // PRINCIPLE" },
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const { width: W, height: H } = useVideoConfig();
    const color = d.color || t.primary;
    const inK = easeOut(prog(frame, 0, 18));
    const out = easeIn(prog(frame, dur - 12, 12));
    const titleIn = easeOut(prog(frame, 12, 20));
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#010805", opacity: 1 - out }}>
        <TunnelCanvas frame={frame} W={W} H={H} seed={seed} color={color} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.5) 100%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 220px ${alpha(color, 0.12)}`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 120, top: 120, fontFamily: t.font.mono, fontSize: 26, letterSpacing: 5, color: alpha(color, 0.75), opacity: inK }}>
          CHAPTER / {d.num}
        </div>
        <div style={{ position: "absolute", left: 120, top: 190, right: 120, opacity: titleIn, transform: `translateY(${(1 - titleIn) * 26}px) scale(${1.08 - 0.08 * titleIn})`, transformOrigin: "left center" }}>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 148, lineHeight: 1.02, color: "#f2fff8", textShadow: `0 0 70px ${alpha(color, 0.55)}, 0 10px 40px rgba(0,0,0,.9)`, whiteSpace: "nowrap" }}>{d.title}</div>
          <div style={{ marginTop: 30, fontFamily: t.font.mono, fontSize: 30, letterSpacing: 4, color: alpha(color, 0.9) }}>{d.sub}</div>
        </div>
        <div style={{ position: "absolute", left: 120, right: 120, bottom: 120, height: 2, background: alpha(color, 0.18) }}>
          <div style={{ width: `${Math.min(100, (frame / Math.max(1, dur)) * 100)}%`, height: "100%", background: color, boxShadow: `0 0 18px ${color}` }} />
        </div>
        <Sfx name="whoosh" at={0} volume={0.4} />
        <Sfx name="riser" at={Math.max(1, Math.round(dur * 0.32))} volume={0.22} />
        <Sfx name="impact" at={12} volume={0.42} />
        <Sfx name="tick" at={16} volume={0.22} />
        <Sfx name="ding" at={Math.round(dur * 0.62)} volume={0.28} />
        <Sfx name="whoosh" at={Math.max(1, dur - 10)} volume={0.2} />
      </div>
    );
  },
  camera: (_d, f, dur) => ({ zoom: 1, x: 0, y: 0, rot: 0, opacity: 1 - easeInOut(prog(f, dur - 12, 12)) }),
});
