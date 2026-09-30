// Rule-based content detectors. Each returns { type, data, score } or null.
// Order of preference is decided by score; the planner also enforces variety.

const CN_NUM = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const cnToInt = (s) => {
  if (/^\d+$/.test(s)) return +s;
  if (s === "十") return 10;
  if (s.length === 2 && s[0] === "十") return 10 + (CN_NUM[s[1]] ?? 0);
  if (s.length === 2 && s[1] === "十") return (CN_NUM[s[0]] ?? 0) * 10;
  if (s.length === 3 && s[1] === "十") return (CN_NUM[s[0]] ?? 0) * 10 + (CN_NUM[s[2]] ?? 0);
  return CN_NUM[s] ?? NaN;
};

const clean = (s) => s.replace(/[，。！？；：、,.!?;:"“”'‘’（）()\s]+$/g, "").replace(/^[，。！？；：、,.!?;:"“”'‘’（）()\s]+/g, "").trim();
const short = (s, n = 12) => {
  s = clean(s);
  return Array.from(s).length > n ? Array.from(s).slice(0, n).join("") : s;
};

// ---------- keyword extraction (no jieba: pattern + frequency heuristics) ----------
const STOP = new Set("我们 你们 他们 这个 那个 就是 一个 什么 怎么 因为 所以 但是 然后 如果 可以 已经 还是 没有 不是 这样 那样 真的 其实 大家 自己 现在 时候 今天 一下 一些 知道 觉得 需要 我们的 你的 他的 这种 那种 而且 或者 只是 还有 这里 那里 起来 出来 东西 问题".split(" "));

export const keywords = (text, max = 4) => {
  const out = [];
  const push = (w) => {
    w = clean(w);
    if (!w || STOP.has(w) || Array.from(w).length < 2 || Array.from(w).length > 10) return;
    if (!out.includes(w)) out.push(w);
  };
  // quoted terms first
  for (const m of text.matchAll(/[“"「『《]([^”"」』》]{2,12})[”"」』》]/g)) push(m[1]);
  // latin terms / product names
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9.\-+]{1,20}/g)) push(m[0]);
  // "X是Y" -> X
  for (const m of text.matchAll(/([一-龥]{2,6})(?:是|叫|就是|等于)/g)) push(m[1]);
  // split on function words, keep 2-6 char chunks
  const chunks = text.split(/[，。！？；：、,.!?;:\s的了是在和与把被让给对就也都很更最又还要会能说做用]+/).filter(Boolean);
  const scored = chunks
    .map((c) => clean(c))
    .filter((c) => Array.from(c).length >= 2 && Array.from(c).length <= 6)
    .sort((a, b) => Array.from(b).length - Array.from(a).length);
  for (const c of scored) push(c);
  return out.slice(0, max);
};

// ---------- detectors ----------
export const detectCode = (seg) => {
  const m = seg.raw.match(/```(\w+)?\n([\s\S]*?)```/);
  if (!m) return null;
  return { type: "code", score: 100, data: { code: m[2].replace(/\n$/, ""), lang: m[1] || "py", title: short(seg.spoken.split(/[。！？]/)[0] || "", 16) || undefined } };
};

export const detectTalkingHead = (seg) => {
  const m = seg.raw.match(/\[视频:\s*([^\]]+\.mp4)\]/i);
  if (!m) return null;
  return { type: "talking-head", score: 105, data: { video: m[1].trim() } };
};

export const detectImage = (seg) => {
  const m = seg.raw.match(/\[(?:图|截图|录屏|视频|img|image|video)\s*[:：]\s*([^\]]+)\]/i);
  if (!m) return null;
  const src = m[1].trim();
  const isVideo = /\.(mp4|mov|webm|mkv)$/i.test(src) || /录屏|视频|video/i.test(seg.raw.slice(m.index, m.index + 6));
  return { type: "screen", score: 100, data: { src, kind: isVideo ? "video" : "image" } };
};

