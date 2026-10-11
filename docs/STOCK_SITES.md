# 免费素材站调研 + 接入方案

> 2026-10-11 实测。所有 HTTP 状态、图标条数都是在这台机器上 curl 真跑出来的，不是抄介绍页。
> 结论先说：**图标这一类可以立刻全自动接进来（零 key、零署名）**；图片/视频要嘛申请免费 key、
> 要嘛走 Mixkit 的页面直链；Unsplash 最麻烦（强制署名 + 必须热链），不建议当默认源。

## 一、这些站到底有什么

| 站点 | 有什么 | 能不能自动取 | 要 key | 署名 | 本机实测 |
|---|---|---|---|---|---|
| **Pexels** 图+视频 | 照片、插画、短视频（1080/4K 多档） | 搜索要 key；**图片 CDN 直链不用 key** | 搜索 API 要（免费，header 认证） | 不要求（license 只禁转卖原图、禁暗示代言） | `api.pexels.com` 无 key → 401「Missing API key」；`images.pexels.com/...w=1920` → **200，118KB** |
| **Pixabay** 图+视频 | 照片 / `illustration` / `vector` 三类可分筛，视频多档 | 全程要 key（query 参数） | 要（登录后页面直接显示，免费） | 法律上不要求；API 条款要求「标注来源」 | `pixabay.com/api/` 无 key → 400；`/api/docs` → 200 可读；官网页面 403（反爬） |
| **Unsplash** 图 | 照片（无视频、无图标） | 要 key，且**必须热链 + 必须回调 download_location** | 要（免费 50 req/h，可申请 1000） | **强制署名**（摄影师 + 回链），这是 API 使用合同的硬性条款 | `api.unsplash.com` 无 token → 401；`source.unsplash.com` → **503，服务已死**（老热链写法全部作废） |
| **Mixkit** 视频/模板/音乐/音效 | 短视频、AE/DaVinci 模板、音乐、SFX | **无 API**，但列表页 HTML 里直接嵌着 mp4 直链 → 爬页取链即可 | 不要 | 不要求 | `mixkit.co/free-stock-video/technology/` → 200，页面里抓到 `assets.mixkit.co/videos/46635/46635-720.mp4`；该直链 `-r 0-100000` → **206 可分段下载**（1080 档同样可取） |
| **SVG Silh**（截图里的 "svgilh"）| CC0 的 SVG 剪影/图标/插画 | 直链 `svgsilh.com/svg/{id}.svg` 可用；**但搜索页要爬**（`/search.html` → 404，得从列表页抓 id） | 不要 | 不要（全站 CC0） | 首页 200，`/svg/1299642.svg` → **200，8.1KB 真 SVG** |
| **Flaticon**（截图里 flaticon + flaticons 两个）| 巨量图标包 | 官方 API 存在但文档站被 Cloudflare 挡；**免费档不给 SVG，只给 PNG，且必须写「Designed by Flaticon」** | 要（注册） | **要** | `flaticon.com` → 403；`flaticons.net`（Icons8 家）→ 200，无 API，页面要求回链 |
| **Pictogram2**（截图里的 "pictogram2"，是真实站名，不是 OCR 错）| 日语站，运动/人形 pictogram | 无 API，人工下载 | 不要 | 用可以，**不许把原文件再分发/卖** | `pictogram2.com` → 200 |
| **SVGRepo** | SVG/PNG/EPS，免登录 | 无官方 API，站点 429 + CF 质询 | 不要 | 逐个图标 license 不同 | 429/CF 挡 → 不适合自动抓 |

**调研时顺手验出来的两个更好的图标来源**（都在截图之外，但对「必须用真身、不能手绘」这条红线是直接解药）：

| 来源 | 内容 | 取法 | license |
|---|---|---|---|
| **Iconify 合集包**（`@iconify-json/lucide｜tabler｜mdi｜ph｜solar`）| lucide **1942** 个、tabler **6286**、mdi **7638** 个矢量图标，SVG 里写 `currentColor` → 一行字符串替换就能染成主题色 | `https://cdn.jsdelivr.net/npm/@iconify-json/<集>@latest/icons.json` 一次拿全（lucide 615KB / tabler 2.1MB / mdi 3.1MB），**无 key、无署名** | ISC / MIT |
| **Simple Icons** | 3307 个品牌/产品官方单色 logo，索引里带官方 hex 色值 | `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/<slug>.svg`，**无 key**；SVG 本身 CC0（logo 仍是商标，只能如实指代） | CC0 |

