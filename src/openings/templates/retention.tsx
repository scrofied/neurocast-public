import React from "react";
import { Freeze, Img, OffthreadVideo, staticFile } from "remotion";
import { z } from "zod";
import type { CompDef, CompProps } from "../../components/types";
import { easeIn, easeOut, easeInOut, lerp, prog } from "../../lib/anim";
import { sourceSchema, SourceBadge } from "../../lib/source";
import { useTheme } from "../../lib/theme";
import { OpeningSoundtrack } from "./soundtrack";

const line = (max: number) => z.string().trim().min(1).max(max).refine((s) => !/[\r\n]/.test(s), { message: "短文案不要手工换行，模板会自动排版" });
const common = {
  hook: line(36).default("先看结果，再讲怎么做"),
  proof: line(60).default("看这处细节：信息已经按主题分组"),
  payoff: line(60).default("第一步：把原文按同一个问题分组"),
  proofAt: z.number().finite().nonnegative().default(60).describe("解释证据的时刻（帧；分镜可写台词锚点或秒）"),
  payoffAt: z.number().finite().nonnegative().default(150).describe("第一步实际兑现的时刻（帧；不要只写收益承诺）"),
  sound: z.enum(["quiet", "foley", "pulse", "impact"]).default("foley"),
};
const media = z.object({
  src: z.string().optional().describe("真实截图或录屏；留空仅供布局预览，正式出片必须提供"),
  kind: z.enum(["image", "video"]).default("image"),
  frames: z.number().int().positive().optional(),
  aspect: z.number().positive().optional(),
  origin: z.string().optional(),
  source: sourceSchema,
}).refine((d) => !d.src || (d.source?.kind !== "stock" && !!(d.source?.platform?.trim() || d.source?.url?.trim())), { message: "证据素材必须注明 source.platform 或 source.url，不能用库存示意画面" });
const resultSchema = z.object({
  ...common,
  result: media.prefault({}),
  focusX: z.number().min(0).max(1).default(0.5),
  focusY: z.number().min(0).max(1).default(0.45),
  // 可选的第二件证据：同一块素材位换到另一张真截图/录屏，圈选与底部证据行跟着换
  proof2: z.object({ src: z.string().min(1), kind: z.enum(["image", "video"]).default("image"), frames: z.number().int().positive().optional(), aspect: z.number().positive().optional(), origin: z.string().optional(), source: sourceSchema, text: line(60).default("") }).refine((s) => s.source?.kind !== "stock" && !!(s.source?.platform?.trim() || s.source?.url?.trim()), { message: "第二件证据同样必须注明 source.platform 或 source.url" }).optional(),
  proofNextAt: z.number().finite().nonnegative().optional().describe("第二件证据出现的时刻（秒或台词锚点）"),
}).refine((d) => d.proofAt < d.payoffAt && (d.proofNextAt == null || (d.proofAt < d.proofNextAt && d.proofNextAt < d.payoffAt)), { message: "时刻必须递增：proofAt < proofNextAt < payoffAt" })
  .refine((d) => !d.proof2 || d.proofNextAt != null, { message: "给了 proof2 素材就必须给 proofNextAt" });
const quietSchema = z.object({
  ...common,
  hook: line(36).default("为什么越忙，反而越慢？"),
  proof: line(60).default("每次切换任务，都要重新找回上下文"),
  payoff: line(60).default("先关掉通知，只留下当前这一件事"),
  sound: z.enum(["quiet", "foley", "pulse", "impact"]).default("quiet"),
  topic: line(12).default("工作方法"),
}).refine((d) => d.proofAt < d.payoffAt, { message: "proofAt 必须早于 payoffAt" });
const compareSchema = z.object({
  ...common,
  hook: line(36).default("同一份输入，差别在哪里？"),
  proof: line(60).default("把两次结果放在一起，看相同位置"),
  payoff: line(60).default("第一步：固定输入，只改一个条件"),
  sound: z.enum(["quiet", "foley", "pulse", "impact"]).default("pulse"),
  before: media.prefault({}),
  after: media.prefault({}),
  beforeLabel: line(12).default("调整前"),
  afterLabel: line(12).default("调整后"),
}).refine((d) => d.proofAt < d.payoffAt, { message: "proofAt 必须早于 payoffAt" });
type MediaData = z.infer<typeof media>;

