import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { assetUrl } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { alpha, useTheme } from "../../lib/theme";
import { Sfx } from "../../lib/sfx";
import { fitFont } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 人物两侧的竖版动效位。和全屏组件不同，这里一律「窄高」构图：
// 上面一个 mono 小标，中间主视觉（可动），下面一两条短句。
// 每种 kind 的入场语法都不一样（逐行升起 / 落珠 / 画线 / 砌墙 / 飞入），避免整片同一种运动节奏。
const item = z.object({
  text: z.string(),
  sub: z.string().optional(),
  at: z.number().optional(),
  tone: z.enum(["accent", "warn", "good", "dim"]).optional(),
  icon: z.string().optional(),
});

const schema = z.object({
  kind: z.enum(["statement", "abacus", "steps", "counter", "brands", "flow", "bars", "wall", "phone", "checklist"]).default("statement"),
  kicker: z.string().optional(),
  title: z.string().optional(),
  sub: z.string().optional(),
  num: z.number().optional(),
  numText: z.string().optional(),
  unit: z.string().optional(),
  label: z.string().optional(),
  items: z.array(item).default([]),
  // 全部是「相对本槽位开始」的秒数，引擎会换算成本槽位内的帧
  riseAt: z.number().optional(),
  pokeAt: z.number().optional(),
  stopAt: z.number().optional(),
  autoAt: z.number().optional(),
  countAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const toneColor = (tone: string | undefined, t: any) => (tone === "warn" ? t.bad : tone === "good" ? "#6ee7a8" : tone === "dim" ? t.dim : tone === "accent" ? t.accent : t.primary);

const Kicker: React.FC<{ text?: string; x: number; y: number; w: number; t: any; p: number }> = ({ text, x, y, w, t, p }) => {
  if (!text) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, opacity: p, transform: `translateY(${(1 - p) * -10}px)` }}>
      <div style={{ color: t.primary, fontFamily: t.font.mono, fontSize: 15, letterSpacing: 3.4 }}>{text}</div>
      <div style={{ marginTop: 10, height: 2, width: `${p * 100}%`, background: `linear-gradient(90deg, ${alpha(t.primary, 0.95)}, ${alpha(t.primary, 0)})` }} />
    </div>
  );
};

