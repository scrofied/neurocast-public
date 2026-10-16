import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, lerp, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { compile } from "../../lib/formula";
import { Sfx } from "../../lib/sfx";
import { cubicIO } from "../../lib/spring";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, fmtNum, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 出处：opus-5-5-motion-gallery/v14-lab-explainer / misbahsy（GitHub claude-horizon-animation）2026-09 https://github.com/misbahsy/claude-horizon-animation
// 片库整理：小红书 AI伐木工（jinhanbuilds/opus-5-5-motion-gallery）；逐条机制对照见 docs/OPUS55_ANIMATIONS.md 一·c。
// 移植自 opus-5-5-motion-gallery/v14-lab-explainer 的核心思路（不是搬它的画）：
// **画面里每一个数字、每一行字，都是同一个纯函数的即时读数。**
// 写死文案的科普片一改口径就要逐处找，公式驱动的只改那一个表达式：
// 临界角、反射比例、大字幕里的 48.8°、曲线上的游标全部跟着动，永远不会自相矛盾。
// 自变量走关键帧 + 三次缓动（v14 的 TH 表），画面上就是「有人在拧这个旋钮」。

const rd = z.object({
  label: z.string().describe("读数叫什么，如 临界角 / 反射掉的比例"),
  expr: z.string().describe("公式。自变量一律写 x（滑轨上那个量），t 是同义写法；其余名字必须在 vars 里给过。支持 + - * / ^ 括号、比较 > < >= <=、sin cos asin sqrt abs min max round floor、常量 pi deg(=π/180)"),
  decimals: z.number().min(0).max(4).optional().describe("小数位（默认 1）"),
  unit: z.string().max(4).optional().describe("单位，如 °、%、元"),
  yes: z.string().max(12).optional().describe("表达式是比较式时：成立（返回 1）显示这句话"),
  no: z.string().max(12).optional().describe("表达式是比较式时：不成立显示这句话"),
});
const v = z.object({
  name: z.string().describe("公式里用的变量名，如 n"),
  label: z.string().describe("给观众看的名字，如 折射率 n"),
  value: z.number(),
  switchAt: z.number().optional().describe("在这一刻换成 to（锚点，如「换成水试试」）"),
  to: z.number().optional(),
});
const key = z.object({ v: z.number().describe("自变量取到这个值"), at: z.number().optional().describe("到达该值的时刻（锚点）；缺省 = 均匀铺开") });
const cs = z.object({ title: z.string().max(10).describe("这一段的小标题，如 ① 拖到临界"), line: z.string().max(26).describe("这一段的大字幕（≤26 字，会被读出来）"), at: z.number().optional().describe("出现的时刻（锚点）") });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  driver: z.object({
    label: z.string().describe("自变量叫什么，如 入射角 θ₁"),
    unit: z.string().max(4).optional(),
    keys: z.array(key).min(2).max(8).describe("自变量的关键帧，2~8 个。这就是口播在拧的那个旋钮"),
    min: z.number().optional().describe("滑轨左端（缺省 = 关键帧最小值）"),
    max: z.number().optional().describe("滑轨右端（缺省 = 关键帧最大值）"),
  }),
  vars: z.array(v).max(3).optional().describe("公式里用到的其它参数（最多 3 个），可在某一刻换值"),
  readouts: z.array(rd).min(2).max(5).describe("2~5 个读数，每个都由公式现算"),
  cases: z.array(cs).min(1).max(5).describe("分段大字幕，跟关键帧一起走"),
  plot: z.object({ expr: z.string().describe("画成曲线的表达式（横轴 = 自变量）"), label: z.string().optional() }).optional().describe("末段画一条曲线，把「这个量随那个量怎么变」摊开看"),
  verdict: z.string().optional(),
});
type D = z.infer<typeof schema>;

