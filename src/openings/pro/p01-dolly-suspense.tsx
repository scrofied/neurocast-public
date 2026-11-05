import React from "react";
import { z } from "zod";
import { clamp, E, fitSize, h1, mix, noise, pulses, shake, useClock } from "./kit/core";
import { Dust, Flash, LightLeak, Ring, Scrim, Sparks, SpeedLines } from "./kit/fx";
import { rgba } from "./kit/look";
import { Sfx } from "./kit/sfx";
import { Backdrop, common, PersonMedia, personSchema, PRO_FONT, ProRoot } from "./kit/stage";
import { Big, Chars, gradientInk } from "./kit/type";
import type { ProOpening } from "./types";

// ═══ PRO-01 慢推悬疑 · Dolly Suspense ═══════════════════════════════════
// 第 1 招「慢慢放大 + 做悬疑」的电影版：
//   0.0s  闪白 + 咚，画面从黑里推出，宽银幕光圈慢慢关小（压迫）
//   0.2s  悬疑句逐字浮现，关键答案用 ▇▇ 遮住（不给答案）
//   …     镜头持续加速推近人脸，心跳越来越快，画面越来越暗、越来越冷
//   reveal 上扬音效戛然而止 → 闪白 + 咚 + 冲击环 + 火花，答案巨字砸出发光
//   end   巨字慢慢放大并淡出，留给正片
// 适合：悬念型 / 揭露型 / “我赌你不知道…” “真正的原因是…”

const schema = z
  .object({
    ...common("noir"),
    kicker: z.string().default("99% 的人都不知道").describe("顶部小字（可留空）"),
    line: z.string().default("让你一直穷的，不是能力，是▇▇").describe("悬疑句。用 ▇▇（或 __）标出被遮住的答案位置"),
    reveal: z.string().default("认知").describe("最后揭晓的答案（砸出来的巨字）"),
    sub: z.string().default("").describe("答案下方的小字（可留空）"),
    revealAt: z.number().default(2.4).describe("揭晓时刻（秒）—— 卡在口播说出答案的那个字上"),
    zoomTo: z.number().default(1.32).describe("推镜终点倍数（1.2~1.45）"),
    personAt: z.number().default(0).describe("真人第几秒才出场（默认 0 = 第 0 帧就在）。出场前那几秒铺 pre 的图，守「开场前 2 秒不露主播脸」"),
    pre: personSchema.describe("personAt 之前铺的背景素材（kind:image = 一张生图/真图，跟着同一套推镜与压暗）；不给就用模板自己的图形底"),
    center: z.boolean().default(false).describe("悬疑句垂直居中（默认在画面下方）。和 personAt 一起给时，真人出场那一下它会滑回下方让出人脸"),
  })
  .prefault({});
type D = z.infer<typeof schema>;

