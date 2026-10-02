import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, lerp, prog, rng } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { guessIcon, Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  items: z.array(z.object({ name: z.string(), days: z.number().optional(), icon: z.string().optional(), at: z.number().optional() })).min(2).max(8).describe("架子上吃灰的东西：没卖出去的智能体 / 半途而废的项目"),
  pileCount: z.number().int().min(2).max(200).default(100).describe("总数滚动到的数字"),
  dustLevel: z.number().min(0).max(1).default(0.8).describe("灰有多厚 0~1"),
  caption: z.string().optional().describe("一句话，如“收藏夹里吃灰的 100 个项目”"),
  sweepAt: z.number().optional().describe("镜头扫过架子的时刻"),
  countAt: z.number().optional().describe("总数滚动的时刻"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed }) => {
  const t = useTheme();
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const n = data.items.length;
  const sweepAt = cueOr(data.sweepAt, Math.round(dur * 0.16));
  const cues = data.items.map((x, i) => cueOr(x.at, sweepAt + 8 + i * 7));
  const countAt = cueOr(data.countAt, sweepAt + Math.round(dur * 0.4));
  const countEnd = countAt + 40;
  const G = full ? H * 0.78 : H * 0.76;
  const shelfH = full ? 62 : 34;
  const rows = Math.ceil(n / 4);
  const shelfW = full ? W * 0.82 : W * 0.9;
  const shelfX = (W - shelfW) / 2;
  // the "camera" pans across the shelves
  const pan = easeInOut(prog(frame, sweepAt, Math.max(30, cues[n - 1] - sweepAt)));
  const panX = lerp(-(full ? 60 : 30), full ? 60 : 30, pan);
  // dust specks drifting
  const specks = React.useMemo(() => {
    const r = rng(seed + 7);
    return Array.from({ length: 26 }, () => ({ x: r() * W, y: r() * H, s: 1 + r() * 3, sp: 0.2 + r() * 0.5, ph: r() * 6 }));
  }, [seed, W, H]);
  const dust = clamp(data.dustLevel);
  const countP = clamp((frame - countAt) / Math.max(1, countEnd - countAt));
  const shown = Math.round(lerp(0, data.pileCount, easeOut(countP)));
  const sh = { x: panX, y: 0 };

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* shelves */}
        {Array.from({ length: rows }, (_, r) => {
          const y = G - (rows - r - 1) * shelfH * 3.1;
          const p = easeOut(prog(frame, sweepAt - 10 + r * 6, 16));
          return (
            <React.Fragment key={r}>
              {/* items sitting on this shelf */}
              {data.items.map((it, i) => {
                if (Math.floor(i / 4) !== r) return null;
                const c = cues[i];
                if (frame < c) return null;
                const col = i % 4;
                const ip = easeOutBack(prog(frame, c, 12));
                const ic = it.icon ?? guessIcon(it.name) ?? "box";
                const cw = (shelfW - (full ? 40 : 16)) / 4;
                const x = shelfX + (full ? 20 : 8) + col * cw;
                const chh = full ? 120 : 64;
                return (
                  <div key={i} style={{ position: "absolute", left: x + cw * 0.06, top: y - chh, width: cw * 0.88, height: chh, transform: `scale(${ip})`, transformOrigin: "50% 100%", borderRadius: 10, background: `linear-gradient(180deg, ${alpha(t.text, 0.16)}, ${alpha(t.bg2, 0.9)})`, border: `2px solid ${alpha(t.dim, 0.6)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: full ? 6 : 3 }}>
                    <Icon name={ic} size={full ? 34 : 18} color={t.dim} />
                    <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: fitFont(it.name, cw * 0.82, full ? 19 : 10, 8), color: t.dim, whiteSpace: "nowrap" }}>{it.name}</span>
                    {it.days !== undefined && (
                      <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 17 : 9, color: alpha("#b9a88a", 0.9) }}>吃灰 {it.days} 天</span>
                    )}
                    {/* dust cap on top of every item */}
                    <div style={{ position: "absolute", left: -2, right: -2, top: -2, height: (full ? 14 : 8) * dust, borderRadius: 10, background: `linear-gradient(180deg, ${alpha("#b9a88a", 0.75 * dust)}, transparent)` }} />
                  </div>
                );
              })}
              {/* the shelf plank */}
              <div style={{ position: "absolute", left: shelfX, top: y, width: shelfW * p, height: full ? 12 : 7, borderRadius: 4, background: alpha(t.text, 0.35), boxShadow: `0 6px 14px rgba(0,0,0,.5)` }} />
            </React.Fragment>
          );
        })}
        {/* spider web in the far corner */}
        {dust > 0.4 && (
          <svg width={full ? 200 : 110} height={full ? 140 : 78} style={{ position: "absolute", right: shelfX, top: G - rows * shelfH * 3.1 - (full ? 150 : 82), opacity: (dust - 0.4) * 1.6 }}>
            {Array.from({ length: 5 }, (_, q) => <line key={q} x1={full ? 200 : 110} y1={0} x2={(full ? 200 : 110) * (q % 2 ? 0.35 : 1)} y2={((full ? 140 : 78) * (q + 1)) / 5} stroke={alpha("#cfd8dd", 0.42)} strokeWidth={1.5} />)}
            {Array.from({ length: 4 }, (_, q) => <path key={q} d={`M${(full ? 200 : 110) * (0.2 + q * 0.18)} 0 Q ${(full ? 200 : 110) * (0.1 + q * 0.2)} ${(full ? 140 : 78) * 0.35} ${(full ? 200 : 110) * (0.35 + q * 0.16)} ${(full ? 140 : 78) * 0.7}`} fill="none" stroke={alpha("#cfd8dd", 0.35)} strokeWidth={1.2} />)}
          </svg>
        )}
        {/* dust motes drifting in the light */}
        {specks.map((s, i) => (
          <div key={i} style={{ position: "absolute", left: s.x + Math.sin(frame * 0.01 * s.sp + s.ph) * 40, top: s.y + Math.cos(frame * 0.008 * s.sp + s.ph) * 30, width: s.s * 2.6, height: s.s * 2.6, borderRadius: "50%", background: alpha("#e8dcc0", 0.35 * dust) }} />
        ))}
        {/* the counter */}
        <div style={{ position: "absolute", right: full ? W * 0.06 : 16, top: full ? H * 0.3 : H * 0.14, textAlign: "right", opacity: easeOut(prog(frame, countAt, 12)) }}>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 150 : 62, lineHeight: 1, color: t.dim, fontVariantNumeric: "tabular-nums", textShadow: "0 4px 18px rgba(0,0,0,.7)" }}>{shown}</div>
          <div style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: full ? 30 : 15, color: t.dim }}>个吃灰的</div>
        </div>
        {data.caption && frame >= countEnd && (
          <div style={{ position: "absolute", left: 0, right: 0, top: G + (full ? 46 : 22), textAlign: "center", opacity: easeOut(prog(frame, countEnd, 12)), fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(data.caption, W * 0.8, full ? 48 : 24, 14), color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 22px ${alpha(t.gold, 0.5)}, 0 3px 0 #000` }}>{data.caption}</div>
        )}
      </div>
      {cues.map((c, i) => (
        <Sfx key={i} name="click" at={c} volume={0.2} />
      ))}
      <Sfx name="tick" at={countAt} volume={0.24} />
      <Sfx name="glitch" at={countEnd} volume={0.22} />
    </>
  );
};

export const DustyShelf: CompDef<D> = {
  id: "dusty-shelf",
  name: "积灰货架（做完就放着）",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["吃灰", "积灰", "收藏夹", "没卖出去", "半途而废", "放着没动"],
  motion: { kind: "架子一层层立起、东西摆上并积灰 → 镜头横扫 → 总数滚动 → 蛛网飘灰", energy: 1 },
  desc: "一层层货架搭起来，每件做完就没再动的东西被摆上架、顶上慢慢积起灰、挂着「吃灰 N 天」；镜头横扫过整排架子，空气里飘着灰粒、角落结着蛛网；右侧一个数字滚到总数",
  use: "讲做完就放着、没人用：收藏夹里吃灰的 100 个项目、一堆没人买的智能体、三个半途而废的作品、课程买了一节没看",
  panel: true,
  schema,
  example: { items: [{ name: "智能体 A", days: 42 }, { name: "智能体 B", days: 88 }, { name: "小工具", days: 120 }, { name: "课程", days: 200 }], pileCount: 100, caption: "收藏夹里吃灰的 100 个项目" },
  C,
};
