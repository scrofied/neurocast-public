import React from "react";
import { z } from "zod";
import { Img, staticFile } from "remotion";
import { clamp, easeInOut, easeOutBack, prog } from "../../lib/anim";
import { Flash, RingBurst, Scrim, SpeedLines } from "../../lib/cine/Flash";
import { CharPop, Counter, Slam, Strike, Wipe } from "../../lib/cine/Type";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, ink, rnd, Stage, tpl } from "../templates/kit";

// 《Codex 必装的 5 个神级 Skill》专属开场 v5（2026-10-07 第 7 轮画面整改）
// 0~3s：不透明冲击层——「比通用大模型强大」砸出 + 右侧「100倍」大数字（审核原因：不点名、不放任何真实产品图标做贬损对比）
// revAt：划掉 → revAt+12 整层向左甩出退场
// codexAt：【Codex 单独镜头】Codex 官方图标居中砸出 + 金字 Codex + 一定要学会
// panelOut：揭幕真人全屏（仅到 full=6.5s 收窗），大字「今天给大家分享」
// fiveAt 起：舞台层「5个 Codex」+ 代码窗口动画（打字 → 进度条停在 50% → 后半灰化）隐喻「只用了一半的能力」
type D = z.infer<typeof s>;
const s = z.object({
  kick: z.string().default("有一个 AI").describe("首行小字（逐字弹出）"),
  big: z.string().default("比通用大模型强大").describe("左列大字（不点名的对比钩子，锚「不会」时划掉）"),
  num: z.number().default(100).describe("第一个数字（锚「100 倍」）"),
  unit: z.string().default("倍").describe("数字单位"),
  rev: z.string().default("Codex").describe("翻案金字（锚「一定」，单独镜头）"),
  share: z.string().default("今天给大家分享").describe("揭幕全屏大字（锚「今天」）"),
  num2: z.number().default(5).describe("第二个数字（锚「5 个」）"),
  label2: z.string().default("Codex 神级 skill").describe("数字后的说明（锚「神级」）"),
  pill: z.string().default("只用了一半的能力").describe("收束胶囊（锚「一半」）"),
  panelOut: z.number().default(158).describe("冲击层退场（真人揭幕）的帧号，默认 158≈5.3s"),
  numAt: z.number().default(30).describe("100 倍砸出（锚「100 倍」）"),
  revAt: z.number().default(85).describe("划掉大字（锚「不会」）"),
  codexAt: z.number().default(128).describe("Codex 单独镜头（锚「一定」）"),
  shareAt: z.number().default(170).describe("今天给大家分享（锚「今天」）"),
  fiveAt: z.number().default(190).describe("5 滚动（锚「5 个」）"),
  labAt: z.number().default(225).describe("神级 skill 擦出 + 代码窗口开始打字（锚「神级」）"),
  halfAt: z.number().default(300).describe("进度条锁 50% + 胶囊弹出（锚「一半」）"),
  aspect: z.number().optional(),
  kind: z.string().optional(),
});

const CX = "opening-assets/codex-100x/cx_icon.png"; // Codex 官方图标（VS Code Marketplace 扩展图标，白色六边形结，透明底）

/** Codex 单独镜头：Codex 官方图标居中砸出 + 金字 Codex + 一定要学会 */
const CodexSolo: React.FC<{ frame: number; at: number; label: string }> = ({ frame, at, label }) => {
  const t = useTheme();
  const slam = prog(frame, at, 6);
  const back = 1 + (1 - slam) * 0.5;
  const sub = prog(frame, at + 8, 6);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 130, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Img src={staticFile(CX)} width={520} height={520} style={{ display: "block", transform: `scale(${back})`, filter: `drop-shadow(0 0 60px ${alpha(t.gold, 0.45)})`, opacity: clamp(slam * 4) }} />
      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 26 }}>
        <Slam frame={frame} at={at} text={label} size={170} color={t.gold} font={t.font.title} from={1.45} len={6} blur={4} minOpacity={0.9} strokeW={13} style={{ display: "inline-block" }} />
        <span style={{ ...ink(62, alpha(t.text, 0.95), t.font.title, 8), display: "inline-block", opacity: clamp(sub * 3) }}>一定要学会</span>
      </div>
    </div>
  );
};