const C: React.FC<{ data: D; duration?: number }> = ({ data: d, duration }) => {
  const { t, dur, W, H, u, p } = useClock(duration);
  const R = d.revealAt;
  // 真人第几秒才出场：0 = 第 0 帧就在（老片行为一字不变）。>0 时那几秒铺 pre 的图，
  // 到点在 pre 与真人之间硬切一下，用一道闪白 + 咚盖住切口（和模板自己的揭晓语法同一套）。
  const P = Math.max(0, d.personAt ?? 0);
  const look0 = d.look;
  return (
    <ProRoot d={d}>
      {(L) => {
        // ── 推镜：从 1.0 加速推到 zoomTo（不是匀速，越来越快 = 压迫感）──
        const pre = clamp(t / R);
        const z0 = mix(1.0, d.zoomTo, E.in2(pre));
        // 揭晓时猛冲一下再回弹
        const kick = t >= R ? 0.07 * Math.exp(-(t - R) * 7) : 0;
        // 揭晓后缓慢继续推进
        const post = t >= R ? 0.04 * E.out((t - R) / Math.max(0.1, dur - R)) : 0;
        // 手持呼吸 + 揭晓的冲击抖动
        const sh = shake(t, [{ at: 0, amp: 10 * u, len: 0.35 }, { at: R, amp: 26 * u, len: 0.55 }], 4);
        const breathe = { x: noise(t * 0.7, 1) * 5 * u, y: noise(t * 0.6, 2) * 4 * u };
        // 心跳：间隔从 0.85s 收紧到 0.38s
        const beats: number[] = [];
        for (let b = 0.35, gap = 0.85; b < R - 0.15; b += gap, gap = Math.max(0.38, gap * 0.8)) beats.push(b);
        const thump = pulses(t, beats, 9);
        // 画面越来越暗、越来越冷，揭晓时一下回暖
        const dark = clamp(pre * 0.55 + thump * 0.08) * (t < R ? 1 : Math.exp(-(t - R) * 4));
        const gradeF = `brightness(${1 - dark * 0.5}) contrast(${1 + dark * 0.25}) saturate(${1 - dark * 0.6})`;
        // 光圈（暗角）收紧
        const iris = mix(0.62, 0.3, E.in2(pre)) + (t >= R ? 0.3 * E.out((t - R) / 0.25) : 0);
        const exit = E.in(p(dur - 0.45, 0.45));
        // 悬疑句：拆出被遮住的位置
        const mask = d.line.includes("▇") ? /▇+/ : /_{2,}/;
        const m = d.line.match(mask);
        const before = m ? d.line.slice(0, m.index) : d.line;
        const after = m ? d.line.slice((m.index ?? 0) + m[0].length) : "";
        // 遮块按答案字数占位，一起算进宽度；放不下就缩字号（竖屏也不会溢出）
        const lineEms = Array.from(before).length + Array.from(after).length + (m ? Array.from(d.reveal).length + 0.3 : 0);
        const lineSize = Math.min(84 * u, (W * 0.88) / Math.max(1, lineEms));
        const per = Math.min(0.075, Math.max(0.03, (R - 0.6) / Math.max(1, Array.from(before).length + 2)));
        // 首帧红线：整句（含遮块）第 0 帧就在位可读，逐字只是「点亮」，不是从无到有
        const lineAt = 0;
        const maskAt = lineAt + per * Array.from(before).length;
        // 大字位置：center = 前几秒居中（第 0 屏不能沉底），真人一出场就滑回下方让出脸。
        // 滑的这 0.28 秒正好压在 personAt 那道闪白 + whip 音上，看不出是「挪位置」。
        const lineY = d.center ? mix(H * 0.44, H * 0.66, d.person && P > 0 ? E.inOut(p(P - 0.02, 0.28)) : 0) : H * 0.66;
        const revSize = fitSize(d.reveal, W * 0.78, 300 * u);
        const k = clamp((t - R) / 0.22);
        return (
          <>
            {/* 画面：真人出场前铺 pre（生图/真图），出场后换真人；两者都没有就是模板图形底 */}
            <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x + breathe.x}px, ${sh.y + breathe.y}px) rotate(${sh.r}deg)` }}>
              {d.person && t >= P ? <PersonMedia person={d.person} cam={{ zoom: z0 + kick + post + thump * 0.006, filter: gradeF }} /> : d.pre ? <PersonMedia person={d.pre} cam={{ zoom: z0 + thump * 0.006, filter: gradeF }} /> : <Backdrop look={L} t={t} />}
            </div>
            {/* 冷色压暗 */}
            <div style={{ position: "absolute", inset: 0, background: rgba(L.bg, 0.25 + dark * 0.4), mixBlendMode: "multiply" }} />
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at ${(d.person?.focusX ?? 0.5) * 100}% ${(d.person?.focusY ?? 0.4) * 100}%, transparent ${iris * 70}%, ${rgba("#000", 0.92)} ${iris * 70 + 38}%)` }} />
            {/* 心跳时边缘泛红光 */}
            <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${220 * u}px ${rgba(L.danger, clamp(thump * 0.35))}` }} />
            <Dust t={t} W={W} H={H} color={L.key} n={34} opacity={0.35} />
            <Scrim side="bottom" size={0.55} strength={0.82} />
            {/* 首帧红线：开场闪白压在文字层「下面」，只冲一下背景，不能把大字糊成一片白 */}
            <Flash t={t} at={0} len={0.18} peak={0.3} />
            {/* 真人出场那一下：一道闪白盖住 pre→真人 的硬切（白色、peak/len 与首帧那道一致，
                整屏染成 key 色的话抽帧看就是一张错帧的绿纸，撞「首帧必须是完整画面」红线） */}
            {d.person && P > 0 && <Flash t={t} at={P} len={0.18} peak={0.32} />}

            {/* 顶部小字 */}
            {d.kicker && (
              <div style={{ position: "absolute", top: lineY + lineSize * 1.25, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: E.out(p(0, 0.2)) * (1 - E.out(p(R, 0.2))) }}>
                <div style={{ fontFamily: PRO_FONT, fontWeight: 700, fontSize: 34 * u, letterSpacing: "0.32em", color: L.key, padding: `${10 * u}px ${28 * u}px`, border: `1.5px solid ${rgba(L.key, 0.6)}`, borderRadius: 999, background: rgba("#000", 0.35), textShadow: `0 0 20px ${rgba(L.key, 0.8)}` }}>{d.kicker}</div>
              </div>
            )}

            {/* 悬疑句：逐字点亮，答案被遮住 */}
            <div style={{ position: "absolute", left: 0, right: 0, top: lineY, display: "flex", justifyContent: "center", alignItems: "center", opacity: 1 - E.out(p(R, 0.18)), transform: `translateY(${-E.out(p(R, 0.3)) * 30 * u}px)`, filter: t > R ? `blur(${E.out(p(R, 0.2)) * 10}px)` : undefined }}>
              <Chars text={before} t={t} at={lineAt} per={per} len={0.35} anim="rise" floor={0.55} size={lineSize} color={L.ink} outline={0} glow={rgba("#000", 0.9)} glowR={24} />
              {m && (
                <span
                  style={{
                    display: "inline-block",
                    width: Array.from(d.reveal).length * lineSize * 1.0,
                    height: lineSize * 0.92,
                    margin: `0 ${lineSize * 0.08}px`,
                    borderRadius: 6 * u,
                    background: `repeating-linear-gradient(90deg, ${rgba(L.accent, 0.95)} 0 ${lineSize * 0.12}px, ${rgba(L.accent, 0.7)} ${lineSize * 0.12}px ${lineSize * 0.16}px)`,
                    boxShadow: `0 0 ${30 * u}px ${rgba(L.accent, 0.5 + thump * 0.5)}`,
                    opacity: clamp(0.5 + 0.5 * E.out((t - maskAt) / 0.25)),
                    transform: `scaleX(${0.9 + 0.1 * E.back(clamp((t - maskAt) / 0.3))}) translateX(${noise(t * 30, 9) * thump * 6}px)`,
                  }}
                />
              )}
              {after && <Chars text={after} t={t} at={maskAt + per * 2} per={per} len={0.35} anim="rise" floor={0.55} size={lineSize} color={L.ink} glow={rgba("#000", 0.9)} glowR={24} />}
            </div>

            {/* ── 揭晓 ── */}
            {/* 揭晓瞬间：画面整体压暗衬巨字（放在光效下面） */}
            {t >= R && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 50%, ${rgba("#000", 0.35)}, ${rgba("#000", 0.8)})`, opacity: E.out(p(R, 0.15)) * (1 - exit) }} />}
            <Flash t={t} at={R} len={0.3} peak={0.75} color={L.key} />
            <Flash t={t} at={R} len={0.1} peak={0.9} />
            <LightLeak t={t} at={R - 0.05} len={1.3} color={L.accent} color2={L.key} W={W} H={H} strength={0.42} />
            <SpeedLines t={t} at={R} x={W / 2} y={H * 0.5} color={rgba(L.ink, 0.9)} W={W} len={0.5} inner={revSize * 1.1} />
            <Ring t={t} at={R} x={W / 2} y={H * 0.5} color={L.accent} r={W * 0.55} w={12 * u} len={0.7} />
            <Ring t={t} at={R + 0.08} x={W / 2} y={H * 0.5} color={L.key} r={W * 0.4} w={5 * u} len={0.6} />
            <Sparks t={t} at={R} x={W / 2} y={H * 0.5} color={L.gold} n={60} speed={1500 * u} len={1.1} gravity={1100 * u} />
            {t >= R && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", opacity: 1 - exit, transform: `scale(${1 + exit * 0.15})` }}>
                <div style={{ position: "relative", transform: `scale(${mix(2.6, 1, E.out5(k)) + 0.05 * E.out((t - R - 0.2) / Math.max(0.2, dur - R))})`, filter: k < 1 ? `blur(${(1 - k) * 18}px)` : undefined, opacity: clamp(k * 2) }}>
                  {/* 背光：字后面一团强光 */}
                  <div style={{ position: "absolute", left: "50%", top: "50%", width: revSize * Array.from(d.reveal).length * 1.1, height: revSize * 1.4, transform: "translate(-50%,-50%)", background: `radial-gradient(ellipse, ${rgba(L.accent, 0.55)}, transparent 68%)`, filter: `blur(${30 * u}px)` }} />
                  {/* 金属渐变字 + 黑描边 + 立体阴影 */}
                  <Big
                    text={d.reveal}
                    size={revSize}
                    tracking={0.04}
                    style={{ position: "relative", ...gradientInk("#ffffff", L.accent, 180), WebkitTextStroke: `${3 * u}px ${rgba("#000", 0.6)}`, filter: `drop-shadow(0 ${8 * u}px 0 ${rgba("#000", 0.85)}) drop-shadow(0 0 ${26 * u}px ${rgba(L.accent, 0.75)})` }}
                  />
                  {/* 扫光：一道亮带从字上划过 */}
                  <Big text={d.reveal} size={revSize} tracking={0.04} style={{ position: "absolute", inset: 0, ...gradientInk("transparent", "transparent"), backgroundImage: `linear-gradient(105deg, transparent ${E.inOut(p(R + 0.15, 0.7)) * 160 - 40}%, rgba(255,255,255,.95) ${E.inOut(p(R + 0.15, 0.7)) * 160 - 25}%, transparent ${E.inOut(p(R + 0.15, 0.7)) * 160 - 10}%)` }} />
                </div>
                {d.sub && <div style={{ marginTop: 24 * u, fontFamily: PRO_FONT, fontWeight: 700, fontSize: 44 * u, color: L.ink, letterSpacing: "0.12em", opacity: E.out(p(R + 0.25, 0.4)), transform: `translateY(${(1 - E.out(p(R + 0.25, 0.4))) * 20 * u}px)`, textShadow: "0 4px 18px rgba(0,0,0,.9)" }}>{d.sub}</div>}
              </div>
            )}

            {/* 音效 */}
            <Sfx name="boom" at={0} vol={0.55} />
            <Sfx name="drone" at={0} vol={0.45} />
            {d.person && P > 0.3 && (
              <>
                <Sfx name="whip" at={P - 0.28} vol={0.4} />
                <Sfx name="boom" at={P} vol={0.5} />
              </>
            )}
            {beats.map((b, i) => (
              <Sfx key={i} name="heart" at={b} vol={0.35 + (i / Math.max(1, beats.length)) * 0.35} />
            ))}
            <Sfx name="swell" at={Math.max(0, R - 1.8)} vol={0.5} />
            <Sfx name="boom" at={R} vol={0.85} />
            <Sfx name="slam" at={R} vol={0.6} />
            <Sfx name="ding" at={R + 0.05} vol={0.45} />
            <Sfx name="shimmer" at={R + 0.1} vol={0.4} />
            {void look0}
            {void h1}
          </>
        );
      }}
    </ProRoot>
  );
};

export const P01DollySuspense: ProOpening<D> = {
  id: "pro-01-dolly-suspense",
  name: "PRO 01 · 慢推悬疑",
  trick: "第1招 慢慢放大 + 做悬疑",
  hook: "悬念 / 揭露",
  desc: "镜头从黑里推出、加速推近人脸，心跳越来越快、画面越来越暗越冷；悬疑句逐字浮现、答案用发光色块遮住；揭晓时上扬音戛然而止 → 闪白 + 咚 + 冲击环 + 火花，答案巨字砸出发光",
  use: "“让你一直穷的不是能力，是…”“90% 的人都不知道…”“真正的原因是…”——有一个可以藏到最后再说的答案",
  defaultSec: 3.6,
  schema,
  example: {},
  C,
};
