import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, listCues, typed } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  folder: z.string().default("卡片转场-竖屏9比16-30秒-科技风").describe("归档完成后打出的文件夹名"),
  library: z.string().default("动效资产库").describe("文件管理器窗口标题"),
  items: z
    .array(z.object({ name: z.string(), icon: z.enum(["film", "terminal", "image", "doc", "video", "save", "box", "grid"]).default("doc"), at: z.number().optional() }))
    .min(1)
    .max(6)
    .default([
      { name: "预览视频", icon: "film" },
      { name: "可运行代码", icon: "terminal" },
      { name: "关键帧截图", icon: "image" },
      { name: "动效说明", icon: "doc" },
    ])
    .describe("要归档的几样东西（每件可卡自己的锚点）"),
  vars: z.array(z.string()).default(["文案", "Logo", "颜色", "图片", "音效"]).describe("右侧单独抽出的变量/素材"),
  varsTitle: z.string().default("文案 · Logo · 颜色 → 变量/素材文件夹").describe("变量区标题"),
  createAt: z.number().optional().describe("建文件夹的时刻（锚点，如“建立一个文件夹”）"),
  nameAt: z.number().optional().describe("开始打文件夹名的时刻（锚点，如“命名”）"),
  varsAt: z.number().optional().describe("变量抽出的时刻（锚点，如“单独”）"),
  noteAt: z.number().optional().describe("结论徽章弹出的时刻（锚点）"),
  note: z.string().default("下次直接调用 · 不花高价从零生成").describe("底部结论徽章"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width } = useBox();
  const createAt = cueOr(d.createAt, 10);
  const cues = listCues(d.items, createAt + 16, Math.max(createAt + 16 + d.items.length * 8, dur * 0.42));
  const nameAt = cueOr(d.nameAt, cues[cues.length - 1] + 20);
  const varsAt = cueOr(d.varsAt, nameAt + 26);
  const noteAt = cueOr(d.noteAt, varsAt + d.vars.length * 6 + 14);

  // 文件管理器窗口 + 文件夹
  const wx = 780;
  const wy = 210;
  const ww = 820;
  const wh = 560;
  // 窗口/文件夹原生是 easeOutBack 回弹入画，rise 与之等价；分镜写 motion.enter 才换
  const eWin = enterAt(frame, createAt, { fallback: "rise", dur: 16, from: 0.9 });
  const eFolder = enterAt(frame, createAt + 6, { fallback: "rise", dur: 12, from: 0.7 });
  const eScatter = enterAt(frame, 6, { fallback: "rise", dur: 10 });
  const eVarsTitle = enterAt(frame, varsAt, { fallback: "rise", dur: 10 });
  const eNote = enterAt(frame, noteAt, { fallback: "rise", dur: 12, from: 0 });
  const named = frame >= nameAt;
  const shownName = named ? (typed(d.folder, frame, nameAt, nameAt + 46) || "…") : "新建文件夹";
  const landed = d.items.filter((_, i) => frame >= cues[i] + 14).length;

  // 左侧散落的素材卡
  const spots = [
    { x: 70, y: 300 },
    { x: 250, y: 470 },
    { x: 90, y: 640 },
    { x: 300, y: 760 },
    { x: 70, y: 870 },
    { x: 280, y: 960 },
  ];
  const fx = wx + 130;
  const fy = wy + 200;

  return (
    <>
      <Heading kicker={d.kicker} title={d.title ?? "别只保存成片"} frame={frame} width={width} />

      {/* 散落的产出物 */}
      {d.items.map((it, i) => {
        const from = spots[i % spots.length];
        const p = easeInOut(prog(frame, cues[i], 14));
        if (p >= 1) return null;
        const gone = prog(frame, cues[i] + 12, 6);
        return (
          <div
            key={it.name}
            style={{
              position: "absolute",
              left: from.x + (fx - from.x) * p,
              top: from.y + (fy - from.y) * p - Math.sin(Math.PI * p) * 90,
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 26px",
              borderRadius: 16,
              background: t.bg2,
              border: `3px solid ${alpha(t.primary, 0.7)}`,
              boxShadow: `0 16px 40px rgba(0,0,0,.5)`,
              transform: `scale(${1 - 0.45 * p})`,
              opacity: (1 - gone) * eScatter.opacity,
            }}
          >
            <Icon name={it.icon} size={44} color={t.accent} />
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 36, color: t.text, whiteSpace: "nowrap" }}>{it.name}</span>
          </div>
        );
      })}

      {/* 文件管理器窗口 */}
      <div style={{ position: "absolute", left: wx, top: wy, width: ww, height: wh, borderRadius: 18, overflow: "hidden", background: "#f4f6f9", boxShadow: `0 0 0 2px ${alpha(t.primary, 0.45)}, 0 30px 80px rgba(0,0,0,.6)`, transform: `scale(${eWin.scale}) translate(${eWin.dx}px, ${eWin.dy}px)`, clipPath: eWin.clip, opacity: clamp(eWin.p * 1.6) }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", background: "#e3e7ee", fontFamily: t.font.body, fontSize: 24, color: "#333" }}>
          <Icon name="box" size={26} color="#4a6fa5" />
          {d.library}
          <span style={{ marginLeft: "auto", fontFamily: t.font.mono, fontSize: 20, color: "#8a97a8" }}>{landed > 0 ? `${landed} 个项目` : ""}</span>
        </div>
        {/* 文件夹 */}
        <div style={{ position: "absolute", left: 100, top: 160, textAlign: "center", transform: `scale(${eFolder.scale}) translate(${eFolder.dx}px, ${eFolder.dy}px)`, clipPath: eFolder.clip, opacity: clamp(eFolder.p * 1.5) }}>
          <div style={{ position: "relative", width: 210, height: 180, margin: "0 auto" }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 110, height: 34, background: named ? t.gold : "#e8b64c", borderRadius: "14px 18px 0 0" }} />
            <div style={{ position: "absolute", inset: "28px 0 0 0", borderRadius: 16, background: named ? `linear-gradient(160deg, ${t.gold}, ${t.accent})` : "#f2c66d", boxShadow: "0 12px 30px rgba(0,0,0,.35)", border: "3px solid rgba(0,0,0,.35)" }} />
            {landed > 0 && (
              <div style={{ position: "absolute", right: -14, top: -14, width: 58, height: 58, borderRadius: 29, background: t.primary, border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.font.title, fontWeight: 900, fontSize: 30, color: t.bg, transform: `scale(${easeOutBack(prog(frame, cues[landed - 1] + 10, 8))})` }}>
                {landed}
              </div>
            )}
          </div>
          <div style={{ marginTop: 26, display: "inline-block", padding: "6px 16px", borderRadius: 10, background: named && frame < nameAt + 46 ? alpha(t.primary, 0.22) : "transparent", fontFamily: named ? t.font.mono : t.font.body, fontWeight: 700, fontSize: fitFont(d.folder, 560, 34, 20), color: named ? "#1c2430" : "#5a6b80", whiteSpace: "nowrap", boxShadow: named ? `0 0 0 2px ${alpha(t.primary, 0.6)}` : "none" }}>
            {shownName}
            {named && frame < nameAt + 46 && <span style={{ color: t.primary, opacity: Math.floor(frame / 8) % 2 ? 1 : 0 }}>▍</span>}
          </div>
        </div>
        {/* 已归档清单 */}
        <div style={{ position: "absolute", left: 400, top: 120, width: 360 }}>
          {d.items.map((it, i) => (
            <div key={it.name} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, opacity: frame >= cues[i] + 14 ? 1 : 0, transform: `translateX(${frame >= cues[i] + 14 ? 0 : 30}px)`, transition: "none" }}>
              <Icon name="check" size={30} color={t.primary} />
              <Icon name={it.icon} size={30} color="#5a6b80" />
              <span style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 28, color: "#2b3646", whiteSpace: "nowrap" }}>{it.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：变量 / 素材单独抽出 */}
      {frame >= varsAt - 4 && (
        <div style={{ position: "absolute", left: 70, top: 300, width: 620 }}>
          <div style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 36, color: t.text, whiteSpace: "nowrap", marginBottom: 22, transform: `translate(${eVarsTitle.dx}px, ${eVarsTitle.dy}px)`, clipPath: eVarsTitle.clip, opacity: eVarsTitle.opacity }}>{d.varsTitle}</div>
          {d.vars.map((v, i) => {
            const at = varsAt + 6 + i * 6;
            const eVar = enterAt(frame, at, { fallback: "rise", dur: 10, from: 0.6 });
            return (
              <div key={v} style={{ display: "inline-flex", alignItems: "center", gap: 10, marginRight: 16, marginBottom: 14, padding: "12px 24px", borderRadius: 30, background: alpha(t.glass, 0.9), border: `3px solid ${alpha(t.accent, 0.8)}`, fontFamily: t.font.mono, fontWeight: 700, fontSize: 32, color: t.accent, opacity: frame >= at ? 1 : 0, transform: `scale(${eVar.scale}) translate(${eVar.dx}px, ${eVar.dy}px)`, clipPath: eVar.clip }}>
                <Icon name="hash" size={26} color={t.accent} />
                {v}
              </div>
            );
          })}
        </div>
      )}

      {/* 结论徽章 */}
      {frame >= noteAt && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 830, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "16px 40px", borderRadius: 40, background: alpha(t.bg, 0.85), border: `4px solid ${t.accent}`, transform: `scale(${eNote.scale}) translate(${eNote.dx}px, ${eNote.dy}px)`, clipPath: eNote.clip, boxShadow: `0 0 40px ${alpha(t.accent, 0.45)}` }}>
            <Icon name="save" size={40} color={t.accent} />
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 42, color: t.accent, whiteSpace: "nowrap" }}>{d.note}</span>
          </div>
        </div>
      )}

      <Sfx name="pop" at={createAt} volume={0.35} />
      {cues.map((c, i) => (
        <Sfx key={i} name="tick" at={c + 12} volume={0.3} />
      ))}
      <Sfx name="typing" at={nameAt} volume={0.25} />
      <Sfx name="ding" at={nameAt + 46} volume={0.35} />
      {d.vars.map((_, i) => (
        <Sfx key={i} name="click" at={varsAt + 6 + i * 6} volume={0.22} />
      ))}
      <Sfx name="sparkle" at={noteAt + 8} volume={0.3} />
    </>
  );
};

export const FolderSave: CompDef<D> = {
  id: "folder-save",
  name: "归档进文件夹（散件 → 命名资产）",
  layer: "product",
  variants: 1,
  minSec: 5,
  maxSec: 14,
  tags: ["文件夹", "归档", "命名", "变量", "素材", "资产库", "保存"],
  motion: { kind: "文件管理器窗口回弹入画、产出物逐件飞入文件夹、变量标签逐个弹出、结论徽章回弹", energy: 2 },
  desc: "左侧散落的产出物（预览视频/代码/截图/说明）逐件飞进右侧文件管理器里新建的文件夹，计数徽章跳动；文件夹名逐字打出规范命名；右侧把文案/Logo/颜色逐颗抽成变量标签；最后弹出结论徽章",
  use: "把一次性的东西归档成可复用资产：动效四件套存文件夹并按规范命名、项目模板抽变量、素材分库存放、把 AI 产出整理成下次能直接用的包（items/vars/folder 全可改）",
  schema,
  example: { createAt: 10, nameAt: 90, varsAt: 120, noteAt: 170 },
  C,
};
