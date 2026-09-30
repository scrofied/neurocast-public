# 组件资产目录（CATALOG）

> 本文件由 `node scripts/catalog.mjs` 从 `src/components/registry.ts` 自动生成，**不要手改**。新增/修改组件后重新生成。

当前共 **78** 个组件。写分镜时按「适用」选组件，按字段表填 data。

- **锚点**：类型写着「锚点」的字段（`at`、`until`、`xxxAt`）填台词里的原文片段，如 `"at": "封面"`，管线会换算成那个词说出口的帧；也可填秒数（相对本镜头开始）。`"文字$"` = 这几个字说完的时刻，`"文字+0.3"` = 往后偏 0.3 秒。
- **可放侧栏**：能作为 `talking-head-stage` 的 `left/right` 小组件。
- **自动隐藏字幕**：画面本身就显示了台词（对话、指令、冲击大字），默认不再叠底部字幕；分镜里写 `"captions": true` 可强制打开。

## 速查

| id | 名称 | 适用 |
|---|---|---|
| `hook` | 开场冲击 | 没有真人口播时的开场标题（有口播时开场用 talking-head-stage） |
| `chapter` | 章节标题卡 | 无配音估算模式的章节过场（有配音时章节由顶部 HUD 闪现，不占时长，一般不用它） |
| `narration` | 关键词轨道（通用叙述） | 兜底：普通叙述、没有更贴切的画面时（写分镜时尽量少用） |
| `quote` | 金句点燃 | 金句、结论、观点总结（10~26 字）；更短更冲的反问/吐槽用 punch-text |
| `punch-text` | 冲击大字 | 短促有力的反问、吐槽、结论、转折（1~3 秒），例如“这不是瞎胡闹吗？”“快拉倒吧” |
| `outro` | 结尾回顾+关注 | 最后一句（关注/评论区留言等 CTA），放在最后一个镜头 |
| `talking-head-stage` | 真人口播舞台（两侧动画） | 真人口播片段（[口播: x.mp4]）。侧栏内容要跟他当时说的话对应，用 at 锚点卡住节奏 |
| `number` | 粒子凝聚数字 | 单个关键数字 / 百分比 / 倍数（多个同单位数值用 growth） |
| `code` | 代码编辑器打字 | 讲稿里用 ``` 包起来的代码块 |
| `flow` | 能量流程管线 | 第一步…第二步…、首先…然后…最后… 的操作流程 |
| `timeline` | 时间轨道推进 | 按年份/时间顺序讲发展历程 |
| `versus` | 对比对撞 | 两种方案/观点同时摆出来比（A vs B）；有先后节奏的“以前…现在…”用 before-after |
| `growth` | 增长曲线生长 | 同一单位的多个数值随时间变化的趋势 |
| `cards` | 卡片深空飞入 | 并列的几项（A、B、C），一次性盘点；需要逐条跟读的要点用 bullet-cards |
| `bullet-cards` | 要点逐条出现 | 列举原因、痛点、注意事项、以前的麻烦做法；也适合放进口播侧栏做“字幕式要点” |
| `logic-flip` | 逻辑倒置（先后顺序翻转） | “先有 A 再有 B，但很多人反过来了”这类顺序被搞反、因果倒置的论述 |
| `scale-gap` | 体量悬殊对比 | 强弱/大小/资源差距悬殊的对比：大博主 vs 新号、大厂 vs 个人、头部 vs 长尾 |
| `before-after` | 以前 vs 现在 | “以前得…现在只要…”“过去人工…现在 AI…”的前后对比（按讲话节奏，不是同时出现） |
| `leaderboard` | 排行榜（淘金效果） | 排名/榜单/最多最高的几项；“一张干干净净的痛点排行榜”“沙子沉下去，金子露出来” |
| `day-clock` | 一天之内（时间压缩） | 从 A 时刻到 B 时刻就做完了（时间压缩、效率）：早上想到晚上上线、上午开会下午交付、9 点提需求 11 点出方案 |
| `neural` | 神经网络信号流 | 解释大模型/神经网络怎么工作；不要只因为出现“AI”两个字就用 |
| `agents` | 多 Agent 协作 | 多个 Agent/工具协作分工；一个东西接入多个平台（center=Skill，agents=平台名） |
| `prompt` | 提示词吸入芯片 | “给模型一句话就出结果”的抽象表达；要展示指令原文、逐字打出时用 chat-command |
| `funnel` | 粒子漏斗筛选 | 转化漏斗、层层递减的数量 |
| `vault` | 知识库向量检索 | 知识库、RAG、检索、把资料喂给 AI |
| `assembly` | 自动化流水线 | 自动化流水线、批量生产、一键量产 |
| `flywheel` | 增长飞轮（循环越转越快） | A 带来 B、B 又带来 C、最后回到 A 的循环/正反馈：内容→粉丝→数据→更好的内容；用户→数据→模型→更多用户；恶性循环也行（boost 写“越陷越深”） |
| `domino-chain` | 多米诺连锁反应 | 一件小事一步步引发大结果：第一步搞反→内容没人看→账号没权重→放弃；一个好习惯→连锁收益；供应链断一环→全线停工 |
| `asset-distill` | 经历提炼成资产 | 把平常的经历/琐事提炼成能对外交付的东西：三年跟单提炼成催收 SOP、十次客诉提炼成服务话术、五十场面试提炼成面试题库（fragments / asset / price 全可改） |
| `untapped-potential` | 大材小用（潜力只用了一点点） | 很强的东西只被用来干小事：AI 只拿来写周报、旗舰手机只打电话、健身年卡只去洗澡、数据库只当记事本（machine / used / potential 全可改） |
| `scope-shrink` | 目标缩小 · 成功率变高 | 目标越小越容易成功：新手做产品先做 MVP、减肥先定小目标、创业先打一个细分市场、学习先攻一个章节（big / small / meter 全可改） |
| `labor-takeover` | AI 一件件接管人的活（劳动力被替代） | AI 正在替代/接管某种人力工作、人的活被 AI 一件件拿走、产能被碾压式反超；也可换成「旧工具被新方案逐个替代」「外包流程被自动化接管」等 A 被 B 替代的叙事（jobs / workerLabel / rate / stamp 全走参数） |
| `phone-feed` | 手机信息流 · 被划走 | 观众不感兴趣 / 划走 / 停留时长短 / 完播率低 / 自嗨内容没人看 |
| `sword-forge` | 闭门造车（做了没人要） | 先埋头做、再去找人要，结果没人需要：自嗨写的深度文章、没人用的 App、没市场的产品、没人报名的课程 |
| `dialogue` | 对话气泡 | 设问/假想对话/网友提问/“有人就说了…快拉倒吧”这种一来一回的段落 |
| `sink` | 石沉大海 | 投入了却没有回响：发了没人看的视频、投了没回音的简历、上线没人用的功能、砸进去没水花的广告费（post / views / label 全可改） |
| `comment-wall` | 评论区里有金子 | 真正有价值的东西不在表面、藏在反馈里：评论区的需求、差评里的改进点、客服记录里的痛点、问卷的开放题（video 换成任何“表面”，comments 换成任何反馈） |
| `signal-map` | 需求信号地图 | 大量信号散落各处、到处都在发生：用户的需求原话、各地的订单、全网的讨论、各城市的求职者（signals 换成任何原话） |
| `reframe` | 换个视角（同一件事，两边两种价值） | 同一件事换个人看就值钱：你的坑是别人的排雷指南、你的日常是别人的刚需、你的抱怨是别人的需求、你的经验是新人的导航（you / them / verdict 全可改） |
| `tool-card` | 工具/产品卡（下载量滚动） | 盘点/推荐工具、插件、Skill、产品；“第一个…第二个…”逐个介绍时每个用一次 focus |
| `chat-command` | 给 AI 下指令（对话框打字） | “你给它一句命令：……”“下这条死命令：……”——展示具体对 AI 说了什么 |
| `browser-agent` | AI 自己操作浏览器 | AI/Agent 自动完成网页操作、采集、下载、整理（“它自己打开页面，自己往下翻，自己存好”） |
| `data-sieve` | 数据清洗筛（去噪→归类→挑 TOP） | 把一堆杂乱的东西去噪、归类、挑出最好的：清洗评论、筛简历、整理笔记、分拣客户线索（pool / chips / bins 全可改） |
| `topic-radar` | 选题雷达（找差异化角度） | 调研已有内容/竞品后找空白、差异化角度；“先看看网上发成什么样了，再挑出还值得做的角度” |
| `checklist` | 一条龙交付清单 | 一个工具/流程把多项产出全包了；“从 A、B、C 一直到 D，一条全配齐” |
| `file-launch` | 代码 → 文件 → 双击运行 | 把一段东西存成文件就能直接用：AI 写的 HTML 双击即跑、脚本改后缀变可执行、导出的 .csv 双击进表格、配置文件改名生效（code / from / to / app 全可改） |
| `bug-fix-loop` | 报错 → 甩给 AI → 整份覆盖修好 | 出错了把错误原样交给 AI、让它整份重做再覆盖：代码报错修复、表格公式出错重算、文档格式乱了整篇重排、配置写错整份替换（errors / prompt / file / app 全可改） |
| `drag-deploy` | 拖拽上线 · 吐出网址 · 多端打开 | 把做好的东西一键发布出去给别人用：网页拖进托管平台、视频上传出链接、文件丢进网盘分享、App 提交上架（file / host / url / app 全可改） |
| `screen` | 录屏截屏演示（设备框+鼠标+聚焦） | 文案里 [图: x.png] / [录屏: x.mp4] 的操作演示；说明写「点击"按钮名"」会自动定位 |
| `board-proof` | 整屏截图举证 | 用真实截图证明一个会变/会涨会跌的东西：大模型榜单换个排序就换第一、后台数据看板前后对比、价格页调整前后的截图、搜索结果页的变化（boards / aspect / swapAt 全可改） |
| `opening-comment-mining` | 开场 · 从评论区挖掘爆款选题 | 只给《从评论区挖掘爆款选题》用（开场不重样） |
| `opening-ai-tool-4steps` | 开场 · 20 分钟用 AI 做出你的第一个小软件 | 只给《20 分钟用 AI 做出你的第一个小软件》用（开场不重样） |
| `opening-model-arena` | 开场 · 用 AI 挖出你身上的隐藏资产 | 只给《用 AI 挖出你身上的隐藏资产》用（开场不重样） |
| `op-t01-question` | 模板 · 反问质疑（问号砸下 + 红章答案） | 文案第一句是反问/质疑：“为什么…？”“你真的…吗？”“凭什么…？” |
| `op-t02-number` | 模板 · 数字冲击（计数狂滚 + 定格砸下） | 开头就是一个数字：“90% 的人…”“3 天涨粉 1 万”“月入 3 万”“只要 20 分钟” |
| `op-t03-myth` | 模板 · 反常识（常识被划掉 → 真相砸入） | 开头推翻一个常识：“都说…其实…”“努力就有结果？错”“别再…了” |
| `op-t04-pain` | 模板 · 痛点扎心（黑白画面 + 痛点气泡围攻） | 开头连续列痛点、戳用户：“天天加班、工资不涨、学不动了…”“是不是你？” |
| `op-t05-suspense` | 模板 · 悬念锁（马赛克遮挡 + 锁头晃动） | 开头卖关子：“最后一个方法才是重点”“我不建议你看到最后”“这个秘密…” |
| `op-t06-callout` | 模板 · 身份点名（瞄准框锁定 + 人群标签） | 开头点名目标人群：“如果你是宝妈/上班族/新手博主…”“这条视频只给…看” |
| `op-t07-before-after` | 模板 · 前后对比（画面劈开 BEFORE/AFTER） | 开头晒对比/逆袭：“3 个月前 0 粉，现在 10 万”“以前 3 小时，现在 3 分钟”“月薪 3 千到 3 万” |
| `op-t08-warning` | 模板 · 警告禁止（红色警报 + 禁止牌） | 开头警告/劝退：“千万别…”“再这样做就完了”“这 3 个坑一定要避开” |
| `op-t09-reveal` | 模板 · 爆料揭秘（绝密档案撕封条） | 开头爆料：“揭秘…内幕”“这是平台不会告诉你的”“行业里没人敢说的” |
| `op-t10-countdown` | 模板 · 倒计时紧迫（巨型倒数 + 燃烧进度条） | 开头强调时间短或紧迫：“只要 3 分钟”“最后 3 天”“5 秒钟教会你”“倒计时开始” |
| `op-t11-money` | 模板 · 金钱收益（金币雨 + 到账通知） | 开头晒收益/结果：“一个月多赚 3 万”“这条视频带来 1000 单”“省下 5 万块” |
| `op-t12-rewind` | 模板 · 结果先行（定格 + VHS 倒带） | 开头先抛结果再倒叙：“这个网站是我 20 分钟做的”“我是怎么做到的？让我们倒回去” |
| `op-t13-versus` | 模板 · 对决 VS（两方冲撞 + VS 爆炸） | 开头比较两样东西：“A 和 B 到底谁更好”“手机 vs 电脑”“打工 vs 创业” |
| `op-t14-list` | 模板 · 清单预告（卡片扇形甩出 + 最后一张最狠） | 开头是清单/合集：“5 个 AI 工具”“3 个方法”“7 个习惯”——特别是“最后一个最重要” |
| `op-t15-chat` | 模板 · 聊天截图（私信气泡逐条弹出） | 开头引用粉丝/客户/老板的话：“昨天有人私信问我…”“老板跟我说…”“评论区有人问…” |
| `op-t16-crowd` | 模板 · 人群对比（百人方阵 → 只剩 1 个发光） | 开头讲比例/稀缺：“100 个人里只有 1 个…”“99% 的人都…”“只有少数人知道” |
| `op-t17-news` | 模板 · 新闻快讯（BREAKING 红条 + 滚动字幕） | 开头是热点/新发布/大事件：“重磅！…刚刚发布”“突发”“行业变天了” |
| `op-t18-magnify` | 模板 · 放大镜聚焦（画面里的关键物） | 开头让观众看画面里某个东西：“注意看我身后…”“这台电脑…”“这个小东西让我…”（x/y 填它在画面里的位置） |
| `op-t19-bet` | 模板 · 挑战打赌（筹码砸桌 + 承诺盖章） | 开头立 flag/打赌/挑战：“看完还不会我…”“我赌你做不到”“7 天挑战…” |
| `op-t20-glitch` | 模板 · 故障闯入（信号撕裂 → 真人闯出） | 通用强打断开场：“停！先别划走”“等一下”“你刷到这条是有原因的”——任何需要立刻抓住注意力的文案 |
| `trick-01-zoom-suspense` | 第1招 · 慢慢放大 + 做悬疑 | 悬念型、揭露型开场：“为什么…”“最后一个方法…”“我赌你不知道…” |
| `trick-02-morph-rhythm` | 第2招 · 出其不意 + 按节奏变形 | 反常识型、转折型：“这叫教程？其实这是印钞机”“你以为 A，其实是 B” |
| `trick-03-mask-focus` | 第3招 · 蒙版缩圈 + 开篇主题 | 聚焦型、主题揭示型：任何需要 1 秒内说清“这条视频讲什么”的开场 |
| `trick-04-title-behind` | 第4招 · 身后飞个大标题 + 抠像 + 副标题 | 真人口播、观点输出：需要一句大标题压住画面的开场 |
| `trick-05-info-first` | 第5招 · 文字干货先出现，再露脸 | 干货型、知识型：“3 个方法”“不写代码也能做”“记住这几点” |

## 结构

### `hook` 开场冲击

2.5–6s · 变体 1

**画面**：冲击波 + 速度线，标题放大砸入并抖动

**适用**：没有真人口播时的开场标题（有口播时开场用 talking-head-stage）

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` **必填** | string |  |
| `sub` | string |  |

