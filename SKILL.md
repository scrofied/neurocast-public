---
name: neurocast
description: 把中文文案（讲稿）+ 配音（TTS，可加真人口播视频）做成 16:9 科技感动画讲解视频（mp4，本地 Remotion 渲染）。按配音的真实时间轴分镜：镜头切换、画面里每个元素出现的时刻、逐字字幕都卡在对应的词上。组件库是可持续扩充的动画资产，现有画面表达不好时要新增组件。用户给文案+配音/口播视频，要做讲解视频、知识视频、口播配动画时使用。
---

# NeuroCast · 文案 + 配音 → 动画讲解视频

## 它做什么

1. **对齐**：本地 faster-whisper 识别配音里每个字的时间，再把**文案**逐字对齐上去。屏幕上的字、字幕全部以文案为准，ASR 的错别字（爆款→报款、金子→精子）不会上屏。
2. **口播**：`[口播: x.mp4]` 段落用真人原声原画面；配音里如果也念了这段（常见），自动跳过，接着往下放。
3. **分镜**：由你（调用 skill 的模型）写 `storyboard.json`：每个镜头从哪句台词开始、用哪个组件、画面里每个元素在哪个词出现（锚点）。管线把锚点换算成帧。没有分镜时有自动模式兜底。
4. **校验**：每个镜头的数据用组件的 zod schema 校验，不合格直接报错，不会渲染到一半崩掉。
5. **渲染**：逐字高亮字幕（跟真实语音走）、章节 HUD、音效、响度统一到 -16 LUFS、HEVC 口播自动转 H.264。

## 快速开始（示例就是一条完整的真实视频）

```bash
node scripts/make.mjs examples/comment-mining/input.json --out output/从评论区挖掘爆款选题.mp4
```

需要 Node 22+、ffmpeg、Python 3 + `faster-whisper`（时间轴识别）+ `rapidocr_onnxruntime`（截图按钮定位，可选），首次在项目目录执行 `npm install`。
Windows 上如果 `node` 不在 PATH：`$env:Path = "$env:USERPROFILE\.workbuddy\binaries\node\versions\22.22.2-3;$env:Path"`。

## 一条视频 = 一个独立项目目录（硬规则）

**母 skill 目录只放基础设施**（`src/` 组件与引擎、`scripts/` 管线、`CATALOG.md`、三个台账）。单条视频的文案、配音、截图、分镜、成片、静帧，一律落在自己的工作目录里，不许混进母 skill 目录——混进去下次就分不清哪条片是哪条片，母目录也会越来越乱。

每条片的家：`<工作区>/neurocast-<片名>/`

```
neurocast-我的新片/
  文案.md            讲稿 + [口播:] [出处:] [流程:] [圈注:] 这些槽位标记（见「素材槽位」）
  input.json         管线入口（路径都相对这个目录写）
  storyboard.json    分镜
  assets/            配音 voice.mp3、口播 mp4、截图、录屏——都放这儿
  assets_todo.md     管线生成的采集清单（缺哪张素材、上哪一镜），照它去截图
  out/               成片、beats.md、静帧拼图自动落这里（gitignore 覆盖，不用管）
```

创建：

```bash
node scripts/new-video.mjs 我的新片                 # 中文片名即可
node scripts/new-video.mjs 我的新片 my-new-video    # 第二个参数是开场的 ascii id（中文名必须给）
```

它会建好上面这套目录，顺手在 `src/openings/<日期>-<id>/Opening.tsx` 生成这条片的**专属开场骨架**并登记进 `src/openings/index.ts`（开场是组件资产，留在 skill 里；`--plan-only` 前不用手工接线）。工作区默认取当前目录往上找到的第一个含 `neurocast-*` 的目录，也可用 `--at <目录>` 或环境变量 `NEUROCAST_WORKSPACE` 指定。

判据（管线自动识别，无需参数）：`input.json` 在 skill 目录外 → 它所在目录就是这条片的家，所有产物落 `<片目录>/out/`，任务名取片目录名（不再是一串 `input_2026…`）。`examples/` 里的历史示例照旧落 `ROOT/out`，行为不变。

## 工作流程（调用模型照做）

| 步骤 | 命令 | 产出 |
|---|---|---|
| 1 建片目录 | `node scripts/new-video.mjs <片名> [ascii-id]` → 往里放文案.md / 配音 / 截图，写 `input.json` | 独立项目目录 + 专属开场骨架 |
| 2 节拍表 | `node scripts/make.mjs <片目录>/input.json --beats` | `<片目录>/out/…beats.md`：每句台词的真实时间、口播/配音分段、匹配率 |
| 3 写分镜 | 读 `beats.md` + `CATALOG.md`，先看 `node scripts/pick.mjs --recent` 避开上几条片的老面孔，写 `<片目录>/storyboard.json` | |
| 3.5 定制开场 | 改步骤 1 生成的 `src/openings/<日期>-<id>/Opening.tsx`（首帧钩子按这条片重写，见「专属开场」），`node scripts/openings.mjs sync` | 开场库 +1 |
| 4 校验 | `node scripts/make.mjs <片目录>/input.json --plan-only` | 镜头表；锚点找不到、数据不合 schema、本片内重复、**跨片重复**都会逐条列出 |
| 5 看静帧 | `node scripts/make.mjs <片目录>/input.json --stills` | `<片目录>/out/<名>_stills.jpg`：每个镜头一张，先看再渲染 |
| 5.5 逐帧查转场 | 改了 `ShotFrame.tsx` / `PostPass.tsx` 或第一次用 zoom/push/wipe/grid 时：`node scripts/qa/transitions.mjs` | `out/qa/transitions.jpg`：每个边界一行（上一镜尾巴 / 入场 +2 / +6 / +10 / 稳定帧）+ 开/关后期均差。**稳定帧和首帧必须是 0**（滤镜没挂上、开场第 0 帧干净），换镜帧应明显 >0 |
| 6 渲染 | `node scripts/make.mjs <片目录>/input.json` | 2.5 分钟视频约 7 分钟，成片落 `<片目录>/out/`；成功后自动写用量台账 |
| 7 补资产 | 某段现有组件表达不好 → 先 `pick.mjs --fresh` 在没上过的组件里找，找不到再新建（见「扩展组件资产」） | 组件库越用越丰富 |

