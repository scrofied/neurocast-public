// 移植自 yihui-dev/awesome-opus5-5-videos（MIT）里 @gdgtify 的 prompt gdgtify-929495：
// https://x.com/gdgtify
// 原机制：20 秒 kinetic spoken-word 短片《BUILD THE FLOOR》——「每一句台词都改变画面的建筑结构，
// 最后一句必须站在前面那些词真正搭起来的地面上」。
// 已改成配音时间轴驱动的讲解镜头，参数化：金句/结尾镜头，先说的几句收缩成地基·立柱·横梁·顶梁，
// 结论大字被这些词顶起来（区别于 quote：不是逐字点燃，是文字真的变成建筑）。
import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { hitShake } from "../../lib/bits";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Headline, textEm } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const line = z.object({
  text: z.string().describe("这句话；进场时是大字，下一句进场时它收缩成建筑的一块构件"),
  role: z.enum(["beam", "floor", "wall", "cap"]).default("beam").describe("这句话最后变成建筑的哪一部分：floor 地基（最厚）/ wall 立柱（竖条）/ beam 横梁 / cap 顶梁"),
  at: z.number().optional().describe("这句出现的时刻（锚点（台词原文）或帧）；缺省=按台词均匀铺开"),
});

const schema = z.object({
  kicker: z.string().optional().describe("左上小标签，缺省 BUILD THE FLOOR"),
  lines: z.array(line).min(3).max(6).describe("按说话顺序进场的几句话（3~6 句），它们最后堆成结论脚下的建筑剖面"),
  final: z.string().describe("站在这些词上面的最终结论"),
  finalAt: z.number().optional().describe("结论登场时刻（锚点（台词原文）或帧）；缺省=最后一句落地后 26 帧"),
});
type D = z.infer<typeof schema>;