const textStyle = (text: string, width: number, max: number, font: string, color: string): React.CSSProperties => ({
  fontFamily: font, fontWeight: 800, color, fontSize: Math.min(max, width / Math.min(Math.max(1, Array.from(text).length), 14)),
  lineHeight: 1.24, overflowWrap: "anywhere", whiteSpace: "pre-wrap", margin: 0,
});
const mediaUrl = (p: string) => /^https?:/.test(p) ? p : staticFile(p);
const Media: React.FC<{ data: MediaData; frame: number; label: string }> = ({ data, frame, label }) => {
  const last = data.frames ? Math.max(0, data.frames - 1) : undefined;
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "contain", display: "block" };
  return <div style={{ position: "absolute", inset: 0, background: "#10171e", overflow: "hidden" }}>
    {data.src ? data.kind === "video" ? last !== undefined && frame >= last ?
      <Freeze frame={last}><OffthreadVideo src={mediaUrl(data.src)} muted style={style} /></Freeze> :
      <OffthreadVideo src={mediaUrl(data.src)} muted style={style} /> :
      <Img src={mediaUrl(data.src)} style={style} /> :
      <div style={{ position: "absolute", inset: 0, padding: "12%", color: "#8196a3", fontFamily: "sans-serif", background: "repeating-linear-gradient(0deg, transparent, transparent 39px, #20313c 40px)" }}>
        <div style={{ fontSize: 30, letterSpacing: 4 }}>{label}</div>
        {[0.8, 0.5, 0.65].map((w, i) => <div key={i} style={{ marginTop: 36, height: 26, width: `${w * 100}%`, background: "#284350", borderRadius: 3 }} />)}
      </div>}
  </div>;
};
const Demo: React.FC<{ show: boolean; light?: boolean }> = ({ show, light }) => show ? <div style={{ position: "absolute", right: 92, top: 106, fontSize: 23, fontFamily: "sans-serif", color: light ? "#655d50" : "#c2d2db", padding: "8px 14px", background: light ? "#e9e1d2" : "#18252e", border: "1px solid currentColor" }}>布局演示 · 非实测数据</div> : null;

