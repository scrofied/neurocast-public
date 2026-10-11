import React from "react";
import { z } from "zod";
import { Img, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { clamp, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { shake } from "../../lib/cine/motion";
import { RingBurst, SpeedLines } from "../../lib/cine/Flash";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, ink, rnd, Stage, tpl } from "../templates/kit";

// 《什么是AI控制AI》专属开场（2026-10-10）
// 沿用上一条片已过审的 v10.3 骨架（AI 生图底 + 透明底 3D 大字 + 录屏锚词入画 + 真人揭幕 + 金章），
// 但背景图 / 3D 字都是本片新生成的紫色版，文案、卡点、痛点段落全部按本片配音重排：
// ① 0 → 「以前同时」：第 0 帧 闪白+双冲击环+速度线+3D 大标题砸入（AI 生图紫色指挥台底）；
//    「以前同时」（painVidAt）「两三个 AI 工具、六个窗口来回搬」的实录原样全屏，
//    痛点词条在底部逐条替换（≤2.5s 必有一次画面变化）；
// ② 「我做了」（pill.at）：痛点录屏收走，工作台 console_hold 全屏拉开 + 胶囊弹出，
//    「工作台$」标题飞出，底部要点按配音词时逐条弹（我说目标 / AI拆任务派活 / 其他AI执行 / 结果回到这里）；
// ③ stageAt（锚「回到这里$+0.3」）：console 淡出、真人全屏入画（presenter.showFrom 同帧），
//    要点脉冲高亮、右侧金章「各干长处」盖章；presenter.full 收右上小窗，交棒正片。

const s = z.object({
  points: z.array(z.string()).min(2).max(5).default(["什么是AI控制AI", "我说目标", "AI拆任务派活", "其他AI执行", "结果回到这里"]).describe("points[0]=大标题，其余为底部逐条弹出的要点"),
  ats: z.array(z.number()).default([0, 14.72, 16.1, 17.76, 19.2]).describe("每条要点出现秒数（对齐配音真实词时）"),
  title: z.string().default("").describe("预留字段（本版不显示）"),
  look: z.string().default("violet").describe("预留字段（本版不显示）"),
  pill: z.object({ text: z.string(), at: z.number() }).optional().describe("标题下方胶囊（at=帧，锚「我做了」）"),
  titleOutAt: z.number().default(427).describe("大标题向上飞出的帧（锚「工作台$」）"),
  console: z.string().default("").describe("工作台实录（锚「我做了」全屏入场）"),
  painVid: z.string().default("").describe("痛点实录：「以前…六个窗口来回搬」原样全屏（空 = 不播）"),
  painVidAt: z.number().default(0).describe("痛点实录入场帧（锚「以前同时」）"),
  pain: z.array(z.object({ text: z.string(), at: z.number() })).default([]).describe("底部痛点词条，逐条替换（at=帧）"),
  bgArt: z.string().default("").describe("第一屏背景：AI 生图（cover 铺满 + 缓慢推近）。空 = 用代码画的全息指挥台 Deck"),
  titleArt: z.string().default("").describe("第一屏大标题：AI 生图 3D 字（透明底 PNG）。空 = 用代码字"),
  artScrim: z.number().default(0.3).describe("AI 背景中心压暗强度 0~1"),
  stamp: z.object({ text: z.string(), at: z.number() }).optional().describe("右侧金章（at=帧）"),
  stageAt: z.number().default(623).describe("揭幕帧（锚「回到这里$+0.3」，真人全屏入画）"),
  side: z.enum(["left", "right"]).default("left").describe("预留字段"),
  kind: z.string().optional(),
  aspect: z.number().optional(),
});
type D = z.infer<typeof s>;

const HX = 960;
const HY = 556;
const DECK_Y = 664;
const NODES = 6;
// 本片 3D 标题图裁边后 1610×268（透明底），保持宽高比铺到 1420 宽
const TITLE_W = 1420;
const TITLE_H = Math.round((TITLE_W * 268) / 1610);

const Deck: React.FC<{ frame: number; seed: number; dim: number }> = ({ frame, seed, dim }) => {
  const t = useTheme();
  if (dim <= 0.004) return null;

  const inP = easeOut(prog(frame, 0, 20));
  const op0 = 0.82 + 0.18 * inP;
  const push = lerp(1.14, 1, inP) + 0.012 * Math.sin(frame / 26);
  const sh = shake(frame, 0, 13, 11, seed);
  const g = (v: string) => alpha(v, 1);

  const floor: React.ReactNode[] = [];
  const rows = 15;
  const flow = ((frame * 1.05) % 22) / 22;
  for (let i = 0; i < rows; i++) {
    const k = (i + flow) / rows;
    const y = HY + Math.pow(k, 2.7) * (1080 - HY) * 1.06;
    const half = 180 + Math.pow(k, 1.35) * 1750;
    floor.push(<line key={`fr${i}`} x1={HX - half} y1={y} x2={HX + half} y2={y} stroke={t.primary} strokeWidth={0.8 + 2.2 * k} opacity={0.05 + 0.3 * k * k} />);
    const yc = HY - (y - HY) * 0.52;
    floor.push(<line key={`ce${i}`} x1={HX - half * 0.9} y1={yc} x2={HX + half * 0.9} y2={yc} stroke={t.secondary} strokeWidth={0.7 + 1.2 * k} opacity={0.03 + 0.11 * k * k} />);
  }
  for (let j = -9; j <= 9; j++) {
    const x1 = HX + j * 26;
    const x2 = HX + j * 300;
    floor.push(<line key={`vf${j}`} x1={x1} y1={HY} x2={x2} y2={1080} stroke={t.primary} strokeWidth={1.1} opacity={0.09} />);
    floor.push(<line key={`vc${j}`} x1={x1} y1={HY} x2={x2} y2={1080 - (1080 - HY) * 2 * 0.52} stroke={t.secondary} strokeWidth={0.9} opacity={0.05} />);
  }

  const dust: React.ReactNode[] = [];
  for (let i = 0; i < 52; i++) {
    const a = rnd(i, seed + 1) * Math.PI * 2;
    const sp = 0.006 + rnd(i, seed + 2) * 0.019;
    const k = (frame * sp + rnd(i, seed + 3)) % 1;
    const r = Math.pow(k, 1.9) * 1450;
    const x = HX + Math.cos(a) * r;
    const y = HY + Math.sin(a) * r * 0.66;
    const r2 = Math.max(0, r - 40 - 150 * k * k);
    dust.push(<line key={`d${i}`} x1={HX + Math.cos(a) * r2} y1={HY + Math.sin(a) * r2 * 0.66} x2={x} y2={y} stroke={i % 5 === 0 ? t.accent : t.primary} strokeWidth={0.9 + 2.4 * k} opacity={0.14 + 0.5 * k} />);
  }

  const rings = [300, 430, 560, 700].map((rx, i) => (
    <ellipse
      key={`rg${i}`}
      cx={HX}
      cy={DECK_Y}
      rx={rx}
      ry={rx * 0.285}
      fill="none"
      stroke={i === 2 ? t.accent : t.primary}
      strokeWidth={i === 2 ? 2.4 : 1.6}
      strokeDasharray={i % 2 ? "26 18" : "70 26"}
      strokeDashoffset={(i % 2 ? 1 : -1) * frame * (2.2 + i * 0.7)}
      opacity={i === 2 ? 0.5 : 0.28}
    />
  ));
  const nodeAt = (i: number) => {
    const a = (i / NODES) * Math.PI * 2 + frame * 0.0075;
    return { x: HX + Math.cos(a) * 560, y: DECK_Y + Math.sin(a) * 560 * 0.285, front: Math.sin(a) > -0.15 };
  };
  const core = 1 + 0.07 * Math.sin(frame / 7);
  const deck: React.ReactNode[] = [];
  for (let i = 0; i < NODES; i++) {
    const n = nodeAt(i);
    const col = n.front ? t.primary : alpha(t.primary, 0.45);
    deck.push(<line key={`sp${i}`} x1={HX} y1={DECK_Y} x2={n.x} y2={n.y} stroke={col} strokeWidth={1.4} opacity={0.32} />);
    const kOut = (frame * 0.021 + i * 0.17) % 1;
    const kIn = 1 - ((frame * 0.016 + i * 0.41) % 1);
    deck.push(<circle key={`po${i}`} cx={lerp(HX, n.x, kOut)} cy={lerp(DECK_Y, n.y, kOut)} r={3 + 3 * kOut} fill={t.accent} opacity={0.35 + 0.6 * kOut} />);
    deck.push(<circle key={`pi${i}`} cx={lerp(HX, n.x, kIn)} cy={lerp(DECK_Y, n.y, kIn)} r={2.6} fill={t.secondary} opacity={0.55 * kIn} />);
    const sz = n.front ? 1 : 0.72;
    deck.push(
      <g key={`nd${i}`} opacity={n.front ? 1 : 0.5}>
        <circle cx={n.x} cy={n.y} r={26 * sz} fill="none" stroke={col} strokeWidth={2.2} />
        <circle cx={n.x} cy={n.y} r={11 * sz} fill={t.accent} opacity={0.85} />
        <text x={n.x} y={n.y + 46 * sz} textAnchor="middle" fill={col} fontFamily={t.font.mono} fontSize={17} letterSpacing={2}>
          {`AI-0${i + 1}`}
        </text>
      </g>,
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, opacity: dim }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(125% 95% at 50% 46%, #140a26 0%, #0a0518 52%, #030108 100%)" }} />
      <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: `scale(${push}) translate(${sh.x}px,${sh.y}px)`, transformOrigin: "50% 46%" }}>
        <g opacity={0.55 + 0.45 * inP}>
          {floor}
          {dust}
        </g>
        <rect x={0} y={HY - 1.5} width={1920} height={3} fill="url(#ac-hz2)" opacity={0.5} />
        <defs>
          <linearGradient id="ac-hz2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={alpha(t.primary, 0)} />
            <stop offset="50%" stopColor={g(t.accent)} />
            <stop offset="100%" stopColor={alpha(t.primary, 0)} />
          </linearGradient>
          <radialGradient id="ac-coreGlow2">
            <stop offset="0%" stopColor={alpha(t.accent, 0.85)} />
            <stop offset="45%" stopColor={alpha(t.primary, 0.3)} />
            <stop offset="100%" stopColor={alpha(t.primary, 0)} />
          </radialGradient>
        </defs>
        <g opacity={op0}>
          {rings}
          {deck}
          <circle cx={HX} cy={DECK_Y} r={190 * core} fill="url(#ac-coreGlow2)" opacity={0.55} />
          <circle cx={HX} cy={DECK_Y} r={44 * core} fill="none" stroke={t.accent} strokeWidth={3} opacity={0.9} />
          <circle cx={HX} cy={DECK_Y} r={20 * core} fill={t.accent} />
        </g>
      </svg>
      <Hud frame={frame} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(78% 62% at 50% 44%, rgba(0,0,0,0) 40%, rgba(0,0,0,.62) 100%)" }} />
    </div>
  );
};

