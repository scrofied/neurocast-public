# NeuroCast

把中文文案（讲稿）+ 配音（TTS，可加真人口播视频）做成 16:9 科技感动画讲解视频的本地渲染管线（Remotion）。

核心特点：按配音的真实时间轴分镜 —— 镜头切换、画面元素出现时刻、逐字字幕全部卡在对应的词上（faster-whisper 词级时间轴 + 文案逐字对齐）。组件库是可持续扩充的动画资产（49 个正片组件 + 20 个开场钩子模板 + 5 个开场招式模板），并带开场数据回收（2s 跳出 / 5s 完播）。

## 快速开始

```bash
npm install
node scripts/make.mjs examples/comment-mining/input.json --out output/demo.mp4
```

依赖：Node 22+、ffmpeg、Python 3 + `faster-whisper`（时间轴识别）。

## 工作流

1. 写 `input.json` + 文案（`[口播: x.mp4]` 标记真人段落）
2. `--beats` 生成节拍表 → 按 `CATALOG.md` 写 `storyboard.json`（锚点卡词）
3. `--plan-only` 校验 → `--stills` 看静帧 → 渲染出片

组件开发、开场模板、音效规范见 `SKILL.md`。
