import React from "react";
import { z } from "zod";
import { easeIn, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake, StampBox } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  mode: z.enum(["brake", "fuse"]).optional().describe("brake 小车冲向悬崖被栏杆拦停（默认）；fuse 电流冲向目标，保险丝炸断"),
  actor: z.string().describe("冲过来的东西：AI 全自动发货 / 你的情绪 / 每天的消费"),
  actorIcon: z.string().optional().describe("图标名"),
  hazard: z.string().describe("前面的危险：客户退款纠纷 / 删库 / 爆仓"),
  rule: z.string().describe("救命的那条规矩：退款必须人工确认"),
  ruleNote: z.string().optional(),
  goAt: z.number().optional(),
  hazardAt: z.number().optional(),
  brakeAt: z.number().optional().describe("刹住的时刻（锚点）"),
  ruleAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const Brake: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const goAt = cueOr(data.goAt, Math.round(dur * 0.06));
  const brakeAt = cueOr(data.brakeAt, Math.round(dur * 0.52));
  const hazardAt = cueOr(data.hazardAt, Math.max(goAt + 12, brakeAt - 18));
  const ruleAt = cueOr(data.ruleAt, brakeAt + 20);
  const G = H * (full ? 0.62 : 0.6);
  const edge = W * (full ? 0.74 : 0.78);
  const cw = full ? 220 : 120;
  const chh = full ? 116 : 64;
  const x0 = -cw * 0.5;
  const stopX = edge - cw - (full ? 20 : 10);
  const skidLen = full ? 100 : 55;
  const xBrake = stopX - skidLen;
  const run = prog(frame, goAt, Math.max(8, brakeAt - goAt));
  let cx = frame < brakeAt ? lerp(x0, xBrake, Math.pow(run, 1.7)) : lerp(xBrake, stopX, easeOut(prog(frame, brakeAt, 16)));
  cx = Math.min(cx, stopX);
  const skid = frame >= brakeAt && frame < brakeAt + 16;
  const stopped = frame >= brakeAt + 16;
  const tiltBase = frame > goAt ? 1.5 : 0;
  const tilt = skid ? -6 * (1 - prog(frame, brakeAt, 16)) : stopped ? 2 * Math.sin((frame - brakeAt - 16) * 0.5) * Math.exp(-(frame - brakeAt - 16) * 0.08) : tiltBase;
  const sh = hitShake(frame, [brakeAt], full ? 16 : 8, 14);
  const hz = easeOutBack(prog(frame, hazardAt, 14));
  const armDrop = easeIn(prog(frame, brakeAt - 5, 6));
  const barrierX = stopX + cw + 4;
  const red = frame >= hazardAt && frame < brakeAt + 30 ? 0.5 + 0.5 * Math.sin(frame * 0.8) : 0;
  const speed = frame < brakeAt ? Math.pow(run, 0.7) : 0;
  const icon = data.actorIcon ?? guessIcon(data.actor) ?? "robot";
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <rect x={0} y={G} width={edge} height={14} fill={alpha(t.primary, 0.25)} />
        <line x1={0} y1={G} x2={edge} y2={G} stroke={t.primary} strokeWidth={3} />
        {Array.from({ length: 14 }).map((_, i) => {
          const step = full ? 130 : 78;
          const off = (cx * 0.55) % step;
          const x = i * step - off;
          if (x < -20 || x > edge - 10) return null;
          return <rect key={i} x={x} y={G + (full ? 34 : 20)} width={step * 0.46} height={4} fill={alpha(t.text, 0.15)} />;
        })}
        <path d={`M ${edge} ${G} l 16 60 l -10 80 l 14 ${H - G - 140}`} fill="none" stroke={alpha(t.bad, 0.4 + 0.5 * hz)} strokeWidth={4} />
        <rect x={edge + 8} y={G} width={W - edge} height={H - G} fill={alpha(t.bad, hz * 0.07)} />
        {hz > 0 && Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={edge - 6 + (i % 2) * 10} y={G - 6 - i * 11} width={full ? 18 : 10} height={9} rx={2} fill={alpha(t.bad, 0.3 + red * 0.2)} />
        ))}
        {frame >= brakeAt && (
          <g opacity={0.6}>
            <line x1={xBrake + cw * 0.2} y1={G - 5} x2={cx + cw * 0.2} y2={G - 5} stroke={alpha(t.text, 0.5)} strokeWidth={5} strokeLinecap="round" />
            <line x1={xBrake + cw * 0.8} y1={G - 5} x2={cx + cw * 0.8} y2={G - 5} stroke={alpha(t.text, 0.5)} strokeWidth={5} strokeLinecap="round" />
          </g>
        )}
        {speed > 0.18 && Array.from({ length: 5 }).map((_, i) => {
          const ly = G - chh * (0.15 + i * 0.15);
          const len = (full ? 210 : 110) * speed * (0.6 + 0.4 * Math.sin(i * 2.2));
          return <line key={i} x1={cx - len} y1={ly} x2={cx - 10} y2={ly} stroke={alpha(t.primary, 0.5 * speed)} strokeWidth={3} strokeLinecap="round" />;
        })}
        <rect x={barrierX - 8} y={G - chh * 1.5} width={16} height={chh * 1.5} rx={4} fill={alpha(t.bg2, 0.95)} stroke={t.gold} strokeWidth={3} />
        <g transform={`rotate(${lerp(-88, 0, armDrop)}, ${barrierX}, ${G - chh * 1.5})`}>
          <rect x={barrierX - cw * 1.05} y={G - chh * 1.5 - (full ? 15 : 9)} width={cw * 1.05} height={full ? 20 : 12} rx={5} fill={t.gold} />
          {Array.from({ length: 5 }).map((_, i) => (
            <rect key={i} x={barrierX - cw * 1.05 + i * cw * 0.21 + 6} y={G - chh * 1.5 - (full ? 15 : 9)} width={cw * 0.1} height={full ? 20 : 12} fill={t.bad} />
          ))}
        </g>
      </svg>
      <div style={{ position: "absolute", left: cx, top: G - chh, width: cw, height: chh, transform: `translate(${sh.x}px, ${sh.y}px) rotate(${tilt}deg)`, transformOrigin: "50% 100%", borderRadius: full ? 16 : 10, background: `linear-gradient(160deg, ${alpha(t.primary, 0.28)}, ${alpha(t.bg2, 0.95)})`, border: `3px solid ${alpha(t.primary, 0.75)}`, boxShadow: `0 0 ${full ? 34 : 18}px ${alpha(t.primary, 0.38)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, overflow: "hidden" }}>
        <Icon name={icon} size={chh * 0.38} color={t.primary} />
        <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.actor, cw * 0.86, chh * 0.22, 11), color: t.text, whiteSpace: "nowrap" }}>{data.actor}</div>
        <div style={{ position: "absolute", left: cw * 0.1, bottom: -10, width: full ? 36 : 22, height: full ? 36 : 22, borderRadius: "50%", border: `5px solid ${t.dim}`, background: t.bg2 }} />
        <div style={{ position: "absolute", right: cw * 0.1, bottom: -10, width: full ? 36 : 22, height: full ? 36 : 22, borderRadius: "50%", border: `5px solid ${t.dim}`, background: t.bg2 }} />
      </div>
      {hz > 0 && <div style={{ position: "absolute", left: edge + 10, top: G - (full ? 66 : 36), width: W - edge - 20, textAlign: "center", opacity: hz, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.hazard, W - edge - 28, full ? 34 : 18, 12), color: t.bad, whiteSpace: "nowrap", textShadow: "0 3px 0 #000" }}>{data.hazard}</div>}
      <Sfx name="whoosh" at={goAt} volume={0.18} />
      <Sfx name="riser" at={Math.max(0, hazardAt - 34)} volume={0.16} />
      <Sfx name="stamp" at={brakeAt} volume={0.45} />
      <Sfx name="ding" at={ruleAt} volume={0.28} />
    </>
  );
};

const Fuse: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const goAt = cueOr(data.goAt, 4);
  const brakeAt = cueOr(data.brakeAt, Math.round(dur * 0.52));
  const hazardAt = cueOr(data.hazardAt, Math.max(4, brakeAt - 18));
  const ruleAt = cueOr(data.ruleAt, brakeAt + 18);
  const wy = H * (full ? 0.5 : 0.48);
  const xS = W * (full ? 0.07 : 0.05);
  const xF = W * (full ? 0.5 : 0.48);
  const xT = W * (full ? 0.84 : 0.86);
  const fw = full ? 100 : 60;
  const fh = full ? 38 : 24;
  const surgeK = easeInOut(prog(frame, goAt, brakeAt - goAt));
  const surgeX = lerp(xS, xF - fw / 2, surgeK);
  const blown = frame >= brakeAt;
  const blowK = prog(frame, brakeAt, 14);
  const curl = easeOut(blowK);
  const icon = data.actorIcon ?? guessIcon(data.actor) ?? "zap";
  const tIcon = guessIcon(data.hazard) ?? "box";
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <line x1={xS} y1={wy} x2={xF - fw / 2} y2={wy} stroke={blown ? alpha(t.dim, 0.35) : t.text} strokeWidth={6} strokeLinecap="round" />
        {!blown && (
          <>
            <circle cx={surgeX} cy={wy} r={full ? 22 : 13} fill={t.bad} style={{ filter: `drop-shadow(0 0 ${full ? 22 : 12}px ${t.bad})` }} />
            <circle cx={surgeX} cy={wy} r={full ? 10 : 6} fill="#fff" opacity={0.6} />
          </>
        )}
        <line x1={xF + fw / 2} y1={wy} x2={xT} y2={wy} stroke={blown ? alpha(t.dim, 0.3) : t.text} strokeWidth={6} strokeLinecap="round" />
        <circle cx={xS} cy={wy} r={8} fill={t.text} />
        <circle cx={xT} cy={wy} r={8} fill={t.text} />
        <rect x={xF - fw / 2} y={wy - fh / 2} width={fw} height={fh} rx={fh / 2} fill="none" stroke={blown ? t.bad : t.text} strokeWidth={3} />
        {!blown ? (
          <path d={`M ${xF - fw / 2 + 8} ${wy} q ${fw * 0.12} ${-fh * 0.28} ${fw * 0.25} 0 t ${fw * 0.25} 0 t ${fw * 0.25 - 16} 0`} fill="none" stroke={surgeK > 0.8 ? t.bad : t.gold} strokeWidth={3} />
        ) : (
          <>
            <path d={`M ${xF} ${wy} q ${-fw * 0.1} ${-fh * 0.5 * curl} ${-fw * 0.22 * curl} ${-fh * 0.3 * curl}`} fill="none" stroke={t.bad} strokeWidth={3} />
            <path d={`M ${xF} ${wy} q ${fw * 0.1} ${fh * 0.5 * curl} ${fw * 0.22 * curl} ${fh * 0.3 * curl}`} fill="none" stroke={t.bad} strokeWidth={3} />
          </>
        )}
        {blown && blowK < 1 && Array.from({ length: 12 }).map((_, k) => {
          const a = (k / 12) * Math.PI * 2;
          const r = easeOut(blowK) * (full ? 60 : 36);
          return <circle key={k} cx={xF + Math.cos(a) * r} cy={wy + Math.sin(a) * r} r={(full ? 8 : 5) * (1 - blowK)} fill={t.bad} opacity={1 - blowK} />;
        })}
        <rect x={xT + 10} y={wy - (full ? 68 : 40)} width={full ? 140 : 90} height={full ? 130 : 78} rx={14} fill={blown ? alpha(t.primary, 0.16) : alpha(t.bg2, 0.9)} stroke={blown ? t.primary : alpha(t.text, 0.5)} strokeWidth={3} />
      </svg>
      <div style={{ position: "absolute", left: xT + 10, top: wy + (full ? 68 : 40) + 4, width: full ? 140 : 90, textAlign: "center" }}>
        <Icon name={tIcon} size={full ? 50 : 30} color={blown ? t.primary : t.dim} />
        <div style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(data.hazard, full ? 130 : 86, full ? 22 : 13, 10), color: blown ? t.primary : t.dim, whiteSpace: "nowrap", marginTop: 4 }}>{data.hazard}</div>
      </div>
      <div style={{ position: "absolute", left: xS - 50, width: 100, top: wy + (full ? 36 : 22), textAlign: "center", fontFamily: t.font.body, fontWeight: 900, fontSize: full ? 24 : 14, color: t.bad, whiteSpace: "nowrap" }}>
        <Icon name={icon} size={full ? 28 : 18} color={t.bad} style={{ verticalAlign: "-4px", marginRight: 6 }} />{data.actor}
      </div>
      <div style={{ position: "absolute", left: xF - 80, width: 160, top: wy - fh / 2 - (full ? 44 : 26), textAlign: "center", fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 22 : 14, color: t.gold, letterSpacing: 2 }}>保险丝</div>
      <Sfx name="riser" at={Math.max(0, hazardAt - 30)} volume={0.14} />
      <Sfx name="glitch" at={brakeAt} volume={0.45} />
      <Sfx name="ding" at={ruleAt} volume={0.28} />
    </>
  );
};

const RuleCard: React.FC<{ data: D; frame: number; dur: number }> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const brakeAt = cueOr(data.brakeAt, Math.round(dur * 0.5));
  const ruleAt = cueOr(data.ruleAt, brakeAt + 20);
  const size = fitFont(data.rule, W * 0.7, full ? 54 : 28, 16);
  const y = full ? H * 0.8 : H * 0.83;
  return (
    <>
      <StampBox text={data.rule} at={ruleAt} frame={frame} x={W / 2} y={y} size={size} color={t.primary} rot={-3} />
      {data.ruleNote && (
        <div style={{ position: "absolute", left: 0, right: 0, top: y + size * 0.9, textAlign: "center", opacity: easeOut(prog(frame, ruleAt + 10, 12)), fontFamily: t.font.body, fontSize: full ? 24 : 14, color: t.dim, whiteSpace: "nowrap" }}>
          {data.ruleNote}
        </div>
      )}
    </>
  );
};

const C: React.FC<CompProps<D>> = (p) => {
  const { width: W } = useBox();
  const full = W >= 900;
  return (
    <>
      {full && <Heading kicker={p.data.kicker} title={p.data.title} frame={p.frame} width={W} />}
      {p.data.mode === "fuse" ? <Fuse {...p} /> : <Brake {...p} />}
      <RuleCard data={p.data} frame={p.frame} dur={p.dur} />
    </>
  );
};

export const SafetyBrake: CompDef<D> = {
  id: "safety-brake",
  name: "紧急制动 / 保险丝",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 9,
  tags: ["规矩", "红线", "刹车", "保护", "止损", "人工复核", "保险丝"],
  motion: { kind: "brake：小车加速冲向悬崖被栏杆拦住急刹；fuse：电流冲向目标保险丝炸断", energy: 3 },
  desc: "brake：一辆写着 actor 的小车从左加速冲向悬崖（hazard 写在崖边），最后一刻栏杆砸下、车急刹停在崖边晃动；fuse：电流沿电线冲向目标，保险丝在中间烧红炸断，目标保持完好。最后盖出救命规矩 rule",
  use: "关键时刻的规矩：AI 不能碰的红线、签字前必须人工复核、每天止损线、上线前最后一道审批；以及「差点翻车但被拦住了」",
  panel: true,
  schema,
  example: { mode: "brake", actor: "AI 全自动发货", actorIcon: "robot", hazard: "客户退款纠纷", rule: "退款必须人工确认", ruleNote: "只有这一步不交给 AI" },
  C,
};
