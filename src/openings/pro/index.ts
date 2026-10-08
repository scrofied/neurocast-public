import { P01DollySuspense } from "./p01-dolly-suspense";
import { P02ShatterMorph } from "./p02-shatter-morph";
import { P03IrisTitle } from "./p03-iris-title";
import { P04DepthTitle } from "./p04-depth-title";
import { P05InfoFirst } from "./p05-info-first";
import type { ProOpening } from "./types";

// PRO 开场模板库。新增模板：在这里加一行，Studio / 渲染脚本 / 目录自动可见。
export const PRO_OPENINGS: ProOpening[] = [P01DollySuspense, P02ShatterMorph, P03IrisTitle, P04DepthTitle, P05InfoFirst];

export { ProAssetBase } from "./kit/sfx";
export type { ProOpening } from "./types";
