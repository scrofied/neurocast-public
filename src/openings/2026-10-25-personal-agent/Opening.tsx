import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeOut, easeOutBack, noise1, prog } from "../../lib/anim";
import { assetUrl } from "../../lib/asset";
import { alpha, useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";

// 强钩子开场：0-2.4s 纯图形冲击（不露人）→ 2.4-6.3s 海外 Agent 图标爆开环绕
// → 6.3s 后回到人物与「一户一苏培盛」的落点。开场每 2 秒换一次视觉机制，避免平缓。
const schema = z.object({
  slamAt: z.number().default(0),
  montageAt: z.number().default(2.4),
  montageEndAt: z.number().default(6.3),
  termAt: z.number().default(6.4),
  literalAt: z.number().default(8.2),
  aliasAt: z.number().default(11.2),
  exitAt: z.number().default(13.8),
  showCaptions: z.boolean().default(true),
});
type D = z.infer<typeof schema>;

const AGENTS = [
  { src: "brands/meta.svg", label: "Muse", org: "Meta" },
  { src: "brands/chatgpt.svg", label: "Dots", org: "OpenAI" },
  { src: "brands/gemini.svg", label: "Gemini", org: "Google" },
  { src: "brands/claude.svg", label: "Claude", org: "Anthropic" },
  { src: "brands/perplexity.svg", label: "Perplexity", org: "Perplexity" },
];

const C: React.FC<CompProps<D>> = ({ data: d, frame }) => {
  const t = useTheme();
  if (frame >= d.exitAt) return null;

  // ---------- 0–2.4s：纯图形冲击 ----------
  if (frame < d.montageAt) {
    const k = easeOutBack(prog(frame, 2, 12));
    const shake = frame < 22 ? noise1(frame * 3.1, 7) * 16 * (1 - frame / 22) : 0;
    const flash = frame < 6 ? 1 - frame / 6 : 0;
    const glide = prog(frame, 14, 30);
    return (
      <div style={{ position: "absolute", inset: 0, background: t.bg, overflow: "hidden", fontFamily: t.font.title }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 48%, ${alpha(t.primary, 0.35)}, ${t.bg} 60%)` }} />
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {new Array(46).fill(0).map((_, i) => {
            const a = (i / 46) * Math.PI * 2;
            const r0 = 140 + glide * 320;
            const r1 = r0 + 260 + (i % 5) * 70;
            return (
              <line key={i} x1={960 + Math.cos(a) * r0} y1={520 + Math.sin(a) * r0}
                x2={960 + Math.cos(a) * r1} y2={520 + Math.sin(a) * r1}
                stroke={alpha(i % 3 === 0 ? t.accent : t.primary, 0.45)} strokeWidth={i % 4 === 0 ? 4 : 2} />
            );
          })}
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, top: 300 + shake, textAlign: "center", transform: `scale(${0.6 + 0.4 * k}) rotate(${(1 - k) * -4}deg)`, opacity: clamp(k * 1.6) }}>
          <div style={{ color: t.text, fontSize: 210, lineHeight: 0.86, fontWeight: 900, letterSpacing: -8, textShadow: `0 0 90px ${alpha(t.primary, 0.85)}` }}>PERSONAL</div>
          <div style={{ color: t.primary, fontSize: 210, lineHeight: 0.86, fontWeight: 900, letterSpacing: -8, textShadow: `0 0 90px ${alpha(t.primary, 0.9)}` }}>AGENT</div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", opacity: clamp(prog(frame, 12, 14)) }}>
          <span style={{ display: "inline-block", padding: "12px 28px", border: `2px solid ${alpha(t.primary, 0.8)}`, borderRadius: 999, color: t.text, fontSize: 34, fontWeight: 800, letterSpacing: 3 }}>AI 圈又炸出一个新词</span>
        </div>
        {flash > 0 && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash * 0.55 }} />}
      </div>
    );
  }

  const inMontage = frame < d.montageEndAt;
  const montageOut = prog(frame, d.montageEndAt - 8, 8);
  const alias = easeOutBack(prog(frame, d.aliasAt, 12));
  const term = easeOutBack(prog(frame, d.termAt, 12));
  const exitFade = 1 - prog(frame, d.exitAt - 10, 10);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: exitFade, pointerEvents: "none", fontFamily: t.font.title }}>
      {inMontage && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - montageOut }}>
          {/* 只压两侧：真人这一块不许盖任何遮罩 */}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${alpha(t.bg, 0.96)} 0%, ${alpha(t.bg, 0.82)} 16%, ${alpha(t.bg, 0.25)} 34%, transparent 46%, transparent 56%, ${alpha(t.bg, 0.22)} 68%, ${alpha(t.bg, 0.88)} 84%, ${alpha(t.bg, 0.96)} 100%)` }} />
          <div style={{ position: "absolute", left: 84, top: 132, width: 620, zIndex: 6 }}>
            <div style={{ color: t.primary, fontFamily: t.font.mono, fontSize: 24, letterSpacing: 6 }}>THE RACE HAS STARTED</div>
            <div style={{ marginTop: 10, color: t.text, fontSize: 104, lineHeight: 0.94, fontWeight: 900, letterSpacing: -2, textShadow: `0 0 50px ${alpha(t.primary, 0.45)}` }}>海外大厂<br /><span style={{ color: t.primary }}>已经开打</span></div>
            <div style={{ marginTop: 18, color: t.dim, fontSize: 26, letterSpacing: 2 }}>Meta · OpenAI · Google · Anthropic</div>
          </div>
          {/* 品牌轨放在画面最右侧，和人物脸部完全错开（旧版环形排布会压脸） */}
          <div style={{ position: "absolute", left: 1462, top: 118, width: 420, height: 820, zIndex: 3 }}>
            <div style={{ position: "absolute", left: 40, top: 0, width: 2, height: `${easeOut(prog(frame, d.montageAt + 2, 26)) * 100}%`, background: `linear-gradient(180deg, ${alpha(t.primary, 0)}, ${alpha(t.primary, 0.8)}, ${alpha(t.primary, 0)})` }} />
            {AGENTS.map((a, i) => {
              const at = d.montageAt + 2 + i * 5;
              const k = easeOutBack(prog(frame, at, 14));
              if (frame < at) return null;
              const y = 8 + i * 152;
              return (
                <div key={a.label} style={{ position: "absolute", left: 0, top: y, width: 420, display: "flex", alignItems: "center", gap: 16, opacity: Math.min(1, k * 1.7), transform: `translateX(${(1 - k) * 90}px)` }}>
                  <div style={{ width: 92, height: 92, borderRadius: 46, background: alpha(t.bg2, 0.92), border: `3px solid ${alpha(t.primary, 0.9)}`, boxShadow: `0 0 34px ${alpha(t.primary, 0.5)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 42 }}>
                    <Img src={assetUrl(a.src)} style={{ width: 50, height: 50, objectFit: "contain" }} />
                  </div>
                  <div>
                    <div style={{ color: t.text, fontSize: 33, fontWeight: 900, lineHeight: 1 }}>{a.label}</div>
                    <div style={{ marginTop: 6, color: t.primary, fontFamily: t.font.mono, fontSize: 14, letterSpacing: 2.6 }}>{a.org.toUpperCase()}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ position: "absolute", left: 42, top: 792, width: 340, color: t.dim, fontFamily: t.font.mono, fontSize: 15, letterSpacing: 2.6, opacity: easeOut(prog(frame, d.montageAt + 20, 14)) }}>5 家大厂 · 全部重仓 PERSONAL AGENT</div>
          </div>
        </div>
      )}

      {!inMontage && (
        <>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${alpha(t.bg, 0.8)}, transparent 32%, transparent 68%, ${alpha(t.bg, 0.8)})` }} />
          <div style={{ position: "absolute", left: 58, right: 58, top: 54, height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderTop: `1px solid ${alpha(t.primary, 0.55)}`, borderBottom: `1px solid ${alpha(t.primary, 0.35)}`, color: t.primary, fontFamily: t.font.mono, fontSize: 20, letterSpacing: 4 }}>
            <span>TECH NEWS · 新词速递</span><span style={{ color: t.text }}>PERSONAL AGENT / 2026</span>
          </div>
          <div style={{ position: "absolute", left: 58, top: 166, width: 470, padding: "22px 26px", borderRadius: 18, background: `linear-gradient(145deg, ${alpha(t.primary, 0.18)}, ${alpha(t.bg, 0.9)} 70%)`, border: `2px solid ${alpha(t.primary, 0.65)}`, color: t.text }}>
            <div style={{ color: t.primary, fontSize: 21, letterSpacing: 4, fontWeight: 800 }}>直译</div>
            <div style={{ marginTop: 10, fontSize: 54, fontWeight: 900 }}>个人智能体</div>
            <div style={{ marginTop: 12, color: t.dim, fontSize: 23 }}>老百姓怎么理解？</div>
          </div>
          <div style={{ position: "absolute", right: 58, top: 166, width: 520, padding: "22px 26px", borderRadius: 18, background: `linear-gradient(145deg, ${alpha(t.primary, 0.18)}, ${alpha(t.bg, 0.9)} 70%)`, border: `2px solid ${alpha(t.primary, 0.65)}`, color: t.text, transform: `scale(${0.8 + 0.2 * term})`, transformOrigin: "right top", opacity: Math.min(1, term * 2) }}>
            <div style={{ color: t.dim, fontSize: 19, letterSpacing: 3 }}>THE NEW BUZZWORD</div>
            <div style={{ marginTop: 10, fontSize: 54, fontWeight: 900, lineHeight: 1.02 }}>Personal<br /><span style={{ color: t.primary }}>Agent</span></div>
          </div>
          {frame >= d.aliasAt && (
            <>
              <div style={{ position: "absolute", left: 90, top: 690, width: 470, textAlign: "center", color: t.text, fontSize: 84, fontWeight: 900, transform: `scale(${0.5 + 0.5 * alias}) rotate(-4deg)`, textShadow: `0 0 36px ${alpha(t.primary, 0.6)}` }}>一户一</div>
              <div style={{ position: "absolute", right: 80, top: 590, width: 520, textAlign: "center", color: t.accent, fontSize: 104, fontWeight: 900, WebkitTextStroke: `2px ${alpha(t.bg, 0.85)}`, textShadow: `0 10px 0 ${alpha(t.bg, 0.9)}, 0 0 44px ${alpha(t.accent, 0.5)}`, transform: `scale(${0.5 + 0.5 * alias}) rotate(3deg)` }}>苏培盛</div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export const OpeningPersonalAgent: CompDef<D> = {
  id: "opening-personal-agent",
  name: "Personal Agent · 三段式强钩子开场",
  layer: "opening",
  variants: 1,
  minSec: 8,
  maxSec: 15,
  tags: ["新词", "科技新闻", "图标环绕", "强钩子", "真人开场"],
  schema,
  opening: {
    selfBg: false,
    script: "AI 新词 → PERSONAL AGENT 图形冲击 → 五家大厂图标环绕 → 一户一苏培盛",
    hook: "纯图形冲击开头，不露人",
    techniques: ["2.4秒纯图形冲击", "五图标环形爆开", "大字盖章", "紫色新闻HUD"],
    signature: { visual: "巨型PERSONAL AGENT + 五图标环形", sound: "无（单音源口播）" },
  },
  motion: { kind: "巨型标题冲击 + 图标环形爆开 + 盖章落点", energy: 4 },
  example: { slamAt: 0, montageAt: 2.4, montageEndAt: 6.3, termAt: 6.4, literalAt: 8.2, aliasAt: 11.2, exitAt: 13.8 },
  C,
};