const Result: React.FC<CompProps<z.infer<typeof resultSchema>>> = ({ data: d, frame, dur }) => {
  const t = useTheme();
  const split = easeInOut(prog(frame, d.payoffAt, 22));
  const exit = easeIn(prog(frame, dur - 10, 10));
  const W = lerp(1736, 1010, split);
  // 两件证据：同一块素材位先后换图，聚焦环与底部证据行跟着换（第二件出现时第一件淡出）
  const has2 = !!d.proof2 && d.proofNextAt != null;
  const p2 = has2 ? easeInOut(prog(frame, d.proofNextAt as number, 14)) : 0;
  const box = (at: number, len: number) => easeInOut(prog(frame, at, len));
  // 首帧素材就要在场（红线：第 0 帧是完整画面）；圈选环与证据行才从 proofAt 淡入
  const stages = [
    { op: 1 - split, ring: box(d.proofAt, 10), textOp: box(d.proofAt, 10) * (1 - p2) * (1 - split), det: box(d.proofAt, 20), m: d.result as MediaData & { text?: string }, fx: d.focusX, fy: d.focusY, text: d.proof },
    ...(has2 ? [{ op: p2 * (1 - split), ring: p2, textOp: p2 * (1 - split), det: box(d.proofNextAt as number, 20), m: { ...d.proof2!, kind: d.proof2!.kind, src: d.proof2!.src } as MediaData, fx: 0.5, fy: 0.45, text: d.proof2!.text }] : []),
  ];
  return <div data-opening="result-first" style={{ position: "absolute", inset: 0, background: "#0a1416", opacity: 1 - exit, fontFamily: t.font.body }}>
    <div style={{ position: "absolute", left: 92, top: 110, color: "#70e1c5", letterSpacing: 5, fontSize: 23 }}>RESULT / 先给你看</div>
    <div style={{ position: "absolute", left: 92, top: 162, width: 1580, ...textStyle(d.hook, 1580, d.hook.length > 20 ? 62 : 84, t.font.title, "#f0f7f4") }}>{d.hook}</div>
    <div style={{ position: "absolute", left: 92, top: 325, width: W, height: Math.max(...stages.map((s) => Math.round(Math.max(475, Math.min(660, 1736 / Math.max(0.6, s.m.aspect ?? 3.65)))))), borderRadius: 12, overflow: "hidden", border: "1px solid #3a5954", boxShadow: "0 20px 60px #0008" }}>
      {stages.map((s, i) => {
        if (s.op <= 0.001) return null;
        // 素材自适应：按实测宽高比给媒体盒定尺寸（contain 后不留大黑边），聚焦环画在**素材自身**坐标里
        const ar = s.m.aspect ?? 3.65;
        const H = Math.round(Math.max(475, Math.min(660, 1736 / Math.max(0.6, ar))));
        const mw = Math.min(W, Math.round(H * ar));
        const ml = Math.round((W - mw) / 2);
        return <div key={i} style={{ position: "absolute", inset: 0, opacity: s.op }}>
          <div style={{ position: "absolute", left: ml, top: 0, width: mw, height: H, transform: `scale(${1 + s.det * 0.16 * (1 - split)})`, transformOrigin: `${s.fx * 100}% ${s.fy * 100}%` }}><Media data={s.m} frame={frame} label="结果素材位置" /></div>
          <div style={{ position: "absolute", left: ml + s.fx * mw, top: s.fy * H, width: 110 + s.det * 130, height: 80 + s.det * 80, transform: "translate(-50%, -50%)", border: "3px solid #70e1c5", opacity: s.ring * (1 - split), boxShadow: "0 0 0 1600px #07131055" }} />
        </div>;
      })}
    </div>
    <div style={{ position: "absolute", left: 1160, top: 355, width: 660, opacity: split, transform: `translateX(${60 * (1 - split)}px)` }}>
      <div style={{ fontSize: 26, color: "#70e1c5", letterSpacing: 4, marginBottom: 28 }}>01 / 现在就做</div>
      <p style={textStyle(d.payoff, 660, 64, t.font.title, "#f0f7f4")}>{d.payoff}</p>
      <div style={{ height: 3, width: `${split * 100}%`, marginTop: 36, background: "#70e1c5" }} />
    </div>
    {stages.map((s, i) => s.text ? <div key={i} style={{ position: "absolute", left: 92, top: 1006, width: 1460, opacity: s.textOp, ...textStyle(s.text, 1460, 32, t.font.body, "#adcac1") }}>{s.text}</div> : null)}
    <div style={{ position: "absolute", right: 92, top: 926 }}><SourceBadge source={stages[stages.length - 1].m.source} frame={frame} maxWidth={1660} /></div>
    <Demo show={!d.result.src} />
    <OpeningSoundtrack sound={d.sound} proofAt={d.proofAt} payoffAt={d.payoffAt} dur={dur} />
  </div>;
};

