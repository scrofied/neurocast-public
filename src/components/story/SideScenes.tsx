import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, easeOutQuint, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../types";

// ═══ 真人两侧「编辑台式」小剧场 ══════════════════════════════════════════
// 学的是参考片那套「深色编辑台」语法，而不是一排发光胶囊：
//   左上角 mono 小标 → 两行大标题 → 细横线 → 一块扁平面板（细边框、分栏、行号）
//   右侧是一根数据轨：逐条打勾的清单 / 计数 / 进度 / 盖章
// 每块面板里的零件按台词锚点分批出现：命令行逐字打、行从下往上擦、条形从 0 长到值、
// 勾逐个点亮、计数器滚动、印章盖章回弹。中间永远留给人脸，底部永远留给字幕。
// 所有运动都是「信息在写出来」的动作，不做无意义的漂浮。
const item = z.object({
  text: z.string().describe("一句话标签（≤10 字）"),
  note: z.string().optional().describe("下面一行小注（≤14 字）"),
  icon: z.string().optional().describe("图标名：film/search/grid/browser/tool/check/spark/box/layers…"),
  at: z.number().optional().describe("出现时刻（台词锚点/帧）"),
  tone: z.enum(["key", "accent", "warn"]).optional(),
});
const schema = z.object({
  scene: z
    .enum(["skill-loop", "edit-flow", "auto-cut", "model-switch", "skill-search", "design-system", "test-loop", "prompt-app", "mini-app", "four-roles"])
    .describe("按这段话的语义选：流程封装 / 剪辑流程 / 一句话成片 / 模型切换 / 搜技能 / 定风格 / 自动测试 / 一句话生成页面 / 做小程序 / 四角色收束"),
  no: z.string().default("01").describe("左下角的场次编号（两位）"),
  kicker: z.string().default("").describe("左上角 mono 小标（例：// 01 · 流程封装）"),
  title: z.string().default("").describe("左侧大标题，用 \\n 分两行（每行 ≤8 字）"),
  railKicker: z.string().default("").describe("右栏 mono 小标（例：// 配方）"),
  items: z.array(item).min(1).max(4),
  stamp: z
    .object({ text: z.string().describe("章面大字（≤6 字）"), sub: z.string().optional().describe("章下一行小字"), at: z.number().optional() })
    .optional(),
  outAt: z.number().optional().describe("整层收起的时刻；缺省镜头结束前 12 帧"),
});
type D = z.infer<typeof schema>;

const AMBER = "#ffb547";
const ORANGE = "#ff8a3d";
const TEAL = "#5eead4";
const CREAM = "#fff5e8";
const INK = "rgba(8,6,14,.92)";
const LINE = "rgba(255,245,232,.16)";

