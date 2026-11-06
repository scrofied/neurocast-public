# OASIS 代码动画方法论（赛博朋克 /《头号玩家》）

参考工程：`D:\qord\.qoder\live\svb`（Opus 生成，Remotion + React + Three.js，174.2 秒 / 18 个场景）。
本文只记录**可复用的做法**，不是把 18 个场景原样搬进 neurocast。目标：让下一个模型看到「赛博朋克 / OASIS」时，知道该先写什么、再怎么把它写成代码。

## 一、为什么它看起来不像模板

不是某个特效厉害，而是五层东西一起成立：

| 层 | 内容 | 作用 |
|---|---|---|
| 1. 世界层 | `Sky` + `NeonGrid` + `Skyline` + `Dust` | 全片同一个 3D 空间，镜头怎么走都不穿帮 |
| 2. 相机层 | `Stage3D` + `camKeys` + `CameraRig` | 真实透视、飞行、环绕、俯冲；背景不是平移贴图 |
| 3. 道具层 | `BotCube` / `DocSheet` / `GlowRing` / `Beam` / `Coins` / `NeonLine` | 把抽象概念变成可触摸的 3D 物件 |
| 4. HUD 层 | `HudBox` / `HoloMedia` / `ItemCard` / `Achievement` / `Callout` | 信息解释、真实素材、数据读数；始终在 3D 之上 |
| 5. 全片层 | `Chrome` + `Fx` + `Captions` | 游戏身份、章节、XP、故障/闪白/抖动、字幕 |

再加上一条叙事主线：**Skill = 普通掉落物（可复制说明书），Bot = 传说级黑盒方块（按月产出金币）**。所有画面都在服务这个隐喻，所以风格再花也不散。

## 二、背景到底是怎么做的

### 1. NeonGrid：程序化霓虹地面

`src/three/World.tsx` 的 `NeonGrid` 不是一张网格贴图，是 `ShaderMaterial`：

- `fwidth` 求屏幕导数，让网格线在任何距离都保持 1px 左右，不会远看糊、近看粗；
- 两层网格：细格 + 四倍格，四倍格更亮；
- `uScroll` 让网格朝镜头滚动；
- `uPulse` 是一道从相机位置向外扩散的波，命中时 `uColor2` 提亮，用来配合「冲击/落地」；
- 远处按 `fogDist` 混到地平线颜色，地面自然消失。

### 2. Sky：地平线光污染

`Sky` 是一个 `BackSide` 球体，fragment 里用：

```glsl
vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.45, h));
col += uGlow * exp(-abs(h - 0.01) * 22.0) * uGlowAmt;
```

`h` 是视线方向的 y。地平线附近叠两道指数衰减的辉光，就会得到粉紫/青色的「城市光污染」。这比放一张渐变背景更有空间感，因为球体跟着相机，镜头转也不会露边。

### 3. Skyline：一次 draw call 的赛博巨城

`Skyline` 是 260 个 `InstancedMesh` 立方体，每个楼用 shader 程序化生成：

- `edge`：用 `fwidth(vUv)` 算楼体边缘亮线；
- `win`：把 UV 乘上楼体缩放，取 `floor` 得到窗格，`step` 出亮窗；
- `on`：用 `sin(dot(cell, ...))` 哈希决定哪扇窗亮，亮窗比例约 28%；
- `top`：楼顶再叠一条亮边；
- `vDepth`：远处混入雾色。

**关键坑**：楼不能离相机太近。svb 的城市环半径 160、中心在相机前方；如果环中心离相机太近，会有一栋楼贴在镜头前，把半个画面盖成黑墙（实测过：画面左侧 768px 全黑，只剩楼边缘的青色块）。规则：**所有楼必须在相机前方 ≥ 80 单位，环中心 z 要在相机 z 的 -200 以下**。

### 4. Dust：空气中的尘埃

`Dust` 是 `THREE.Points` + 自定义 shader：

