import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";
import { MiniApp } from "./MiniApp";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  file: z.string().default("小工具.html").describe("被拖进去的文件"),
  host: z.string().default("免费网页托管").describe("托管平台（虚线框上方的名字）"),
  drop: z.string().default("把文件拖到这里").describe("虚线框里的提示"),
  url: z.string().default("https://my-tool.site").describe("吐出来的专属网址"),
  app: z.object({ title: z.string(), url: z.string().optional(), button: z.string().optional(), inputs: z.array(z.string()).max(3).optional() }).default({ title: "表格金额核对", button: "开始比对", inputs: ["表格 A", "表格 B"] }),
  dragAt: z.number().optional().describe("开始拖文件（锚点，如“拖进”）"),
  dropAt: z.number().optional().describe("松手落进虚线框（锚点，如“虚线框”）"),
  doneAt: z.number().optional().describe("进度条走完（锚点，如“走完”）"),
  urlAt: z.number().optional().describe("网址吐出来（锚点，如“专属网址”）"),
  shareAt: z.number().optional().describe("发到群里、手机电脑都能打开（锚点，如“发到群里”）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width } = useBox();
  const dragAt = cueOr(data.dragAt, 12);
  const dropAt = cueOr(data.dropAt, dragAt + 30);
  const doneAt = cueOr(data.doneAt, dropAt + 36);
  const urlAt = cueOr(data.urlAt, doneAt + 10);
  const shareAt = cueOr(data.shareAt, urlAt + 40);
  // after the URL is out, the upload page slides left and the devices come in
  const sh = easeInOut(prog(frame, shareAt, 18));
  const shiftX = -560 * sh;
  // drop zone
  const ZX = 660;
  const ZY = 250;
  const ZW = 820;
  const ZH = 480;
  const eZone = enterAt(frame, 0, { fallback: "rise", dur: 16, from: 0.92 });
  // file travels from the left desktop to the zone centre
  const mv = easeInOut(prog(frame, dragAt, Math.max(8, dropAt - dragAt)));
  const f0 = { x: 170, y: 430 };
  const f1 = { x: ZX + ZW / 2 - 80, y: ZY + ZH / 2 - 110 };
  const fx = f0.x + (f1.x - f0.x) * mv;
  const fy = f0.y + (f1.y - f0.y) * mv - Math.sin(mv * Math.PI) * 80;
  const dropped = frame >= dropAt;
  const hover = frame >= dragAt + 4 && !dropped;
  const up = clamp((frame - dropAt) / Math.max(6, doneAt - dropAt));
  const fileGone = easeOut(prog(frame, dropAt, 10));
  const eUrl = enterAt(frame, urlAt, { fallback: "rise", dur: 14, from: 0 });
  const urlChars = Array.from(data.url);
  const shown = urlChars.slice(0, Math.round(clamp((frame - urlAt) / 16) * urlChars.length)).join("");
  // devices
  const eLap = enterAt(frame, shareAt + 6, { fallback: "rise", dur: 18, from: 0 });
  const ePhone = enterAt(frame, shareAt + 14, { fallback: "rise", dur: 18, from: 0 });
  const eChips = enterAt(frame, shareAt + 30, { fallback: "rise", dur: 12 });
  return (
    <>
      <Heading kicker={data.kicker ?? "DEPLOY"} title={data.title} frame={frame} width={width} />
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${shiftX}px) scale(${1 - sh * 0.18})`, transformOrigin: "30% 50%", opacity: 1 - sh * 0.15 }}>
        {/* drop zone */}
        <div style={{ position: "absolute", left: ZX, top: ZY, width: ZW, height: ZH, borderRadius: 26, background: `linear-gradient(160deg, ${alpha(t.bg2, 0.95)}, ${alpha(t.bg, 0.9)})`, border: `1.5px solid ${alpha(t.primary, 0.35)}`, boxShadow: `0 0 50px ${alpha(t.primary, 0.15)}`, transform: `scale(${eZone.scale}) translate(${eZone.dx}px, ${eZone.dy}px)`, clipPath: eZone.clip, opacity: eZone.opacity }}>
          <div style={{ position: "absolute", left: 30, top: 22, display: "flex", alignItems: "center", gap: 12, fontFamily: t.font.title, fontWeight: 900, fontSize: 32, color: t.text }}>
            <Icon name="globe" size={34} color={t.primary} />
            {data.host}
          </div>
          <div
            style={{
              position: "absolute",
              left: 40,
              right: 40,
              top: 90,
              bottom: 40,
              borderRadius: 20,
              border: `4px dashed ${hover ? t.accent : alpha(t.primary, 0.6)}`,
              background: hover ? alpha(t.accent, 0.08 + 0.05 * Math.sin(frame / 4)) : alpha(t.primary, 0.04),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}
          >
            {!dropped && (
              <>
                <Icon name="download" size={90} color={hover ? t.accent : alpha(t.primary, 0.8)} stroke={1.8} style={{ transform: "rotate(180deg)" }} />
                <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 36, color: hover ? t.accent : t.dim }}>{data.drop}</div>
              </>
            )}
            {dropped && frame < urlAt && (
              <div style={{ width: "80%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: t.font.mono, fontSize: 28, color: t.text, marginBottom: 14 }}>
                  <span>{data.file}</span>
                  <span style={{ color: t.accent }}>{Math.round(up * 100)}%</span>
                </div>
                <div style={{ height: 22, borderRadius: 11, background: alpha(t.primary, 0.15), overflow: "hidden" }}>
                  <div style={{ width: `${up * 100}%`, height: "100%", background: `linear-gradient(90deg, ${t.primary}, ${t.accent})`, boxShadow: `0 0 20px ${alpha(t.primary, 0.8)}` }} />
                </div>
              </div>
            )}
            {frame >= urlAt && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, transform: `scale(${eUrl.scale}) translate(${eUrl.dx}px, ${eUrl.dy}px)`, clipPath: eUrl.clip }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: t.font.title, fontWeight: 900, fontSize: 36, color: t.primary }}>
                  <Icon name="check" size={40} color={t.primary} stroke={3} />
                  已上线
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 30px", borderRadius: 18, background: alpha(t.bg, 0.9), border: `3px solid ${t.accent}`, boxShadow: `0 0 40px ${alpha(t.accent, 0.5)}`, fontFamily: t.font.mono, fontWeight: 700, fontSize: fitFont(data.url, 640, 44, 24), color: t.text, whiteSpace: "nowrap" }}>
                  <Icon name="lock" size={36} color={t.accent} />
                  {shown}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* the file being dragged */}
        {fileGone < 1 && (
          <div style={{ position: "absolute", left: fx, top: fy, width: 160, textAlign: "center", opacity: 1 - fileGone, transform: `scale(${(hover ? 1.08 : 1) * (1 - fileGone * 0.5)}) rotate(${hover ? -6 : 0}deg)` }}>
            <div style={{ width: 130, height: 150, margin: "0 auto", borderRadius: 16, background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`, boxShadow: `0 ${hover ? 30 : 10}px ${hover ? 50 : 24}px rgba(0,0,0,.6), 0 0 30px ${alpha(t.primary, 0.5)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="globe" size={80} color={t.bg} stroke={1.8} />
            </div>
            <div style={{ marginTop: 10, fontFamily: t.font.mono, fontWeight: 700, fontSize: 26, color: t.text, whiteSpace: "nowrap", textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>{data.file}</div>
            {hover && (
              <div style={{ position: "absolute", left: 110, top: 110 }}>
                <Icon name="cursor" size={54} color="#fff" fill="#111" stroke={1.6} />
              </div>
            )}
          </div>
        )}
      </div>
      {/* shared: laptop + phone both open the link */}
      {frame >= shareAt + 6 && (
        <>
          <div style={{ position: "absolute", left: 1010, top: 250, width: 640, transform: `scale(${eLap.scale}) translate(${eLap.dx}px, ${eLap.dy}px)`, clipPath: eLap.clip, transformOrigin: "center bottom" }}>
            <div style={{ padding: 14, borderRadius: "18px 18px 6px 6px", background: "#1c2233", border: `2px solid ${alpha(t.primary, 0.5)}` }}>
              <MiniApp w={612} h={380} frame={frame} app={{ ...data.app, url: data.url }} workAt={shareAt + 30} />
            </div>
            <div style={{ height: 22, margin: "0 -40px", borderRadius: "0 0 20px 20px", background: "#2a3146" }} />
          </div>
          <div style={{ position: "absolute", left: 1560, top: 420, width: 250, height: 470, borderRadius: 36, padding: 12, background: "#1c2233", border: `3px solid ${alpha(t.primary, 0.6)}`, boxShadow: "0 20px 50px rgba(0,0,0,.6)", transform: `scale(${ePhone.scale}) translate(${ePhone.dx}px, ${ePhone.dy}px)`, clipPath: ePhone.clip, transformOrigin: "center bottom" }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 26, overflow: "hidden" }}>
              <MiniApp w={226} h={446} frame={frame} app={{ ...data.app, url: data.url }} workAt={shareAt + 36} chrome={false} />
            </div>
          </div>
          <div style={{ position: "absolute", left: 1010, top: 790, width: 800, display: "flex", justifyContent: "center", gap: 20, transform: `translate(${eChips.dx}px, ${eChips.dy}px)`, clipPath: eChips.clip, opacity: eChips.opacity }}>
            {[
              ["users", "发到群里"],
              ["globe", "点开就能用"],
            ].map(([ic, tx]) => (
              <span key={tx} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 24px", borderRadius: 26, background: alpha(t.bg, 0.8), border: `2px solid ${t.primary}`, fontFamily: t.font.title, fontWeight: 900, fontSize: 32, color: t.text }}>
                <Icon name={ic} size={32} color={t.primary} />
                {tx}
              </span>
            ))}
          </div>
        </>
      )}
      <Sfx name="swish" at={dragAt} volume={0.3} />
      <Sfx name="pop" at={dropAt} volume={0.4} />
      <Sfx name="riser" at={dropAt} volume={0.14} />
      <Sfx name="ding" at={doneAt} volume={0.35} />
      <Sfx name="typing" at={urlAt} volume={0.2} />
      <Sfx name="success" at={urlAt + 14} volume={0.35} />
      <Sfx name="whoosh" at={shareAt} volume={0.3} />
      <Sfx name="pop" at={shareAt + 8} volume={0.3} />
      <Sfx name="pop" at={shareAt + 16} volume={0.3} />
    </>
  );
};

export const DragDeploy: CompDef<D> = {
  id: "drag-deploy",
  name: "拖拽上线 · 吐出网址 · 多端打开",
  layer: "product",
  variants: 1,
  minSec: 4,
  maxSec: 14,
  tags: ["上线", "部署", "托管", "拖进", "网址", "链接", "分享"],
  motion: { kind: "文件被拖进虚线框、进度条走满逐字吐网址、笔记本手机弹出同开", energy: 3 },
  desc: "文件从桌面被拖进托管平台的虚线框（框变亮）→ 进度条走满 → 专属网址逐字吐出；随后页面让到左边，笔记本和手机弹出，打开同一个网址、工具在两端同时跑起来",
  use: "把做好的东西一键发布出去给别人用：网页拖进托管平台、视频上传出链接、文件丢进网盘分享、App 提交上架（file / host / url / app 全可改）",
  schema,
  example: { dragAt: 10, dropAt: 40, doneAt: 76, urlAt: 84, shareAt: 130 },
  C,
};
