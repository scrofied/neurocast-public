// Forced alignment: the 文案 decides WHAT is said (captions, on-screen text); ASR word timestamps only decide WHEN.
// ASR typos (爆款→报款, 金子→精子 …) therefore never reach the screen.

const PUNCT_RE = /[\s　，。！？；：、,.!?;:"“”'‘’（）()《》〈〉【】\[\]{}「」『』…—–\-·~～|/\\*#`]/;
export const isPunct = (c) => PUNCT_RE.test(c);
const ENDERS = /[。！？!?；;：:…]/;

const norm = (c) => {
  const k = c.charCodeAt(0);
  if (k >= 0xff01 && k <= 0xff5e) c = String.fromCharCode(k - 0xfee0);
  return c.toLowerCase();
};

// accepts word-level ({words}) or segment-level ({segments}) timelines
export const wordsOf = (tl) => {
  if (Array.isArray(tl?.words) && tl.words.length) return tl.words;
  if (Array.isArray(tl?.segments) && tl.segments.length) return tl.segments.map((s) => ({ start: s.start, end: s.end, text: s.text }));
  throw new Error("时间轴里既没有 words[] 也没有 segments[]");
};

// ASR words -> char units with interpolated times
const unitsOf = (words) => {
  const out = [];
  for (const w of words) {
    const cs = Array.from(String(w.text)).filter((c) => !isPunct(c));
    if (!cs.length) continue;
    const d = Math.max(0.01, w.end - w.start) / cs.length;
    cs.forEach((c, k) => out.push({ c: norm(c), start: w.start + k * d, end: w.start + (k + 1) * d }));
  }
  return out;
};

// semi-global edit-distance alignment; free* = which ends may stay unmatched at no cost
// freeA0/freeA1: audio has extra speech before/after this text (TTS also reads the talking-head lines)
// freeS1: text continues after this audio ends (find where a clip ends inside the script)
const alignUnits = (S, A, { freeA0 = false, freeA1 = false, freeS1 = false } = {}) => {
  const n = S.length;
  const m = A.length;
  const W = m + 1;
  const tb = new Uint8Array((n + 1) * W); // 1 diag, 2 up (script char unmatched), 3 left (asr char unmatched)
  let prev = new Int32Array(W);
  let cur = new Int32Array(W);
  const lastCol = new Int32Array(n + 1);
  for (let j = 0; j <= m; j++) {
    prev[j] = freeA0 ? 0 : j;
    tb[j] = 3;
  }
  lastCol[0] = prev[m];
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    tb[i * W] = 2;
    const si = S[i - 1];
    for (let j = 1; j <= m; j++) {
      let best = prev[j - 1] + (si === A[j - 1].c ? 0 : 1);
      let dir = 1;
      const up = prev[j] + 1;
      if (up < best) {
        best = up;
        dir = 2;
      }
      const left = cur[j - 1] + 1;
      if (left < best) {
        best = left;
        dir = 3;
      }
      cur[j] = best;
      tb[i * W + j] = dir;
    }
    lastCol[i] = cur[m];
    [prev, cur] = [cur, prev];
  }
  // prev now holds row n
  let bi = n;
  let bj = m;
  let best = prev[m];
  if (freeA1)
    for (let j = 0; j <= m; j++)
      if (prev[j] < best) {
        best = prev[j];
        bi = n;
        bj = j;
      }
  if (freeS1)
    for (let i = 0; i <= n; i++)
      if (lastCol[i] < best) {
        best = lastCol[i];
        bi = i;
        bj = m;
      }
  const map = new Int32Array(n).fill(-1);
  let i = bi;
  let j = bj;
  while (i > 0 && j > 0) {
    const d = tb[i * W + j];
    if (d === 1) {
      if (S[i - 1] === A[j - 1].c) map[i - 1] = j - 1;
      else map[i - 1] = -2 - (j - 1); // substitution: keep position, mark as soft hit
      i--;
      j--;
    } else if (d === 2) i--;
    else j--;
  }
  return { map, cost: best, endS: bi };
};

