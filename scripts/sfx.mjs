#!/usr/bin/env node
// 音效桥接：把猫学长开源的 sfx-sources skill（vendor/sound/）接进 neurocast 的音效系统。
//
// 为什么要有这个脚本：原来 public/sfx/*.wav 是 scripts/gen_sfx.py 用正弦/噪声程序合成的，
// 听感就是「电子哔声」，放在真人配音旁边很廉价。这里改成**去 Mixkit / Freesound / Kenney / Pixabay
// 找真实音效**，下载后归一化成 48k 立体声 wav、按每个 cue 的时长预算裁短、加淡入淡出，
// 再把实测时长写回 src/lib/sfx.tsx 的 SFX 表（引擎靠这个表决定 <Sequence durationInFrames>）。
//
// 许可口径（重要）：只用 Mixkit（免费可商用、无需署名）、Kenney（CC0）、Freesound 的 CC0。
// Freesound 的 BY 需要署名、BY-NC 不能商用 —— 短视频里没法挂署名，一律不取。
//
// 用法：
//   node scripts/sfx.mjs audit                      看现在每个 cue 用的是什么（来源/许可/时长）
//   node scripts/sfx.mjs search <cue> [-n 8]        按该 cue 的预设查询词列候选（带 ♥/↓ 与时长）
//   node scripts/sfx.mjs search --source mixkit "cinematic whoosh"
//   node scripts/sfx.mjs pick <cue> <key>           下载 + 归一化到 public/sfx/<cue>.wav + 刷新表
//   node scripts/sfx.mjs auto [cue...]              每个 cue 自动取候选里「时长合适」的第一名
//   node scripts/sfx.mjs table                      只按磁盘实测重刷 src/lib/sfx.tsx 的时长表
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SFXDIR = path.join(ROOT, "public", "sfx");
const MANIFEST = path.join(SFXDIR, "manifest.json");
const TSX = path.join(ROOT, "src", "lib", "sfx.tsx");
const PY = process.env.SFX_PY || "python"; // 这台机器 python3 是坏空壳，必须 python
const SFXPY = path.join(ROOT, "vendor", "sound", "sfx-sources", "scripts", "sfx.py");
const FPS = 30;
const TARGET_PEAK = -3; // dBFS

// cue → 检索词 / 时长预算 / 优先源。max 是「这条音效最多留几秒」：
// 音效超过预算就会盖住人声，所以宁可裁短也不要长。
// hp = 归一化时保住的最低频。impact/stamp/riser 要留 25~35Hz 的下潜，否则「咚」会变成「嗒」，
// 薄一层就没分量了（之前统一 highpass=50，正是开场砸下来听不见的原因之一）。
// 源顺序 = Mixkit（策展 wav、免署名可商用）→ Freesound CC0。
// ⚠ Kenney 在这台机器上取不到：kenney.nl 的资产页里没有 zip 直链，脚本会报 no zip found，所以不排进查询序列。
// ⚠ Pixabay 在这台机器上 403（Cloudflare 收紧，curl_cffi 也过不去），同样不排。
const CUES = {
  impact: { max: 1.2, vol: 0.5, hp: 25, queries: [["mixkit", "movie trailer epic impact"], ["mixkit", "big cinematic impact"], ["mixkit", "cinematic whoosh deep impact"], ["freesound", "cinematic impact hit"]], why: "开场第一帧、砸字（要 trailer 级的低频「咚」+ 尾巴；body punch / wood hit 那种肉拳 foley 太薄，撑不起开场）" },
  ding: { max: 0.9, vol: 0.4, queries: [["mixkit", "attention bell"], ["mixkit", "bell ding"], ["freesound", "ding bell"]], why: "强调词、结论点亮" },
  stamp: { max: 0.6, vol: 0.45, hp: 30, queries: [["mixkit", "stamp"], ["freesound", "rubber stamp"], ["mixkit", "wood hit"]], why: "盖章、否定" },
  whoosh: { max: 0.6, vol: 0.26, queries: [["mixkit", "whoosh"], ["mixkit", "cinematic whoosh"], ["freesound", "whoosh air"]], why: "转场、飞入、下落" },
  swish: { max: 0.4, vol: 0.2, queries: [["mixkit", "swish"], ["freesound", "swish quick"]], why: "快速划过、擦出" },
  swipe: { max: 0.35, vol: 0.2, queries: [["mixkit", "swipe"], ["freesound", "swipe short"]], why: "划走、卡片滑动" },
  pop: { max: 0.3, vol: 0.3, queries: [["mixkit", "pop"], ["freesound", "pop bubble short"]], why: "元素弹出" },
  click: { max: 0.18, vol: 0.28, queries: [["mixkit", "mouse click"], ["mixkit", "select click"], ["freesound", "click button"]], why: "按钮、开关" },
  tick: { max: 0.14, vol: 0.24, queries: [["mixkit", "tick"], ["freesound", "clock tick"]], why: "计数、进度" },
  riser: { max: 1.8, vol: 0.24, hp: 35, queries: [["mixkit", "riser"], ["mixkit", "cinematic build up"], ["freesound", "riser build up"]], why: "悬念铺垫（放在揭晓前）" },
  glitch: { max: 0.5, vol: 0.3, queries: [["mixkit", "glitch"], ["freesound", "glitch digital error"]], why: "故障、反转" },
  typing: { max: 1.6, vol: 0.22, queries: [["mixkit", "keyboard"], ["freesound", "keyboard typing"]], why: "打字（一段轻快的键盘声）" },
  bubbles: { max: 0.6, vol: 0.26, queries: [["mixkit", "bubble"], ["freesound", "cartoon bubble pop"]], why: "聊天气泡" },
  sparkle: { max: 1.0, vol: 0.28, queries: [["mixkit", "sparkle"], ["mixkit", "magic chime"], ["freesound", "sparkle magic"]], why: "完成、好结果" },
  success: { max: 1.0, vol: 0.35, queries: [["mixkit", "success"], ["mixkit", "correct answer"], ["freesound", "success chime correct"]], why: "任务完成" },
};

