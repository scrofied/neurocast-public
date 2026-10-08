# PRO 开场模板（5 个）· 口播开场五招

按《口播开场五招》做的高规格开场。它们原本是**独立资产**（只依赖 `remotion` / `react` / `zod`，不依赖 NeuroCast 引擎），
现在通过 `nc.tsx` 接成了引擎认识的 `CompDef`（`layer: "opening"`），所以在本 skill 里：**做每条视频时按第一句的钩子类型挑一个，再把文案 / 卡点 / 调色填进 `data`**。
模板自己会铺不透明舞台（底色 + 暗角 + 颗粒）并放自己的音效，因此**没有真人口播也能独立成立**；有口播就填 `person`。
横屏 1920×1080、竖屏 1080×1920 自适应，模板内部时间单位全部是**秒**。

| id | 招式 | 画面 | 适合的第一句 | 推荐时长 |
|---|---|---|---|---|
| `pro-01-dolly-suspense` | 第1招 慢慢放大+悬疑 | 从黑里推出，加速推近人脸，心跳越来越快、画面变暗变冷；悬疑句逐字浮现、答案用发光色块遮住；揭晓：上扬音戛然而止 → 闪白+咚+冲击环+火花，答案金属巨字砸出 + 扫光 | “让你一直穷的不是能力，是…” | 3.6s |
| `pro-02-shatter-morph` | 第2招 出其不意+按节奏变形 | 第一句砸在下方 → 转折词那一刻画面定格裂开、碎成几十块玻璃带着画面翻飞 → 重组成倾斜三竖条分屏（冷/人/热）+ 光缝，第二句砸上 | “你以为…其实…”“这不是 A，是 B” | 3.4s |
| `pro-03-iris-title` | 第3招 蒙版缩圈+主题 | 六片拉丝金属叶片的机械光圈一格一格咔哒收紧到人脸，HUD 刻度圈转动、f 值跳动；锁定：闪光+咚+叮，片名从中线向两侧展开；最后光圈猛地张开 | 系列片头 / “今天教你 XX 四步法” | 3.4s |
| `pro-04-depth-title` | 第4招 身后飞个大标题 + 抠像 + 副标题 | 人从原画面里“拎”出来缩小下沉，背景溶成虚化氛围；巨型标题从极远处呼啸飞入、落在**人身后**（轮廓光勾边）；副标题色条补位 | 观点 / 口号：“我劝你别再自嗨” | 3.2s |
| `pro-05-info-first` | 第5招 干货先行+闪白叮 | 透视网格上干货一条条全屏砸出（巨型序号、马克笔底），下一条来时上一条飞进侧边清单；全部落位后闪白+叮，斜切光刃劈开画面、真人入画 | “3 个方法”“不写代码、不装环境…” | 3.4s |

每个模板都能换 `look`（noir 黑金 / ice 冰蓝 / blood 血红 / neon 赛博 / acid 酸性 / paper 纸白）+ `palette` 覆盖单个颜色
→ **同一个模板换文案 + 换卡点 + 换调色就是一条新开场**（这是「可以挑模板」和「开场不能重样」之间的答案）。

## 在本 skill 里怎么用

写进这条片 `storyboard.json` 的顶层 `opening`（全片 TTS + 真人小窗的排法），或挂进口播镜头的 `data.opening`：

```json
{
  "opening": {
    "type": "pro-02-shatter-morph",
    "at": 0,
    "until": "其实",
    "data": {
      "look": "noir",
      "line1": "都说做号要日更",
      "line2": "其实一天十条也能做",
      "hl": "一天十条",
      "crackAt": "其实",
      "punchAt": "一天",
      "person": { "src": "assets/talk.mp4", "kind": "video", "audio": false, "focusX": 0.5, "focusY": 0.34 }
    }
  }
}
```

```bash
node scripts/opening-templates.mjs sheet <talk.mp4> pro-      # 5 个模板各出一张四时刻拼图（含第 0 帧）
node scripts/opening-templates.mjs video pro-03-iris-title    # 单个模板出 mp4 预览，落 openings/previews/
node scripts/openings.mjs list                                # 看池子 + 每个模板的推荐时长
node scripts/openings.mjs metric pro-02-… bounce2s=28% finish5s=61% plays=2100   # 发布后回填数据
node scripts/make.mjs <片目录>/input.json --frames 0-107 --out out/op.mp4         # 成片里逐帧验前 3.6 秒
```

