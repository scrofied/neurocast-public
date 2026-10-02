import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const item = z.object({ text: z.string(), icon: z.string().optional(), at: z.number().optional().describe("它飞进来 / 被弹走的时刻") });

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  inside: z.array(item).min(1).max(5).describe("墙里喂进去的资料/数据/文件"),
  outside: z.array(item).min(1).max(4).describe("墙外想进去但进不去的东西"),
  label: z.string().optional().describe("墙上挂的牌子，如“封闭生态”"),
  bounceAt: z.number().optional().describe("开始尝试飞入并被弹回的时刻"),
  verdict: z.string().optional().describe("最后一句，如“数据不出门，也进不来”"),
  verdictAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const inCues = data.inside.map((x, i) => cueOr(x.at, 6 + i * Math.round(Math.max(10, (dur * 0.24) / data.inside.length))));
  const bounceAt = cueOr(data.bounceAt, inCues[data.inside.length - 1] + 18);
  const outCues = data.outside.map((x, i) => cueOr(x.at, bounceAt + i * Math.round(Math.max(14, (dur * 0.26) / data.outside.length))));
  const verdictAt = cueOr(data.verdictAt, outCues[data.outside.length - 1] + 24);
  const G = full ? H * 0.82 : H * 0.8;
  // the garden: a square wall in the middle-left, ground line, glowing interior
  const gw = full ? W * 0.4 : W * 0.5;
  const gh = full ? H * 0.4 : H * 0.3;
  const gx = full ? W * 0.16 : W * 0.26;
  const gy = G - gh;
  const wallT = full ? 26 : 15;
  const sh = hitShake(frame, outCues, full ? 10 : 5, 12, seed);
  const growK = easeOut(prog(frame, 0, 20));

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <GlowDefs id="wg" std={7} user />
          <line x1={0} y1={G} x2={W} y2={G} stroke={alpha(t.primary, 0.5)} strokeWidth={3} filter="url(#wg)" />
          {/* interior glow */}
          <rect x={gx} y={gy} width={gw} height={gh * growK} fill={alpha(t.primary, 0.07)} />
          {/* walls: grow up from the ground */}
          <rect x={gx - wallT} y={gy} width={wallT} height={gh + wallT} fill={alpha(t.text, 0.5)} />
          <rect x={gx + gw} y={gy} width={wallT} height={gh + wallT} fill={alpha(t.text, 0.5)} />
          <rect x={gx} y={gy - (full ? 0 : 0)} width={gw} height={wallT} fill={alpha(t.text, 0.5)} />
          {/* crenellations: the "walled garden" read */}
          {Array.from({ length: Math.max(4, Math.round(gw / (full ? 70 : 46))) }, (_, i) => {
            const count = Math.max(4, Math.round(gw / (full ? 70 : 46)));
            return (
              <rect key={i} x={gx + (i * gw) / count} y={gy - wallT * 0.9} width={(gw / count) * 0.55} height={wallT * 0.9} fill={alpha(t.text, 0.5)} />
            );
          })}
          {/* inside items sitting on the ground */}
          {data.inside.map((x, i) => {
            const c = inCues[i];
            if (frame < c) return null;
            // 资料原生从 0 弹入（rise 等价）；落点 sx 是算死的，位移走 SVG transform 属性（CSS transform 对图元不可靠）
            const ei = enterAt(frame, c, { fallback: "rise", dur: 14, from: 0 });
            const cols = Math.min(data.inside.length, 4);
            const sx = gx + (gw * (i + 0.5)) / cols;
            const ic = x.icon ?? guessIcon(x.text) ?? "doc";
            return (
              <g key={i} transform={`translate(${sx + ei.dx} ${gy + gh * 0.62 + ei.dy}) scale(${ei.scale})`}>
                <circle r={full ? 40 : 24} fill={alpha(t.primary, 0.18)} stroke={t.primary} strokeWidth={3} />
                <g transform={`translate(${full ? -22 : -13} ${full ? -22 : -13})`}>
                  <foreignObject width={full ? 44 : 26} height={full ? 44 : 26}>
                    <Icon name={ic} size={full ? 44 : 26} color={t.primary} />
                  </foreignObject>
                </g>
              </g>
            );
          })}
        </svg>
        {/* inside item labels */}
        {data.inside.map((x, i) => {
          const c = inCues[i];
          if (frame < c) return null;
          const cols = Math.min(data.inside.length, 4);
          const sx = gx + (gw * (i + 0.5)) / cols;
          // 纯淡入入场：吃 e.opacity + 位移/擦除（落点 sx 是算死的，不是 p 插值出来的）
          const el = enterAt(frame, c + 6, { fallback: "rise", dur: 12 });
          return (
            <div key={i} style={{ position: "absolute", left: sx, top: gy + gh * 0.62 + (full ? 50 : 30), width: full ? 220 : 120, transform: `translateX(-50%) translate(${el.dx}px, ${el.dy}px)`, clipPath: el.clip, textAlign: "center", fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(x.text, full ? 210 : 116, full ? 24 : 14, 10), color: t.primary, whiteSpace: "nowrap", opacity: el.opacity }}>{x.text}</div>
        );
      })}
        {/* outside items try to fly in and bounce off the wall */}
        {data.outside.map((x, i) => {
          const c = outCues[i];
          if (frame < c) return null;
          const p = prog(frame, c, 26);
          // fly toward the wall, then bounce back
          const app = easeInOut(clamp(p / 0.55));
          const back = easeOut(clamp((p - 0.55) / 0.45));
          const startX = W * (full ? 0.95 : 1.0);
          const hitX = gx + gw + wallT + (full ? 40 : 22);
          const xNow = lerp(startX, hitX, app) + back * (full ? 260 : 130);
          const yNow = H * (full ? 0.3 : 0.24) + i * (full ? 84 : 46);
          const ic = x.icon ?? guessIcon(x.text) ?? "globe";
          const hit = p > 0.5 && p < 0.72;
          return (
            <div key={i} style={{ position: "absolute", left: xNow, top: yNow, transform: "translate(-50%,-50%)", padding: `${full ? 10 : 5}px ${full ? 22 : 11}px`, borderRadius: 30, background: alpha(t.bad, 0.18), border: `2px solid ${t.bad}`, boxShadow: hit ? `0 0 34px ${alpha(t.bad, 0.9)}` : `0 0 14px ${alpha(t.bad, 0.4)}`, display: "flex", alignItems: "center", gap: full ? 10 : 5 }}>
              <Icon name={ic} size={full ? 26 : 14} color={t.bad} />
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(x.text, full ? 240 : 130, full ? 24 : 13, 10), color: t.text, whiteSpace: "nowrap" }}>{x.text}</span>
            </div>
          );
        })}
        {/* bounce sparks */}
        {data.outside.map((x, i) => {
          const c = outCues[i];
          const p = prog(frame, c, 26);
          if (p <= 0.48 || p >= 0.8) return null;
          const hitX = gx + gw + wallT + (full ? 40 : 22);
          const yNow = H * (full ? 0.3 : 0.24) + i * (full ? 84 : 46);
          const k = clamp((p - 0.48) / 0.32);
          return Array.from({ length: 7 }, (_, q) => {
            const a = (-80 + q * 26) * (Math.PI / 180);
            const r = easeOut(k) * (full ? 110 : 60);
            return <div key={q} style={{ position: "absolute", left: hitX + Math.cos(a) * r, top: yNow + Math.sin(a) * r, width: full ? 12 : 7, height: full ? 12 : 7, borderRadius: "50%", background: t.bad, opacity: 1 - k }} />;
          });
        })}
        {/* wall sign */}
        {data.label && (() => {
          // 牌子原生从 0 弹入（rise+from:0 等价）；挂点在墙上算死 → 位移可以叠加
          const es = enterAt(frame, 8, { fallback: "rise", dur: 14, from: 0 });
          return (
          <div style={{ position: "absolute", left: gx + gw / 2, top: gy - (full ? 96 : 54), transform: `translateX(-50%) translate(${es.dx}px, ${es.dy}px) scale(${es.scale})`, clipPath: es.clip, display: "flex", alignItems: "center", gap: full ? 12 : 6, padding: `${full ? 8 : 4}px ${full ? 24 : 12}px`, borderRadius: 12, background: alpha(t.gold, 0.16), border: `3px solid ${t.gold}`, boxShadow: `0 0 26px ${alpha(t.gold, 0.5)}` }}>
            <Icon name="lock" size={full ? 30 : 16} color={t.gold} />
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 34 : 17, color: t.gold, whiteSpace: "nowrap" }}>{data.label}</span>
          </div>
          );
        })()}
        {data.verdict && frame >= verdictAt && (() => {
          // 结论淡入 + 位移（贴地平线，rise 的下沉量小，不会出画）
          const ev = enterAt(frame, verdictAt, { fallback: "rise", dur: 12 });
          return (
          <div style={{ position: "absolute", left: 0, right: 0, top: G + (full ? 44 : 22), textAlign: "center", opacity: ev.opacity, transform: `translate(${ev.dx}px, ${ev.dy}px)`, clipPath: ev.clip, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.8, full ? 52 : 26, 15), color: t.text, whiteSpace: "nowrap", textShadow: "0 3px 0 #000" }}>{data.verdict}</div>
          );
        })()}
      </div>
      {inCues.map((c, i) => (
        <Sfx key={`i${i}`} name="pop" at={c} volume={0.28} />
      ))}
      {outCues.map((c, i) => (
        <Sfx key={`o${i}`} name="swish" at={c} volume={0.3} />
      ))}
      {data.verdict && <Sfx name="ding" at={verdictAt} volume={0.32} />}
    </>
  );
};

export const WalledGarden: CompDef<D> = {
  id: "walled-garden",
  name: "高墙花园（进得来，出不去）",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["封闭", "生态", "护城河", "锁死", "数据安全", "进不来"],
  motion: { kind: "围墙升起 → 资料落进墙内发光 → 墙外的东西撞墙弹回 + 火花", energy: 2 },
  desc: "一座带雉堞的高墙围出花园：墙里的资料一个个落进去、发着光；墙外想进来的东西从右边飞过来，撞在墙上被弹回去、溅出火花；墙上挂着锁牌，最后一句结论",
  use: "讲封闭生态 / 数据边界：某某是一座高墙花园、数据会不会漏出去、喂进去的资料只进不出、生态锁死的代价",
  panel: true,
  schema,
  example: { inside: [{ text: "内部文档" }, { text: "客户名单" }], outside: [{ text: "外部抓取" }, { text: "别家模型" }], label: "封闭生态", verdict: "进得来，出不去" },
  C,
};