// 这些 cue 的「打击头」必须落在取到的片段里（源里峰值靠后就把取景窗挪过去）；
// whoosh / swish / swipe / riser / typing / bubbles 是扫音与过程音，要的正是从头滑到尾，不动它。
const PUNCH = new Set(["impact", "stamp", "ding", "pop", "click", "tick", "glitch", "sparkle", "success"]);

const run = (cmd, args, opt = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opt });
const sh = (cmd, args) => {
  const r = run(cmd, args);
  if (r.status !== 0) throw new Error(`${cmd} 失败：${(r.stderr || r.stdout || "").trim().slice(0, 400)}`);
  return r.stdout;
};
const durSec = (f) => parseFloat(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());
// 各源的时长写法不一样：Mixkit「0:07」、Freesound「4.4s」，统一成秒
const secs = (s) => {
  const m = /^(\d+):(\d+)$/.exec((s || "").trim());
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 999;
};
const readManifest = () => (fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {});

// ---------- 上游 sfx.py ----------
function sfxCli(args) {
  if (!fs.existsSync(SFXPY)) throw new Error(`找不到 ${SFXPY}（vendor/sound 没拉下来？）`);
  const r = run(PY, [SFXPY, ...args]);
  if (r.status !== 0) throw new Error(`sfx.py ${args.join(" ")} 失败：${(r.stderr || "").trim().slice(0, 400)}`);
  // Windows 上 python 打的是 \r\n：不统一换行，最后一列（文件名 / 许可）会带上 \r，
  // 后面拼路径就会变成「xxx.wav\r」→ ffprobe: Invalid argument。
  return (r.stdout || "").replace(/\r\n/g, "\n");
}
// ⚠ 列位：上游 show() 只在「许可不是 cc0」时才多打一列 license。
//   mixkit    → key / title / dur
//   freesound --license cc0 → key / title / dur / stats / desc   （没有 license 列，全是 CC0）
function search(source, query) {
  const out = source === "freesound" ? sfxCli(["freesound", query, "--license", "cc0", "-n", "8"]) : sfxCli([source, query, "-n", "8"]);
  return out
    .split("\n")
    .filter((l) => l.includes("\t"))
    .map((l) => {
      const c = l.split("\t");
      return source === "freesound"
        ? { key: c[0], title: c[1], dur: c[2] || "", stats: c[3] || "", license: "CC0", desc: c[4] || "" }
        : { key: c[0], title: c[1], dur: c[2] || "", stats: "", license: source === "mixkit" ? "Mixkit" : c[3] || "?", desc: "" };
    });
}
function kenneyPackList() {
  return sfxCli(["kenney"]).trim().split(/\s+/);
}
function kenneyFiles(pack) {
  const out = sfxCli(["kenney", pack]);
  const line = out.split("\n").slice(1).join(" ");
  return line.trim().split(/\s+/).filter(Boolean);
}