const Quiet: React.FC<CompProps<z.infer<typeof quietSchema>>> = ({ data: d, frame, dur }) => {
  const t = useTheme();
  const reveal = easeInOut(prog(frame, d.proofAt, 20));
  const step = easeInOut(prog(frame, d.payoffAt, 20));
  const exit = easeIn(prog(frame, dur - 10, 10));
  return <div data-opening="quiet-question" style={{ position: "absolute", inset: 0, background: "#f2eddf", color: "#292a25", opacity: 1 - exit, fontFamily: t.font.body }}>
    <div style={{ position: "absolute", left: 110, top: 124, display: "flex", alignItems: "center", gap: 22, fontSize: 26, letterSpacing: 5 }}><span style={{ width: 46, height: 3, background: "#9e3827" }} />{d.topic}</div>
    <div style={{ position: "absolute", left: 110, top: lerp(272, 220, reveal), width: 990, ...textStyle(d.hook, 990, 126, t.font.title, "#292a25"), transform: `scale(${lerp(1, 0.94, reveal)})`, transformOrigin: "left top" }}>{d.hook}</div>
    <div style={{ position: "absolute", left: 1110, top: 196, width: 640, height: 430 }}>
      <div style={{ position: "absolute", inset: 0, fontFamily: "Georgia,serif", fontSize: 390, lineHeight: 1, textAlign: "center", color: "#9e3827", opacity: 1 - reveal, transform: `translateY(${-70 * reveal}px)` }}>?</div>
      <svg width={640} height={430} style={{ opacity: reveal }}>
        <path d={`M70 90 C 470 40, 470 180, 160 200 S 30 360, 510 330`} fill="none" stroke="#c8bba6" strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - reveal} />
        {[{ x: 70, y: 90 }, { x: 310, y: 150 }, { x: 160, y: 200 }, { x: 290, y: 333 }].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={10} fill="#9e3827" opacity={(1 - step) * reveal} />)}
        <path d="M70 90 L510 330" fill="none" stroke="#3c6756" strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - step} />
        <circle cx={lerp(70, 510, step)} cy={lerp(90, 330, step)} r={14} fill="#3c6756" opacity={step} />
      </svg>
      <div style={{ position: "absolute", right: 40, bottom: 0, fontSize: 22, color: "#766d5e", opacity: reveal }}>关系示意 · 非统计曲线</div>
    </div>
    <div style={{ position: "absolute", left: 110, top: 540, width: 920, opacity: reveal, transform: `translateY(${28 * (1 - reveal)}px)`, ...textStyle(d.proof, 920, 40, t.font.body, "#766d5e") }}>{d.proof}</div>
    <div style={{ position: "absolute", left: 110, right: 110, top: 758, borderTop: "2px solid #c8bba6", paddingTop: 24, display: "flex", gap: 50, opacity: step, transform: `translateY(${20 * (1 - step)}px)` }}>
      <span style={{ fontSize: 80, color: "#9e3827", fontFamily: "Georgia,serif", lineHeight: 1 }}>01</span>
      <p style={{ ...textStyle(d.payoff, 1450, 48, t.font.title, "#292a25"), width: 1450 }}>{d.payoff}</p>
    </div>
    <OpeningSoundtrack sound={d.sound} proofAt={d.proofAt} payoffAt={d.payoffAt} dur={dur} />
  </div>;
};

