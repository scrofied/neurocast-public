import React from "react";
import { z } from "zod";
import { Img } from "remotion";
import { clamp, easeIn, easeInOut, easeOut, easeOutBack, lerp, prog } from "../../lib/anim";
import { assetUrl } from "../../lib/asset";
import { brandForName } from "../../lib/brands";
import { Icon } from "../../lib/icons";
import { Sfx } from "../../lib/sfx";
import type { CompDef, CompProps } from "../../components/types";
import { cam, tpl } from "../templates/kit";

// 《连胡彦斌都在用的AI工具TRAE，到底有多牛呢？》专属开场（2026-10-24）
// 用户口径：「开场 0-1 秒要出现我的全屏的口播画面，然后切到胡彦斌…（真人白描边杂志风），
// 然后 trae 的图标在背后，再接着列出字节的图标，抖音的图标，豆包的图标，最后列出 trae 的图标」
// ＋「真人口播画面要在人物的两侧做动效，不要挡住人脸」「要有转场和出入场的动效」「trae 是绿色 logo」。
//
// 四拍（帧）：
// ① 0 → 30：真人全屏。只在人物**两侧**做动效（中间那张脸完全空着）：
//    左栏＝绿色 TRAE 应用图标 + 标题小字 + 绿线；右栏＝大字问句 + 红线 + 一行小字。
//    18 帧起两侧一起滑出退场。
// ② 30 → 130：闪白转场（23 帧起爆白、30 帧峰值、35 帧收）→ 深紫环境光杂志页：
//    真人白描边 cutout 贴右侧版面，绿色 TRAE 图标垫在他**后面**（右下角被肩膀压住 + 投影），
//    左侧是杂志标题区（kicker / TRAE / 到底有多牛？/ 红线）。
// ③ 130 → 210：标题区收进左上角，字节跳动 / 抖音 / 豆包 三张真标识卡按配音词时依次飞入左栏，
//    真人 + 绿色图标继续在右半幅。
// ④ 210 → 255：三张卡与真人退场，绿色 TRAE 图标从人后面飞到正中收束，
//    红色「战略级产品」印章砸下 + 收尾标签。
//
// 时基：data 里的 photoAt / focusAt / marks[].at 都是「帧」。
// 引擎契约是「缺省帧、声明 sec 才是秒」，而且这条 film 级开场的锚点解析走的是
// timed.mjs:597 的 useSec=false 分支（cueUnit 只对嵌套 slot 生效）——
// 所以组件里一律按帧算，分镜里写秒（引擎负责换算），不要在组件里再乘一次 30。
//
// 人名不写成屏幕文字（人名只在配音里），画面给的是从活动视频里截出来的真人白描边。

const BG0 = "#070914"; // 与口播现场一致的近黑蓝底
const BG1 = "#17102f";
const BG2 = "#321657"; // 紫色环境光
const INK = "#f5f2ff";
const RED = "#ff756d";
const GREEN = "#45ef8f"; // 官方品牌绿（现场大屏「TRAE」字样取色）
const GREY = "#b7abc9";

// 版面常数（改尺寸只动这里）
const L = {
  cutH: 960, // 白描边真人高度
  cutW: 815, // 900×1060 的等比宽
  cutRight: 120, // 往左挪，好让绿色图标真正被「压在人后面」
  plateC: { x: 1010, y: 420, s: 380 }, // 绿色 TRAE 图标：垫在人后面（人被头发/肩膀压住一截）
  plateF: { x: 960, y: 250, s: 300 }, // 收束到正中
  titleX: 96,
  titleY: 196,
  cardX: 96,
  cardW: 560,
  cardH: 116,
  cardY0: 300,
  cardGap: 140,
};