const TIME_RE = /((?:19|20)\d{2})\s*年(?:\s*(\d{1,2})\s*月)?/g;
export const detectTimeline = (seg) => {
  const hits = [...seg.spoken.matchAll(TIME_RE)];
  if (hits.length < 2) return null;
  const events = [];
  for (let i = 0; i < hits.length && events.length < 6; i++) {
    const h = hits[i];
    const end = i + 1 < hits.length ? hits[i + 1].index : seg.spoken.length;
    let txt = seg.spoken.slice(h.index + h[0].length, end).split(/[。！？；]/)[0];
    txt = txt.replace(/^[，,、\s]*/, "");
    const time = h[2] ? `${h[1]}.${h[2]}` : h[1];
    if (events.some((e) => e.time === time)) continue;
    events.push({ time, text: short(txt, 14) || "关键节点" });
  }
  if (events.length < 2) return null;
  return { type: "timeline", score: 90, data: { events } };
};

const STEP_RE = /(第[一二三四五六七八九十\d]+步|首先|其次|然后|接着|再然后|最后|第[一二三四五六七八九十\d]+[，,、])/g;
export const detectSteps = (seg) => {
  const s = seg.spoken;
  const marks = [...s.matchAll(STEP_RE)];
  if (marks.length < 2) return null;
  const steps = [];
  for (let i = 0; i < marks.length && steps.length < 6; i++) {
    const st = marks[i].index + marks[i][0].length;
    const en = i + 1 < marks.length ? marks[i + 1].index : s.length;
    const body = s.slice(st, en).replace(/^[，,、：:\s]*/, "");
    const kw = short(body.split(/[，。！？；,]/)[0], 8);
    if (kw) steps.push(kw);
  }
  if (steps.length < 2) return null;
  return { type: "flow", score: 85, data: { steps } };
};

const LIST_HEAD = /([一二三四五六七八九十两\d]+)\s*(?:个|种|件|条|点|招|步|类|大)/;
export const detectList = (seg) => {
  const s = seg.spoken;
  // enumerations: 第一…第二… / 一是…二是… / A、B、C
  const ord = [...s.matchAll(/(?:第[一二三四五六七八九十]|[一二三四五六]是)[，,、：:\s]*([^，。！？；]{2,16})/g)];
  if (ord.length >= 2) return { type: "cards", score: 75, data: { items: ord.slice(0, 5).map((m) => ({ title: short(m[1], 10) })) } };
  const enumM = s.match(/([一-龥A-Za-z0-9]{2,8}(?:、[一-龥A-Za-z0-9]{2,8}){2,5})/);
  if (enumM) {
    const items = enumM[1].split("、").map((x) => ({ title: x }));
    const head = s.match(LIST_HEAD);
    return { type: "cards", score: 70, data: { items, title: head ? short(s.slice(0, head.index + head[0].length + 6), 14) : undefined } };
  }
  return null;
};

const VS_RE = /(.{2,12}?)\s*(?:vs|VS|对比|相比|和|跟)\s*(.{2,12}?)(?:的区别|有什么不同|比起来|相比)/;
export const detectVersus = (seg) => {
  const s = seg.spoken;
  let m = s.match(/以前([^，。！？]{2,16})[，,。；]\s*(?:现在|如今|而现在)([^，。！？]{2,16})/);
  if (m) return { type: "versus", score: 80, data: { left: { label: "以前", points: [short(m[1], 12)] }, right: { label: "现在", points: [short(m[2], 12)] } } };
  m = s.match(/不是([^，。！？]{2,14})[，,]\s*而是([^，。！？]{2,14})/);
  if (m) return { type: "versus", score: 72, data: { left: { label: short(m[1], 8), points: [] }, right: { label: short(m[2], 8), points: [] } } };
  m = s.match(/传统([^，。！？]{2,14})[，,。；]\s*(?:而|但)?\s*(?:AI|用AI|有了AI)([^，。！？]{2,14})/);
  if (m) return { type: "versus", score: 78, data: { left: { label: "传统方式", points: [short(m[1], 12)] }, right: { label: "AI 方式", points: [short(m[2], 12)] } } };
  m = s.match(VS_RE);
  if (m) return { type: "versus", score: 70, data: { left: { label: short(m[1], 8) }, right: { label: short(m[2], 8) } } };
  return null;
};