- 每个点有随机相位，位置用 `sin/cos` 缓慢漂移；
- `gl_PointSize` 按距离衰减；
- `AdditiveBlending`，片元做一个软圆；
- 数量 1200~1400 就够，不要上万。

### 5. 后期：Bloom / 色差 / 暗角

svb 的 `Stage3D` 用 `postprocessing` 的 `EffectComposer`：

- `BloomEffect`：让霓虹和高光真的“发光”；
- `VignetteEffect`：压暗四周，把注意力收回中心；
- `ChromaticAberrationEffect`：轻微 RGB 色差，增加镜头质感。

neurocast 阶段 B 已接 `postprocessing` 的 Bloom / Chromatic Aberration / Vignette；没有 Bloom 时，靠高亮自发光材质和 Shader 的亮边也能成立，但“梦幻感”会少一截。

## 三、相机：所有高级感的一半

`camKeys(t, keys, roll)` 是一组 `[时间, 相机位置, 看向点, fov]` 关键帧，段间用 `easeInOutCubic`：

```ts
const cam = camKeys(t, [
  [A,    [7.5, 3.0, 9.5], [0, 1.6, 0], 46],
  [PREC, [5, 3.4, 10],    [-0.5, 1.8, 0], 44],
  [DATA, [3.5, 4.2, 11.5],[-2.8, 2.0, -1], 46],
  [B,    [4.5, 5.5, 13.5],[1.5, 1.6, 0], 48],
]);
```

常用机位语言：

| 机位 | 用途 | 写法 |
|---|---|---|
| fly-in | 开场、进新地图 | 从远处 `z=52` 高速推到 `z=9`，FOV 58→44 |
| orbit | 看一个立体物 | 半径 4~9 绕目标，`sin/cos` 每帧推进 |
| push | 强调一个判断 | 位置缓慢靠近，look 不变 |
| whip | 两个对象对峙 | 0.2~0.3 秒内从 A 机位甩到 B，配 `whoosh` |
| top-down | 看全城/全平台 | 相机 y 14~18，look y=0 |
| dive | 进入物体/转场 | 镜头推到物体表面，FOV 拉到 70+，接闪白 |
| low-angle | 威压/巨物 | 相机 y 1~2，look 抬高 |

**每个场景至少有一个连续运动的相机**。没有相机运动，再好的背景也像一张壁纸。

## 四、3D 道具：把概念变成物件

| 物件 | 语义 | 关键做法 |
|---|---|---|
| `BotCube` | 黑盒 Bot / 数字资产 | 自定义 shader：fresnel 边缘光 + 接缝 + 电路纹 + 扫描线；外面再叠 `GlowEdges` 立方体边框 |
| `DocSheet` | Skill / 说明书 / 可复制物 | canvas 画一张文档纹理，贴到 plane；多个副本用 `InstancedMesh` |
| `GlowRing` | 能量环 / 护城河 / 冲击波 | `torusGeometry` + `MeshBasicMaterial`，颜色乘 intensity |
| `Pad` | 平台/落点 | 六边形底座 + 两层光环 |
| `Crystal` | 核心资产/数据 | 内层实心 icosa + 外层 wireframe icosa，反向旋转 |
| `Beam` | 金色光柱/价值喷发 | 透明圆柱 shader，核心 + 纵向流动 |
| `Coins` | 收入/掉落 | `InstancedMesh` 圆柱，`fountain()` 给弹道 |
| `NeonBox/Line` | 城墙/连接/管线 | 纯发光 box 或两点之间的细长 box |
| `CubeSwarm` | 克隆块/城市/平台砖 | 自定义 instanced shader，一次画上千块 |

**不要从网上下 3D 模型。** OASIS 的高级感来自「几何体 + 发光边 + 程序化纹理」，不是模型精度。

## 五、HUD：信息解释的另一半

### 1. 三种主力容器

