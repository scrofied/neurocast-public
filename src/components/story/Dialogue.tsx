import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, noise1, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { Heading, textEm } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const msg = z.object({
  who: z.enum(["them", "me"]).describe("them=对方/网友（左） me=你/博主（右）"),
  text: z.string(),
  at: z.number().optional().describe("这条消息出现的时刻（锚点）"),
  punch: z.boolean().optional().describe("大字+抖动，用于怼回去的那句"),
  media: z.object({ title: z.string(), views: z.string().optional() }).optional().describe("气泡里附一张视频卡片"),
});
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  them: z.string().default("网友").describe("左侧说话人名字"),
  me: z.string().default("我"),
  messages: z.array(msg).min(1).max(6),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const msgs = data.messages;
  const cues = listCues(msgs, 10, Math.max(20, dur * 0.7));
  const colW = Math.min(1180, width - 300);
  const x0 = (width - colW) / 2;
  const top = 200;
  const bottom = height - 170;
  const maxText = colW * 0.62;
  // estimate bubble heights to stack and auto-scroll
  const lay = msgs.map((m) => {
    const fs = m.punch ? 66 : 38;
    const lines = Math.max(1, Math.ceil((textEm(m.text) * fs) / (maxText - 60)));
    const h = lines * fs * 1.42 + 44 + (m.media ? 214 : 0) + 34;
    return { fs, h, lines };
  });
  const ys: number[] = [];
  let acc = 0;
  for (const l of lay) {
    ys.push(acc);
    acc += l.h + 22;
  }
  const visible = cues.reduce((k, c, i) => (frame >= c - 12 ? i : k), -1);
  const PAD = 30;
  const room = bottom - top - PAD - 30;
  const contentBottom = visible >= 0 ? ys[visible] + lay[visible].h : 0;
  const overflow = Math.max(0, contentBottom - room);
  // smooth scroll towards the newest message
  const prevOverflow = visible > 0 ? Math.max(0, ys[visible - 1] + lay[visible - 1].h - room) : 0;
  const scroll = prevOverflow + (overflow - prevOverflow) * easeInOut(clamp((frame - (cues[Math.max(0, visible)] - 12)) / 12));
  return (
    <>
      <Heading kicker={data.kicker ?? "DIALOGUE"} title={data.title} frame={frame} width={width} />
      <div style={{ position: "absolute", left: x0, top, width: colW, height: bottom - top, overflow: "hidden", maskImage: "linear-gradient(180deg, transparent 0, #000 40px, #000 100%)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: -scroll + PAD }}>
          {msgs.map((m, i) => {
            const at = cues[i];
            const me = m.who === "me";
            const typing = frame >= at - 14 && frame < at;
            const p = easeOutBack(prog(frame, at, 14));
            if (frame < at - 14) return null;
            const col = me ? t.primary : t.secondary;
            const since = frame - at;
            const shake = m.punch && since >= 0 && since < 16 ? noise1(frame * 3, seed + i) * 14 * (1 - since / 16) : 0;
            return (
              <div key={i} style={{ position: "absolute", top: ys[i], left: 0, right: 0, display: "flex", flexDirection: me ? "row-reverse" : "row", alignItems: "flex-start", gap: 18 }}>
                <div style={{ flex: "none", width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg, ${alpha(col, 0.7)}, ${alpha(col, 0.25)})`, border: `2px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: clamp(prog(frame, at - 14, 8)) }}>
                  <Icon name={me ? "mic" : "user"} size={36} color="#fff" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: me ? "flex-end" : "flex-start", maxWidth: maxText }}>
                  <div style={{ fontFamily: t.font.body, fontSize: 22, color: t.dim, marginBottom: 8, opacity: clamp(prog(frame, at - 14, 8)) }}>{me ? data.me : data.them}</div>
                  {typing ? (
                    <div style={{ padding: "22px 30px", borderRadius: 26, background: alpha(col, 0.14), border: `1.5px solid ${alpha(col, 0.4)}`, display: "flex", gap: 10 }}>
                      {[0, 1, 2].map((k) => (
                        <span key={k} style={{ width: 12, height: 12, borderRadius: 6, background: t.text, opacity: 0.35 + 0.65 * Math.max(0, Math.sin(frame / 3 - k)) }} />
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        transform: `translateX(${shake}px) scale(${p})`,
                        transformOrigin: me ? "right top" : "left top",
                        padding: m.punch ? "20px 40px" : "18px 30px",
                        borderRadius: 26,
                        borderTopRightRadius: me ? 6 : 26,
                        borderTopLeftRadius: me ? 26 : 6,
                        background: me ? `linear-gradient(135deg, ${alpha(t.primary, m.punch ? 0.5 : 0.32)}, ${alpha(t.secondary, 0.22)})` : `linear-gradient(135deg, ${alpha(t.bg2, 0.95)}, ${t.glass})`,
                        border: `2px solid ${m.punch ? t.accent : alpha(col, 0.55)}`,
                        boxShadow: m.punch ? `0 0 50px ${alpha(t.accent, 0.55)}` : `0 0 30px ${alpha(col, 0.18)}`,
                        fontFamily: m.punch ? t.font.title : t.font.body,
                        fontWeight: m.punch ? 900 : 700,
                        fontSize: lay[i].fs,
                        lineHeight: 1.42,
                        color: m.punch ? t.accent : t.text,
                        textShadow: m.punch ? `0 0 24px ${alpha(t.accent, 0.7)}` : undefined,
                      }}
                    >
                      {m.text}
                      {m.media && (
                        <div style={{ marginTop: 14, width: 360, height: 200, borderRadius: 16, overflow: "hidden", position: "relative", background: `linear-gradient(160deg, ${alpha(t.accent, 0.55)}, ${alpha(t.secondary, 0.35)} 55%, ${t.bg})` }}>
                          <div style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)" }}>
                            <Icon name="play" size={64} color="#fff" fill={alpha("#ffffff", 0.35)} />
                          </div>
                          <div style={{ position: "absolute", left: 16, bottom: 14, fontFamily: t.font.body, fontWeight: 800, fontSize: 26, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,.7)" }}>{m.media.title}</div>
                          {m.media.views && (
                            <div style={{ position: "absolute", right: 12, top: 12, padding: "4px 12px", borderRadius: 99, background: alpha("#000000", 0.55), fontFamily: t.font.mono, fontSize: 20, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                              <Icon name="play" size={16} color="#fff" fill="#fff" />
                              {m.media.views}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Sfx name={m.punch ? "impact" : "pop"} at={at} volume={m.punch ? 0.45 : 0.3} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: x0, width: colW, top: bottom + 12, height: 2, background: `linear-gradient(90deg, transparent, ${alpha(t.primary, 0.4)}, transparent)`, opacity: easeOut(prog(frame, 4, 12)) }} />
    </>
  );
};

export const Dialogue: CompDef<D> = {
  id: "dialogue",
  name: "对话气泡",
  layer: "story",
  variants: 1,
  minSec: 3,
  maxSec: 12,
  tags: ["有人说", "网友问", "你可能会说", "反驳", "对话"],
  desc: "聊天界面：左边网友、右边你，气泡按说话时刻弹出（先出“正在输入…”），可附视频卡片；最后一句可用 punch 大字抖动怼回去",
  use: "设问/假想对话/网友提问/“有人就说了…快拉倒吧”这种一来一回的段落",
  hideCaptions: true,
  schema,
  example: {
    messages: [
      { who: "them", text: "那我听你的", at: 10 },
      { who: "them", text: "我去看那些几百万播放的爆款视频", at: 40, media: { title: "爆款视频", views: "386万" } },
      { who: "them", text: "我跟着大博主抄还不成吗？", at: 90 },
      { who: "me", text: "快拉倒吧。", at: 130, punch: true },
    ],
  },
  C,
};
