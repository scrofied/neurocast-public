import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim } from "../../lib/cine/Flash";
import { CharPop, Slam, Stamp, Wipe } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, idxOf, ink, Stage, tpl } from "../templates/kit";

// 《用WorkBuddy变现：4个Skill+4个步骤》专属开场（2026-10-03，收益先行+数字钩子）
// 第 0 帧：kicker「用 WorkBuddy 变现」逐字弹出 + 大字砸下「能收钱的产品」（能收钱烧金色）+ 闪白 impact
// ~2.0s / ~2.9s：「4 个 Skill」「4 个步骤」两块数字牌依次擦出（pop）
// ~3.9s：胶囊「几十分钟」砸入（收益预告）
// ~5.0s：前面收拢，收据卡盖章「第一笔 · 已到账 ✓」+ 冲击环 + ding —— 2 秒跳出率靠"已经赚到"压住
type D = z.infer<typeof s>;
const s = z.object({
  kick: z.string().default("用 WorkBuddy 变现").describe("首行小字（逐字弹出）"),
  a1: z.string().default("4 个 Skill").describe("第一块数字牌"),
  a2: z.string().default("4 个步骤").describe("第二块数字牌"),
  mins: z.string().default("几十分钟").describe("收益预告胶囊"),
  hook: z.string().default("做出一个能收钱的产品").describe("第 0 帧大字"),
  receipt: z.string().default("第一笔 · 已到账").describe("收据卡盖章文字"),
  skillAt: z.number().default(60).describe("数字牌一入场（锚点/帧）"),
  stepAt: z.number().default(87).describe("数字牌二入场（锚点/帧）"),
  minsAt: z.number().default(117).describe("几十分钟胶囊入场（锚点/帧）"),
  hitAt: z.number().default(150).describe("收据盖章时刻（锚点/帧）"),
});

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const hookOut = easeIn(prog(frame, d.minsAt - 4, 10)); // 大字在胶囊进场前上移退场
  const badgeIn = (at: number) => easeOutBack(prog(frame, at, 8));
  const minsIn = easeOutBack(prog(frame, d.minsAt, 9));
  const recIn = prog(frame, d.hitAt, 7);
  const stampP = prog(frame, d.hitAt + 6, 6);
  const clearP = easeOut(prog(frame, d.minsAt, 10)); // 数字牌区在盖章前淡出
  return (
    <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.skillAt, amp: 6, len: 5 }, { at: d.minsAt, amp: 8, len: 6 }, { at: d.hitAt, amp: 12, len: 8 }]} exit="up">
      <Scrim side="left" size={0.7} strength={0.78} />
      <Flash frame={frame} at={0} len={8} peak={0.5} />
      <Flash frame={frame} at={d.hitAt} len={7} peak={0.4} color={t.gold} />
      {frame >= d.hitAt && frame < d.hitAt + 16 && <RingBurst frame={frame} at={d.hitAt} x={360} y={760} color={t.gold} maxR={300} len={14} />}

      {/* 第 0 帧就有大字：kicker 逐字 + 「做出一个能收钱的产品」砸下 */}
      <div style={{ position: "absolute", left: 96, top: 150, opacity: 1 - hookOut, transform: `translateY(${-90 * hookOut}px)` }}>
        <CharPop frame={frame} at={0} text={d.kick} cues={Array.from(d.kick).map((_, i) => Math.min(2 + i, 12))} hl={idxOf(d.kick, "WorkBuddy")} hlColor={t.accent} size={58} color={t.text} font={t.font.title} strokeW={7} />
        <div style={{ marginTop: 22, display: "flex", alignItems: "baseline", gap: 14 }}>
          <Slam frame={frame} at={0} text="做出一个" size={118} color={t.text} font={t.font.title} from={1.7} len={6} blur={4} minOpacity={0.9} strokeW={10} style={{ display: "inline-block" }} />
          <span style={{ ...ink(168, t.gold, t.font.title, 13), display: "inline-block", transform: `scale(${1 + 0.55 * (1 - easeOut(prog(frame, 3, 8)))})`, color: t.gold }}>能收钱</span>
          <span style={{ ...ink(118, t.text, t.font.title, 10), display: "inline-block", marginLeft: 10 }}>的产品</span>
        </div>
      </div>

      {/* ~2s：两块数字牌依次擦出（4 个 Skill / 4 个步骤） */}
      {[{ txt: d.a1, at: d.skillAt, col: t.primary }, { txt: d.a2, at: d.stepAt, col: t.secondary }].map((b, i) => {
        const out = clearP; // 胶囊进场时完全退场，避免叠字
        if (frame < b.at) return null;
        return (
          <div key={b.txt} style={{ position: "absolute", left: 116 + i * 460, top: 470, opacity: 1 - out, transform: `translateY(${-70 * clearP}px) scale(${0.7 + 0.3 * badgeIn(b.at)})`, transformOrigin: "left center" }}>
            <Wipe frame={frame} at={b.at} text={b.txt} size={104} color={b.col} font={t.font.title} len={7} edge={b.col} strokeW={10} />
          </div>
        );
      })}

      {/* ~3.9s：「装完只要 ▸ 几十分钟」胶囊砸入 */}
      {frame >= d.minsAt - 2 && (
        <div style={{ position: "absolute", left: 120, top: 560 + 100 * (1 - hookOut), display: "flex", alignItems: "center", gap: 26, opacity: clamp(minsIn * 3), transform: `scale(${0.7 + 0.3 * minsIn})`, transformOrigin: "left center" }}>
          <div style={{ ...ink(60, t.text, t.font.title), opacity: minsIn }}>装完只要</div>
          <div style={{ padding: "16px 46px", borderRadius: 999, background: alpha(t.gold, 0.16), border: `6px solid ${t.gold}`, boxShadow: "0 16px 44px rgba(0,0,0,.55)" }}>
            <span style={{ ...ink(112, t.gold, t.font.title, 11) }}>{d.mins}</span>
          </div>
        </div>
      )}

      {/* ~5s：收据卡盖章「第一笔 · 已到账 ✓」 */}
      {frame >= d.hitAt - 2 && (
        <div style={{ position: "absolute", left: 116, top: 700, opacity: clamp(recIn * 3), transform: `translateY(${(1 - recIn) * 120}px) rotate(${(1 - recIn) * -3}deg)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <div style={{ width: 76, height: 76, borderRadius: 38, background: t.gold, border: "5px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.title, fontSize: 46, fontWeight: 900, color: "#141018" }}>¥</div>
            <div>
              {frame >= d.hitAt + 5 ? (
                <Stamp frame={frame} at={d.hitAt + 5} text={d.receipt} size={84} color={t.gold} font={t.font.title} rotate={-4} />
              ) : (
                <div style={{ ...ink(84, alpha(t.text, 0.5), t.font.title) }}>{d.receipt}</div>
              )}
              <div style={{ ...ink(46, t.text, t.font.title), marginTop: 14, opacity: stampP }}>4 个 Skill + 4 步 · 完整流程讲清楚</div>
            </div>
          </div>
        </div>
      )}

      <Sfx name="impact" at={0} volume={0.45} />
      <Sfx name="pop" at={d.skillAt + 2} volume={0.32} />
      <Sfx name="pop" at={d.stepAt + 2} volume={0.32} />
      <Sfx name="whoosh" at={d.minsAt - 4} volume={0.24} />
      <Sfx name="stamp" at={d.minsAt + 4} volume={0.36} />
      <Sfx name="riser" at={d.hitAt - 20} volume={0.2} />
      <Sfx name="impact" at={d.hitAt} volume={0.38} />
      <Sfx name="stamp" at={d.hitAt + 6} volume={0.42} />
      <Sfx name="ding" at={d.hitAt + 10} volume={0.42} />
      <Sfx name="whoosh" at={dur - 10} volume={0.25} />
    </Stage>
  );
};

export const OpeningWorkbuddyPay: CompDef<D> = {
  ...tpl<D>({
    id: "opening-workbuddy-pay",
    name: "开场 · 收益先行（首帧能收钱大字 → 4+4数字牌 → 几十分钟 → 已到账盖章）",
    hook: "收益先行+数字冲击",
    desc: "第 0 帧 kicker「用 WorkBuddy 变现」+ 大字「做出一个能收钱的产品」（能收钱烧金色）砸下闪白；两块数字牌「4 个 Skill / 4 个步骤」依次擦出；金色胶囊「几十分钟」砸入；收据卡盖章「第一笔 · 已到账 ✓」+ 冲击环",
    use: "只给《用WorkBuddy变现：4个Skill+4个步骤》用（开场不重样）",
    techniques: ["首帧大字", "闪白+冲击音", "逐字kicker", "数字牌依次擦出", "金色胶囊砸入", "收据盖章", "冲击环+ding", "收益承诺前置"],
    schema: s,
    C,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        punches: [{ at: 0, amt: 0.06 }, { at: dd.skillAt, amt: 0.04 }, { at: dd.minsAt, amt: 0.05 }, { at: dd.hitAt, amt: 0.07 }],
      }),
  }),
  noGallery: true,
  opening: {
    script: "../../../neurocast-workbuddy-pay",
    hook: "收益先行+数字冲击",
    techniques: ["首帧大字", "闪白+冲击音", "数字牌依次擦出", "金色胶囊砸入", "收据盖章", "冲击环+ding", "收益承诺前置"],
  },
};
