// NeuroCast: 文案 + 配音（+ 口播视频）-> 时间轴对齐 -> 分镜 -> 校验 -> mp4
// usage: node scripts/make.mjs <input.json> [--out out/x.mp4] [--seed N] [--beats] [--plan-only]
//                              [--frames 0-300] [--no-sfx] [--concurrency 12] [--asr-model small]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { plan as planLegacy, PlanError, styleFor, VARIANTS } from "./lib/planner.mjs";
import { parseTimedScript } from "./lib/script.mjs";
import { beatsMarkdown, planTimed, splitOpening, TimedError } from "./lib/timed.mjs";
import { wordsOf } from "./lib/align.mjs";
import { checkKindParity } from "./lib/motion.mjs";
import { loadRegistry, validateShot } from "./lib/registry-node.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const CACHE = path.join(ROOT, ".cache");
const FPS = 30;

const fail = (code, msg) => {
  console.error(`\n✖ 失败 [${code}] ${msg}\n`);
  process.exit(1);
};

// 入场语法列表在渲染侧（src/lib/enter.tsx）和脚本侧（scripts/lib/motion.mjs）各有一份，
// 这里比对，防止两处漂移后静默失效
{
  const _parity = checkKindParity(fs.readFileSync(path.join(ROOT, "src/lib/enter.tsx"), "utf8"));
  if (_parity) fail("E_MOTION_PARITY", _parity);
}
const warnings = [];
const warn = (m) => {
  warnings.push(m);
  console.warn(`⚠ ${m}`);
};

// ---------- args ----------
const VALUED = new Set(["--out", "--seed", "--frames", "--concurrency", "--asr-model"]);
const opt = {};
let inputPath;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUED.has(a)) opt[a] = argv[++i];
  else if (a.startsWith("--")) opt[a] = true;
  else if (!inputPath) inputPath = a;
}
if (!inputPath) fail("E_ARGS", "用法: node scripts/make.mjs <input.json> [--beats] [--plan-only] [--out 路径] [--seed N]");
if (!fs.existsSync(inputPath)) fail("E_INPUT", `找不到输入文件 ${inputPath}`);

const readText = (p) => fs.readFileSync(p, "utf8").replace(/^﻿/, "");
const readJson = (p, code = "E_JSON") => {
  try {
    return JSON.parse(readText(p));
  } catch (e) {
    fail(code, `${p} 不是合法 JSON：${e.message}`);
  }
};
const input = readJson(inputPath);
const baseDir = path.dirname(path.resolve(inputPath));
const resolveIn = (p, dir = baseDir) => (path.isAbsolute(p) ? p : path.resolve(dir, p));
if (opt["--seed"]) input.seed = +opt["--seed"];
if (opt["--no-sfx"]) input.sfx = false;
if (input.timeline && !input.audio_timeline) input.audio_timeline = input.timeline;
const KNOWN = new Set(["script", "script_file", "title", "subtitle", "seed", "skin", "audio", "audio_timeline", "timeline", "opening_video", "opening_timeline", "clip_timelines", "storyboard", "captions", "sfx", "bgm", "cta", "outroTitle", "keywords", "tail", "assets", "tts", "voice", "presenter"]);
for (const k of Object.keys(input)) if (!KNOWN.has(k)) warn(`未知字段 "${k}" 已忽略（可用：${[...KNOWN].join(", ")}）`);
let scriptDir = baseDir;
if (input.script_file) {
  const p = resolveIn(input.script_file);
  if (!fs.existsSync(p)) fail("E_SCRIPT_FILE", `script_file 指向的文件不存在：${p}`);
  input.script = readText(p);
  scriptDir = path.dirname(p);
}
if (typeof input.script !== "string" || !input.script.trim()) fail("E_EMPTY", "缺少 script（讲稿全文）或 script_file");
if (input.skin && !["aurora", "violet", "amber", "matrix", "arctic"].includes(input.skin)) warn(`skin "${input.skin}" 不存在，改为按 seed 选择（可用：aurora/violet/amber/matrix/arctic）`);

