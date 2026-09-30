import React from "react";
import { z } from "zod";
import { Img, staticFile } from "remotion";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { drift, punch, shakes } from "../../lib/cine/motion";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { CharPop, Slam } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";

// 《用 AI 挖出你身上的隐藏资产》专属开场（2026-09-30）
// 钩子 = 权威共识 + 榜单当面盖脸：先给 1 秒真人脸，再把真实榜单截图整块砸到脸上，展示完撤走、人脸回来
//  0–30f   真人脸全屏 1 秒 +「全球最权威」砸字 + 闪白 + 推镜头      （形态 1）
// 16–44f   逐字弹出「大模型竞技场」，「竞技」叮 + 光环              （形态 2）
// 40–52f   大字上移退场，给榜单让位                                （形态 3）
// 52–68f   榜单截图从中心放大砸入，居中盖住人脸 + 冲击音             （形态 4）
// 68–92f   截图保持：扫描线下扫 + 高亮带滑过 + LIVE 呼吸             （形态 5）
// 92–105f  截图快速缩回淡出，人脸重新出现（shrinkAt 之后再收进舞台）
const schema = z.object({
  lead: z.string().default("全球最权威"),
  line: z.string().default("大模型竞技场"),
  hl: z.string().default("竞技"),
  boards: z
    .array(z.object({ src: z.string().describe("截图路径（相对 public/）"), note: z.string().optional().describe("这张图在讲什么，可留空") }))
    .max(2)
    .default([])
    .describe("真实榜单截图 1~2 张；给 2 张时在 swapAt 处做「重新排序」式竖滑切换；不给就用合成榜单兜底"),
  boardAspect: z.number().default(2.13).describe("截图宽高比，框按它出尺寸"),
  swapAt: z.number().optional().describe("两张截图切换（重新排序）的时刻（秒，相对开场起点）"),
  boardTitle: z.string().default("大模型竞技场 · 实时榜单"),
  fallbackNames: z.array(z.string()).min(3).max(4).default(["Astra", "Opus 5.5", "开源模型", "Gemini"]),
  lineAt: z.number().default(16).describe("「大模型竞技场」逐字弹出开始"),
  lineEndAt: z.number().default(44).describe("这一行弹完"),
  slamAt: z.number().default(52).describe("榜单截图砸入的时刻（秒，相对开场起点）；不给 boards 时它只决定大字何时让位"),
  typeOutAt: z.number().optional().describe("大字上移让位的时刻；缺省 = slamAt - 12 帧"),
  outAt: z.number().default(92).describe("榜单截图撤走的时刻（秒，相对开场起点）"),
});
type D = z.infer<typeof schema>;

