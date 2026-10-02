import React from "react";
import { z } from "zod";
import { clamp, easeInOut, easeOut, easeOutBack, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { cueOr, typed } from "../../lib/cue";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { useEnter } from "../../lib/enter";
import { fitFont, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";
import { MiniApp, miniButton } from "./MiniApp";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  app: z.object({ title: z.string(), url: z.string().optional(), button: z.string().optional(), inputs: z.array(z.string()).max(3).optional() }).default({ title: "表格金额核对", button: "开始比对", inputs: ["表格 A", "表格 B"] }),
  key: z.string().default("F12").describe("打开报错面板的按键"),
  errors: z.array(z.string()).min(1).max(3).default(["Uncaught TypeError: rows is undefined", "    at compare (index.html:88)"]).describe("红色报错原文"),
  prompt: z.string().default("请直接给出修复后的全量完整代码，严禁给局部替换代码！").describe("甩给 AI 时加的那句话"),
  file: z.string().default("index.html · 全量代码").describe("AI 重新生成的整份文件"),
  fixed: z.string().default("2 秒解决").describe("修好后盖的章"),
  failAt: z.number().optional().describe("点按钮没反应的时刻（锚点，如“点不动”）"),
  devAt: z.number().optional().describe("按下 F12、报错面板弹出（锚点）"),
  errAt: z.number().optional().describe("红色报错高亮（锚点，如“红色报错”）"),
  sendAt: z.number().optional().describe("报错被甩给 AI（锚点，如“甩给”）"),
  promptAt: z.number().optional().describe("开始打那句话（锚点）"),
  promptDoneAt: z.number().optional(),
  regenAt: z.number().optional().describe("AI 整份重新生成（锚点）"),
  replaceAt: z.number().optional().describe("全选覆盖（锚点）"),
  fixedAt: z.number().optional().describe("跑通的时刻（锚点，如“解决”）"),
});
type D = z.infer<typeof schema>;

