import React from "react";
import { z } from "zod";
import { clamp, easeIn, easeOut, lerp, prog } from "../../lib/anim";
import { hitShake, StampBox } from "../../lib/bits";
import { useBox } from "../../lib/box";
import { cueOr } from "../../lib/cue";
import { useEnter } from "../../lib/enter";
import { Icon } from "../../lib/icons";
import { Flash, RingBurst } from "../../lib/cine/Flash";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont, GlowDefs, Heading } from "../../lib/ui";
import type { CompDef, CompProps } from "../types";

const schema = z.object({
  title: z.string().optional(),
  kicker: z.string().optional(),
  heading: z.string().default("仓库可见性").describe("两块选项上方的表单标题"),
  publicLabel: z.string().default("公开").describe("左边那块选项的名字"),
  publicNote: z.string().default("任何人都能翻到").describe("公开那句小字"),
  privateLabel: z.string().default("私有").describe("右边那块选项的名字"),
  privateNote: z.string().default("只有你和授权的 AI").describe("私有那句小字"),
  pickAt: z.number().optional().describe("光标落到「私有」上按下去的时刻（锚点）"),
  sealAt: z.number().optional().describe("锁扣落下的时刻（锚点）"),
  sealText: z.string().default("锁上").describe("盖下的章"),
  verdict: z.string().optional().describe("最后砸出的结论大字"),
  verdictAt: z.number().optional().describe("结论砸出的时刻（锚点）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data, frame, dur, seed, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width: W, height: H } = useBox();
  const full = W >= 900;

  const pickAt = Math.min(cueOr(data.pickAt, dur * 0.34), dur - 34);
  const sealAt = Math.max(cueOr(data.sealAt, pickAt + 22), pickAt + 12);
  const vAt = Math.min(cueOr(data.verdictAt, sealAt + 20), dur - 8);
  const picked = frame >= pickAt;
  const sealed = frame >= sealAt;
  const sh = hitShake(frame, [pickAt, sealAt], full ? 12 : 6, 12, seed);

  // 两块选项卡
  const cw = Math.min(W * (full ? 0.3 : 0.36), full ? 520 : 300);
  const ch = H * (full ? 0.34 : 0.3);
  const cy = H * (full ? 0.46 : 0.44);
  const lx = W * 0.5 - cw - (full ? 34 : 16);
  const rx = W * 0.5 + (full ? 34 : 16);

  // 光标：从下方中间走到右卡
  const cur = easeOut(prog(frame, Math.max(4, pickAt - 20), Math.max(8, pickAt - Math.max(4, pickAt - 20))));
  const cx = lerp(W * 0.5, rx + cw * 0.16, cur);
  const cyy = lerp(H * 0.9, cy + ch * 0.3, cur);
  const click = frame >= pickAt && frame < pickAt + 9 ? 1 - prog(frame, pickAt, 9) : 0;

  // 锁扣：锁梁从上方落进锁体
  const lk = easeIn(prog(frame, sealAt, full ? 12 : 8));
  const lockY = lerp(-ch * 0.22, 0, lk);

  const eStage = enterAt(frame, 0, { fallback: "rise", dur: 16 });
  const eL = enterAt(frame, 2, { fallback: "slide-r", dur: 14 });
  const eR = enterAt(frame, 4, { fallback: "slide-l", dur: 14 });

  const card = (side: "pub" | "priv") => {
    const priv = side === "priv";
    const e = priv ? eR : eL;
    const x = priv ? rx : lx;
    const on = priv && picked;
    const dead = !priv && picked;
    const border = priv ? (sealed ? t.gold : on ? t.primary : alpha(t.dim, 0.7)) : dead ? alpha(t.bad, 0.75) : alpha(t.dim, 0.6);
    const bg = priv ? alpha(sealed ? t.gold : t.primary, sealed ? 0.14 : on ? 0.16 : 0.05) : alpha(t.bg2, dead ? 0.4 : 0.75);
    const radio = full ? 30 : 16;
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: cy - ch / 2,
          width: cw,
          height: ch,
          borderRadius: full ? 22 : 12,
          background: bg,
          border: `${full ? 4 : 2}px solid ${border}`,
          boxShadow: on || sealed ? `0 0 ${full ? 46 : 20}px ${alpha(sealed ? t.gold : t.primary, 0.45)}` : undefined,
          filter: dead ? "grayscale(1)" : undefined,
          opacity: e.opacity * (dead ? 0.5 : 1),
          transform: `translate(${e.dx}px, ${e.dy}px) scale(${e.scale * (on ? 1 + 0.02 * clamp((frame - pickAt) / 8) : 1)})`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: full ? 12 : 6,
          padding: `0 ${full ? 30 : 15}px`,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: full ? 14 : 7 }}>
          {/* 单选点 */}
          <div style={{ width: radio, height: radio, borderRadius: "50%", border: `${full ? 3 : 2}px solid ${on ? t.primary : alpha(t.dim, 0.8)}`, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            {on && <div style={{ width: radio * 0.5, height: radio * 0.5, borderRadius: "50%", background: t.primary, boxShadow: `0 0 ${full ? 16 : 8}px ${t.primary}` }} />}
          </div>
          <Icon name={priv ? "lock" : "globe"} size={full ? 34 : 17} color={priv ? (sealed ? t.gold : t.primary) : dead ? t.bad : t.dim} />
          <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: full ? 52 : 26, color: priv ? t.text : alpha(t.text, dead ? 0.5 : 0.8) }}>
            {priv ? data.privateLabel : data.publicLabel}
          </span>
        </div>
        <div style={{ fontFamily: t.font.body, fontSize: full ? 25 : 13, color: alpha(t.text, priv ? 0.75 : 0.45), paddingLeft: full ? 44 : 22 }}>
          {priv ? data.privateNote : data.publicNote}
        </div>
        {/* 公开被划掉：一道红线横扫 */}
        {dead && !priv && (
          <div style={{ position: "absolute", left: 0, top: "52%", height: full ? 6 : 3, width: cw * easeOut(prog(frame, pickAt + 4, full ? 12 : 8)), background: t.bad, boxShadow: `0 0 14px ${t.bad}` }} />
        )}
        {/* 私有：锁体 + 落下的锁梁 */}
        {priv && (
          <svg width={cw} height={ch} style={{ position: "absolute", right: full ? -10 : -4, bottom: full ? -14 : -6, opacity: picked ? 0.95 : 0.28, pointerEvents: "none" }}>
            <GlowDefs id="vs-lock" std={7} user />
            <g transform={`translate(${cw * 0.62} ${ch * 0.42 + lockY})`}>
              <path d={`M ${full ? -26 : -13} ${full ? -6 : -3} v ${full ? -18 : -9} a ${full ? 26 : 13} ${full ? 14 : 7} 0 0 1 ${full ? 52 : 26} 0 v ${full ? 18 : 9}`} fill="none" stroke={sealed ? t.gold : alpha(t.dim, 0.8)} strokeWidth={full ? 9 : 4} strokeLinecap="round" filter={sealed ? "url(#vs-lock)" : undefined} />
              <rect x={full ? -38 : -19} y={full ? -6 : -3} width={full ? 76 : 38} height={full ? 56 : 28} rx={full ? 12 : 6} fill={alpha(sealed ? t.gold : t.dim, 0.24)} stroke={sealed ? t.gold : alpha(t.dim, 0.85)} strokeWidth={full ? 4 : 2} />
              <circle cx={0} cy={full ? 16 : 8} r={full ? 8 : 4} fill={sealed ? t.gold : alpha(t.dim, 0.8)} />
            </g>
          </svg>
        )}
      </div>
    );
  };

  return (
    <>
      {full && <Heading kicker={data.kicker} title={data.title} frame={frame} width={W} />}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)`, opacity: eStage.opacity, clipPath: eStage.clip }}>
        {/* 表单标题 + 底板 */}
        <div style={{ position: "absolute", left: W * 0.5 - (cw * 2 + (full ? 68 : 32)) / 2, top: cy - ch / 2 - (full ? 64 : 34), fontFamily: t.font.mono, fontSize: full ? 24 : 13, letterSpacing: full ? 3 : 1, color: alpha(t.text, picked ? 0.5 : 0.75) }}>
          {data.heading}
        </div>
        {card("pub")}
        {card("priv")}
        {/* 光标 */}
        {frame >= Math.max(4, pickAt - 20) && (
          <div style={{ position: "absolute", left: cx, top: cyy, transform: `scale(${1 + click * 0.5})`, opacity: frame < sealAt + 6 ? 1 : clamp((sealAt + 12 - frame) / 6) }}>
            <Icon name="cursor" size={full ? 40 : 20} color="#fff" />
            {click > 0 && <RingBurst frame={frame} at={pickAt} x={0} y={0} color={t.primary} maxR={full ? 70 : 34} width={5} />}
          </div>
        )}
        <RingBurst frame={frame} at={sealAt} x={rx + cw * 0.5} y={cy} color={t.gold} maxR={full ? 320 : 160} width={9} />
        <StampBox frame={frame} at={sealAt + 6} text={data.sealText} color={t.gold} x={rx + cw * 0.5} y={cy + ch * 0.42} size={full ? 58 : 28} maxW={cw * 0.8} rot={-5} />
        {data.verdict && <StampBox frame={frame} at={vAt} text={data.verdict} color={t.primary} x={W * 0.5} y={H * (full ? 0.86 : 0.82)} size={full ? 56 : 27} maxW={W * 0.74} rot={1} />}
      </div>
      <Flash frame={frame} at={sealAt} len={full ? 9 : 6} peak={0.22} />
      <Sfx name="whoosh" at={Math.max(4, pickAt - 20)} volume={0.22} />
      <Sfx name="pop" at={pickAt} volume={0.3} />
      <Sfx name="impact" at={sealAt} volume={0.42} />
      <Sfx name="stamp" at={sealAt + 6} volume={0.3} />
      {data.verdict && <Sfx name="ding" at={vAt} volume={0.32} />}
    </>
  );
};

export const VisibilitySeal: CompDef<D> = {
  id: "visibility-seal",
  name: "私有 / 公开落锁",
  layer: "metaphor",
  variants: 1,
  minSec: 3,
  maxSec: 9,
  tags: ["可见性", "私有", "公开", "锁", "权限", "选错", "落锁"],
  motion: { kind: "两块可见性选项卡从左右滑入 → 光标走过去按下「私有」（单选点亮、公开被红线划掉并去色）→ 锁梁落进锁体 + 闪白 + 冲击环 + 盖章 → verdict 大字砸出", energy: 3 },
  desc: "表单式两块选项：左 publicLabel（globe 图标 + publicNote）、右 privateLabel（lock 图标 + privateNote）。pickAt 光标按在私有上：私有单选点亮、卡片发光，公开被一道红线横扫并变灰；sealAt 锁梁从上方落进锁体（变金）、闪白 + 冲击环 + sealText 章；最后 verdict 砸在下方",
  use: "讲「选错一下就把东西暴露给所有人」：仓库可见性、账号私密设置、上传链接的权限、群发的收件人、云盘分享范围",
  schema,
  example: {
    kicker: "新建仓库",
    title: "这一步别选错",
    heading: "仓库可见性",
    publicLabel: "公开",
    publicNote: "任何人都能翻到",
    privateLabel: "私有",
    privateNote: "只有你和授权的 AI",
    sealText: "锁上",
    verdict: "一定要选私有",
  },
  C,
};
