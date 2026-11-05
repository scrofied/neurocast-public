import React from "react";
import { z } from "zod";
import { Img, OffthreadVideo } from "remotion";
import { clamp, easeOut, prog } from "../../lib/anim";
import { assetSrc, assetUrl, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { Headline, fitFont } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 素材叠层墙：把仓库/产品自带的真实演示片段直接铺在画面上，格子尽量大、边距尽量小，
// 每一格自己慢慢推近（视频和静帧都推），按台词锚点一格格亮起来。
// 画面上的文字只来自标题/结论行 —— 素材本身一格文字都不压（没有角标、没有编号、没有名牌、没有黑场），
// 避免成片里出现"叠在素材上的字"被当成水印。
// 和 board-proof / evidence-zoom 的分工：
//   board-proof 举证「这张页面/这张榜是真的」；
//   evidence-zoom 圈出「这个数字/这行字」；
//   demo-reel 展示「这东西实际跑出来长什么样」—— 视频会真的播，不是截一张图。
const tile = z.object({
  src: z.string().describe("演示素材（相对 public/）：仓库里的 mp4/gif 转好的视频，或样片截图"),
  kind: z.enum(["image", "video"]).optional().describe("视频还是静帧：prepAssets 探过会自动填，别手写"),
  aspect: z.number().optional().describe("素材宽高比（管线自动带）"),
  frames: z.number().optional().describe("素材总帧数（管线实测后自动填入，别手写）"),
  label: z.string().optional().describe("旧字段，仅供备注：素材上不再上屏任何文字"),
  sub: z.string().optional().describe("旧字段，仅供备注：素材上不再上屏任何文字"),
  at: z.number().optional().describe("这一格什么时候出现（锚点或帧）；缺省按顺序自动错开"),
  fit: z.enum(["cover", "contain"]).default("cover").describe("画风/实拍用 cover；带界面的样片用 contain，别把按钮裁掉"),
  zoom: z.number().default(1.1).describe("这一格从头到尾的推近量（1.1 = 推进 10%）；视频静帧都推"),
  speed: z.number().min(0.3).max(2.5).default(1).describe("视频播放倍速；样片后段是空镜/片尾时调慢，让有内容的段落撑住整镜"),
});
const schema = z.object({
  kicker: z.string().optional().describe("左上角小标签，如「仓库自带 · 四种画风」；不写就没有"),
  title: z.string().optional().describe("一行标题，别复述台词；不写就没有"),
  tiles: z.array(tile).min(2).max(7).describe("2~7 格；2 格一大一行，3 格上二下一，4 格 2×2，5~7 格上三下二 / 上四下三，格子自动撑满安全区"),
  note: z.string().optional().describe("图墙下方一行结论，如「先挑方案，再动手」"),
  noteAt: z.number().optional().describe("结论出现的时刻（锚点或帧）；缺省随第一格出现"),
  source: sourceSchema.describe("所有格子的共同出处（真实素材角标）；仓库演示写 GitHub + 仓库名 + 采集日期，不要写 url"),
});
type D = z.infer<typeof schema>;

const A169 = 16 / 9;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const n = d.tiles.length;
  // 安全区：顶部 HUD 90 + kicker(96) + 标题(130，字号 54，底边约 200)，底部字幕 ~150；左右只留 44，格子尽可能大
  const gutter = Math.min(56, width * 0.03);
  const gap = n >= 5 ? 16 : 20;
  // 标题带必须真的让开：216 = 标题底边 200 + 16 呼吸。写 156 的时候格子会压住标题下半截，
  // 那就是「文字压在素材上」，正是要避免的样子。
  const boxTop = d.kicker || d.title ? Math.max(216, height * 0.2) : Math.max(112, height * 0.104);
  const boxH = height - boxTop - Math.max(150, height * 0.14);
  const boxW = width - gutter * 2;
  const rows = n <= 2 ? 1 : 2;
  const perRow = rows === 1 ? [n] : [Math.ceil(n / 2), Math.floor(n / 2)];
  // 有结论行时从底部让出一条，压在字幕带之上，不和字幕抢地方
  const noteBand = d.note ? 66 : 0;
  const contentH = boxH - noteBand;
  const bandH = (contentH - gap * (rows - 1)) / rows;
  // 每行独立排：先按行内格数分宽，再受行高限制 → 格子始终是 16:9 里能放下的最大块
  const layout = perRow.map((k, r) => {
    const w = Math.min((boxW - gap * (k - 1)) / k, bandH * A169);
    const h = w / A169;
    const rowW = k * w + gap * (k - 1);
    const x0 = (width - rowW) / 2;
    const y0 = boxTop + r * (bandH + gap) + (bandH - h) / 2;
    return { k, w, h, x0, y0 };
  });
  const cellOf = (i: number) => {
    let acc = 0;
    for (let r = 0; r < layout.length; r++) {
      if (i < acc + layout[r].k) return { row: r, col: i - acc };
      acc += layout[r].k;
    }
    return { row: layout.length - 1, col: 0 };
  };

  const cues = d.tiles.map((x, i) => (typeof x.at === "number" ? x.at : 6 + i * 9));
  const noteAt = typeof d.noteAt === "number" ? d.noteAt : cues[0] + 8;
  const eNote = enterAt(frame, noteAt, { fallback: "rise", dur: 14, dist: 0.5 });
  const pNote = clamp(eNote.p);
  const noteY = boxTop + contentH + 10;

  return (
    <>
      <Headline kicker={d.kicker} title={d.title} frame={frame} capW={1180} />

      {/* 角标放标题右侧，不占图墙的安全区；仓库演示的出处是可信度的一部分 */}
      <div style={{ position: "absolute", right: 96, top: 96, width: 1, height: 1 }}>
        <SourceBadge source={d.source} frame={frame} />
      </div>

      {d.tiles.map((x, i) => {
        const { row, col } = cellOf(i);
        const L = layout[row];
        const bx = L.x0 + col * (L.w + gap);
        const by = L.y0;
        const cue = cues[i];
        // 入场：从 0.86 弹到位（整格缩放，不裁内容）
        const e = enterAt(frame, cue, { fallback: "rise", dur: 13, from: 0.86 });
        const isVideo = x.kind === "video";
        const life = Math.max(18, dur - cue);
        const push = clamp(prog(Math.max(0, frame - cue), 0, life));
        const zoomAmt = Math.max(0, (x.zoom ?? 1.1) - 1);
        // 视频格：推近做在「整格」上（连边框一起放大，画面内容一格都不裁），
        // 因为演示片段边缘全是 UI 文字，裁切会把字切成半截 —— 那正是「被裁掉的水印」的样子。
        // 静帧（画风样片，边上没字）才做画内的缓推。
        const grow = isVideo ? 1 + Math.min(zoomAmt, 0.04) * push : 1;
        // 素材比镜头短：慢一点放，别演到一半黑掉；比镜头长：只取用得到的那段。
        const vf = x.frames ?? 0;
        const auto = vf > 0 && vf < dur ? Math.max(0.55, vf / dur) : 1;
        const rate = clamp(auto * (x.speed ?? 1), 0.3, 3);
        const trimAfter = vf > 0 && vf > dur ? dur : undefined;
        const kin = isVideo ? push : easeOut(prog(Math.max(0, frame - cue), 0, life));
        const src = assetSrc(x.src);
        // 静帧的画内推近一律绕正中心：偏心会把一侧多推出几 %，正好把贴边的字切掉半截
        // —— 那副样子和「被裁掉的水印」一模一样，是平台判「无效水印」的头号来源。
        // 所以：中心对称 + 分镜里只给「画面里没有字」的静帧写 zoom > 1。
        const origin = "50% 50%";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: bx,
              top: by,
              width: L.w,
              height: L.h,
              opacity: clamp(e.opacity),
              transform: `translateY(${e.dy * 0.35}px) scale(${e.scale * grow})`,
              zIndex: i,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                borderRadius: 16,
                background: "#04060a",
                border: `2px solid ${alpha(t.primary, 0.5)}`,
                boxShadow: `0 22px 64px rgba(0,0,0,.6), 0 0 34px ${alpha(t.primary, 0.16)}`,
              }}
            >
              {!src ? (
                <MissingAsset field="tiles[].src" hint="这里要放仓库自带的演示片段/样片，不是代码画的图" w={L.w} h={L.h} frame={frame} />
              ) : isVideo ? (
                <OffthreadVideo
                  src={src}
                  muted
                  playbackRate={rate}
                  {...(trimAfter !== undefined ? { trimAfter } : {})}
                  style={{ width: "100%", height: "100%", objectFit: x.fit === "contain" ? "contain" : "cover", display: "block" }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + zoomAmt * kin})`, transformOrigin: origin }}>
                  <Img src={assetUrl(x.src)} style={{ width: "100%", height: "100%", objectFit: x.fit === "contain" ? "contain" : "cover", display: "block" }} />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {d.note && (
        <div
          style={{
            position: "absolute",
            left: gutter,
            right: gutter,
            top: noteY,
            textAlign: "center",
            fontFamily: t.font.title,
            fontWeight: 800,
            fontSize: fitFont(d.note, width - gutter * 2, 34, 22),
            color: alpha(t.text, 0.9),
            letterSpacing: 1,
            opacity: pNote,
            transform: `translateY(${(1 - pNote) * 16}px)`,
            textShadow: `0 0 24px ${alpha(t.primary, 0.35)}`,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ display: "inline-block", width: 34, height: 3, background: t.primary, boxShadow: `0 0 12px ${t.primary}`, verticalAlign: "middle", marginRight: 16 }} />
          {d.note}
        </div>
      )}

      {d.tiles.map((x, i) => (
        <Sfx key={`s${i}`} name="pop" at={cues[i]} volume={0.22} />
      ))}
      {d.note && <Sfx name="ding" at={Math.round(noteAt)} volume={0.24} />}
    </>
  );
};

export const DemoReel: CompDef<D> = {
  id: "demo-reel",
  name: "素材叠层墙",
  layer: "screen",
  variants: 1,
  minSec: 2,
  maxSec: 12,
  tags: ["演示", "样片", "画风", "对比", "视频", "仓库", "多格"],
  motion: { kind: "多格素材铺满画面 + 依次入场 + 每格持续推近", energy: 2 },
  desc:
    "2~7 格真实演示素材直接叠在画面上：格子撑满安全区（2 格一行两大图，3 格上二下一，4 格 2×2，5~7 格上三下二/上四下三），视频真的播、静帧也推，每格从入场到镜头结束持续放大；素材上一律不压文字（无编号、无名牌、无黑场），只有标题/结论行是画面自己的字。右上角统一挂一处真实出处角标",
  use:
    "讲一个东西「实际跑出来是什么样」时用它：一个仓库自带的多个操作片段（点按钮/转场/片头）、同一句解说在几种画风下的成片（风格对比）、同一个方案在三种视觉方向下的预览（选型）、一个工具导出的多段样片。只讲概念/关系、没有真实片段时别用",
  schema,
  assetFields: ["tiles[].src"],
  example: {
    kicker: "仓库自带 · 三种画风",
    title: "同一句话，三种画法",
    tiles: [
      { src: "assets/stock/mixkit/test-library.mp4", kind: "video", fit: "cover", zoom: 1.1, speed: 1 },
      { src: "assets/stock/pexels/desk-night.mp4", kind: "video", fit: "cover", zoom: 1.1, speed: 1 },
      { src: "assets/stock/pexels/phone-scroll-dark.mp4", kind: "video", fit: "cover", zoom: 1.1, speed: 1 },
    ],
    note: "每格都是真素材，演示墙不自己画",
    source: { platform: "仓库演示", capturedAt: "2026-10-21", kind: "real" },
  },
  C,
};
