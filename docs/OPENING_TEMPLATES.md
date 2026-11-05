# 开场模板入口

以 [SKILL.md 的开场流程](../SKILL.md#开场设计前-2--5--10-秒不是堆特效) 和 [开场选型表](../openings/TEMPLATES.md) 为准；本页原来的 `tech-opening-01`～`06` 并非当前注册 ID，不要写进分镜。

- 前 2 秒给看点，5 秒内给证据/解释，10 秒内兑现第一步；不是把片头拉长到 10 秒。
- 有真实成品：`op-result-first`；同条件前后素材：`op-proof-compare`；观点解释/无实测素材：`op-quiet-question`。
- 短钩子可选 PRO 或透明叠层，后续正文接住承诺。不要每条片都闪白、重击、盖章。
- `node scripts/openings.mjs list` 查看实际可选组件、推荐时长、近片签名及留存数据；字段查看 [CATALOG.md](../CATALOG.md)。
- 分镜里的时间填台词锚点或秒数；新模板生产使用必须显式填写文案与所需真实素材，演示默认值不能直接出片。
- `node scripts/openings.mjs preview <input.json>` 先校验，再输出本片前 10 秒；文件落在 `openings/previews/<开场id>-<input hash>.mp4`，检查画面交接并试听，不以静帧代替视听验收。
- `node scripts/openings.mjs pending` 看开场库待办：草稿缺哪些字段、哪些上过片还没录数据、哪些正式开场还没预览。
- `new-video.mjs` 只建项目目录，不生成未定制开场；草稿不能通过生产校验。

## 章节隧道 `op-tunnel`

长视频换章时用：代码雨从中心向外冲成一条透视通道，章节编号与标题在通道尽头推近、落定，2.2–4 秒后交回正片。自背景（`selfBg:true`），会盖住 presenter 与素材，**只适合章节边界，不适合 15 秒以内短片或开场钩子**。

```json
{
  "id": "s18",
  "type": "punch-text",
  "data": {
    "opening": {
      "type": "op-tunnel",
      "at": 0,
      "until": 2.6,
      "data": { "num": "02", "title": "开源方法", "sub": "CHAPTER 02 // OPEN SOURCE" }
    }
  }
}
```

写在**这一章第一镜**的分镜条目 `data.opening` 里，`at/until` 是相对这一镜的**秒数**（写台词锚点也行，管线会换算）；模板默认 2.6 秒。每一章都换 `num/title/sub`，不要把同一章号复用到下一章。预览：`node scripts/opening-templates.mjs sheet - op-tunnel`。
