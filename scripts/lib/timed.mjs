// Timeline-driven planner: every shot boundary, in-shot cue and caption comes from the real voice timing.
// Pipeline: sections -> runs (talking-head clip | contiguous voice-over) -> forced alignment -> master timeline
//           -> beats (sentences) -> shots (storyboard anchors, or auto detectors) -> cues -> captions
import { alignText, audioTrimStart, captionLines, isPunct, sentenceSpans, spanTime } from "./align.mjs";
import { DETECTORS, detectMetaphor, keywords, clean, short } from "./detect.mjs";
import { sectionText } from "./script.mjs";

const LEAD = 0.12; // visuals lead the voice a little

export class TimedError extends Error {
  constructor(code, msg) {
    super(`[${code}] ${msg}`);
    this.code = code;
  }
}

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

const normC = (c) => {
  const k = c.charCodeAt(0);
  if (k >= 0xff01 && k <= 0xff5e) c = String.fromCharCode(k - 0xfee0);
  return c.toLowerCase();
};

// ---------- 1. runs + alignment -> master timeline ----------
const buildRuns = (parsed) => {
  const runs = [];
  for (const sec of parsed.sections) {
    const { text, paraStarts } = sectionText(sec);
    const last = runs[runs.length - 1];
    if (sec.kind === "tts" && last && last.kind === "tts") {
      const off = Array.from(last.text).length;
      last.parts.push({ chapter: sec.chapter, charOffset: off, paraStarts: paraStarts.map((p) => p + off), paras: sec.paras });
      last.text += text;
    } else runs.push({ kind: sec.kind, clip: sec.clip, text, parts: [{ chapter: sec.chapter, charOffset: 0, paraStarts, paras: sec.paras }] });
  }
  return runs;
};

const alignRuns = (runs, media, warn) => {
  let ttsFrom = 0; // voice-over is consumed monotonically
  let firstTts = true;
  let cursor = 0;
  for (const run of runs) {
    if (run.kind === "talk") {
      const clip = media.clips[run.clip];
      if (!clip) throw new TimedError("E_ASSET", `口播视频 ${run.clip} 没有准备好`);
      const al = alignText(run.text, clip.words, { freeA0: true, freeA1: true });
      if (al.ratio < 0.6) warn(`口播 ${run.clip} 和文案只对上了 ${(al.ratio * 100).toFixed(0)}%，请检查 [口播] 下面写的是不是他说的原话`);
      const lastEnd = Math.max(...al.times.filter((x) => !x.punct).map((x) => x.end));
      run.srcStart = 0;
      run.srcEnd = Math.min(clip.duration, lastEnd + 0.8);
      run.al = al;
    } else {
      if (!media.tts) throw new TimedError("E_AUDIO", "文案里有配音段落，但没有提供 audio（配音文件）");
      const words = media.tts.words.filter((w) => w.start >= ttsFrom - 0.01);
      const al = alignText(run.text, words, { freeA0: true, freeA1: true });
      if (al.ratio < 0.6) warn(`配音和文案只对上了 ${(al.ratio * 100).toFixed(0)}%，配音是不是按这份文案生成的？`);
      const spoken = al.times.filter((x) => !x.punct);
      const firstStart = spoken[0].start;
      const lastEnd = spoken[spoken.length - 1].end;
      if (firstTts) {
        run.srcStart = audioTrimStart(al);
        if (run.srcStart > 0.5) warn(`配音开头 ${run.srcStart.toFixed(2)}s 的内容在文案这一段里没有（通常是口播已经讲过的开场），已自动跳过`);
      } else run.srcStart = Math.max(ttsFrom, firstStart - 0.25);
      const nextWord = media.tts.words.find((w) => w.start > lastEnd + 0.01);
      run.srcEnd = nextWord ? Math.min(nextWord.start - 0.02, lastEnd + 0.35) : Math.min(media.tts.duration, lastEnd + 0.6);
      run.al = al;
      ttsFrom = run.srcEnd;
      firstTts = false;
    }
    run.offset = cursor;
    run.dur = run.srcEnd - run.srcStart;
    cursor += run.dur;
  }
  return cursor;
};

