import React from "react";
import { z } from "zod";
import { easeIn, easeInOut, easeOut, lerp, prog } from "../../lib/anim";
import { hitShake } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { Figure, POSES, mixPose } from "../../lib/figure";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  mode: z.enum(["lever", "moat"]).optional().describe("lever 杠杆撬动（默认）；moat 护城河：城墙越垒越高，洪水涨不上城头"),
  input: z.string().optional().describe("lever：压在短端的小东西（你 / 一句话 / 1 小时）"),
  fulcrum: z.string().describe("支点 / 城墙刻的字：经验、判断力、行业认知"),
  output: z.string().optional().describe("lever：被撬起的大箱子（产出 / 收入 / 10 个项目）"),
  gain: z.number().optional().describe("放大倍数，显示为 ×N"),
  outputIcon: z.string().optional(),
  pressAt: z.number().optional().describe("lever：小人压下去的时刻（锚点，如“撬”）"),
  gainAt: z.number().optional().describe("倍数砸出来的时刻"),
  layers: z.array(z.object({ text: z.string(), at: z.number().optional() })).max(5).optional().describe("moat：一块块垒上城墙的砖（经验的组成，如 踩过的坑 / 客户关系 / 行业判断）"),
  flood: z.string().optional().describe("moat：墙外的洪水（AI 冲击 / 低价竞争）"),
  floodAt: z.number().optional().describe("moat：洪水涌来的时刻"),
  verdict: z.string().optional().describe("最后的一句结论（短）"),
  verdictAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

