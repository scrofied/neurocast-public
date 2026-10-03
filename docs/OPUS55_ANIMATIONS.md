# Opus 5.5 动画移植台账（prompt 语料 + 真代码仓库两个来源）

> 两个来源分开记：**一、** 来自只有 prompt 的 `awesome-opus5-5-videos`（机制由我们写成组件）；
> **一·b、** 来自 `tuzhechen2005/opus-video-skills` 的**现成代码**（后期层 + 形状连续转场，直接对译过来）。

来源仓库：<https://github.com/yihui-dev/awesome-opus5-5-videos>（MIT © 2026 yihui-dev，475 条 prompt）
本地克隆：`D:\temp\aop`（一次性，重拉：`git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 clone https://github.com/yihui-dev/awesome-opus5-5-videos D:/temp/aop`）

**这个仓库里只有 prompt，没有代码**（`prompts/<slug>.md` + `data/videos.json`，475 条，category 分布：motion 288 / interactive 70 / explainer 62 / 3d 55）。所以「下载到我的资产仓库」= 逐条判断机制能不能参数化成 NeuroCast 的镜头，能做的写成 `CompDef`，并把出处记在本文档。约 105 条是「秀操作 / 你是最棒的动效设计师」类元 prompt，无机制可提取，直接排除；同一 prompt 被多位创作者复用的按 slug 去重。

移植的每个组件在文件头注释里保留 `slug + @作者 + 原帖链接`，别删（出处即信任度）。

---

## 一、已移植（本仓库已接上线）

| 组件 id | 机制（上游 prompt 的核心一句） | slug / 作者 | 落地位置 |
|---|---|---|---|
| `flood`（转场） | 「一块黑色形状涨满全帧再收缩成下一个场景」，无淡出无剪切 | `twoclipping-496100` / @twoclipping | `src/engine/ShotFrame.tsx` + `scripts/lib/motion.mjs` |
| `screen-morph` | 「同一个元素换尺寸/圆角/颜色来换状态，内容永不交叉淡出；光标用真点击驱动；tab 指示器两条边各骑一个 spring；末帧=首帧」 | `verbove-268381` / @verbove | `src/components/screen/ScreenMorph.tsx` |
| `cursor-trace` | 「用鼠标移动 + 画笔一笔一笔把结论画出来」 | `ehsanik-162993` / @ehsanik | `src/components/screen/CursorTrace.tsx` |
| `infinite-zoom` | 「相机穿过物体（怀表/放大镜）的 glass 进入下一个世界，指数 zoom 才匀速感，末帧回首帧成环」 | `koldo2k-778767` / @koldo2k | `src/components/structure/InfiniteZoom.tsx` |
| `scale-dive` | 「从桌面一路钻到 CPU 里的原子，右侧一把尺全程跟尺度：1 米 → 2 纳米」 | `acoramaa-053577` / @acoramaa | `src/components/metaphor/ScaleDive.tsx` |
| `fill-build` | 「原料 + 计量随倒入进度逐条显示，空杯到成品的全过程」 | `ror-fly-880547` / @ror-fly | `src/components/info/FillBuild.tsx` |
| `inplace-evolve` | 「一颗死星球变成可呼吸星球：一个机位、不切镜」 | `rush3rx-342153` / @rush3rx | `src/components/info/InplaceEvolve.tsx` |
| `reward-beat` | 「待机→档位跃迁（配色随等级）→蓄力吸粒子→爆发屏震→数字滚动揭晓」 | `op7418-814408` / @op7418 | `src/components/info/RewardBeat.tsx` |
| `typo-arch` | 「每一行改变画面的结构；最后的宣言必须站在前面的字真实搭起来的地基上」 | `gdgtify-929495` / @gdgtify | `src/components/structure/TypoArch.tsx` |

组件是否真在库里，以 `node scripts/catalog.mjs` 生成的 CATALOG.md 为准（本文档只记出处）。

---

## 一·b、已移植 —— 真代码来源（tuzhechen2005/opus-video-skills）

来源仓库：<https://github.com/tuzhechen2005/opus-video-skills>。**这一份是 Opus 写好的真代码，不是 prompt**：
MIT © 2026 tuzhechen2005；其中 `skills/painted-animation/template/` 与 `skills/kinetic-reel/template/render.mjs`
（由它派生）© 2026 John Heibel —— 双版权写在仓库 LICENSE 里；方法论来自 PDoomVideo，上游 ClaudeAnimationBase 同为 MIT。
仓库自述：画面与音乐全部由代码程序化生成，不涉及任何图像/视频/音频模型产物，**每一帧是时间的纯函数**，
无头 Chrome 逐帧渲染后 ffmpeg 编码——和我们 Remotion 的约束是同一套，所以机制能直接对译。

