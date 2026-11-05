import React from "react";
import { z } from "zod";
import { clamp, E, fitSize, mix, shake, useClock } from "./kit/core";
import { Flash, Ring, Sweep } from "./kit/fx";
import { rgba } from "./kit/look";
import { Sfx } from "./kit/sfx";
import { common, PersonMedia, PRO_FONT, ProRoot } from "./kit/stage";
import { Big } from "./kit/type";
import type { ProOpening } from "./types";

// ═══ PRO-05 干货先行 · Info First ═══════════════════════════════════════
// 第 5 招「文字干货先出现，找好节奏再露脸」+ 附加绝招「闪白 + 叮」：
//   0.0s  纯黑 + 透视网格：第 1 条干货在画面中间全屏砸出（巨型序号 01 在背后）
//   gap   第 2 条砸出时，第 1 条缩小飞到左侧清单里落位；依次类推（每条一下重击）
//   person 最后一条落位后：闪白 + 叮，画面被一道斜切光刃劈开，真人从右侧入画（延后 0.2~1 秒）
//   …     左侧清单保留当“本期目录”，当前条目高亮扫光
// 适合：干货型 / 知识型 / 清单型：“3 个方法”“记住这几点”“不写代码也能做”

const schema = z
  .object({
    ...common("paper"),
    title: z.string().default("今天讲 3 件事").describe("清单标题（落位后显示在清单上方，可留空）"),
    points: z.array(z.string()).min(2).max(5).default(["不写代码", "不装环境", "双击就能跑"]).describe("干货要点（2~5 条，每条建议 ≤ 8 字）"),
    at: z.number().default(0).describe("第 1 条出现的秒"),
    gap: z.number().default(0.42).describe("每条之间的间隔（秒）—— 卡在口播每说完一条的节奏上"),
    ats: z.array(z.number()).optional().describe("逐条出现秒数（给了就覆盖 at+gap，卡不齐距的口播节奏用）"),
    personAt: z.number().optional().describe("真人入画时刻（秒，缺省 = 最后一条之后 0.35s）"),
    side: z.enum(["left", "right"]).default("left").describe("清单放在哪一侧（真人在另一侧）"),
  })
  .prefault({});
type D = z.infer<typeof schema>;