// ---------- 2. master text ----------
const masterText = (runs) => {
  const chars = [];
  const times = [];
  const meta = [];
  runs.forEach((run, ri) => {
    run.g0 = chars.length;
    const map = (t) => Math.min(run.offset + run.dur, Math.max(run.offset, run.offset + (t - run.srcStart)));
    run.al.chars.forEach((c, i) => {
      const tt = run.al.times[i];
      chars.push(c);
      times.push({ start: map(tt.start), end: map(tt.end), punct: !!tt.punct });
      let ch = run.parts[0].chapter;
      for (const p of run.parts) if (i >= p.charOffset) ch = p.chapter;
      meta.push({ run: ri, chapter: ch });
    });
    run.g1 = chars.length;
  });
  // normalised string for anchor search
  const nStr = [];
  const nIdx = [];
  chars.forEach((c, i) => {
    if (!isPunct(c)) {
      nStr.push(normC(c));
      nIdx.push(i);
    }
  });
  return { chars, times, meta, nStr: nStr.join(""), nIdx };
};

const normalize = (s) => Array.from(s).filter((c) => !isPunct(c)).map(normC).join("");

// anchor syntax: "文字" | "文字$"(用这几个字说完的时刻) | "文字+0.3" / "文字-0.2"(秒偏移)
const parseAnchor = (a) => {
  const m = String(a).match(/^(.*?)(\$)?([+-]\d+(?:\.\d+)?)?$/);
  return { text: m[1], atEnd: !!m[2], offset: m[3] ? parseFloat(m[3]) : 0 };
};

const findChar = (M, text, fromG, toG = Infinity) => {
  const na = normalize(text);
  if (!na) return -1;
  let k0 = M.nIdx.findIndex((g) => g >= fromG);
  if (k0 < 0) return -1;
  const pos = M.nStr.indexOf(na, k0);
  if (pos < 0) return -1;
  const g = M.nIdx[pos];
  if (g >= toG) return -1;
  return { g, gEnd: M.nIdx[pos + Array.from(na).length - 1] };
};

// ---------- 3. beats ----------
const buildBeats = (runs, M) => {
  const beats = [];
  runs.forEach((run) => {
    run.parts.forEach((part, pi) => {
      const partEnd = pi + 1 < run.parts.length ? run.parts[pi + 1].charOffset : Array.from(run.text).length;
      const starts = [...part.paraStarts, partEnd];
      for (let k = 0; k + 1 < starts.length; k++) {
        const a = run.g0 + starts[k];
        const b = run.g0 + starts[k + 1];
        for (const [x, y] of sentenceSpans(M.chars, M.times, a, b)) {
          const tt = spanTime(M.chars, M.times, x, y);
          if (!tt) continue;
          beats.push({ id: `b${beats.length}`, a: x, b: y, start: tt.start, end: tt.end, chapter: part.chapter, kind: run.kind, run: runs.indexOf(run), para: k, text: M.chars.slice(x, y).join("").trim(), asset: part.paras[k]?.asset });
        }
      }
    });
  });
  return beats;
};

// ---------- 4. anchors inside shot data ----------
const isCueKey = (k) => k === "at" || k === "until" || /[a-z]At$/.test(k);

const resolveCues = (obj, ctx, baseSec, path, warn) => {
  if (Array.isArray(obj)) return obj.map((v, i) => resolveCues(v, ctx, baseSec, `${path}[${i}]`, warn));
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  // a nested component slot ({ type, data, at }) — its data cues are relative to the slot's own start
  const isSlot = typeof obj.type === "string" && obj.data && typeof obj.data === "object";
  if (isSlot) ctx.cursor = ctx.g0;
  for (const [k, v] of Object.entries(obj)) {
    if (isCueKey(k) && (typeof v === "string" || typeof v === "number")) {
      const sec = cueSeconds(v, ctx, baseSec, `${path}.${k}`, warn);
      out[k] = sec === undefined ? undefined : Math.round((sec - baseSec) * ctx.fps);
    } else if (!(isSlot && k === "data")) out[k] = resolveCues(v, ctx, baseSec, `${path}.${k}`, warn);
  }
  if (isSlot) {
    const slotSec = typeof out.at === "number" ? baseSec + out.at / ctx.fps : baseSec;
    ctx.cursor = ctx.g0; // the slot's own until may have moved the cursor past its first anchors
    out.data = resolveCues(obj.data, ctx, slotSec, `${path}.data`, warn);
  }
  return out;
};

