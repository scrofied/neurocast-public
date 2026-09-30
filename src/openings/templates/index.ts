import type { CompDef } from "../../components/types";
import { T01Question, T02Number, T03Myth, T04Pain } from "./t01-04";
import { T05Suspense, T06Callout, T07BeforeAfter, T08Warning } from "./t05-08";
import { T09Reveal, T10Countdown, T11Money, T12Rewind } from "./t09-12";
import { T13Versus, T14List, T15Chat, T16Crowd } from "./t13-16";
import { T17News, T18Magnify, T19Bet, T20Glitch } from "./t17-20";
import { Trick01ZoomSuspense, Trick02MorphRhythm, Trick03MaskFocus, Trick04TitleBehind, Trick05InfoFirst } from "./trick-01-05";

// 20 generic opening templates (hook types). Transparent overlays above the person, all text via data,
// every change on an anchor. Pick by the hook of the script's first line; see TEMPLATES.md.
export const OPENING_TEMPLATES: CompDef[] = [
  T01Question, T02Number, T03Myth, T04Pain, T05Suspense,
  T06Callout, T07BeforeAfter, T08Warning, T09Reveal, T10Countdown,
  T11Money, T12Rewind, T13Versus, T14List, T15Chat,
  T16Crowd, T17News, T18Magnify, T19Bet, T20Glitch,
];

// 开场招数模板（按《开场手法素材》的 5 招实现，会直接驱动真人画面）
export const TRICK_TEMPLATES: CompDef[] = [Trick01ZoomSuspense, Trick02MorphRhythm, Trick03MaskFocus, Trick04TitleBehind, Trick05InfoFirst];
