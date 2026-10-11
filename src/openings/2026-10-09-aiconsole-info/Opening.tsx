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

// 《怎样用AI控制AI》专属开场（2026-10-09 v10.3 第一屏换成 AI 生图 + 紫色主色调）
// 用户要求：开场先把「我自己搭的工作台」录屏原样全屏展示出来——不装框、不画鼠标、不推镜、不加聚焦标签。
// 用户复审要求：大字动画先行撑住前 2 秒（提 2 秒留存），「我做了这个工作台」这句出口时工作台画面才出现。
// 用户三/四复审：代码画的指挥台「太小气 / 还是不好看」→ 改用 AI 生图做背景与 3D 字体，并全片改紫色主色调（skin=violet）。
// v10.3 第一屏 = bgArt（全息指挥台 / 神经核心，cover 铺满 + 缓慢推近 + 冲击抖动）+ titleArt（AI 生图 3D 铬金字，screen 混合），
//   HUD 光带/四角/读数与闪白、双冲击环、速度线照旧叠在图上层；bgArt/titleArt 不填则退回 v10.2 的代码 Deck/代码字。
// ① 0 → 「我做了」（pill.at）：闪白+冲击环+速度线+3D 大标题砸入，底下整座指挥台在动（持续变化、不空窗）；
//    锚「我做了」工作台录屏拉开入场（淡入+微缩放）＋胶囊弹出，图底同步压暗到 10% 让位真素材；
//    锚「工作台$」标题向上飞出，随后四条要点按配音词时（ats）逐条弹到屏幕底部；
// ② stageAt（锚「这里$+0.2」）：录屏 12 帧淡出、真人全屏入画（引擎 presenter.showFrom 同帧），
//    要点条整排脉冲高亮、右侧金章「全自动交接」盖章；
// ③ presenter.full（12.0s）真人收右上小窗，开场层收尾淡出，正片第一条录屏镜头全屏接班。

const s = z.object({
  points: z.array(z.string()).min(2).max(5).default(["怎样用AI控制AI", "我说目标", "AI拆任务派活", "其他AI执行", "结果回到这里"]).describe("points[0]=大标题，其余为底部逐条弹出的要点"),
  ats: z.array(z.number()).default([0, 4.42, 5.66, 6.89, 8.54]).describe("每条要点出现秒数（对齐配音真实词时，不是 cue 键）"),
  title: z.string().default("").describe("预留字段（本版不显示）"),
  look: z.string().default("neon").describe("预留字段（本版不显示）"),
  pill: z.object({ text: z.string(), at: z.number() }).optional().describe("标题下方胶囊（at=帧，锚「我做了」）"),
  titleOutAt: z.number().default(92).describe("大标题向上飞出的帧（锚「工作台$」）"),
  console: z.string().default("").describe("全屏实录视频（assetFields 注入 jobs 路径）"),
  bgArt: z.string().default("").describe("第一屏背景：AI 生图（cover 铺满 + 缓慢推近）。空 = 用代码画的全息指挥台 Deck"),
  titleArt: z.string().default("").describe("第一屏大标题：AI 生图 3D 字（黑底，screen 混合叠上）。空 = 用代码字"),
  artScrim: z.number().default(0.34).describe("AI 背景中心压暗强度 0~1（图太花时调大，保证大字可读）"),
  stamp: z.object({ text: z.string(), at: z.number() }).optional().describe("右侧金章（at=帧，锚「怎么做到的」）"),
  stageAt: z.number().default(276).describe("揭幕帧（锚「这里$+0.2」，真人全屏入画）"),
  side: z.enum(["left", "right"]).default("left").describe("预留字段（本版不显示）"),
  kind: z.string().optional(),
  aspect: z.number().optional(),
});
type D = z.infer<typeof s>;

