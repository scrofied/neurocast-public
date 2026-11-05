import React from "react";
import { z } from "zod";
import { AbsoluteFill, Img, OffthreadVideo, Sequence } from "remotion";
import { clamp, easeInOut, prog } from "../../lib/anim";
import { assetSrc, assetUrl, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { Sfx } from "../../lib/sfx";
import type { CompDef, CompProps } from "../types";

// 全屏素材层：讲到某个 skill 的时候，把这个仓库自带的演示片段/样片**铺满整个画面**播。
// 这一层上没有任何我们自己的字 —— 没有 HUD 章节条（CompDef.bare 让引擎在本镜期间不渲染 HUD/角标）、
// 没有标题、没有 kicker、没有编号、没有出处角标、没有边框圆角和投影。画面里唯一的字是底部字幕。
// 为什么要做到这个程度：叠在真实素材上的小字（角落标签、章节条）在机器审核里就是「无效水印」的形态，
// 素材自己单独检测又是通过的 —— 所以素材镜头一律全屏、一律零文字。
// 和 demo-reel 的分工：demo-reel 是「多格对照墙」（要标题把几格串成一件事）；
//   asset-full 是「一次只放一个，放到最大」，讲的是这一个东西跑出来长什么样。
const clip = z.object({
  src: z.string().describe("素材（相对 public/）：仓库自带的 mp4/gif 转好的演示片段，或样片静帧"),
  kind: z.enum(["image", "video"]).optional().describe("视频还是静帧：prepAssets 探过会自动填，别手写"),
  aspect: z.number().optional().describe("素材宽高比（管线自动带）"),
  frames: z.number().optional().describe("素材总帧数（管线实测后自动填入，别手写）"),
  at: z.number().optional().describe("这一段什么时候开始（台词锚点或相对本镜头的秒数）；不写就在本镜里均分"),
  fit: z.enum(["cover", "contain"]).default("cover").describe("默认 cover 铺满全屏；只有必须整屏看全的界面截图才用 contain（会留边）"),
  zoom: z.number().default(1.06).describe("静帧在这一段里绕正中心缓推的量（1.06 = 推近 6%）；视频不推，原样播"),
  speed: z.number().min(0.3).max(2.5).default(1).describe("视频倍速；素材比这一段的时长短时管线会自动放慢补满，不会黑掉"),
  enter: z.enum(["settle", "wipe-l", "wipe-r", "wipe-up", "iris"]).optional().describe("本段入场动效；缺省 settle = 原有 7 帧回落。其余为 12 帧擦除/圆形展开，入场期间保留上一段在底层"),
  // 素材**自己**烧在边上的署名 / 角标 / 内嵌字幕 —— 用放大 + 偏心锚定把那条边带推出画框。
  // 不打码、不遮黑块（糊方块本身就是「无效水印」形态），画面仍然铺满 1920×1080，只是取景窗挪了。
  cut: z
    .enum(["t", "b", "l", "r", "tb", "lr"])
    .optional()
    .describe("把素材自带的边带推出画框：t=顶部（署名/标题）b=底部（内嵌字幕）l/r=左右缘，tb/lr=两边一起。不写=居中"),
  cutBy: z.number().min(0.02).max(0.3).optional().describe("每条边各推出多少（占画面高/宽的比例），写 cut 时缺省 0.1"),
  // ⚠ cut:"b" 是「偏心放大」，映射是 y → y/(1-cutBy)：切掉底部之后，保留区里**最低的那条内容永远落到画面最底**。
  //   所以它只能用来推「整张图最下面一条、上方再没有别的字」的边带；如果上方还有小字，越切越糟
  //   （实测白板图 orbit@0.836 用 b0.22 推掉了，结果 ground@0.648 从 y700 掉进字幕带 y898..995）。
  //   图里有多条底部文字时：要么切到 cb≥「上方最后一条文字的 y」为止（等于大幅放大糊掉），要么换素材/撤这一格。
});
const schema = z.object({
  clips: z.array(clip).min(1).max(8).describe("1~8 段，按顺序全屏切换；切换点写在 clips[].at（台词锚点）上"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data: d, frame: f, dur }) => {
  const { width, height } = useBox();
  const n = d.clips.length;
  // 每段的起点：写了锚点就用锚点，没写就在本镜里均分；最后一段一直放到镜头结束
  const starts = d.clips.map((c, i) => (typeof c.at === "number" ? Math.round(c.at) : Math.round(((dur - 6) * i) / Math.max(1, n))));
  for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + 8); // 至少给上一格留 8 帧，别叠成一闪
  const win = starts.map((s, i) => {
    const from = clamp(s, 0, Math.max(1, dur - 8));
    const to = i + 1 < starts.length ? clamp(Math.max(starts[i + 1], from + 8), from + 8, dur) : dur;
    return { from, to, slot: Math.max(8, to - from) };
  });
  const enterFrames = d.clips.map((c) => (c.enter && c.enter !== "settle" ? 12 : 0));

  return (
    <AbsoluteFill style={{ background: "#05070c", overflow: "hidden" }}>
      {d.clips.map((c, i) => {
        const { from, slot } = win[i];
        // 下一段擦除/展开时，上一段多在底层留 12 帧；默认 settle 时逐帧行为与原版一致。
        const renderSlot = Math.min(dur - from, slot + (i + 1 < n ? enterFrames[i + 1] : 0));
        if (f < from || f >= from + renderSlot) return null;
        const isVideo = c.kind === "video";
        const src = assetSrc(c.src);
        const vf = c.frames ?? 0;
        // 素材比这一段短：放慢补满（最少 0.55 倍），不放黑；素材比这一段长：Sequence 到点就切走
        const rate = clamp((vf > 0 && vf < slot ? Math.max(0.55, vf / slot) : 1) * (c.speed ?? 1), 0.3, 3);
        // 切进来的那一下：整屏从 1.03 回落到 1（只缩不裁内容，硬切不做溶解，避免看起来像花屏）
        const settle = 1 + 0.03 * (1 - easeInOut(prog(f - from, 0, 7)));
        // 静帧一直在缓推（中心对称，绝不偏心裁边），这样素材镜头不会出现「画面几秒不动」的空窗
        const kin = 1 + Math.max(0, (c.zoom ?? 1.06) - 1) * easeInOut(prog(f - from, 0, slot));
        // cut：素材自己烧在边上的署名/字幕推出画框。锚到「要留下的那条边」，放大后超出的一律裁掉。
        // 单边推 cutBy → scale = 1/(1-cutBy)；双边各推 cutBy → scale = 1/(1-2*cutBy)。
        const two = c.cut === "tb" || c.cut === "lr";
        const cb = Math.min(c.cutBy ?? 0.1, two ? 0.28 : 0.45);
        const cutScale = c.cut ? 1 / (1 - (two ? 2 * cb : cb)) : 1;
        const origin =
          c.cut === "t" ? "50% 100%"
          : c.cut === "b" ? "50% 0%"
          : c.cut === "l" ? "100% 50%"
          : c.cut === "r" ? "0% 50%"
          : c.cut === "tb" || c.cut === "lr" ? "50% 50%"
          : "50% 50%";
        const enter = c.enter ?? "settle";
        const ep = easeInOut(prog(f - from, 0, 12));
        const enterStyle: React.CSSProperties =
          enter === "wipe-l" ? { clipPath: `inset(0 ${100 * (1 - ep)}% 0 0)` }
          : enter === "wipe-r" ? { clipPath: `inset(0 0 0 ${100 * (1 - ep)}%)` }
          : enter === "wipe-up" ? { clipPath: `inset(${100 * (1 - ep)}% 0 0 0)` }
          : enter === "iris" ? { clipPath: `circle(${78 * ep}% at 50% 50%)` }
          : {};
        return (
          <Sequence key={i} from={from} durationInFrames={renderSlot} name={`asset:${c.src.split("/").pop()}`}>
            <div style={{ position: "absolute", inset: 0, ...enterStyle }}>
              {!src ? (
                <div style={{ position: "absolute", inset: 0 }}>
                  <MissingAsset field="clips[].src" hint="这里要放仓库自带的演示片段/样片" w={width} h={height} frame={f} />
                </div>
              ) : isVideo ? (
                <div style={{ position: "absolute", inset: 0, transform: `scale(${settle * cutScale})`, transformOrigin: origin }}>
                  <OffthreadVideo
                    src={src}
                    muted
                    playbackRate={rate}
                    style={{ width: "100%", height: "100%", objectFit: c.fit === "contain" ? "contain" : "cover", display: "block" }}
                  />
                </div>
              ) : (
                <div style={{ position: "absolute", inset: 0, transform: `scale(${settle * kin * cutScale})`, transformOrigin: origin }}>
                  <Img src={assetUrl(c.src)} style={{ width: "100%", height: "100%", objectFit: c.fit === "contain" ? "contain" : "cover", display: "block" }} />
                </div>
              )}
            </div>
            {i > 0 && <Sfx name="pop" at={0} volume={0.15} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const AssetFull: CompDef<D> = {
  id: "asset-full",
  name: "全屏素材",
  layer: "screen",
  variants: 1,
  minSec: 2,
  maxSec: 20,
  tags: ["素材", "全屏", "演示", "样片", "录屏", "视频", "零文字"],
  motion: { kind: "整屏素材 + 硬切换段 + 静帧中心缓推", energy: 2 },
  // 本镜期间引擎不画顶部章节 HUD、不画右下角标：素材镜头除字幕外不留任何别的文字
  bare: true,
  desc:
    "真实素材铺满整个 1920×1080：一次只放一段，按台词锚点在段与段之间硬切。画面上没有任何我们自己加的东西 —— 无标题、无标签、无编号、无边框、无出处角标，也没有顶部章节条；唯一上屏的字是底部字幕。视频原样播（素材比这段短就自动放慢补满，不放黑），静帧绕正中心缓推",
  use:
    "讲到某个工具/仓库/功能时，把它自带的真实演示片段直接全屏放给观众看（操作录屏、跑出来的样片、生成的画面）；也用于「先看片再听我说」的开场样片串。要几格同时对照、需要标题把几格串成一件事时改用 demo-reel；素材只是配角、主体还是概念关系时用信息图组件",
  schema,
  assetFields: ["clips[].src"],
  example: {
    clips: [
      { src: "assets/stock/mixkit/test-library.mp4", kind: "video", at: 0, fit: "cover", zoom: 1.06, speed: 1 },
      { src: "assets/stock/pexels/desk-night.mp4", kind: "video", at: 3, fit: "cover", zoom: 1.06, speed: 1 },
    ],
  },
  noGallery: true,
  C,
};
