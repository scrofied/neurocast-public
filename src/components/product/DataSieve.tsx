import React, { useMemo } from "react";
import { z } from "zod";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, prog, rng } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues, typed } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading, textEm } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const chip = z.object({ text: z.string(), kind: z.enum(["noise", "real"]).describe("noise=打哈哈/表情包/玩梗，real=真实提问"), bin: z.number().int().optional().describe("real 归到第几类（0 起）") });
const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  pool: z.string().default("评论池"),
  chips: z.array(chip).min(4).max(24),
  bins: z.array(z.string()).min(1).max(4).default(["卡点 A", "卡点 B", "卡点 C"]).describe("归类的类别名"),
  commands: z.array(z.object({ text: z.string(), at: z.number().optional() })).max(4).default([]).describe("右侧“死命令”，每条在说到时打出"),
  dumpAt: z.number().optional().describe("评论倒进来的时刻（锚点，如“全甩进去”）"),
  purgeAt: z.number().optional().describe("噪音被剔除的时刻（缺省=第 1 条命令后）"),
  sortAt: z.number().optional().describe("真实提问归类的时刻（缺省=第 2 条命令后）"),
  pickAt: z.number().optional().describe("每类选出 TOP 的时刻（缺省=第 3 条命令后）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const cmds = data.commands;
  const hasCmd = cmds.length > 0;
  const cCues = listCues(cmds, cueOr(data.dumpAt, 6) + 30, Math.max(60, dur * 0.72));
  const dumpAt = cueOr(data.dumpAt, 6);
  const purgeAt = cueOr(data.purgeAt, (cCues[0] ?? dumpAt + 40) + 16);
  const sortAt = cueOr(data.sortAt, (cCues[1] ?? purgeAt + 40) + 14);
  const pickAt = cueOr(data.pickAt, (cCues[2] ?? sortAt + 40) + 14);
  const px = hasCmd ? 110 : 360;
  const py = 210;
  const pw = hasCmd ? 960 : 1200;
  const ph = 660;
  const bins = data.bins;
  const nb = bins.length;
  const binW = (pw - 60 - (nb - 1) * 20) / nb;
  const binTop = py + ph - 250;
  const layout = useMemo(() => {
    const r = rng(seed + 17);
    let realK = 0;
    const counts = new Array(nb).fill(0);
    return data.chips.map((c, i) => {
      const w = Math.min(pw * 0.45, textEm(c.text) * 28 + 44);
      const cols = 3;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const hx = px + 40 + col * ((pw - 80) / cols) + r() * ((pw - 80) / cols - w);
      const hy = py + 90 + row * 58 + r() * 20;
      const bin = c.kind === "real" ? (c.bin ?? realK++ % nb) : -1;
      const slot = bin >= 0 ? counts[bin]++ : -1;
      return { w, hx, hy, rot: (r() - 0.5) * 34, bin, slot, delay: r() * 16 };
    });
  }, [data.chips, seed, nb, px, pw, py]);
  const purged = data.chips.filter((c) => c.kind === "noise").length;
  // 面板/分类槽/命令面板：pass2 接上入场位移（dx/dy）；rise 下仅 22px 上浮，分镜写 slide 才真的推入。chips 自身轨迹（fall/q/drop）保持原样
  const ePool = enterAt(frame, 0, { fallback: "rise", dur: 12 });
  const eBin = enterAt(frame, sortAt - 6, { fallback: "rise", dur: 12 });
  const eCmd = enterAt(frame, (cCues[0] ?? 0) - 10, { fallback: "rise", dur: 12 });
  return (
    <>
      <Heading kicker={data.kicker ?? "DATA CLEANING"} title={data.title} frame={frame} width={width} />
      {/* pool */}
      <div style={{ position: "absolute", left: px, top: py, width: pw, height: ph, borderRadius: 26, background: `linear-gradient(170deg, ${alpha(t.bg2, 0.9)}, ${alpha(t.bg, 0.85)})`, border: `1.5px solid ${alpha(t.primary, 0.35)}`, boxShadow: `inset 0 0 60px ${alpha(t.primary, 0.06)}`, transform: `translate(${ePool.dx}px, ${ePool.dy}px)`, opacity: ePool.opacity }}>
        <div style={{ position: "absolute", left: 28, top: 20, display: "flex", alignItems: "center", gap: 12, fontFamily: t.font.body, fontWeight: 800, fontSize: 28, color: t.text }}>
          <Icon name="chat" size={28} color={t.primary} />
          {data.pool}
          {frame >= purgeAt + 10 && <span style={{ marginLeft: 10, padding: "2px 12px", borderRadius: 8, background: alpha(t.bad, 0.2), color: t.bad, fontSize: 22 }}>{`已剔除 ${purged} 条噪音`}</span>}
        </div>
        {frame >= sortAt - 6 &&
          bins.map((b, i) => (
            <div key={i} style={{ position: "absolute", left: 30 + i * (binW + 20), top: binTop - py, width: binW, height: 230, borderRadius: 18, border: `2px dashed ${alpha(t.primary, 0.45)}`, background: alpha(t.primary, 0.05), transform: `translate(${eBin.dx}px, ${eBin.dy}px)`, opacity: eBin.opacity }}>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 12, textAlign: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(b, binW - 30, 30, 18), color: t.primary }}>{b}</div>
            </div>
          ))}
      </div>
      {/* chips */}
      {data.chips.map((c, i) => {
        const L = layout[i];
        const land = dumpAt + L.delay;
        if (frame < land - 12) return null;
        const fall = easeOutBack(prog(frame, land - 12, 14));
        let x = L.hx;
        let y = -80 + (L.hy + 80) * fall;
        let rot = L.rot * fall;
        let op = 1;
        let col = c.kind === "real" ? t.primary : t.dim;
        let strike = 0;
        let gold = 0;
        if (c.kind === "noise" && frame >= purgeAt) {
          strike = easeOut(prog(frame, purgeAt + (i % 5) * 2, 8));
          const drop = easeIn(prog(frame, purgeAt + 10 + (i % 5) * 2, 18));
          y = L.hy + drop * (py + ph + 120 - L.hy);
          op = 1 - drop;
          col = t.bad;
        }
        if (c.kind === "real" && frame >= sortAt) {
          const q = easeInOut(prog(frame, sortAt + L.slot * 3, 18));
          const tx = px + 30 + L.bin * (binW + 20) + (binW - L.w) / 2;
          const ty = binTop + 14 + L.slot * 52;
          x = L.hx + (tx - L.hx) * q;
          y = L.hy + (ty - L.hy) * q;
          rot = L.rot * (1 - q);
          if (frame >= pickAt) {
            gold = L.slot === 0 ? easeOut(prog(frame, pickAt + L.bin * 4, 12)) : 0;
            op = L.slot === 0 ? 1 : 0.45;
          }
        }
        if (op <= 0.01) return null;
        const cc = gold > 0 ? t.gold : col;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: L.w, height: 46, borderRadius: 23, transform: `rotate(${rot}deg) scale(${1 + gold * 0.08})`, opacity: op, background: alpha(cc, gold ? 0.3 : 0.14), border: `2px solid ${alpha(cc, 0.8)}`, boxShadow: gold ? `0 0 26px ${alpha(t.gold, 0.7)}` : undefined, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.body, fontWeight: 700, fontSize: 26, color: gold ? t.gold : c.kind === "real" ? t.text : alpha(t.text, 0.7), whiteSpace: "nowrap" }}>
            {c.text}
            {strike > 0 && <div style={{ position: "absolute", left: 12, top: "50%", height: 3, width: `${strike * (L.w - 24)}px`, background: t.bad }} />}
            {gold > 0 && <div style={{ position: "absolute", right: -14, top: -16, padding: "2px 8px", borderRadius: 8, background: t.gold, color: t.bg, fontFamily: t.font.mono, fontWeight: 900, fontSize: 16, opacity: gold }}>TOP</div>}
          </div>
        );
      })}
      {/* command panel */}
      {hasCmd && (
        <div style={{ position: "absolute", left: px + pw + 50, top: py, width: width - (px + pw + 50) - 110, height: ph, borderRadius: 26, background: alpha(t.bg, 0.8), border: `1.5px solid ${alpha(t.accent, 0.45)}`, padding: "26px 30px", transform: `translate(${eCmd.dx}px, ${eCmd.dy}px)`, opacity: eCmd.opacity }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: t.font.mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: t.accent }}>
            <Icon name="terminal" size={26} color={t.accent} />
            死命令
          </div>
          {cmds.map((c, i) => {
            const at = cCues[i];
            if (frame < at) return null;
            const cur = i === cCues.reduce((k, v, j) => (frame >= v ? j : k), 0);
            return (
              <div key={i} style={{ marginTop: 30, display: "flex", gap: 16, alignItems: "flex-start", opacity: cur ? 1 : 0.6 }}>
                <span style={{ flex: "none", width: 40, height: 40, borderRadius: 20, background: cur ? t.accent : alpha(t.accent, 0.3), color: t.bg, fontFamily: t.font.mono, fontWeight: 900, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: 32, lineHeight: 1.4, color: t.text }}>{typed(c.text, frame, at, at + 16)}</span>
                <Sfx name="typing" at={at} volume={0.2} />
              </div>
            );
          })}
        </div>
      )}
      <Sfx name="bubbles" at={dumpAt} volume={0.25} />
      <Sfx name="swish" at={purgeAt + 10} volume={0.35} />
      <Sfx name="whoosh" at={sortAt} volume={0.2} />
      <Sfx name="sparkle" at={pickAt} volume={0.3} />
    </>
  );
};

