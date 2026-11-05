import React from "react";
import { z } from "zod";
import { Img, OffthreadVideo, useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { assetUrl, MissingAsset } from "../../lib/asset";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// focus points are normalised 0..1 on the source image
const focusSchema = z.object({ x: z.number(), y: z.number(), w: z.number().optional(), label: z.string().optional(), click: z.boolean().optional() });
const schema = z.object({
  src: z.string(),
  kind: z.enum(["image", "video"]).optional(),
  aspect: z.number().optional(), // width / height of source
  frameStyle: z.enum(["browser", "laptop", "float", "full"]).optional().describe('full = 真录屏原样全屏展出（不装设备框、不画鼠标、不推镜头、不加聚焦标签，素材按 contain 铺满不变形），HUD 下方留一行小字标题、右下角留来源角标'),
  url: z.string().optional().describe("真地址栏文案，如 arena.ai/leaderboard。写不出真地址就别用 browser 外框（会自动退成 float）"),
  title: z.string().optional(),
  kicker: z.string().optional(),
  focus: z.array(focusSchema).max(5).optional(),
  source: sourceSchema,
});
type D = z.infer<typeof schema>;

const Cursor: React.FC<{ x: number; y: number; press: number; color: string }> = ({ x, y, press, color }) => (
  <svg width={44} height={44} style={{ position: "absolute", left: x - 6, top: y - 4, transform: `scale(${1 - press * 0.15})`, filter: `drop-shadow(0 4px 10px rgba(0,0,0,.6)) drop-shadow(0 0 8px ${color})` }}>
    <path d="M6 4 L6 34 L14 26 L20 40 L26 37 L20 24 L32 24 Z" fill="#fff" stroke="#111" strokeWidth={2} strokeLinejoin="round" />
  </svg>
);

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const styleOf = data.frameStyle ?? (["browser", "laptop", "float"] as const)[variant % 3];
  // 浏览器外框里那行地址是最容易露馅的：写不出真地址就退成无边框悬浮，不编一个假域名
  const style = styleOf === "browser" && !data.url ? "float" : styleOf;
  const aspect = data.aspect ?? 16 / 10;

  // full：真录屏原样全屏展出——不装设备框、不画鼠标、不推镜头、不加聚焦标签。
  // 素材按 contain 铺满 1920×1080（宽高比不足处留黑边）；录屏本身逐帧静止（首帧就位），
  // 环境慢推镜由 ShotFrame 的 steady 一并关掉；只有左上小字标题和右上来源角标带入场淡入。
  if (style === "full") {
    const eFull = enterAt(frame, 0, { fallback: "rise", dur: 18 });
    const hasFull = !!data.src;
    return (
      <>
        {/* 铺满 1920×1080，黑边交给 objectFit:contain 自己留。
            之前按 data.aspect 手算盒子，但分镜经常忘写 aspect（默认 1.6），
            而录屏素材基本都是 16:9（1386×780=1.777）⇒ 素材被纵向拉伸 11%、上下各裁掉 60px，
            正好违反「录屏原样全屏不包装」。用 contain 后写没写 aspect 都不会变形。 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            background: "#04060a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {!hasFull && <MissingAsset field="src" hint="这里要一段真录屏（原样全屏展出）" w={width} h={height} frame={frame} />}
          {hasFull && (data.kind === "video" ? (
            <OffthreadVideo src={assetUrl(data.src)} muted style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <Img src={assetUrl(data.src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ))}
        </div>
        {(data.kicker || data.title) && (
          <div
            style={{
              position: "absolute",
              left: 26,
              // HUD 占顶部 0~64（章节行 top26、进度轨 top60），录屏原样全屏时素材本身铺满 1080，
              // 这行小字写在 top:10 会和「CH 01/05 ××」压在同一行上糊成一团；放到 HUD 之下
              top: 76,
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              padding: "6px 16px",
              borderRadius: 9,
              background: "rgba(6,10,18,.8)",
              border: `1.2px solid ${alpha(t.primary, 0.5)}`,
              opacity: clamp(eFull.p * 1.6),
              whiteSpace: "nowrap",
            }}
          >
            {data.kicker && <span style={{ fontFamily: t.font.mono, fontSize: 15, letterSpacing: 1.5, color: t.accent }}>{data.kicker}</span>}
            {data.title && <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: 20, color: "#fff" }}>{data.title}</span>}
          </div>
        )}
        {/* 来源角标不能留在右上：那里是 HUD 的计时（00:18），长出处文案会把它压糊。
            也不能贴着字幕带（bottom 52 + 最多两行）：放字幕之上、真人小窗（y≈110~440）之下。
            容器 1×1 + SourceBadge 自带 align:right，从锚点向左长，不会被裁。 */}
        <div style={{ position: "absolute", right: 26, top: height - 196, width: 1, height: 1, opacity: clamp(eFull.p * 1.6) }}>
          <SourceBadge source={data.source} frame={frame} y={0} />
        </div>
      </>
    );
  }

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
  // 设备框原生是 easeOutBack 从 0.8 摆正入画（rise 等价），分镜写 motion.enter 才换
  const eFrame = enterAt(frame, 0, { fallback: "rise", dur: 26, from: 0.8 });
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
  const rot = (1 - eFrame.p) * 30 + tiltY * (1 - zoomP) * (frame < settle ? 1 : 0.35);

  // 讲稿点名的素材没找到（--allow-missing-assets 草稿模式）时路径会被清空 → 演占位；空路径直接上屏会让渲染 404 崩掉
  const has = !!data.src;
  const src = has ? assetUrl(data.src) : "";

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
            transform: `perspective(2200px) rotateY(${rot}deg) rotateX(${(1 - eFrame.p) * 12 + 3}deg) scale(${eFrame.scale})`,
            opacity: clamp(eFrame.p * 1.5),
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
                🔒 {data.url}
              </div>
            </div>
          )}
          {style === "laptop" && <div style={{ height: chrome, background: "#10141c", display: "flex", justifyContent: "center", alignItems: "center" }}><div style={{ width: 8, height: 8, borderRadius: 4, background: "#222" }} /></div>}
          <div style={{ position: "relative", width: sw, height: viewH, overflow: "hidden" }}>
            {!has && <MissingAsset field="src" hint="这里要一张真截图或一段真录屏" w={sw} h={viewH} frame={frame} />}
            {has && (data.kind === "video" ? (
              <OffthreadVideo src={src} muted style={{ width: sw, height: sh }} />
            ) : (
              <Img src={src} style={{ position: "absolute", left: 0, top: -scroll, width: sw, height: sh }} />
            ))}
            {/* 素材来源角标：平台 + 采集时间 + 出处（不填 source 就不渲染）。
                和 cursor-trace 同一个坑：SourceBadge 自己是 absolute + top:y，从锚点往下长；
                直接写 bottom:14 会让它整块掉到容器底边之外，被上面的 overflow:hidden 裁掉
                （1-3 的 p13_codex 那镜逐秒 OCR 就是扫不到「真实素材」）——靠 y=-38 顶回容器内侧。 */}
            <div style={{ position: "absolute", right: 18, bottom: 14, width: 1, height: 1 }}>
              <SourceBadge source={data.source} frame={frame} y={-38} />
            </div>
          </div>
        </div>
        {style === "laptop" && (
          <div style={{ position: "absolute", left: fx - 70, top: fy + fh, width: fw + 140, height: 26, borderRadius: "0 0 30px 30px", background: "linear-gradient(#2a3140,#11151d)", opacity: clamp(eFrame.p), transform: `perspective(2200px) rotateY(${rot}deg)` }} />
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
          const eLabel = enterAt(frame, settle + fi * per + 28, { fallback: "rise", dur: 14, from: 0 });
          const right = to.x < width * 0.6;
          const bx = right ? to.x + 70 : to.x - 70 - 360;
          return (
            <>
              <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: clamp(eLabel.p), transform: `translate(${eLabel.dx}px, ${eLabel.dy}px)` }}>
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
                  transform: `translate(${eLabel.dx}px, ${eLabel.dy}px) scale(${eLabel.scale})`,
                  clipPath: eLabel.clip,
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
  motion: { kind: "设备框带透视摆正入画，鼠标弧线移动点击+涟漪，镜头推近聚焦点、标签回弹弹出", energy: 2 },
  desc: "截图/录屏装进浏览器或笔记本外框，镜头推到 OCR 定位到的按钮并模拟鼠标点击；frameStyle:\"full\" 则原样全屏展出、不加工；右下角可挂「真实素材 | 平台 · 采集时间」来源角标",
  use: "文案里 [图: x.png] / [录屏: x.mp4] 的操作演示；说明写「点击\"按钮名\"」会自动定位。上真截图就写 source（平台+采集日期），写不出真 url 就别用 browser 外框；给了成段录屏要给观众看原片时用 frameStyle:\"full\"",
  schema,
  assetFields: ["src"],
  example: { src: "assets/demo-shot.png", aspect: 1400 / 3200, frameStyle: "browser", url: "lmarena.ai/leaderboard", source: { platform: "LMArena", url: "lmarena.ai", capturedAt: "2026-09-30" }, focus: [{ x: 0.5, y: 0.1, label: "打开知识库" }, { x: 0.5, y: 0.45, label: "上传文档" }] },
  C,
};
