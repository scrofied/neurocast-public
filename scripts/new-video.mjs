// 一条片子一个独立项目文件夹（本 skill 的硬规矩，见 SKILL「每条视频一个独立项目目录」）。
// usage:
//   node scripts/new-video.mjs <片名> [开场id-用ascii短词] [--at <工作区目录>] [--title <完整标题>] [--date YYYY-MM-DD]
//
// 生成两半，各归各位：
//   <工作区>/neurocast-<片名>/    这条片的全部内容：文案.md、input.json、storyboard.json、assets/（素材）、out/（产物）
//   src/openings/<日期>-<id>/      专属开场组件（开场是资产，进开场库，不进片目录）+ 自动写进 src/openings/index.ts
// 工作区默认：--at > 环境变量 NEUROCAST_WORKSPACE > 从 skill 目录往上第一个已经有 neurocast-* 片目录的目录。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const die = (m) => {
  console.error(`✖ ${m}`);
  process.exit(1);
};

const argv = process.argv.slice(2);
const opt = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) opt[argv[i]] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  else pos.push(argv[i]);
}
const name = pos[0];
if (!name) die("用法：node scripts/new-video.mjs <片名> [开场id] [--at 工作区] [--title 完整标题]");
const today = new Date();
const date = opt["--date"] || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die(`--date 要写成 YYYY-MM-DD（现在是 ${date}）`);
const title = opt["--title"] || name;
const ascii = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
// 开场 id 得是能在 storyboard.json / CATALOG 里敲的短词：片名是中文时必须显式给一个
const openId = pos[1] || ascii(name);
if (!openId) die("片名是中文，请再给一个 ascii 开场 id：node scripts/new-video.mjs 成本账单 cost-bill");
if (!/^[a-z][a-z0-9-]*$/.test(openId)) die(`开场 id 只能是小写字母、数字、连字符（现在是 ${openId}）`);

// ---------- 工作区 ----------
const guessWorkspace = () => {
  let dir = ROOT;
  for (let i = 0; i < 6; i++) {
    dir = path.dirname(dir);
    try {
      if (fs.readdirSync(dir).some((f) => /^neurocast-[^.]+$/.test(f) && fs.statSync(path.join(dir, f)).isDirectory())) return dir;
    } catch {}
  }
  return process.cwd();
};
const WS = path.resolve(opt["--at"] || process.env.NEUROCAST_WORKSPACE || guessWorkspace());
const vdir = path.join(WS, `neurocast-${ascii(name) || openId}`);
if (fs.existsSync(vdir)) die(`这条片的目录已经存在：${vdir}（要改就直接改，别再新建一个）`);
const odir = path.join(ROOT, "src", "openings", `${date}-${openId}`);
if (fs.existsSync(odir)) die(`开场目录已存在：${odir}（同一天同 id，换个 --date 或开场 id）`);
// 先确认 index.ts 认得出来（校验不过就什么都不建，免得留下半条片目录）
const idxPath = path.join(ROOT, "src", "openings", "index.ts");
const compName = `Opening${openId.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`;
const IMPORT_MARK = "// >>> new-video：每条片一个专属开场（scripts/new-video.mjs 维护，别手删这行）";
const idxSrc = fs.readFileSync(idxPath, "utf8");
if (idxSrc.includes(`opening-${openId}`)) die(`index.ts 里已经有 opening-${openId} 了`);
const arrM = idxSrc.match(/export const OPENINGS: CompDef\[\] = (\[[^\r\n]*\])/);
if (!arrM) die("index.ts 的 OPENINGS 数组不是一行（或形状变了），请手工加 import 和数组项");
fs.mkdirSync(path.join(vdir, "assets"), { recursive: true });
fs.mkdirSync(path.join(vdir, "out"), { recursive: true });
fs.mkdirSync(odir, { recursive: true });

const write = (p, s) => fs.writeFileSync(p, s, "utf8");

