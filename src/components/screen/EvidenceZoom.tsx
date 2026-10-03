import React from "react";
import { z } from "zod";
import { Img, OffthreadVideo } from "remotion";
import { clamp, easeInOut, easeOut, lerp, prog } from "../../lib/anim";
import { assetSrc, MissingAsset } from "../../lib/asset";
import { useBox } from "../../lib/box";
import { listCues } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { SourceBadge, sourceSchema } from "../../lib/source";
import { fitFont, Headline } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

// 圈出截图里的东西：先给全景，再一处处推近、把那一块圈出来。
// 和 screen 的区别：screen 演「点哪个按钮」（操作路径），这里演「看这个数字/这行小字」（证据）。
const mark = z.object({
  x: z.number().describe("圈区左上角横坐标（0~1，相对原图）"),
  y: z.number().describe("圈区左上角纵坐标（0~1）"),
  w: z.number().default(0.22).describe("圈区宽（0~1）"),
  h: z.number().default(0.1).describe("圈区高（0~1）；OCR 能给就写实际高度"),
  label: z.string().optional().describe("圈旁边的话，如「成本 90%」"),
  at: z.number().optional().describe("什么时候圈它（锚点或帧）"),
});
const schema = z.object({
  src: z.string().describe("真截图或录屏（相对 public/）：必须是外部文件，不接受代码画的界面"),
  kind: z.enum(["image", "video"]).optional(),
  aspect: z.number().optional().describe("原图宽高比，prepAssets 会自动带进来"),
  marks: z.array(mark).min(1).max(4).describe("按讲的顺序圈；一镜最多 4 处，多了拆镜"),
  zoom: z.number().default(2.2).describe("推近倍数（1.6~3 之间，太小看不清字）"),
  kicker: z.string().optional(),
  title: z.string().optional(),
  source: sourceSchema,
  at: z.number().optional(),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width, height } = useBox();
  const ar = data.aspect ?? 16 / 10;
  const boxW = Math.min(width - 260, 1300);
  const boxH = Math.min(height - 300, boxW / ar);
  const sw = Math.min(boxW, boxH * ar);
  const sh = sw / ar;
  const fx = (width - sw) / 2;
  const fy = (height - sh) / 2 + 46;

  const start = data.at ?? 4;
  const cues = listCues(data.marks.map((m) => ({ at: m.at })), start + 16, Math.max(start + 40, dur - 14));
  const idx = cues.findIndex((c) => frame < c);
  const cur = idx === -1 ? data.marks.length - 1 : idx - 1; // -1 = 还在看全景
  const m = cur >= 0 ? data.marks[cur] : null;
  const local = cur >= 0 ? frame - cues[cur] : 0;

  // 推镜：先描圈（16 帧）再推近（20 帧），停在这处讲，下一个圈来临前放开
  const drawP = easeInOut(clamp(local / 16));
  const dwell = (cues[cur + 1] ?? dur) - (cues[cur] ?? 0);
  const pushP = easeInOut(clamp((local - 10) / 20)) * (1 - easeInOut(clamp((local - (dwell - 24)) / 16)));
  const zoom = 1 + (data.zoom - 1) * pushP;
  const cx = m ? fx + (m.x + m.w / 2) * sw : width / 2;
  const cy = m ? fy + (m.y + m.h / 2) * sh : height / 2;
  const e = enterAt(frame, start, { fallback: "rise", dur: 20, from: 0.92 });
  const src = assetSrc(data.src);

  return (
    <>
      <Headline kicker={data.kicker ?? "LOOK AT THIS"} title={data.title} frame={frame} y={64} size={42} />
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${cx}px ${cy}px`, transform: `scale(${zoom})`, opacity: clamp(e.opacity) }}>
        <div style={{ position: "absolute", left: fx, top: fy, width: sw, height: sh, borderRadius: 14, overflow: "hidden", border: `1.5px solid ${alpha(t.primary, 0.5)}`, boxShadow: `0 30px 100px rgba(0,0,0,.7), 0 0 60px ${alpha(t.primary, 0.18)}`, transform: `scale(${e.scale}) translate(${e.dx}px, ${e.dy}px)` }}>
          {!src && <MissingAsset field="src" hint="evidence-zoom 要一张真截图：圈出来的必须是真数字" w={sw} h={sh} frame={frame} />}
          {src && data.kind === "video" && <OffthreadVideo src={src} muted style={{ width: sw, height: sh }} />}
          {src && data.kind !== "video" && <Img src={src} style={{ width: sw, height: sh, objectFit: "cover" }} />}
          <div style={{ position: "absolute", right: 0, bottom: 12, paddingRight: 14 }}>
            <SourceBadge source={data.source} frame={frame} />
          </div>
        </div>

        {/* 圈：椭圆描边一路画出来，画完轻轻呼吸 */}
        {m && (
          <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <ellipse
              cx={fx + (m.x + m.w / 2) * sw}
              cy={fy + (m.y + m.h / 2) * sh}
              rx={(m.w * sw) / 2 + 14}
              ry={(m.h * sh) / 2 + 12}
              fill="none"
              stroke={t.accent}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={1680}
              strokeDashoffset={1680 * (1 - drawP)}
              style={{ filter: `drop-shadow(0 0 14px ${alpha(t.accent, 0.8)})`, opacity: clamp(0.74 + 0.26 * Math.sin(frame / 7)) * drawP }}
              transform={`rotate(-2 ${fx + (m.x + m.w / 2) * sw} ${fy + (m.y + m.h / 2) * sh})`}
            />
          </svg>
        )}

        {/* 区外压暗，视线只剩这一块 */}
        {m && pushP > 0.01 && (
          <div style={{ position: "absolute", inset: -400, background: `radial-gradient(ellipse ${(m.w * sw) / 2 + 190}px ${(m.h * sh) / 2 + 150}px at ${cx}px ${cy}px, transparent 55%, ${alpha("#000000", 0.66 * pushP)} 100%)` }} />
        )}

        {m && m.label && (
          (() => {
            const eL = enterAt(frame, cues[cur] + 14, { fallback: "drop", dur: 14, from: 0 });
            const wl = Math.max(220, Math.min(520, m.label.length * 30 + 90));
            const right = cx < width * 0.62;
            const lx = right ? cx + (m.w * sw) / 2 + 46 : cx - (m.w * sw) / 2 - 46 - wl;
            const ly = cy - (m.h * sh) / 2 - 26;
            return (
              <>
                <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: eL.p }}>
                  <line x1={cx + (right ? -1 : 1) * ((m.w * sw) / 2 + 6)} y1={cy} x2={right ? lx : lx + wl} y2={ly + 22} stroke={t.accent} strokeWidth={2.5} strokeDasharray="7 6" />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    left: lx,
                    top: ly,
                    width: wl,
                    padding: "14px 20px",
                    borderRadius: 14,
                    background: alpha(t.bg, 0.92),
                    border: `2px solid ${t.accent}`,
                    boxShadow: `0 0 34px ${alpha(t.accent, 0.45)}`,
                    fontFamily: t.font.title,
                    fontWeight: 900,
                    fontSize: fitFont(m.label, wl - 50, 30, 20),
                    color: t.text,
                    transform: `translateY(${eL.dy}px) scale(${eL.scale})`,
                    opacity: eL.opacity,
                  }}
                >
                  {m.label}
                </div>
              </>
            );
          })()
        )}

        {/* 没在圈的时候给一句「全景」提示：观众知道接下来要看局部 */}
        {cur < 0 && (
          <div style={{ position: "absolute", left: fx, top: fy + sh + 18, width: sw, textAlign: "center", fontFamily: t.font.mono, fontSize: 19, letterSpacing: 3, color: alpha(t.dim, 0.9), opacity: lerp(0, 1, easeOut(prog(frame, start + 6, 12))) }}>
            先看整张，再看重点
          </div>
        )}
      </div>
      <Sfx name="impact" at={start + 2} volume={0.34} />
      {cues.slice(0, cur + 1).map((c, i) => (
        <Sfx key={i} name="tick" at={c + 2} volume={0.26} />
      ))}
    </>
  );
};

export const EvidenceZoom: CompDef<D> = {
  id: "evidence-zoom",
  name: "圈出截图里的重点（推近）",
  layer: "screen",
  variants: 3,
  minSec: 4,
  maxSec: 18,
  tags: ["注意", "这个数字", "看这里", "圈", "放大", "证据", "小字"],
  motion: { kind: "全景停留 → 椭圆描边画出圈 → 镜头推近、区外压暗、标签落下", energy: 3 },
  desc: "一张真截图先给全景，讲到哪一处就把那一块圈出来推近，区外压暗、旁边挂标签。最多 4 处，按讲序圈",
  use: "「注意看这个数字」「就藏在这行小字里」「成本 90% 在这张表里」——凡是「让观众看真图里的某一处」的句子。坐标用 0~1 归一化；OCR 能给位置时自动填（见 scripts/ocr_focus.py）",
  schema,
  assetFields: ["src"],
  example: {
    kicker: "LOOK AT THIS",
    src: "assets/arena-rank-overall.png",
    aspect: 2.13,
    zoom: 2.1,
    marks: [
      { x: 0.06, y: 0.3, w: 0.5, h: 0.12, label: "第一名换了", at: 24 },
      { x: 0.72, y: 0.62, w: 0.24, h: 0.1, label: "分数只差 12", at: 68 },
    ],
    source: { platform: "LMArena", url: "lmarena.ai", capturedAt: "2026-09-30" },
  },
  C,
};
