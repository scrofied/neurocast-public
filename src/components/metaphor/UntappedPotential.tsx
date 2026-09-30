import React from "react";
import { z } from "zod";
import { easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const item = z.object({ text: z.string(), at: z.number().optional() });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  machine: z.object({ label: z.string(), icon: z.string().optional(), at: z.number().optional() }).describe("本来很强的东西，如 AI · 印钞机 / 旗舰手机 / 年卡"),
  used: z.array(item).min(1).max(3).describe("你实际只拿它干的小事（灰色），如 写周报、润色文案"),
  usedPct: z.number().min(1).max(40).default(5).describe("只用了百分之几（环上灰色那一小段）"),
  potential: z.array(item).min(3).max(6).describe("它其实能干的事：揭晓时绕环逐段点亮"),
  revealAt: z.number().optional().describe("揭晓潜力的时刻（锚点，如“印钞机”）"),
  verdict: z.string().default("大材小用"),
  verdictAt: z.number().optional().describe("结论章盖下的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const n = data.potential.length;
  const machineAt = cueOr(data.machine.at, 4);
  const uCues = listCues(data.used, Math.max(machineAt + 16, dur * 0.18), dur * 0.4);
  const revealAt = cueOr(data.revealAt, Math.max(uCues[uCues.length - 1] + 20, dur * 0.5));
  const pCues: number[] = [];
  data.potential.forEach((p, i) => pCues.push(Math.max(i ? pCues[i - 1] + 3 : revealAt, cueOr(p.at, revealAt + 6 + i * 7))));
  const verdictAt = cueOr(data.verdictAt, pCues[n - 1] + 16);
  const cx = width * 0.33;
  const cy = height * 0.55;
  const R = Math.min(230, height * 0.23);
  const SW = 40;
  const m = easeOutBack(prog(frame, machineAt, 18));
  const rv = easeOut(prog(frame, revealAt, 14));
  const used = data.usedPct;
  const seg = (100 - used) / n;
  const uP = easeOut(prog(frame, uCues[0], 16));
  const inner = R - SW / 2 - 22;
  const pulse = 1 + 0.025 * Math.sin(frame / 7) * rv;
  const cols = [t.primary, t.accent, t.secondary];
  // right column: what you actually use it for
  const x0 = width * 0.58;
  const y0 = height * 0.27;
  const chipsTop = y0 + 56;
  const pctTop = chipsTop + data.used.length * 108 + 10;
  const pctP = easeOut(prog(frame, uCues[0], 18));
  const vd = easeOutBack(prog(frame, verdictAt, 10));
  const stampS = frame >= verdictAt ? (prog(frame, verdictAt, 7) < 1 ? 2 - vd : 1) : 0;
  return (
    <>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <g transform={`rotate(-90 ${cx} ${cy})`} opacity={Math.min(1, m)}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={alpha(t.primary, 0.1)} strokeWidth={SW} />
          {/* the tiny slice you use */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#9aa3ad" strokeWidth={SW} pathLength={100} strokeDasharray={`${used * uP} 100`} />
          {data.potential.map((_, i) => {
            const start = used + i * seg + 0.8;
            const len = seg - 1.6;
            const lit = easeOut(prog(frame, pCues[i], 10));
            const c = cols[i % cols.length];
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={R} fill="none" stroke={alpha(t.primary, 0.14)} strokeWidth={SW - 10} pathLength={100} strokeDasharray={`${len} 100`} strokeDashoffset={-start} />
                {lit > 0 && <circle cx={cx} cy={cy} r={R} fill="none" stroke={c} strokeWidth={SW} pathLength={100} strokeDasharray={`${len * lit} 100`} strokeDashoffset={-start} style={{ filter: `drop-shadow(0 0 12px ${alpha(c, 0.8)})` }} />}
              </g>
            );
          })}
        </g>
      </svg>
      {/* the machine */}
      <div
        style={{
          position: "absolute",
          left: cx - inner,
          top: cy - inner,
          width: inner * 2,
          height: inner * 2,
          borderRadius: "50%",
          transform: `scale(${m * pulse})`,
          background: `radial-gradient(circle at 40% 35%, ${alpha(t.primary, 0.25 + 0.3 * rv)}, ${alpha(t.bg2, 0.95)} 72%)`,
          border: `3px solid ${alpha(t.primary, 0.5 + 0.5 * rv)}`,
          boxShadow: `0 0 ${30 + 70 * rv}px ${alpha(t.primary, 0.25 + 0.45 * rv)}, inset 0 0 40px ${alpha(t.primary, 0.2)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={data.machine.icon ?? "zap"} size={inner * 0.95} color={rv > 0.5 ? t.text : alpha(t.text, 0.75)} stroke={1.6} />
      </div>
      <div style={{ position: "absolute", left: cx - 360, width: 720, top: cy + R + 34, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.machine.label, 680, 54, 28), color: t.text, opacity: easeOut(prog(frame, machineAt + 6, 12)), whiteSpace: "nowrap", textShadow: `0 0 20px ${alpha(t.primary, 0.6)}` }}>
        {data.machine.label}
      </div>
      {/* abilities around the ring */}
      {data.potential.map((p, i) => {
        const start = used + i * seg;
        const ang = ((-90 + (start + seg / 2) * 3.6) * Math.PI) / 180;
        const lx = cx + Math.cos(ang) * (R + 118);
        const ly = cy + Math.sin(ang) * (R + 92);
        const pp = easeOutBack(prog(frame, pCues[i], 12));
        if (frame < pCues[i]) return null;
        const c = cols[i % cols.length];
        return (
          <div key={i} style={{ position: "absolute", left: lx, top: ly, transform: `translate(-50%, -50%) scale(${pp})`, padding: "8px 18px", borderRadius: 14, background: alpha(t.bg, 0.8), border: `2px solid ${c}`, boxShadow: `0 0 18px ${alpha(c, 0.5)}`, fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(p.text, 220, 32, 20), color: t.text, whiteSpace: "nowrap" }}>
            {p.text}
          </div>
        );
      })}
      {/* what you actually use it for */}
      <div style={{ position: "absolute", left: x0, top: y0, fontFamily: t.font.body, fontWeight: 700, fontSize: 30, color: t.dim, opacity: easeOut(prog(frame, uCues[0] - 6, 10)) }}>你只拿它来：</div>
      {data.used.map((u, i) => {
        const p = easeOutBack(prog(frame, uCues[i], 12));
        if (frame < uCues[i]) return null;
        return (
          <div key={i} style={{ position: "absolute", left: x0, top: chipsTop + i * 108, width: Math.min(440, width - x0 - 100), height: 88, display: "flex", alignItems: "center", gap: 18, padding: "0 26px", borderRadius: 16, background: "rgba(40,44,52,.85)", border: "2px solid #6b7480", transform: `translateX(${(1 - p) * 60}px) scale(${0.9 + 0.1 * p})`, opacity: Math.min(1, p) * (1 - rv * 0.35), filter: rv > 0 ? `grayscale(${rv})` : undefined }}>
            <Icon name="doc" size={44} color="#c9ced6" />
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(u.text, 420, 46, 24), color: "#dde2e8", whiteSpace: "nowrap" }}>{u.text}</span>
          </div>
        );
      })}
      {frame >= uCues[0] && (
        <div style={{ position: "absolute", left: x0, top: pctTop, display: "flex", alignItems: "baseline", gap: 10, fontFamily: t.font.title, fontWeight: 900, color: t.accent, opacity: pctP, textShadow: "0 4px 20px rgba(0,0,0,.6)" }}>
          <span style={{ fontSize: 40, color: t.dim }}>只用了</span>
          <span style={{ fontSize: 120, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{Math.round(used * pctP)}</span>
          <span style={{ fontSize: 56 }}>%</span>
        </div>
      )}
      {frame >= verdictAt && (
        <div style={{ position: "absolute", left: x0 - 10, top: pctTop + 150, transform: `rotate(-6deg) scale(${stampS})`, transformOrigin: "left center", padding: "10px 30px", border: `6px solid ${t.bad}`, borderRadius: 14, background: "rgba(0,0,0,.4)", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, 520, 78, 34), color: t.bad, whiteSpace: "nowrap", textShadow: `0 0 20px ${alpha(t.bad, 0.6)}` }}>
          {data.verdict}
        </div>
      )}
      {uCues.map((c, i) => (
        <Sfx key={`u${i}`} name="pop" at={c} volume={0.3} />
      ))}
      {revealAt >= 40 && <Sfx name="riser" at={revealAt - 40} volume={0.16} />}
      <Sfx name="sparkle" at={revealAt} volume={0.35} />
      {pCues.map((c, i) => (
        <Sfx key={`p${i}`} name="tick" at={c} volume={0.28} />
      ))}
      <Sfx name="stamp" at={verdictAt} volume={0.5} />
    </>
  );
};

export const UntappedPotential: CompDef<D> = {
  id: "untapped-potential",
  name: "大材小用（潜力只用了一点点）",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["大材小用", "只用了", "潜力", "浪费", "当成", "印钞机"],
  desc: "一台发光的“机器”外面套一圈能力环，你只用了灰色的一小段（右侧灰卡：写周报…、“只用了 5%”）；揭晓时环上其余能力逐段点亮、标签弹出，最后红章盖下结论",
  use: "很强的东西只被用来干小事：AI 只拿来写周报、旗舰手机只打电话、健身年卡只去洗澡、数据库只当记事本（machine / used / potential 全可改）",
  schema,
  example: {
    machine: { label: "AI · 印钞机", icon: "bot" },
    used: [{ text: "写周报" }, { text: "润色文案" }],
    usedPct: 5,
    potential: [{ text: "做小工具" }, { text: "做网站" }, { text: "自动化" }, { text: "数据核对" }, { text: "批量处理" }],
    verdict: "当打字机用",
  },
  C,
};