/**
 * Align a spoken text to ASR words.
 * returns per-char times for every char of `text` (punctuation inherits the previous char's end)
 */
export const alignText = (text, words, opts = {}) => {
  const chars = Array.from(text);
  const idx = [];
  const S = [];
  chars.forEach((c, i) => {
    if (!isPunct(c)) {
      idx.push(i);
      S.push(norm(c));
    }
  });
  const A = unitsOf(words);
  if (!S.length || !A.length) throw new Error("对齐失败：文案或音频识别结果为空");
  const { map, endS } = alignUnits(S, A, opts);
  const n = S.length;
  const ut = new Array(n);
  let exact = 0;
  let firstA = -1;
  let lastA = -1;
  for (let k = 0; k < n; k++) {
    const v = map[k];
    if (v === -1) continue;
    const j = v >= 0 ? v : -2 - v;
    if (v >= 0) exact++;
    ut[k] = { start: A[j].start, end: A[j].end };
    if (firstA < 0) firstA = j;
    lastA = j;
  }
  // interpolate unmatched runs between their matched neighbours
  const limit = opts.freeS1 ? endS : n;
  for (let k = 0; k < n; ) {
    if (ut[k]) {
      k++;
      continue;
    }
    let e = k;
    while (e < n && !ut[e]) e++;
    const L = k > 0 ? ut[k - 1].end : e < n ? Math.max(0, ut[e].start - (e - k) * 0.18) : 0;
    const R = e < n ? ut[e].start : L + (e - k) * 0.18;
    const step = Math.max(0, R - L) / (e - k);
    for (let q = k; q < e; q++) ut[q] = { start: L + (q - k) * step, end: L + (q - k + 1) * step, interp: true, beyond: q >= limit };
    k = e;
  }
  const times = new Array(chars.length);
  let last = ut[0].start;
  let u = 0;
  for (let i = 0; i < chars.length; i++) {
    if (u < idx.length && idx[u] === i) {
      times[i] = ut[u];
      last = ut[u].end;
      u++;
    } else times[i] = { start: last, end: last, punct: true };
  }
  // script position (char index into `text`) where the audio ends — only meaningful with freeS1
  const endChar = endS >= n ? chars.length : idx[endS];
  return { chars, times, ratio: exact / n, A, firstA, lastA, endChar };
};

// where to start playing the audio when its beginning is not part of this text
export const audioTrimStart = (al) => {
  const { A, firstA } = al;
  if (firstA <= 3) return 0;
  const prevEnd = A[firstA - 1].end;
  return Math.max(prevEnd + 0.05, A[firstA].start - 0.25);
};

// ---------- beats: sentence-level units with real timings ----------
const firstIdx = (chars, a, b) => {
  for (let i = a; i < b; i++) if (!isPunct(chars[i])) return i;
  return -1;
};
const lastIdx = (chars, a, b) => {
  for (let i = b - 1; i >= a; i--) if (!isPunct(chars[i])) return i;
  return -1;
};

export const spanTime = (chars, times, a, b) => {
  const i0 = firstIdx(chars, a, b);
  const i1 = lastIdx(chars, a, b);
  if (i0 < 0) return null;
  return { start: times[i0].start, end: times[i1].end };
};