const C: React.FC<CompProps<D>> = ({ data: d, frame: f, dur, variant }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const enterAt = useEnter(variant);
  const outAt = cueOr(d.outAt, dur - 12);
  const out = easeIn(prog(f, outAt, 12));
  const o = 1 - out;
  const ats = d.items.map((x, i) => (typeof x.at === "number" ? x.at : 12 + i * 14));
  const A = (i: number) => ats[Math.min(i, ats.length - 1)] ?? 12;
  const accent = t.primary;
  const bad = t.bad;

  // ── 版面：左栏 82..578，右栏 1344..1840；中间 578..1344 全部留给人脸 ──
  const lx = W * 0.042;
  const rx = W * 0.7;
  const cw = W * 0.258;
  const top = H * 0.115;
  const panelY = H * 0.265;
  const panelH = H * 0.48;

  const sceneIn = enterAt(f, 0, { fallback: "wipe", dur: 14 });
  const layerStyle: React.CSSProperties = {
    opacity: sceneIn.opacity * o,
    transform: `translate(${sceneIn.dx * 0.35}px, ${sceneIn.dy * 0.35}px) scale(${1 - (1 - sceneIn.scale) * 0.2})`,
  };
  const stampAt = cueOr(d.stamp?.at, dur - 46);
  const stampK = easeOutBack(clamp((f - stampAt) / 12));

  // 通用：上擦 + 上浮。别用 shot.motion.enter，否则 slam/zoom 会把每一行都变成砸屏。
  const rise = (at: number, durF = 11, dy = 14): React.CSSProperties => {
    const p = easeOut(clamp((f - at) / durF));
    return { opacity: p, transform: `translateY(${(1 - p) * dy}px)`, clipPath: p >= 0.999 ? undefined : `inset(${(1 - p) * 46}% 0 -8% 0)` };
  };
  const grow = (at: number, durF = 14) => easeInOut(clamp((f - at) / durF));
  const blink = Math.sin(f / 7) > 0;

  const Kicker = ({ x, label, align = "left", y = top }: { x: number; label: string; align?: "left" | "right"; y?: number }) => {
    const p = rise(2, 12, 8);
    const shown = label.slice(0, Math.max(0, Math.round(clamp((f - 2) / 12) * label.length)));
    return (
      <div style={{ position: "absolute", left: x, top: y, width: cw, textAlign: align, ...p }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: t.font.mono, fontSize: 17, letterSpacing: 2.6, color: alpha(accent, 0.95), textShadow: "0 2px 12px rgba(0,0,0,.85)" }}>
          <span style={{ width: 7, height: 7, background: accent, display: "inline-block", opacity: 0.9 }} />
          {shown}
          <span style={{ display: "inline-block", width: 9, height: 16, background: accent, opacity: blink ? 0.9 : 0.12 }} />
        </div>
      </div>
    );
  };

  const Title = ({ x, text, at = 8 }: { x: number; text: string; at?: number }) => {
    const lines = text.split("\n");
    return (
      <div style={{ position: "absolute", left: x, top: top + 30, width: cw }}>
        {lines.map((ln, i) => {
          const p = rise(at + i * 5, 13, 20);
          return (
            <div key={i} style={{ ...p, fontFamily: t.font.title, fontWeight: 900, fontSize: 44, lineHeight: 1.16, letterSpacing: 1, color: CREAM, textShadow: "0 3px 18px rgba(0,0,0,.8)", whiteSpace: "nowrap" }}>
              {ln}
            </div>
          );
        })}
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 120, height: 3, background: accent, transformOrigin: "left", transform: `scaleX(${grow(at + 8, 12)})` }} />
          <div style={{ width: 6, height: 6, borderRadius: 3, background: accent, opacity: grow(at + 8, 12) }} />
        </div>
      </div>
    );
  };

  // 面板外框：细边、深色、顶部一条 mono 头栏
  const Panel: React.FC<{ x: number; y?: number; h?: number; label: string; right?: string; children: React.ReactNode }> = ({ x, y = panelY, h = panelH, label, right, children }) => {
    const p = rise(10, 13, 18);
    return (
      <div style={{ position: "absolute", left: x, top: y, width: cw, height: h, ...p }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 16, background: `linear-gradient(158deg, ${INK} 0%, rgba(9,7,16,.84) 58%, rgba(18,10,30,.9) 100%)`, border: `1px solid ${LINE}`, boxShadow: "0 26px 60px rgba(0,0,0,.42)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 38, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 15px", fontFamily: t.font.mono, fontSize: 13.5, letterSpacing: 1.8, color: alpha(CREAM, 0.52) }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, background: accent, borderRadius: 1 }} />
            {label}
          </span>
          <span>{right ?? "LIVE"}</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 38, bottom: 0, overflow: "hidden", borderRadius: "0 0 16px 16px" }}>{children}</div>
        {/* 面板里缓慢下移的一道扫描光，保证没有静止的一秒 */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 38 + ((f * 1.35) % Math.max(1, h - 70)), height: 46, background: `linear-gradient(180deg, rgba(0,0,0,0), ${alpha(accent, 0.05)}, rgba(0,0,0,0))`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 10, bottom: 8, fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1.5, color: alpha(CREAM, 0.24) }}>{d.no} / 10</div>
      </div>
    );
  };

  // 右栏：数据轨。顶部大数字 + 逐条勾选的行 + 底部印章
  const Rail: React.FC<{ count: string; unit: string; rows: string[]; at: (i: number) => number; sub?: string }> = ({ count, unit, rows, at, sub }) => {
    const k = easeOutQuint(clamp((f - at(0)) / Math.max(12, at(Math.max(0, rows.length - 1)) - at(0) + 12)));
    const num = Math.round(clamp(k) * parseInt(count, 10) || 0);
    return (
      <div style={{ position: "absolute", left: rx, top, width: cw, ...rise(6, 12, 8) }}>
        <Kicker x={0} y={0} label={d.railKicker || "// 数据"} />
        <div style={{ position: "absolute", left: 0, top: top + 28 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 112, lineHeight: 0.86, letterSpacing: -2, color: CREAM, fontVariantNumeric: "tabular-nums", textShadow: "0 4px 24px rgba(0,0,0,.65)" }}>{String(num).padStart(2, "0")}</div>
            <div style={{ paddingBottom: 12 }}>
              <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 25, color: accent, letterSpacing: 2 }}>{unit}</div>
              {sub && <div style={{ marginTop: 4, fontFamily: t.font.mono, fontSize: 13, letterSpacing: 1.6, color: alpha(CREAM, 0.45) }}>{sub}</div>}
            </div>
          </div>
          <div style={{ marginTop: 16, height: 1, background: LINE, transformOrigin: "left", transform: `scaleX(${grow(10, 14)})` }} />
        </div>
        <div style={{ position: "absolute", left: 0, top: top + 210, width: cw }}>
          {rows.map((r, i) => {
            const at0 = at(i);
            const kk = clamp((f - at0) / 10);
            const done = f >= at0;
            return (
              <div key={i} style={{ ...rise(at0, 10, 12), display: "flex", alignItems: "center", gap: 12, height: 54, borderBottom: `1px solid ${alpha(CREAM, 0.08)}` }}>
                <div style={{ width: 22, height: 22, border: `1.5px solid ${done ? TEAL : "rgba(255,245,232,.24)"}`, background: done ? alpha(TEAL, 0.16) : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: TEAL }}>
                  {done && <Icon name="check" size={14} />}
                </div>
                <div style={{ flex: 1, fontFamily: t.font.title, fontWeight: 900, fontSize: 24, color: done ? CREAM : alpha(CREAM, 0.5), textShadow: "0 2px 10px rgba(0,0,0,.7)" }}>{r}</div>
                <div style={{ fontFamily: t.font.mono, fontSize: 13, letterSpacing: 1.5, color: alpha(TEAL, 0.4 + 0.6 * kk) }}>{String(i + 1).padStart(2, "0")}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const Scene = () => {
    switch (d.scene) {
      // ── 1. 把流程封成 Skill ───────────────────────────────────────────────
      case "skill-loop": {
        const fuse = grow(A(2) + 10, 16);
        const rows = d.items.map((x) => x.text);
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 01 · 流程封装"} />
            <Title x={lx} text={d.title || "把方法\n写成 SKILL"} />
            <Panel x={lx} label="MY WORKFLOW" right="DRAFT">
              <div style={{ padding: "16px 16px 0", fontFamily: t.font.mono, fontSize: 14, letterSpacing: 1.5, color: alpha(CREAM, 0.5) }}>workflow.md</div>
              {rows.map((r, i) => {
                const at0 = A(i);
                const p = grow(at0, 12);
                const shrink = i < 2 ? fuse : 0;
                return (
                  <div key={r} style={{ position: "absolute", left: 16, top: 52 + i * 74, width: cw - 32, transform: `translateY(${shrink * 118}px) scale(${1 - shrink * 0.5})`, opacity: (f >= at0 ? 1 : 0) * (1 - shrink * 0.72), clipPath: p >= 0.999 ? undefined : `inset(0 ${(1 - p) * 100}% 0 0)` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: t.font.mono, fontSize: 13, color: accent }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 24, color: CREAM }}>{r}</span>
                      <span style={{ flex: 1, height: 1, background: alpha(CREAM, 0.1) }} />
                    </div>
                    <div style={{ marginTop: 8, height: 3, background: alpha(CREAM, 0.1) }}>
                      <div style={{ width: `${p * 100}%`, height: "100%", background: i === 1 ? ORANGE : accent }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ position: "absolute", left: 16, right: 16, bottom: 24, height: 82, borderRadius: 12, border: `1.5px solid ${alpha(fuse > 0.05 ? TEAL : CREAM, 0.2 + 0.6 * fuse)}`, background: alpha(TEAL, 0.05 + 0.12 * fuse), display: "flex", alignItems: "center", gap: 12, padding: "0 16px", boxShadow: fuse > 0.05 ? `0 0 26px ${alpha(TEAL, 0.18)}` : undefined }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, border: `1.5px dashed ${alpha(TEAL, 0.5)}`, display: "flex", alignItems: "center", justifyContent: "center", color: TEAL, transform: `rotate(${f * 1.1}deg)` }}>
                  <Icon name="box" size={22} />
                </div>
                <div>
                  <div style={{ fontFamily: t.font.mono, fontSize: 18, letterSpacing: 3, color: CREAM }}>SKILL</div>
                  <div style={{ fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1.2, color: alpha(TEAL, 0.8) }}>{fuse > 0.55 ? "READY · 3 STEPS" : "ASSEMBLING…"}</div>
                </div>
              </div>
            </Panel>
            <Rail count="4" unit="条规则" rows={["触发条件", "执行步骤", "可用工具", "验收标准"]} at={(i) => A(Math.min(i, 3)) + 4} sub="一份 Skill 的结构" />
          </>
        );
      }

      // ── 2. 一句话剪完成片 ────────────────────────────────────────────────
      case "edit-flow": {
        const play = clamp((f - A(0)) / Math.max(10, dur - 24));
        const sliders = [
          { w: 0.46, v: 46 },
          { w: 0.72, v: 72 },
          { w: 0.88, v: 88 },
          { w: 0.61, v: 61 },
        ];
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 02 · 剪辑流程"} />
            <Title x={lx} text={d.title || "一句话\n剪完成片"} />
            <Panel x={lx} label="SEQUENCE · 01" right="30 FPS">
              <div style={{ padding: "16px 16px 0", display: "flex", justifyContent: "space-between", fontFamily: t.font.mono, fontSize: 13, color: alpha(CREAM, 0.5) }}>
                <span>CLIP · 5</span>
                <span style={{ color: accent }}>{`00:00:${String(Math.floor(play * 30)).padStart(2, "0")}:${String(Math.floor((play * 30 * 30) % 30)).padStart(2, "0")}`}</span>
              </div>
              {/* 时间线：五格胶片 + 波形 + 扫描播放头 */}
              <div style={{ position: "absolute", left: 16, right: 16, top: 58, height: 118, border: `1px solid ${LINE}`, background: "rgba(0,0,0,.28)", overflow: "hidden" }}>
                {[0, 1, 2, 3, 4].map((i) => {
                  const at0 = A(Math.min(i, d.items.length - 1));
                  const p = clamp((f - at0) / 9);
                  return <div key={i} style={{ position: "absolute", left: 8 + i * ((cw - 44) / 5), top: 10, width: (cw - 64) / 5, height: 56, background: i % 2 ? alpha(t.primary, 0.42) : alpha(ORANGE, 0.48), opacity: p, transform: `translateY(${(1 - p) * 10}px)` }} />;
                })}
                <svg width={cw - 34} height="42" style={{ position: "absolute", left: 0, bottom: 2 }}>
                  {Array.from({ length: 40 }, (_, i) => {
                    const hh = 3 + Math.abs(Math.sin(i * 1.63 + f / 8)) * 26;
                    return <rect key={i} x={4 + i * ((cw - 42) / 40)} y={34 - hh} width={4} height={hh} rx={2} fill={alpha(CREAM, 0.28)} />;
                  })}
                </svg>
                <div style={{ position: "absolute", left: 6 + play * (cw - 38), top: 0, bottom: 0, width: 2, background: bad, boxShadow: `0 0 10px ${bad}` }} />
              </div>
              {/* 切点：每句话一道 */}
              <div style={{ position: "absolute", left: 16, right: 16, top: 196 }}>
                {d.items.map((it, i) => {
                  const p = clamp((f - A(i)) / 7);
                  return (
                    <div key={i} style={{ ...rise(A(i), 9, 10), display: "flex", alignItems: "center", gap: 10, height: 44 }}>
                      <span style={{ fontFamily: t.font.mono, fontSize: 12, color: alpha(CREAM, 0.4) }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 21, color: CREAM }}>{it.text}</span>
                      <span style={{ flex: 1, height: 1, background: alpha(i === 0 ? accent : CREAM, i === 0 ? 0.4 : 0.12), transformOrigin: "left", transform: `scaleX(${p})` }} />
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Rail count="4" unit="项效果" rows={["节奏", "字幕", "调色", "音效"]} at={(i) => A(Math.min(i, d.items.length - 1)) + 6} sub="按同一套配方" />
            {/* 右栏底部：滑杆排（数据轨下面） */}
            <div style={{ position: "absolute", left: rx, top: top + 470, width: cw, ...rise(18, 12, 10) }}>
              {sliders.map((s, i) => {
                const p = easeOut(clamp((f - A(Math.min(i, d.items.length - 1)) - 6) / 14));
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1.4, color: alpha(CREAM, 0.55) }}><span>{["PACE", "SUB", "GRADE", "AUDIO"][i]}</span><span style={{ color: accent }}>{Math.round(s.v * p)}</span></div>
                    <div style={{ marginTop: 5, height: 4, background: alpha(CREAM, 0.1) }}>
                      <div style={{ width: `${s.w * 100 * p}%`, height: "100%", background: `linear-gradient(90deg, ${alpha(accent, 0.5)}, ${accent})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      }

      // ── 3. 一句话 → 自动成片 ─────────────────────────────────────────────
      case "auto-cut": {
        const typed = clamp((f - A(0)) / 30);
        const prompt = "把这条剪成 30 秒";
        const shown = prompt.slice(0, Math.round(typed * prompt.length));
        const run = clamp((f - A(1)) / 12);
        const pc = clamp((f - A(1) - 8) / Math.max(12, A(2) - A(1)));
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 03 · 一句话成片"} />
            <Title x={lx} text={d.title || "说一句话\n它自己剪"} />
            <Panel x={lx} label="AGENT · RUN" right="AUTO">
              <div style={{ position: "absolute", left: 16, right: 16, top: 14, padding: "11px 14px", border: `1px solid ${alpha(accent, 0.5)}`, background: alpha(accent, 0.07), fontFamily: t.font.title, fontWeight: 900, fontSize: 20, color: CREAM, minHeight: 44 }}>
                {shown}<span style={{ opacity: blink ? 1 : 0, color: accent }}>｜</span>
              </div>
              <div style={{ position: "absolute", left: 16, right: 16, top: 76, fontFamily: t.font.mono, fontSize: 16, letterSpacing: 0.5, color: alpha(CREAM, 0.8) }}>$ skill run edit</div>
              {["挑选片段", "对齐卡点", "套用字幕", "导出成片"].map((r, i) => {
                const at0 = A(1) + i * 6;
                return (
                  <div key={r} style={{ ...rise(at0, 8, 8), position: "absolute", left: 22, top: 108 + i * 35, fontFamily: t.font.title, fontWeight: 900, fontSize: 19, color: f >= at0 + 2 ? TEAL : alpha(CREAM, 0.2) }}>
                    <span style={{ marginRight: 8 }}>✓</span>{r}
                  </div>
                );
              })}
              <div style={{ position: "absolute", left: 16, right: 16, bottom: 36, height: 6, background: alpha(CREAM, 0.1) }}>
                <div style={{ width: `${pc * 100}%`, height: "100%", background: `linear-gradient(90deg, ${ORANGE}, ${accent})` }} />
              </div>
              <div style={{ position: "absolute", left: 16, right: 16, bottom: 12, display: "flex", justifyContent: "space-between", fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1.5, color: alpha(CREAM, 0.5) }}>
                <span>AUTO CUT</span><span style={{ color: accent }}>{Math.round(pc * 100)}%</span>
              </div>
            </Panel>
            {/* 右栏：产出卡 + 大数字 */}
            <div style={{ position: "absolute", left: rx, top, width: cw, ...rise(6, 12, 8) }}>
              <Kicker x={rx} label={d.railKicker || "// 产出"} />
              <div style={{ position: "absolute", left: 0, top: top + 30, display: "flex", alignItems: "flex-end", gap: 12 }}>
                <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 112, lineHeight: 0.86, color: CREAM, fontVariantNumeric: "tabular-nums" }}>01</div>
                <div style={{ paddingBottom: 12, fontFamily: t.font.title, fontWeight: 900, fontSize: 25, color: accent }}>句</div>
              </div>
              <div style={{ position: "absolute", left: 0, top: top + 150, width: cw, ...rise(A(2), 12, 18) }}>
                <div style={{ height: 150, border: `1px solid ${LINE}`, background: "rgba(0,0,0,.3)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 10, display: "flex", gap: 4 }}>
                    {[0, 1, 2, 3].map((i) => <div key={i} style={{ flex: 1, background: i % 2 ? alpha(accent, 0.35) : alpha(ORANGE, 0.26), transform: `scaleY(${clamp((f - A(2) - i * 3) / 12)})`, transformOrigin: "bottom" }} />)}
                  </div>
                  <div style={{ position: "absolute", left: 10, bottom: 8, fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1.5, color: alpha(CREAM, 0.7) }}>OUTPUT · 30s · MP4</div>
                </div>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontFamily: t.font.mono, fontSize: 13, letterSpacing: 1.5, color: TEAL }}>
                  <Icon name="check" size={15} /> EXPORTED
                </div>
              </div>
              <div style={{ position: "absolute", left: 0, top: top + 350, width: cw, display: "flex", gap: 8 }}>
                {["输入", "剪辑", "成片"].map((s, i) => (
                  <div key={s} style={{ flex: 1, ...rise(A(1) + i * 8, 10, 10), padding: "9px 0", textAlign: "center", border: `1px solid ${alpha(i === 2 ? TEAL : CREAM, i === 2 ? 0.5 : 0.16)}`, fontFamily: t.font.title, fontWeight: 900, fontSize: 17, color: i === 2 ? TEAL : CREAM }}>{s}</div>
                ))}
              </div>
            </div>
          </>
        );
      }

      // ── 4. 模型切换 ──────────────────────────────────────────────────────
      case "model-switch": {
        const cx = lx + cw / 2;
        const cy = panelY + panelH / 2 + 6;
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 04 · 模型选择"} />
            <Title x={lx} text={d.title || "按任务\n换模型"} />
            <Panel x={lx} label="MODEL ROUTER" right="4 SLOTS">
              <svg width={cw} height={panelH - 38} style={{ position: "absolute", inset: 0 }}>
                {d.items.map((_, i) => {
                  const ang = -Math.PI / 2 + (i * Math.PI) / 2;
                  const x = cw / 2 + Math.cos(ang) * 128;
                  const y = (panelH - 38) / 2 + Math.sin(ang) * 112;
                  const p = clamp((f - A(i)) / 10);
                  return <line key={i} x1={cw / 2} y1={(panelH - 38) / 2} x2={x} y2={y} stroke={alpha(i === 0 ? accent : CREAM, 0.12 + 0.4 * p)} strokeWidth="1.5" strokeDasharray="5 6" />;
                })}
                <circle cx={cw / 2} cy={(panelH - 38) / 2} r={96 + Math.sin(f / 40) * 5} fill="none" stroke={alpha(accent, 0.14)} strokeWidth="1" strokeDasharray="3 8" />
              </svg>
              <div style={{ position: "absolute", left: cw / 2 - 46, top: (panelH - 38) / 2 - 46, width: 92, height: 92, borderRadius: 18, border: `1.5px solid ${alpha(accent, 0.75)}`, background: `linear-gradient(150deg, ${alpha(accent, 0.22)}, rgba(8,6,14,.96))`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 34px ${alpha(accent, 0.16)}` }}>
                <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: 21, letterSpacing: 2, color: CREAM }}>TRAE</span>
              </div>
              {d.items.map((it, i) => {
                const ang = -Math.PI / 2 + (i * Math.PI) / 2;
                const x = cw / 2 + Math.cos(ang) * 128;
                const y = (panelH - 38) / 2 + Math.sin(ang) * 112;
                const lit = f >= A(i);
                return (
                  <div key={i} style={{ ...rise(A(i), 10, 10), position: "absolute", left: x - 58, top: y - 20, width: 116, height: 40, border: `1px solid ${alpha(lit ? (i === 0 ? accent : CREAM) : CREAM, lit ? 0.65 : 0.12)}`, background: lit ? alpha(i === 0 ? accent : CREAM, 0.08) : "rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: it.text.length > 7 ? 15 : 18, color: lit ? CREAM : alpha(CREAM, 0.4), whiteSpace: "nowrap" }}>{it.text}</span>
                  </div>
                );
              })}
              <div style={{ position: "absolute", left: 14, bottom: 10, fontFamily: t.font.mono, fontSize: 12, color: alpha(CREAM, 0.4) }}>{`ROUTE · ${f >= A(2) ? "TASK → MODEL" : "IDLE"}`}</div>
            </Panel>
            <Rail count="4" unit="个模型" rows={["豆包 · 内容", "DeepSeek · 推理", "Qwen · 通用", "GPT · 国际"]} at={(i) => A(Math.min(i, 3)) + 5} sub="同一句里自由切" />
            <div style={{ position: "absolute", left: rx, top: top + 470, width: cw, ...rise(A(2) + 8, 11, 10) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 62, height: 28, borderRadius: 15, border: `1.5px solid ${alpha(accent, 0.8)}`, background: alpha(accent, 0.16), position: "relative" }}>
                  <div style={{ position: "absolute", left: 4 + 32 * clamp((f - A(2) - 8) / 14), top: 3, width: 22, height: 22, borderRadius: 11, background: accent }} />
                </div>
                <div style={{ fontFamily: t.font.mono, fontSize: 13, letterSpacing: 1.8, color: alpha(CREAM, 0.65) }}>SWITCH BY TASK</div>
              </div>
            </div>
          </>
        );
      }

      // ── 5. 搜技能 ────────────────────────────────────────────────────────
      case "skill-search": {
        const cmd = "$ trae skill find PPT";
        const typed = Math.round(clamp((f - A(0)) / 26) * cmd.length);
        const scan = f * 2.6;
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 05 · 找技能"} />
            <Title x={lx} text={d.title || "先搜\n再安装"} />
            <Panel x={lx} label="TERMINAL · FIND" right="SKILLS">
              <div style={{ padding: "16px 16px 0", fontFamily: t.font.mono, fontSize: 17, color: CREAM, letterSpacing: 0.4 }}>
                {cmd.slice(0, typed)}<span style={{ opacity: blink ? 1 : 0, color: accent }}>▌</span>
              </div>
              {d.items.map((it, i) => {
                const at0 = A(i) + 6;
                return (
                  <div key={i} style={{ ...rise(at0, 9, 8), position: "absolute", left: 16, right: 16, top: 58 + i * 58, height: 46, borderTop: `1px solid ${alpha(CREAM, 0.1)}`, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: t.font.mono, fontSize: 12, color: accent }}>›</span>
                    <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 20, color: CREAM }}>{it.text}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontFamily: t.font.mono, fontSize: 12, color: alpha(TEAL, 0.85) }}>{it.note ?? "v1.2"}</span>
                  </div>
                );
              })}
              {/* 小雷达在面板下半部右侧 */}
              <div style={{ position: "absolute", right: 18, bottom: 18, width: 92, height: 92, borderRadius: 46, border: `1px solid ${alpha(accent, 0.26)}` }}>
                <div style={{ position: "absolute", left: 6, top: 6, width: 78, height: 78, borderRadius: 39, border: `1px solid ${alpha(accent, 0.12)}` }} />
                <div style={{ position: "absolute", left: "50%", top: "50%", width: 45, height: 1.5, background: `linear-gradient(90deg, ${alpha(accent, 0.9)}, rgba(0,0,0,0))`, transformOrigin: "left center", transform: `rotate(${scan}deg)` }} />
                {[0, 1, 2].map((i) => {
                  const on = f > A(i) + 8;
                  return <span key={i} style={{ position: "absolute", left: 26 + i * 17, top: 30 + i * 13, width: 4, height: 4, borderRadius: 2, background: on ? TEAL : alpha(CREAM, 0.25) }} />;
                })}
              </div>
            </Panel>
            {/* 右：技能卡 + 安装 */}
            <div style={{ position: "absolute", left: rx, top, width: cw, ...rise(6, 12, 8) }}>
              <Kicker x={rx} label={d.railKicker || "// 安装"} />
              <div style={{ position: "absolute", left: 0, top: top + 32, width: cw, ...rise(A(1), 12, 14) }}>
                <div style={{ padding: "16px 16px 14px", border: `1px solid ${LINE}`, background: "rgba(0,0,0,.28)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon name="box" size={22} />
                    <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 23, color: CREAM }}>{d.items[0]?.text ?? "find-skills"}</span>
                  </div>
                  <div style={{ marginTop: 8, fontFamily: t.font.mono, fontSize: 12.5, lineHeight: 1.6, color: alpha(CREAM, 0.5) }}>技能市场里按需求检索<br />给你现成的安装命令</div>
                  <div style={{ marginTop: 14, height: 40, border: `1.5px solid ${alpha(accent, 0.7)}`, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, background: accent, transformOrigin: "left", transform: `scaleX(${clamp((f - A(2)) / 18)})` }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: 18, color: f >= A(2) + 12 ? "#120b04" : CREAM }}>{f >= A(2) + 12 ? "已安装" : "安装"}</div>
                  </div>
                  <div style={{ marginTop: 10, fontFamily: t.font.mono, fontSize: 12, color: alpha(TEAL, 0.85) }}>{f >= A(2) + 12 ? "✓ INSTALLED" : `INSTALLING ${Math.round(clamp((f - A(2)) / 18) * 100)}%`}</div>
                </div>
              </div>
              <div style={{ position: "absolute", left: 0, top: top + 320, width: cw, fontFamily: t.font.mono, fontSize: 13, lineHeight: 1.8, color: alpha(CREAM, 0.5), ...rise(A(2) + 6, 10, 8) }}>
                <div>$ trae skill install find-skills</div>
                <div style={{ color: alpha(accent, 0.9) }}>→ 装完就能直接喊它找技能</div>
              </div>
            </div>
          </>
        );
      }

      // ── 6. 定风格 ────────────────────────────────────────────────────────
      case "design-system": {
        const swatches = ["#f3e7d3", "#ffb547", "#ff8a3d", "#8f7bd6", "#2c2544"];
        const built = clamp((f - A(1)) / 22);
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 06 · 定风格"} />
            <Title x={lx} text={d.title || "先定规范\n再写页面"} />
            <Panel x={lx} label="DESIGN RULES" right={`${Math.round(built * 100)}%`}>
              <div style={{ padding: "14px 16px 0", display: "flex", gap: 7 }}>
                {swatches.map((c, i) => {
                  const k = easeOutBack(clamp((f - A(0) - i * 4) / 12));
                  return <div key={c} style={{ width: 42, height: 42, background: c, opacity: k, transform: `translateY(${(1 - k) * -18}px) scale(${k})`, border: `1px solid ${alpha("#000", 0.2)}` }} />;
                })}
              </div>
              <div style={{ padding: "16px 16px 0" }}>
                {[26, 19, 15].map((s, i) => {
                  const k = clamp((f - A(0) - 8 - i * 4) / 10);
                  return <div key={s} style={{ ...rise(A(0) + 8 + i * 4, 9, 8), fontFamily: t.font.title, fontWeight: 900, fontSize: s + 8, color: i === 0 ? CREAM : alpha(CREAM, 0.62 - i * 0.1), lineHeight: 1.35 }}>Aa 标题 / 正文 {i + 1}</div>;
                })}
              </div>
              <div style={{ position: "absolute", left: 16, bottom: 44, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, width: cw - 32 }}>
                {Array.from({ length: 12 }, (_, i) => {
                  const k = clamp((f - A(1) - i * 1.5) / 8);
                  return <div key={i} style={{ height: 22, border: `1px solid ${alpha(CREAM, 0.1)}`, background: i === 7 ? alpha(accent, 0.4 * k) : alpha(CREAM, 0.03 * k), opacity: k }} />;
                })}
              </div>
              <div style={{ position: "absolute", left: 16, bottom: 16, fontFamily: t.font.mono, fontSize: 11.5, letterSpacing: 1.4, color: alpha(CREAM, 0.45) }}>GRID 8PT · RADIUS 12 · 3 WEIGHTS</div>
            </Panel>
            {/* 右：before / after */}
            <div style={{ position: "absolute", left: rx, top, width: cw, ...rise(6, 12, 8) }}>
              <Kicker x={rx} label={d.railKicker || "// 前后对比"} />
              <div style={{ position: "absolute", left: 0, top: top + 34, width: cw }}>
                {[0, 1].map((k) => {
                  const e = clamp((f - A(1) - k * 9) / 13);
                  const styled = k === 1;
                  return (
                    <div key={k} style={{ position: "relative", height: 118, marginBottom: 12, border: `1px solid ${styled ? alpha(accent, 0.6) : LINE}`, background: styled ? `linear-gradient(150deg, ${alpha(accent, 0.13)}, rgba(8,6,14,.9))` : "rgba(255,245,232,.06)", opacity: e, transform: `translateY(${(1 - e) * 14}px)`, overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 12, top: 10, width: 58, height: 7, background: styled ? accent : alpha(CREAM, 0.3) }} />
                      <div style={{ position: "absolute", left: 12, top: 26, width: 110, height: 5, background: styled ? alpha(CREAM, 0.3) : alpha(CREAM, 0.16) }} />
                      <div style={{ position: "absolute", left: 12, bottom: 12, width: 52, height: 18, background: styled ? accent : alpha(CREAM, 0.2) }} />
                      <div style={{ position: "absolute", right: 10, top: 8, fontFamily: t.font.mono, fontSize: 11, letterSpacing: 1.4, color: styled ? accent : alpha(CREAM, 0.4) }}>{styled ? "AFTER" : "BEFORE"}</div>
                    </div>
                  );
                })}
                <div style={{ position: "absolute", left: 10, top: 104, padding: "6px 12px", border: `2px solid ${bad}`, color: bad, fontFamily: t.font.title, fontWeight: 900, fontSize: 20, background: "rgba(8,6,14,.88)", opacity: clamp((f - A(2)) / 8), transform: "rotate(-4deg)" }}>
                  一眼假
                  <div style={{ position: "absolute", left: -4, right: -4, top: "50%", height: 2.5, background: bad, transformOrigin: "left", transform: `scaleX(${clamp((f - A(2) - 7) / 9)})` }} />
                </div>
              </div>
              <div style={{ position: "absolute", left: 0, top: top + 340, width: cw }}>
                {d.items.slice(0, 3).map((it, i) => (
                  <div key={i} style={{ ...rise(A(1) + 10 + i * 7, 9, 8), display: "flex", alignItems: "center", gap: 8, height: 32, fontFamily: t.font.mono, fontSize: 14, letterSpacing: 1.4, color: alpha(CREAM, 0.7) }}>
                    <Icon name="check" size={14} /> {it.text}
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      }

      // ── 7. 自动测试 ──────────────────────────────────────────────────────
      case "test-loop": {
        const step = clamp((f - A(0)) / Math.max(14, dur - 26));
        const cursorX = 34 + step * (cw - 110);
        const cursorY = 118 + Math.sin(step * Math.PI * 2.2) * 42;
        const clicked = step > 0.34;
        const fixed = f >= A(2) + 8;
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 07 · 自动测试"} />
            <Title x={lx} text={d.title || "它自己\n开着浏览器"} />
            <Panel x={lx} label="BROWSER · AUTO" right={fixed ? "PASS" : "RUN"}>
              <div style={{ position: "absolute", left: 14, right: 14, top: 14, bottom: 46, border: `1px solid ${LINE}`, background: "rgba(0,0,0,.32)", overflow: "hidden" }}>
                <div style={{ height: 24, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
                  {[0, 1, 2].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: 3, background: alpha(CREAM, 0.24) }} />)}
                  <span style={{ marginLeft: 6, fontFamily: t.font.mono, fontSize: 10, color: alpha(CREAM, 0.38) }}>MY APP</span>
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ width: "52%", height: 6, background: alpha(CREAM, 0.26) }} />
                  <div style={{ marginTop: 7, width: "74%", height: 4, background: alpha(CREAM, 0.12) }} />
                  <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                    {[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 34, border: `1px solid ${alpha(i === 1 ? accent : CREAM, 0.22)}`, background: i === 1 ? alpha(accent, 0.1) : "transparent" }} />)}
                  </div>
                  <div style={{ marginTop: 10, width: "38%", height: 24, background: alpha(accent, 0.22), border: `1px solid ${alpha(accent, 0.5)}` }} />
                </div>
                {/* 光标 + 点击涟漪 */}
                <div style={{ position: "absolute", left: cursorX, top: cursorY, width: 0, height: 0, borderLeft: "8px solid #fff", borderBottom: "12px solid transparent", filter: "drop-shadow(0 0 3px #000)", transform: "rotate(-16deg)" }} />
                {clicked && <div style={{ position: "absolute", left: cursorX - 12, top: cursorY + 6, width: 34, height: 34, borderRadius: 17, border: `2px solid ${accent}`, opacity: 1 - clamp((f - A(1)) / 18) }} />}
                {/* 控制台 */}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34, borderTop: `1px solid ${LINE}`, background: "rgba(4,3,8,.72)", display: "flex", alignItems: "center", padding: "0 9px", fontFamily: t.font.mono, fontSize: 11, color: fixed ? TEAL : bad }}>
                  {fixed ? "✓ console clean · screenshot saved" : clicked ? "× console error · expected 1 got 0" : "▌ waiting for click…"}
                </div>
              </div>
              <div style={{ position: "absolute", left: 14, bottom: 12, fontFamily: t.font.mono, fontSize: 11.5, letterSpacing: 1.4, color: alpha(CREAM, 0.45) }}>AUTO CLICK · SNAPSHOT · FIX</div>
            </Panel>
            {/* 右：五步闭环 */}
            <div style={{ position: "absolute", left: rx, top, width: cw, ...rise(6, 12, 8) }}>
              <Kicker x={rx} label={d.railKicker || "// 闭环"} />
              <div style={{ position: "absolute", left: 0, top: top + 34, width: cw }}>
                {d.items.map((it, i) => {
                  const at0 = A(i);
                  const done = f >= at0 + 3;
                  return (
                    <div key={i} style={{ ...rise(at0, 9, 8), display: "flex", alignItems: "center", gap: 10, height: 58, borderBottom: `1px solid ${alpha(CREAM, 0.09)}` }}>
                      <span style={{ fontFamily: t.font.mono, fontSize: 12, color: alpha(CREAM, 0.4) }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ width: 18, height: 18, border: `1.5px solid ${done ? TEAL : alpha(CREAM, 0.24)}`, display: "flex", alignItems: "center", justifyContent: "center", color: TEAL }}>{done && <Icon name="check" size={12} />}</span>
                      <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 22, color: done ? CREAM : alpha(CREAM, 0.45) }}>{it.text}</span>
                    </div>
                  );
                })}
                <div style={{ marginTop: 16, fontFamily: t.font.mono, fontSize: 13, letterSpacing: 1.6, color: alpha(TEAL, 0.9), opacity: clamp((f - A(3)) / 12) }}>↺ 改完再跑一遍</div>
              </div>
            </div>
          </>
        );
      }

      // ── 8. 一句话生成页面（讲“门槛”，不碰现场画面） ─────────────────────
      case "prompt-app": {
        const prompt = "做一个微信小程序";
        const typed = Math.round(clamp((f - A(0)) / 24) * prompt.length);
        const ask = clamp((f - A(0)) / 26);
        const gen = clamp((f - A(1)) / 20);
        const run = clamp((f - A(2)) / 14);
        // 提问之后不要干等：先让 agent 起手、文件行开始流、页面骨架先搭起来，
        // 到「它直接给你生成」这句话才把状态翻成 WORKING / OK。
        const head = clamp((f - A(0) - 18) / 10);
        const sketch = clamp((f - A(0) - 30) / 34);
        const pct = clamp(0.08 + sketch * 0.2 + gen * 0.72);
        const files = [
          { t: "pages/index", at: A(0) + 34 },
          { t: "app.json", at: A(0) + 42 },
          { t: "preview ready", at: A(2) + 5 },
        ];
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 04 · 门槛"} />
            <Title x={lx} text={d.title || "一句话\n长出小程序"} />
            <Panel x={lx} label="CHAT · BUILD" right={run > 0.5 ? "READY" : gen > 0 ? "BUILD" : head > 0.5 ? "THINK" : "IDLE"}>
              {/* 用户只说了一句 */}
              <div style={{ position: "absolute", left: 20, right: 18, top: 18, display: "flex", justifyContent: "flex-end" }}>
                <div style={{ maxWidth: cw - 90, padding: "11px 15px", borderRadius: "14px 14px 3px 14px", border: `1px solid ${alpha(accent, 0.28 + 0.3 * ask)}`, background: alpha(accent, 0.04 + 0.07 * ask), fontFamily: t.font.title, fontWeight: 900, fontSize: 19, lineHeight: 1.3, color: typed ? CREAM : alpha(CREAM, 0.42), transform: `translateY(${(1 - ask) * 12}px)` }}>
                  {typed ? prompt.slice(0, typed) : "描述你要的小程序…"}
                  <span style={{ opacity: blink ? 1 : 0, color: accent }}>｜</span>
                </div>
              </div>
              {/* 生成出来的文件行 */}
              <div style={{ position: "absolute", left: 20, right: 18, top: 86 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: t.font.mono, fontSize: 12.5, letterSpacing: 1.8, color: alpha(TEAL, 0.85), opacity: head }}>
                  <span style={{ width: 7, height: 7, borderRadius: 4, background: TEAL, boxShadow: `0 0 8px ${alpha(TEAL, 0.8)}` }} />
                  TRAE · AGENT
                  <span style={{ marginLeft: 4, color: alpha(CREAM, 0.38) }}>{run > 0.5 ? "DONE" : gen > 0 ? "WORKING" : head > 0.5 ? "THINKING" : "READY"}</span>
                </div>
                {files.map((x, i) => {
                  const p = clamp((f - x.at) / 9);
                  const ok = i === 2 ? f >= x.at + 3 : f >= A(1) + 2;
                  return (
                    <div key={x.t} style={{ ...rise(x.at, 9, 8), display: "flex", alignItems: "center", gap: 9, height: 34, borderBottom: `1px solid ${alpha(CREAM, 0.08)}`, fontFamily: t.font.mono, fontSize: 15, color: i === 2 ? TEAL : alpha(CREAM, 0.8) }}>
                      <span style={{ color: i === 2 ? TEAL : accent }}>{i === 2 ? "✓" : "▸"}</span>
                      {x.t}
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 10.5, letterSpacing: 1.2, color: ok ? alpha(TEAL, 0.9) : alpha(CREAM, 0.34) }}>{ok ? "OK" : p > 0.9 ? "…" : ""}</span>
                    </div>
                  );
                })}
              </div>
              {/* 生成出来的页面骨架：三块板子落位 */}
              <div style={{ position: "absolute", left: 20, right: 18, top: 212, height: 156, border: `1px solid ${alpha(accent, 0.32 + 0.3 * gen)}`, background: "rgba(0,0,0,.28)", overflow: "hidden", opacity: clamp(sketch * 1.8) }}>
                <div style={{ position: "absolute", left: 10, top: 10, width: 74, height: 6, background: alpha(CREAM, 0.5) }} />
                <div style={{ position: "absolute", right: 10, top: 8, fontFamily: t.font.mono, fontSize: 10, letterSpacing: 1.2, color: alpha(TEAL, 0.8) }}>MINI APP</div>
                {[
                  { l: 10, t: 32, w: 132, h: 58, c: accent },
                  { l: 152, t: 32, w: 90, h: 58, c: t.primary },
                  { l: 252, t: 32, w: 185, h: 58, c: t.primary },
                  { l: 10, t: 100, w: 132, h: 20, c: TEAL },
                  { l: 10, t: 128, w: 230, h: 12, c: CREAM },
                ].map((b, i) => {
                  const k = clamp((f - A(0) - 32 - i * 5) / 14);
                  return <div key={i} style={{ position: "absolute", left: b.l, top: b.t, width: b.w, height: b.h, borderRadius: 5, border: `1px solid ${alpha(b.c, 0.28 + 0.4 * k)}`, background: alpha(b.c, 0.06 + 0.12 * k), opacity: k, transform: `translateY(${(1 - k) * 10}px)` }} />;
                })}
              </div>
              <div style={{ position: "absolute", left: 20, right: 18, top: 388, height: 5, background: alpha(CREAM, 0.1) }}>
                <div style={{ width: `${pct * 100}%`, height: "100%", background: `linear-gradient(90deg, ${ORANGE}, ${accent})` }} />
              </div>
              <div style={{ position: "absolute", left: 20, right: 18, top: 402, display: "flex", justifyContent: "space-between", fontFamily: t.font.mono, fontSize: 10.5, letterSpacing: 1.4, color: alpha(CREAM, 0.46) }}>
                <span>{run > 0.5 ? "✓ 可以点开" : gen > 0 ? "生成中" : sketch > 0 ? "搭页面" : "等一句话"}</span>
                <span style={{ color: run > 0.5 ? TEAL : accent }}>{Math.round(pct * 100)}%</span>
              </div>
            </Panel>
            <Rail count="1" unit="句话" rows={d.items.map((x) => x.text)} at={(i) => A(i) + 4} sub="从一句话到能跑" />
            <div style={{ position: "absolute", left: rx, top: top + 510, width: cw, ...rise(A(1) + 8, 12, 10) }}>
              <div style={{ padding: "10px 12px", border: `1px solid ${LINE}`, background: "rgba(0,0,0,.3)", fontFamily: t.font.mono, fontSize: 12.5, lineHeight: 1.75, color: alpha(CREAM, 0.7) }}>
                <div>$ trae build miniapp</div>
                <div style={{ color: alpha(TEAL, 0.9) }}>✓ 页面 + 组件 + 预览</div>
              </div>
            </div>
          </>
        );
      }

      // ── 9. 生成小程序 ────────────────────────────────────────────────────
      case "mini-app": {
        const asm = clamp((f - A(0)) / 26);
        const gen = clamp((f - A(1)) / 20);
        const live = clamp((f - A(2)) / 14);
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 08 · 做小程序"} />
            <Title x={lx} text={d.title || "一句话\n生成小程序"} />
            <Panel x={lx} label="MINI APP · BUILD" right={live > 0.5 ? "RUNNING" : gen > 0 ? "BUILD" : "WIREFRAME"}>
              <div style={{ position: "absolute", left: cw / 2 - 92, top: 26, width: 184, height: 300, border: `1.5px solid ${alpha(accent, 0.7)}`, borderRadius: 24, background: "rgba(6,4,12,.78)", overflow: "hidden", boxShadow: `0 18px 40px rgba(0,0,0,.4)` }}>
                <div style={{ position: "absolute", left: "50%", top: 7, width: 44, height: 5, borderRadius: 3, background: alpha(CREAM, 0.25), transform: "translateX(-50%)" }} />
                {[
                  { l: 12, t: 24, w: 160, h: 70, c: accent },
                  { l: 12, t: 102, w: 76, h: 44, c: t.primary },
                  { l: 96, t: 102, w: 76, h: 44, c: t.primary },
                  { l: 12, t: 156, w: 160, h: 58, c: accent },
                  { l: 12, t: 226, w: 96, h: 22, c: CREAM },
                  { l: 12, t: 258, w: 160, h: 26, c: TEAL },
                ].map((b, i) => {
                  const k = clamp((f - A(0) - i * 4) / 13) * asm;
                  return <div key={i} style={{ position: "absolute", left: b.l, top: b.t, width: b.w, height: b.h, borderRadius: 8, border: `1px solid ${alpha(b.c, 0.3 + 0.5 * k)}`, background: alpha(b.c, 0.05 + 0.12 * k), opacity: k, transform: `scale(${0.92 + 0.08 * k})` }} />;
                })}
                {live > 0.5 && <div style={{ position: "absolute", left: 12, top: 258, width: 160, height: 26, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.mono, fontSize: 11, letterSpacing: 1.4, color: TEAL }}>CHECKOUT ✓</div>}
              </div>
              <div style={{ position: "absolute", left: 14, right: 14, bottom: 18, fontFamily: t.font.mono, fontSize: 12, letterSpacing: 1.4, color: live > 0.5 ? TEAL : alpha(CREAM, 0.55) }}>
                {live > 0.5 ? "✓ RUNNING · 可点击" : gen > 0 ? `GENERATING ${Math.round(gen * 100)}%` : "▌ WIREFRAME"}
              </div>
              <div style={{ position: "absolute", left: 14, top: 20, fontFamily: t.font.mono, fontSize: 11, letterSpacing: 1.3, color: alpha(CREAM, 0.35) }}>TARO</div>
            </Panel>
            {/* 右：三步 + 命令行 */}
            <div style={{ position: "absolute", left: rx, top, width: cw, ...rise(6, 12, 8) }}>
              <Kicker x={rx} label={d.railKicker || "// 三步"} />
              <div style={{ position: "absolute", left: 0, top: top + 34, width: cw }}>
                {d.items.map((it, i) => {
                  const at0 = A(i);
                  const done = f >= at0 + 8;
                  return (
                    <div key={i} style={{ ...rise(at0, 10, 10), display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 15, border: `1.5px solid ${done ? TEAL : alpha(CREAM, 0.3)}`, background: done ? alpha(TEAL, 0.14) : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: done ? TEAL : CREAM, fontFamily: t.font.mono, fontSize: 13 }}>{done ? "✓" : i + 1}</div>
                      <div>
                        <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 24, color: CREAM }}>{it.text}</div>
                        {it.note && <div style={{ marginTop: 3, fontFamily: t.font.mono, fontSize: 12.5, color: alpha(CREAM, 0.5) }}>{it.note}</div>}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 4, padding: "10px 12px", border: `1px solid ${LINE}`, background: "rgba(0,0,0,.3)", fontFamily: t.font.mono, fontSize: 12.5, lineHeight: 1.7, color: alpha(CREAM, 0.7) }}>
                  <div>$ trae build miniapp</div>
                  <div style={{ color: alpha(TEAL, 0.9) }}>✓ pages/home.tsx</div>
                  <div style={{ color: alpha(TEAL, 0.9) }}>✓ preview ready</div>
                </div>
              </div>
            </div>
          </>
        );
      }

      // ── 9. 四个角色 ──────────────────────────────────────────────────────
      case "four-roles": {
        return (
          <>
            <Kicker x={lx} label={d.kicker || "// 09 · 四个角色"} />
            <Title x={lx} text={d.title || "装完四个\n多了四个人"} />
            <Panel x={lx} label="TEAM · 4 ROLES" right={`${Math.min(4, d.items.filter((_, i) => f >= A(i)).length)} / 4`}>
              <svg width={cw} height={panelH - 38} style={{ position: "absolute", inset: 0 }}>
                {d.items.map((_, i) => {
                  const ang = -Math.PI / 2 + (i * Math.PI) / 2;
                  const x = cw / 2 + Math.cos(ang) * 118;
                  const y = (panelH - 38) / 2 + Math.sin(ang) * 96;
                  const p = clamp((f - A(i)) / 10);
                  return <line key={i} x1={cw / 2} y1={(panelH - 38) / 2} x2={x} y2={y} stroke={alpha(i % 2 ? accent : t.primary, 0.12 + 0.5 * p)} strokeWidth="1.5" />;
                })}
              </svg>
              <div style={{ position: "absolute", left: cw / 2 - 42, top: (panelH - 38) / 2 - 42, width: 84, height: 84, borderRadius: 42, border: `1.5px solid ${alpha(accent, 0.8)}`, background: `radial-gradient(circle at 36% 30%, ${alpha(accent, 0.34)}, rgba(8,6,14,.96))`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.mono, fontWeight: 900, fontSize: 17, letterSpacing: 1, color: CREAM }}>TRAE</div>
              {d.items.map((it, i) => {
                const ang = -Math.PI / 2 + (i * Math.PI) / 2;
                const x = cw / 2 + Math.cos(ang) * 118;
                const y = (panelH - 38) / 2 + Math.sin(ang) * 96;
                const lit = f >= A(i);
                const col = it.tone === "warn" ? bad : it.tone === "accent" ? accent : t.primary;
                return (
                  <div key={i} style={{ ...rise(A(i), 10, 10), position: "absolute", left: x - 26, top: y - 26, width: 52, height: 52, border: `1.5px solid ${alpha(lit ? col : CREAM, lit ? 0.8 : 0.16)}`, background: lit ? alpha(col, 0.14) : "rgba(0,0,0,.36)", display: "flex", alignItems: "center", justifyContent: "center", color: lit ? col : alpha(CREAM, 0.35) }}>
                    <Icon name={it.icon ?? "tool"} size={24} />
                  </div>
                );
              })}
              <div style={{ position: "absolute", left: 14, bottom: 12, fontFamily: t.font.mono, fontSize: 12, color: alpha(TEAL, 0.85) }}>{d.items.every((_, i) => f >= A(i)) ? "✓ 4 / 4 INSTALLED" : "INSTALLING…"}</div>
            </Panel>
            <Rail count="4" unit="个角色" rows={d.items.map((x) => x.note ?? x.text)} at={(i) => A(i) + 4} sub="找 / 画 / 测 / 做" />
          </>
        );
      }
    }
    return null;
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* 两侧压暗：把口播画面变成一块编辑台，但不碰脸 */}
      <div style={{ position: "absolute", left: 0, top: 0, width: W * 0.315, height: H, background: "linear-gradient(90deg, rgba(5,4,11,.93) 0%, rgba(6,5,13,.82) 58%, rgba(6,5,13,0) 100%)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: W * 0.315, height: H, background: "linear-gradient(270deg, rgba(5,4,11,.93) 0%, rgba(6,5,13,.82) 58%, rgba(6,5,13,0) 100%)" }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: W * 0.315, height: H, background: `radial-gradient(70% 60% at 0% 30%, ${alpha(accent, 0.09)}, rgba(0,0,0,0) 70%)` }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: W * 0.315, height: H, background: `radial-gradient(70% 60% at 100% 70%, ${alpha(t.secondary, 0.08)}, rgba(0,0,0,0) 70%)` }} />
      <div style={{ position: "absolute", inset: 0, ...layerStyle }}>
        <Scene />
        {/* 左下：场次 + 一条细进度；右下留给出处/字幕 */}
        <div style={{ position: "absolute", left: lx, top: H * 0.875, display: "flex", alignItems: "center", gap: 10, opacity: 0.85 }}>
          <span style={{ fontFamily: t.font.mono, fontSize: 12.5, letterSpacing: 2, color: alpha(CREAM, 0.4) }}>TRAE · SIDE</span>
          <span style={{ width: 54, height: 2, background: alpha(CREAM, 0.14) }}>
            <span style={{ display: "block", width: `${clamp(f / Math.max(1, dur)) * 100}%`, height: "100%", background: alpha(accent, 0.8) }} />
          </span>
          <span style={{ fontFamily: t.font.mono, fontSize: 12.5, letterSpacing: 2, color: alpha(CREAM, 0.4) }}>{d.no} / 10</span>
        </div>
        {/* 盖章 */}
        {d.stamp && (
          <div style={{ position: "absolute", right: W * 0.045, top: H * 0.735, opacity: stampK, transform: `rotate(-5deg) scale(${1.22 - 0.22 * Math.min(1, stampK)})`, transformOrigin: "center" }}>
            <div style={{ position: "relative", padding: "11px 22px", border: `2.5px solid ${accent}`, background: "rgba(8,5,14,.86)", color: CREAM, boxShadow: `0 0 26px ${alpha(accent, 0.2)}` }}>
              <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 31, letterSpacing: 2 }}>{d.stamp.text}</div>
              {d.stamp.sub && <div style={{ marginTop: 2, fontFamily: t.font.mono, fontSize: 14, letterSpacing: 1.5, color: alpha(CREAM, 0.62) }}>{d.stamp.sub}</div>}
              {stampK > 0 && stampK < 1 && <div style={{ position: "absolute", inset: -10, border: `2px solid ${alpha(accent, 0.55 * (1 - stampK))}`, transform: `scale(${1 + 0.25 * stampK})` }} />}
            </div>
            <Sfx name="stamp" at={stampAt} volume={0.3} />
          </div>
        )}
      </div>
    </div>
  );
};

