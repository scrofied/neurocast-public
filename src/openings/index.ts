import type { CompDef } from "../components/types";
import { OpeningCommentMining } from "./2026-09-28-comment-mining/Opening";
import { OpeningAiTool4Steps } from "./2026-09-29-ai-tool-4steps/Opening";
import { OpeningModelArena } from "./2026-09-30-model-arena/Opening";
import { OpeningNeverFromZero } from "./2026-10-01-never-from-zero/Opening";
import { OpeningCostBill } from "./2026-10-02-cost-bill/Opening";
import { OPENING_TEMPLATES, TRICK_TEMPLATES } from "./templates";

// Per-script openings (layer "opening"). One folder per video: src/openings/<日期-主题>/Opening.tsx.
// They are archived in openings/library.json (node scripts/openings.mjs sync) and never reused as-is.
export const OPENINGS: CompDef[] = [OpeningCommentMining, OpeningAiTool4Steps, OpeningModelArena, OpeningNeverFromZero, OpeningCostBill, ...OPENING_TEMPLATES, ...TRICK_TEMPLATES];