**接线三件事**（`nc.tsx` 已经做了，改模板时别漏）：

1. **时长**：引擎传下来的是帧，模板要秒 → `duration = dur / fps`。开场本身是一个 `from…to` 的 `<Sequence>`，模板内部的第 0 秒就是开场第一帧。
2. **时基**：模板的 `xxxAt` / `at` 在分镜里写「相对开场开始的秒数」**或台词锚点字符串**（`"其实"`）。CompDef 上标了 `cueUnit: "sec"`，
   `timed.mjs` 对这些组件解析锚点后**不乘 fps**（别的组件都换算成帧）。写错成帧值（比如 72）会被 `--plan-only` 的时长检查抓到。
3. **素材**：`assetFields: ["person.src", "person.matte"]` → `person.src` 按片目录里的相对路径写（`assets/talk.mp4`），
   prepAssets 会把文件拷进 job 目录并把路径改写成 `jobs/<任务>/a0.mp4`。`audio` 在全片 TTS 时必须 `false`，否则模板里的原声和配音打架。
   路径规则：`kit/sfx.tsx` 的 `useAsset()` 默认给路径拼 `pro/`（模板自带的 `fonts/`、`sfx/` 在 `public/pro/` 下），
   所以 `jobs/`、`assets/`、`brands/`、`opening-assets/` 这四个开头被豁免、按整个 `public/` 根解析 —— 别把这条豁免删掉，否则真素材全 404。
4. **首帧**：模板自带的「开场闪白」已按本 skill 红线压到 `peak 0.3`（上游 0.55~0.7 会把第 0 帧洗成一张白纸）。

## 字段

所有模板共有：

| 字段 | 说明 |
|---|---|
| `look` / `palette` | 调色 / 覆盖颜色 `{ "accent": "#ff3355" }`（键：bg bg2 ink key accent danger gold dim） |
| `person` | 真人素材（可不填，不填就是纯图形开场）：`src`（片目录相对路径或 URL）、`kind` video/image、`start` 从素材第几秒开始、`focusX/focusY` 人脸中心（0~1）、`audio` 是否播原声（全片 TTS 时设 false）、`matte` 抠像前景（只有 04 用） |
| `sfx` / `sfxVol` | 模板自带音效（`public/pro/sfx/*.wav`）开关 / 总音量 |
| `grain` | 胶片颗粒 0~1 |

各模板专有字段（都有默认值，见各文件 schema 的 `.describe()`）：

- **01**：`kicker` 顶部小字 · `line` 悬疑句（用 `▇▇` 标出被遮住的答案位置）· `reveal` 答案 · `sub` · `revealAt` 揭晓 · `zoomTo`
- **02**：`line1` 以为的 · `line2` 真相 · `hl` 发光词 · `crackAt` 裂开（卡转折词）· `punchAt` 第二句砸出 · `tilt`
- **03**：`title` · `sub` · `tag` · `lockAt` 锁定 · `steps` 咔哒几格 · `irisMin` · `openAt`
- **04**：`lead` · `title`（≤6 字，`\n` 换行）· `sub` · `flyAt` · `subAt` · `outline` 空心字 · `titleY` · `fgScale` · `fgDrop`
- **05**：`title` · `points`（2~5 条）· `at` 第一条 · `gap` 每条间隔 · `personAt` 真人入画 · `side` left/right

**卡节奏**：所有 `xxxAt` 都是秒（或锚点）。拿口播的词级时间（`python scripts/asr_words.py talk.mp4 talk.json small`），
把揭晓 / 转折 / 每条干货的时刻填进去，画面就跟语音同步——这是这五个模板最值钱的地方。

## 真人相关的红线（照 SKILL.md，别改）

- 全屏真人只 ~2 秒：模板是**不透明层**，开场期间观众看到的是模板编排的画面；`presenter.full` 决定真人大屏什么时候收成小窗，两者分开调。
- 05 的 `personAt` 天然满足「文字干货先出、节奏对了再露脸」，是逐条清单型第一句的首选。
- 只有本片主播自己的口播能进 `person`；名人的姓名/称谓文字、形象图（含 Q 版、剪影）一概不上屏（平台审核驳回过两次）。

## 抠像（04 用，可选）

