import React from "react";
import { z } from "zod";
import { clamp, E, fitSize, mix, noise, shake, useClock, wrap2 } from "./kit/core";
import { Dust, Flash, LightLeak, Ring, Sparks } from "./kit/fx";
import { rgba } from "./kit/look";
import { Sfx } from "./kit/sfx";
import { Backdrop, common, PersonMedia, PRO_FONT, ProRoot } from "./kit/stage";
import { Big, gradientInk } from "./kit/type";
import type { ProOpening } from "./types";

// ═══ PRO-04 身后巨字 · Depth Title ══════════════════════════════════════
// 第 4 招「身后飞个大标题 + 抠像 + 副标题」：
//   三层景深：背景（真人原画面，压暗 + 虚化）→ 中间巨型标题 → 前景（抠出来的人）
//   0.0s  闪白 + 咚：小字 lead 出现，背景开始压暗虚化
//   fly   巨字从镜头外（Z 轴极远）呼啸飞入，穿过人身后落定 —— 字在人背后，人在字前面
//         落定瞬间：冲击 + 镜头抖 + 背光爆亮，巨字后面一圈光晕把人的轮廓勾出来（rim light）
//   sub   副标题从下方滑入补位；人物持续微推，巨字缓慢视差漂移
// 有抠像（person.matte）效果最强；没有抠像时自动退化成「人前景深 + 巨字压在人下半身」
// 适合：真人口播、观点输出、个人 IP 片头

const schema = z
  .object({
    ...common("blood"),
    lead: z.string().default("我劝你").describe("巨字上方的小字（可留空）"),
    title: z.string().default("别再手写周报").describe("巨型标题（在人身后，建议 ≤ 6 字，可用 \\n 换行）"),
    sub: z.string().default("一个人干完一个团队的活").describe("副标题（最后补位）"),
    flyAt: z.number().default(0.35).describe("巨字飞入时刻（秒）"),
    subAt: z.number().default(1.3).describe("副标题出现时刻（秒）"),
    outline: z.boolean().default(false).describe("巨字用空心描边风格（更潮），默认实心渐变"),
    titleY: z.number().default(0.36).describe("巨字中心的高度（0~1，人头顶上方最好）"),
    fgScale: z.number().default(0.82).describe("前景人缩放（<1 = 缩小，让巨字露出来；人脸占满画面时用 0.7~0.85）"),
    fgDrop: z.number().default(0.14).describe("前景人往下沉多少（0~0.3 × 画面高）"),
  })
  .prefault({});
type D = z.infer<typeof schema>;