<details><summary>示例 data</summary>

```json
{
 "title": "一个人，就是一家公司",
 "sub": "AI 时代的超级个体"
}
```

</details>

### `chapter` 章节标题卡

2–3s · 变体 2

**画面**：大号章节编号 + 章节标题的过场卡

**适用**：无配音估算模式的章节过场（有配音时章节由顶部 HUD 闪现，不占时长，一般不用它）

| 字段 | 类型 | 说明 |
|---|---|---|
| `index` **必填** | number |  |
| `total` **必填** | number |  |
| `title` **必填** | string |  |

<details><summary>示例 data</summary>

```json
{
 "index": 1,
 "total": 4,
 "title": "为什么 Agent 会取代 App"
}
```

</details>

### `narration` 关键词轨道（通用叙述）

3–9s · 变体 2

**画面**：几个关键词在 3D 轨道上环绕，当前词拉到中心放大

**适用**：兜底：普通叙述、没有更贴切的画面时（写分镜时尽量少用）

| 字段 | 类型 | 说明 |
|---|---|---|
| `keywords` **必填** | string[] (1–6) |  |
| `line` | string |  |

<details><summary>示例 data</summary>

```json
{
 "keywords": [
  "效率",
  "成本",
  "规模"
 ],
 "line": "AI 改变的不是工具，是生产关系"
}
```

</details>

### `quote` 金句点燃

3–7s · 变体 2

**画面**：一句话大字逐字点燃，强调词烧成强调色（变体 1 左对齐）

**适用**：金句、结论、观点总结（10~26 字）；更短更冲的反问/吐槽用 punch-text

**常见说法**：记住、本质、核心、关键、一句话、说白了、真正

| 字段 | 类型 | 说明 |
|---|---|---|
| `text` **必填** | string |  |
| `emphasis` | string[] |  |
| `kicker` | string |  |

<details><summary>示例 data</summary>

```json
{
 "text": "工具不会淘汰你，会用工具的人会",
 "emphasis": [
  "会用工具的人"
 ]
}
```

</details>

### `punch-text` 冲击大字

1–4s · 变体 3 · 自动隐藏字幕

**画面**：一句短话砸进画面：放大落下+镜头抖动+色散+冲击波（变体：砸下 / 红框盖章 / 故障撕裂），强调词烧成强调色

**适用**：短促有力的反问、吐槽、结论、转折（1~3 秒），例如“这不是瞎胡闹吗？”“快拉倒吧”

**常见说法**：反问、吐槽、拉倒吧、瞎胡闹、扎心

| 字段 | 类型 | 说明 |
|---|---|---|
| `text` **必填** | string | 一句短狠的话，建议 ≤ 10 字 |
| `emphasis` | string[] | 要烧成强调色的词 |
| `sub` | string |  |
| `kicker` | string |  |
| `style` | "slam" \| "stamp" \| "glitch" | 缺省按变体：0 砸下 1 盖章 2 故障 |
| `hitAt` | 锚点 | 砸下的时刻，默认第 4 帧 |

<details><summary>示例 data</summary>

```json
{
 "text": "这不是瞎胡闹吗？",
 "emphasis": [
  "瞎胡闹"
 ]
}
```

</details>

### `outro` 结尾回顾+关注

4–8s · 变体 1

**画面**：结尾：标题 + 逐条回顾要点 + 呼吸发光的关注按钮

**适用**：最后一句（关注/评论区留言等 CTA），放在最后一个镜头

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `cta` | string |  |
| `recap` | string[] (0–5) |  |

<details><summary>示例 data</summary>

```json
{
 "title": "今天讲了 3 件事",
 "recap": [
  "Agent 是什么",
  "怎么搭",
  "怎么赚钱"
 ],
 "cta": "关注我 · 带你用 AI"
}
```

</details>

### `talking-head-stage` 真人口播舞台（两侧动画）

3–40s · 变体 1

**画面**：开头 1 秒真人全屏，随后收进中间发光窗口；左右两块玻璃侧栏按讲话节奏依次放入小组件（手机信息流、要点卡、逻辑翻转、数字等）

**适用**：真人口播片段（[口播: x.mp4]）。侧栏内容要跟他当时说的话对应，用 at 锚点卡住节奏

**常见说法**：口播、真人、开场

| 字段 | 类型 | 说明 |
|---|---|---|
| `video` **必填** | string | 口播视频（管线从 [口播: x.mp4] 自动填入） |
| `videoFrames` | number | 视频帧数（管线自动填入） |
| `audioUntil` | number | 口播原声在第几帧静音（管线自动填入，避免和后面的配音重叠） |
| `focusX` | number | 人物在原画面里的水平中心 0~1；默认 0.52 |
| `focusY` | number | 默认 0.42 |
| `title` | string | 左下角标题条 |
| `kicker` | string |  |
| `intro` | number | 开头全屏保持的帧数，默认 24，之后收进中间舞台 |
| `shrinkAt` | 锚点 | 真人收进中间舞台的时刻（锚点/秒）；有专属开场时用它让开场全屏播完 2~3 秒，优先于 intro |
| `opening` | { type: string, at?: 锚点, until?: 锚点, data?: object } | 本条视频专属开场：{type: 开场组件 id(layer=opening), at, until, data}。透明画布叠在真人画面上层 |
| `inserts` | [{ type: string, at?: 锚点, until?: 锚点, data?: object }] | 口播段中途的整屏插图（同样是透明覆盖层）：讲到某句时把一张截图/图表盖满画面举证，讲完撤走露出真人；默认 [] |
| `leftLabel` | string |  |
| `rightLabel` | string |  |
| `left` | [{ type: string, at?: 锚点, until?: 锚点, data?: object }] | 默认 [] |
| `right` | [{ type: string, at?: 锚点, until?: 锚点, data?: object }] | 默认 [] |

<details><summary>示例 data</summary>

```json
{
 "video": "assets/demo-talk.mp4",
 "focusX": 0.52,
 "focusY": 0.42,
 "title": "从评论区挖掘爆款选题",
 "left": [
  {
   "type": "phone-feed",
   "at": 30,
   "data": {
    "swipeAt": 150
   }
  }
 ],
 "right": [
  {
   "type": "bullet-cards",
   "at": 40,
   "data": {
    "items": [
     {
      "text": "你觉得重要",
      "tone": "good"
     },
     {
      "text": "观众不关心",
      "tone": "bad",
      "at": 70
     }
    ]
   }
  }
 ]
}
```

</details>

## 信息图

### `number` 粒子凝聚数字

3–7s · 变体 2

**画面**：几千个粒子从四周旋入凝聚成一个大数字，数值滚动到位，下方说明

**适用**：单个关键数字 / 百分比 / 倍数（多个同单位数值用 growth）

**常见说法**：数字、百分比、倍、万、亿、增长、提升、数据

| 字段 | 类型 | 说明 |
|---|---|---|
| `value` **必填** | number |  |
| `unit` | string |  |
| `prefix` | string |  |
| `label` | string |  |
| `kicker` | string |  |
| `decimals` | int |  |

<details><summary>示例 data</summary>

```json
{
 "value": 87,
 "unit": "%",
 "label": "的重复工作可以交给 AI"
}
```

</details>

### `code` 代码编辑器打字

4–12s · 变体 3

**画面**：代码编辑器窗口，代码逐行打字并语法高亮

**适用**：讲稿里用 ``` 包起来的代码块

**常见说法**：代码、写代码、函数、脚本、命令、Python、JavaScript

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` **必填** | string |  |
| `lang` | string |  |
| `file` | string |  |
| `title` | string |  |
| `highlight` | number[] |  |

<details><summary>示例 data</summary>

```json
{
 "code": "import anthropic\nclient = anthropic.Anthropic()\nmsg = client.messages.create(\n  model=\"claude-sonnet-5\",\n  messages=[{\"role\":\"user\",\"content\":\"你好\"}]\n)\nprint(msg.content)",
 "lang": "py",
 "highlight": [
  4
 ]
}
```

</details>

### `flow` 能量流程管线

4–12s · 变体 3

**画面**：能量沿管线流动，依次点亮 N 个步骤节点（变体：直线 / 之字 / 菱形）

**适用**：第一步…第二步…、首先…然后…最后… 的操作流程

**常见说法**：第一步、第二步、步骤、流程、首先、然后、最后、接着

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `steps` **必填** | string[] (2–6) |  |

<details><summary>示例 data</summary>

```json
{
 "title": "三步搞定",
 "steps": [
  "丢讲稿",
  "自动分镜",
  "渲染成片"
 ]
}
```

</details>

### `timeline` 时间轨道推进

5–14s · 变体 2

**画面**：时间轴上的年份节点依次点亮，镜头沿轴推进

**适用**：按年份/时间顺序讲发展历程

**常见说法**：年、月、时间、历史、发展、发布、那时候、后来

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `events` **必填** | [{ time: string, text: string }] (2–8) |  |

<details><summary>示例 data</summary>

```json
{
 "title": "三年，AI 走了多远",
 "events": [
  {
   "time": "2022",
   "text": "ChatGPT 发布"
  },
  {
   "time": "2024",
   "text": "多模态普及"
  },
  {
   "time": "2026",
   "text": "Agent 接管工作流"
  }
 ]
}
```

</details>

### `versus` 对比对撞

4–10s · 变体 2

**画面**：两块面板从两侧冲来对撞（冲击波），弹开后展示左右要点

**适用**：两种方案/观点同时摆出来比（A vs B）；有先后节奏的“以前…现在…”用 before-after

**常见说法**：对比、区别、vs、VS、以前、现在、传统、而是、不是、相比

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `left` **必填** | { label: string, points?: string[] (0–4) } |  |
| `right` **必填** | { label: string, points?: string[] (0–4) } |  |

<details><summary>示例 data</summary>

```json
{
 "title": "传统做法 vs AI 做法",
 "left": {
  "label": "人工剪辑",
  "points": [
   "3 小时一条",
   "依赖经验"
  ]
 },
 "right": {
  "label": "AI 自动出片",
  "points": [
   "3 分钟一条",
   "批量不重样"
  ]
 }
}
```

</details>

### `growth` 增长曲线生长

4–10s · 变体 2

**画面**：增长曲线逐点画出，节点标数值

**适用**：同一单位的多个数值随时间变化的趋势

**常见说法**：增长、趋势、曲线、上涨、翻倍、逐年、变化、数据

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `points` **必填** | [{ label: string, value: number }] (2–10) |  |
| `unit` | string |  |

<details><summary>示例 data</summary>

```json
{
 "title": "用户增长",
 "points": [
  {
   "label": "1月",
   "value": 12
  },
  {
   "label": "3月",
   "value": 30
  },
  {
   "label": "6月",
   "value": 88
  },
  {
   "label": "9月",
   "value": 240
  }
 ],
 "unit": "万"
}
```

