import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim } from "../../lib/cine/Flash";
import { CharPop } from "../../lib/cine/Type";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompProps } from "../../components/types";
import { cam, idxOf, ink, spread, Stage, tpl } from "./kit";

// ============ 三拍子开场（实景 → 反转金句 → 正文第一句） ============
// 博主那套「0-2s 演处境 → 2-4s 反转金句砸正中 → 正文第一句从底部推进接住」的三连拍。
// 现有 hook / op-t01~20 / trick-01~05 全是单拍，撑不住这个结构，所以单列一个模板。
const s = z.object({
  // 第一拍：处境
  sceneRole: z.string().default("外贸新人").describe("第一拍的人/身份，如“高三班主任”“夜班护士”"),
  sceneJob: z.string().default("盯着空邮箱").describe("他在干什么（动词短语，≤8 字）"),
  sceneLoop: z.string().default("刷新 第 37 次").describe("反复循环的那个动作 + 次数，如“第 37 份卷子”"),
  sceneIcon: z.string().default("send").describe("处境的图标名（src/lib/icons.tsx）"),
  // 第二拍：反转金句
  reversal: z.string().default("不是你不行").describe("反转句/金句（≤12 字）"),
  reversalHl: z.string().default("不行").describe("反转句里烧成强调色的词"),
  reversalSub: z.string().default("是没人告诉你这一句话").describe("反转句下面一行小字（可选）"),
  // 第三拍：正文第一句
  bodyFirst: z.string().default("我带了 300 个外贸新人").describe("正文第一句（≤14 字）"),
  bodyHl: z.string().default("300 个").describe("正文里的数字/重点词，自动高亮"),
  // 锚点
  reversalAt: z.number().default(66).describe("反转句砸下的时刻（锚点，卡在反转那句台词上）"),
  bodyAt: z.number().default(108).describe("正文第一句推进来的时刻（锚点，卡正文开头）"),
  beatSec: z.number().default(2).describe("前两拍各几秒（仅用于内部节奏，默认 2）"),
});
type D = z.infer<typeof s>;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const beat = Math.round(clamp(d.beatSec, 1.2, 3) * 30);
  // ── 第一拍：处境 (frame 0 .. reversalAt) ──
  const sceneOut = easeIn(prog(frame, d.reversalAt - 8, 8)); // 处境在反转句砸下时退场
  const loopIdx = Math.floor(frame / Math.max(8, Math.round(beat / 3.2)));
  const loopPulse = 1 + 0.06 * Math.sin(frame * 0.7);
  const sceneIn = easeOutBack(prog(frame, 0, 10));
  // ── 第二拍：反转金句 ──
  const revIn = easeOutBack(prog(frame, d.reversalAt, 10));
  const dim = easeOut(prog(frame, d.reversalAt, 6)); // 整幅定格压暗
  const revOut = easeIn(prog(frame, d.bodyAt - 10, 8));
  // ── 第三拍：正文第一句 ──
  const bodyIn = easeInOut(prog(frame, d.bodyAt, 14));
  const bodyW = 1500;
  const chars = Array.from(d.bodyFirst);
  const hlIdx = idxOf(d.bodyFirst, d.bodyHl);
  const hlColor = t.accent;

  return (
    <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 14, len: 10 }, { at: d.reversalAt, amp: 20, len: 16 }, { at: d.bodyAt, amp: 10, len: 12 }]} exit="fade">
      <Flash frame={frame} at={0} len={7} peak={0.55} />
      <Flash frame={frame} at={d.reversalAt} len={8} peak={0.4} color={t.bad} />

      {/* ── 第一拍：处境（图标循环动作 + 计数器累加） ── */}
      {frame < d.reversalAt + 6 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - sceneOut }}>
          <Scrim side="left" size={0.55} strength={0.6} />
          <div style={{ position: "absolute", left: 110, top: 300, transform: `scale(${sceneIn})`, transformOrigin: "left center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
              {/* the action icon pulsing on a loop */}
              <div style={{ width: 190, height: 190, borderRadius: 30, border: `5px solid ${t.bad}`, background: alpha(t.bad, 0.14), display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${loopPulse})` }}>
                <Icon name={d.sceneIcon} size={104} color={t.bad} />
              </div>
              <div>
                <div style={ink(84, t.text, t.font.title, 9)}>{d.sceneRole}</div>
                <div style={{ ...ink(58, alpha(t.text, 0.9), t.font.body, 7), marginTop: 10, fontWeight: 800 }}>{d.sceneJob}</div>
              </div>
            </div>
            {/* the counter that keeps climbing — the loop you can't get out of */}
            <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ padding: "8px 26px", borderRadius: 40, background: alpha(t.bad, 0.22), border: `4px solid ${t.bad}` }}>
                <span style={{ ...ink(46, t.text, t.font.mono, 6), fontWeight: 900 }}>
                  {d.sceneLoop.replace(/第\s*\d+\s*/, `第 ${Math.max(1, Math.round((frame / Math.max(6, beat / 3)) * 12))} `)}
                </span>
              </div>
            </div>
          </div>
          {/* the重复 strokes: three ghost copies of the icon fading behind, showing it happening again and again */}
          {[1, 2, 3].map((k) => {
            const lp = ((frame / Math.max(6, beat / 3)) % 1 + k / 3) % 1;
            return <div key={k} style={{ position: "absolute", left: 110 + lp * 240, top: 300 + lp * 90, width: 190, height: 190, borderRadius: 30, border: `3px solid ${alpha(t.bad, 0.3 * (1 - lp))}`, opacity: 1 - lp }} />;
          })}
        </div>
      )}

      {/* 第二拍：整幅定格压暗 + 反转句砸在正中 */}
      {frame >= d.reversalAt - 6 && (
        <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${0.55 * dim})` }} />
      )}
      {frame >= d.reversalAt - 4 && frame < d.bodyAt + 6 && (
        <div style={{ position: "absolute", inset: 0, opacity: (1 - revOut) }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", transform: `scale(${lerp(1.6, 1, revIn)}) rotate(${lerp(-5, -2, revIn)}deg)` }}>
            {/* the reversal line, characters popping with the emphasis burnt in */}
            <CharPop
              frame={frame}
              at={d.reversalAt}
              text={d.reversal}
              cues={spread(d.reversal, d.reversalAt, d.reversalAt + 12)}
              hl={idxOf(d.reversal, d.reversalHl)}
              hlColor={hlColor}
              size={186}
              color={t.text}
              font={t.font.title}
              strokeW={17}
            />
          </div>
          {d.reversalSub && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", opacity: easeOut(prog(frame, d.reversalAt + 14, 12)), transform: `translateY(${(1 - easeOut(prog(frame, d.reversalAt + 14, 12))) * 18}px)` }}>
              <span style={ink(64, hlColor, t.font.body, 8)}>{d.reversalSub}</span>
            </div>
          )}
          {/* the strike-through that cancels the old belief, drawn under the reversal */}
          <RingBurst frame={frame} at={d.reversalAt} x={960} y={420} color={t.bad} len={22} maxR={760} width={5} />
        </div>
      )}

      {/* 第三拍：正文第一句的主题条从底部推进接住 */}
      {frame >= d.bodyAt - 6 && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, height: 250, top: 1080 - 250 * bodyIn, background: `linear-gradient(180deg, transparent, ${alpha(t.primary, 0.28)})` }} />
          <div style={{ position: "absolute", left: (1920 - bodyW) / 2, width: bodyW, top: 1080 - 250 * bodyIn - 120, opacity: bodyIn }}>
            <div style={{ borderTop: `6px solid ${t.primary}`, paddingTop: 22, textAlign: "center", transform: `translateY(${(1 - bodyIn) * 60}px)` }}>
              <CharPop frame={frame} at={d.bodyAt} text={d.bodyFirst} cues={spread(d.bodyFirst, d.bodyAt, d.bodyAt + 12)} hl={hlIdx} hlColor={hlColor} size={92} color={t.text} font={t.font.title} strokeW={9} />
            </div>
          </div>
        </>
      )}
      {chars.length > 0 && frame >= d.bodyAt + 12 && frame < d.bodyAt + 26 && (
        <RingBurst frame={frame} at={d.bodyAt + 12} x={960} y={880} color={t.accent} len={12} maxR={520} width={4} />
      )}

      {/* sound */}
      <Sfx name="impact" at={0} volume={0.5} />
      <Sfx name="riser" at={Math.max(0, d.reversalAt - 46)} volume={0.2} />
      <Sfx name="impact" at={d.reversalAt} volume={0.55} />
      <Sfx name="ding" at={d.reversalAt + 14} volume={0.34} />
      <Sfx name="whoosh" at={Math.max(0, d.bodyAt - 12)} volume={0.28} />
      <Sfx name="sparkle" at={d.bodyAt + 12} volume={0.32} />
    </Stage>
  );
};

