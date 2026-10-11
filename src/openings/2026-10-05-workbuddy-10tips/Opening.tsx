import React from "react";
import { z } from "zod";
import { clamp, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim } from "../../lib/cine/Flash";
import { CharPop, Counter, Slam, Stamp, Strike, Wipe } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, idxOf, ink, Stage, tpl } from "../templates/kit";

// 《WorkBuddy 的 10 个高频使用技巧》专属开场（2026-10-05，痛点反问 + 反常识翻案 + 数字）
// 第 0 帧：kicker「WorkBuddy 正在干活」逐字 + 大字「想补充两句？」砸下 + 闪白 impact
// ~3s「害怕打断」：红字「怕打断？」砸下；~4.7s「今天」：红线划掉 + 金字「不用停！」翻案
// ~6s「10 个」：Counter 0→10 金色砸出（问句三行同时退场）+「高频使用技巧」擦出
// ~10s「没有用上」：金章「你用到几个？」盖章 + 冲击环 + ding
type D = z.infer<typeof s>;
const s = z.object({
  kick: z.string().default("WorkBuddy 正在干活").describe("首行小字（逐字弹出）"),
  q1: z.string().default("想补充两句？").describe("第 0 帧大字（痛点反问）"),
  q2: z.string().default("怕打断？").describe("红字反问（锚「害怕打断」）"),
  rev: z.string().default("不用停！").describe("翻案金字（锚「今天」，红线划掉 q2）"),
  revNote: z.string().default("消息进队列 · 跑完接着办").describe("翻案行右侧小胶囊"),
  num: z.number().default(10).describe("滚动到的数字"),
  numLabel: z.string().default("高频使用技巧").describe("数字后的说明"),
  ask: z.string().default("你用到几个？").describe("盖章文字"),
  hookAt: z.number().default(96).describe("红字反问入场（锚「害怕打断」）"),
  revAt: z.number().default(141).describe("划掉+翻案（锚「今天」）"),
  numAt: z.number().default(186).describe("10 数字滚动（锚「10 个」）"),
  labAt: z.number().default(216).describe("「高频使用技巧」擦出（锚「高频」）"),
  askAt: z.number().default(292).describe("盖章时刻（锚「没有用上」）"),
  aspect: z.number().optional(),
  kind: z.string().optional(),
});

