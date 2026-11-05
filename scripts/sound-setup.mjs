// 拉取猫学长的 sound skill（vendor/sound）。只做两件事：检查是否已就绪、缺了才 clone。
// 上游只读，不在本地改；真正调用走 scripts/sfx.mjs 的桥接。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEST = path.join(ROOT, "vendor", "sound");
const SFXPY = path.join(DEST, "sfx-sources", "scripts", "sfx.py");
const CHECK = process.argv.includes("--check");

const ok = () => {
  let commit = "";
  try {
    commit = execFileSync("git", ["-C", DEST, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    commit = "unknown";
  }
  console.log(`✓ 音效库已就绪：vendor/sound (${commit})`);
  console.log("  下一步：node scripts/sfx.mjs audit   # 看 15 个 cue 的来源/许可");
};

if (fs.existsSync(SFXPY)) {
  ok();
  process.exit(0);
}

if (CHECK) {
  console.error("✗ vendor/sound 不完整：先跑 node scripts/sound-setup.mjs");
  process.exit(1);
}

if (fs.existsSync(DEST)) {
  console.error("✗ vendor/sound 已存在但不完整（缺 sfx-sources/scripts/sfx.py）。");
  console.error("  不自动删除本地目录；确认里面没有你的改动后，删掉它再重跑本脚本。");
  process.exit(1);
}

console.log("拉取 https://github.com/sxhzju/sound.git → vendor/sound …");
try {
  execFileSync("git", ["clone", "--depth", "1", "https://github.com/sxhzju/sound.git", DEST], { stdio: "inherit" });
} catch {
  console.error("✗ clone 失败：检查网络/代理，或手动把仓库放到 vendor/sound。");
  process.exit(1);
}
if (!fs.existsSync(SFXPY)) {
  console.error("✗ 拉取完成但没找到 sfx-sources/scripts/sfx.py：上游结构变了，先人工核对。");
  process.exit(1);
}
ok();