// ---------- 归一化 ----------
// 素材开头常有一段纯静音（freesound 的采样尤其常见），从 0 裁会浪费掉预算，所以跳过它。
// 但阈值不能松：whoosh 这类「渐强扫音」用 -40dB 会被整段判成静音，结果只剩 0.1s。
// 所以：门槛压到 -60dB、只有「 silence 从 0 开始」才算前导静音、最多跳 0.3s，且永远保证留下 ≥0.25s。
function onset(src) {
  const r = run("ffmpeg", ["-hide_banner", "-i", src, "-af", "silencedetect=n=-60dB:d=0.05", "-f", "null", "-"]);
  const s = (r.stderr || "") + (r.stdout || "");
  const st = [...s.matchAll(/silence_start: ([-\d.]+)/g)].map((m) => Number(m[1]));
  const en = [...s.matchAll(/silence_end: ([-\d.]+)/g)].map((m) => Number(m[1]));
  if (!st.length || st[0] > 0.02 || !en.length) return 0;
  return Math.min(Math.max(0, en[0]), 0.3);
}
// 能量落在哪：把素材降成 8k 单声道，扫一遍找全局峰值的位置。
// trailer 级 impact 前面常有一段渐强，重击在 2~3 秒处 —— 直接从头部裁 max 秒就只会留下渐强，
// 听起来就是「砸下来没音效」。上游 SKILL.md 说的「先量能量落在哪再信热门」就是这一步。
function peakAt(src) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", src, "-f", "f32le", "-ac", "1", "-ar", "8000", "-"], { encoding: "buffer", maxBuffer: 1 << 28 });
  if (r.status !== 0 || !r.stdout?.length) return 0;
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
  let best = 0, bi = 0;
  const W = 400; // 50ms 窗
  for (let i = 0; i + W < x.length; i += W) {
    let s = 0;
    for (let k = 0; k < W; k++) { const v = x[i + k]; s += v * v; }
    const rms = Math.sqrt(s / W);
    if (rms > best) { best = rms; bi = i; }
  }
  return bi / 8000;
}
function normalize(src, dst, max, hp = 50, anchorPeak = false) {
  const full = durSec(src);
  let from = Math.min(onset(src), Math.max(0, full - Math.min(max, 0.25)));
  if (anchorPeak) {
    // 打击类一律把取景窗挪到「全局峰值前 0.12s」，让 attack 正好落在音效的第 0 帧附近。
    // 只判「峰值是不是太靠后」是不够的：mk:2908 的峰值在 0.9s，仍在预算内，
    // 结果就是画面落地了、咚 0.9 秒后才响 —— 必须无条件对齐峰值。
    const want = Math.max(0, peakAt(src) - 0.12);
    if (want > from) from = Math.min(want, Math.max(0, full - Math.min(max, 0.3)));
  }
  const d0 = Math.min(max, full - from);
  const vd = run("ffmpeg", ["-hide_banner", "-ss", from.toFixed(3), "-i", src, "-t", String(d0), "-af", "volumedetect", "-f", "null", "-"]);
  const m = /max_volume: ([-\d.]+) dB/.exec((vd.stderr || "") + (vd.stdout || ""));
  const peak = m ? parseFloat(m[1]) : -20;
  let gain = TARGET_PEAK - peak;
  gain = Math.max(-14, Math.min(12, gain)); // 太小的声音不要硬抬，会把底噪一起抬上来
  const fo = Math.max(0, d0 - 0.06);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  sh("ffmpeg", ["-v", "error", "-y", "-ss", from.toFixed(3), "-i", src, "-t", d0.toFixed(3), "-af",
    `aresample=48000,highpass=f=${hp},volume=${gain.toFixed(2)}dB,afade=t=in:d=0.004,afade=t=out:st=${fo.toFixed(3)}:d=0.06`,
    "-ac", "2", "-c:a", "pcm_s16le", dst]);
  return { dur: durSec(dst), from: +from.toFixed(3), peak: +peak.toFixed(1), gain: +gain.toFixed(1) };
}

