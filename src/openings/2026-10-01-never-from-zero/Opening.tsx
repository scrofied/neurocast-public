import React from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, Scrim } from "../../lib/cine/Flash";
import { Slam, Strike } from "../../lib/cine/Type";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef } from "../../components/types";
import { cam, ink, Stage, tpl } from "../templates/kit";

// 《别再让AI每次从零开始》专属开场（2026-10-01，反常识拍）
// 第 0 帧：常识句「做视频，就得每次从零开始」带引号砸下 + 绿勾 + 闪白 impact（真人全屏）
// 说到「从零开始」：红线划掉常识 + 绿勾翻红叉 + 故障抖动 + 红字「别再！」
// 说到「干活了」：真相大字「让能力复利」从下方砸入烧成强调色 + ding，随后收进真人层
type D = z.infer<typeof s03>;
const s03 = z.object({
  myth: z.string().default("做视频，就得每次从零开始").describe("大家以为的常识"),
  truth: z.string().default("让能力复利").describe("反转后的真相"),
  tag: z.string().default("别再！").describe("否定大字"),
  strikeAt: z.number().default(28).describe("划掉常识（锚点）"),
  truthAt: z.number().default(58).describe("真相砸入（锚点）"),
});

const C: React.FC<import("../../components/types").CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const struck = frame >= d.strikeAt;
  const g = struck && frame < d.strikeAt + 8 ? (frame % 2 ? 1 : -1) * 12 : 0;
  const tr = easeOutBack(prog(frame, d.truthAt, 12));
  return (
    <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.strikeAt, amp: 16, len: 10 }, { at: d.truthAt, amp: 10, len: 8 }]} exit="up">
      <Scrim side="left" size={0.64} strength={0.72} />
      <Flash frame={frame} at={0} len={8} peak={0.45} />
      <Flash frame={frame} at={d.strikeAt} len={6} peak={0.35} color={t.bad} />
      <div style={{ position: "absolute", left: 96, top: 170, transform: `translateX(${g}px)`, opacity: 1 - 0.45 * easeOut(prog(frame, d.truthAt, 10)) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ width: 130, height: 130, borderRadius: 65, background: struck ? t.bad : "#2fd07a", border: "8px solid #000", display: "flex", alignItems: "center", justifyContent: "center", transform: `rotateY(${struck ? 180 * (1 - easeOut(prog(frame, d.strikeAt, 8))) : 0}deg)` }}>
            <Icon name={struck ? "x" : "check"} size={86} color="#fff" stroke={3.6} />
          </div>
          <div style={{ position: "relative" }}>
            <Slam frame={frame} at={0} text={`“${d.myth}”`} size={128} color={struck ? alpha(t.text, 0.7) : t.text} font={t.font.title} from={1.3} len={6} blur={3} minOpacity={0.85} strokeW={10} />
            <Strike frame={frame} at={d.strikeAt} color={t.bad} thickness={20} len={6} />
          </div>
        </div>
        {struck && <div style={{ ...ink(170, t.bad, t.font.title), marginTop: 10, marginLeft: 160, transform: `scale(${easeOutBack(prog(frame, d.strikeAt, 8))})`, transformOrigin: "left center" }}>{d.tag}</div>}
      </div>
      {frame >= d.truthAt && (
        <div style={{ position: "absolute", left: 96, top: 640, ...ink(124, t.accent, t.font.title, 11), transform: `translateY(${(1 - tr) * 120}px) scale(${0.7 + 0.3 * tr})`, transformOrigin: "left bottom", opacity: clamp(tr * 2) }}>{d.truth}</div>
      )}
      <Sfx name="impact" at={0} volume={0.45} />
      <Sfx name="glitch" at={d.strikeAt} volume={0.4} />
      <Sfx name="stamp" at={d.strikeAt + 2} volume={0.45} />
      <Sfx name="ding" at={d.truthAt} volume={0.4} />
      <Sfx name="whoosh" at={dur - 10} volume={0.25} />
    </Stage>
  );
};

export const OpeningNeverFromZero: CompDef<D> = {
  ...tpl<D>({
    id: "opening-never-from-zero",
    name: "开场 · 别再让AI每次从零开始（常识被划掉 → 复利砸入）",
    hook: "反常识",
    desc: "首帧砸出带引号的常识「做视频，就得每次从零开始」+绿勾，说到「从零开始」红线划掉、勾翻成叉、红字「别再！」，说到「干活了」真相「让能力复利」烧成强调色从下方砸入",
    use: "只给《别再让AI每次从零开始》用（开场不重样）",
    techniques: ["首帧大字", "闪白+冲击音", "常识→划掉", "勾变叉", "故障抖动", "否定红字", "真相砸入", "强调色"],
    schema: s03,
    C,
    camera: (d, f, dur) => cam(f, dur, { punches: [{ at: 0, amt: 0.08 }, { at: d.truthAt, amt: 0.06 }], hits: [{ at: d.strikeAt, amp: 16, len: 10 }], desatAt: d.strikeAt, desatUntil: d.truthAt, desat: 0.6 }),
  }),
  noGallery: true,
  opening: {
    script: "../../../neurocast-motionface",
    hook: "反常识",
    techniques: ["首帧大字", "闪白+冲击音", "常识→划掉", "勾变叉", "故障抖动", "否定红字", "真相砸入", "强调色"],
  },
};
