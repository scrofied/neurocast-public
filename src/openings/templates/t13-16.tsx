import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { CharPop, Slam, Stamp, Strike, Wipe } from "../../lib/cine/Type";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { cam, idxOf, ink, rnd, spread, Stage, tpl } from "./kit";

// ============ T13 对决 VS：左右两方冲撞 + VS 爆炸 ============
// “ChatGPT 和 Claude 到底谁更强？”
const s13 = z.object({
  a: z.string().default("ChatGPT"),
  b: z.string().default("Claude"),
  q: z.string().default("到底谁更强？"),
  clashAt: z.number().default(22).describe("两方撞在一起（锚点，如“和”或 B 的名字）"),
  qAt: z.number().default(40),
});
export const T13Versus = tpl<z.infer<typeof s13>>({
  id: "op-t13-versus",
  name: "模板 · 对决 VS（两方冲撞 + VS 爆炸）",
  hook: "对决比较",
  desc: "首帧左右两块斜切色块带着 A / B 名字冲向中间（速度线），撞上时巨大 VS 爆开 + 冲击环 + 闪白，问句从底部砸出",
  use: "开头比较两样东西：“A 和 B 到底谁更好”“手机 vs 电脑”“打工 vs 创业”",
  techniques: ["首帧双色块", "冲撞", "VS 爆炸", "冲击环", "闪白", "问句砸出"],
  schema: s13,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const inP = easeIn(prog(frame, 0, d.clashAt));
    const hit = frame >= d.clashAt;
    const bounce = hit ? Math.sin(prog(frame, d.clashAt, 10) * Math.PI) * 40 : 0;
    const vs = easeOutBack(prog(frame, d.clashAt, 10));
    const panel = (side: -1 | 1, label: string, col: string) => (
      <div style={{ position: "absolute", top: 660, height: 280, width: 900, left: side < 0 ? -900 + 940 * inP - bounce : 1920 - 940 * inP + bounce, background: `linear-gradient(${side < 0 ? 90 : 270}deg, ${alpha(col, 0.2)}, ${alpha(col, 0.9)})`, clipPath: side < 0 ? "polygon(0 0,100% 0,88% 100%,0 100%)" : "polygon(12% 0,100% 0,100% 100%,0 100%)", display: "flex", alignItems: "center", justifyContent: side < 0 ? "flex-end" : "flex-start", padding: side < 0 ? "0 160px 0 0" : "0 0 0 160px", borderTop: "8px solid #000", borderBottom: "8px solid #000" }}>
        <span style={ink(130, "#fff", t.font.title, 11)}>{label}</span>
      </div>
    );
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: d.clashAt, amp: 22, len: 14 }]} exit="fade">
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.25)" }} />
        {!hit && <SpeedLines frame={frame % 12} at={0} x={960} y={800} color={alpha("#ffffff", 0.7)} len={12} seed={seed} />}
        {panel(-1, d.a, t.primary)}
        {panel(1, d.b, t.bad)}
        <Flash frame={frame} at={d.clashAt} len={8} peak={0.7} />
        <RingBurst frame={frame} at={d.clashAt} x={960} y={800} color={t.accent} maxR={600} len={18} />
        {hit && <div style={{ position: "absolute", left: 960, top: 800, transform: `translate(-50%,-50%) scale(${vs * (1 + 0.8 * (1 - vs))}) rotate(-8deg)`, ...ink(260, t.accent, t.font.title, 18) }}>VS</div>}
        {frame >= d.qAt && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 130, textAlign: "center" }}>
            <Slam frame={frame} at={d.qAt} text={d.q} size={130} color={t.text} font={t.font.title} from={1.8} len={7} strokeW={11} />
          </div>
        )}
        <Sfx name="whoosh" at={0} volume={0.35} />
        <Sfx name="impact" at={d.clashAt} volume={0.6} />
        <Sfx name="glitch" at={d.clashAt + 2} volume={0.3} />
        <Sfx name="stamp" at={d.qAt} volume={0.4} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: d.clashAt, amt: 0.1 }], hits: [{ at: d.clashAt, amp: 20, len: 14 }] }),
});

