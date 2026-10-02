import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog, rng } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  channel: z.string().default("客户咨询").describe("App / 后台的名字，如“微信”“阿里询盘”“抖音私信”"),
  messages: z.array(z.string()).min(3).max(10).default(["在吗？", "多少钱", "能便宜点吗", "发货多久", "有现货吗", "还在吗？？"]).describe("涌进来的消息（循环使用）"),
  peak: z.number().default(99).describe("未读数冲到多少（≥99 显示 99+）"),
  floodAt: z.number().optional().describe("消息开始涌入（锚点）"),
  peakAt: z.number().optional().describe("未读冲到峰值（锚点，如“几百个”）"),
  responder: z.string().optional().describe("接手的是谁，如“AI 客服”；不给 = 只演被淹没"),
  respondAt: z.number().optional().describe("接手开始的时刻（锚点）"),
  reply: z.string().default("已回复").describe("处理完的气泡变成的字"),
  meter: z.string().optional().describe("承接率标签，如“承接率”"),
  meterTo: z.number().default(98).describe("承接率最终百分比"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const floodAt = cueOr(data.floodAt, 8);
  const has = !!data.responder;
  const respondAt = has ? cueOr(data.respondAt, dur * 0.55) : dur + 999;
  const peakAt = Math.min(cueOr(data.peakAt, Math.min(respondAt - 6, floodAt + (respondAt < dur ? respondAt - floodAt : dur * 0.8) * 0.9)), respondAt - 2);
  // phone geometry
  const ph = full ? H * 0.74 : H * 0.8;
  const pw = ph * 0.49;
  const px = full ? (has ? W * 0.36 : W * 0.5) - pw / 2 : W / 2 - pw / 2;
  const py = full ? H * 0.17 : H * 0.12;
  const rowH = pw * 0.2;
  // arrivals accelerate: message i arrives at floodAt + span * (i/M)^0.55
  const M = 26;
  const span = Math.max(20, peakAt - floodAt);
  const arrive = (i: number) => floodAt + span * Math.pow(i / M, 0.6);
  const arrived = Array.from({ length: M }, (_, i) => i).filter((i) => frame >= arrive(i)).length;
  const r = useMemo(() => {
    const g = rng(seed + 5);
    return Array.from({ length: M }, () => ({ w: 0.45 + g() * 0.4, name: Math.floor(g() * 900 + 100), dot: g() }));
  }, [seed]);
  // unread badge
  const unreadUp = Math.round(data.peak * Math.pow(clamp((frame - floodAt) / span), 1.3));
  // responder handles the visible top rows one by one, then the counter drains
  const handled = has ? Math.max(0, Math.floor((frame - respondAt) / 7)) : 0;
  const drainK = has ? easeInOut(prog(frame, respondAt, Math.max(30, dur - respondAt - 20))) : 0;
  const unread = has && frame >= respondAt ? Math.round(lerp(data.peak, 0, drainK)) : unreadUp;
  const badge = unread >= 99 ? "99+" : String(unread);
  const hot = unread >= 99;
  const sh = hitShake(frame, hot && frame < respondAt ? [Math.floor(frame / 6) * 6] : [], 5, 6, seed);
  // rows visible in the phone list: newest first
  const listTop = py + ph * 0.19;
  const listH = ph * 0.76;
  const maxRows = Math.floor(listH / rowH);
  const aiX = full ? W * 0.72 : W * 0.5;
  const aiY = full ? H * 0.52 : H * 0.9;
  // AI 接手圆原生从 0 回弹入画（rise 等价）；角标首现弹跳、承接率面板淡入同理
  const eAi = enterAt(frame, respondAt - 6, { fallback: "rise", dur: 16, from: 0 });
  const eMeter = enterAt(frame, respondAt + 10, { fallback: "rise", dur: 12 });
  const eBadge = enterAt(frame, floodAt, { fallback: "rise", dur: 10 });
  const meterK = has ? easeOut(prog(frame, respondAt + 10, Math.max(30, dur - respondAt - 26))) : 0;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* phone */}
        <div style={{ position: "absolute", left: px, top: py, width: pw, height: ph, borderRadius: pw * 0.12, border: `${Math.max(5, pw * 0.025)}px solid ${alpha(t.text, 0.8)}`, background: alpha(t.bg, 0.95), overflow: "hidden", boxShadow: `0 0 ${hot && !has ? 60 : 30}px ${alpha(hot && frame < respondAt ? t.bad : t.primary, 0.4)}` }}>
          {/* header */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: ph * 0.16, background: alpha(t.primary, 0.14), borderBottom: `2px solid ${alpha(t.primary, 0.3)}`, display: "flex", alignItems: "flex-end", padding: `0 ${pw * 0.07}px ${ph * 0.025}px` }}>
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.channel, pw * 0.6, pw * 0.085, 14), color: t.text, whiteSpace: "nowrap" }}>{data.channel}</span>
          </div>
          {/* rows (clipped list) */}
          <div style={{ position: "absolute", left: 0, right: 0, top: listTop - py, height: listH, overflow: "hidden" }}>
            {Array.from({ length: Math.min(arrived, maxRows + 1) }, (_, k) => {
              const i = arrived - 1 - k; // newest on top
              const age = frame - arrive(i);
              const slide = easeOut(clamp(age / 5));
              const y = (k - 1 + slide) * rowH;
              // handled rows: row index from the top that the responder has processed
              const done = has && frame >= respondAt && k < handled;
              const msg = data.messages[i % data.messages.length];
              const ok = done ? easeOut(clamp((handled - k) / 1.5)) : 0;
              return (
                <div key={i} style={{ position: "absolute", left: pw * 0.04, right: pw * 0.04, top: y + rowH * 0.08, height: rowH * 0.84, borderRadius: rowH * 0.2, background: done ? alpha(t.primary, 0.15) : alpha(t.text, 0.06), border: `1px solid ${done ? alpha(t.primary, 0.6) : alpha(t.text, 0.12)}`, display: "flex", alignItems: "center", gap: pw * 0.035, padding: `0 ${pw * 0.04}px`, transform: done ? `translateX(${(1 - ok) * 20}px)` : undefined }}>
                  <div style={{ width: rowH * 0.56, height: rowH * 0.56, borderRadius: "50%", background: [t.secondary, t.accent, t.primary][i % 3], opacity: 0.8, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: t.font.mono, fontSize: rowH * 0.2, color: t.dim }}>客户{r[i].name}</div>
                    <div style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(done ? data.reply : msg, pw * 0.5, rowH * 0.3, 10), color: done ? t.primary : t.text, whiteSpace: "nowrap" }}>{done ? `✓ ${data.reply}` : msg}</div>
                  </div>
                  {!done && <div style={{ minWidth: rowH * 0.36, height: rowH * 0.36, borderRadius: rowH * 0.2, background: t.bad, color: "#fff", fontFamily: t.font.mono, fontWeight: 900, fontSize: rowH * 0.22, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{1 + ((i * 7) % 9)}</div>}
                </div>
              );
            })}
          </div>
        </div>
        {/* big unread badge on the phone corner */}
        {frame >= floodAt && (
          <div style={{ position: "absolute", left: px + pw - pw * 0.18, top: py - pw * 0.1, minWidth: pw * 0.34, height: pw * 0.34, borderRadius: pw * 0.2, background: unread === 0 ? t.primary : t.bad, border: `4px solid ${t.bg}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 14px", fontFamily: t.font.title, fontWeight: 900, fontSize: pw * (badge.length > 2 ? 0.14 : 0.17), color: "#fff", boxShadow: `0 0 ${hot ? 40 : 18}px ${alpha(unread === 0 ? t.primary : t.bad, 0.8)}`, transform: `translate(${eBadge.dx}px, ${eBadge.dy}px) scale(${1 + (hot && frame < respondAt ? 0.1 * Math.sin(frame / 1.5) : 0) + 0.15 * eBadge.p * (1 - prog(frame, floodAt + 10, 6))})`, clipPath: eBadge.clip }}>
            {unread === 0 ? "✓" : badge}
          </div>
        )}
        {/* overflow bubbles bursting out of the phone when overwhelmed */}
        {!has || frame < respondAt
          ? Array.from({ length: Math.max(0, arrived - maxRows) }, (_, k) => {
              const i = maxRows + k;
              const age = frame - arrive(i);
              if (age < 0) return null;
              const p = easeOut(clamp(age / 14));
              const side = i % 2 ? 1 : -1;
              const x = px + pw / 2 + side * (pw * 0.5 + p * (80 + (i * 37) % 180));
              const y = py + ph * (0.2 + ((i * 53) % 60) / 100) - p * 30;
              const msg = data.messages[i % data.messages.length];
              return (
                <div key={`o${i}`} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${easeOutBack(clamp(age / 10)) * (full ? 1 : 0.6)})`, padding: "10px 20px", borderRadius: 22, background: alpha(t.bg2, 0.95), border: `2px solid ${alpha(t.bad, 0.7)}`, fontFamily: t.font.body, fontWeight: 800, fontSize: 28, color: t.text, whiteSpace: "nowrap", boxShadow: `0 0 16px ${alpha(t.bad, 0.4)}` }}>
                  {msg}
                </div>
              );
            })
          : null}
        {/* responder */}
        {has && frame >= respondAt - 6 && (
          <>
            <div style={{ position: "absolute", left: aiX - 100, top: aiY - 100, width: 200, height: 200, borderRadius: "50%", transform: `translate(${eAi.dx}px, ${eAi.dy}px) scale(${eAi.scale * (full ? 1 : 0.5)})`, clipPath: eAi.clip, background: `radial-gradient(circle at 40% 35%, ${alpha(t.primary, 0.5)}, ${alpha(t.bg2, 0.95)} 70%)`, border: `4px solid ${t.primary}`, boxShadow: `0 0 60px ${alpha(t.primary, 0.6)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="bot" size={110} color={t.text} />
            </div>
            {full && <div style={{ position: "absolute", left: aiX - 240, width: 480, top: aiY + 120, textAlign: "center", transform: `translate(${eAi.dx}px, ${eAi.dy}px)`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.responder!, 460, 50, 24), color: t.text, opacity: eAi.p, whiteSpace: "nowrap" }}>{data.responder}</div>}
            {/* beams to the row being handled */}
            {full && frame >= respondAt && (
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                {[0, 1, 2].map((b) => {
                  const k = handled + b;
                  if (k >= maxRows) return null;
                  const ry = listTop + k * rowH + rowH / 2;
                  const o = 0.8 - b * 0.25;
                  return <path key={b} d={`M${aiX - 100},${aiY} C${aiX - 260},${aiY} ${px + pw + 120},${ry} ${px + pw - 10},${ry}`} stroke={t.primary} strokeWidth={4 - b} fill="none" opacity={o * (0.6 + 0.4 * Math.sin(frame / 2 + b))} style={{ filter: `drop-shadow(0 0 8px ${t.primary})` }} />;
                })}
              </svg>
            )}
            {data.meter && full && (
              <div style={{ position: "absolute", left: aiX - 220, width: 440, top: aiY - 280, opacity: eMeter.opacity, transform: `translate(${eMeter.dx}px, ${eMeter.dy}px)`, clipPath: eMeter.clip }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: t.font.title, fontWeight: 900, color: t.text }}>
                  <span style={{ fontSize: 32, color: t.dim }}>{data.meter}</span>
                  <span style={{ fontSize: 64, color: t.primary, fontVariantNumeric: "tabular-nums" }}>{Math.round(lerp(12, data.meterTo, meterK))}%</span>
                </div>
                <div style={{ marginTop: 10, height: 18, borderRadius: 10, background: alpha(t.text, 0.1), overflow: "hidden" }}>
                  <div style={{ width: `${lerp(12, data.meterTo, meterK)}%`, height: "100%", background: `linear-gradient(90deg, ${t.primary}, ${t.accent})`, boxShadow: `0 0 14px ${t.primary}` }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {Array.from({ length: 12 }, (_, k) => (
        <Sfx key={k} name="pop" at={arrive(Math.floor((k / 12) * M))} volume={0.16 + k * 0.012} />
      ))}
      {!has && <Sfx name="glitch" at={peakAt} volume={0.3} />}
      {has && <Sfx name="sparkle" at={respondAt} volume={0.35} />}
      {has && Array.from({ length: Math.min(maxRows, 8) }, (_, k) => <Sfx key={`h${k}`} name="tick" at={respondAt + k * 7 + 7} volume={0.24} />)}
      {has && <Sfx name="success" at={Math.min(dur - 20, respondAt + Math.max(30, dur - respondAt - 20))} volume={0.3} />}
    </>
  );
};

export const UnreadFlood: CompDef<D> = {
  id: "unread-flood",
  name: "未读轰炸 → AI 接手清零",
  layer: "product",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["未读", "99+", "消息", "咨询", "私信", "询盘", "回不过来", "客服"],
  motion: { kind: "消息越涌越快 + 红角标狂跳 + 气泡溢出 → 光束逐条处理变绿 + 计数下降", energy: 3 },
  desc: "一台手机里的消息列表越刷越快，右上角红色未读角标从 1 跳到 99+ 并狂抖，气泡挤出手机外；AI 接手后一道道光束打到列表上，每条消息变绿“✓ 已回复”，未读数一路掉到 ✓，旁边承接率进度条涨满",
  use: "别人来找你、你接不过来：几百个未回的客户、99+ 未读的客服后台、询盘邮件淹没；以及“交给 AI 自动回”的转折（不给 responder 就只演被淹没）",
  panel: true,
  schema,
  example: { channel: "客户咨询", peak: 99, responder: "AI 客服", reply: "已回复 · 已下单", meter: "承接率", meterTo: 98 },
  C,
};