/** 代码窗口隐喻：labAt 起逐行打字，进度条只走到 50%；halfAt 进度条锁死、后半代码灰掉、红「50%」砸出 */
const CodeWindow: React.FC<{ frame: number; labAt: number; halfAt: number }> = ({ frame, labAt, halfAt }) => {
  const t = useTheme();
  if (frame < labAt - 2) return null;
  const pop = easeOutBack(prog(frame, labAt - 2, 8));
  const lines = Array.from({ length: 8 }, (_, i) => ({ w: 0.34 + 0.52 * rnd(i, 7), kw: 60 + 34 * rnd(i, 3), at: labAt + 10 + i * 9 }));
  const fill = prog(frame, labAt + 10, halfAt - labAt - 16); // 进度条在 halfAt 前刚好走到 50%
  const lock = prog(frame, halfAt, 6);
  const badge = easeOutBack(prog(frame, halfAt + 2, 8));
  return (
    <div style={{ position: "absolute", left: 724, top: 288, width: 660, opacity: clamp(pop * 3), transform: `scale(${0.7 + 0.3 * pop}) translateY(${(1 - pop) * 60}px)`, transformOrigin: "50% 0%", borderRadius: 16, overflow: "hidden", background: alpha(t.bg, 0.88), border: `3px solid ${lock > 0 ? alpha(t.bad, 0.55 + 0.35 * Math.sin(lock * Math.PI)) : alpha(t.text, 0.28)}`, boxShadow: "0 18px 50px rgba(0,0,0,.55)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: alpha(t.bg2, 0.95), borderBottom: `2px solid ${alpha(t.text, 0.14)}` }}>
        <Img src={staticFile(CX)} width={30} height={30} style={{ borderRadius: 8 }} />
        <span style={{ ...ink(26, t.text, t.font.mono ?? t.font.title, 4) }}>Codex 写代码</span>
        <span style={{ marginLeft: "auto", ...ink(24, alpha(t.text, 0.55), t.font.title, 3) }}>skill 未启用</span>
      </div>
      <div style={{ padding: "16px 20px 10px", display: "flex", flexDirection: "column", gap: 12 }}>
        {lines.map((l, i) => {
          const on = frame >= l.at;
          const dim = i >= 4 && lock > 0; // 后半段代码被锁灰
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: on ? (dim ? 0.22 : 1) : 0, transform: `translateX(${on ? 0 : -24}px)`, transition: "none", filter: dim ? "grayscale(1)" : undefined }}>
              <span style={{ width: 30, ...ink(20, alpha(t.text, 0.35), t.font.title, 0) }}>{i + 1}</span>
              <span style={{ width: l.kw, height: 20, borderRadius: 6, background: i % 3 === 0 ? alpha(t.gold, 0.85) : i % 3 === 1 ? alpha(t.primary, 0.8) : alpha(t.accent ?? t.secondary, 0.75) }} />
              <span style={{ width: `${l.w * 100}%`, height: 20, borderRadius: 6, background: alpha(t.text, 0.3) }} />
            </div>
          );
        })}
      </div>
      <div style={{ padding: "8px 20px 16px" }}>
        <div style={{ position: "relative", height: 16, borderRadius: 999, background: alpha(t.text, 0.12), overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${50 * fill}%`, borderRadius: 999, background: `linear-gradient(90deg, ${t.gold}, ${alpha(t.gold, 0.7)})`, boxShadow: `0 0 14px ${alpha(t.gold, 0.6)}` }} />
        </div>
      </div>
      {frame >= halfAt + 2 && (
        <div style={{ position: "absolute", right: 18, top: 46, opacity: clamp(badge * 3), transform: `scale(${badge})`, transformOrigin: "50% 0%" }}>
          <span style={{ ...ink(64, t.bad, t.font.title, 10), whiteSpace: "nowrap" }}>50%</span>
        </div>
      )}
    </div>
  );
};

const C: React.FC<CompProps<D> & { presenter?: boolean }> = ({ data: d, frame, dur, seed, presenter }) => {
  const t = useTheme();
  const reveal = d.panelOut; // 冲击层退场、真人揭幕
  const po = frame < reveal ? 1 : clamp(1 - (frame - reveal) / 4);
  const numIn = prog(frame, d.numAt, 8);
  const grpOut = prog(frame, d.revAt + 12, 12); // 划掉后整层向左甩出
  const soloIn = prog(frame, d.codexAt, 8);
  const fiveIn = prog(frame, d.fiveAt, 8);
  const labIn = prog(frame, d.labAt, 8);
  const pillIn = easeOutBack(prog(frame, d.halfAt, 8));
  const shareOut = d.fiveAt - 8; // 「今天给大家分享」在 5 滚动前淡出
  const shareIn = prog(frame, d.shareAt, 6);

  return (
    <>
      <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 12, len: 9 }, { at: d.numAt, amp: 12, len: 8 }, { at: d.revAt, amp: 7, len: 5 }, { at: d.codexAt, amp: 11, len: 8 }, { at: reveal, amp: 5, len: 4 }, { at: d.fiveAt, amp: 10, len: 7 }, { at: d.halfAt, amp: 9, len: 6 }]} exit="up">
        <Flash frame={frame} at={0} len={8} peak={0.4} />
        <Flash frame={frame} at={d.numAt} len={6} peak={0.34} color={t.gold} />
        <Flash frame={frame} at={d.codexAt} len={7} peak={0.4} color={t.gold} />
        <Flash frame={frame} at={reveal} len={6} peak={0.22} />
        <Flash frame={frame} at={d.fiveAt} len={7} peak={0.34} color={t.gold} />
        {frame >= d.codexAt && frame < d.codexAt + 16 && <RingBurst frame={frame} at={d.codexAt} x={960} y={430} color={t.gold} maxR={460} len={15} />}
        {frame >= d.halfAt && frame < d.halfAt + 16 && <RingBurst frame={frame} at={d.halfAt} x={1330} y={900} color={t.gold} maxR={300} len={14} />}
        {frame >= d.numAt && frame < d.numAt + 12 && <SpeedLines frame={frame} at={d.numAt} x={1450} y={560} color={t.gold} len={12} count={22} />}
        {frame >= d.codexAt && frame < d.codexAt + 12 && <SpeedLines frame={frame} at={d.codexAt} x={960} y={430} color={t.gold} len={12} count={26} />}

        {/* ── 0~5.3s 不透明冲击层（超边 100px 防抖动漏边）：A=对比大字+100倍数字组，revAt+12 甩出；B=Codex 单独镜头 ── */}
        {frame < reveal + 4 && (
          <div style={{ position: "absolute", left: -100, top: -100, width: 2120, height: 1280, opacity: po, transform: `scale(${1 + (1 - po) * 0.05})` }}>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(1300px 900px at 50% 40%, ${alpha(t.secondary, 0.30)}, transparent 62%), linear-gradient(168deg, ${t.bg} 0%, ${t.bg2} 100%)` }} />
            {/* A 组：kicker + 左列大字 + 右侧「100倍」大数字，同帧出场；划掉后一起向左甩出 */}
            <div style={{ position: "absolute", inset: 0, opacity: 1 - grpOut, transform: `translateX(${grpOut * -980}px) rotate(${grpOut * -4}deg)`, pointerEvents: "none" as const }}>
              <div style={{ position: "absolute", left: 204, top: 230 }}>
                <CharPop frame={frame} at={0} text={d.kick} cues={Array.from(d.kick).map((_, i) => i)} hl={[]} size={52} color={t.text} font={t.font.title} strokeW={6} />
              </div>
              <div style={{ position: "absolute", left: 204, top: 330 }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <Slam frame={frame} at={0} text={d.big} size={126} color={t.text} font={t.font.title} from={1.5} len={6} blur={4} minOpacity={0.9} strokeW={11} style={{ display: "inline-block", transformOrigin: "left center" }} />
                  {frame >= d.revAt && <Strike frame={frame} at={d.revAt} color={t.bad} len={7} thickness={13} />}
                </div>
              </div>
              <div style={{ position: "absolute", left: 1120, top: 300, display: "flex", alignItems: "baseline", gap: 18, transform: `translateY(${(1 - numIn) * 130}px) scale(${1 + (1 - numIn) * 0.4})`, opacity: frame >= d.numAt - 1 ? clamp(numIn * 3) : 0 }}>
                <Counter frame={frame} at={d.numAt} from={0} to={d.num} size={300} color={t.gold} font={t.font.title} strokeW={15} style={{ display: "inline-block" }} />
                <span style={{ ...ink(160, t.gold, t.font.title, 10), display: "inline-block" }}>{d.unit}</span>
              </div>
            </div>
            {/* B 组：Codex 单独镜头（A 组已甩出，画面只有 Codex） */}
            {frame >= d.codexAt && (
              <div style={{ position: "absolute", inset: 0, opacity: clamp(soloIn * 3) }}>
                <CodexSolo frame={frame} at={d.codexAt} label={d.rev} />
              </div>
            )}
          </div>
        )}

        {/* 真人全屏（5.3~6.5s）时左侧压暗保证大字可读（人已被 camera 右移） */}
        {presenter && frame >= reveal - 4 && frame < d.fiveAt + 30 && <Scrim side="left" size={0.6} strength={0.6} />}

        {/* 揭幕全屏大字：「今天给大家分享」→ 5 滚动前淡出 */}
        {frame >= reveal && (
          <div style={{ position: "absolute", left: 104, top: 300, opacity: frame >= shareOut ? clamp(1 - (frame - shareOut) / 8) : clamp(shareIn * 2.5) }}>
            <Slam frame={frame} at={d.shareAt} text={d.share} size={126} color={t.text} font={t.font.title} from={1.35} len={6} blur={4} minOpacity={0.9} strokeW={11} style={{ display: "inline-block", transformOrigin: "left center" }} />
          </div>
        )}

        {/* 6.6s 起：真人收进右上 LIVE，「5 个」动画 + 代码窗口在舞台层入场 */}
        {frame >= d.fiveAt - 2 && (
          <div style={{ position: "absolute", left: 104, top: 560, display: "flex", alignItems: "baseline", gap: 16, opacity: clamp(fiveIn * 3), transform: `translateY(${(1 - fiveIn) * 90}px)` }}>
            <Counter frame={frame} at={d.fiveAt} from={0} to={d.num2} size={230} color={t.gold} font={t.font.title} strokeW={13} style={{ display: "inline-block" }} />
            <span style={{ ...ink(104, t.gold, t.font.title, 9), display: "inline-block" }}>个</span>
            <span style={{ ...ink(72, t.text, t.font.title, 8), display: "inline-block", opacity: clamp(labIn * 3) }}>Codex</span>
          </div>
        )}
        {frame >= d.labAt && (
          <div style={{ position: "absolute", left: 118, top: 830 }}>
            <Wipe frame={frame} at={d.labAt} text={d.label2} size={76} color={t.text} font={t.font.title} len={8} edge={t.primary} strokeW={9} />
          </div>
        )}
        <CodeWindow frame={frame} labAt={d.labAt} halfAt={d.halfAt} />

        {/* ~11.2s：胶囊「只用了一半的能力」（代码窗口同时锁 50%） */}
        {frame >= d.halfAt - 2 && (
          <div style={{ position: "absolute", left: 104, top: 950, opacity: clamp(pillIn * 3), transform: `scale(${0.6 + 0.4 * pillIn})`, transformOrigin: "left center" }}>
            <div style={{ padding: "14px 30px", borderRadius: 999, background: alpha(t.bg, 0.62), border: `4px solid ${alpha(t.gold, 0.9)}`, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
              <span style={{ ...ink(46, t.text, t.font.title, 7), whiteSpace: "nowrap" }}>{d.pill}</span>
            </div>
          </div>
        )}

        <Sfx name="impact" at={0} volume={0.5} />
        <Sfx name="riser" at={d.numAt - 12} volume={0.18} />
        <Sfx name="impact" at={d.numAt} volume={0.48} />
        <Sfx name="stamp" at={d.revAt} volume={0.38} />
        <Sfx name="whoosh" at={d.revAt + 12} volume={0.3} />
        <Sfx name="riser" at={d.codexAt - 10} volume={0.16} />
        <Sfx name="impact" at={d.codexAt} volume={0.5} />
        <Sfx name="ding" at={d.codexAt + 8} volume={0.4} />
        <Sfx name="whoosh" at={reveal} volume={0.3} />
        <Sfx name="impact" at={d.shareAt} volume={0.4} />
        <Sfx name="riser" at={d.fiveAt - 18} volume={0.2} />
        <Sfx name="impact" at={d.fiveAt} volume={0.4} />
        <Sfx name="whoosh" at={d.labAt} volume={0.22} />
        <Sfx name="typing" at={d.labAt + 10} volume={0.24} />
        <Sfx name="stamp" at={d.halfAt} volume={0.42} />
        <Sfx name="ding" at={d.halfAt + 6} volume={0.4} />
        <Sfx name="whoosh" at={dur - 10} volume={0.25} />
      </Stage>
    </>
  );
};