// ============ T14 清单预告：N 张卡片扇形甩出 → “第 N 个最狠” ============
// “分享 5 个让你效率翻倍的 AI 工具”
const s14 = z.object({
  n: z.number().int().min(2).max(7).default(5).describe("清单数量"),
  what: z.string().default("个 AI 神器").describe("数量后面的名词"),
  items: z.array(z.string()).max(7).default(["写作", "做图", "剪辑", "表格", "PPT"]).describe("卡片上的字（可留空只显示序号）"),
  last: z.string().default("最后一个最狠").describe("结尾钩子"),
  fanAt: z.number().default(12).describe("卡片甩出（锚点）"),
  lastAt: z.number().default(50).describe("最后一张高亮（锚点）"),
});
export const T14List = tpl<z.infer<typeof s14>>({
  id: "op-t14-list",
  name: "模板 · 清单预告（卡片扇形甩出 + 最后一张最狠）",
  hook: "清单干货",
  desc: "首帧巨大“5”砸下 + 名词，随后 N 张卡片像扑克一样扇形甩出（每张一声），最后一张发金光翻转、其余变暗，钩子“最后一个最狠”擦出",
  use: "开头是清单/合集：“5 个 AI 工具”“3 个方法”“7 个习惯”——特别是“最后一个最重要”",
  techniques: ["首帧大数字", "扇形甩卡", "逐张音效", "最后一张金光翻转", "暗化其余", "钩子句"],
  schema: s14,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const n = d.n;
    const cx = 1400;
    const cy = 900;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 12, len: 8 }, { at: d.lastAt, amp: 12, len: 10 }]} exit="left">
        <Scrim side="left" size={0.55} strength={0.7} />
        <Scrim side="right" size={0.5} strength={0.5} />
        <Flash frame={frame} at={0} len={8} peak={0.45} />
        <div style={{ position: "absolute", left: 100, top: 160, display: "flex", alignItems: "baseline", gap: 10 }}>
          <Slam frame={frame} at={0} text={String(n)} size={380} color={t.accent} font={t.font.title} from={1.5} len={6} blur={3} minOpacity={0.9} strokeW={16} />
          <span style={ink(110, t.text, t.font.title)}>{d.what}</span>
        </div>
        {Array.from({ length: n }, (_, i) => {
          const at = d.fanAt + i * 3;
          if (frame < at) return null;
          const p = easeOutBack(prog(frame, at, 12));
          const ang = (-34 + (68 * i) / Math.max(1, n - 1)) * p;
          const isLast = i === n - 1;
          const hl = isLast && frame >= d.lastAt;
          const flip = hl ? easeInOut(prog(frame, d.lastAt, 10)) : 0;
          const dim = frame >= d.lastAt && !isLast ? 0.4 : 1;
          return (
            <div key={i} style={{ position: "absolute", left: cx - 110, top: cy - 520, width: 220, height: 320, transformOrigin: "50% 160%", transform: `rotate(${ang}deg) translateY(${hl ? -60 * flip : 0}px) scale(${hl ? 1 + 0.2 * flip : 1}) rotateY(${flip * 360}deg)`, opacity: dim, borderRadius: 22, border: "7px solid #000", background: hl ? `linear-gradient(160deg, #fff3b0, ${t.gold})` : `linear-gradient(160deg, ${t.bg2}, ${alpha(t.primary, 0.9)})`, boxShadow: hl ? `0 0 60px ${alpha(t.gold, 0.9)}` : "0 10px 30px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <span style={ink(110, hl ? "#000" : "#fff", t.font.title, hl ? 0 : 8)}>{i + 1}</span>
              {d.items[i] && <span style={{ ...ink(44, hl ? "#000" : "#fff", t.font.title, hl ? 0 : 5) }}>{hl ? "???" : d.items[i]}</span>}
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 100, top: 640 }}>
          <Wipe frame={frame} at={d.lastAt + 4} text={d.last} size={110} color={t.gold} font={t.font.title} len={10} edge={t.gold} />
        </div>
        <Sfx name="impact" at={0} volume={0.45} />
        {Array.from({ length: n }, (_, i) => (
          <Sfx key={i} name="swish" at={d.fanAt + i * 3} volume={0.25} />
        ))}
        <Sfx name="sparkle" at={d.lastAt} volume={0.4} />
        <Sfx name="ding" at={d.lastAt + 6} volume={0.35} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: 0, amt: 0.08 }, { at: d.lastAt, amt: 0.05 }] }),
});

