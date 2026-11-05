import React from "react";
import { z } from "zod";
import { useBox } from "../../lib/box";
import { alpha, useTheme } from "../../lib/theme";
import { clamp, prog, easeOut } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { GlowDefs, Headline } from "../../lib/ui";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { Figure, POSES } from "../../lib/figure";
import type { CompDef, CompProps } from "../types";

// sense-rig：给一个「只有大脑」的主体逐个装上感官、四肢和外挂工具。
// 中间是无脸剪影（Figure），四周是插槽卡：讲到哪一样，哪一样从虚线空位点亮并拉出一条连接线。
// 为什么单独做：tier-stack 讲的是「第几层」，这里讲的是「同一个东西被补上了哪几样」——
// 语义是补件不是楼层，多模态（眼/耳/手/嗓）、工具（联网/知识库）、主动性都能挂在同一具身体上。
const slotSchema = z.object({
  label: z.string().describe("插槽名（≤6 字）：眼睛 / 嗓子 / 手 / 联网 / 知识库"),
  icon: z.string().optional().describe("图标名，见 src/lib/icons.tsx（eye/mic/tool/globe/doc/video…）"),
  note: z.string().optional().describe("这一样补的是什么（≤12 字），点亮后写在插槽卡下方"),
  at: z.number().optional().describe("装上这一样的帧（台词锚点）。不写 = 还没装上，留虚线空位"),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  subject: z.string().default("大模型").describe("中间那具身体的名字（≤6 字），写在脚下"),
  subjectNote: z.string().optional().describe("身体现在是什么状态（≤14 字），如「只有大脑，动不了」"),
  slots: z.array(slotSchema).min(2).max(6).describe("插槽，按说的顺序排；会绕着主体铺成上半圈"),
  grayHint: z.string().optional().describe("还有插槽没装上时右下角那句提示，如「还空着」"),
  pipSafe: z.boolean().optional().describe("真人小窗在右上角时设为 true：把右上角的插槽下移，避免压住小窗"),
  verdict: z.string().optional().describe("底部结论条（≤18 字），停在字幕带上方"),
  verdictAt: z.number().optional().describe("结论条落下的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const compact = W < 900;

  const slots = data.slots ?? [];
  const n = slots.length;
  const cues = slots.map((s, i) => (Number.isFinite(s.at) ? (s.at as number) : Number.POSITIVE_INFINITY));
  const lit = cues.map((a) => prog(frame, a, 18));
  const litN = lit.filter((p) => p > 0.5).length;

  // ---- 几何：主体站中间偏下，插槽绕它铺成上半圈
  const cx = W / 2;
  const G = H * (compact ? 0.72 : 0.775);
  const figH = H * (compact ? 0.34 : 0.44);
  const chestY = G - figH * 0.66;
  const rx = Math.min(W * (compact ? 0.4 : 0.33), 660);
  const ry = Math.min(H * (compact ? 0.3 : 0.26), 300);
  // 上半圈：180°→360°（屏幕 y 向下，取 sin 为负的那半圈）
  const ang = (i: number) => Math.PI + (Math.PI * (i + 0.5)) / n;
  const sx = (i: number) => cx + rx * Math.cos(ang(i));
  // pipSafe：引擎的真人小窗固定占右上角（约 x 1408..1780 / y 104..430）。右上那枚插槽
  // 会正好压在小窗胸口上，文字被小窗边框切断；把它落到小窗下沿以下，连接线跟着改。
  const sy = (i: number) => {
    const y = chestY + ry * Math.sin(ang(i));
    return data.pipSafe && sx(i) > W * 0.68 && y < H * 0.42 ? H * 0.47 : y;
  };
  const chipW = Math.min(compact ? 150 : 196, (2 * Math.PI * rx) / n / 1.9);
  const chipH = compact ? 52 : 66;

  // ---- 常动：呼吸 + 一圈绕着身体转的扫描环
  const breathe = Math.sin(frame / 30) * 2.5;
  const ringR = figH * 0.5;
  const spin = (frame * 1.1) % 360;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 16);

  const eFig = enterAt(frame, 2, { fallback: "rise", dur: 16 });
  const vAt = Number.isFinite(data.verdictAt)
    ? (data.verdictAt as number)
    : (cues.filter(Number.isFinite).sort((a, b) => a - b).slice(-1)[0] ?? 0) + 24;
  const eVd = enterAt(frame, vAt, { fallback: "drop", dur: 16 });

  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="sr" std={7} user />
        {/* 地面 */}
        <line x1={cx - rx * 0.62} y1={G + 8} x2={cx + rx * 0.62} y2={G + 8} stroke={alpha(t.dim, 0.5)} strokeWidth={2} strokeDasharray="10 12" />
        {/* 扫描环：绕着身体转，保证没有静止帧 */}
        <g transform={`translate(${cx} ${chestY + breathe}) rotate(${spin})`} opacity={eFig.opacity * 0.75}>
          <ellipse rx={ringR * 1.15} ry={ringR * 0.42} fill="none" stroke={alpha(t.secondary, 0.4)} strokeWidth={2} strokeDasharray="26 40" />
        </g>
        {/* 连接线：插槽点亮后才画，线上一个亮点往身体跑 */}
        {slots.map((_, i) => {
          const p = lit[i];
          if (p <= 0.02) return null;
          const x0 = sx(i), y0 = sy(i) + chipH / 2;
          const x1 = cx + (x0 - cx) * 0.22, y1 = chestY;
          const k = easeOut(p);
          const ex = x0 + (x1 - x0) * k, ey = y0 + (y1 - y0) * k;
          const run = ((frame * 3 + i * 40) % 100) / 100;
          return (
            <g key={`c${i}`} opacity={clamp(p * 1.4 - 0.1)}>
              <path d={`M ${x0} ${y0} Q ${(x0 + x1) / 2} ${y0 + (y1 - y0) * 0.15} ${ex} ${ey}`} fill="none" stroke={alpha(t.primary, 0.75)} strokeWidth={3} filter="url(#sr)" />
              {p > 0.6 && <circle cx={x0 + (x1 - x0) * run} cy={y0 + (y1 - y0) * run} r={5} fill={t.accent} filter="url(#sr)" />}
            </g>
          );
        })}
        {/* 主体：无脸剪影 */}
        <g opacity={eFig.opacity} transform={`translate(${eFig.dx} ${eFig.dy + breathe})`}>
          <Figure x={cx} y={G} h={figH} pose={POSES.stand} color={t.text} glow={t.primary} />
          {/* 大脑那颗亮点：这具身体目前只有脑袋能用 */}
          <circle cx={cx} cy={G - figH * 0.93} r={figH * 0.055 * (0.85 + pulse * 0.3)} fill={alpha(t.accent, 0.9)} filter="url(#sr)" />
        </g>
        {/* 插槽卡：没装上是虚线空位，装上后实心发光 */}
        {slots.map((s, i) => {
          const p = lit[i];
          const on = p > 0.5;
          const eo = enterAt(frame, Number.isFinite(cues[i]) ? Math.max(0, (cues[i] as number) - 14) : 99999, { fallback: "zoom-through", dur: 16 });
          const x = sx(i), y = sy(i);
          return (
            <g key={i} opacity={on ? 1 : 0.62} transform={`translate(${x + (on ? eo.dx : 0)} ${y + (on ? eo.dy : 0)}) scale(${on ? clamp(eo.scale, 0.4, 2) : 1})`}>
              <rect
                x={-chipW / 2} y={-chipH / 2} width={chipW} height={chipH} rx={12}
                fill={alpha(t.primary, on ? 0.16 + p * 0.1 : 0.03)}
                stroke={on ? t.primary : alpha(t.dim, 0.55)} strokeWidth={on ? 3 : 2}
                strokeDasharray={on ? undefined : "12 9"} filter={on ? "url(#sr)" : undefined}
              />
              {on && <rect x={-chipW / 2} y={-chipH / 2} width={chipW} height={chipH} rx={12} fill="none" stroke={alpha(t.accent, 0.45 * pulse)} strokeWidth={2} />}
            </g>
          );
        })}
      </svg>

      {/* 插槽里的图标 + 字（DOM 层，方便长文案缩字号） */}
      {slots.map((s, i) => {
        const p = lit[i];
        const on = p > 0.5;
        const eo = enterAt(frame, Number.isFinite(cues[i]) ? Math.max(0, (cues[i] as number) - 14) : 99999, { fallback: "zoom-through", dur: 16 });
        const x = sx(i), y = sy(i);
        const size = Math.min(compact ? 20 : 27, (compact ? 20 : 27) * (s.label.length > 5 ? 0.8 : 1));
        return (
          <React.Fragment key={`t${i}`}>
            <div style={{ position: "absolute", left: x - chipW / 2 + 14 + (on ? eo.dx : 0), top: y - chipH / 2 + (on ? eo.dy : 0), width: chipW - 28, height: chipH, display: "flex", alignItems: "center", gap: 10, opacity: on ? eo.opacity : 0.7 }}>
              {s.icon && <Icon name={s.icon} size={Math.min(chipH * 0.5, 30)} color={on ? t.primary : alpha(t.dim, 0.8)} />}
              <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: size, color: on ? t.text : alpha(t.dim, 0.85), whiteSpace: "nowrap", letterSpacing: 1 }}>{s.label}</span>
            </div>
            {s.note && on && p > 0.6 && (
              <div style={{ position: "absolute", left: x - chipW / 2, top: y + chipH / 2 + 6 + eo.dy, width: chipW, textAlign: "center", fontFamily: t.font.body, fontWeight: 700, fontSize: compact ? 15 : 19, lineHeight: 1.25, color: alpha(t.accent, 0.92), opacity: clamp(p * 1.3 - 0.5), whiteSpace: "nowrap" }}>
                {s.note}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* 脚下：主体名 + 现在的状态 */}
      <div style={{ position: "absolute", left: cx - 220, top: G + 16 + breathe, width: 440, textAlign: "center", opacity: eFig.opacity }}>
        <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: compact ? 26 : 34, color: t.text, letterSpacing: 2, whiteSpace: "nowrap" }}>{data.subject}</div>
        {data.subjectNote && <div style={{ marginTop: 4, fontFamily: t.font.body, fontWeight: 700, fontSize: compact ? 16 : 20, color: alpha(t.dim, 0.95), whiteSpace: "nowrap" }}>{data.subjectNote}</div>}
      </div>

      {/* 已装上 k/n 计数 */}
      <div style={{ position: "absolute", left: compact ? 16 : 40, top: G - 6, fontFamily: t.font.mono, fontWeight: 800, fontSize: compact ? 18 : 23, color: alpha(t.accent, 0.9), letterSpacing: 1 }}>
        已装上 {litN}/{n}
      </div>
      {data.grayHint && litN < n && (
        <div style={{ position: "absolute", right: compact ? 16 : 40, top: G - 6, fontFamily: t.font.body, fontWeight: 700, fontSize: compact ? 17 : 21, color: alpha(t.dim, 0.95), whiteSpace: "nowrap" }}>
          {data.grayHint}
        </div>
      )}

      {/* 结论条：块顶 + 高 ≤ H-145，不压逐字字幕带 */}
      {data.verdict && (
        <div
          style={{
            position: "absolute", left: 0, width: W, top: H - 145 - 46 + eVd.dy, opacity: eVd.opacity, clipPath: eVd.clip, transform: `scale(${eVd.scale})`,
            textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: compact ? 24 : 34, color: t.accent, whiteSpace: "nowrap", textShadow: `0 0 26px ${alpha(t.accent, 0.5)}`,
          }}
        >
          {data.verdict}
        </div>
      )}

      {cues.map((a, i) => (a > 4 && frame >= a && frame < a + 3 ? <Sfx key={i} name="pop" at={a} volume={0.32} /> : null))}
      {data.verdict ? <Sfx name="ding" at={vAt} volume={0.3} /> : null}
      <Headline kicker={data.kicker} title={data.title} frame={frame} />
    </>
  );
};

export const SenseRig: CompDef<D> = {
  id: "sense-rig",
  name: "给主体装上感官和工具",
  layer: "metaphor",
  variants: 2,
  minSec: 4,
  maxSec: 16,
  tags: ["多模态", "感官", "四肢", "装配", "补短板", "工具", "联网", "知识库", "被动", "能力"],
  motion: { kind: "无脸主体居中，四周插槽逐个点亮并拉出连接线，扫描环常转", energy: 2 },
  desc:
    "中间站一具无脸剪影（只有大脑那颗点在亮），四周绕一圈插槽卡：讲到哪一样，哪一样从虚线空位变成实心发光卡，并拉一条曲线连回身体，线上有亮点往身体跑。左下角实时计数「已装上 k/n」，还有空位时右下角可挂一句提示。底部结论条停在字幕带上方。",
  use:
    "讲「同一个东西被补上了哪几样能力」：给大模型装上眼睛耳朵手脚嗓子（多模态）、给它配上网和知识库（工具）、给它装上主动性（智能体）；也反过来用——只点亮两三个、留着空位，讲「它还是碰不到你的文件」「它还缺这一样」。和 tier-stack 分开：那个讲楼层（第几层），这个讲补件（缺哪一块、补上了哪一块）。",
  schema,
  example: {
    kicker: "第二层 · 多模态",
    title: "给这位教授装上感官和四肢",
    subject: "老教授",
    subjectNote: "只有大脑，动不了",
    slots: [
      { label: "眼睛", icon: "eye", note: "看图、生图", at: 20 },
      { label: "嗓子", icon: "mic", note: "生音乐、配音", at: 60 },
      { label: "手", icon: "tool", note: "写代码、剪视频", at: 100 },
      { label: "联网", icon: "globe", note: "知道刚发生的事", at: 140 },
      { label: "知识库", icon: "doc", note: "读你的资料", at: 180 },
    ],
    grayHint: "还空着",
    verdict: "装上的每一样，都是补它缺的那一块",
  },
  C,
};
