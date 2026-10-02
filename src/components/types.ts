import type React from "react";
import type { z } from "zod";

export type CompProps<D = any> = {
  data: D;
  frame: number;
  dur: number;
  variant: number;
  seed: number;
  text: string;
};

// metaphor: 抽象概念隐喻 · info: 信息图 · story: 叙事场景 · product: 产品/工具演示
// screen: 截图录屏 · structure: 结构镜头 · overlay: 侧栏/叠加小组件（可放进口播舞台两侧）
// opening: 每条视频专属的开场（透明画布，叠在真人画面上层；src/openings/<日期-主题>/）
export type Layer = "metaphor" | "info" | "story" | "product" | "screen" | "structure" | "overlay" | "fx" | "opening";

// camera moves an opening applies to the person layer underneath it (zoom punch, shake, grade).
// clip = CSS clip-path (遮罩收圈 / 文字蒙版 / 形态突变), radius = container shape, opacity = 延后入画.
export type Cam = {
  zoom?: number;
  x?: number;
  y?: number;
  rot?: number;
  filter?: string;
  tint?: string;
  tintOpacity?: number;
  // 0~1: 人像层整体透明度（第5招「人物延后入画」用 0 让真人先不出场）
  opacity?: number;
  // CSS clip-path 值，如 "circle(20% at 50% 45%)" / "inset(0 40% 0 0)"（第3招收圈、第2招变形）
  clip?: string;
  // 人像窗口圆角，配合 zoom/位置可做人像容器形态突变
  radius?: number;
  // 人像窗口在画面里的位置/尺寸（相对 1920x1080 的比例 0~1）；缺省 = 全屏
  box?: { x?: number; y?: number; w?: number; h?: number };
  // 人像镜像（反差硬切里做「照镜子」感）
  mirror?: boolean;
};

// 组件的动效特征（写分镜时用来错开"动感"，避免连续几镜都是同一种运动）
export type MotionTag = {
  /** 画面里什么东西在动、怎么动：元素聚合 / 路径推进 / 数值滚动 / 图表生长 / 镜头推移 / 逐条点亮 … */
  kind: string;
  /** 适合的强度：1 克制 / 2 标准 / 3 强冲击 */
  energy: number;
};

export type CompDef<D = any> = {
  id: string;
  name: string;
  layer: Layer;
  variants: number;
  minSec: number;
  maxSec: number;
  tags: string[];
  // 动效特征；未标注 = 尚未梳理（CATALOG 里显示「未标注」）
  motion?: MotionTag;
  // 画面是什么（给写分镜的模型看）
  desc?: string;
  // 什么内容该用它（语义，不是关键词）
  use?: string;
  // 画面本身已经把讲的话显示出来了 → 默认隐藏底部字幕，避免重复
  hideCaptions?: boolean;
  // 能放进口播舞台的窄侧栏（组件用 useBox() 自适应尺寸）
  panel?: boolean;
  // 为 true 时 Gallery 不单独生成预览（例如依赖外部视频素材）
  noGallery?: boolean;
  schema: z.ZodType<D>;
  // gallery / catalog example; fields with zod defaults may be omitted
  example: Partial<D>;
  C: React.FC<CompProps<D>>;
  // openings only: drives the talking-head video under the overlay (frame is relative to the opening start)
  camera?: (data: D, frame: number, dur: number) => Cam;
  // openings only: archive info for openings/library.json
  opening?: { script: string; hook: string; techniques: string[]; template?: boolean };
};