// role 决定它变成哪种构件：厚度/位置都不同，观众才读得出「这句话是那根横梁」
const ROLE_CN: Record<string, string> = { floor: "地基", wall: "立柱", beam: "横梁", cap: "顶梁" };
const THICK = { floor: 82, wall: 168, beam: 54, cap: 44 };

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const n = d.lines.length;
  const v1 = variant === 1;

  const cues = listCues(d.lines, 10, Math.max(40, Math.round(dur * 0.52)));
  const finalAt = cueOr(d.finalAt, Math.round(cues[n - 1] + 30));
  // 每句的「就位时刻」= 下一句进场（末句=结论进场）：先当大字可读，再收缩落到建筑里，
  // 两者之间不留重叠——画面同一时刻只有一句话还挂在天上当大字。
  const seatAt = d.lines.map((_, i) => (i < n - 1 ? cues[i + 1] : finalAt));
  const hold = (i: number) => Math.max(10, (seatAt[i] - cues[i]) * 0.45);
  const moveAt = d.lines.map((_, i) => Math.round(cues[i] + hold(i)));
  const mLen = d.lines.map((_, i) => Math.max(10, seatAt[i] - moveAt[i]));
  const landAt = d.lines.map((_, i) => seatAt[i]);
  const dropAt = Math.round(finalAt + 12); // 结论长到位、把这栋楼压下去的那一下

  const cx = v1 ? width * 0.68 : width / 2;
  // 地平线：整栋楼从这条线往上长。0.845 而不是 0.88 —— 地基那条横条的底边落在 913，
  // 再往下就压进逐字字幕带（y935~1028）了
  const gy = height * 0.845;
  const BW = Math.min(v1 ? 860 : 1160, width * (v1 ? 0.42 : 0.6));
  const stageY = height * 0.15;

  // 自下而上排剖面：地基 → 立柱 → 横梁 → 顶梁；总高超预算就整体缩放
  const order: ("floor" | "wall" | "beam" | "cap")[] = ["floor", "wall", "beam", "cap"];
  const byRole = order.map((r) => d.lines.map((l, i) => ({ l, i })).filter((x) => x.l.role === r));
  const rawH = byRole.reduce((s, g, ri) => (g.length ? s + THICK[order[ri]] : s), 0);
  const maxH = height * 0.42;
  const ks = rawH > maxH ? maxH / rawH : 1;
  const slot: { x: number; y: number; w: number; h: number }[] = new Array(n);
  // 建筑剖面顶面（结论就站在这条线上）：逐层往上扣
  let topY = gy;
  byRole.forEach((g, ri) => {
    const r = order[ri];
    const h = THICK[r] * ks;
    if (!g.length) return;
    if (r === "wall") {
      // 立柱：等距竖条，宽度按 150 收，不是铺满整层
      const cw = Math.min(150 * ks, BW / g.length);
      g.forEach((el, j) => {
        const px = cx - BW / 2 + (BW * (j + 0.5)) / g.length;
        slot[el.i] = { x: px - cw / 2, y: topY - h, w: cw, h };
      });
    } else {
      const w = r === "cap" ? BW * 0.56 : r === "beam" ? BW * 0.94 : BW;
      g.forEach((el, j) => {
        const hh = r === "floor" && g.length > 1 ? h / g.length : h;
        slot[el.i] = { x: cx - w / 2, y: topY - hh * (j + 1), w, h: hh };
      });
    }
    topY -= h;
  });

  const sh = hitShake(frame, [dropAt, landAt[n - 1]], 3, 12, 1);

  return (
    <>
      {/* 图纸底纹 + 地平线：structure 层的「施工图」气质 */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} x1={(i * width) / 12} x2={(i * width) / 12} y1={0} y2={height} stroke={alpha(t.primary, 0.05)} strokeWidth={1} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={0} x2={width} y1={(i * height) / 8} y2={(i * height) / 8} stroke={alpha(t.primary, 0.05)} strokeWidth={1} />
        ))}
        <line x1={cx - BW * 0.86} x2={cx + BW * 0.86} y1={gy + sh.y} y2={gy + sh.y} stroke={alpha(t.primary, 0.85)} strokeWidth={5} />
        {Array.from({ length: 16 }, (_, i) => {
          const x = cx - BW * 0.8 + (i * BW * 1.6) / 15;
          return <line key={`g${i}`} x1={x} x2={x - 22} y1={gy + 8 + sh.y} y2={gy + 34 + sh.y} stroke={alpha(t.primary, 0.4)} strokeWidth={2} />;
        })}
        {/* 剖面左侧的竖向尺寸线：把这栋楼「量」出来 */}
        <line x1={cx - BW * 0.72} x2={cx - BW * 0.72} y1={gy} y2={topY} stroke={alpha(t.dim, 0.5)} strokeWidth={2} strokeDasharray="6 8" />
        <line x1={cx - BW * 0.72 - 8} x2={cx - BW * 0.72 + 8} y1={topY} y2={topY} stroke={alpha(t.dim, 0.7)} strokeWidth={2} />
      </svg>

      {/* 每句话：先当大字，再收缩成构件（同一段文字、同一个 div，所以是「变形」不是「切换」） */}
      {d.lines.map((ln, i) => {
        if (frame < cues[i]) return null;
        const fs0 = fitFont(ln.text, v1 ? width * 0.4 : width * 0.7, 104, 38);
        const w0 = textEm(ln.text) * fs0 + 12;
        const s0 = { x: v1 ? width * 0.07 : width / 2 - w0 / 2, y: stageY, w: w0, h: fs0 * 1.2 };
        const s1 = slot[i];
        const mp = easeInOut(prog(frame, moveAt[i], mLen[i]));
        const x = lerp(s0.x, s1.x, mp);
        const y = lerp(s0.y, s1.y, mp);
        const w = lerp(s0.w, s1.w, mp);
        const h = lerp(s0.h, s1.h, mp);
        // 字号两头插值，再按当前盒宽兜一层：过渡中途也不会被裁字
        const fsB = Math.min(s1.h * 0.74, s1.w / Math.max(1, textEm(ln.text)));
        const fs = Math.max(13, Math.min(lerp(fs0, fsB, mp), w / Math.max(1, textEm(ln.text))));
        const c = [t.primary, t.secondary, t.accent, t.gold][i % 4];
        const eLine = enterAt(frame, cues[i], { fallback: "wipe", dur: 16, seed: i });
        const landed = clamp(mp);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: x + sh.x,
                top: y + sh.y,
                width: w,
                height: h,
                opacity: eLine.opacity,
                transform: `translate(${eLine.dx}px, ${eLine.dy}px) scale(${eLine.scale})`,
                clipPath: eLine.clip,
                background: alpha(c, 0.14 + 0.6 * landed),
                border: `${2 + landed * 2}px solid ${alpha(c, 0.3 + 0.6 * landed)}`,
                borderRadius: 4 + (1 - landed) * 10,
                boxShadow: landed > 0.3 ? `inset 0 0 30px ${alpha(c, 0.25)}, 0 ${6 * landed}px ${20 * landed}px ${alpha(t.bg, 0.6)}` : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, lineHeight: 1.05, color: t.text, whiteSpace: "nowrap" }}>{ln.text}</span>
            </div>
            {/* 构件标注：落地后才显形，讲清「这句话现在是谁的地基」 */}
            {mp > 0.55 && (
              <div style={{ position: "absolute", left: Math.max(20, s1.x - 122), top: s1.y + s1.h / 2 - 14, width: 108, textAlign: "right", fontFamily: t.font.mono, fontSize: 18, letterSpacing: 3, color: alpha(c, 0.9), opacity: clamp((mp - 0.55) / 0.3) }}>
                {ROLE_CN[ln.role]}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* 结论：从建好的地面上长出来，落地时整栋结构下沉抖一下 */}
      {frame >= finalAt &&
        (() => {
          const fsF = fitFont(d.final, v1 ? width * 0.44 : width * 0.78, 132, 46);
          const gp = easeOutBack(prog(frame, finalAt, 20));
          const eFinal = enterAt(frame, finalAt, { fallback: "rise", dur: 18, from: 1.04 });
          const cxT = v1 ? cx : width / 2;
          const wT = Math.min(width - 80, textEm(d.final) * fsF + 60);
          return (
            <div style={{ position: "absolute", left: cxT - wT / 2, top: topY - fsF * 1.2 - 10 + sh.y, width: wT, textAlign: "center", opacity: eFinal.opacity, transform: `translate(${eFinal.dx}px, ${eFinal.dy}px) scale(${eFinal.scale})` }}>
              <div style={{ clipPath: `inset(${(1 - clamp(gp)) * 100}% 0 0 0)`, fontFamily: t.font.title, fontWeight: 900, fontSize: fsF, lineHeight: 1.2, color: t.text, textShadow: `0 0 34px ${alpha(t.primary, 0.6)}, 0 4px 0 ${alpha(t.bg, 0.9)}` }}>
                {d.final}
              </div>
              {/* 结论脚下的承托线：让人看见它是被前面那些词顶起来的 */}
              <div style={{ margin: "6px auto 0", width: wT * 0.9, height: 4, background: alpha(t.primary, 0.7), boxShadow: `0 0 20px ${alpha(t.primary, 0.8)}`, opacity: easeOut(prog(frame, dropAt, 12)) }} />
            </div>
          );
        })()}

      <Headline kicker={d.kicker ?? "BUILD THE FLOOR"} frame={frame} />
      {landAt.map((a, i) => (
        <Sfx key={i} name="tick" at={a} volume={0.22} />
      ))}
      <Sfx name="impact" at={dropAt} volume={0.5} />
      <Sfx name="whoosh" at={moveAt[0]} volume={0.24} />
    </>
  );
};

