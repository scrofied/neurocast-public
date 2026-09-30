import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, noise1, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  mine: z.string().default("我的深度干货").describe("你的那条内容"),
  mineNote: z.string().default("我觉得超重要").describe("贴在你那条上的心声"),
  cards: z.array(z.string()).default(["萌宠日常", "爆笑合集", "美食探店", "旅行 vlog"]).describe("被刷过去的别人的内容"),
  swipeAt: z.number().optional().describe("观众划走的时刻（锚点，如“划过去”）"),
  dwell: z.string().default("停留 0.3 秒"),
  label: z.string().optional().describe("手机下方的小字说明"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: bw, height: bh } = useBox();
  const full = bw >= 900;
  const top = full ? 200 : 20;
  const avail = bh - top - (data.label ? 70 : 30) - (full ? 110 : 0);
  const ph = Math.min(avail, bw * 1.9);
  const pw = ph * 0.5;
  const cx = bw / 2;
  const cy = top + ph / 2 + noise1(frame / 60, seed) * 4;
  const x0 = cx - pw / 2;
  const y0 = cy - ph / 2;
  const inset = pw * 0.035;
  const sw = pw - inset * 2;
  const sh = ph - inset * 2;
  const swipeAt = cueOr(data.swipeAt, dur * 0.45);
  const swipes = [swipeAt, swipeAt + 14, swipeAt + 26];
  const off = swipes.reduce((a, s) => a + easeInOut(clamp((frame - s) / 9)), 0);
  const enter = easeOutBack(prog(frame, 0, 18));
  const note = easeOutBack(prog(frame, 8, 16));
  const dwell = easeOutBack(prog(frame, swipeAt + 5, 14));
  const cards = [data.mine, ...data.cards];
  const hues = [t.primary, t.secondary, t.accent, t.primary, t.secondary];
  const fsTitle = fitFont(data.mine, sw * 0.62, sw * 0.12, 14);
  return (
    <>
      {full && <Heading kicker={data.kicker ?? "FEED"} title={data.title} frame={frame} width={bw} />}
      <div
        style={{
          position: "absolute",
          left: x0,
          top: y0,
          width: pw,
          height: ph,
          borderRadius: pw * 0.14,
          background: "#05070c",
          border: `2px solid ${alpha(t.dim, 0.55)}`,
          boxShadow: `0 0 50px ${alpha(t.primary, 0.18)}, 0 30px 60px rgba(0,0,0,.6)`,
          transform: `scale(${0.9 + 0.1 * enter})`,
          opacity: clamp(enter * 1.5),
        }}
      >
        <div style={{ position: "absolute", left: inset, top: inset, width: sw, height: sh, borderRadius: pw * 0.11, overflow: "hidden", background: t.bg }}>
          {cards.map((c, i) => {
            const y = (i - off) * sh;
            if (y > sh || y < -sh) return null;
            const mine = i === 0;
            const col = hues[i % hues.length];
            return (
              <div key={i} style={{ position: "absolute", left: 0, top: y, width: sw, height: sh, background: mine ? `linear-gradient(165deg, ${alpha(t.primary, 0.28)}, ${t.bg2} 60%, ${t.bg})` : `linear-gradient(165deg, ${alpha(col, 0.55)}, ${alpha(col, 0.12)} 60%, ${t.bg})` }}>
                <div style={{ position: "absolute", left: "50%", top: "40%", transform: "translate(-50%,-50%)", opacity: mine ? 0.25 : 0.5 }}>
                  <Icon name="play" size={sw * 0.22} color="#fff" fill={alpha("#ffffff", 0.3)} />
                </div>
                <div style={{ position: "absolute", left: sw * 0.07, bottom: sh * 0.12, width: sw * 0.7 }}>
                  <div style={{ fontFamily: t.font.body, fontSize: sw * 0.055, color: alpha("#ffffff", 0.75), marginBottom: 6 }}>{mine ? "@我" : `@创作者${i}`}</div>
                  <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: mine ? fsTitle : sw * 0.09, color: "#fff", lineHeight: 1.2, whiteSpace: "nowrap", textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>{c}</div>
                  <div style={{ marginTop: 10, height: sw * 0.025, width: "90%", borderRadius: 4, background: alpha("#ffffff", 0.2) }} />
                  <div style={{ marginTop: 6, height: sw * 0.025, width: "60%", borderRadius: 4, background: alpha("#ffffff", 0.14) }} />
                </div>
                <div style={{ position: "absolute", right: sw * 0.05, bottom: sh * 0.14, display: "flex", flexDirection: "column", alignItems: "center", gap: sh * 0.03 }}>
                  {(["heart", "chat", "send"] as const).map((ic, k) => (
                    <div key={ic} style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#fff", fontFamily: t.font.mono, fontSize: sw * 0.045 }}>
                      <Icon name={ic} size={sw * 0.1} color={!mine && k === 0 ? t.bad : "#fff"} fill={!mine && k === 0 ? t.bad : "none"} />
                      <span style={{ marginTop: 2 }}>{mine ? ["12", "3", "1"][k] : ["12.3w", "8.1k", "2.4k"][k]}</span>
                    </div>
                  ))}
                </div>
                {mine && (
                  <div
                    style={{
                      position: "absolute",
                      left: sw * 0.07,
                      top: sh * 0.16,
                      padding: `${sw * 0.02}px ${sw * 0.05}px`,
                      borderRadius: 999,
                      background: alpha(t.gold, 0.92),
                      color: t.bg,
                      fontFamily: t.font.body,
                      fontWeight: 800,
                      fontSize: sw * 0.058,
                      transform: `rotate(-6deg) scale(${note})`,
                      transformOrigin: "left center",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: `0 0 20px ${alpha(t.gold, 0.6)}`,
                    }}
                  >
                    <Icon name="heart" size={sw * 0.06} color={t.bg} fill={t.bg} />
                    {data.mineNote}
                  </div>
                )}
              </div>
            );
          })}
          {/* swipe gesture: a finger dot flicks upward on every swipe */}
          {swipes.map((s, i) => {
            const p = clamp((frame - s + 4) / 12);
            if (p <= 0 || p >= 1) return null;
            const y = sh * (0.78 - 0.55 * easeOut(p));
            return (
              <React.Fragment key={i}>
                <div style={{ position: "absolute", left: sw / 2 - 18, top: y - 18, width: 36, height: 36, borderRadius: 18, background: alpha("#ffffff", 0.85 * (1 - p)), boxShadow: `0 0 20px ${alpha("#ffffff", 0.8)}` }} />
                <div style={{ position: "absolute", left: sw / 2 - 5, top: y + 10, width: 10, height: sh * 0.2 * (1 - p), borderRadius: 5, background: `linear-gradient(180deg, ${alpha("#ffffff", 0.6)}, transparent)` }} />
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: pw / 2 - pw * 0.13, top: inset + 6, width: pw * 0.26, height: pw * 0.05, borderRadius: 99, background: "#000" }} />
      </div>
      {frame >= swipeAt + 5 && (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: y0 + ph - 14,
            transform: `translate(-50%, -50%) scale(${dwell})`,
            padding: full ? "12px 26px" : "8px 18px",
            borderRadius: 999,
            background: alpha(t.bad, 0.18),
            border: `2px solid ${t.bad}`,
            boxShadow: `0 0 30px ${alpha(t.bad, 0.55)}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: t.font.body,
            fontWeight: 900,
            fontSize: full ? 38 : 26,
            color: t.bad,
            whiteSpace: "nowrap",
            backdropFilter: "blur(8px)",
          }}
        >
          <Icon name="clock" size={full ? 34 : 24} color={t.bad} />
          {data.dwell}
        </div>
      )}
      {data.label && (
        <div style={{ position: "absolute", left: 0, right: 0, top: y0 + ph + (full ? 50 : 34), textAlign: "center", fontFamily: t.font.body, fontWeight: 700, fontSize: full ? 30 : 20, color: t.dim, opacity: easeOut(prog(frame, 12, 16)) }}>{data.label}</div>
      )}
      {swipes.map((s, i) => (
        <Sfx key={i} name="swipe" at={s} volume={0.3} />
      ))}
      <Sfx name="pop" at={swipeAt + 5} volume={0.35} />
    </>
  );
};

export const PhoneFeed: CompDef<D> = {
  id: "phone-feed",
  name: "手机信息流 · 被划走",
  layer: "story",
  variants: 1,
  minSec: 3,
  maxSec: 12,
  tags: ["划走", "停留", "完播", "信息流", "刷到", "没人看"],
  desc: "一部手机里是你的内容（贴着“我觉得超重要”），观众手指一划连刷三条，红色徽章弹出“停留 0.3 秒”",
  use: "观众不感兴趣 / 划走 / 停留时长短 / 完播率低 / 自嗨内容没人看",
  panel: true,
  schema,
  example: { mine: "我的深度干货", mineNote: "我觉得超重要", cards: ["萌宠日常", "爆笑合集", "美食探店", "旅行 vlog"], swipeAt: 70, dwell: "停留 0.3 秒", label: "观众的真实反应" },
  C,
};