命令都在 skill 目录里执行（`scripts/` 在那儿）；`input.json` 和素材路径相对**它自己所在的片目录**写，所以同一份 `input.json` 换台机器也能跑。`beats.md` 里匹配率低于 90% 说明文案和配音对不上（配音不是按这份文案生成的），先把文案改成配音实际念的内容。

## input.json

| 字段 | 必填 | 说明 |
|---|---|---|
| `script` / `script_file` | 是 | 文案全文，或文案文件（相对 input.json） |
| `audio` | 出片必填 | 配音文件（mp3/wav/m4a）。不给时只能按字数估算时长出草稿 |
| `audio_timeline` | 否 | 配音的时间轴 JSON（`asr_words.py` 输出的 `{words:[{start,end,text}]}`，或 `{segments:[…]}`）。不给就自动识别并缓存到 `.cache/asr` |
| `clip_timelines` | 否 | 口播视频的时间轴 `{ "talk.mp4": "talk_asr.json" }`，不给就自动识别 |
| `opening_video` | 否 | 开场口播视频。文案里没写 `[口播:]` 时用它：自动找出它讲到文案哪里，那部分归口播 |
| `presenter` | 否 | **全片只用 TTS 配音**时的真人画面层：`{ "video": "talk.mp4", "timeline": "talk_asr.json", "full": 2 }`。真人静音，按口型自动对齐 TTS：逐字拟合，语速差非线性时自动用 ffmpeg setpts 把真人视频重排到 TTS 时钟（两段变速，日志会打「✓ 真人分段变速」），前 `full` 秒全屏，之后收进右上角小窗，一直播到视频素材结束。可选 `offset`（秒，手动偏移）、`rate`（手动变速，给了就跳过分段）、`focusX/focusY`、`hideFrom`（秒，提前收起） |
| `storyboard` | 推荐 | 分镜文件。不给 = 自动模式（规则检测，效果一般） |
| `title` | 否 | 视频标题（口播标题条、HUD） |
| `seed` | 否 | 换 seed = 换一套配色/3D 背景/字体/转场组合 |
| `skin` | 否 | aurora / violet / amber / matrix / arctic |
| `keywords` | 否 | 字幕里要高亮的词（数字、英文词自动高亮） |
| `cta` / `outroTitle` | 否 | 自动模式结尾用 |
| `captions` | 否 | `false` 关字幕 |
| `sfx` | 否 | `false` 关音效（或命令行 `--no-sfx`） |
| `bgm` | 否 | 背景音乐文件（音量 0.14，约 -17 dB） |
| `post` | 否 | 全片后期层强度（`src/engine/PostPass.tsx`）：`{ "grain": 0.07, "vign": 0.95, "scan": 1, "chroma": 1, "tear": 1, "flashOnCut": true }`。`chroma`/`tear` 是倍率（0~2，0 = 关掉 RGB 分离 / 画面撕裂），其余 0~1。撕裂和闪白**只发生在换镜那 12 帧**，稳定帧与首帧恒定干净；讲严肃数据、不想看着「花」的片子写 `"chroma": 0, "tear": 0` |
| `tail` | 否 | 最后一句话之后留几秒，默认 1.6 |

## 文案写法

```markdown
# 视频标题
## 开场
[口播: talk.mp4]
他在视频里说的原话（逐字，口误可以不写）。

## 第二章
配音念的正文……
[图: 截图.png]
点击"设置"，再选择"导出"。（截图后第一段里的「点击"按钮"」会被 OCR 定位，镜头推过去模拟点击）
> 备注行（> 或 // 开头）不会被当成台词
```