// anchor text -> absolute master seconds; plain numbers are seconds after the current base (shot or slot start)
const cueSeconds = (v, ctx, baseSec, where, warn) => {
  if (typeof v === "number") return baseSec + v;
  const { text, atEnd, offset } = parseAnchor(v);
  let hit = findChar(ctx.M, text, ctx.cursor, ctx.g1);
  if (hit === -1) hit = findChar(ctx.M, text, ctx.g0, ctx.g1);
  if (hit === -1) {
    warn(`镜头 ${ctx.shotId} 的锚点「${text}」（${where}）在这一镜的台词里找不到，已忽略`);
    return undefined;
  }
  ctx.cursor = hit.g + 1;
  const t = atEnd ? ctx.M.times[hit.gEnd].end : ctx.M.times[hit.g].start;
  return t - (atEnd ? 0 : 0.05) + offset;
};

// ---------- 5. auto shot choice (no storyboard) ----------
const chooseAuto = (text, recent, r, asset) => {
  const seg = { raw: asset ? `[图: ${asset}]\n${text}` : text, spoken: text };
  const cands = [];
  for (const d of DETECTORS) {
    const c = d(seg);
    if (c && c.type !== "talking-head") cands.push(c);
  }
  cands.push(...detectMetaphor(seg));
  // short rhetorical punch line
  const body = clean(text);
  if (Array.from(body).length <= 10 && /[？?！!]$|吧$/.test(text.trim().replace(/[。]$/, "")) ) cands.push({ type: "punch-text", score: 74, data: { text: text.trim().replace(/[。]$/, "") } });
  for (const c of cands) {
    if (c.type === "versus" && c.data.left?.label === "以前") {
      c.type = "before-after";
      c.data = { before: { label: "以前", items: (c.data.left.points || []).map((p) => ({ text: p })).slice(0, 3) }, after: { label: "现在", at: "现在", items: (c.data.right.points || []).map((p) => ({ text: p })).slice(0, 3) } };
      if (!c.data.before.items.length || !c.data.after.items.length) c.score = 0;
    }
    const k = recent.lastIndexOf(c.type);
    if (k >= 0 && c.score < 100) c.score -= 20 + k * 10;
    c.score += r() * 10;
  }
  cands.sort((a, b) => b.score - a.score);
  const top = cands[0];
  const pool = top && top.score < 100 ? cands.filter((c) => c.score > 30 && top.score - c.score <= 14) : [];
  let chosen = pool.length > 1 ? pool[Math.floor(r() * pool.length)] : cands.find((c) => c.score > 30);
  if (!chosen) {
    const kws = keywords(text, 4);
    const first = clean(text.split(/[。！？]/)[0]);
    chosen = kws.length >= 2 && recent[recent.length - 1] !== "narration" ? { type: "narration", data: { keywords: kws } } : Array.from(first).length <= 26 && recent[recent.length - 1] !== "quote" ? { type: "quote", data: { text: first, emphasis: kws.slice(0, 1) } } : { type: "narration", data: { keywords: kws.length ? kws : [short(first, 8)] } };
  }
  if (["neural", "agents", "prompt", "vault", "assembly", "flow", "cards", "versus", "growth", "timeline", "funnel", "code", "before-after"].includes(chosen.type) && !chosen.data.title) {
    const first = clean(text.split(/[，。！？：:]/)[0]).replace(/^(第[一二三四五六七八九十\d]+步?|首先|其次|然后|接着|最后)/, "");
    if (Array.from(first).length >= 4) chosen.data.title = short(first, 16);
  }
  return chosen;
};

