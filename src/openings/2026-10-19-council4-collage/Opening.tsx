import React from "react";
import { z } from "zod";
import { Img, staticFile, useVideoConfig } from "remotion";
import { clamp, easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { shake } from "../../lib/cine/motion";
import { Flash, RingBurst, SpeedLines } from "../../lib/cine/Flash";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, ink, rnd, Stage, tpl } from "../templates/kit";

// 《怎样让马斯克来指挥你的AI干活？》专属开场（2026-10-19）
// 用户口径：「0-2 秒把几个大佬的照片做成剪贴画的效果，贴在开场钩住人！然后 3-5 秒再切我的真人全屏画面，
// 真人两侧做动效！」→ 两段式：
// ① 0 → stageAt（锚「我把」2.78s）：不透明拼贴墙。四张真实大佬照片做成「剪贴画纸片」（白卡纸边 + 胶带 + 倾角）
//    按 马斯克 → 乔布斯 → 芒格 → 贝索斯 逐张砸上墙，居中大字两行（「让马斯克」/「来指挥你的AI干活？」）
//    第 0 帧就在场；闪白 peak 0.26/len 5、双冲击环、速度线、逐张落地抖动 —— 前 2 秒不露真人。
// ② stageAt → until（7.88s = presenter.full，正卡在「并且装进了」这一句的起点）：拼贴墙 12 帧淡出揭幕真人全屏。
//    四个名字按配音真实词时（芒格 3.24 / 马斯克 3.86 / 贝索斯 4.50 / 乔布斯 5.06）左右左右交替弹出，
//    每枚胶囊带同一个人的圆形照片缩略；锚「做成了」（6.16s）右侧金章「四人 AI 参谋团」盖章。
//    到 presenter.full 收右上小窗，正片第一条工作台录屏（参谋团圆桌）接班。
// ③ camera()：真人层缓慢推近 + 三处 punch，收窗前回到 1.03，衔接不跳位。

const s = z.object({
  line1: z.string().default("让马斯克").describe("第一行大字（第 0 帧就在场）"),
  hl1: z.string().default("马斯克").describe("第一行里变金的词（锚「马斯克」）"),
  line2: z.string().default("来指挥你的AI干活？").describe("第二行大字（锚「指挥」）"),
  kicker: z.string().default("四人 AI 参谋团").describe("大标题上方小标签"),
  faces: z.array(z.string()).default([]).describe("四张真实照片（assetFields 注入 jobs 路径），顺序同 people"),
  people: z
    .array(z.object({ name: z.string(), tag: z.string(), at: z.number(), side: z.enum(["l", "r"]) }))
    .default([])
    .describe("四个人：name 胶囊名字、tag 一句话标签、at=配音里说到这个名字的帧、side 左/右"),
  scraps: z
    .array(z.object({ i: z.number(), at: z.number() }))
    .default([])
    .describe("剪贴画纸片上墙时刻（i=faces 下标，at=帧）"),
  stageAt: z.number().default(84).describe("拼贴墙淡出、真人全屏揭幕（锚「我把」）"),
  stamp: z.object({ text: z.string(), at: z.number() }).optional().describe("金章（锚「做成了」）"),
  kind: z.string().optional(),
  aspect: z.number().optional(),
});
type D = z.infer<typeof s>;

// 四张纸片在墙上的位置 / 倾角（1920×1080 画布，中间留给大字）
const SLOT = [
  { x: 268, y: 312, rot: -5.5 },
  { x: 1652, y: 296, rot: 4.5 },
  { x: 256, y: 852, rot: 3.5 },
  { x: 1660, y: 866, rot: -4.5 },
];
const PW = 300; // 照片边长（正方形原图）