const Key: React.FC<{ label: string; down: boolean }> = ({ label, down }) => {
  const t = useTheme();
  return (
    <span style={{ display: "inline-block", padding: "10px 22px", borderRadius: 12, background: t.bg2, border: `2px solid ${t.primary}`, fontFamily: t.font.mono, fontWeight: 700, fontSize: 34, color: t.text, transform: `translateY(${down ? 5 : 0}px)`, boxShadow: `0 ${down ? 1 : 6}px 0 ${alpha(t.primary, 0.6)}, 0 0 24px ${alpha(t.primary, 0.3)}` }}>{label}</span>
  );
};

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width } = useBox();
  const failAt = cueOr(data.failAt, 20);
  const devAt = cueOr(data.devAt, failAt + 40);
  const errAt = cueOr(data.errAt, devAt + 16);
  const sendAt = cueOr(data.sendAt, errAt + 30);
  const promptAt = cueOr(data.promptAt, sendAt + 24);
  const promptDoneAt = cueOr(data.promptDoneAt, promptAt + Array.from(data.prompt).length * 3);
  const regenAt = cueOr(data.regenAt, promptDoneAt + 14);
  const replaceAt = cueOr(data.replaceAt, regenAt + 40);
  const fixedAt = cueOr(data.fixedAt, replaceAt + 18);
  // left: the broken tool
  const AX = 110;
  const AY = 200;
  const AW = 820;
  const AH = 620;
  const btn = miniButton(AW);
  // 原生是 0.92→1 回弹淡入，rise 等价顶替
  const eWin = enterAt(frame, 0, { fallback: "rise", dur: 16, from: 0.92 });
  const cur = easeInOut(prog(frame, failAt - 16, 14));
  const curX = AX + AW * 0.75 + (AX + btn.x - (AX + AW * 0.75)) * cur;
  const curY = AY + AH * 0.9 + (AY + btn.y - (AY + AH * 0.9)) * cur;
  // devtools slides up, closes once the new code is in
  const dv = easeOut(prog(frame, devAt, 12)) * (1 - easeInOut(prog(frame, replaceAt + 8, 10)));
  const PH = 300;
  const errHi = easeOut(prog(frame, errAt, 8));
  const eGrab = enterAt(frame, errAt, { fallback: "rise", dur: 8 });
  const eNo = enterAt(frame, failAt + 4, { fallback: "rise", dur: 10, from: 0 });
  // right: the AI chat
  const BX = 1010;
  const BY = 200;
  const BW = 800;
  const BH = 620;
  const eChat = enterAt(frame, sendAt - 10, { fallback: "rise", dur: 14, from: 0.9 });
  const fly = easeInOut(prog(frame, sendAt, 14));
  const errChip = data.errors[0].trim();
  const fromX = AX + 40;
  const fromY = AY + AH - PH + 90;
  const toX = BX + BW - 40 - 520;
  const toY = BY + 110;
  const regen = prog(frame, regenAt, Math.max(12, replaceAt - regenAt - 4));
  // the whole file flies back into the tool
  const back = easeInOut(prog(frame, replaceAt + 6, 12));
  const eDoc = enterAt(frame, regenAt, { fallback: "rise", dur: 12, from: 0 });
  const docX = BX + 40 + (AX + AW / 2 - 260 - (BX + 40)) * back;
  const docY = BY + 330 + (AY + AH / 2 - 90 - (BY + 330)) * back;
  const sel = frame >= replaceAt && frame < replaceAt + 10;
  const flash = frame >= replaceAt + 18 && frame < replaceAt + 26 ? 1 - (frame - replaceAt - 18) / 8 : 0;
  const eOk = enterAt(frame, fixedAt, { fallback: "rise", dur: 12, from: 0 });
  // 金章原生是 2→1 快速收缩砸下：zoom-through(from 2) 的减速曲线最接近
  const eStamp = enterAt(frame, fixedAt, { fallback: "zoom-through", dur: 7, from: 2 });
  const fsP = fitFont(data.prompt.slice(0, 16), 560, 32, 22);
  return (
    <>
      <Heading kicker={data.kicker ?? "DEBUG"} title={data.title} frame={frame} width={width} />
      {/* the tool */}
      <div style={{ position: "absolute", left: AX, top: AY, transform: `scale(${eWin.scale}) translate(${eWin.dx}px, ${eWin.dy}px)`, opacity: eWin.opacity }}>
        <MiniApp w={AW} h={AH} frame={frame} app={data.app} fail={failAt} workAt={frame >= fixedAt ? fixedAt : undefined} />
        {sel && <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: alpha(t.primary, 0.35), border: `3px solid ${t.primary}` }} />}
        {flash > 0 && <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: `rgba(255,255,255,${0.7 * flash})` }} />}
        {/* devtools console */}
        {dv > 0.01 && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: PH * dv, overflow: "hidden", borderRadius: "0 0 14px 14px", background: "#1b1b1f", borderTop: `3px solid ${t.bad}` }}>
            <div style={{ height: 44, display: "flex", alignItems: "center", gap: 26, padding: "0 20px", background: "#26262c", fontFamily: t.font.mono, fontSize: 20, color: "#9aa0a6" }}>
              <span>Elements</span>
              <span style={{ color: "#fff", borderBottom: `3px solid ${t.primary}`, paddingBottom: 6 }}>Console</span>
              <span>Sources</span>
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, color: t.bad, fontWeight: 700 }}>
                <Icon name="x" size={20} color={t.bad} stroke={3} />
                {data.errors.length}
              </span>
            </div>
            {data.errors.map((e, i) => (
              <div key={i} style={{ margin: i ? "0 12px" : "12px 12px 0", padding: "10px 14px", background: `rgba(120,0,16,${0.35 + 0.35 * errHi})`, borderLeft: `5px solid ${t.bad}`, fontFamily: t.font.mono, fontSize: fitFont(e, AW - 90, 24, 14), color: "#ff8a95", whiteSpace: "pre", boxShadow: errHi > 0 && i === 0 ? `0 0 ${24 * errHi}px ${alpha(t.bad, 0.7)}` : undefined }}>
                {i === 0 ? "✖ " : ""}
                {e}
              </div>
            ))}
          </div>
        )}
        {/* grab box around the red error */}
        {frame >= errAt && frame < sendAt + 4 && dv > 0.5 && (
          <div style={{ position: "absolute", left: 4, right: 4, top: AH - PH + 48, height: 58 + (data.errors.length - 1) * 50, border: `4px dashed ${t.accent}`, borderRadius: 10, transform: `translate(${eGrab.dx}px, ${eGrab.dy}px)`, opacity: eGrab.opacity, boxShadow: `0 0 20px ${alpha(t.accent, 0.5)}` }} />
        )}
      </div>
      {/* cursor clicking the dead button */}
      {frame >= failAt - 16 && frame < devAt + 4 && (
        <div style={{ position: "absolute", left: curX, top: curY }}>
          {frame >= failAt && frame < failAt + 12 && <div style={{ position: "absolute", left: -30 - (frame - failAt) * 3, top: -30 - (frame - failAt) * 3, width: 60 + (frame - failAt) * 6, height: 60 + (frame - failAt) * 6, borderRadius: "50%", border: `3px solid ${alpha(t.bad, 1 - (frame - failAt) / 12)}` }} />}
          <Icon name="cursor" size={54} color="#fff" fill="#111" stroke={1.6} />
        </div>
      )}
      {frame >= failAt + 4 && frame < devAt && (
        <div style={{ position: "absolute", left: AX + btn.x + 150, top: AY + btn.y - 40, fontFamily: t.font.title, fontWeight: 900, fontSize: 48, color: t.bad, transform: `scale(${eNo.scale}) translate(${eNo.dx}px, ${eNo.dy}px)`, WebkitTextStroke: "6px #000", paintOrder: "stroke fill" }}>点不动？</div>
      )}
      {/* keycaps */}
      {frame >= devAt - 6 && frame < devAt + 40 && (
        <div style={{ position: "absolute", left: AX + AW - 140, top: AY - 90, opacity: 1 - easeOut(prog(frame, devAt + 30, 10)) }}>
          <Key label={data.key} down={frame >= devAt && frame < devAt + 5} />
        </div>
      )}
      {frame >= replaceAt - 6 && frame < replaceAt + 34 && (
        <div style={{ position: "absolute", left: AX + AW - 250, top: AY - 90, display: "flex", gap: 12, opacity: 1 - easeOut(prog(frame, replaceAt + 24, 10)) }}>
          <Key label="Ctrl" down={frame >= replaceAt && frame < replaceAt + 5} />
          <Key label="A" down={frame >= replaceAt && frame < replaceAt + 5} />
        </div>
      )}
      {/* AI chat */}
      {frame >= sendAt - 10 && (
        <div style={{ position: "absolute", left: BX, top: BY, width: BW, height: BH, borderRadius: 22, overflow: "hidden", background: `linear-gradient(170deg, ${alpha(t.bg2, 0.96)}, ${alpha(t.bg, 0.94)})`, border: `1.5px solid ${alpha(t.primary, 0.45)}`, boxShadow: `0 0 50px ${alpha(t.primary, 0.18)}`, transform: `scale(${eChat.scale}) translate(${eChat.dx}px, ${eChat.dy}px)`, opacity: eChat.opacity }}>
          <div style={{ height: 70, display: "flex", alignItems: "center", gap: 14, padding: "0 26px", borderBottom: `1px solid ${alpha(t.primary, 0.2)}` }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="bot" size={26} color={t.bg} stroke={2.4} />
            </div>
            <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: 30, color: t.text }}>AI 助手</span>
          </div>
          {/* your message: the error + the rule */}
          <div style={{ position: "absolute", right: 30, top: 96, width: 560, padding: "18px 22px", borderRadius: 22, borderTopRightRadius: 6, background: `linear-gradient(135deg, ${alpha(t.primary, 0.28)}, ${alpha(t.secondary, 0.2)})`, border: `2px solid ${alpha(t.primary, 0.7)}` }}>
            <div style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: "rgba(120,0,16,.6)", border: `1.5px solid ${t.bad}`, fontFamily: t.font.mono, fontSize: 20, color: "#ff8a95", opacity: fly >= 1 ? 1 : 0, whiteSpace: "nowrap", maxWidth: 516, overflow: "hidden" }}>✖ {errChip}</div>
            {frame >= promptAt && (
              <div style={{ marginTop: 12, fontFamily: t.font.body, fontWeight: 800, fontSize: fsP, lineHeight: 1.45, color: t.text }}>
                {typed(data.prompt, frame, promptAt, promptDoneAt)}
                {frame < promptDoneAt + 6 && Math.floor(frame / 8) % 2 === 0 && <span style={{ color: t.primary }}>▍</span>}
              </div>
            )}
          </div>
        </div>
      )}
      {/* error chip flying over */}
      {frame >= sendAt && fly < 1 && (
        <div style={{ position: "absolute", left: fromX + (toX - fromX) * fly, top: fromY + (toY - fromY) * fly - Math.sin(fly * Math.PI) * 120, padding: "8px 16px", borderRadius: 10, background: "rgba(120,0,16,.85)", border: `2px solid ${t.bad}`, fontFamily: t.font.mono, fontSize: 22, color: "#ffb3ba", whiteSpace: "nowrap", boxShadow: `0 0 30px ${alpha(t.bad, 0.7)}`, transform: `scale(${1 + Math.sin(fly * Math.PI) * 0.2})` }}>✖ {errChip}</div>
      )}
      {/* the regenerated full file */}
      {frame >= regenAt && back < 1 && (
        <div style={{ position: "absolute", left: docX, top: docY, width: 520, height: 180, borderRadius: 16, overflow: "hidden", background: "#0b1220", border: `2px solid ${t.secondary}`, boxShadow: `0 0 40px ${alpha(t.secondary, 0.5)}`, transform: `scale(${eDoc.scale * (1 - back * 0.3)}) translate(${eDoc.dx}px, ${eDoc.dy}px)`, opacity: 1 - back * 0.4 }}>
          <div style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", background: alpha(t.secondary, 0.25), fontFamily: t.font.mono, fontSize: 20, color: t.text }}>
            <Icon name="doc" size={22} color={t.text} />
            {data.file}
            <span style={{ marginLeft: "auto", color: t.accent }}>{Math.round(regen * 100)}%</span>
          </div>
          <div style={{ position: "absolute", left: 16, right: 16, top: 56, bottom: 10, overflow: "hidden" }}>
            {Array.from({ length: 9 }, (_, i) => {
              const y = ((i * 16 - frame * 6) % 144 + 144) % 144;
              return <div key={i} style={{ position: "absolute", top: y, left: (i % 3) * 20, width: `${40 + ((i * 37) % 50)}%`, height: 8, borderRadius: 4, background: alpha(i % 4 === 0 ? t.primary : t.text, 0.35) }} />;
            })}
          </div>
          <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: `${regen * 100}%`, background: t.accent }} />
        </div>
      )}
      {/* fixed */}
      {frame >= fixedAt && (
        <>
          <div style={{ position: "absolute", left: AX + AW - 300, top: AY + AH - 120, display: "flex", alignItems: "center", gap: 10, padding: "10px 22px", borderRadius: 30, background: alpha(t.bg, 0.85), border: `2px solid ${t.primary}`, fontFamily: t.font.title, fontWeight: 900, fontSize: 34, color: t.primary, transform: `scale(${eOk.scale}) translate(${eOk.dx}px, ${eOk.dy}px)`, boxShadow: `0 0 30px ${alpha(t.primary, 0.5)}` }}>
            <Icon name="check" size={34} color={t.primary} stroke={3} />0 报错
          </div>
          <div style={{ position: "absolute", left: BX + 150, top: BY + 360, transform: `rotate(-8deg) scale(${eStamp.scale}) translate(${eStamp.dx}px, ${eStamp.dy}px)`, padding: "10px 34px", border: `7px solid ${t.accent}`, borderRadius: 16, background: "rgba(0,0,0,.45)", fontFamily: t.font.title, fontWeight: 900, fontSize: 96, color: t.accent, whiteSpace: "nowrap", textShadow: `0 0 24px ${alpha(t.accent, 0.6)}` }}>{data.fixed}</div>
        </>
      )}
      <Sfx name="click" at={failAt} volume={0.4} />
      <Sfx name="glitch" at={failAt + 2} volume={0.3} />
      <Sfx name="click" at={devAt} volume={0.45} />
      <Sfx name="swish" at={devAt + 1} volume={0.3} />
      <Sfx name="ding" at={errAt} volume={0.3} />
      <Sfx name="whoosh" at={sendAt} volume={0.35} />
      <Sfx name="typing" at={promptAt} volume={0.22} />
      <Sfx name="typing" at={promptAt + 40} volume={0.22} />
      <Sfx name="pop" at={regenAt} volume={0.3} />
      <Sfx name="click" at={replaceAt} volume={0.45} />
      <Sfx name="whoosh" at={replaceAt + 6} volume={0.3} />
      <Sfx name="success" at={fixedAt} volume={0.4} />
      <Sfx name="stamp" at={fixedAt + 2} volume={0.45} />
    </>
  );
};