export const SideScenes: CompDef<D> = {
  id: "side-scenes",
  name: "真人两侧编辑台",
  layer: "overlay",
  variants: 10,
  minSec: 2,
  maxSec: 10,
  tags: ["真人全屏", "两侧", "编辑台", "语义动画", "终端", "数据轨"],
  motion: { kind: "两侧编辑台：mono 小标打出 → 大标题上擦 → 面板里的行/条/计数分批写出，右栏打勾盖章", energy: 2 },
  desc:
    "真人回到全屏讲话时，左右两侧变成一块深色编辑台：左上 mono 小标与两行大标题，左下扁平工作面板（时间线/终端/模型路由/设计板/浏览器/手机装配），右侧是数据轨——大数字计数、逐条打勾的清单、滑杆与盖章。元素按台词分批出现，中间永远留给人脸，底部留给字幕。",
  use:
    "讲一个具体过程而真人又回到全屏时用：scene 决定画哪套工作台，items 填这一段要点的短标签，stamp 收这句话。分镜要写 presenter:\"full\"（引擎自动走 over 层）。",
  schema,
  example: {
    scene: "skill-loop",
    no: "02",
    kicker: "// 01 · 流程封装",
    title: "把方法\n写成一个 SKILL",
    railKicker: "// 配方",
    items: [{ text: "拍素材", icon: "film", at: 8 }, { text: "粗剪", icon: "film", at: 20 }, { text: "包装", icon: "spark", at: 32 }],
    stamp: { text: "写一次", sub: "下次复用", at: 58 },
  },
  C,
};
