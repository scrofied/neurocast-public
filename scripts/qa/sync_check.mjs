// End-to-end sync check: where each sentence is actually heard in the rendered video vs where the plan put it.
// 1) python scripts/asr_words.py 成片.mp4 成片_asr.json small
// 2) node scripts/qa/sync_check.mjs 文案.md 成片_asr.json public/jobs/<任务>/timeline.json
// Deviations right after sound effects are usually ASR onset bias; confirm with scripts/qa/xcorr_check.py (exact).
import fs from "node:fs";
import { alignText, sentenceSpans, spanTime } from "../lib/align.mjs";
import { parseTimedScript, sectionText } from "../lib/script.mjs";

const [, , scriptPath, asrPath, tlPath] = process.argv;
const parsed = parseTimedScript(fs.readFileSync(scriptPath, "utf8"));
const text = parsed.sections.map((s) => sectionText(s).text).join("");
const asr = JSON.parse(fs.readFileSync(asrPath, "utf8"));
const tl = JSON.parse(fs.readFileSync(tlPath, "utf8"));
const al = alignText(text, asr.words);
console.log(`文案 vs 成片音频 匹配率 ${(al.ratio * 100).toFixed(1)}%`);
const spans = sentenceSpans(al.chars, al.times, 0, al.chars.length);
// planned caption start for the same sentence: first caption whose text starts the sentence
let worst = 0;
let sum = 0;
let n = 0;
for (const [a, b] of spans) {
  const heard = spanTime(al.chars, al.times, a, b);
  const sent = al.chars.slice(a, b).join("").trim();
  const head = sent.replace(/[，。！？；：、\s]/g, "").slice(0, 6);
  const cap = tl.captions.find((c) => c.text.replace(/[，。！？；：、\s]/g, "").startsWith(head));
  if (!cap) continue;
  const planned = cap.t ? cap.t[0] / 30 : cap.start / 30;
  const d = heard.start - planned;
  worst = Math.max(worst, Math.abs(d));
  sum += Math.abs(d);
  n++;
  if (Math.abs(d) > 0.25) console.log(`  偏差 ${d.toFixed(2)}s @ ${heard.start.toFixed(2)}  ${sent.slice(0, 20)}`);
}
console.log(`句子 ${n} 条：平均偏差 ${(sum / n).toFixed(3)}s，最大偏差 ${worst.toFixed(3)}s`);
