import React from "react";
import { z } from "zod";
import { easeIn, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { drift, punch, shakes } from "../../lib/cine/motion";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { Counter, Slam, Stamp } from "../../lib/cine/Type";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";

// 《20 分钟用 AI 做出你的第一个小软件》专属开场（2026-09-29）
// 钩子 = 反差质问：「用了一整年 AI，还只是拿它写周报？」
// 0f    闪白 + 「用了一整年」砸字 + 速度线 + 推镜头，天数 1→365 滚动   （形态 1+2）
// AI    渐变「AI」徽章砸到天数旁，叮 + 光环                          （形态 3）
// 还只是 红章「还只是？」盖下，画面抖动褪色                         （形态 4）
// 写    整层左移退场，正片 s0 的「写周报」灰卡接上（chip 留空；别的文案可以填 chip 在开场里弹小卡）（形态 5）
// 真人 2 秒全屏后收进右上小窗（presenter.full），和开场退场叠在一起
const schema = z.object({
  lead: z.string().default("用了一整年"),
  days: z.number().default(365),
  unit: z.string().default("天"),
  ai: z.string().default("AI"),
  q: z.string().default("还只是？"),
  chip: z.string().default("写周报"),
  aiAt: z.number().default(31).describe("「AI」：徽章砸入 + 叮"),
  qAt: z.number().default(52).describe("「还只是」：红章 + 抖动褪色"),
  chipAt: z.number().default(73).describe("「写周报」：小卡片弹出"),
});
type D = z.infer<typeof schema>;

const LEFT = 96;
const TOP = 150;
const LEAD = 150;
const NUM = 180;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const font = t.font.title;
  const out = easeIn(prog(frame, dur - 10, 10));
  const dr = drift(frame, 6, 0.05, seed);
  const hit = shakes(frame, [{ at: 0, amp: 12, len: 10 }, { at: d.aiAt, amp: 7, len: 8 }, { at: d.qAt, amp: 18, len: 14 }], seed);
  const dim = easeOut(prog(frame, d.qAt, 10));
  const ai = easeOutBack(prog(frame, d.aiAt, 10));
  const chip = easeOutBack(prog(frame, d.chipAt, 10));
  const cntLen = Math.max(12, d.aiAt - 4);
  const numW = Array.from(String(d.days)).length * NUM * 0.58 + NUM * 0.45;
  const aiX = LEFT + numW + 30;
  const aiY = TOP + LEAD * 1.05 + 18;
  const ticks: number[] = [];
  for (let f = 2; f < cntLen; f += 5) ticks.push(f);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - out, transform: `translate(${dr.x + hit.x - out * 220}px, ${dr.y + hit.y}px) rotate(${hit.r}deg) scale(${1 - out * 0.08})` }}>
      <Scrim side="left" size={0.6} strength={0.72} />
      <Scrim side="right" size={0.42} strength={0.5} opacity={easeOut(prog(frame, d.qAt - 3, 8))} />
      <Flash frame={frame} at={0} len={8} peak={0.45} />
      <Flash frame={frame} at={d.qAt} len={8} peak={0.35} color={t.bad} />
      <SpeedLines frame={frame} at={0} x={520} y={420} color={alpha("#ffffff", 0.9)} len={12} seed={seed} />

      {/* 形态 1-3: 一整年 + 天数滚动 + AI 徽章 */}
      <div style={{ position: "absolute", left: LEFT, top: TOP, transformOrigin: "left top", transform: `scale(${1 - dim * 0.12})`, opacity: 1 - dim * 0.3 }}>
        <Slam frame={frame} at={0} text={d.lead} size={LEAD} color={t.text} font={font} from={1.35} len={6} blur={3} minOpacity={0.85} strokeW={11} style={{ transformOrigin: "left center" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 18, height: NUM * 1.05 }}>
          <Counter frame={frame} at={0} from={1} to={d.days} len={cntLen} suffix={d.unit} size={NUM} color={t.accent} font={font} />
          {frame >= d.aiAt && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 30px",
                borderRadius: 26,
                background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`,
                border: "6px solid #000",
                boxShadow: `0 0 50px ${alpha(t.primary, 0.7)}, 0 12px 30px rgba(0,0,0,.5)`,
                fontFamily: font,
                fontWeight: 900,
                fontSize: 120,
                lineHeight: 1,
                color: t.bg,
                transformOrigin: "left center",
                transform: `scale(${ai}) rotate(${(1 - ai) * -18}deg)`,
              }}
            >
              <Icon name="bot" size={96} color={t.bg} stroke={2.6} />
              {d.ai}
            </div>
          )}
        </div>
      </div>
      <RingBurst frame={frame} at={d.aiAt} x={aiX + 160} y={aiY + NUM * 0.5} color={t.primary} maxR={320} len={16} />

      {/* 形态 4: 红章质问 */}
      <div style={{ position: "absolute", left: 1150, top: 560 }}>
        <Stamp frame={frame} at={d.qAt} text={d.q} size={120} color={t.bad} font={font} rotate={-8} />
      </div>

      {/* 形态 5: 大材小用的小卡片 */}
      {d.chip && frame >= d.chipAt && (
        <div
          style={{
            position: "absolute",
            left: 1230,
            top: 770,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 28px",
            borderRadius: 18,
            background: "rgba(20,20,24,.82)",
            border: `3px solid ${alpha(t.dim, 0.9)}`,
            fontFamily: font,
            fontWeight: 900,
            fontSize: 60,
            color: "#d8d8d8",
            transformOrigin: "left center",
            transform: `scale(${chip}) rotate(${-3 + (1 - chip) * 10}deg)`,
            boxShadow: "0 10px 30px rgba(0,0,0,.6)",
          }}
        >
          <Icon name="doc" size={56} color="#d8d8d8" stroke={2.4} />
          {d.chip}
        </div>
      )}

      <Sfx name="impact" at={0} volume={0.5} />
      {ticks.map((f) => (
        <Sfx key={f} name="tick" at={f} volume={0.16} />
      ))}
      <Sfx name="ding" at={d.aiAt} volume={0.4} />
      <Sfx name="stamp" at={d.qAt} volume={0.55} />
      {d.chip && <Sfx name="pop" at={d.chipAt} volume={0.35} />}
      <Sfx name="whoosh" at={dur - 10} volume={0.25} />
    </div>
  );
};

export const OpeningAiTool4Steps: CompDef<D> = {
  id: "opening-ai-tool-4steps",
  name: "开场 · 20 分钟用 AI 做出你的第一个小软件",
  layer: "opening",
  variants: 1,
  minSec: 2,
  maxSec: 4,
  tags: ["开场", "反差质问"],
  desc: "闪白砸字「用了一整年」+ 天数 1→365 滚动 → 渐变「AI」徽章砸入 → 红章「还只是？」+ 抖动褪色 → 灰色「写周报」小卡弹出，真人 2 秒后收进右上小窗",
  use: "只给《20 分钟用 AI 做出你的第一个小软件》用（开场不重样）",
  noGallery: true,
  schema,
  example: {},
  C,
  // punch-in on frame 0 and on AI, shake + partial desaturation on 还只是
  camera: (d, f, dur) => {
    const fade = 1 - easeInOut(prog(f, dur - 12, 12));
    const z = punch(f, 0, 0.1, 18, 0.3) * punch(f, d.aiAt, 0.05, 12, 0.4);
    const s = shakes(f, [{ at: 0, amp: 10, len: 10 }, { at: d.qAt, amp: 18, len: 14 }], 3);
    const desat = easeOut(prog(f, d.qAt, 6)) * fade;
    return {
      zoom: 1 + (z - 1) * fade,
      x: s.x * fade,
      y: s.y * fade,
      rot: s.r * fade,
      filter: desat > 0.001 ? `grayscale(${0.6 * desat}) contrast(${1 + 0.1 * desat})` : undefined,
      tint: "#2a0010",
      tintOpacity: 0.25 * desat,
    };
  },
  opening: {
    script: "examples/ai-tool-4steps",
    hook: "反差质问",
    techniques: ["首帧大字", "闪白+冲击音", "数字滚动", "推镜头", "徽章砸入", "叮+光环强调", "红章质问", "抖动褪色", "大材小用小卡", "真人2秒全屏后收进小窗", "5 次形态变化"],
  },
};