const C: React.FC<CompProps<D> & { presenter?: boolean }> = ({ data: d, frame, dur, seed, presenter }) => {
  const t = useTheme();
  const revIn = prog(frame, d.revAt, 7);
  const numIn = prog(frame, d.numAt, 8);
  const labIn = prog(frame, d.labAt, 8);
  const askIn = prog(frame, d.askAt, 7);
  const stampP = prog(frame, d.askAt + 5, 6);
  const noteIn = easeOutBack(prog(frame, d.revAt + 6, 8));
  const qOut = d.numAt - 6; // 问句三行在数字砸出前退场

  return (
    <>
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.hookAt, amp: 6, len: 5 }, { at: d.revAt, amp: 9, len: 6 }, { at: d.numAt, amp: 10, len: 7 }, { at: d.askAt, amp: 12, len: 8 }]} exit="up">
        <Flash frame={frame} at={0} len={8} peak={0.32} />
        <Flash frame={frame} at={d.revAt} len={6} peak={0.28} />
        <Flash frame={frame} at={d.askAt} len={7} peak={0.4} color={t.gold} />
        {frame >= d.askAt && frame < d.askAt + 16 && <RingBurst frame={frame} at={d.askAt} x={1430} y={840} color={t.gold} maxR={320} len={14} />}

        {/* 真人全屏时：左侧压暗保证大字可读（人已被 camera 右移，脸在右侧） */}
        {presenter && <Scrim side="left" size={0.62} strength={0.6} />}

        {/* 第 0 帧起：痛点反问三行（正在干活 / 想补充两句？ / 怕打断？→划掉→不用停！），数字砸出前整组退场 */}
        <div style={{ position: "absolute", left: 104, top: 150, opacity: frame >= qOut ? clamp(1 - (frame - qOut) / 8) : 1 }}>
          <CharPop frame={frame} at={0} text={d.kick} cues={Array.from(d.kick).map((_, i) => Math.min(2 + i, 14))} hl={idxOf(d.kick, "WorkBuddy")} hlColor={t.accent} size={46} color={t.text} font={t.font.title} strokeW={6} />
          <div style={{ marginTop: 20 }}>
            <Slam frame={frame} at={0} text={d.q1} size={128} color={t.text} font={t.font.title} from={1.7} len={6} blur={4} minOpacity={0.9} strokeW={11} style={{ display: "inline-block", transformOrigin: "left center" }} />
          </div>
          {frame >= d.hookAt - 1 && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 18 }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <Slam frame={frame} at={d.hookAt} text={d.q2} size={128} color={t.bad} font={t.font.title} from={1.2} len={6} blur={4} minOpacity={0.9} strokeW={11} style={{ display: "inline-block", transformOrigin: "left center" }} />
                {frame >= d.revAt && <Strike frame={frame} at={d.revAt} color={t.bad} len={7} thickness={13} />}
              </div>
              {frame >= d.revAt && (
                <Slam frame={frame} at={d.revAt + 3} text={d.rev} size={128} color={t.gold} font={t.font.title} from={1.5} len={6} blur={4} minOpacity={0.9} strokeW={11} style={{ display: "inline-block", transformOrigin: "left center" }} />
              )}
              {frame >= d.revAt + 6 && (
                <div style={{ display: "inline-block", opacity: clamp(noteIn * 3), transform: `scale(${0.6 + 0.4 * noteIn})`, transformOrigin: "left center" }}>
                  <div style={{ padding: "12px 26px", borderRadius: 999, background: alpha(t.bg, 0.6), border: `4px solid ${alpha(t.primary, 0.85)}`, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
                    <span style={{ ...ink(42, t.text, t.font.title, 7), whiteSpace: "nowrap" }}>{d.revNote}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ~6s：10 个 数字滚动 + 高频使用技巧 */}
        {frame >= d.numAt - 2 && (
          <div style={{ position: "absolute", left: 104, top: 560, display: "flex", alignItems: "baseline", gap: 16, opacity: clamp(numIn * 3), transform: `translateY(${(1 - numIn) * 90}px)` }}>
            <Counter frame={frame} at={d.numAt} from={0} to={d.num} size={230} color={t.gold} font={t.font.title} strokeW={13} style={{ display: "inline-block" }} />
            <span style={{ ...ink(104, t.gold, t.font.title, 9), display: "inline-block", opacity: stampP ? 1 : clamp(numIn * 3) }}>个</span>
            <span style={{ ...ink(72, t.text, t.font.title, 8), display: "inline-block", opacity: clamp(labIn * 3) }}>WorkBuddy</span>
          </div>
        )}
        {frame >= d.labAt && (
          <div style={{ position: "absolute", left: 118, top: 830 }}>
            <Wipe frame={frame} at={d.labAt} text={d.numLabel} size={76} color={t.text} font={t.font.title} len={8} edge={t.primary} strokeW={9} />
          </div>
        )}

        {/* ~10s：金章「你用到几个？」 */}
        {frame >= d.askAt - 2 && (
          <div style={{ position: "absolute", left: 1180, top: 740, opacity: clamp(askIn * 3), transform: `scale(${0.7 + 0.3 * askIn}) rotate(${(1 - askIn) * -8}deg)` }}>
            {frame >= d.askAt + 3 ? <Stamp frame={frame} at={d.askAt + 3} text={d.ask} size={92} color={t.gold} font={t.font.title} rotate={-5} /> : <div style={{ ...ink(92, alpha(t.gold, 0.5), t.font.title) }}>{d.ask}</div>}
          </div>
        )}

        <Sfx name="impact" at={0} volume={0.45} />
        <Sfx name="pop" at={d.hookAt + 2} volume={0.32} />
        <Sfx name="stamp" at={d.revAt} volume={0.4} />
        <Sfx name="impact" at={d.revAt + 3} volume={0.34} />
        <Sfx name="riser" at={d.numAt - 18} volume={0.2} />
        <Sfx name="impact" at={d.numAt} volume={0.4} />
        <Sfx name="ding" at={d.numAt + 16} volume={0.4} />
        <Sfx name="whoosh" at={d.labAt} volume={0.22} />
        <Sfx name="stamp" at={d.askAt + 4} volume={0.42} />
        <Sfx name="ding" at={d.askAt + 9} volume={0.42} />
        <Sfx name="whoosh" at={dur - 10} volume={0.25} />
      </Stage>
    </>
  );
};

export const OpeningWorkbuddy10Tips: CompDef<D> = {
  ...tpl<D>({
    id: "opening-workbuddy-10tips",
    name: "开场 · 插话痛点反问（想补充两句→怕打断→划掉翻案→10 个→盖章）",
    hook: "痛点反问+反常识翻案+数字",
    desc: "第 0 帧 kicker 逐字 +「想补充两句？」砸下；红字「怕打断？」入场；锚「今天」红线划掉 + 金字「不用停！」翻案 + 队列小胶囊；「10 个」Counter 金色砸出 +「高频使用技巧」擦出；金章「你用到几个？」盖章+冲击环",
    use: "只给《WorkBuddy 的 10 个高频使用技巧》用（开场不重样）",
    techniques: ["首帧大字", "闪白+冲击音", "逐字kicker", "划掉翻案", "数字滚动", "盖章+冲击环+ding"],
    schema: s,
    C,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        x: 260, // 真人右移让出左列大字区（开场结束前 12 帧自动回中）
        punches: [{ at: 0, amt: 0.06 }, { at: dd.hookAt, amt: 0.04 }, { at: dd.revAt, amt: 0.05 }, { at: dd.numAt, amt: 0.06 }, { at: dd.askAt, amt: 0.07 }],
      }),
  }),
  noGallery: true,
  opening: {
    script: "../../../neurocast-workbuddy-10tips",
    hook: "痛点反问+反常识翻案+数字",
    techniques: ["首帧大字", "闪白+冲击音", "划掉翻案", "数字滚动", "盖章+冲击环+ding"],
  },
};