// split [a,b) at sentence enders, then split anything longer than maxSec at the comma nearest its middle
export const sentenceSpans = (chars, times, a, b, maxSec = 6.5) => {
  const raw = [];
  let s = a;
  for (let i = a; i < b; i++) {
    if (ENDERS.test(chars[i]) || chars[i] === "\n") {
      raw.push([s, i + 1]);
      s = i + 1;
    }
  }
  if (s < b) raw.push([s, b]);
  const out = [];
  const split = (x, y) => {
    const tt = spanTime(chars, times, x, y);
    if (!tt) return;
    if (tt.end - tt.start <= maxSec) return out.push([x, y]);
    const mid = (tt.start + tt.end) / 2;
    let bestK = -1;
    let bestD = Infinity;
    for (let k = x + 2; k < y - 2; k++) {
      if (!/[，,、]/.test(chars[k])) continue;
      const d = Math.abs(times[k].end - mid);
      if (d < bestD) {
        bestD = d;
        bestK = k;
      }
    }
    if (bestK < 0) return out.push([x, y]);
    split(x, bestK + 1);
    split(bestK + 1, y);
  };
  for (const [x, y] of raw) split(x, y);
  // trim leading whitespace/punctuation into the previous span so spans start on a spoken char
  return out
    .map(([x, y]) => {
      while (x < y && /\s/.test(chars[x])) x++;
      return [x, y];
    })
    .filter(([x, y]) => firstIdx(chars, x, y) >= 0);
};

// ---------- caption lines ----------
// 一个英文标识（video-shotcraft / mg-styles-15 / dashi-animationstyle）算一个不可切的整体：
// 连字符、下划线只在「前后都是字母数字」时并入这一段。
// 之前只并 [A-Za-z0-9.%]，于是 dashi-animationstyle 被切成「dashi-」+「animationstyle」两行字幕，
// 一个词拦腰断开 —— 平台细则里的「字幕展示不完整 / 文案被截断」正是判这个。
const ID_CH = /[A-Za-z0-9._%+-]/;
const isAlnum = (c) => !!c && /[A-Za-z0-9]/.test(c);
const tokens = (chars, a, b) => {
  const out = [];
  let i = a;
  while (i < b) {
    if (/[A-Za-z0-9]/.test(chars[i])) {
      let j = i;
      while (j < b && (/[A-Za-z0-9.%]/.test(chars[j]) || (ID_CH.test(chars[j]) && isAlnum(chars[j + 1])))) j++;
      out.push([i, j]);
      i = j;
    } else {
      out.push([i, i + 1]);
      i++;
    }
  }
  return out;
};
const widthOf = (chars, a, b) => {
  let w = 0;
  for (let i = a; i < b; i++) w += /[\u0000-ÿ]/.test(chars[i]) ? 0.55 : 1;
  return w;
};

// good places to break a Chinese line without a word segmenter:
// after structural particles, before adverbs/prepositions that start a new chunk
const BREAK_AFTER = /[的了着过地得吗呢吧啊呀]/;
const BREAK_BEFORE = /[就才都也还再又把被让给和与跟去来在是从到对向往]/;
// 情态动词起头是新分句（「…生成 / 能跑起来…」），但别把「不能 / 可能 / 只能」切开
const MODAL_BEFORE = /[能会要想]/;
const NEG_PREV = /[不可只才就也都很最更没未难]/;
// 动补结构是同一个词，绝不能拆到两行：「能跑起 / 来的」就是坏断行
const COMPLEMENT = /(起来|出来|下来|过来|回来|上去|下去|进去|出去)/;
// 数词/指示词 + 量词同理：「写成 一 / 个 Skill」这种断行＝文案被截断
const NUM_W = "一两二三三四五六七八九十几每那这什哪";
const MEASURE = "个条次台种样些儿本张位家部天年月号遍下点块件项步句字页款双份名回只";
const keepTogether = (prev, next) =>
  COMPLEMENT.test(String(prev ?? "") + String(next ?? "")) ||
  (NUM_W.includes(prev ?? "") && MEASURE.includes(next ?? ""));