</details>

### `cards` 卡片深空飞入

4–12s · 变体 2

**画面**：几张玻璃卡片从深空飞入排成一排（变体 1 扇形），按节奏依次抬起高亮

**适用**：并列的几项（A、B、C），一次性盘点；需要逐条跟读的要点用 bullet-cards

**常见说法**：几个、三个、五个、清单、列表、盘点、推荐、第一、第二

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `items` **必填** | [{ title: string, desc?: string }] (2–6) |  |

<details><summary>示例 data</summary>

```json
{
 "title": "3 个必装 Skill",
 "items": [
  {
   "title": "读 PDF",
   "desc": "百页文档一分钟看完"
  },
  {
   "title": "做表格",
   "desc": "自然语言出报表"
  },
  {
   "title": "写 PPT",
   "desc": "大纲直接成片"
  }
 ]
}
```

</details>

### `bullet-cards` 要点逐条出现

2–12s · 变体 1 · 可放侧栏

**画面**：玻璃卡片一条条滑入（跟着说到的那个词出现），左侧色条+图标表示对/错/注意，可让否定项被红线划掉

**适用**：列举原因、痛点、注意事项、以前的麻烦做法；也适合放进口播侧栏做“字幕式要点”

**常见说法**：要点、清单、痛点、原因、列举

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `items` **必填** | [{ text: string, sub?: string, tone?: "good" \| "bad" \| "warn" \| "info" \| "neutral", icon?: string, at?: 锚点, strike?: boolean }] (1–6) |  |

<details><summary>示例 data</summary>

```json
{
 "title": "以前挖评论有多难",
 "items": [
  {
   "text": "装采集插件",
   "tone": "bad",
   "at": 10
  },
  {
   "text": "学爬虫",
   "tone": "bad",
   "at": 40
  },
  {
   "text": "天天担心账号被封",
   "tone": "warn",
   "at": 70,
   "strike": true
  }
 ]
}
```

</details>

### `logic-flip` 逻辑倒置（先后顺序翻转）

3–10s · 变体 1 · 可放侧栏

**画面**：两个发光节点 A→B 表示正确顺序，说到“倒过来”时两个节点绕中心互换位置，箭头变红、打叉，下方红字点题

**适用**：“先有 A 再有 B，但很多人反过来了”这类顺序被搞反、因果倒置的论述

**常见说法**：倒过来、搞反了、本末倒置、顺序、先…再…

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `nodes` **必填** | string[] (2–2) | 正确顺序：[先, 后]，如 ["市场需求", "产品"] |
| `steps` | string[] (2–2) | 默认 ["先有","再做"] |
| `note` | string | 翻转前的说明，如“生意的逻辑” |
| `flipAt` | 锚点 | 翻转时刻（锚点，如“倒过来”） |
| `flipNote` | string | 翻转后红字，如“很多博主 · 倒过来了” |

<details><summary>示例 data</summary>

```json
{
 "nodes": [
  "市场需求",
  "产品"
 ],
 "steps": [
  "先有",
  "再做"
 ],
 "note": "做生意的逻辑",
 "flipAt": 90,
 "flipNote": "很多博主 · 倒过来了"
}
```

</details>

### `scale-gap` 体量悬殊对比

4–16s · 变体 1

**画面**：左边一颗巨大的发光球（大号：几百万粉丝），基础盘/推流标签环绕、背后流量光束上涌；右边一个小亮点（新号：几百粉丝），最后被判“平台：不感兴趣”

**适用**：强弱/大小/资源差距悬殊的对比：大博主 vs 新号、大厂 vs 个人、头部 vs 长尾

**常见说法**：大博主、小号、新号、差距、粉丝、推流

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `big` **必填** | { label: string, value: string, at?: 锚点, boosts?: [{ text: string, at?: 锚点 }] (0–3) } |  |
| `small` **必填** | { label: string, value: string, at?: 锚点, verdict?: string, verdictAt?: 锚点 } |  |
| `ratio` | string | 两者差距的标注，如“×10000” |

<details><summary>示例 data</summary>

```json
{
 "big": {
  "label": "大博主",
  "value": "几百万粉丝",
  "at": 4,
  "boosts": [
   {
    "text": "粉丝基础盘",
    "at": 30
   },
   {
    "text": "算法强力推流",
    "at": 60
   }
  ]
 },
 "small": {
  "label": "你的新号",
  "value": "几百粉丝",
  "at": 100,
  "verdict": "平台：不感兴趣",
  "verdictAt": 140
 },
 "ratio": "×10000"
}
```

</details>

### `before-after` 以前 vs 现在

2–12s · 变体 1

**画面**：左卡“以前”逐条列出麻烦（✕），说到“现在”时右卡带冲击砸进来，左卡变灰退后，右卡逐条 ✓

**适用**：“以前得…现在只要…”“过去人工…现在 AI…”的前后对比（按讲话节奏，不是同时出现）

**常见说法**：以前、现在、过去、如今、传统、人工、AI

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `before` **必填** | { label: string, icon?: string, items: [{ text: string, at?: 锚点 }] (1–4), at?: 锚点 } | 以前/传统/人工：items 逐条出现（锚点） |
| `after` **必填** | { label: string, icon?: string, items: [{ text: string, at?: 锚点 }] (1–4), at?: 锚点 } | 现在/AI：at = 说到“现在”的时刻 |
| `verdict` | string | 底部一句总结 |

<details><summary>示例 data</summary>

```json
{
 "before": {
  "label": "以前",
  "icon": "tool",
  "items": [
   {
    "text": "装采集插件",
    "at": 8
   },
   {
    "text": "学爬虫",
    "at": 30
   },
   {
    "text": "担心账号被封",
    "at": 52
   }
  ]
 },
 "after": {
  "label": "现在",
  "icon": "bot",
  "at": 90,
  "items": [
   {
    "text": "只说一句话"
   },
   {
    "text": "坐着看它干活"
   }
  ]
 }
}
```

</details>

### `leaderboard` 排行榜（淘金效果）

3–10s · 变体 1

**画面**：金边榜单：金/银/铜奖牌、名称、进度条和数字依次滚出；可叠加淘金背景（灰沙下沉、金粒上浮），第一名周期性扫光

**适用**：排名/榜单/最多最高的几项；“一张干干净净的痛点排行榜”“沙子沉下去，金子露出来”

**常见说法**：排行、排行榜、TOP、前三、最多、痛点

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `board` | string | 榜单名；默认 "痛点排行榜" |
| `items` **必填** | [{ label: string, value: number, unit?: string, note?: string, at?: 锚点 }] (2–5) |  |
| `timer` | string | 右上角用时徽章，如“30 秒” |
| `timerAt` | 锚点 |  |
| `sift` | boolean | 背景：沙子下沉、金粒上浮；默认 true |
| `siftAt` | 锚点 | 淘金效果时刻（锚点，如“沙子沉下去”） |

<details><summary>示例 data</summary>

```json
{
 "board": "痛点排行榜",
 "items": [
  {
   "label": "发了没流量",
   "value": 1286,
   "unit": "次抱怨",
   "note": "点赞 3.2w"
  },
  {
   "label": "新手不会起号",
   "value": 954,
   "unit": "次抱怨",
   "note": "点赞 2.1w"
  },
  {
   "label": "剪辑太耗时间",
   "value": 731,
   "unit": "次抱怨",
   "note": "点赞 1.6w"
  }
 ],
 "timer": "30 秒",
 "siftAt": 90
}
```

</details>

### `day-clock` 一天之内（时间压缩）

2–8s · 变体 1

**画面**：太阳沿一天的弧线从早上走到傍晚，中间数字时钟滚动，起点插旗“挖到痛点”，终点金色插旗“已发布”

**适用**：从 A 时刻到 B 时刻就做完了（时间压缩、效率）：早上想到晚上上线、上午开会下午交付、9 点提需求 11 点出方案

**常见说法**：早上、晚上、当天、一天、晚饭前、效率、马上

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `from` **必填** | { label: string, time: string, event?: string, at?: 锚点 } | 起点，如 早上 08:00 挖到痛点 |
| `to` **必填** | { label: string, time: string, event?: string, at?: 锚点 } | 终点，如 晚饭前 18:00 已发布 |

<details><summary>示例 data</summary>

```json
{
 "from": {
  "label": "早上",
  "time": "08:00",
  "event": "挖到痛点",
  "at": 8
 },
 "to": {
  "label": "晚饭前",
  "time": "18:00",
  "event": "已发布",
  "at": 90
 }
}
```

</details>

## 概念隐喻

### `neural` 神经网络信号流

4–10s · 变体 3

**画面**：多层神经网络，信号从输入（你的问题）逐层点亮传到输出（答案）

**适用**：解释大模型/神经网络怎么工作；不要只因为出现“AI”两个字就用

**常见说法**：模型、大模型、神经网络、AI、训练、推理、参数、LLM、GPT、深度学习

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `input` | string |  |
| `output` | string |  |

<details><summary>示例 data</summary>

```json
{
 "title": "大模型是怎么思考的",
 "input": "你的问题",
 "output": "答案"
}
```

</details>

### `agents` 多 Agent 协作

4–10s · 变体 3

**画面**：中心核心 + 环绕的节点（Agent/工具/平台），能量包在核心和节点间往返

**适用**：多个 Agent/工具协作分工；一个东西接入多个平台（center=Skill，agents=平台名）

**常见说法**：Agent、智能体、协作、分工、多个、团队、调度、工作流、Skill、插件、工具

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `center` | string |  |
| `agents` | string[] (0–8) |  |

<details><summary>示例 data</summary>

```json
{
 "title": "一个人指挥一支 AI 团队",
 "center": "你",
 "agents": [
  "调研",
  "写稿",
  "剪辑",
  "发布"
 ]
}
```

</details>

### `prompt` 提示词吸入芯片

4–9s · 变体 2

**画面**：一句提示词化作芯片插进 LLM 模块，模块运转后吐出结果

**适用**：“给模型一句话就出结果”的抽象表达；要展示指令原文、逐字打出时用 chat-command

**常见说法**：提示词、Prompt、指令、输入、问它、告诉它、喂给、输出、生成

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `input` | string |  |
| `output` | string |  |
| `chip` | string |  |

<details><summary>示例 data</summary>

```json
{
 "title": "一句话，交给 AI",
 "input": "帮我做一份竞品分析",
 "output": "10 页报告 ✓"
}
```

</details>

### `funnel` 粒子漏斗筛选

4–10s · 变体 1

**画面**：发光漏斗，粒子逐层流下，每层标数值（播放→点击→加微信→成交）

**适用**：转化漏斗、层层递减的数量

**常见说法**：漏斗、转化、筛选、过滤、留存、流量、成交

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `stages` **必填** | [{ label: string, value?: string }] (2–5) |  |

<details><summary>示例 data</summary>

```json
{
 "title": "10 万播放，最后剩下多少客户",
 "stages": [
  {
   "label": "播放",
   "value": "10万"
  },
  {
   "label": "点进主页",
   "value": "3000"
  },
  {
   "label": "加微信",
   "value": "200"
  },
  {
   "label": "成交",
   "value": "18"
  }
 ]
}
```

</details>

### `vault` 知识库向量检索

5–10s · 变体 1

**画面**：文档方块堆成知识库墙，提问时相关文档被点亮检索出来

**适用**：知识库、RAG、检索、把资料喂给 AI

**常见说法**：知识库、文档、资料、检索、RAG、向量、上传、记忆

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `docs` | string[] (0–8) |  |
| `query` | string |  |

<details><summary>示例 data</summary>

```json
{
 "title": "把公司文档喂给 AI",
 "query": "新员工报销怎么走"
}
```

</details>

### `assembly` 自动化流水线

4–10s · 变体 1

**画面**：传送带上的原料依次经过几个工位，被加工成成品

**适用**：自动化流水线、批量生产、一键量产

**常见说法**：自动化、批量、流水线、自动、一键、规模化、量产、工厂

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `stations` | string[] (2–4) |  |
| `input` | string |  |
| `output` | string |  |

<details><summary>示例 data</summary>

```json
{
 "title": "内容生产变成流水线",
 "stations": [
  "选题",
  "写稿",
  "出片"
 ],
 "input": "热点",
 "output": "视频"
}
```

</details>

### `flywheel` 增长飞轮（循环越转越快）

3–10s · 变体 1 · 可放侧栏

**画面**：3~6 个图标节点围成一个环，说到哪环哪环点亮、箭头弧线连到下一环；最后一环点亮后闭环，环上光带加速流动、能量光点越绕越快，弹出结论

**适用**：A 带来 B、B 又带来 C、最后回到 A 的循环/正反馈：内容→粉丝→数据→更好的内容；用户→数据→模型→更多用户；恶性循环也行（boost 写“越陷越深”）

**常见说法**：循环、飞轮、正反馈、越来越、滚雪球、闭环

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `nodes` **必填** | [{ text: string, icon?: string, at?: 锚点 }] (3–6) | 循环里的每一环，按顺序：如 需求 → 内容 → 流量 → 反馈 |
| `center` | string | 中心的字，如“增长飞轮” |
| `spinAt` | 锚点 | 开始加速的时刻（锚点，如“越转越快”）；缺省 = 最后一环点亮后 |
| `boost` | string | 加速后弹出的结论，如“越转越快” |

<details><summary>示例 data</summary>

