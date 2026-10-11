import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeIn, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { assetUrl } from "../../lib/asset";
import { CharPop, Slam, Stamp } from "../../lib/cine/Type";
import { Flash, RingBurst, SpeedLines } from "../../lib/cine/Flash";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, ink, Stage, tpl } from "../templates/kit";

// 《Codex和WorkBuddy怎么选》专属开场（2026-10-10）
// 钩子 = 反问 + 品牌 VS：第 0 帧两个真实官方图标从左右砸位 + 居中大字「怎么选？」，
// 「你还在」时金色 VS 盖章，「纠结」时两图标对撞一下，说到「我现在让」整层爆闪交棒真人全屏。
// 全程不透明舞台 —— 真人这段时间被压在层下，收棒时刻由 presenter.full 精确接管。
const W = 1920;
const H = 1080;

const s = z.object({
  title: z.string().default("怎么选？").describe("第 0 帧居中大字"),
  iconL: z.string().describe("左侧真实图标（Codex 官方图标，走 assetFields）"),
  iconR: z.string().describe("右侧真实图标（WorkBuddy 官方图标）"),
  labelL: z.string().default("Codex").describe("左图标下的品牌名"),
  labelR: z.string().default("WorkBuddy").describe("右图标下的品牌名"),
  vsAt: z.number().default(40).describe("VS 盖章时刻（锚点，如「你还在」）"),
  bumpAt: z.number().default(62).describe("两图标对撞时刻（锚点，如「纠结」）"),
  outAt: z.number().default(84).describe("整层交棒时刻（锚点，如「我现在让」）；缺省=镜头结束"),
});
type D = z.infer<typeof s>;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const vsAt = d.vsAt;
  const bumpAt = d.bumpAt;
  const outAt = d.outAt > 0 ? Math.min(d.outAt, dur - 6) : dur - 6;

  // 图标入场：左右各一记 slam（大→落定），带一点过冲回弹
  const inL = easeOutBack(prog(frame, 1, 10));
  const inR = easeOutBack(prog(frame, 4, 10));
  // 对撞：bumpAt 起 8 帧向内顶一下再弹回（sin 半波）
  const bump = frame >= bumpAt && frame < bumpAt + 10 ? Math.sin(((frame - bumpAt) / 10) * Math.PI) : 0;
  // VS 盖章
  const vsK = frame >= vsAt ? easeOutBack(prog(frame, vsAt, 8)) : 0;
  // 交棒：整层向两侧撕开 + 加速淡出
  const outK = easeIn(prog(frame, outAt, 8));

  const iy = H * 0.3;
  const lw = W * 0.17; // 图标边长 ~326
  const lx = W * 0.3 - 55 * bump; // 左图标中心
  const rx = W * 0.7 + 55 * bump;

  const icon = (src: string, label: string, cx: number, k: number, at: number) => {
    const op = clamp(k * 1.6) * (1 - outK);
    if (op <= 0.01) return null;
    const sz = lw * lerp(2.1, 1, k);
    return (
      <div style={{ position: "absolute", left: cx - sz / 2, top: iy - sz / 2, width: sz, height: sz, opacity: op }}>
        <Img src={assetUrl(src)} style={{ width: sz, height: sz, borderRadius: sz * 0.22, objectFit: "cover", boxShadow: `0 18px 60px rgba(0,0,0,.55), 0 0 46px ${alpha(t.primary, 0.4)}`, border: `3px ${alpha(t.primary, 0.5)} solid` }} />
      </div>
    );
  };
  const label = (text: string, cx: number, at: number) => {
    const op = frame >= at ? 1 - outK : 0;
    if (op <= 0.01) return null;
    return (
      <div style={{ position: "absolute", left: cx - 300, top: iy + lw / 2 + 26, width: 600, textAlign: "center", opacity: op }}>
        <CharPop frame={frame} at={at} text={text} cues={Array.from(text).map((_, i) => at + i * 2)} size={58} color="#fff" font={t.font.title} strokeW={8} />
      </div>
    );
  };

  return (
    <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: vsAt, amp: 8, len: 6 }, { at: bumpAt, amp: 5, len: 4 }]} exit="fade" outLen={8}>
      {/* 底：紫色舞台 + 中央光环 */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(1200px 700px at 50% 34%, ${alpha(t.primary, 0.2)}, transparent 60%), linear-gradient(180deg, #0b0618 0%, #140a26 55%, #0b0618 100%)` }} />
      {/* 中缝 VS */}
      {vsK > 0.01 && (
        <div style={{ position: "absolute", left: W / 2 - 130, top: iy - 130, width: 260, height: 260, opacity: (frame >= outAt ? 1 - outK * 2 : 1) }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${0.6 + 0.4 * vsK}) rotate(-8deg)`, opacity: clamp(vsK) }}>
            <Stamp frame={frame} at={vsAt} text="VS" size={190} color={t.gold} font={t.font.title} rotate={-8} pad={0.22} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }} />
          </div>
          <RingBurst frame={frame} at={vsAt} x={130} y={130} color={t.gold} maxR={210} len={14} />
        </div>
      )}
      {icon(d.iconL, d.labelL, lx, inL, 1)}
      {icon(d.iconR, d.labelR, rx, inR, 4)}
      {label(d.labelL, W * 0.3, 10)}
      {label(d.labelR, W * 0.7, 14)}
      {/* 居中大字：第 0 帧就有 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.56, textAlign: "center", opacity: 1 - outK, transform: `translateY(${-160 * outK}px) scale(${1 + 0.12 * outK})` }}>
        <Slam frame={frame} at={0} text={d.title} size={168} color="#fff" font={t.font.title} from={1.55} len={7} blur={5} strokeW={12} />
      </div>
      {/* 「纠结」时大字下面补一行小承诺 */}
      {frame >= bumpAt && (
        <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.76, textAlign: "center", opacity: (1 - outK) * clamp((frame - bumpAt) / 6) }}>
          <span style={{ display: "inline-block", padding: "10px 34px", borderRadius: 999, background: alpha(t.primary, 0.18), border: `2px ${alpha(t.gold, 0.7)} solid`, ...ink(40, "#fff", t.font.title, 6) }}>不用选，让它们组队干活</span>
        </div>
      )}
      <Flash frame={frame} at={0} len={7} peak={0.55} />
      <Flash frame={frame} at={vsAt} len={5} peak={0.3} />
      <Flash frame={frame} at={outAt} len={8} peak={0.6} />
      <SpeedLines frame={frame} at={0} x={W / 2} y={H * 0.4} color={t.primary} len={16} count={14} inner={420} seed={seed} />
      <Sfx name="impact" at={0} volume={0.5} />
      <Sfx name="stamp" at={vsAt} volume={0.4} />
      <Sfx name="ding" at={bumpAt} volume={0.3} />
      <Sfx name="whoosh" at={outAt} volume={0.4} />
    </Stage>
  );
};

export const OpeningCodexVsWb: CompDef<D> = {
  ...tpl<D>({
    id: "opening-codex-vs-wb",
    name: "开场 · Codex 与 WorkBuddy 双真图标 VS",
    hook: "反问 + 品牌VS",
    desc: "第 0 帧两个真实官方图标左右砸位 + 居中「怎么选？」大字（闪白+impact）；「你还在」金色 VS 盖章；「纠结」图标对撞+承诺胶囊；「我现在让」整层爆闪交棒真人",
    use: "两个知名 AI 工具「选哪个」类钩子：把两家真实图标做成主视觉对峙，第三秒交棒真人口播（本骨架供《Codex和WorkBuddy怎么选》使用）",
    techniques: ["首帧大字居中", "真实品牌图标对峙", "VS 盖章", "图标对撞", "承诺胶囊", "爆闪交棒"],
    schema: s,
    assetFields: ["iconL", "iconR"],
    example: {
      title: "怎么选？",
      iconL: "codex_icon.png",
      iconR: "wb_256.png",
      vsAt: 40,
      bumpAt: 62,
      outAt: 84,
    },
    C,
    camera: (dd, f, dur2) => cam(f, dur2, { punches: [{ at: 0, amt: 0.06 }, { at: dd.vsAt, amt: 0.04 }] }),
  }),
  noGallery: true,
  opening: { script: "neurocast-codex-workbuddy", hook: "反问+品牌VS", techniques: ["首帧大字居中", "真图标对峙", "VS 盖章", "爆闪交棒"] },
};
