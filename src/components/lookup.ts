import type { CompDef } from "./types";

// filled by registry.ts; lets container components (e.g. the talking-head stage) render other
// registry components by id without a circular import
export const LOOKUP: Record<string, CompDef> = {};
