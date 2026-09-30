// QA for one asset: render its Gallery composition at several moments into one contact sheet.
// node scripts/preview.mjs <component-id> [variant=0] [fractions=0.15,0.4,0.65,0.9]
// -> out/preview/<id>-v<variant>.jpg
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [, , ids, variant = "0", fracArg = "0.15,0.4,0.65,0.9"] = process.argv;
if (!ids) {
  console.error("用法: node scripts/preview.mjs <组件id[,组件id...]> [变体=0] [时刻比例=0.15,0.4,0.65,0.9]");
  process.exit(2);
}
const fracs = fracArg.split(",").map(Number);
const outDir = path.join(ROOT, "out", "preview");
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
const comps = await getCompositions(serveUrl, { chromiumOptions: { gl: "angle" } });
for (const id of ids.split(",")) {
  const comp = comps.find((c) => c.id === `g-${id}-v${variant}`);
  if (!comp) {
    console.error(`✖ 没有 Gallery 组合 g-${id}-v${variant}（组件是否已在 registry.ts 注册？）`);
    continue;
  }
  const files = [];
  for (const fr of fracs) {
    const frame = Math.min(comp.durationInFrames - 1, Math.floor(comp.durationInFrames * fr));
    const f = path.join(outDir, `_${id}_${frame}.png`);
    await renderStill({ serveUrl, composition: comp, output: f, frame, chromiumOptions: { gl: "angle" }, inputProps: comp.defaultProps });
    files.push(f);
  }
  const sheet = path.join(outDir, `${id}-v${variant}.jpg`);
  const py = `import sys\nfrom PIL import Image\nfs=sys.argv[2:]\nw,h=960,540\ncols=2\nrows=(len(fs)+1)//2\ns=Image.new('RGB',(cols*w,rows*h))\nfor i,f in enumerate(fs):\n  s.paste(Image.open(f).convert('RGB').resize((w,h)),((i%cols)*w,(i//cols)*h))\ns.save(sys.argv[1],quality=80)\n`;
  execFileSync("python", ["-c", py, sheet, ...files]);
  for (const f of files) fs.unlinkSync(f);
  console.log(`✓ ${id} -> ${sheet}`);
}
