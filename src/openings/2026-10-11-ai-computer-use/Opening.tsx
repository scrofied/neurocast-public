import React from "react";
import { z } from "zod";
import { easeIn, easeOut, easeOutBack, prog } from "../../lib/anim";
import { CharPop, Slam } from "../../lib/cine/Type";
import { useTheme } from "../../lib/theme";
import type { CompDef, CompProps } from "../../components/types";
import { cam, idxOf, ink, Stage, tpl } from "../templates/kit";

// 《AI控制电脑》专属开场（2026-10-11）
// 骨架，不是成品：第 0 帧要放什么钩子、几秒给承诺、用什么方式收住 2 秒跳出，得按这条片的口播重写。
// 红线（SKILL「开场前 5 秒」）：首帧不能露素材残帧；大字必须在第 0 帧就有；改完先渲前 5 秒逐帧看。
type D = z.infer<typeof s>;
const s = z.object({
  kick: z.string().default("AI控制电脑").describe("首行小字（逐字弹出）"),
  hook: z.string().default("<第 0 帧大字>").describe("首帧就砸下来的钩子"),
  hot: z.string().default("<钩子里最扎心的两三个字>").describe("烧金色的词（留空则不烧）"),
  promise: z.string().default("<几秒给的第二行承诺>").describe("第二行"),
  promiseAt: z.number().default(60).describe("第二行入场（帧/锚点）"),
});

const C: React.FC<CompProps<D>> = ({ data: d, frame, dur, seed }) => {
  const t = useTheme();
  const pIn = easeOutBack(prog(frame, d.promiseAt, 9));
  const hookOut = easeIn(prog(frame, d.promiseAt - 4, 10)); // 承诺进场前，大字先上移退场，别叠字
  return (
    <Stage frame={frame} dur={dur} seed={seed} hits={[{ at: 0, amp: 10, len: 8 }, { at: d.promiseAt, amp: 7, len: 5 }]} exit="up">
      <div style={{ position: "absolute", left: 96, top: 200, opacity: 1 - hookOut, transform: `translateY(${-90 * hookOut}px)` }}>
        <CharPop frame={frame} at={0} text={d.kick} cues={Array.from(d.kick).map((_, i) => Math.min(2 + i, 12))} size={54} color={t.text} font={t.font.title} strokeW={7} />
        <div style={{ marginTop: 24, display: "flex", alignItems: "baseline" }}>
          <Slam frame={frame} at={0} text={d.hook.replace(d.hot, "")} size={112} color={t.text} font={t.font.title} from={1.7} len={6} blur={4} strokeW={10} style={{ display: "inline-block" }} />
          {d.hot && <span style={{ ...ink(112, t.gold, t.font.title, 12), display: "inline-block", marginLeft: 12, transform: `scale(${1 + 0.5 * (1 - easeOut(prog(frame, 3, 8)))})`, color: t.gold }}>{d.hot}</span>}
        </div>
      </div>
      {frame >= d.promiseAt && (
        <div style={{ position: "absolute", left: 100, top: 470, transform: `scale(${0.7 + 0.3 * pIn})`, opacity: pIn, transformOrigin: "left center" }}>
          <span style={{ ...ink(66, t.primary, t.font.title, 9) }}>{d.promise}</span>
        </div>
      )}
    </Stage>
  );
};

export const OpeningAiComputerUse: CompDef<D> = {
  ...tpl<D>({
    id: "opening-ai-computer-use",
    name: "开场 · 《AI控制电脑》（骨架，待定制）",
    hook: "首帧大字+第二行承诺",
    desc: "第 0 帧 kicker 逐字弹出 + 钩子大字砸下（${d.hot} 烧金色）；${d.promiseAt} 帧第二行承诺缩放入场",
    use: "只给《AI控制电脑》用（开场不重样）。骨架阶段的默认画面，定稿前别拿它当风格参考",
    techniques: ["首帧大字", "逐字 kicker", "金色重音", "承诺第二行"],
    schema: s,
    example: { kick: "AI 干货", hook: "别再", hot: "瞎忙", promise: "4 步做完过去 4 小时的活", promiseAt: 60 },
    C,
    camera: (dd, f, dur2) => cam(f, dur2, { punches: [{ at: 0, amt: 0.06 }, { at: dd.promiseAt, amt: 0.04 }] }),
  }),
  noGallery: true,
  opening: { draft: true, script: "neurocast-ai", hook: "首帧大字+第二行承诺", techniques: ["首帧大字", "逐字 kicker", "金色重音", "承诺第二行"] },
};