// ---------- 片目录 ----------
write(
  path.join(vdir, "文案.md"),
  `# ${title}

## 开场
[口播: presenter.mp4]
（把口播里说的原话逐字抄在这里；没有真人口播就删掉这一节，改用 TTS 配音）

## 第一章 · <这一章在讲什么>
配音实际念出来的正文。文案必须是配音念的内容，别写配音里没有的句子。

> 下面这些是给自己看的备忘（> 开头的行不会被当成台词，不进字幕）
> 素材先丢进本目录 assets/，正文里挂一行槽位标记点名它，自动分镜就会选对组件并把文件拷进任务目录：
> [logo: Claude, 剪映]      [出处: LMArena 榜单 https://lmarena.ai 2026-09-30]      [来源: …]
> [文档: 长截图.png]  [表格: a.png, b.png]      [对比: 改之前.png 手写; 改之后.png 装了 skill]
> [证据: 报表.png 0.42,0.31 成本占90%]（没写坐标就退成 screen 让管线 OCR 定位）
> [头像: 头像1.png 小王|做了 3 年运营, 阿月|自媒体]      [评论墙: 小明|这招真有用 1.2万, …]（≥3 条）
> [原文: “Everything is a function of the current frame.” ——官方文档 · Models]
> 一条片至少要 4~6 个镜头是真素材（素材占比 ≥20%），全代码动画观众不信。
`
);
write(
  path.join(vdir, "input.json"),
  JSON.stringify({ title, script_file: "文案.md", storyboard: "storyboard.json", audio: "assets/voice.mp3", keywords: [] }, null, 2) + "\n"
);
write(path.join(vdir, "storyboard.json"), JSON.stringify({ keywords: [], shots: [] }, null, 2) + "\n");
write(path.join(vdir, "assets", ".gitkeep"), "");

// ---------- 专属开场骨架 ----------
write(
  path.join(odir, "Opening.tsx"),
  `import React from "react";
import { z } from "zod";
import { easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { CharPop, Slam } from "../../lib/cine/Type";
import { useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, idxOf, ink, Stage, tpl } from "../templates/kit";

// 《${title}》专属开场（${date}）
// 骨架，不是成品：第 0 帧要放什么钩子、几秒给承诺、用什么方式收住 2 秒跳出，得按这条片的口播重写。
// 红线（SKILL「开场前 5 秒」）：首帧不能露素材残帧；大字必须在第 0 帧就有；改完先渲前 5 秒逐帧看。
type D = z.infer<typeof s>;
const s = z.object({
  kick: z.string().default("${title.slice(0, 14)}").describe("首行小字（逐字弹出）"),
  hook: z.string().default("<第 0 帧大字>").describe("首帧就砸下来的钩子"),
  hot: z.string().default("<钩子里最扎心的两三个字>").describe("烧金色的词（留空则不烧）"),
  promise: z.string().default("<几秒给的第二行承诺>").describe("第二行"),
  promiseAt: z.number().default(60).describe("第二行入场（帧/锚点）"),
});

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const pIn = easeOutBack(prog(frame, d.promiseAt, 9));
  const hookOut = easeIn(prog(frame, d.promiseAt - 4, 10)); // 承诺进场前，大字先上移退场，别叠字
  return (
    <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.promiseAt, amp: 7, len: 5 }]} exit="up">
      <div style={{ position: "absolute", left: 96, top: 200, opacity: 1 - hookOut, transform: \`translateY(\${-90 * hookOut}px)\` }}>
        <CharPop frame={frame} at={0} text={d.kick} cues={Array.from(d.kick).map((_, i) => Math.min(2 + i, 12))} size={54} color={t.text} font={t.font.title} strokeW={7} />
        <div style={{ marginTop: 24, display: "flex", alignItems: "baseline" }}>
          <Slam frame={frame} at={0} text={d.hook.replace(d.hot, "")} size={112} color={t.text} font={t.font.title} from={1.7} len={6} blur={4} strokeW={10} style={{ display: "inline-block" }} />
          {d.hot && <span style={{ ...ink(112, t.gold, t.font.title, 12), display: "inline-block", marginLeft: 12, transform: \`scale(\${1 + 0.5 * (1 - easeOut(prog(frame, 3, 8)))})\`, color: t.gold }}>{d.hot}</span>}
        </div>
      </div>
      {frame >= d.promiseAt && (
        <div style={{ position: "absolute", left: 100, top: 470, transform: \`scale(\${0.7 + 0.3 * pIn})\`, opacity: pIn, transformOrigin: "left center" }}>
          <span style={{ ...ink(66, t.primary, t.font.title, 9) }}>{d.promise}</span>
        </div>
      )}
    </Stage>
  );
};

export const Opening${openId.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}: CompDef<D> = {
  ...tpl<D>({
    id: "opening-${openId}",
    name: "开场 · 《${title}》（骨架，待定制）",
    hook: "首帧大字+第二行承诺",
    desc: "第 0 帧 kicker 逐字弹出 + 钩子大字砸下（${'\${d.hot}'} 烧金色）；\${d.promiseAt} 帧第二行承诺缩放入场",
    use: "只给《${title}》用（开场不重样）。骨架阶段的默认画面，定稿前别拿它当风格参考",
    techniques: ["首帧大字", "逐字 kicker", "金色重音", "承诺第二行"],
    schema: s,
    example: { kick: "AI 干货", hook: "别再", hot: "瞎忙", promise: "4 步做完过去 4 小时的活", promiseAt: 60 },
    C,
    camera: (dd, f, dur2) => cam(f, dur2, { punches: [{ at: 0, amt: 0.06 }, { at: dd.promiseAt, amt: 0.04 }] }),
  }),
  noGallery: true,
  opening: { script: "neurocast-${ascii(name) || openId}", hook: "首帧大字+第二行承诺", techniques: ["首帧大字", "逐字 kicker", "金色重音", "承诺第二行"] },
};
`
);