const C: React.FC<{ data: D; duration?: number }> = ({ data: d, duration }) => {
  const { t, dur, W, H, u, p, portrait } = useClock(duration);
  const n = d.points.length;
  const ats = d.points.map((_, i) => (d.ats && d.ats.length ? (d.ats[i] ?? d.at + i * d.gap) : d.at + i * d.gap));
  const P = d.personAt ?? ats[n - 1] + d.gap * 0.85;
  return (
    <ProRoot d={d}>
      {(L) => {
        const exit = E.in(p(dur - 0.35, 0.35));
        const left = d.side === "left";
        // 清单落位区域
        const listW = portrait ? W * 0.86 : W * 0.4;
        const listX = portrait ? W * 0.07 : left ? 130 * u : W - listW - 130 * u;
        const listTop = portrait ? H * 0.1 : H * 0.24;
        const rowH = portrait ? 120 * u : Math.min(150 * u, (H * 0.62) / n);
        const listSize = Math.min(...d.points.map((s) => fitSize(s, listW - 140 * u, portrait ? 76 * u : 78 * u)));
        const bigSize = Math.min(...d.points.map((s) => fitSize(s, W * 0.82, 200 * u)));
        const hits = ats.map((a) => ({ at: a, amp: 16 * u, len: 0.3 }));
        const sh = shake(t, [...hits, { at: P, amp: 20 * u, len: 0.4 }], 12);
        // 真人入画：斜切光刃从屏幕外扫进来
        const pin = E.out5(p(P, 0.5));
        const edge = portrait ? H * mix(1.05, 0.48, pin) : left ? mix(W * 1.05, W * 0.44, pin) : mix(-W * 0.05, W * 0.56, pin);
        const slant = portrait ? 90 * u : 160 * u;
        const clip = portrait
          ? `polygon(0px ${edge + slant}px, ${W}px ${edge - slant}px, ${W}px ${H}px, 0px ${H}px)`
          : left
          ? `polygon(${edge + slant}px 0px, ${W}px 0px, ${W}px ${H}px, ${edge - slant}px ${H}px)`
          : `polygon(0px 0px, ${edge + slant}px 0px, ${edge - slant}px ${H}px, 0px ${H}px)`;
        const cur = Math.min(n - 1, Math.max(0, Math.floor((t - P - 0.25) / 0.5)));
        const dark = L.bg;
        // 透视网格（地面）
        const grid = (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
            {Array.from({ length: 22 }, (_, i) => {
              const x = (i / 21) * W * 2 - W * 0.5;
              return <line key={`v${i}`} x1={W / 2} y1={H * 0.42} x2={x} y2={H} stroke={rgba(L.dim, 0.35)} strokeWidth={1.2 * u} />;
            })}
            {Array.from({ length: 12 }, (_, i) => {
              const k = ((i + ((t * 1.6) % 1)) / 12) ** 2.2;
              const y = H * 0.42 + (H * 0.58) * k;
              return <line key={`h${i}`} x1={0} y1={y} x2={W} y2={y} stroke={rgba(L.dim, 0.18 + 0.4 * k)} strokeWidth={1.2 * u} />;
            })}
          </svg>
        );
        return (
          <>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 40%, ${L.bg2}, ${dark} 70%)` }} />
            {grid}

            {/* 真人：斜切入画 */}
            {d.person && t >= P && (
              <div style={{ position: "absolute", inset: 0, clipPath: clip, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
                {/* 人脸移到露出区域的中心：露出区域是 [edge, W]（或 [0, edge]） */}
                <PersonMedia
                  person={d.person}
                  cam={{
                    zoom: mix(1.5, 1.42, pin) + 0.04 * E.out(p(P, dur - P)),
                    // 平移后画面边缘不能露出来：x 限制在 ±(zoom-1)·W/2 以内（PersonMedia 以人脸为缩放中心）
                    x: portrait
                      ? 0
                      : Math.max(-W * 0.2, Math.min(W * 0.2, (left ? (W * 0.44 + W) / 2 : (W * 0.56) / 2) - (d.person.focusX ?? 0.5) * W)),
                    y: portrait ? H * 0.74 - (d.person.focusY ?? 0.36) * H : 0,
                  }}
                />
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${portrait ? "180deg" : left ? "90deg" : "270deg"}, ${rgba(dark, 0.55)}, transparent 40%)` }} />
              </div>
            )}
            {/* 光刃 */}
            {t >= P && pin < 1 && (
              <svg width={W} height={H} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
                {portrait ? (
                  <line x1={0} y1={edge + slant} x2={W} y2={edge - slant} stroke="#fff" strokeWidth={10 * u * (1 - pin) + 3 * u} style={{ filter: `drop-shadow(0 0 ${30 * u}px ${L.accent})` }} />
                ) : (
                  <line x1={edge + slant} y1={0} x2={edge - slant} y2={H} stroke="#fff" strokeWidth={10 * u * (1 - pin) + 3 * u} style={{ filter: `drop-shadow(0 0 ${30 * u}px ${L.accent})` }} />
                )}
              </svg>
            )}
            {t >= P + 0.5 && (
              <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
                {portrait ? <line x1={0} y1={edge + slant} x2={W} y2={edge - slant} stroke={L.accent} strokeWidth={4 * u} /> : <line x1={edge + slant} y1={0} x2={edge - slant} y2={H} stroke={L.accent} strokeWidth={4 * u} />}
              </svg>
            )}

            {/* 清单标题 */}
            {d.title && (
              <div style={{ position: "absolute", left: listX, top: listTop - 92 * u, opacity: E.out(p(ats[n - 1] + 0.2, 0.3)) * (1 - exit), transform: `translateX(${(1 - E.out(p(ats[n - 1] + 0.2, 0.3))) * -30 * u}px)`, fontFamily: PRO_FONT, fontWeight: 900, fontSize: 46 * u, color: L.accent, letterSpacing: "0.12em" }}>{d.title}</div>
            )}

            {/* 每条干货：先在中间全屏砸出 → 下一条来时飞进清单 */}
            {d.points.map((s, i) => {
              const a = ats[i];
              if (t < a) return null;
              // 下一条砸下前 0.14s 就开始飞走 → 中间永远只有一条大字
              const hand = i < n - 1 ? ats[i + 1] - 0.14 : P - 0.2;
              const k = E.inOut(clamp((t - hand) / 0.2));
              const slam = i === 0 ? 1 : E.out5(clamp((t - a) / 0.16)); // 首条第 0 帧就是满大字（红线：不从透明淡入）
              const bx = W / 2;
              const by = portrait ? H * 0.42 : H * 0.48;
              const sx = listX + 120 * u;
              const sy = listTop + i * rowH + rowH / 2;
              const x = mix(bx, sx, k);
              const y = mix(by, sy, k);
              const sz = mix(bigSize, listSize, k);
              const centerAlign = 1 - k;
              const active = t >= P && i === cur;
              // 已落位但真人还没入画：这一条只是「背景堆叠」，压暗让画面中间正在砸的大字读得清。
              // 否则要点里带英文品牌名（Claude Code / WorkBuddy 这种宽词）时，巨型字会横穿左侧清单，
              // 和已落位的小字叠成一团（ats 卡口播时每条间隔可达 2 秒，重叠窗口很长）。
              const dim = k >= 1 && t < P ? 0.26 : t >= P + 0.4 && !active ? 0.55 : 1;
              return (
                <React.Fragment key={i}>
                  {/* 背后的巨型序号（只在中间阶段） */}
                  {k < 1 && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: by - bigSize * 1.25, textAlign: "center", opacity: (1 - k) * 0.9 * slam, transform: `scale(${mix(1.6, 1, slam)})`, fontFamily: '"Bahnschrift","Segoe UI",sans-serif', fontWeight: 900, fontSize: bigSize * 2.4, lineHeight: 1, color: "transparent", WebkitTextStroke: `${3 * u}px ${rgba(L.accent, 0.55)}` }}>{String(i + 1).padStart(2, "0")}</div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      left: x,
                      top: y,
                      transform: `translate(${-50 * centerAlign}%, -50%) scale(${k > 0 ? 1 : mix(1.9, 1, slam)})`,
                      transformOrigin: k > 0 ? "left center" : "center",
                      filter: slam < 1 ? `blur(${(1 - slam) * 12}px)` : undefined,
                      opacity: clamp(slam * 2) * dim * (1 - exit),
                      display: "flex",
                      alignItems: "center",
                      gap: 22 * u * k,
                    }}
                  >
                    {/* 序号徽章（落位后出现） */}
                    <div style={{ width: sz * 1.2 * k, height: sz * 1.2, flex: "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14 * u, background: active ? L.accent : L.ink, color: active ? "#fff" : L.bg, fontFamily: '"Bahnschrift","Segoe UI",sans-serif', fontWeight: 900, fontSize: sz * 0.62, opacity: k }}>{String(i + 1).padStart(2, "0")}</div>
                    <div style={{ position: "relative" }}>
                      <Big text={s} size={sz} color={L.ink} style={{ position: "relative", zIndex: 1 }} />
                      {/* 中间阶段：字下面的荧光马克笔底 */}
                      <div style={{ position: "absolute", left: -sz * 0.08, right: -sz * 0.08, bottom: sz * 0.06, height: sz * 0.36, background: L.accent, opacity: 0.85 * E.out(clamp((t - a - 0.08) / 0.2)) * (k < 1 ? 1 : active ? 1 : 0.0), transformOrigin: "left", transform: `scaleX(${E.out(clamp((t - a - 0.08) / 0.2))}) skewX(-12deg)` }} />
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {/* 冲击：每条一下 */}
            {ats.map((a, i) => (
              <React.Fragment key={i}>
                <Flash t={t} at={a} len={0.16} peak={i === 0 ? 0.0 : 0.25} color={L.accent} />
                <Ring t={t} at={a} x={W / 2} y={portrait ? H * 0.42 : H * 0.48} color={L.accent} r={W * 0.4} w={8 * u} len={0.45} />
              </React.Fragment>
            ))}
            {/* 极简绝招：真人入画 = 闪白 + 叮 */}
            <Flash t={t} at={P} len={0.3} peak={0.95} />
            <Sweep t={t} at={P + 0.55} len={0.6} color={L.accent} />

            {ats.map((a, i) => (
              <React.Fragment key={i}>
                <Sfx name="slam" at={a} vol={0.55 + i * 0.05} />
                {i === 0 && <Sfx name="boom" at={a} vol={0.45} />}
                {i < n - 1 && <Sfx name="whip" at={ats[i + 1] - 0.14} vol={0.3} />}
              </React.Fragment>
            ))}
            <Sfx name="whip" at={P - 0.2} vol={0.35} />
            <Sfx name="ding" at={P} vol={0.65} />
            <Sfx name="boom" at={P} vol={0.45} />
            <Sfx name="shimmer" at={P + 0.05} vol={0.3} />
          </>
        );
      }}
    </ProRoot>
  );
};

export const P05InfoFirst: ProOpening<D> = {
  id: "pro-05-info-first",
  name: "PRO 05 · 干货先行",
  trick: "第5招 文字干货先出现，找好节奏再露脸 + 闪白叮",
  hook: "干货 / 知识 / 清单",
  desc: "纯黑透视网格上，干货要点一条一条在画面中间全屏砸出（背后巨型序号、荧光马克笔底），下一条来时上一条缩小飞进侧边清单落位；全部落位后闪白 + 叮，一道斜切光刃劈开画面、真人从另一侧入画，清单留作本期目录并逐条高亮",
  use: "“3 个方法”“记住这几点”“不写代码、不装环境、双击就能跑”——第一句就能列出干货的开场",
  defaultSec: 3.4,
  schema,
  example: {},
  C,
};