上游用 `python scripts/pro/matte.py in.mp4 out.matte.webm --start 0 --dur 4`（RVM 模型，CPU 4 秒素材约 25 秒，输出 VP9 + alpha）。
本仓库**没有带这个脚本和模型**：不给 `matte`，04 自动退化成「柔边人像窗 + 巨字压下半身」，照样能用。
实测（真人满屏 talk.mp4）：默认 `fgScale/fgDrop` 下人像窗还是太大，巨字横着压在脸上 —— 没抠像时把 `fgScale` 收到 `0.62~0.72`、`fgDrop` 给到 `0.16~0.22`，让字在人头顶上飞过。
要做真抠像再补 `scripts/pro/matte.py` + `models/rvm_mobilenetv3_fp32.onnx`（`.onnx` 已在 .gitignore）。

## 字体

模板用 `ProSans`（`public/pro/fonts/NotoSansSC-VF.ttf`，可变字重 100~900，OFL 授权，随包一起放进了 `public/pro/`）。
加载失败会自动退回系统的微软雅黑（`FontFace(...).catch(() => undefined)`），不会卡住渲染，但 900 字重的冲击感会打折——别删这个文件。

## 改 / 加模板

- 文件：`p0N-xxx.tsx` 一个模板一个文件；在 `index.ts` 的 `PRO_OPENINGS` 加一行，再放一个 `examples/<id>.json`；`nc.tsx` 的 `adapt()` 自动包装，无需改 `src/openings/index.ts`。
- 结构照抄现有模板：`schema = z.object({ ...common("默认调色"), 专有字段 }).prefault({})` → `C` 里 `useClock(duration)` 拿 `t`（秒）/`W`/`H`/`u`（1080 短边 = 1）→ `<ProRoot d={d}>{(L) => …}</ProRoot>`。
- 尺寸全部乘 `u`，位置用 `W`/`H` 比例，横竖屏都要看一眼。
- 颜色只用 look 里的 `L.bg / bg2 / ink / key / accent / danger / gold / dim`。
- 工具包 `kit/`：
  - `core.ts`：缓动 `E.*`、`shake` 抖动、`punch` 推镜冲击、`pulses` 心跳包络、`fitSize` / `wrap2` 排字、`noise` / `h1` 随机
  - `fx.tsx`：`Flash` 闪光、`Ring` 冲击环、`Sparks` 火花碎屑、`SpeedLines` 速度线、`LightLeak` 漏光、`Sweep` 扫光、`Dust` 浮尘、`Letterbox` 宽银幕、`Scrim` 压暗、`Vignette` / `Grain`
  - `type.tsx`：`Big` 大字、`Chars` 逐字（pop / drop / rise / blur）、`gradientInk` 金属渐变字、`extrude` 立体字、`Count` 计数
  - `stage.tsx`：`PersonMedia`（真人画面，`cam` 推镜 / `freeze` 定格 / `matte` 抠像层）、`Backdrop` 无真人背景、`ProRoot`
  - `sfx.tsx`：`<Sfx name="boom" at={秒} vol={0.6} />`，音效表 `PRO_SFX`
- 每个关键时刻都要「画面 + 音效」一起：落地 = boom（咚）+ 冲击环；强调 = ding（叮）；形态切换 = whip；揭晓前 1.5 秒放 swell（上扬音会戛然而止在揭晓点）。
- 第 0 帧必须有东西（大字 / 画面已在动），全程不要静止。**首帧闪白已按本 skill 的红线压过**：上游 01/02/03/04 的第 0 帧是 `peak 0.55~0.7` 的整屏白闪（缩略图/封面看就是一张白纸），这里统一改成 `len 0.18 / peak 0.3`，第 0 帧能看清人和字、余晖仍在。新增模板别再回到 0.7。
- 字不能压在人脸上：放下三分之一、两侧，或把人缩小 / 推开（04、05 的做法）。

## 目录

```
src/openings/pro/
  index.ts     PRO_OPENINGS 列表（5 个）
  types.ts     ProOpening 类型（duration 用秒）
  nc.tsx       → CompDef 适配层（引擎唯一入口，src/openings/index.ts 引它）
  p01-…p05-    5 个模板
  examples/    示例 data（独立调试用；在本 skill 里以 storyboard 为准）
  kit/         工具包（core / look / fx / type / stage / sfx）
public/pro/
  sfx/         15 个合成音效 wav
  fonts/       NotoSansSC-VF.ttf
  demo/        （没带：上游作者的个人口播样片，*.mp4 本来也不进仓库）
```
