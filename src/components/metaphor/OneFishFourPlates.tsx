import React from "react";
import { z } from "zod";
import { easeInOut, easeOut, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const plate = z.object({
  name: z.string().describe("平台 / 形态：竖屏短视频 / 横屏长视频 / 图文 / 音频"),
  form: z.string().optional().describe("这一盘里的样子，如“剪成 3 条”“转成播客”"),
  gain: z.string().describe("这一盘吃到的：1.2 万播放 / 300 个粉"),
  icon: z.string().optional(),
  at: z.number().optional(),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  source: z.string().describe("那条源内容：这一条视频 / 这篇稿子 / 这次直播"),
  sourceIcon: z.string().optional(),
  plates: z.array(plate).min(2).max(4),
  cutAt: z.number().optional().describe("开始把源内容切开分盘的时刻"),
  verdict: z.string().optional(),
  verdictAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.plates.length;
  const cutAt = cueOr(data.cutAt, Math.round(dur * 0.16));
  const cues = data.plates.map((p, i) => cueOr(p.at, cutAt + 20 + i * Math.round(Math.max(16, (dur * 0.5) / n))));
  const verdictAt = cueOr(data.verdictAt, cues[n - 1] + 26);
  const srcX = full ? W * 0.16 : W * 0.18;
  const srcY = full ? H * 0.46 : H * 0.42;
  const srcW = full ? W * 0.2 : W * 0.26;
  const srcH = full ? H * 0.2 : H * 0.14;
  const plateX = full ? W * 0.52 : W * 0.48;
  const plateW = full ? W * 0.4 : W * 0.44;
  const plateH = full ? Math.min(120, (H * 0.6) / n) : 68;
  const gap = full ? 20 : 10;
  const top = full ? H * 0.24 : H * 0.14;
  const srcIcon = data.sourceIcon ?? guessIcon(data.source) ?? "film";
  // 源盘 / 结论从 0 弹出 = 元素入场；分瓣曲线、切口虚线、把内容送进盘里是主体动作不动
  const eSrc = enterAt(frame, 4, { fallback: "rise", dur: 16, from: 0 });
  const eVerd = enterAt(frame, verdictAt, { fallback: "rise", dur: 14, from: 0 });

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0 }}>
        {/* the source dish */}
        <div style={{ position: "absolute", left: srcX, top: srcY, width: srcW, height: srcH, transform: `translate(${eSrc.dx}px, ${eSrc.dy}px) scale(${eSrc.scale})`, opacity: eSrc.opacity, borderRadius: 18, background: `linear-gradient(150deg, ${alpha(t.primary, 0.25)}, ${alpha(t.bg2, 0.95)})`, border: `3px solid ${t.primary}`, boxShadow: `0 0 40px ${alpha(t.primary, 0.4)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: full ? 8 : 4 }}>
          <Icon name={srcIcon} size={full ? 44 : 24} color={t.primary} />
          {/* 切割虚线按 n 等分横穿源盘，字必须垫一块不透明底，否则标签被「切」成贯穿线 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: full ? 4 : 2, padding: full ? "7px 14px" : "3px 7px", borderRadius: 10, background: alpha(t.bg, 0.94), boxShadow: `0 0 0 1.5px ${alpha(t.primary, 0.4)}` }}>
            <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.source, srcW - (full ? 60 : 30), full ? 26 : 14, 11), color: t.text, whiteSpace: "nowrap" }}>{data.source}</div>
            <div style={{ fontFamily: t.font.mono, fontSize: full ? 16 : 10, letterSpacing: 3, color: t.primary }}>一条源内容</div>
          </div>
        </div>
        {/* cutting blades: the dashes that split it into portions */}
        {frame >= cutAt && (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {Array.from({ length: n }, (_, i) => {
              const c = cues[i];
              if (frame < c) return null;
              const p = easeInOut(prog(frame, c - 10, 14));
              const y0 = srcY + (srcH * (i + 0.5)) / n;
              const y1 = top + i * (plateH + gap) + plateH / 2;
              const x0 = srcX + srcW;
              const x1 = plateX;
              return (
                <g key={i} opacity={p}>
                  <path d={`M${x0},${y0} C${x0 + 90},${y0} ${x1 - 110},${y1} ${x1},${y1}`} fill="none" stroke={alpha(t.accent, 0.9)} strokeWidth={full ? 5 : 3} strokeDasharray="14 12" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${alpha(t.accent, 0.6)})` }} />
                  <polygon points={`${x1},${y1} ${x1 - 16},${y1 - 9} ${x1 - 16},${y1 + 9}`} fill={t.accent} />
                </g>
              );
            })}
            {/* the split lines on the source */}
            {frame >= cutAt && Array.from({ length: n - 1 }, (_, i) => (
              <line key={i} x1={srcX + 6} y1={srcY + (srcH * (i + 1)) / n} x2={srcX + srcW - 6} y2={srcY + (srcH * (i + 1)) / n} stroke={alpha(t.accent, easeOut(prog(frame, cutAt, 14)))} strokeWidth={3} strokeDasharray="8 8" />
            ))}
          </svg>
        )}
        {/* the four plates */}
        {data.plates.map((p, i) => {
          const c = cues[i];
          if (frame < c) return null;
          // 每只盘子从右侧滑入淡入 = 元素入场
          const ePl = enterAt(frame, c, { fallback: "slide-r", dur: 14, dist: 70 / 240, seed: i });
          const y = top + i * (plateH + gap);
          // each plate is a different shape: 竖屏 / 横屏 / 图文 / 音频
          const shape = i % 4;
          const ic = p.icon ?? guessIcon(p.name) ?? "film";
          return (
            <div key={i} style={{ position: "absolute", left: plateX, top: y, width: plateW, height: plateH, transform: `translate(${ePl.dx}px, ${ePl.dy}px)`, opacity: ePl.opacity, borderRadius: shape === 3 ? 18 : 14, background: alpha(t.bg, 0.9), border: `2.5px solid ${alpha(t.accent, 0.85)}`, boxShadow: `0 0 22px ${alpha(t.accent, 0.3)}`, display: "flex", alignItems: "center", gap: full ? 16 : 8, padding: `0 ${full ? 20 : 10}px`, overflow: "hidden" }}>
              {/* plate silhouette */}
              <div style={{ width: full ? 54 : 30, height: full ? 54 : 30, borderRadius: shape === 0 ? 8 : shape === 3 ? "50%" : 4, border: `2.5px solid ${t.accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={ic} size={full ? 26 : 14} color={t.accent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(p.name, plateW * 0.5, full ? 28 : 15, 11), color: t.text, whiteSpace: "nowrap" }}>{p.name}</div>
                {p.form && <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: fitFont(p.form, plateW * 0.5, full ? 20 : 11, 9), color: t.dim, whiteSpace: "nowrap" }}>{p.form}</div>}
              </div>
              <div style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: fitFont(p.gain, plateW * 0.34, full ? 24 : 13, 10), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 14px ${alpha(t.gold, 0.5)}` }}>{p.gain}</div>
            </div>
          );
        })}
        {data.verdict && frame >= verdictAt && (
          <div style={{ position: "absolute", left: 0, right: 0, top: top + n * (plateH + gap) + (full ? 26 : 12), textAlign: "center", transform: `translate(${eVerd.dx}px, ${eVerd.dy}px) scale(${eVerd.scale})`, opacity: eVerd.opacity, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.verdict, W * 0.8, full ? 48 : 24, 14), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 22px ${alpha(t.gold, 0.6)}, 0 3px 0 #000` }}>{data.verdict}</div>
        )}
      </div>
      <Sfx name="swipe" at={cutAt} volume={0.3} />
      {cues.map((c, i) => (
        <Sfx key={i} name="pop" at={c} volume={0.28} />
      ))}
      {data.verdict && <Sfx name="success" at={verdictAt} volume={0.34} />}
    </>
  );
};

export const OneFishFourPlates: CompDef<D> = {
  id: "one-fish-four-plates",
  name: "一鱼多吃（一条内容分几盘）",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["一鱼多吃", "分发", "多平台", "一次生产", "吃透"],
  motion: { kind: "源内容被切成分瓣 → 每瓣沿曲线送进一个异形盘 → 各盘收益跳出", energy: 2 },
  desc: "左边一条源内容被虚线切成几份，每一份沿一条曲线送进右边一个形状不同的盘子（竖屏 / 横屏 / 图文 / 音频），每只盘子上标着在这一盘里的形态和吃到的收益；全部到位后底部给出结论",
  use: "讲一次生产多处分发：同一条内容在四个平台各吃一份流量、一条视频吃透 4 个平台、一份稿子拆成图文和播客",
  panel: true,
  schema,
  example: { source: "这一条视频", plates: [{ name: "竖屏短视频", form: "剪成 3 条", gain: "1.2 万播放" }, { name: "图文", form: "转成笔记", gain: "800 收藏" }, { name: "音频", form: "做成播客", gain: "300 订阅" }], verdict: "一条内容，四份流量" },
  C,
};
