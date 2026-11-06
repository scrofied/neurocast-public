import React from "react";
import { z } from "zod";
import { useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont } from "../../lib/ui";
import { Sfx } from "../../lib/sfx";
import type { CompDef, CompProps } from "../types";
import { Cam, Stage3D, camKeys, project } from "../../oasis/Stage3D";
import { OasisWorld } from "../../oasis/World";
import { Beam, BotCube, Coins, GlowRing, Pad, fountain } from "../../oasis/Objects";
import { Tag, HudBox } from "../../oasis/Hud";
import { p, useT, eOutExpo } from "../../oasis/time";

const item = z.object({ label: z.string(), value: z.string() });
const schema = z.object({
  kicker: z.string().default("OASIS // BRIEF"),
  title: z.string(),
  sub: z.string().optional(),
  items: z.array(item).min(2).max(4).describe("2~4 条 HUD 数据；每条一个标签一个值"),
  cubeLabel: z.string().default("BOT"),
  side: z.enum(["left", "right"]).default("left"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const th = useTheme();
  const t = useT();
  const enterAt = useEnter(variant);
  const secs = dur / 30;
  const cam: Cam = camKeys(t, [
    [0, [0.7, 4.7, 18], [0, 2.1, 0], 54],
    [secs * 0.42, [0, 4.1, 12.6], [0, 2.2, 0], 50],
    [secs * 0.9, [0, 3.5, 10.2], [0, 2.35, 0], 47],
    [secs, [-0.4, 3.2, 9.4], [0, 2.4, 0], 46],
  ]);
  const appear = p(t, 0.12, 0.8, eOutExpo);
  const glow = p(t, 0.3, 1.2, eOutExpo);
  const pc = project(cam, [0, 3.15, 0]);
  const eTitle = enterAt(frame, 0, { fallback: "rise", dur: 18 });
  const titleX = data.side === "left" ? 110 : 1080;
  const boxX = data.side === "left" ? 1240 : 120;
  return (
    <>
      <Stage3D cam={cam} bloom={1.35} threshold={0.2} ca={0}>
        <OasisWorld cam={cam} t={t} glow={th.secondary} gridIntensity={0.85} dust={0.8} pulse={(t * 16) % 180} pulseAmt={0.28} />
        <Pad position={[0, 0.02, 0]} radius={3.1} color={th.primary} intensity={1.1} />
        <BotCube position={[0, 2.15, 0]} size={2.2} scale={appear} rotation={[0.28, 0.55 + t * 0.35, 0]} time={t} seam={0.8} seamColor={th.accent} edgeColor={th.accent} edge={3.4} rim={0.5} rimColor={th.primary} scan={0.55} />
        <GlowRing radius={3.05 + glow * 0.2} tube={0.035} color={th.primary} intensity={2.8} position={[0, 0.05, 0]} opacity={glow} />
        <GlowRing radius={3.55} tube={0.018} color={th.secondary} intensity={2} position={[0, 0.06, 0]} opacity={glow * 0.8} />
        {t > 0.72 && <Beam position={[0, 2.4, 0]} height={26} radius={0.42} color={th.accent} intensity={1.1} opacity={p(t, 0.72, 1.2)} time={t} />}
        {t > 0.8 && <Coins count={80} state={fountain([0, 4.2, 0], t, 0.8, { spread: 1.8, up: 6, g: 7, life: 1.8, rate: 70, seed: 3 })} emissive={0.7} />}
      </Stage3D>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: titleX,
            top: 178,
            width: 760,
            opacity: eTitle.opacity,
            transform: `translate(${eTitle.dx}px, ${eTitle.dy}px) scale(${eTitle.scale})`,
            transformOrigin: "left center",
          }}
        >
          <div style={{ fontFamily: th.font.mono, fontSize: 17, letterSpacing: 6, color: th.primary }}>{data.kicker}</div>
          <div style={{ marginTop: 10, fontFamily: th.font.title, fontWeight: 900, fontSize: fitFont(data.title, 720, 86, 48), lineHeight: 1.06, color: th.text, textShadow: `0 0 28px ${th.primary}88` }}>{data.title}</div>
          {data.sub && <div style={{ marginTop: 16, fontFamily: th.font.body, fontSize: 28, color: th.dim, lineHeight: 1.4 }}>{data.sub}</div>}
          <div style={{ marginTop: 24, width: 340 * p(t, 0.35, 0.9, eOutExpo), height: 2, background: `linear-gradient(90deg, ${th.primary}, transparent)` }} />
        </div>

        <HudBox x={boxX} y={214} w={540} h={330} t0={0.45} t1={secs - 0.1} color={th.primary} label="MISSION LOG" tag={`${data.items.length} SIGNALS`} pad={22}>
          {data.items.map((it, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", height: 64, borderBottom: `1px dashed ${th.primary}33`, opacity: p(t, 0.6 + i * 0.1, 0.85 + i * 0.1) }}>
              <span style={{ fontFamily: th.font.body, fontSize: 24, color: th.dim }}>{it.label}</span>
              <span style={{ fontFamily: th.font.mono, fontWeight: 700, fontSize: 28, color: th.accent }}>{it.value}</span>
            </div>
          ))}
        </HudBox>

        <div style={{ position: "absolute", left: pc.x, top: pc.y - 56, transform: "translate(-50%,-100%)", opacity: p(t, 0.7, 1.0) }}>
          <Tag color={th.accent} style={{ fontFamily: th.font.mono, fontSize: 18, padding: "5px 12px" }}>{data.cubeLabel} · LEGENDARY</Tag>
        </div>
      </div>

      <Sfx name="impact" at={Math.round(0.35 * 30)} volume={0.38} />
      <Sfx name="riser" at={Math.round(0.15 * 30)} volume={0.18} />
      <Sfx name="ding" at={Math.round(0.9 * 30)} volume={0.26} />
    </>
  );
};

export const OasisBrief: CompDef<D> = {
  id: "oasis-brief",
  name: "OASIS · 3D 任务简报",
  layer: "oasis",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["核心", "本质", "总结", "拆解", "游戏", "赛博", "任务"],
  motion: { kind: "相机飞入霓虹巨城 → 黑盒方块落台、光环展开 → HUD 数据逐条点亮", energy: 3 },
  desc: "OASIS 风格 3D 舞台：霓虹网格/巨城/尘埃 + 黑盒 BotCube + 光环 + 左右 HUD 任务面板；自带舞台和相机，适合把一个核心概念做成“游戏任务简报”",
  use: "讲一个核心概念/一个黑盒产品/一个数字资产时；必须有明确的「主物件」和 2~4 条 HUD 数据，不要拿它做纯口播背景",
  schema,
  example: {
    kicker: "OASIS // MISSION 01",
    title: "一个 Bot，一条现金流",
    sub: "封装专业能力，按月收租",
    items: [
      { label: "商业模式", value: "按月订阅" },
      { label: "后厨可见", value: "✕ 黑盒" },
      { label: "可复制性", value: "✕ 抄不走" },
    ],
    cubeLabel: "YOUR BOT",
    side: "left",
  },
  C,
};
