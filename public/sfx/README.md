# 音效库

这里的 `*.wav` 由 `python scripts/gen_sfx.py` 程序合成（无版权问题）。想换成自己的素材：保持文件名不变直接覆盖即可。

| 名字 | 用途 |
|---|---|
| whoosh / swish / swipe | 转场、飞入、手机划动 |
| impact / stamp | 冲击大字、对撞、盖章 |
| pop / click / tick | 卡片弹出、点击发送、打勾计数 |
| ding / success / sparkle | 完成、发布、淘金高光 |
| riser | 揭晓前的上扬 |
| glitch | 故障转场、逻辑翻转 |
| typing | 打字 |
| bubbles | 沉水气泡 |

新增音效：放 `<name>.wav`，并在 `src/lib/sfx.tsx` 的 `SFX` 表里登记它的时长（帧，30fps）。