const C: React.FC<{ data: D; duration?: number }> = ({ data: d, duration }) => {
  const { t, dur, W, H, u, p } = useClock(duration);
  const F = d.flyAt;
  return (
    <ProRoot d={d}>
      {(L) => {
        const exit = E.in(p(dur - 0.4, 0.4));
        const land = F + 0.42; // 落定时刻
        // flyAt:0 = 巨字首帧就位（不飞入）：抖音首帧不能是空画面，观众刷到第一眼就得看见钩子
        const fly = F <= 0 ? 1 : clamp((t - F) / (land - F));
        const zf = E.expoIn(fly); // 越来越快地扑过来
        const sh = shake(t, [{ at: 0, amp: 10 * u, len: 0.3 }, { at: land, amp: 30 * u, len: 0.55 }], 9);
        // 竖屏：超过 3 个字就拆两行（字要大，宁可两行）
        const lines = wrap2(d.title, W < H ? 3 : 7);
        const titleSize = Math.min(...lines.map((l) => fitSize(l, W * 0.92, (lines.length > 1 ? 300 : 380) * u)));
        // 巨字：从 scale 0.15 + 远处模糊 → 1.0；落定后轻微回弹 + 缓慢漂移
        const sc = t < land ? mix(0.12, 1.06, zf) : 1 + 0.06 * Math.exp(-(t - land) * 6) * Math.cos((t - land) * 22) + 0.03 * E.out((t - land) / Math.max(0.2, dur - land));
        const blur = t < land ? (1 - zf) * 24 : 0;
        const titleOp = t < F ? 0 : clamp(fly * 3);
        const drift = { x: noise(t * 0.5, 4) * 14 * u, y: noise(t * 0.45, 5) * 8 * u };
        // 背景：有抠像时第 0 帧是原画面，0.35 秒内溶解成「重度虚化 + 压暗」的氛围底（不再看得出第二个人）；
        // 没抠像时只是压暗虚化
        const bgK = E.out(p(0.05, 0.45));
        const hasMatte0 = !!d.person?.matte;
        const bgFilter = hasMatte0 ? `blur(${bgK * 60 * u}px) brightness(${1 - bgK * 0.75}) saturate(${1 - bgK * 0.5})` : `blur(${bgK * 7 * u}px) brightness(${1 - bgK * 0.55}) saturate(${1 - bgK * 0.4})`;
        // 前景人：缩小并下沉（露出头顶上方给巨字），之后微推
        // 0~0.45s 从「原画面同位置」平滑过渡到缩小下沉的前景位，像人从背景里被拎出来
        const sep = E.inOut(p(0.05, 0.45));
        const pz = mix(1.0, d.fgScale, sep) * (1 + 0.04 * E.out(p(0, dur)));
        const fgY = H * d.fgDrop * sep;
        const hasMatte = !!d.person?.matte;
        const rim = E.out(p(land, 0.15)) * (0.6 + 0.4 * Math.exp(-(t - land) * 3));
        const leadK = F <= 0 ? 1 : E.out5(p(0.04, 0.3));
        const subK = E.out5(p(d.subAt, 0.45));
        const titleY = H * d.titleY;
        const fill = d.outline ? { color: "transparent", WebkitTextStroke: `${5 * u}px ${L.accent}` } : { ...gradientInk("#ffffff", L.accent, 180) };
        const titleBlock = (
          <div style={{ position: "absolute", left: 0, right: 0, top: titleY, transform: `translate(${drift.x}px, calc(-50% + ${drift.y}px)) scale(${sc})`, opacity: titleOp * (1 - exit), filter: blur > 0.3 ? `blur(${blur}px)` : undefined, display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 0.95 }}>
            {lines.map((l, i) => (
              <Big key={i} text={l} size={titleSize} tracking={-0.02} style={{ ...fill, lineHeight: 0.98, filter: `drop-shadow(0 ${10 * u}px ${30 * u}px ${rgba("#000", 0.7)})` }} />
            ))}
          </div>
        );
        return (
          <>
            {/* 层 1：背景（真人原画面压暗虚化 / 纯图形） */}
            <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x * 0.5}px, ${sh.y * 0.5}px)` }}>
              {d.person ? <PersonMedia person={d.person} cam={{ zoom: 1.08 + (hasMatte0 ? 0.5 * bgK : 0.03 * E.out(p(0, dur))), filter: bgFilter }} /> : <Backdrop look={L} t={t} />}
            </div>
            {/* 有抠像：前景人从原画面「分离」出来——第 0 帧原画面 = 前景位置，随后前景缩小下沉 */}
            {hasMatte0 && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${L.bg2}, ${L.bg} 75%)`, opacity: 0.55 * bgK }} />}
            {/* 背景氛围色 + 巨字后的背光 */}
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% ${titleY / H * 100}%, ${rgba(L.accent, 0.42 * rim + 0.1)}, ${rgba(L.bg, 0.55)} 62%)`, mixBlendMode: "screen" }} />
            <div style={{ position: "absolute", inset: 0, background: rgba(L.bg, 0.35 * bgK) }} />
            <Dust t={t} W={W} H={H} color={L.key} n={44} opacity={0.4} />

            {/* 层 2：巨型标题（人身后） */}
            <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>{titleBlock}</div>
            <Ring t={t} at={land} x={W / 2} y={titleY} color={L.accent} r={W * 0.6} w={14 * u} len={0.7} />
            <Sparks t={t} at={land} x={W / 2} y={titleY + titleSize * 0.3} color={L.gold} n={50} speed={1400 * u} len={1} gravity={1200 * u} size={u} />

            {/* 层 3：前景人物 */}
            {d.person && (
              <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x * 1.3}px, ${sh.y * 1.3 + (hasMatte ? fgY : 0)}px)` }}>
                {hasMatte ? (
                  <>
                    {/* 轮廓光：抠像层放大一点 + 发光色，垫在人后面 */}
                    <PersonMedia person={d.person} matte cam={{ zoom: pz * 1.012, filter: `brightness(0) invert(1) drop-shadow(0 0 ${18 * u}px ${L.accent}) drop-shadow(0 0 ${40 * u}px ${L.accent})` }} style={{ opacity: rim * 0.85, mixBlendMode: "screen", transformOrigin: "50% 100%" }} />
                    <PersonMedia person={d.person} matte cam={{ zoom: pz, filter: `contrast(1.06) saturate(1.05) drop-shadow(0 ${20 * u}px ${40 * u}px rgba(0,0,0,.6))` }} style={{ transformOrigin: "50% 100%" }} />
                  </>
                ) : (
                  // 没抠像：人像放在中间一个柔边窗口里，巨字压在窗口下沿
                  <div style={{ position: "absolute", inset: 0, maskImage: "radial-gradient(ellipse 34% 52% at 50% 40%, #000 60%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 34% 52% at 50% 40%, #000 60%, transparent 100%)" }}>
                    <PersonMedia person={d.person} cam={{ zoom: pz }} />
                  </div>
                )}
              </div>
            )}
            {/* 没抠像时，巨字在人下半身前面再压一次（只露下半部分），保持“人和字交叠”的层次 */}
            {d.person && !hasMatte && <div style={{ position: "absolute", inset: 0, clipPath: `inset(${(titleY / H) * 100 + 4}% 0 0 0)`, transform: `translate(${sh.x}px, ${sh.y}px)` }}>{titleBlock}</div>}

            {/* lead 小字：在人前面、巨字上方 */}
            {d.lead && (
              <div style={{ position: "absolute", left: 0, right: 0, top: Math.max(40 * u, titleY - titleSize * (lines.length > 1 ? 1.25 : 0.85)), display: "flex", justifyContent: "center", opacity: leadK * (1 - exit), transform: `translateY(${(1 - leadK) * -30 * u}px)` }}>
                <div style={{ fontFamily: PRO_FONT, fontWeight: 900, fontSize: 64 * u, color: L.ink, letterSpacing: "0.3em", padding: `${6 * u}px ${30 * u}px`, background: rgba("#000", 0.55), borderLeft: `${8 * u}px solid ${L.accent}` }}>{d.lead}</div>
              </div>
            )}
            {/* 副标题 */}
            {d.sub && t >= d.subAt && (
              <div style={{ position: "absolute", left: 0, right: 0, bottom: H * 0.1, display: "flex", justifyContent: "center", opacity: subK * (1 - exit), transform: `translateY(${(1 - subK) * 50 * u}px)` }}>
                <div style={{ position: "relative", padding: `${14 * u}px ${44 * u}px`, fontFamily: PRO_FONT, fontWeight: 800, fontSize: fitSize(d.sub, W * 0.8, 58 * u), color: "#fff", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                  <div style={{ position: "absolute", inset: 0, background: L.accent, transform: `scaleX(${subK}) skewX(-10deg)`, transformOrigin: "left", boxShadow: `0 0 ${40 * u}px ${rgba(L.accent, 0.6)}` }} />
                  <span style={{ position: "relative", textShadow: "0 2px 0 rgba(0,0,0,.35)" }}>{d.sub}</span>
                </div>
              </div>
            )}

            {/* 首帧红线：闪白从 0.7 压到 0.3 —— 第 0 帧必须看得清画面，不能是一片白 */}
            <Flash t={t} at={0} len={0.18} peak={0.3} />
            <Flash t={t} at={land} len={0.22} peak={0.5} color={L.accent} />
            <LightLeak t={t} at={land - 0.05} len={1.1} color={L.accent} color2={L.gold} W={W} H={H} strength={0.45} from="right" />

            <Sfx name="boom" at={0} vol={0.5} />
            <Sfx name="swell" at={Math.max(0, land - 1.2)} vol={0.4} />
            <Sfx name="whip" at={F + 0.05} vol={0.65} />
            <Sfx name="boom" at={land} vol={0.9} />
            <Sfx name="slam" at={land} vol={0.5} />
            <Sfx name="sub" at={land + 0.05} vol={0.5} />
            <Sfx name="whip" at={d.subAt} vol={0.35} />
            <Sfx name="ding" at={d.subAt + 0.08} vol={0.4} />
          </>
        );
      }}
    </ProRoot>
  );
};

export const P04DepthTitle: ProOpening<D> = {
  id: "pro-04-depth-title",
  name: "PRO 04 · 身后巨字",
  trick: "第4招 身后飞个大标题 + 抠像 + 副标题",
  hook: "观点输出 / 个人 IP",
  desc: "三层景深：背景真人压暗虚化 → 巨型标题从极远处呼啸飞入、穿到人身后落定 → 前景是抠出来的人（轮廓被背光勾亮）。落定瞬间冲击环 + 火花 + 镜头抖；lead 小字在上、副标题色条从下方补位。没有抠像素材时自动退化为柔边人像窗 + 巨字压下半身",
  use: "观点型 / 口号型开场：“我劝你别再手写周报”“普通人翻身就靠这一招”——一句话能压住整个画面",
  defaultSec: 3.2,
  schema,
  example: {},
  C,
};