- `## 章节` → 顶部 HUD 章节进度；换章时 HUD 标题闪一下，不额外占时长。
- `[口播: x.mp4]` 之后到下一个 `##`（或 `[配音]`）之间的段落 = 口播里说的话。
- 文案必须是**配音实际念的内容**。同一段话不要写两遍（旧版示例就是把开场写了两次，导致口播和配音重复）。
- 代码块 ``` 不参与对齐（配音一般不念代码）。

### 素材槽位：一行标记点名「用真素材 + 用哪个组件」

写文案时手上有真东西（截图、榜单、 logo、评论、原话），别去写 storyboard——直接在文案里挂一行槽位标记，自动分镜就会点名对应组件并把文件拷进任务目录：

```markdown
[logo: Claude, 剪映, 小红书, GitHub]        → logo-wall（品牌库里有真 svg 就上真的）
[品牌墙: …]  [出处: LMArena 榜单 https://lmarena.ai 2026-09-30]  [来源: …]   → citation-strip
[文档: 长截图.png]  [文档: p1.png, p2.png]  [表格: …]             → real-doc-scroll（逐页滚动）
[对比: 改之前.png 手写; 改之后.png 装了 skill]  [vs: a.png b.png]  → screen-versus
[证据: 报表.png 0.42,0.31 成本占90%]                              → evidence-zoom（圈选放大）
[证据: 报表.png 成本占90%]                                        → 没坐标就退成 screen，让管线 OCR 定位（坐标必须是量出来的）
[头像: 头像1.png 小王|做了 3 年运营, 阿月|自媒体]                  → photo-wall（≥2 人）
[评论墙: 小明|这招真有用 1.2万, …]  [评论: …]                      → comment-wall（≥3 条）
[原文: “Everything is a function of the current frame.” ——官方文档 · Models]  → brand-quote-card
[金句: …]
[流程: 首页.png 打开榜单, 榜单.png 换到 AGENTIC, 结果.png 导出]        → screen-morph（一镜到底，2~6 格真截图）
[层层: 主界面.png 0.3,0.36 总榜, 明细.png 0.5,0.16 单个模型]           → infinite-zoom（穿门无限缩放，洞口坐标可选）
[圈注: 报表.png 0.42,0.31 成本占九成]                                  → cursor-trace（在真截图上一笔笔画出来）
```

- 一行一个标记，**不朗读、不进字幕**，挂在紧跟的那段正文上；一段里多个标记 = 多个镜头（每个标记切一刀）。
- 名字必须在这几个里（`SLOT_NAMES`），否则当成正文。写得再详细也不会念出来。
- 组件字段要求不满足（比如 `[出处]` 里没写真地址、`[评论墙]` 只有两条）→ 这条标记作废，退回通用检测器，不硬凑假素材。
- 标记里点名的文件找不到 = `E_ASSET` 硬失败；草稿阶段先看分镜用 `--allow-missing-assets` 降级（画面渲染「缺素材 · 字段」占位，并在采集清单里记账）。


## 分镜 storyboard.json

```json
{
  "keywords": ["评论区"],
  "shots": [
    { "type": "talking-head-stage", "data": { "title": "…", "left": [ { "type": "phone-feed", "at": "为什么", "data": { "swipeAt": "划过去" } } ], "right": [ … ] } },
    { "start": "自己先吭哧吭哧", "type": "sword-forge", "data": { "labelAt": "削铁如泥", "askAt": "喂" } },
    { "start": "这不是瞎胡闹吗", "type": "punch-text", "data": { "text": "这不是瞎胡闹吗？", "emphasis": ["瞎胡闹"] } }
  ]
}
```

规则：

1. **start 写台词原文**（这一镜第一句的开头几个字），按顺序、必须出现在上一镜之后。镜头在这个词出口前 0.12 秒切入，持续到下一镜开始。也可以写 `"beat": "b12"`。
2. **锚点**：data 里所有 `at` / `until` / `xxxAt` 字段写台词原文片段，如 `"flipAt": "倒过来"`。`"词$"` = 这个词说完的时刻，`"词+0.3"` = 往后 0.3 秒，纯数字 = 相对本镜头（或本侧栏槽）开始的秒数。**画面里的每个出现/变化都要卡锚点**，这是“音画同步”的关键。
3. **口播段**只能是一个 `talking-head-stage`（不写 start）；要加动画写进它的 `left` / `right` 侧栏（槽里的组件必须是 CATALOG 标了「可放侧栏」的）。视频以口播开头时必须有 `opening`（见「专属开场」）。
4. **按意思选组件，不按关键词**：先问“这句话在讲一个什么场景/关系”，再去 CATALOG 找对应画面（先后顺序反了 → logic-flip；大 vs 小 → scale-gap；以前 vs 现在 → before-after；逐个推荐工具 → tool-card focus）。出现“AI”两个字不等于要用 neural。
5. **画面里的字比台词短**：标题、标签、数字、关键词；不要把整句台词再抄一遍（底部已有字幕）。画面本身就在“说台词”的组件（dialogue / chat-command / punch-text）会自动关字幕，可用 `"captions": true/false` 覆盖。
6. **节奏**：一镜 2~8 秒为宜；< 1.5 秒的短句并进相邻镜头（比如“快拉倒吧”做成对话最后一条 punch 气泡）；超过 10 秒的镜头必须有 3 个以上内部锚点。同一组件不要连用超过 2 次（逐个介绍的系列除外）。
7. 可选字段：`transition`（fly / warp / iris / glitch / fade / cut / flood / zoom / push / wipe / grid）、`through`、`variant`、`captions`。
   - **flood**「一镜到底」：一块黑形状涨满吞掉上一场，再收缩成圆点把下一场吐出来（不剪、不淡出，下一场像从上一场里长出来的），适合连续推同一件事。
   - **形状连续转场 zoom / push / wipe / grid**（移植自 opus-video-skills 的真代码，见 `docs/OPUS55_ANIMATIONS.md` 一·b）：上一镜不淡出、不剪走，下一镜从上一镜画面里的**一个形状**长出来盖满全屏。写在**入场**那一镜上；A/B 两侧靠镜头重叠的 12 帧各算同一个 k，视觉上就是同一扇门在放大。
     - `zoom`：从 `through` 指定的位置钻出来放大铺满。`"through": [中心x, 中心y, 宽, 高]`，全部 0~1 归一化（例：`[0.78, 0.3, 0.16, 0.22]` = 右上那块）。**洞要对准上一镜里正在讲的那个东西**——上一镜是仪表盘，就把洞开在那块表上，观众的视线是被「带着走」而不是被切过去的。不写 `through` 用画面中上默认位。
     - `push`：整块画面被下一镜推走；推进方向 = `variant % 4`（0 右 / 1 下 / 2 左 / 3 上），讲「并列两块内容」「下一步」时用。
     - `wipe`：从左推过去的擦除，前缘一条强调色亮边；讲「切换到下一个对象」用。
     - `grid`：16×9 格子按对角线依次弹起强调色块再被画面顶替；适合章节切换、总结页、信息密度高的下一镜。
   - 选转场的标准是**语义**不是好看：`cut` 只给口播首镜和「必须立刻看清」的硬转折；连续推同一件事优先 zoom/push/wipe/grid/flood；`fade` 留给时间/场景真的跳了一段的地方。随机池（不写 `transition` 时）由 seed 挑 4 种。
8. 写完跑 `--plan-only`：报「锚点找不到」就换成台词里真实存在的字；报 schema 错误就照 CATALOG 改字段。再跑 `--stills` 看每镜静帧。
9. 字幕每行 ≤ 12 字（自动断行），黑描边，不用管。

完整示例：`examples/comment-mining/storyboard.json`（24 个镜头，覆盖真人口播 + 20 种新组件 + 专属开场）。

## 专属开场（每条视频一个，定制，不套模板）

开场决定 2 秒跳出率，所以**每条视频都要为它的文案 + 口播画面单独写一个开场组件**，不从库里挑模板套用（库攒到 20~30 个、有了数据之后才考虑组合复用）。

**形态**：透明画布，叠在真人画面**上层**（不做人像分割；只有必须让字穿到人身后时才考虑）。开场写进口播镜头：

```json
{ "type": "talking-head-stage", "data": {
    "shrinkAt": "关心$",
    "opening": { "type": "opening-comment-mining", "at": 0, "until": "关心$+0.25",
                 "data": { "hitAt": "重要", "audAt": "观众", "notAt": "不关心" } },
    "left": [ { "type": "phone-feed", "at": "你自己", … } ], … } }
```

- `shrinkAt`：真人从全屏收进中间舞台的时刻（开场全屏播完再收）。侧栏内容从 `shrinkAt` 之后开始。
- 开场播放期间底部字幕自动隐藏（开场自己就在用大字说这句话）。
- 开场组件可以导出 `camera(data, frame, dur)`，控制下面的真人画面：推镜头 `zoom`、抖动 `x/y/rot`、调色 `filter`（褪色/对比）、`tint` 压色。

**全片 TTS + 真人小窗**（input 用 `presenter`，文案里不写 `[口播:]`）：开场不挂在口播镜头上，而是写在分镜顶层，叠在真人画面层上面；正片镜头照常从第 0 帧开始排（开场期间正片在真人下面，真人收进小窗后露出来）：

```json
{ "opening": { "type": "opening-ai-tool-4steps", "at": 0, "until": "写", "data": { "aiAt": "AI", "qAt": "还只是" } },
  "shots": [ { "type": "untapped-potential", "data": { … } }, … ] }
```

`camera()` 同样作用在真人层上。完整示例：`examples/ai-tool-4steps/`。

**硬指标**（`--plan-only` 会检查时长和重复）：

1. 时长 2~3 秒（60~105 帧），只讲第一句钩子（悬念 / 痛点 / 反问 / 反常识 / 数字冲击）。
2. **第 0 帧就有大字**（不要从透明淡入），配闪白 + 冲击音（impact / 咚）；强调词配 ding。
3. 前 5 秒至少 4 次画面形态变化（砸字 → 逐字弹出 → 图形/头像出场 → 盖章/划掉 → 收进舞台），画面始终在动（`drift`）。
4. 画面上的字比台词短，每个出现都卡锚点（和口播同步）；字全部黑描边，亮背景也看得清。
5. 不重样：同一个开场只能用在一条视频上（`openings/library.json` 的 `usedBy`）。

**做法**：

1. 读文案第一句 + 看口播第一帧（`ffmpeg -ss 0.5 -i talk.mp4 -frames:v 1 f.jpg`：人在画面哪边、背景亮不亮），定钩子类型和画面动作。
2. 改 `node scripts/new-video.mjs` 生成的 `src/openings/<日期>-<id>/Opening.tsx`（骨架已带 `layer: "opening"`、`noGallery: true`、`opening: { script, hook, techniques }` 元信息，也已登记进 `src/openings/index.ts`），把首帧钩子按这条片重写。手工新建也行，但要自己补 index.ts 那一行。
3. 用电影感工具包 `src/lib/cine/` 拼：
   - `Type.tsx`：`Slam` 砸字、`CharPop` 逐字弹出、`Wipe` 擦出、`Stamp` 盖章、`Strike` 划掉、`Counter` 数字滚动、`outline()` 描边
   - `Flash.tsx`：`Flash` 闪白、`RingBurst` 冲击环、`SpeedLines` 速度线、`Scrim` 压暗一侧保证字可读
   - `motion.ts`：`shake/shakes` 抖动、`punch` 推镜头、`env` 包络、`drift` 常动
4. 分镜里挂到口播镜头的 `opening`，跑 `--frames 0-179 --out out/op.mp4`，抽帧看第 0 / 1 / 2 / 3 秒。
5. 归档：`node scripts/openings.mjs sync`，`node scripts/openings.mjs preview <input.json>`（前 5 秒预览存到 `openings/previews/`）。

**开场库与数据**（`openings/library.json`）：每个开场记录钩子类型、手法、预览、用在哪条视频、数据。发布后录入数据：

```bash
node scripts/openings.mjs metric opening-comment-mining bounce2s=31% finish5s=58% plays=1200
node scripts/openings.mjs list
node scripts/openings.mjs status opening-comment-mining keep
```

2 秒跳出 > 35% 或 5 秒完播 < 50% 标记「建议淘汰」（阈值在 library.json 的 `rules` 里改），保留下来的手法优先用在后面的开场里。

## 正片组件：只加真正通用的

正片不再每条视频新增一批专用组件（目标：每条视频新增 0~2 个）。新增前先过这 4 条，缺一条就不要加，改用现有组件的参数：

1. **按叙事动作定义**，不按题材：「A 被 B 替代」「数量从多到少被筛选」「循环越转越快」，而不是「评论区挖矿」。
2. **内容全靠参数**：文字、数字、图标（`src/lib/icons.tsx`）、颜色语义都从 data 来。
3. 能说出 **3 个不相关题材**的用法，写进 `use`。
4. **画面有动作**（有东西移动、变化、碰撞），不是一屏字。

去 PPT 感（`--plan-only` 会警告）：纯文字镜头（narration / quote / punch-text / chapter / bullet-cards / cards / hook）不超过 20%，不能连续两个；同一组件不要紧挨着用两次。

### 跨片重复：用量台账是硬规则，不是参考

「每次都是那几个组件」是观众看出来的重复，单片内的检查抓不到——它发生在**片与片之间**。所以有一条持久记忆：`usage/library.json`（`node scripts/usage.mjs report` 看）。

- **每条片子至少首次使用 3 个从未上过片的组件**（`rules.minFresh`）。`--plan-only` 会算给你看，不够就回去换 `--fresh` 池子里的。
- **近 3 条片用过的组件**（`rules.recentVideos`）：出现在 ≥2 条近片的 → 换成语义接近的别的组件，或新增；只在 1 条近片用过的 → 可以用，但 `motion.enter` 必须换成这个组件没用过的入场语法（`pick.mjs` 的 ⚠ 标记和台账里的「入场已用 …」都会告诉你哪些用过了）。
- 渲染成功后管线自动记账；`--plan-only` / `--stills` 不记账，`--dry-run` 全流程也不记账。调试老素材不想被记账/检查：`--no-usage-check`；想改片子身份：`--video 片名`。
- 台账是资产不是负担：`usage/library.json` 要提交，换机器/重新 clone 后跨片记忆才还在。历史片第一次建库用 `node scripts/usage.mjs backfill <分镜或时间轴路径…>`。

**入场语法：每条正片镜头都显式写 `motion.enter`。** 现在 100 个正片组件全部接了 `src/lib/enter.tsx`（`node scripts/motion-audit.mjs` 报「待迁移 0」），分镜写什么就用什么运动：`rise / slam / slide-l / slide-r / wipe / assemble / zoom-through / drop`，可配 `energy: 1|2|3`。

```json
{ "type": "leaderboard", "motion": { "enter": "slide-l", "energy": 2 }, "data": { … } }
```

- 同一个组件在一条片子里用第 2、3 次时，**必须换一种 enter**（`--plan-only` 的多样性检查会盯全片频次、5 镜滑窗、连续同入场、单变体复用四项）。这样即使躲不开复用，观众看到的也不是同一个动作。
- 组件里的 `fallback` 保住的是它原生观感：不写 `motion.enter` 时逐帧和迁移前一致（已用 316 帧像素对照验证，最大平均差 1.5/255）。所以 enter 是**免费**的改动，只影响这一镜的运动方式。
- 例外：隐喻主体的运动轨迹（骨牌倒下、药片下落、传送带、曲线生长、翻牌角度）不由 enter 决定，那些是组件的内容；enter 只管元素怎么进场。
- 新增组件时必须接 `useEnter(variant)` 并消费 `e.p / e.opacity / e.scale / e.dx / e.dy / e.clip`，只换 `e.p` 不算接完（`node scripts/motion-audit.mjs` 查得出）。

## 真实素材：信任度的硬指标

全片都是代码动画 → 观众不信。所以「真东西上屏多少秒」是一条硬指标，和用量台账同级：

- **素材占比 = 用了真素材/真标识/真出处的镜头时长 ÷ 全片时长**，`rules.minRatio = 0.2`（`assets/library.json`）。低于 20% 时 `--plan-only` 和每次渲染都会 `⚠` 提醒。做新片默认按 ≥20% 排镜头。
- 真标识（`public/brands/*.svg`）和真地址（citation-strip 的 url）**不计进占比**：它们不是文件素材，占比只量「真的截图/录屏/头像上屏多久」。
- 每个组件的素材字段用 `assetFields` 声明（`"src"` / `"video.src"` / `"boards[].src"` / `"pages[]"` 四种写法），管线据此自动拷贝文件、量宽高比、必要时 OCR 定位——组件里读 `data.aspect / data.kind / data.frames / data.focus` 就行，这些字段由管线填，别手写。允许哪些字段上屏由 schema 探测得出（`assetMeta` 可覆盖）。
- **真素材镜头必须写 `data.source`**（平台 / url / capturedAt / note 任选）。没写会警告「N 个镜头上了真素材但没写 data.source」——上了真东西却不标来源，等于白上。组件用 `src/lib/source.tsx` 的 `SourceBadge` 把它显示出来。

### 采集清单：缺什么，一目了然

`--plan-only` / 渲染后都会打印，并写两份：任务目录 `public/jobs/<任务>/assets_todo.md`（一次性构建产物）+ **片目录根 `assets_todo.md`**（跟文案同级，跟着这条片走）。哪一镜、哪个组件、缺哪些字段、讲稿里点名的文件名是什么。只列「真会空着」的行（讲稿点名了文件却没找到，或这个组件的素材字段本来就必填——必填由 schema 探测得出）。博主照着这张表去截图/录屏，把文件放进 `<片目录>/assets/`，回来重跑就补齐。

### 素材台账：`assets/library.json`

按**原始文件路径**记账（不是 `public/jobs/…` 那种一次性副本名，靠任务目录里的 `assets.json` 对照表还原）：md5、宽高比、出镜历史（哪条片子、哪个组件、哪一镜）。命令：

| 命令 | 作用 |
|---|---|
| `node scripts/assets.mjs report` | 台账总览：多少张图、占比、只用过一次的老素材 |
| `node scripts/assets.mjs unused` | 从没上过屏 / 只上过一次的素材 |
| `node scripts/assets.mjs dup` | md5 重复（同一张图两个文件名） |
| `node scripts/assets.mjs check` | 台账里的文件还在不在 |
| `node scripts/assets.mjs record <timeline.json> [--video 名]` | 手工补记一条片子 |
| `node scripts/assets.mjs harvest <成片asr/timeline…>` | 把历史片子里用过的素材回填进台账 |

### 品牌库：`brands/library.json` + `public/brands/`

`brands/library.json` 是「文案里的叫法 → 真 svg 文件」的映射（35 个牌子，含中别名）。放文件：把官方 svg 存成 `public/brands/<file>`，然后

- `node scripts/brands.mjs sync` → 生成 `src/lib/brands.generated.ts`（**只包含文件真的存在的牌子**，缺文件的条目上屏会让 Remotion 报缺静态文件；0 字节/小于 120 字节的空文件不算 logo，会单独警告）
- `node scripts/brands.mjs check` / `missing` → 看哪些牌子还缺文件、文案里可能叫什么

组件（logo-wall / citation-strip / brand-quote-card）通过 `src/lib/brands.ts` 查这张表；查不到就退化成通用图标，绝不画假 logo。

## 组件资产库



- 全部组件、字段、适用场景：**`CATALOG.md`**（由 `node scripts/catalog.mjs` 从 registry 自动生成，不要手改）。
- **开场模板库**：
  - **技术类通用 6 招**（`tech-opening-01`~`06`，`src/openings/tech.tsx`）：按第一句话的手法选（慢慢放大做悬疑 / 出其不意按节奏变形 / 蒙版缩圈 / 身后飞标题 / 文字干货先出现 / 极简闪白），只改字段就能用。参考《开场手法素材》招数表。
  - **20 个按钩子类型的模板**（`op-t01`~`op-t20`，`src/openings/templates/`）：按文案第一句的钩子类型（反问/数字/反常识/痛点/悬念/点名/对比/警告/揭秘/倒计时/收益/结果先行/VS/清单/私信/稀缺/快讯/放大镜/打赌/故障打断）挑一个，只改字段。选型表在 `openings/TEMPLATES.md`，预览在 `openings/previews/op-t*.mp4`。
  - 同一个模板不要连着用；要大改就复制成专属开场。
- 目前 100 个正片组件（结构 10 / 信息图 28 / 概念隐喻 31 / 叙事场景 9 / 产品 11 / 截图录屏 11），另有 32 个开场（`src/openings/`，不计入）。**以 `node scripts/catalog.mjs` 生成的 CATALOG.md 为准**（这里的手写分类只是给个量感）。最新加入的两批：
  - **真标识**：logo-wall（品牌墙，牌子上过 `public/brands/` 的真 svg，查不到退成通用图标）、brand-quote-card（引用官方原话 + 真地址 + 采集时间，逐字打出来）。
  - **真凭据**：citation-strip（出处清单：真 url + 真日期 + 可选截图缩略，写不出地址的条目直接不收）、evidence-zoom（在真截图上圈一个点放大，坐标来自 OCR 或人量的，不猜）。
  - **真界面**：real-doc-scroll（长文档/表格逐页滚动 + 当前行高亮 + 进度轨）、screen-versus（两三张真结果并排，各自标来源与采集时间）。
  - **真人临场**：head-pip（满屏真截图/录屏 + 一角真人口播窗，REC 亮点闪）、photo-wall（真头像墙，没图的退成姓名首字并标「姓名占位」）、comment-wall 升级版（`video.src` 真封面、`comments[].src` 真头像、`count` 写截图里的真条数）。
  早期加入的通用组件：
  - **处境人设**：persona-scene（无脸剪影 + 工位/屏幕/两头跑，循环动作越转越快 + 时钟转深夜 + 台灯亮起 + 最后瘫倒）。共用 `src/lib/figure.tsx` 无脸人物骨架（关节角度驱动，可插值：stand/work/stare/slump/despair/proud/fall/dig/look/cheer/raise/handsUp/sit/reach/turn + gait 步态）。
  - **反转拍**：blame-strike（连环劈掉假因 → 真因砸下）、fork-paths（同一起点 → 岔路两种结局）、counter-example（正例 + 反例对照）。
  - **体量/危机**：pile-crush（堆成山 → 一板压扁）、unread-flood（未读轰炸 → AI 接手清零）、pit-trap（透视路面的坑 + 安全路线）、walled-garden（高墙花园）、safety-brake（紧急制动 / 保险丝）。
  - **账目/对比**：open-ledger（摊开算账：单账累加 / 双账对比）、spec-matrix（横评打勾表）、version-lanes（同话 N 版本）、tier-grid（分档格 + 红黄绿灯）、vet-card（鉴伪卡）、measure-ruler（拿尺子量一量）。
  - **时间/进程**：step-rail（底部步骤轨 / 进度条）、case-replay（事件回放，scale=hour/day/year 兼时间轴）、time-shards（捡碎时间）、time-ceiling（收入天花板）。
  - **隐喻**：teardown-lens（拆解透视）、reveal-cards（亮底牌）、lever-lift（杠杆 / 护城河）、race-lanes（同一起跑线赛跑）、painkiller（止痛药 vs 保健品）、ring-assembly（环形拼图，缺一环不成立）、spinner-reasoning（转圈即思考）、carry-or-dig（挑水 vs 挖井）、dusty-shelf（积灰货架）、mirror-reveal（AI 是镜子）、surface-vs-core（换皮不换骨）、one-fish-four-plates（一鱼多吃）。
  - **屏幕类**：ui-replica（无录屏时仿制界面：editor/terminal/timeline/chat 四预设 + 光标点击）、ab-audio-wave（双声波形盲测）。
  - 早期：untapped-potential（大材小用：很强的东西只用了 5%）、scope-shrink（目标缩小 → 成功率涨满，可带具体例子）。
  - 代码/产品动画三件套：file-launch（贴代码 → 改后缀 → 双击弹出成品）、bug-fix-loop（点不动 → F12 抓报错 → 甩给 AI → 整份覆盖修好）、drag-deploy（拖进托管虚线框 → 进度走满 → 吐出网址 → 手机电脑同时打开）。三者共用 `src/components/product/MiniApp.tsx` 小工具界面（标题/输入/按钮/结果行都走参数）。
  - flywheel（循环/正反馈/恶性循环）、domino-chain（连锁反应）。sword-forge 支持 `icon` 字段，可以把剑换成任意产品图标。
  - **共享工具**：`src/lib/bits.tsx`（StampBox 结论章 / Mark ✓✗? 标记 / hitShake 衰减抖动 / Pill 胶囊标签）。
- 预览：`npm run studio` → Gallery 文件夹；或 `node scripts/preview.mjs <id>` 出 4 个时刻的静帧拼图（`out/preview/`）；自定义数据用 `node scripts/qa/try.mjs <id> <data.json> [秒] [时刻]`。

## 扩展组件资产（组件不是固定的，缺什么就补什么）

**什么时候新建**：写分镜时某段内容用现有组件只能拿 narration/quote 凑，或者画面和台词意思对不上 —— 就新建一个组件，而不是将就。做完就成了永久资产，下个视频直接用。

**怎么做**：

1. 复制最接近的组件（如 `src/components/info/BulletCards.tsx`）到 `src/components/<layer>/Xxx.tsx`，layer：structure / info / story / product / metaphor / screen。
2. 导出一个 `CompDef`：`id`（kebab-case，唯一）、`name`、`layer`、`variants`、`minSec`/`maxSec`、`tags`、**`desc`（画面是什么）**、**`use`（什么内容用它，讲语义）**、`schema`（zod，字段用 `.describe()` 写中文说明）、`example`、`C`；可选 `panel: true`（能放口播侧栏）、`hideCaptions: true`（画面即台词）。
3. 规范（review 时逐条检查）：
   - 颜色只用 `useTheme()`：`t.primary / secondary / accent / text / dim / bg / bg2 / glass / bad / gold`，不写死色值（写死的颜色换皮肤就错了）。
   - 尺寸用 `useBox()`，不要写死 1920×1080；要进侧栏就处理 `width < 900` 的紧凑布局并设 `panel: true`。
   - 时间：每个“出现/变化”给一个 `at` 类字段（schema 里 `z.number().optional()`，组件收到的是帧），缺省时用 `cueOr` / `listCues`（`src/lib/cue.ts`）自动错开。不要用写死的帧号排整段动画。
   - 音效：`<Sfx name="pop" at={cue} volume={0.3} />`，名字见 `src/lib/sfx.tsx`；音量 0.2~0.45；不要循环音效（会盖住人声）。
   - 文字：长文本用 `fitFont` 缩字号 + `whiteSpace: "nowrap"`；中文按 1em、英文数字按 0.58em 估宽。
   - 安全区：顶部 90px 是 HUD，**底部 y≥935 是逐字字幕带（1080 高时字幕条占 940~1028），任何元素的最下沿都要停在 935 以上** —— 别只盯着「容器的 top」，一个 `top: height-250` 的块里叠三行文字就已经压进去了；贴底边摆的东西（读数、批注、地平线、结论句）一律按「块顶 + 块高 ≤ height-145」算。标题用 `Heading`（自适应 Headline）。
   - SVG 里水平/垂直直线加发光时用 `<GlowDefs user />`（否则 bbox 高度为 0，线会消失）。
4. 在 `src/components/registry.ts` 注册。
5. `node scripts/preview.mjs <id>` 看静帧，溢出/重叠/太空都要修到满意。注意：静帧拼图里**不画逐字字幕**，字幕带那条冲突肉眼看不见，得按上一条的算法自己核一遍。
6. `node scripts/catalog.mjs` 重新生成 CATALOG.md。
7. 可选：在 `scripts/lib/detect.mjs` 加检测器，让自动模式也能选到它。
8. 新图标加在 `src/lib/icons.tsx`；新音效放 `public/sfx/<name>.wav` 并在 `src/lib/sfx.tsx` 的 `SFX` 表登记时长（帧）。

**不知道加什么的时候，去别人的动画里挖**：`docs/OPUS55_ANIMATIONS.md` 是移植台账，**两个来源分开记**：
- **一、** `awesome-opus5-5-videos`（MIT）——那仓库**只有 prompt 没有代码**，所以这一路的「移植」是把别人描述的机制参数化成我们的组件。已移植 9 条（flood 转场、screen-morph、cursor-trace、infinite-zoom、scale-dive、fill-build、inplace-evolve、reward-beat、typo-arch）都标了 slug 和 @author，待移植的按 P1/P2/P3 排好了，还有一份「一条镜头只讲一件事、最后一个画面 = 下一个画面的起点、能不切就不切」这类通用原则。
- **一·b、** `tuzhechen2005/opus-video-skills`（MIT © tuzhechen2005，部分文件双版权 © John Heibel）——**这一路是 Opus 写好的真代码**，已移植：全片后期层（`src/engine/PostPass.tsx`）+ 形状连续转场 zoom/push/wipe/grid（`src/engine/ShotFrame.tsx`）。每帧是时间的纯函数、无头 Chrome 逐帧渲染，和我们是同一套约束，所以机制能直接对译。

要新增组件先去看这张表，别从空白开始想；移植完回来把表更新（勾掉 + 写组件 id/落地位置 + 出处）。**外部仓库只读不入库**：临时目录里 clone 来看，别把它拷进 skill 或 git。

## 音效

实际音效只有 `public/sfx/*.wav` 这 15 个（`scripts/gen_sfx.py` 程序合成，无版权问题；旧文档里的 `assets/sfx/*.mp3` 语义化音效和“组件专属映射表”并不存在，已作废）：

| 名字 | 帧 | 适合 |
|---|---|---|
| impact | 30 | 开场第一帧、砸字（“咚”） |
| ding | 40 | 强调词、结论点亮 |
| stamp | 14 | 盖章、否定 |
| whoosh / swish / swipe | 20 / 10 / 8 | 转场、飞入、划走 |
| pop / click / tick | 8 / 5 / 4 | 元素弹出、按钮、计数 |
| riser | 50 | 悬念铺垫（放在揭晓前） |
| glitch | 12 | 故障、反转 |
| typing / bubbles | 40 / 45 | 打字、聊天气泡 |
| sparkle / success | 30 / 30 | 完成、好结果 |

换成自己的素材：同名覆盖即可。音量：人声响度统一到 -16 LUFS，BGM 0.14（约 -17 dB，规范 -12~-18 dB），音效 0.2~0.55。转场音效自动加（fly/warp/zoom → whoosh，iris/push/wipe → swish，glitch/grid → glitch，flood → impact，音量 0.16）；组件内部音效在各组件里声明。`--no-sfx` 全关。

## 命令

| 命令 | 作用 |
|---|---|
| `node scripts/new-video.mjs <片名> [ascii-id]` | 建这条片的独立项目目录 + 专属开场骨架（见「一条视频 = 一个独立项目目录」） |
| `node scripts/make.mjs in.json` | 出片（默认落 `<片目录>/out/<名>_seed<N>.mp4`，历史示例仍落 `ROOT/out`；`--out` 指定） |
| `--beats` | 只生成节拍表 `beats.md` |
| `--plan-only` | 只分镜 + 校验，打印镜头表 |
| `--stills` | 每个镜头渲一张静帧拼图 |
| `--frames 0-900` | 只渲一段（配合 `--out`）；试渲染，不写用量台账 |
| `--video 片名` / `--dry-run` / `--no-usage-check` | 改台账里的片子身份 / 全流程但不落账 / 连跨片检查一起跳过 |
| `--seed N` / `--no-sfx` / `--concurrency 16` / `--asr-model medium` | 换风格 / 关音效 / 并发 / 识别模型 |
| `--allow-missing-assets` | 草稿：讲稿点名的素材文件缺失时不硬失败，渲染占位并记进采集清单 |
| `node scripts/pick.mjs "语义"` | 组件吻合度，带每行的用量标注 |
| `node scripts/pick.mjs --storyboard <f>` | 逐镜体检：该新增组件的位置 + 本片首次使用组件数 |
| `node scripts/pick.mjs --fresh ["语义"]` / `--recent [--n 3]` / `--avoid a,b` | 只在没上片的组件里选 / 看近几条片用了什么 / 排除指定组件 |
| `node scripts/usage.mjs report / unused / list / recent` | 用量台账：覆盖率、高频、从未上片的池子 |
| `node scripts/usage.mjs backfill [路径…]` / `record <timeline.json>` | 历史分镜回填建库 / 手工补记一条片子 |
| `node scripts/brands.mjs sync / check / missing` | 品牌库：生成组件用的映射 / 校验 / 看还缺哪些 logo（详见「真实素材」） |
| `node scripts/preview.mjs <id>[,<id>]` | 组件静帧 QA |
| `node scripts/qa/transitions.mjs [kinds] [偏移]` | 转场 + 全片后期层 QA：出边界拼图 + 开/关后期的像素均差（稳定帧/首帧须为 0） |
| `node scripts/catalog.mjs` | 重新生成 CATALOG.md |
| `node scripts/openings.mjs sync / list / metric / status / preview` | 开场库：登记、看数据、录数据、保留/淘汰、出 5 秒预览 |
| `python scripts/gen_sfx.py` | 重新生成音效库 |
| `python scripts/asr_words.py <音视频> <out.json> [small]` | 单独提取词级时间轴 |
| `node scripts/qa/sync_check.mjs <文案> <成片asr.json> <timeline.json>` | 成片音画同步检查（配合 asr_words.py） |
| `npm run studio` | Remotion Studio（Gallery 看每个组件） |

## 失败时

所有错误以 `✖ 失败 [错误码]` 输出并以非 0 退出；`⚠` 是警告，不影响出片。

| 错误码 | 含义 / 处理 |
|---|---|
| E_ARGS / E_INPUT / E_JSON | 参数、输入文件、JSON 格式问题 |
| E_EMPTY / E_SCRIPT_FILE | 没有文案，或 script_file 找不到 |
| E_AUDIO / E_TIMELINE | 配音或时间轴文件不存在 / 格式不对 |
| E_TIMELINE_EXTRACT | 自动识别失败：`pip install faster-whisper` |
| E_ASSET | 口播视频、截图等素材找不到或 ffmpeg 处理失败。只想先看分镜：`--allow-missing-assets` 降级（正式出片别带这个跑） |
| E_STORYBOARD | 分镜问题：锚点在文案里找不到、口播段里放了别的组件、数据不符合 schema（会逐条列出） |
| E_CODE_FENCE | 代码块 ``` 没闭合 |
| E_DEPS | 缺依赖：`npm install` |
| E_RENDER | 渲染失败；时间轴已保存在 `public/jobs/<任务>/timeline.json`，可 `npm run studio` 排查 |

## 目录

```
scripts/make.mjs            入口：准备素材 → 对齐 → 分镜 → 校验 → 渲染
scripts/lib/align.mjs       文案↔ASR 逐字对齐、句子节拍、字幕断行
scripts/lib/script.mjs      文案解析（章节 / 口播 / 截图 / 素材槽位 / 备注）
scripts/lib/timed.mjs       时间轴驱动分镜：分段、锚点、字幕、音轨
scripts/lib/planner.mjs     无配音时的估算草稿模式 + 风格（seed）
scripts/lib/detect.mjs      自动模式的内容检测器 + 素材槽位表（SLOT_SPEC：[logo:] [出处:] …→ 组件与 data）
scripts/lib/registry-node.mjs  在 Node 里加载组件库做 schema 校验
scripts/lib/assets.mjs      素材台账读写：占比、采集清单、按原始路径记账
scripts/assets.mjs          素材台账命令（report / unused / dup / check / record / harvest）
scripts/new-video.mjs       一条片的独立项目目录脚手架（建目录 + 生成并登记专属开场骨架）
scripts/brands.mjs          品牌库命令（sync / check / missing）
src/components/…            组件资产（registry.ts 注册）
src/lib/asset.tsx           素材路径解析 + MissingAsset 缺素材占位
src/lib/source.tsx          sourceSchema / SourceBadge：真素材的来源角标（平台 · 日期 · 地址）
src/lib/brands.ts           文案叫法 → 真 logo（查 brands.generated.ts）
src/openings/<日期-主题>/    每条视频的专属开场（index.ts 注册）
src/openings/tech.tsx       技术类通用开场模板（6 招）
src/openings/templates/     按时长分组的预制开场（t01-t20.tsx）
src/lib/cine/               开场电影感工具包（砸字、闪白、抖动、推镜头…）
openings/library.json       开场库：钩子、手法、预览、数据、保留/淘汰
usage/library.json          正片组件用量台账：每条片用了什么、入场用过哪几种
assets/library.json         素材台账：每张真素材的尺寸/md5/上过哪条片哪一镜 + 素材占比规则（minRatio）
brands/library.json         品牌库：文案叫法 → public/brands/ 里的真 logo 文件
public/brands/              真 logo 文件（svg/png）；空文件不算，见 brands.mjs check
scripts/usage.mjs           用量台账命令（backfill / report / unused / recent）
scripts/openings.mjs        开场库命令
scripts/qa/transitions.mjs  转场 + 后期层的像素验证（出 out/qa/transitions.jpg 拼图 + 开/关后期均差）
src/engine/                 Video（音轨/镜头/字幕）、ShotFrame（转场）、PostPass（全片后期层）、Hud（字幕/章节）
src/lib/                    theme / box / cue / sfx / icons / ui / anim
CATALOG.md                  组件目录（自动生成）
docs/OPUS55_ANIMATIONS.md   外部动画移植台账：一、prompt 语料的机制移植；一·b、opus-video-skills 真代码移植（含 MIT + John Heibel 双版权署名）
examples/comment-mining/    完整示例：文案.md、storyboard.json、input.json、口播和配音
<工作区>/neurocast-<片名>/   不在这个目录里：每条视频自己的文案/素材/成片都在这里（见「一条视频 = 一个独立项目目录」）
_deprecated/                旧版不可用的脚本和文档（仅留档）
```
