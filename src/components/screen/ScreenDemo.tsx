import React from "react";
import { z } from "zod";
import { Img, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { alpha, useTheme } from "../../lib/theme";
import { Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// focus points are normalised 0..1 on the source image
const focusSchema = z.object({ x: z.number(), y: z.number(), w: z.number().optional(), label: z.string().optional(), click: z.boolean().optional() });
const schema = z.object({
  src: z.string(),
  kind: z.enum(["image", "video"]).optional(),
  aspect: z.number().optional(), // width / height of source
  frameStyle: z.enum(["browser", "laptop", "float"]).optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  kicker: z.string().optional(),
  focus: z.array(focusSchema).max(5).optional(),
});
type D = z.infer<typeof schema>;

const Cursor: React.FC<{ x: number; y: number; press: number; color: string }> = ({ x, y, press, color }) => (
  <svg width={44} height={44} style={{ position: "absolute", left: x - 6, top: y - 4, transform: `scale(${1 - press * 0.15})`, filter: `drop-shadow(0 4px 10px rgba(0,0,0,.6)) drop-shadow(0 0 8px ${color})` }}>
    <path d="M6 4 L6 34 L14 26 L20 40 L26 37 L20 24 L32 24 Z" fill="#fff" stroke="#111" strokeWidth={2} strokeLinejoin="round" />
  </svg>
);

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { width, height } = useVideoConfig();
  const style = data.frameStyle ?? (["browser", "laptop", "float"] as const)[variant % 3];
  const aspect = data.aspect ?? 16 / 10;
  // fit screen into a 1320x760 box
  const boxW = 1320;
  const boxH = 720;
  let sw = boxW;
  let sh = sw / aspect;
  let scrollable = false;
  if (sh > boxH) {
    // tall screenshots scroll inside the viewport instead of shrinking
    scrollable = aspect < 0.9;
    if (!scrollable) {
      sh = boxH;
      sw = sh * aspect;
    }
  }
  const viewH = Math.min(sh, boxH);
  const chrome = style === "browser" ? 46 : style === "laptop" ? 22 : 0;
  const fw = sw;
  const fh = viewH + chrome;
  const fx = (width - fw) / 2;
  const fy = (height - fh) / 2 + 60;

  const focus = data.focus ?? [];
  const enter = easeOutBack(prog(frame, 0, 26));
  const settle = 28;
  const n = focus.length;
  const per = n ? Math.max(40, (dur - settle - 20) / n) : 1;
  const fi = n ? clamp(Math.floor((frame - settle) / per), -1, n - 1) : -1;
  const local = fi >= 0 ? frame - settle - fi * per : 0;

  // scroll position for tall screenshots: follow current focus y
  const targetScroll = (fy_: number) => clamp(fy_ * sh - viewH / 2, 0, Math.max(0, sh - viewH));
  const prevF = fi > 0 ? focus[fi - 1] : null;
  const curF = fi >= 0 ? focus[fi] : null;
  const scrollFrom = prevF ? targetScroll(prevF.y) : 0;
  const scrollTo = curF ? targetScroll(curF.y) : 0;
  const move = easeInOut(clamp(local / 22));
  const scroll = scrollable ? lerp(scrollFrom, scrollTo, move) : 0;

  // cursor path in screen coords
  const toScreen = (p: { x: number; y: number }) => ({ x: fx + p.x * sw, y: fy + chrome + p.y * sh - scroll });
  const startC = { x: fx + sw * 0.82, y: fy + chrome + viewH * 0.85 };
  const from = prevF ? toScreen(prevF) : startC;
  const to = curF ? toScreen(curF) : startC;
  const cm = easeInOut(clamp((local - 4) / 20));
  const arc = Math.sin(cm * Math.PI) * -60;
  const cx = lerp(from.x, to.x, cm);
  const cy = lerp(from.y, to.y, cm) + arc;
  const clickAt = 26;
  const press = curF && curF.click !== false ? Math.max(0, 1 - Math.abs(local - clickAt) / 4) : 0;
  const ripple = local - clickAt;

  // zoom push toward focus
  const zoomP = curF ? easeInOut(clamp((local - 30) / 22)) * (1 - easeInOut(clamp((local - per + 14) / 14))) : 0;
  const zoom = 1 + zoomP * 0.55;
  const zx = curF ? to.x : width / 2;
  const zy = curF ? to.y : height / 2;
  const spotR = curF ? (curF.w ?? 0.14) * sw * 0.8 : 200;
  const tiltY = style === "float" ? -14 : -8;
  const rot = (1 - enter) * 30 + tiltY * (1 - zoomP) * (frame < settle ? 1 : 0.35);

  const src = data.src.startsWith("http") ? data.src : staticFile(data.src);

  return (
    <>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${zx}px ${zy}px`, transform: `scale(${zoom})` }}>
        <div
          style={{
            position: "absolute",
            left: fx,
            top: fy,
            width: fw,
            height: fh,
            transform: `perspective(2200px) rotateY(${rot}deg) rotateX(${(1 - enter) * 12 + 3}deg) scale(${0.8 + 0.2 * clamp(enter)})`,
            opacity: clamp(enter * 1.5),
            borderRadius: style === "float" ? 18 : 14,
            overflow: "hidden",
            border: `1.5px solid ${alpha(t.primary, 0.5)}`,
            boxShadow: `0 40px 120px rgba(0,0,0,.7), 0 0 60px ${alpha(t.primary, 0.25)}`,
            background: "#0b0f17",
          }}
        >
          {style === "browser" && (
            <div style={{ height: chrome, background: "#141a26", display: "flex", alignItems: "center", gap: 9, padding: "0 16px", borderBottom: "1px solid #232b3b" }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
              ))}
              <div style={{ marginLeft: 16, flex: 1, height: 28, borderRadius: 14, background: "#0b0f17", color: "#8b97ad", fontFamily: t.font.mono, fontSize: 15, display: "flex", alignItems: "center", padding: "0 16px" }}>
                🔒 {data.url ?? "app.example.com"}
              </div>
            </div>
          )}
          {style === "laptop" && <div style={{ height: chrome, background: "#10141c", display: "flex", justifyContent: "center", alignItems: "center" }}><div style={{ width: 8, height: 8, borderRadius: 4, background: "#222" }} /></div>}
          <div style={{ position: "relative", width: sw, height: viewH, overflow: "hidden" }}>
            {data.kind === "video" ? (
              <OffthreadVideo src={src} muted style={{ width: sw, height: sh }} />
            ) : (
              <Img src={src} style={{ position: "absolute", left: 0, top: -scroll, width: sw, height: sh }} />
            )}
          </div>
        </div>
        {style === "laptop" && (
          <div style={{ position: "absolute", left: fx - 70, top: fy + fh, width: fw + 140, height: 26, borderRadius: "0 0 30px 30px", background: "linear-gradient(#2a3140,#11151d)", opacity: clamp(enter), transform: `perspective(2200px) rotateY(${rot}deg)` }} />
        )}
        {/* spotlight dim */}
        {curF && zoomP > 0.01 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle ${spotR}px at ${to.x}px ${to.y}px, transparent 60%, rgba(0,0,0,${0.62 * zoomP}) 100%)`,
            }}
          />
        )}
        {curF && ripple >= 0 && ripple < 24 && (
          <div style={{ position: "absolute", left: to.x - ripple * 3, top: to.y - ripple * 3, width: ripple * 6, height: ripple * 6, borderRadius: "50%", border: `3px solid ${alpha(t.accent, 1 - ripple / 24)}`, boxShadow: `0 0 20px ${alpha(t.accent, 0.6)}` }} />
        )}
        {curF && curF.label && (() => {
          const lp = easeOutBack(clamp((local - 28) / 14));
          const right = to.x < width * 0.6;
          const bx = right ? to.x + 70 : to.x - 70 - 360;
          return (
            <>
              <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: clamp(lp) }}>
                <line x1={to.x} y1={to.y} x2={right ? bx : bx + 360} y2={to.y - 60} stroke={t.accent} strokeWidth={2} />
                <circle cx={to.x} cy={to.y} r={6} fill={t.accent} />
              </svg>
              <div
                style={{
                  position: "absolute",
                  left: bx,
                  top: to.y - 96,
                  width: 360,
                  padding: "12px 18px",
                  borderRadius: 12,
                  background: alpha(t.bg, 0.9),
                  border: `1.5px solid ${t.accent}`,
                  boxShadow: `0 0 30px ${alpha(t.accent, 0.4)}`,
                  fontFamily: t.font.body,
                  fontWeight: 800,
                  fontSize: 26,
                  color: t.text,
                  transform: `scale(${lp})`,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ flex: "none", width: 34, height: 34, borderRadius: 17, background: t.accent, color: t.bg, fontFamily: t.font.mono, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{fi + 1}</span>
                {curF.label}
              </div>
            </>
          );
        })()}
        {n > 0 && <Cursor x={cx} y={cy} press={press} color={t.primary} />}
      </div>
      <Headline kicker={data.kicker ?? "SCREEN DEMO"} title={data.title} frame={frame} y={70} size={44} />
    </>
  );
};

export const ScreenDemo: CompDef<D> = {
  id: "screen",
  name: "录屏截屏演示（设备框+鼠标+聚焦）",
  layer: "screen",
  variants: 3,
  minSec: 5,
  maxSec: 20,
  tags: ["点击", "打开", "界面", "操作", "设置", "按钮", "菜单", "页面", "截图", "录屏"],
  desc: "截图/录屏装进浏览器或笔记本外框，镜头推到 OCR 定位到的按钮并模拟鼠标点击",
  use: "文案里 [图: x.png] / [录屏: x.mp4] 的操作演示；说明写「点击\"按钮名\"」会自动定位",
  schema,
  example: { src: "assets/demo-shot.png", aspect: 1400 / 3200, frameStyle: "browser", url: "kb.example.com", focus: [{ x: 0.5, y: 0.1, label: "打开知识库" }, { x: 0.5, y: 0.45, label: "上传文档" }] },
  C,
};
