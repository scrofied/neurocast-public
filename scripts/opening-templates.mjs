// QA / preview for the 20 opening templates: render each one over a real talking-head clip.
// usage:
//   node scripts/opening-templates.mjs sheet [person.mp4]      -> out/templates/<id>.jpg (4 moments) + out/templates/_all.jpg
//   node scripts/opening-templates.mjs video <id> [person.mp4] -> openings/previews/<id>.mp4 (3 s)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./lib/registry-node.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 30;
const [cmd = "sheet", a1, a2] = process.argv.slice(2);
const person = path.resolve(ROOT, (cmd === "video" ? a2 : a1) ?? "examples/ai-tool-4steps/talk.mp4");
// usage also: node scripts/opening-templates.mjs video all
if (!fs.existsSync(person)) {
  console.error(`✖ 找不到真人视频 ${person}`);
  process.exit(1);
}

// H.264 copy of the person clip inside public/ (Chrome can't decode HEVC)
const pubDir = path.join(ROOT, "public", "jobs", "_templates");
fs.mkdirSync(pubDir, { recursive: true });
const clip = path.join(pubDir, "person.mp4");
if (!fs.existsSync(clip)) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", person, "-t", "6", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", clip]);

const reg = await loadRegistry();
const tpls = reg.list.filter((c) => c.opening?.template);
const DUR = 90; // 3 s: the template owns the whole window, the presenter stays full-screen
const timelineFor = (id) => ({
  meta: { title: id, seed: 7, skin: "aurora", font: "yahei", world: "grid", fps: FPS, width: 1920, height: 1080, mirror: false, showCaptions: false, sfx: true, presenter: { src: "jobs/_templates/person.mp4", frames: 170, offset: 0, full: 999, focusX: 0.5, focusY: 0.3 } },
  durationInFrames: DUR,
  chapters: [{ title: id, start: 0, end: DUR }],
  shots: [{ id: "s0", type: "narration", variant: 0, start: 0, dur: DUR, chapter: 0, text: "", data: { keywords: [" "] }, transition: "cut" }],
  captions: [],
  opening: { type: id, at: 0, until: DUR, data: {} },
});

const { bundle } = await import("@remotion/bundler");
const { selectComposition, renderStill, renderMedia } = await import("@remotion/renderer");
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });

if (cmd === "video") {
  // "video all" renders every template
  const ids = a1 === "all" ? tpls.map((c) => c.id) : [a1];
  for (const id of ids) {
    const out = path.join(ROOT, "openings", "previews", `${id}.mp4`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const inputProps = { timeline: timelineFor(id) };
    const composition = await selectComposition({ serveUrl, id: "NeuroCast", inputProps, chromiumOptions: { gl: "angle" } });
    await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: out, inputProps, chromiumOptions: { gl: "angle" }, concurrency: 8 });
    console.log(`✓ ${out}`);
  }
  process.exit(0);
}

const outDir = path.join(ROOT, "out", "templates");
fs.mkdirSync(outDir, { recursive: true });
const FR = [0, 22, 45, 70];
const sheets = [];
for (const c of tpls) {
  const inputProps = { timeline: timelineFor(c.id) };
  const composition = await selectComposition({ serveUrl, id: "NeuroCast", inputProps, chromiumOptions: { gl: "angle" } });
  const files = [];
  for (const f of FR) {
    const p = path.join(outDir, `_${c.id}_${f}.png`);
    await renderStill({ serveUrl, composition, output: p, frame: f, inputProps, chromiumOptions: { gl: "angle" } });
    files.push(p);
  }
  const sheet = path.join(outDir, `${c.id}.jpg`);
  const py = `import sys\nfrom PIL import Image, ImageDraw\nfs=sys.argv[3:]\nw,h=480,270\ns=Image.new('RGB',(w*len(fs),h+24),'black')\nd=ImageDraw.Draw(s)\nd.text((6,4),sys.argv[2],fill='white')\nfor i,f in enumerate(fs):\n  s.paste(Image.open(f).convert('RGB').resize((w,h)),(i*w,24))\ns.save(sys.argv[1],quality=80)\n`;
  execFileSync("python", ["-c", py, sheet, c.id, ...files]);
  for (const f of files) fs.unlinkSync(f);
  sheets.push(sheet);
  console.log(`✓ ${c.id}`);
}
const all = path.join(outDir, "_all.jpg");
execFileSync("python", ["-c", "import sys\nfrom PIL import Image\nfs=sys.argv[2:]\nims=[Image.open(f) for f in fs]\nw,h=ims[0].size\ns=Image.new('RGB',(w,h*len(ims)))\nfor i,im in enumerate(ims): s.paste(im,(0,i*h))\ns.save(sys.argv[1],quality=78)", all, ...sheets]);
console.log(`✓ 总览：${all}`);
