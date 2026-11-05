import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, lerp } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { listCues, cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { harm } from "../../lib/spring";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 「不报错、不提醒、等你发现的时候已经发生了」——这类隐性风险的原片画面从来没被现有组件表达过：
// versus/pit-trap 都要「看得见的一个结果」，而这段要的是「一整段过程里所有指标都说正常，
// 只有一个没人看的数在悄悄下滑」。所以这个组件的说服力全在「颜色的不变」上：
//   1) 左侧检查项逐条打勾，勾的颜色和绿灯到 revealAt 之前一个像素都没变过；
//   2) 右侧那条曲线是自己一点点画出来的（不是画完再放大），观众和博主一样没盯着它；
//   3) revealAt 才做全片第一次颜色变化：曲线转红 + 落点套环 + 读数砸红，
//      此时左侧依旧「全部正常」——画面自己把「它一声没吭」讲完。
// 数值只在 [from, to] 之间线性走，抖动幅度取跨度 1%，小到一个数量级读数看不出来（隐蔽），
// 但曲线终点和虚线基线的落差是实打实的（可比）。

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  panel: z.string().max(12).optional().describe("左侧检查面板的标题，如「这一天顺不顺」；缺省「每天都在查的几项」"),
  allOk: z.string().max(12).optional().describe("面板顶部那颗绿灯写的字，如「全部正常」；缺省「全部正常」"),
  items: z
    .array(z.object({ text: z.string().max(14), at: z.number().optional() }))
    .min(1)
    .max(5)
    .describe("逐条打勾的检查项（都说「正常」的那些事），如「活干完了」「没弹报错」"),
  metric: z.string().max(12).describe("右边那条没人看的曲线：悄悄在变的那个东西，如「自己想的次数」"),
  from: z.number().describe("起始读数"),
  to: z.number().describe("发现时的读数"),
  unit: z.string().max(6).optional().describe("读数单位，如 %、次、小时"),
  driftAt: z.number().optional().describe("曲线开始悄悄下滑的时刻（锚点）；缺省=第一项打勾后"),
  revealAt: z.number().optional().describe("「等你发现」那一刻：曲线转红、砸出结论（锚点）"),
  verdict: z.string().max(18).optional().describe("结论大字，如「它一声没吭」"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const { fps } = useVideoConfig();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const full = width >= 900;
  const D_sec = dur / fps;
  const s = frame / fps;

  const pad = full ? 96 : 18;
  const top = full ? 224 : 108;
  const bottomSafe = height - (full ? 150 : 96); // 结论条的下沿不许越过逐字字幕带
  const panelH = Math.min(full ? 470 : 210, bottomSafe - top - (full ? 150 : 64));

  const okW = full ? Math.round(width * 0.4) : width - pad * 2;
  const okX = pad;
  const chX = pad + okW + (full ? 44 : 0);
  const chY = full ? top : top + panelH + 26;
  const chW = width - chX - pad;
  const chH = panelH;

  const items = data.items || [];
  const cues = listCues(items, Math.round(dur * 0.1), Math.round(dur * 0.46));
  const allOk = data.allOk || "全部正常";
  const panelName = data.panel || "每天都在查的几项";

  const revealAt = cueOr(data.revealAt, Math.round(dur * 0.78));
  const driftAt = cueOr(data.driftAt, cues[0] + Math.round(fps * 0.6));
  const drawEnd = Math.max(driftAt + Math.round(fps * 0.8), revealAt - Math.round(fps * 0.35));
  const verdictAt = Math.min(revealAt + Math.round(fps * 0.42), dur - 8);

  const p = clamp((s - driftAt / fps) / Math.max(0.4, (drawEnd - driftAt) / fps));
  const span = data.from - data.to;
  const val = (u: number) => {
    const e = easeInOut(clamp(u * 1.08));
    const wobble = span * 0.01 * harm(u * D_sec, D_sec, 5, seed % 7);
    return lerp(data.from, data.to, e) + wobble;
  };
  const vHi = Math.max(data.from, data.to) + Math.abs(span) * 0.1;
  const vLo = Math.min(data.from, data.to) - Math.abs(span) * 0.12;
  // 图表分「表头带 + 画图区」：读数和曲线名放表头带，曲线只在下面的画图区里走，
  // 否则大数字会正好压在曲线起点和「起点」虚线上（静帧里一眼就看出来）。
  const headH = full ? 158 : 62;
  const plotTop = chY + headH;
  const plotBot = chY + chH - (full ? 46 : 18);
  const X = (u: number) => chX + 26 + u * (chW - 60);
  const Y = (v: number) => plotTop + (1 - (v - vLo) / Math.max(1e-6, vHi - vLo)) * (plotBot - plotTop);

  const N = full ? 76 : 40;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * p;
    pts.push(`${X(u).toFixed(1)},${Y(val(u)).toFixed(1)}`);
  }
  const line = pts.join(" ");
  const lastX = X(p);
  const lastY = Y(val(p));

  const rev = easeOut(clamp((s - revealAt / fps) / 0.5));
  const calm = rev < 0.02;
  // 左边那块的颜色：一直到 revealAt 之后都不动 —— 「全部正常」是它一开始就说、并且一直没改口的话
  const okCol = t.primary;
  const eVerdict = enterAt(frame, verdictAt, { fallback: "slam", dur: 16 });
  const ePanel = enterAt(frame, Math.round(dur * 0.06), { fallback: "rise", dur: 18 });
  const breathe = 0.55 + 0.45 * (0.5 + 0.5 * harm(s, D_sec, 3));

  const shown = val(p);
  const dec = Math.abs(span) >= 20 ? 0 : 1;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />}

      {/* ── 左：每天都在查的几项，逐条打勾，全程不变脸 ── */}
      <div
        style={{
          position: "absolute",
          left: okX,
          top,
          width: okW,
          height: panelH,
          padding: full ? "22px 26px" : "12px 14px",
          borderRadius: 20,
          display: "flex",
          flexDirection: "column",
          background: alpha(t.bg2, 0.5),
          border: `2px solid ${alpha(t.line, 0.55)}`,
          opacity: ePanel.opacity,
          transform: `translate(${ePanel.dx}px, ${ePanel.dy}px)`,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontFamily: t.font.mono, fontSize: full ? 22 : 13, letterSpacing: 3, color: t.dim }}>{panelName}</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: full ? "7px 18px" : "4px 10px",
              borderRadius: 999,
              border: `2px solid ${alpha(okCol, 0.75)}`,
              color: okCol,
              fontFamily: t.font.title,
              fontWeight: 900,
              fontSize: full ? 24 : 13,
              boxShadow: `0 0 ${full ? 26 : 12}px ${alpha(okCol, 0.28 * breathe)}`,
            }}
          >
            <span style={{ width: full ? 13 : 8, height: full ? 13 : 8, borderRadius: 999, background: okCol, opacity: breathe }} />
            {allOk}
          </span>
        </div>
        <div style={{ flex: 1, marginTop: full ? 14 : 8, display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>
          {items.map((it, i) => {
            const e = enterAt(frame, cues[i], { fallback: "slide-l", dur: 12 });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: full ? 18 : 8,
                  paddingBottom: full ? 14 : 6,
                  borderBottom: i < items.length - 1 ? `1.5px solid ${alpha(t.line, 0.28)}` : "none",
                  opacity: e.opacity,
                  transform: `translateX(${e.dx}px)`,
                }}
              >
                <span
                  style={{
                    width: full ? 36 : 20,
                    height: full ? 36 : 20,
                    flex: "0 0 auto",
                    borderRadius: 9,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: alpha(okCol, 0.14),
                    border: `2px solid ${alpha(okCol, 0.8)}`,
                  }}
                >
                  <Icon name="check" size={full ? 23 : 13} color={okCol} stroke={3.2} />
                </span>
                <span style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: full ? 33 : 14, color: t.text, whiteSpace: "nowrap" }}>{it.text}</span>
                <span style={{ marginLeft: "auto", fontFamily: t.font.mono, fontSize: full ? 23 : 12, color: okCol, letterSpacing: 3 }}>正常</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 右：没人盯着的那条曲线，自己一点点画出来 ── */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <rect x={chX} y={chY} width={chW} height={chH} rx={20} fill={alpha(t.bg2, 0.42)} stroke={alpha(t.line, 0.5)} strokeWidth={2} />
        {/* 起点基线：落差得有参照，不然「下滑」看不出来 */}
        <line x1={chX + 26} y1={Y(data.from)} x2={chX + chW - 26} y2={Y(data.from)} stroke={alpha(t.dim, 0.55)} strokeWidth={2} strokeDasharray="10 12" />
        <text x={chX + chW - 30} y={Y(data.from) - 12} textAnchor="end" fontFamily={t.font.mono} fontSize={full ? 21 : 12} fill={t.dim}>
          起点 {data.from}
          {data.unit || ""}
        </text>
        <line x1={chX + 26} y1={Y(vLo)} x2={chX + chW - 26} y2={Y(vLo)} stroke={alpha(t.dim, 0.28)} strokeWidth={1.5} />
        {/* 曲线：平静色一直画到 revealAt，红的这路是叠在上面淡入的（不混色，主题换皮也不会糊） */}
        <polyline points={line} fill="none" stroke={t.primary} strokeWidth={full ? 5 : 2.5} strokeLinejoin="round" strokeOpacity={calm ? 0.95 : 0.95 * (1 - rev)} />
        <polyline points={line} fill="none" stroke={t.bad} strokeWidth={full ? 5 : 2.5} strokeLinejoin="round" strokeOpacity={rev} />
        {p > 0.02 && (
          <>
            <circle cx={lastX} cy={lastY} r={full ? 9 : 5} fill={calm ? t.primary : t.bad} />
            {rev > 0.02 && (
              <>
                <circle cx={lastX} cy={lastY} r={(full ? 34 : 18) * (0.5 + 0.5 * rev)} fill="none" stroke={t.bad} strokeWidth={3} strokeOpacity={0.85 * rev} />
                <circle cx={lastX} cy={lastY} r={(full ? 62 : 30) * rev} fill="none" stroke={t.bad} strokeWidth={2} strokeOpacity={0.35 * rev} />
              </>
            )}
          </>
        )}
        <text x={chX + 30} y={chY + (full ? 44 : 20)} fontFamily={t.font.body} fontWeight={700} fontSize={full ? 26 : 13} fill={t.dim}>
          {data.metric}
        </text>
      </svg>

      {/* 读数：表头带左边，曲线在下面自己走；讲到发现那一刻才变红 */}
      <div style={{ position: "absolute", left: chX + 26, top: chY + (full ? 56 : 26), whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 76 : 30, color: calm ? t.text : t.bad, letterSpacing: -2 }}>{shown.toFixed(dec)}</span>
        <span style={{ fontFamily: t.font.mono, fontSize: full ? 28 : 13, color: t.dim, marginLeft: 10 }}>{data.unit || ""}</span>
      </div>

      {/* 报警计数：全片一直是 0，这行小字就是「不报错」的证据 */}
      {full && (
        <div style={{ position: "absolute", left: pad, top: top + panelH + 26, display: "flex", alignItems: "center", gap: 26, fontFamily: t.font.mono, fontSize: 23, color: t.dim }}>
          <span>
            报警 <b style={{ color: calm ? t.primary : t.text, fontFamily: t.font.title, fontSize: 30 }}>0</b> 次
          </span>
          <span>
            提醒 <b style={{ color: calm ? t.primary : t.text, fontFamily: t.font.title, fontSize: 30 }}>0</b> 条
          </span>
          <span style={{ color: calm ? t.primary : t.bad }}>● 状态始终正常</span>
        </div>
      )}

      {data.verdict && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            // 66px 的行要 79px 高，bottomSafe-96 会把下沿压到 967 —— 逐字字幕带从 935 开始，
            // 结论大字和字幕会叠成两行几乎重复的字。留足一行的高度。
            top: bottomSafe - 150,
            textAlign: "center",
            opacity: eVerdict.opacity,
            transform: `translate(${eVerdict.dx}px, ${eVerdict.dy}px) scale(${eVerdict.scale})`,
            clipPath: eVerdict.clip,
          }}
        >
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, width * 0.8, full ? 66 : 26, 15), color: t.bad, whiteSpace: "nowrap" }}>
            {data.verdict}
          </span>
        </div>
      )}

      {items.map((_, i) => (
        <Sfx key={i} name="tick" at={cues[i]} volume={0.22} />
      ))}
      <Sfx name="impact" at={revealAt} volume={0.4} />
      {data.verdict && <Sfx name="stamp" at={verdictAt} volume={0.32} />}
    </>
  );
};

