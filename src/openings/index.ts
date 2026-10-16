import type { CompDef } from "../components/types";
import { OpeningCommentMining } from "./2026-09-28-comment-mining/Opening";
import { OpeningAiTool4Steps } from "./2026-09-29-ai-tool-4steps/Opening";
import { OpeningModelArena } from "./2026-09-30-model-arena/Opening";
import { OpeningNeverFromZero } from "./2026-10-01-never-from-zero/Opening";
import { OpeningCostBill } from "./2026-10-02-cost-bill/Opening";
import { OpeningWorkbuddyPay } from "./2026-10-03-workbuddy-pay/Opening";
import { OpeningOpus55FourThings } from "./2026-10-04-opus55-4things/Opening";
import { OpeningWorkbuddy10Tips } from "./2026-10-05-workbuddy-10tips/Opening";
import { OpeningCodex100x } from "./2026-10-06-codex-100x/Opening";
import { OpeningWebpptNow } from "./2026-10-08-webppt-now/Opening";
import { OpeningDbsShatter } from "./2026-10-09-dbs-shatter/Opening";
import { OpeningAiconsoleInfo } from "./2026-10-09-aiconsole-info/Opening";
import { PRO_TEMPLATE_OPENINGS } from "./pro/nc";
import { OPENING_TEMPLATES, TRICK_TEMPLATES } from "./templates";

// Openings (layer "opening").
// · src/openings/<日期-主题>/Opening.tsx —— 为某条文案单独写的开场，归档在 openings/library.json，不复用
// · src/openings/pro/ —— 5 个高规格「开场模板」（口播开场五招），做片时按第一句的钩子类型挑一个，
//   再把文案 / 调色 / 卡点填进去；自成一体（自己铺不透明背景），可以没有真人口播
// · src/openings/templates/ —— 透明叠加层模板（叠在真人画面上），同样按本片文案改数据
// >>> new-video：每条片一个专属开场（scripts/new-video.mjs 维护，别手删这行）
import { OpeningJuniorJobsVanish } from "./2026-10-14-junior-jobs-vanish/Opening";
import { OpeningAiComputerUse } from "./2026-10-11-ai-computer-use/Opening";
import { OpeningCodexVsWb } from "./2026-10-10-codex-vs-wb/Opening";
import { OpeningAiconsoleExplainer } from "./2026-10-09-aiconsole-explainer/Opening";
export const OPENINGS: CompDef[] = [OpeningCommentMining, OpeningAiTool4Steps, OpeningModelArena, OpeningNeverFromZero, OpeningCostBill, OpeningWorkbuddyPay, OpeningOpus55FourThings, OpeningWorkbuddy10Tips, OpeningCodex100x, OpeningWebpptNow, OpeningDbsShatter, OpeningAiconsoleInfo, ...PRO_TEMPLATE_OPENINGS, ...OPENING_TEMPLATES, ...TRICK_TEMPLATES, OpeningAiconsoleExplainer, OpeningCodexVsWb, OpeningAiComputerUse, OpeningJuniorJobsVanish];