- `HudBox`：带 header、四角括号、扫描线的面板；打开时先横向展开再纵向展开（`scaleX/scaleY` 两段），关闭时缩回。
- `HoloMedia`：把真实图片/视频装进 3D 斜面板；入场时 `translateZ(-600) rotateY(18°)` 飞到正面，带切片故障；标签在外侧，不压画面。
- `ItemCard`：游戏物品卡；rarity + 名字 + 属性行 + 滚动数字；用 `project(cam, 3D点)` 锚在物件旁边。

### 2. 锚点：3D 坐标 → 屏幕坐标

```ts
const p = project(cam, [x, y, z]);
// p.x / p.y 是屏幕像素，直接给 HUD 的 left/top
```

这样 HUD 会跟着 3D 物件走，而不是贴在固定位置。`Callout` 就是一条从 3D 点拉到屏幕的折线。

### 3. 文字层级

- 英文 mono 小标：`LIVE · PLAYER_01`、`MISSION LOG`、`ROI ↓`；
- 中文大字：真正的观点/结论；
- 数字用 `Rolling` 从旧值滚到新值；
- 所有 HUD 元素都有 `t0/t1`，过期就消失，不要在画面上堆 10 个同时亮的面板。

### 4. 安全区

- 底部 150px 留给字幕；
- 左上角 64/52 是 `Chrome` 的 OASIS 标识；
- 右上角 64/50 是章节名；
- 3D 物件和 HUD 不要压在字幕带上；
- 真实素材面板的标签放在框外，不叠在素材上。

## 六、全片层：Chrome + Fx

`Chrome` 提供“玩家身份”：

- 四角框、OASIS//SKILL×BOT 标识、PLAYER_01 在线时间；
- 右上角扇区名 + 章节色；
- 顶部 XP 进度条 + 章节刻度；
- 右下角声波条（读 `voiceEnv.json`）；
- 左下角帧号。

`Fx` 提供剪辑惩罚：

- `glitchAmt` 取所有 cut 的包络，驱动 RGB split 与故障条；
- `Flashes` 在切点闪白/闪色；
- `shakeOffset` 用 `hit()` 做衰减抖动；
- `black` cut 用于「新物种」这种硬分隔。

**转场不是装饰，是标点。** 每个 cut 的 kind/color/amp 都在 `CUTS` 表里，与音效点位一一对应。

## 七、从文案到场景的写法

不要先想“用哪个组件”，按这个顺序：

1. **写一句视觉隐喻**：这一场把什么比作什么？（Skill=掉落物，Bot=黑盒，护城河=两条环）
2. **写 3~5 个动作节拍**：出现 → 变化 → 反转 → 结论；每个节拍一个时间。
3. **选世界颜色**：这一章是青/红/金/品红/绿？只换 `OasisWorld` 的 glow/grid/horizon。
4. **选机位**：fly-in / orbit / push / whip / top-down / dive。
5. **选 3D 道具 + HUD**：一个主物件，一个辅助面板，一个结论大字；不要超过 3 个信息焦点。
6. **写时间函数**：所有出现/消失/数值变化都用 `p(t, a, b, ease)`，不要用 CSS transition；Remotion 要逐帧确定性。
7. **加声音**：每个动作节拍一个 Sfx；冲击用 impact，转场用 whoosh，UI 用 tick/click，揭示用 riser/ding。
8. **出静帧检查**：首帧、2 秒、5 秒、10 秒、结尾，各一张；先看构图再看动画。

### 场景骨架

```tsx
export const MyScene: React.FC = () => {
  const t = useT();
  const cam = camKeys(t, [
    [A, [7, 3, 10], [0, 1.5, 0], 46],
    [B, [4, 4, 12], [0, 2, -1], 48],
  ]);
  const appear = p(t, A + 0.2, A + 0.8, eOutExpo);
  const anchor = project(cam, [0, 2, 0]);

  return (
    <>
      <Stage3D cam={cam} bloom={1.3} threshold={0.2}>
        <OasisWorld cam={cam} t={t} glow={C.cyan} />
        <BotCube position={[0, 1.6, 0]} size={2} time={t} seam={appear} />
        <GlowRing radius={2.2} color={C.cyan} intensity={3} />
      </Stage3D>
      <HudBox x={anchor.x + 80} y={anchor.y - 120} w={380} h={240} t0={A + 0.3} label="MISSION LOG">
        {/* 数据行 */}
      </HudBox>
      <Sfx name="impact" at={Math.round((A + 0.2) * 30)} />
    </>
  );
};
```

