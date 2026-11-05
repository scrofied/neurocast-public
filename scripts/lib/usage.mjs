// 正片组件用量台账：把「上次是哪条片子用的、用过几次」变成持久记忆。
// 台账文件 usage/library.json（进仓库，跨机器共享）；开场台账在 openings/library.json，两回事。
//
// 结构：
// {
//   "rules": { "recentVideos": 3, "minRotated": 3, "maxHistory": 12 },
//   "videos": [ { "id","title","date","file","shots","types" } ],
//   "comps":  { "<id>": { "count", "videos": ["vid1",…], "lastDate", "history": [ { "video","date","shots":[…],"enters":[…] } ] } }
// }
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LEDGER = path.join(ROOT, "usage", "library.json");

const DEFAULTS = {
  rules: {
    // 近 N 条片内用过的组件，选型时要给出「刚用过」提示
    recentVideos: 3,
    // 每条片子至少要这么多个组件是近 recentVideos 条片没用过的（0 表示不检查）。
    // 不再要求「从未上过片」——库用满之后那个池子会枯，轮换休眠组件才是可持续的防重复。
    minRotated: 3,
    // 每个组件保留最近多少条片的明细
    maxHistory: 12,
  },
};

const readText = (p) => fs.readFileSync(p, "utf8").replace(/^﻿/, "");

export const load = () => {
  if (!fs.existsSync(LEDGER)) return { ...DEFAULTS, videos: [], comps: {} };
  const j = JSON.parse(readText(LEDGER));
  return { ...DEFAULTS, ...j, rules: { ...DEFAULTS.rules, ...(j.rules || {}) }, comps: j.comps || {}, videos: j.videos || [] };
};

export const save = (j) => {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify({ rules: j.rules, videos: j.videos, comps: j.comps }, null, 1) + "\n", "utf8");
  return LEDGER;
};

const dateOf = (file) => {
  const m = String(file).match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const j = /(\d{4})(\d{2})(\d{2})/.exec(String(file));
  return j ? `${j[1]}-${j[2]}-${j[3]}` : null;
};

// outro / talking-head-stage 是骨架件（每条片子都在或必然在），不参与「用没用过」的统计
export const NON_BODY = new Set(["outro", "talking-head-stage"]);
const isBody = (type) => type && !NON_BODY.has(type);

/** 从一条 timeline（Remotion 用的那份 JSON）里取出用量明细 */
export const shotsOf = (tl) => {
  const rows = [];
  const idOf = (s, i) => s.id || `s${i}`; // 渲染前的分镜草稿可能没写 id
  (tl.shots || []).forEach((s, i) => {
    // 侧栏组件挂在 talking-head-stage 的 data.left / data.right 里，
    // 骨架本身不计用量，但槽里的画面要计
    for (const side of ["left", "right"]) {
      const slot = s.data?.[side] ?? s[side];
      if (!Array.isArray(slot)) continue;
      for (const x of slot) {
        if (x && isBody(x.type)) rows.push({ type: x.type, id: `${idOf(s, i)}.${side}`, enter: x.motion?.enter || null });
      }
    }
    if (!isBody(s.type)) return;
    rows.push({ type: s.type, id: idOf(s, i), enter: s.motion?.enter || null });
  });
  return rows;
};

/**
 * 记一条片子的用量。同一 video id 重复调用 = 覆盖（幂等），方便重跑。
 * @returns {{video: object, added: number}}
 */