// ---------- statement：大字陈述，逐行升起 ----------
const Statement: React.FC<{ d: D; f: number; W: number; H: number; t: any }> = ({ d, f, W, H, t }) => {
  const lines = (d.title ?? "").split("\n").filter(Boolean);
  const base = cueOr(d.riseAt, 4);
  const numP = easeOutBack(prog(f, base + lines.length * 7 + 2, 14));
  const subP = easeOut(prog(f, base + lines.length * 7 + 10, 14));
  return (
    <>
      <Sfx name="whoosh" at={base - 2} volume={0.22} />
      {d.num !== undefined && d.num > 0 && <Sfx name="tick" at={base + lines.length * 7 + 2} volume={0.3} />}
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      <div style={{ position: "absolute", left: 26, top: 132, width: 4, height: `${Math.min(1, prog(f, base, 16)) * 76}%`, background: `linear-gradient(180deg, ${t.primary}, ${alpha(t.primary, 0)})`, borderRadius: 2 }} />
      {lines.map((ln, i) => {
        const p = easeOutBack(prog(f, base + i * 7, 13));
        const size = fitFont(ln, W - 74, 66, 34);
        return (
          <div key={i} style={{ position: "absolute", left: 44, top: 150 + i * 78, width: W - 70, color: t.text, fontSize: size, lineHeight: 1.02, fontWeight: 900, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 34}px)`, textShadow: `0 6px 30px ${alpha(t.bg, 0.9)}` }}>{ln}</div>
        );
      })}
      {d.num !== undefined && (
        <div style={{ position: "absolute", left: 44, top: 150 + lines.length * 78 + 18, width: W - 70, opacity: numP, transform: `scale(${0.8 + 0.2 * numP})`, transformOrigin: "left top", display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div style={{ color: t.primary, fontSize: 96, fontWeight: 900, lineHeight: 0.9, letterSpacing: -2, textShadow: `0 0 40px ${alpha(t.primary, 0.6)}` }}>{d.numText ?? d.num}</div>
          {d.unit && <div style={{ color: t.text, fontSize: 26, fontWeight: 800, paddingBottom: 8 }}>{d.unit}</div>}
        </div>
      )}
      {d.sub && (
        <div style={{ position: "absolute", left: 44, top: 150 + lines.length * 78 + (d.num !== undefined ? 128 : 14), width: W - 70, opacity: subP, transform: `translateY(${(1 - subP) * 12}px)` }}>
          <div style={{ width: 54, height: 3, background: alpha(t.accent, 0.9), marginBottom: 14 }} />
          <div style={{ color: t.dim, fontSize: 20, lineHeight: 1.55 }}>{d.sub}</div>
        </div>
      )}
      {lines[0] && (
        <div style={{ position: "absolute", left: -18, bottom: 34, fontFamily: t.font.title, fontSize: 210, fontWeight: 900, lineHeight: 0.8, color: alpha(t.primary, 0.07), pointerEvents: "none" }}>{Array.from(lines[0])[0]}</div>
      )}
      <div style={{ position: "absolute", left: 26, bottom: 26, width: W - 52, height: 1, background: alpha(t.primary, 0.25) }} />
    </>
  );
};

// ---------- abacus：竖版算盘，指针拨一格，停住 → 切自动节点 ----------
const Abacus: React.FC<{ d: D; f: number; dur: number; W: number; H: number; t: any }> = ({ d, f, dur, W, H, t }) => {
  const RODS = 4;
  const LOWER = 5;
  const poke = cueOr(d.pokeAt, Math.round(dur * 0.34));
  const stop = cueOr(d.stopAt, poke + 16);
  const auto = cueOr(d.autoAt, 100000);
  const autoK = easeOut(prog(f, auto, 16));
  const fx = 30, fy = 176, fw = W - 60, fh = 372;
  const gap = fw / RODS;
  const bw = 40, bh = 26;
  const col = 1;
  const beamY = fy + fh * 0.27;
  const fly = easeInOut(prog(f, poke - 20, 18));
  const targetX = fx + gap * (col + 0.5);
  const targetY = beamY + 32 + 3 * (bh + 5);
  const px = W + 40 + (targetX + 74 - (W + 40)) * fly;
  const py = H * 0.9 - (H * 0.9 - (targetY + 8)) * fly;
  const hit = prog(f, poke, 3) * (1 - prog(f, poke + 10, 8));
  const moved = easeOutBack(prog(f, poke + 2, 9));
  return (
    <>
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      <div style={{ position: "absolute", left: 26, top: 92, width: W - 52, color: t.text, fontSize: fitFont(d.title ?? "", W - 52, 42, 22), fontWeight: 900, lineHeight: 1.12, opacity: easeOut(prog(f, 4, 12)) }}>{d.title}</div>

      <Sfx name="click" at={poke} volume={0.4} />
      <Sfx name="tick" at={poke + 4} volume={0.3} />
      {/* 外框 + 横梁 */}
      <div style={{ position: "absolute", left: fx, top: fy, width: fw, height: fh, borderRadius: 10, border: `3px solid ${alpha(t.primary, 0.55)}`, background: `linear-gradient(175deg, ${alpha(t.bg2, 0.75)}, ${alpha(t.bg, 0.45)})`, boxShadow: `inset 0 0 40px ${alpha(t.primary, 0.08)}` }} />
      <div style={{ position: "absolute", left: fx + 6, top: beamY, width: fw - 12, height: 7, borderRadius: 3, background: alpha(t.primary, 0.5) }} />

      {new Array(RODS).fill(0).map((_, r) => {
        const x = fx + gap * (r + 0.5);
        const isPoke = r === col;
        return (
          <React.Fragment key={r}>
            <div style={{ position: "absolute", left: x - 1.5, top: fy + 12, width: 3, height: fh - 24, background: `linear-gradient(180deg, ${alpha(t.text, 0.35)}, ${alpha(t.text, 0.14)})` }} />
            {/* 上档一颗 */}
            <div style={{ position: "absolute", left: x - bw / 2, top: fy + fh * 0.06, width: bw, height: bh, borderRadius: 7, background: alpha(t.text, 0.2), border: `1.5px solid ${alpha(t.text, 0.3)}` }}><div style={{ position: "absolute", left: bw / 2 - 3, top: 3, width: 6, height: bh - 6, background: alpha(t.bg, 0.85), borderRadius: 3 }} /></div>
            {/* 下档五颗 */}
            {new Array(LOWER).fill(0).map((_, bb) => {
              const active = isPoke && bb === 2;
              const drop = active ? moved * (bh + 5) : 0;
              return (
                <div key={bb} style={{ position: "absolute", left: x - bw / 2, top: beamY + 30 + bb * (bh + 5) + drop, width: bw, height: bh, borderRadius: 7, background: active ? `linear-gradient(180deg, ${alpha(t.primary, 1)}, ${alpha(t.primary, 0.7)})` : alpha(t.text, 0.14), border: `1.5px solid ${active ? alpha(t.primary, 1) : alpha(t.text, 0.26)}`, boxShadow: active ? `0 0 20px ${alpha(t.primary, 0.75)}` : "inset 0 1px 0 rgba(255,255,255,.08)" }}><div style={{ position: "absolute", left: bw / 2 - 3, top: 3, width: 6, height: bh - 6, background: alpha(t.bg, 0.85), borderRadius: 3 }} /></div>
              );
            })}
          </React.Fragment>
        );
      })}
      {/* 指针：从右侧飞入，悬在目标档位 */}
      <div style={{ position: "absolute", left: px - 30, top: py - 24, width: 60, height: 60, borderRadius: 30, border: `2px solid ${alpha(t.accent, 0.95)}`, background: alpha(t.accent, 0.16), opacity: Math.min(1, prog(f, poke - 22, 8)), boxShadow: `0 0 26px ${alpha(t.accent, 0.55)}` }}>
        <div style={{ position: "absolute", left: 22, top: 22, width: 12, height: 12, borderRadius: 6, background: t.accent }} />
      </div>
      {hit > 0 && <div style={{ position: "absolute", left: px - 12 - hit * 30, top: py - 6 - hit * 30, width: 36 + hit * 60, height: 36 + hit * 60, borderRadius: 80, border: `2px solid ${alpha(t.accent, 1 - hit)}` }} />}

      {/* 计数 */}
      <div style={{ position: "absolute", left: 30, top: fy + fh + 18, width: W - 60, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: t.primary, fontFamily: t.font.mono, fontSize: 15, letterSpacing: 2.6 }}>自主动作</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 2 }}>
            <div style={{ color: t.bad, fontSize: 68, fontWeight: 900, lineHeight: 0.95 }}>0</div>
            <div style={{ color: t.text, fontSize: 20, paddingBottom: 10 }}>次</div>
          </div>
        </div>
        <div style={{ textAlign: "right", paddingBottom: 8 }}>
          <div style={{ color: t.bad, fontFamily: t.font.mono, fontSize: 14, letterSpacing: 2.2, opacity: prog(f, stop - 4, 10) }}>STOPPED</div>
          <div style={{ marginTop: 6, color: t.text, fontSize: 17, opacity: prog(f, stop + 4, 10) }}>你不问，它就停在这</div>
        </div>
      </div>
    </>
  );
};

// ---------- steps：编号条目，右侧滑入 ----------
const Steps: React.FC<{ d: D; f: number; W: number; H: number; t: any }> = ({ d, f, W, H, t }) => {
  const cues = d.items.map((it, i) => cueOr(it.at, 16 + i * 16));
  return (
    <>
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      {d.title && <div style={{ position: "absolute", left: 26, top: 96, width: W - 52, color: t.text, fontSize: fitFont(d.title, W - 52, 42, 24), fontWeight: 900, lineHeight: 1.12 }}>{d.title}</div>}
      {d.items.map((it, i) => <Sfx key={`s${i}`} name="pop" at={cueOr(it.at, 16 + i * 16) - 1} volume={0.16} />)}
      <div style={{ position: "absolute", left: 44, top: 190, width: 2, height: H - 330, background: alpha(t.primary, 0.18) }} />
      <div style={{ position: "absolute", left: 44, top: 190, width: 2, height: `${clamp(prog(f, cues[0] ?? 16, 60)) * 100}%`, background: t.primary }} />
      {d.items.map((it, i) => {
        const p = easeOut(prog(f, cues[i], 13));
        const c = toneColor(it.tone, t);
        const y = 200 + i * 128;
        return (
          <div key={i} style={{ position: "absolute", left: 30, top: y, width: W - 56, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * 46}px)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 15, background: alpha(c, 0.9), color: t.bg, fontSize: 15, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.mono }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ color: t.text, fontSize: fitFont(it.text, W - 120, 28, 18), fontWeight: 900, lineHeight: 1.2 }}>{it.text}</div>
            </div>
            {it.sub && <div style={{ marginTop: 8, marginLeft: 42, color: t.dim, fontSize: 17, lineHeight: 1.35 }}>{it.sub}</div>}
          </div>
        );
      })}
    </>
  );
};

// ---------- counter：大数字滚动 ----------
const Counter: React.FC<{ d: D; f: number; W: number; H: number; t: any }> = ({ d, f, W, H, t }) => {
  const at = cueOr(d.countAt, 6);
  const k = easeOut(prog(f, at, 30));
  const target = d.num ?? 0;
  const v = target * k;
  const shown = d.numText ?? (target >= 10000 ? Math.round(v).toLocaleString() : String(Math.round(v)));
  const size = fitFont(shown + (d.unit ?? ""), W - 60, 108, 44);
  return (
    <>
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      <Sfx name="riser" at={at - 4} volume={0.14} />
      <Sfx name="ding" at={at + 28} volume={0.22} />
      <div style={{ position: "absolute", left: 26, top: H * 0.28, width: W - 52 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, opacity: Math.min(1, k * 3) }}>
          <div style={{ color: t.primary, fontSize: size, fontWeight: 900, lineHeight: 0.94, letterSpacing: -3, textShadow: `0 0 50px ${alpha(t.primary, 0.55)}` }}>{shown}</div>
          {d.unit && <div style={{ color: t.text, fontSize: 28, fontWeight: 900, paddingBottom: 10 }}>{d.unit}</div>}
        </div>
        <div style={{ marginTop: 16, height: 3, width: `${k * 100}%`, background: `linear-gradient(90deg, ${t.primary}, ${alpha(t.primary, 0)})` }} />
        {d.label && <div style={{ marginTop: 18, color: t.text, fontSize: 22, lineHeight: 1.45, fontWeight: 700 }}>{d.label}</div>}
        {d.sub && <div style={{ marginTop: 10, color: t.dim, fontSize: 18, lineHeight: 1.5 }}>{d.sub}</div>}
      </div>
      <div style={{ position: "absolute", left: 26, bottom: 40, width: W - 52, display: "flex", gap: 6 }}>
        {new Array(12).fill(0).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 26, background: i / 12 < k ? alpha(t.primary, 0.85) : alpha(t.text, 0.12), borderRadius: 2 }} />
        ))}
      </div>
    </>
  );
};

// ---------- brands：品牌芯片竖排 ----------
const Brands: React.FC<{ d: D; f: number; W: number; H: number; t: any }> = ({ d, f, W, H, t }) => {
  const cues = d.items.map((it, i) => cueOr(it.at, 12 + i * 12));
  return (
    <>
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      {d.title && <div style={{ position: "absolute", left: 26, top: 92, width: W - 52, color: t.text, fontSize: fitFont(d.title, W - 52, 38, 22), fontWeight: 900, lineHeight: 1.1 }}>{d.title}</div>}
      {d.items.map((it, i) => <Sfx key={`s${i}`} name="swish" at={cueOr(it.at, 12 + i * 12) - 1} volume={0.14} />)}
      <div style={{ position: "absolute", left: 54, top: 178, width: 2, height: H - 300, background: alpha(t.primary, 0.22) }} />
      {d.items.map((it, i) => {
        const p = easeOutBack(prog(f, cues[i], 14));
        const c = toneColor(it.tone, t);
        return (
          <div key={i} style={{ position: "absolute", left: 30, top: 186 + i * 118, width: W - 50, display: "flex", alignItems: "center", gap: 14, opacity: Math.min(1, p * 1.4), transform: `translateX(${(1 - p) * -40}px)` }}>
            <div style={{ width: 62, height: 62, borderRadius: 31, background: alpha(t.bg2, 0.95), border: `2px solid ${alpha(c, 0.85)}`, boxShadow: `0 0 22px ${alpha(c, 0.35)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {it.icon ? <Img src={assetUrl(`brands/${it.icon}.svg`)} style={{ width: 34, height: 34, objectFit: "contain" }} /> : <div style={{ color: c, fontFamily: t.font.mono, fontSize: 16, fontWeight: 900 }}>{it.text.slice(0, 2)}</div>}
            </div>
            <div>
              <div style={{ color: t.text, fontSize: fitFont(it.text, W - 140, 27, 17), fontWeight: 900, lineHeight: 1.15 }}>{it.text}</div>
              {it.sub && <div style={{ marginTop: 4, color: t.dim, fontSize: 16 }}>{it.sub}</div>}
            </div>
          </div>
        );
      })}
    </>
  );
};

// ---------- flow：竖向执行链，线往下画 ----------
const Flow: React.FC<{ d: D; f: number; W: number; H: number; t: any }> = ({ d, f, W, H, t }) => {
  const cues = d.items.map((it, i) => cueOr(it.at, 14 + i * 18));
  const n = d.items.length || 4;
  const top = 190, stepY = 132;
  const lineK = clamp(prog(f, 12, 24 + n * 16));
  return (
    <>
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      {d.title && <div style={{ position: "absolute", left: 26, top: 92, width: W - 52, color: t.text, fontSize: fitFont(d.title, W - 52, 38, 22), fontWeight: 900, lineHeight: 1.1 }}>{d.title}</div>}
      {d.items.map((it, i) => <Sfx key={`s${i}`} name="tick" at={cueOr(it.at, 14 + i * 18) + 6} volume={0.18} />)}
      <div style={{ position: "absolute", left: 68, top: top + 26, width: 2, height: (n - 1) * stepY * lineK, background: `repeating-linear-gradient(180deg, ${alpha(t.primary, 0.9)} 0 8px, transparent 8px 16px)` }} />
      {d.items.map((it, i) => {
        const p = easeOut(prog(f, cues[i], 13));
        const y = top + i * stepY;
        const done = f >= cues[i] + 8;
        return (
          <div key={i} style={{ position: "absolute", left: 40, top: y, width: W - 60, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 18}px)` }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: alpha(t.bg2, 0.95), border: `2px solid ${alpha(t.primary, 0.8)}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: done ? `0 0 20px ${alpha(t.primary, 0.4)}` : undefined }}>
              {done ? <div style={{ color: t.primary, fontSize: 26, fontWeight: 900 }}>✓</div> : <div style={{ width: 10, height: 10, borderRadius: 5, background: alpha(t.primary, 0.7) }} />}
            </div>
            <div style={{ position: "absolute", left: 74, top: 4, width: W - 140 }}>
              <div style={{ color: t.text, fontSize: fitFont(it.text, W - 150, 27, 17), fontWeight: 900, lineHeight: 1.15 }}>{it.text}</div>
              {it.sub && <div style={{ marginTop: 5, color: t.dim, fontSize: 16 }}>{it.sub}</div>}
            </div>
          </div>
        );
      })}
    </>
  );
};

