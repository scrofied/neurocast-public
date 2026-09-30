import React, { useMemo } from "react";
import { z } from "zod";
import { useVideoConfig } from "remotion";
import { clamp, easeInOut, easeOut, easeOutBack, noise1, prog, rng } from "../../lib/anim";
import { alpha, useTheme } from "../../lib/theme";
import { GlowDefs, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({ title: z.string().optional(), kicker: z.string().optional(), docs: z.array(z.string()).max(8).optional(), query: z.string().optional() });
type D = z.infer<typeof schema>;

// documents fly into a 3D vault, get sliced into vector chips, a query beam retrieves the relevant ones
const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant, seed }) => {
  const t = useTheme();
  const { width, height } = useVideoConfig();
  const docs = (data.docs && data.docs.length ? data.docs : ["产品手册.pdf", "会议纪要.docx", "客户FAQ.md", "合同模板.pdf", "培训课件.pptx"]).slice(0, 8);
  const cx = width / 2 + 120;
  const cy = height / 2 + 70;
  const cols = 8;
  const rows = 5;
  const cells = useMemo(() => {
    const r = rng(seed + 8);
    return new Array(cols * rows).fill(0).map((_, i) => ({ c: i % cols, r: Math.floor(i / cols), hot: r() < 0.18, d: r() }));
  }, [seed]);
  const flyEnd = 12 + docs.length * 6 + 16;
  const q = prog(frame, flyEnd + 8, 24);
  const found = easeOut(prog(frame, flyEnd + 30, 20));
  const cw = 128;
  const ch = 78;
  const gx = cx - (cols * cw) / 2;
  const gy = cy - (rows * ch) / 2;
  const rotY = -18 + noise1(frame / 90, seed) * 4;

  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width, height, transform: `perspective(1800px) rotateX(18deg) rotateY(${rotY}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        {cells.map((c, i) => {
          const on = easeOut(prog(frame, 14 + c.d * 30, 14));
          const lit = c.hot ? found : 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: gx + c.c * cw,
                top: gy + c.r * ch,
                width: cw - 10,
                height: ch - 10,
                borderRadius: 6,
                background: alpha(lit > 0.1 ? t.accent : t.primary, 0.08 + lit * 0.4 + on * 0.06),
                border: `1px solid ${alpha(lit > 0.1 ? t.accent : t.primary, 0.3 + lit * 0.7)}`,
                boxShadow: lit > 0.1 ? `0 0 ${30 * lit}px ${alpha(t.accent, 0.7)}` : "none",
                opacity: on,
                transform: `translateZ(${lit * 60}px)`,
                fontFamily: t.font.mono,
                fontSize: 14,
                color: alpha(t.text, 0.5),
                padding: 5,
                overflow: "hidden",
              }}
            >
              {`[${(c.d * 2 - 1).toFixed(2)}, ${((c.d * 7) % 1).toFixed(2)}…]`}
            </div>
          );
        })}
      </div>
      {docs.map((d, i) => {
        const p = easeInOut(prog(frame, 6 + i * 6, 22));
        const sx = 160;
        const sy = 280 + i * 92;
        const tx = cx;
        const ty = cy;
        const x = sx + (tx - sx) * p;
        const y = sy + (ty - sy) * p - Math.sin(p * Math.PI) * 120;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              padding: "12px 22px",
              borderRadius: 10,
              background: alpha(t.bg2, 0.9),
              border: `1.5px solid ${alpha(t.primary, 0.6)}`,
              fontFamily: t.font.body,
              fontSize: 24,
              fontWeight: 700,
              color: t.text,
              whiteSpace: "nowrap",
              opacity: easeOut(prog(frame, 2 + i * 6, 8)) * (1 - clamp((p - 0.85) * 7)),
              transform: `translate(-50%,-50%) scale(${1 - p * 0.6}) rotate(${p * 20 * (i % 2 ? 1 : -1)}deg)`,
              boxShadow: `0 0 20px ${alpha(t.primary, 0.3)}`,
            }}
          >
            📄 {d}
          </div>
        );
      })}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <GlowDefs id="kv" std={8} />
        {q > 0 && <line x1={cx} y1={150} x2={cx} y2={150 + (cy - 150) * easeOut(q)} stroke={t.accent} strokeWidth={4} filter="url(#kv)" />}
      </svg>
      {q > 0 && (
        <div style={{ position: "absolute", left: cx - 300, width: 600, top: 150 - 40, textAlign: "center", fontFamily: t.font.mono, fontSize: 28, color: t.accent, opacity: clamp(q * 3), textShadow: `0 0 16px ${t.accent}` }}>
          {`? ${data.query ?? "退款流程是什么"}`}
        </div>
      )}
      <div style={{ position: "absolute", right: 110, bottom: 130, fontFamily: t.font.mono, fontSize: 20, color: t.dim, letterSpacing: 3, opacity: found }}>
        {`MATCHED ${cells.filter((c) => c.hot).length} CHUNKS · ${(0.9 + found * 0.08).toFixed(2)} SIM`}
      </div>
      <Headline kicker={data.kicker ?? "KNOWLEDGE BASE"} title={data.title} frame={frame} />
    </>
  );
};

export const KnowledgeVault: CompDef<D> = {
  id: "vault",
  name: "知识库向量检索",
  layer: "metaphor",
  variants: 1,
  minSec: 5,
  maxSec: 10,
  tags: ["知识库", "文档", "资料", "检索", "RAG", "向量", "上传", "记忆"],
  desc: "文档方块堆成知识库墙，提问时相关文档被点亮检索出来",
  use: "知识库、RAG、检索、把资料喂给 AI",
  schema,
  example: { title: "把公司文档喂给 AI", query: "新员工报销怎么走" },
  C,
};
