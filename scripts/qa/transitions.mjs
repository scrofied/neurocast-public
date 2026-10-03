// 转场 + 全片后期层的像素验证。造一条把转场都排上的假时间轴，回答三个问题：
//   1) 形状连续转场（zoom/push/wipe/grid）在换镜那 12 帧里真的「揭开」了吗？（看图）
//   2) 撕裂/RGB 分离只出现在换镜帧吗？（同一帧 开后期 vs 关后期 的均差：换镜帧应明显 >0）
//   3) 稳定帧干净吗？（同一帧 开/关 后期均差应 ≈0，滤镜根本没挂上）
//
//   node scripts/qa/transitions.mjs [kinds] [入场抽帧偏移]
//   默认 kinds = fade,cut,glitch,zoom,push,wipe,grid（第 0 镜的 transition 不算边界）
//   默认偏移 = 2,6,10（重叠窗 12 帧的早/中/晚）
//   -> out/qa/transitions.jpg：每行一个边界（上一镜尾巴 | 入场各时刻 | 稳定帧）
//      并打印每个边界「开后期 ↔ 关后期」的像素均差
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { loadRegistry } from "../lib/registry-node.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FPS = 30;
const SHOT = 60; // 每镜 2s：够看清稳定期，又不至于渲染太久
// 第 0 镜没有上一镜可「连续」，所以默认列表第一项只是它的入场样式；从第 2 镜起每项都是一个真实边界。
// 想全测：node scripts/qa/transitions.mjs cut,fly,warp,iris,glitch,fade,flood,zoom,push,wipe,grid
const only = (process.argv[2] ? process.argv[2].split(",") : ["fade", "cut", "glitch", "zoom", "push", "wipe", "grid"]);

// 每镜挑一个「长得明显不一样」的组件，换镜才看得出是谁盖住了谁
const TYPES = ["hook", "narration", "quote", "versus", "cards", "number", "funnel", "chapter", "flow", "timeline", "growth", "screen"];
const reg = await loadRegistry();
const picks = TYPES.map((t) => reg.byId[t]).filter(Boolean);
const shots = only.map((tr, i) => {
  const def = picks[i % picks.length];
  const s = {
    id: `s${i}`,
    type: def.id,
    variant: 0,
    start: i * SHOT,
    dur: SHOT,
    chapter: 0,
    text: `第 ${i + 1} 镜 · ${tr}`,
    data: def.example ?? {},
    transition: tr,
  };
  // 故意给一个 off-center 的洞，验证 through 真的被读到（而不是永远用默认位置）
  if (tr === "zoom") s.through = [0.78, 0.3, 0.16, 0.22];
  return s;
});

const tl = (post) => ({
  meta: { title: "transitions qa", seed: 7, skin: "aurora", font: "yahei", world: "grid", fps: FPS, width: 1920, height: 1080, mirror: false, showCaptions: false, sfx: false, ...(post ? {} : { post: { chroma: 0, tear: 0, flashOnCut: false } }) },
  durationInFrames: shots.length * SHOT,
  chapters: [{ title: "transitions", start: 0, end: shots.length * SHOT }],
  shots,
  captions: [],
});
const ON = tl(true);
const OFF = tl(false);

const outDir = path.join(ROOT, "out", "qa", "_transitions");
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
// 和 qa/try.mjs 一样：先用 getCompositions 拿到 NeuroCast 的真实 composition 对象，再覆盖 props。
// 自己手搓一个 composition 会被 Remotion 当成没有 props，Video 收到 timeline=undefined 直接崩。
const comps = await getCompositions(serveUrl, { chromiumOptions: { gl: "angle" }, inputProps: { timeline: ON } });
const base = comps.find((c) => c.id === "NeuroCast");
if (!base) {
  console.error("✖ 找不到 NeuroCast 组合");
  process.exit(1);
}
const compOf = (props) => ({ ...base, durationInFrames: props.durationInFrames, props: { timeline: props }, defaultProps: { timeline: props } });

// 每个边界抽哪几帧：默认 2/6/10（重叠窗 12 帧的早/中/晚）。
// ioExpo 的转场开头几乎不动，只看第 2 帧会误判「没生效」，所以要抽到中段。
const marks = (process.argv[3] || "2,6,10").split(",").map(Number);
const files = [];
const pairs = []; // [标签, 开后期, 关后期]
const shot = async (name, props, frame, keep = false) => {
  const f = path.join(outDir, `${name}.png`);
  await renderStill({ serveUrl, composition: compOf(props), output: f, frame, chromiumOptions: { gl: "angle" }, inputProps: { timeline: props } });
  if (keep) files.push(f);
  return f;
};

for (let i = 1; i < shots.length; i++) {
  const kind = shots[i].transition;
  const b = shots[i].start;
  await shot(`${String(i).padStart(2, "0")}_${kind}_A尾${b - 6}`, ON, b - 6, true);
  for (const m of marks) {
    const on = await shot(`${String(i).padStart(2, "0")}_${kind}_+${m}`, ON, b + m, true);
    if (m === marks[marks.length - 1]) pairs.push([`${kind} +${m}`, on, await shot(`${String(i).padStart(2, "0")}_${kind}_+${m}关`, OFF, b + m)]);
  }
  // 稳定帧：本镜开始 30 帧后，早已远离重叠窗
  const sOn = await shot(`${String(i).padStart(2, "0")}_${kind}_稳定${b + 30}`, ON, b + 30, true);
  if (i === shots.length - 1) pairs.push([`${kind} 稳定帧`, sOn, await shot(`${String(i).padStart(2, "0")}_${kind}_稳定关${b + 30}`, OFF, b + 30)]);
}
// 第 0 镜的首帧：开场红线——首帧不许有撕裂/闪白
{
  const f0 = await shot("00_首帧", ON, 0, true);
  pairs.push(["首帧(第0镜)", f0, await shot("00_首帧关", OFF, 0)]);
}

const py = `
import sys, json
from PIL import Image, ImageChops
sheet, pairsJson = sys.argv[1], sys.argv[2]
fs = sys.argv[3:-1]
w, h = 480, 270
cols = int(sys.argv[-1])
rows = (len(fs) + cols - 1) // cols
s = Image.new("RGB", (cols * w, rows * h), (8, 10, 16))
for i, f in enumerate(fs):
    s.paste(Image.open(f).convert("RGB").resize((w, h)), ((i % cols) * w, (i // cols) * h))
s.save(sheet, quality=82)
def mad(a, b):
    d = ImageChops.difference(Image.open(a).convert("RGB").resize((160, 90)), Image.open(b).convert("RGB").resize((160, 90)))
    px = list(d.getdata())
    return round(sum(sum(p) for p in px) / (len(px) * 3), 3)
print(json.dumps([[t, mad(a, b)] for t, a, b in json.loads(pairsJson)]))
`;
const sheet = path.join(ROOT, "out", "qa", "transitions.jpg");
const cols = String(marks.length + 2); // 每行一个边界：A尾 | +2 | +6 | +10 | 稳定
const out = execFileSync("python", ["-c", py, sheet, JSON.stringify(pairs), ...files, cols], { encoding: "utf8" }).trim();
for (const f of files) fs.unlinkSync(f);
fs.rmSync(outDir, { recursive: true, force: true });
console.log(`✓ 拼图（每行一个边界：上一镜尾巴 | 入场 +${marks.join(" | +")} | 稳定帧）-> ${sheet}`);
for (const [tag, v] of JSON.parse(out)) console.log(`  ${tag.padEnd(14)} 开后期↔关后期 均差 ${v}`);