取阅方式：只 clone 到临时目录读、比对，**没有把该仓库拷进 skill 或 git**（用户明确否决把外部工程混进资产库）。

| 移植项 | 上游写法（原片里怎么做的） | 我们的落地 | 为什么不一样 |
|---|---|---|---|
| 全片后期层 | `render.mjs` 的 GLSL post pass：`FX = {split, slice, seed, grain, vign, flash, flashCol}`。slice = `band=floor(uv.y*28+h(seed))` 让每条横带整体 `uv.x += (h(band,seed+2)-.5)*.16*slice`；split = 三通道 `texture2D(uv±d)` 取 r/g/b（`d=(split, split*.15)`）；grain = `(h(uv*res+time*61.7)-.5)*grain`；再暗角、闪白。**FX 由转场函数按拍点写值，稳定帧归零**；硬切那帧 `FX.flash=max(flash,.08)` | `src/engine/PostPass.tsx`：slice/split 换成等价 SVG 滤镜（`feTurbulence baseFrequency="0 28/H"` → `feFuncR discrete` 二值化出硬边条带 → `feDisplacementMap` 只沿 X 位移；三通道 `feColorMatrix` 隔离 + `feOffset ±split*W` + `feComposite arithmetic k2=1 k3=1` 相加），grain/vignette/scan/flash 用 DOM 覆盖层；`fxAt()` 按「换镜的 OVERLAP 帧」算 `sin(πk)` 包络，强度由 `meta.post` 调 | Remotion 是 DOM 合成，读不到「合成后的整帧纹理」，只能对子树挂滤镜。所以：① 滤镜只在峰值帧挂载（`postFilter()` 在 split/slice≈0 时返回 undefined，稳定帧零成本）；② HUD 与逐字字幕**不进**滤镜，否则卡拉OK字幕会被扯花 |
| `zoom` 转场（形状连续） | `trZoom(rect)`：A 侧 `translate(px,py) scale(s) translate(-cx,-cy)`，`s=pow(max(W/rw,H/rh), e)`、`e=ioExpo(k)`；B 侧 `drawImage` 后 `clip(rect)`，`globalAlpha=clamp(e*2.2-.2)`，同时 `FX.split=max(split,.008*sin(πe))` | `ShotFrame.tsx`：B 侧 `clipPath` 放大矩形 + 同一条 `zoomGeom()`；A 侧由 `nextTransition==="zoom"` 触发同一几何推进；洞的位置来自 `shot.through=[x,y,宽,高]`（归一化） | 原片用 bufA/bufB 离屏回读上一镜像素；我们镜头本来就重叠 12 帧，A/B 两侧用同一个 k 各算各的，不需要回读 |
| `push` 转场 | `trPush(dx,dy)`：A/B 同向平移 `ioExpo(k)`，峰值 `FX.split=.012*sin(πe)` | A/B 两侧 `translate`，方向取 `variant % 4`（右/下/左/上） | variant 兼职方向，不新增字段 |
| `wipe` 转场 | `trWipe`：`x=easeInOut(k)*(W+40)` 从左推过去，前缘一条 8px 强调色亮边 | B 侧 `clipPath` 0→x + 前缘亮边（`t.accent`），A 侧整幅停住当底 | 一致 |
| `grid` 转场 | `trGrid(16,9,color)`：格子按对角线顺序「先弹起强调色块，再被新画面顶替」两段式 | B 侧 data-URI SVG `mask-image` 逐格放开 + `GridPops` 前半拍色块，A 侧停住当底 | 无头 Chrome 对 HTML 元素引用 `<mask>` 支持不稳，改成 data-URI 蒙版 |

**没移植的**：`painted-animation` 那套水彩色卡（p5.js + p5.brush）。它要 p5 运行时和笔刷资产，与我们 DOM/CSS 逐帧纯函数管线冲突，收益只在美术风格，代价是整条渲染链改道。

验证：`node scripts/qa/transitions.mjs`（造一条排满转场的假时间轴，出 `out/qa/transitions.jpg` 拼图 + 「同一帧开后期 ↔ 关后期」的像素均差）。2026-10-04 实测：
`zoom +10 = 3.95`、`push +10 = 3.99`、`wipe +10 = 8.58`、`grid +10 = 5.98`（换镜帧确有撕裂/分离），
`grid 稳定帧 = 0`、`首帧 = 0`（稳定期和开场第 0 帧滤镜根本没挂载，画面干净——开场红线）。拼图里能直接看到
zoom 把上一镜放大穿出、wipe 的强调色前缘边、grid 的琥珀色方块逐格顶替上一镜。

---

## 二、值得做但还没做（下一次扩充的排队清单）