const s = z.object({
  kicker: z.string().default("连他都在用的 AI 工具"),
  head: z.string().default("TRAE"),
  q: z.string().default("到底有多牛？"),
  tag: z.string().default("字节跳动 · 继抖音、豆包之后"),
  photo: z.string().describe("真人白描边杂志 cutout（assetFields 注入）"),
  marks: z
    .array(z.object({ name: z.string(), note: z.string(), at: z.number() }))
    .default([
      { name: "字节跳动", note: "母公司", at: 139 },
      { name: "抖音", note: "内容生态", at: 162 },
      { name: "豆包", note: "AI 助手", at: 182 },
    ])
    .describe("依次列出的品牌：name=产品名（走真标识库）、note=一行定位、at=弹出时刻（帧；分镜里写秒）"),
  photoAt: z.number().default(30).describe("闪白转场 + 纸页上场（帧；分镜里写秒）"),
  focusAt: z.number().default(210).describe("trae 标识收束到正中（帧；分镜里写秒）"),
  seal: z.string().default("战略级产品"),
  leadCaption: z.string().default("连他都在用的").describe("首句人名脱敏后的开场字幕"),
  leadCaptionUntil: z.number().default(35).describe("首句安全字幕退出帧，与后续脱敏逐字轨衔接"),
  kind: z.string().optional(),
  aspect: z.number().optional(),
});
type D = z.infer<typeof s>;

// ── 绿色 TRAE 应用标识 ────────────────────────────────────────────
// 现场大屏上的真实形态：绿色圆角方块 + 深色屏幕 + 屏幕里两个浅绿点。
// 品牌库里的 trae.svg 是黑色 Simple Icons 路径（<Icon> 走 BrandMark 原样当图片读、不染色），
// 所以这里自己画一份矢量，不依赖品牌库。
const TraeApp: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => {
  const gid = `traeg${Math.round(size)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#79ffb4" />
          <stop offset="0.5" stopColor={GREEN} />
          <stop offset="1" stopColor="#1fbf6e" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5.2" fill={`url(#${gid})`} />
      <rect x="4.3" y="4.2" width="15.4" height="12.3" rx="1.5" fill="#0b1014" />
      <circle cx="9.7" cy="10.35" r="1.45" fill={GREEN} />
      <circle cx="14.3" cy="10.35" r="1.45" fill={GREEN} />
    </svg>
  );
};

// 重击落点的双层冲击环。只存在 12 帧，不用常亮光效假装动感。
const ImpactRings: React.FC<{ x: number; y: number; size: number; at: number; frame: number }> = ({ x, y, size, at, frame }) => (
  <>
    {[0, 3].map((delay, i) => {
      const k = clamp(prog(frame, at + delay, 12));
      if (k <= 0 || k >= 1) return null;
      const d = size * (0.58 + k * (i === 0 ? 1.9 : 2.35));
      return (
        <div
          key={delay}
          style={{
            position: "absolute",
            left: x - d / 2,
            top: y - d / 2,
            width: d,
            height: d,
            borderRadius: "50%",
            border: `${Math.max(2, 12 * (1 - k))}px solid ${i === 0 ? GREEN : "#d9c8ff"}`,
            boxShadow: `0 0 ${34 * (1 - k)}px ${i === 0 ? "rgba(69,239,143,0.8)" : "rgba(166,116,255,0.65)"}`,
            opacity: (1 - k) * (i === 0 ? 0.95 : 0.65),
          }}
        />
      );
    })}
  </>
);

// 落地重击：瞬间放大 → 快速回弹 → 衰减稳定。
const punch = (frame: number, at: number, amount = 0.4) => {
  const t = frame - at;
  return t < 0 ? 1 : 1 + amount * Math.exp(-t / 5) * Math.cos(t * 0.9);
};

