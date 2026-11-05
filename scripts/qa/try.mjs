// QA a component with custom data (not just its Gallery example).
// node scripts/qa/try.mjs <component-id> <data.json | inline-json> [sec=6] [fractions=0.15,0.4,0.65,0.9] [tag]
// -> out/preview/<id>-try[-tag].jpg
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const [, , id, dataArg, secArg = "6", fracArg = "0.15,0.4,0.65,0.9", tag = ""] = process.argv;
if (!id || !dataArg) {
  console.error("用法: node scripts/qa/try.mjs <组件id> <data.json 或 JSON 字符串> [秒=6] [时刻比例] [标签]");
  process.exit(2);
}
const data = JSON.parse(fs.existsSync(dataArg) ? fs.readFileSync(dataArg, "utf8") : dataArg);
const FPS = 30;
const WORLD = process.env.WORLD || "grid";
const SKIN = process.env.SKIN || "aurora";
const dur = Math.round(Number(secArg) * FPS);
const timeline = {
  meta: { title: id, seed: 7, skin: SKIN, font: "yahei", world: WORLD, fps: FPS, width: 1920, height: 1080, mirror: false, showCaptions: false },
  durationInFrames: dur,
  chapters: [{ title: id, start: 0, end: dur }],
  shots: [{ id: "g", type: id, variant: 0, start: 0, dur, chapter: 0, text: "", data, transition: "cut" }],
  captions: [],
};
const outDir = path.join(ROOT, "out", "preview");
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
const comps = await getCompositions(serveUrl, { chromiumOptions: { gl: "angle" }, inputProps: { timeline } });
const base = comps.find((c) => c.id === "NeuroCast");
const comp = { ...base, durationInFrames: dur, props: { timeline }, defaultProps: { timeline } };
const files = [];
for (const fr of fracArg.split(",").map(Number)) {
  const frame = Math.min(dur - 1, Math.floor(dur * fr));
  const f = path.join(outDir, `_try_${id}_${frame}.png`);
  await renderStill({ serveUrl, composition: comp, output: f, frame, chromiumOptions: { gl: "angle" }, inputProps: { timeline } });
  files.push(f);
}
const sheet = path.join(outDir, `${id}-try${tag ? `-${tag}` : ""}.jpg`);
const py = `import sys\nfrom PIL import Image\nfs=sys.argv[2:]\nw,h=960,540\ncols=2\nrows=(len(fs)+1)//2\ns=Image.new('RGB',(cols*w,rows*h))\nfor i,f in enumerate(fs):\n  s.paste(Image.open(f).convert('RGB').resize((w,h)),((i%cols)*w,(i//cols)*h))\ns.save(sys.argv[1],quality=80)\n`;
execFileSync("python", ["-c", py, sheet, ...files]);
if (!process.env.KEEP) for (const f of files) fs.unlinkSync(f);
console.log(`✓ ${id} -> ${sheet}`);