| 优先级 | 机制 | slug / 作者 | 卡在哪 |
|---|---|---|---|
| P1 | 数据镜头先拉真实 API 再可视化（禁编数） | `groundcontrol-230877` / @groundcontrol | 需要一条取数管线（fetch + 缓存 + 字段映射），不是组件问题 |
| P1 | 录屏回放上按拍子弹拟声词/批注大字 | `mappletour-334921` / @mappletour | 等 `--stills` 之外加「拍点」概念（beats.md 已有 id，可直接接） |
| P2 | 权重沿图边流动累积 | `stewchan2-369810` / @stewchan2 | 与现有 `neural`/`agents` 的 packet 流动重复度高，先不做 |
| P2 | 沙/水/火元胞物理涌现（个体规则 → 宏观现象） | `cyrilxbt-149036` / @cyrilXBT | 108k 粒子在 30fps 逐帧渲染下成本要实测 |
| P2 | 引力透镜：拖动质量、背景星光弯成弧/环 | `voxyz-ai-345550` / @voxyz_ai | 需要 shader 或逐帧三角函数场，先看 `field-warp` 的必要性 |
| P3 | 同一概念反复解释、每次换一种美术风格自指嵌套 | `emollick-019567` / @emollick | 低频，一次片的 1 个镜头，性价比低 |
| 不做 | 无限 zoom 穿真实拍摄街景（Blender 重建 1906 旧金山）、pagoda 漫游、Mona Lisa 临摹 | `alexalbert-274839` / `buildfastwithai-597035` / 其它 | 需要外部素材或一次性场景，不可参数化 |

---

## 三、要写进 SKILL.md 的通用原则（出处记在这里）

**来自 `verbove-268381`（@verbove，规则原文最完整）**

1. 一个形状，永不切镜（One shape, never cut）：每个状态是同一个元素换尺寸/圆角/颜色，内容替换。
2. 每帧只依赖 `t`：不写 CSS transition、不 setInterval、不跨帧携带状态。（管线侧对应：`useEnter` 是纯函数，每帧可截图。）
3. 内容在容器开始变形之后才进、下一次变形之前必须出，文字永不重叠。
4. 闭环 spring，只允许极小过冲；一个值多次改目标 = 每次变化叠加一个 spring。
5. tab / 指示器的两条边各骑一个 spring（前导边先拉伸）——这是「像真 UI」的关键。
6. 相机推近到每个状态铺满画面。
7. 黑色永远不要直接淡成强调色；让一个强调元素在状态之间「搬运」过去。
8. 末帧 = 首帧（可循环）。

**来自 `twoclipping-402193` / `twoclipping-496100`（@twoclipping）**

- 先渲「每拍一帧」的 contact sheet 检查拥挤，再全量渲（对应本管线：分镜阶段看 `--stills`）。
- 相机缩放的东西禁止 `will-change`，否则文字糊。
- 循环要连光标位置和速度一起复位。
- 120 BPM 网格：每拍必须有事发生；hold 不超过 1 秒。
- 负向清单（防 AI 味）：禁 crossfade、禁 blur-in、禁亮度「洗显」、禁 3D 翻转、禁无意义粒子、禁 shockwave rings / RGB split / lens flare / bouncy easing / 网格地板。

**来自 `koldo2k-778767`（@koldo2k）**

- 恒速感的无限缩放 = 指数 zoom，每段时长 ∝ log(zoom)。
- 视差层缩放用 `相机^Z`（Z 为层深度），不是线性加位移。
- 贴纸/拼贴类元素降到 15fps「拍二」更有手作感。
- 音乐按小节精确对齐时长。

**来自 `stokebuilder-356793`（@stokebuilder，50 段口播配动画的完整规范，中文知识视频几乎逐条适用）**

- 满屏动画时真人固定在角落 PiP，**不要**对摄像机做推近。
- 文案必须逐字忠于配音，**绝不编数字**。
- 每个图形卡在一段 uninterrupted 台词内；图形之间留几秒纯人脸。
- 先写共享 style bible + 组件 kit，再逐个做画面。
- 每件只评审一次，只回修「 egregious」的，不搞全量 redo 循环。

**来自 `astrothewizard-618782`（@astrothewizard）**

- 能真模拟就真模拟：随机游走要真是随机游走，不是画一个随机游走的样子；给真数字并对不确定度诚实。
- 质量靠验证回路：逐场景渲静帧并批判性回看、逐帧查转场、数值化测响度，修完再渲。交付的不是初稿。

**来自 `op7418-814408`（@op7418）**

- 高潮特效要克制：彩带/爆闪全片只放一次。
- 画布贴图分辨率 ≥ 显示尺寸的 1.5×。
- 循环补间（呼吸、抖动）在状态切换时先取消归零，别叠着换。

**来自 `parkerrex-701462`（@parkerrex）**

- 每帧是时间的纯函数，因此任意一帧都能单独截图检查——Remotion 天然满足，写组件时别偷用可变全局状态。
