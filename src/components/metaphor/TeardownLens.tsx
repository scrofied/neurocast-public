import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const layer = z.object({
  name: z.string().describe("这一层的名字：外壳 / 渠道 / 成本 / 利润"),
  value: z.string().optional().describe("这一层贴的数值或价签：¥199 / 60% / 全被吃掉"),
  icon: z.string().optional(),
  at: z.number().optional().describe("这一层爆开并贴标签的时刻（锚点）"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  object: z.string().describe("被拆开的东西：一家店 / 一个行业 / 一份报价 / 这个项目"),
  objectIcon: z.string().optional(),
  layers: z.array(layer).min(2).max(5).describe("从外到内的分层，逐层剥离"),
  core: z.string().optional().describe("剥到底露出来的骨架/内核，如“真实利润”“保本线”"),
  coreAt: z.number().optional(),
  explodeAt: z.number().optional().describe("整体炸开的时刻"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.layers.length;
  const expl = cueOr(data.explodeAt, Math.round(dur * 0.12));
  const cues = data.layers.map((l, i) => Math.max(expl + 6, cueOr(l.at, expl + 14 + i * Math.round(Math.max(16, (dur * 0.6) / n)))));
  const coreAt = cueOr(data.coreAt, cues[n - 1] + 24);
  const cx = W * (full ? 0.42 : 0.5);
  const cy = H * (full ? 0.52 : 0.46);
  const boxW = full ? W * 0.3 : W * 0.42;
  const boxH = full ? H * 0.34 : H * 0.24;
  // explode: each layer separates along a diagonal, easing out
  const ex = easeInOut(prog(frame, expl, 22));
  const icon = data.objectIcon ?? guessIcon(data.object) ?? "box";
  const sh = hitShake(frame, [expl, coreAt], full ? 10 : 5, 12, seed);
  // skeleton glow once everything is peeled
  const bare = frame >= cues[n - 1] + 14;
  // 骨架/内核文字在 coreAt 出现：原生是 easeOutBack 从 0 弹入（rise 等价）
  const eCore = enterAt(frame, coreAt, { fallback: "rise", dur: 16, from: 0 });
  // a scan line sweeps down as layers come off
  const scanY = lerp(cy - boxH, cy + boxH, clamp((frame - expl) / Math.max(20, cues[n - 1] - expl)));

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="tdLayer" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={alpha(t.primary, 0.5)} />
              <stop offset="1" stopColor={alpha(t.secondary, 0.28)} />
            </linearGradient>
          </defs>
          {/* layers: back layers first so the front one overlaps */}
          {data.layers.map((l, i) => {
            // i = 0 is the outermost, drawn last (nearest to camera)
            const depth = n - 1 - i;
            const off = depth * (full ? 46 : 26);
            const sep = off * ex;
            const y = cy + off * 0.35 - sep * 1.5;
            const x = cx - off * 0.2 + sep * 0.7;
            const w = boxW * (1 - depth * 0.06);
            const h = boxH * (1 - depth * 0.06);
            const gone = frame >= cues[i] + 12;
            const fly = easeOut(prog(frame, cues[i], 20));
            // once labelled, the layer lifts away up-left and fades
            const lx = x - fly * (full ? 300 : 150);
            const ly = y - fly * (full ? 190 : 100);
            const vis = gone ? 1 - clamp(prog(frame, cues[i] + 20, 16)) : 1;
            if (vis <= 0.01) return null;
            const c = [t.primary, t.secondary, t.accent, t.gold][i % 4];
            return (
              <g key={i} opacity={vis} transform={`translate(${lx - x} ${ly - y})`}>
                <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={14} fill={bare ? alpha(c, 0.06) : `url(#tdLayer)`} stroke={alpha(c, 0.75)} strokeWidth={2.5} />
                {/* shell hatching so each layer reads as a plate */}
                {Array.from({ length: 5 }, (_, k) => (
                  <line key={k} x1={x - w / 2 + 12} y1={y - h / 2 + 16 + k * (h / 6)} x2={x + w / 2 - 12} y2={y - h / 2 + 16 + k * (h / 6)} stroke={alpha(c, 0.18)} strokeWidth={1.5} />
                ))}
              </g>
            );
          })}
          {/* scan line */}
          {frame >= expl && frame < cues[n - 1] + 8 && (
            <line x1={cx - boxW * 0.7} y1={scanY} x2={cx + boxW * 0.7} y2={scanY} stroke={t.accent} strokeWidth={3} style={{ filter: `drop-shadow(0 0 10px ${t.accent})` }} />
          )}
          {/* core skeleton */}
          {bare && (
            <g opacity={clamp(eCore.p)}>
              {[-1, 1].map((s) => (
                <line key={s} x1={cx + s * boxW * 0.22} y1={cy - boxH * 0.4} x2={cx + s * boxW * 0.22} y2={cy + boxH * 0.4} stroke={t.gold} strokeWidth={5} style={{ filter: `drop-shadow(0 0 14px ${t.gold})` }} />
              ))}
              <line x1={cx - boxW * 0.22} y1={cy} x2={cx + boxW * 0.22} y2={cy} stroke={t.gold} strokeWidth={5} style={{ filter: `drop-shadow(0 0 14px ${t.gold})` }} />
            </g>
          )}
        </svg>
        {/* object icon + name in the middle */}
        <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) scale(${1 - ex * 0.3})`, opacity: 1 - ex * 0.5, textAlign: "center" }}>
          <Icon name={icon} size={boxH * 0.5} color={t.text} />
          <div style={{ marginTop: 10, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.object, boxW, full ? 40 : 22), color: t.text, whiteSpace: "nowrap" }}>{data.object}</div>
        </div>
        {/* layer labels fly to the side as each layer is peeled */}
        {data.layers.map((l, i) => {
          const c = cues[i];
          if (frame < c) return null;
          // 标签原生从右侧 60px 处弹入 + scale 0→1：用 e.p 保留这段位移，e.scale 接管缩放
          const el = enterAt(frame, c, { fallback: "rise", dur: 14, from: 0 });
          const p = el.p;
          const rowH = full ? 84 : 46;
          const stack = H * (full ? 0.26 : 0.16) + i * (rowH + 12);
          const lx = W * (full ? 0.72 : 0.5);
          const col = [t.primary, t.secondary, t.accent, t.gold][i % 4];
          const ic = l.icon ?? guessIcon(l.name);
          return (
            <div key={i} style={{ position: "absolute", left: lx, top: stack, transform: `translateX(${(1 - p) * 60}px) scale(${el.scale})`, transformOrigin: "0 50%", opacity: el.opacity, width: W * (full ? 0.24 : 0.46), height: rowH, borderRadius: 14, background: alpha(t.bg, 0.86), border: `2px solid ${col}`, boxShadow: `0 0 20px ${alpha(col, 0.4)}`, display: "flex", alignItems: "center", gap: full ? 14 : 8, padding: `0 ${full ? 20 : 10}px` }}>
              {ic && <Icon name={ic} size={rowH * 0.44} color={col} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(l.name, W * (full ? 0.16 : 0.3), rowH * 0.4, 12), color: t.text, whiteSpace: "nowrap" }}>{l.name}</div>
                {l.value && <div style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: fitFont(l.value, W * (full ? 0.16 : 0.3), rowH * 0.34, 11), color: col, whiteSpace: "nowrap" }}>{l.value}</div>}
              </div>
            </div>
          );
        })}
        {data.core && frame >= coreAt && (
          <div style={{ position: "absolute", left: cx, top: cy + boxH * 0.62, transform: `translate(-50%, 0) translate(${eCore.dx}px, ${eCore.dy}px) scale(${eCore.scale})`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.core, W * 0.3, full ? 52 : 26, 14), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 24px ${alpha(t.gold, 0.7)}, 0 3px 0 #000` }}>{data.core}</div>
        )}
      </div>
      <Sfx name="whoosh" at={expl} volume={0.3} />
      {cues.map((c, i) => (
        <Sfx key={i} name="swipe" at={c} volume={0.28} />
      ))}
      {data.core && <Sfx name="ding" at={coreAt} volume={0.35} />}
    </>
  );
};

export const TeardownLens: CompDef<D> = {
  id: "teardown-lens",
  name: "拆解透视（一层层扒开）",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["拆解", "扒开", "底朝天", "拆开看", "内核", "分层"],
  motion: { kind: "整体炸开分层 → 逐层飞走并贴标签 → 露出发光骨架", energy: 3 },
  desc: "一个东西（店铺/行业/报价/项目）从中间炸开成几层悬空的板，一条扫描线扫过，随配音每层飞向右侧并贴上它的名字和数值（外壳/渠道/成本/利润 → ¥199 / 60%）；全部剥完后露出中间发光的骨架，标出内核",
  use: "拆解一个东西看里面：把一个行业的真实利润扒个底朝天、拆开报价看哪块被吃掉、逆向拆解同行的保本底牌、拆开这个项目看它靠什么赚钱",
  panel: true,
  schema,
  example: { object: "一份 199 的课", objectIcon: "box", layers: [{ name: "渠道抽成", value: "¥60" }, { name: "投放成本", value: "¥70" }, { name: "交付成本", value: "¥40" }], core: "到手 ¥29" },
  C,
};