// ---------- bars：两条对比条 ----------
const Bars: React.FC<{ d: D; f: number; W: number; H: number; t: any }> = ({ d, f, W, H, t }) => {
  const cues = d.items.map((it, i) => cueOr(it.at, 12 + i * 14));
  return (
    <>
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      {d.title && <div style={{ position: "absolute", left: 26, top: 96, width: W - 52, color: t.text, fontSize: fitFont(d.title, W - 52, 40, 22), fontWeight: 900, lineHeight: 1.12 }}>{d.title}</div>}
      {d.items.map((it, i) => <Sfx key={`s${i}`} name="swipe" at={cues[i] - 1} volume={0.12} />)}
      {d.items.map((it, i) => {
        const p = easeOut(prog(f, cues[i], 22));
        const c = toneColor(it.tone, t);
        const y = 226 + i * 138;
        const val = clamp(Number(it.sub ?? 0) / 100);
        return (
          <div key={i} style={{ position: "absolute", left: 26, top: y, width: W - 52, opacity: Math.min(1, p * 1.6) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ color: t.text, fontSize: 21, fontWeight: 800 }}>{it.text}</div>
              <div style={{ color: c, fontFamily: t.font.mono, fontSize: 18 }}>{it.sub}</div>
            </div>
            <div style={{ marginTop: 10, height: 14, borderRadius: 7, background: alpha(t.text, 0.1) }}>
              <div style={{ width: `${val * 100 * p}%`, height: "100%", borderRadius: 7, background: `linear-gradient(90deg, ${alpha(c, 0.65)}, ${c})`, boxShadow: `0 0 16px ${alpha(c, 0.5)}` }} />
            </div>
          </div>
        );
      })}
      {d.sub && <div style={{ position: "absolute", left: 26, bottom: 46, width: W - 52, color: t.dim, fontSize: 18, lineHeight: 1.5 }}>{d.sub}</div>}
    </>
  );
};

