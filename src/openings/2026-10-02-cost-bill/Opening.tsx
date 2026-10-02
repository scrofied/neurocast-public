import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, Scrim } from "../../lib/cine/Flash";
import { CharPop, Counter, Slam, Stamp } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, idxOf, ink, rnd, Stage, tpl } from "../templates/kit";

// 《用Opus做AI剪辑=浪费90%成本》专属开场（2026-10-02，成本账单钩子）
// 第 0 帧：kicker「用Opus做AI剪辑 · 每次从零付费」逐字弹出 + 大字砸下「白白浪费 90% 的成本」+ 闪白 impact
// ~0.5s：账单卡入场，4 行「重新找参考/拆镜头/搭工程/试错」逐行砸下（每次从零 = 花 4 份钱），共 <3s
// ~3.2s：账单收起，Counter 90 → 10 滚动 + 盖章「可复用资产」，价值承诺直接给出
type D = z.infer<typeof s>;
const s = z.object({
  kick: z.string().default("用 Opus 做 AI 剪辑 · 每次从零付费").describe("首行小字（逐字弹出）"),
  hook: z.string().default("白白浪费 90% 的成本").describe("第 0 帧大字（90% 烧成强调色）"),
  billTitle: z.string().default("每次从零 = 花 4 份钱").describe("账单标题"),
  bill: z.array(z.string()).default(["重新找参考", "重新拆镜头", "重新搭工程", "重新试错"]).describe("账单 4 行，逐行砸下"),
  stamp: z.string().default("沉淀成可复用资产").describe("价值承诺盖章"),
  promise: z.string().default("下次成本 → 原来的").describe("计数器前缀"),
  billAt: z.number().default(14).describe("账单入场（锚点/帧）"),
  rollAt: z.number().default(100).describe("90→10 计数开始（锚点/帧）"),
});

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const billIn = easeOutBack(prog(frame, d.billAt, 9));
  const billOut = easeIn(prog(frame, d.rollAt - 14, 12)); // 账单在计数开始前收走
  const rollP = prog(frame, d.rollAt, 22);
  const stampP = prog(frame, d.rollAt + 10, 7);
  const rows = d.bill.map((txt, i) => ({
    txt,
    at: d.billAt + 7 + i * 9,
    p: easeOutBack(prog(frame, d.billAt + 7 + i * 9, 7)),
  }));
  const rowsShown = rows.filter((r) => frame >= r.at).length;
  return (
    <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.billAt, amp: 8, len: 6 }, { at: d.rollAt, amp: 12, len: 8 }]} exit="up">
      <Scrim side="left" size={0.68} strength={0.76} />
      <Flash frame={frame} at={0} len={8} peak={0.5} />
      <Flash frame={frame} at={d.rollAt} len={7} peak={0.38} color={t.accent} />

      {/* 第 0 帧就有字：kicker 逐字弹出 + 大字砸下；计数开始前整块上移退场，不和承诺区打架 */}
      <div style={{ position: "absolute", left: 96, top: 168, opacity: (1 - 0.45 * easeOut(prog(frame, d.billAt, 10))) * (1 - easeIn(prog(frame, d.rollAt - 26, 12))), transform: `translateY(${-80 * easeIn(prog(frame, d.rollAt - 26, 12))}px)` }}>
        <CharPop frame={frame} at={0} text={d.kick} cues={Array.from(d.kick).map((_, i) => Math.min(2 + i, 12))} hl={idxOf(d.kick, "Opus")} hlColor={t.accent} size={58} color={t.text} font={t.font.title} strokeW={7} />
        <div style={{ marginTop: 22, position: "relative" }}>
          <Slam frame={frame} at={0} text="白白浪费" size={150} color={t.text} font={t.font.title} from={2.0} len={6} blur={4} minOpacity={0.9} strokeW={12} style={{ display: "inline-block" }} />
          <span style={{ ...ink(178, t.accent, t.font.title, 13), display: "inline-block", marginLeft: 18, transform: `scale(${1 + 0.5 * (1 - easeOut(prog(frame, 2, 8)))})`, color: t.accent }}>90%</span>
          <span style={{ ...ink(150, t.accent, t.font.title, 12), display: "inline-block", marginLeft: 14 }}>的成本</span>
        </div>
      </div>

      {/* 账单卡：<3 秒演示「每次从零要花 4 份钱」 */}
      {frame >= d.billAt - 2 && billOut < 1 && (
        <div
          style={{
            position: "absolute",
            left: 116,
            top: 430,
            width: 940,
            padding: "34px 46px",
            background: alpha(t.bg2, 0.92),
            border: `6px solid ${t.bad}`,
            borderRadius: 28,
            boxShadow: `0 24px 70px rgba(0,0,0,.6), 0 0 0 3px rgba(0,0,0,.5)`,
            transform: `translateY(${(1 - billIn) * 160 - billOut * 220}px) scale(${0.86 + 0.14 * billIn}) rotate(${billIn * 0 + (frame % 2 === 0 && frame < d.billAt + 4 ? 1 : -1) * (frame < d.billAt + 4 ? 4 : 0)}deg)`,
            opacity: clamp(billIn * 3) * (1 - billOut),
          }}
        >
          <div style={{ ...ink(64, t.bad, t.font.title), marginBottom: 18 }}>{d.billTitle}</div>
          {rows.map((r, i) => (
            <div key={r.txt} style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 12, opacity: frame >= r.at ? 1 : 0, transform: `translateX(${(1 - r.p) * 90}px) scale(${0.7 + 0.3 * r.p})`, transformOrigin: "left center" }}>
              <div style={{ width: 62, height: 62, borderRadius: 31, background: t.bad, border: "5px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontFamily: t.font.title, fontSize: 38, color: "#fff" }}>{i + 1}</div>
              <div style={{ ...ink(58, t.text, t.font.title), flex: 1 }}>{r.txt}</div>
              <div style={{ ...ink(52, t.gold, t.font.title), opacity: frame >= r.at ? 1 : 0 }}>¥ 一份</div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 14, opacity: rowsShown >= 4 ? 1 : 0, transform: `scale(${rowsShown >= 4 ? easeOutBack(prog(frame, rows[3].at, 7)) : 0.8})`, transformOrigin: "left center" }}>
            <div style={{ ...ink(54, t.text, t.font.title) }}>一条片子</div>
            <div style={{ ...ink(76, t.bad, t.font.title) }}>4 份钱</div>
            <div style={{ ...ink(46, alpha(t.dim, 1), t.font.title) }}>最后只剩一个 MP4</div>
          </div>
        </div>
      )}

      {/* 价值承诺：90 → 10 滚动 + 盖章 */}
      {frame >= d.rollAt && (
        <div style={{ position: "absolute", left: 116, top: 380, opacity: clamp(rollP * 3) }}>
          <div style={{ ...ink(72, t.text, t.font.title), marginBottom: 26, opacity: 1 }}>{d.promise}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
            <div style={{ ...ink(120, alpha(t.dim, 1), t.font.title), textDecoration: "line-through", opacity: prog(frame, d.rollAt + 4, 6) }}>90%</div>
            <Counter frame={frame} at={d.rollAt} from={90} to={10} len={20} suffix="%" suffixScale={0.5} size={230} color={t.accent} font={t.font.title} strokeW={13} style={{ transform: `translateX(${(1 - easeOut(rollP)) * 40}px)` }} />
          </div>
          {frame >= d.rollAt + 14 && (
            <div style={{ marginTop: 34 }}>
              <Stamp frame={frame} at={d.rollAt + 14} text={d.stamp} size={72} color={t.gold} font={t.font.title} rotate={-4} />
            </div>
          )}
          {frame >= d.rollAt + 20 && <div style={{ ...ink(56, t.text, t.font.title), marginTop: 30, opacity: prog(frame, d.rollAt + 20, 6) }}>看完这条视频就学会 · 3 分钟出片</div>}
        </div>
      )}

      <Sfx name="impact" at={0} volume={0.45} />
      {rows.map((r) => (
        <Sfx key={r.txt} name="tick" at={r.at + 2} volume={0.3 + rnd(r.at, seed) * 0.08} />
      ))}
      <Sfx name="stamp" at={d.billAt + 7 + 3 * 9 + 8} volume={0.4} />
      <Sfx name="whoosh" at={d.rollAt - 14} volume={0.28} />
      <Sfx name="riser" at={d.rollAt - 22} volume={0.22} />
      <Sfx name="ding" at={d.rollAt + 20} volume={0.42} />
      <Sfx name="stamp" at={d.rollAt + 14} volume={0.42} />
      <Sfx name="whoosh" at={dur - 10} volume={0.25} />
    </Stage>
  );
};

