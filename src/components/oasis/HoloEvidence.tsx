import React from "react";
import { z } from "zod";
import { useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont } from "../../lib/ui";
import { Sfx } from "../../lib/sfx";
import { SourceBadge, sourceSchema } from "../../lib/source";
import type { CompDef, CompProps } from "../types";
import { Cam, Stage3D, camKeys } from "../../oasis/Stage3D";
import { OasisWorld } from "../../oasis/World";
import { HoloMedia as HoloPanel, Tag } from "../../oasis/Hud";
import { p, useT, eOutExpo } from "../../oasis/time";

const schema = z.object({
  src: z.string().describe("真实截图/录屏/头像（相对 public/）；不要拿代码画的界面冒充"),
  kind: z.enum(["image", "video"]).optional().describe("prepAssets 会按文件类型自动填，别手写"),
  aspect: z.number().optional(),
  kicker: z.string().default("OASIS // EVIDENCE"),
  title: z.string(),
  label: z.string().default("HOLO // MEDIA"),
  tag: z.string().optional(),
  fit: z.enum(["cover", "contain"]).default("cover"),
  source: sourceSchema,
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const th = useTheme();
  const t = useT();
  const enterAt = useEnter(variant);
  const secs = dur / 30;
  const video = data.kind === "video" || /\.(mp4|mov|webm|m4v)$/i.test(data.src);
  const cam: Cam = camKeys(t, [
    [0, [0.8, 4.0, 18], [0, 2.1, 0], 54],
    [secs * 0.5, [0, 3.6, 13.5], [0, 2.15, 0], 50],
    [secs, [-0.5, 3.3, 11.2], [0, 2.2, 0], 48],
  ]);
  const eTitle = enterAt(frame, 0, { fallback: "rise", dur: 18 });
  const pIn = p(t, 0.1, 0.7, eOutExpo);
  return (
    <>
      <Stage3D cam={cam} bloom={1.25} threshold={0.22} ca={0}>
        <OasisWorld cam={cam} t={t} glow={th.primary} gridIntensity={0.7} dust={0.7} pulse={(t * 14) % 180} pulseAmt={0.2} />
      </Stage3D>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: 240,
            top: 96,
            width: 1200,
            opacity: eTitle.opacity,
            transform: `translate(${eTitle.dx}px, ${eTitle.dy}px)`,
            transformOrigin: "left center",
          }}
        >
          <div style={{ fontFamily: th.font.mono, fontSize: 17, letterSpacing: 6, color: th.primary }}>{data.kicker}</div>
          <div style={{ marginTop: 8, fontFamily: th.font.title, fontWeight: 900, fontSize: fitFont(data.title, 1120, 68, 38), lineHeight: 1.08, color: th.text, textShadow: `0 0 26px ${th.primary}88` }}>{data.title}</div>
        </div>

        <HoloPanel
          src={data.src}
          video={video}
          vstart={0}
          x={250}
          y={230}
          w={1420}
          h={650}
          t0={0.15}
          t1={secs}
          color={th.primary}
          label={data.label}
          tag={data.tag}
          fit={data.fit}
          rotY={-5}
          rotX={1.5}
          filter="contrast(1.04) saturate(1.05)"
          seed={7}
          intro
        />

        {data.source && (
          <div style={{ position: "absolute", inset: 0 }}>
            <SourceBadge source={data.source} frame={frame} x={-34} y={920} align="right" />
          </div>
        )}

        <div style={{ position: "absolute", left: 250, bottom: 120, opacity: pIn }}>
          <Tag color={th.accent}>HOLO // EVIDENCE</Tag>
        </div>
      </div>

      <Sfx name="whoosh" at={0} volume={0.22} />
      <Sfx name="tick" at={Math.round(0.3 * 30)} volume={0.2} />
      <Sfx name="ding" at={Math.round(1.0 * 30)} volume={0.22} />
    </>
  );
};

export const HoloEvidence: CompDef<D> = {
  id: "holo-evidence",
  name: "OASIS · 全息证据面板",
  layer: "oasis",
  variants: 1,
  minSec: 4,
  maxSec: 12,
  tags: ["截图", "录屏", "证据", "官方", "真实", "赛博", "全息"],
  motion: { kind: "相机推近霓虹巨城 → 真实素材全息面板从纵深飞到正面，切片故障收敛", energy: 2 },
  desc: "OASIS 风格的全息证据：真截图/录屏装进带 3D 倾斜、括号、扫描线的 HoloMedia 面板，背景是霓虹巨城；来源角标仍走 SourceBadge",
  use: "有官方截图/真实录屏/后台数据，且想让证据看起来像“从游戏世界调出的档案”时；素材本身仍必须是真文件，不能代码画界面冒充",
  schema,
  assetFields: ["src"],
  example: {
    kicker: "OASIS // EVIDENCE 01",
    title: "这是官方页面，不是概念图",
    src: "assets/arena-livebench.png",
    label: "OFFICIAL // ARENA",
    tag: "LIVE DATA",
    fit: "cover",
    source: { platform: "Arena", capturedAt: "2026-10-17", kind: "real" },
  },
  C,
};
