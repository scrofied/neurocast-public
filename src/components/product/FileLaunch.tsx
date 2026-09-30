import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";
import { MiniApp } from "./MiniApp";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  editor: z.string().default("记事本").describe("左边的编辑器窗口名"),
  code: z.array(z.string()).min(1).max(8).default(["<!DOCTYPE html>", "<html>", "<style> …全部样式… </style>", "<body> …界面… </body>", "<script> …全部逻辑… </script>", "</html>"]).describe("贴进去的代码（几行示意即可）"),
  from: z.string().default("小工具.txt").describe("改名前的文件名"),
  to: z.string().default("小工具.html").describe("改名后的文件名"),
  pasteAt: z.number().optional().describe("代码贴进去的时刻（锚点，如“贴进去”）"),
  renameAt: z.number().optional().describe("改后缀的时刻（锚点，如“改成”）"),
  openAt: z.number().optional().describe("双击的时刻（锚点，如“双击”）"),
  appAt: z.number().optional().describe("浏览器弹出成品的时刻（锚点，如“弹出”）"),
  app: z.object({ title: z.string(), url: z.string().optional(), button: z.string().optional(), inputs: z.array(z.string()).max(3).optional() }).default({ title: "表格金额核对", button: "开始比对", inputs: ["表格 A", "表格 B"] }),
  badge: z.string().optional().describe("成品弹出后的徽章，如“零依赖 · 双击即跑”"),
});
type D = z.infer<typeof schema>;

