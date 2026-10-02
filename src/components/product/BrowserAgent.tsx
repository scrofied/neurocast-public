import React from "react";
import { z } from "zod";
import { clamp, easeInOut, noise1 } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { listCues, typed } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fmtNum, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const step = z.object({ text: z.string(), at: z.number().optional() });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  url: z.string().default("douyin.com/video/7394…"),
  items: z.array(z.string()).default(["求新手教程！", "这个怎么做的？", "哈哈哈哈", "有没有平价替代", "为什么我总失败", "蹲一个后续", "能讲讲避坑吗", "学到了"]).describe("页面里滚动的评论"),
  target: z.number().default(500).describe("最终保存条数"),
  unit: z.string().default("条评论"),
  file: z.string().default("评论.txt"),
  steps: z.array(step).max(4).default([{ text: "自己打开页面" }, { text: "自己往下翻" }, { text: "自己存好" }]).describe("三个动作，用锚点对齐“打开/往下翻/存好”"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const steps = data.steps;
  const cues = listCues(steps, 6, Math.max(20, dur * 0.72));
  const openAt = cues[0] ?? 6;
  const scrollAt = cues[1] ?? openAt + 30;
  const saveAt = cues[cues.length - 1] ?? scrollAt + 30;
  const bx = 120;
  const by = 190;
  const bw = 1060;
  const bh = 720;
  const fx = 1260;
  const fw = 540;
  const urlDone = openAt + 16;
  // 浏览器窗口 / 页面内容 / 光标 / 文件卡的「出现」接入语法层；滚动、飞行轨迹、计数、光标路径保持原样
  const eWin = enterAt(frame, 0, { fallback: "rise", dur: 12 });
  const ePage = enterAt(frame, urlDone, { fallback: "rise", dur: 12 });
  const eCur = enterAt(frame, openAt - 4, { fallback: "rise", dur: 10 });
  // 文件卡原生用 easeOutBack(prog) 同时喂 scale(0→1) 与 opacity(clamp)，rise 的 e.p 与基线一致
  const eFile = enterAt(frame, openAt + 10, { fallback: "rise", dur: 16, from: 0 });
  const speed = frame < scrollAt ? 0 : Math.min(9, (frame - scrollAt) * 0.35);
  const scrolled = frame < scrollAt ? 0 : ((frame - scrollAt) * Math.min(9, (frame - scrollAt) * 0.175));
  const rowH = 96;
  const listTop = 330;
  const saved = Math.round(data.target * easeInOut(clamp((frame - scrollAt) / Math.max(10, saveAt + 20 - scrollAt))));
  // AI cursor path: url bar -> page -> scroll area
  const curX = frame < urlDone ? bx + 300 : bx + bw - 120 + noise1(frame / 20, seed) * 10;
  const curY = frame < urlDone ? by + 80 : by + 420 + Math.sin(frame / 5) * (speed > 0 ? 40 : 0);
  const flying = frame >= scrollAt && frame < saveAt + 20;
  return (
    <>
      <Heading kicker={data.kicker ?? "AGENT BROWSER"} title={data.title} frame={frame} width={width} />
      {/* browser window */}
      <div style={{ position: "absolute", left: bx, top: by, width: bw, height: bh, borderRadius: 22, overflow: "hidden", background: alpha(t.bg2, 0.96), border: `1.5px solid ${alpha(t.primary, 0.45)}`, boxShadow: `0 0 60px ${alpha(t.primary, 0.16)}, 0 30px 80px rgba(0,0,0,.5)`, transform: `translate(${eWin.dx}px, ${eWin.dy}px)`, opacity: eWin.opacity }}>
        <div style={{ height: 58, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", background: alpha(t.bg, 0.6) }}>
          {[t.bad, t.accent, t.primary].map((c, i) => (
            <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
          ))}
          <div style={{ marginLeft: 20, flex: 1, height: 38, borderRadius: 19, background: alpha(t.text, 0.08), display: "flex", alignItems: "center", gap: 10, padding: "0 16px", fontFamily: t.font.mono, fontSize: 22, color: t.text }}>
            <Icon name="lock" size={18} color={t.dim} />
            {typed(data.url, frame, openAt, urlDone)}
            {frame < urlDone + 4 && Math.floor(frame / 6) % 2 === 0 && <span style={{ color: t.primary }}>▍</span>}
          </div>
          <div style={{ padding: "6px 14px", borderRadius: 10, background: alpha(t.primary, 0.2), color: t.primary, fontFamily: t.font.mono, fontSize: 18, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="bot" size={18} color={t.primary} />
            AI 操作中
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 58, bottom: 0, opacity: ePage.opacity, transform: `translate(${ePage.dx}px, ${ePage.dy}px)`, overflow: "hidden" }}>
          {24 - scrolled > -260 && (
            <div style={{ position: "absolute", left: 30, top: 24 - scrolled, width: bw - 60, height: 230, borderRadius: 16, background: `linear-gradient(150deg, ${alpha(t.accent, 0.45)}, ${alpha(t.secondary, 0.3)})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="play" size={80} color="#fff" fill={alpha("#ffffff", 0.3)} />
            </div>
          )}
          {new Array(10).fill(0).map((_, k) => {
            // endless list: only the rows currently in view are rendered
            const first = Math.max(0, Math.floor((scrolled - (listTop - 58)) / rowH));
            const i = first + k;
            const y = listTop - 58 + i * rowH - scrolled;
            if (y < -rowH || y > bh) return null;
            const txt = data.items[i % data.items.length];
            const cap = flying && y < bh * 0.55 && y > 100;
            return (
              <div key={i} style={{ position: "absolute", left: 30, right: 30, top: y, height: rowH - 14, borderRadius: 14, display: "flex", alignItems: "center", gap: 16, padding: "0 20px", background: cap ? alpha(t.primary, 0.14) : alpha(t.text, 0.04), border: `1.5px solid ${cap ? alpha(t.primary, 0.7) : "transparent"}` }}>
                <span style={{ width: 46, height: 46, borderRadius: 23, background: alpha(t.secondary, 0.4), flex: "none" }} />
                <span style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 30, color: t.text, flex: 1, whiteSpace: "nowrap" }}>{txt}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: t.font.mono, fontSize: 20, color: t.dim }}>
                  <Icon name="heart" size={20} color={t.bad} fill={t.bad} />
                  {`${(((i * 7919) % 97) + 3) / 10}k`}
                </span>
                {cap && <Icon name="check" size={28} color={t.primary} stroke={3} />}
              </div>
            );
          })}
        </div>
        {/* AI cursor */}
        <div style={{ position: "absolute", left: curX - bx, top: curY - by, transform: `translate(${eCur.dx}px, ${eCur.dy}px)`, opacity: eCur.opacity, transition: "none" }}>
          <Icon name="cursor" size={44} color={t.primary} fill={alpha(t.primary, 0.35)} stroke={2.2} />
          <span style={{ position: "absolute", left: 36, top: 36, padding: "2px 10px", borderRadius: 8, background: t.primary, color: t.bg, fontFamily: t.font.mono, fontWeight: 900, fontSize: 18 }}>AI</span>
        </div>
      </div>
      {/* captured comments fly into the file */}
      {flying &&
        new Array(8).fill(0).map((_, k) => {
          const q = ((frame - scrollAt) / 16 + k / 8) % 1;
          const x0 = bx + 200 + ((k * 131) % 500);
          const y0 = by + 300 + ((k * 71) % 200);
          const x1 = fx + fw / 2;
          const y1 = by + 170;
          const x = x0 + (x1 - x0) * easeInOut(q);
          const y = y0 + (y1 - y0) * easeInOut(q) - Math.sin(q * Math.PI) * 120;
          return <div key={k} style={{ position: "absolute", left: x - 30, top: y - 12, width: 60, height: 24, borderRadius: 8, background: alpha(t.primary, 0.8 * (1 - q)), boxShadow: `0 0 16px ${t.primary}` }} />;
        })}
      {/* file + counter */}
      <div style={{ position: "absolute", left: fx, top: by, width: fw, height: 300, borderRadius: 22, background: `linear-gradient(160deg, ${alpha(t.primary, 0.16)}, ${t.glass})`, border: `2px solid ${alpha(t.primary, 0.5)}`, boxShadow: `0 0 40px ${alpha(t.primary, 0.2)}`, transform: `scale(${eFile.scale}) translate(${eFile.dx}px, ${eFile.dy}px)`, opacity: clamp(eFile.p), padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Icon name="doc" size={70} color={t.primary} stroke={1.8} />
          <div>
            <div style={{ fontFamily: t.font.mono, fontWeight: 700, fontSize: 30, color: t.text }}>{data.file}</div>
            <div style={{ fontFamily: t.font.body, fontSize: 22, color: t.dim }}>自动保存中</div>
          </div>
        </div>
        <div style={{ marginTop: 26, display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 96, color: t.text, textShadow: `0 0 30px ${alpha(t.primary, 0.6)}` }}>{fmtNum(saved, 0)}</span>
          <span style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 30, color: t.dim }}>{data.unit}</span>
        </div>
        <div style={{ marginTop: 10, height: 10, borderRadius: 5, background: alpha(t.primary, 0.15), overflow: "hidden" }}>
          <div style={{ width: `${(saved / data.target) * 100}%`, height: "100%", background: t.primary, boxShadow: `0 0 12px ${t.primary}` }} />
        </div>
      </div>
      {/* the three things it does by itself */}
      <div style={{ position: "absolute", left: fx, top: by + 340, width: fw }}>
        {steps.map((s, i) => {
          const at = cues[i];
          const on = frame >= at;
          // 原生无位移，只把「点亮」的 scale 0.96→1 入场接入语法层（rise+from:0.96 与基线一致）
          const eStep = enterAt(frame, at, { fallback: "rise", dur: 14, from: 0.96, seed: i });
          return (
            <div key={i} style={{ height: 104, marginBottom: 16, borderRadius: 18, display: "flex", alignItems: "center", gap: 18, padding: "0 26px", background: on ? alpha(t.primary, 0.12) : alpha(t.text, 0.03), border: `1.5px solid ${alpha(t.primary, on ? 0.6 : 0.15)}`, transform: `scale(${on ? eStep.scale : 0.96}) translate(${eStep.dx}px, ${eStep.dy}px)`, opacity: on ? 1 : 0.4 }}>
              <div style={{ width: 54, height: 54, borderRadius: 27, background: on ? t.primary : "transparent", border: `2px solid ${t.primary}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {on ? <Icon name="check" size={32} color={t.bg} stroke={3.2} /> : <span style={{ fontFamily: t.font.mono, color: t.primary, fontSize: 24 }}>{i + 1}</span>}
              </div>
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 38, color: on ? t.text : t.dim }}>{s.text}</span>
              <Sfx name="tick" at={at} volume={0.35} />
            </div>
          );
        })}
      </div>
      <Sfx name="typing" at={openAt} volume={0.2} />
      {saveAt + 20 < dur && <Sfx name="success" at={saveAt + 20} volume={0.3} />}
    </>
  );
};

export const BrowserAgent: CompDef<D> = {
  id: "browser-agent",
  name: "AI 自己操作浏览器",
  layer: "product",
  variants: 1,
  minSec: 3,
  maxSec: 12,
  tags: ["自己打开", "自己往下翻", "自动", "采集", "抓取", "浏览器"],
  motion: { kind: "AI 光标打字打开页面 → 评论流滚动、光块飞入文件计数上涨 → 步骤逐条点亮打勾", energy: 2 },
  desc: "浏览器里 AI 光标自己输网址、打开页面、加速往下翻评论；评论被抓取后化成光块飞进右侧文件，计数滚到 500；右侧三个动作依次打勾",
  use: "AI/Agent 自动完成网页操作、采集、下载、整理（“它自己打开页面，自己往下翻，自己存好”）",
  schema,
  example: { target: 500, steps: [{ text: "自己打开页面", at: 6 }, { text: "自己往下翻", at: 40 }, { text: "自己存好", at: 90 }] },
  C,
};