// ============ T15 聊天截图冲击：手机聊天气泡一条条弹出 ============
// “昨天一个粉丝私信问我…”
const s15 = z.object({
  name: z.string().default("粉丝私信").describe("聊天对象名"),
  msgs: z.array(z.object({ text: z.string(), me: z.boolean().default(false), at: z.number().optional() })).min(1).max(4).default([{ text: "学了半年 AI 还是不会用", me: false }, { text: "到底该从哪开始？", me: false }, { text: "今天一次讲清楚", me: true }]),
  gap: z.number().default(14).describe("没有锚点时气泡间隔帧数"),
});
export const T15Chat = tpl<z.infer<typeof s15>>({
  id: "op-t15-chat",
  name: "模板 · 聊天截图（私信气泡逐条弹出）",
  hook: "真实提问",
  desc: "首帧一部手机从侧面甩进画面（聊天界面 + 未读红点），对方气泡一条条弹出（消息提示音 + 手机震动），最后自己的绿色气泡回一句钩子",
  use: "开头引用粉丝/客户/老板的话：“昨天有人私信问我…”“老板跟我说…”“评论区有人问…”",
  techniques: ["首帧手机道具", "未读红点", "气泡逐条弹出", "消息提示音", "手机震动", "自己回复钩子"],
  schema: s15,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const inP = easeOutBack(prog(frame, 0, 12));
    const X = 1180;
    const Y = 110;
    const W = 560;
    const H = 880;
    const cues = d.msgs.map((m, i) => m.at ?? 6 + i * d.gap);
    const lastHit = cues.filter((c) => frame >= c).pop();
    const buzz = lastHit !== undefined && frame - lastHit < 6 ? Math.sin(frame * 4) * 6 : 0;
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 8, len: 8 }]} exit="right">
        <Scrim side="right" size={0.5} strength={0.6} />
        <div style={{ position: "absolute", left: X, top: Y, width: W, height: H, borderRadius: 60, background: "#111", border: "8px solid #000", padding: 14, boxShadow: "0 30px 70px rgba(0,0,0,.6)", transform: `translateX(${(1 - inP) * 700 + buzz}px) rotate(${4 - (1 - inP) * 20}deg)` }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 46, background: "#ededed", overflow: "hidden", position: "relative" }}>
            <div style={{ height: 110, background: "#f7f7f7", borderBottom: "1px solid #ddd", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 18, fontFamily: t.font.body, fontWeight: 800, fontSize: 34, color: "#111" }}>
              {d.name}
              <span style={{ marginLeft: 12, width: 34, height: 34, borderRadius: 17, background: "#fa5151", color: "#fff", fontSize: 22, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{d.msgs.filter((_, i) => frame >= cues[i] && !d.msgs[i].me).length}</span>
            </div>
            <div style={{ padding: "26px 22px", display: "flex", flexDirection: "column", gap: 22 }}>
              {d.msgs.map((m, i) => {
                if (frame < cues[i]) return null;
                const p = easeOutBack(prog(frame, cues[i], 10));
                return (
                  <div key={i} style={{ display: "flex", flexDirection: m.me ? "row-reverse" : "row", gap: 14, alignItems: "flex-start", transform: `scale(${p})`, transformOrigin: m.me ? "right top" : "left top" }}>
                    <div style={{ width: 64, height: 64, borderRadius: 12, flex: "none", background: m.me ? t.primary : "#9aa5b1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="user" size={40} color="#fff" />
                    </div>
                    <div style={{ maxWidth: 360, padding: "16px 20px", borderRadius: 14, background: m.me ? "#95ec69" : "#fff", fontFamily: t.font.body, fontWeight: 700, fontSize: 32, lineHeight: 1.35, color: "#111", boxShadow: "0 2px 6px rgba(0,0,0,.08)" }}>{m.text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* the first message also as big type on the left */}
        <div style={{ position: "absolute", left: 90, top: 300, maxWidth: 720, opacity: easeOut(prog(frame, cues[0], 8)) }}>
          <div style={{ ...ink(60, t.dim, t.font.title, 6) }}>{d.name}：</div>
          <div style={{ ...ink(92, t.text, t.font.title, 9), whiteSpace: "normal", marginTop: 10, width: 700 }}>“{d.msgs[0].text}”</div>
        </div>
        <Sfx name="swipe" at={0} volume={0.35} />
        {cues.map((c, i) => (
          <Sfx key={i} name={d.msgs[i].me ? "pop" : "bubbles"} at={c} volume={0.3} />
        ))}
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { zoomTo: 1.05 }),
});

// ============ T16 人群对比：100 个小人 → 99 个变灰 → 1 个发光 ============
// “100 个人里只有 1 个人能做到”
const s16 = z.object({
  total: z.number().int().min(20).max(100).default(100),
  keep: z.number().int().min(1).max(10).default(1).describe("最后亮着的人数"),
  line: z.string().default("只有 1 个人做对了").describe("结论句"),
  hl: z.string().default("1 个人"),
  fadeAt: z.number().default(24).describe("大多数变灰（锚点，如“只有”）"),
  lineAt: z.number().default(38),
});
export const T16Crowd = tpl<z.infer<typeof s16>>({
  id: "op-t16-crowd",
  name: "模板 · 人群对比（百人方阵 → 只剩 1 个发光）",
  hook: "稀缺少数",
  desc: "首帧满屏小人方阵像波浪一样亮起，说到“只有”时绝大多数快速熄灭变灰（咔咔声），只剩 1 个金色小人放大发光，结论句烧色",
  use: "开头讲比例/稀缺：“100 个人里只有 1 个…”“99% 的人都…”“只有少数人知道”",
  techniques: ["首帧方阵", "波浪点亮", "批量熄灭", "唯一发光", "放大聚焦", "结论烧色"],
  schema: s16,
  C: ({ data: d, frame, dur, seed }) => {
    const t = useTheme();
    const cols = d.total >= 60 ? 10 : 8;
    const rows = Math.ceil(d.total / cols);
    const S = 44;
    const X = 1200;
    const Y = 170;
    const keepSet = new Set(Array.from({ length: d.keep }, (_, k) => Math.floor(((k + 0.5) / d.keep) * d.total * 0.6 + d.total * 0.2)));
    return (
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: d.fadeAt, amp: 10, len: 8 }]} exit="fade">
        <Scrim side="right" size={0.62} strength={0.72} />
        <Scrim side="left" size={0.5} strength={0.6} />
        {Array.from({ length: d.total }, (_, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const on = easeOut(prog(frame, (c + r) * 0.8, 8));
          const keep = keepSet.has(i);
          const off = keep ? 0 : easeOut(prog(frame, d.fadeAt + rnd(i, seed) * 10, 5));
          const glow = keep ? easeOutBack(prog(frame, d.fadeAt + 12, 12)) : 0;
          const col = keep && glow > 0 ? t.gold : off > 0.5 ? "#444" : t.primary;
          return (
            <svg key={i} width={S} height={S * 1.2} viewBox="0 0 20 24" style={{ position: "absolute", left: X + c * (S + 18), top: Y + r * (S * 1.2 + 8), opacity: on * (1 - off * 0.55), transform: `scale(${on * (1 + glow * 1.6)})`, zIndex: keep ? 2 : 1, filter: glow > 0 ? `drop-shadow(0 0 ${16 * glow}px ${t.gold})` : undefined }}>
              <circle cx="10" cy="6" r="5" fill={col} stroke="#000" strokeWidth="1.5" />
              <path d="M1,24 C1,15 5,12 10,12 C15,12 19,15 19,24 Z" fill={col} stroke="#000" strokeWidth="1.5" />
            </svg>
          );
        })}
        <div style={{ position: "absolute", left: 90, top: 300 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <Slam frame={frame} at={0} text={String(d.total)} size={260} color={t.text} font={t.font.title} from={1.4} len={6} blur={3} minOpacity={0.9} strokeW={14} />
            <span style={ink(90, t.text, t.font.title)}>个人</span>
          </div>
          <div style={{ marginTop: 20 }}>
            <CharPop frame={frame} at={0} text={d.line} cues={spread(d.line, d.lineAt, d.lineAt + 18)} size={96} color={t.text} hl={idxOf(d.line, d.hl)} hlColor={t.gold} font={t.font.title} strokeW={9} />
          </div>
        </div>
        <Sfx name="impact" at={0} volume={0.4} />
        <Sfx name="sparkle" at={2} volume={0.25} />
        {[0, 3, 6].map((k) => (
          <Sfx key={k} name="click" at={d.fadeAt + k} volume={0.3} />
        ))}
        <Sfx name="ding" at={d.fadeAt + 12} volume={0.45} />
        <Sfx name="whoosh" at={dur - 10} volume={0.2} />
      </Stage>
    );
  },
  camera: (d, f, dur) => cam(f, dur, { punches: [{ at: d.fadeAt + 12, amt: 0.06 }], desatAt: d.fadeAt, desat: 0.35 }),
});
