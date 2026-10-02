import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const comment = z.object({ user: z.string().optional(), text: z.string(), likes: z.string().optional(), gold: z.boolean().optional().describe("真实需求/痛点，聚焦后发金光"), tag: z.string().optional() });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  video: z.object({ title: z.string(), views: z.string().optional(), label: z.string().optional() }).default({ title: "大博主的爆款视频", views: "386万播放" }),
  comments: z.array(comment).min(3).max(12),
  focusAt: z.number().optional().describe("镜头从视频转向评论区的时刻（锚点，如“评论区”）"),
  badge: z.string().default("秘密在评论区"),
  handoff: z.object({ text: z.string(), at: z.number().optional() }).optional().describe("底部交接条，如“挖评论 → 交给 AI”"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const focusAt = cueOr(data.focusAt, dur * 0.45);
  const fp = easeInOut(prog(frame, focusAt, 22));
  const vx = 150;
  const vy = 250;
  const vw = 800;
  const vh = 450;
  const px = 1030;
  const py = 200;
  const pw = 740;
  const ph = 700;
  const rowH = 112;
  const scroll = frame * 0.7;
  const list = [...data.comments, ...data.comments];
  const hand = data.handoff ? cueOr(data.handoff.at, dur * 0.8) : Infinity;
  // 原生元素入场：两张面板淡入、金标/交接条原位回弹放大（无位移 → dist: 0, from: 0）
  const eVid = enterAt(frame, 0, { fallback: "rise", dur: 14 });
  const ePanel = enterAt(frame, 6, { fallback: "rise", dur: 14 });
  const eNo = enterAt(frame, focusAt + 8, { fallback: "rise", dur: 12 });
  const eBadge = enterAt(frame, focusAt + 10, { fallback: "rise", dur: 16, from: 0, dist: 0 });
  const eHand = enterAt(frame, hand, { fallback: "rise", dur: 16, from: 0, dist: 0 });
  return (
    <>
      <Heading kicker={data.kicker ?? "WHERE THE GOLD IS"} title={data.title} frame={frame} width={width} />
      {/* big creator's video: bright first, dims when the focus moves to the comments */}
      <div
        style={{
          position: "absolute",
          left: vx,
          top: vy,
          width: vw,
          height: vh,
          borderRadius: 22,
          overflow: "hidden",
          border: `2px solid ${alpha(t.accent, 0.6 - fp * 0.4)}`,
          background: `linear-gradient(150deg, ${alpha(t.accent, 0.5)}, ${alpha(t.secondary, 0.35)} 55%, ${t.bg})`,
          filter: `grayscale(${fp}) brightness(${1 - fp * 0.55}) blur(${fp * 2}px)`,
          transform: `scale(${1 - fp * 0.06})`,
          boxShadow: `0 0 ${60 * (1 - fp)}px ${alpha(t.accent, 0.35)}`,
          opacity: eVid.opacity,
        }}
      >
        <div style={{ position: "absolute", left: "50%", top: "45%", transform: "translate(-50%,-50%)" }}>
          <Icon name="play" size={110} color="#fff" fill={alpha("#ffffff", 0.35)} />
        </div>
        <div style={{ position: "absolute", left: 26, bottom: 22, fontFamily: t.font.title, fontWeight: 900, fontSize: 42, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,.7)" }}>{data.video.title}</div>
        {data.video.views && <div style={{ position: "absolute", right: 20, top: 18, padding: "6px 16px", borderRadius: 99, background: alpha("#000000", 0.5), color: "#fff", fontFamily: t.font.mono, fontSize: 24 }}>▶ {data.video.views}</div>}
      </div>
      {fp > 0.3 && (
        <div style={{ position: "absolute", left: vx + vw / 2, top: vy + vh + 40, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 10, fontFamily: t.font.body, fontWeight: 800, fontSize: 32, color: t.dim, opacity: eNo.opacity }}>
          <Icon name="x" size={30} color={t.bad} stroke={3} />
          {data.video.label ?? "秘密不在画面里"}
        </div>
      )}
      {/* comment section */}
      <div style={{ position: "absolute", left: px, top: py, width: pw, height: ph, borderRadius: 24, background: `linear-gradient(170deg, ${alpha(t.bg2, 0.92)}, ${alpha(t.bg, 0.88)})`, border: `2px solid ${alpha(fp > 0.5 ? t.gold : t.primary, 0.3 + fp * 0.5)}`, boxShadow: `0 0 ${20 + fp * 60}px ${alpha(fp > 0.5 ? t.gold : t.primary, 0.15 + fp * 0.3)}`, overflow: "hidden", transform: `scale(${1 + fp * 0.03})`, opacity: ePanel.opacity }}>
        <div style={{ height: 76, display: "flex", alignItems: "center", gap: 14, padding: "0 30px", borderBottom: `1px solid ${alpha(t.primary, 0.2)}`, fontFamily: t.font.body, fontWeight: 800, fontSize: 30, color: t.text }}>
          <Icon name="chat" size={30} color={t.primary} />
          评论 · 12.8w
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 76, bottom: 0, overflow: "hidden" }}>
          {list.map((c, i) => {
            const y = i * rowH - (scroll % (data.comments.length * rowH));
            if (y < -rowH || y > ph) return null;
            const gold = !!c.gold && fp > 0.5;
            const g = gold ? easeOut(prog(frame, focusAt + 12 + (i % data.comments.length) * 3, 12)) : 0;
            return (
              <div key={i} style={{ position: "absolute", left: 16, right: 16, top: y + 8, height: rowH - 16, borderRadius: 16, display: "flex", alignItems: "center", gap: 16, padding: "0 18px", background: gold ? alpha(t.gold, 0.12 * g) : "transparent", border: gold ? `2px solid ${alpha(t.gold, 0.8 * g)}` : "2px solid transparent", boxShadow: gold ? `0 0 24px ${alpha(t.gold, 0.35 * g)}` : undefined, opacity: fp > 0.5 && !c.gold ? 0.45 : 1 }}>
                <div style={{ flex: "none", width: 54, height: 54, borderRadius: 27, background: alpha(t.secondary, 0.35), border: `1.5px solid ${alpha(t.secondary, 0.6)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="user" size={28} color={t.text} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: t.font.body, fontSize: 20, color: t.dim }}>{c.user ?? `用户${(i * 37) % 900 + 100}`}</div>
                  <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: fitFont(c.text, pw - 260, 30, 18), color: gold ? t.gold : t.text, whiteSpace: "nowrap" }}>{c.text}</div>
                </div>
                {c.tag && gold && <div style={{ flex: "none", padding: "4px 12px", borderRadius: 8, background: t.gold, color: t.bg, fontFamily: t.font.body, fontWeight: 900, fontSize: 20, opacity: g }}>{c.tag}</div>}
                <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", color: t.dim, fontFamily: t.font.mono, fontSize: 18 }}>
                  <Icon name="heart" size={24} color={c.gold ? t.bad : t.dim} fill={c.gold ? t.bad : "none"} />
                  {c.likes ?? ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* spotlight sweeps from the video to the comments */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse 560px 520px at ${vx + vw / 2 + (px + pw / 2 - vx - vw / 2) * fp}px ${vy + vh / 2 + (py + ph / 2 - vy - vh / 2) * fp}px, transparent 55%, ${alpha(t.bg, 0.5 * clamp(fp * 2))} 100%)` }} />
      {frame >= focusAt + 10 && (
        <div style={{ position: "absolute", left: px + pw / 2, top: py - 34, transform: `translate(-50%,-50%) translate(${eBadge.dx}px, ${eBadge.dy}px) scale(${eBadge.scale})`, padding: "12px 30px", borderRadius: 99, background: t.gold, color: t.bg, display: "flex", alignItems: "center", gap: 12, fontFamily: t.font.title, fontWeight: 900, fontSize: 36, boxShadow: `0 0 40px ${alpha(t.gold, 0.7)}`, whiteSpace: "nowrap", opacity: eBadge.opacity }}>
          <Icon name="key" size={32} color={t.bg} stroke={2.6} />
          {data.badge}
        </div>
      )}
      {data.handoff && frame >= hand && (
        <div style={{ position: "absolute", left: vx + vw / 2, top: vy + vh + 110, transform: `translate(-50%,0) translate(${eHand.dx}px, ${eHand.dy}px) scale(${eHand.scale})`, padding: "16px 36px", borderRadius: 18, background: `linear-gradient(90deg, ${alpha(t.primary, 0.3)}, ${alpha(t.secondary, 0.3)})`, border: `2px solid ${t.primary}`, boxShadow: `0 0 40px ${alpha(t.primary, 0.45)}`, display: "flex", alignItems: "center", gap: 16, fontFamily: t.font.title, fontWeight: 900, fontSize: 40, color: t.text, whiteSpace: "nowrap", opacity: eHand.opacity }}>
          <Icon name="bot" size={40} color={t.primary} />
          {data.handoff.text}
        </div>
      )}
      <Sfx name="swish" at={focusAt} volume={0.3} />
      <Sfx name="sparkle" at={focusAt + 12} volume={0.3} />
      {data.handoff && <Sfx name="pop" at={hand} volume={0.35} />}
    </>
  );
};

export const CommentWall: CompDef<D> = {
  id: "comment-wall",
  name: "评论区里有金子",
  layer: "story",
  variants: 1,
  minSec: 3,
  maxSec: 12,
  tags: ["评论区", "留言", "用户需求", "痛点", "真实反馈"],
  motion: { kind: "评论区持续滚动 + 聚光灯从视频移到评论区 + 金标/交接条回弹弹出", energy: 2 },
  desc: "左边大博主的爆款视频，右边滚动的评论区；说到“评论区”时视频变灰、聚光灯移到评论区，真实需求评论发金光并打上标签，可在底部接一条交接提示",
  use: "真正有价值的东西不在表面、藏在反馈里：评论区的需求、差评里的改进点、客服记录里的痛点、问卷的开放题（video 换成任何“表面”，comments 换成任何反馈）",
  schema,
  example: {
    comments: [
      { text: "哈哈哈哈哈笑死", likes: "2.1w" },
      { text: "新手到底怎么起号？", likes: "8.6k", gold: true, tag: "需求" },
      { text: "前排", likes: "302" },
      { text: "剪辑太慢了有没有办法", likes: "5.2k", gold: true, tag: "痛点" },
      { text: "[捂脸][捂脸]", likes: "1.1k" },
      { text: "为什么我发了没流量", likes: "9.9k", gold: true, tag: "痛点" },
    ],
    focusAt: 60,
    handoff: { text: "挖评论这件事 → 交给 AI", at: 130 },
  },
  C,
};