```json
{
 "center": "增长飞轮",
 "nodes": [
  {
   "text": "真实需求"
  },
  {
   "text": "爆款内容"
  },
  {
   "text": "精准粉丝"
  },
  {
   "text": "更多评论"
  }
 ],
 "boost": "越转越快"
}
```

</details>

### `domino-chain` 多米诺连锁反应

2.5–9s · 变体 1 · 可放侧栏

**画面**：一排发光骨牌，每块下面写一步；说到哪步哪块倒下撞倒下一块（变红/金 + 冲击环 + 咔哒声），最后一块倒地时画面一震、砸出结果大字

**适用**：一件小事一步步引发大结果：第一步搞反→内容没人看→账号没权重→放弃；一个好习惯→连锁收益；供应链断一环→全线停工

**常见说法**：连锁反应、多米诺、一步错步步错、崩塌、导致、蝴蝶效应

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `steps` **必填** | [{ text: string, at?: 锚点 }] (3–7) | 连锁反应的每一步，从起因到结果 |
| `pushAt` | 锚点 | 第一块被推倒的时刻（锚点）；没给每块的 at 时后面自动接连倒 |
| `result` | string | 最后砸出来的结果大字，如“账号废了”“订单翻倍” |
| `tone` | "bad" \| "good" | bad = 崩塌（红），good = 好的连锁（金）；默认 "bad" |

<details><summary>示例 data</summary>

```json
{
 "steps": [
  {
   "text": "先做产品"
  },
  {
   "text": "没人需要"
  },
  {
   "text": "没有流量"
  },
  {
   "text": "账号废了"
  }
 ],
 "result": "第一步就错了",
 "tone": "bad"
}
```

</details>

### `asset-distill` 经历提炼成资产

3–10s · 变体 1

**画面**：左边一摞被当成杂事的碎卡片，被中间的提炼塔吸进去，塔内粒子向上加速，右边凝出一张金边的资产卡（名字+给谁用），可盖章价签

**适用**：把平常的经历/琐事提炼成能对外交付的东西：三年跟单提炼成催收 SOP、十次客诉提炼成服务话术、五十场面试提炼成面试题库（fragments / asset / price 全可改）

**常见说法**：提炼、沉淀、杂活、资产、可售卖、SOP

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `fragments` **必填** | [{ text: string, at?: 锚点 }] (2–5) | 被当成杂事的琐碎经历：微信催工厂发货 / 核对 Excel / 群里赔笑脸 |
| `tower` | string | 中间那台机器的名字，如 提炼 / 沉淀 / 复盘；默认 "提炼" |
| `towerIcon` | string | 塔上的图标名（src/lib/icons），缺省 shovel |
| `asset` **必填** | { name: string, note?: string, tag?: string } | 最后凝结出来的可售卖资产 |
| `price` | string | 价签，如 单份 299 |
| `refineAt` | 锚点 | 碎片被吸入、开始提炼的时刻（锚点，如“提炼出了”） |
| `outAt` | 锚点 | 资产卡凝成飞出的时刻（锚点，如“一套”） |
| `priceAt` | 锚点 | 价签盖章的时刻（锚点，如“收费”） |

<details><summary>示例 data</summary>

```json
{
 "fragments": [
  {
   "text": "微信催工厂发货"
  },
  {
   "text": "核对 Excel"
  },
  {
   "text": "群里赔笑脸"
  }
 ],
 "tower": "提炼",
 "asset": {
  "name": "非标供应链交付风险前置预警与催收 SOP",
  "note": "给刚起步的电商小卖家搭交付流程",
  "tag": "可对外交付"
 },
 "price": "单份 299"
}
```

</details>

### `untapped-potential` 大材小用（潜力只用了一点点）

3–10s · 变体 1

**画面**：一台发光的“机器”外面套一圈能力环，你只用了灰色的一小段（右侧灰卡：写周报…、“只用了 5%”）；揭晓时环上其余能力逐段点亮、标签弹出，最后红章盖下结论

**适用**：很强的东西只被用来干小事：AI 只拿来写周报、旗舰手机只打电话、健身年卡只去洗澡、数据库只当记事本（machine / used / potential 全可改）

**常见说法**：大材小用、只用了、潜力、浪费、当成、印钞机

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `machine` **必填** | { label: string, icon?: string, at?: 锚点 } | 本来很强的东西，如 AI · 印钞机 / 旗舰手机 / 年卡 |
| `used` **必填** | [{ text: string, at?: 锚点 }] (1–3) | 你实际只拿它干的小事（灰色），如 写周报、润色文案 |
| `usedPct` | number | 只用了百分之几（环上灰色那一小段）；默认 5 |
| `potential` **必填** | [{ text: string, at?: 锚点 }] (3–6) | 它其实能干的事：揭晓时绕环逐段点亮 |
| `revealAt` | 锚点 | 揭晓潜力的时刻（锚点，如“印钞机”） |
| `verdict` | string | 默认 "大材小用" |
| `verdictAt` | 锚点 | 结论章盖下的时刻（锚点） |

<details><summary>示例 data</summary>

```json
{
 "machine": {
  "label": "AI · 印钞机",
  "icon": "bot"
 },
 "used": [
  {
   "text": "写周报"
  },
  {
   "text": "润色文案"
  }
 ],
 "usedPct": 5,
 "potential": [
  {
   "text": "做小工具"
  },
  {
   "text": "做网站"
  },
  {
   "text": "自动化"
  },
  {
   "text": "数据核对"
  },
  {
   "text": "批量处理"
  }
 ],
 "verdict": "当打字机用"
}
```

</details>

### `scope-shrink` 目标缩小 · 成功率变高

3–12s · 变体 1

**画面**：几个巨大的“野心球”（商城 / 外卖平台）撑满画面，右侧成功率仪表红色报警、盖章“找死”；说到小目标时大球全部坍缩成一颗发光小方块（指甲刀），仪表一路涨满

**适用**：目标越小越容易成功：新手做产品先做 MVP、减肥先定小目标、创业先打一个细分市场、学习先攻一个章节（big / small / meter 全可改）

**常见说法**：缩小目标、别贪心、小目标、降维、聚焦、MVP

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `big` **必填** | [{ text: string, at?: 锚点 }] (1–3) | 贪大的目标（巨大的球），如 商城、外卖平台 |
| `verdict` | string | 贪大的下场，红章，如“找死” |
| `verdictAt` | 锚点 |  |
| `small` **必填** | { text: string, icon?: string, at?: 锚点 } | 缩小后的目标：说到这里大球全部坍缩成它 |
| `meter` | { label: string, from: number, to: number } | 右侧成功率仪表：贪大时低，缩小后涨满；默认 {"label":"一次跑通率","from":8,"to":92} |
| `meterAt` | 锚点 | 仪表开始上涨的时刻（锚点，如“成功率”）；缺省 = 坍缩后马上涨 |
| `examples` | [{ text: string, icon?: string, at?: 锚点 }] (0–3) | 小目标的具体例子，在小方块下面逐个弹出；默认 [] |

<details><summary>示例 data</summary>

```json
{
 "big": [
  {
   "text": "商城"
  },
  {
   "text": "外卖平台"
  }
 ],
 "verdict": "找死",
 "small": {
  "text": "一个微小痛点",
  "icon": "tool"
 },
 "examples": [
  {
   "text": "批量改图片名",
   "icon": "image"
  },
  {
   "text": "核对表格金额",
   "icon": "chart"
  }
 ],
 "meter": {
  "label": "一次跑通率",
  "from": 8,
  "to": 92
 }
}
```

</details>

### `labor-takeover` AI 一件件接管人的活（劳动力被替代）

5–16s · 变体 1

**画面**：一排打工人头顶各自的任务卡，右侧 AI 核心点亮后把任务卡一张张抽走（人变灰低头打✕），最后 AI 吞吐爆发数字狂跳，砸下结论章

**适用**：AI 正在替代/接管某种人力工作、人的活被 AI 一件件拿走、产能被碾压式反超；也可换成「旧工具被新方案逐个替代」「外包流程被自动化接管」等 A 被 B 替代的叙事（jobs / workerLabel / rate / stamp 全走参数）

**常见说法**：替代、接管、裁员、自动化、产能、人工、失业、效率碾压

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `jobs` | string[] (2–6) | 被一件件接管的任务（人头顶的卡片）；默认 ["写周报","做报表","审合同"] |
| `workerLabel` | string | 左侧人排下方的标注；默认 "人工 · 1 件/小时" |
| `aiLabel` | string | 右侧核心的标注；默认 "AI" |
| `rate` | string | 吞吐爆发后显示的倍数；默认 "10x" |
| `stamp` | string | 最后砸下去的强调字；默认 "被替代" |
| `aiAt` | 锚点 | AI 核心点亮的时刻（锚点，如“AI”） |
| `takeAt` | 锚点 | 第一件活被抽走（锚点） |
| `lastAt` | 锚点 | 最后一件活被抽走（锚点） |
| `speedAt` | 锚点 | 吞吐爆发、数字滚动（锚点，如“十倍”） |
| `stampAt` | 锚点 | 砸章时刻（锚点，如“替代”） |

<details><summary>示例 data</summary>

```json
{
 "title": "AI 正在接管这些活",
 "jobs": [
  "写周报",
  "做报表",
  "审合同"
 ],
 "aiAt": 12,
 "takeAt": 34,
 "lastAt": 96,
 "speedAt": 122,
 "stampAt": 170
}
```

</details>

## 叙事场景

### `phone-feed` 手机信息流 · 被划走

3–12s · 变体 1 · 可放侧栏

**画面**：一部手机里是你的内容（贴着“我觉得超重要”），观众手指一划连刷三条，红色徽章弹出“停留 0.3 秒”

**适用**：观众不感兴趣 / 划走 / 停留时长短 / 完播率低 / 自嗨内容没人看

**常见说法**：划走、停留、完播、信息流、刷到、没人看

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `mine` | string | 你的那条内容；默认 "我的深度干货" |
| `mineNote` | string | 贴在你那条上的心声；默认 "我觉得超重要" |
| `cards` | string[] | 被刷过去的别人的内容；默认 ["萌宠日常","爆笑合集","美食探店","旅行 vlog"] |
| `swipeAt` | 锚点 | 观众划走的时刻（锚点，如“划过去”） |
| `dwell` | string | 默认 "停留 0.3 秒" |
| `label` | string | 手机下方的小字说明 |

<details><summary>示例 data</summary>

```json
{
 "mine": "我的深度干货",
 "mineNote": "我觉得超重要",
 "cards": [
  "萌宠日常",
  "爆笑合集",
  "美食探店",
  "旅行 vlog"
 ],
 "swipeAt": 70,
 "dwell": "停留 0.3 秒",
 "label": "观众的真实反应"
}
```

</details>

### `sword-forge` 闭门造车（做了没人要）

4–10s · 变体 1

**画面**：火花中造出一个发光的产品（缺省是一把剑，`icon` 可换成文档/视频/工具/App 等任何东西）+ 金色卖点标签，路人从右往左走过、头顶冒“……”，你推销的气泡无人理会

**适用**：先埋头做、再去找人要，结果没人需要：自嗨写的深度文章、没人用的 App、没市场的产品、没人报名的课程

**常见说法**：闭门造车、自嗨、没人要、先做产品、推销、需求错位

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `icon` | string | 你做出来的东西：图标名（src/lib/icons，如 doc / video / tool / chart / bot），缺省 = 一把剑 |
| `label` | string | 产品旁的金色标签（你引以为傲的卖点）；默认 "削铁如泥" |
| `labelAt` | 锚点 |  |
| `streetAt` | 锚点 | 路人开始走过的时刻（锚点，如“满大街”） |
| `ask` | string | 你向路人推销的话；默认 "喂，你需不需要削铁啊？" |
| `askAt` | 锚点 | 推销气泡出现时刻（锚点，如“喂”） |
| `reply` | string | 路人的反应；默认 "……" |
| `crowd` | int | 默认 4 |

<details><summary>示例 data</summary>

```json
{
 "label": "削铁如泥",
 "ask": "喂，你需不需要削铁啊？",
 "streetAt": 80,
 "askAt": 120,
 "reply": "……",
 "crowd": 4
}
```

</details>

### `dialogue` 对话气泡

3–12s · 变体 1 · 自动隐藏字幕

**画面**：聊天界面：左边网友、右边你，气泡按说话时刻弹出（先出“正在输入…”），可附视频卡片；最后一句可用 punch 大字抖动怼回去

**适用**：设问/假想对话/网友提问/“有人就说了…快拉倒吧”这种一来一回的段落

**常见说法**：有人说、网友问、你可能会说、反驳、对话

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `them` | string | 左侧说话人名字；默认 "网友" |
| `me` | string | 默认 "我" |
| `messages` **必填** | [{ who: "them" \| "me", text: string, at?: 锚点, punch?: boolean, media?: { title: string, views?: string } }] (1–6) |  |

<details><summary>示例 data</summary>

```json
{
 "messages": [
  {
   "who": "them",
   "text": "那我听你的",
   "at": 10
  },
  {
   "who": "them",
   "text": "我去看那些几百万播放的爆款视频",
   "at": 40,
   "media": {
    "title": "爆款视频",
    "views": "386万"
   }
  },
  {
   "who": "them",
   "text": "我跟着大博主抄还不成吗？",
   "at": 90
  },
  {
   "who": "me",
   "text": "快拉倒吧。",
   "at": 130,
   "punch": true
  }
 ]
}
```

