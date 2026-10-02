import React from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeOutBack } from "../../lib/anim";
import { useEnter } from "../../lib/enter";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Glass, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({ title: z.string().optional(), kicker: z.string().optional(), items: z.array(z.object({ title: z.string(), desc: z.string().optional() })).min(2).max(6) });
type D = z.infer<typeof schema>;

// cards fly from deep space into a fanned arc; the "current" one lifts forward in turn
const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useVideoConfig();
  const it = data.items;
  const n = it.length;
  const cw = Math.min(400, (width - 260) / n - 24);
  const ch = 420;
  const total = n * (cw + 24) - 24;
  const x0 = (width - total) / 2;
  const cy = height / 2 + 70;
  const per = Math.max(16, (dur - 30) / n);
  const cur = Math.min(n - 1, Math.floor((frame - 20) / per));
  return (
    <>
      {it.map((c, i) => {
        // 原生入场：卡片从深空穿到面前（easeOutQuint + perspective）→ zoom-through 的 p 与原生等价
        const e = enterAt(frame, 4 + i * 5, { fallback: "zoom-through", dur: 26, seed: i });
        const p = e.p;
        const mid = (n - 1) / 2;
        const arc = variant === 1 ? Math.abs(i - mid) * 30 : 0;
        const rot = variant === 1 ? (i - mid) * 4 : 0;
        const isCur = i === cur;
        const lift = isCur ? easeOutBack(clamp((frame - 20 - i * per) / 12)) : 0;
        const x = x0 + i * (cw + 24);
        const y = cy - ch / 2 + arc - lift * 30;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: cw,
              height: ch,
              transform: `perspective(1400px) translateZ(${(1 - p) * -1600 + lift * 80}px) rotateY(${(1 - p) * 60}deg) rotateZ(${rot}deg) translate(${e.dx}px, ${e.dy}px)`,
              clipPath: e.clip,
              opacity: clamp(p * 1.4),
            }}
          >
            <Glass glow={isCur ? t.accent : t.primary} style={{ inset: 0 }}>
              <div style={{ position: "absolute", right: 20, top: 10, fontFamily: t.font.mono, fontWeight: 900, fontSize: 110, color: "transparent", WebkitTextStroke: `1.5px ${alpha(isCur ? t.accent : t.primary, 0.5)}` }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ position: "absolute", left: 32, right: 32, top: 170 }}>
                <div style={{ width: 50 * p, height: 4, background: isCur ? t.accent : t.primary, boxShadow: `0 0 14px ${isCur ? t.accent : t.primary}` }} />
                <div style={{ marginTop: 22, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(c.title, cw - 64, 44), color: t.text, lineHeight: 1.25 }}>{c.title}</div>
                {c.desc && <div style={{ marginTop: 16, fontFamily: t.font.body, fontSize: 24, color: t.dim, lineHeight: 1.5 }}>{c.desc}</div>}
              </div>
            </Glass>
          </div>
        );
      })}
      <Headline kicker={data.kicker ?? `${n} POINTS`} title={data.title} frame={frame} />
    </>
  );
};

export const CardStack: CompDef<D> = {
  id: "cards",
  name: "卡片深空飞入",
  layer: "info",
  variants: 2,
  minSec: 4,
  maxSec: 12,
  tags: ["几个", "三个", "五个", "清单", "列表", "盘点", "推荐", "第一", "第二"],
  motion: { kind: "卡片从深空依次穿入排成一排 + 当前卡片抬起前推", energy: 3 },
  desc: "几张玻璃卡片从深空飞入排成一排（变体 1 扇形），按节奏依次抬起高亮",
  use: "并列的几项（A、B、C），一次性盘点；需要逐条跟读的要点用 bullet-cards",
  schema,
  example: { title: "3 个必装 Skill", items: [{ title: "读 PDF", desc: "百页文档一分钟看完" }, { title: "做表格", desc: "自然语言出报表" }, { title: "写 PPT", desc: "大纲直接成片" }] },
  C,
};