// ─────────────────────────────────────────────────────────────────────────────
// 第一屏图形底：全息「AI 指挥台」
// 用户驳回「呼吸光晕+漂移网格」= 小气、不够震撼、没有 AI 控制 AI 的科技感。
// 换成三层纵深：① 透视数据走廊（向镜头涌来的地板网格 + 放射速度线）
//              ② 中枢调度台（标题下方的全息椭圆台面：指挥官核心 → 六颗 AI 节点，
//                 指令光点从核心飞向节点、成果光点飞回来 = 字面意义的「AI 控制 AI」）
//              ③ HUD 边框 / 刻度 / 扫掠光带（持续运动，第 0 帧就是满画面信息）
// 录屏在「我做了」入场时整层压暗到 10%，不跟真实素材抢画面。
// ─────────────────────────────────────────────────────────────────────────────

const HX = 960; // 灭点 / 台面中心 x
const HY = 556; // 灭点 y（台面椭圆中心在 DECK_Y）
const DECK_Y = 664;
const NODES = 6;
const TITLE_W = 1420; // AI 生图 3D 标题（裁边后 1604×312，保持宽高比）
const TITLE_H = Math.round((TITLE_W * 312) / 1604);

const Deck: React.FC<{ frame: number; seed: number; dim: number }> = ({ frame, seed, dim }) => {
  const t = useTheme();
  if (dim <= 0.004) return null;

  const inP = easeOut(prog(frame, 0, 20)); // 设施展开（透明度）
  const op0 = 0.82 + 0.18 * inP; // 第 0 帧指挥台就已经在场（冲击帧不能是空画面）
  const push = lerp(1.14, 1, inP) + 0.012 * Math.sin(frame / 26); // 缓慢推近 + 常动
  const sh = shake(frame, 0, 13, 11, seed); // 第 0 帧冲击抖动
  const g = (v: string) => alpha(v, 1);

  // ① 透视地板：环线向镜头涌来，纵向线收束到灭点
  const floor: React.ReactNode[] = [];
  const rows = 15;
  const flow = ((frame * 1.05) % 22) / 22;
  for (let i = 0; i < rows; i++) {
    const k = (i + flow) / rows;
    const y = HY + Math.pow(k, 2.7) * (1080 - HY) * 1.06;
    const half = 180 + Math.pow(k, 1.35) * 1750;
    floor.push(<line key={`fr${i}`} x1={HX - half} y1={y} x2={HX + half} y2={y} stroke={t.primary} strokeWidth={0.8 + 2.2 * k} opacity={0.05 + 0.3 * k * k} />);
    const yc = HY - (y - HY) * 0.52; // 天花镜像（压得更扁，留出标题区）
    floor.push(<line key={`ce${i}`} x1={HX - half * 0.9} y1={yc} x2={HX + half * 0.9} y2={yc} stroke={t.secondary} strokeWidth={0.7 + 1.2 * k} opacity={0.03 + 0.11 * k * k} />);
  }
  for (let j = -9; j <= 9; j++) {
    const x1 = HX + j * 26;
    const x2 = HX + j * 300;
    floor.push(<line key={`vf${j}`} x1={x1} y1={HY} x2={x2} y2={1080} stroke={t.primary} strokeWidth={1.1} opacity={0.09} />);
    floor.push(<line key={`vc${j}`} x1={x1} y1={HY} x2={x2} y2={1080 - (1080 - HY) * 2 * 0.52} stroke={t.secondary} strokeWidth={0.9} opacity={0.05} />);
  }

  // ② 数据流粒子：从灭点向外加速（曲速感）
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

  // ③ 全息调度台：椭圆台面 + 旋转刻度环 + 指挥官核心 + 六颗 AI 节点（指令/成果双向流光）
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
    // 指令出（accent 光点飞向节点）+ 成果回（primary 光点飞回核心）
    const kOut = ((frame * 0.021 + i * 0.17) % 1);
    const kIn = 1 - ((frame * 0.016 + i * 0.41) % 1);
    deck.push(<circle key={`po${i}`} cx={lerp(HX, n.x, kOut)} cy={lerp(DECK_Y, n.y, kOut)} r={3 + 3 * kOut} fill={t.accent} opacity={0.35 + 0.6 * kOut} />);
    deck.push(<circle key={`pi${i}`} cx={lerp(HX, n.x, kIn)} cy={lerp(DECK_Y, n.y, kIn)} r={2.6} fill={t.secondary} opacity={0.55 * kIn} />);
    const s = n.front ? 1 : 0.72;
    deck.push(
      <g key={`nd${i}`} opacity={n.front ? 1 : 0.5}>
        <circle cx={n.x} cy={n.y} r={26 * s} fill="none" stroke={col} strokeWidth={2.2} />
        <circle cx={n.x} cy={n.y} r={11 * s} fill={t.accent} opacity={0.85} />
        <text x={n.x} y={n.y + 46 * s} textAnchor="middle" fill={col} fontFamily={t.font.mono} fontSize={17} letterSpacing={2}>
          {`AI-0${i + 1}`}
        </text>
      </g>,
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, opacity: dim }}>
      {/* 深空底 + 中枢辉光 */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(125% 95% at 50% 46%, #08150f 0%, #04080b 52%, #010305 100%)" }} />
      <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: `scale(${push}) translate(${sh.x}px,${sh.y}px)`, transformOrigin: "50% 46%" }}>
        <g opacity={0.55 + 0.45 * inP}>
          {floor}
          {dust}
        </g>
        {/* 地平光带 */}
        <rect x={0} y={HY - 1.5} width={1920} height={3} fill="url(#ac-hz)" opacity={0.5} />
        <defs>
          <linearGradient id="ac-hz" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={alpha(t.primary, 0)} />
            <stop offset="50%" stopColor={g(t.accent)} />
            <stop offset="100%" stopColor={alpha(t.primary, 0)} />
          </linearGradient>
          <radialGradient id="ac-coreGlow">
            <stop offset="0%" stopColor={alpha(t.accent, 0.85)} />
            <stop offset="45%" stopColor={alpha(t.primary, 0.3)} />
            <stop offset="100%" stopColor={alpha(t.primary, 0)} />
          </radialGradient>
        </defs>
        <g opacity={op0}>
          {rings}
          {deck}
          <circle cx={HX} cy={DECK_Y} r={190 * core} fill="url(#ac-coreGlow)" opacity={0.55} />
          <circle cx={HX} cy={DECK_Y} r={44 * core} fill="none" stroke={t.accent} strokeWidth={3} opacity={0.9} />
          <circle cx={HX} cy={DECK_Y} r={20 * core} fill={t.accent} />
        </g>
      </svg>
      <Hud frame={frame} />
      {/* 暗角：把视线压到中心大字上 */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(78% 62% at 50% 44%, rgba(0,0,0,0) 40%, rgba(0,0,0,.62) 100%)" }} />
    </div>
  );
};