const Hud: React.FC<{ frame: number }> = ({ frame }) => {
  const t = useTheme();
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, height: 150, top: ((frame * 26) % 1230) - 150, background: `linear-gradient(180deg, rgba(0,0,0,0), ${alpha(t.primary, 0.11)} 60%, ${alpha(t.accent, 0.16)})`, mixBlendMode: "screen" }} />
      {[
        { l: 46, t: 118, b: 0, r: 0 },
        { l: 0, t: 118, b: 0, r: 46 },
        { l: 46, t: 0, b: 46, r: 0 },
        { l: 0, t: 0, b: 46, r: 46 },
      ].map((p, i) => (
        <div key={`hd${i}`} style={{ position: "absolute", left: p.l, right: p.r || undefined, top: p.t || undefined, bottom: p.b || undefined, width: 62, height: 62, borderTop: p.t ? `3px solid ${alpha(t.primary, 0.55)}` : undefined, borderBottom: p.b ? `3px solid ${alpha(t.primary, 0.55)}` : undefined, borderLeft: p.l ? `3px solid ${alpha(t.primary, 0.55)}` : undefined, borderRight: p.r ? `3px solid ${alpha(t.primary, 0.55)}` : undefined }} />
      ))}
      <div style={{ position: "absolute", left: 60, top: 196, fontFamily: t.font.mono, fontSize: 20, letterSpacing: 4, color: alpha(t.primary, 0.62) }}>
        CORE ▸ ONLINE
        <br />
        NODES ▸ 06
      </div>
      <div style={{ position: "absolute", right: 60, top: 196, textAlign: "right", fontFamily: t.font.mono, fontSize: 20, letterSpacing: 4, color: alpha(t.primary, 0.62) }}>
        MODE ▸ AUTO
        <br />
        LINKS ▸ {String(Math.floor(frame / 3) % 999).padStart(3, "0")}
      </div>
    </>
  );
};