export const BugFixLoop: CompDef<D> = {
  id: "bug-fix-loop",
  name: "报错 → 甩给 AI → 整份覆盖修好",
  layer: "product",
  variants: 1,
  minSec: 5,
  maxSec: 18,
  tags: ["报错", "F12", "修复", "全量代码", "覆盖", "调试", "Bug"],
  motion: { kind: "控制台滑出、报错卡片飞向 AI、生成文件飞回覆盖、金章砸下", energy: 3 },
  desc: "左边小工具点按钮没反应（红叉抖动）→ 按 F12 弹出控制台、红色报错被虚线框抓住 → 报错卡片飞进右边 AI 对话框、打出一句硬规则 → AI 生成整份文件（进度滚到 100%）→ Ctrl+A 全选、文件飞回覆盖 → 工具跑通，“0 报错”+ 金色章",
  use: "出错了把错误原样交给 AI、让它整份重做再覆盖：代码报错修复、表格公式出错重算、文档格式乱了整篇重排、配置写错整份替换（errors / prompt / file / app 全可改）",
  schema,
  example: { failAt: 12, devAt: 40, errAt: 56, sendAt: 80, promptAt: 100, promptDoneAt: 150, regenAt: 160, replaceAt: 200, fixedAt: 220 },
  C,
};