// 把表达式里的变量名换成当前数值，作为「代入过程」显示（v14 的 2.42 × sin 30.0° = 1.210 > 1）
const pretty = (src: string, vals: Record<string, number>) => {
  const op: Record<string, string> = { "*": "×", "/": "÷", "^": "^", "<=": "≤", ">=": "≥", "!=": "≠", "<": "<", ">": ">" };
  let s = src.replace(/[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]*/g, (m) => {
    if (vals[m] !== undefined) {
      const v = vals[m];
      return m.length === 1 ? fmtNum(v, Math.abs(v) >= 10 ? 1 : 2) : fmtNum(v, Math.abs(v) >= 10 ? 1 : 2);
    }
    return m;
  });
  s = s.replace(/(<=|>=|!=|<|>|\*|\/|\^)/g, (m) => op[m] ?? m);
  return s;
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const s = frame / fps;

  const keys = data.driver.keys;
  const at = keys.map((k, i) => cueOr(k.at, Math.round(lerp(dur * 0.08, dur * 0.82, i / Math.max(1, keys.length - 1)))));
  const drv = (sec: number) => {
    if (sec * fps <= at[0]) return keys[0].v;
    for (let i = 0; i < keys.length - 1; i++) {
      if (sec * fps <= at[i + 1]) return lerp(keys[i].v, keys[i + 1].v, cubicIO((sec * fps - at[i]) / Math.max(1, at[i + 1] - at[i])));
    }
    return keys[keys.length - 1].v;
  };
  const x = drv(s);

  const vals: Record<string, number> = {};
  (data.vars ?? []).forEach((p) => {
    const flip = p.switchAt !== undefined && frame >= p.switchAt;
    vals[p.name] = flip && typeof p.to === "number" ? p.to : p.value;
  });
  // 自变量在公式里就叫 x（t 是同义写法），免得中文/希腊字母的变量名解析不出来
  vals.x = x;
  vals.t = x;

  const lo = data.driver.min ?? Math.min(...keys.map((k) => k.v));
  const hi = data.driver.max ?? Math.max(...keys.map((k) => k.v));
  const knob = clamp((x - lo) / Math.max(1e-6, hi - lo));

  const caseCues = data.cases.map((c, i) => cueOr(c.at, Math.round(lerp(dur * 0.1, dur * 0.7, i / Math.max(1, data.cases.length - 1)))));
  let ci = 0;
  caseCues.forEach((a, i) => {
    if (frame >= a) ci = i;
  });

  const eVerdict = enterAt(frame, Math.round(dur * 0.88), { fallback: "slam", dur: 16 });

  // 曲线区（plot）与读数区的分配
  const px = full ? width * 0.52 : 0;
  const pw = full ? width * 0.42 : width;
  const py = full ? 250 : 90;
  const ph = full ? height - 250 - 280 : height * 0.42;

  const compiled = (expr?: string) => (expr ? compile(expr) : null);

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}

      {/* 大字幕：这一段在验证什么 */}
      {data.cases.map((c, i) => {
        if (frame < caseCues[i]) return null;
        const nxt = i + 1 < data.cases.length ? caseCues[i + 1] : Infinity;
        if (frame >= nxt) return null;
        const e = enterAt(frame, caseCues[i], { fallback: "slide-l", dur: 14 });
        return (
          <div key={i} style={{ position: "absolute", left: full ? 96 : 16, width: full ? Math.round(width * 0.42) : undefined, right: full ? undefined : 16, top: full ? 250 : 54, opacity: e.opacity, transform: `translate(${e.dx}px, ${e.dy}px)`, clipPath: e.clip }}>
            <div style={{ fontFamily: t.font.mono, fontSize: full ? 24 : 14, color: t.primary, letterSpacing: 2 }}>{c.title}</div>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(c.line, width * (full ? 0.4 : 0.9), full ? 62 : 26, 15), color: t.text, marginTop: 4 }}>{c.line}</div>
          </div>
        );
      })}

      {/* 左：读数板。每一个数都是上面那个公式此刻的值 */}
      <div style={{ position: "absolute", left: full ? 96 : 16, top: full ? 400 : 150, width: full ? width * 0.42 : width - 32 }}>
        {data.readouts.map((r, i) => {
          const f = compiled(r.expr);
          const val = f ? f.at(vals) : NaN;
          const show = r.yes !== undefined || r.no !== undefined;
          const e = enterAt(frame, 20 + i * 8, { fallback: "rise", dur: 12 });
          return (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: full ? 20 : 8, opacity: e.opacity, transform: `translate(${e.dx}px, ${e.dy}px)` }}>
              <span style={{ fontFamily: t.font.body, fontSize: full ? 26 : 15, color: t.dim, width: full ? 250 : 120, flexShrink: 0 }}>{r.label}</span>
              {show ? (
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 40 : 22, color: val >= 0.5 ? t.accent : t.dim }}>{val >= 0.5 ? r.yes : r.no}</span>
              ) : (
                <span style={{ fontFamily: t.font.mono, fontWeight: 700, fontSize: full ? 46 : 26, color: Number.isFinite(val) ? t.text : t.dim }}>{Number.isFinite(val) ? fmtNum(val, r.decimals ?? 1) : "—"}{r.unit}</span>
              )}
            </div>
          );
        })}
        {/* 代入式：让观众看见这个数是怎么来的 */}
        <div style={{ marginTop: full ? 26 : 10, padding: full ? "14px 20px" : "8px 12px", borderRadius: 14, background: alpha(t.bg2, 0.7), border: `1.5px solid ${alpha(t.line, 0.8)}`, fontFamily: t.font.mono, fontSize: full ? 27 : 15, color: t.primary, whiteSpace: "nowrap", overflow: "hidden" }}>
          {pretty(data.readouts[Math.min(ci, data.readouts.length - 1)]?.expr ?? "", vals)}
        </div>
      </div>

      {/* 右：曲线 + 游标（讲到「这个量随那个量怎么变」时才出现） */}
      {data.plot && (
        <Plot
          expr={data.plot.expr}
          vals={vals}
          x={x}
          lo={lo}
          hi={hi}
          s={s}
          dur={dur}
          frame={frame}
          box={{ x: px, y: py, w: pw, h: ph }}
          unit={data.driver.unit}
          label={data.plot.label ?? data.driver.label}
          driver={data.driver.label}
          colors={{ line: t.line, text: t.text, dim: t.dim, accent: t.accent, primary: t.primary, bg2: t.bg2 }}
          font={t.font}
          full={full}
        />
      )}

      {/* 自变量的滑轨：画面里「被拧的东西」，位置严格等于当前关键帧插值 */}
      <div style={{ position: "absolute", left: full ? 96 : 16, right: full ? 96 : 16, bottom: full ? 210 : 90 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: t.font.mono, fontSize: full ? 22 : 13, color: t.dim, marginBottom: 8 }}>
          <span>{data.driver.label}</span>
          <span style={{ color: t.accent, fontWeight: 700 }}>
            {fmtNum(x, Math.abs(x) >= 100 ? 0 : 1)}
            {data.driver.unit}
          </span>
        </div>
        <div style={{ position: "relative", height: 8, borderRadius: 6, background: alpha(t.dim, 0.28) }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${knob * 100}%`, borderRadius: 6, background: `linear-gradient(90deg, ${alpha(t.primary, 0.5)}, ${t.accent})` }} />
          <div style={{ position: "absolute", left: `calc(${knob * 100}% - ${full ? 17 : 11}px)`, top: -(full ? 13 : 8), width: full ? 34 : 22, height: full ? 34 : 22, borderRadius: "50%", background: t.text, boxShadow: `0 0 22px ${alpha(t.accent, 0.8)}` }} />
        </div>
      </div>

      {data.verdict && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: full ? 262 : 130, textAlign: "center", opacity: eVerdict.opacity, transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`, clipPath: eVerdict.clip }}>
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, width * 0.8, full ? 56 : 24, 14), color: t.accent }}>{data.verdict}</span>
        </div>
      )}

      {at.map((a, i) => (
        <Sfx key={i} name="tick" at={a} volume={0.2} />
      ))}
    </>
  );
};

