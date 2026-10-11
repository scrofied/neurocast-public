import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, ink, Stage, tpl } from "../templates/kit";
import { ProAssetBase } from "../pro/kit/sfx";
import { P02ShatterMorph } from "../pro/p02-shatter-morph";

// 《做重大决策，让AI竭尽全力唱反调》专属开场（2026-10-09，用户两条意见的落地）
// ① 大字居中（p02 加 center 参数），不再沉在画面下方；
// ② 碎屏层在「反调$」淡出揭幕 → 真人全屏 ≥2 秒，动效放人物两侧：
//    左侧场景胶囊「辞职 / 转行 / 合伙做生意」逐个卡词弹出，右侧金章「先收藏这条」盖章；
//    到 presenter.full（≈7.0s）收进右上小窗，正片聊天窗接管。
// 0→stageAt 这段直接复用 PRO-02 碎屏模板（P02ShatterMorph.C，center:true）。

const s = z.object({
  line1: z.string().default("重大决策 问AI行不行？").describe("第一句（居中砸出，锚「一定要」前）"),
  line2: z.string().default("让AI竭尽全力唱反调").describe("第二句（碎屏重组后砸出）"),
  hl: z.string().default("唱反调").describe("第二句里发光的词"),
  look: z.string().default("noir").describe("PRO 调色：noir 黑金"),
  tilt: z.number().default(-8).describe("分屏倾角"),
  crackAt: z.number().default(78).describe("裂开帧（锚「一定要」）"),
  punchAt: z.number().default(93).describe("第二句砸出帧（锚「让AI」）"),
  stageAt: z.number().default(123).describe("碎屏层淡出、真人全屏揭幕（锚「反调$」）"),
  chips: z
    .array(z.object({ text: z.string(), at: z.number() }))
    .default([])
    .describe("真人全屏期间左侧胶囊，逐个卡词（辞职/转行/合伙做生意）"),
  stamp: z
    .object({ text: z.string(), at: z.number() })
    .optional()
    .describe("右侧金色盖章（先收藏这条）"),
  kind: z.string().optional(),
  aspect: z.number().optional(),
});
type D = z.infer<typeof s>;

const C: React.FC<CompProps<D> & { presenter?: boolean }> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const stage = d.stageAt;
  // ── 阶段 1：PRO-02 碎屏（center 大字），stageAt 起 12 帧淡出揭幕真人 ──
  const po = 1 - clamp(easeOut(prog(frame, stage, 12)));
  const p02data = P02ShatterMorph.schema.parse({
    look: d.look as any,
    line1: d.line1,
    line2: d.line2,
    hl: d.hl,
    tilt: d.tilt,
    center: true,
    crackAt: d.crackAt / fps,
    punchAt: d.punchAt / fps,
  });
  // ── 阶段 2：真人全屏 + 两侧动效 ──
  const chipIn = (at: number) => easeOutBack(prog(frame, at, 8));
  const stampIn = d.stamp ? easeOutBack(prog(frame, d.stamp.at, 9)) : 0;
  return (
    <>
      {frame < stage + 12 && (
        <div style={{ position: "absolute", inset: 0, opacity: po }}>
          <ProAssetBase base="pro/">
            <P02ShatterMorph.C data={p02data} duration={(stage + 12) / fps} />
          </ProAssetBase>
        </div>
      )}
      {frame >= stage - 4 && (
        <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: stage, amp: 5, len: 4 }, ...d.chips.map((c) => ({ at: c.at, amp: 3, len: 3 })), ...(d.stamp ? [{ at: d.stamp.at, amp: 8, len: 6 }] : [])]} exit="fade" outLen={8}>
          {/* 左侧：场景胶囊，逐个卡词 */}
          <div style={{ position: "absolute", left: 120, top: 330, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 30 }}>
            {d.chips.map((c, i) => {
              const k = chipIn(c.at);
              if (k <= 0) return null;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, opacity: clamp(k * 3), transform: `translateX(${(1 - Math.min(1.08, k)) * -70}px) scale(${0.6 + 0.4 * Math.min(1.08, k)})`, transformOrigin: "left center" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 9, background: t.gold, boxShadow: `0 0 18px ${alpha(t.gold, 0.8)}`, flexShrink: 0 }} />
                  <span style={{ ...ink(72, t.text, t.font.title, 9), padding: "10px 34px", borderRadius: 999, background: alpha(t.bg, 0.78), border: `3px solid ${alpha(t.gold, 0.75)}`, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>{c.text}</span>
                </div>
              );
            })}
          </div>
          {/* 右侧：先收藏盖章 */}
          {d.stamp && stampIn > 0 && (
            <div style={{ position: "absolute", right: 130, top: 380, opacity: clamp(stampIn * 3), transform: `scale(${0.55 + 0.45 * Math.min(1.12, stampIn)}) rotate(-7deg)`, transformOrigin: "50% 50%" }}>
              <div style={{ padding: "20px 40px", borderRadius: 18, border: `6px double ${t.gold}`, background: alpha(t.bg, 0.5), boxShadow: `0 0 40px ${alpha(t.gold, 0.35)}` }}>
                <span style={{ ...ink(78, t.gold, t.font.title, 10), whiteSpace: "nowrap" }}>{d.stamp.text}</span>
              </div>
            </div>
          )}
          <Sfx name="whoosh" at={stage} volume={0.28} />
          {d.chips.map((c, i) => (
            <Sfx key={i} name="pop" at={c.at} volume={0.3} />
          ))}
          {d.stamp && <Sfx name="stamp" at={d.stamp.at} volume={0.45} />}
          {d.stamp && <Sfx name="ding" at={d.stamp.at + 8} volume={0.35} />}
        </Stage>
      )}
    </>
  );
};

export const OpeningDbsShatter: CompDef<D> = {
  ...tpl<D>({
    id: "opening-dbs-shatter",
    name: "开场 · 碎屏居中大字→真人全屏两侧动效→收窗",
    hook: "反常识（让AI唱反调）+ 场景胶囊 + 收藏盖章",
    desc: "0~4.1s PRO-02 碎屏（两句大字居中）；stageAt 碎屏层淡出揭幕真人全屏，左侧「辞职/转行/合伙做生意」胶囊逐个卡词弹出、右侧金章「先收藏这条」盖章；到 presenter.full 收进右上小窗",
    use: "只给《做重大决策，让AI竭尽全力唱反调》用（开场不重样）",
    techniques: ["居中大字砸出", "碎屏重组", "真人全屏两侧动效", "胶囊逐词弹出", "盖章+ding", "收窗衔接"],
    schema: s,
    C,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        punches: [{ at: 0, amt: 0.06 }, { at: dd.punchAt, amt: 0.05 }, { at: dd.stageAt, amt: 0.05 }],
        // 真人全屏期间缓慢推近，收窗前回到 1.02 附近，衔接不跳位
        zoomTo: 1.05,
        zoomAt: dd.stageAt,
        zoomLen: Math.max(12, dur2 - dd.stageAt - 12),
      }),
  }),
  noGallery: true,
  opening: {
    script: "../../../dbs-decision",
    hook: "反常识 + 真人全屏两侧动效",
    techniques: ["居中大字", "碎屏重组", "两侧胶囊", "收藏盖章"],
    selfBg: true,
  },
};
