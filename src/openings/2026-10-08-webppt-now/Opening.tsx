import React from "react";
import { OffthreadVideo, staticFile } from "remotion";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { drift, punch, shakes } from "../../lib/cine/motion";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { CharPop, Slam, Stamp } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";

// 《现在的PPT，都做成这样了》(v7) 专属开场（2026-10-08）
// 第一句（0→锚「以前」）：全屏直接铺 d1 演示视频 + 大字标题砸出（无设备框、无真人——presenter showFrom=align）。
// 「以前」起 12 帧：标题退场，视频滑到右列变成面板，左列是引擎画的真人窗（presenter.stage 同矩形）= 左右布局；
// 面板外铺暗色遮罩盖住底层 3D 背景/机框残影（遮罩绕开真人窗）。
// 真人开口同步：make.mjs 自动对齐把 talk.mp4 第 0 帧（「以前」）卡到 TTS 的「以前」。
// f0        大字「现在的PPT」砸出 + 闪白 + 冲击 + 速度线           （形态 1）
// 做成这样  「都做成这样了？」逐字弹出                              （形态 2）
// 做得好    绿胶囊「加分项」弹出；「加分项$」面板上绿色 +1 大印章砸下 + 光环（形态 3/4）
// 撑场面    红胶囊「扣分项」弹出；「扣分项$」红色 -1 盖章、画面抖动、+1 灰化（形态 5）
// dur-10    面板+遮罩淡出（底下 s0 同一视频同起点，无缝）、整层甩出交给下一镜（screen d5）
const STAGE = { x: 64, y: 150, w: 560, h: 747 }; // 与 input.json presenter.stage 同一矩形：真人窗由引擎画，开场只负责让光+描边
const PANEL = { x: 664, y: 198, w: 1216, h: 684 }; // 右列演示视频面板（16:9）
const schema = z.object({
  video: z.string().default("").describe("第一句全屏垫底演示视频（assetFields 注入 jobs 路径）"),
  coverAt: z.number().default(81).describe("布局翻转帧（锚第二句「以前」）：标题退场、全屏视频滑到右列、真人左列入画"),
  hook: z.string().default("现在的PPT").describe("首帧大字（台词开头，f0 砸出）"),
  hook2: z.string().default("都做成这样了？").describe("第二行问句（锚「做成这样」逐字弹出）"),
  good: z.string().default("加分项").describe("绿胶囊文字（锚「做得好」弹出）"),
  bad: z.string().default("扣分项").describe("红胶囊文字（锚「撑场面」弹出）"),
  plus: z.string().default("+1").describe("绿色大数字（锚「加分项$」盖章）"),
  minus: z.string().default("-1").describe("红色大数字（锚「扣分项$」盖章）"),
  askAt: z.number().default(38).describe("第二行弹出帧"),
  goodAt: z.number().default(108).describe("绿胶囊弹出帧（锚「做得好」）"),
  goodHitAt: z.number().default(138).describe("+1 盖章帧（锚「加分项$」）"),
  badAt: z.number().default(202).describe("红胶囊弹出帧（锚「撑场面」）"),
  badHitAt: z.number().default(240).describe("-1 盖章帧（锚「扣分项$」）"),
});
type D = z.infer<typeof schema>;

