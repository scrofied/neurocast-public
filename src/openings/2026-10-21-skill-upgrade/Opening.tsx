import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, SpeedLines } from "../../lib/cine/Flash";
import { shake } from "../../lib/cine/motion";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, ink, Stage, tpl } from "../templates/kit";

// 《7 个真能干活的 AI 剪辑 skill》专属开场（2026-10-21）
// 用户口径：「这篇开场0-2秒就可以用全屏真人口播加上动效的画面」→ 0~3.0s 真人不切、不铺背景，
// 动效全叠在他身上：底部居中两行大字（AI 剪辑 skill / 又升级了）+ 右侧 7 枚 skill 编号胶囊逐枚窜入。
// 硬指标：第 0 帧就有大字（不从透明淡入）、闪白 + 冲击环 + 抖动、2.95s 真人收进右上小窗时开场元素向两侧飞走。

const s = z.object({
  kicker: z.string().default("这次升级的不是画面"),
  line1: z.string().default("AI 剪辑 skill"),
  line2: z.string().default("又升级了"),
  hl: z.string().default("升级"),
  chips: z
    .array(z.string())
    .default(["shotcraft", "xilo-opus-video", "lemo-opuscar", "mg-styles-15", "huashu-art-motion", "dashi", "wtt"])
    .describe("右侧 7 枚 skill 名字胶囊（按顺序窜入）"),
  chipFrom: z.number().default(26).describe("第一枚胶囊入场帧（0.87s）"),
  chipGap: z.number().default(5).describe("胶囊之间的间隔帧"),
  outStart: z.number().default(78).describe("整层退场起点（2.6s，真人 2.95s 收窗）"),
});
type D = z.infer<typeof s>;