// split one over-long phrase into k lines near equal width, preferring natural break points
// (no orphans like a lone "宝剑", no breaks inside 排行榜)
const balance = (chars, x, y, maxW) => {
  const total = widthOf(chars, x, y);
  // add lines until none is wider than maxW (natural break points can make a line run long)
  for (let k = Math.ceil(total / maxW); k <= Math.ceil(total / maxW) + 3; k++) {
    const out = balanceK(chars, x, y, maxW, k);
    if (out.every(([a, b]) => widthOf(chars, a, b) <= maxW + 0.5)) return out;
  }
  return balanceK(chars, x, y, maxW, Math.ceil(total / maxW) + 3);
};
const balanceK = (chars, x, y, maxW, k) => {
  const tks = tokens(chars, x, y);
  const total = widthOf(chars, x, y);
  const target = total / k;
  const out = [];
  let s = 0; // token index where the current line starts
  for (let line = 0; line < k - 1; line++) {
    let best = -1;
    let bestScore = Infinity;
    let w = 0;
    for (let i = s; i < tks.length - 1; i++) {
      w += widthOf(chars, tks[i][0], tks[i][1]);
      const d = Math.abs(w - target);
      if (d > 5) {
        if (w > target) break;
        continue;
      }
      const prevC = chars[tks[i][1] - 1];
      const nextC = chars[tks[i + 1][0]];
      const modal = MODAL_BEFORE.test(nextC) && !NEG_PREV.test(prevC) ? 3 : 0;
      const splitComplement = keepTogether(prevC, nextC) ? 12 : 0;
      const score = d - (BREAK_AFTER.test(prevC) ? 2.5 : 0) - (BREAK_BEFORE.test(nextC) ? 2 : 0) - modal + splitComplement;
      if (score < bestScore) {
        bestScore = score;
        best = i + 1;
      }
    }
    if (best < 0) break;
    out.push([tks[s][0], tks[best][0]]);
    s = best;
  }
  out.push([tks[s][0], y]);
  return out;
};

// captions: phrases (split at punctuation) packed greedily into lines of <= maxW em, never across a sentence end;
// a phrase wider than maxW is split at natural break points. 12 em = the "≤12 字一行" rule for vertical-friendly captions
export const CAPTION_MAX = 12;
export const captionLines = (chars, times, a, b, maxW = CAPTION_MAX) => {
  const phrases = [];
  let s = a;
  for (let i = a; i < b; i++) {
    if (/[，。！？；：、,!?;:]/.test(chars[i])) {
      phrases.push([s, i + 1]);
      s = i + 1;
    }
  }
  if (s < b) phrases.push([s, b]);
  const lines = [];
  let cur = null;
  for (const [x, y] of phrases) {
    // +0.01：0.55 宽的英文字符累加会带浮点毛刺（20×0.55 = 11.000000000000002），
    // 不加容差时一条刚好 12 em 的短语会被当成超长，拦腰切开一个英文单词。
    const w = widthOf(chars, x, y);
    if (w > maxW + 0.01) {
      if (cur) lines.push(cur);
      cur = null;
      lines.push(...balance(chars, x, y, maxW));
      continue;
    }
    const endsSentence = cur && ENDERS.test(chars[cur[1] - 1]);
    if (cur && !endsSentence && widthOf(chars, cur[0], y) <= maxW + 0.01) cur[1] = y;
    else {
      if (cur) lines.push(cur);
      cur = [x, y];
    }
  }
  if (cur) lines.push(cur);
  const merged = lines;
  return merged
    .map(([x, y]) => {
      // drop leading/trailing punctuation from what is displayed, keep ？！
      while (x < y && (isPunct(chars[x]) || /\s/.test(chars[x]))) x++;
      while (y > x && /[\s，。；：、,.;:]/.test(chars[y - 1])) y--;
      if (y <= x) return null;
      const tt = spanTime(chars, times, x, y);
      if (!tt) return null;
      const text = chars.slice(x, y).join("");
      const t = [];
      for (let i = x; i < y; i++) t.push(times[i].start);
      return { a: x, b: y, text, start: tt.start, end: tt.end, t };
    })
    .filter(Boolean);
};