## 八、在 neurocast 里的落地

### 阶段 A（已接）

- `input.json` 写 `"skin": "oasis"`，`"world": "oasis"`。
- `world:"oasis"` 是 [src/world/OasisBackdrop.tsx](../src/world/OasisBackdrop.tsx)：Sky + NeonGrid + Skyline + Dust 四层，相机缓慢漂移。
- `skin:"oasis"` 是 [src/lib/theme.tsx](../src/lib/theme.tsx) 里的青/品红/金配色。
- 这只解决“背景”。3D 道具、Stage3D、HUD 组件族已在阶段 B 接上。

### 阶段 B（已接）

已落地 `src/oasis/`：

- `Stage3D` + `CameraRig` + `camKeys` + `project`；
- `Objects`（BotCube / GlowRing / Pad / Crystal / Beam / Coins / NeonBox / NeonLine / fountain）；
- `HudBox / HoloMedia / ItemCard / Achievement / Rolling / Meter / Tag / Brackets / Scanlines / GlitchText`；
- `postprocessing` 的 Bloom / Chromatic Aberration / Vignette；
- 两个通用组件：
  - `oasis-brief`：3D 舞台 + 黑盒 BotCube + 光环 + 左右 HUD 任务面板；
  - `holo-evidence`：3D 舞台 + 真实截图/录屏的全息面板 + SourceBadge。

用法：

```json
{ "type": "oasis-brief", "data": { "title": "一个 Bot，一条现金流", "items": [{ "label": "商业模式", "value": "按月订阅" }] } }
```

```json
{ "type": "holo-evidence", "data": { "title": "这是官方页面", "src": "assets/xxx.png", "source": { "platform": "Arena", "capturedAt": "2026-10-17", "kind": "real" } } }
```

这两个组件自带不透明 Stage3D 舞台。**整片都是 OASIS 组件时，把顶层 `world` 写成 `"none"`**，避免全局 World 和组件 Stage3D 两个 WebGL 画布同时渲染；混合片可以保留 `world:"oasis"`，自带舞台的镜头会盖住背景。

还没接的：`DocSheet` / `CubeSwarm` / `Callout` 的完整版，以及一个通用的 `holo-stats` 数据面板；这些留到按片需要时再加。

## 九、性能与验收

- 3D 物件能用 `InstancedMesh` 就不要一个个 `<mesh>`；楼、金币、克隆块、文档副本都必须实例化。
- ShaderMaterial 共用材质，别每帧 new。
- 环境粒子 1000~1500、楼 250~300、克隆块 ≤ 2000；再多先量帧时间。
- 1920×1080 + Bloom 时，Remotion concurrency 从 12 降到 8~10，先试渲 90 帧看时间。
- 每场先出 `--frames` 段渲，检查：首帧无残片、2 秒有动作、5 秒有解释、10 秒有结论、字幕不压 HUD、真实素材有来源角标。
- 3D 背景不是“证据”：真实截图/录屏/头像仍然要按素材规则放，不能拿代码画的界面冒充真实产品。

## 十、不要做的事

- 不要 18 个场景都套同一个机位；机位要服务这一场的动作。
- 不要满屏 HUD；一场最多 3 个信息焦点。
- 不要把 3D 当背景壁纸；没有相机运动就没有 OASIS。
- 不要把楼放在相机脸上；先检查相机到最近楼的距离。
- 不要在纯黑背景上只放一个发光方块；必须有网格/天空/尘埃至少两层。
- 不要用外部 3D 模型/贴图；这套风格的资产就是几何体 + shader + canvas 纹理。
- 不要把 Bloom 当万能药；没有明确亮暗层级，Bloom 只会让画面糊。
