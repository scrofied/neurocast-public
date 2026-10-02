import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake, StampBox } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, fmtNum, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const row = z.object({
  name: z.string(),
  amount: z.number(),
  hidden: z.boolean().optional().describe("single 模式：隐藏项，先盖着，揭开时红字翻出、总额跳变"),
  same: z.boolean().optional().describe("dual 模式：两边相同的项（会变灰，如“努力”“运气”）"),
  at: z.number().optional().describe("这一行出现的时刻（锚点）"),
});
const book = z.object({ name: z.string(), items: z.array(row).min(1).max(7) });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  mode: z.enum(["single", "dual"]).default("single").describe("single = 一张账纸逐行累加；dual = 两本账并排逐项对比"),
  unit: z.string().default("元").describe("金额单位"),
  prefix: z.string().default("¥").describe("金额前缀"),
  items: z.array(row).max(8).default([]).describe("single 模式的行项"),
  left: book.optional().describe("dual 模式左边那本"),
  right: book.optional().describe("dual 模式右边那本"),
  revealAt: z.number().optional().describe("single：隐藏项翻出的时刻；dual：相同项变灰、差异跳红的时刻（锚点）"),
  verdict: z.string().optional().describe("最后盖下的结论，如“差在系统”“一年够吃 3 顿火锅”"),
  verdictAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

