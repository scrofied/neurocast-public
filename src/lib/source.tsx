import React from "react";
import { z } from "zod";
import { easeOut, prog } from "./anim";
import { alpha, useTheme } from "./theme";

// 「这张图是哪来的」——素材来源角标。
// 全片只要上真实截图/真数据，就该带这一行小字：平台 + 采集时间（+ 出处）。
// 它是可选字段：不填就不渲染，零侵入；填了就把「代码画的动画」变成「有出处的证据」。
export const sourceSchema = z
  .object({
    platform: z.string().optional().describe("截图来自哪：抖音 / 小红书 / Arena / 后台 / 我自己的表格"),
    url: z.string().optional().describe("出处地址，只写域名或短链，别塞长参数"),
    capturedAt: z.string().optional().describe("采集时间，如 2026-09-30（相对时间会过期，写绝对日期）"),
    author: z.string().optional().describe("谁的素材：@某人 / 我自己 / 客户 provided"),
    at: z.number().optional().describe("角标出现的时刻（锚点或帧）；缺省跟素材一起进来"),
  })
  .optional()
  .describe("素材来源角标（右下角小字）：平台 + 采集时间 + 出处，真实截图必须带");

export type Source = z.infer<typeof sourceSchema>;

const short = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").slice(0, 28);

export const SourceBadge: React.FC<{ source: Source; frame: number; x?: number; y?: number; align?: "left" | "right" }> = ({
  source,
  frame,
  x = 0,
  y = 0,
  align = "right",
}) => {
  const t = useTheme();
  if (!source || !(source.platform || source.capturedAt || source.url || source.author)) return null;
  const at = source.at ?? 0;
  const p = easeOut(prog(frame, at, 12));
  const bits = [source.platform, source.capturedAt ? `${source.capturedAt} 采集` : "", source.author, source.url ? short(source.url) : ""].filter(Boolean);
  return (
    <div
      style={{
        position: "absolute",
        [align]: 0,
        left: align === "left" ? x : undefined,
        right: align === "right" ? -x : undefined,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 999,
        background: alpha(t.bg, 0.78),
        border: `1.5px solid ${alpha(t.primary, 0.55)}`,
        boxShadow: `0 0 24px ${alpha(t.primary, 0.22)}`,
        fontFamily: t.font.mono,
        fontSize: 17,
        letterSpacing: 0.5,
        color: alpha(t.text, 0.92),
        opacity: p,
        transform: `translateY(${(1 - p) * 10}px)`,
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 4, background: t.primary, boxShadow: `0 0 8px ${t.primary}` }} />
      真实素材
      <span style={{ opacity: 0.4 }}>|</span>
      {bits.join(" · ")}
    </div>
  );
};