// ── lever ────────────────────────────────────────────────────────────────────
const Lever: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const pressAt = cueOr(data.pressAt, Math.round(dur * 0.3));
  const gainAt = cueOr(data.gainAt, pressAt + 30);
  const verdictAt = cueOr(data.verdictAt, gainAt + 30);
  const cx = W * 0.5;
  const G = full ? H * 0.8 : H * 0.8;
  const fh = full ? 120 : 64; // fulcrum height
  const px = full ? W * 0.3 : W * 0.3; // pivot x (short arm on the left)
  const Lshort = full ? W * 0.13 : W * 0.14;
  const Llong = Lshort * 3;
  const pivot = { x: px, y: G - fh };
  // beam angle: starts tilted with the long (right) arm resting on the ground,
  // then the tiny figure presses the short arm down and the heavy box flies up
  const rest = Math.asin(Math.min(0.95, fh / Llong)) * (180 / Math.PI); // right arm on the ground
  const down = -Math.asin(Math.min(0.95, fh / Lshort)) * (180 / Math.PI); // left arm on the ground
  const press = frame < pressAt ? 0 : easeInOut(prog(frame, pressAt, 22));
  const bounce = frame > pressAt + 22 ? Math.sin((frame - pressAt - 22) * 0.35) * Math.exp(-(frame - pressAt - 22) * 0.09) * 3 : 0;
  // the beam rotates so the short side goes down => negative rotation of right arm
  const ang = lerp(rest, down, press) + bounce;
  const a = (ang * Math.PI) / 180;
  const endL = { x: pivot.x - Math.cos(a) * Lshort, y: pivot.y - Math.sin(a) * Lshort };
  const endR = { x: pivot.x + Math.cos(a) * Llong, y: pivot.y + Math.sin(a) * Llong };
  const bw = full ? 26 : 16;
  const boxW = full ? 250 : 130;
  const boxH = full ? 170 : 90;
  const gain = data.gain ?? 10;
  const cnt = Math.round(lerp(1, gain, easeOut(prog(frame, gainAt, 20))));
  const fig = mixPose(POSES.stand, { ...POSES.stand, ls: 150, rs: 140, le: 20, re: 30, lh: -10, rh: 30, rk: -40, drop: 0.08 }, press > 0 ? 1 : easeOut(prog(frame, pressAt - 14, 14)));
  const figH = full ? 120 : 64;
  const jumpY = frame < pressAt && frame > pressAt - 14 ? -Math.sin(prog(frame, pressAt - 14, 14) * Math.PI) * 40 : 0;
  const sh = hitShake(frame, [pressAt + 20], full ? 10 : 5, 10, 3);
  const icon = data.outputIcon ?? guessIcon(data.output ?? "") ?? "box";
  const lx = (dx: number) => ({ x: endL.x + Math.cos(a) * dx, y: endL.y + Math.sin(a) * dx });
  const figPos = lx(full ? 40 : 22);
  const boxPos = { x: endR.x - Math.cos(a) * (full ? 150 : 80), y: endR.y - Math.sin(a) * (full ? 150 : 80) };
  // ×N 倍数原生是从 0 弹出（easeOutBack scale），接进入场语法层保住基线
  const eGain = enterAt(frame, gainAt, { fallback: "rise", dur: 14, from: 0 });
  // 结论原生从左侧滑入并淡入（translateX -40 → 0）：dist 换算成同等位移
  const eVerd = enterAt(frame, verdictAt, { fallback: "slide-l", dur: 12, dist: 40 / 240 });
  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <GlowDefs id="lv" std={6} user />
        <line x1={W * 0.04} y1={G} x2={W * 0.96} y2={G} stroke={alpha(t.primary, 0.5)} strokeWidth={3} filter="url(#lv)" />
        {/* lift gauge: dashed line from the ground to the rising box */}
        {press > 0 && <line x1={endR.x + (full ? 40 : 20)} y1={G} x2={endR.x + (full ? 40 : 20)} y2={endR.y} stroke={t.gold} strokeWidth={3} strokeDasharray="10 10" opacity={0.8} />}
        {/* fulcrum */}
        <polygon points={`${pivot.x},${pivot.y} ${pivot.x - fh * 0.62},${G} ${pivot.x + fh * 0.62},${G}`} fill={alpha(t.gold, 0.2)} stroke={t.gold} strokeWidth={3} filter="url(#lv)" />
        <circle cx={pivot.x} cy={pivot.y} r={bw * 0.5} fill={t.gold} />
        {/* beam */}
        <line x1={endL.x} y1={endL.y} x2={endR.x} y2={endR.y} stroke={t.primary} strokeWidth={bw} strokeLinecap="round" />
        <line x1={endL.x} y1={endL.y} x2={endR.x} y2={endR.y} stroke={alpha(t.bg, 0.6)} strokeWidth={bw * 0.3} strokeLinecap="round" />
        <g transform={`translate(0 ${jumpY})`}>
          <Figure x={figPos.x} y={figPos.y - bw / 2} h={figH} pose={fig} color={t.text} glow={t.primary} rot={ang} />
        </g>
        {/* motion arcs at the long end */}
        {press > 0 && press < 1 && [0, 1, 2].map((k) => (
          <path key={k} d={`M ${endR.x - 20 - k * 30} ${endR.y + 30 + k * 26} q 30 -10 50 -40`} stroke={alpha(t.gold, 0.6 - k * 0.15)} strokeWidth={4} fill="none" />
        ))}
      </svg>
      {/* fulcrum label */}
      <div style={{ position: "absolute", left: pivot.x, top: G + 14, transform: "translateX(-50%)", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.fulcrum, W * 0.3, full ? 44 : 24, 14), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 14px ${alpha(t.gold, 0.6)}` }}>
        支点 · {data.fulcrum}
      </div>
      {data.input && (
        <div style={{ position: "absolute", left: figPos.x, top: figPos.y + jumpY - figH - (full ? 70 : 40), transform: "translateX(-50%)", fontFamily: t.font.title, fontWeight: 800, fontSize: fitFont(data.input, W * 0.2, full ? 32 : 18, 12), color: t.text, whiteSpace: "nowrap", padding: "4px 14px", borderRadius: 30, background: alpha(t.bg, 0.8), border: `2px solid ${alpha(t.primary, 0.6)}` }}>{data.input}</div>
      )}
      {/* heavy box on the long end */}
      <div style={{ position: "absolute", left: boxPos.x - boxW / 2, top: boxPos.y - bw / 2 - boxH, width: boxW, height: boxH, transformOrigin: "50% 100%", transform: `translate(${sh.x}px, ${sh.y}px) rotate(${ang}deg)`, borderRadius: 14, background: `linear-gradient(160deg, ${alpha(t.gold, 0.4)}, ${alpha(t.bg2, 0.95)})`, border: `3px solid ${t.gold}`, boxShadow: `0 0 ${20 + press * 40}px ${alpha(t.gold, 0.3 + press * 0.4)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Icon name={icon} size={boxH * 0.38} color={t.gold} />
        {data.output && <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.output, boxW * 0.9, boxH * 0.2, 12), color: t.text, whiteSpace: "nowrap" }}>{data.output}</div>}
      </div>
      {frame >= gainAt && (
        <div style={{ position: "absolute", left: Math.min(W - (full ? 260 : 120), boxPos.x - (full ? 20 : 10)), top: Math.max(full ? 120 : 20, boxPos.y - boxH - (full ? 190 : 90)), transform: `translate(${eGain.dx}px, ${eGain.dy}px) scale(${eGain.scale})`, transformOrigin: "50% 100%", opacity: eGain.opacity, fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 150 : 64, color: t.gold, whiteSpace: "nowrap", lineHeight: 1, textShadow: `0 0 30px ${alpha(t.gold, 0.7)}, 0 4px 0 #000` }}>
          ×{cnt}
        </div>
      )}
      {data.verdict && frame >= verdictAt && full && (
        <div style={{ position: "absolute", left: W * 0.08, top: H * 0.22, opacity: eVerd.opacity, transform: `translate(${eVerd.dx}px, ${eVerd.dy}px)`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.4, 56, 24), color: t.text, whiteSpace: "nowrap", textShadow: "0 3px 0 #000" }}>
          {data.verdict}
        </div>
      )}
      <Sfx name="swish" at={pressAt - 14} volume={0.25} />
      <Sfx name="impact" at={pressAt + 20} volume={0.4} />
      <Sfx name="ding" at={gainAt} volume={0.35} />
      {data.verdict && <Sfx name="pop" at={verdictAt} volume={0.25} />}
    </>
  );
};