const slug = path.basename(inputPath, path.extname(inputPath)).replace(/[^\w一-龥-]+/g, "_").slice(0, 40) || "job";
const d = new Date();
const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
const jobDir = path.join(PUB, "jobs", `${slug}_${stamp}`);
fs.mkdirSync(jobDir, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });
const pubRel = (abs) => path.relative(PUB, abs).replace(/\\/g, "/");

// ---------- media helpers ----------
const sh = (cmd, args, code) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    fail(code, `${cmd} ${args.slice(0, 3).join(" ")} … 失败：${(e.stderr || e.message).toString().split("\n").filter(Boolean).slice(-3).join(" | ")}`);
  }
};
const probe = (abs) => {
  const o = sh("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", abs], "E_ASSET");
  const j = JSON.parse(o);
  const v = j.streams.find((s) => s.codec_type === "video");
  return { duration: +j.format.duration, video: v, hasAudio: j.streams.some((s) => s.codec_type === "audio") };
};
const hashFile = (abs) => {
  const st = fs.statSync(abs);
  return crypto.createHash("md5").update(`${abs}|${st.size}|${st.mtimeMs}`).digest("hex").slice(0, 16);
};
// cached derived media (normalised / transcoded), copied into the job folder
const derived = (abs, kind, ext, make) => {
  const dir = path.join(CACHE, "media");
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${hashFile(abs)}-${kind}.${ext}`);
  if (!fs.existsSync(f)) make(f);
  return f;
};
const LOUD = "loudnorm=I=-16:TP=-1.5:LRA=11";
const asrWords = (abs, what) => {
  const model = opt["--asr-model"] || "small";
  const dir = path.join(CACHE, "asr");
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${hashFile(abs)}-${model}.json`);
  if (!fs.existsSync(f)) {
    console.log(`⏳ 识别${what}的时间轴（faster-whisper ${model}，首次较慢）…`);
    const r = spawnSync("python", [path.join(ROOT, "scripts", "asr_words.py"), abs, f, model], { encoding: "utf8" });
    if (r.status !== 0 || !fs.existsSync(f)) fail("E_TIMELINE_EXTRACT", `${what}时间轴提取失败（需要 pip install faster-whisper）：${(r.stderr || "").split("\n").filter(Boolean).slice(-2).join(" | ")}`);
  }
  return readJson(f, "E_TIMELINE_EXTRACT");
};
const loadTimeline = (p, what) => {
  const abs = resolveIn(p);
  if (!fs.existsSync(abs)) fail("E_AUDIO", `${what}时间轴文件不存在：${abs}`);
  const j = readJson(abs);
  try {
    return { words: wordsOf(j), duration: j.duration };
  } catch (e) {
    fail("E_TIMELINE", `${abs}：${e.message}`);
  }
};

