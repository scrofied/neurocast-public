import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { hitShake, Mark } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const row = z.object({
  name: z.string().describe("候选项：某工具 / 某方案 / 某个人"),
  marks: z.array(z.union([z.boolean(), z.null()])).describe("对每一条标准的判定：true ✓ / false ✗ / null ? 未知"),
  note: z.string().optional().describe("这一行的小注，如“只有它是免费的”"),
  at: z.number().optional(),
});

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  cols: z.array(z.string()).min(2).max(4).describe("用来筛的标准（表头）：免费 / 中文 / 能接你的活"),
  rows: z.array(row).min(2).max(5),
  eliminate: z.boolean().optional().describe("不合格的行当场灰掉塌出画面（默认 true）"),
  winner: z.number().optional().describe("胜出行序号（0 开始）；没给 = 全中的那行自动胜出"),
  verdict: z.string().optional().describe("胜出行的结论条，如“就它了”"),
  verdictAt: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;
  const nRow = data.rows.length;
  const nCol = data.cols.length;
  const colW = full ? W * 0.21 : W * 0.24;
  const rowH = full ? Math.min(120, (H * 0.5) / nRow) : 62;
  const nameW = full ? W * 0.24 : W * 0.3;
  const left = full ? W * 0.09 : W * 0.04;
  const top = full ? H * 0.26 : H * 0.13;
  const tableW = nameW + colW * nCol;
  const colCues = data.cols.map((_, i) => cueOr(undefined, 8 + i * 10));
  const rowCues = data.rows.map((r, i) => Math.max(8, cueOr(r.at, 20 + colCues[nCol - 1] + i * 16)));
  // winner: explicit, else the first row with no false
  const scores = data.rows.map((r) => r.marks.filter((m) => m === true).length - r.marks.filter((m) => m === false).length * 2);
  const winner = data.winner ?? scores.indexOf(Math.max(...scores));
  const cellCue = (ri: number, ci: number) => rowCues[ri] + 6 + ci * 8;
  const allCells = nRow * nCol;
  const lastCell = rowCues[nRow - 1] + 6 + (nCol - 1) * 8;
  const verdictAt = cueOr(data.verdictAt, lastCell + 26);
  // 结论条原生是从左侧推入并淡入（easeOut）：用 slide-l + dist 复原原生 40px 位移，保基线
  const eVerdict = enterAt(frame, verdictAt, { fallback: "slide-l", dur: 12, dist: 40 / 240 });
  const winRowAt = lastCell + 10;
  const sh = hitShake(frame, [verdictAt], full ? 8 : 4, 10, seed);
  const elim = data.eliminate !== false;
  const scale = full ? 1 : 0.62;
  const tableH = rowH * nRow;

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* header: each criterion is typed in as it is spoken */}
        {data.cols.map((c, i) => {
          const p = enterAt(frame, colCues[i], { fallback: "rise", dur: 12 }).p;
          if (frame < colCues[i]) return null;
          return (
            <div key={i} style={{ position: "absolute", left: left + nameW + i * colW, top: top - (full ? 62 : 34), width: colW, textAlign: "center", transform: `scale(${p})`, fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(c, colW - 16, full ? 32 : 18, 12), color: t.primary, whiteSpace: "nowrap", textShadow: `0 0 16px ${alpha(t.primary, 0.6)}` }}>
              {c}
            </div>
          );
        })}
        {/* header underline */}
        <div style={{ position: "absolute", left, top: top - (full ? 22 : 12), width: tableW * easeOut(prog(frame, 4, 14)), height: 3, background: alpha(t.primary, 0.6) }} />
        {data.rows.map((r, ri) => {
          const rc = rowCues[ri];
          if (frame < rc) return null;
          const inP = enterAt(frame, rc, { fallback: "slide-r", dur: 12 });
          const dead = elim && r.marks.some((m) => m === false);
          const deadK = dead ? easeIn(prog(frame, lastCell + 6 + ri * 4, 16)) : 0;
          const isWin = ri === winner && !dead;
          const winK = isWin ? easeOut(prog(frame, winRowAt, 14)) : 0;
          const y = top + ri * rowH;
          const drop = deadK * (full ? 260 : 130);
          const fs = fitFont(r.name, nameW - 24, full ? 34 : 19, 12);
          return (
            <div key={ri} style={{ position: "absolute", left, top: y + drop, width: tableW, height: rowH, opacity: (1 - deadK * 0.75) * inP.p, transform: `translateY(${(1 - inP.p) * 26}px) scale(${1 + winK * 0.03})`, filter: dead ? `grayscale(${deadK})` : undefined }}>
              {/* row plate */}
              <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: isWin ? alpha(t.gold, 0.1 + 0.12 * winK) : alpha(t.text, 0.045), border: `2px solid ${isWin ? t.gold : alpha(t.text, 0.14)}`, boxShadow: isWin ? `0 0 ${26 + 26 * winK}px ${alpha(t.gold, 0.45)}` : undefined }} />
              {/* name */}
              <div style={{ position: "absolute", left: 0, top: 0, width: nameW, height: rowH, display: "flex", alignItems: "center", paddingLeft: full ? 22 : 10, gap: full ? 12 : 6 }}>
                <span style={{ fontFamily: t.font.mono, fontWeight: 900, fontSize: full ? 20 : 12, color: isWin ? t.gold : t.dim }}>{String(ri + 1).padStart(2, "0")}</span>
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fs, color: isWin ? t.gold : t.text, whiteSpace: "nowrap", textDecoration: dead && deadK > 0.6 ? "line-through" : undefined }}>{r.name}</span>
              </div>
              {/* cells */}
              {r.marks.map((m, ci) => {
                const cx = left + nameW + ci * colW + colW / 2;
                const cc = cellCue(ri, ci);
                const on = frame >= cc;
                return (
                  <React.Fragment key={ci}>
                    {on && deadK < 0.9 && <Mark frame={frame} at={cc} ok={m} x={cx} y={y + drop + rowH / 2} size={full ? 46 : 26} />}
                  </React.Fragment>
                );
              })}
              {/* note after all cells */}
              {r.note && (
                <div style={{ position: "absolute", left: 0, top: rowH + (full ? 2 : 0), width: tableW, fontFamily: t.font.body, fontWeight: 700, fontSize: full ? 20 : 12, color: dead ? t.dim : isWin ? t.gold : t.dim, whiteSpace: "nowrap", opacity: enterAt(frame, cellCue(ri, nCol - 1) + 6, { fallback: "slide-r", dur: 10 }).p }}>{r.note}</div>
              )}
            </div>
          );
        })}
        {data.verdict && frame >= verdictAt && full && (
          <div style={{ position: "absolute", left, top: top + nRow * rowH + (full ? 46 : 22), opacity: eVerdict.p, transform: `translateX(${eVerdict.dx}px)`, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 46 : 24, color: t.gold, whiteSpace: "nowrap", textShadow: `0 0 22px ${alpha(t.gold, 0.6)}, 0 3px 0 #000` }}>{data.verdict}</span>
            <span style={{ fontFamily: t.font.body, fontWeight: 800, fontSize: full ? 26 : 14, color: t.text, whiteSpace: "nowrap" }}>← {data.rows[winner]?.name}</span>
          </div>
        )}
      </div>
      {colCues.map((c, i) => (
        <Sfx key={`c${i}`} name="click" at={c} volume={0.28} />
      ))}
      {data.rows.map((_, ri) => data.rows[ri].marks.map((__, ci) => <Sfx key={`m${ri}-${ci}`} name={data.rows[ri].marks[ci] === false ? "tick" : "pop"} at={cellCue(ri, ci)} volume={0.18} />))}
      <Sfx name="sparkle" at={winRowAt} volume={0.3} />
      {data.verdict && <Sfx name="ding" at={verdictAt} volume={0.35} />}
    </>
  );
};

export const SpecMatrix: CompDef<D> = {
  id: "spec-matrix",
  name: "横评打勾表（多候选择一）",
  layer: "info",
  variants: 1,
  minSec: 3,
  maxSec: 10,
  tags: ["对比", "筛选", "条件", "比价", "横评", "淘汰"],
  motion: { kind: "标准逐列打出 → 候选逐行滑入 → 逐格打勾打叉 → 不合格行灰掉塌出画面", energy: 2 },
  desc: "表头按配音逐条打出标准，候选一行行滑进来被逐格打勾（✓）/打叉（✗）/存疑（?）；打叉的行当场变灰划线、坠出画面；剩下的胜出行镀金放大，底部给出结论",
  use: "多候选项按多条标准筛：三条件选工具、几分钟出一份比价表、五个人谁适合、方案 A/B/C 逐条对",
  panel: true,
  schema,
  example: { cols: ["免费", "中文", "能接你的活"], rows: [{ name: "国外大牌", marks: [false, true, true], note: "按次收费" }, { name: "国产小工具", marks: [true, true, false], note: "功能太浅" }, { name: "这套流程", marks: [true, true, true], note: "自己搭，最省" }], verdict: "就它了" },
  C,
};
