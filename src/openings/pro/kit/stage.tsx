import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, Freeze, Img, OffthreadVideo, useVideoConfig } from "remotion";
import { z } from "zod";
import { Grain, Vignette } from "./fx";
import { isLight, Look, resolveLook } from "./look";
import { SfxScope, useAsset } from "./sfx";

// ── 舞台：真人层 + 胶片质感 + 公共字段 ─────────────────────────────────

// 真人素材（可选）。不给 = 纯动态图形开场，模板照样能用。
export const personSchema = z
  .object({
    src: z.string().describe("真人视频或图片（public/pro 下的相对路径，或 URL）"),
    kind: z.enum(["video", "image"]).default("video"),
    start: z.number().default(0).describe("从素材第几秒开始用（开场第 0 秒 = 素材这一秒）"),
    matte: z.string().optional().describe("抠像前景：带透明通道的 webm（python scripts/pro/matte.py 生成）。只有「身后飞标题」用得上"),
    focusX: z.number().default(0.5).describe("人脸中心 x（0~1，推镜/收圈都围着它）"),
    focusY: z.number().default(0.36).describe("人脸中心 y（0~1）"),
    audio: z.boolean().default(true).describe("播放素材原声（全片 TTS 时设 false）"),
    volume: z.number().default(1),
  })
  .optional()
  .describe("真人素材；留空则用纯图形背景");
export type Person = z.infer<typeof personSchema>;

// 每个模板都带的公共字段
export const common = <L extends string>(look: L) => ({
  look: z.enum(["noir", "ice", "blood", "neon", "acid", "paper"]).default(look as any).describe("调色：noir 黑金 / ice 冰蓝 / blood 血红 / neon 赛博 / acid 酸性 / paper 纸白"),
  palette: z.record(z.string(), z.string()).optional().describe("覆盖调色里的某几个颜色，如 { \"accent\": \"#ff3355\" }"),
  person: personSchema,
  sfx: z.boolean().default(true).describe("音效开关"),
  sfxVol: z.number().default(1).describe("音效总音量倍数"),
  grain: z.number().optional().describe("胶片颗粒 0~1（缺省用调色自带）"),
});

// 相机：作用在真人画面上（围绕人脸缩放）
export type Cam = { zoom?: number; x?: number; y?: number; rot?: number; filter?: string };

// 真人画面，铺满父容器。freeze = 定格在第几秒（相对开场开始）。
export const PersonMedia: React.FC<{ person: NonNullable<Person>; cam?: Cam; matte?: boolean; freeze?: number; style?: React.CSSProperties }> = ({ person, cam = {}, matte, freeze, style }) => {
  const { fps } = useVideoConfig();
  const asset = useAsset();
  const src = asset(matte ? person.matte! : person.src);
  const fit: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: `${person.focusX * 100}% ${person.focusY * 100}%`, display: "block" };
  const media =
    person.kind === "image" && !matte ? (
      <Img src={src} style={fit} />
    ) : (
      <OffthreadVideo src={src} muted transparent={!!matte} trimBefore={Math.round(person.start * fps)} style={fit} />
    );
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${person.focusX * 100}% ${person.focusY * 100}%`,
        transform: `translate(${cam.x ?? 0}px, ${cam.y ?? 0}px) scale(${cam.zoom ?? 1}) rotate(${cam.rot ?? 0}deg)`,
        filter: cam.filter,
        ...style,
      }}
    >
      {freeze !== undefined ? <Freeze frame={Math.max(0, Math.round(freeze * fps))}>{media}</Freeze> : media}
    </div>
  );
};

// 没有真人时的背景：缓慢流动的光雾
export const Backdrop: React.FC<{ look: Look; t: number }> = ({ look, t }) => (
  <AbsoluteFill style={{ background: look.bg }}>
    <div style={{ position: "absolute", inset: "-20%", background: `radial-gradient(circle at ${50 + Math.sin(t * 0.5) * 12}% ${45 + Math.cos(t * 0.4) * 8}%, ${look.bg2} 0%, ${look.bg} 55%)` }} />
  </AbsoluteFill>
);

// 中文粗体：随包带的 Noto Sans SC 可变字体（100~900），任何系统都有 Black 字重
let fontReady: Promise<void> | null = null;
export const PRO_FONT = "ProSans";
const useProFont = () => {
  const asset = useAsset();
  const [h] = useState(() => delayRender("pro font"));
  useEffect(() => {
    if (!fontReady) {
      const f = new FontFace(PRO_FONT, `url(${asset("fonts/NotoSansSC-VF.ttf")})`, { weight: "100 900" });
      fontReady = f
        .load()
        .then((ff) => {
          (document.fonts as any).add(ff);
        })
        .catch(() => undefined);
    }
    fontReady.then(() => continueRender(h));
  }, [asset, h]);
};

// 每个模板的根：底色、真人原声、音效开关、颗粒 + 暗角盖在最上面
export const ProRoot: React.FC<{ d: { look: string; palette?: Record<string, string>; person?: Person; sfx: boolean; sfxVol: number; grain?: number }; children: (look: Look) => React.ReactNode }> = ({ d, children }) => {
  useProFont();
  const look = resolveLook(d.look, d.palette as Partial<Look>);
  const { fps } = useVideoConfig();
  const asset = useAsset();
  const p = d.person;
  return (
    <SfxScope on={d.sfx} vol={d.sfxVol}>
      <AbsoluteFill style={{ background: look.bg, overflow: "hidden" }}>
        {children(look)}
        <Vignette amount={look.vignette * 0.85} />
        <Grain amount={d.grain ?? look.grain} dark={!isLight(look.bg)} />
        {p && p.audio && p.kind === "video" && <Audio src={asset(p.src)} trimBefore={Math.round(p.start * fps)} volume={p.volume} />}
      </AbsoluteFill>
    </SfxScope>
  );
};