// ---------- 写回 sfx.tsx 的时长表 ----------
function writeTable(man) {
  const names = Object.keys(CUES);
  const rows = names.map((n) => {
    const f = path.join(SFXDIR, `${n}.wav`);
    const fr = fs.existsSync(f) ? Math.max(2, Math.round(durSec(f) * FPS)) : (man[n]?.frames ?? 8);
    return `  ${n}: ${fr},`;
  });
  const body = `import React, { createContext, useContext } from "react";
import { Audio, Sequence, staticFile } from "remotion";

// 音效文件在 public/sfx/<name>.wav。现在这些是**真实音效**，由 scripts/sfx.mjs 走
// vendor/sound（猫学长开源的 sfx-sources skill）从 Mixkit 与 Freesound 的 CC0 素材取的，
// 不是 scripts/gen_sfx.py 程序合成的那批（那批已备份到 public/sfx_synth_backup/）。
// 下面的数字是每条音效的**实测帧数**，由 \`node scripts/sfx.mjs table\` 刷新，别手改；
// 每条的来源、许可、裁切点记录在 public/sfx/manifest.json。
// 组件里这样用：<Sfx name="pop" at={cue} />
export const SFX = {
${rows.join("\n")}
} as const;
export type SfxName = keyof typeof SFX;

const VOL = ${JSON.stringify(Object.fromEntries(names.map((n) => [n, CUES[n].vol])), null, 0).replace(/","/g, '", "')};

const SfxCtx = createContext(true);
export const SfxProvider: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({ enabled, children }) => <SfxCtx.Provider value={enabled}>{children}</SfxCtx.Provider>;
export const useSfxEnabled = () => useContext(SfxCtx);

// 默认音量按 cue 走（砸点响一点、转场轻一点），组件里显式传 volume 时以传入值为准。
export const Sfx: React.FC<{ name: SfxName; at: number; volume?: number }> = ({ name, at, volume }) => {
  const on = useContext(SfxCtx);
  if (!on || !Number.isFinite(at) || at < 0) return null;
  return (
    <Sequence from={Math.round(at)} durationInFrames={SFX[name] + 6} name={\`sfx:\${name}\`} layout="none">
      <Audio src={staticFile(\`sfx/\${name}.wav\`)} volume={volume ?? VOL[name] ?? 0.35} />
    </Sequence>
  );
};
`;
  fs.writeFileSync(TSX, body);
  return names.length;
}