const C: React.FC<CompProps<D> & { presenter?: boolean }> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const in1 = easeOutBack(prog(frame, -7, 10)); // 第 0 帧已近满场（只留最后一帧的落定）
  const in2 = easeOutBack(prog(frame, 10, 10));
  const hl = prog(frame, 24, 6); // 「升级」烧成金色（0.8s）
  const kick = easeOut(prog(frame, 3, 10));
  const ul = easeOutBack(prog(frame, 26, 13));
  const out = easeIn(prog(frame, d.outStart, Math.max(10, dur - d.outStart)));
  const sh1 = shake(frame, 0, 14, 13, seed);
  const sh2 = shake(frame, 10, 12, 10, seed + 5);
  const glow = hl > 0.5;
  const bef = d.line2.split(d.hl)[0] || "";
  const aft = d.line2.split(d.hl)[1] || "";
  return (
    <Stage
      frame={frame}
      dur={dur}
      seed={seed}
      hits={[
        { at: 0, amp: 5, len: 14 },
        { at: 10, amp: 4, len: 10 },
        { at: d.chipFrom + d.chipGap * (d.chips.length - 1), amp: 2.4, len: 8 },
      ]}
      exit="fade"
      outLen={12}
    >
      {/* 底部压暗：大字压在他胸前的镜头上也要读得清 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 560,
          background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${alpha(t.bg, 0.26)} 40%, ${alpha(t.bg, 0.8)} 100%)`,
        }}
      />
      {/* 居中大字：两行 + 金色下划 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 92,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateY(${-out * 170}px)`,
          opacity: 1 - out,
        }}
      >
        <div
          style={{
            ...ink(27, alpha(t.primary, 0.95), t.font.mono, 5),
            letterSpacing: 9,
            marginBottom: 4,
            opacity: clamp(kick * 1.6),
            transform: `translateY(${(1 - kick) * 14}px)`,
          }}
        >
          {d.kicker}
        </div>
        <div
          style={{
            transform: `translate(${(sh1.x * (1 - out)).toFixed(1)}px, ${(sh1.y * (1 - out)).toFixed(1)}px) scale(${0.78 + 0.22 * Math.min(1.05, in1)})`,
            opacity: clamp(in1 * 3),
          }}
        >
          <span style={ink(104, t.text, t.font.title, 9)}>{d.line1}</span>
        </div>
        <div
          style={{
            marginTop: 2,
            transform: `translate(${(sh2.x * (1 - out)).toFixed(1)}px, ${(sh2.y * (1 - out)).toFixed(1)}px) scale(${0.72 + 0.28 * Math.min(1.05, in2)})`,
            opacity: clamp(in2 * 3),
          }}
        >
          <span style={ink(150, t.text, t.font.title, 13)}>{bef}</span>
          <span
            style={{
              ...ink(150, glow ? t.gold : t.text, t.font.title, 13),
              textShadow: glow ? `0 0 46px ${alpha(t.gold, 0.8)}, 0 0 16px ${alpha(t.gold, 0.6)}` : "none",
              display: "inline-block",
              transform: `scale(${1 + 0.06 * Math.sin(prog(frame, 24, 30) * Math.PI)})`,
            }}
          >
            {d.hl}
          </span>
          <span style={ink(150, t.text, t.font.title, 13)}>{aft}</span>
        </div>
        <div
          style={{
            marginTop: 10,
            width: 640 * ul,
            height: 7,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${alpha(t.gold, 0)}, ${t.gold} 22%, ${t.accent} 78%, ${alpha(t.accent, 0)})`,
            boxShadow: `0 0 26px ${alpha(t.gold, 0.7)}`,
            opacity: clamp(ul * 2),
          }}
        />
      </div>
      {/* 右侧 7 枚 skill 名字胶囊 */}
      <div style={{ position: "absolute", right: 74, top: 150, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 9 }}>
        {d.chips.map((name, i) => {
          const at = d.chipFrom + i * d.chipGap;
          const k = easeOutBack(prog(frame, at, 9));
          if (k <= 0) return null;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: 392,
                height: 66,
                padding: "0 20px",
                borderRadius: 12,
                background: alpha(t.bg, 0.62),
                border: `2px solid ${alpha(t.primary, 0.55)}`,
                boxShadow: `0 10px 28px rgba(0,0,0,.5), inset 0 0 22px ${alpha(t.primary, 0.12)}`,
                opacity: clamp(k * 3) * (1 - out),
                transform: `translateX(${(1 - Math.min(1.05, k)) * 260 + out * 460}px) scale(${0.86 + 0.14 * Math.min(1, k)})`,
              }}
            >
              <span style={{ ...ink(20, t.gold, t.font.mono, 3), letterSpacing: 2, width: 30 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ ...ink(27, t.text, t.font.body, 4), letterSpacing: 1 }}>{name}</span>
            </div>
          );
        })}
      </div>
      <Flash frame={frame} at={0} len={5} peak={0.24} />
      <Flash frame={frame} at={10} len={4} peak={0.15} />
      <RingBurst frame={frame} at={0} x={960} y={760} color={t.gold} len={18} maxR={720} width={8} />
      <RingBurst frame={frame} at={0} x={960} y={760} color={t.accent} len={24} maxR={1020} width={3} />
      <SpeedLines frame={frame} at={0} x={960} y={700} color={t.primary} len={14} count={18} inner={420} seed={seed} />
      <Sfx name="impact" at={0} volume={0.5} />
      <Sfx name="ding" at={24} volume={0.34} />
      <Sfx name="whoosh" at={d.chipFrom} volume={0.24} />
      <Sfx name="swish" at={d.outStart} volume={0.28} />
    </Stage>
  );
};

export const OpeningSkillUpgrade: CompDef<D> = {
  ...tpl<D>({
    id: "opening-skill-upgrade",
    name: "开场 · 真人全屏+居中两行大字+右侧 7 枚 skill 胶囊窜入",
    hook: "升级反常识（不是画面更好看，是根本不生成画面）+ 真人在场",
    desc: "0~3s 真人不切、不铺背景：底部居中两行大字「AI 剪辑 skill / 又升级了」第 0 帧砸出，右侧 7 枚 skill 名字胶囊按拍逐枚窜入；闪白+双冲击环+速度线+三处抖动；2.6s 元素向两侧飞走，2.95s 真人收进右上小窗",
    use: "只给《7 个真能干活的 AI 剪辑 skill》用（开场不重样）",
    techniques: ["真人全屏大字", "居中两行", "7 枚名字胶囊窜入", "闪白+冲击环", "收窗同时退场"],
    schema: s,
    C,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        punches: [{ at: 0, amt: 0.07 }, { at: 10, amt: 0.035 }],
        zoomTo: 1.05,
        zoomAt: 0,
        zoomLen: dur2,
      }),
  }),
  noGallery: true,
  opening: {
    script: "../../../skills7",
    hook: "升级反常识 + 真人在场 + 7 个名字先亮",
    techniques: ["居中两行大字", "右侧名字胶囊", "闪白冲击环", "收窗"],
  },
};