// ── ① 真人全屏两侧动效 ───────────────────────────────────────────
// 人脸在 x≈810~1130、y≈140~560；肩背在底部 x≈520~1500。
// 所以左栏放 x<520、右栏放 x>1500，中间 810~1130 一律空着（不挡脸）。
const SideFx: React.FC<{ d: D; frame: number }> = ({ d, frame }) => {
  const out = clamp(easeIn(prog(frame, 18, 11))); // 退场
  const o = 1 - out;
  const scrimIn = clamp(prog(frame, 0, 8));

  const iconK = easeOutBack(prog(frame, 2, 14));
  const kickK = easeOutBack(prog(frame, 6, 13));
  const qK = easeOutBack(prog(frame, 6, 13));
  const ruleK = clamp(easeOut(prog(frame, 11, 9)));
  const subK = clamp(easeOut(prog(frame, 15, 9)));

  const decoL = [
    { x: 404, y: 700, s: 15, c: GREEN, d: 0 },
    { x: 320, y: 880, s: 9, c: GREEN, d: 9 },
    { x: 452, y: 960, s: 11, c: "#f2937c", d: 18 },
    { x: 268, y: 560, s: 12, c: "#dfe8f2", d: 26 },
  ];
  const decoR = [
    { x: 1396, y: 320, s: 13, c: "#f2937c", d: 4 },
    { x: 1432, y: 640, s: 9, c: GREEN, d: 14 },
    { x: 1372, y: 880, s: 16, c: "#dfe8f2", d: 24 },
  ];

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* 两侧压暗：只压边，不做中央暗角（中央是脸，必须亮） */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 660,
          height: 1080,
          background: "linear-gradient(90deg, rgba(4,8,14,0.92) 0%, rgba(4,8,14,0.58) 44%, rgba(4,8,14,0) 100%)",
          opacity: scrimIn * o,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: 620,
          height: 1080,
          background: "linear-gradient(270deg, rgba(4,8,14,0.92) 0%, rgba(4,8,14,0.56) 46%, rgba(4,8,14,0) 100%)",
          opacity: scrimIn * o,
        }}
      />

      {/* 左栏：绿色 TRAE 图标 + 标题小字 + 绿线 */}
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 150,
          opacity: clamp(iconK * 2.4) * o,
          transform: `translateX(${(1 - Math.min(1.02, iconK)) * -90}px) rotate(${-9 + 6 * Math.min(1, iconK)}deg)`,
          filter: "drop-shadow(0 14px 34px rgba(69,239,143,0.42))",
        }}
      >
        <TraeApp size={124} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 322,
          fontFamily: '"Microsoft YaHei UI","Microsoft YaHei",sans-serif',
          fontWeight: 900,
          fontSize: 52,
          lineHeight: 1.16,
          letterSpacing: 2,
          color: "#f7f2e6",
          textShadow: "0 6px 26px rgba(0,0,0,0.8)",
          opacity: clamp(kickK * 2.2) * o,
          transform: `translateX(${(1 - Math.min(1.02, kickK)) * -70}px)`,
        }}
      >
        连他都在用的
        <br />
        AI 工具
      </div>
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 470,
          width: 240,
          height: 8,
          background: GREEN,
          transformOrigin: "left center",
          transform: `scaleX(${ruleK})`,
          opacity: ruleK * o,
        }}
      />

      {/* 右栏：问句大字 + 红线 + 一行小字 */}
      <div
        style={{
          position: "absolute",
          right: 56,
          top: 236,
          textAlign: "right",
          fontFamily: '"Microsoft YaHei UI","Microsoft YaHei",sans-serif',
          fontWeight: 900,
          fontSize: 92,
          lineHeight: 1.08,
          letterSpacing: 2,
          color: "#f7f2e6",
          textShadow: "0 8px 30px rgba(0,0,0,0.85)",
          opacity: clamp(qK * 2.2) * o,
          transform: `translateX(${(1 - Math.min(1.02, qK)) * 80}px)`,
        }}
      >
        到底
        <br />
        <span style={{ color: "#f2937c" }}>有多牛？</span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 56,
          top: 512,
          width: 250,
          height: 8,
          background: RED,
          transformOrigin: "right center",
          transform: `scaleX(${ruleK})`,
          opacity: ruleK * o,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 56,
          top: 556,
          fontFamily: '"Microsoft YaHei UI","Microsoft YaHei",sans-serif',
          fontSize: 26,
          letterSpacing: 3,
          color: "#cbd6e2",
          textShadow: "0 4px 18px rgba(0,0,0,0.8)",
          opacity: subK * o,
          transform: `translateX(${(1 - subK) * 40}px)`,
        }}
      >
        {d.tag}
      </div>

      {/* 两侧漂浮小方块（保证这一拍画面一直在动） */}
      {[...decoL, ...decoR].map((p, i) => {
        const t = (frame * 0.85 + i * 53) % 150;
        const k = clamp(prog(frame, i * 2, 10));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y - t,
              width: p.s,
              height: p.s,
              background: p.c,
              opacity: k * o * (0.25 + 0.55 * Math.sin((t / 150) * Math.PI)),
              transform: `rotate(${frame * 0.6 + i * 20}deg)`,
            }}
          />
        );
      })}
    </div>
  );
};

