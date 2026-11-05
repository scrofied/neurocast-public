import React from "react";
import { z } from "zod";
import { Img, staticFile } from "remotion";
import { clamp, easeOut, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { Slam, Wipe } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, Stage, tpl } from "../templates/kit";

// 《WorkBuddy 这 5 个设置》专属开场（2026-11-06）
// 用户口径：第 0 帧 WorkBuddy 大图标**砸下来**（震撼入场），真人全屏 1 秒后收窗，动效接着走。
// f0    图标从画布外 2.4× 自由落体 + 闪白 + impact（首帧就有东西，绝不淡入）
// f10   落地：冲击环 + 速度线 + 地面光带 + 屏幕抖动，金字「WorkBuddy」同时砸在图标下方（卡 work@0.02–body@0.86）
// f26   「下载之后直接就用」擦出（卡「下载」0.86s）
// f30   图标缩到左上角成徽标 = 真人收窗那一刻（一次形态突变）
// f48   大字组上移退场，把屏幕交给正片（正片从 f30 起就露出来了）
// 卡点全部写死成帧（不写台词锚点）：film-level opening 的锚点是在**全片**前向搜索的，
// 开场内部用帧更稳（见 memory「council4 开场锚点踩坑」）。
const s = z.object({
  brand: z.string().default("WorkBuddy").describe("第 0 帧大字（品牌名）"),
  brandFile: z.string().default("brands/workbuddy.svg").describe("真标识文件（public/ 下相对路径）"),
  sub: z.string().default("下载之后直接就用").describe("第二行小字（擦出）"),
  dropAt: z.number().default(0).describe("图标起跳 + 闪白（帧；分镜里也可写台词锚点或秒数，引擎换算成帧）"),
  landAt: z.number().default(10).describe("落地冲击 + 大字砸出（帧）"),
  subAt: z.number().default(26).describe("小字擦出（帧）"),
  cornerAt: z.number().default(30).describe("图标收到左上角 = 真人收窗（帧）"),
  outAt: z.number().default(48).describe("大字组退场（帧）"),
  aspect: z.number().optional(),
  kind: z.string().optional(),
});
type D = z.infer<typeof s>;

// 图标行程：画布外 -620 → 落地位 y=300；2.4× → 1.0×；到点后再回弹一下；然后补间去左上角
const iconPose = (f: number, d: D) => {
  const fall = easeOut(prog(f, d.dropAt, Math.max(1, d.landAt)));
  const settle = easeOut(prog(f, d.landAt, d.landAt + 7));
  const toCorner = easeOut(prog(f, d.cornerAt, d.cornerAt + 11));
  // 起点 y=-260：2.4× 的图标高 1008px，第 0 帧已经有 240px 进画框（首帧就有东西，不是从透明淡入）
  const y = 300 + (1 - fall) * -560;
  const sc = (2.4 - 1.4 * fall) * (1 + 0.1 * (1 - settle));
  return {
    cx: 960 + (190 - 960) * toCorner,
    cy: y + (168 - y) * toCorner,
    cs: sc * (1 - toCorner) + 0.3 * toCorner,
    toCorner,
  };
};

