import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim } from "../../lib/cine/Flash";
import { CharPop, Counter, Slam, Stamp, Wipe } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { assetUrl } from "../../lib/asset";
import type { CompDef, CompProps } from "../../components/types";
import { cam, idxOf, ink, Stage, tpl } from "../templates/kit";

// 《用 Opus 5.5 做爆款视频的人不会告诉你的四件事》专属开场（2026-10-04，数字冲击+悬念）
// 第 0 帧：kicker「那些用 Opus 5.5 做出AI爆款视频的人」逐字弹出 + 大字「绝对不会告诉你」砸下 + 闪白 impact
// ~4.2s「四件事」：四张悬念小卡依次擦出（做什么/什么感觉/哪些不要/什么算完成）
// ~6.0s「475」：数字滚动 0→475 +「条真实视频提示词」；有真人层时合集墙截图(a01wall)在 475 背后快速上滚（几百条逐条拆的震撼感），无真人层时切成全屏片墙推近
// ~10.3s「收藏」：金章「先收藏起来」砸下 + 冲击环 + ding
// 真人口播还没录：input 不给 presenter 时，开场自己铺不透明背景（opuscar 成片快切 → 成片墙），首帧不留残帧。
type D = z.infer<typeof s>;
const s = z.object({
  kick: z.string().default("那些用 Opus 5.5 做出AI爆款视频的人").describe("首行小字（逐字弹出）"),
  hook: z.string().default("绝对不会告诉你").describe("第 0 帧大字"),
  four: z.array(z.string()).default(["要它做什么", "想要什么感觉", "哪些东西不要", "什么才算完成"]).describe("四张悬念小卡（≤6 字）"),
  num: z.number().default(475).describe("滚动到的数字"),
  numLabel: z.string().default("真实视频提示词 · 逐条拆解").describe("数字下的说明"),
  fav: z.string().default("先收藏起来").describe("盖章文字"),
  fourAt: z.number().default(126).describe("四张小卡入场（锚点/帧）"),
  wallAt: z.number().default(150).describe("全屏合集墙上屏（锚「这」，硬切入）"),
  numAt: z.number().default(180).describe("475 数字滚动（锚点/帧）"),
  labAt: z.number().default(268).describe("说明文字擦出（锚点/帧）"),
  favAt: z.number().default(309).describe("盖章时刻（锚点/帧）"),
  bgs: z.array(z.string()).default([]).describe("无真人层时的快切垫底（真实成片帧，路径数组）"),
  wall: z.string().default("").describe("成片墙图：无真人层时全屏铺底推近；有真人层时在 475 背后快速上滚"),
  aspect: z.number().optional(),
  kind: z.string().optional(),
});