const ORDERS = [
  [0, 1, 2, 3],
  [1, 0, 2, 3],
  [2, 1, 0, 3],
];
const MEDAL = ["#ffcf5c", "#d8dde6", "#d9935f", "#8b93a3"];

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const font = t.font.title;
  const out = easeIn(prog(frame, dur - 10, 10));
  const dr = drift(frame, 5, 0.05, seed);
  const hit = shakes(frame, [{ at: 0, amp: 12, len: 10 }, { at: d.slamAt, amp: 14, len: 12 }, { at: d.outAt, amp: 7, len: 9 }], seed);

  const lineChars = Array.from(d.line);
  const lineCues = lineChars.map((_, i) => d.lineAt + ((d.lineEndAt - d.lineAt) * i) / Math.max(1, lineChars.length - 1));
  const hlStart = Array.from(d.line.slice(0, Math.max(0, d.line.indexOf(d.hl)))).length;
  const hlIdx = Array.from(d.hl).map((_, k) => hlStart + k);

  // ① the face keeps the first second to itself, then the big type steps aside for the board
  const typeOut = easeIn(prog(frame, d.typeOutAt ?? d.slamAt - 12, 11));
  const typeStyle: React.CSSProperties = {
    transform: `translateY(${-typeOut * 130}px) scale(${1 - typeOut * 0.16})`,
    opacity: 1 - typeOut,
  };

  // ② the board card: slams in centred over the face, then snaps away
  const slamIn = easeOutBack(prog(frame, d.slamAt, 16));
  const boardOut = easeOut(prog(frame, d.outAt, 13));
  const bw = Math.min(1700, 870 * d.boardAspect);
  const bh = bw / d.boardAspect;
  const boardX = 960 - bw / 2;
  const boardY = 484 - bh / 2;
  // 两张截图：在 swapAt 处竖直滑到下一张 —— 读起来就是「同一张榜被重新排序」
  const nB = d.boards.length;
  const swapAt = d.swapAt ?? d.slamAt + (d.outAt - d.slamAt) * 0.42;
  const slide = easeInOut(prog(frame, swapAt, 12)) * (nB > 1 ? 1 : 0);
  const glitch = frame >= swapAt && frame < swapAt + 16 ? 1 - (frame - swapAt) / 16 : 0;
  const boardVisible = nB > 0 && frame >= d.slamAt - 2 && boardOut < 1;
  const sweep = prog(frame, d.slamAt + 8, Math.max(12, d.outAt - d.slamAt - 8));
  const live = 0.55 + 0.45 * Math.sin(frame / 5);

  // fallback (no real screenshot): synthetic board whose #1 keeps getting replaced
  const swap1 = Math.round(d.slamAt + (d.outAt - d.slamAt) * 0.36);
  const swap2 = Math.round(d.slamAt + (d.outAt - d.slamAt) * 0.68);
  const swapCount = frame >= swap2 ? 2 : frame >= swap1 ? 1 : 0;
  const from = ORDERS[swapCount];
  const to = ORDERS[Math.min(2, swapCount + 1)];
  const bt = swapCount === 0 ? 0 : easeOut(prog(frame, swapCount === 1 ? swap1 : swap2, 12));
  const rankOf = (i: number) => {
    const a = from.indexOf(i);
    const b = to.indexOf(i);
    return a + (b - a) * bt;
  };
  const rowH = 118;
  const rowGap = 16;
  const rowTop = 236;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - out, transform: `translate(${dr.x + hit.x}px, ${dr.y + hit.y}px) rotate(${hit.r}deg) scale(${1 - out * 0.06})` }}>
      <Scrim side="left" size={0.5} strength={0.55} opacity={1 - typeOut} />
      <Scrim side="right" size={0.3} strength={0.4} opacity={1 - typeOut} />
      <Flash frame={frame} at={0} len={10} peak={0.72} />
      {nB > 0 && <Flash frame={frame} at={d.slamAt} len={8} peak={0.5} />}
      {nB > 1 && <Flash frame={frame} at={swapAt} len={7} peak={0.44} />}
      <SpeedLines frame={frame} at={0} x={460} y={360} color={alpha("#ffffff", 0.8)} len={12} seed={seed} />

      {/* ── beat 1+2：真人脸 1 秒 + 大字 ── */}
      <div style={{ position: "absolute", left: 80, top: 118, ...typeStyle }}>
        <Slam frame={frame} at={0} text={d.lead} size={145} color={t.text} font={font} from={1.3} len={6} blur={3} minOpacity={0.88} strokeW={11} style={{ transformOrigin: "left center" }} />
      </div>
      <div style={{ position: "absolute", left: 84, top: 318, ...typeStyle }}>
        <CharPop frame={frame} at={d.lineAt} text={d.line} cues={lineCues} size={120} color={t.text} hl={hlIdx} hlColor={t.accent} font={font} strokeW={10} />
      </div>
      <RingBurst frame={frame} at={d.lineAt + 4} x={84 + 120 * (hlStart + 0.5)} y={378} color={t.accent} maxR={300} len={16} />

      {/* ── beat 3+4+5：真实榜单截图居中盖脸 ── */}
      {boardVisible && (
        <div
          style={{
            position: "absolute",
            left: boardX + (1 - slamIn) * bw * 0.18,
            top: boardY + (1 - slamIn) * bh * 0.1,
            width: bw,
            height: bh,
            borderRadius: 26,
            overflow: "hidden",
            background: alpha(t.bg, 0.96),
            border: `3px solid ${alpha(t.primary, 0.85)}`,
            boxShadow: `0 0 ${70 * (1 - boardOut)}px ${alpha(t.primary, 0.5)}, 0 40px 120px rgba(0,0,0,.7)`,
            transform: `perspective(1400px) scale(${0.55 + 0.45 * slamIn}) rotateX(${(1 - slamIn) * 10}deg) scale(${1 - boardOut * 0.14})`,
            opacity: Math.min(1, slamIn * 1.8) * (1 - boardOut),
          }}
        >
          {nB > 0 ? (
            <div style={{ position: "absolute", left: 0, top: 0, width: bw, height: bh * nB, transform: `translateY(${-slide * bh}px)` }}>
              {d.boards.map((b, i) => (
                <Img key={i} src={staticFile(b.src)} style={{ width: "100%", height: bh, objectFit: "cover", display: "block" }} />
              ))}
            </div>
          ) : (
            <div style={{ position: "absolute", inset: 0 }}>
              <div style={{ position: "absolute", left: 34, top: 30, fontFamily: t.font.mono, fontSize: 22, letterSpacing: 4, color: alpha(t.primary, 0.85) }}>{d.boardTitle}</div>
              {d.fallbackNames.map((nm, i) => {
                const r = rankOf(i);
                if (r > d.fallbackNames.length - 1) return null;
                const y = rowTop + r * (rowH + rowGap);
                const top = Math.round(r) === 0;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: 34,
                      top: y,
                      width: bw - 68,
                      height: rowH,
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      padding: "0 24px",
                      borderRadius: 16,
                      background: top ? alpha(t.gold, 0.16) : alpha("#ffffff", 0.05),
                      border: `2px solid ${top ? alpha(t.gold, 0.8) : alpha("#ffffff", 0.14)}`,
                    }}
                  >
                    <span style={{ width: 44, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: 44, color: MEDAL[Math.round(r)] ?? "#8b93a3" }}>{Math.round(r) + 1}</span>
                    <span style={{ flex: 1, fontFamily: t.font.title, fontWeight: 900, fontSize: 46, color: top ? t.text : alpha(t.text, 0.72), whiteSpace: "nowrap", overflow: "hidden" }}>{nm}</span>
                    {top && <span style={{ padding: "5px 16px", borderRadius: 999, background: alpha(t.gold, 0.92), color: t.bg, fontFamily: t.font.mono, fontSize: 20, fontWeight: 700 }}>#1</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* 「这个榜一直在变」的动势：扫描线下扫 + 高亮带滑过 */}
          <div style={{ position: "absolute", left: 0, right: 0, top: `${sweep * 108 - 6}%`, height: 110, background: `linear-gradient(180deg, transparent, ${alpha("#ffffff", 0.16)}, transparent)`, pointerEvents: "none" }} />
          {[0, 1].map((k) => {
            const p = (sweep * 1.35 + k * 0.5) % 1;
            return <div key={k} style={{ position: "absolute", left: 0, right: 0, top: `${p * 100}%`, height: 4, background: alpha(t.accent, 0.5), boxShadow: `0 0 22px ${t.accent}`, opacity: 0.5 + 0.5 * Math.sin(frame / 4 + k), pointerEvents: "none" }} />;
          })}
          {/* 重新排序的一瞬：故障条纹横切 */}
          {glitch > 0 &&
            [0, 1, 2].map((k) => (
              <div key={`g${k}`} style={{ position: "absolute", left: 0, right: 0, top: `${(0.2 + k * 0.3 + Math.sin(frame * 0.9 + k) * 0.04) * 100}%`, height: 6 + k * 4, background: alpha(k % 2 ? t.primary : "#ffffff", 0.5 * glitch), transform: `translateX(${(k % 2 ? 1 : -1) * 28 * glitch}px)`, pointerEvents: "none" }} />
            ))}
          <div style={{ position: "absolute", right: 24, top: 20, display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", borderRadius: 999, background: alpha(t.bg, 0.72), border: `1.5px solid ${alpha(t.bad, 0.7)}`, fontFamily: t.font.mono, fontSize: 18, letterSpacing: 2, color: t.text, opacity: live }}>
            <span style={{ width: 11, height: 11, borderRadius: 6, background: t.bad }} />
            LIVE
          </div>
        </div>
      )}

      <Sfx name="impact" at={0} volume={0.5} />
      <Sfx name="ding" at={d.lineAt + 4} volume={0.38} />
      {nB > 0 && <Sfx name="impact" at={d.slamAt} volume={0.55} />}
      {nB > 1 && <Sfx name="glitch" at={swapAt} volume={0.4} />}
      {nB > 1 && <Sfx name="tick" at={Math.round((d.slamAt + d.outAt) / 2)} volume={0.3} />}
      {nB > 0 && <Sfx name="swipe" at={d.outAt} volume={0.34} />}
      <Sfx name="whoosh" at={dur - 10} volume={0.24} />
    </div>
  );
};

export const OpeningModelArena: CompDef<D> = {
  id: "opening-model-arena",
  name: "开场 · 用 AI 挖出你身上的隐藏资产",
  layer: "opening",
  variants: 1,
  minSec: 2,
  maxSec: 4,
  tags: ["开场", "权威共识"],
  desc: "真人脸卡 1 秒 + 砸字「全球最权威」→ 逐字弹出「大模型竞技场」→ 大字上移让位 → 真实榜单截图从中心放大砸入、居中盖住人脸（扫描线 + 高亮带 + LIVE）→ 同一张榜竖直滑切到另一种排序（红框里的模型名次变了）→ 截图缩回淡出、人脸重新出现",
  use: "只给《用 AI 挖出你身上的隐藏资产》用（开场不重样）",
  noGallery: true,
  schema,
  example: {},
  C,
  // 真人层：开场推一下、截图砸入时重推一次、撤走时回拉
  camera: (d, f, dur) => {
    const fade = 1 - easeInOut(prog(f, dur - 10, 10));
    const z = punch(f, 0, 0.12, 16, 0.35) * punch(f, d.slamAt, 0.1, 12, 0.45) * (1 + 0.015 * prog(f, 0, dur));
    const s = shakes(f, [{ at: 0, amp: 10, len: 10 }, { at: d.slamAt, amp: 12, len: 12 }, { at: d.outAt, amp: 6, len: 9 }], 5);
    return {
      zoom: 1 + (z - 1) * fade,
      x: s.x * fade,
      y: s.y * fade,
      rot: s.r * fade,
      tint: "#1d0a38",
      tintOpacity: 0.22 * fade,
    };
  },
  opening: {
    script: "examples/0930-ability-audit",
    hook: "权威共识",
    techniques: ["真人脸卡 1 秒", "首帧大字", "闪白+冲击音", "推镜头", "逐字弹出", "叮+光环强调", "大字让位", "真实榜单截图居中盖脸", "同榜重新排序竖滑切换", "故障条纹", "扫描线+高亮带", "人脸回归", "收进舞台"],
  },
};
