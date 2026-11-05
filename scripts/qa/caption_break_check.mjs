// 逐条扫描成片字幕：找出「跨行切断一个词」的坏断行。
// 用法：node scripts/qa/caption_break_check.mjs <timeline.json>
import { readFileSync } from "node:fs";

const p = process.argv[2];
if (!p) { console.error("用法: node scripts/qa/caption_break_check.mjs <timeline.json>"); process.exit(2); }
const caps = JSON.parse(readFileSync(p, "utf8")).captions ?? [];

const NUM = "一两二三三四五六七八九十几每那这什哪";
const MEASURE = "个条次台种样些儿本张位家部天年月号遍下点块件项步句字页款双份名回只次";
const WORDS = new Set(["什么", "怎么", "这个", "那个", "一个", "不是", "可以", "已经", "直接", "自己", "我们", "你们", "他们", "生成", "技能", "模型", "页面", "视频", "剪辑", "角色", "安装", "评论", "收藏", "门槛", "流程", "起来", "出来", "下来", "过来", "回来", "上去", "下去", "进去", "出去", "小时", "文档", "官方", "现场", "活动", "浏览器", "控制台", "小程序", "一句话"]);

const bad = (a, b) => {
  const prev = a[a.length - 1];
  const next = b[0];
  if (!prev || !next) return null;
  if (NUM.includes(prev) && MEASURE.includes(next)) return `数量词被切开「${prev} / ${next}」`;
  const bigram = prev + next;
  if (WORDS.has(bigram)) return `词被切开「${bigram}」`;
  return null;
};

let n = 0;
for (let i = 0; i < caps.length; i++) {
  const cur = caps[i];
  const nxt = caps[i + 1];
  // 只查时间上紧挨着的下一行（同一口气说完的连续文本）
  if (!nxt || Math.abs(nxt.start - cur.end) > 0.01) continue;
  const r = bad(cur.text, nxt.text);
  if (r) { n++; console.log(`${(cur.start / 30).toFixed(2)} ${(cur.text).padEnd(14)} | ${nxt.text}   ← ${r}`); }
}
console.log(n === 0 ? "✓ 未发现跨行断词" : `✗ 跨行断词 ${n} 处`);
process.exit(n === 0 ? 0 : 1);