const Scrap: React.FC<{ src: string; frame: number; at: number; x: number; y: number; rot: number; name: string; seed: number }> = ({ src, frame, at, x, y, rot, name, seed }) => {
  const k = easeOutBack(prog(frame, at, 11));
  if (k <= 0) return null;
  const sh = shake(frame, at, 13, 11, seed);
  const float = Math.sin((frame + x) / 23) * 3.2;
  const scale = 0.55 + 0.45 * Math.min(1.06, k);
  return (
    <div style={{ position: "absolute", left: x - PW / 2, top: y - PW / 2, opacity: clamp(k * 4), transform: `translate(${sh.x}px, ${sh.y + float}px) rotate(${rot + sh.r + (1 - Math.min(1, k)) * -14}deg) scale(${scale})` }}>
      {/* 胶带 */}
      <div style={{ position: "absolute", left: PW / 2 - 62, top: -20, width: 124, height: 40, background: alpha("#fff8dc", 0.42), border: `1px solid ${alpha("#fff8dc", 0.28)}`, transform: "rotate(-6deg)", boxShadow: "0 4px 14px rgba(0,0,0,.35)", zIndex: 3 }} />
      {/* 卡纸：白边 + 照片 + 名字条 */}
      <div style={{ padding: 16, background: "linear-gradient(170deg,#fdfdf7,#e7e3d6)", boxShadow: "0 26px 60px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.35) inset" }}>
        <div style={{ width: PW, height: PW, overflow: "hidden", background: "#111" }}>
          <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 24%", filter: "contrast(1.06) saturate(1.02)" }} />
        </div>
        <div style={{ width: PW, textAlign: "center", marginTop: 10, fontFamily: "inherit", fontWeight: 900, fontSize: 40, lineHeight: 1.1, color: "#1a1712", letterSpacing: 2 }}>{name}</div>
      </div>
    </div>
  );
};

const Chip: React.FC<{ src?: string; name: string; tag: string; frame: number; at: number; side: "l" | "r"; t: ReturnType<typeof useTheme> }> = ({ src, name, tag, frame, at, side, t }) => {
  const k = easeOutBack(prog(frame, at, 9));
  if (k <= 0) return null;
  const dx = (1 - Math.min(1.08, k)) * (side === "l" ? -90 : 90);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexDirection: side === "l" ? "row" : "row-reverse", opacity: clamp(k * 3.4), transform: `translateX(${dx}px) scale(${0.62 + 0.38 * Math.min(1.08, k)})`, transformOrigin: side === "l" ? "left center" : "right center" }}>
      {src ? (
        <div style={{ width: 78, height: 78, borderRadius: 39, overflow: "hidden", border: `3px solid ${alpha(t.gold, 0.9)}`, boxShadow: `0 0 26px ${alpha(t.gold, 0.55)}`, flexShrink: 0 }}>
          <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 22%" }} />
        </div>
      ) : null}
      <div style={{ padding: "10px 26px", borderRadius: 14, background: alpha(t.bg, 0.8), border: `3px solid ${alpha(t.gold, 0.7)}`, boxShadow: "0 12px 30px rgba(0,0,0,.55)", textAlign: side === "l" ? "left" : "right" }}>
        <div style={{ ...ink(46, t.text, t.font.title, 8) }}>{name}</div>
        <div style={{ ...ink(27, t.gold, t.font.body, 6), marginTop: 2 }}>{tag}</div>
      </div>
    </div>
  );
};