const C: React.FC<CompProps<D> & { presenter?: boolean }> = ({ data: d, frame, dur, seed, presenter }) => {
  const t = useTheme();
  const { cx, cy, cs } = iconPose(frame, d);
  const brandIn = prog(frame, d.landAt, d.landAt + 6);
  const subIn = prog(frame, d.subAt, d.subAt + 9);
  const exit = clamp((frame - d.outAt) / 9, 0, 1);
  const textOp = frame < d.outAt ? 1 : 1 - exit;

  return (
    <Stage
      frame={frame}
      dur={dur}
      seed={seed}
      hits={[{ at: d.landAt, amp: 17, len: 9 }]}
      exit="fade"
      outLen={7}
    >
      {/* 真人全屏那 1 秒：底部压暗一档就够（整幅压死会把人做成黑剪影），保证居中大字读得清 */}
      {presenter && frame < 34 && <Scrim side="bottom" size={0.55} strength={0.45} />}
      <Flash frame={frame} at={d.dropAt} len={7} peak={0.34} />

      {frame >= d.landAt - 1 && frame < d.landAt + 15 && (
        <>
          <Flash frame={frame} at={d.landAt} len={6} peak={0.5} />
          <RingBurst frame={frame} at={d.landAt} x={960} y={520} color={t.primary} maxR={640} len={15} />
          <SpeedLines frame={frame} at={d.landAt} x={960} y={300} color={t.text} len={9} count={22} inner={250} seed={seed} />
          {/* 落地压痕：一条横向光带，10 帧内摊开退掉 */}
          <div
            style={{
              position: "absolute",
              left: 960 - 420 * (1 + (frame - d.landAt) / 12),
              top: 520,
              width: 840 * (1 + (frame - d.landAt) / 12),
              height: 10,
              opacity: clamp(1 - (frame - d.landAt) / 12),
              background: `linear-gradient(90deg, transparent, ${t.primary}, transparent)`,
              filter: "blur(3px)",
            }}
          />
        </>
      )}

      {/* WorkBuddy 真标识：第 0 帧就在半空，砸下来 → 左上角定格成徽标 */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width: 420,
          height: 420,
          transform: `translate(-50%,-50%) scale(${cs})`,
          filter: frame < d.landAt ? "blur(6px)" : "none",
          opacity: clamp(prog(frame, d.dropAt, d.dropAt + 2) * 4),
        }}
      >
        <Img src={staticFile(d.brandFile)} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      </div>

      {/* 大字（水平居中，压在图标下方）：品牌名 + 第二行小字；outAt 起整组上移退场 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: textOp,
          transform: `translateY(${-exit * 150}px)`,
          pointerEvents: "none",
        }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", opacity: clamp(brandIn * 4) }}>
          <Slam
            frame={frame}
            at={d.landAt}
            text={d.brand}
            size={150}
            color={t.gold}
            font={t.font.title}
            from={1.55}
            len={7}
            blur={5}
            minOpacity={0.92}
            strokeW={13}
            style={{ display: "inline-block" }}
          />
        </div>
        {frame >= d.subAt - 1 && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 830, textAlign: "center", opacity: clamp(subIn * 4) }}>
            <Wipe frame={frame} at={d.subAt} text={d.sub} size={68} color={t.text} font={t.font.title} len={9} edge={t.primary} strokeW={9} />
          </div>
        )}
      </div>

      {/* 开场的声音设计单独配，不走正片那套默认音量：
          下坠要有风声、落地那一下必须是全片最响的一击（0.78），否则「砸下来」就没有重量。
          实测（qc/rms_curve.py）落地 0.33~1.2s 成片比纯配音高 30dB 以上才算做到。 */}
      <Sfx name="whoosh" at={d.dropAt} volume={0.42} />
      <Sfx name="impact" at={d.landAt} volume={0.78} />
      <Sfx name="swish" at={d.subAt} volume={0.24} />
      <Sfx name="pop" at={d.cornerAt} volume={0.32} />
      <Sfx name="ding" at={d.cornerAt + 8} volume={0.5} />
      <Sfx name="whoosh" at={dur - 8} volume={0.22} />
    </Stage>
  );
};

export const OpeningWb5Settings: CompDef<D> = {
  ...tpl<D>({
    id: "opening-wb-5settings",
    name: "开场 · 真身图标砸下（WorkBuddy logo 自由落体 + 冲击环 + 收角成徽标）",
    hook: "真身图标砸下+落地冲击+收角",
    desc: "第 0 帧 WorkBuddy 真标识从画布外 2.4× 自由落体砸下：闪白 + impact + 速度线 + 冲击环 + 地面光带 + 屏幕抖动；金字「WorkBuddy」砸在图标下方，「下载之后直接就用」擦出；1.0s 图标缩到左上角成徽标（和真人收窗同一刻，画面一次形态突变）",
    use: "只给《WorkBuddy 这 5 个设置》用（开场不重样）",
    techniques: ["首帧真 logo 砸下", "闪白+冲击环+速度线", "落地压痕+抖屏", "图标收角成徽标", "大字居中+黑描边"],
    schema: s,
    C,
    maxSec: 3,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        x: 210, // 真人右移，让出居中的图标与大字区（开场结束前自动回中）
        punches: [{ at: dd.landAt, amt: 0.085 }],
      }),
  }),
  noGallery: true,
  opening: {
    script: "../../../neurocast-wb-5settings",
    hook: "真身图标砸下+落地冲击+收角",
    techniques: ["首帧真 logo 砸下", "冲击环+速度线+压痕", "图标收角成徽标", "大字居中"],
  },
};
