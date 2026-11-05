import React from "react";
import { z } from "zod";
import { clamp, prog } from "../../lib/anim";
import { useBox } from "../../lib/box";
import { useEnter } from "../../lib/enter";
import { Sfx } from "../../lib/sfx";
import { alpha, useTheme } from "../../lib/theme";
import { fitFont } from "../../lib/ui";
import { Icon } from "../../lib/icons";
import type { CompDef, CompProps } from "../types";

// 仓库名片（原生字卡）：仓库名 + 星数全部用本片字体直接排，不再贴 GitHub 页头截图。
// 旧版是白底 + 名称裁片 + Star 按钮裁片；平台审核把这块最醒目的外来 UI 判成
// 「无效水印」，即便只裁名称与星标，白卡本身仍然像一张贴上去的水印条。
// 现在信息（名字、星数）全部保留，第三方页面像素、按钮、白底一个不留。
const schema = z.object({
  kicker: z.string().optional().describe("左上角小标签，如「第一个 · 真实仓库」"),
  name: z.string().describe("仓库名纯文字，如 video-shotcraft；不再使用页头截图"),
  stars: z.string().optional().describe("星数纯文字，如 12.7k / 216；仓库内 skill 没有独立星标就不给"),
  tag: z.string().optional().describe("名片下的分类短标签，如「产品片」「35+ 风格」"),
  tagAt: z.number().optional().describe("分类标签出现的时刻（锚点或帧）"),
  nameAt: z.number().optional().describe("名片出现的时刻（锚点或帧）；缺省=本镜开头"),
  starAt: z.number().optional().describe("星数弹出的时刻；缺省=名片出现后 10 帧"),
  index: z.string().optional().describe("背景大序号，如 01 / 02"),
  // 「去水印形态」模式：讲到某一段落里如果已经出现过一次名片，后面的就不再来第二张卡。
  // 为什么要有这个模式：深色原生名片仍然是「圆角边框卡 + 英文账号名 + REPO/STARS + ★计数」，
  // 这正好是平台机审「无效水印 / 账号引流」那一类要抓的形态 —— 一个固定位置的、带 follower 数
  // 一样的英文 handle 条。plain 模式下这些一个都不留：无卡框、无英文标签、无星数、无第三方像素，
  // 只有中文一句话定位 + 一个我们自己的矢量图标，信息量靠台词和字幕传。
  plain: z.boolean().optional().describe("true=不画名片框，只排中文（无 REPO/STARS 英文标签、无星数、无卡框）"),
  icon: z.string().optional().describe("plain 模式下的图标名（src/lib/icons.tsx，如 film/palette/mic/box）"),
});
type D = z.infer<typeof schema>;

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, variant }) => {
  const t = useTheme();
  const enterAt = useEnter(variant);
  const { width } = useBox();

  const nameAt = d.nameAt ?? 2;
  const starAt = d.starAt ?? nameAt + 10;
  const tagAt = d.tagAt ?? starAt + 12;

  const eCard = enterAt(frame, nameAt, { fallback: "rise", dur: 18, from: 0.94 });
  const eStar = enterAt(frame, starAt, { fallback: "drop", dur: 12, from: 0.6 });
  const eTag = enterAt(frame, tagAt, { fallback: "rise", dur: 12, dist: 0.5 });

  const hasStar = !!d.stars;
  const cw = Math.min(width - 240, 1560);
  const ch = 264;
  const cx = (width - cw) / 2;
  const cy = 404;
  const padX = 88;
  // 星数在右侧单独占一列；长仓库名用 fitFont 压到这一列之外，绝不换行。
  const starW = hasStar ? 356 : 0;
  const nameMax = cw - padX * 2 - starW;
  const nameSize = fitFont(d.name, nameMax, 96, 44);

  // 星数弹出时的一圈扩散：纯 div，避免把 cine 工具包拉进正片组件。
  const burst = clamp(prog(frame, starAt, 20));
  const burstOn = frame >= starAt && burst < 1;

  // 卡片上一道很慢的扫光，让静态字卡不是死帧；只用主题色，不再用白色亮带。
  const sweep = (frame / Math.max(1, dur)) * 1.5 - 0.25;

  // ---- plain：无卡框 / 无英文标签 / 无计数，只有中文一句话 + 图标 ----
  if (d.plain) {
    const eIcon = enterAt(frame, nameAt, { fallback: "zoom-through", dur: 16, from: 0.72 });
    const nameSize = fitFont(d.name, Math.min(width - 300, 1420), 128, 62);
    const drift = Math.sin(frame / 34) * 5;
    return (
      <>
        {d.index && (
          <div
            style={{
              position: "absolute",
              left: 34,
              top: 176,
              fontFamily: t.font.title,
              fontWeight: 900,
              fontSize: 420,
              lineHeight: 0.82,
              letterSpacing: -18,
              color: alpha(t.primary, 0.075),
              textShadow: `0 0 80px ${alpha(t.primary, 0.12)}`,
              transform: `translateY(${Math.sin(frame / 38) * 6}px)`,
            }}
          >
            {d.index}
          </div>
        )}
        {d.kicker && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 176,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
              opacity: clamp(eCard.opacity),
              transform: `translateY(${eCard.dy * 0.4}px)`,
            }}
          >
            <span style={{ width: 54, height: 2, background: alpha(t.primary, 0.7), boxShadow: `0 0 10px ${alpha(t.primary, 0.6)}` }} />
            <span style={{ fontFamily: t.font.mono, fontSize: 24, letterSpacing: 5, color: t.primary, whiteSpace: "nowrap" }}>{d.kicker}</span>
            <span style={{ width: 54, height: 2, background: alpha(t.primary, 0.7), boxShadow: `0 0 10px ${alpha(t.primary, 0.6)}` }} />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 300,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 44,
            transform: `translateY(${drift + eCard.dy * 0.5}px)`,
          }}
        >
          {d.icon && (
            <div style={{ position: "relative", width: 208, height: 208 }}>
              <div
                style={{
                  position: "absolute",
                  inset: -46,
                  background: `radial-gradient(circle at 50% 46%, ${alpha(t.primary, 0.26)} 0%, transparent 68%)`,
                  opacity: 0.75 + 0.25 * Math.sin(frame / 11),
                }}
              />
              <Icon
                name={d.icon}
                size={208}
                color={t.primary}
                stroke={2.2}
                style={{
                  position: "relative",
                  opacity: clamp(eIcon.opacity),
                  transform: `scale(${eIcon.scale}) rotate(${(1 - eIcon.scale) * 12}deg)`,
                  filter: `drop-shadow(0 0 26px ${alpha(t.primary, 0.5)})`,
                }}
              />
            </div>
          )}
          <div
            style={{
              fontFamily: t.font.title,
              fontWeight: 900,
              fontSize: nameSize,
              lineHeight: 1.06,
              letterSpacing: 1,
              color: t.text,
              whiteSpace: "nowrap",
              opacity: clamp(eCard.opacity),
              textShadow: `0 6px 40px rgba(0,0,0,.55), 0 0 52px ${alpha(t.primary, 0.24)}`,
            }}
          >
            {d.name}
          </div>
        </div>
        {d.tag && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 700,
              display: "flex",
              justifyContent: "center",
              opacity: clamp(eTag.opacity),
              transform: `translateY(${eTag.dy}px) scale(${eTag.scale})`,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 34px",
                borderRadius: 999,
                background: alpha(t.bg, 0.7),
                border: `2px solid ${alpha(t.primary, 0.62)}`,
                boxShadow: `0 0 30px ${alpha(t.primary, 0.24)}`,
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: fitFont(d.tag, 900, 40, 26),
                letterSpacing: 2,
                color: t.text,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 5, background: t.accent, boxShadow: `0 0 12px ${t.accent}` }} />
              {d.tag}
            </div>
          </div>
        )}
        <Sfx name="impact" at={nameAt} volume={0.3} />
        {d.tag && <Sfx name="pop" at={tagAt} volume={0.22} />}
      </>
    );
  }

  return (
    <>
      {/* 背景序号：只做纵深，不参与信息 */}
      {d.index && (
        <div
          style={{
            position: "absolute",
            left: 34,
            top: 176,
            fontFamily: t.font.title,
            fontWeight: 900,
            fontSize: 420,
            lineHeight: 0.82,
            letterSpacing: -18,
            color: alpha(t.primary, 0.075),
            textShadow: `0 0 80px ${alpha(t.primary, 0.12)}`,
            transform: `translateY(${Math.sin(frame / 38) * 6}px)`,
          }}
        >
          {d.index}
        </div>
      )}

      {/* 名片后的光晕 */}
      <div
        style={{
          position: "absolute",
          left: cx - 150,
          top: cy - 125,
          width: cw + 300,
          height: ch + 250,
          background: `radial-gradient(ellipse at 50% 45%, ${alpha(t.primary, 0.2)} 0%, ${alpha(t.primary, 0.06)} 44%, transparent 72%)`,
          opacity: clamp(eCard.opacity),
          transform: `scale(${0.96 + 0.04 * Math.sin(frame / 46)})`,
          pointerEvents: "none",
        }}
      />

      {/* 深色原生名片：没有任何第三方页面像素 */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width: cw,
          height: ch,
          borderRadius: 26,
          background: `linear-gradient(135deg, ${alpha(t.bg2, 0.96)} 0%, ${alpha(t.bg, 0.9)} 58%, ${alpha(t.primary, 0.14)} 100%)`,
          border: `1.5px solid ${alpha(t.primary, 0.62)}`,
          boxShadow: `0 34px 110px rgba(0,0,0,.62), inset 0 0 0 1px ${alpha(t.text, 0.05)}, inset 0 0 80px ${alpha(t.primary, 0.06)}, 0 0 70px ${alpha(t.primary, 0.2)}`,
          overflow: "hidden",
          opacity: clamp(eCard.opacity),
          transform: `translateY(${eCard.dy}px) scale(${eCard.scale})`,
        }}
      >
        {/* 顶部主题细线 + 主题色扫光 */}
        <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 3, background: `linear-gradient(90deg, ${t.primary}, ${t.accent}, transparent 88%)`, opacity: 0.95 }} />
        <div
          style={{
            position: "absolute",
            top: -30,
            bottom: -30,
            left: `${sweep * 100}%`,
            width: 220,
            background: `linear-gradient(90deg, transparent, ${alpha(t.primary, 0.16)}, transparent)`,
            transform: "skewX(-12deg)",
            pointerEvents: "none",
          }}
        />
        {/* 左侧主题竖条 */}
        <div style={{ position: "absolute", left: 0, top: 22, bottom: 22, width: 6, borderRadius: 6, background: `linear-gradient(180deg, ${t.primary}, ${alpha(t.accent, 0.5)})`, boxShadow: `0 0 18px ${alpha(t.primary, 0.55)}` }} />
        {/* 四角小括号：技术感，但只是装饰线，不是角标水印 */}
        <div style={{ position: "absolute", left: 18, top: 16, width: 16, height: 16, borderLeft: `2px solid ${alpha(t.primary, 0.55)}`, borderTop: `2px solid ${alpha(t.primary, 0.55)}` }} />
        <div style={{ position: "absolute", right: 18, bottom: 16, width: 16, height: 16, borderRight: `2px solid ${alpha(t.primary, 0.55)}`, borderBottom: `2px solid ${alpha(t.primary, 0.55)}` }} />

        <div
          style={{
            position: "absolute",
            inset: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: padX,
            paddingRight: padX,
            gap: 44,
          }}
        >
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontFamily: t.font.mono, fontSize: 18, letterSpacing: 6, color: alpha(t.primary, 0.9), marginBottom: 16, whiteSpace: "nowrap" }}>
              REPO{d.index ? ` · ${d.index}` : ""}
            </div>
            <div
              style={{
                fontFamily: t.font.title,
                fontWeight: 900,
                fontSize: nameSize,
                lineHeight: 1.02,
                letterSpacing: -1,
                color: t.text,
                whiteSpace: "nowrap",
                textShadow: `0 0 46px ${alpha(t.primary, 0.2)}`,
              }}
            >
              {d.name}
            </div>
          </div>

          {hasStar && (
            <div
              style={{
                position: "relative",
                flex: "0 0 auto",
                textAlign: "right",
                transform: `scale(${eStar.scale})`,
                opacity: clamp(eStar.opacity),
              }}
            >
              {burstOn && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "42%",
                    width: 330 * burst,
                    height: 330 * burst,
                    borderRadius: "50%",
                    border: `${3 * (1 - burst) + 1}px solid ${alpha(t.gold, 0.5 * (1 - burst))}`,
                    transform: "translate(-50%,-50%)",
                    pointerEvents: "none",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: -34,
                  background: `radial-gradient(ellipse at 60% 45%, ${alpha(t.gold, 0.24)} 0%, transparent 68%)`,
                  opacity: 0.7 + 0.3 * Math.sin(frame / 9),
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 10 }}>
                <span style={{ fontSize: 38, lineHeight: 1, color: t.gold, textShadow: `0 0 22px ${alpha(t.gold, 0.55)}` }}>★</span>
                <span style={{ fontFamily: t.font.title, fontWeight: 900, fontSize: fitFont(d.stars!, 232, 68, 38), lineHeight: 1, color: t.text, whiteSpace: "nowrap" }}>
                  {d.stars}
                </span>
              </div>
              <div style={{ position: "relative", marginTop: 12, fontFamily: t.font.mono, fontSize: 15, letterSpacing: 5, color: alpha(t.dim, 0.95) }}>STARS</div>
            </div>
          )}
        </div>

        {/* 底部主题发丝线 */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, ${alpha(t.primary, 0.75)}, ${alpha(t.accent, 0.45)}, transparent)` }} />
      </div>

      {/* 分类短标签 */}
      {d.tag && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: cy + ch + 30,
            display: "flex",
            justifyContent: "center",
            opacity: clamp(eTag.opacity),
            transform: `translateY(${eTag.dy}px) scale(${eTag.scale})`,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 28px",
              borderRadius: 999,
              background: alpha(t.bg, 0.86),
              border: `2px solid ${alpha(t.primary, 0.75)}`,
              boxShadow: `0 0 30px ${alpha(t.primary, 0.28)}`,
              fontFamily: t.font.title,
              fontWeight: 900,
              fontSize: fitFont(d.tag, 760, 34, 24),
              letterSpacing: 2,
              color: t.text,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 5, background: t.accent, boxShadow: `0 0 12px ${t.accent}` }} />
            {d.tag}
          </div>
        </div>
      )}

      {/* 名片上方的小标签：走居中一行，避开顶部 HUD 和章名 */}
      {d.kicker && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: cy - 78,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            opacity: clamp(eCard.opacity),
            transform: `translateY(${eCard.dy * 0.4}px)`,
          }}
        >
          <span style={{ width: 54, height: 2, background: alpha(t.primary, 0.7), boxShadow: `0 0 10px ${alpha(t.primary, 0.6)}` }} />
          <span style={{ fontFamily: t.font.mono, fontSize: 24, letterSpacing: 5, color: t.primary, whiteSpace: "nowrap" }}>{d.kicker}</span>
          <span style={{ width: 54, height: 2, background: alpha(t.primary, 0.7), boxShadow: `0 0 10px ${alpha(t.primary, 0.6)}` }} />
        </div>
      )}

      <Sfx name="impact" at={nameAt} volume={0.34} />
      {hasStar && <Sfx name="ding" at={starAt} volume={0.3} />}
      {d.tag && <Sfx name="pop" at={tagAt} volume={0.22} />}
    </>
  );
};

export const RepoId: CompDef<D> = {
  id: "repo-id",
  name: "仓库名片（原生字卡 · 名称 + 星数）",
  layer: "screen",
  variants: 2,
  minSec: 2,
  maxSec: 12,
  tags: ["GitHub", "仓库", "skill", "名称", "星标", "证据", "名片"],
  motion: { kind: "深色字卡升起 + 星数弹出（金圈扩散）+ 分类标签落下", energy: 2 },
  desc: "两种形态：默认是一张深色原生名片（仓库名 + 星数，不贴任何第三方页面像素）；plain=true 时不画卡框、不写 REPO/STARS/★计数，只排中文一句话定位 + 一个矢量图标",
  use:
    "点到某个仓库/skill 的名字，只需要证明它存在、有多少星。name 写仓库名、stars 写星数（纯文字），没有独立星标就只给 name；不要再用页头截图。注意：名片是「固定位置 + 英文 handle + 计数」的形态，平台机审里这就是账号引流/无效水印的样子，一条片里不要连用超过一两次；一段里已经出现过名片，后面的改用 plain:true + 中文 name + icon（送审被驳回时优先把英文 handle 和星数撤掉）。",
  schema,
  assetFields: [],
  example: {
    kicker: "第一个 · 真实仓库",
    name: "video-shotcraft",
    stars: "12.7k",
    tag: "产品片",
    index: "01",
  },
  C,
};
