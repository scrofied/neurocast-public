import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, easeOut, easeOutBack, prog, rng } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, fmtNum, Heading } from "../../lib/ui";
import { useEnter } from "../../lib/enter";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  board: z.string().default("痛点排行榜").describe("榜单名"),
  items: z.array(z.object({ label: z.string(), value: z.number(), unit: z.string().optional(), note: z.string().optional(), at: z.number().optional() })).min(2).max(5),
  timer: z.string().optional().describe("右上角用时徽章，如“30 秒”"),
  timerAt: z.number().optional(),
  sift: z.boolean().default(true).describe("背景：沙子下沉、金粒上浮"),
  siftAt: z.number().optional().describe("淘金效果时刻（锚点，如“沙子沉下去”）"),
});
type D = z.infer<typeof schema>;

const MEDAL = ["#ffcf5c", "#cfd8e6", "#e0a070"];

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const items = data.items;
  const n = items.length;
  const cues = listCues(items, 14, Math.min(60, dur * 0.4));
  const max = Math.max(...items.map((x) => x.value));
  const bx = 330;
  const by = 220;
  const bw = width - 660;
  const rowH = Math.min(150, 560 / n);
  const siftAt = cueOr(data.siftAt, dur * 0.6);
  const timerAt = cueOr(data.timerAt, 6);
  const grains = useMemo(() => {
    const r = rng(seed + 41);
    return new Array(160).fill(0).map(() => ({ x: r() * width, y: r() * height, gold: r() < 0.28, v: 1 + r() * 3, s: 1.5 + r() * 3 }));
  }, [seed, width, height]);
  const sp = clamp((frame - siftAt) / 40);
  // 榜单主体原生是 0.9→1 回弹淡入（rise 的基线），位移交给动效层
  const eBoard = enterAt(frame, 0, { fallback: "rise", dur: 20 });
  // 右上角用时徽章原生是从 0 回弹弹出
  const eTimer = enterAt(frame, timerAt, { fallback: "rise", dur: 14, from: 0 });
  return (
    <>
      {data.sift && frame >= siftAt - 5 && (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {grains.map((g, i) => {
            const k = frame - siftAt;
            const y = g.gold ? g.y - k * g.v * 1.2 : g.y + k * g.v * 2.2;
            const yy = ((y % height) + height) % height;
            const tx = g.gold ? g.x + (width / 2 - g.x) * clamp(k / 70) * 0.35 : g.x;
            return <circle key={i} cx={tx} cy={yy} r={g.gold ? g.s * 1.3 : g.s} fill={g.gold ? t.gold : alpha(t.dim, 0.7)} opacity={(g.gold ? 0.9 : 0.5) * clamp(k / 10) * (g.gold ? 1 : 1 - sp * 0.6)} />;
          })}
        </svg>
      )}
      <Heading kicker={data.kicker ?? "RANKING"} title={data.title} frame={frame} width={width} />
      <div style={{ position: "absolute", left: bx, top: by, width: bw, height: Math.min(height - by - 150, 150 + n * (rowH + 10)), borderRadius: 30, background: `linear-gradient(170deg, ${alpha(t.bg2, 0.95)}, ${alpha(t.bg, 0.9)})`, border: `2px solid ${alpha(t.gold, 0.45)}`, boxShadow: `0 0 70px ${alpha(t.gold, 0.18)}`, transform: `translate(${eBoard.dx}px, ${eBoard.dy}px) scale(${eBoard.scale})`, opacity: eBoard.opacity, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "30px 44px 10px" }}>
          <Icon name="award" size={46} color={t.gold} stroke={2.2} />
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 50, color: t.text }}>{data.board}</span>
          <span style={{ fontFamily: t.font.mono, fontSize: 24, letterSpacing: 4, color: t.gold }}>{`TOP ${n}`}</span>
        </div>
        {items.map((it, i) => {
          const at = cues[i];
          if (frame < at) return null;
          // 行原生是从左侧 80px 推进来（slide-l，dist 换算成同样的距离）
          const eRow = enterAt(frame, at, { fallback: "slide-l", dur: 16, dist: 0.33, seed: i });
          const bar = easeOut(prog(frame, at + 4, 24));
          const top1 = i === 0;
          const shine = top1 && frame > siftAt ? ((frame - siftAt) % 50) / 50 : -1;
          const mc = MEDAL[i] ?? t.dim;
          return (
            <div key={i} style={{ position: "absolute", left: 40, right: 40, top: 120 + i * (rowH + 10), height: rowH, borderRadius: 22, background: top1 ? alpha(t.gold, 0.08 + (frame > siftAt ? 0.06 : 0)) : alpha(t.text, 0.03), border: `1.5px solid ${alpha(top1 ? t.gold : t.primary, top1 ? 0.6 : 0.18)}`, transform: `translate(${eRow.dx}px, ${eRow.dy}px)`, opacity: eRow.opacity, overflow: "hidden", display: "flex", alignItems: "center" }}>
              {shine >= 0 && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${shine * 130 - 30}%`, width: "18%", background: `linear-gradient(90deg, transparent, ${alpha("#ffffff", 0.22)}, transparent)`, transform: "skewX(-20deg)" }} />}
              <div style={{ flex: "none", marginLeft: 26, width: rowH * 0.6, height: rowH * 0.6, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, #fff, ${mc} 55%, ${alpha(mc, 0.6)})`, boxShadow: `0 0 24px ${alpha(mc, 0.6)}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.mono, fontWeight: 900, fontSize: rowH * 0.3, color: t.bg }}>{i + 1}</div>
              <div style={{ marginLeft: 26, width: bw * 0.36 }}>
                <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(it.label, bw * 0.34, 46, 24), color: top1 ? t.gold : t.text, whiteSpace: "nowrap" }}>{it.label}</div>
                {it.note && <div style={{ marginTop: 4, fontFamily: t.font.body, fontSize: 24, color: t.dim, whiteSpace: "nowrap" }}>{it.note}</div>}
              </div>
              <div style={{ flex: 1, marginRight: 30, height: 26, borderRadius: 13, background: alpha(t.primary, 0.1), position: "relative" }}>
                <div style={{ width: `${(it.value / max) * 100 * bar}%`, height: "100%", borderRadius: 13, background: top1 ? `linear-gradient(90deg, ${alpha(t.gold, 0.6)}, ${t.gold})` : `linear-gradient(90deg, ${alpha(t.primary, 0.5)}, ${t.primary})`, boxShadow: `0 0 16px ${alpha(top1 ? t.gold : t.primary, 0.6)}` }} />
              </div>
              <div style={{ flex: "none", width: 230, marginRight: 30, textAlign: "right", fontFamily: t.font.title, fontWeight: 900, fontSize: 42, color: t.text }}>
                {fmtNum(it.value * bar, 0)}
                <span style={{ fontFamily: t.font.body, fontSize: 22, color: t.dim, marginLeft: 6 }}>{it.unit ?? ""}</span>
              </div>
              <Sfx name="pop" at={at} volume={0.3} />
            </div>
          );
        })}
      </div>
      {data.timer && frame >= timerAt && (
        <div style={{ position: "absolute", right: bx - 40, top: by - 40, transform: `translate(${eTimer.dx}px, ${eTimer.dy}px) scale(${eTimer.scale})`, opacity: eTimer.opacity, padding: "12px 24px", borderRadius: 99, background: alpha(t.bg, 0.9), border: `2px solid ${t.primary}`, boxShadow: `0 0 26px ${alpha(t.primary, 0.5)}`, display: "flex", alignItems: "center", gap: 10, fontFamily: t.font.title, fontWeight: 900, fontSize: 34, color: t.primary }}>
          <Icon name="clock" size={32} color={t.primary} />
          {data.timer}
        </div>
      )}
      {data.sift && <Sfx name="sparkle" at={siftAt} volume={0.35} />}
      {data.sift && <Sfx name="success" at={siftAt + 20} volume={0.25} />}
    </>
  );
};

export const Leaderboard: CompDef<D> = {
  id: "leaderboard",
  name: "排行榜（淘金效果）",
  layer: "info",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["排行", "排行榜", "TOP", "前三", "最多", "痛点"],
  motion: { kind: "金边榜单回弹入画，条目逐条从左侧滑入 + 进度条数字滚动，叠加淘金粒子", energy: 2 },
  desc: "金边榜单：金/银/铜奖牌、名称、进度条和数字依次滚出；可叠加淘金背景（灰沙下沉、金粒上浮），第一名周期性扫光",
  use: "排名/榜单/最多最高的几项；“一张干干净净的痛点排行榜”“沙子沉下去，金子露出来”",
  schema,
  example: {
    board: "痛点排行榜",
    items: [
      { label: "发了没流量", value: 1286, unit: "次抱怨", note: "点赞 3.2w" },
      { label: "新手不会起号", value: 954, unit: "次抱怨", note: "点赞 2.1w" },
      { label: "剪辑太耗时间", value: 731, unit: "次抱怨", note: "点赞 1.6w" },
    ],
    timer: "30 秒",
    siftAt: 90,
  },
  C,
};