const Plot: React.FC<{
  expr: string;
  vals: Record<string, number>;
  x: number;
  lo: number;
  hi: number;
  s: number;
  dur: number;
  frame: number;
  box: { x: number; y: number; w: number; h: number };
  unit?: string;
  label: string;
  driver: string;
  colors: { line: string; text: string; dim: string; accent: string; primary: string; bg2: string };
  font: { title: string; body: string; mono: string };
  full: boolean;
}> = ({ expr, vals, x, lo, hi, box, unit, label, driver, colors, font, full, frame, dur }) => {
  const f = compile(expr);
  const N = 60;
  const pad = full ? 40 : 18;
  const W = box.w - pad * 2;
  const H = box.h - pad * 2;
  // 自变量范围外扩一点，曲线两头不顶边
  const [a, b] = [Math.min(lo, x) - Math.abs(hi - lo || 1) * 0.04, Math.max(hi, x) + Math.abs(hi - lo || 1) * 0.04];
  const ys: number[] = [];
  for (let i = 0; i <= N; i++) {
    const v = a + ((b - a) * i) / N;
    ys.push(f.at({ ...vals, x: v, t: v }));
  }
  const vmin = Math.min(...ys.filter(Number.isFinite));
  const vmax = Math.max(...ys.filter(Number.isFinite));
  const span = Math.max(1e-6, vmax - vmin);
  const pt = (i: number, v: number) => ({ x: pad + (W * (i / N)), y: pad + H - ((v - vmin) / span) * H });
  const draw = clamp(prog(frame, dur * 0.55, dur * 0.2));
  const shown = Math.max(2, Math.floor((N + 1) * draw));
  const path = ys.slice(0, shown).map((v, i) => `${pt(i, v).x},${pt(i, v).y}`).join(" ");
  const cur = f.at(vals);
  const curPt = pt(((x - a) / (b - a)) * N, Number.isFinite(cur) ? cur : vmin);
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity: clamp(prog(frame, dur * 0.5, 14)) }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 18, background: alpha(colors.bg2, 0.55), border: `1.5px solid ${alpha(colors.line, 0.7)}` }} />
      <svg width={box.w} height={box.h} style={{ position: "absolute", inset: 0 }}>
        <line x1={pad} y1={pad + H} x2={pad + W} y2={pad + H} stroke={alpha(colors.dim, 0.6)} strokeWidth={1.5} />
        <line x1={pad} y1={pad} x2={pad} y2={pad + H} stroke={alpha(colors.dim, 0.6)} strokeWidth={1.5} />
        {shown > 2 && <polyline points={path} fill="none" stroke={colors.primary} strokeWidth={4} strokeLinejoin="round" />}
        {draw > 0.15 && (
          <>
            <line x1={curPt.x} y1={pad} x2={curPt.x} y2={pad + H} stroke={alpha(colors.accent, 0.7)} strokeWidth={2} strokeDasharray="6 6" />
            <circle cx={curPt.x} cy={curPt.y} r={full ? 9 : 5} fill={colors.accent} />
          </>
        )}
      </svg>
      <div style={{ position: "absolute", left: pad, top: full ? 14 : 6, fontFamily: font.body, fontSize: full ? 24 : 14, color: colors.dim }}>{label}</div>
      <div style={{ position: "absolute", right: pad, bottom: full ? 12 : 4, fontFamily: font.mono, fontSize: full ? 22 : 13, color: colors.text }}>
        {fmtNum(cur, 1)}
        {unit} ← {fmtNum(x, 1)}
      </div>
    </div>
  );
};