</details>

### `sink` 石沉大海

2–8s · 变体 1

**画面**：你的视频卡片从天而降砸进水面（涟漪+水花），然后慢慢沉底变暗，气泡上浮，卡片上“播放 0”，上方大字波动

**适用**：投入了却没有回响：发了没人看的视频、投了没回音的简历、上线没人用的功能、砸进去没水花的广告费（post / views / label 全可改）

**常见说法**：石沉大海、没流量、0播放、没人看、发出去没反应

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `post` | string | 沉下去的那条内容；默认 "我的新视频" |
| `views` | string | 默认 "播放 0" |
| `label` | string | 默认 "石沉大海" |
| `dropAt` | 锚点 | 落水时刻，默认第 14 帧 |
| `sinkAt` | 锚点 | 开始下沉的时刻（锚点，如“石沉大海”）；之前卡片浮在水面上 |

<details><summary>示例 data</summary>

```json
{
 "post": "我的新视频",
 "views": "播放 0",
 "label": "石沉大海"
}
```

</details>

### `comment-wall` 评论区里有金子

3–12s · 变体 1

**画面**：左边大博主的爆款视频，右边滚动的评论区；说到“评论区”时视频变灰、聚光灯移到评论区，真实需求评论发金光并打上标签，可在底部接一条交接提示

**适用**：真正有价值的东西不在表面、藏在反馈里：评论区的需求、差评里的改进点、客服记录里的痛点、问卷的开放题（video 换成任何“表面”，comments 换成任何反馈）

**常见说法**：评论区、留言、用户需求、痛点、真实反馈

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `video` | { title: string, views?: string, label?: string } | 默认 {"title":"大博主的爆款视频","views":"386万播放"} |
| `comments` **必填** | [{ user?: string, text: string, likes?: string, gold?: boolean, tag?: string }] (3–12) |  |
| `focusAt` | 锚点 | 镜头从视频转向评论区的时刻（锚点，如“评论区”） |
| `badge` | string | 默认 "秘密在评论区" |
| `handoff` | { text: string, at?: 锚点 } | 底部交接条，如“挖评论 → 交给 AI” |

<details><summary>示例 data</summary>

```json
{
 "comments": [
  {
   "text": "哈哈哈哈哈笑死",
   "likes": "2.1w"
  },
  {
   "text": "新手到底怎么起号？",
   "likes": "8.6k",
   "gold": true,
   "tag": "需求"
  },
  {
   "text": "前排",
   "likes": "302"
  },
  {
   "text": "剪辑太慢了有没有办法",
   "likes": "5.2k",
   "gold": true,
   "tag": "痛点"
  },
  {
   "text": "[捂脸][捂脸]",
   "likes": "1.1k"
  },
  {
   "text": "为什么我发了没流量",
   "likes": "9.9k",
   "gold": true,
   "tag": "痛点"
  }
 ],
 "focusAt": 60,
 "handoff": {
  "text": "挖评论这件事 → 交给 AI",
  "at": 130
 }
}
```

</details>

### `signal-map` 需求信号地图

3–10s · 变体 1

**画面**：一颗缓慢旋转的网络星球，节点不断亮起脉冲，求助原话（“求新手教程”“为什么我没流量”）从节点弹出，左上计数器滚动

**适用**：大量信号散落各处、到处都在发生：用户的需求原话、各地的订单、全网的讨论、各城市的求职者（signals 换成任何原话）

**常见说法**：成千上万、真实的人、呼救、需求、信号、用户

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `count` | { value: number, suffix?: string, label?: string } | 计数器，如 10000+ 真实的人 |
| `signals` **必填** | string[] (3–10) | 冒出来的求助/需求原话 |
| `label` | string |  |

<details><summary>示例 data</summary>

```json
{
 "count": {
  "value": 10000,
  "suffix": "+",
  "label": "条真实的呼救信号"
 },
 "signals": [
  "求新手教程",
  "为什么我没流量？",
  "有没有人教教我",
  "剪辑太难了",
  "起号卡住了"
 ]
}
```

</details>

### `reframe` 换个视角（同一件事，两边两种价值）

3–10s · 变体 1

**画面**：左边灰色面板写你自己的视角（烦心事、踩过的坑），中间一只眼睛透镜，说到关键处一道金光扫过右侧面板：同一件东西在另一群人眼里发光并被翻转亮出（排雷指南、避坑清单），最后砸出结论

**适用**：同一件事换个人看就值钱：你的坑是别人的排雷指南、你的日常是别人的刚需、你的抱怨是别人的需求、你的经验是新人的导航（you / them / verdict 全可改）

**常见说法**：视角、换位、你以为、别人眼里、值钱、排雷指南

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `you` **必填** | { label: string, icon?: string, items: [{ text: string, at?: 锚点 }] (1–3), at?: 锚点 } | 你自己这一侧：被当成负担的东西 |
| `them` **必填** | { label: string, icon?: string, items: [{ text: string, at?: 锚点 }] (1–3), at?: 锚点 } | 另一群人这一侧：同一件东西在他们眼里值钱 |
| `revealAt` | 锚点 | 视角翻转的时刻（锚点，如“新人眼里”）；缺省用 them.at |
| `verdict` | string | 翻转后的结论，如 换个视角，全是资产 |
| `verdictAt` | 锚点 |  |

<details><summary>示例 data</summary>

```json
{
 "kicker": "看到差距了吗？",
 "you": {
  "label": "你 · 工位上",
  "items": [
   {
    "text": "烦心事"
   },
   {
    "text": "踩过的坑"
   }
  ]
 },
 "them": {
  "label": "想入行的新人",
  "items": [
   {
    "text": "排雷指南"
   },
   {
    "text": "避坑清单"
   }
  ]
 },
 "verdict": "换个视角，全是资产"
}
```

</details>

## 产品/工具演示

### `tool-card` 工具/产品卡（下载量滚动）

2–10s · 变体 1

**画面**：应用商店风的发光卡片：图标、名字、一句话职责、下载量计数滚动、标签。阵列模式并排飞入；focus 模式把第 N 张放大居中、其余虚化到两侧

**适用**：盘点/推荐工具、插件、Skill、产品；“第一个…第二个…”逐个介绍时每个用一次 focus

**常见说法**：推荐、工具、Skill、插件、App、下载量、第一个、第二个

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `hub` | string | 左上角的平台名，如 Skill Hub |
| `tools` **必填** | [{ name: string, icon?: string, downloads?: number, display?: string, role?: string, tags?: string[] (0–3), at?: 锚点 }] (1–4) |  |
| `focus` | int | 聚焦第几个（0 起）；不填 = 并排阵列 |
| `total` | { value: string, label: string, at?: 锚点 } | 右上角总量徽章，如 100万+ 人下载 |
| `badges` | [{ text: string, icon?: string, at?: 锚点 }] (0–3) | 醒目的属性徽章，如“免密钥” |
| `footer` | { text: string, at?: 锚点 } |  |

<details><summary>示例 data</summary>

```json
{
 "hub": "Skill Hub",
 "tools": [
  {
   "name": "Agent Browser",
   "icon": "browser",
   "downloads": 870000,
   "role": "给 AI 用的浏览器",
   "tags": [
    "挖评论"
   ]
  },
  {
   "name": "Data Analysis",
   "icon": "chart",
   "downloads": 96000,
   "role": "把评论洗干净",
   "tags": [
    "清洗"
   ]
  },
  {
   "name": "热点选题",
   "icon": "fire",
   "downloads": 92000,
   "role": "从痛点到成片",
   "tags": [
    "收尾"
   ]
  }
 ],
 "total": {
  "value": "100万+",
  "label": "人下载",
  "at": 50
 },
 "badges": [
  {
   "text": "免密钥",
   "icon": "unlock",
   "at": 80
  }
 ]
}
```

</details>

### `chat-command` 给 AI 下指令（对话框打字）

3–14s · 变体 1 · 自动隐藏字幕

**画面**：AI 对话窗口：你的指令跟着配音逐字打出（或分条 ①②③ 在说到时打出），点击发送后 AI 回复并逐项打勾执行

**适用**：“你给它一句命令：……”“下这条死命令：……”——展示具体对 AI 说了什么

**常见说法**：命令、指令、提示词、跟它说、一句话

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `app` | string | 窗口标题，如 Agent Browser；默认 "AI 助手" |
| `appIcon` | string |  |
| `prompt` | string | 一整句指令（跟着说话打字） |
| `typeAt` | 锚点 | 开始打字的时刻（锚点） |
| `doneAt` | 锚点 | 打完的时刻（锚点，缺省按字数估） |
| `lines` | [{ text: string, at?: 锚点 }] (0–5) | 分条指令：每条在说到它时打出来，适合“下这条死命令：①…②…③…” |
| `reply` | string | AI 的回复 |
| `replyAt` | 锚点 |  |
| `steps` | [{ text: string, at?: 锚点 }] (0–5) | AI 执行步骤，逐个打勾 |

<details><summary>示例 data</summary>

```json
{
 "app": "Agent Browser",
 "appIcon": "browser",
 "prompt": "把这个视频下面点赞最高的 500 条评论，全部导成文本",
 "typeAt": 10,
 "doneAt": 110,
 "reply": "收到，开始执行",
 "steps": [
  {
   "text": "打开视频页面"
  },
  {
   "text": "加载全部评论"
  },
  {
   "text": "导出文本"
  }
 ]
}
```

</details>

### `browser-agent` AI 自己操作浏览器

3–12s · 变体 1

**画面**：浏览器里 AI 光标自己输网址、打开页面、加速往下翻评论；评论被抓取后化成光块飞进右侧文件，计数滚到 500；右侧三个动作依次打勾

**适用**：AI/Agent 自动完成网页操作、采集、下载、整理（“它自己打开页面，自己往下翻，自己存好”）

**常见说法**：自己打开、自己往下翻、自动、采集、抓取、浏览器

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `url` | string | 默认 "douyin.com/video/7394…" |
| `items` | string[] | 页面里滚动的评论；默认 ["求新手教程！","这个怎么做的？","哈哈哈哈","有没有平价替代","为什么我总失败","蹲一个后续","能讲讲避坑吗","学到了"] |
| `target` | number | 最终保存条数；默认 500 |
| `unit` | string | 默认 "条评论" |
| `file` | string | 默认 "评论.txt" |
| `steps` | [{ text: string, at?: 锚点 }] (0–4) | 三个动作，用锚点对齐“打开/往下翻/存好”；默认 [{"text":"自己打开页面"},{"text":"自己往下翻"},{"text":"自己存好"}] |

<details><summary>示例 data</summary>

```json
{
 "target": 500,
 "steps": [
  {
   "text": "自己打开页面",
   "at": 6
  },
  {
   "text": "自己往下翻",
   "at": 40
  },
  {
   "text": "自己存好",
   "at": 90
  }
 ]
}
```

</details>

### `data-sieve` 数据清洗筛（去噪→归类→挑 TOP）

4–16s · 变体 1

**画面**：一大坨评论标签砸进“评论池”；噪音（哈哈/表情包/玩梗）被划掉掉出去，真实提问飞进分类槽，每类第一名发金光打 TOP；右侧同步打出分条“死命令”

**适用**：把一堆杂乱的东西去噪、归类、挑出最好的：清洗评论、筛简历、整理笔记、分拣客户线索（pool / chips / bins 全可改）

**常见说法**：清洗、去重、剔掉、归类、筛选、整理

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `pool` | string | 默认 "评论池" |
| `chips` **必填** | [{ text: string, kind: "noise" \| "real", bin?: int }] (4–24) |  |
| `bins` | string[] (1–4) | 归类的类别名；默认 ["卡点 A","卡点 B","卡点 C"] |
| `commands` | [{ text: string, at?: 锚点 }] (0–4) | 右侧“死命令”，每条在说到时打出；默认 [] |
| `dumpAt` | 锚点 | 评论倒进来的时刻（锚点，如“全甩进去”） |
| `purgeAt` | 锚点 | 噪音被剔除的时刻（缺省=第 1 条命令后） |
| `sortAt` | 锚点 | 真实提问归类的时刻（缺省=第 2 条命令后） |
| `pickAt` | 锚点 | 每类选出 TOP 的时刻（缺省=第 3 条命令后） |

<details><summary>示例 data</summary>

```json
{
 "chips": [
  {
   "text": "哈哈哈哈哈",
   "kind": "noise"
  },
  {
   "text": "新手怎么起号？",
   "kind": "real",
   "bin": 0
  },
  {
   "text": "[捂脸][捂脸]",
   "kind": "noise"
  },
  {
   "text": "发了没流量",
   "kind": "real",
   "bin": 1
  },
  {
   "text": "笑死我了",
   "kind": "noise"
  },
  {
   "text": "剪辑太慢",
   "kind": "real",
   "bin": 2
  },
  {
   "text": "绝绝子",
   "kind": "noise"
  },
  {
   "text": "起号要多久",
   "kind": "real",
   "bin": 0
  },
  {
   "text": "666",
   "kind": "noise"
  },
  {
   "text": "播放卡在 500",
   "kind": "real",
   "bin": 1
  }
 ],
 "bins": [
  "起号",
  "流量",
  "剪辑"
 ],
 "commands": [
  {
   "text": "打哈哈/表情包/玩梗 → 全剔掉",
   "at": 40
  },
  {
   "text": "真实提问 → 按卡点归类",
   "at": 90
  },
  {
   "text": "告诉我 TOP 3 卡点",
   "at": 130
  }
 ],
 "dumpAt": 6
}
```

