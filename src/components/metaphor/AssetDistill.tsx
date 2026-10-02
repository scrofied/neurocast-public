import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const frag = z.object({ text: z.string(), at: z.number().optional() });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  fragments: z.array(frag).min(2).max(5).describe("被当成杂事的琐碎经历：微信催工厂发货 / 核对 Excel / 群里赔笑脸"),
  tower: z.string().default("提炼").describe("中间那台机器的名字，如 提炼 / 沉淀 / 复盘"),
  towerIcon: z.string().optional().describe("塔上的图标名（src/lib/icons），缺省 shovel"),
  asset: z
    .object({
      name: z.string().describe("提炼出来的资产名，如 非标供应链交付风险预警与催收 SOP"),
      note: z.string().optional().describe("这资产是什么、能帮谁，如 给刚起步的电商小卖家搭交付流程"),
      tag: z.string().optional().describe("角标，如 可对外交付"),
    })
    .describe("最后凝结出来的可售卖资产"),
  price: z.string().optional().describe("价签，如 单份 299"),
  refineAt: z.number().optional().describe("碎片被吸入、开始提炼的时刻（锚点，如“提炼出了”）"),
  outAt: z.number().optional().describe("资产卡凝成飞出的时刻（锚点，如“一套”）"),
  priceAt: z.number().optional().describe("价签盖章的时刻（锚点，如“收费”）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const n = data.fragments.length;
  const refineAt = cueOr(data.refineAt, Math.max(30, dur * 0.46));
  const fCues = listCues(data.fragments, 6, Math.max(20, Math.min(dur * 0.34, refineAt - 12)));
  const outAt = cueOr(data.outAt, refineAt + 46);
  const priceAt = cueOr(data.priceAt, outAt + 26);

  // geometry on 1920x1080
  const FX = width * 0.055;
  const FW = width * 0.24;
  const fy0 = height * 0.31;
  const fh = Math.min(78, (height * 0.5) / n);
  const gap = fh * 0.22;
  const cx = width * 0.425;
  const ty0 = height * 0.235;
  const ty1 = height * 0.83;
  const half0 = 74;
  const half1 = 56;
  const ax = width * 0.565;
  const aw = width * 0.37;
  const ay = height * 0.32;
  const ah = height * 0.29;

  // refine: fragments get sucked into the tower, a core condenses, then the asset card flies out
  const rf = easeIn(prog(frame, refineAt, 20));
  const rv = easeOut(prog(frame, refineAt, 16));
  const coreAt = refineAt + 22;
  const core = easeOutBack(prog(frame, coreAt, 18)) * (frame < outAt ? 1 : 0);
  // 资产卡原生是「从塔口滑出 + 0.86→1 放大 + 淡入」；rise 的 p 曲线与原来一致，from 保住起始缩放
  // 卡片的 left/top 就是 (1 - eOut.p) 插出来的（位置由 e.p 驱动）→ 不叠加 e.dx/e.dy，否则会两倍位移
  const eOut = enterAt(frame, outAt, { fallback: "rise", dur: 22, from: 0.86 });
  // 价签盖章：原生从 2 倍缩到 1
  const ePrice = enterAt(frame, priceAt, { fallback: "rise", dur: 10, from: 2 });
  // 纯淡入的小标签文字
  const eTowerLbl = enterAt(frame, 6, { fallback: "rise", dur: 12 });
  const ePileLbl = enterAt(frame, 4, { fallback: "rise", dur: 12 });
  const shake = frame >= refineAt && frame < refineAt + 14 ? Math.sin((frame - refineAt) * 2.1) * 4 * (1 - (frame - refineAt) / 14) : 0;
  const coreY = ty0 + (ty1 - ty0) * 0.46;

  const cols = [t.primary, t.secondary, t.accent];

  return (
    <>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />

      {/* the tower */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, transform: `translateX(${shake}px)` }}>
        <defs>
          <linearGradient id="adTower" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={alpha(t.primary, 0.03 + 0.08 * rv)} />
            <stop offset="1" stopColor={alpha(t.primary, 0.16 + 0.2 * rv)} />
          </linearGradient>
          <radialGradient id="adCore" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={alpha("#ffffff", 0.95)} />
            <stop offset="0.45" stopColor={alpha(t.primary, 0.7)} />
            <stop offset="1" stopColor={alpha(t.primary, 0)} />
          </radialGradient>
        </defs>
        {/* base plate */}
        <rect x={cx - half1 - 46} y={ty1 - 14} width={(half1 + 46) * 2} height={30} rx={15} fill={alpha(t.bg2, 0.9)} stroke={alpha(t.primary, 0.45 + 0.4 * rv)} strokeWidth={2.5} />
        {/* column */}
        <polygon
          points={`${cx - half0},${ty0} ${cx + half0},${ty0} ${cx + half1},${ty1} ${cx - half1},${ty1}`}
          fill="url(#adTower)"
          stroke={alpha(t.primary, 0.4 + 0.5 * rv)}
          strokeWidth={2.5}
          style={{ filter: rv > 0.2 ? `drop-shadow(0 0 ${18 * rv}px ${alpha(t.primary, 0.6)})` : undefined }}
        />
        {/* stage rings — reads as a machine, not a slab */}
        {[0.2, 0.42, 0.64, 0.86].map((k, i) => {
          const y = ty0 + (ty1 - ty0) * k;
          const hw = half0 + (half1 - half0) * k;
          const lit = easeOut(prog(frame, refineAt + i * 5, 10));
          return <line key={i} x1={cx - hw} y1={y} x2={cx + hw} y2={y} stroke={alpha(t.primary, 0.25 + 0.55 * lit)} strokeWidth={2} />;
        })}
        {/* top collar */}
        <ellipse cx={cx} cy={ty0} rx={half0} ry={13} fill={alpha(t.bg2, 0.95)} stroke={alpha(t.primary, 0.45 + 0.45 * rv)} strokeWidth={2.5} />
        {/* rising particles inside the tower */}
        {frame >= refineAt &&
          new Array(26).fill(0).map((_, i) => {
            const k = ((frame - refineAt) * (0.022 + 0.032 * rv) + i / 26) % 1;
            const y = ty1 - 24 - k * (ty1 - ty0 - 30);
            const hw = half0 + (half1 - half0) * ((y - ty0) / (ty1 - ty0));
            const x = cx + Math.sin(i * 2.7 + frame * 0.06) * (hw - 16);
            return <circle key={i} cx={x} cy={y} r={3 + (i % 3)} fill={cols[i % cols.length]} opacity={0.45 + 0.5 * k} />;
          })}
        {/* condensing core before the asset is released */}
        {core > 0 && <circle cx={cx} cy={coreY} r={52 * core + 16} fill="url(#adCore)" opacity={0.85} />}
        {/* feed lines from the pile */}
        {frame >= 2 &&
          data.fragments.map((_, i) => {
            const p = clamp(rf * 1.2 - i * 0.06);
            if (p <= 0) return null;
            const sy = fy0 + i * (fh + gap) + fh / 2;
            return <line key={i} x1={FX + FW} y1={sy} x2={cx - half0 * 0.5} y2={sy + (coreY - sy) * p} stroke={alpha(t.primary, 0.5 * (1 - p * 0.5))} strokeWidth={2} strokeDasharray="8 10" strokeDashoffset={-frame * 2} />;
          })}
      </svg>

      {/* tower icon + label */}
      <div style={{ position: "absolute", left: cx - 60, top: coreY - 60, width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center", opacity: (0.45 + 0.55 * rv) * (frame < outAt ? 1 : 0.35), transform: `scale(${0.9 + 0.1 * Math.sin(frame / 9) * rv})` }}>
        <Icon name={data.towerIcon ?? "shovel"} size={86} color={rv > 0.4 ? t.text : alpha(t.text, 0.7)} stroke={1.8} />
      </div>
      <div style={{ position: "absolute", left: cx - 190, top: ty1 + 30, width: 380, textAlign: "center", fontFamily: t.font.mono, fontSize: 22, letterSpacing: 8, color: alpha(t.primary, 0.85), opacity: eTowerLbl.opacity, transform: `translate(${eTowerLbl.dx}px, ${eTowerLbl.dy}px)`, clipPath: eTowerLbl.clip }}>
        {data.tower}
      </div>

      {/* left: the "nothing special" pile */}
      <div style={{ position: "absolute", left: FX, top: fy0 - 62, fontFamily: t.font.body, fontWeight: 700, fontSize: 26, color: t.dim, opacity: ePileLbl.opacity, transform: `translate(${ePileLbl.dx}px, ${ePileLbl.dy}px)`, clipPath: ePileLbl.clip }}>她眼里的杂事</div>
      {data.fragments.map((f, i) => {
        // 碎卡原生就是从左偏 50px 滑进位（left 里有 (1 - e.p) * -50）：位置由 e.p 驱动，不再叠加 e.dx/e.dy
        const e = enterAt(frame, fCues[i], { fallback: "rise", dur: 12, from: 0.9 });
        if (frame < fCues[i]) return null;
        const sy = fy0 + i * (fh + gap);
        const gone = rf;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: FX + (1 - e.p) * -50 + gone * (cx - FX - half0 * 0.5) * 0.6,
              top: sy + gone * (coreY - sy - fh / 2) * 0.85,
              width: FW,
              height: fh,
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "0 22px",
              borderRadius: 14,
              background: "rgba(44,44,56,.86)",
              border: "2px solid #6b6b80",
              transform: `rotate(${(i % 2 ? 1 : -1) * 1.2 * (1 - gone)}deg) scale(${e.scale * (1 - gone * 0.45)})`,
              opacity: Math.min(1, e.p) * (1 - gone * 0.82),
              filter: `grayscale(${0.5 + gone * 0.5})`,
            }}
          >
            <Icon name="doc" size={38} color="#c9ced6" />
            <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(f.text, FW - 120, 38, 20), color: "#dfe3ea", whiteSpace: "nowrap" }}>{f.text}</span>
          </div>
        );
      })}

      {/* right: the asset that comes out */}
      {frame >= outAt - 6 && (
        <div
          style={{
            position: "absolute",
            left: ax + (1 - eOut.p) * (cx - ax) * 0.6,
            top: ay + (1 - eOut.p) * (coreY - ay) * 0.7,
            width: aw,
            minHeight: ah,
            padding: "34px 38px",
            borderRadius: 20,
            background: `linear-gradient(155deg, ${alpha(t.gold, 0.2)}, ${alpha(t.bg2, 0.94)} 62%)`,
            border: `3px solid ${alpha(t.gold, 0.85)}`,
            boxShadow: `0 0 ${40 * eOut.p}px ${alpha(t.gold, 0.45)}, inset 0 0 40px ${alpha(t.gold, 0.08)}`,
            transform: `scale(${eOut.scale})`,
            opacity: Math.min(1, eOut.p * 1.6),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <Icon name="award" size={38} color={t.gold} stroke={1.8} />
            {data.asset.tag && (
              <span style={{ padding: "4px 14px", borderRadius: 999, background: alpha(t.gold, 0.18), border: `1.5px solid ${alpha(t.gold, 0.6)}`, fontFamily: t.font.body, fontWeight: 700, fontSize: 22, color: t.gold }}>
                {data.asset.tag}
              </span>
            )}
          </div>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.asset.name, aw - 76, 52, 26), lineHeight: 1.28, color: t.text }}>{data.asset.name}</div>
          {data.asset.note && <div style={{ marginTop: 16, fontFamily: t.font.body, fontSize: 26, lineHeight: 1.5, color: alpha(t.text, 0.72) }}>{data.asset.note}</div>}
        </div>
      )}
      {data.price && frame >= priceAt - 4 && (
        <div
          style={{
            position: "absolute",
            left: ax + aw * 0.46,
            top: ay + ah + 26,
            transform: `rotate(-6deg) scale(${frame >= priceAt ? ePrice.scale : 0}) translate(${ePrice.dx}px, ${ePrice.dy}px)`,
            clipPath: ePrice.clip,
            transformOrigin: "left center",
            padding: "12px 34px",
            border: `5px solid ${t.gold}`,
            borderRadius: 14,
            background: alpha(t.bg, 0.72),
            fontFamily: t.font.title,
            fontWeight: 900,
            fontSize: fitFont(data.price, 560, 66, 34),
            color: t.gold,
            whiteSpace: "nowrap",
            opacity: clamp(ePrice.p * 2),
            boxShadow: `0 0 30px ${alpha(t.gold, 0.5)}`,
          }}
        >
          {data.price}
        </div>
      )}

      {fCues.map((c, i) => (
        <Sfx key={`f${i}`} name="pop" at={c} volume={0.3} />
      ))}
      {refineAt >= 40 && <Sfx name="riser" at={refineAt - 40} volume={0.16} />}
      <Sfx name="sparkle" at={outAt} volume={0.36} />
      {data.price && <Sfx name="stamp" at={priceAt} volume={0.5} />}
    </>
  );
};

export const AssetDistill: CompDef<D> = {
  id: "asset-distill",
  name: "经历提炼成资产",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["提炼", "沉淀", "杂活", "资产", "可售卖", "SOP"],
  motion: { kind: "碎卡逐条弹出、被吸入提炼塔（塔内粒子上升），资产卡凝出飞入、价签盖章", energy: 3 },
  desc: "左边一摞被当成杂事的碎卡片，被中间的提炼塔吸进去，塔内粒子向上加速，右边凝出一张金边的资产卡（名字+给谁用），可盖章价签",
  use: "把平常的经历/琐事提炼成能对外交付的东西：三年跟单提炼成催收 SOP、十次客诉提炼成服务话术、五十场面试提炼成面试题库（fragments / asset / price 全可改）",
  schema,
  example: {
    fragments: [{ text: "微信催工厂发货" }, { text: "核对 Excel" }, { text: "群里赔笑脸" }],
    tower: "提炼",
    asset: { name: "非标供应链交付风险前置预警与催收 SOP", note: "给刚起步的电商小卖家搭交付流程", tag: "可对外交付" },
    price: "单份 299",
  },
  C,
};