// split "name.ext" so the extension can be swapped on its own
const ext = (s: string) => {
  const i = s.lastIndexOf(".");
  return i > 0 ? [s.slice(0, i), s.slice(i)] : [s, ""];
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur }) => {
  const t = useTheme();
  const { width, height } = useBox();
  const pasteAt = cueOr(data.pasteAt, 12);
  const renameAt = cueOr(data.renameAt, Math.max(pasteAt + 30, dur * 0.35));
  const openAt = cueOr(data.openAt, Math.max(renameAt + 30, dur * 0.6));
  const appAt = cueOr(data.appAt, openAt + 18);
  // notepad
  const nx = 150;
  const ny = 210;
  const nw = 860;
  const nh = 560;
  const win = easeOutBack(prog(frame, 0, 16));
  const app = easeOutBack(prog(frame, appAt, 20));
  const back = easeOut(prog(frame, appAt, 14));
  // desktop file icon
  const fx = 1400;
  const fy = 380;
  const [base, fromExt] = ext(data.from);
  const [, toExt] = ext(data.to);
  const rn = frame >= renameAt;
  const typedExt = Array.from(toExt).slice(0, Math.round(clamp((frame - renameAt - 8) / 12) * Array.from(toExt).length)).join("");
  const isHtml = frame >= renameAt + 20;
  // cursor: travels to the icon, double-clicks at openAt
  const cur = easeInOut(prog(frame, openAt - 16, 14));
  const cx = 1180 + (fx - 1180) * cur;
  const cy = 820 + (fy + 40 - 820) * cur;
  const clicks = [openAt, openAt + 6];
  // browser window zooms out of the icon
  const bw = 1000;
  const bh = 640;
  const bx = (width - bw) / 2;
  const by = 250;
  const ax = fx + (bx + bw / 2 - fx) * app;
  const ay = fy + (by + bh / 2 - fy) * app;
  const lineFs = 30;
  return (
    <>
      <Heading kicker={data.kicker} title={data.title} frame={frame} width={width} />
      {/* notepad */}
      <div style={{ position: "absolute", left: nx, top: ny, width: nw, height: nh, borderRadius: 14, overflow: "hidden", background: "#f4f6f9", boxShadow: `0 0 0 2px ${alpha(t.primary, 0.4)}, 0 30px 70px rgba(0,0,0,.55)`, transform: `scale(${(0.92 + 0.08 * win) * (1 - back * 0.08)})`, opacity: clamp(win * 1.4) * (1 - back * 0.55), filter: back > 0 ? `blur(${back * 3}px)` : undefined }}>
        <div style={{ height: 50, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", background: "#e3e7ee", fontFamily: t.font.body, fontSize: 22, color: "#333" }}>
          <Icon name="doc" size={24} color="#4a6fa5" />
          {`${rn ? data.to : data.from} - ${data.editor}`}
        </div>
        <div style={{ padding: "22px 30px", fontFamily: t.font.mono, fontSize: lineFs, lineHeight: 1.55 }}>
          {frame < pasteAt ? (
            <span style={{ color: "#333", opacity: Math.floor(frame / 8) % 2 ? 1 : 0 }}>▍</span>
          ) : (
            data.code.map((ln, i) => {
              const p = easeOut(prog(frame, pasteAt + i * 2, 8));
              const tag = /^\s*</.test(ln);
              return (
                <div key={i} style={{ opacity: p, transform: `translateX(${(1 - p) * 20}px)`, color: tag ? "#1f5fbf" : "#333", whiteSpace: "nowrap" }}>
                  {ln}
                </div>
              );
            })
          )}
        </div>
        {frame >= pasteAt && frame < pasteAt + 10 && <div style={{ position: "absolute", inset: 0, background: alpha(t.primary, 0.25 * (1 - (frame - pasteAt) / 10)) }} />}
      </div>
      {/* Ctrl+V keycaps */}
      {frame >= pasteAt - 6 && frame < pasteAt + 36 && (
        <div style={{ position: "absolute", left: nx + nw - 300, top: ny + nh + 22, display: "flex", gap: 12, opacity: easeOut(prog(frame, pasteAt - 6, 6)) * (1 - easeOut(prog(frame, pasteAt + 26, 10))) }}>
          {["Ctrl", "V"].map((k, i) => (
            <span key={k} style={{ padding: "10px 22px", borderRadius: 12, background: t.bg2, border: `2px solid ${t.primary}`, fontFamily: t.font.mono, fontWeight: 700, fontSize: 32, color: t.text, transform: `translateY(${frame >= pasteAt && frame < pasteAt + 5 ? 5 : 0}px)`, boxShadow: `0 ${frame >= pasteAt && frame < pasteAt + 5 ? 1 : 6}px 0 ${alpha(t.primary, 0.6)}` }}>
              {i ? k : k}
            </span>
          ))}
        </div>
      )}
      {/* desktop file icon + rename */}
      <div style={{ position: "absolute", left: fx - 100, top: fy - 90, width: 200, textAlign: "center", opacity: easeOut(prog(frame, 6, 12)) * (1 - back) }}>
        <div style={{ width: 150, height: 170, margin: "0 auto", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: isHtml ? `linear-gradient(135deg, ${t.primary}, ${t.secondary})` : "#e9edf3", boxShadow: isHtml ? `0 0 40px ${alpha(t.primary, 0.6)}` : "0 10px 30px rgba(0,0,0,.5)", transform: `scale(${isHtml ? 1 + 0.12 * (1 - easeOut(prog(frame, renameAt + 20, 12))) : 1})` }}>
          <Icon name={isHtml ? "globe" : "doc"} size={90} color={isHtml ? t.bg : "#5a6b80"} stroke={1.8} />
        </div>
        <div style={{ marginTop: 18, display: "inline-flex", alignItems: "baseline", padding: "4px 12px", borderRadius: 8, background: rn && !isHtml ? alpha(t.primary, 0.25) : "transparent", fontFamily: t.font.mono, fontWeight: 700, fontSize: fitFont(data.to, 300, 38, 22), color: t.text, whiteSpace: "nowrap", textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>
          {base}
          {!rn ? (
            <span>{fromExt}</span>
          ) : (
            <>
              {frame < renameAt + 10 && <span style={{ color: t.bad, textDecoration: "line-through" }}>{fromExt}</span>}
              <span style={{ color: t.primary }}>{typedExt}</span>
            </>
          )}
        </div>
      </div>
      {/* cursor */}
      {frame >= openAt - 16 && frame < appAt + 6 && (
        <div style={{ position: "absolute", left: cx, top: cy, opacity: 1 - back }}>
          {clicks.map((c, i) => (frame >= c && frame < c + 12 ? <div key={i} style={{ position: "absolute", left: -30 - (frame - c) * 3, top: -30 - (frame - c) * 3, width: 60 + (frame - c) * 6, height: 60 + (frame - c) * 6, borderRadius: "50%", border: `3px solid ${alpha(t.accent, 1 - (frame - c) / 12)}` }} /> : null))}
          <Icon name="cursor" size={56} color="#fff" fill="#111" stroke={1.6} />
        </div>
      )}
      {/* the finished tool pops out of the icon */}
      {frame >= appAt && (
        <div style={{ position: "absolute", left: ax - bw / 2, top: ay - bh / 2, width: bw, height: bh, transform: `scale(${0.12 + 0.88 * app})`, opacity: clamp(app * 2) }}>
          <MiniApp w={bw} h={bh} frame={frame} app={{ ...data.app, url: data.app.url ?? `file:///桌面/${data.to}` }} workAt={appAt + 22} />
        </div>
      )}
      {data.badge && frame >= appAt + 18 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: by + bh + 20, textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 30px", borderRadius: 30, background: alpha(t.bg, 0.8), border: `2px solid ${t.accent}`, fontFamily: t.font.title, fontWeight: 900, fontSize: 36, color: t.accent, transform: `scale(${easeOutBack(prog(frame, appAt + 18, 12))})`, boxShadow: `0 0 30px ${alpha(t.accent, 0.4)}` }}>
            <Icon name="zap" size={34} color={t.accent} />
            {data.badge}
          </span>
        </div>
      )}
      <Sfx name="click" at={pasteAt} volume={0.4} />
      <Sfx name="pop" at={pasteAt + 2} volume={0.3} />
      <Sfx name="typing" at={renameAt + 6} volume={0.25} />
      <Sfx name="ding" at={renameAt + 20} volume={0.3} />
      <Sfx name="click" at={clicks[0]} volume={0.45} />
      <Sfx name="click" at={clicks[1]} volume={0.45} />
      <Sfx name="whoosh" at={appAt} volume={0.3} />
      <Sfx name="sparkle" at={appAt + 16} volume={0.3} />
    </>
  );
};

export const FileLaunch: CompDef<D> = {
  id: "file-launch",
  name: "代码 → 文件 → 双击运行",
  layer: "product",
  variants: 1,
  minSec: 4,
  maxSec: 12,
  tags: ["记事本", "改后缀", "双击", "HTML", "打开", "运行", "单文件"],
  desc: "编辑器窗口里 Ctrl+V 贴进代码；桌面文件图标的后缀被划掉改写（txt → html），图标变亮；鼠标双击后，成品小工具从图标里放大弹出成浏览器窗口，数据行开始跑",
  use: "把一段东西存成文件就能直接用：AI 写的 HTML 双击即跑、脚本改后缀变可执行、导出的 .csv 双击进表格、配置文件改名生效（code / from / to / app 全可改）",
  schema,
  example: { pasteAt: 10, renameAt: 50, openAt: 100, appAt: 118, badge: "零依赖 · 双击即跑" },
  C,
};
