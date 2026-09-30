// render one still per gallery composition at a given fraction of its length, then build a contact sheet
// node scripts/gallery.mjs [frac=0.6] [filter]
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";

const frac = parseFloat(process.argv[2] ?? "0.6");
const filter = process.argv[3] ?? "";
const root = path.resolve(".");
const outDir = path.join(root, "out", "gallery");
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const comps = (await getCompositions(serveUrl, { chromiumOptions: { gl: "angle" } })).filter((c) => c.id.startsWith("g-") && c.id.includes(filter));
const files = [];
// a few at a time: rendering every composition at once starves video frame extraction (delayRender timeouts)
const jobs = comps.map((c) => async () => {
  const f = path.join(outDir, `${c.id}.png`);
  await renderStill({ serveUrl, composition: c, output: f, frame: Math.floor(c.durationInFrames * frac), chromiumOptions: { gl: "angle" }, inputProps: c.defaultProps, timeoutInMilliseconds: 120000 });
  files.push(f);
  console.log("✓", c.id);
});
for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map((j) => j()));
files.sort();
const py = `
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:]
cols=3
w,h=640,360
rows=(len(fs)+cols-1)//cols
sheet=Image.new('RGB',(cols*w,rows*(h+28)),'black')
d=ImageDraw.Draw(sheet)
for i,f in enumerate(fs):
    im=Image.open(f).convert('RGB').resize((w,h))
    x=(i%cols)*w; y=(i//cols)*(h+28)
    sheet.paste(im,(x,y+28))
    d.text((x+8,y+6),f.split('\\\\')[-1].split('/')[-1],fill='white')
sheet.save(sys.argv[1],quality=78)
`;
fs.writeFileSync(path.join(outDir, "_sheet.py"), py);
const sheet = path.join(outDir, `sheet_${Math.round(frac * 100)}${filter ? "_" + filter : ""}.jpg`);
execFileSync("python", [path.join(outDir, "_sheet.py"), sheet, ...files]);
console.log("sheet:", sheet);