> ⚠ 实测坑：**官方 `cdn.simpleicons.org` 和 npm 包内容不同步** —— `openai`、`canva` 在官方 CDN 上 404，
> 在 jsdelivr 的 npm 包里有；反过来 `deepseek`、`cursor`、`dify` 是 CDN 有、我下到的索引版本没有。
> 所以抓取源固定用 **jsdelivr 的 npm 包**（索引和文件同源，不会错位），别用官方 CDN。

## 二、这条能力接进来能直接解决什么

1. **`brands/library.json` 里 35 个牌子，`public/brands/` 只有 1 个文件（claude.svg）。**
   剩下 34 个牌子（chatgpt / gemini / deepseek / cursor / figma / notion / wechat / douyin / bilibili / youtube /
   github / huggingface / n8n / dify / taobao / meituan / twitter…）在 `brands.mjs sync` 时全被判定「文件不存在」
   而剔出组件 —— 所以现在片子里提到这些牌子只能退成通用线条图标，正是用户打回过的那种「手绘替代」。
   用 Simple Icons 补齐实测可命中 **18/35**（`chatgpt→openai`、`gemini→googlegemini`、`douyin→tiktok`、`twitter→x`、
   `feishu→bytedance` 这类改名/合并的要显式映射）；补不齐的（qoder / workbuddy / motionface / 剪映 / 语雀 / 飞书 /
   WPS / 京东 / Midjourney / remotion）只能官网抓或人工放文件。
2. **MG 动画里的图标不再靠手绘**：现在 `src/lib/icons.tsx` 只有 44 个手绘 stroke 图标，全靠改名复用。
   接 Iconify 合集 = 一次性拿到几千个风格统一、可染色的矢量图标，离线缓存在本地，渲染不联网。
3. **空镜/氛围镜头有真画面**：讲「打工人对着屏幕」这类抽象段落，现在只能画代码动画；
   接 Mixkit/Pexels 后有真视频垫底，且 >2.5s 无变化的「空窗」问题多了一个解法。

## 三、必须守住的三条红线（不写清楚就会翻车的地方）

1. **库存 B-roll 不能顶替真实证据。** 讲操作步骤、讲数据、引用大模型回复的段落，必须用真截图/真录屏
   （v3 就是拿氛围镜头冒充真实界面被打回的）。所以 `screen / evidence-zoom / real-doc-scroll / board-proof /
   citation-strip / ui-replica / brand-quote-card` 这些「证据类」槽位一旦拿到 `stock` 素材，`--plan-only` 要直接报错。
2. **库存素材不计入「素材占比 ≥20%」。** 那个指标的意义是「真东西够不够多」，让 Pexels 氛围镜头也能刷分的话，
   指标就废了。台账里给每条素材打 `stock` 标记，`ratioOf` 只数非 stock。
3. **库存素材上屏，角标文案必须换。** `SourceBadge` 原来写死「真实素材 | 平台 | 采集时间」，
   库存画面套这个 = 用氛围镜头冒充证据。现在按 `source.kind` 分两条线：`stock` 渲染成「示意画面 · Pexels/@作者」
   （灰字虚线、不给「采集」时间、不带发光），`real` 才是原来那枚。需要署名的（Flaticon/Unsplash）就把作者名带上。
   另外沿用既有红线：**真人形象/真人姓名的素材一律不上屏**（平台审核连驳两次），库存视频里带清晰正脸说话人的也别用。

## 四、落地实现（2026-10-11 已接完，改动尽量小、全走既有管线）

素材一旦落到 `public/assets/stock/…`，`make.mjs` 的 `prepAssets` 就会照常拷贝进 job、量宽高比、写
`assets.json` 对照表、进 `assets/library.json` 台账 —— **渲染层零改动**。实际接进来的就这四块：