// ---------- 登记进 src/openings/index.ts：只加一行 import + 一个数组项 ----------
const EOL = idxSrc.includes("\r\n") ? "\r\n" : "\n";
const impLine = `import { ${compName} } from "./${date}-${openId}/Opening";`;
let idx = idxSrc;
if (!idx.includes(IMPORT_MARK)) idx = idx.replace(/\r?\nexport const OPENINGS/, `${EOL}${IMPORT_MARK}${EOL}export const OPENINGS`);
idx = idx.replace(IMPORT_MARK, `${IMPORT_MARK}${EOL}${impLine}`);
const arr = arrM[1];
idx = idx.replace(arr, `[${arr.slice(1, -1).trim()}, ${compName}]`);
if (!idx.includes(`${compName}]`)) die("index.ts 数组替换没生效，请手工加 import 和数组项");
write(idxPath, idx);

console.log(`✓ 片目录：${vdir}`);
console.log(`    文案.md / input.json / storyboard.json / assets/（素材）/ out/（成片与静帧默认落这里）`);
console.log(`✓ 专属开场骨架：src/openings/${date}-${openId}/Opening.tsx → 组件 id opening-${openId}（已登记进 index.ts）`);
console.log(`\n下一步：`);
console.log(`  1. 把配音放成 ${path.join(vdir, "assets", "voice.mp3")}，口播/截图放同一目录，文案里挂槽位标记`);
console.log(`  2. node scripts/make.mjs "${path.join(vdir, "input.json")}" --beats     # 看真实节拍`);
console.log(`  3. 定制开场（首帧钩子按这条片重写）+ 照 CATALOG.md 写 storyboard.json`);
console.log(`  4. node scripts/make.mjs "${path.join(vdir, "input.json")}" --plan-only`);
console.log(`  5. node scripts/make.mjs "${path.join(vdir, "input.json")}" --stills`);
console.log(`  6. node scripts/make.mjs "${path.join(vdir, "input.json")}"   # 成片 → ${path.join(vdir, "out")}`);
console.log(`  7. node scripts/openings.mjs sync && node scripts/catalog.mjs`);
