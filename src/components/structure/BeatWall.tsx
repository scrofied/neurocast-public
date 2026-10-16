import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, lerp, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { beatSec, eioX, eoX, samples, snapBeat } from "../../lib/spring";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, fmtNum, Heading, textEm } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 出处：opus-5-5-motion-gallery/v03-high-end-product / @zero（twoclipping），X 经 YouMind 收录 2026-09-23 https://youmind.com/video-prompts/high-end-product-video-prompt-11292
// 片库整理：小红书 AI伐木工（jinhanbuilds/opus-5-5-motion-gallery）；逐条机制对照见 docs/OPUS55_ANIMATIONS.md 一·c。
// 移植自 opus-5-5-motion-gallery/v03-high-end-product 的骨架。它「卡」的来源不是画得多，
// 而是三条纪律（全部照搬）：
//   1) 所有事件落在拍点上：B = 60/BPM，词 i 的落地时刻 = snapBeat(...)，**入场提前 0.1s 起步、
//      0.42s 收住**，缓动一律 eoX（指数缓出）——瞬间到位再沉降，天然咬住拍子；
//   2) 每个词有**自己的遮罩窗**（一格 overflow hidden），词从自己格子的下沿升起，
//      不是整行一起淡入。这是它看起来像剪辑、不像 PPT 的关键；
//   3) 切幕发生在**拍点之后**而不是之前，让上一幕的转场在拍后画完，避免硬切闪白。
// iris（圆形转场）也搬了过来，改成「最后一拍用圆从画面中心炸开揭示大字」，
// 展开的 0.52s 里按 v03 的 1/i 谐波权重画 5 个采样半径 —— 子帧运动模糊的廉价等价物。