// ── ② 杂志标题区（可收进左上角；每个元件分开入场） ─────────────────
// 参考「阿里巴巴员工数」那条片的开场：kicker、每个字母、问句、红条不是一起出现，
// 而是按 2~3 帧的间隔逐件落位，最后才凑成完整版面。
const TitleBlock: React.FC<{ d: D; shrink: number; opacity: number; punch?: number; frame: number; photoAt: number }> = ({ d, shrink, opacity, punch: punchScale = 1, frame, photoAt }) => {
  const sc = (1 - 0.5 * shrink) * punchScale;
  const kick = easeOut(clamp((frame - photoAt - 8) / 12));
  const letters = Array.from(d.head);
  const qIn = easeOut(clamp((frame - photoAt - 26) / 13));
  const ruleIn = easeInOut(clamp((frame - photoAt - 30) / 12));
  return (
    <div
      style={{
        position: "absolute",
        left: L.titleX,
        top: L.titleY,
        transformOrigin: "left top",
        transform: `translateY(${-116 * shrink}px) scale(${sc})`,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: '"Microsoft YaHei UI","Microsoft YaHei",sans-serif',
          fontWeight: 900,
          fontSize: 32,
          letterSpacing: 10,
          color: GREY,
          marginBottom: 14,
          opacity: kick,
          transform: `translateX(${(1 - kick) * -26}px)`,
          clipPath: kick >= 0.999 ? undefined : `inset(0 ${(1 - kick) * 100}% 0 0)`,
        }}
      >
        {d.kicker}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: '"Microsoft YaHei UI","Microsoft YaHei",sans-serif',
          fontWeight: 900,
          fontSize: 164,
          lineHeight: 1,
          letterSpacing: 2,
          color: INK,
        }}
      >
        {letters.map((ch, i) => {
          const p = easeOutBack(clamp((frame - photoAt - 12 - i * 3) / 12));
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: clamp(p * 2.4),
                transform: `translateY(${(1 - Math.min(1, p)) * 118}px) rotate(${(1 - Math.min(1, p)) * 9}deg)`,
                textShadow: `0 ${(1 - Math.min(1, p)) * 26}px 30px rgba(0,0,0,0.5)`,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
      <div
        style={{
          fontFamily: '"Microsoft YaHei UI","Microsoft YaHei",sans-serif',
          fontWeight: 900,
          fontSize: 62,
          letterSpacing: 6,
          color: RED,
          marginTop: 12,
          opacity: qIn,
          transform: `translateY(${(1 - qIn) * 28}px)`,
          clipPath: qIn >= 0.999 ? undefined : `inset(0 0 ${(1 - qIn) * 100}% 0)`,
        }}
      >
        {d.q}
      </div>
      <div style={{ width: 320, height: 9, background: RED, marginTop: 24, transformOrigin: "left center", transform: `scaleX(${ruleIn})`, opacity: ruleIn }} />
    </div>
  );
};

// ── ③ 一张品牌卡（真标识 + 一行定位；三张各走一种入场） ──────────────
const BrandCard: React.FC<{
  name: string;
  note: string;
  at: number;
  frame: number;
  top: number;
  out: number;
  index: number;
}> = ({ name, note, at, frame, top, out, index }) => {
  const k = easeOutBack(prog(frame, at, 16));
  if (k <= 0.001) return null;
  const e = Math.min(1.04, k);
  // 0 左推 / 1 上落 / 2 侧旋推入 —— 三张不重样，但都收在同一左栏里
  const mode = index % 3;
  const dx = mode === 0 ? -150 * (1 - e) : mode === 2 ? 96 * (1 - e) : 0;
  const dy = mode === 1 ? -128 * (1 - e) : 0;
  const rot = (mode === 2 ? -3.2 : mode === 1 ? 1.2 : 0) * (1 - e);
  const drift = Math.sin((frame - at) / 26) * 2.5;
  const iconK = easeOutBack(clamp((frame - at - 6) / 13));
  const noteK = easeOut(clamp((frame - at - 10) / 11));
  const dark = brandForName(name)?.file === "douyin.svg";
  return (
    <div
      style={{
        position: "absolute",
        left: L.cardX,
        top,
        width: L.cardW,
        height: L.cardH,
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "0 26px",
        background: "rgba(20,15,43,0.92)",
        border: "2px solid rgba(194,166,255,0.30)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)",
        opacity: clamp(k * 2.2) * (1 - out),
        transform: `translateX(${dx - out * 180}px) translateY(${dy + drift}px) rotate(${rot}deg)`,
        transformOrigin: "left center",
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: 18,
          // 白标识垫深色砖；黑标识垫浅砖，深紫卡片上两种官方标识都清楚。
          background: dark ? "#0b0d17" : "rgba(245,242,255,0.94)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: iconK,
          transform: `scale(${0.72 + 0.28 * Math.min(1, iconK)}) rotate(${(1 - Math.min(1, iconK)) * -18}deg)`,
        }}
      >
        <Icon name={name} size={64} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div
          style={{
            fontFamily: '"Microsoft YaHei UI",sans-serif',
            fontWeight: 900,
            fontSize: 42,
            color: INK,
            letterSpacing: 1,
            opacity: clamp(k * 1.8),
            transform: `translateX(${(1 - e) * 28}px)`,
          }}
        >
          {name}
        </div>
        <div style={{ fontFamily: '"Microsoft YaHei UI",sans-serif', fontSize: 24, color: GREY, letterSpacing: 2, opacity: noteK, transform: `translateX(${(1 - noteK) * 18}px)` }}>{note}</div>
      </div>
      <div style={{ position: "absolute", right: 16, top: 12, fontFamily: 'Consolas,"Cascadia Code",monospace', fontSize: 15, letterSpacing: 2, color: "rgba(183,171,201,.42)" }}>{String(index + 1).padStart(2, "0")}</div>
    </div>
  );
};

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const photoAt = d.photoAt; // 帧：闪白转场 + 纸页上场
  const focusAt = d.focusAt; // 帧：绿色 TRAE 收束到正中
  const firstMark = d.marks[0]?.at ?? 139;

  // 转场：23 帧起爆白 → 30 帧峰值（正好是真人硬切那一帧）→ 35 帧收干净
  const flash = clamp(prog(frame, photoAt - 7, 7)) * (1 - clamp(prog(frame, photoAt, 5)));
  // 纸页淡入
  const pageIn = clamp(easeOut(prog(frame, photoAt - 1, 7)));
  // 两次 TRAE 重击：首次揭示约 1.3s，最终落版约 7.1s。
  const revealAt = photoAt + 9;
  const finalAt = focusAt + 4;
  const plateK = easeOutBack(prog(frame, photoAt + 6, 18));
  const cutK = easeOutBack(prog(frame, photoAt + 6, 18));
  const titleK = easeOutBack(prog(frame, photoAt + 8, 16));
  const shrink = clamp(easeInOut(prog(frame, firstMark - 14, 16)));
  const cardOut = clamp(easeIn(prog(frame, focusAt - 8, 14)));
  const cutOut = clamp(easeIn(prog(frame, focusAt - 12, 18)));
  // 图标快速飞到中心，在 finalAt 真正落地时触发重击，而不是提前空响。
  const fly = easeInOut(prog(frame, focusAt - 4, 8));
  const focusK = easeOutBack(prog(frame, finalAt, 12));
  const sealK = easeOutBack(prog(frame, finalAt + 4, 12));
  const tagK = clamp(easeOut(prog(frame, finalAt + 12, 12)));
  const raysK = easeOut(clamp((frame - finalAt) / 14));
  const burstK = clamp((frame - finalAt) / 22);
  const titleOut = clamp(easeIn(prog(frame, focusAt - 4, 12)));

  const firstPunch = punch(frame, revealAt, 0.42);
  const finalPunch = punch(frame, finalAt, 0.48);
  const plateEnter = frame < revealAt ? 0.68 + 0.32 * clamp(prog(frame, photoAt + 4, 5)) : firstPunch;
  const plateX = lerp(L.plateC.x, L.plateF.x, fly);
  const plateY = lerp(L.plateC.y, L.plateF.y, fly);
  const plateS = lerp(L.plateC.s, L.plateF.s, fly);
  const floatY = Math.sin(frame / 38) * 8 * (1 - fly);
  const shakeAt = (at: number) => {
    const t = frame - at;
    if (t < 0 || t > 12) return { x: 0, y: 0 };
    const amp = 11 * (1 - t / 13);
    return { x: Math.sin(t * 2.31) * amp, y: Math.cos(t * 1.77) * amp * 0.65 };
  };
  const a = shakeAt(revealAt);
  const b = shakeAt(finalAt);
  const shakeX = a.x + b.x;
  const shakeY = a.y + b.y;
  const impactLight = (at: number) => {
    const t = frame - at;
    return t >= 0 && t <= 8 ? (1 - t / 8) * 0.6 : 0;
  };
  const revealLight = impactLight(revealAt);
  const finalLight = impactLight(finalAt);
  const seam = Math.sin(frame / 30) * 0.5 + 0.5;
  void dur;
  void seed;

  return (
    <>
      {/* ── ① 0 → 1s：真人全屏 + 两侧动效 ── */}
      {frame < photoAt + 2 && <SideFx d={d} frame={frame} />}

      {/* ── ②③④ 深紫环境光杂志页：与口播现场的蓝紫色温一致 ── */}
      {pageIn > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            opacity: pageIn,
            background: BG0,
            transform: `translate(${shakeX}px, ${shakeY}px) scale(1.014)`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(112deg, ${BG0} 0%, ${BG1} 52%, ${BG2} 100%)` }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 100% at 4% 38%, rgba(20,107,178,0.24) 0%, rgba(20,107,178,0) 70%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 90% at 82% 38%, rgba(136,63,214,0.32) 0%, rgba(77,36,140,0) 72%)" }} />
          {/* 半调网点与光圈（缓慢漂移，保证画面一直在动） */}
          <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, opacity: 0.72 }}>
            <defs>
              <pattern id="traedots" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform={`translate(${(frame * 0.28) % 18} ${(frame * 0.16) % 18})`}>
                <circle cx="3" cy="3" r="1.5" fill="#d8c9ff" opacity="0.16" />
              </pattern>
            </defs>
            <rect width="1920" height="1080" fill="url(#traedots)" />
            <circle cx={960 + Math.sin(frame / 60) * 12} cy={520} r={430} fill="none" stroke={RED} strokeWidth="2" opacity="0.15" />
            <circle cx={960 + Math.sin(frame / 60) * 12} cy={520} r={300} fill="none" stroke={GREEN} strokeWidth="2" opacity="0.18" />
          </svg>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(112% 92% at 46% 40%, rgba(0,0,0,0) 40%, rgba(2,3,12,0.58) 100%)" }} />
          {/* 重击瞬间的局部亮度脉冲，不全屏泛白。 */}
          {revealLight > 0 && <div style={{ position: "absolute", inset: 0, opacity: revealLight, background: `radial-gradient(circle at ${L.plateC.x}px ${L.plateC.y}px, rgba(69,239,143,0.38) 0%, rgba(112,65,190,0.16) 25%, rgba(0,0,0,0) 58%)` }} />}
          {finalLight > 0 && <div style={{ position: "absolute", inset: 0, opacity: finalLight, background: `radial-gradient(circle at ${L.plateF.x}px ${L.plateF.y}px, rgba(69,239,143,0.42) 0%, rgba(145,89,255,0.18) 28%, rgba(0,0,0,0) 62%)` }} />}
          <ImpactRings x={L.plateC.x} y={L.plateC.y} size={L.plateC.s} at={revealAt} frame={frame} />
          <ImpactRings x={L.plateF.x} y={L.plateF.y} size={L.plateF.s} at={finalAt} frame={frame} />

          {/* ② 绿色 TRAE 图标垫在真人后面（右下角被肩膀压住 + 投影 → 明确前后层次） */}
          {plateK > 0.001 && (
            <div
              style={{
                position: "absolute",
                left: plateX - plateS / 2,
                top: plateY - plateS / 2,
                width: plateS,
                height: plateS,
                transformOrigin: "center center",
                transform: `translateY(${floatY}px) rotate(${lerp(-7, 0, fly)}deg) scale(${plateEnter * (fly >= 1 ? finalPunch : 1)})`,
                opacity: clamp(plateK * 2.2),
                filter: `drop-shadow(0 22px 48px rgba(31,191,110,${0.45 + Math.max(revealLight, finalLight) * 0.5}))`,
              }}
            >
              <TraeApp size={plateS} />
            </div>
          )}

          {/* ② 白描边真人 cutout（杂志贴纸感） */}
          {cutK > 0.001 && (
            <div
              style={{
                position: "absolute",
                right: L.cutRight,
                bottom: 0,
                width: L.cutW,
                height: L.cutH,
                transformOrigin: "center bottom",
                transform: `translateX(${cutOut * 460}px) translateY(${(1 - Math.min(1.04, cutK)) * 80}px) scale(${0.94 + 0.06 * Math.min(1.04, cutK)})`,
                opacity: clamp(cutK * 2.2) * (1 - cutOut),
                filter: "drop-shadow(-18px 22px 36px rgba(27,35,51,0.34))",
              }}
            >
              {d.photo ? <Img src={assetUrl(d.photo)} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null}
            </div>
          )}

          {/* ② 杂志标题区 */}
          {titleK > 0.001 && (
            <div
              style={{
                opacity: clamp(titleK * 2.2) * (1 - titleOut),
                transform: `translateY(${(1 - Math.min(1.04, titleK)) * 46}px)`,
              }}
            >
              <TitleBlock d={d} shrink={shrink} opacity={1} punch={firstPunch} frame={frame} photoAt={photoAt} />
            </div>
          )}

          {/* ③ 品牌卡（真标识；三张各走一种入场） */}
          {d.marks.map((m, i) => (
            <BrandCard
              key={m.name}
              name={m.name}
              note={m.note}
              at={m.at}
              frame={frame}
              top={L.cardY0 + i * L.cardGap}
              out={cardOut}
              index={i}
            />
          ))}

          {/* ④ 收束：放射光 + 粒子 + 绿色 TRAE 逐字母落位 + 问句 + 红章 + 标签 */}
          {focusK > 0.001 && (
            <>
              {/* 收束时的放射光：从字标背后散开，慢速转，像参考片里的日光章 */}
              <div
                style={{
                  position: "absolute",
                  left: 960 - 430,
                  top: 512 - 430,
                  width: 860,
                  height: 860,
                  opacity: raysK * 0.55,
                  background: "repeating-conic-gradient(from 0deg at 50% 50%, rgba(69,239,143,0.30) 0deg 1.4deg, rgba(0,0,0,0) 1.4deg 13deg)",
                  transform: `rotate(${frame * 0.18}deg) scale(${0.7 + 0.3 * raysK})`,
                  WebkitMaskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,.75) 38%, rgba(0,0,0,0) 66%)",
                  maskImage: "radial-gradient(circle, #000 0%, rgba(0,0,0,.75) 38%, rgba(0,0,0,0) 66%)",
                }}
              />
              {/* 重击时炸开的 22 颗粒子 */}
              {Array.from({ length: 22 }, (_, i) => {
                const ang = (i / 22) * Math.PI * 2 + (i % 3) * 0.05;
                const dist = 120 + (i % 5) * 46;
                const pk = easeOut(clamp((frame - finalAt) / 18));
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: 960 + Math.cos(ang) * dist * pk - 3,
                      top: 512 + Math.sin(ang) * dist * 0.62 * pk - 3,
                      width: i % 4 === 0 ? 8 : 5,
                      height: i % 4 === 0 ? 8 : 5,
                      background: i % 3 === 0 ? "#f2937c" : i % 3 === 1 ? "#d9c8ff" : GREEN,
                      opacity: Math.max(0, 1 - burstK) * 0.9,
                      transform: `rotate(${frame * 2 + i * 17}deg)`,
                    }}
                  />
                );
              })}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 452,
                  display: "flex",
                  justifyContent: "center",
                  fontFamily: '"Microsoft YaHei UI",sans-serif',
                  fontWeight: 900,
                  fontSize: 118,
                  letterSpacing: 10,
                  color: GREEN,
                  transform: `scale(${finalPunch})`,
                  textShadow: "0 0 34px rgba(69,239,143,0.42), 0 8px 26px rgba(0,0,0,0.65)",
                }}
              >
                {Array.from("TRAE").map((ch, i) => {
                  const p = easeOutBack(clamp((frame - finalAt - i * 2) / 11));
                  return (
                    <span key={i} style={{ display: "inline-block", opacity: clamp(p * 2.4), transform: `translateY(${(1 - Math.min(1, p)) * 72}px) scale(${0.86 + 0.14 * Math.min(1, p)})` }}>{ch}</span>
                  );
                })}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 576,
                  textAlign: "center",
                  fontFamily: '"Microsoft YaHei UI",sans-serif',
                  fontWeight: 900,
                  fontSize: 54,
                  letterSpacing: 6,
                  color: INK,
                  opacity: easeOut(clamp((frame - finalAt - 9) / 12)),
                  transform: `translateY(${(1 - easeOut(clamp((frame - finalAt - 9) / 12))) * 20}px)`,
                }}
              >
                {d.q}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 686,
                  display: "flex",
                  justifyContent: "center",
                  opacity: clamp(sealK * 2.2),
                  transform: `rotate(-2deg) scale(${1.5 - 0.5 * Math.min(1.04, sealK)})`,
                }}
              >
                <div
                  style={{
                    padding: "14px 38px",
                    border: `5px solid ${RED}`,
                    color: RED,
                    fontFamily: '"Microsoft YaHei UI",sans-serif',
                    fontWeight: 900,
                    fontSize: 58,
                    letterSpacing: 6,
                    background: "rgba(22,12,39,0.76)",
                    boxShadow: "0 0 32px rgba(255,117,109,0.18)",
                  }}
                >
                  {d.seal}
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 846,
                  textAlign: "center",
                  fontFamily: '"Microsoft YaHei UI",sans-serif',
                  fontSize: 32,
                  letterSpacing: 6,
                  color: INK,
                  opacity: tagK,
                }}
              >
                {d.tag}
              </div>
            </>
          )}

          <Sfx name="swish" at={photoAt} volume={0.3} />
          <Sfx name="impact" at={revealAt} volume={0.38} />
          {d.marks.map((m) => (
            <Sfx key={m.name} name="pop" at={m.at + 8} volume={0.28} />
          ))}
          <Sfx name="whoosh" at={focusAt - 4} volume={0.26} />
          <Sfx name="impact" at={finalAt} volume={0.42} />
          <Sfx name="stamp" at={finalAt + 4} volume={0.36} />
          <Sfx name="ding" at={finalAt + 18} volume={0.26} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.03 * seam,
              background: `linear-gradient(180deg, ${GREEN} 0%, rgba(0,0,0,0) 40%)`,
            }}
          />
        </div>
      )}

      {/* ── 转场：闪白（盖住真人硬切那一帧） ── */}
      {flash > 0.001 && <div style={{ position: "absolute", inset: 0, background: "#ffffff", opacity: flash }} />}

      {/* 首句只保留安全替代文案；35 帧后由引擎的脱敏逐字字幕无缝接上。 */}
      {frame < d.leadCaptionUntil && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 52, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div
            style={{
              padding: "6px 26px",
              borderRadius: 12,
              background: "linear-gradient(90deg, transparent, rgba(7,9,20,0.38) 18%, rgba(7,9,20,0.38) 82%, transparent)",
              fontFamily: '"Microsoft YaHei UI","Microsoft YaHei",sans-serif',
              fontWeight: 900,
              fontSize: 50,
              letterSpacing: 2,
              color: "#ffffff",
              WebkitTextStroke: "7px #000",
              paintOrder: "stroke fill",
              whiteSpace: "nowrap",
              opacity: clamp(prog(frame, 0, 5)) * (1 - clamp(prog(frame, d.leadCaptionUntil - 3, 3))),
            }}
          >
            {d.leadCaption}
          </div>
        </div>
      )}
    </>
  );
};

export const OpeningTrae: CompDef<D> = {
  ...tpl<D>({
    id: "opening-trae",
    name: "开场 · 真人全屏两侧动效→白描边真人杂志页→品牌序列→TRAE 收束",
    hook: "真人两侧动效 + 白描边真人 + 绿色 TRAE",
    desc: "0~1s 真人全屏、动效只在人物两侧（左＝绿色 TRAE 图标+标题小字，右＝问句大字），闪白转场；1~4.3s 深紫环境光杂志页，绿色 TRAE 图标带冲击环与回弹重击揭示、垫在白描边真人身后；4.6~6.1s 字节跳动/抖音/豆包 三张真标识卡按配音词时依次飞入左栏；7~8.5s 卡片与真人退场，绿色 TRAE 飞到正中再次重击落版 + 红章「战略级产品」收束",
    use: "只给《连胡彦斌都在用的AI工具TRAE，到底有多牛呢？》用（开场不重样）",
    techniques: ["真人全屏两侧动效", "闪白转场", "白描边真人 cutout", "标识垫底", "真标识卡片序列", "红章收束"],
    schema: s,
    assetFields: ["photo"],
    minSec: 4,
    maxSec: 11,
    C,
    camera: (dd, f) =>
      cam(f, 60, {
        zoomTo: 1.04,
        zoomAt: 0,
        zoomLen: 30,
      }),
  }),
  noGallery: true,
  opening: {
    script: "../../../neurocast-trae",
    hook: "真人两侧动效 + 白描边真人 + 绿色 TRAE",
    techniques: ["真人全屏", "闪白转场", "白描边真人", "绿色标识序列", "红章收束"],
    selfBg: true,
  },
};