// 第一屏：AI 生图紫色指挥台底（cover 铺满 + 推近 + 冲击抖动），HUD/压暗在上
const ArtBg: React.FC<{ src: string; frame: number; seed: number; dim: number; scrim: number }> = ({ src, frame, seed, dim, scrim }) => {
  const t = useTheme();
  if (!src || dim <= 0.004) return null;
  const inP = easeOut(prog(frame, 0, 24));
  const push = lerp(1.15, 1.015, inP) + 0.014 * Math.sin(frame / 30);
  const sh = shake(frame, 0, 13, 11, seed);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: dim }}>
      <div style={{ position: "absolute", inset: 0, background: t.bg }} />
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "50% 54%",
          transform: `scale(${push}) translate(${sh.x}px,${sh.y}px)`,
          transformOrigin: "50% 46%",
          filter: `saturate(1.12) brightness(${(0.92 + 0.08 * Math.sin(frame / 17)).toFixed(3)})`,
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(72% 54% at 50% 42%, rgba(2,1,8,${scrim}) 0%, rgba(2,1,8,${(scrim * 0.5).toFixed(3)}) 58%, rgba(2,1,8,0) 100%)` }} />
      <Hud frame={frame} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(86% 70% at 50% 46%, rgba(0,0,0,0) 46%, rgba(0,0,0,.66) 100%)" }} />
    </div>
  );
};

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const stage = d.stageAt;
  const chips = d.points.slice(1, 5).map((text, i) => ({ text, at: (d.ats[i + 1] ?? 0) * fps }));

  const scrAt = d.pill?.at ?? 0; // 工作台录屏入场（锚「我做了」）
  const painAt = d.painVid ? d.painVidAt : scrAt; // 痛点录屏更早入场
  const firstAt = Math.min(painAt, scrAt);

  const p1 = 1 - clamp(easeOut(prog(frame, stage, 12)));
  const flash0 = 1 - easeOut(prog(frame, 0, 6));
  const tSlam = easeOut(clamp(prog(frame, 0, 9)));
  const slamFrom = d.titleArt ? 1.3 : 1.58;
  const tOutP = clamp(easeOut(prog(frame, d.titleOutAt, 12)));
  const pillIn = d.pill ? easeOutBack(prog(frame, d.pill.at, 8)) : 0;
  const pillOut = d.pill ? 1 - clamp(easeOut(prog(frame, d.ats[1] * fps - 18, 10))) : 1;
  const scrP = clamp(easeOut(prog(frame, scrAt, 10))); // 工作台拉开
  const painP = clamp(easeOut(prog(frame, painAt, 10))); // 痛点录屏拉开
  const painOut = d.painVid ? 1 - clamp(easeOut(prog(frame, scrAt - 8, 10))) : 1; // 「我做了」时收走
  const introOut = 1 - clamp(easeOut(prog(frame, Math.max(6, firstAt - 16), 14)));
  const glow = frame >= stage ? 1 - clamp(easeOut(prog(frame, stage, 22))) : 0;
  const endOut = 1 - clamp(easeOut(prog(frame, dur - 8, 8)));

  const aspect = d.aspect ?? 1440 / 738;
  const fw = aspect >= 16 / 9 ? 1920 : Math.round(1080 * aspect);
  const fh = Math.round(fw / aspect);
  const fx = (1920 - fw) / 2;
  const fy = (1080 - fh) / 2;

  const stampIn = d.stamp ? easeOutBack(prog(frame, d.stamp.at, 9)) : 0;

  const title = d.points[0] ?? "";
  const hi = title.indexOf("控制");
  const titleEl =
    hi >= 0 ? (
      <>
        {title.slice(0, hi)}
        <span style={{ color: t.accent }}>{title.slice(hi, hi + 2)}</span>
        {title.slice(hi + 2)}
      </>
    ) : (
      title
    );

  // 痛点词条：逐条替换（下一条出口前 6 帧收走上一条，最后一条在录屏收走时一起退）
  const painCur = (() => {
    let idx = -1;
    for (let i = 0; i < d.pain.length; i++) if (frame >= d.pain[i].at) idx = i;
    return idx;
  })();
  const painP0 = painCur >= 0 ? d.pain[painCur].at : 0;
  const painNext = painCur + 1 < d.pain.length ? d.pain[painCur + 1].at : scrAt;
  const painPop = painCur >= 0 ? easeOutBack(prog(frame, painP0, 8)) : 0;
  const painFade = painCur >= 0 ? 1 - clamp(easeOut(prog(frame, painNext - 6, 6))) : 0;

  return (
    <>
      {frame < stage + 12 && (
        <div style={{ position: "absolute", inset: 0, opacity: p1 }}>
          {d.bgArt ? (
            <ArtBg src={d.bgArt} frame={frame} seed={seed} dim={1 - clamp(easeOut(prog(frame, firstAt, 10))) * 0.9} scrim={d.artScrim} />
          ) : (
            <Deck frame={frame} seed={seed} dim={1 - clamp(easeOut(prog(frame, firstAt, 10))) * 0.9} />
          )}
          {/* 痛点实录：锚「以前同时」原样全屏（不装框、不加工），「我做了」时收走 */}
          {d.painVid && painAt < scrAt && (
            <Sequence from={painAt}>
              <div style={{ position: "absolute", left: fx, top: fy, width: fw, height: fh, overflow: "hidden", opacity: clamp(painP * 1.15) * painOut, transform: `scale(${lerp(1.04, 1, painP)})`, transformOrigin: "50% 50%" }}>
                <OffthreadVideo src={staticFile(d.painVid)} muted style={{ width: fw, height: fh }} />
              </div>
            </Sequence>
          )}
          {/* 工作台实录：锚「我做了」拉开入场（原片全屏 contain） */}
          <Sequence from={scrAt}>
            <div style={{ position: "absolute", left: fx, top: fy, width: fw, height: fh, overflow: "hidden", opacity: clamp(scrP * 1.15), transform: `scale(${lerp(1.05, 1, scrP)})`, transformOrigin: "50% 50%" }}>
              <OffthreadVideo src={staticFile(d.console)} muted style={{ width: fw, height: fh }} />
            </div>
          </Sequence>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(56% 40% at 50% 38%, ${alpha("#ffffff", 0.42)}, ${alpha("#ffffff", 0.12)} 55%, rgba(255,255,255,0) 78%)`, opacity: clamp(flash0), mixBlendMode: "screen" }} />
          <RingBurst frame={frame} at={0} x={HX} y={470} color={alpha(t.primary, 0.65)} len={24} maxR={1180} width={10} />
          <RingBurst frame={frame} at={5} x={HX} y={470} color={alpha(t.accent, 0.6)} len={20} maxR={820} width={6} />
          <SpeedLines frame={frame} at={0} x={HX} y={470} color={alpha(t.primary, 0.55)} len={16} count={34} inner={430} seed={seed} />
          {frame < d.titleOutAt + 14 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 300,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: 1 - tOutP,
                transform: `translateY(${lerp(-90, 0, tSlam) - tOutP * 170}px) scale(${lerp(slamFrom, 1, tSlam)})`,
              }}
            >
              <div style={{ marginBottom: 30, clipPath: `inset(0 ${(1 - easeOut(prog(frame, 10, 12))) * 100}% 0 -2%)`, opacity: introOut }}>
                <span style={{ fontFamily: t.font.mono, fontSize: 30, fontWeight: 700, letterSpacing: 16, paddingLeft: 16, color: t.primary, textShadow: `0 0 26px ${alpha(t.primary, 0.75)}` }}>AI CONTROLS AI</span>
              </div>
              {d.titleArt ? (
                <div style={{ position: "relative", width: TITLE_W, height: TITLE_H }}>
                  <Img src={staticFile(d.titleArt)} style={{ position: "absolute", inset: -20, width: TITLE_W + 40, height: TITLE_H + 40, objectFit: "contain", filter: "blur(24px) saturate(1.6)", opacity: 0.45 + 0.2 * Math.sin(frame / 11) }} />
                  <Img src={staticFile(d.titleArt)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: `drop-shadow(0 12px 26px rgba(0,0,0,.8)) brightness(${(1 + 0.1 * Math.sin(frame / 13)).toFixed(3)})` }} />
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <span aria-hidden style={{ position: "absolute", left: 0, top: 0, ...ink(150, t.accent, t.font.title, 12), filter: "blur(28px)", opacity: 0.45 + 0.2 * Math.sin(frame / 11) }}>{titleEl}</span>
                  <span style={{ ...ink(150, t.text, t.font.title, 12), letterSpacing: 4, textShadow: `0 6px 0 #000, 0 14px 34px rgba(0,0,0,.6), 0 0 74px ${alpha(t.primary, 0.55)}` }}>{titleEl}</span>
                </div>
              )}
              <div style={{ position: "relative", marginTop: 34, height: 7, width: 1180 * easeOut(prog(frame, 6, 16)), opacity: introOut }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: 4, background: `linear-gradient(90deg, rgba(0,0,0,0), ${t.accent} 16%, ${t.primary} 50%, ${t.accent} 84%, rgba(0,0,0,0))`, boxShadow: `0 0 30px ${alpha(t.accent, 0.75)}` }} />
                <div style={{ position: "absolute", left: "50%", top: -9, width: 2, height: 25, background: alpha(t.accent, 0.75) }} />
              </div>
            </div>
          )}
          {d.pill && pillIn > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 602, display: "flex", justifyContent: "center", opacity: clamp(pillIn * 3) * pillOut }}>
              <div style={{ transform: `scale(${0.6 + 0.4 * Math.min(1.1, pillIn)})` }}>
                <span style={{ ...ink(50, t.text, t.font.title, 7), padding: "12px 40px", borderRadius: 999, background: alpha(t.bg, 0.72), border: `3px solid ${alpha(t.gold, 0.8)}`, boxShadow: "0 10px 30px rgba(0,0,0,.5)", whiteSpace: "nowrap" }}>{d.pill.text}</span>
              </div>
            </div>
          )}
          {/* 痛点词条：底部居中的一条（逐条替换），录屏收走时一起退 */}
          {painPop > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 938, display: "flex", justifyContent: "center", opacity: clamp(painPop * 2.5) * painFade * painOut }}>
              <div style={{ transform: `scale(${0.6 + 0.4 * Math.min(1.1, painPop)})`, display: "flex", alignItems: "center", gap: 14, padding: "13px 30px", borderRadius: 999, background: "rgba(10,4,22,.82)", border: `2px solid ${alpha(t.accent, 0.6)}`, boxShadow: `0 0 24px ${alpha(t.accent, 0.3)}` }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: t.accent, boxShadow: `0 0 12px ${t.accent}` }} />
                <span style={{ ...ink(30, t.text, t.font.title, 5), whiteSpace: "nowrap" }}>{d.pain[painCur]?.text}</span>
              </div>
            </div>
          )}
          <Sfx name="impact" at={0} volume={0.5} />
          {d.painVid && <Sfx name="whoosh" at={painAt} volume={0.22} />}
          {d.pill && <Sfx name="ding" at={d.pill.at} volume={0.3} />}
          <Sfx name="whoosh" at={scrAt} volume={0.22} />
        </div>
      )}

      {chips.length > 0 && frame >= chips[0].at - 6 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 938, display: "flex", justifyContent: "center", gap: 22, opacity: endOut, transform: `translateY(${(1 - endOut) * 16}px)` }}>
          {chips.map((c, i) => {
            const en = easeOutBack(prog(frame, c.at, 9));
            if (en <= 0) return null;
            return (
              <div
                key={c.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 26px",
                  borderRadius: 999,
                  background: "rgba(6,10,18,.8)",
                  border: `2px solid ${alpha(t.primary, 0.55 + 0.4 * glow)}`,
                  boxShadow: `0 0 ${26 * glow + 10}px ${alpha(t.accent, 0.35 + 0.5 * glow)}`,
                  opacity: clamp(en * 2.2),
                  transform: `scale(${0.55 + 0.45 * Math.min(1.12, en)})`,
                }}
              >
                <span style={{ width: 34, height: 34, borderRadius: 17, background: alpha(t.accent, 0.18 + 0.5 * glow), border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.font.mono, fontWeight: 700, fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <span style={{ ...ink(29, t.text, t.font.title, 5), whiteSpace: "nowrap" }}>{c.text}</span>
              </div>
            );
          })}
          <Sfx name="pop" at={chips[0]?.at ?? 0} volume={0.22} />
          <Sfx name="pop" at={chips[1]?.at ?? 0} volume={0.22} />
          <Sfx name="pop" at={chips[2]?.at ?? 0} volume={0.22} />
          <Sfx name="pop" at={chips[3]?.at ?? 0} volume={0.22} />
        </div>
      )}

      {frame >= stage - 4 && (
        <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: stage, amp: 6, len: 5 }, ...(d.stamp ? [{ at: d.stamp.at, amp: 8, len: 6 }] : [])]} exit="fade" outLen={8}>
          {d.stamp && stampIn > 0 && (
            <div style={{ position: "absolute", right: 130, top: 380, opacity: clamp(stampIn * 3), transform: `scale(${0.55 + 0.45 * Math.min(1.12, stampIn)}) rotate(-7deg)`, transformOrigin: "50% 50%" }}>
              <div style={{ padding: "20px 40px", borderRadius: 18, border: `6px double ${t.gold}`, background: alpha(t.bg, 0.5), boxShadow: `0 0 40px ${alpha(t.gold, 0.35)}` }}>
                <span style={{ ...ink(72, t.gold, t.font.title, 10), whiteSpace: "nowrap" }}>{d.stamp.text}</span>
              </div>
            </div>
          )}
          <Sfx name="whoosh" at={stage} volume={0.28} />
          {d.stamp && <Sfx name="stamp" at={d.stamp.at} volume={0.45} />}
          {d.stamp && <Sfx name="ding" at={d.stamp.at + 8} volume={0.35} />}
        </Stage>
      )}
    </>
  );
};

