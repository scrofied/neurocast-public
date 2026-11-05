import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./lib/registry-node.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 30;
const [cmd = "sheet", a1, a2] = process.argv.slice(2);
const fail = (m) => { console.error(`失败：${m}`); process.exit(1); };
if (!["sheet", "video"].includes(cmd)) fail("用法：sheet [person.mp4|-] [id片段] 或 video <id|all> [person.mp4|-]");
const reg = await loadRegistry();
let tpls = reg.list.filter((c) => c.opening?.template && !c.opening.draft);
if (cmd === "video" && a1 && a1 !== "all") tpls = tpls.filter((c) => c.id === a1);
if (cmd === "sheet" && a2) tpls = tpls.filter((c) => c.id.includes(a2));
if (!tpls.length) fail("没有匹配的开场模板");
const secs = (c) => c.opening?.sec ?? Math.min(c.maxSec, Math.max(c.minSec, 3));
const personArg = cmd === "video" ? a2 : a1;
const person = path.resolve(ROOT, personArg && personArg !== "-" ? personArg : "examples/ai-tool-4steps/talk.mp4");
const needPerson = tpls.some((c) => !c.opening.selfBg);
const usePerson = personArg !== "-" && fs.existsSync(person) && (needPerson || !!personArg);
if (needPerson && !usePerson) fail("透明开场需要真人视频；请传 person.mp4。自带背景模板可用 '-' 单独预览。");
let personSrc, personFrames;
if (usePerson) {
  const seconds = Math.max(...tpls.map(secs)) + 1;
  const stat = fs.statSync(person);
  const key = crypto.createHash("sha256").update(`${person}:${stat.mtimeMs}:${stat.size}:${seconds}`).digest("hex").slice(0, 14);
  const pubDir = path.join(ROOT, "public", "jobs", "_opening-previews");
  fs.mkdirSync(pubDir, { recursive: true });
  const clip = path.join(pubDir, `${key}.mp4`);
  if (!fs.existsSync(clip)) execFileSync("ffmpeg", ["-v", "error", "-y", "-stream_loop", "-1", "-i", person, "-t", String(seconds), "-an", "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", clip]);
  personSrc = `jobs/_opening-previews/${key}.mp4`;
  personFrames = Math.round(seconds * FPS);
}
const timelineFor = (c) => {
  const dur = Math.round(secs(c) * FPS);
  return {
    meta: { title: c.id, seed: 7, skin: "aurora", font: "yahei", world: "grid", fps: FPS, width: 1920, height: 1080, mirror: false, showCaptions: false, sfx: true, chapterFlash: false, ...(personSrc ? { presenter: { src: personSrc, frames: personFrames, offset: 0, full: dur, focusX: 0.5, focusY: 0.3 } } : {}) },
    durationInFrames: dur, chapters: [{ title: c.id, start: 0, end: dur }],
    shots: [{ id: "s0", type: "narration", variant: 0, start: 0, dur, chapter: 0, text: "", data: { keywords: [" "] }, transition: "cut" }], captions: [],
    opening: { type: c.id, at: 0, until: dur, data: c.example },
  };
};
const { bundle } = await import("@remotion/bundler");
const { selectComposition, renderStill, renderMedia } = await import("@remotion/renderer");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
const chromiumOptions = { gl: "angle" };
const outDir = path.join(ROOT, "out", "templates");
fs.mkdirSync(outDir, { recursive: true });
const sheets = [];
for (const c of tpls) {
  const inputProps = { timeline: timelineFor(c) };
  const composition = await selectComposition({ serveUrl, id: "NeuroCast", inputProps, chromiumOptions });
  if (cmd === "video") {
    const out = path.join(ROOT, "openings", "previews", `${c.id}.mp4`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: out, inputProps, chromiumOptions, concurrency: 4 });
    console.log(`模板演示：${out}`);
    continue;
  }
  const dur = inputProps.timeline.durationInFrames;
  const moments = dur > 5 * FPS ? [0, 2.5 * FPS, 5.7 * FPS, dur - 12] : [0, dur * 0.25, dur * 0.55, dur * 0.8];
  const frames = [...new Set(moments.map((f) => Math.max(0, Math.min(dur - 1, Math.round(f)))))];
  const files = [];
  for (const frame of frames) {
    const out = path.join(outDir, `_${c.id}_${frame}.png`);
    await renderStill({ serveUrl, composition, output: out, frame, inputProps, chromiumOptions });
    files.push(out);
  }
  const sheet = path.join(outDir, `${c.id}.jpg`);
  const py = "import sys\nfrom PIL import Image, ImageDraw\nfiles=sys.argv[3:]\nw,h=480,270\ns=Image.new('RGB',(w*len(files),h+24),'black')\nImageDraw.Draw(s).text((6,4),sys.argv[2],fill='white')\nfor i,f in enumerate(files): s.paste(Image.open(f).convert('RGB').resize((w,h)),(i*w,24))\ns.save(sys.argv[1],quality=85)";
  execFileSync("python", ["-c", py, sheet, `${c.id}: ${frames.map((f) => `${(f / FPS).toFixed(1)}s`).join(' / ')}`, ...files]);
  for (const f of files) fs.unlinkSync(f);
  sheets.push(sheet);
  console.log(`模板拼图：${sheet}`);
}
if (sheets.length) {
  const out = path.join(outDir, "_all.jpg");
  execFileSync("python", ["-c", "import sys\nfrom PIL import Image\nims=[Image.open(f) for f in sys.argv[2:]]\nw=max(i.width for i in ims);h=sum(i.height for i in ims)\ns=Image.new('RGB',(w,h));y=0\nfor i in ims: s.paste(i,(0,y));y+=i.height\ns.save(sys.argv[1],quality=85)", out, ...sheets]);
  console.log(`总览：${out}；正式出片另跑 openings.mjs preview <input.json> 检查本片真人/素材/人声。`);
}
