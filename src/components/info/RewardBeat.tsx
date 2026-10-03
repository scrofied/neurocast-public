// 移植自 yihui-dev/awesome-opus5-5-videos（MIT）里 @op7418 的 prompt op7418-814408：
// https://x.com/op7418
// 原机制：手游「高光时刻」五拍动效（开宝箱/段位晋升/成就解锁/Boss 掉落/角色升级），
// 配色随等级切换（普通绿→稀有蓝→史诗紫→传说金），待机慢转 → 蓄力吸粒子 → 爆发屏震 → 揭晓数字滚动，
// 并且明确要求「彩带/冲击环只在爆发那一拍放」。已改成配音时间轴驱动的结算镜头，参数化。
import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeIn, easeOut, easeOutQuint, hash, lerp, noise1, prog, rng } from "../../lib/anim";
import { cueOr, listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { hitShake } from "../../lib/bits";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { CharPop, outline } from "../../lib/cine/Type";
import { Flash, RingBurst, SpeedLines } from "../../lib/cine/Flash";
import { fmtNum, fitFont, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const tier = z.object({
  name: z.string().describe("档位名，如「普通」「稀有」「史诗」「传说」「白银」"),
  color: z.string().optional().describe("这一档的颜色（#hex）；缺省按 稀有蓝→主题青→史诗紫→传说金 取"),
  at: z.number().optional().describe("升到这一档的时刻（锚点（台词原文）或帧）；缺省=按台词均匀铺开"),
});
const reward = z.object({
  label: z.string().describe("奖励条目名，如「现金」「限定头像框」"),
  value: z.string().optional().describe("奖励数值，如 +1200、1 个"),
  at: z.number().optional().describe("这条奖励飞入的时刻（锚点（台词原文）或帧）"),
});

const schema = z.object({
  title: z.string().optional().describe("镜头标题，左上 Headline"),
  kicker: z.string().optional().describe("标题上方小标签，缺省 HIGHLIGHT"),
  badge: z.string().describe("主体：被升级/被开的那个东西，如「月度战绩」「账号体检」「宝箱」"),
  tiers: z.array(tier).min(2).max(4).describe("逐级晋升的档位（2~4 档），每档切换主色/背景/光效"),
  chargeAt: z.number().optional().describe("蓄力开始（锚点（台词原文）或帧）；缺省=最后一档 +18 帧"),
  burstAt: z.number().optional().describe("爆发/揭晓（锚点（台词原文）或帧）；缺省=蓄力后 24 帧"),
  value: z
    .object({
      from: z.number().default(0).describe("数字滚动起点"),
      to: z.number().describe("数字滚动终点（结算值）"),
      unit: z.string().optional().describe("单位，如 %、分、元、粉、位"),
      label: z.string().describe("这个数字是什么，如「当月涨粉」「综合得分」"),
    })
    .describe("爆发后滚出来的那个数"),
  rewards: z.array(reward).max(4).optional().describe("揭晓后从中央沿贝塞尔飞入两侧的奖励条目（最多 4 条，可不填）"),
});
type D = z.infer<typeof schema>;

// 二次贝塞尔（奖励卡从中心绕弧飞到两侧，比直线位移更像「掉落物弹开」）
const qbez = (a: number, b: number, c: number, t: number) => lerp(lerp(a, b, t), lerp(b, c, t), t);

// 尖顶六边形（手游徽章的轮廓）：按框尺寸算顶点，SVG 描边才不会被 clip 削掉
const hexPoints = (w: number, h: number) =>
  [
    [w * 0.5, 0],
    [w * 0.94, h * 0.25],
    [w * 0.94, h * 0.75],
    [w * 0.5, h],
    [w * 0.06, h * 0.75],
    [w * 0.06, h * 0.25],
  ]
    .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();

  const tn = d.tiers.length;
  const PAL = [t.secondary, t.primary, t.accent, t.gold];
  const tcol = d.tiers.map((x, i) => x.color ?? PAL[i % PAL.length]);
  const cues = listCues(d.tiers, 12, Math.max(40, Math.round(dur * 0.6)));

  const chargeAt = cueOr(d.chargeAt, Math.round(cues[tn - 1] + 18));
  const burstAt = cueOr(d.burstAt, Math.round(chargeAt + Math.max(20, (dur - chargeAt) * 0.32)));
  const revealAt = burstAt + 6;
  const rolls = d.rewards ? listCues(d.rewards, revealAt + 8, revealAt + 52) : [];

  // 档位色连续混过去（14 帧），背景色调/光效一起跟着换，不做硬切
  let ti = 0;
  for (let i = 0; i < tn; i++) if (frame >= cues[i]) ti = i;
  const mixP = clamp((frame - cues[ti]) / 14);
  const col = ti === 0 ? tcol[0] : mixHex(tcol[ti - 1], tcol[ti], mixP);
  const post = frame >= burstAt;

  const cx = width / 2;
  const cy = height * 0.3;
  const bw = Math.min(360, width * 0.2);
  const bh = bw * 0.92;

  // ① 待机：慢浮 + 慢左右转（noise1 而不是随机，逐帧是时间的纯函数）
  const bob = Math.sin(frame / 26) * 7;
  const turn = noise1(frame / 80, seed) * 15;
  const shine = lerp(-80, bw + 20, (frame % 90) / 90);
  // ③ 蓄力：粒子从四周收敛到主体
  const chP = clamp(prog(frame, chargeAt, Math.max(6, burstAt - chargeAt)));
  const chAmp = frame >= chargeAt && frame <= burstAt + 6 ? Math.sin(chP * Math.PI) : 0;
  // 原生是「主体从 0.86 稳稳定住」；from 保住基线，分镜写 motion.enter 才换语法
  const eBadge = enterAt(frame, 8, { fallback: "rise", dur: 18, from: 0.86, seed });
  const eNum = enterAt(frame, revealAt, { fallback: "slam", dur: 14 });

  const sh = hitShake(frame, [burstAt, revealAt], 16, 22, seed);
  const rollP = easeOutQuint(prog(frame, revealAt, 30));
  const dec = Number.isInteger(d.value.from) && Number.isInteger(d.value.to) ? 0 : 1;
  const vStr = fmtNum(lerp(d.value.from, d.value.to, rollP), dec);
  const unit = d.value.unit ?? "";
  // 字号按终值算：滚动过程中位数在变，跟着 vStr 缩放会抖
  const numFs = fitFont(`${fmtNum(d.value.to, dec)}${unit}`, width * 0.62, 172, 60);

  const parts = React.useMemo(() => {
    const r = rng(hash(d.badge) + seed);
    return Array.from({ length: 30 }, () => ({ a: r() * Math.PI * 2, r0: 340 + r() * 460, sp: 0.7 + r() * 0.6, sz: 3 + r() * 5, k: r() }));
  }, [d.badge, seed]);
  const conf = React.useMemo(() => {
    const r = rng(hash(d.badge) + seed * 31 + 5);
    return Array.from({ length: 52 }, () => ({ a: -Math.PI / 2 + (r() - 0.5) * 2.6, sp: 320 + r() * 700, sz: 8 + r() * 16, c: r(), rot: (r() - 0.5) * 900, delay: r() * 6 }));
  }, [d.badge, seed]);

  const HEX = hexPoints(bw, bh);

  return (
    <>
      {/* 背景随档位染色：整幅压暗 + 中心一团主色光 */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${cx}px ${cy}px, ${alpha(col, 0.1 + 0.16 * chAmp + (post ? 0.14 : 0))}, ${alpha(t.bg, 0)} 62%)` }} />

      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* ①② 主体徽章：待机慢浮慢转，档位切换时换色 + 段位名逐字砸入 */}
        <div style={{ position: "absolute", left: cx - bw / 2, top: cy - bh / 2 + bob, width: bw, height: bh, opacity: eBadge.opacity, transform: `perspective(1500px) rotateY(${turn}deg) scale(${eBadge.scale}) translate(${eBadge.dx}px, ${eBadge.dy}px)`, clipPath: eBadge.clip }}>
          <div style={{ position: "absolute", inset: -120, background: `radial-gradient(circle at 50% 50%, ${alpha(col, 0.5)}, ${alpha(col, 0)} 68%)`, opacity: 0.45 + 0.55 * chAmp + (post ? 0.25 : 0) }} />
          <svg width={bw} height={bh} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="rb-body" x1="0" y1="0" x2="0.3" y2="1">
                <stop offset="0%" stopColor={alpha(col, 0.62)} />
                <stop offset="55%" stopColor={alpha(t.bg2, 0.94)} />
                <stop offset="100%" stopColor={alpha(t.bg, 0.96)} />
              </linearGradient>
            </defs>
            <polygon points={HEX} fill="none" stroke={alpha(col, 0.3 + 0.5 * chAmp)} strokeWidth={3} transform={`translate(${bw * 0.04} ${bh * 0.04}) scale(0.92)`} />
            <polygon points={HEX} fill="url(#rb-body)" stroke={col} strokeWidth={5} strokeLinejoin="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden" }}>
            <div style={{ fontFamily: t.font.mono, fontSize: 18, letterSpacing: 6, color: alpha(t.text, 0.7) }}>{`TIER ${ti + 1}/${tn}`}</div>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(d.badge, bw * 0.66, 44, 20), color: t.text, textAlign: "center", lineHeight: 1.25, padding: "0 18px", textShadow: `0 0 22px ${alpha(col, 0.8)}` }}>{d.badge}</div>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: shine, width: 60, background: `linear-gradient(90deg, transparent, ${alpha("#ffffff", 0.22)}, transparent)`, transform: "skewX(-14deg)" }} />
          </div>
        </div>

        {d.tiers.map((x, i) => {
          const next = i < tn - 1 ? cues[i + 1] : undefined;
          if (frame < cues[i]) return null;
          const cs = Array.from(x.name).map((_, j) => Math.round(cues[i] + 2 + j * 2.4));
          return (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: cy + bh / 2 + 18 + bob * 0.4, display: "flex", justifyContent: "center" }}>
              <CharPop frame={frame} at={cues[i]} cues={cs} text={x.name} size={fitFont(x.name, width * 0.5, 84, 40)} color={tcol[i]} font={t.font.title} stroke={t.bg} strokeW={7} out={next} outLen={10} />
            </div>
          );
        })}

        {/* ③ 蓄力：粒子从四周被吸向主体 + 核心膨胀 */}
        {frame >= chargeAt && frame <= burstAt + 4 && (
          <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {parts.map((pt, i) => {
              const lp = clamp((chP - pt.k * 0.25) / 0.75);
              if (lp <= 0) return null;
              const rr = lerp(pt.r0, 26, easeIn(lp));
              const x = cx + Math.cos(pt.a + lp * 2.4 * (i % 2 ? 1 : -1)) * rr;
              const y = cy + Math.sin(pt.a + lp * 2.4 * (i % 2 ? 1 : -1)) * rr * 0.72;
              return <g key={i} opacity={0.25 + 0.75 * lp}>
                <line x1={x} y1={y} x2={cx + Math.cos(pt.a) * Math.max(0, rr - pt.sp * 0.12)} y2={cy + Math.sin(pt.a) * Math.max(0, rr * 0.72 - pt.sp * 0.1)} stroke={alpha(col, 0.45)} strokeWidth={pt.sz * 0.4} strokeLinecap="round" />
                <circle cx={x} cy={y} r={pt.sz} fill={pt.k < 0.6 ? col : t.text} />
              </g>;
            })}
            <circle cx={cx} cy={cy} r={lerp(0, bw * 0.62, easeIn(chP))} fill={alpha(col, 0.2 + 0.4 * chP)} />
            <circle cx={cx} cy={cy} r={lerp(10, bw * 0.66, easeIn(chP))} fill="none" stroke={alpha(t.text, 0.5 * chP)} strokeWidth={3} />
          </svg>
        )}

        {/* ④ 爆发：全片只有这一拍有冲击环与彩带（op7418 原 prompt 的克制规则） */}
        <RingBurst frame={frame} at={burstAt} x={cx} y={cy} color={col} len={22} maxR={Math.min(width, height) * 0.62} width={12} />
        <RingBurst frame={frame} at={burstAt + 3} x={cx} y={cy} color={t.text} len={18} maxR={Math.min(width, height) * 0.42} width={6} />
        <SpeedLines frame={frame} at={burstAt} x={cx} y={cy} color={alpha(col, 0.8)} len={16} count={30} inner={bw * 0.6} seed={seed} />
        {frame >= burstAt && frame < burstAt + 50 &&
          conf.map((c, i) => {
            const cp = easeOut(prog(frame, burstAt + c.delay, 44));
            const dist = c.sp * cp;
            const x = cx + Math.cos(c.a) * dist;
            const y = cy + Math.sin(c.a) * dist * 0.55 + 520 * cp * cp;
            const cc = c.c < 0.34 ? col : c.c < 0.62 ? t.gold : c.c < 0.82 ? t.primary : t.text;
            return <div key={i} style={{ position: "absolute", left: x - c.sz / 2, top: y - c.sz / 2, width: c.sz, height: c.sz * 0.45, background: alpha(cc, 1 - cp * 0.6), transform: `rotate(${c.rot * cp}deg)`, borderRadius: 2 }} />;
          })}
        <Flash frame={frame} at={burstAt} len={10} peak={0.7} color={alpha(col, 0.9)} />

        {/* ⑤ 揭晓：数字从 from 滚到 to */}
        {post && (
          <div style={{ position: "absolute", left: 0, right: 0, top: height * 0.56, textAlign: "center", opacity: eNum.opacity, transform: `translate(${eNum.dx}px, ${eNum.dy}px) scale(${eNum.scale})`, clipPath: eNum.clip }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", fontFamily: t.font.title, fontWeight: 900, color: t.text, whiteSpace: "nowrap", ...outline(t.bg, 8) }}>
              <span style={{ fontSize: numFs, lineHeight: 1, fontVariantNumeric: "tabular-nums", textShadow: `0 0 46px ${alpha(col, 0.75)}` }}>{vStr}</span>
              {unit && <span style={{ fontSize: numFs * 0.4, marginLeft: 12, color: col }}>{unit}</span>}
            </div>
            <div style={{ marginTop: 12, fontFamily: t.font.body, fontWeight: 800, fontSize: 34, letterSpacing: 4, color: alpha(t.text, 0.82) }}>{d.value.label}</div>
          </div>
        )}

        {/* 奖励卡沿贝塞尔曲线飞入两侧并停住 */}
        {(d.rewards ?? []).map((rw, j) => {
          const at = rolls[j];
          if (frame < at) return null;
          const tp = easeOut(prog(frame, at, 20));
          const side = j % 2 === 0 ? -1 : 1;
          const row = Math.floor(j / 2);
          const ex = cx + side * width * (0.3 + row * 0.02);
          const ey = height * (0.2 + row * 0.26);
          const x = qbez(cx, cx + side * 60, ex, tp);
          const y = qbez(cy, -60, ey, tp);
          const cw = Math.min(360, width * 0.2);
          const eRw = enterAt(frame, at, { fallback: "drop", dur: 20, seed: j });
          return (
            <div key={j} style={{ position: "absolute", left: x - cw / 2, top: y - 46, width: cw, opacity: eRw.opacity, transform: `translate(${eRw.dx}px, ${eRw.dy}px) scale(${lerp(0.4, 1, tp) * eRw.scale}) rotate(${(1 - tp) * side * 14}deg)`, clipPath: eRw.clip, padding: "16px 20px", borderRadius: 16, background: alpha(t.bg, 0.88), border: `2px solid ${alpha(col, 0.75)}`, boxShadow: `0 0 34px ${alpha(col, 0.3)}`, textAlign: "center" }}>
              <div style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(rw.label, cw - 30, 28, 16), color: alpha(t.text, 0.85), whiteSpace: "nowrap" }}>{rw.label}</div>
              {rw.value && <div style={{ marginTop: 6, fontFamily: t.font.title, fontWeight: 900, fontSize: 40, color: col, whiteSpace: "nowrap" }}>{rw.value}</div>}
            </div>
          );
        })}
      </div>

      <Headline kicker={d.kicker ?? "高光时刻 · 结算"} title={d.title} frame={frame} />

      {d.tiers.map((_, i) => (
        <Sfx key={i} name="pop" at={Math.round(cues[i])} volume={0.28} />
      ))}
      <Sfx name="riser" at={chargeAt} volume={0.34} />
      <Sfx name="impact" at={burstAt} volume={0.45} />
      <Sfx name="success" at={revealAt} volume={0.42} />
      {rolls.map((r, i) => (
        <Sfx key={i} name="ding" at={Math.round(r)} volume={0.3} />
      ))}
    </>
  );
};

// 十六进制颜色插值：档位切换时主色/背景/光效要一起连续换色，不能整块跳色
function mixHex(a: string, b: string, k: number) {
  const p = (h: string) => {
    const s = h.replace("#", "");
    const f = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
    const n = parseInt(f, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const A = p(a);
  const B = p(b);
  const t = clamp(k);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

export const RewardBeat: CompDef<D> = {
  id: "reward-beat",
  name: "手游高光五拍结算",
  layer: "info",
  variants: 1,
  minSec: 5,
  maxSec: 18,
  tags: ["战绩", "结算", "升级", "段位", "开箱", "达成", "收益", "排名", "涨粉"],
  motion: { kind: "待机慢浮慢转 → 逐档换主色+段位名逐字砸入 → 吸粒子蓄力 → 爆闪+冲击环+彩带（只在这一拍） → 数字 easeOutQuint 滚动、奖励卡贝塞尔飞入两侧", energy: 3 },
  desc: "手游「高光时刻」节奏的结算镜头：中央六边形主体徽章待机微转，按配音逐档晋升（配色 蓝→青→紫→金，主色/背景光/光效一起连续换色，段位名逐字砸入），蓄力把四周粒子吸进主体，爆发一帧屏震 + 冲击环 + 彩带 + 速度线，随后数字从 from 滚到 to，奖励条目沿曲线飞入两侧停住",
  use: "晒一个带档位的成果/结算：这个月涨粉 12.8 万从青铜到传说、跑分从合格到史诗、收益结算清单、榜单名次晋升、开箱拿到了什么（badge 写主体，tiers 写晋升的几档，value 写那个数字）",
  schema,
  example: {
    title: "这个月的账号",
    kicker: "月度结算",
    badge: "月度战绩",
    tiers: [{ name: "普通" }, { name: "稀有" }, { name: "史诗" }, { name: "传说" }],
    value: { from: 0, to: 128000, unit: "粉", label: "当月净涨粉丝" },
    rewards: [{ label: "单条爆款", value: "320 万播放" }, { label: "商业合作", value: "3 单" }, { label: "完播率", value: "+12%" }],
  },
  C,
};
