import React from "react";
import { staticFile } from "remotion";
import { easeOut, prog } from "./anim";
import { Icon } from "./icons";
import { alpha, useTheme } from "./theme";

// 素材路径统一入口：相对 public/ 的写法走 staticFile，http(s) 原样交给浏览器。
// 组件里别再手写三元判断，免得漏掉 http 分支导致渲染时找不到文件。
export const assetSrc = (p?: string): string | undefined => (p ? (/^https?:/i.test(p) ? p : staticFile(p)) : undefined);
// 已确认存在的路径（在 `{data.src && ...}` 分支里用），返回类型收敛成 string
export const assetUrl = (p: string): string => (/^https?:/i.test(p) ? p : staticFile(p));

// 有素材吗？—— 用于「缺素材就不演」的判断（引擎侧的降级见 scripts/make.mjs）
export const hasAsset = (p?: string) => typeof p === "string" && p.length > 0;

// 缺素材时的降级画面：不黑屏、也不用代码画的假截图冒认真东西，
// 直接把「这里该放哪张真素材」写在片子里，剪辑时一眼能看到要补什么。
export const MissingAsset: React.FC<{
  field: string;
  hint?: string;
  w: number;
  h: number;
  frame: number;
  at?: number;
}> = ({ field, hint, w, h, frame, at = 0 }) => {
  const t = useTheme();
  const p = easeOut(prog(frame, at, 14));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: w,
        height: h,
        borderRadius: 14,
        border: `2px dashed ${alpha(t.primary, 0.55)}`,
        background: alpha(t.bg2, 0.5),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        opacity: 0.5 + 0.5 * p,
        padding: 24,
        textAlign: "center",
      }}
    >
      <Icon name="image" size={54} color={alpha(t.primary, 0.8)} />
      <div style={{ fontFamily: t.font.mono, fontSize: 20, letterSpacing: 2, color: t.primary }}>缺素材 · {field}</div>
      <div style={{ fontFamily: t.font.body, fontWeight: 700, fontSize: 22, lineHeight: 1.5, color: alpha(t.text, 0.85) }}>
        {hint ?? "分镜里没给真实截图/录屏路径"}
      </div>
    </div>
  );
};
