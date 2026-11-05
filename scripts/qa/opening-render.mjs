import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia, renderStill } from "@remotion/renderer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = fs.mkdtempSync(path.join(ROOT, "out/qa/openings-"));
const assets = fs.mkdtempSync(path.join(ROOT, "public/jobs/_opening-qa-"));
const rel = (file) => path.relative(path.join(ROOT, "public"), file).replace(/\\/g, "/");
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", ...args], { maxBuffer: 32 * 1024 * 1024 });
const image = path.join(assets, "screenshot.png");
fs.copyFileSync(path.join(ROOT, "examples/0930-ability-audit/assets-src/arena-rank-overall.png"), image);
ff(["-f", "lavfi", "-i", "sine=frequency=220:duration=10", "-ar", "48000", path.join(assets, "tone.wav")]);
ff(["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(assets, "short.mp4")]);
const source = { platform: "已有截图，测试展示不作产品结论", capturedAt: "2026-10-17" };
const copy = { hook: "先看内容，再解释步骤", proof: "测试只检查素材显示与画面交接", payoff: "先打开原图，对照同一项内容", proofAt: 60, payoffAt: 150 };
const body = { id: "body", type: "op-t02-number", variant: 0, start: 0, dur: 300, chapter: 0, text: "", data: {}, transition: "cut" };
const timeline = (type, data, meta = {}, dur = 300) => ({
  meta: { title: "开场视听回归", seed: 7, skin: "aurora", font: "yahei", world: "grid", fps: 30, width: 1920, height: 1080, mirror: false, showCaptions: false, sfx: true, chapterFlash: false, ...meta },
  durationInFrames: dur, chapters: [], captions: [], shots: [{ ...body, dur }],
  opening: { type, at: 0, until: 240, data },
});
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts") });
const chromiumOptions = { gl: "angle" };
const render = async (name, tl, end, start = 0) => {
  const inputProps = { timeline: tl };
  const composition = await selectComposition({ serveUrl, id: "NeuroCast", inputProps, chromiumOptions });
  const file = path.join(out, `${name}.mp4`);
  await renderMedia({ serveUrl, composition, inputProps, chromiumOptions, outputLocation: file, codec: "h264", scale: 0.5, frameRange: [start, end], concurrency: 4 });
  return file;
};
const peak = (file) => {
  const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", file], { encoding: "utf8" }));
  if (!info.streams.some((s) => s.codec_type === "audio")) return 0;
  const pcm = ff(["-i", file, "-vn", "-f", "f32le", "-ac", "1", "pipe:1"]);
  let value = 0;
  for (let i = 0; i + 4 <= pcm.length; i += 4) value = Math.max(value, Math.abs(pcm.readFloatLE(i)));
  return value;
};
const quiet = timeline("op-quiet-question", copy, { bgm: rel(path.join(assets, "tone.wav")) });
const quietFile = await render("quiet-with-bgm-and-hidden-sfx", quiet, 209);
assert.ok(peak(quietFile) < 0.00001, "quiet leaked music or hidden-body sound");
const pulse = await render("pulse", timeline("op-quiet-question", { ...copy, sound: "pulse" }), 209);
assert.ok(peak(pulse) > 0.001, "pulse soundtrack missing");
const pro = timeline("pro-03-iris-title", {}, { sfx: false });
pro.opening.until = 105;
const muted = await render("pro-muted", pro, 80);
assert.ok(peak(muted) < 0.00001, "global sfx:false did not mute PRO");
const voice = await render("quiet-preserves-narration", timeline("op-quiet-question", copy, { audio: rel(path.join(assets, "tone.wav")), sfx: false }), 35);
assert.ok(peak(voice) > 0.01, "narration was muted with effects");
const nested = timeline("op-quiet-question", { ...copy, sound: "quiet" }, { bgm: rel(path.join(assets, "tone.wav")) });
nested.shots = [{ ...body, type: "talking-head-stage", data: { video: rel(path.join(assets, "short.mp4")), videoFrames: 30, opening: nested.opening, left: [{ type: "op-t02-number", at: 0, until: 240, data: {} }] } }];
delete nested.opening;
const nestedQuiet = await render("nested-quiet-with-hidden-panel", nested, 209);
assert.ok(peak(nestedQuiet) < 0.00001, "nested quiet leaked music or hidden-panel sound");
const loopedBgm = await render("bgm-after-loop", timeline("op-quiet-question", copy, { bgm: rel(path.join(assets, "tone.wav")), sfx: false }, 360), 335, 310);
assert.ok(peak(loopedBgm) > 0.005, "looping BGM restarted opening attenuation during the body");
const real = timeline("op-result-first", { ...copy, result: { src: rel(image), source } });
const film = await render("result-and-handoff", real, 299);
const long = { hook: "长文案边界测试".repeat(6).slice(0, 36), proof: "说明文字边界测试".repeat(8).slice(0, 60), payoff: "第一步动作边界测试".repeat(8).slice(0, 60) };
const cases = [
  ["result", real],
  ["quiet-long", timeline("op-quiet-question", { ...copy, ...long })],
  ["nested-quiet", nested],
  ["compare-short-video", timeline("op-proof-compare", { ...copy, ...long, before: { src: rel(image), source: { platform: "来源长度测试".repeat(12) } }, after: { src: rel(path.join(assets, "short.mp4")), kind: "video", frames: 30, source: { platform: "QA测试图案，非证据" } } })],
  ["three-beat", { ...timeline("op-three-beat", {}), opening: { type: "op-three-beat", at: 0, until: 180, data: {} } }],
];
for (const [name, tl] of cases) {
  const inputProps = { timeline: tl };
  const composition = await selectComposition({ serveUrl, id: "NeuroCast", inputProps, chromiumOptions });
  const files = [];
  for (const frame of [0, 78, 174, 250]) {
    const file = path.join(out, `${name}-${frame}.png`);
    await renderStill({ serveUrl, composition, inputProps, chromiumOptions, frame, output: file });
    files.push(file);
  }
  if (name === "nested-quiet") execFileSync("python", ["-c", "import sys\nfrom PIL import Image\nfor f in sys.argv[1:]:\n im=Image.open(f).convert('RGB')\n assert im.getpixel((12,12)) == (242,237,223), 'nested opening inherited post effects or camera drift'", ...files.slice(0, 3)]);
  execFileSync("python", ["-c", "import sys\nfrom PIL import Image\ns=Image.new('RGB',(1920,1080))\nfor i,f in enumerate(sys.argv[2:]): s.paste(Image.open(f).convert('RGB').resize((960,540)),((i%2)*960,(i//2)*540))\ns.save(sys.argv[1])", path.join(out, `${name}-sheet.jpg`), ...files]);
}
fs.writeFileSync(path.join(out, "props.json"), JSON.stringify({ timeline: real }));
console.log(JSON.stringify({ out, assets, film, peaks: { quiet: peak(quietFile), nestedQuiet: peak(nestedQuiet), pulse: peak(pulse), mutedPro: peak(muted), narration: peak(voice) } }, null, 2));