// HUD 层（代码指挥台与 AI 生图共用）：扫掠光带 + 四角括号 + mono 读数
const Hud: React.FC<{ frame: number }> = ({ frame }) => {
  const t = useTheme();
  return (
    <>
      {/* 扫掠光带：每 ~40 帧自上而下过一次 */}
      <div style={{ position: "absolute", left: 0, right: 0, height: 150, top: ((frame * 26) % 1230) - 150, background: `linear-gradient(180deg, rgba(0,0,0,0), ${alpha(t.primary, 0.11)} 60%, ${alpha(t.accent, 0.16)})`, mixBlendMode: "screen" }} />
      {/* HUD 四角 + 侧边刻度 */}
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

// ─────────────────────────────────────────────────────────────────────────────
// 第一屏 v10.3：AI 生图底（用户驳回代码画的指挥台「还是不好看」，要求直接用生图做背景 + 字体）
// 图是 16:9 宽幅裁掉水印后的成品：cover 铺满 + 第 0 帧就在、缓慢推近 + 冲击抖动，
// 上面叠 HUD 与压暗蒙版（保证大字可读）。录屏在「我做了」入场时整层压暗到 10% 让位真素材。
// ─────────────────────────────────────────────────────────────────────────────
const ArtBg: React.FC<{ src: string; frame: number; seed: number; dim: number; scrim: number }> = ({ src, frame, seed, dim, scrim }) => {
  const t = useTheme();
  if (!src || dim <= 0.004) return null;
  const inP = easeOut(prog(frame, 0, 24));
  const push = lerp(1.15, 1.015, inP) + 0.014 * Math.sin(frame / 30); // 开场推近，之后常动
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
      {/* 中心压暗：字永远压得住图；四周留亮，画面不闷 */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(72% 54% at 50% 42%, rgba(2,1,8,${scrim}) 0%, rgba(2,1,8,${(scrim * 0.5).toFixed(3)}) 58%, rgba(2,1,8,0) 100%)` }} />
      <Hud frame={frame} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(86% 70% at 50% 46%, rgba(0,0,0,0) 46%, rgba(0,0,0,.66) 100%)" }} />
    </div>
  );
};


const C: React.FC<CompProps<D> & { presenter?: boolean }> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const stage = d.stageAt;
  const chips = d.points.slice(1, 5).map((text, i) => ({ text, at: (d.ats[i + 1] ?? 0) * fps }));

  // ── 阶段 1：工作台录屏原样全屏 + 标题 / 胶囊 / 要点条 ──
  const p1 = 1 - clamp(easeOut(prog(frame, stage, 12)));
  const flash0 = 1 - easeOut(prog(frame, 0, 6));
  const tSlam = easeOut(clamp(prog(frame, 0, 9)));
  // AI 生图标题比代码字宽得多（1420px）：起始缩放 1.3，再大第 0 帧首尾字就被切出画外
  const slamFrom = d.titleArt ? 1.3 : 1.58;
  const tOutP = clamp(easeOut(prog(frame, d.titleOutAt, 12)));
  const pillIn = d.pill ? easeOutBack(prog(frame, d.pill.at, 8)) : 0;
  const pillOut = d.pill ? 1 - clamp(easeOut(prog(frame, d.ats[1] * fps - 18, 10))) : 1;
  // v10.1：工作台录屏不在第 0 帧出现——锚「我做了」（pill.at）才拉开入场，先让大字动画撑住前两秒留存
  const scrAt = d.pill?.at ?? 0;
  const scrP = clamp(easeOut(prog(frame, scrAt, 10)));
  // kicker / 刻度条这类「第一屏装饰」在录屏入场前 16 帧退场，不与真实素材叠字
  const introOut = 1 - clamp(easeOut(prog(frame, Math.max(6, scrAt - 16), 14)));
  // 要点条整排：第 stage 帧脉冲一次（揭幕时亮）
  const glow = frame >= stage ? 1 - clamp(easeOut(prog(frame, stage, 22))) : 0;
  // 收尾：开场最后 8 帧整排淡出
  const endOut = 1 - clamp(easeOut(prog(frame, dur - 8, 8)));

  // 录屏 contain 铺满：1920×1080 内居中，宽高比不足处留边
  const aspect = d.aspect ?? 1440 / 738;
  const fw = aspect >= 16 / 9 ? 1920 : Math.round(1080 * aspect);
  const fh = Math.round(fw / aspect);
  const fx = (1920 - fw) / 2;
  const fy = (1080 - fh) / 2;

  // ── 阶段 2：金章 ──
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

  return (
    <>
      {frame < stage + 12 && (
        <div style={{ position: "absolute", inset: 0, opacity: p1 }}>
          {/* 第一屏图形底：有 AI 生图就用生图，没有退回代码画的全息指挥台（录屏入场时都压暗到 10%） */}
          {d.bgArt ? (
            <ArtBg src={d.bgArt} frame={frame} seed={seed} dim={1 - scrP * 0.9} scrim={d.artScrim} />
          ) : (
            <Deck frame={frame} seed={seed} dim={1 - scrP * 0.9} />
          )}
          {/* 工作台录屏：锚「我做了」拉开入场（原片全屏 contain，不装框、不加工） */}
          <Sequence from={scrAt}>
            <div style={{ position: "absolute", left: fx, top: fy, width: fw, height: fh, overflow: "hidden", opacity: clamp(scrP * 1.15), transform: `scale(${lerp(1.05, 1, scrP)})`, transformOrigin: "50% 50%" }}>
              <OffthreadVideo src={staticFile(d.console)} muted style={{ width: fw, height: fh }} />
            </div>
          </Sequence>
          {/* 第 0 帧闪白：做成中心冲击光，四周保住纯黑（整屏白会把指挥台糊成灰雾，第 0 帧就小气了） */}
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(56% 40% at 50% 38%, ${alpha("#ffffff", 0.42)}, ${alpha("#ffffff", 0.12)} 55%, rgba(255,255,255,0) 78%)`, opacity: clamp(flash0), mixBlendMode: "screen" }} />
          {/* 冲击：两道扩散环 + 放射速度线（压在大字下面） */}
          <RingBurst frame={frame} at={0} x={HX} y={470} color={alpha(t.primary, 0.65)} len={24} maxR={1180} width={10} />
          <RingBurst frame={frame} at={5} x={HX} y={470} color={alpha(t.accent, 0.6)} len={20} maxR={820} width={6} />
          <SpeedLines frame={frame} at={0} x={HX} y={470} color={alpha(t.primary, 0.55)} len={16} count={34} inner={430} seed={seed} />
          {/* 大标题：第 0 帧就在（放大落定），「工作台$」向上飞出 */}
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
              {/* kicker：10 帧后擦入，录屏入场前退场 */}
              <div style={{ marginBottom: 30, clipPath: `inset(0 ${(1 - easeOut(prog(frame, 10, 12))) * 100}% 0 -2%)`, opacity: introOut }}>
                <span style={{ fontFamily: t.font.mono, fontSize: 30, fontWeight: 700, letterSpacing: 16, paddingLeft: 16, color: t.primary, textShadow: `0 0 26px ${alpha(t.primary, 0.75)}` }}>COMMAND DECK</span>
              </div>
              {d.titleArt ? (
                <div style={{ position: "relative", width: TITLE_W, height: TITLE_H }}>
                  {/* AI 生图 3D 字已抠成透明底（title_*_alpha.png）：直接叠，不用 screen 混合
                      ——混合模式在带 opacity 的祖先里会失效，叠在录屏上会露出一块暗「盒子」 */}
                  <Img src={staticFile(d.titleArt)} style={{ position: "absolute", inset: -20, width: TITLE_W + 40, height: TITLE_H + 40, objectFit: "contain", filter: "blur(24px) saturate(1.6)", opacity: 0.45 + 0.2 * Math.sin(frame / 11) }} />
                  <Img src={staticFile(d.titleArt)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: `drop-shadow(0 12px 26px rgba(0,0,0,.8)) brightness(${(1 + 0.1 * Math.sin(frame / 13)).toFixed(3)})` }} />
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <span aria-hidden style={{ position: "absolute", left: 0, top: 0, ...ink(150, t.accent, t.font.title, 12), filter: "blur(28px)", opacity: 0.45 + 0.2 * Math.sin(frame / 11) }}>{titleEl}</span>
                  <span style={{ ...ink(150, t.text, t.font.title, 12), letterSpacing: 4, textShadow: `0 6px 0 #000, 0 14px 34px rgba(0,0,0,.6), 0 0 74px ${alpha(t.primary, 0.55)}` }}>{titleEl}</span>
                </div>
              )}
              {/* 标题下的数据刻度条：从中心拉开 */}
              <div style={{ position: "relative", marginTop: 34, height: 7, width: 1180 * easeOut(prog(frame, 6, 16)), opacity: introOut }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: 4, background: `linear-gradient(90deg, rgba(0,0,0,0), ${t.accent} 16%, ${t.primary} 50%, ${t.accent} 84%, rgba(0,0,0,0))`, boxShadow: `0 0 30px ${alpha(t.accent, 0.75)}` }} />
                <div style={{ position: "absolute", left: "50%", top: -9, width: 2, height: 25, background: alpha(t.accent, 0.75) }} />
              </div>
            </div>
          )}
          {/* 胶囊：填补 1.9→第一条要点之间的空窗 */}
          {d.pill && pillIn > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 602, display: "flex", justifyContent: "center", opacity: clamp(pillIn * 3) * pillOut }}>
              <div style={{ transform: `scale(${0.6 + 0.4 * Math.min(1.1, pillIn)})` }}>
                <span style={{ ...ink(50, t.text, t.font.title, 7), padding: "12px 40px", borderRadius: 999, background: alpha(t.bg, 0.72), border: `3px solid ${alpha(t.gold, 0.8)}`, boxShadow: "0 10px 30px rgba(0,0,0,.5)", whiteSpace: "nowrap" }}>{d.pill.text}</span>
              </div>
            </div>
          )}
          <Sfx name="impact" at={0} volume={0.5} />
          {d.pill && <Sfx name="ding" at={d.pill.at} volume={0.3} />}
          <Sfx name="whoosh" at={scrAt} volume={0.22} />
        </div>
      )}

      {/* 要点条：从第一条起常驻（阶段 2 也在），开场收尾整排淡出 */}
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

      {/* 阶段 2：真人全屏揭幕（引擎 presenter）之后的动效 + 金章 */}
      {frame >= stage - 4 && (
        <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: stage, amp: 6, len: 5 }, ...(d.stamp ? [{ at: d.stamp.at, amp: 8, len: 6 }] : [])]} exit="fade" outLen={8}>
          {/* 右侧：金章盖章 */}
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

