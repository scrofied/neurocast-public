# 开场模板选型

先设计前 2 / 5 / 10 秒的看点、解释/证据、第一步兑现，再选机制。不要把每条片都做成“砸字 + 闪白 + 叮”。当前 ID、时长和必填字段以 `node scripts/openings.mjs list` 与 [CATALOG.md](../CATALOG.md) 为准。

## 三套自带舞台的三段开场

代码在 `src/openings/templates/retention.tsx`；推荐 8 秒，支持 6–10 秒，无需真人底图。

| ID | 首帧 → 解释 → 兑现 | 适用素材 | 默认声音 |
|---|---|---|---|
| `op-result-first` | 暗绿展台真实结果 → 局部聚焦 → 分屏第一步 | `result.src` 真截图/录屏 | `foley` 快门、点击、打字 |
| `op-quiet-question` | 纸白反问与留白 → 绕路示意 → 直达路径与行动条 | 无需证据素材；图形只做关系解释 | `quiet` 只留配音 |
| `op-proof-compare` | 同条件实物对照 → 滑杆揭差别 → 收高腾出复现步骤 | `before.src`、`after.src` 真素材 | `pulse` 低频脉冲 |

必须显式填写 `hook / proof / payoff`（≤36 / 60 / 60 字，尽量短）；用 `proofAt / payoffAt` 对齐台词。**storyboard 的时间填台词原文或秒数，不填帧数**；普通组件在运行时接收帧，PRO 接收秒。兑现后至少留 0.8 秒供阅读。

素材各自填写 `source.platform` 或 `source.url`；库存画面不能作证据。预览缺素材只显示“布局演示 · 非实测数据”，正式管线会拦下。不要让示意画面冒充结果。

新三套的 `sound` 可选四种：quiet / foley / pulse / impact。声音只落首帧、解释、兑现节点，无统一结尾 whoosh。全局 `sfx:false` 同样约束 PRO；有 BGM 时开场压低，quiet 留白，结束时平滑回到正片音量。

## 短钩子与真人叠层

短模板结束后，仍需在正片前 5–10 秒给解释和第一步。数字、收益、评论、对比必须有真实依据，不能照搬示例声称实测。

| ID | 机制 |
|---|---|
| `op-t01-question` | 问号 + 问句 + 答案章 |
| `op-t02-number` | 滚动数字定格 |
| `op-t03-myth` | 常识划掉、真相入场 |
| `op-t04-pain` | 黑白画面、痛点气泡 |
| `op-t05-suspense` | 遮挡与锁头；不要拖延兑现 |
| `op-t06-callout` | 点名与聚焦框 |
| `op-t07-before-after` | 分屏前后对比 |
| `op-t08-warning` | 警告与禁止牌 |
| `op-t09-reveal` | 档案撕封揭示 |
| `op-t10-countdown` | 倒数与时间条 |
| `op-t11-money` | 金额与通知；禁止虚构收益 |
| `op-t12-rewind` | 定格倒带 |
| `op-t13-versus` | 两方对决 |
| `op-t14-list` | 扇形清单 |
| `op-t15-chat` | 聊天气泡 |
| `op-t16-crowd` | 人群筛选 |
| `op-t17-news` | 新闻信息条 |
| `op-t18-magnify` | 真人画面局部放大 |
| `op-t19-bet` | 挑战与承诺 |
| `op-t20-glitch` | 故障打断；不是万能兜底 |
| `op-tunnel` | 章节过场；代码雨隧道 → 章节大标题（2.2–4 秒，自背景） |
| `op-three-beat` | 钩子 → 承诺 → 第一条正文（5–8 秒） |
| `trick-*` | 慢推、变形、收圈、身后标题、信息先行 |

PRO 系列自带舞台与运镜，按各自时长用；详见 [PRO 选型与参数](../src/openings/pro/README.md)。自带舞台会挡住外层 presenter：PRO 需填 `person` 才露脸，新三套不内嵌真人。

## 使用与验收

TTS 把 opening 放分镜顶层；原声口播放 `talking-head-stage.data.opening`，不能两处同时挂。参数示例及注意事项见 [SKILL.md](../SKILL.md)。

```bash
node scripts/openings.mjs list
node scripts/opening-templates.mjs sheet - op-quiet-question
node scripts/opening-templates.mjs video op-result-first -
node scripts/opening-templates.mjs sheet <talk.mp4> pro-
node scripts/openings.mjs preview <input.json>
node scripts/openings.mjs pending
```

演示视频不是本片验收：必须预览本片前 10 秒，检查首帧、长字、素材来源、兑现时间和正文交接并试听。预览实际落在 `openings/previews/<开场id>-<input hash>.mp4`（按 input 文件区分），`sync` 会把最近一条写回 `library.json`；短片自动截到结尾。`pending` 盘点草稿、上过片但没录数据的开场、以及还没预览的正式开场。

近三片同模板或同视觉/声音组合会警告。优先换机制，而不是复制源码换名字；草稿标 `opening.draft:true`，不可用于正式出片。发布后使用 `metric <id> video=<片标识> bounce2s=... finish5s=... finish10s=... plays=...` 回填真实样本，不凭单条小样本承诺留存效果。