const wd = z.object({
  text: z.string().max(12).describe("一个词（≤12 字）。它会在拍点上砸进自己的那一格"),
  at: z.number().optional().describe("落在哪一拍之前（台词锚点）；缺省 = 从第一拍起逐拍排"),
});
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  words: z.array(wd).min(3).max(10).describe("3~10 个词，逐拍砸出"),
  bpm: z.number().min(70).max(150).optional().describe("节拍，默认 120。词与转场都吸附到拍点"),
  layout: z.enum(["wall", "row", "stack"]).optional().describe("wall 两列墙 / row 一行横排 / stack 逐行左对齐（默认 wall）"),
  count: z.object({ to: z.number().describe("数字滚到这里"), label: z.string().max(12).describe("这个数是什么，如 条待剪素材") }).optional().describe("可选：墙上挂一个随拍子滚动的计数"),
  punch: z.string().max(16).optional().describe("最后一拍用圆形炸开揭示的大字（≤16 字）"),
  punchAt: z.number().optional().describe("炸开的时刻（锚点）；缺省 = 最后一个词落拍后再一拍"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const s = frame / fps;
  const bpm = data.bpm ?? 120;
  const B = beatSec(bpm);
  const n = data.words.length;
  const layout = data.layout ?? "wall";

  const baseCues = listCues(data.words, Math.round(B * fps * 0.5), Math.round(dur * 0.6));
  const lands = data.words.map((w, i) => snapBeat(cueOr(w.at, baseCues[i]) / fps, bpm));
  // punchAt 走的是分镜锚点（帧），lands 是秒 ⇒ 换算只能在一侧做一次，别两边都除
  const punchT = snapBeat(typeof data.punchAt === "number" ? data.punchAt / fps : (lands[n - 1] ?? B) + B, bpm);
  const lastBeat = Math.max(punchT, lands[n - 1] ?? 0);
  const diag = Math.hypot(width, height);

  // 每词入场：提前 0.1s 起步、0.42s 收住（v03 的固定写法）
  const landK = (i: number) => eoX(clamp((s - (lands[i] - 0.1)) / 0.42));

  const top = full ? 250 : 90;
  const bandH = height - 175 - top;
  const side = full ? 96 : 24;
  const availW = width - side * 2;
  const sizeFor = () => {
    const em = data.words.reduce((a, w) => a + textEm(w.text), 0) + 0.3 * (n - 1);
    if (layout === "row") return Math.min(full ? 128 : 52, availW / em);
    if (layout === "wall") {
      const rows = Math.ceil(n / 2);
      const maxRowEm = Math.max(...data.words.map((w) => textEm(w.text)));
      return Math.min(full ? 132 : 54, (availW / 2 - 24) / maxRowEm, (bandH * 0.8) / (rows * 1.3));
    }
    const rows = n;
    return Math.min(full ? 104 : 44, availW / Math.max(...data.words.map((w) => textEm(w.text))), (bandH * 0.82) / (rows * 1.34));
  };
  const FS = sizeFor();
  const eCount = enterAt(frame, 6, { fallback: "rise", dur: 14 });

  const ct = data.count;
  const span = Math.max(0.4, (lands[n - 1] ?? 1) - lands[0]);
  const cRoll = ct ? Math.round(ct.to * eoX(clamp((s - lands[0]) / (span + 0.4)))) : 0;

  const iris = (() => {
    const ce = eioX(clamp((s - punchT) / 0.52));
    const cx = width / 2;
    const cy = top + bandH / 2;
    const R = lerp(FS * 0.4, diag, ce);
    return { ce, cx, cy, R };
  })();

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}

      {ct && (
        <div style={{ position: "absolute", left: 0, right: 0, top: full ? 236 : 62, textAlign: "center", opacity: eCount.opacity, transform: `translate(${eCount.dx}px, ${eCount.dy}px) scale(${eCount.scale})`, clipPath: eCount.clip }}>
          <span style={{ fontFamily: t.font.mono, fontWeight: 700, fontSize: full ? 68 : 32, color: t.accent }}>{fmtNum(cRoll, 0)}</span>
          <span style={{ marginLeft: 14, fontFamily: t.font.body, fontSize: full ? 28 : 15, color: t.dim }}>{ct.label}</span>
        </div>
      )}

      {/* 词墙：每词一格遮窗，flex 排版 ⇒ 再长的词也不会互相压字 */}
      <div
        style={{
          position: "absolute",
          left: side,
          right: side,
          top,
          height: bandH,
          display: "flex",
          flexDirection: layout === "stack" ? "column" : "row",
          flexWrap: layout === "wall" ? "wrap" : "nowrap",
          alignContent: "center",
          alignItems: layout === "row" ? "center" : "flex-start",
          justifyContent: layout === "stack" ? "flex-start" : "center",
          gap: `${FS * 0.16}px ${FS * 0.3}px`,
        }}
      >
        {data.words.map((w, i) => {
          const k = landK(i);
          return (
            <div key={i} style={{ position: "relative", width: layout === "wall" ? "46%" : undefined, textAlign: layout === "stack" ? "left" : "center", height: FS * 1.28, overflow: "hidden", opacity: k > 0.001 ? 1 : 0 }}>
              <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: FS, lineHeight: 1.05, color: i === n - 1 ? t.accent : t.text, whiteSpace: "nowrap", transform: `translateY(${(1 - k) * FS * 1.1}px)`, letterSpacing: "-0.035em", textShadow: `0 6px 26px ${alpha(t.bg, 0.72)}` }}>
                {w.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* 拍点 HUD：走过拍子的点亮，当前拍放大 */}
      {full && (
        <div style={{ position: "absolute", left: 96, bottom: 210, display: "flex", alignItems: "center", gap: 14 }}>
          {Array.from({ length: Math.min(28, Math.max(4, Math.round((lastBeat + B) / B))) }, (_, i) => (
            <span key={i} style={{ width: i === Math.floor(s / B) ? 13 : 7, height: i === Math.floor(s / B) ? 13 : 7, borderRadius: "50%", background: i * B <= s ? t.accent : alpha(t.dim, 0.5) }} />
          ))}
          <span style={{ fontFamily: t.font.mono, fontSize: 22, color: t.dim, marginLeft: 8 }}>{bpm} BPM</span>
        </div>
      )}

      {/* iris：圆从画面中心炸开揭示 punch；展开期间叠 5 个采样半径（子帧模糊的等价写法） */}
      {data.punch && frame >= punchT * fps && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, clipPath: `circle(${iris.R}px at ${iris.cx}px ${iris.cy}px)`, background: alpha(t.bg, 0.92) }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${side}px` }}>
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.punch, availW, full ? 148 : 50, 20), color: t.text, textAlign: "center", lineHeight: 1.15, letterSpacing: "-0.04em" }}>{data.punch}</span>
            </div>
          </div>
          {iris.ce < 1 &&
            samples(s, 5, 0.08).map((r, i) => {
              const rr = lerp(FS * 0.4, diag, eioX(clamp((r.t - punchT) / 0.52)));
              return <div key={i} style={{ position: "absolute", left: iris.cx - rr, top: iris.cy - rr, width: rr * 2, height: rr * 2, borderRadius: "50%", border: `3px solid ${alpha(t.accent, 0.7)}`, opacity: r.w * 0.55 }} />;
            })}
        </div>
      )}

      {lands.map((l, i) => (
        <Sfx key={i} name={i === n - 1 ? "impact" : "tick"} at={Math.round(l * fps)} volume={i === n - 1 ? 0.45 : 0.24} />
      ))}
      {data.punch && <Sfx name="whoosh" at={Math.round(punchT * fps)} volume={0.4} />}
    </>
  );
};

export const BeatWall: CompDef<D> = {
  id: "beat-wall",
  name: "卡点词墙（逐词砸在拍上）",
  layer: "structure",
  variants: 2,
  minSec: 3,
  maxSec: 10,
  tags: ["卡点", "节奏", "盘点", "快闪", "列举", "口号", "排比"],
  motion: { kind: "词逐个砸在拍点上（每词独立遮窗、指数缓出沉降），拍点 HUD 跟闪，最后一拍圆形炸开揭示大字（叠子帧采样环）", energy: 3 },
  desc: "3~10 个词按 BPM 网格逐拍砸进画面：每个词有自己的一格遮窗，从格子下沿窜起再沉降，所以听得出「卡在拍上」；左下一排点跟着拍走、当前拍放大；最后一个词落定后，一个圆从画面中心炸开（展开时叠 5 个采样半径，是子帧运动模糊的等价写法），整屏翻成 punch 那句大字。可选一个随拍子滚动的计数",
  use: "有节奏地盘点：「三个坑、五个工具、七天做完」、排比式的反问、片头钩子的快闪、结尾口号。words 写**能喊出来的短词**（不是整句），punch 写最后一句结论。一段口播只该用一次，多用来切节奏明显不同的段落",
  schema,
  example: {
    kicker: "我试了半个月",
    title: "踩了三个坑",
    words: [{ text: "第一条" }, { text: "全删了" }, { text: "第二条" }, { text: "没人看" }, { text: "第三条" }, { text: "才有点响" }],
    bpm: 128,
    count: { to: 47, label: "条素材" },
    punch: "问题不在剪辑",
  },
  C,
};