</details>

### `topic-radar` 选题雷达（找差异化角度）

3–12s · 变体 1

**画面**：中心是你的话题，雷达扫过时周围冒出网上已有的做法（标热度和“已饱和”），最后一张金色卡片弹出“值得你做的角度”

**适用**：调研已有内容/竞品后找空白、差异化角度；“先看看网上发成什么样了，再挑出还值得做的角度”

**常见说法**：选题、角度、差异化、网上已经、竞品、搜索

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `topic` **必填** | string | 中心的话题/痛点 |
| `takes` **必填** | [{ text: string, heat?: string }] (3–8) | 网上已有的做法（被扫描到，标“已饱和”） |
| `scanAt` | 锚点 | 开始扫描（锚点，如“先看看”） |
| `pick` **必填** | { label?: string, text: string, at?: 锚点 } | 挑出来的新角度（锚点，如“角度”） |

<details><summary>示例 data</summary>

```json
{
 "topic": "发了没流量",
 "takes": [
  {
   "text": "10 个涨粉技巧"
  },
  {
   "text": "算法机制揭秘"
  },
  {
   "text": "爆款标题公式"
  },
  {
   "text": "起号避坑指南"
  },
  {
   "text": "投流教程"
  }
 ],
 "scanAt": 10,
 "pick": {
  "label": "值得你做的角度",
  "text": "新号 7 天真实起号记录",
  "at": 120
 }
}
```

</details>

### `checklist` 一条龙交付清单

3–10s · 变体 1

**画面**：一排交付物图块（自动配图标：封面/正文/标签/分镜/成片…），说到哪项哪项点亮打勾，进度条走满，最后金色横幅“一条全配齐”

**适用**：一个工具/流程把多项产出全包了；“从 A、B、C 一直到 D，一条全配齐”

**常见说法**：一条龙、全配齐、全套、一键、封面、正文、标签、分镜

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `items` **必填** | [{ text: string, icon?: string, at?: 锚点 }] (2–6) |  |
| `done` | { text: string, at?: 锚点 } | 全部完成后的横幅，如“一条全配齐” |

<details><summary>示例 data</summary>

```json
{
 "items": [
  {
   "text": "封面"
  },
  {
   "text": "正文"
  },
  {
   "text": "话题标签"
  },
  {
   "text": "分镜"
  },
  {
   "text": "口播成片"
  }
 ],
 "done": {
  "text": "一条全配齐"
 }
}
```

</details>

### `file-launch` 代码 → 文件 → 双击运行

4–12s · 变体 1

**画面**：编辑器窗口里 Ctrl+V 贴进代码；桌面文件图标的后缀被划掉改写（txt → html），图标变亮；鼠标双击后，成品小工具从图标里放大弹出成浏览器窗口，数据行开始跑

**适用**：把一段东西存成文件就能直接用：AI 写的 HTML 双击即跑、脚本改后缀变可执行、导出的 .csv 双击进表格、配置文件改名生效（code / from / to / app 全可改）

**常见说法**：记事本、改后缀、双击、HTML、打开、运行、单文件

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `editor` | string | 左边的编辑器窗口名；默认 "记事本" |
| `code` | string[] (1–8) | 贴进去的代码（几行示意即可）；默认 ["<!DOCTYPE html>","<html>","<style> …全部样式… </style>","<body> …界面… </body>","<script> …全部逻辑… </script>","</html>"] |
| `from` | string | 改名前的文件名；默认 "小工具.txt" |
| `to` | string | 改名后的文件名；默认 "小工具.html" |
| `pasteAt` | 锚点 | 代码贴进去的时刻（锚点，如“贴进去”） |
| `renameAt` | 锚点 | 改后缀的时刻（锚点，如“改成”） |
| `openAt` | 锚点 | 双击的时刻（锚点，如“双击”） |
| `appAt` | 锚点 | 浏览器弹出成品的时刻（锚点，如“弹出”） |
| `app` | { title: string, url?: string, button?: string, inputs?: string[] (0–3) } | 默认 {"title":"表格金额核对","button":"开始比对","inputs":["表格 A","表格 B"]} |
| `badge` | string | 成品弹出后的徽章，如“零依赖 · 双击即跑” |

<details><summary>示例 data</summary>

```json
{
 "pasteAt": 10,
 "renameAt": 50,
 "openAt": 100,
 "appAt": 118,
 "badge": "零依赖 · 双击即跑"
}
```

</details>

### `bug-fix-loop` 报错 → 甩给 AI → 整份覆盖修好

5–18s · 变体 1

**画面**：左边小工具点按钮没反应（红叉抖动）→ 按 F12 弹出控制台、红色报错被虚线框抓住 → 报错卡片飞进右边 AI 对话框、打出一句硬规则 → AI 生成整份文件（进度滚到 100%）→ Ctrl+A 全选、文件飞回覆盖 → 工具跑通，“0 报错”+ 金色章

**适用**：出错了把错误原样交给 AI、让它整份重做再覆盖：代码报错修复、表格公式出错重算、文档格式乱了整篇重排、配置写错整份替换（errors / prompt / file / app 全可改）

**常见说法**：报错、F12、修复、全量代码、覆盖、调试、Bug

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `app` | { title: string, url?: string, button?: string, inputs?: string[] (0–3) } | 默认 {"title":"表格金额核对","button":"开始比对","inputs":["表格 A","表格 B"]} |
| `key` | string | 打开报错面板的按键；默认 "F12" |
| `errors` | string[] (1–3) | 红色报错原文；默认 ["Uncaught TypeError: rows is undefined","    at compare (index.html:88)"] |
| `prompt` | string | 甩给 AI 时加的那句话；默认 "请直接给出修复后的全量完整代码，严禁给局部替换代码！" |
| `file` | string | AI 重新生成的整份文件；默认 "index.html · 全量代码" |
| `fixed` | string | 修好后盖的章；默认 "2 秒解决" |
| `failAt` | 锚点 | 点按钮没反应的时刻（锚点，如“点不动”） |
| `devAt` | 锚点 | 按下 F12、报错面板弹出（锚点） |
| `errAt` | 锚点 | 红色报错高亮（锚点，如“红色报错”） |
| `sendAt` | 锚点 | 报错被甩给 AI（锚点，如“甩给”） |
| `promptAt` | 锚点 | 开始打那句话（锚点） |
| `promptDoneAt` | 锚点 |  |
| `regenAt` | 锚点 | AI 整份重新生成（锚点） |
| `replaceAt` | 锚点 | 全选覆盖（锚点） |
| `fixedAt` | 锚点 | 跑通的时刻（锚点，如“解决”） |

<details><summary>示例 data</summary>

```json
{
 "failAt": 12,
 "devAt": 40,
 "errAt": 56,
 "sendAt": 80,
 "promptAt": 100,
 "promptDoneAt": 150,
 "regenAt": 160,
 "replaceAt": 200,
 "fixedAt": 220
}
```

</details>

### `drag-deploy` 拖拽上线 · 吐出网址 · 多端打开

4–14s · 变体 1

**画面**：文件从桌面被拖进托管平台的虚线框（框变亮）→ 进度条走满 → 专属网址逐字吐出；随后页面让到左边，笔记本和手机弹出，打开同一个网址、工具在两端同时跑起来

**适用**：把做好的东西一键发布出去给别人用：网页拖进托管平台、视频上传出链接、文件丢进网盘分享、App 提交上架（file / host / url / app 全可改）

**常见说法**：上线、部署、托管、拖进、网址、链接、分享

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string |  |
| `kicker` | string |  |
| `file` | string | 被拖进去的文件；默认 "小工具.html" |
| `host` | string | 托管平台（虚线框上方的名字）；默认 "免费网页托管" |
| `drop` | string | 虚线框里的提示；默认 "把文件拖到这里" |
| `url` | string | 吐出来的专属网址；默认 "https://my-tool.site" |
| `app` | { title: string, url?: string, button?: string, inputs?: string[] (0–3) } | 默认 {"title":"表格金额核对","button":"开始比对","inputs":["表格 A","表格 B"]} |
| `dragAt` | 锚点 | 开始拖文件（锚点，如“拖进”） |
| `dropAt` | 锚点 | 松手落进虚线框（锚点，如“虚线框”） |
| `doneAt` | 锚点 | 进度条走完（锚点，如“走完”） |
| `urlAt` | 锚点 | 网址吐出来（锚点，如“专属网址”） |
| `shareAt` | 锚点 | 发到群里、手机电脑都能打开（锚点，如“发到群里”） |

<details><summary>示例 data</summary>

```json
{
 "dragAt": 10,
 "dropAt": 40,
 "doneAt": 76,
 "urlAt": 84,
 "shareAt": 130
}
```

</details>

## 截图录屏

### `screen` 录屏截屏演示（设备框+鼠标+聚焦）

5–20s · 变体 3

**画面**：截图/录屏装进浏览器或笔记本外框，镜头推到 OCR 定位到的按钮并模拟鼠标点击

**适用**：文案里 [图: x.png] / [录屏: x.mp4] 的操作演示；说明写「点击"按钮名"」会自动定位

**常见说法**：点击、打开、界面、操作、设置、按钮、菜单、页面、截图、录屏

| 字段 | 类型 | 说明 |
|---|---|---|
| `src` **必填** | string |  |
| `kind` | "image" \| "video" |  |
| `aspect` | number |  |
| `frameStyle` | "browser" \| "laptop" \| "float" |  |
| `url` | string |  |
| `title` | string |  |
| `kicker` | string |  |
| `focus` | [{ x: number, y: number, w?: number, label?: string, click?: boolean }] (0–5) |  |

<details><summary>示例 data</summary>

```json
{
 "src": "assets/demo-shot.png",
 "aspect": 0.4375,
 "frameStyle": "browser",
 "url": "kb.example.com",
 "focus": [
  {
   "x": 0.5,
   "y": 0.1,
   "label": "打开知识库"
  },
  {
   "x": 0.5,
   "y": 0.45,
   "label": "上传文档"
  }
 ]
}
```

</details>

### `board-proof` 整屏截图举证

2–20s · 变体 1

**画面**：把一张真截图放大盖满画面当证据（边框 + 扫描线 + 高亮带 + LIVE），给 2 张时竖直滑切换图（同一张榜换个排序，左上角标签跟着换），讲完自动撤走露出真人

**适用**：用真实截图证明一个会变/会涨会跌的东西：大模型榜单换个排序就换第一、后台数据看板前后对比、价格页调整前后的截图、搜索结果页的变化（boards / aspect / swapAt 全可改）

**常见说法**：截图、榜单、举证、排名、真实数据

| 字段 | 类型 | 说明 |
|---|---|---|
| `kicker` | string | 卡片外的小标签 |
| `title` | string |  |
| `boards` **必填** | [{ src: string, note?: string }] (1–2) | 1 张=静态举证；2 张=在 swapAt 处竖直滑切换图 |
| `aspect` | number | 截图宽高比，卡片按它出尺寸；默认 2.13 |
| `badge` | string | 右上角徽章，如 LIVE |
| `centerX` | number | 卡片水平中心（0~1）；presenter 模式下真人小窗占右上角，把它左移避开；默认 0.5 |
| `inAt` | 锚点 | 卡片砸入的时刻（锚点或秒，相对本插图起点） |
| `swapAt` | 锚点 | 换到第二张的时刻（锚点或秒） |
| `outAt` | 锚点 | 撤走的时刻；缺省=本段结束前 12 帧（自动接上真人） |
| `zoom` | number | 停留期间的缓推量，0=完全静止；默认 0.05 |

<details><summary>示例 data</summary>

```json
{
 "kicker": "同一张榜，换个排序",
 "boards": [
  {
   "src": "assets/arena-rank-overall.png",
   "note": "按 OVERALL 排"
  },
  {
   "src": "assets/arena-rank-agentic.png",
   "note": "按 AGENTIC CODING 排"
  }
 ],
 "aspect": 2.13,
 "badge": "LIVE"
}
```

</details>

## 专属开场（每条视频一个，不复用）

### `opening-comment-mining` 开场 · 从评论区挖掘爆款选题

2–4s · 变体 1

**画面**：闪白砸字「为什么」→ 逐字弹出「自己觉得重要的话题」→ 观众头像出场 → 红章「根本不关心」+ 划掉「重要」+ 画面褪色抖动

**适用**：只给《从评论区挖掘爆款选题》用（开场不重样）

**常见说法**：开场、痛点反问

| 字段 | 类型 | 说明 |
|---|---|---|
| `q` | string | 默认 "为什么" |
| `line` | string | 默认 "自己觉得重要的话题" |
| `hl` | string | 默认 "重要" |
| `aud` | string | 默认 "观众" |
| `verdict` | string | 默认 "根本不关心" |
| `lineAt` | 锚点 | 「自己」开口：逐字弹出开始；默认 10 |
| `hitAt` | 锚点 | 「重要」：叮 + 光环；默认 27 |
| `lineEndAt` | 锚点 | 「题」：这一行弹完；默认 46 |
| `audAt` | 锚点 | 「观众」：头像出场；默认 55 |
| `rootAt` | 锚点 | 「根本」：头像开始变灰；默认 64 |
| `notAt` | 锚点 | 「不关心」：盖章 + 抖动 + 褪色；默认 74 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `opening-ai-tool-4steps` 开场 · 20 分钟用 AI 做出你的第一个小软件