const autoTalkPanels = (beats) => {
  const phrases = beats.map((b) => ({ text: short(clean(b.text.split(/[，。！？]/)[0]), 9), at: clean(b.text.split(/[，。！？]/)[0]).slice(0, 4) })).filter((p) => Array.from(p.text).length >= 3);
  const half = Math.ceil(phrases.length / 2);
  const left = phrases.slice(0, Math.min(4, half));
  const right = phrases.slice(half, half + 4);
  const slot = (items) => (items.length ? [{ type: "bullet-cards", at: items[0].at, data: { items: items.map((p) => ({ text: p.text, at: p.at, tone: "info" })) } }] : []);
  return { left: slot(left), right: slot(right) };
};

// ---------- main ----------
export const planTimed = ({ parsed, media, storyboard, input, style, fps = 30, warn = () => {} }) => {
  const r = rngOf((style.seed || 1) * 7919 + 13);
  const runs = buildRuns(parsed);
  const total = alignRuns(runs, media, warn);
  const M = masterText(runs);
  const beats = buildBeats(runs, M);
  if (!beats.length) throw new TimedError("E_EMPTY", "文案里没有可朗读的正文");
  const tail = Number.isFinite(+input.tail) ? +input.tail : 1.6;
  const endSec = total + tail;
  const F = (s) => Math.round(s * fps);

  // ---- shot skeletons: { start (sec), g (char), type, data, ... }
  let skel = [];
  const talkRunOf = (g) => runs.findIndex((run) => run.kind === "talk" && g >= run.g0 && g < run.g1);
  if (storyboard?.shots?.length) {
    let cursor = 0;
    storyboard.shots.forEach((s, i) => {
      if (!s.type) throw new TimedError("E_STORYBOARD", `分镜第 ${i + 1} 条缺少 type`);
      let g;
      if (s.beat) {
        const b = beats.find((x) => x.id === s.beat);
        if (!b) throw new TimedError("E_STORYBOARD", `分镜第 ${i + 1} 条的 beat "${s.beat}" 不存在（见 beats.md）`);
        g = b.a;
      } else if (s.start === undefined || s.start === null) g = i === 0 ? 0 : cursor;
      else {
        const an = parseAnchor(s.start);
        const hit = findChar(M, an.text, cursor);
        if (hit === -1) throw new TimedError("E_STORYBOARD", `分镜第 ${i + 1} 条（${s.type}）的起点锚点「${s.start}」在文案里找不到（要在上一镜之后，且是文案原文）`);
        g = hit.g;
        s = { ...s, startOffset: an.offset };
      }
      cursor = g + 1;
      skel.push({ ...s, g, i });
    });
  } else {
    // auto: one stage per talking-head run, beats grouped into 3-8.5s shots for voice-over
    const recent = [];
    runs.forEach((run, ri) => {
      const rb = beats.filter((b) => b.run === ri);
      if (!rb.length) return;
      if (run.kind === "talk") {
        skel.push({ type: "talking-head-stage", g: rb[0].a, data: { title: input.title || parsed.title || undefined, ...autoTalkPanels(rb) } });
        return;
      }
      let grp = [];
      const flush = () => {
        if (!grp.length) return;
        const text = grp.map((b) => b.text).join("");
        const c = chooseAuto(text, recent, r, grp.find((b) => b.asset)?.asset);
        recent.push(c.type);
        if (recent.length > 4) recent.shift();
        skel.push({ type: c.type, g: grp[0].a, data: c.data, auto: true });
        grp = [];
      };
      for (const b of rb) {
        const gs = grp.length ? grp[0].start : b.start;
        const gd = grp.length ? grp[grp.length - 1].end - gs : 0;
        const bd = b.end - b.start;
        // an ordinal opener ("第二个…", "首先…") always starts its own shot
        const opener = /^(第[一二三四五六七八九十\d]+[个步点条]|首先|其次|最后|接下来)/.test(b.text);
        if (grp.length && (opener || b.chapter !== grp[0].chapter || gd >= 3.2 || gd + bd > 8.5) && !(!opener && bd < 1.1 && gd + bd <= 9.5)) flush();
        grp.push(b);
      }
      flush();
    });
    const last = beats[beats.length - 1];
    const outro = { type: "outro", data: { title: input.outroTitle || "今天就聊到这", cta: input.cta || "关注我 · 用 AI 升级自己", recap: parsed.chapters.map((c) => c.title).filter(Boolean).slice(-4) }, auto: true };
    // the closing line (usually the call to action) plays under the outro card
    if (skel.length && skel[skel.length - 1].g === last.a && skel[skel.length - 1].type !== "talking-head-stage") Object.assign(skel[skel.length - 1], outro);
    else skel.push({ ...outro, g: last.a });
  }

  // ---- talking-head runs are fixed slots: exactly one stage shot spans each of them
  const shots0 = [];
  const usedTalk = new Set();
  for (const s of skel) {
    const tr = talkRunOf(s.g);
    if (tr >= 0) {
      if (s.type !== "talking-head-stage") throw new TimedError("E_STORYBOARD", `分镜第 ${(s.i ?? 0) + 1} 条（${s.type}）落在口播段里：口播段只能用 talking-head-stage，想加动画请写进它的 left/right 侧栏`);
      if (usedTalk.has(tr)) throw new TimedError("E_STORYBOARD", `口播段 ${runs[tr].clip} 里有两条 talking-head-stage，只能有一条`);
      usedTalk.add(tr);
      shots0.push({ ...s, startSec: runs[tr].offset, talk: tr });
    } else {
      const t = M.times[s.g].start - LEAD + (s.startOffset || 0);
      shots0.push({ ...s, startSec: Math.max(0, t) });
    }
  }
  runs.forEach((run, ri) => {
    if (run.kind === "talk" && !usedTalk.has(ri)) {
      const rb = beats.filter((b) => b.run === ri);
      shots0.push({ type: "talking-head-stage", g: run.g0, startSec: run.offset, talk: ri, data: { title: input.title || parsed.title || undefined, ...autoTalkPanels(rb) } });
      warn(`口播 ${run.clip} 没有写 talking-head-stage 分镜，已自动生成（侧栏为要点卡）`);
    }
  });
  shots0.sort((a, b) => a.startSec - b.startSec || a.g - b.g);
  if (shots0.length && shots0[0].startSec > 0) shots0[0].startSec = 0;
  // a talking-head slot ends where its run ends: the next shot cannot start earlier
  for (let i = 0; i < shots0.length; i++) {
    const s = shots0[i];
    if (s.talk !== undefined) {
      const end = runs[s.talk].offset + runs[s.talk].dur;
      for (let j = i + 1; j < shots0.length && shots0[j].startSec < end; j++) shots0[j].startSec = end;
    }
  }
  // de-duplicate starts; enforce a minimal visible duration
  const shotsT = [];
  for (const s of shots0) {
    const prev = shotsT[shotsT.length - 1];
    if (prev && s.startSec - prev.startSec < 0.6) {
      warn(`镜头「${s.type}」离上一镜只有 ${(s.startSec - prev.startSec).toFixed(2)}s，太短，已并入上一镜`);
      continue;
    }
    shotsT.push(s);
  }

  // ---- concrete shots
  const TR = style.transitions;
  const shots = [];
  const lastVariant = {};
  shotsT.forEach((s, i) => {
    const startSec = s.startSec;
    const endSec_ = i + 1 < shotsT.length ? shotsT[i + 1].startSec : endSec;
    const start = F(startSec);
    const dur = Math.max(12, F(endSec_) - start);
    // chars spoken in this shot
    const gStart = s.talk !== undefined ? runs[s.talk].g0 : s.g;
    const next = shotsT[i + 1];
    const gEnd = s.talk !== undefined ? runs[s.talk].g1 : next ? (next.talk !== undefined ? runs[next.talk].g0 : next.g) : M.chars.length;
    const text = M.chars.slice(gStart, gEnd).join("").replace(/\s+/g, " ").trim();
    const ctx = { M, fps, shotStart: startSec, cursor: gStart, g0: gStart, g1: gEnd, shotId: `s${i}` };
    let data = resolveCues(JSON.parse(JSON.stringify(s.data ?? {})), ctx, startSec, s.type, warn);
    if (s.type === "talking-head-stage") {
      const run = runs[s.talk];
      const clip = media.clips[run.clip];
      data = { ...data, video: clip.src, videoFrames: clip.frames, audioUntil: dur };
      if (data.title === undefined && (input.title || parsed.title)) data.title = input.title || parsed.title;
    }
    if (s.type === "screen" && data.src && media.assets?.[data.src]) data = { ...media.assets[data.src], ...data, src: media.assets[data.src].src };
    let tr = s.transition;
    if (!tr) {
      if (s.talk !== undefined && start === 0) tr = "cut";
      else {
        const prevT = shots.length ? shots[shots.length - 1].transition : "";
        tr = TR[Math.floor(r() * TR.length)];
        if (tr === prevT) tr = TR[(TR.indexOf(tr) + 1) % TR.length];
      }
    }
    const nv = style.variants?.[s.type] ?? 1;
    let variant = s.variant ?? Math.floor(r() * nv);
    if (s.variant === undefined && nv > 1 && lastVariant[s.type] === variant) variant = (variant + 1) % nv;
    lastVariant[s.type] = variant;
    shots.push({
      id: `s${i}`,
      type: s.type,
      variant,
      start,
      dur,
      chapter: M.meta[Math.min(M.meta.length - 1, gStart)]?.chapter ?? 0,
      text,
      data,
      transition: tr,
      hideCaptions: s.captions === false ? true : s.captions === true ? false : undefined,
      auto: !!s.auto,
    });
  });

  // ---- chapters (HUD)
  const chs = parsed.chapters.map((c, ci) => {
    const b = beats.find((x) => x.chapter === ci);
    return { title: c.title, start: b ? Math.max(0, F(b.start - LEAD)) : null };
  });
  const chapters = chs
    .map((c, i) => ({ ...c, i }))
    .filter((c) => c.start !== null)
    .map((c, k, arr) => ({ title: c.title, start: k === 0 ? 0 : c.start, end: k + 1 < arr.length ? arr[k + 1].start : F(endSec) }));

  // ---- captions: karaoke timing per char from the real voice
  const kw = [...(input.keywords || []), ...(storyboard?.keywords || [])];
  const captions = [];
  for (const b of beats) {
    for (const ln of captionLines(M.chars, M.times, b.a, b.b)) {
      const hl = [];
      const chars = Array.from(ln.text);
      const mark = (re) => {
        for (const m of ln.text.matchAll(re)) {
          const a = Array.from(ln.text.slice(0, m.index)).length;
          hl.push([a, a + Array.from(m[0]).length]);
        }
      };
      mark(/\d+(?:\.\d+)?\s*(?:万|亿|千|%|倍|条|次|秒|分钟|小时|天|个)?/g);
      mark(/[A-Za-z][A-Za-z0-9 .+-]*[A-Za-z0-9]/g);
      for (const k of kw) if (k) mark(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
      captions.push({ start: Math.max(0, F(ln.start - 0.04)), end: F(ln.end + 0.3), text: ln.text, t: ln.t.map((x) => F(x)), hl: hl.length ? hl : undefined, _n: chars.length });
    }
  }
  captions.sort((a, b) => a.start - b.start);
  for (let i = 0; i < captions.length; i++) {
    const c = captions[i];
    const n = captions[i + 1];
    if (n) {
      if (n.start - c.end < 21) c.end = n.start; // bridge short gaps (no flicker)
      if (c.end > n.start) c.end = n.start;
    }
    delete c._n;
  }

  // ---- audio clips on the master timeline (talking-head audio comes from its own video)
  const audioClips = runs
    .filter((run) => run.kind === "tts")
    .map((run, k) => ({ src: media.tts.src, from: F(run.offset), trimBefore: F(run.srcStart), trimAfter: F(run.srcEnd), name: `配音 ${k + 1}` }));

  const report = {
    runs: runs.map((run) => ({ kind: run.kind, clip: run.clip, offset: run.offset, srcStart: run.srcStart, srcEnd: run.srcEnd, dur: run.dur, match: run.al.ratio })),
    beats: beats.map((b) => ({ id: b.id, start: +b.start.toFixed(2), end: +b.end.toFixed(2), chapter: b.chapter, kind: b.kind, text: b.text })),
  };

  // ---- film-level opening (TTS-only films with a presenter layer): anchors resolve against the whole script
  let opening;
  if (storyboard?.opening?.type) {
    const ctx = { M, fps, shotStart: 0, cursor: 0, g0: 0, g1: M.chars.length, shotId: "opening" };
    opening = resolveCues(JSON.parse(JSON.stringify(storyboard.opening)), ctx, 0, "opening", warn);
  }

  return {
    timeline: {
      meta: { title: input.title || parsed.title || parsed.chapters[0]?.title || "", fps, width: 1920, height: 1080, showCaptions: input.captions !== false, sfx: input.sfx !== false, ...style.meta },
      durationInFrames: F(endSec),
      chapters,
      shots,
      captions,
      audioClips,
      opening,
    },
    beats,
    report,
  };
};

// ---------- opening clip without a [口播] marker: find where its speech ends inside the script ----------
export const splitOpening = (parsed, clipRef, words, warn = () => {}) => {
  const first = parsed.sections[0];
  if (!first || first.kind !== "tts") return parsed;
  const { text } = sectionText(first);
  const chars = Array.from(text);
  // the clip says the start of the script: every clip word must be used (no free audio ends, or the empty
  // alignment would cost nothing); only the rest of the script after the clip is free
  const al = alignText(text, words, { freeS1: true });
  let cut = al.endChar;
  // snap to a sentence end close to where the clip stops talking
  let best = -1;
  for (let k = Math.max(0, cut - 6); k < Math.min(chars.length, cut + 14); k++) if (/[。！？!?；;]/.test(chars[k])) {
    best = k + 1;
    if (k + 1 >= cut) break;
  }
  if (best > 0) cut = best;
  // the clip speaks noticeably more than this section -> it probably continues into the next chapter
  const spokenN = chars.filter((c) => !/[\s，。！？；：、,.!?;:"“”（）]/.test(c)).length;
  if (cut >= chars.length - 1 && al.A.length > spokenN * 1.15) warn(`开场口播 ${clipRef} 讲的内容比第一章多，若口播还讲到了下一章，请在文案里用 [口播: ${clipRef}] 明确标出口播段落`);
  const talkParas = [];
  const restParas = [];
  let pos = 0;
  for (const p of first.paras) {
    const n = Array.from(p.text).length + 1; // + "\n"
    if (pos + n <= cut) talkParas.push(p);
    else if (pos >= cut) restParas.push(p);
    else {
      const k = cut - pos;
      const arr = Array.from(p.text);
      talkParas.push({ ...p, text: arr.slice(0, k).join("") });
      const rest = arr.slice(k).join("").trim();
      if (rest) restParas.push({ ...p, text: rest, asset: null });
    }
    pos += n;
  }
  const sections = [{ kind: "talk", clip: clipRef, chapter: first.chapter, paras: talkParas }];
  if (restParas.length) sections.push({ ...first, paras: restParas });
  return { ...parsed, sections: [...sections, ...parsed.sections.slice(1)] };
};

// human-readable beat sheet for whoever writes the storyboard
export const beatsMarkdown = (parsed, beats, report) => {
  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
  const lines = [`# 节拍表（beats）`, ``, `分镜的 start / at 锚点直接写下面台词里的原文片段即可（不用写时间）。`, ``];
  for (const r of report.runs) lines.push(`- ${r.kind === "talk" ? `口播 ${r.clip}` : "配音"}：成片 ${fmt(r.offset)}–${fmt(r.offset + r.dur)}（源 ${r.srcStart.toFixed(2)}–${r.srcEnd.toFixed(2)}s，文案匹配 ${(r.match * 100).toFixed(0)}%）`);
  let ch = -1;
  for (const b of beats) {
    if (b.chapter !== ch) {
      ch = b.chapter;
      lines.push("", `## ${parsed.chapters[ch]?.title || `第 ${ch + 1} 部分`}`, "", "| id | 时间 | 时长 | 台词 |", "|---|---|---|---|");
    }
    lines.push(`| ${b.id} | ${fmt(b.start)} | ${(b.end - b.start).toFixed(1)}s | ${b.kind === "talk" ? "🎥 " : ""}${b.text.replace(/\|/g, "\\|")} |`);
  }
  return lines.join("\n") + "\n";
};
