// QA before the long render: one still per shot (at 60% of its length) -> one contact sheet
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const renderStills = async ({ root, timeline, out, frac = 0.6, only }) => {
  const { bundle } = await import("@remotion/bundler");
  const { selectComposition, renderStill } = await import("@remotion/renderer");
  const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts") });
  const inputProps = { timeline };
  const composition = await selectComposition({ serveUrl, id: "NeuroCast", inputProps, chromiumOptions: { gl: "angle" } });
  const tmp = path.join(path.dirname(out), `_stills_${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  const shots = timeline.shots.filter((s) => !only || only.includes(s.id));
  const files = [];
  let k = 0;
  const work = shots.map((s) => async () => {
    const frame = Math.min(timeline.durationInFrames - 1, s.start + Math.floor(s.dur * frac));
    const f = path.join(tmp, `${String(k++).padStart(3, "0")}_${s.id}_${s.type}.png`);
    await renderStill({ serveUrl, composition, output: f, frame, inputProps, chromiumOptions: { gl: "angle" } });
    files.push(f);
    process.stdout.write(".");
  });
  // a few in parallel
  const pool = 4;
  for (let i = 0; i < work.length; i += pool) await Promise.all(work.slice(i, i + pool).map((w) => w()));
  files.sort();
  const py = `import sys, os\nfrom PIL import Image, ImageDraw\nfs=sys.argv[2:]\nw,h=640,360\ncols=4\nrows=(len(fs)+cols-1)//cols\ns=Image.new('RGB',(cols*w,rows*(h+26)),'black')\nd=ImageDraw.Draw(s)\nfor i,f in enumerate(fs):\n  x=(i%cols)*w; y=(i//cols)*(h+26)\n  s.paste(Image.open(f).convert('RGB').resize((w,h)),(x,y+26))\n  d.text((x+8,y+6),os.path.basename(f)[4:-4],fill='white')\ns.save(sys.argv[1],quality=82)\n`;
  execFileSync("python", ["-c", py, out, ...files]);
  for (const f of files) fs.unlinkSync(f);
  fs.rmdirSync(tmp);
  process.stdout.write("\n");
  return out;
};