export const SilentDrift: CompDef<D> = {
  id: "silent-drift",
  name: "零报警下滑（没人看的数在悄悄掉）",
  layer: "metaphor",
  variants: 1,
  minSec: 4,
  maxSec: 12,
  tags: ["隐性风险", "不报错", "悄悄", "无预警", "退化", "温水煮蛙", "发现太晚"],
  motion: { kind: "检查项逐条打勾保持原色，右侧一条读数曲线随时间自行画低；revealAt 后曲线整条转红、落点套环、结论砸下", energy: 2 },
  desc: "左右两块：左边一块检查面板，项项打勾、右侧统一标「正常」、顶部那颗绿灯一直在呼吸；右边一块没人盯的读数曲线，从 driftAt 起自己一点点往右画、画的同时数值就在往下掉（起点画一条虚线做参照）。底下「报警 0 次 · 提醒 0 条」全程不动。到 revealAt 才发生全片第一次变化：曲线转红、落点套两圈红环、读数砸红、结论大字落下——而左边依然写着全部正常",
  use: "讲「不报错、不提醒、等你发现的时候已经发生了」的隐性风险：能力悄悄退化、账户余额悄悄被扣、关系悄悄被消耗、坏习惯悄悄攒够、债务滚利息、代码里的技术债。verdict 就写那件最扎心的事实（「它一声没吭」「没人按报警键」）。revealAt 必须挂在台词里「等你发现/回头看/已经发生了」那个词上，前面所有东西都要忍住不变",
  schema,
  example: {
    kicker: "这两个坑的共同点",
    title: "没有任何一个地方报警",
    panel: "这一天顺不顺",
    allOk: "全部正常",
    items: [{ text: "活干完了" }, { text: "没弹报错" }, { text: "没人提醒" }, { text: "时间也够用" }],
    metric: "自己想的次数",
    from: 100,
    to: 34,
    unit: "%",
    verdict: "它一声没吭",
  },
  C,
};