export const DataSieve: CompDef<D> = {
  id: "data-sieve",
  name: "数据清洗筛（去噪→归类→挑 TOP）",
  layer: "product",
  variants: 1,
  minSec: 4,
  maxSec: 16,
  tags: ["清洗", "去重", "剔掉", "归类", "筛选", "整理"],
  motion: { kind: "标签雨砸进池子、噪音被划掉坠出、真实提问滑进分类槽、TOP 发金光", energy: 3 },
  desc: "一大坨评论标签砸进“评论池”；噪音（哈哈/表情包/玩梗）被划掉掉出去，真实提问飞进分类槽，每类第一名发金光打 TOP；右侧同步打出分条“死命令”",
  use: "把一堆杂乱的东西去噪、归类、挑出最好的：清洗评论、筛简历、整理笔记、分拣客户线索（pool / chips / bins 全可改）",
  schema,
  example: {
    chips: [
      { text: "哈哈哈哈哈", kind: "noise" },
      { text: "新手怎么起号？", kind: "real", bin: 0 },
      { text: "[捂脸][捂脸]", kind: "noise" },
      { text: "发了没流量", kind: "real", bin: 1 },
      { text: "笑死我了", kind: "noise" },
      { text: "剪辑太慢", kind: "real", bin: 2 },
      { text: "绝绝子", kind: "noise" },
      { text: "起号要多久", kind: "real", bin: 0 },
      { text: "666", kind: "noise" },
      { text: "播放卡在 500", kind: "real", bin: 1 },
    ],
    bins: ["起号", "流量", "剪辑"],
    commands: [{ text: "打哈哈/表情包/玩梗 → 全剔掉", at: 40 }, { text: "真实提问 → 按卡点归类", at: 90 }, { text: "告诉我 TOP 3 卡点", at: 130 }],
    dumpAt: 6,
  },
  C,
};
