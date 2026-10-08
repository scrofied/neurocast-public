import type React from "react";
import type { z } from "zod";

// 一个 PRO 开场模板 = 一个自包含的 Remotion 组件 + zod schema（字段即文档）。
// 调用方式：<P.C data={...} duration={秒} />，放进任意 1920x1080（或竖屏）合成里。
export type ProOpening<D = any> = {
  id: string;
  name: string;
  trick: string; // 对应《开场手法》哪一招
  hook: string; // 钩子类型
  desc: string; // 画面是什么
  use: string; // 什么文案适合
  defaultSec: number; // 推荐时长
  schema: z.ZodType<D>;
  example: Partial<D>;
  C: React.FC<{ data: D; duration?: number }>;
};