// ---------- wall：两块自留地之间砌墙 ----------
const Wall: React.FC<{ d: D; f: number; W: number; H: number; t: any }> = ({ d, f, W, H, t }) => {
  const build = clamp(prog(f, 18, 40));
  const bricks = 4 * 6;
  return (
    <>
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      {d.title && <div style={{ position: "absolute", left: 26, top: 92, width: W - 52, color: t.text, fontSize: fitFont(d.title, W - 52, 38, 22), fontWeight: 900, lineHeight: 1.1 }}>{d.title}</div>}
      {d.items.slice(0, 2).map((it, i) => {
        const p = easeOutBack(prog(f, 10 + i * 10, 12));
        return (
          <div key={i} style={{ position: "absolute", left: i === 0 ? 26 : W / 2 + 14, top: 190, width: W / 2 - 40, height: 96, borderRadius: 12, border: `2px solid ${alpha(t.primary, 0.55)}`, background: alpha(t.bg2, 0.6), opacity: p, transform: `translateY(${(1 - p) * 18}px)`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <div style={{ color: t.text, fontSize: 21, fontWeight: 900 }}>{it.text}</div>
            <div style={{ color: t.dim, fontSize: 14, marginTop: 4 }}>{it.sub}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: W / 2 - 100, top: 310, width: 200, height: 240, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
        {new Array(bricks).fill(0).map((_, i) => {
          const k = clamp((build * bricks - i) / 2);
          return <div key={i} style={{ opacity: k, transform: `scale(${0.6 + 0.4 * k})`, background: alpha(t.bad, 0.35), border: `1px solid ${alpha(t.bad, 0.8)}`, borderRadius: 3 }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 26, top: 566, width: W - 52, textAlign: "center", color: t.bad, fontFamily: t.font.mono, fontSize: 16, letterSpacing: 3, opacity: build }}>BLOCKED</div>
      <Sfx name="impact" at={52} volume={0.22} />
      {d.items[2] && (
      <div style={{ position: "absolute", left: 26, top: 578, width: W - 52, opacity: easeOut(prog(f, 34, 12)) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: t.bad }} />
            <div style={{ color: t.text, fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>{d.items[2].text}</div>
          </div>
          {d.items[2].sub && <div style={{ marginTop: 6, marginLeft: 18, color: t.dim, fontSize: 16 }}>{d.items[2].sub}</div>}
        </div>
      )}
    </>
  );
};

// ---------- phone：通知卡片飞进手机 ----------
const Phone: React.FC<{ d: D; f: number; W: number; H: number; t: any }> = ({ d, f, W, H, t }) => {
  const cues = d.items.map((it, i) => cueOr(it.at, 14 + i * 16));
  return (
    <>
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      {d.title && <div style={{ position: "absolute", left: 26, top: 92, width: W - 52, color: t.text, fontSize: fitFont(d.title, W - 52, 38, 22), fontWeight: 900, lineHeight: 1.1 }}>{d.title}</div>}
      {d.items.map((it, i) => <Sfx key={`s${i}`} name="bubbles" at={cueOr(it.at, 14 + i * 16)} volume={0.1} />)}
      <div style={{ position: "absolute", left: W / 2 - 120, top: 190, width: 240, height: 430, borderRadius: 30, border: `2px solid ${alpha(t.primary, 0.55)}`, background: `linear-gradient(180deg, ${alpha(t.bg2, 0.85)}, ${alpha(t.bg, 0.7)})`, boxShadow: `0 20px 60px rgba(0,0,0,.5)` }}>
        <div style={{ position: "absolute", left: 100, top: 12, width: 40, height: 5, borderRadius: 3, background: alpha(t.text, 0.25) }} />
      </div>
      {d.items.map((it, i) => {
        const p = easeOutBack(prog(f, cues[i], 13));
        const y = 214 + i * 92;
        return (
          <div key={i} style={{ position: "absolute", left: W / 2 - 104, top: y, width: 208, padding: "10px 12px", borderRadius: 12, background: alpha(t.bg2, 0.96), border: `1px solid ${alpha(t.primary, 0.6)}`, boxShadow: `0 10px 26px rgba(0,0,0,.45)`, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * 120}px) scale(${0.9 + 0.1 * p})` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, background: t.primary, color: t.bg, fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ color: t.text, fontSize: 17, fontWeight: 900, lineHeight: 1.2 }}>{it.text}</div>
            </div>
            {it.sub && <div style={{ marginTop: 4, marginLeft: 26, color: t.dim, fontSize: 13 }}>{it.sub}</div>}
          </div>
        );
      })}
      {d.sub && <div style={{ position: "absolute", left: 26, bottom: 46, width: W - 52, color: t.dim, fontSize: 18, lineHeight: 1.5 }}>{d.sub}</div>}
    </>
  );
};

// ---------- checklist：打勾清单 ----------
const Checklist: React.FC<{ d: D; f: number; W: number; H: number; t: any }> = ({ d, f, W, H, t }) => {
  const cues = d.items.map((it, i) => cueOr(it.at, 12 + i * 13));
  return (
    <>
      <Kicker text={d.kicker} x={26} y={26} w={W - 52} t={t} p={easeOut(prog(f, 0, 10))} />
      {d.title && <div style={{ position: "absolute", left: 26, top: 94, width: W - 52, color: t.text, fontSize: fitFont(d.title, W - 52, 38, 22), fontWeight: 900, lineHeight: 1.1 }}>{d.title}</div>}
      {d.items.map((it, i) => <Sfx key={`s${i}`} name="tick" at={cueOr(it.at, 12 + i * 13)} volume={0.16} />)}
      {d.items.map((it, i) => {
        const p = easeOut(prog(f, cues[i], 12));
        const c = toneColor(it.tone, t);
        return (
          <div key={i} style={{ position: "absolute", left: 26, top: 200 + i * 104, width: W - 52, opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 20}px)` }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, border: `2px solid ${c}`, background: alpha(c, 0.16), flexShrink: 0, marginTop: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: c, fontSize: 17, fontWeight: 900, opacity: p > 0.5 ? 1 : 0 }}>✓</div>
              </div>
              <div style={{ color: t.text, fontSize: fitFont(it.text, W - 110, 25, 17), fontWeight: 800, lineHeight: 1.3 }}>{it.text}</div>
            </div>
            {it.sub && <div style={{ marginTop: 6, marginLeft: 38, color: t.dim, fontSize: 16 }}>{it.sub}</div>}
          </div>
        );
      })}
    </>
  );
};

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: t.font.title }}>
      {d.kind === "statement" && <Statement d={d} f={frame} W={W} H={H} t={t} />}
      {d.kind === "abacus" && <Abacus d={d} f={frame} dur={dur} W={W} H={H} t={t} />}
      {d.kind === "steps" && <Steps d={d} f={frame} W={W} H={H} t={t} />}
      {d.kind === "counter" && <Counter d={d} f={frame} W={W} H={H} t={t} />}
      {d.kind === "brands" && <Brands d={d} f={frame} W={W} H={H} t={t} />}
      {d.kind === "flow" && <Flow d={d} f={frame} W={W} H={H} t={t} />}
      {d.kind === "bars" && <Bars d={d} f={frame} W={W} H={H} t={t} />}
      {d.kind === "wall" && <Wall d={d} f={frame} W={W} H={H} t={t} />}
      {d.kind === "phone" && <Phone d={d} f={frame} W={W} H={H} t={t} />}
      {d.kind === "checklist" && <Checklist d={d} f={frame} W={W} H={H} t={t} />}
    </div>
  );
};

export const SideGraphic: CompDef<D> = {
  id: "side-graphic",
  name: "侧栏竖版动效（陈述/算盘/步骤/计数/品牌/执行链/对比条/围墙/手机/清单）",
  layer: "info",
  panel: true,
  variants: 1,
  minSec: 2,
  maxSec: 30,
  tags: ["侧栏", "竖版", "动效", "真人两侧"],
  motion: { kind: "竖版构图，逐行升起 / 落珠 / 画线 / 砌墙 / 通知飞入", energy: 2 },
  desc: "专给真人口播两侧的窄高动效位使用：人物保持大画面，动效在左右两侧独立演进，不遮挡人脸",
  use: "talking-head-stage 的 left/right 槽位",
  schema,
  example: { kind: "statement", kicker: "PASSIVE TOOL", title: "你拨一下\n它才动一下", num: 0, unit: "次", sub: "不问，它不动" },
  C,
};
