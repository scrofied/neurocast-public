import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const die = (m) => { console.error(`失败：${m}`); process.exit(1); };
const argv = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) {
    if (!["--at", "--title"].includes(argv[i])) die(`未知选项 ${argv[i]}`);
    const key = argv[i];
    if (!argv[i + 1] || argv[i + 1].startsWith("--")) die(`${key} 缺少值`);
    opt[key] = argv[++i];
  } else pos.push(argv[i]);
}
const name = pos[0];
if (!name) die("用法：node scripts/new-video.mjs <片名> [ascii-id] [--at 工作区] [--title 完整标题]");
const ascii = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
const id = pos[1] || ascii(name);
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) die("请给一个小写ascii-id，例如：node scripts/new-video.mjs 成本账单 cost-bill");
const title = opt["--title"] || name;
const guessWorkspace = () => {
  let dir = ROOT;
  for (let i = 0; i < 6; i++) {
    dir = path.dirname(dir);
    if (fs.readdirSync(dir, { withFileTypes: true }).some((f) => f.isDirectory() && /^neurocast-[^.]+$/.test(f.name))) return dir;
  }
  die("未找到片工作区，请用 --at <工作区目录> 指定，不把单条视频建进母 skill");
};
const ws = path.resolve(opt["--at"] || process.env.NEUROCAST_WORKSPACE || guessWorkspace());
const relative = path.relative(ROOT, ws);
if (!(relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))) die("片目录必须放在母 skill 之外，请更换 --at 工作区");
const vdir = path.join(ws, `neurocast-${ascii(name) || id}`);
if (fs.existsSync(vdir)) die(`片目录已经存在：${vdir}，请直接修改原项目`);
fs.mkdirSync(path.join(vdir, "assets"), { recursive: true });
fs.mkdirSync(path.join(vdir, "out"), { recursive: true });
fs.writeFileSync(path.join(vdir, "文案.md"), `# ${title}

## 开场
[口播: assets/presenter.mp4]
（抄写口播原话；没有真人口播就删掉这行标记，用配音正文。）

## 正文
配音实际念出来的正文。

> 开场先写三拍：0~2秒与观众有关的问题/真实结果；2~5秒解释/证据；5~10秒先教一个具体动作。
> 有真实成品选 op-result-first；同条件前后图选 op-proof-compare；没有证据用 op-quiet-question 解释，不伪造数据。
> 素材放 assets/，截图/录屏要写 source.platform 或 source.url；库存画面不是证据。
> sound 可选 quiet（留人声）、foley（轻拟音）、pulse（低频悬念）、impact（单次冲击）。
> 不生成重复的专属开场骨架。确有独特机制再写源码，未完成时标 opening.draft:true。
`, "utf8");
fs.writeFileSync(path.join(vdir, "input.json"), JSON.stringify({ title, script_file: "文案.md", storyboard: "storyboard.json", audio: "assets/voice.mp3", keywords: [] }, null, 2) + "\n");
fs.writeFileSync(path.join(vdir, "storyboard.json"), JSON.stringify({ keywords: [], shots: [] }, null, 2) + "\n");
fs.writeFileSync(path.join(vdir, "assets", ".gitkeep"), "");
console.log(`已建片目录：${vdir}`);
console.log("未生成或注册开场骨架：先按本片文案/素材选型，不自动复制上一条片的视听形式。");
console.log(`1. 放入原文、配音和真实素材；node scripts/make.mjs "${path.join(vdir, "input.json")}" --beats`);
console.log("2. node scripts/openings.mjs list；按 SKILL.md 的前2/5/10秒三拍填写 storyboard.json，锚点匹配实际台词");
console.log(`3. node scripts/make.mjs "${path.join(vdir, "input.json")}" --plan-only`);
console.log(`4. node scripts/openings.mjs preview "${path.join(vdir, "input.json")}"（检查前10秒及声音）`);
console.log(`5. node scripts/make.mjs "${path.join(vdir, "input.json")}"`);