const C: React.FC<CompProps<D> & { presenter?: boolean }> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  void fps;
  const stage = d.stageAt;
  const po = 1 - clamp(easeIn(prog(frame, stage, 12))); // 拼贴墙淡出
  const in1 = easeOutBack(prog(frame, -9, 10)); // 第 0 帧砸完就已满场（不从透明淡入）
  const in2 = easeOutBack(prog(frame, 30, 10)); // 第二行卡在「来指挥」（0.98s）
  const hl = prog(frame, 14, 6); // 「马斯克」烧成金色（0.46s）
  const tlSh = shake(frame, 0, 16, 13, seed);
  const l2Sh = shake(frame, 30, 12, 10, seed);
  const stampIn = d.stamp ? easeOutBack(prog(frame, d.stamp.at, 10)) : 0;
  return (
    <>
      {/* ── 阶段 1：不透明拼贴墙（第 0 帧就是完整大场面） ── */}
      {frame < stage + 12 && (
        <div style={{ position: "absolute", inset: 0, opacity: po }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 50% 42%, ${alpha(t.bg2, 0.98)} 0%, ${alpha(t.bg, 0.99)} 62%, rgba(0,0,0,.96) 100%)` }} />
          {/* 软木板纹理：横竖细线 + 每帧缓慢漂移，保证「画面一直在动」 */}
          <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
            {Array.from({ length: 26 }).map((_, i) => {
              const y = i * 44 + ((frame * 0.35) % 44);
              return <line key={`h${i}`} x1={0} y1={y} x2={1920} y2={y} stroke={t.primary} strokeWidth={1} opacity={0.05 + 0.03 * Math.sin(i + frame / 30)} />;
            })}
            {Array.from({ length: 22 }).map((_, i) => {
              const x = i * 96 + ((frame * 0.22) % 96);
              return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={1080} stroke={t.secondary} strokeWidth={1} opacity={0.045} />;
            })}
            <ellipse cx={960} cy={540} rx={760} ry={430} fill="none" stroke={alpha(t.gold, 0.16)} strokeWidth={2} strokeDasharray="16 22" transform={`rotate(${frame * 0.22} 960 540)`} />
          </svg>
          {/* 四张剪贴画纸片 */}
          {d.scraps.map((sc, n) => {
            const p = SLOT[sc.i % 4];
            const pe = d.people[sc.i] || d.people[n];
            return <Scrap key={n} src={d.faces[sc.i]} frame={frame} at={sc.at} x={p.x} y={p.y} rot={p.rot} name={pe ? pe.name : ""} seed={seed + n} />;
          })}
          {/* 居中大字 */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 372, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ ...ink(34, alpha(t.gold, 0.95), t.font.body, 6), letterSpacing: 8, opacity: clamp(in1 * 2.2) }}>{d.kicker}</div>
            <div style={{ transform: `translate(${tlSh.x}px, ${tlSh.y}px) scale(${0.72 + 0.28 * Math.min(1.05, in1)})`, opacity: clamp(in1 * 3) }}>
              <span style={{ ...ink(152, t.text, t.font.title, 13) }}>{d.line1.split(d.hl1)[0] || ""}</span>
              <span style={{ ...ink(152, hl > 0.5 ? t.gold : t.text, t.font.title, 13), textShadow: hl > 0.5 ? `0 0 34px ${alpha(t.gold, 0.75)}` : "none" }}>{d.hl1}</span>
            </div>
            <div style={{ transform: `translate(${l2Sh.x}px, ${l2Sh.y}px) scale(${0.74 + 0.26 * Math.min(1.05, in2)})`, opacity: clamp(in2 * 3) }}>
              <span style={{ ...ink(112, t.text, t.font.title, 11) }}>{d.line2}</span>
            </div>
          </div>
          <Flash frame={frame} at={0} len={5} peak={0.26} />
          <Flash frame={frame} at={30} len={4} peak={0.16} />
          <RingBurst frame={frame} at={0} x={960} y={520} color={t.gold} len={16} maxR={620} width={9} />
          <RingBurst frame={frame} at={0} x={960} y={520} color={t.accent} len={22} maxR={900} width={4} />
          <SpeedLines frame={frame} at={0} x={960} y={520} color={t.primary} len={14} count={16} inner={330} seed={seed} />
          <Sfx name="impact" at={0} volume={0.5} />
          <Sfx name="ding" at={14} volume={0.34} />
          <Sfx name="impact" at={30} volume={0.36} />
          {d.scraps.filter((x) => x.at > 0).map((x, i) => (
            <Sfx key={i} name="stamp" at={x.at} volume={0.4} />
          ))}
        </div>
      )}
      {/* ── 阶段 2：真人全屏 + 两侧名字胶囊 + 金章 ── */}
      {frame >= stage - 4 && (
        <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: stage, amp: 4, len: 4 }, ...d.people.map((p) => ({ at: p.at, amp: 3, len: 3 })), ...(d.stamp ? [{ at: d.stamp.at, amp: 8, len: 6 }] : [])]} exit="fade" outLen={8}>
          <div style={{ position: "absolute", left: 96, top: 292, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 26 }}>
            {d.people.filter((p) => p.side === "l").map((p, i) => (
              <Chip key={i} src={d.faces[d.people.indexOf(p)]} name={p.name} tag={p.tag} frame={frame} at={p.at} side="l" t={t} />
            ))}
          </div>
          <div style={{ position: "absolute", right: 96, top: 292, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 26 }}>
            {d.people.filter((p) => p.side === "r").map((p, i) => (
              <Chip key={i} src={d.faces[d.people.indexOf(p)]} name={p.name} tag={p.tag} frame={frame} at={p.at} side="r" t={t} />
            ))}
          </div>
          {d.stamp && stampIn > 0 && (
            <div style={{ position: "absolute", left: 96, bottom: 168, opacity: clamp(stampIn * 3.4), transform: `scale(${0.5 + 0.5 * Math.min(1.14, stampIn)}) rotate(-7deg)`, transformOrigin: "left bottom" }}>
              <div style={{ padding: "18px 36px", borderRadius: 16, border: `6px double ${t.gold}`, background: alpha(t.bg, 0.52), boxShadow: `0 0 44px ${alpha(t.gold, 0.4)}` }}>
                <span style={{ ...ink(66, t.gold, t.font.title, 9), whiteSpace: "nowrap" }}>{d.stamp.text}</span>
              </div>
            </div>
          )}
          <Sfx name="whoosh" at={stage} volume={0.3} />
          {d.people.map((p, i) => (
            <Sfx key={i} name="pop" at={p.at} volume={0.32} />
          ))}
          {d.stamp && <Sfx name="stamp" at={d.stamp.at} volume={0.46} />}
          {d.stamp && <Sfx name="ding" at={d.stamp.at + 8} volume={0.34} />}
        </Stage>
      )}
    </>
  );
};

export const OpeningCouncil4Collage: CompDef<D> = {
  ...tpl<D>({
    id: "opening-council4-collage",
    name: "开场 · 大佬照片剪贴画墙→真人全屏两侧名字胶囊→盖章收窗",
    hook: "名人悬念（让马斯克指挥 AI）+ 照片拼贴 + 两侧卡词胶囊",
    desc: "0~2.8s 不透明拼贴墙：四张真实大佬照片做成卡纸剪贴画（胶带+倾角）逐张砸上墙，居中两行大字第 0 帧在场，闪白+双冲击环+速度线；2.8s 起拼贴墙淡出揭幕真人全屏，四个名字按配音词时左右交替弹出（带圆形照片缩略），锚「做成了」左下金章「四人 AI 参谋团」盖章；到 presenter.full 收右上小窗",
    use: "只给《怎样让马斯克来指挥你的AI干活？》用（开场不重样）",
    techniques: ["照片剪贴画墙", "居中大字砸出", "逐张落地抖动", "真人全屏两侧卡词胶囊", "照片缩略胶囊", "盖章+ding", "收窗衔接"],
    schema: s,
    assetFields: ["faces[]"],
    C,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        punches: [{ at: 0, amt: 0.06 }, { at: 30, amt: 0.045 }, { at: dd.stageAt, amt: 0.05 }, { at: dd.stamp?.at ?? 185, amt: 0.05 }],
        zoomTo: 1.045,
        zoomAt: dd.stageAt,
        zoomLen: Math.max(12, dur2 - dd.stageAt - 12),
      }),
  }),
  noGallery: true,
  opening: {
    script: "../../../council4",
    hook: "名人悬念 + 照片剪贴画 + 真人两侧动效",
    techniques: ["剪贴画墙", "居中大字", "两侧名字胶囊", "盖章收窗"],
    selfBg: true,
  },
};