// screenshots / screen recordings referenced by [图:] [录屏:]
// 「点击"按钮名"」in the text right after the marker is located by local OCR -> camera push + simulated click
const focusTargets = (ref) => {
  const i = input.script.indexOf(ref);
  const after = input.script.slice(i, i + 400).split(/\n\s*\n|\[(?:图|截图|录屏|视频|口播)/)[0];
  const out = [];
  for (const m of after.matchAll(/(?:点击|点一下|点开|打开|选择|选中|找到|进入|切换到|输入|勾选)\s*[“"「]?([^，。！？”"」\s]{2,8})/g)) out.push(m[1]);
  return [...new Set(out)].slice(0, 4);
};
const prepAssets = (refs) => {
  const out = {};
  refs.forEach((ref, k) => {
    const abs = resolveIn(ref, scriptDir);
    if (!fs.existsSync(abs)) fail("E_ASSET", `讲稿引用的素材不存在：${ref}（解析为 ${abs}）`);
    const name = `a${k}${path.extname(abs).toLowerCase()}`;
    fs.copyFileSync(abs, path.join(jobDir, name));
    const a = { ...(input.assets?.[ref] || {}), src: pubRel(path.join(jobDir, name)) };
    if (/\.(png|jpe?g|webp|bmp)$/i.test(abs)) {
      a.kind = "image";
      const targets = focusTargets(ref);
      try {
        const res = JSON.parse(execFileSync("python", [path.join(ROOT, "scripts", "ocr_focus.py"), abs, JSON.stringify(targets)], { encoding: "utf8" }));
        a.aspect = a.aspect ?? res.width / res.height;
        if (!a.focus) {
          a.focus = res.hits.filter((h) => h.found).map((h) => ({ x: h.x, y: h.y, w: h.w, label: `点击「${h.q}」`, click: true }));
          const miss = res.hits.filter((h) => !h.found).map((h) => h.q);
          if (miss.length) warn(`截图 ${ref} 中没识别到：${miss.join("、")}（该步骤将不聚焦）`);
          if (res.error) warn(`OCR 不可用（${res.error}），截图将只做设备框展示`);
        }
      } catch (e) {
        warn(`OCR 失败：${e.message.split("\n")[0]}`);
      }
      if (!a.focus || !a.focus.length) a.focus = [{ x: 0.5, y: 0.2, w: 0.3, click: false }, { x: 0.5, y: 0.6, w: 0.3, click: false }];
    } else {
      const p = probe(abs);
      a.aspect = a.aspect ?? (p.video ? p.video.width / p.video.height : 16 / 9);
      a.kind = "video";
    }
    out[ref] = a;
  });
  return out;
};

const style = styleFor(input);