const Compare: React.FC<CompProps<z.infer<typeof compareSchema>>> = ({ data: d, frame, dur }) => {
  const t = useTheme();
  const proof = easeInOut(prog(frame, d.proofAt, 22));
  const step = easeInOut(prog(frame, d.payoffAt, 22));
  const exit = easeIn(prog(frame, dur - 10, 10));
  const splitX = lerp(1270, 852, proof);
  return <div data-opening="proof-compare" style={{ position: "absolute", inset: 0, background: "#0c111b", color: "#eef4fc", opacity: 1 - exit, fontFamily: t.font.body }}>
    <div style={{ position: "absolute", left: 100, top: 116, color: "#91a5bd", fontSize: 24, letterSpacing: 5 }}>A / B — 同条件对照</div>
    <div style={{ position: "absolute", left: 100, top: 176, width: 1630, ...textStyle(d.hook, 1630, d.hook.length > 20 ? 62 : 82, t.font.title, "#eef4fc") }}>{d.hook}</div>
    <div style={{ position: "absolute", left: 100, top: 340, width: 1720, height: lerp(450, 350, step), overflow: "hidden", border: "1px solid #36485e" }}>
      <Media data={d.before} frame={frame} label="调整前素材位置" />
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${splitX}px)` }}><Media data={d.after} frame={frame} label="调整后素材位置" /></div>
      <div style={{ position: "absolute", left: splitX, top: 0, bottom: 0, width: 3, background: "#a2d4ff", boxShadow: "0 0 28px #80caff99" }} />
      <div style={{ position: "absolute", left: splitX - 22, top: "50%", width: 46, height: 46, borderRadius: 24, background: "#d9edff", color: "#142433", fontSize: 28, textAlign: "center", lineHeight: "46px", transform: "translateY(-50%)" }}>↔</div>
      <div style={{ position: "absolute", left: 22, top: 18, padding: "8px 16px", background: "#0c111be6", fontSize: 27 }}>A / {d.beforeLabel}</div>
      <div style={{ position: "absolute", right: 22, top: 18, padding: "8px 16px", background: "#173952e6", fontSize: 27 }}>B / {d.afterLabel}</div>
      <div style={{ position: "absolute", left: 18, bottom: 44 }}><SourceBadge source={d.before.source} frame={frame} align="left" maxWidth={780} /></div>
      <div style={{ position: "absolute", right: 18, bottom: 44 }}><SourceBadge source={d.after.source} frame={frame} maxWidth={780} /></div>
    </div>
    <div style={{ position: "absolute", left: 100, top: lerp(814, 714, step), width: 1710, opacity: proof, ...textStyle(d.proof, 1710, 40, t.font.body, "#a6bad2") }}>{d.proof}</div>
    <div style={{ position: "absolute", left: 100, right: 100, top: 830, display: "flex", gap: 32, opacity: step, transform: `translateY(${20 * (1 - step)}px)` }}>
      <div style={{ fontSize: 25, color: "#9ad4ff", paddingTop: 8, whiteSpace: "nowrap" }}>复现 / 01</div>
      <p style={textStyle(d.payoff, 1500, 46, t.font.title, "#eef4fc")}>{d.payoff}</p>
    </div>
    <Demo show={!d.before.src || !d.after.src} />
    <OpeningSoundtrack sound={d.sound} proofAt={d.proofAt} payoffAt={d.payoffAt} dur={dur} />
  </div>;
};

export const ResultFirst: CompDef<z.infer<typeof resultSchema>> = {
  id: "op-result-first", name: "开场 · 结果先行 → 细节举证 → 第一步", layer: "opening", variants: 1, minSec: 6, maxSec: 10,
  tags: ["开场", "实物先行", "证据"], schema: resultSchema, example: {}, C: Result,
  desc: "先展示真实成品或录屏；2秒放大证据细节（可给 proof2 换第二件证据，同一素材位先后两张真图）；兑现时缩为左侧实物，右侧给具体第一步；暗绿展台，无闪白砸字。",
  use: "已经有可展示的真实结果，想先证明值得看再教怎么做；没有结果素材不要选。",
  assetFields: ["result.src", "proof2.src"],
  opening: { script: "template", template: true, selfBg: true, sec: 8, hook: "结果先行", techniques: ["真实结果", "局部聚焦", "分屏教学"], signature: { visual: "result-focus-split", sound: "foley" }, beats: { proof: "proofAt", payoff: "payoffAt" }, requiredData: ["hook", "proof", "payoff", "result.src"] },
};
export const QuietQuestion: CompDef<z.infer<typeof quietSchema>> = {
  id: "op-quiet-question", name: "开场 · 留白反问 → 关系解释 → 行动", layer: "opening", variants: 1, minSec: 6, maxSec: 10,
  tags: ["开场", "留白", "反问"], schema: quietSchema, example: {}, C: Quiet,
  desc: "纸色编辑排版，首帧问题和大留白；问号让位给关系线；绕路收成直达路径，底部第一步接住；默认只留人声。",
  use: "观点、工作方法、认知纠偏；没有真实证据时用解释，不虚构收益或实测数字。",
  opening: { script: "template", template: true, selfBg: true, sec: 8, hook: "冷开场反问", techniques: ["纸色留白", "关系线示意", "行动条"], signature: { visual: "editorial-path", sound: "quiet" }, beats: { proof: "proofAt", payoff: "payoffAt" }, requiredData: ["hook", "proof", "payoff"] },
};
export const ProofCompare: CompDef<z.infer<typeof compareSchema>> = {
  id: "op-proof-compare", name: "开场 · 实物对照 → 差别揭示 → 复现", layer: "opening", variants: 1, minSec: 6, maxSec: 10,
  tags: ["开场", "对照", "证据"], schema: compareSchema, example: {}, C: Compare,
  desc: "真实前后画面由滑动分割线揭示；2秒展开同条件比较，5秒收高为复现步骤腾位；低频悬念，无盖章。",
  use: "相同输入/条件的真实前后对比或工具对比；必须有两张真实图/录屏和来源。",
  assetFields: ["before.src", "after.src"],
  opening: { script: "template", template: true, selfBg: true, sec: 8, hook: "可见差别", techniques: ["滑动比较", "同条件举证", "复现步骤"], signature: { visual: "comparison-slider", sound: "pulse" }, beats: { proof: "proofAt", payoff: "payoffAt" }, requiredData: ["hook", "proof", "payoff", "before.src", "after.src"] },
};