export const OpeningAiconsoleExplainer: CompDef<D> = {
  ...tpl<D>({
    id: "opening-aiconsole-explainer",
    name: "开场 · 紫色指挥台大字先行→痛点实录→工作台实录→真人揭幕→盖章",
    hook: "AI 生图紫底 3D 大字 + 痛点/工作台两段实录锚词入画 + 要点逐条",
    desc: "0→「以前同时」：第 0 帧 闪白+双冲击环+速度线+AI 生图 3D 大标题砸入（紫色全息指挥台底，持续推近+HUD 扫掠）；锚「以前同时」痛点实录（两三个工具·六个窗口来回搬）原样全屏，底部痛点词条逐条替换；锚「我做了」工作台实录全屏拉开+胶囊弹出、「工作台$」标题飞出、四条要点按配音词时逐条弹；stageAt（锚「回到这里$+0.3」）录屏淡出、真人全屏入画、要点脉冲高亮、右侧金章「各干长处」盖章；presenter.full 收右上小窗、开场收尾交棒",
    use: "只给《什么是AI控制AI》用（开场不重样）",
    techniques: ["AI 生图紫底+透明 3D 字", "大字先行撑留存", "痛点实录锚词入画", "逐条替换痛点词条", "真录屏全屏", "要点逐条弹条", "闪白揭幕真人", "盖章"],
    schema: s,
    C,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        punches: [{ at: 0, amt: 0.06 }, { at: dd.painVidAt || dd.ats[1] * 30, amt: 0.04 }, { at: dd.ats[1] * 30, amt: 0.04 }, { at: dd.stageAt, amt: 0.05 }],
        zoomTo: 1.05,
        zoomAt: dd.stageAt,
        zoomLen: Math.max(12, dur2 - dd.stageAt - 12),
      }),
  }),
  noGallery: true,
  assetFields: ["console", "painVid", "bgArt", "titleArt"],
  opening: {
    script: "neurocast-ai-ai",
    hook: "大字先行 + 痛点/工作台两段实录锚词入画 + 真人揭幕",
    techniques: ["AI 生图底", "大字先行", "锚词入画", "真录屏全屏", "首帧大字", "逐条痛点词条", "要点逐条", "闪白揭幕", "盖章"],
    selfBg: true,
  },
};