const NUM_RE = /(\d+(?:\.\d+)?)\s*(%|％|倍|万|亿|千|个小时|小时|分钟|秒|天|块|元|美元|人|次|条|篇|个)/g;
export const detectNumbers = (seg) => {
  const hits = [...seg.spoken.matchAll(NUM_RE)];
  if (!hits.length) return null;
  if (hits.length >= 3) {
    // multiple numbers with same unit -> growth curve
    const unit = hits[0][2];
    const same = hits.filter((h) => h[2] === unit);
    if (same.length >= 3) {
      const points = same.slice(0, 6).map((h, i) => {
        const before = seg.spoken.slice(Math.max(0, h.index - 8), h.index);
        const lab = before.match(/((?:19|20)\d{2}年|\d{1,2}月|[一-龥]{2,4})[^一-龥]*$/);
        return { label: lab ? lab[1] : `#${i + 1}`, value: parseFloat(h[1]) };
      });
      return { type: "growth", score: 82, data: { points, unit: unit === "％" ? "%" : unit } };
    }
  }
  const h = hits.sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]))[0];
  const after = seg.spoken.slice(h.index + h[0].length).split(/[，。！？；]/)[0];
  const before = seg.spoken.slice(0, h.index).split(/[，。！？；]/).pop();
  let label = short(after, 14) || short(before, 14);
  const unit = h[2] === "％" ? "%" : h[2];
  return { type: "number", score: 68, data: { value: parseFloat(h[1]), unit, label } };
};

export const detectFunnel = (seg) => {
  if (!/漏斗|转化|留存|筛/.test(seg.spoken)) return null;
  const hits = [...seg.spoken.matchAll(/(\d+(?:\.\d+)?)\s*(万|千|个|人|%)?\s*(?:个|人)?([一-龥]{2,6})/g)];
  if (hits.length < 3) return null;
  return { type: "funnel", score: 84, data: { stages: hits.slice(0, 5).map((h) => ({ value: h[1] + (h[2] ?? ""), label: h[3] })) } };
};

