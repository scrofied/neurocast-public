import React from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const tier = z.object({
  name: z.string().describe("这一档的名字：公开 / 内部 / 涉密"),
  rule: z.string().optional().describe("这一档的做法，如“可以直接丢进去”"),
  result: z.string().optional().describe("后果，如“出事赔到倾家荡产”"),
  light: z.enum(["red", "yellow", "green"]).optional().describe("配一盏状态灯：红=别用 / 黄=能用 / 绿=推荐"),
  icon: z.string().optional(),
  at: z.number().optional().describe("这一档盖章出现的时刻（锚点）"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  tiers: z.array(tier).min(2).max(4).describe("2~4 档分类"),
  layout: z.enum(["row", "grid"]).optional().describe("row 横向一排（默认，1×N）；grid 四宫格 2×2"),
  stampLabel: z.string().optional().describe("每档盖在格子角上的章，如“档位”"),
  highlight: z.number().optional().describe("要重点警示的那一档序号（0 开始），会红框抖动"),
  note: z.string().optional().describe("底部一行结论"),
  noteAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const LAMPS = { red: "#ff5d6c", yellow: "#ffcf5c", green: "#3dffa8" } as const;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.tiers.length;
  const grid = data.layout === "grid" && n === 4;
  const cues = data.tiers.map((x, i) => cueOr(x.at, 10 + i * Math.round(Math.max(14, (dur * 0.7) / n))));
  const noteAt = cueOr(data.noteAt, cues[n - 1] + 22);
  const top = full ? H * 0.24 : H * 0.13;
  const bottom = full ? H * 0.74 : H * 0.78;
  const left = full ? W * 0.08 : W * 0.05;
  const right = full ? W * 0.92 : W * 0.95;
  const cols = grid ? 2 : n;
  const rows = grid ? 2 : 1;
  const cw = (right - left) / cols;
  const ch = (bottom - top) / rows;
  const gap = full ? 22 : 10;
  const hi = data.highlight;
  const hiAt = hi !== undefined ? cues[hi] + 12 : -1;
  const sh = hitShake(frame, [hiAt], full ? 9 : 5, 26, seed);

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* frame lines first: the grid is built before anything is stamped in */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {data.tiers.map((_, i) => {
            const c = grid ? i % 2 : i;
            const r = grid ? Math.floor(i / 2) : 0;
            const x = left + c * cw + gap / 2;
            const y = top + r * ch + gap / 2;
            const w = cw - gap;
            const h = ch - gap;
            const p = easeOut(prog(frame, i * 3, 14));
            const isHi = i === hi;
            const hiK = isHi && hiAt >= 0 ? clamp((frame - hiAt) / 10) : 0;
            const wob = isHi && frame >= hiAt && frame < hiAt + 26 ? Math.sin((frame - hiAt) * 0.9) * 3 * (1 - (frame - hiAt) / 26) : 0;
            return (
              <g key={i} transform={`translate(${wob} 0)`}>
                <rect x={x} y={y} width={w * p} height={h} rx={16} fill={alpha(isHi ? t.bad : t.primary, isHi ? 0.08 + hiK * 0.06 : 0.05)} stroke={isHi ? alpha(t.bad, 0.5 + 0.5 * hiK) : alpha(t.primary, 0.4)} strokeWidth={isHi ? 4 : 2} strokeDasharray={p < 1 ? `${w * 3} ${w * 3}` : undefined} />
              </g>
            );
          })}
        </svg>
        {data.tiers.map((x, i) => {
          const c = grid ? i % 2 : i;
          const r = grid ? Math.floor(i / 2) : 0;
          const bx = left + c * cw + gap / 2;
          const by = top + r * ch + gap / 2;
          const bw = cw - gap;
          const bh = ch - gap;
          if (frame < cues[i]) return null;
          const p = easeOutBack(prog(frame, cues[i], 14));
          const isHi = i === hi;
          const hiK = isHi && hiAt >= 0 ? clamp((frame - hiAt) / 10) : 0;
          const icon = x.icon ?? guessIcon(x.name) ?? "grid";
          const lamp = x.light ? LAMPS[x.light] : undefined;
          const nameFs = fitFont(x.name, bw * 0.8, full ? 56 : 30, 16);
          return (
            <div key={i} style={{ position: "absolute", left: bx, top: by, width: bw, height: bh, opacity: clamp(p * 1.4), transform: `scale(${0.92 + 0.08 * p})`, borderRadius: 16, background: isHi ? alpha(t.bad, 0.1 * hiK) : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: full ? 12 : 6, padding: full ? 20 : 10 }}>
              {/* stamp: the tier label slams in like a seal */}
              <div style={{ transform: `scale(${2 - p}) rotate(${lerp(-8, -2, p)}deg)`, display: "flex", alignItems: "center", gap: full ? 14 : 8, padding: `${full ? 8 : 4}px ${full ? 26 : 13}px`, border: `${full ? 5 : 3}px solid ${isHi ? t.bad : t.primary}`, borderRadius: 12, background: alpha(t.bg, 0.55), boxShadow: `0 0 24px ${alpha(isHi ? t.bad : t.primary, 0.45)}` }}>
                <Icon name={icon} size={nameFs * 0.85} color={isHi ? t.bad : t.primary} />
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: nameFs, color: isHi ? t.bad : t.text, whiteSpace: "nowrap", textShadow: `0 0 18px ${alpha(isHi ? t.bad : t.primary, 0.6)}` }}>{x.name}</span>
              </div>
              {/* lamp */}
              {lamp && (
                <div style={{ display: "flex", gap: 8, marginTop: full ? 4 : 2 }}>
                  {(["red", "yellow", "green"] as const).map((k) => (
                    <div key={k} style={{ width: full ? 26 : 14, height: full ? 26 : 14, borderRadius: "50%", background: k === x.light ? LAMPS[k] : alpha(t.text, 0.14), boxShadow: k === x.light ? `0 0 20px ${LAMPS[k]}` : undefined }} />
                  ))}
                </div>
              )}
              {/* rule + result fly in after the stamp */}
              {x.rule && (
                <div style={{ opacity: easeOut(prog(frame, cues[i] + 8, 12)), transform: `translateY(${(1 - easeOut(prog(frame, cues[i] + 8, 12))) * 14}px)`, fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(x.rule, bw * 0.86, full ? 32 : 18, 12), color: t.text, whiteSpace: "nowrap" }}>{x.rule}</div>
              )}
              {x.result && (
                <div style={{ opacity: easeOut(prog(frame, cues[i] + 16, 12)), fontFamily: t.font.body, fontWeight: 900, fontSize: fitFont(x.result, bw * 0.86, full ? 28 : 16, 11), color: t.bad, whiteSpace: "nowrap" }}>{x.result}</div>
              )}
              {data.stampLabel && (
                <div style={{ position: "absolute", right: full ? 16 : 8, top: full ? 12 : 6, fontFamily: t.font.mono, fontSize: full ? 16 : 11, letterSpacing: 3, color: t.dim }}>{data.stampLabel}</div>
              )}
            </div>
          );
        })}
        {data.note && frame >= noteAt && (
          <div style={{ position: "absolute", left: 0, right: 0, top: bottom + (full ? 24 : 12), textAlign: "center", opacity: easeOut(prog(frame, noteAt, 12)), fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.note, W * 0.8, full ? 44 : 22, 14), color: t.gold, whiteSpace: "nowrap", textShadow: "0 3px 0 #000" }}>{data.note}</div>
        )}
      </div>
      {cues.map((c, i) => (
        <Sfx key={i} name="stamp" at={c + 8} volume={0.32} />
      ))}
      {data.note && <Sfx name="ding" at={noteAt} volume={0.3} />}
    </>
  );
};

export const TierGrid: CompDef<D> = {
  id: "tier-grid",
  name: "分档格（含红黄绿灯）",
  layer: "info",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["三档", "分类", "红黄绿灯", "档位", "别用能用推荐", "四宫格"],
  motion: { kind: "空框先立 → 档位章砸下 → 做法/后果飞入 → 警示档抖动", energy: 2 },
  desc: "先画出 1×N 或 2×2 的空档格，随配音每档砸进一枚印章式的档位名（可配图标），随后这一档的做法和后果飞入；可给每档配红黄绿灯，也可指定末档红框抖动警示；底部一行结论",
  use: "把东西分成几档各说各的做法：公开/内部/涉密、红黄绿灯（别用/能用/推荐）、成本四档、报价分档结果的差别",
  panel: true,
  schema,
  example: { tiers: [{ name: "公开", rule: "随便丢给 AI", light: "green" }, { name: "内部", rule: "脱敏后再喂", light: "yellow" }, { name: "涉密", rule: "一个字都不能出", result: "出事赔到底朝天", light: "red" }], highlight: 2, note: "先分级，再决定给谁看" },
  C,
};