/** 评分胶囊：小字标签，pop 进场 */
const Pill: React.FC<{ frame: number; at: number; text: string; color: string; font: string; x: number; y: number }> = ({ frame, at, text, color, font, x, y }) => {
  const t = useTheme();
  if (frame < at) return null;
  const pop = easeOutBack(prog(frame, at, 9));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        padding: "10px 30px",
        borderRadius: 999,
        background: alpha(t.bg, 0.72),
        border: `5px solid ${color}`,
        boxShadow: `0 0 34px ${alpha(color, 0.55)}, 0 10px 26px rgba(0,0,0,.55)`,
        fontFamily: font,
        fontWeight: 900,
        fontSize: 58,
        lineHeight: 1.15,
        color: t.text,
        whiteSpace: "nowrap",
        opacity: clamp(pop * 3),
        transform: `scale(${pop}) translateY(${(1 - pop) * 26}px)`,
      }}
    >
      {text}
    </div>
  );
};

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const font = t.font.title;
  const out = easeIn(prog(frame, dur - 10, 10));
  const dr = drift(frame, 6, 0.05, seed);
  const hit = shakes(frame, [{ at: 0, amp: 11, len: 9 }, { at: d.goodHitAt, amp: 7, len: 6 }, { at: d.badHitAt, amp: 16, len: 12 }], seed);
  const plusDim = easeOut(prog(frame, d.badHitAt - 6, 8)); // 扣分项盖章后 +1 灰化
  const line2 = easeOut(prog(frame, d.askAt, 6));
  const goodGlow = frame >= d.goodHitAt && frame < d.goodHitAt + 10;
  const badGlow = frame >= d.badHitAt && frame < d.badHitAt + 10;
  // 布局翻转：全屏垫底 → 右列面板（12 帧）；标题同时退场；开场收尾整块淡出（底下 s0 播同一路视频，无缝）
  const mv = easeInOut(prog(frame, d.coverAt, 12));
  const titleOut = easeIn(prog(frame, d.coverAt - 4, 7)); // 真人露脸前标题必须完全退场

  return (
    <>
      {!!d.video && (
        <>
          {/* 暗色遮罩：盖住真人窗/右面板以外的底层画面（3D 背景、机框边缘），绕开左列 stage 矩形让引擎的真人窗露出来 */}
          {mv > 0.01 &&
            [
              { x: 0, y: 0, w: 1920, h: STAGE.y },
              { x: 0, y: STAGE.y + STAGE.h, w: 1920, h: 1080 - STAGE.y - STAGE.h },
              { x: 0, y: STAGE.y, w: STAGE.x, h: STAGE.h },
              { x: STAGE.x + STAGE.w, y: STAGE.y, w: 1920 - STAGE.x - STAGE.w, h: STAGE.h },
            ].map((r, i) => (
              <div key={i} style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, background: alpha(t.bg, 0.84 * mv), opacity: 1 - out }} />
            ))}
          <div
            style={{
              position: "absolute",
              left: lerp(0, PANEL.x, mv),
              top: lerp(0, PANEL.y, mv),
              width: lerp(1920, PANEL.w, mv),
              height: lerp(1080, PANEL.h, mv),
              opacity: 1 - out,
              overflow: "hidden",
              borderRadius: 18 * mv,
              border: mv > 0.4 ? `2.5px solid ${alpha(t.primary, 0.55)}` : undefined,
              boxShadow: mv > 0.4 ? `0 24px 70px rgba(0,0,0,.55), 0 0 40px ${alpha(t.primary, 0.15)}` : undefined,
            }}
          >
            <OffthreadVideo
              src={staticFile(d.video)}
              muted
              endAt={Math.round(dur + 2)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.03 + 0.04 * prog(frame, 0, Math.max(1, dur))})` }}
            />
          </div>
        </>
      )}
      <div style={{ position: "absolute", inset: 0, opacity: 1 - out, transform: `translate(${dr.x + hit.x - out * 200}px, ${dr.y + hit.y}px) rotate(${hit.r}deg) scale(${1 - out * 0.07})` }}>
      {/* 左侧压暗保证大字可读（布局翻转后撤掉，不压真人窗）；右侧随评分出场压暗 */}
      <Scrim side="left" size={0.55} strength={0.62} opacity={1 - mv} />
      <Scrim side="right" size={0.5} strength={0.55} opacity={easeOut(prog(frame, d.goodAt - 4, 10))} />
      <Flash frame={frame} at={0} len={8} peak={0.45} />
      <Flash frame={frame} at={d.goodHitAt} len={6} peak={0.3} color={t.primary} />
      <Flash frame={frame} at={d.badHitAt} len={8} peak={0.4} color={t.bad} />
      <SpeedLines frame={frame} at={0} x={470} y={300} color={alpha("#ffffff", 0.9)} len={12} seed={seed} />

      {/* 问句标题：第一句砸出，「以前」一出口即整体退场（真人出现后不再上屏） */}
      <div style={{ position: "absolute", inset: 0, opacity: 1 - titleOut, transform: `translateY(${-46 * titleOut}px) scale(${1 - 0.08 * titleOut})`, transformOrigin: "20% 30%" }}>
        <div style={{ position: "absolute", left: 116, top: 170 }}>
          <Slam frame={frame} at={0} text={d.hook} size={150} color={t.text} font={font} from={1.4} len={6} blur={4} minOpacity={0.9} strokeW={12} style={{ display: "inline-block", transformOrigin: "left center" }} />
        </div>
        {frame >= d.askAt - 2 && (
          <div style={{ position: "absolute", left: 132, top: 362, opacity: clamp(line2 * 3) }}>
            <CharPop frame={frame} at={d.askAt} text={d.hook2} cues={Array.from(d.hook2).map((_, i) => i)} hl={[]} size={104} color={t.gold} font={font} strokeW={9} />
          </div>
        )}
      </div>

      {/* 评分区（右侧）：胶囊在上、大数字在下先后盖章，两组上下错开不叠字 */}
      <Pill frame={frame} at={d.goodAt} text={d.good} color={t.primary} font={font} x={1420} y={140} />
      {frame >= d.goodHitAt && (
        <div style={{ position: "absolute", left: 1290, top: 235, opacity: 1 - plusDim * 0.6, filter: plusDim > 0.01 ? `grayscale(${plusDim * 0.8})` : undefined }}>
          <Stamp frame={frame} at={d.goodHitAt} text={d.plus} size={252} color={t.primary} font={font} rotate={-7} />
        </div>
      )}
      <Pill frame={frame} at={d.badAt} text={d.bad} color={t.bad} font={font} x={1420} y={560} />
      {frame >= d.badHitAt && (
        <div style={{ position: "absolute", left: 1290, top: 655 }}>
          <Stamp frame={frame} at={d.badHitAt} text={d.minus} size={260} color={t.bad} font={font} rotate={6} />
        </div>
      )}
      {goodGlow && <RingBurst frame={frame} at={d.goodHitAt} x={1480} y={360} color={t.primary} maxR={360} len={14} />}
      {badGlow && <RingBurst frame={frame} at={d.badHitAt} x={1480} y={790} color={t.bad} maxR={400} len={15} />}

      <Sfx name="impact" at={0} volume={0.5} />
      <Sfx name="swipe" at={d.coverAt} volume={0.3} />
      <Sfx name="pop" at={d.askAt} volume={0.3} />
      <Sfx name="pop" at={d.goodAt} volume={0.32} />
      <Sfx name="impact" at={d.goodHitAt} volume={0.4} />
      <Sfx name="ding" at={d.goodHitAt + 4} volume={0.42} />
      <Sfx name="pop" at={d.badAt} volume={0.32} />
      <Sfx name="stamp" at={d.badHitAt} volume={0.52} />
      <Sfx name="ding" at={d.badHitAt + 4} volume={0.36} />
      <Sfx name="whoosh" at={dur - 10} volume={0.25} />
      </div>
    </>
  );
};

export const OpeningWebpptNow: CompDef<D> = {
  id: "opening-webppt-now",
  name: "开场 · 首帧大字压在真实演示视频上+加分项/扣分项盖章评分",
  layer: "opening",
  variants: 1,
  minSec: 2,
  maxSec: 9,
  tags: ["开场", "反问钩子", "评分盖章"],
  assetFields: ["video"],
  desc: "第一句全屏直接铺真实演示视频（assetFields 注入）+大字砸出；锚「以前」标题退场、视频滑到右列成面板，与引擎画的左列真人窗（presenter.stage）构成左右布局，遮罩盖住其余底层；f0「现在的PPT」砸出+闪白冲击，锚「做成这样」金色问句逐字弹出；锚「做得好」绿胶囊「加分项」弹出、「加分项$」绿色 +1 大印章砸在面板上+光环；锚「撑场面」红胶囊「扣分项」弹出、「扣分项$」红色 -1 盖章整层抖动、+1 灰化；收尾面板+遮罩淡出（同一路视频无缝交还正片）",
  use: "只给《现在的PPT，都做成这样了》用（开场不重样）",
  noGallery: true,
  schema,
  example: {},
  C,
  // 真人层在左下小窗：只做轻微脉冲/抖动，幅度调小避免小窗晃得难受
  camera: (d, f, dur2) => {
    const fade = 1 - easeInOut(prog(f, dur2 - 12, 12));
    const s = shakes(f, [{ at: 0, amp: 5, len: 8 }, { at: d.badHitAt, amp: 6, len: 8 }], 3);
    const z = punch(f, 0, 0.05, 16, 0.3) * punch(f, d.badHitAt, 0.04, 12, 0.4);
    return { zoom: 1 + (z - 1) * fade, x: s.x * fade, y: s.y * fade, rot: s.r * fade };
  },
  opening: {
    script: "../../../opus55-web-ppt",
    hook: "反问钩子+加减分盖章（首屏即真实演示视频）",
    techniques: ["首帧大字", "闪白+冲击音", "逐字弹出", "胶囊弹出", "盖章评分", "光环+叮", "盖章抖动灰化", "甩出退场"],
  },
};