2–4s · 变体 1

**画面**：闪白砸字「用了一整年」+ 天数 1→365 滚动 → 渐变「AI」徽章砸入 → 红章「还只是？」+ 抖动褪色 → 灰色「写周报」小卡弹出，真人 2 秒后收进右上小窗

**适用**：只给《20 分钟用 AI 做出你的第一个小软件》用（开场不重样）

**常见说法**：开场、反差质问

| 字段 | 类型 | 说明 |
|---|---|---|
| `lead` | string | 默认 "用了一整年" |
| `days` | number | 默认 365 |
| `unit` | string | 默认 "天" |
| `ai` | string | 默认 "AI" |
| `q` | string | 默认 "还只是？" |
| `chip` | string | 默认 "写周报" |
| `aiAt` | 锚点 | 「AI」：徽章砸入 + 叮；默认 31 |
| `qAt` | 锚点 | 「还只是」：红章 + 抖动褪色；默认 52 |
| `chipAt` | 锚点 | 「写周报」：小卡片弹出；默认 73 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `opening-model-arena` 开场 · 用 AI 挖出你身上的隐藏资产

2–4s · 变体 1

**画面**：真人脸卡 1 秒 + 砸字「全球最权威」→ 逐字弹出「大模型竞技场」→ 大字上移让位 → 真实榜单截图从中心放大砸入、居中盖住人脸（扫描线 + 高亮带 + LIVE）→ 同一张榜竖直滑切到另一种排序（红框里的模型名次变了）→ 截图缩回淡出、人脸重新出现

**适用**：只给《用 AI 挖出你身上的隐藏资产》用（开场不重样）

**常见说法**：开场、权威共识

| 字段 | 类型 | 说明 |
|---|---|---|
| `lead` | string | 默认 "全球最权威" |
| `line` | string | 默认 "大模型竞技场" |
| `hl` | string | 默认 "竞技" |
| `boards` | [{ src: string, note?: string }] (0–2) | 真实榜单截图 1~2 张；给 2 张时在 swapAt 处做「重新排序」式竖滑切换；不给就用合成榜单兜底；默认 [] |
| `boardAspect` | number | 截图宽高比，框按它出尺寸；默认 2.13 |
| `swapAt` | 锚点 | 两张截图切换（重新排序）的时刻（秒，相对开场起点） |
| `boardTitle` | string | 默认 "大模型竞技场 · 实时榜单" |
| `fallbackNames` | string[] (3–4) | 默认 ["Astra","Opus 5.5","开源模型","Gemini"] |
| `lineAt` | 锚点 | 「大模型竞技场」逐字弹出开始；默认 16 |
| `lineEndAt` | 锚点 | 这一行弹完；默认 44 |
| `slamAt` | 锚点 | 榜单截图砸入的时刻（秒，相对开场起点）；不给 boards 时它只决定大字何时让位；默认 52 |
| `typeOutAt` | 锚点 | 大字上移让位的时刻；缺省 = slamAt - 12 帧 |
| `outAt` | 锚点 | 榜单截图撤走的时刻（秒，相对开场起点）；默认 92 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t01-question` 模板 · 反问质疑（问号砸下 + 红章答案）

2–4s · 变体 1

**画面**：闪白 + 巨大问号在人脸旁砸下旋转，疑问词砸字，问句逐字弹出、强调词变色叮一声，最后红章盖下答案 + 画面抖动

**适用**：文案第一句是反问/质疑：“为什么…？”“你真的…吗？”“凭什么…？”

**常见说法**：开场模板、反问质疑

| 字段 | 类型 | 说明 |
|---|---|---|
| `q` | string | 砸下来的疑问词（2~4 字）；默认 "为什么" |
| `line` | string | 问句主体（≤10 字）；默认 "你越努力越没流量" |
| `hl` | string | 主体里要烧成强调色的词；默认 "没流量" |
| `answer` | string | 最后盖下的答案/判词；默认 "方向错了" |
| `lineAt` | 锚点 | 问句开始逐字弹出（锚点）；默认 10 |
| `lineEndAt` | 锚点 | 默认 40 |
| `answerAt` | 锚点 | 答案红章（锚点）；默认 58 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t02-number` 模板 · 数字冲击（计数狂滚 + 定格砸下）

2–4s · 变体 1

**画面**：第 0 帧巨大数字从 0 狂滚（滴答声 + 抖动模糊），说到数字那一刻定格放大、冲击环 + 叮，下面擦出解释句，人脸推镜头

**适用**：开头就是一个数字：“90% 的人…”“3 天涨粉 1 万”“月入 3 万”“只要 20 分钟”

**常见说法**：开场模板、数字冲击

| 字段 | 类型 | 说明 |
|---|---|---|
| `from` | number | 默认 0 |
| `to` | number | 最终数字；默认 90 |
| `decimals` | number | 默认 0 |
| `prefix` | string | 数字前缀，如 ¥ / +；默认 "" |
| `unit` | string | 单位；默认 "%" |
| `line` | string | 数字下面的一句（≤12 字）；默认 "的人都用错了 AI" |
| `hl` | string | 默认 "用错了" |
| `landAt` | 锚点 | 数字定格（锚点，数字说出口的时刻）；默认 24 |
| `lineAt` | 锚点 | 默认 34 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t03-myth` 模板 · 反常识（常识被划掉 → 真相砸入）

2–4s · 变体 1

**画面**：首帧砸出一句常识（带引号、绿勾），说到“错”时红线划掉 + 绿勾翻成红叉 + 故障抖动，真相大字从下方砸上来烧成强调色

**适用**：开头推翻一个常识：“都说…其实…”“努力就有结果？错”“别再…了”

**常见说法**：开场模板、反常识

| 字段 | 类型 | 说明 |
|---|---|---|
| `myth` | string | 大家以为的常识；默认 "越努力越成功" |
| `truth` | string | 反转后的真相；默认 "方向比努力重要" |
| `tag` | string | 否定大字；默认 "错！" |
| `strikeAt` | 锚点 | 划掉常识（锚点，如“错”）；默认 28 |
| `truthAt` | 锚点 | 真相砸入（锚点）；默认 44 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t04-pain` 模板 · 痛点扎心（黑白画面 + 痛点气泡围攻）

2–4s · 变体 1

**画面**：画面瞬间褪成黑白压暗，一个个红色痛点气泡从四周砸到人脸周围（每个一声咚、画面一震），最后大字“说的是不是你？”砸下，强调词变红

**适用**：开头连续列痛点、戳用户：“天天加班、工资不涨、学不动了…”“是不是你？”

**常见说法**：开场模板、痛点扎心

| 字段 | 类型 | 说明 |
|---|---|---|
| `pains` | string[] (2–5) | 围上来的痛点气泡；默认 ["天天加班","工资不涨","被裁员","学不动了"] |
| `line` | string | 最后的大字；默认 "说的是不是你？" |
| `hl` | string | 默认 "你" |
| `painAt` | 锚点 | 第一个痛点出现（锚点）；默认 4 |
| `gap` | number | 痛点之间隔几帧（没给锚点时）；默认 8 |
| `lineAt` | 锚点 | 大字砸下（锚点）；默认 48 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t05-suspense` 模板 · 悬念锁（马赛克遮挡 + 锁头晃动）

2–4s · 变体 1

**画面**：首帧大字 + 一块发光马赛克挡在人脸旁（像素抖动），锁头砸在上面，说到关键处锁晃动冒火花，右下角“看到最后 ▼”箭头呼吸

**适用**：开头卖关子：“最后一个方法才是重点”“我不建议你看到最后”“这个秘密…”

**常见说法**：开场模板、悬念

| 字段 | 类型 | 说明 |
|---|---|---|
| `line` | string | 被藏起来的东西；默认 "最后一个方法" |
| `secret` | string | 锁下面的一句；默认 "没人告诉你" |
| `cta` | string | 右下角提示；默认 "看到最后" |
| `lockAt` | 锚点 | 锁砸下（锚点）；默认 16 |
| `rattleAt` | 锚点 | 锁开始晃（锚点，如“不知道”）；默认 44 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t06-callout` 模板 · 身份点名（瞄准框锁定 + 人群标签）

2–4s · 变体 1

**画面**：四角瞄准框从全屏收拢锁定人脸（滴滴锁定声），身份大字贴在框边，人群标签从框上逐个弹出，最后一句“说的就是你”擦出

**适用**：开头点名目标人群：“如果你是宝妈/上班族/新手博主…”“这条视频只给…看”

**常见说法**：开场模板、身份点名

| 字段 | 类型 | 说明 |
|---|---|---|
| `who` | string | 点名的人群；默认 "普通上班族" |
| `tags` | string[] (0–3) | 人群标签，逐个弹出；默认 ["没背景","没资源","想搞副业"] |
| `line` | string | 最后一句；默认 "这条视频就是给你的" |
| `lockAt` | 锚点 | 定位框锁定人脸（锚点）；默认 6 |
| `tagAt` | 锚点 | 默认 22 |
| `lineAt` | 锚点 | 默认 52 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t07-before-after` 模板 · 前后对比（画面劈开 BEFORE/AFTER）

2–4s · 变体 1

**画面**：首帧左半边压灰写着 BEFORE + 惨淡数值，说到“现在”时一道光刃从上到下劈开画面，右半边金色 AFTER + 数值砸下，中间箭头冲击，底部一句钩子

**适用**：开头晒对比/逆袭：“3 个月前 0 粉，现在 10 万”“以前 3 小时，现在 3 分钟”“月薪 3 千到 3 万”

**常见说法**：开场模板、前后对比

| 字段 | 类型 | 说明 |
|---|---|---|
| `before` | { label: string, value: string } | 默认 {"label":"3 个月前","value":"0 粉丝"} |
| `after` | { label: string, value: string } | 默认 {"label":"现在","value":"10 万粉"} |
| `line` | string | 默认 "我只做对了一件事" |
| `splitAt` | 锚点 | 画面劈开、右侧 AFTER 出现（锚点，如“现在”）；默认 22 |
| `lineAt` | 锚点 | 默认 50 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t08-warning` 模板 · 警告禁止（红色警报 + 禁止牌）

2–4s · 变体 1

**画面**：首帧画面边缘红色警报闪烁、黄黑警戒条从上下滑入，“千万别”砸字抖动，内容逐字弹出，红色八角禁止牌带冲击砸在人脸旁

**适用**：开头警告/劝退：“千万别…”“再这样做就完了”“这 3 个坑一定要避开”

**常见说法**：开场模板、警告

| 字段 | 类型 | 说明 |
|---|---|---|
| `warn` | string | 警告大字；默认 "千万别" |
| `line` | string | 后面的内容；默认 "再这样写简历了" |
| `hl` | string | 默认 "这样" |
| `stop` | string | 禁止牌上的字；默认 "STOP" |
| `lineAt` | 锚点 | 默认 14 |
| `stopAt` | 锚点 | 禁止牌砸下（锚点）；默认 40 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t09-reveal` 模板 · 爆料揭秘（绝密档案撕封条）

2–4s · 变体 1

**画面**：首帧一份印着红章“绝密”的档案夹甩到人脸旁，说到揭秘时封条撕成两半飞出、档案翻开发光、大字从里面弹出

**适用**：开头爆料：“揭秘…内幕”“这是平台不会告诉你的”“行业里没人敢说的”

**常见说法**：开场模板、揭秘爆料

| 字段 | 类型 | 说明 |
|---|---|---|
| `file` | string | 文件夹上的字；默认 "行业内幕" |
| `seal` | string | 封条；默认 "绝密" |
| `reveal` | string | 撕开后露出的大字；默认 "没人会告诉你" |
| `hl` | string | 默认 "没人" |
| `tearAt` | 锚点 | 封条撕开（锚点，如“揭秘”）；默认 30 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t10-countdown` 模板 · 倒计时紧迫（巨型倒数 + 燃烧进度条）

2–4s · 变体 1

**画面**：首帧巨大数字 3→2→1 每下一砸（心跳声 + 画面脉冲），底部红色进度条像引线一样燃烧，归零时爆出结论大字 + 闪白

**适用**：开头强调时间短或紧迫：“只要 3 分钟”“最后 3 天”“5 秒钟教会你”“倒计时开始”

**常见说法**：开场模板、时间紧迫

| 字段 | 类型 | 说明 |
|---|---|---|
| `from` | number | 倒数起点；默认 3 |
| `unit` | string | 默认 "分钟" |
| `line` | string | 倒计时下面一句；默认 "学会这个技巧" |
| `endAt` | 锚点 | 倒数到 0 / 砸出结论的时刻（锚点）；默认 48 |
| `end` | string | 倒数结束时的大字；默认 "GO!" |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t11-money` 模板 · 金钱收益（金币雨 + 到账通知）

2–4s · 变体 1

**画面**：首帧金币从天而降砸满画面边缘，右上角弹出手机到账通知，金额数字从 0 狂滚到定格、金光扫过，叮叮收钱声

**适用**：开头晒收益/结果：“一个月多赚 3 万”“这条视频带来 1000 单”“省下 5 万块”

**常见说法**：开场模板、收益诱惑

| 字段 | 类型 | 说明 |
|---|---|---|
| `amount` | number | 默认 30000 |
| `prefix` | string | 默认 "¥" |
| `line` | string | 金额上面的小字；默认 "一个月多赚的" |
| `notice` | string | 手机到账通知；默认 "收款到账" |
| `landAt` | 锚点 | 金额定格（锚点）；默认 26 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t12-rewind` 模板 · 结果先行（定格 + VHS 倒带）