// the paper strip: receipt style, perforated top, rows printed as it scrolls down
const Paper: React.FC<{ x: number; y: number; w: number; h: number; name: string; children: React.ReactNode; tone?: string }> = ({ x, y, w, h, name, children, tone }) => {
  const t = useTheme();
  const zig = Array.from({ length: Math.ceil(w / 22) + 1 }, (_, i) => `${i * 22},0 ${i * 22 + 11},10`).join(" ");
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, #f2f4ee, #dfe3da)`, borderRadius: 4, boxShadow: `0 20px 60px rgba(0,0,0,.55), 0 0 0 3px ${alpha(tone ?? t.primary, 0.5)}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 74, borderBottom: "3px dashed #9aa396", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(name, w - 40, 40, 18), color: "#1d2420", whiteSpace: "nowrap" }}>{name}</div>
        {children}
      </div>
      <svg width={w} height={10} style={{ position: "absolute", left: 0, top: h - 1 }}>
        <polyline points={zig} fill="#dfe3da" stroke="none" />
      </svg>
    </div>
  );
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const ink = "#1d2420";
  const money = (v: number) => `${data.prefix}${fmtNum(v, 0)}`;

  if (data.mode === "dual" && data.left && data.right) {
    const L = data.left;
    const R = data.right;
    const n = Math.max(L.items.length, R.items.length);
    const cues = Array.from({ length: n }, (_, i) => cueOr(L.items[i]?.at ?? R.items[i]?.at, 10 + i * 14));
    const revealAt = Math.max(cues[n - 1] + 14, cueOr(data.revealAt, cues[n - 1] + 26));
    const verdictAt = Math.max(revealAt + 16, cueOr(data.verdictAt, revealAt + 34));
    const pw = full ? Math.min(560, W * 0.3) : W * 0.46;
    const rh = full ? Math.min(74, (H * 0.44) / n) : 40;
    const ph = 90 + n * rh + 110;
    const pyTop = full ? H * 0.15 : H * 0.08;
    const gap = full ? W * 0.12 : W * 0.04;
    const lx = W / 2 - gap / 2 - pw;
    const rx = W / 2 + gap / 2;
    const open = easeOut(prog(frame, 0, 16));
    const rv = easeOut(prog(frame, revealAt, 14));
    const sumL = L.items.reduce((a, b) => a + b.amount, 0);
    const sumR = R.items.reduce((a, b) => a + b.amount, 0);
    const pull = (y0: number) => lerp(y0 - ph, y0, open);
    const rowsOf = (b: typeof L, x: number, other: typeof L) =>
      b.items.map((it, i) => {
        if (frame < cues[i]) return null;
        const e = enterAt(frame, cues[i], { fallback: "slide-r", dur: 10 });
        const o = other.items[i];
        const same = it.same || (o && o.amount === it.amount && o.name === it.name);
        const ratio = o && o.amount ? it.amount / o.amount : 0;
        const big = !same && (ratio >= 1.5 || (!!o && o.amount === 0 && it.amount > 0));
        const fs = rh * 0.42;
        return (
          <div key={i} style={{ position: "absolute", left: 22, right: 22, top: 90 + i * rh, height: rh, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dotted #9aa396", opacity: (0.3 + 0.7 * e.p) * (same ? 1 - rv * 0.6 : 1), clipPath: e.clip ?? `inset(0 ${(1 - e.p) * 100}% 0 0)` }}>
            <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(it.name, pw * 0.48, fs, 12), color: same && rv > 0.5 ? "#8b938a" : ink, whiteSpace: "nowrap", textDecoration: same && rv > 0.5 ? "line-through" : undefined }}>{it.name}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {big && rv > 0 && <span style={{ transform: `scale(${easeOutBack(prog(frame, revealAt + 4, 12))})`, padding: "2px 10px", borderRadius: 8, background: t.bad, color: "#fff", fontFamily: t.font.mono, fontWeight: 900, fontSize: fs * 0.8 }}>{o && o.amount === 0 ? "0→有" : `×${+ratio.toFixed(ratio >= 10 ? 0 : 1)}`}</span>}
              <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: fs, color: big && rv > 0.3 ? "#c8182c" : same && rv > 0.5 ? "#8b938a" : ink }}>{money(it.amount)}</span>
            </span>
          </div>
        );
      });
    const totalRow = (sum: number, other: number) => (
      <div style={{ position: "absolute", left: 22, right: 22, top: 90 + n * rh + 20, display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `3px solid ${ink}`, paddingTop: 12, opacity: enterAt(frame, cues[n - 1] + 8, { fallback: "slide-r", dur: 10 }).p }}>
        <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: rh * 0.45, color: ink }}>合计</span>
        <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: rh * 0.62, color: sum > other && rv > 0.3 ? "#c8182c" : ink }}>{money(Math.round(sum * clamp(prog(frame, cues[n - 1] + 8, 16))))}</span>
      </div>
    );
    // alignment beams between matching rows at reveal
    return (
      <>
        {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
        <Paper x={lx} y={pull(pyTop)} w={pw} h={ph} name={L.name} tone={t.dim}>
          {rowsOf(L, lx, R)}
          {totalRow(sumL, sumR)}
        </Paper>
        <Paper x={rx} y={pull(pyTop)} w={pw} h={ph} name={R.name} tone={t.gold}>
          {rowsOf(R, rx, L)}
          {totalRow(sumR, sumL)}
        </Paper>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {Array.from({ length: n }, (_, i) => {
            if (frame < revealAt) return null;
            const same = L.items[i] && R.items[i] && (L.items[i].same || R.items[i].same || L.items[i].amount === R.items[i].amount);
            const y = pull(pyTop) + 90 + i * rh + rh / 2;
            const k = easeOut(prog(frame, revealAt + i * 2, 10));
            const c = same ? t.dim : t.bad;
            return <line key={i} x1={lx + pw} y1={y} x2={lerp(lx + pw, rx, k)} y2={y} stroke={c} strokeWidth={same ? 2 : 5} strokeDasharray={same ? "6 8" : undefined} style={{ filter: same ? undefined : `drop-shadow(0 0 8px ${t.bad})` }} />;
          })}
        </svg>
        {data.verdict && <StampBox frame={frame} at={verdictAt} text={data.verdict} color={t.bad} x={W / 2} y={Math.min(H - 190, pull(pyTop) + ph + (full ? 64 : 40))} size={full ? 72 : 36} maxW={W * 0.7} />}
        {cues.map((c, i) => (
          <Sfx key={i} name="tick" at={c} volume={0.26} />
        ))}
        <Sfx name="swish" at={0} volume={0.25} />
        <Sfx name="glitch" at={revealAt} volume={0.3} />
        {data.verdict && <Sfx name="stamp" at={verdictAt} volume={0.5} />}
      </>
    );
  }

  // ── single: a receipt pulled out of the top, adding up as it goes ──
  const items = data.items.length ? data.items : [{ name: "示例", amount: 100 }];
  const n = items.length;
  const cues: number[] = [];
  items.forEach((it, i) => cues.push(Math.max(i ? cues[i - 1] + 5 : 8, cueOr(it.at, 12 + i * 14))));
  const hid = items.findIndex((it) => it.hidden);
  const revealAt = hid >= 0 ? Math.max(cues[n - 1] + 10, cueOr(data.revealAt, cues[n - 1] + 26)) : dur + 999;
  const verdictAt = Math.max((hid >= 0 ? revealAt : cues[n - 1]) + 18, cueOr(data.verdictAt, (hid >= 0 ? revealAt : cues[n - 1]) + 32));
  const pw = full ? Math.min(620, W * 0.34) : W * 0.8;
  const rh = full ? Math.min(80, (H * 0.5) / n) : 38;
  const ph = 90 + n * rh + 120;
  const x = full ? W * 0.3 - pw / 2 + W * 0.05 : W / 2 - pw / 2;
  const topY = full ? H * 0.17 : H * 0.06;
  // the paper extends downward as rows are printed
  const printed = items.filter((_, i) => frame >= cues[i]).length;
  const visH = 90 + printed * rh + (printed === n ? 120 : 20);
  const lastP = printed ? easeOut(prog(frame, cues[printed - 1], 8)) : 0;
  const curH = lerp(90 + Math.max(0, printed - 1) * rh + 20, visH, lastP);
  const running = items.reduce((a, it, i) => (frame >= cues[i] && (!it.hidden || frame >= revealAt) ? a + it.amount : a), 0);
  const shownTotal = items.reduce((a, it) => a + (it.hidden ? 0 : it.amount), 0);
  const rv = easeOut(prog(frame, revealAt, 12));
  const sh = hitShake(frame, [revealAt + 2], 18, 12, seed);
  const bigTotal = frame >= revealAt ? Math.round(lerp(shownTotal, shownTotal + (items[hid]?.amount ?? 0), easeInOut(prog(frame, revealAt + 4, 18)))) : running;
  const jumpK = frame >= revealAt ? clamp(1 - (frame - revealAt - 20) / 20) : 0;
  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* printer slot */}
        <div style={{ position: "absolute", left: x - 30, top: topY - 26, width: pw + 60, height: 34, borderRadius: 12, background: alpha(t.bg2, 0.95), border: `3px solid ${t.primary}`, boxShadow: `0 0 20px ${alpha(t.primary, 0.5)}` }} />
        <div style={{ position: "absolute", left: x, top: topY, width: pw, height: curH + 12, overflow: "hidden" }}>
          <Paper x={0} y={0} w={pw} h={curH} name="账单">
            {items.map((it, i) => {
              if (frame < cues[i]) return null;
              const covered = it.hidden && frame < revealAt;
              const fs = rh * 0.42;
              return (
                <div key={i} style={{ position: "absolute", left: 24, right: 24, top: 90 + i * rh, height: rh, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dotted #9aa396" }}>
                  <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(it.name, pw * 0.55, fs, 12), color: it.hidden && !covered ? "#c8182c" : ink, whiteSpace: "nowrap" }}>{it.name}</span>
                  <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: fs, color: it.hidden && !covered ? "#c8182c" : ink }}>{money(it.amount)}</span>
                  {it.hidden && (
                    // tape over the hidden line, torn off at reveal
                    <div style={{ position: "absolute", left: -8, right: -8, top: 6, bottom: 6, background: "repeating-linear-gradient(45deg, #2a2f2c 0 16px, #3a403c 16px 32px)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.mono, fontWeight: 900, fontSize: fs * 0.7, color: "#c9cfc6", letterSpacing: 6, transformOrigin: "100% 0%", transform: `rotate(${rv * -28}deg) translate(${rv * 80}px, ${-rv * 60}px)`, opacity: 1 - rv }}>
                      ? ? ?
                    </div>
                  )}
                </div>
              );
            })}
            {printed === n && (
              <div style={{ position: "absolute", left: 24, right: 24, top: 90 + n * rh + 18, borderTop: `3px solid ${ink}`, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: rh * 0.48, color: ink }}>合计</span>
                <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: rh * 0.66, color: rv > 0 ? "#c8182c" : ink }}>{money(bigTotal)}</span>
              </div>
            )}
          </Paper>
        </div>
        {/* running total, big, on the right */}
        {full && frame >= cues[0] && (
          <div style={{ position: "absolute", left: x + pw + W * 0.07, top: H * 0.34, fontFamily: t.font.title, fontWeight: 900, color: rv > 0 ? t.bad : t.text }}>
            <div style={{ fontSize: 34, color: t.dim }}>一共</div>
            <div style={{ fontSize: fitFont(money(bigTotal), W * 0.4, 170, 60), lineHeight: 1.05, fontVariantNumeric: "tabular-nums", transform: `scale(${1 + jumpK * 0.12})`, transformOrigin: "0 50%", textShadow: `0 0 ${30 * jumpK}px ${t.bad}` }}>{money(bigTotal)}</div>
            <div style={{ fontSize: 34, color: t.dim }}>{data.unit}</div>
            {hid >= 0 && frame >= revealAt + 6 && <div style={{ marginTop: 14, fontSize: 40, color: t.bad, opacity: easeOut(prog(frame, revealAt + 6, 10)) }}>+ {items[hid].name} {money(items[hid].amount)}</div>}
          </div>
        )}
        {data.verdict && <StampBox frame={frame} at={verdictAt} text={data.verdict} color={t.bad} x={full ? x + pw + W * 0.07 : W / 2} y={full ? H * 0.78 : H * 0.88} size={full ? 72 : 34} maxW={full ? W * 0.4 : W * 0.8} anchor={full ? "left" : "center"} />}
      </div>
      {cues.map((c, i) => (
        <Sfx key={i} name="tick" at={c} volume={0.28} />
      ))}
      {hid >= 0 && <Sfx name="glitch" at={revealAt} volume={0.35} />}
      {hid >= 0 && <Sfx name="impact" at={revealAt + 2} volume={0.35} />}
      {data.verdict && <Sfx name="stamp" at={verdictAt} volume={0.5} />}
    </>
  );
};