export const record = (tl, { video, title, file, date, ledger, opening } = {}) => {
  const j = ledger || load();
  const rows = shotsOf(tl);
  if (!rows.length) return { video: null, added: 0 };
  const vid = video || tl?.meta?.title || path.basename(path.dirname(file || "video"));
  const day = date || dateOf(file || "") || new Date().toISOString().slice(0, 10);
  const prev = j.videos.findIndex((v) => v.id === vid);
  if (prev >= 0) {
    // 覆盖旧记录：先把该视频记进去的次数扣掉
    const old = j.videos[prev];
    for (const [id, c] of Object.entries(j.comps)) c.history = c.history.filter((h) => h.video !== vid);
    for (const [id, c] of Object.entries(j.comps)) {
      const n = old.types?.[id] || 0;
      c.count = Math.max(0, c.count - n);
      c.videos = c.videos.filter((v) => v !== vid);
    }
    j.videos.splice(prev, 1);
  }
  const types = {};
  for (const r of rows) types[r.type] = (types[r.type] || 0) + 1;
  for (const [id, n] of Object.entries(types)) {
    const c = (j.comps[id] ||= { count: 0, videos: [], lastDate: null, history: [] });
    c.count += n;
    c.videos.push(vid);
    c.history.push({
      video: vid,
      date: day,
      shots: rows.filter((r) => r.type === id).map((r) => r.id),
      enters: [...new Set(rows.filter((r) => r.type === id && r.enter).map((r) => r.enter))],
    });
    if (c.history.length > j.rules.maxHistory) c.history = c.history.slice(-j.rules.maxHistory);
    c.lastDate = day;
  }
  const rec = { id: vid, title: title || tl?.meta?.title || vid, date: day, file: file ? String(file).replace(/\\/g, "/") : null, shots: rows.length, types, ...(opening ? { opening } : {}) };
  j.videos.push(rec);
  j.videos.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  // 每个组件的 videos 也按片子的时间顺序排
  const order = new Map(j.videos.map((v, i) => [v.id, i]));
  for (const c of Object.values(j.comps)) c.videos.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  save(j);
  return { video: rec, added: rows.length };
};

/** 近 N 条片（不含自己）用过的组件 → Map<id, {n, videos}> */
export const recent = (ledger, { exclude } = {}) => {
  const j = ledger || load();
  const vids = j.videos.filter((v) => v.id !== exclude).slice(-j.rules.recentVideos);
  const m = new Map();
  for (const v of vids) for (const [id, n] of Object.entries(v.types || {})) m.set(id, { n: (m.get(id)?.n || 0) + n, videos: [...(m.get(id)?.videos || []), v.id] });
  return m;
};

/** 台账里出现过（count>0）的组件 id 集合 */
export const usedIds = (ledger) => {
  const j = ledger || load();
  return new Set(Object.keys(j.comps).filter((id) => j.comps[id].count > 0));
};

/** 可统计用量的正片组件（排除开场和骨架件） */
export const bodyComps = (registry) => registry.filter((c) => c.layer !== "opening" && !NON_BODY.has(c.id));

/**
 * 选型时给一个候选组件的用量提示。
 * @returns {{count:number, videos:string[], lastDate:string|null, recentN:number, recentIn:string[], fresh:boolean, enters:string[]}}
 */
export const statsOf = (id, { ledger, rec } = {}) => {
  const j = ledger || load();
  const c = j.comps[id];
  const n = c?.count || 0;
  const r = (rec || recent(j)).get(id);
  return {
    count: n,
    videos: c?.videos || [],
    lastDate: c?.lastDate || null,
    recentN: r?.n || 0,
    recentIn: r?.videos || [],
    fresh: n === 0,
    enters: [...new Set((c?.history || []).flatMap((h) => h.enters))],
  };
};

/** 一句话用量标注（要短，表格要用），用于 pick / CATALOG */
export const usageNote = (s) => (s.fresh ? "从未上过片" : s.recentN ? `近${s.recentIn.length}条片用${s.recentN}次` : `累计${s.count}次`);

/**
 * 跨片重复检查：这条片子里用的组件，最近几条片用过没有。
 * 返回结构化结果，让调用方（make.mjs）决定怎么措辞、要不要给替代建议。
 * @param heavy  近 N 条片里出现在 ≥2 条片的组件（真的会被观众认出来的重复）
 * @param light  只在 1 条近片里出现过的组件（提醒换入场语法即可）
 * @param fresh  本片第一次出现、台账里累计 0 次的组件
 * @param rotated 本片用到、但近 N 条片都没出现过的组件（含 fresh）——轮换池
 */
export const crossVideoReport = (tl, { ledger, selfVideo } = {}) => {
  const j = ledger || load();
  const rows = shotsOf(tl);
  const mine = new Set(rows.map((r) => r.type));
  const rec = recent(j, { exclude: selfVideo });
  const heavy = [];
  const light = [];
  for (const id of [...mine].sort()) {
    const r = rec.get(id);
    if (!r) continue;
    const videos = [...new Set(r.videos)];
    (videos.length >= 2 ? heavy : light).push({ id, n: r.n, videos, count: j.comps[id]?.count || 0 });
  }
  const fresh = [...mine].filter((id) => (j.comps[id]?.count || 0) === 0);
  const rotated = [...mine].filter((id) => !rec.has(id));
  return { heavy, light, fresh, rotated, recentVideos: j.rules.recentVideos, minRotated: j.rules.minRotated, videos: j.videos.length };
};