export const OpeningAiconsoleInfo: CompDef<D> = {
  ...tpl<D>({
    id: "opening-aiconsole-info",
    name: "开场 · 全息指挥台大字先行→工作台录屏全屏→真人揭幕→盖章收窗",
    hook: "AI 指挥台科技底 + 大字动画先行 2 秒 + 工作台锚词入画 + 要点逐条",
    desc: "0→「我做了」：第 0 帧 闪白+双冲击环+速度线+150px 大标题砸入，底是动态全息 AI 指挥台（透视数据走廊向镜头涌来、曲速粒子、指挥官核心向六颗 AI 节点派指令/成果飞回、HUD 四角与扫掠光带持续运动）；锚「我做了」工作台录屏 contain 全屏拉开入场（不加工、指挥台压暗让位）+胶囊弹出、「工作台$」标题飞出、四条要点按词时逐条弹底部；stageAt（锚「这里$+0.2」）录屏淡出、真人全屏入画、要点脉冲高亮、右侧金章盖章；presenter.full 收右上小窗、开场收尾交棒",
    use: "只给《怎样用AI控制AI》用（开场不重样）",
    techniques: ["全息指挥台·中枢向节点派单", "透视数据走廊+曲速粒子", "大字先行·锚词入画", "首帧大字+闪白+冲击环", "真录屏全屏", "要点逐条弹条", "闪白揭幕真人", "盖章"],
    schema: s,
    C,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        punches: [{ at: 0, amt: 0.06 }, { at: dd.ats[1] * 30, amt: 0.04 }, { at: dd.stageAt, amt: 0.05 }],
        zoomTo: 1.05,
        zoomAt: dd.stageAt,
        zoomLen: Math.max(12, dur2 - dd.stageAt - 12),
      }),
  }),
  noGallery: true,
  assetFields: ["console", "bgArt", "titleArt"],
  opening: {
    script: "../../../ai-console",
    hook: "大字动画先行 2 秒 + 工作台锚「我做了」入画 + 真人揭幕",
    techniques: ["大字先行撑留存", "锚词入画", "真录屏全屏", "首帧大字", "要点逐条", "闪白揭幕", "盖章"],
    selfBg: true,
  },
};
