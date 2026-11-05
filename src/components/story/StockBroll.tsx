import React from "react";
import { z } from "zod";
import { Img, OffthreadVideo } from "remotion";
import { clamp, easeInOut, easeOut, lerp, prog } from "../../lib/anim";
import { assetUrl, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 库存素材（Pexels / Pixabay / Mixkit 抓来的现成画面）当「示意画面」用。
//
// 这个组件存在的理由是一条红线：库存镜头只能演「氛围」，不能演「证据」。
// 讲操作步骤、讲数据、讲模型怎么回复，都必须上自己截的真图 —— 那是 screen / evidence-zoom
// 那一类组件的活，make.mjs 会直接拦（E_STOCK）。这里做的是另一半：
// 「城市在变快」「用户在刷手机」这种没人能截图的抽象铺垫，用真素材垫一下画面，
// 比全片都是代码画的圆点更像一个人在讲话。
//
// 代价是必须说清楚它是谁的东西：右下角角标写「示意画面 · 站点 / @作者」，
// 绝不写「真实素材」。出处由 scripts/stock.mjs get 落在 assets/stock-index.json，
// make.mjs 出分镜时自动补进 data.source —— 分镜里忘了写也不会漏署名。
const schema = z.object({
  src: z.string().optional().describe("库存素材文件（scripts/stock.mjs get 抓下来的那个路径）"),
  kind: z.enum(["image", "video"]).optional().describe("视频还是静帧：prepAssets 探过会自动填，别手写"),
  aspect: z.number().optional().describe("素材宽高比（管线自动带）"),
  frames: z.number().optional().describe("素材总帧数（管线实测后自动填入，别手写）"),
  layout: z.enum(["full", "card", "split"]).default("full").describe("full 铺满整屏 / card 居中一块 / split 右侧一块留左半说理"),
  fit: z.enum(["cover", "contain"]).default("cover").describe("cover 裁满（氛围镜头用）/ contain 原样（素材里有字别裁）"),
  move: z.enum(["push", "pan", "still"]).default("push").describe("静帧图也能动：push 缓推 / pan 横移 / still 不动（素材本身在动时用）"),
  kicker: z.string().optional(),
  title: z.string().optional().describe("压在画面上的大字（铺满时居中、split 时靠左），素材上盖了顶光罩才写得动，别太长"),
  caption: z.string().optional().describe("画面底部一行小字，讲这张画面在垫哪句话"),
  dim: z.number().min(0).max(0.8).default(0.3).describe("压暗强度：素材太花、要压住它让字幕读得清时调大（默认 0.3）"),
  source: sourceSchema,
  showSourceUrl: z.boolean().default(true).describe("是否在角标显示来源网址；有站外链接限制时设为 false"),
  flat: z.boolean().default(false).describe("原样展示：不加压暗与渐变遮罩，素材直出"),
  at: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const start = data.at ?? 0;
  const isVideo = data.kind === "video";

  // 时长对齐：库存素材比镜头短就别让它演完黑在那儿 —— 慢放铺满（最多放慢到 0.6 倍，
  // 再慢就成默片了）；比镜头长则只演用得到的那段。素材够长时正常速度播。
  const vf = data.frames ?? 0;
  const need = Math.max(1, dur - start);
  const rate = vf > 0 && vf < need ? Math.max(0.6, vf / need) : 1;
  const trimAfter = vf > 0 && vf > need ? need - 1 : undefined;

  // 取景框：full 铺满 / card 居中一块 / split 右块 + 左字
  const split = data.layout === "split";
  const card = data.layout === "card";
  const inset = split || card;
  const ar = data.aspect ?? 16 / 9;
  // 安全区：底部 y≥935 是逐字字幕带（1080 高时 = height-175），画面下沿和大字都停在它上面
  const bottomCap = height - 175;
  // 左右留白：铺满时按全片大字栏的 96px 起（贴着屏幕边会像没排完），开窗时收一点
  const gutter = inset ? 30 : 96;
  const boxW = split ? Math.round(width * 0.54) : card ? Math.min(width - 420, (bottomCap - 250) * ar) : width;
  const boxH = inset ? Math.min(boxW / ar, bottomCap - 235) : height;
  const bx = split ? width - boxW - 110 : card ? Math.round((width - boxW) / 2) : 0;
  const by = inset ? Math.round((235 + bottomCap - boxH) / 2) : 0;

  // Ken Burns：静帧也得有镜头感；素材自己在动（或写了 still）时不硬加运动
  const kin = !isVideo && data.move !== "still";
  const pushP = kin ? easeInOut(prog(frame, start, dur)) : 0;
  const scale = lerp(1, data.move === "pan" ? 1.05 : 1.075, pushP);
  const panX = data.move === "pan" ? lerp(-boxW * 0.025, boxW * 0.025, pushP) : 0;

  const e = enterAt(frame, start, { fallback: "rise", dur: 22, from: 0.985 });
  const fade = easeOut(prog(frame, start, 16));

  // 署名角标是 nowrap 的绝对定位小块，宽度只能按字数估（等宽字体 17px ≈ 10.6px/字）。
  // 先估出它占多宽，说明文字才知道自己还剩多少地方 —— 否则两者会在底边叠成一行糊字。
  const badgeSrc = data.source ? { ...data.source, ...(data.showSourceUrl ? {} : { url: undefined }) } : {};
  const badgeBits = [badgeSrc.platform, badgeSrc.author, badgeSrc.url ? String(badgeSrc.url).replace(/^https?:\/\//, "").replace(/^www\./, "").slice(0, 28) : ""].filter(Boolean).join(" · ").length;
  const badgeW = Math.min(boxW - gutter * 2, Math.round(168 + badgeBits * 10.6));
  // 开窗（card/split）时框子窄，说明和署名并排会把说明挤成一行一个字 —— 改成上下两行；
  // 铺满时屏幕够宽，才让它们同行左右分列。
  const capW = inset ? boxW - gutter * 2 : Math.max(240, boxW - gutter * 2 - badgeW - 40);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: bx,
          top: by,
          width: boxW,
          height: boxH,
          overflow: "hidden",
          borderRadius: inset ? 18 : 0,
          border: inset ? `1.5px solid ${alpha(t.line, 0.8)}` : "none",
          boxShadow: inset ? `0 26px 80px rgba(0,0,0,.62), 0 0 54px ${alpha(t.primary, 0.14)}` : "none",
          opacity: clamp(e.opacity * fade),
          transform: `scale(${e.scale}) translate(${e.dx}px, ${e.dy}px)`,
          background: "#04060a",
        }}
      >
        {!data.src ? (
          <MissingAsset field="src" hint="这里要一段库存氛围镜头（node scripts/stock.mjs search）" w={boxW} h={boxH} frame={frame} />
        ) : isVideo ? (
          <OffthreadVideo
            src={assetUrl(data.src)}
            muted
            playbackRate={rate}
            {...(trimAfter !== undefined ? { trimAfter } : {})}
            style={{ width: "100%", height: "100%", objectFit: data.fit === "contain" ? "contain" : "cover", display: "block" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, transform: `scale(${scale}) translateX(${panX}px)`, transformOrigin: "50% 46%" }}>
            <Img src={assetUrl(data.src)} style={{ width: "100%", height: "100%", objectFit: data.fit === "contain" ? "contain" : "cover", display: "block" }} />
          </div>
        )}

        {/* 压暗 + 收底：素材太亮太花会把字幕吃掉，这两层是给它「落地」到本片配色里；flat = 原样直出 */}
        {!data.flat && <div style={{ position: "absolute", inset: 0, background: alpha(t.bg, data.dim), pointerEvents: "none" }} />}
        {!data.flat && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(t.bg, 0.18)} 30%, ${alpha(t.bg, 0.72)})`, pointerEvents: "none" }} />}
        {/* 顶部再压一道：大字要画在素材之上，素材一亮就把字吃掉（flat 模式不加） */}
        {!data.flat && (data.kicker || data.title) && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 250, background: `linear-gradient(180deg, ${alpha(t.bg, 0.72)}, ${alpha(t.bg, 0)})`, pointerEvents: "none" }} />
        )}
        {inset && <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 90px ${alpha(t.primary, 0.14)}`, pointerEvents: "none" }} />}

        {/* 底部：左说明、右署名。铺满时画面盖到屏幕底，署名得自己躲开字幕带（bottom 150） */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: inset ? 18 : 150, display: "flex", flexDirection: inset ? "column" : "row", alignItems: inset ? "stretch" : "flex-end", gap: 10, padding: `0 ${gutter}px`, opacity: easeOut(prog(frame, start + 6, 18)) }}>
          {data.caption && (
            <div style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(data.caption, capW, 25, 17), color: alpha(t.text, 0.94), maxWidth: capW, lineHeight: 1.35, textShadow: `0 2px 14px ${alpha(t.bg, 0.85)}` }}>
              {data.caption}
            </div>
          )}
          {/* SourceBadge 自己是绝对定位（贴容器右边），给它一块流里的位置，署名才不会顶到屏幕边 */}
          <div style={{ marginLeft: "auto", position: "relative", width: badgeW, height: 34, flexShrink: 0 }}>
            <SourceBadge source={badgeSrc} frame={frame} />
          </div>
        </div>
      </div>

      {/* 大字排在画面之后：铺满时素材盖满整屏，先画就被盖掉。split 时标题只许用左半那块地方 */}
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} align={split ? "left" : "center"} {...(split ? { capW: Math.max(360, bx - 210) } : {})} />

      <Sfx name="whoosh" at={start} volume={0.2} />
    </>
  );
};