// metaphor detectors: concept keywords -> animated scene
const METAPHORS = [
  { type: "agents", re: /(Agent|智能体|多个AI|AI团队|分工|协作|Skill|技能包|插件)/i, score: 60, data: (s) => ({ center: /Skill/i.test(s) ? "Claude" : "你", agents: keywords(s, 5).length >= 3 ? keywords(s, 5).map((k) => short(k, 5)) : undefined }) },
  { type: "vault", re: /(知识库|RAG|向量|文档库|检索|资料库)/i, score: 62, data: (s) => ({}) },
  { type: "prompt", re: /(提示词|Prompt|指令|问它|跟它说|告诉它|喂给)/i, score: 58, data: (s) => { const m = s.match(/[“"「]([^”"」]{2,18})[”"」]/); return { input: m ? m[1] : undefined }; } },
  { type: "assembly", re: /(自动化|流水线|批量|一键|量产|规模化|自动)/, score: 55, data: () => ({}) },
  { type: "neural", re: /(大模型|神经网络|模型|LLM|GPT|Claude|DeepSeek|Kimi|训练|推理|参数)/i, score: 52, data: () => ({}) },
];

export const detectMetaphor = (seg) => {
  const out = [];
  for (const m of METAPHORS) if (m.re.test(seg.spoken)) out.push({ type: m.type, score: m.score, data: m.data(seg.spoken) });
  return out;
};

export const detectQuote = (seg) => {
  const s = seg.spoken;
  const sentences = s.split(/(?<=[。！？!?])/).map(clean).filter(Boolean);
  const cand = sentences.find((x) => /(记住|本质|核心|说白了|一句话|真正|关键是|不是.+而是)/.test(x) && Array.from(x).length <= 30);
  if (!cand) return null;
  const text = cand.replace(/^(记住|所以|说白了|一句话)[，,：:]?/, "");
  const m = text.match(/而是(.{2,10})/) || text.match(/是(.{2,10})$/);
  return { type: "quote", score: 64, data: { text, emphasis: m ? [clean(m[1])] : [] } };
};

// ---------- detectors for the newer assets: only when the data can be taken from the text itself ----------
// "第一个，Agent Browser，87万次下载" -> tool card
export const detectToolIntro = (seg) => {
  const m = seg.spoken.match(/第([一二三四五六七八九十\d]+)个[，,、:：\s]*([A-Za-z][A-Za-z0-9 .+-]{1,30}[A-Za-z0-9]|[一-龥]{2,8})[，,、\s]*(\d+(?:\.\d+)?)\s*(万|千)?\s*(?:次|人)?下载/);
  if (!m) return null;
  const v = parseFloat(m[3]) * (m[4] === "万" ? 1e4 : m[4] === "千" ? 1e3 : 1);
  const role = (seg.spoken.match(/它管([一-龥]{1,6})/) || [])[1];
  return { type: "tool-card", score: 88, data: { tools: [{ name: m[2].trim(), downloads: v, role: role ? `它管${role}` : undefined }], focus: 0 } };
};

const CLOCK = { 早上: "08:00", 上午: "10:00", 中午: "12:00", 下午: "15:00", 晚饭前: "18:00", 下班前: "18:00", 傍晚: "18:00", 晚上: "20:00", 今晚: "21:00" };
// "早上挖到的痛点，晚饭前就能发出去" -> day clock
export const detectSameDay = (seg) => {
  const m = seg.spoken.match(/(早上|上午|中午|下午)([^，。！？]{1,10})[，,]\s*([^，。！？]{0,4}?)(晚饭前|下班前|傍晚|晚上|今晚)([^，。！？]{1,10})/);
  if (!m) return null;
  const ev = (s) => short(s.replace(/^(就能|就|都|能|可以)/, ""), 6);
  return { type: "day-clock", score: 80, data: { from: { label: m[1], time: CLOCK[m[1]], event: ev(m[2]), at: m[1] }, to: { label: m[4], time: CLOCK[m[4]], event: ev(m[5]), at: m[4] } } };
};

// "把封面、正文、话题标签、分镜，一直到口播成片，一条全配齐" -> checklist
export const detectDeliverables = (seg) => {
  const s = seg.spoken;
  if (!/(一直到|全配齐|全套|一条龙|全都|一次性)/.test(s)) return null;
  const m = s.match(/([一-龥A-Za-z]{2,5}(?:、[一-龥A-Za-z]{2,5}){2,5})/);
  if (!m) return null;
  const items = m[1].split("、");
  const tail = s.match(/一直到([一-龥A-Za-z]{2,5})/);
  if (tail && !items.includes(tail[1])) items.push(tail[1]);
  const done = s.match(/(一条全配齐|全配齐|一条龙|全套搞定)/);
  return { type: "checklist", score: 84, data: { items: items.slice(0, 6).map((x) => ({ text: x, at: x })), done: done ? { text: done[1], at: done[1] } : undefined } };
};

// "发出去就是石沉大海" -> sink
export const detectNoReach = (seg) => {
  const m = seg.spoken.match(/(石沉大海|零播放|0 ?播放|没人看)/);
  if (!m) return null;
  return { type: "sink", score: 76, data: { label: m[1] === "没人看" ? "没人看" : "石沉大海", sinkAt: m[1] } };
};

// talking-head clips are handled by the timed pipeline (talking-head-stage), not by a detector
export const DETECTORS = [detectCode, detectImage, detectToolIntro, detectSameDay, detectDeliverables, detectNoReach, detectTimeline, detectFunnel, detectSteps, detectVersus, detectNumbers, detectList, detectQuote];
export { clean, short, cnToInt };