export const OpeningCodex100x: CompDef<D> = {
  ...tpl<D>({
    id: "opening-codex-100x",
    name: "开场 · 大字对比钩子f0砸出+100倍大数字→划掉甩出→Codex 官方图标单独镜头→真人全屏2秒→代码窗口锁50%",
    hook: "数字冲击+对比翻案+代码隐喻（不点名、不贬损任何真实产品）",
    desc: "0~5.3s 不透明层：「比通用大模型强大」砸出、右侧「100倍」大数字锚「100 倍」砸出；锚「不会」划掉、revAt+12 整层甩出；锚「一定」Codex Codex 官方图标居中砸出单独镜头；锚「今天」揭幕真人全屏（仅 ~1.2s+收窗），「今天给大家分享」；锚「5 个」收右上 LIVE，舞台层计数 + 代码窗口打字、进度条锁 50% 隐喻「只用了一半的能力」",
    use: "只给《Codex 必装的 5 个神级 Skill》用（开场不重样）",
    techniques: ["首帧大字", "大数字砸出", "划掉甩出转场", "单独镜头砸图标", "闪白+冲击音", "数字滚动", "揭幕转场", "代码窗口打字", "进度条锁50%", "胶囊收束+ding"],
    schema: s,
    C,
    camera: (dd, f, dur2) =>
      cam(f, dur2, {
        // 真人右移让出左列大字区；shareAt+24（≈presenter.full=6.5s）前平滑回中，衔接收窗不跳位
        x: 260 * (1 - easeInOut(prog(f, dd.shareAt + 14, 10))),
        punches: [{ at: dd.numAt, amt: 0.06 }, { at: dd.revAt, amt: 0.05 }, { at: dd.codexAt, amt: 0.08 }, { at: dd.panelOut, amt: 0.05 }, { at: dd.shareAt, amt: 0.05 }, { at: dd.fiveAt, amt: 0.06 }, { at: dd.halfAt, amt: 0.05 }],
      }),
  }),
  noGallery: true,
  opening: {
    script: "../../../neurocast-codex-5skills",
    hook: "数字冲击+对比翻案+代码隐喻（不点名真实产品）",
    techniques: ["大数字砸出", "划掉甩出转场", "单独镜头砸图标", "代码窗口打字", "进度条锁50%"],
  },
};
