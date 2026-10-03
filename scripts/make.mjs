// NeuroCast: 文案 + 配音（+ 口播视频）-> 时间轴对齐 -> 分镜 -> 校验 -> mp4
// usage: node scripts/make.mjs <input.json> [--out out/x.mp4] [--seed N] [--beats] [--plan-only]
//        [--video 片名] 覆盖台账里的片子身份 · [--dry-run] 全流程但不写用量台账
//        [--no-usage-check] 连跨片重复检查一起跳过（调试老素材时用）
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
import { slotAssetRefs } from "./lib/detect.mjs";
import { load as loadUsage, shotsOf, record as recordUsage, crossVideoReport, statsOf, bodyComps } from "./lib/usage.mjs";
import { ratioOf, shotAssets, checklist as assetChecklist, record as recordAssets, load as loadAssetLedger } from "./lib/assets.mjs";

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
const VALUED = new Set(["--out", "--seed", "--frames", "--concurrency", "--asr-model", "--video"]);
const opt = {};
let inputPath;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUED.has(a)) opt[a] = argv[++i];
  else if (a.startsWith("--")) opt[a] = true;
  else if (!inputPath) inputPath = a;
}
if (!inputPath) fail("E_ARGS", "用法: node scripts/make.mjs <input.json> [--beats] [--plan-only] [--out 路径] [--seed N] [--video 片名] [--dry-run] [--no-usage-check]");
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
  if (i < 0) return [];
  const out = [];
  // [槽位: 文件.png 报表里那行成本] ——槽位里的说明文字就是要在图上圈出来的东西，拿去给 OCR 定位
  const line = ((input.script.slice(0, i).match(/[^\n]*$/) || [""])[0] + input.script.slice(i).split("\n")[0]).trim();
  const slot = line.match(/^\[[^\]:：]{1,6}[:：]\s*([^\]]+)\]$/);
  if (slot)
    for (const t of slot[1].split(/[,，、|；;]/)) {
      const q = t.trim();
      if (q && !/^\d/.test(q) && !/[\/\\]|\.(png|jpe?g|webp|gif|mp4|mov|md|pdf|txt)$/i.test(q) && Array.from(q).length >= 2 && Array.from(q).length <= 8) out.push(q);
    }
  const after = input.script.slice(i, i + 400).split(/\n\s*\n|\[(?:图|截图|录屏|视频|口播|logo|出处|来源|文档|表格|对比|vs|头像|评论|原文|金句|证据)/i)[0];
  for (const m of after.matchAll(/(?:点击|点一下|点开|打开|选择|选中|找到|进入|切换到|输入|勾选)\s*[“"「]?([^，。！？”"」\s]{2,8})/g)) out.push(m[1]);
  return [...new Set(out)].slice(0, 4);
};
const missingAssets = [];
// jobs 副本路径 -> 素材原始路径。素材台账要知道「这张图上过哪条片」，
// 而 timeline 里只剩 public/jobs/…/a3.png 这种一次性副本名。
const ASSET_ORIGIN = {};
// 素材路径有两种写法：讲稿/分镜旁边的相对路径（相对讲稿目录），和组件 example、CATALOG 里那种
// public/ 相对路径（assets/xxx.png）。两处都找，都找不到才算缺素材。
const assetAbs = (ref) => {
  const a = resolveIn(ref, scriptDir);
  if (fs.existsSync(a)) return a;
  const b = path.join(PUB, ref);
  return fs.existsSync(b) ? b : a;
};
const prepAssets = (refs) => {
  const out = {};
  refs.forEach((ref, k) => {
    const abs = assetAbs(ref);
    if (!fs.existsSync(abs)) {
      // 默认硬失败：正式出片不能带着「缺素材」的占位画面出去。
      // --allow-missing-assets（草稿/看分镜）时降级：记下名字、继续往下走，组件自己渲染「缺素材 · 字段」占位。
      if (!opt["--allow-missing-assets"]) fail("E_ASSET", `讲稿引用的素材不存在：${ref}（解析为 ${abs}）`);
      missingAssets.push(ref);
      warn(`素材缺失，已降级：${ref}`);
      return;
    }
    const name = `a${k}${path.extname(abs).toLowerCase()}`;
    fs.copyFileSync(abs, path.join(jobDir, name));
    const relOrigin = path.relative(ROOT, abs).replace(/\\/g, "/");
    const a = { ...(input.assets?.[ref] || {}), src: pubRel(path.join(jobDir, name)), origin: relOrigin.startsWith("..") ? abs.replace(/\\/g, "/") : relOrigin };
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
      // 素材组件（head-pip 之类）要知道剪辑能走到第几帧，超出就得冻在最后一片
      if (p.duration) a.frames = Math.floor(p.duration * FPS);
    }
    out[ref] = a;
    ASSET_ORIGIN[a.src] = a.origin;
  });
  // 落一份对照表：时间轴里的素材只剩 jobs/xxx/a3.png 这种一次性副本名，
  // 台账（node scripts/assets.mjs harvest/record）要靠这张表才知道原图在哪。
  fs.writeFileSync(path.join(jobDir, "assets.json"), JSON.stringify(out, null, 1));
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
  let storyboard = null;
  if (input.storyboard && !opt["--beats"]) {
    const p = resolveIn(input.storyboard);
    if (!fs.existsSync(p)) fail("E_STORYBOARD", `storyboard 文件不存在：${p}`);
    storyboard = readJson(p, "E_STORYBOARD");
    if (Array.isArray(storyboard)) storyboard = { shots: storyboard };
  }
  // 素材引用有三个来源：文案里的 [图/录屏] 标记、[槽位: …] 点名要的真文件，和分镜里
  // 任何声明了 assetFields 的组件（board-proof 这类以前只能手写 public/ 路径的，现在也会被 prepAssets 收到并补上 aspect/OCR/来源）
  const assetRefs = [...new Set([...parsed.sections.flatMap((s) => s.paras.map((p) => p.asset).filter(Boolean)), ...slotAssetRefs(parsed), ...storyboardAssetRefs(storyboard)])];
  media.assets = prepAssets(assetRefs);
  media.assetsMissing = missingAssets; // 降级模式下缺的那些：注入时把路径清空，组件演占位而不是 404 崩掉渲染

  let out;
  try {
    out = planTimed({ parsed, media, storyboard, input, fps: FPS, warn, assetFields: ASSET_FIELDS, assetMeta: ASSET_META, style: { seed: style.seed, transitions: style.transitions, variants: VARIANTS_ALL, meta: { seed: style.seed, skin: style.skin, font: style.font, world: style.world, mirror: style.mirror } } });
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
    let dur = probe(norm).duration;
    // poster = the clip's first frame: held on screen during the alignment offset so the shot
    // underneath is never exposed before the (delayed) person video starts.
    let poster;
    try {
      sh("ffmpeg", ["-v", "error", "-y", "-i", path.join(jobDir, "presenter.mp4"), "-frames:v", "1", path.join(jobDir, "presenter-poster.png")], "E_ASSET");
      poster = pubRel(path.join(jobDir, "presenter-poster.png"));
    } catch { /* fall back to a frozen video frame in the player */ }
    // align the person's lips to the TTS: word-level diffs only give a constant offset, but the two
    // voices also differ slightly in pace — character-level monotonic match + least squares fits
    // s ≈ a + b·t (t = person clock, s = TTS clock) → start at a, play at rate 1/b (clamped ±10%).
    let offset = pr.offset, rate = pr.rate;
    if ((offset == null || rate == null) && media.tts && (pr.timeline || !opt["--no-asr"])) {
      const tw = wordsOf(pr.timeline ? loadTimeline(pr.timeline, "真人") : asrWords(abs, "真人"));
      const clean = (s) => String(s).replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
      const expand = (ws) => { const o = []; for (const w of ws) { const t = +w.start; for (const c of clean(w.text)) o.push({ c, t }); } return o; };
      const A = expand(tw), B = expand(media.tts.words);
      const pairs = [];
      let i = 0, j = 0;
      while (i < A.length && j < B.length) {
        if (A[i].c === B[j].c) { pairs.push([A[i].t, B[j].t]); i++; j++; }
        else {
          let k = 0; for (let d = 1; d <= 12; d++) if (j + d < B.length && B[j + d].c === A[i].c) { k = d; break; }
          if (k) { j += k; continue; }
          let m = 0; for (let d = 1; d <= 8; d++) if (i + d < A.length && A[i + d].c === B[j].c) { m = d; break; }
          if (m) i += m; else { i++; j++; }
        }
      }
      if (pairs.length >= 8) {
        const fit = (ps) => { const n = ps.length; let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const [t, s] of ps) { sx += t; sy += s; sxx += t * t; sxy += t * s; } const b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1); return { a: (sy - b * sx) / n, b }; };
        let f1 = fit(pairs);
        const keep = pairs.filter(([t, s]) => Math.abs(s - (f1.a + f1.b * t)) < 0.6);
        if (keep.length >= 8) f1 = fit(keep);
        if (offset == null) offset = Math.min(2, Math.max(0, f1.a));
        if (rate == null) rate = Math.min(1.1, Math.max(0.9, 1 / f1.b));
        console.log(`✓ 真人对齐 TTS：偏移 ${offset.toFixed(2)} 秒、变速 ×${rate.toFixed(3)}（${pairs.length} 字匹配${keep.length !== pairs.length ? `，去离群后 ${keep.length}` : ""}）`);
        // 语速差非线性（真人前段快后段慢）时单速率修不掉中段漂移：两段拟合，
        // 用 ffmpeg setpts 把真人视频直接重排到 TTS 时钟上（渲染侧 rate=1 + 偏移 a1）。
        if (pr.offset == null && pr.rate == null && keep.length >= 16) {
          const rms = (fn) => Math.sqrt(keep.reduce((r, [t, s]) => r + (s - fn(t)) ** 2, 0) / keep.length);
          const g1 = (t) => f1.a + f1.b * t;
          let best2 = null;
          for (let kk = 6; kk <= 16; kk += 0.5) {
            const s1 = keep.filter((p) => p[0] <= kk), s2 = keep.filter((p) => p[0] > kk);
            if (s1.length < 8 || s2.length < 8) continue;
            const f1s = fit(s1), f2s = fit(s2);
            const c2 = f1s.a + f1s.b * kk - f2s.b * kk; // 边界连续
            const r = rms((t) => (t <= kk ? f1s.a + f1s.b * t : c2 + f2s.b * t));
            if (!best2 || r < best2.r) best2 = { kk, f1s, f2s, r };
          }
          if (best2 && best2.r < rms(g1) * 0.92) {
            const { kk, f1s, f2s } = best2;
            try {
              const w = path.join(jobDir, "presenter-warp.mp4");
              sh("ffmpeg", ["-v", "error", "-y", "-i", norm, "-filter_complex",
                `[0:v]trim=start=0:end=${kk},setpts=${f1s.b.toFixed(6)}*PTS[s1];[0:v]trim=start=${kk},setpts=${f2s.b.toFixed(6)}*(PTS-STARTPTS)[s2];[s1][s2]concat=n=2:v=1:a=0,fps=${FPS},format=yuv420p[v]`,
                "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-movflags", "+faststart", w], "E_ASSET");
              fs.copyFileSync(w, path.join(jobDir, "presenter.mp4"));
              dur = probe(w).duration;
              offset = Math.min(2, Math.max(0, f1s.a)); rate = 1;
              sh("ffmpeg", ["-v", "error", "-y", "-i", path.join(jobDir, "presenter.mp4"), "-frames:v", 1, path.join(jobDir, "presenter-poster.png")], "E_ASSET");
              console.log(`✓ 真人分段变速：拐点 ${kk}s 前×${f1s.b.toFixed(4)} 后×${f2s.b.toFixed(4)}，偏移 ${offset.toFixed(2)}s（残差 ${best2.r.toFixed(3)}s < 单速率 ${rms(g1).toFixed(3)}s）`);
            } catch (e) { console.log(`⚠ 真人分段变速失败，回退单速率：${e.message}`); }
          }
        }
      } else {
        if (offset == null) offset = 0;
        if (rate == null) rate = 1;
        console.log(`⚠ 真人对齐：匹配字数太少（${pairs.length}），偏移按 ${offset.toFixed(2)}s、速率 ×${rate.toFixed(3)}`);
      }
    }
    out.timeline.meta.presenter = {
      src: pubRel(path.join(jobDir, "presenter.mp4")),
      poster,
      frames: Math.floor(dur * FPS),
      offset: Math.round((offset || 0) * FPS),
      rate: Number((rate ?? 1).toFixed(4)),
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

// ---------- 跨片重复：正片组件用量台账（usage/library.json）----------
// antiPpt / varietyCheck 只管这一条片子内部的重复；这一段管「上几条片你已经用过它了」，
// 以及「这条片子有没有首次用上库里的新面孔」。台账只在真正出片成功后写入，
// --plan-only / --stills 是草稿，不污染记忆。
const crossVideoCheck = (tl, reg) => {
  if (opt["--no-usage-check"]) return;
  const ledger = loadUsage();
  const rep = crossVideoReport(tl, { ledger, selfVideo: tl.meta?.title });
  if (rep.videos < 2) return; // 台账里没几条历史片子，谈跨片重复没意义
  const used = new Set(shotsOf(tl).map((r) => r.type));
  for (const h of rep.heavy) {
    // 替代建议按「台账里越少用过」排，优先推没上过片的
    const alt = similarTo(reg, h.id, used)
      .sort((a, b) => (ledger.comps[a]?.count || 0) - (ledger.comps[b]?.count || 0))
      .map((id) => `${id}${ledger.comps[id]?.count > 0 ? "" : "（新）"}`);
    warn(`跨片重复：${h.id} 近 ${rep.recentVideos} 条片里出现在 ${h.videos.length} 条（${h.videos.join(" / ")}），累计已上片 ${h.count} 次：${alt.length ? `换成 ${alt.join(" / ")}，或` : ""}新增一个能表达这镜语义的组件`);
  }
  if (rep.light.length) {
    const detail = rep.light.map((l) => {
      const e = statsOf(l.id, { ledger }).enters;
      return `${l.id}${e.length ? `（入场已用 ${e.join("/")}）` : ""}`;
    });
    warn(`跨片重复（轻）：${detail.join("、")} 上一条片刚用过。要用可以，但 motion.enter 必须换一种没见过的`);
  }
  if (rep.fresh.length >= rep.minFresh) {
    console.log(`  跨片：本片首次使用 ${rep.fresh.length} 个组件 ✓ ${rep.fresh.join(" ")}`);
  } else {
    const pool = bodyComps(reg.list).filter((c) => !(ledger.comps[c.id]?.count > 0));
    warn(`跨片重复：本片首次使用的组件只有 ${rep.fresh.length} 个（要求 ≥${rep.minFresh}）。库里还有 ${pool.length} 个从未上过片的组件：node scripts/usage.mjs unused，或按这次分镜的语义新增`);
  }
};

// ---------- 素材占比（assets/library.json）：真素材是信任度，不是装饰 ----------
// antiPpt / varietyCheck / crossVideoCheck 都只管「画面重不重复」，这一项管的是另一件事：
// 观众能不能从画面里看出「博主真的用过这个东西」。
// 口径：上了真素材（jobs/ 副本或 http 外链）的镜头时长 ÷ 全片时长。
// 组件的 schema 里有没有 source 字段（有 SourceBadge 能力的组件才该被提醒去填）。
// 照旧不抠 zod 内部结构：往 example 上补一个 source 过一遍 schema，键活下来就说明组件会读它。
const hasSourceField = (def) => {
  const r = def?.schema?.safeParse({ ...(def.example ?? {}), source: { platform: "试" } });
  return !!r?.success && r.data?.source !== undefined;
};

// 侧栏槽位（talking-head-stage 的 left/right）可能是数组、也可能是单个对象（versus 那类），
// 直接展开对象会炸（TypeError: object is not iterable），先归一成数组。
const slotList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const assetReport = (tl, reg) => {
  const ledger = loadAssetLedger();
  const r = ratioOf(tl, ASSET_FIELDS);
  const min = ledger.rules.minRatio;
  const pct = (r.pct * 100).toFixed(1);
  const want = `${pct}%（${r.assetShots}/${r.shots} 镜 · ${(r.asset / FPS).toFixed(0)}/${(r.total / FPS).toFixed(0)} 秒有真素材）`;
  if (r.pct >= min) console.log(`  素材占比 ${want} ≥${(min * 100).toFixed(0)}% ✓`);
  else warn(`素材占比 ${want} 低于 ${(min * 100).toFixed(0)}%：这条片子基本全是代码动画，观众没有一样东西可以「看见是真的」。去补真截图/真录屏/真 logo/真头像，或把镜头让给素材组件（node scripts/pick.mjs --need 素材）`);
  // 真标识 / 真出处这类镜头不吃文件（logo 来自品牌库、地址是数据），不计进占比，但要知道它们在场
  const noFile = shotAssets(tl, ASSET_FIELDS).filter((m) => m.fields.length && !m.got.length && !m.missing.length && !m.fields.some((f) => (ASSET_REQUIRED[m.type] || {})[f]));
  if (noFile.length) console.log(`  另有 ${noFile.length} 镜（${(noFile.reduce((a, m) => a + (m.dur || 0), 0) / FPS).toFixed(0)} 秒）用真标识/真出处（品牌库与地址不是文件，不计进上面的占比）：${[...new Set(noFile.map((m) => m.type))].join(" ")}`);
  // C1：真素材要带出处角标，否则和「代码画了一张像截图的图」没有区别
  const rows = new Map(shotAssets(tl, ASSET_FIELDS).map((x) => [x.id, x]));
  const bare = [];
  for (const s of tl.shots) {
    if (!(rows.get(s.id)?.got || []).length) continue;
    // 镜头自己或它侧栏槽位里的素材组件，只要有一个写了 source 就算过了
    const canCheck = [s, ...slotList(s.data?.left), ...slotList(s.data?.right)].filter((x) => x && ASSET_FIELDS[x.type] && hasSourceField(reg.byId[x.type]));
    if (!canCheck.length) continue;
    const ok = canCheck.some((x) => {
      const o = x.data?.source;
      return o && (o.platform || o.url || o.capturedAt || o.author);
    });
    if (!ok) bare.push(`${s.id} ${s.type}`);
  }
  if (bare.length) warn(`${bare.length} 个镜头上了真素材但没写 data.source（平台 / 采集时间 / 出处）：${bare.join("、")}。补上出处角标，观众才知道这不是画出来的（见 CATALOG「素材来源」）`);
  // 只列「真会空着」的：讲稿点名了文件却没找到，或这个组件的素材字段本来就必填（logo 墙少张缩略图不算事）
  const miss = assetChecklist(tl, ASSET_FIELDS).filter((m) => m.missing.length || m.fields.some((f) => (ASSET_REQUIRED[m.type] || {})[f]));
  if (miss.length) {
    console.log(`  采集清单（${miss.length} 个镜头点名要真素材但手上没有）：`);
    for (const m of miss) console.log(`    ${m.id.padEnd(4)} ${m.type.padEnd(19)} ${m.fields.join(",")} ${m.missing.length ? `← ${m.missing.join(" ")}` : "←（分镜里没填路径）"}  「${m.text.slice(0, 18)}」`);
    const p = path.join(jobDir, "assets_todo.md");
    fs.writeFileSync(p, ["# 采集清单", "", `分镜点名要真素材、但当前没有文件的镜头（${miss.length} 个）。补齐后重跑同一条命令即可。`, "", ...miss.map((m) => `- [ ] **${m.id} ${m.type}** · 字段 ${m.fields.join(", ")}`), "", ...miss.map((m) => `  - 台词：${m.text}`)].join("\n"), "utf8");
    console.log(`    清单已写出：${p}`);
  }
  if (missingAssets.length) console.log(`  本次降级跳过的素材：${missingAssets.join(" ")}`);
  return r;
};

// 这个素材字段是不是「非给不可」：把组件 example 里的这个字段拿掉，schema 不认 → 必填。
// 采集清单靠它分轻重：evidence-zoom 没 src 就是空画面，logo-wall 没缩略图照样有真 logo，别混在一起刷屏。
let ASSET_REQUIRED = {};
const dropField = (data, f) => {
  const seed = JSON.parse(JSON.stringify(data ?? {}));
  const arr = /^([\w.]+)\[\]\.(.+)$/.exec(f);
  const bare = /^([\w.]+)\[\]$/.exec(f);
  if (arr) {
    (seed[arr[1]] || []).forEach((el) => delete el[arr[2].split(".").pop()]);
    return seed;
  }
  if (bare) {
    delete seed[bare[1]];
    return seed;
  }
  const parts = f.split(".");
  const leaf = parts.pop();
  const holder = parts.length ? dig(seed, parts.join(".")) : seed;
  if (holder && typeof holder === "object") delete holder[leaf];
  return seed;
};
const assetRequiredFor = (reg, def) => Object.fromEntries((def.assetFields || []).map((f) => [f, !validateShot(reg, def.id, dropField(def.example, f)).ok]));

// component variant counts come from the registry (so new assets need no planner edit)
let VARIANTS_ALL = { ...VARIANTS };
// id -> CompDef.assetFields。素材注入（timed.mjs）和素材引用收集（storyboardAssetRefs）都读它，
// 所以新增一个吃素材的组件只要在 CompDef 上声明 assetFields，流水线不用改。
let ASSET_FIELDS = {};
// id -> { 字段: [允许的元数据键] }。prepAssets 量出来的 kind/aspect/focus/frames 只有在组件
// schema 声明过的那个键才留得住（validateShot 用解析结果覆盖 data，没声明的静默丢掉）。
// 与其去抠 zod 内部结构（v4 的 _def 和 v3 不一样，还会随版本变），直接拿组件自己的 example 试：
// 把某个键补到素材所在的那一层，过一遍 schema，活下来的就是组件真会读的。
// 于是新增吃素材的组件依然零流水线改动——声明 assetFields 就够了。
const META_PROBE = { kind: "image", aspect: 1.7778, frames: 300, focus: [{ x: 0.5, y: 0.42, w: 0.26, label: "示例", click: true }] };
let ASSET_META = {};
const putDeep = (obj, p, val) => {
  if (!p) return { ...(obj || {}), ...val };
  const [head, ...rest] = p.split(".");
  const cur = obj?.[head];
  const merged = rest.length ? putDeep(cur, rest.join("."), val) : { ...(cur || {}), ...val };
  return { ...(obj || {}), [head]: merged };
};
const assetMetaFor = (reg, def) => {
  const per = {};
  const ex = def.example ?? {};
  for (const f of def.assetFields || []) {
    const arr = /^([\w.]+)\[\]\.(.+)$/.exec(f); // 元数据并进数组项（boards[].src）
    const bare = /^([\w.]+)\[\]$/.exec(f); // pages[]：fillAssets 只往 data 顶层铺 aspect
    const holder = arr ? null : bare ? "" : f.split(".").slice(0, -1).join(".");
    const live = [];
    for (const [k, v] of Object.entries(META_PROBE)) {
      if (bare && k !== "aspect") continue;
      let seed;
      let survived;
      if (arr) {
        const list = (dig(ex, arr[1]) || []).map((el) => ({ ...el, [k]: v }));
        if (!list.length) break; // example 里没有可试的项：宁可什么都不铺，也别铺一半被丢一半
        seed = { ...ex, [arr[1]]: list };
        survived = (d) => d[arr[1]]?.[0]?.[k] !== undefined;
      } else {
        seed = putDeep(ex, holder, { [k]: v });
        survived = (d) => ((holder ? dig(d, holder) : d) ?? {})[k] !== undefined;
      }
      const r = validateShot(reg, def.id, seed);
      if (r.ok && survived(r.data)) live.push(k);
    }
    per[f] = live;
  }
  // 组件自己点名「这个字段只铺这几个键」（同一层挤了两个素材字段时才需要）
  for (const [f, only] of Object.entries(def.assetMeta || {})) per[f] = (per[f] || []).filter((k) => only.includes(k));
  return per;
};
const dig = (obj, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);
const refOf = (data, field) => {
  const m = /^([\w.]+)\[\]\.(.+)$/.exec(field);
  if (m) {
    return (data?.[m[1]] || []).map((el) => (typeof dig(el, m[2]) === "string" ? dig(el, m[2]) : null)).filter(Boolean);
  }
  const bare = /^([\w.]+)\[\]$/.exec(field); // "pages[]"：整个字段就是素材路径数组
  if (bare) return (data?.[bare[1]] || []).filter((v) => typeof v === "string" && v);
  const v = dig(data, field); // "src" 或嵌套的 "video.src"
  return typeof v === "string" ? [v] : [];
};
const collectRefs = (node, out) => {
  if (Array.isArray(node)) return node.forEach((v) => collectRefs(v, out));
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") for (const f of ASSET_FIELDS[node.type] || []) refOf(node.data ?? node, f).forEach((r) => out.push(r));
  Object.values(node).forEach((v) => v && typeof v === "object" && collectRefs(v, out));
};
const storyboardAssetRefs = (sb) => {
  if (!sb) return [];
  const out = [];
  collectRefs(sb, out);
  return out.filter((r) => !/^https?:/.test(r));
};

// =====================================================================
const main = async () => {
  const reg = await loadRegistry();
  VARIANTS_ALL = { ...VARIANTS, ...Object.fromEntries(reg.list.map((c) => [c.id, c.variants])) };
  ASSET_FIELDS = Object.fromEntries(reg.list.filter((c) => c.assetFields?.length).map((c) => [c.id, c.assetFields]));
  ASSET_META = Object.fromEntries(reg.list.filter((c) => c.assetFields?.length).map((c) => [c.id, assetMetaFor(reg, c)]));
  ASSET_REQUIRED = Object.fromEntries(reg.list.filter((c) => c.assetFields?.length).map((c) => [c.id, assetRequiredFor(reg, c)]));
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
  assetReport(tl, reg);
  crossVideoCheck(tl, reg);
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
  // --frames 只渲了部分帧、--dry-run 明确不落账，都是试渲染，不进跨片记忆
  const draft = opt["--frames"] || opt["--dry-run"];
  const video = opt["--video"] || tl.meta?.title;
  const rec = draft ? null : recordUsage(tl, { video, file: tlPath, date: new Date().toISOString().slice(0, 10) });
  if (rec?.video) console.log(`  用量台账：已记录「${rec.video.id}」（${rec.video.shots} 镜 / ${Object.keys(rec.video.types).length} 种组件）→ usage/library.json`);
  else if (opt["--dry-run"]) console.log(`  用量台账：--dry-run，未写入（画面重复度按真实规则照常检查）`);
  // 素材台账同一套规矩：真出片才记账，重跑同一条片子覆盖旧记录
  const arec = draft ? null : recordAssets(tl, { video, file: tlPath, assetFields: ASSET_FIELDS, originOf: (v) => ASSET_ORIGIN[v] || v, date: new Date().toISOString().slice(0, 10) });
  if (arec?.files) console.log(`  素材台账：${arec.files} 个真素材、素材占比 ${(arec.ratio * 100).toFixed(1)}% → assets/library.json（node scripts/assets.mjs report）`);
  else if (!draft) console.log(`  素材台账：本片没有真素材，未记录`);
  console.log(`\n✓ 完成：${out}${warnings.length ? `（${warnings.length} 条警告，见上）` : ""}`);
};

main().catch((e) => fail("E_INTERNAL", e.stack || e.message));
