import { DETECTORS, detectMetaphor, keywords, clean, short } from "./detect.mjs";
import { TRANSITIONS } from "./motion.mjs";

const rngOf = (seed) => {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const SKINS = ["aurora", "violet", "amber", "matrix", "arctic"];
const EXTRA_SKINS = ["oasis"];
const ALL_SKINS = [...SKINS, ...EXTRA_SKINS];
const FONTS = ["yahei", "noto", "deng"];
const WORLDS = ["grid", "tunnel", "stars"];
// matrix / oasis 是需要显式点名的强风格世界：不参与 seed 随机，避免每条片都变成黑客帝国/绿洲。
const EXTRA_WORLDS = ["matrix", "oasis", "none"];
const ALL_WORLDS = [...WORLDS, ...EXTRA_WORLDS];
// 随机转场池：cut（无入场硬切）留给开场与分镜的显式声明，不参与随机——
// 随机硬切会让节奏失控。池子 = motion.mjs 的 TRANSITIONS 去掉 cut 与 matrix，渲染层加一种它就自动多一种
// （现在是 10 种：fade/fly/warp/iris/flood/glitch + 形状连续那四种 zoom/push/wipe/grid）。
const RANDOM_TRANSITIONS = TRANSITIONS.filter((t) => t !== "cut" && t !== "matrix");

export const VARIANTS = { neural: 3, agents: 3, prompt: 2, funnel: 1, vault: 1, assembly: 1, number: 2, code: 3, flow: 3, timeline: 2, versus: 2, growth: 2, cards: 2, screen: 3, quote: 2, chapter: 2, narration: 2, hook: 1, outro: 1 };

// ---------- parsing ----------
export const parseScript = (script) => {
  if (typeof script !== "string" || !script.trim()) throw new PlanError("E_EMPTY", "讲稿为空：script 字段必须是非空字符串");
  const text = script.replace(/\r\n/g, "\n").replace(/　/g, " ");
  const lines = text.split("\n");
  const chapters = [];
  let cur = null;
  let buf = [];
  let inCode = false;
  let inList = false;
  let docTitle = "";
  const flush = () => {
    if (!cur) cur = { title: "", body: [] };
    const para = buf.join("\n").trim();
    if (para) cur.body.push(para);
    buf = [];
    inList = false;
  };
  for (let ln of lines) {
    if (/^```/.test(ln.trim())) {
      if (!inCode) flush();
      inCode = !inCode;
      buf.push(ln);
      if (!inCode) flush();
      continue;
    }
    if (inCode) {
      buf.push(ln);
      continue;
    }
    // markdown noise from transcripts: rules, metadata lines, emphasis, links
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(ln)) {
      flush();
      continue;
    }
    if (/^\s*\*\*[^*]{1,16}[:：]\s*\*\*/.test(ln) || /^\s*>/.test(ln)) continue;
    ln = ln.replace(/\*\*|__/g, "").replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1");
    // "# X" = video title; "## X" / "### X" = chapter
    const h1 = ln.match(/^\s*#\s+(.+?)\s*$/);
    if (h1) {
      flush();
      if (!docTitle) docTitle = clean(h1[1]);
      continue;
    }
    const h = ln.match(/^\s*#{2,3}\s*(.+?)\s*$/);
    if (h) {
      flush();
      if (cur && (cur.body.length || cur.title)) chapters.push(cur);
      cur = { title: clean(h[1]), body: [] };
      continue;
    }
    if (!ln.trim()) {
      flush();
      continue;
    }
    // consecutive list items stay in one paragraph so step/list detectors see them together
    const li = ln.match(/^\s*(?:[-*+•]|\d{1,2}[.、)）])\s+(.*)$/);
    if (li) {
      if (!inList && buf.length && !/[:：]\s*$/.test(buf[buf.length - 1])) flush();
      buf.push(li[1]);
      inList = true;
      continue;
    }
    if (inList) flush();
    // a lone [图:] marker or a line ending with a colon binds to what follows
    const lone = /^\s*\[(?:图|截图|录屏|视频|img|image|video)\s*[:：][^\]]+\]\s*$/i.test(ln) || /[:：]\s*$/.test(ln);
    buf.push(ln);
    if (!lone) flush();
  }
  flush();
  if (cur && (cur.body.length || cur.title)) chapters.push(cur);
  if (inCode) throw new PlanError("E_CODE_FENCE", "讲稿里的代码块 ``` 没有闭合");
  const out = chapters.filter((c) => c.body.length);
  if (!out.length) throw new PlanError("E_NO_CONTENT", "讲稿里没有可朗读的正文（只有标题或空行）");
  out.docTitle = docTitle;
  return out;
};

// strip markup so we know what is actually spoken
const spokenOf = (raw) =>
  raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[(?:图|截图|录屏|视频|img|image|video)\s*[:：][^\]]+\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();

// split paragraph into shot-sized segments (target ~ 4-9s of speech)
const CPS = 4.6; // chinese chars per second for estimation
const segment = (para) => {
  const hasBlock = /```|\[(?:图|截图|录屏|视频|img|image|video)\s*[:：]/i.test(para);
  if (hasBlock) return [para];
  // keep enumerations / step sequences / timelines in one shot so detectors see the whole structure
  const structured = (para.match(/第[一二三四五六七八九十\d]+步|首先|然后|最后|(?:19|20)\d{2}\s*年/g) || []).length >= 2;
  if (structured && Array.from(para).length / CPS <= 22) return [para];
  const sents = para.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  let acc = "";
  for (const s of sents) {
    const len = Array.from(acc + s).length;
    if (acc && len / CPS > 9) {
      out.push(acc);
      acc = s;
    } else acc += s;
    if (Array.from(acc).length / CPS >= 5.5) {
      out.push(acc);
      acc = "";
    }
  }
  if (acc) {
    if (out.length && Array.from(acc).length / CPS < 2.5) out[out.length - 1] += acc;
    else out.push(acc);
  }
  return out;
};

// auto chaptering when the script has no ## headings: group paragraphs into ~60-120s chunks
const autoChapters = (chs) => {
  if (chs.length > 1 || chs[0].title) return chs;
  const paras = chs[0].body;
  const totalSec = paras.reduce((a, p) => a + Array.from(spokenOf(p)).length / CPS, 0);
  const n = Math.max(1, Math.min(8, Math.round(totalSec / 80)));
  if (n === 1) return [{ title: "", body: paras }];
  const per = totalSec / n;
  const out = [];
  let cur = { title: "", body: [] };
  let acc = 0;
  for (const p of paras) {
    cur.body.push(p);
    acc += Array.from(spokenOf(p)).length / CPS;
    if (acc >= per * (out.length + 1) && out.length < n - 1) {
      out.push(cur);
      cur = { title: "", body: [] };
    }
  }
  if (cur.body.length) out.push(cur);
  return out;
};

const titleFor = (ch, i) => {
  if (ch.title) return ch.title;
  const first = spokenOf(ch.body[0]).split(/[，。！？]/)[0];
  const k = keywords(spokenOf(ch.body.join("")), 1)[0];
  return short(k && Array.from(k).length >= 3 ? k : first, 12) || `第 ${i + 1} 部分`;
};

export class PlanError extends Error {
  constructor(code, msg) {
    super(`[${code}] ${msg}`);
    this.code = code;
  }
}

// ---------- planning ----------
// seed -> look of the video (skin / font / 3D world / mirror / transition set); shared by both planners
export const styleFor = (input) => {
  const seed = Number.isFinite(+input.seed) ? Math.floor(+input.seed) : 1;
  const r = rngOf(seed * 7919 + 13);
  return {
    seed,
    r,
    skin: input.skin && ALL_SKINS.includes(input.skin) ? input.skin : SKINS[seed % SKINS.length],
    font: FONTS[Math.floor(r() * FONTS.length)],
    world: input.world && ALL_WORLDS.includes(input.world)
      ? input.world
      : (input.skin === "oasis" ? "oasis" : WORLDS[Math.floor(r() * WORLDS.length)]),
    mirror: r() < 0.35,
    transitions: [...RANDOM_TRANSITIONS].sort(() => r() - 0.5).slice(0, 4),
    variantOffset: Math.floor(r() * 6),
    pace: 0.94 + r() * 0.12,
  };
};
export { SKINS };

export const plan = (input, opts = {}) => {
  const style = styleFor(input);
  const { seed, r } = style;
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const fps = 30;

  const parsed = parseScript(input.script);
  let chapters = autoChapters(parsed);
  const title = clean(input.title || parsed.docTitle || titleFor(chapters[0], 0));
  const assets = input.assets || {};

  // build segments
  const segs = [];
  chapters.forEach((ch, ci) => {
    ch.title = titleFor(ch, ci);
    for (const para of ch.body) for (const s of segment(para)) segs.push({ raw: s, spoken: spokenOf(s), chapter: ci });
  });
  if (!segs.length) throw new PlanError("E_NO_CONTENT", "讲稿里没有可朗读的正文");

  const shots = [];
  const captions = [];
  const recent = [];
  let t = 0;
  const addShot = (type, data, sec, text, chapter, forceTransition) => {
    const dur = Math.max(Math.round(sec * fps), 45);
    const v = VARIANTS[type] ?? 1;
    const prevSame = [...shots].reverse().find((s) => s.type === type);
    let variant = Math.floor(r() * v);
    if (prevSame && v > 1 && variant === prevSame.variant) variant = (variant + 1) % v;
    const prevT = shots.length ? shots[shots.length - 1].transition : "";
    let tr = forceTransition ?? style.transitions[Math.floor(r() * style.transitions.length)];
    if (!forceTransition && tr === prevT) tr = style.transitions[(style.transitions.indexOf(tr) + 1) % style.transitions.length];
    shots.push({ id: `s${shots.length}`, type, variant, start: t, dur, chapter, text, data, transition: tr });
    t += dur;
    recent.push(type);
    if (recent.length > 4) recent.shift();
    return dur;
  };

  // hook
  const hookSub = input.subtitle || (chapters.length > 1 ? `${chapters.length} 个部分讲清楚` : undefined);
  addShot("hook", { title, sub: hookSub }, 3.2, "", 0, "fly");

  const chapterStarts = [];
  let lastChapter = -1;
  const since = { narration: 0 };
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg.chapter !== lastChapter) {
      lastChapter = seg.chapter;
      chapterStarts[seg.chapter] = t;
      if (chapters.length > 1) addShot("chapter", { index: seg.chapter, total: chapters.length, title: chapters[seg.chapter].title }, 2.2, "", seg.chapter, "iris");
    }
    const speechSec = Math.max(2.2, (Array.from(seg.spoken).length / CPS) * style.pace);
    // candidates
    const cands = [];
    for (const d of DETECTORS) {
      const c = d(seg);
      if (c) cands.push(c);
    }
    cands.push(...detectMetaphor(seg));
    // variety: penalise recently used types
    // penalty grows the more recently a type was used; explicit blocks (code/screen) are exempt
    for (const c of cands) {
      const k = recent.lastIndexOf(c.type);
      if (k >= 0 && c.score < 100) c.score -= 20 + k * 10;
      c.score += r() * 10; // seed-dependent tie-break -> different picks per seed
    }
    cands.sort((a, b) => b.score - a.score);
    // close contenders (within 14 pts) are picked by seed -> same script, different visual choices
    const top = cands[0];
    const pool = top && top.score < 100 ? cands.filter((c) => c.score > 30 && top.score - c.score <= 14) : [];
    let chosen = pool.length > 1 ? pool[Math.floor(r() * pool.length)] : cands.find((c) => c.score > 30);
    if (!chosen) {
      // plain narration: alternate between keyword orbit and big quote-like statement
      const kws = keywords(seg.spoken, 4);
      if (kws.length >= 2 && recent[recent.length - 1] !== "narration") chosen = { type: "narration", data: { keywords: kws } };
      else {
        const first = clean(seg.spoken.split(/[。！？]/)[0]);
        chosen = Array.from(first).length <= 26 && recent[recent.length - 1] !== "quote"
          ? { type: "quote", data: { text: first, emphasis: kws.slice(0, 1) } }
          : { type: "narration", data: { keywords: kws.length ? kws : [short(first, 8)] } };
      }
    }
    // enrich data
    if (chosen.type === "screen") {
      const a = assets[chosen.data.src] || {};
      chosen.data = { ...chosen.data, ...a };
      if (!chosen.data.focus) chosen.data.focus = [];
    }
    if (["neural", "agents", "prompt", "vault", "assembly", "flow", "cards", "versus", "growth", "timeline", "funnel", "code"].includes(chosen.type) && !chosen.data.title) {
      const k = keywords(seg.spoken, 1)[0];
      // first clause, unless it is just a step/ordinal marker
      const first = clean(seg.spoken.split(/[，。！？：:]/)[0]).replace(/^(第[一二三四五六七八九十\d]+步?|首先|其次|然后|接着|最后)/, "");
      const cand = Array.from(first).length >= 4 ? short(first, 16) : "";
      chosen.data.title = cand || (k && Array.from(k).length >= 3 ? k : undefined);
    }
    const minSec = { code: 5, timeline: 5, screen: 6, vault: 6, flow: 4.5, cards: 4.5, funnel: 5 }[chosen.type] ?? 3;
    const sec = Math.max(minSec, speechSec);
    const start = t;
    const dur = addShot(chosen.type, chosen.data, sec, seg.spoken, seg.chapter);
    // captions: split spoken text into <=18 char lines, spread across shot time by length
    const parts = seg.spoken.split(/(?<=[，。！？；,!?;])/).map((x) => x.trim()).filter(Boolean);
    const lines = [];
    for (const p of parts) {
      const arr = Array.from(p.replace(/[。，；]$/, ""));
      for (let k = 0; k < arr.length; k += 18) lines.push(arr.slice(k, k + 18).join(""));
    }
    const total = lines.reduce((a, l) => a + Array.from(l).length, 0) || 1;
    let acc = 0;
    const speakFrames = Math.min(dur, Math.round(speechSec * fps));
    for (const l of lines) {
      const len = Array.from(l).length;
      const s0 = start + Math.round((acc / total) * speakFrames);
      acc += len;
      const s1 = start + Math.round((acc / total) * speakFrames);
      captions.push({ start: s0, end: Math.max(s0 + 10, s1), text: l });
    }
  }

  // outro
  const recap = chapters.length > 1 ? chapters.map((c) => c.title).slice(0, 5) : keywords(segs.map((s) => s.spoken).join(""), 3);
  addShot("outro", { title: input.outroTitle || "今天就聊到这", recap, cta: input.cta || "关注我 · 用 AI 升级自己" }, 5, "", chapters.length - 1, "fly");

  const durationInFrames = t + 12;
  const chs = chapters.map((c, i) => ({ title: c.title, start: chapterStarts[i] ?? 0, end: i + 1 < chapters.length ? chapterStarts[i + 1] ?? t : durationInFrames }));
  chs[0].start = 0;

  return {
    meta: { title, seed, skin: style.skin, font: style.font, world: style.world, fps, width: 1920, height: 1080, mirror: style.mirror, audio: input.audio || null, bgm: input.bgm || null, showCaptions: input.captions !== false },
    durationInFrames,
    chapters: chs,
    shots,
    captions,
  };
};