2–4s · 变体 1

**画面**：首帧结果大字砸下，随后画面定格（快门声 + 白框），出现 VHS 倒带 ◀◀ 和扫描噪点、时间码倒着滚，最后问句“怎么做到的？”砸出

**适用**：开头先抛结果再倒叙：“这个网站是我 20 分钟做的”“我是怎么做到的？让我们倒回去”

**常见说法**：开场模板、结果先行

| 字段 | 类型 | 说明 |
|---|---|---|
| `result` | string | 结果大字；默认 "20 分钟做出来的" |
| `hl` | string | 默认 "20 分钟" |
| `rewind` | string | 倒带后的问句；默认 "怎么做到的？" |
| `freezeAt` | 锚点 | 画面定格 + 倒带（锚点）；默认 24 |
| `askAt` | 锚点 | 默认 50 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t13-versus` 模板 · 对决 VS（两方冲撞 + VS 爆炸）

2–4s · 变体 1

**画面**：首帧左右两块斜切色块带着 A / B 名字冲向中间（速度线），撞上时巨大 VS 爆开 + 冲击环 + 闪白，问句从底部砸出

**适用**：开头比较两样东西：“A 和 B 到底谁更好”“手机 vs 电脑”“打工 vs 创业”

**常见说法**：开场模板、对决比较

| 字段 | 类型 | 说明 |
|---|---|---|
| `a` | string | 默认 "ChatGPT" |
| `b` | string | 默认 "Claude" |
| `q` | string | 默认 "到底谁更强？" |
| `clashAt` | 锚点 | 两方撞在一起（锚点，如“和”或 B 的名字）；默认 22 |
| `qAt` | 锚点 | 默认 40 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t14-list` 模板 · 清单预告（卡片扇形甩出 + 最后一张最狠）

2–4s · 变体 1

**画面**：首帧巨大“5”砸下 + 名词，随后 N 张卡片像扑克一样扇形甩出（每张一声），最后一张发金光翻转、其余变暗，钩子“最后一个最狠”擦出

**适用**：开头是清单/合集：“5 个 AI 工具”“3 个方法”“7 个习惯”——特别是“最后一个最重要”

**常见说法**：开场模板、清单干货

| 字段 | 类型 | 说明 |
|---|---|---|
| `n` | int | 清单数量；默认 5 |
| `what` | string | 数量后面的名词；默认 "个 AI 神器" |
| `items` | string[] (0–7) | 卡片上的字（可留空只显示序号）；默认 ["写作","做图","剪辑","表格","PPT"] |
| `last` | string | 结尾钩子；默认 "最后一个最狠" |
| `fanAt` | 锚点 | 卡片甩出（锚点）；默认 12 |
| `lastAt` | 锚点 | 最后一张高亮（锚点）；默认 50 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t15-chat` 模板 · 聊天截图（私信气泡逐条弹出）

2–4s · 变体 1

**画面**：首帧一部手机从侧面甩进画面（聊天界面 + 未读红点），对方气泡一条条弹出（消息提示音 + 手机震动），最后自己的绿色气泡回一句钩子

**适用**：开头引用粉丝/客户/老板的话：“昨天有人私信问我…”“老板跟我说…”“评论区有人问…”

**常见说法**：开场模板、真实提问

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 聊天对象名；默认 "粉丝私信" |
| `msgs` | [{ text: string, me?: boolean, at?: 锚点 }] (1–4) | 默认 [{"text":"学了半年 AI 还是不会用","me":false},{"text":"到底该从哪开始？","me":false},{"text":"今天一次讲清楚","me":true}] |
| `gap` | number | 没有锚点时气泡间隔帧数；默认 14 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t16-crowd` 模板 · 人群对比（百人方阵 → 只剩 1 个发光）

2–4s · 变体 1

**画面**：首帧满屏小人方阵像波浪一样亮起，说到“只有”时绝大多数快速熄灭变灰（咔咔声），只剩 1 个金色小人放大发光，结论句烧色

**适用**：开头讲比例/稀缺：“100 个人里只有 1 个…”“99% 的人都…”“只有少数人知道”

**常见说法**：开场模板、稀缺少数

| 字段 | 类型 | 说明 |
|---|---|---|
| `total` | int | 默认 100 |
| `keep` | int | 最后亮着的人数；默认 1 |
| `line` | string | 结论句；默认 "只有 1 个人做对了" |
| `hl` | string | 默认 "1 个人" |
| `fadeAt` | 锚点 | 大多数变灰（锚点，如“只有”）；默认 24 |
| `lineAt` | 锚点 | 默认 38 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t17-news` 模板 · 新闻快讯（BREAKING 红条 + 滚动字幕）

2–4s · 变体 1

**画面**：首帧新闻台包装：红色“重磅”块从左侧冲出 + 闪烁 LIVE，主标题白底条擦出，底部红色滚动字幕持续走，人像轻推镜头像主播

**适用**：开头是热点/新发布/大事件：“重磅！…刚刚发布”“突发”“行业变天了”

**常见说法**：开场模板、热点快讯

| 字段 | 类型 | 说明 |
|---|---|---|
| `tag` | string | 红条上的大字；默认 "重磅" |
| `headline` | string | 主标题；默认 "AI 行业刚刚变天了" |
| `ticker` | string | 底部滚动条；默认 "最新消息 · 全网首发 · 一条视频讲清楚 · " |
| `live` | string | 默认 "LIVE" |
| `headAt` | 锚点 | 主标题擦出（锚点）；默认 3 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t18-magnify` 模板 · 放大镜聚焦（画面里的关键物）

2–4s · 变体 1

**画面**：首帧“注意看”砸字 + 画面四周压暗，一个放大镜圆框从人脸滑到画面里的关键物上（真实放大底下的真人画面），箭头 + 标注弹出，底部擦出一句

**适用**：开头让观众看画面里某个东西：“注意看我身后…”“这台电脑…”“这个小东西让我…”（x/y 填它在画面里的位置）

**常见说法**：开场模板、细节聚焦

| 字段 | 类型 | 说明 |
|---|---|---|
| `lead` | string | 首帧大字；默认 "注意看" |
| `x` | number | 要放大的东西在画面里的水平位置 0~1；默认 0.12 |
| `y` | number | 默认 0.72 |
| `label` | string | 放大镜旁的标注；默认 "就是它" |
| `line` | string | 底部一句；默认 "让我一年省下 200 小时" |
| `zoomAt` | 锚点 | 放大镜落下（锚点）；默认 16 |
| `lineAt` | 锚点 | 默认 40 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t19-bet` 模板 · 挑战打赌（筹码砸桌 + 承诺盖章）

2–4s · 变体 1

**画面**：首帧金色筹码一叠从上方砸下（“我赌”）+ 冲击环，条件句逐字弹出，说到赌注时大红承诺字带印章边框砸下 + 画面剧烈一震

**适用**：开头立 flag/打赌/挑战：“看完还不会我…”“我赌你做不到”“7 天挑战…”

**常见说法**：开场模板、挑战打赌

| 字段 | 类型 | 说明 |
|---|---|---|
| `bet` | string | 条件；默认 "看完还学不会" |
| `promise` | string | 承诺/赌注；默认 "我直播吃键盘" |
| `chip` | string | 筹码上的字；默认 "我赌" |
| `promiseAt` | 锚点 | 承诺砸下（锚点）；默认 34 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `op-t20-glitch` 模板 · 故障闯入（信号撕裂 → 真人闯出）

2–4s · 变体 1

**画面**：首帧满屏 RGB 撕裂 + 雪花噪点 + 横向错位条（故障声），“先别划走”在故障里闪烁，信号一恢复人脸猛推清晰，下方一句钩子逐字弹出

**适用**：通用强打断开场：“停！先别划走”“等一下”“你刷到这条是有原因的”——任何需要立刻抓住注意力的文案

**常见说法**：开场模板、打断刷屏

| 字段 | 类型 | 说明 |
|---|---|---|
| `stop` | string | 故障里闪出的大字；默认 "先别划走" |
| `line` | string | 稳定后的一句；默认 "这条能帮你省 100 小时" |
| `hl` | string | 默认 "100 小时" |
| `clearAt` | 锚点 | 信号恢复、人脸清晰（锚点）；默认 18 |
| `lineAt` | 锚点 | 默认 30 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `trick-01-zoom-suspense` 第1招 · 慢慢放大 + 做悬疑

2–4s · 变体 1

**画面**：人物画面从 1.0 全程缓慢推近到 1.2 倍（持续压迫感），悬念问句逐字弹出、强调词变色，全程不给答案

**适用**：悬念型、揭露型开场：“为什么…”“最后一个方法…”“我赌你不知道…”

**常见说法**：开场模板、悬念推镜

| 字段 | 类型 | 说明 |
|---|---|---|
| `hook` | string | 开场悬念句（只提问，不给答案）；默认 "为什么越努力越没结果" |
| `hl` | string | 要强调的词；默认 "越努力" |
| `zoomTo` | number | 推到多近（1.15~1.3 压迫感最强）；默认 1.22 |
| `question` | string | 补一句更小的追问，可留空；默认 "" |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `trick-02-morph-rhythm` 第2招 · 出其不意 + 按节奏变形

2–4s · 变体 1

**画面**：前半段正常全屏讲第一句；说到关键词那一刻人像容器突然变形（变成圆形/宽幅/倾斜），画面一震 + 闪白，第二句砸出

**适用**：反常识型、转折型：“这叫教程？其实这是印钞机”“你以为 A，其实是 B”

**常见说法**：开场模板、形态突变

| 字段 | 类型 | 说明 |
|---|---|---|
| `line` | string | 第一句；默认 "这不是教程" |
| `line2` | string | 突变后的第二句；默认 "这是印钞机" |
| `morphAt` | 锚点 | 形态突变时刻（锚点，卡在语音节奏上）；默认 40 |
| `shape` | "circle" \| "wide" \| "tilt" | 人像容器突然变成什么形状；默认 "circle" |
| `color` | string | 突变后画面偏色（留空则不变）；默认 "" |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `trick-03-mask-focus` 第3招 · 蒙版缩圈 + 开篇主题

2–4s · 变体 1

**画面**：画面外圈被黑暗遮罩包住并向中心收圈（强制聚焦到人脸），收到最小时主题大字点亮、副标题补上，是「本片要讲什么」的预告

**适用**：聚焦型、主题揭示型：任何需要 1 秒内说清“这条视频讲什么”的开场

**常见说法**：开场模板、遮罩收圈

| 字段 | 类型 | 说明 |
|---|---|---|
| `theme` | string | 本片主题（收圈到最小时出现）；默认 "AI 四步法" |
| `sub` | string | 副标题；默认 "20 分钟做出第一个小软件" |
| `irisTo` | number | 光圈收到多小（百分比，越小越聚焦）；默认 26 |
| `holdAt` | 锚点 | 收圈完成的时刻（锚点），主题此刻亮起；默认 34 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `trick-04-title-behind` 第4招 · 身后飞个大标题 + 抠像 + 副标题

2–4s · 变体 1

**画面**：人物保持主体（半透明景深把人像托到前景），大标题从人物身后由远及近飞入放大，最后副标题从下方补位 —— 字在身后、人在前面

**适用**：真人口播、观点输出：需要一句大标题压住画面的开场

**常见说法**：开场模板、分层飞入

| 字段 | 类型 | 说明 |
|---|---|---|
| `lead` | string | 标题上半句（小）；默认 "我劝你" |
| `title` | string | 大标题（从身后飞入放大）；默认 "别再手写周报了" |
| `sub` | string | 副标题（最后补位）；默认 "一个人也能干完一个团队的活" |
| `flyAt` | 锚点 | 大标题飞入时刻（锚点）；默认 14 |
| `subAt` | 锚点 | 副标题补位时刻（锚点）；默认 34 |

<details><summary>示例 data</summary>

```json
{}
```

</details>

### `trick-05-info-first` 第5招 · 文字干货先出现，再露脸

2–4s · 变体 1

**画面**：第 0 帧先砸出干货要点（此时人还没出现，画面是暗底 + 文字），延后 0.2~1 秒人物画面才淡入 —— 先用信息抓住人，再露脸

**适用**：干货型、知识型：“3 个方法”“不写代码也能做”“记住这几点”

**常见说法**：开场模板、信息前置

| 字段 | 类型 | 说明 |
|---|---|---|
| `points` | string[] (2–4) | 先甩出来的干货要点；默认 ["不写代码","不装环境","双击就能跑"] |
| `delay` | number | 人物延后出画的帧数（0.2~1 秒 = 6~30 帧）；默认 9 |
| `title` | string | 可选的标题，留空则不显示；默认 "" |

<details><summary>示例 data</summary>

```json
{}
```

</details>