const C: React.FC<CompProps<D> & { presenter?: boolean }> = ({ data: d, frame, dur, seed, presenter }) => {
  const t = useTheme();
  const pillIn = (i: number) => easeOutBack(prog(frame, d.fourAt + i * 6, 8));
  const numIn = prog(frame, d.numAt, 8);
  const labIn = prog(frame, d.labAt, 8);
  const favIn = prog(frame, d.favAt, 7);
  const stampP = prog(frame, d.favAt + 5, 6);
  const fadeOut = easeIn(prog(frame, dur - 12, 12));
  // 「这」→「收藏」之间 = 独立的全屏滚动墙分镜：其余文字和真人全部撤下，只留墙+475+说明
  const wallShot = !!presenter && !!d.wall && frame >= d.wallAt;

  // ---- 无真人层的自带背景：真实成片帧快切 → 475 起切成片墙推近 ----
  const bgOn = !presenter && (d.bgs.length > 0 || !!d.wall);
  const seg = Math.max(12, Math.round((d.numAt - 6) / Math.max(1, d.bgs.length)));
  const cutIdx = Math.min(d.bgs.length - 1, Math.floor(frame / seg));
  const wallIn = d.wall ? easeOut(prog(frame, d.numAt - 8, 12)) : 0;
  const wallZoom = 1 + 0.1 * easeIn(prog(frame, d.numAt, Math.max(10, dur - d.numAt)));
  const cutZoom = 1.05 + 0.05 * prog(frame - cutIdx * seg, seg, 1);

  return (
    <>
      {bgOn && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - fadeOut }}>
          {d.bgs[cutIdx] && (
            <Img src={assetUrl(d.bgs[cutIdx])} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${cutZoom})`, filter: "saturate(1.05) brightness(0.9)" }} />
          )}
          {d.wall && wallIn > 0.001 && (
            <Img src={assetUrl(d.wall)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: wallIn, transform: `scale(${wallZoom})` }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(100deg, ${alpha("#04070c", 0.93)} 0%, ${alpha("#04070c", 0.74)} 46%, ${alpha("#04070c", 0.3)} 100%)` }} />
          <div style={{ position: "absolute", inset: 0, background: alpha("#04070c", 0.18) }} />
        </div>
      )}

      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.fourAt, amp: 5, len: 5 }, { at: d.wallAt, amp: 9, len: 6 }, { at: d.numAt, amp: 9, len: 7 }, { at: d.favAt, amp: 12, len: 8 }]} exit="up">
        <Flash frame={frame} at={0} len={8} peak={bgOn ? 0.5 : 0.32} />
        <Flash frame={frame} at={d.favAt} len={7} peak={0.4} color={t.gold} />
        {frame >= d.favAt && frame < d.favAt + 16 && <RingBurst frame={frame} at={d.favAt} x={1430} y={840} color={t.gold} maxR={320} len={14} />}

        {/* 真人全屏时：左侧压暗保证大字可读（人已被 camera 右移，脸在右侧） */}
        {!bgOn && presenter && !wallShot && <Scrim side="left" size={0.62} strength={0.6} />}

        {/* 「这」字一出：切独立分镜——合集墙整屏砸入、450px/s 循环上滚，说到「收藏」切回真人盖章 */}
        {wallShot && frame < d.favAt && (() => {
          const o = ((frame - d.wallAt) * 15) % 1920;
          return (
            <>
              <div style={{ position: "absolute", inset: 0 }}>
                <div style={{ position: "absolute", left: 0, top: -o, width: 1920, height: 3840 }}>
                  <Img src={assetUrl(d.wall)} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1920 }} />
                  <Img src={assetUrl(d.wall)} style={{ position: "absolute", left: 0, top: 1920, width: 1920, height: 1920 }} />
                </div>
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(100deg, ${alpha("#04070c", 0.88)} 0%, ${alpha("#04070c", 0.55)} 52%, ${alpha("#04070c", 0.28)} 100%)` }} />
                <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 240px rgba(2,5,10,.85)" }} />
              </div>
              <Flash frame={frame} at={d.wallAt} len={7} peak={0.4} />
            </>
          );
        })()}

        {/* 第 0 帧：kicker 逐字 + 大字三连拍（绝对不会 / 告诉你的 / 四件事），全部走左列不挡脸；进墙分镜后整列撤下 */}
        {!wallShot && (
        <div style={{ position: "absolute", left: 104, top: 150 }}>
          <CharPop frame={frame} at={0} text={d.kick} cues={Array.from(d.kick).map((_, i) => Math.min(2 + i, 14))} hl={idxOf(d.kick, "Opus 5.5")} hlColor={t.accent} size={46} color={t.text} font={t.font.title} strokeW={6} />
          <div style={{ marginTop: 20 }}>
            <Slam frame={frame} at={0} text={d.hook.slice(0, 4)} size={128} color={t.primary} font={t.font.title} from={1.7} len={6} blur={4} minOpacity={0.9} strokeW={11} style={{ display: "inline-block", transformOrigin: "left center" }} />
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 10 }}>
            <Slam frame={frame} at={4} text={d.hook.slice(4) + "的"} size={128} color={t.text} font={t.font.title} from={1.2} len={6} blur={4} minOpacity={0.9} strokeW={11} style={{ display: "inline-block", transformOrigin: "left center" }} />
            <Slam frame={frame} at={8} text="四件事" size={128} color={t.gold} font={t.font.title} from={1.2} len={6} blur={4} minOpacity={0.9} strokeW={11} style={{ display: "inline-block", transformOrigin: "left center" }} />
          </div>
        </div>
        )}

        {/* ~4.2s：四张悬念小卡依次擦出（墙分镜期间撤下） */}
        {!wallShot && d.four.slice(0, 4).map((txt, i) => {
          const at = d.fourAt + i * 6;
          if (frame < at) return null;
          return (
            <div key={txt} style={{ position: "absolute", left: 104 + i * 428, top: 520, opacity: clamp(pillIn(i) * 3), transform: `scale(${0.6 + 0.4 * pillIn(i)})`, transformOrigin: "left center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 30px", borderRadius: 18, background: alpha(t.bg, 0.55), border: `4px solid ${alpha(t.primary, 0.85)}`, boxShadow: "0 12px 34px rgba(0,0,0,.5)" }}>
                <span style={{ ...ink(52, t.primary, t.font.mono) }}>{["①", "②", "③", "④"][i]}</span>
                <span style={{ ...ink(46, t.text, t.font.title, 7), whiteSpace: "nowrap" }}>{txt}</span>
              </div>
            </div>
          );
        })}

        {/* ~6s：475 数字滚动 + 说明 */}
        {frame >= d.numAt - 2 && (
          <div style={{ position: "absolute", left: 104, top: 640, display: "flex", alignItems: "baseline", gap: 16, opacity: clamp(numIn * 3), transform: `translateY(${(1 - numIn) * 90}px)` }}>
            <Counter frame={frame} at={d.numAt} from={0} to={d.num} size={210} color={t.gold} font={t.font.title} strokeW={13} style={{ display: "inline-block" }} />
            <span style={{ ...ink(96, t.gold, t.font.title, 9), display: "inline-block", opacity: stampP ? 1 : clamp(numIn * 3) }}>条</span>
          </div>
        )}
        {frame >= d.labAt && (
          <div style={{ position: "absolute", left: 112, top: 872 }}>
            <Wipe frame={frame} at={d.labAt} text={d.numLabel} size={62} color={t.text} font={t.font.title} len={8} edge={t.primary} strokeW={8} />
          </div>
        )}

        {/* ~10.3s：金章「先收藏起来」 */}
        {frame >= d.favAt - 2 && (
          <div style={{ position: "absolute", left: 1180, top: 740, opacity: clamp(favIn * 3), transform: `scale(${0.7 + 0.3 * favIn}) rotate(${(1 - favIn) * -8}deg)` }}>
            {frame >= d.favAt + 3 ? <Stamp frame={frame} at={d.favAt + 3} text={d.fav} size={92} color={t.gold} font={t.font.title} rotate={-5} /> : <div style={{ ...ink(92, alpha(t.gold, 0.5), t.font.title) }}>{d.fav}</div>}
          </div>
        )}

        <Sfx name="impact" at={0} volume={0.45} />
        {d.four.slice(0, 4).map((_, i) => <Sfx key={i} name="pop" at={d.fourAt + i * 6 + 2} volume={0.28} />)}
        <Sfx name="impact" at={d.wallAt} volume={0.42} />
        <Sfx name="whoosh" at={d.wallAt + 2} volume={0.24} />
        <Sfx name="riser" at={d.numAt - 18} volume={0.2} />
        <Sfx name="impact" at={d.numAt} volume={0.36} />
        <Sfx name="ding" at={d.numAt + 16} volume={0.4} />
        <Sfx name="whoosh" at={d.labAt} volume={0.22} />
        <Sfx name="stamp" at={d.favAt + 4} volume={0.42} />
        <Sfx name="ding" at={d.favAt + 9} volume={0.42} />
        <Sfx name="whoosh" at={dur - 10} volume={0.25} />
      </Stage>
    </>
  );
};

export const OpeningOpus55FourThings: CompDef<D> = {
  ...tpl<D>({
    id: "opening-opus55-4things",
    name: "开场 · 数字悬念（首帧不会告诉你 → 四张小卡 → 475滚动 → 收藏盖章）",
    hook: "数字冲击+悬念",
    desc: "第 0 帧 kicker 逐字 + 大字「绝对不会告诉你的四件事」砸下闪白；四张悬念小卡依次擦出；「475 条」数字滚动（背景切成 100 条成片墙推近）；金章「先收藏起来」盖章+冲击环。无真人层时自带不透明背景（真实成片帧快切→成片墙）",
    use: "只给《用 Opus 5.5 做爆款视频的人不会告诉你的四件事》用（开场不重样）",
    techniques: ["首帧大字", "闪白+冲击音", "逐字kicker", "悬念小卡依次擦出", "数字滚动", "真实素材铺底", "盖章+冲击环+ding"],
    schema: s,
    C,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        x: 260, // 真人右移让出左列大字区（只作用于真人层；开场结束前 12 帧自动回中）
        punches: [{ at: 0, amt: 0.06 }, { at: dd.fourAt, amt: 0.04 }, { at: dd.wallAt, amt: 0.05 }, { at: dd.numAt, amt: 0.05 }, { at: dd.favAt, amt: 0.07 }],
      }),
  }),
  noGallery: true,
  assetFields: ["bgs[]", "wall"],
  opening: {
    script: "../../../neurocast-opus55-4things",
    hook: "数字冲击+悬念",
    techniques: ["首帧大字", "闪白+冲击音", "悬念小卡依次擦出", "数字滚动", "真实素材铺底", "盖章+冲击环+ding"],
    selfBg: true,
  },
};
