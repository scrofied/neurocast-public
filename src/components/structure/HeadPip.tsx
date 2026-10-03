import React from "react";
import { z } from "zod";
import { Freeze, Img, OffthreadVideo } from "remotion";
import { clamp } from "../../lib/anim";
import { assetSrc, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Corners, fitFont, Heading } from "../../lib/ui";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { Sfx } from "../../lib/sfx";
import type { CompDef, CompProps } from "../types";

// 真人 + 真素材同屏：满屏放真截图/录屏，一角放你本人的口播窗。
// 和 talking-head-stage 的区别：那边人是主角、素材只是侧栏插图；这里素材是主角，
// 人只是「我亲眼看过的证据」。信任度靠这两样叠出来，不靠代码动画。
const schema = z.object({
  src: z.string().describe("主画面素材（相对 public/）：真截图 / 录屏 / 照片"),
  video: z.string().optional().describe("真人口播视频（相对 public/）：没有真人视频就别用这个组件"),
  kind: z.enum(["image", "video"]).optional().describe("主画面是图还是视频；不给按文件类型自动判"),
  aspect: z.number().optional().describe("主画面宽高比（管线实测后自动填入，别手写）"),
  frames: z.number().optional().describe("口播视频总帧数（管线实测后自动填入，别手写）"),
  label: z.string().optional().describe("角窗下那条名字：如「我本人 · 2026-10-01 录」"),
  kicker: z.string().optional(),
  title: z.string().optional(),
  note: z.string().optional().describe("主画面旁边的一句说明：这张图在讲什么"),
  side: z.enum(["left", "right"]).default("right").describe("角窗放哪一角"),
  big: z.number().default(0.34).describe("角窗高占画面高的比例（0.24~0.42）"),
  focusX: z.number().default(0.5).describe("口播取景横向重心（0~1）"),
  focusY: z.number().default(0.34).describe("口播取景纵向重心（0~1，脸一般在 0.3 上下）"),
  at: z.number().optional().describe("主画面进来的时刻"),
  source: sourceSchema,
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const start = cueOr(data.at, 4);
  const src = assetSrc(data.src);
  const clip = assetSrc(data.video);
  const isVideo = data.kind === "video" || (data.kind === undefined && /\.(mp4|webm|mov|m4v)$/i.test(data.src ?? ""));
  // 宽高比是管线量出来填的，画框就按真比例开，cover 不会切掉内容；
  // 没量过（手写分镜、组件预览）时宁可留黑边，也不能把表格最左边那列模型名裁掉。
  const fit = data.aspect ? "cover" : "contain";
  const ar = data.aspect ?? 16 / 10;

  // 主画面：留出一角给角窗，别把人脸压在素材的字上
  const pw = Math.min(320, width * (data.big ?? 0.34) * 0.72);
  const ph = pw * 1.26;
  const stageW = Math.min(width - 200, 1420);
  const stageH = Math.min(height - 300, stageW / ar);
  const sx = (width - stageW) / 2;
  const sy = height / 2 - stageH / 2 + 46;
  const px = data.side === "left" ? sx - pw / 2 + 18 : sx + stageW - pw / 2 - 18;
  const py = sy + stageH - ph / 2 + 26;

  const e = enterAt(frame, start, { fallback: "rise", dur: 18, from: 0.94 });
  const ePip = enterAt(frame, start + 10, { fallback: data.side === "left" ? "slide-l" : "slide-r", dur: 16 });
  const vf = data.frames ?? Infinity;
  const last = Math.max(0, Math.floor(vf) - 2);
  const rec = Math.floor(frame / 18) % 2 === 0;

  return (
    <>
      <Heading kicker={data.kicker ?? "REAL FOOTAGE"} title={data.title} frame={frame} width={width} />

      <div
        style={{
          position: "absolute",
          left: sx,
          top: sy,
          width: stageW,
          height: stageH,
          borderRadius: 18,
          overflow: "hidden",
          background: "#0b0f17",
          border: `1.5px solid ${alpha(t.primary, 0.5)}`,
          boxShadow: `0 0 60px ${alpha(t.primary, 0.16)}, 0 34px 110px rgba(0,0,0,.72)`,
          transform: `scale(${e.scale}) translate(${e.dx}px, ${e.dy}px)`,
          clipPath: e.clip,
          opacity: clamp(e.opacity),
        }}
      >
        {!src && <MissingAsset field="src" hint="head-pip 的主画面必须是一张真截图或真录屏" w={stageW} h={stageH} frame={frame} at={start} />}
        {src && isVideo && <OffthreadVideo src={src} muted style={{ width: stageW, height: stageH, objectFit: fit }} />}
        {src && !isVideo && <Img src={src} style={{ width: stageW, height: stageH, objectFit: fit }} />}
        {data.note && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "22px 26px 16px", background: `linear-gradient(180deg, transparent, ${alpha(t.bg, 0.94)})`, fontFamily: t.font.body, fontWeight: 700, fontSize: fitFont(data.note, stageW - 120, 26, 20), color: t.text }}>
            {data.note}
          </div>
        )}
        <div style={{ position: "absolute", right: 0, bottom: data.note ? 66 : 12, paddingRight: 16 }}>
          <SourceBadge source={data.source} frame={frame} />
        </div>
      </div>

      {/* 真人口播角窗 */}
      {clip && (
        <div style={{ position: "absolute", left: px, top: py, width: pw, height: ph, transform: `translate(${ePip.dx}px, ${ePip.dy}px) scale(${ePip.scale})`, opacity: clamp(ePip.opacity) }}>
          <div style={{ position: "relative", width: pw, height: ph, borderRadius: 22, overflow: "hidden", background: "#000", border: `2px solid ${alpha(t.primary, 0.8)}`, boxShadow: `0 0 46px ${alpha(t.primary, 0.3)}, 0 22px 60px rgba(0,0,0,.7)` }}>
            {frame < last ? (
              <OffthreadVideo src={clip} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${data.focusX * 100}% ${data.focusY * 100}%` }} />
            ) : (
              <Freeze frame={last}>
                <OffthreadVideo src={clip} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${data.focusX * 100}% ${data.focusY * 100}%` }} />
              </Freeze>
            )}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(t.bg, 0.04)}, ${alpha(t.bg, 0.3)})`, mixBlendMode: "multiply" }} />
            <Corners color={t.primary} size={18} inset={9} />
            <div style={{ position: "absolute", left: 12, top: 10, display: "flex", alignItems: "center", gap: 7, fontFamily: t.font.mono, fontSize: 15, letterSpacing: 2, color: t.text, opacity: 0.9 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: rec ? t.bad : alpha(t.bad, 0.35), boxShadow: rec ? `0 0 10px ${t.bad}` : "none" }} />
              REC
            </div>
          </div>
          {data.label && (
            <div style={{ marginTop: 10, textAlign: "center", fontFamily: t.font.mono, fontSize: 17, letterSpacing: 1, color: alpha(t.text, 0.9) }}>{data.label}</div>
          )}
        </div>
      )}
      {!clip && (
        <div style={{ position: "absolute", left: px, top: py + ph / 2, width: pw, textAlign: "center", fontFamily: t.font.mono, fontSize: 17, color: alpha(t.dim, 0.8), opacity: clamp(ePip.opacity * 0.9) }}>
          （没有真人口播视频：video 字段空着）
        </div>
      )}

      <Sfx name="impact" at={start + 2} volume={0.32} />
      {clip && <Sfx name="tick" at={start + 10} volume={0.24} />}
    </>
  );
};

export const HeadPip: CompDef<D> = {
  id: "head-pip",
  name: "真人 + 真素材同屏",
  layer: "structure",
  variants: 2,
  minSec: 3,
  maxSec: 18,
  tags: ["我", "本人", "真人", "口播", "亲历", "现场", "实拍"],
  motion: { kind: "满屏素材推进，讲到「我」时人窗从角落滑入并点亮 REC", energy: 3 },
  desc: "主画面是一整张真截图/录屏（带来源角标），右下角或左下角叠一个真人口播小窗，人只在需要露脸的镜头出现",
  use: "「我自己在电脑前录的」「你们看我这个后台」「我当时就在现场」——凡是「我这个人 + 我真看到了」的句子。素材组件里最需要真人临场的一条；没有真口播视频就别选它",
  schema,
  assetFields: ["src", "video"],
  // src 和 video 的元数据都铺在 data 这一层：主画面管 kind/aspect，真人那条只管 frames（角窗冻在最后一帧用）
  assetMeta: { video: ["frames"] },
  example: {
    kicker: "REAL FOOTAGE",
    title: "这是我自己的后台",
    src: "assets/arena-rank-overall.png",
    video: "assets/demo-talk.mp4",
    label: "我本人 · 2026-10-01 录",
    note: "第一行就是我说的那个模型",
    side: "right",
    big: 0.34,
    source: { platform: "我自己的录屏", capturedAt: "2026-10-01" },
  },
  C,
};