export const TypoArch: CompDef<D> = {
  id: "typo-arch",
  name: "词句垒成地基",
  layer: "structure",
  variants: 2,
  minSec: 6,
  maxSec: 20,
  tags: ["金句", "结尾", "结论", "建立在", "前提", "正因为", "所以说", "底盘"],
  motion: { kind: "每句大字进场后收缩成构件（地基/立柱/横梁/顶梁）堆叠成剖面，结论从建好的地面上长出、落地时整栋下沉抖动", energy: 2 },
  desc: "前面说的几句话按锚点依次变成建筑构件（宽度取文字实测宽，厚度按 role），堆叠成一个带尺寸线的剖面；结论大字踩着这些词长出来并落地生根",
  use: "结尾/金句镜头，且结论必须「建立在前面说过的那几件事上」：先讲三件事，最后那句判断站在它们上面（比 quote 更适合讲论证结构，变体 1 是建筑偏右的不对称排版）",
  hideCaptions: true,
  schema,
  example: {
    kicker: "先把地面浇好",
    lines: [
      { text: "每天发一条，连发 90 天", role: "floor" },
      { text: "只做一个人群", role: "wall" },
      { text: "把开头三秒当命来改", role: "wall" },
      { text: "有人问就必回", role: "beam" },
      { text: "数据难看也不删稿", role: "cap" },
    ],
    final: "所谓运气，是你把地面浇好了",
  },
  C,
};
