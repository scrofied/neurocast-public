// PRO 开场模板 → NeuroCast CompDef 适配层。
//
// src/openings/pro/ 下的 5 个模板（p01~p05）是「独立资产」：只吃 remotion / react / zod，
// 自己画不透明舞台（ProRoot 铺底色 + 暗角 + 颗粒），时间模型是「秒」。
// 这一层把它们包成引擎认识的 CompDef（layer: "opening"），于是：
//   · storyboard 里直接写 {"type": "pro-03-iris-title", "at": 0, "until": "转折词", "data": {...}}
//   · openings.mjs sync 登记进台账、pick.mjs / CATALOG 能选能查
//   · scripts/qa/try.mjs、Studio 的 Gallery 都能直接出图
//
// 三个必须对上的地方：
//   1) 时长：引擎给的是帧（dur），模板要的是秒 → duration = dur / fps。
//      useClock() 内部读 useCurrentFrame()，而开场本身就是一个从 from 起、长度 to-from 的
//      <Sequence>（Video.tsx:231），所以模板内部第 0 秒 == 开场第一帧，锚点不用平移。
//   2) 时基：模板 schema 里的 revealAt / crackAt / lockAt / flyAt / personAt 都是「相对开场开始的
//      秒数」。timed.mjs 默认把 xxxAt 解析成帧，所以这些模板在 CompDef 上标了
//      cueUnit: "sec"，让锚点解析的产物保持秒（写分镜时既能填数字也能填台词锚点字符串）。
//   3) 资源：模板的音效/字体走 public/pro/ 下（ProAssetBase 默认 base="pro/"，
//      我们的 publicDir 正好是整个 public/，不用覆盖）。
// 模板自带动画，整段运镜由它自己完成；这里只负责接线，不改它内部的时间模型。
import React from "react";
import { useVideoConfig } from "remotion";
import type { CompDef } from "../../components/types";
import { PRO_OPENINGS } from "./index";
import { ProAssetBase } from "./kit/sfx";
import type { ProOpening } from "./types";

// 模板自己声明的专有字段说明（CATALOG / SKILL 里给写分镜的模型看，字段本身还有 zod .describe()）
const FIELDS: Record<string, string> = {
  "pro-01-dolly-suspense": "kicker 顶小字 · line 悬疑句（▇▇ = 被遮住的答案）· reveal 答案 · sub · revealAt 揭晓（秒/锚点）· zoomTo",
  "pro-02-shatter-morph": "line1 以为的 · line2 真相 · hl 发光词 · crackAt 裂开（卡转折词）· punchAt 第二句砸出 · tilt 分屏倾角",
  "pro-03-iris-title": "title 片名 · sub 副标题 · tag 期数/系列 · lockAt 光圈锁定 · steps 咔哒几格 · irisMin 最小半径 · openAt 张开",
  "pro-04-depth-title": "lead 小字 · title 巨字（≤6 字，\\n 换行）· sub · flyAt 飞入 · subAt 副标题 · outline 空心字 · titleY · fgScale · fgDrop",
  "pro-05-info-first": "title · points 2~5 条要点 · at 第一条秒 · gap 每条间隔 · personAt 真人入画 · side 清单在哪侧",
};

const adapt = (P: ProOpening): CompDef => ({
  id: P.id,
  name: P.name,
  layer: "opening",
  variants: 1,
  minSec: 2.5,
  // 模板内部节奏按 defaultSec 排的；拉到 4s 还好看，再长就是「空窗」了
  maxSec: 4,
  tags: ["开场模板", "PRO", P.hook],
  motion: { kind: "镜头推移 + 大字砸出（整层运镜）", energy: 3 },
  desc: `${P.desc}（${P.trick}。专有字段：${FIELDS[P.id] ?? ""}）`,
  use: P.use,
  // 第 0 帧就有大字 / 闪白，字幕带整段让位给开场
  schema: P.schema,
  example: P.example,
  // 真人可选：person.src 吃本片口播视频（抠像 matte 也走这个目录）
  assetFields: ["person.src", "person.matte"],
  // 自带不透明舞台：没有 input.presenter 时首帧也不会露出正片残帧
  // sec = 模板自己编排的推荐时长，storyboard 的 until 照它给
  opening: { script: "template", hook: P.hook, techniques: [P.trick], template: true, selfBg: true, sec: P.defaultSec },
  // 引擎侧 cueUnit=sec：开场 data 里的 xxxAt 解析成秒，与模板的秒制一致
  cueUnit: "sec",
  C: ({ data, dur }) => {
    const { fps } = useVideoConfig();
    const r = P.schema.safeParse(data ?? {});
    // 分镜字段写错时别让整条片子崩掉：退回模板默认数据（Gallery 用 example={} 也走这条）
    const d = (r.success ? r.data : P.schema.parse({})) as any;
    return (
      <ProAssetBase base="pro/">
        <P.C data={d} duration={dur / fps} />
      </ProAssetBase>
    );
  },
});

export const PRO_TEMPLATE_OPENINGS: CompDef[] = PRO_OPENINGS.map(adapt);