export const OpeningCostBill: CompDef<D> = {
  ...tpl<D>({
    id: "opening-cost-bill",
    name: "开场 · 成本账单（首帧90%大字 → 4份钱账单 → 90→10 计数器）",
    hook: "数字冲击+痛点账单",
    desc: "第 0 帧 kicker+大字「白白浪费 90% 的成本」砸下闪白；3 秒内账单卡四行「重新找参考/拆镜头/搭工程/试错」逐行砸下算出 4 份钱；随后账单收走，Counter 90→10% 滚动 + 盖章「沉淀成可复用资产」",
    use: "只给《用Opus做AI剪辑=浪费90%成本》用（开场不重样）",
    techniques: ["首帧大字", "闪白+冲击音", "逐字kicker", "账单逐行砸下", "数字滚动Counter", "盖章", "强调色90→10", "价值承诺前置"],
    schema: s,
    C,
    camera: (d, f, dur) =>
      cam(f, dur, {
        punches: [{ at: 0, amt: 0.09 }, { at: d.billAt, amt: 0.04 }, { at: d.rollAt, amt: 0.07 }],
        hits: [{ at: d.billAt, amp: 7, len: 6 }],
        desatAt: d.billAt,
        desatUntil: d.rollAt,
        desat: 0.55,
      }),
  }),
  noGallery: true,
  opening: {
    script: "../../../neurocast-motionface-v2",
    hook: "数字冲击+痛点账单",
    techniques: ["首帧大字", "闪白+冲击音", "账单逐行砸下", "数字滚动", "盖章", "价值承诺前置"],
  },
};