// ---------- 命令 ----------
function pick(cue, key, opt = {}) {
  const spec = CUES[cue];
  if (!spec) throw new Error(`未知 cue：${cue}（可选：${Object.keys(CUES).join(", ")}）`);
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMP || "/tmp", "sfx-"));
  const out = sfxCli(["get", tmp, key]);
  const file = (out.split("\n").filter((l) => l && !l.startsWith("FAIL"))[0] || "").split("  [")[0].trim();
  if (!file) throw new Error(`下载失败：${out.trim()}`);
  const src = path.join(tmp, file);
  if (!fs.existsSync(src)) throw new Error(`下载没落盘：${src}`);
  const meta = lookupIndex(key);
  // 只放行 CC0 / Mixkit / Kenney：BY 要署名、BY-NC 不能商用，短视频里都挂不了。
  if (!/^(CC0|Mixkit|Kenney)$/i.test(meta.license || "CC0")) {
    throw new Error(`${key} 的许可是 ${meta.license}，不在可商用免署名范围内（只取 CC0 / Mixkit / Kenney）`);
  }
  const dst = path.join(SFXDIR, `${cue}.wav`);
  const info = normalize(src, dst, spec.max, spec.hp ?? 50, PUNCH.has(cue));
  // 自检：打击类如果裁完峰值还落在 0.25s 之后，说明这条素材的 attack 不对，
  // 渲染出来就是「画面砸了、声音慢半拍」—— 当场报出来，别等用户听出来。
  const pk = PUNCH.has(cue) ? peakAt(dst) : 0;
  if (PUNCH.has(cue) && pk > 0.25) console.log(`  ⚠ ${cue}：${info.dur.toFixed(2)}s 里峰值在 ${pk.toFixed(2)}s，attack 偏晚，换一条（search ${cue}）`);
  const man = readManifest();
  man[cue] = { key, title: meta.title || file, source: key.split(":")[0], license: meta.license || "CC0", author: meta.author || "", dur: +info.dur.toFixed(3), frames: Math.max(2, Math.round(info.dur * FPS)), max: spec.max, cutFrom: info.from, peakDb: info.peak, gainDb: info.gain, pickedAt: new Date().toISOString().slice(0, 10), note: opt.note || "" };
  fs.writeFileSync(MANIFEST, JSON.stringify(man, null, 1));
  return man[cue];
}
function lookupIndex(key) {
  const idx = path.join(process.env.HOME || process.env.USERPROFILE || "~", ".cache", "sfx-sources", "index.json");
  try {
    return JSON.parse(fs.readFileSync(idx, "utf8"))[key] || {};
  } catch {
    return {};
  }
}
function cmdSearch(cue, q, n) {
  if (!CUES[cue]) {
    console.log(sfxCli(["mixkit", q, "-n", String(n)]));
    return;
  }
  for (const [source, query] of CUES[cue].queries) {
    console.log(`\n—— ${source} "${query}"（${CUES[cue].why}；上限 ${CUES[cue].max}s）`);
    try {
      for (const r of search(source, query).slice(0, n)) {
        const sec = secs(r.dur);
        const ok = sec > 0 && sec <= CUES[cue].max; // 超预算的标 ×：会被裁掉尾巴，通常不是那个声音
        console.log(`${ok ? "✓" : "×"} ${r.key}\t${r.dur}\t${r.stats}\t${r.license}\t${r.title}${r.desc ? "  ｜" + r.desc.slice(0, 60) : ""}`);
      }
    } catch (e) {
      console.log("  跳过：" + String(e.message).slice(0, 120));
    }
  }
}
function cmdAuto(cues) {
  const list = cues.length ? cues : Object.keys(CUES);
  const done = [];
  for (const cue of list) {
    const spec = CUES[cue];
    let picked = null;
    for (const [source, query] of spec.queries) {
      let rows = [];
      try {
        rows = search(source, query);
      } catch {
        continue;
      }
      // 没有「时长在预算内」的候选时，退而取**最短的那条**：normalize 只保留前 max 秒，
      // 而 trailer 级 impact 的「咚」就在开头，裁掉尾巴正好（这类素材源本身就 4~10s，等不到短的）。
      const fit = rows.filter((r) => {
        const sec = secs(r.dur);
        return sec > 0.05 && sec <= Math.max(spec.max, 1);
      });
      const use = fit[0] || rows.slice().sort((x, y) => secs(x.dur) - secs(y.dur))[0];
      if (!use) continue;
      try {
        picked = pick(cue, use.key);
        break;
      } catch (e) {
        console.log(`  ${cue}：${use.key} 失败 ${String(e.message).slice(0, 80)}`);
      }
    }
    if (picked) {
      console.log(`✓ ${cue.padEnd(8)} ${picked.dur.toFixed(2)}s (${picked.frames}帧) ← ${picked.source}:${picked.key.split(":")[1]} 「${picked.title}」 [${picked.license}]`);
      done.push(cue);
    } else console.log(`✗ ${cue}：没找到时长合适的，手动跑 node scripts/sfx.mjs search ${cue}`);
  }
  writeTable(readManifest());
  console.log(`\n完成 ${done.length}/${list.length} 条，已刷新 src/lib/sfx.tsx 的时长表。`);
}
// 试听带：我（模型）听不到声音，Mixkit 又只给文件名，所以把每个 cue 的前几名候选
// 原样（最多 3 秒）拼成一条 mp3，人 30 秒就能听完并直接报编号让我换。
//   node scripts/sfx.mjs audition            全部 15 个 cue × 前 3 名
//   node scripts/sfx.mjs audition impact ding 只审这几个
function cmdAudition(cues, per = 3) {
  const dir = path.join(ROOT, "public", "sfx_audition");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const gap = path.join(dir, "_gap.wav");
  sh("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "0.45", gap]);
  const list = cues.length ? cues : Object.keys(CUES);
  const rows = [];
  for (const cue of list) {
    const spec = CUES[cue];
    const cand = [];
    for (const [source, query] of spec.queries) {
      if (cand.length >= per) break; // 前一名已经够了就别再去 freesound 慢下载
      try {
        for (const r of search(source, query)) if (!cand.some((x) => x.key === r.key)) cand.push(r);
      } catch {
        /* 某个源挂了不影响整条试听带 */
      }
    }
    for (const r of cand.slice(0, per)) {
      const n = rows.length + 1;
      const dst = path.join(dir, `${String(n).padStart(2, "0")}_${cue}.wav`);
      try {
        const tmp = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "sfxa-"));
        const out = sfxCli(["get", tmp, r.key]);
        const file = (out.split("\n").filter((l) => l && !l.startsWith("FAIL"))[0] || "").split("  [")[0].trim();
        if (!file) continue;
        const src = path.join(tmp, file);
        const d = Math.min(3, durSec(src));
        sh("ffmpeg", ["-v", "error", "-y", "-i", src, "-t", d.toFixed(3), "-af", "aresample=48000,volume=6dB", "-ac", "2", dst]);
        rows.push({ n, cue, key: r.key, dur: r.dur, title: r.title, file: dst });
        console.log(`[${String(n).padStart(2)}] ${cue.padEnd(8)} ${r.key.padEnd(11)} ${r.dur.padEnd(6)} ${r.title}`);
      } catch (e) {
        console.log(`  ${cue} ${r.key} 取不到：${String(e.message).slice(0, 70)}`);
      }
    }
  }
  if (!rows.length) return console.log("没有候选可下，检查网络。");
  // 每段之间插 0.45s 静音，用 concat demuxer 拼（所有片段都是 48k/立体声/pcm_s16，参数一致）
  const lines = [];
  for (const r of rows) {
    lines.push(`file '${path.relative(dir, gap).replace(/\\/g, "/")}'`);
    lines.push(`file '${path.basename(r.file)}'`);
  }
  fs.writeFileSync(path.join(dir, "concat.txt"), lines.join("\n"));
  const mp3 = path.join(ROOT, "out", "sfx_audition.mp3");
  fs.mkdirSync(path.dirname(mp3), { recursive: true });
  sh("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "concat.txt"), "-c:a", "libmp3lame", "-q:a", "4", mp3]);
  fs.writeFileSync(path.join(dir, "list.json"), JSON.stringify(rows, null, 1));
  console.log(`\n试听带：${mp3}（${rows.length} 段，每段前有一小段静音隔开，顺序就是上面的编号）`);
  console.log("听完直接说：impact 换第 2 个 / ding 用 mk:1791 —— 我就 node scripts/sfx.mjs pick <cue> <key>。");
}
function cmdAudit() {
  const man = readManifest();
  const names = Object.keys(CUES);
  console.log("cue       时长    帧  来源            许可      标题 / 备注");
  for (const n of names) {
    const m = man[n];
    const f = path.join(SFXDIR, `${n}.wav`);
    const d = fs.existsSync(f) ? durSec(f) : 0;
    console.log(`${n.padEnd(9)} ${d.toFixed(2)}s ${String(Math.round(d * FPS)).padStart(4)}  ${(m?.source || "合成").padEnd(14)} ${(m?.license || "-").padEnd(8)} ${m?.title || "gen_sfx.py 程序合成"}${m?.note ? "  ｜" + m.note : ""}`);
  }
  console.log(`\n清单：${MANIFEST}`);
}