export const StockBroll: CompDef<D> = {
  id: "stock-broll",
  name: "库存示意画面（署名强制）",
  layer: "story",
  variants: 3,
  minSec: 2,
  maxSec: 14,
  tags: ["城市", "办公室", "人手", "手机", "街景", "氛围", "空镜", "示意", "画面垫底"],
  motion: { kind: "素材铺底 + 缓推镜，角标署名", energy: 2 },
  desc:
    "Pexels / Pixabay / Mixkit 抓来的现成画面全屏或开窗铺开：压暗 + 主题色罩落地，静帧也能缓推，素材比镜头短就慢放铺满。右下角永远是「示意画面 · 站点/@作者」，不会伪装成真实截图",
  use:
    "讲不了具体操作、只能用氛围垫一句的地方：「所有人都在刷手机」「办公室变了样」「这个行业在涌入」。凡是讲步骤、讲数据、讲模型回复的句子别用这里 —— 那必须上自己截的真图（screen / evidence-zoom），库存画面顶上去会被 make.mjs 直接拦下",
  schema,
  assetFields: ["src"],
  example: {
    layout: "full",
    fit: "cover",
    move: "push",
    kind: "video",
    src: "assets/stock/mixkit/test-library.mp4",
    kicker: "B-ROLL",
    title: "所有人都在刷手机",
    caption: "这类画面谁都能拍，所以它只配当示意",
    dim: 0.34,
    source: { kind: "stock", platform: "Mixkit", author: "Mixkit", url: "https://mixkit.co/free-stock-video/" },
  },
  C,
};