export const OpenLedger: CompDef<D> = {
  id: "open-ledger",
  name: "摊开算账（单账累加 / 双账对比）",
  layer: "info",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["算账", "账本", "账单", "一年花", "成本", "明细", "两份账单", "差在哪"],
  motion: { kind: "小票从打印口逐行吐出 + 合计滚动 + 胶带撕开翻红 / 两本账逐行对齐连线", energy: 2 },
  desc: "single：一张小票从顶部打印口逐行吐出，每行一个名目和金额，右侧大字合计跟着滚；隐藏项先被黑黄胶带盖着，揭开时胶带撕飞、红字翻出、总额跳变并震一下。dual：两本账并排拉下，行项逐条对齐，揭晓时相同项变灰划线、差异项跳红并标出倍数，中间连线，最后盖结论章",
  use: "“这笔账摊开算给你看”：一年订阅费算下来还没一顿火锅多、按次抽卡×100 才看懂多贵、隐藏成本让利润腰斩；dual：时薪账本 vs 资产账本、两份收入账单排除努力和运气后差在系统",
  panel: true,
  schema,
  example: {
    mode: "single",
    items: [{ name: "工具订阅", amount: 240 }, { name: "素材会员", amount: 180 }, { name: "课程", amount: 399 }, { name: "按次调用 ×100", amount: 1200, hidden: true }],
    verdict: "隐藏项才是大头",
  },
  C,
};