// =====================================================================
// timed mode: there is a voice track -> everything follows its timeline
// =====================================================================
const runTimed = async () => {
  let parsed;
  try {
    parsed = parseTimedScript(input.script);
  } catch (e) {
    fail(e.code || "E_SCRIPT", e.message);
  }
  const media = { tts: null, clips: {}, assets: {} };
  if (input.audio) {
    const abs = resolveIn(input.audio);
    if (!fs.existsSync(abs)) fail("E_AUDIO", `audio 指向的音频不存在：${abs}`);
    const norm = derived(abs, "voice", "wav", (f) => sh("ffmpeg", ["-v", "error", "-y", "-i", abs, "-af", LOUD, "-ar", "48000", "-ac", "1", f], "E_AUDIO"));
    fs.copyFileSync(norm, path.join(jobDir, "voice.wav"));
    const tl = input.audio_timeline ? loadTimeline(input.audio_timeline, "配音") : asrWords(abs, "配音");
    media.tts = { src: pubRel(path.join(jobDir, "voice.wav")), duration: probe(norm).duration, words: wordsOf(tl) };
  }
  // talking-head clips: [口播: x.mp4] markers, or opening_video for scripts without a marker
  if (input.opening_video && !parsed.sections.some((s) => s.kind === "talk")) {
    const ref = input.opening_video;
    const abs = resolveIn(ref);
    if (!fs.existsSync(abs)) fail("E_ASSET", `opening_video 不存在：${abs}`);
    const tl = input.opening_timeline ? loadTimeline(input.opening_timeline, "口播") : asrWords(abs, "口播");
    parsed = splitOpening(parsed, ref, wordsOf(tl), warn);
    input.clip_timelines = { ...(input.clip_timelines || {}), [ref]: input.opening_timeline };
    media._clipDirs = { [ref]: baseDir };
  }
  const clipRefs = [...new Set(parsed.sections.filter((s) => s.kind === "talk").map((s) => s.clip))];
  clipRefs.forEach((ref, k) => {
    const dir = media._clipDirs?.[ref] ?? scriptDir;
    const abs = resolveIn(ref, dir);
    if (!fs.existsSync(abs)) fail("E_ASSET", `口播视频不存在：${ref}（解析为 ${abs}）`);
    const p = probe(abs);
    // H.264 + loudness-normalised audio: Chrome can't reliably decode HEVC, and phone recordings are often 10+ LU quieter than TTS
    const norm = derived(abs, "clip", "mp4", (f) => sh("ffmpeg", ["-v", "error", "-y", "-i", abs, "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", ...(p.hasAudio ? ["-af", LOUD, "-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : []), "-movflags", "+faststart", f], "E_ASSET"));
    const name = `clip${k}.mp4`;
    fs.copyFileSync(norm, path.join(jobDir, name));
    const tlRef = input.clip_timelines?.[ref];
    const tl = tlRef ? loadTimeline(tlRef, "口播") : asrWords(abs, `口播 ${ref} `);
    const dur = probe(norm).duration;
    media.clips[ref] = { src: pubRel(path.join(jobDir, name)), duration: dur, frames: Math.floor(dur * FPS), words: wordsOf(tl) };
  });
  const assetRefs = [...new Set(parsed.sections.flatMap((s) => s.paras.map((p) => p.asset).filter(Boolean)))];
  media.assets = prepAssets(assetRefs);

  let storyboard = null;
  if (input.storyboard && !opt["--beats"]) {
    const p = resolveIn(input.storyboard);
    if (!fs.existsSync(p)) fail("E_STORYBOARD", `storyboard 文件不存在：${p}`);
    storyboard = readJson(p, "E_STORYBOARD");
    if (Array.isArray(storyboard)) storyboard = { shots: storyboard };
  }

  let out;
  try {
    out = planTimed({ parsed, media, storyboard, input, fps: FPS, warn, style: { seed: style.seed, transitions: style.transitions, variants: VARIANTS_ALL, meta: { seed: style.seed, skin: style.skin, font: style.font, world: style.world, mirror: style.mirror } } });
  } catch (e) {
    if (e instanceof TimedError) fail(e.code, e.message);
    throw e;
  }
  const md = beatsMarkdown(parsed, out.beats, out.report);
  if (input.bgm) {
    const abs = resolveIn(input.bgm);
    if (!fs.existsSync(abs)) fail("E_AUDIO", `bgm 不存在：${abs}`);
    const name = `bgm${path.extname(abs)}`;
    fs.copyFileSync(abs, path.join(jobDir, name));
    out.timeline.meta.bgm = pubRel(path.join(jobDir, name));
  }
  // presenter: a muted talking-head layer over the TTS-only film (full-screen first, then a PiP window)
  if (input.presenter) {
    const pr = typeof input.presenter === "string" ? { video: input.presenter } : input.presenter;
    const abs = resolveIn(pr.video);
    if (!fs.existsSync(abs)) fail("E_ASSET", `presenter.video 不存在：${abs}`);
    const norm = derived(abs, "presenter", "mp4", (f) => sh("ffmpeg", ["-v", "error", "-y", "-i", abs, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f], "E_ASSET"));
    fs.copyFileSync(norm, path.join(jobDir, "presenter.mp4"));
    const dur = probe(norm).duration;
    // poster = the clip's first frame: held on screen during the alignment offset so the shot
    // underneath is never exposed before the (delayed) person video starts.
    let poster;
    try {
      sh("ffmpeg", ["-v", "error", "-y", "-i", path.join(jobDir, "presenter.mp4"), "-frames:v", "1", path.join(jobDir, "presenter-poster.png")], "E_ASSET");
      poster = pubRel(path.join(jobDir, "presenter-poster.png"));
    } catch { /* fall back to a frozen video frame in the player */ }
    // align the person's lips to the TTS: median of (tts - talk) over identical words spoken in both
    let offset = pr.offset;
    if (offset == null && media.tts && (pr.timeline || !opt["--no-asr"])) {
      const tw = wordsOf(pr.timeline ? loadTimeline(pr.timeline, "真人") : asrWords(abs, "真人"));
      const key = (s) => String(s).replace(/[\s，。！？、,.!?“”"]/g, "");
      const diffs = [];
      for (const w of tw) {
        const k = key(w.text);
        if (k.length < 2) continue;
        const hit = media.tts.words.filter((x) => key(x.text) === k && Math.abs(x.start - w.start) < 6);
        if (hit.length) diffs.push(hit.reduce((a, b) => (Math.abs(b.start - w.start) < Math.abs(a.start - w.start) ? b : a)).start - w.start);
      }
      diffs.sort((a, b) => a - b);
      offset = diffs.length >= 3 ? diffs[diffs.length >> 1] : 0;
      console.log(`✓ 真人对齐 TTS：偏移 ${offset.toFixed(2)} 秒（${diffs.length} 个词匹配）`);
    }
    out.timeline.meta.presenter = {
      src: pubRel(path.join(jobDir, "presenter.mp4")),
      poster,
      frames: Math.floor(dur * FPS),
      offset: Math.round((offset || 0) * FPS),
      full: Math.round((pr.full ?? 2) * FPS),
      focusX: pr.focusX ?? 0.5,
      focusY: pr.focusY ?? 0.3,
      hideFrom: pr.hideFrom != null ? Math.round(pr.hideFrom * FPS) : undefined,
    };
  }
  fs.writeFileSync(path.join(jobDir, "beats.md"), md);
  fs.writeFileSync(path.join(jobDir, "beats.json"), JSON.stringify(out.report, null, 1));
  if (opt["--beats"]) {
    const p = path.join(baseDir, "beats.md");
    fs.writeFileSync(p, md);
    console.log(`✓ 节拍表：${p}（${out.beats.length} 句，${(out.timeline.durationInFrames / FPS).toFixed(1)} 秒）`);
    console.log(`  下一步：照 CATALOG.md 选组件写 storyboard.json（start/at 写台词原文锚点），再去掉 --beats 运行`);
    process.exit(0);
  }
  return { tl: out.timeline, storyboardMode: !!storyboard };
};

// ---------- opening library: every script gets its own opening, never a repeat ----------
const LIB = path.join(ROOT, "openings", "library.json");
const checkOpening = (used, tl) => {
  const lib = fs.existsSync(LIB) ? readJson(LIB, "E_OPENING") : { openings: [] };
  const talk0 = tl.shots[0]?.type === "talking-head-stage";
  if (!used) {
    if (talk0) warn(`第一个镜头是口播但没有专属开场（data.opening）：前 2 秒只有真人，建议按 SKILL.md「专属开场」做一个`);
    return;
  }
  const e = lib.openings.find((o) => o.id === used.id);
  if (!e) warn(`开场 ${used.id} 还没登记到 openings/library.json（运行 node scripts/openings.mjs sync）`);
  else {
    if (e.status === "retired") warn(`开场 ${used.id} 已被数据淘汰（status=retired），不建议再用`);
    const me = path.relative(ROOT, baseDir).replace(/\\/g, "/");
    const other = (e.usedBy || []).filter((x) => x !== me);
    if (other.length) warn(`开场 ${used.id} 已经用在 ${other.join("、")}：开场不能重样，请为这条文案单独做一个`);
  }
  const r = used.range ?? used.shot.data.opening;
  const d = (r.until ?? used.shot?.data.shrinkAt ?? 90) - (r.at ?? 0);
  if (d < 60 || d > 105) warn(`开场时长 ${(d / FPS).toFixed(1)} 秒，建议 2~3 秒（钩子要短）`);
};

// ---------- anti-PPT: too many text-only shots in a row is exactly the "reading slides" feel ----------
const TEXT_ONLY = new Set(["narration", "quote", "punch-text", "chapter", "bullet-cards", "cards", "hook"]);
const antiPpt = (tl, reg) => {
  const body = tl.shots.filter((s) => s.type !== "outro");
  if (!body.length) return;
  const txt = body.filter((s) => TEXT_ONLY.has(s.type));
  const ratio = txt.length / body.length;
  if (ratio > 0.2) warn(`纯文字镜头占 ${(ratio * 100).toFixed(0)}%（${txt.map((s) => s.id).join(" ")}），超过 20% 会有 PPT 念稿感：换成有动作的隐喻/信息图组件`);
  for (let i = 1; i < body.length; i++)
    if (TEXT_ONLY.has(body[i].type) && TEXT_ONLY.has(body[i - 1].type)) warn(`${body[i - 1].id}→${body[i].id} 连续两个纯文字镜头（${body[i - 1].type}→${body[i].type}），中间插一个有画面动作的组件`);
  // same component back-to-back reads like a slide template too
  for (let i = 1; i < body.length; i++)
    if (body[i].type === body[i - 1].type && body[i].type !== "talking-head-stage") warn(`${body[i - 1].id}→${body[i].id} 连续两个 ${body[i].type}，换一个组件或换 variant`);
};

// ---------- 动效与选型的多样性：把「观众看出来的重复」变成出片前的告警 ----------
// 上面 antiPpt 只比相邻两镜，所以 number 落在第 1/6/21 镜、punch-text 落在 7/9/12 镜
// 这种「隔一镜又来一次」完全逃得过检测——而观众恰恰是这样看出重复的。
// 这里补三个维度：全片频次、5 镜滑窗、以及元素入场语法的连续重复。
const similarTo = (reg, type, exclude) => {
  const def = reg.list.find((c) => c.id === type);
  if (!def) return [];
  const mine = new Set(def.tags);
  return reg.list
    .filter((c) => c.id !== type && c.layer !== "opening" && !exclude.has(c.id))
    .map((c) => ({ id: c.id, score: c.tags.filter((t) => mine.has(t)).length + (c.layer === def.layer ? 0.5 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.id);
};

const varietyCheck = (tl, reg) => {
  const body = tl.shots.filter((s) => s.type !== "outro" && s.type !== "talking-head-stage");
  if (body.length < 4) return;

  const cnt = {};
  for (const s of body) (cnt[s.type] ??= []).push(s.id);
  const used = new Set(Object.keys(cnt));

  // ① 全片频次：同一个组件出现 3 次以上
  for (const [type, ids] of Object.entries(cnt)) {
    if (ids.length <= 2) continue;
    const alt = similarTo(reg, type, used);
    warn(`组件 ${type} 全片出现 ${ids.length} 次（${ids.join(" ")}）：${alt.length ? `可换成 ${alt.join(" / ")}` : "换一个语义相近的组件"}`);
  }

  // ② 5 镜滑窗：同一个组件在短窗口内重复（这才是观众真正察觉的那种重复）。
  //    同一组重复会被多个窗口扫到，去重后只报一次
  const W = 5;
  const reported = new Set();
  for (let i = 0; i + W <= body.length; i++) {
    const seen = {};
    for (const s of body.slice(i, i + W)) (seen[s.type] ??= []).push(s.id);
    for (const [type, ids] of Object.entries(seen)) {
      if (ids.length < 2) continue;
      const key = `${type}:${ids.join(",")}`;
      if (reported.has(key)) continue;
      reported.add(key);
      warn(`第 ${i + 1}–${i + W} 镜里 ${type} 出现 ${ids.length} 次（${ids.join(" ")}）：5 镜内不要重复同一个组件`);
    }
  }

  // ③ 元素入场语法的连续重复：不同组件也可能是同一种运动，观感照样平
  let run = 1;
  for (let i = 1; i < body.length; i++) {
    const cur = body[i].motion?.enter;
    if (cur && cur === body[i - 1].motion?.enter) {
      run++;
      if (run === 3) warn(`${body[i - 2].id}→${body[i].id} 连续 3 镜都是「${cur}」入场：换一种运动方式（看 CATALOG 的动效列，或写 shot.motion.enter）`);
    } else run = 1;
  }

  // ④ 单变体组件被复用：骨架必然相同。已经用 motion.enter 逐镜错开的不再报
  for (const [type, ids] of Object.entries(cnt)) {
    if (ids.length < 2) continue;
    const def = reg.list.find((c) => c.id === type);
    if (!def || def.variants !== 1) continue;
    const enters = body.filter((s) => s.type === type).map((s) => s.motion?.enter);
    if (new Set(enters).size >= ids.length) continue; // 每镜入场都不同 → 已经错开
    warn(`${type} 只有 1 个变体却用了 ${ids.length} 次（${ids.join(" ")}），且入场没有逐镜错开：请写不同的 shot.motion.enter，或改用别的组件`);
  }
};

// component variant counts come from the registry (so new assets need no planner edit)
let VARIANTS_ALL = { ...VARIANTS };

// =====================================================================
const main = async () => {
  const reg = await loadRegistry();
  VARIANTS_ALL = { ...VARIANTS, ...Object.fromEntries(reg.list.map((c) => [c.id, c.variants])) };
  let tl;
  let storyboardMode = false;
  if (input.audio || input.audio_timeline) ({ tl, storyboardMode } = await runTimed());
  else {
    warn("没有提供 audio（配音）：按字数估算时长，只适合看分镜草稿；正式出片请提供配音");
    const refs = [...input.script.matchAll(/\[(?:图|截图|录屏|img|image)\s*[:：]\s*([^\]]+)\]/gi)].map((m) => m[1].trim());
    input.assets = prepAssets(refs);
    try {
      tl = planLegacy(input);
    } catch (e) {
      if (e instanceof PlanError) fail(e.code, e.message);
      throw e;
    }
    tl.meta.sfx = input.sfx !== false;
  }

  // ---------- validate every shot against its component schema ----------
  const errors = [];
  let openingUsed = null;
  for (const s of tl.shots) {
    const v = validateShot(reg, s.type, s.data);
    if (!v.ok) {
      if (storyboardMode && !s.auto) errors.push(`${s.id} ${s.type}：${v.issues.join("；")}`);
      else {
        warn(`${s.id} 自动选的 ${s.type} 数据不合格（${v.issues[0]}），改用关键词镜头`);
        s.type = "narration";
        s.data = { keywords: [s.text.slice(0, 6) || "……"] };
      }
      continue;
    }
    const dropped = Object.keys(s.data || {}).filter((k) => !(k in v.data));
    if (dropped.length) warn(`${s.id} ${s.type}：字段 ${dropped.join(", ")} 不在组件 schema 里，已忽略`);
    s.data = v.data;
    if (v.def.hideCaptions && s.hideCaptions === undefined) s.hideCaptions = true;
    // nested panel components (talking-head stage)
    for (const side of ["left", "right"]) {
      // only the talking-head stage has slot arrays here; versus etc. use left/right as plain objects
      if (!Array.isArray(s.data[side])) continue;
      for (const [k, it] of s.data[side].entries()) {
        if (!it?.type) continue;
        const iv = validateShot(reg, it.type, it.data);
        if (!iv.ok) errors.push(`${s.id} ${side}[${k}] ${it.type}：${iv.issues.join("；")}`);
        else {
          if (!iv.def.panel) warn(`${s.id} ${side}[${k}]：${it.type} 不是为侧栏设计的组件，可能显示不全`);
          it.data = iv.data;
        }
      }
    }
    // per-script opening (talking-head stage)
    const op = s.data.opening;
    if (op?.type) {
      const ov = validateShot(reg, op.type, op.data);
      if (!ov.ok) errors.push(`${s.id} opening ${op.type}：${ov.issues.join("；")}`);
      else {
        if (ov.def.layer !== "opening") warn(`${s.id} opening：${op.type} 不是开场组件（layer=${ov.def.layer}）`);
        op.data = ov.data;
        openingUsed = { id: op.type, def: ov.def, shot: s };
      }
    }
  }
  // film-level opening (TTS-only film + presenter layer)
  if (tl.opening?.type) {
    const ov = validateShot(reg, tl.opening.type, tl.opening.data);
    if (!ov.ok) errors.push(`opening ${tl.opening.type}：${ov.issues.join("；")}`);
    else {
      if (ov.def.layer !== "opening") warn(`opening：${tl.opening.type} 不是开场组件（layer=${ov.def.layer}）`);
      if (!tl.meta.presenter) warn(`storyboard.opening 需要 input.presenter（真人画面层），否则开场下面没有真人`);
      tl.opening.data = ov.data;
      openingUsed = { id: tl.opening.type, def: ov.def, range: tl.opening };
    }
  }
  if (errors.length) fail("E_STORYBOARD", `分镜数据不符合组件 schema（见 CATALOG.md）：\n  - ${errors.join("\n  - ")}`);
  for (const s of tl.shots) delete s.auto;
  checkOpening(openingUsed, tl);
  antiPpt(tl, reg);
  varietyCheck(tl, reg);

  const tlPath = path.join(jobDir, "timeline.json");
  fs.writeFileSync(tlPath, JSON.stringify(tl, null, 1));
  const counts = {};
  for (const s of tl.shots) counts[s.type] = (counts[s.type] || 0) + 1;
  console.log(`✓ 分镜完成：${tl.shots.length} 个镜头，${(tl.durationInFrames / FPS).toFixed(1)} 秒，${tl.chapters.length} 章${storyboardMode ? "（按 storyboard）" : "（自动）"}`);
  console.log(`  风格：皮肤 ${tl.meta.skin} · 世界 ${tl.meta.world} · 字体 ${tl.meta.font}${tl.meta.mirror ? " · 镜像" : ""} · seed ${tl.meta.seed}${tl.meta.sfx === false ? " · 无音效" : ""}`);
  console.log(`  画面分布：${Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(" ")}`);
  if (opt["--plan-only"]) {
    const fmt = (f) => `${Math.floor(f / FPS / 60)}:${((f / FPS) % 60).toFixed(1).padStart(4, "0")}`;
    for (const s of tl.shots) console.log(`  ${s.id.padEnd(4)} ${fmt(s.start)} +${(s.dur / FPS).toFixed(1).padStart(4)}s  ${s.type.padEnd(19)} ${s.text.slice(0, 26)}`);
    console.log(`  时间轴：${tlPath}`);
    process.exit(0);
  }
  if (opt["--stills"]) {
    const { renderStills } = await import("./lib/stills.mjs");
    const sheet = path.resolve(opt["--out"] ? opt["--out"].replace(/\.\w+$/, "") + "_stills.jpg" : path.join(ROOT, "out", `${slug}_stills.jpg`));
    fs.mkdirSync(path.dirname(sheet), { recursive: true });
    console.log(`▶ 渲染每个镜头的静帧（${tl.shots.length} 张）`);
    await renderStills({ root: ROOT, timeline: tl, out: sheet });
    console.log(`✓ 静帧总览：${sheet}`);
    process.exit(0);
  }

  // ---------- render ----------
  const out = path.resolve(opt["--out"] || path.join(ROOT, "out", `${slug}_seed${tl.meta.seed}.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const propsPath = path.join(jobDir, "props.json");
  fs.writeFileSync(propsPath, JSON.stringify({ timeline: tl }));
  const cli = path.join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js");
  if (!fs.existsSync(cli)) fail("E_DEPS", `缺少依赖 ${cli}，请在 ${ROOT} 执行 npm install`);
  const rargs = [cli, "render", "src/index.ts", "NeuroCast", out, `--props=${propsPath}`, "--gl=angle", `--concurrency=${opt["--concurrency"] || "12"}`, "--crf=26", "--x264-preset=medium", "--timeout=120000"];
  if (opt["--frames"]) rargs.push(`--frames=${opt["--frames"]}`);
  console.log(`▶ 开始渲染 -> ${out}`);
  const r = spawnSync(process.execPath, rargs, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) fail("E_RENDER", `Remotion 渲染失败（退出码 ${r.status}），时间轴已保存在 ${tlPath}，可用 npm run studio 打开排查`);
  console.log(`\n✓ 完成：${out}${warnings.length ? `（${warnings.length} 条警告，见上）` : ""}`);
};

main().catch((e) => fail("E_INTERNAL", e.stack || e.message));