// 曲线横轴就是自变量 x，替值时把 x/t 一起换掉

export const FormulaDrive: CompDef<D> = {
  id: "formula-drive",
  name: "一个公式算出整屏",
  layer: "info",
  variants: 1,
  minSec: 6,
  maxSec: 18,
  tags: ["推导", "口径", "算账", "临界", "阈值", "公式", "模型", "为什么是这个数"],
  motion: { kind: "关键帧驱动自变量沿滑轨推进，读数逐帧由公式现算、代入式跟着变、曲线游标同步滑动", energy: 2 },
  desc: "科普/算账舞台：上方大字幕按段说明，左边 2~5 个读数**全部由表达式当场算出**（不是写死的字符串），下面一行实时把数值代回公式当「代入过程」；底部一条滑轨上的发光游标就是被拧的自变量；右侧可选曲线在末段自绘出来，虚线把当前值和曲线上的点钉在一起。换介质/换口径时读数会当场跳，比较式读数还会从「出不去」翻成「逃掉了」",
  use: "讲「这个数是怎么来的」：一个折射率怎么决定光能不能出去、一条视频的分成怎么被三个参数决定、阈值在哪里、口径换成美国数就变了多少、成本随量怎么爬。**凡是画面上的数字要有依据**就用它。写完先 --plan-only 核对：表达式里没有的名字会渲染成「—」",
  schema,
  example: {
    kicker: "不是玄学",
    title: "一个公式决定能不能出去",
    driver: { label: "入射角 θ₁", unit: "°", keys: [{ v: 20 }, { v: 41.7, at: 40 }, { v: 55, at: 80 }, { v: 30, at: 130 }], min: 0, max: 90 },
    vars: [{ name: "n", label: "折射率 n", value: 1.5, switchAt: 120, to: 2.42 }],
    readouts: [
      { label: "临界角", expr: "asin(1 / n) * 180 / pi", decimals: 1, unit: "°" },
      { label: "能不能出去", expr: "n * sin(x * deg) > 1", yes: "全被锁住", no: "逃出去了" },
      { label: "n·sinθ", expr: "n * sin(x * deg)", decimals: 3 },
    ],
    cases: [
      { title: "① 小角度", line: "光还能从玻璃里出来" },
      { title: "② 拖到临界", line: "刚好贴着出不去的边" },
      { title: "③ 越过临界", line: "光被完全关在玻璃里" },
    ],
    plot: { expr: "asin(1 / n) * 180 / pi", label: "临界角随折射率" },
    verdict: "换个介质，规则重新算一遍",
  },
  C,
};