// ── moat ─────────────────────────────────────────────────────────────────────
// a small figure behind a wall; bricks stack up on cue, then a flood surges in from the right,
// climbs, and breaks against the wall top while the figure stays dry
const Moat: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const layers = data.layers?.length ? data.layers : [{ text: data.fulcrum }];
  const cues = listCues(layers, Math.round(dur * 0.1), Math.round(dur * 0.42));
  const floodAt = cueOr(data.floodAt, cues[cues.length - 1] + 26);
  const verdictAt = cueOr(data.verdictAt, floodAt + 40);
  // 洪水标签淡入、结论缩放淡入都是元素入场；砖块砸下垒墙 / 水位上涨是护城河隐喻主体，保持不动
  const eFlood = enterAt(frame, floodAt, { fallback: "rise", dur: 12 });
  const eVerdict = enterAt(frame, verdictAt, { fallback: "rise", dur: 14, from: 1.3 });
  const G = H * 0.84;
  const wallX = W * 0.46;
  const wallW = full ? 170 : 90;
  const brickH = Math.min(full ? 92 : 50, (G - H * 0.3) / (layers.length + 0.5));
  const wallTop = G - brickH * layers.length;
  // water: rises from the right up to just under the wall top, with waves
  const fl = frame < floodAt ? 0 : easeOut(prog(frame, floodAt, 40));
  const waterTop = lerp(G, wallTop + brickH * 0.25, fl);
  const wave = (x: number) => Math.sin(x * 0.012 + frame * 0.18) * (full ? 14 : 7) * fl + Math.sin(x * 0.03 - frame * 0.25) * 5 * fl;
  const waterPath = (() => {
    const pts: string[] = [];
    const x0 = wallX + wallW;
    for (let x = x0; x <= W + 10; x += 20) pts.push(`${x},${waterTop + wave(x)}`);
    return `M ${x0},${G} L ${pts.join(" L ")} L ${W + 10},${G} Z`;
  })();
  // spray at the wall
  const sprayHits = [floodAt + 26, floodAt + 44, floodAt + 62, floodAt + 80];
  const sh = hitShake(frame, [floodAt + 26], full ? 8 : 4, 10, 5);
  const figH = full ? 150 : 80;
  const calm = frame >= floodAt + 50;
  const pose = calm ? POSES.stand : mixPose(POSES.stand, { ...POSES.stand, lean: -8, ls: 30, rs: 40, le: 90, re: 80 }, fl);
  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <GlowDefs id="mt" std={6} user />
        <line x1={0} y1={G} x2={W} y2={G} stroke={alpha(t.primary, 0.5)} strokeWidth={3} filter="url(#mt)" />
        {/* flood */}
        {fl > 0 && (
          <>
            <path d={waterPath} fill={alpha(t.bad, 0.28)} stroke={t.bad} strokeWidth={3} />
            {sprayHits.map((h, k) => {
              const p = prog(frame, h, 22);
              if (p <= 0 || p >= 1) return null;
              return Array.from({ length: 7 }, (_, i) => {
                const ang = (-150 + i * 18) * (Math.PI / 180);
                const r = easeOut(p) * (full ? 130 : 70);
                const x = wallX + wallW + Math.cos(ang) * r * 0.6;
                const y = wallTop + Math.sin(ang) * r + easeIn(p) * 60;
                return <circle key={`${k}-${i}`} cx={x} cy={y} r={(full ? 9 : 5) * (1 - p)} fill={t.bad} opacity={1 - p} />;
              });
            })}
          </>
        )}
        <Figure x={wallX - (full ? 150 : 80)} y={G} h={figH} pose={pose} color={t.text} glow={t.primary} face={1} />
      </svg>
      {data.flood && fl > 0 && (
        <div style={{ position: "absolute", right: W * 0.05, top: waterTop - (full ? 90 : 46), opacity: eFlood.opacity, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.flood, W * 0.35, full ? 60 : 28, 14), color: t.bad, whiteSpace: "nowrap", textShadow: `0 0 20px ${alpha(t.bad, 0.6)}, 0 3px 0 #000` }}>
          {data.flood} →
        </div>
      )}
      {/* wall bricks */}
      {layers.map((l, i) => {
        const c = cues[i];
        if (frame < c) return null;
        const p = prog(frame, c, 12);
        const y = G - brickH * (i + 1);
        const dropY = (1 - easeIn(p)) * -H * 0.5;
        return (
          <div key={i} style={{ position: "absolute", left: wallX, top: y + dropY, width: wallW, height: brickH - 6, borderRadius: 8, background: `linear-gradient(180deg, ${alpha(t.gold, 0.5)}, ${alpha(t.gold, 0.18)})`, border: `3px solid ${t.gold}`, boxShadow: `0 0 18px ${alpha(t.gold, 0.4)}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `translate(${sh.x}px, ${sh.y}px)` }}>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(l.text, wallW * 0.88, brickH * 0.36, 11), color: t.text, whiteSpace: "nowrap", textShadow: "0 2px 0 #000" }}>{l.text}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: wallX + wallW / 2, top: G + 14, transform: "translateX(-50%)", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.fulcrum, W * 0.3, full ? 40 : 22, 12), color: t.gold, whiteSpace: "nowrap" }}>{data.fulcrum}</div>
      {data.verdict && frame >= verdictAt && (
        <div style={{ position: "absolute", left: W * 0.05, top: full ? H * 0.2 : H * 0.06, opacity: eVerdict.opacity, transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`, transformOrigin: "0% 50%", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.42, full ? 60 : 26, 14), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 20px ${alpha(t.gold, 0.5)}, 0 3px 0 #000` }}>
          {data.verdict}
        </div>
      )}
      {cues.map((c, i) => <Sfx key={i} name="stamp" at={c + 11} volume={0.3} />)}
      <Sfx name="whoosh" at={floodAt} volume={0.3} />
      <Sfx name="impact" at={floodAt + 26} volume={0.35} />
      {data.verdict && <Sfx name="ding" at={verdictAt} volume={0.35} />}
    </>
  );
};

const C: React.FC<CompProps<D>> = (p) => (p.data.mode === "moat" ? <Moat {...p} /> : <Lever {...p} />);

export const LeverLift: CompDef<D> = {
  id: "lever-lift",
  name: "杠杆撬动 / 护城河",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 10,
  tags: ["杠杆", "放大", "护城河", "经验", "壁垒", "撬动"],
  motion: { kind: "lever：小人跳起砸短端 → 重箱撬上天 + ×N；moat：砖块砸下垒墙 → 洪水涌来拍墙", energy: 3 },
  desc: "lever：一根横在三角支点上的杠杆，短端上的小人跳起一砸，长端的金色重箱被撬到半空，旁边砸出 ×N；moat：金色砖块按配音一块块砸下垒成城墙（每块写经验的组成），右边红色洪水涌来、涨到城头拍出水花，墙后的小人安然站着",
  use: "lever：一句话撬动十倍产出、经验是支点、用 AI 放大一个人的产能、小预算撬大流量；moat：经验/客户关系是 AI 冲不走的护城河、行业门槛挡住低价竞争、复利积累出来的壁垒",
  panel: true,
  schema,
  example: { mode: "lever", input: "你的一句需求", fulcrum: "行业经验", output: "整套方案", gain: 10, verdict: "经验就是支点" },
  C,
};