1. **`scripts/stock.mjs`（新）** —— 实际命令面：
   - `sites` → 站点能力 + license + 是否必须署名（就是本文第一张表的机器版）
   - `search <站> <关键词> [--type video] [--n 12] [--landscape] [--min 1920]` → 列表 + 缩略图，**只列不下载**
   - `get <站:id | 直链> [--res 1080] [--as 名字]` → 下载到 `public/assets/stock/<站>/`，出处（站点/页面/作者/license/是否署名/尺寸/时长/md5）写进 `assets/stock-index.json`
   - `icons <合集> <名字…> [--color HEX]` → 从 Iconify 合集抽 SVG 存 `public/assets/icons/`（一次缓存，之后离线用），出处写 `assets/icons-index.json`
   - `brands [--only-missing] [--dry]` → 用 Simple Icons 按 `brands/library.json` 补齐 `public/brands/` 缺的官方 logo
   - `license [关键词]` → 出片前核对某条素材的署名义务
   - **key 只从环境变量读**（`PEXELS_API_KEY` / `PIXABAY_API_KEY` / `UNSPLASH_ACCESS_KEY`），或仓库外的 `~/.neurocast/stock.env`；
     脚本任何输出都不回显 key，下载物不进 git。没 key 时 Mixkit / Iconify / Simple Icons 这些零 key 源照常用。
2. **台账字段**：`assets/library.json` 里库存素材带 `stock: { site, page, author, license, attribution }`（出处从 `stock-index.json` 查，
   判据是路径落在 `assets/stock/…` 或 `assets/icons/…`）；`ratioOf` 把库存单独算一路，`assets.mjs check` / `make.mjs --plan-only` 都打
   「库存素材（示意画面）：N 镜 · X 秒 · Y 个文件 —— 不计进占比」。
3. **新组件 `stock-broll`**：库存视频/静帧当氛围垫底，`layout: full/card/split`、静帧 `move: push/pan/still`、
   素材比镜头短自动慢放铺满（最低 0.6 倍）、长则裁掉尾巴；压暗 + 主题色渐变落地，右下角永远是 `SourceBadge` 的「示意画面」画法。
   `make.mjs` 出分镜时按 `stock-index.json` **自动**把出处补进 `data.source`（打印「库存素材自动署名：N 处」），分镜忘了写也不会漏署名。
4. **`SKILL.md` 新增一节「库存素材（示意画面）」**：三条口径 + 命令表 + `E_STOCK` 错误码 + 目录条目，和「真实素材」那节同级。
   （`icon-strip` / `icon-badge` 这类「真图标进 MG 动画」的专用组件没做 —— 图标现在是普通文件素材，
   任何带 `src` 字段的组件（`logo-wall` / `side-brand-fx` / `stock-broll`）都能直接吃 `assets/icons/*.svg`，等真需要成排展示的动效再补。）

## 五、已定的三条口径（用户 2026-10-11 拍板，全部按建议执行）

1. **库存素材不计入素材占比 ≥20%** —— 占比只量真东西。
2. **库存画面右下角强制渲染「示意画面 · 站点/@作者」**，不复用「真实素材」字样（配色/边框也和 real 角标分开）。
3. **证据类槽位出现库存素材 → `--plan-only` 直接 `E_STOCK` 报错**，不给过。证据名单见 `make.mjs` 的 `EVIDENCE_TYPES`
   （含 `photo-wall`：它底部写着「真头像 n/n」，塞库存人像 = 拿假人冒充真人）。

key 的处理：先做零 key 那批（Mixkit 视频 + Iconify 图标 + Simple Icons logo），Pexels / Pixabay 的免费 key 同时配上，
但**只放在仓库外的 `~/.neurocast/stock.env`**，不进 git、不进日志、不回显。

## 六、验证过的证据（本机实跑）

| 检查 | 结果 |
|---|---|
| 库存素材冒充证据 | `s11 screen ← assets/stock/pexels/test-ai.mp4` → `✖ 失败 [E_STOCK]`；`photo-wall` 里的库存视频和 `assets/icons/tabler-brain.svg` 各算一处 |
| 库存不计占比 | 同一片：`素材占比 15.1%（4/27 镜）` + 单列 `库存素材（示意画面）：1 镜 · 8 秒 · 1 个文件` |
| 自动署名 | 分镜里 `stock-broll` 不写 `source` → `timeline.json` 落 `source: { kind: "stock", platform: "Pexels", author: "cottonbro studio", url: "…/6153734/" }`，日志「库存素材自动署名：1 处」 |
| 角标文案 | 静帧实拍：右下角「示意画面 \| Pexels · cottonbro studio · pexels.com/video/6153734/」，虚线灰框、无「采集」字样 |
| 三种版式 | `full`（铺满 + 居中大字）/ `card`（居中开窗）/ `split`（右块 + 左大字，标题按左半宽度自动缩）各出一张 QA 拼图核对 |
| 管线 | `tsc --noEmit` 干净；`catalog.mjs` 149 组件；`motion-audit.mjs` `✓ stock-broll` |