export const OneThreeBeat = tpl<D>({
  id: "op-three-beat",
  name: "模板 · 三拍子（实景 → 反转金句 → 正文首句）",
  hook: "三拍子",
  minSec: 5,
  maxSec: 8,
  sec: 6,
  desc: "第一拍演处境：一个身份 + 反复循环的动作图标 + 一直累加的计数（2 秒内连滚三次）；第二拍整幅定格压暗，反转金句从 1.6 倍砸到正中、强调词烧成暖色，下方补一句小字；第三拍正文第一句用主题条从底部推进接住，重点词单独点亮",
  use: "脚本第一句是「先演一个具体处境 → 再一句反转 → 然后进正文」的三连拍写法（行业选题卡基本都是这个结构）；代替单拍开场",
  techniques: ["处境循环动作", "计数器累加", "定格压暗", "反转句砸入", "逐字弹出+强调色", "主题条底部推进", "闪白+冲击音"],
  schema: s,
  example: {
    sceneRole: "外贸新人",
    sceneJob: "盯着空邮箱刷新",
    sceneLoop: "刷新 第 37 次",
    sceneIcon: "send",
    reversal: "不是你没客户",
    reversalHl: "没客户",
    reversalSub: "是你根本不会写第一封开发信",
    bodyFirst: "我带了 300 个外贸新人",
    bodyHl: "300 个",
  },
  C,
  camera: (d, f, dur) =>
    cam(f, dur, {
      punches: [{ at: 0, amt: 0.09 }, { at: d.reversalAt, amt: 0.13 }],
      hits: [{ at: 0, amp: 12, len: 10 }, { at: d.reversalAt, amp: 20, len: 16 }, { at: d.bodyAt, amp: 9, len: 12 }],
      // 第二拍把真人压暗一点、褪色，让反转句站住
      desatAt: d.reversalAt,
      desatUntil: d.bodyAt,
      desat: 0.55,
    }),
});