const argv = process.argv.slice(2);
const cmd = argv[0] || "audit";
try {
  if (cmd === "audit") cmdAudit();
  else if (cmd === "table") console.log(`刷新 ${writeTable(readManifest())} 条时长`);
  else if (cmd === "search") {
    const i = argv.indexOf("-n");
    const n = i > 0 ? Number(argv[i + 1]) : 8;
    const rest = argv.filter((_, k) => k !== i && k !== i + 1).slice(1);
    if (CUES[rest[0]]) cmdSearch(rest[0], "", n);
    else cmdSearch("", rest.join(" "), n);
  } else if (cmd === "pick") {
    const m = pick(argv[1], argv[2]);
    console.log(`✓ ${argv[1]} → ${m.dur.toFixed(2)}s (${m.frames}帧) 「${m.title}」[${m.license}]`);
    writeTable(readManifest());
  } else if (cmd === "auto") cmdAuto(argv.slice(1));
  else if (cmd === "audition") cmdAudition(argv.slice(1).filter((x) => CUES[x]));
  else if (cmd === "kenney") console.log(kenneyPackList().join(" "), "\n", kenneyFiles(argv[1] || "interface-sounds").join(" "));
  else console.log("用法：sfx.mjs [audit|table|search <cue>|-source mixkit \"词\"|pick <cue> <key>|auto [cue...]|audition [cue...]|kenney [pack]]");
} catch (e) {
  console.error("✖ " + e.message);
  process.exit(1);
}
