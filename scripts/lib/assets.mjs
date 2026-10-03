// 真实素材台账：哪张真截图/真录屏/真 logo 进过哪条片子、有没有出处、被用过几次。
// 台账文件 assets/library.json（进仓库，跨机器共享）。
//
// 为什么要有它：素材是一次性成本。同一张 LMArena 截图今年用过三次，
// 再截一次就是浪费；反过来，「手里有 40 张素材但只有 3 张上过片」也要看得见。
//
// 结构：
// {
//   "rules": { "minRatio": 0.2, "recentVideos": 3 },
//   "videos": [ { "id", "date", "file", "assetSec", "totalSec", "ratio", "refs": ["origin…"] } ],
//   "assets": { "<origin>": { "kind", "aspect", "md5", "source", "capturedAt", "note",
//                             "used_in": ["screen"…], "shows": [ { "video","date","shots":[…] } ] } }
// }
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LEDGER = path.join(ROOT, "assets", "library.json");

const DEFAULTS = {
  rules: {
    // 一条片子里「上了真素材的镜头时长」占全片时长的下限；低于它就是在用代码动画糊弄观众
    minRatio: 0.2,
    recentVideos: 3,
  },
};

const readText = (p) => fs.readFileSync(p, "utf8").replace(/^﻿/, "");

export const load = () => {
  if (!fs.existsSync(LEDGER)) return { ...DEFAULTS, videos: [], assets: {} };
  const j = JSON.parse(readText(LEDGER));
  return { ...DEFAULTS, ...j, rules: { ...DEFAULTS.rules, ...(j.rules || {}) }, videos: j.videos || [], assets: j.assets || {} };
};

export const save = (j) => {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify({ rules: j.rules, videos: j.videos, assets: j.assets }, null, 1) + "\n", "utf8");
  return LEDGER;
};

// ---------- 素材字段读取（和 make.mjs 的 assetFields 语法一致） ----------
const dig = (obj, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);
const parentOf = (obj, p) => {
  const parts = p.split(".");
  parts.pop();
  return parts.length ? parts.reduce((a, k) => (a == null ? a : a[k]), obj) : obj;
};
/** 一个字段里的素材：{ v: 路径, origin: 同层的原始路径 }（fillAssets 会把 prepAssets 的 origin 一起铺进时间轴） */
export const entriesOf = (data, field) => {
  if (!data) return [];
  const m = /^([\w.]+)\[\]\.(.+)$/.exec(field);
  if (m) {
    return (data[m[1]] || [])
      .map((el) => {
        const v = dig(el, m[2]);
        return typeof v === "string" && v ? { v, origin: el?.origin } : null;
      })
      .filter(Boolean);
  }
  const bare = /^([\w.]+)\[\]$/.exec(field); // pages[]：整串都是路径，原始路径记在上一层
  if (bare) return (data[bare[1]] || []).filter((v) => typeof v === "string" && v).map((v) => ({ v, origin: data.origin }));
  const v = dig(data, field);
  if (typeof v !== "string" || !v) return [];
  return [{ v, origin: parentOf(data, field)?.origin }];
};
export const valuesOf = (data, field) => entriesOf(data, field).map((e) => e.v);

// 素材有没有真到手：prepAssets 会把路径换成 jobs/ 下的副本（或保留 http 外链）；
// 没到手的字段留的是分镜里写的原话，等于「点名了但没截图」。
export const isReal = (v) => /^https?:/i.test(v) || /^jobs[\/\\]/i.test(v);

/** 每个镜头的素材情况：{ id, type, text, fields, got:[路径], gotE:[{v,origin}], missing:[路径] } */
export const shotAssets = (tl, assetFields = {}) =>
  (tl.shots || []).map((s, i) => {
    const fields = assetFields[s.type] || [];
    const gotE = [];
    const missing = [];
    const scan = (data, type) => {
      for (const f of assetFields[type] || [])
        for (const e of entriesOf(data, f)) {
          if (isReal(e.v)) gotE.push(e);
          else missing.push(e.v);
        }
    };
    scan(s.data, s.type);
    // 侧栏槽位里的组件也算（talking-head-stage 的 left/right；老时间轴里这两槽可能是单个对象）
    for (const side of ["left", "right"]) {
      const slot = s.data?.[side];
      for (const x of Array.isArray(slot) ? slot : slot ? [slot] : []) scan(x?.data, x?.type);
    }
    return { id: s.id || `s${i}`, type: s.type, text: s.text || "", start: s.start, dur: s.dur, fields, got: gotE.map((e) => e.v), gotE, missing };
  });

/** 素材占比：上了真素材的镜头时长 / 全片时长 */
export const ratioOf = (tl, assetFields = {}) => {
  const rows = shotAssets(tl, assetFields);
  const total = rows.reduce((a, r) => a + (r.dur || 0), 0);
  const withAsset = rows.filter((r) => r.got.length);
  const asset = withAsset.reduce((a, r) => a + (r.dur || 0), 0);
  return {
    total,
    asset,
    pct: total ? asset / total : 0,
    shots: rows.length,
    assetShots: withAsset.length,
    files: [...new Set(withAsset.flatMap((r) => r.got))],
    minRatio: load().rules.minRatio,
  };
};

/** 缺素材清单：分镜点名要真东西、但手上没有文件的那些镜头（管线#8） */
export const checklist = (tl, assetFields = {}) =>
  shotAssets(tl, assetFields).filter((r) => r.fields.length && !r.got.length);

const md5 = (abs) => (fs.existsSync(abs) ? crypto.createHash("md5").update(fs.readFileSync(abs)).digest("hex").slice(0, 12) : null);

/**
 * jobs 副本名 -> 原始路径。make.mjs 每次prepAssets 会在 job 目录留一份 assets.json，
 * 补记历史片子（harvest / record）时读它，台账才不会记成一堆 a0/a1/a2。
 */
export const originResolver = (tlFile) => {
  const p = tlFile ? path.join(path.dirname(tlFile), "assets.json") : null;
  let m = new Map();
  if (p && fs.existsSync(p)) {
    try {
      const j = JSON.parse(readText(p));
      m = new Map(Object.values(j).filter((a) => a?.src).map((a) => [a.src, a.origin || a.src]));
    } catch {
      /* 对照表坏了就用副本名，至少不炸 */
    }
  }
  return (v) => m.get(v) || v;
};

const dateOf = (s) => {
  const m = String(s).match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/**
 * 记一条片子的素材使用。同一 video id 重复调用 = 覆盖（幂等）。
 * @param originOf 可选：把 timeline 里的 jobs/… 路径映射回素材的原始路径（make.mjs 有这张表）
 */
export const record = (tl, { video, file, date, assetFields = {}, originOf, ledger } = {}) => {
  const j = ledger || load();
  const rows = shotAssets(tl, assetFields);
  const used = rows.filter((r) => r.got.length);
  const vid = video || tl?.meta?.title || path.basename(path.dirname(file || "video"));
  const day = date || dateOf(file || "") || new Date().toISOString().slice(0, 10);
  const total = rows.reduce((a, r) => a + (r.dur || 0), 0);
  const asset = used.reduce((a, r) => a + (r.dur || 0), 0);
  const fps = tl?.fps || 30;

  const prev = j.videos.findIndex((v) => v.id === vid);
  if (prev >= 0) {
    // 覆盖旧记录：先把这条片子记过的出镜扣掉
    for (const o of j.videos[prev].refs || []) {
      const a = j.assets[o];
      if (!a) continue;
      a.shows = a.shows.filter((h) => h.video !== vid);
      if (!a.shows.length) delete j.assets[o];
    }
    j.videos.splice(prev, 1);
  }

  const refs = [];
  for (const r of used) {
    for (const e of r.gotE) {
      const v = e.v;
      // 台账按「原始文件」记账，不按 public/jobs 里的一次性副本：同一张图用三次要看得见
      const origin = (/^https?:/i.test(v) ? v : originOf?.(v)) || e.origin || v;
      refs.push(origin);
      const cand = [/^https?:/i.test(v) ? null : path.join(ROOT, "public", v), !/^https?:/i.test(origin) && (path.isAbsolute(origin) ? origin : path.join(ROOT, origin))].filter(Boolean);
      const abs = cand.find((p) => fs.existsSync(p)) || null;
      const a = (j.assets[origin] ||= { kind: null, aspect: null, md5: null, source: null, capturedAt: null, note: null, used_in: [], shows: [] });
      // 没对照表（assets.json）的历史片子只能记到 jobs 副本上，而 public/jobs/ 不进仓库、随时会被清掉。
      // 与其让它看起来像一条正常记录，明确标注「原始路径未知」，用的时候一眼就知道。
      if (/^jobs[\/\\]/i.test(origin) && !a.note) a.note = "原始路径未知：这条片子出片时还没有 assets.json 对照表";
      if (abs && !a.md5) a.md5 = md5(abs);
      const shot = (tl.shots || []).find((s) => s.type === r.type && (s.id || "") === r.id);
      const src = shot?.data?.source ?? null;
      if (shot?.data?.kind) a.kind = shot.data.kind;
      else if (/^https?:/i.test(v) || /\.(mp4|mov|webm|mkv)$/i.test(v)) a.kind = a.kind || "video";
      else a.kind = a.kind || "image";
      if (Number.isFinite(shot?.data?.aspect)) a.aspect = +Number(shot.data.aspect).toFixed(3);
      if (src?.platform) a.source = src.platform;
      if (src?.capturedAt) a.capturedAt = src.capturedAt;
      if (!a.used_in.includes(r.type)) a.used_in.push(r.type);
      if (!a.shows.some((h) => h.video === vid)) a.shows.push({ video: vid, date: day, shots: [r.id] });
      else {
        const h = a.shows.find((x) => x.video === vid);
        if (!h.shots.includes(r.id)) h.shots.push(r.id);
      }
    }
  }
  j.videos.push({ id: vid, date: day, file: file ? String(file).replace(/\\/g, "/") : null, assetSec: +(asset / fps).toFixed(1), totalSec: +(total / fps).toFixed(1), ratio: total ? +(asset / total).toFixed(3) : 0, refs: [...new Set(refs)] });
  j.videos.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  save(j);
  return { video: vid, files: [...new Set(refs)].length, ratio: total ? asset / total : 0 };
};

// ---------- 报表 ----------
const pad = (s, n) => {
  s = String(s ?? "");
  // CJK 占两格，padEnd 按字符数补会错位，这里按显示宽度补
  const w = Array.from(s).reduce((a, ch) => a + (/[\u4e00-\u9fa5，。！？：；（）「」｜·]/.test(ch) ? 2 : 1), 0);
  return s + " ".repeat(Math.max(0, n - w));
};

export const report = (j = load()) => {
  const lines = [];
  const ids = Object.keys(j.assets).sort((a, b) => (j.assets[b].shows.length || 0) - (j.assets[a].shows.length || 0));
  const totalShows = ids.reduce((a, k) => a + j.assets[k].shows.length, 0);
  const used = ids.filter((k) => j.assets[k].shows.length);
  lines.push(`素材台账：${ids.length} 个素材 · 上过片 ${used.length} 个 · 累计 ${totalShows} 次出镜 · ${j.videos.length} 条片子`);
  if (j.videos.length) {
    lines.push("");
    lines.push(`${pad("片子", 34)}${pad("日期", 12)}${pad("素材占比", 10)}素材镜头`);
    for (const v of [...j.videos].reverse().slice(0, 20)) {
      const pct = `${(v.ratio * 100).toFixed(1)}%`;
      lines.push(`${pad(v.id, 34)}${pad(v.date, 12)}${pad(v.ratio < j.rules.minRatio ? `${pct} ⚠` : pct, 10)}${(v.refs || []).length}`);
    }
  }
  lines.push("");
  lines.push(`${pad("素材", 44)}${pad("类型", 7)}${pad("出处", 16)}${pad("采集", 12)}出镜`);
  // 台账按原始路径记账，但历史片子只能记到 jobs/<任务>/a0.png 这种一次性副本名——
  // 不同任务里同名文件（a0.png）在表里会长得一模一样，看不出是两个素材，所以同名时带上任务目录。
  const baseOf = (k) => path.basename(k, path.extname(k));
  const count = {};
  for (const k of ids) count[baseOf(k)] = (count[baseOf(k)] || 0) + 1;
  const nameOf = (k) => {
    const b = baseOf(k);
    const shown = count[b] > 1 ? `${path.basename(path.dirname(k))}/${b}` : b;
    return (j.assets[k].note || /^jobs[\/\\]/i.test(k) ? `${shown} ?` : shown).slice(0, 42);
  };
  for (const k of ids) {
    const a = j.assets[k];
    lines.push(`${pad(nameOf(k), 44)}${pad(a.kind || "-", 7)}${pad(a.source || "（没写来源）", 16)}${pad(a.capturedAt || "-", 12)}${a.shows.length}×${[...new Set(a.used_in)].join(",")}`);
  }
  const anon = ids.filter((k) => j.assets[k].note || /^jobs[\/\\]/i.test(k)).length;
  if (anon) lines.push(`\n  ? 原始路径未知（出片时还没有 assets.json 对照表）：${anon} 个。这类素材下次重跑片子就会自动归到真名下。`);
  return lines.join("\n");
};

/** 从没上过片的素材（拍都拍了，就别让它躺着） */
export const unused = (j = load()) => Object.keys(j.assets).filter((k) => !j.assets[k].shows.length).map((k) => ({ origin: k, ...j.assets[k] }));

/** 内容相同但路径不同的素材：同一张图重复截图 / 复制多份 */
export const dup = (j = load()) => {
  const by = new Map();
  for (const [k, a] of Object.entries(j.assets)) {
    if (!a.md5) continue;
    (by.get(a.md5) || by.set(a.md5, []).get(a.md5)).push(k);
  }
  return [...by.entries()].filter(([, ks]) => ks.length > 1).map(([m, ks]) => ({ md5: m, origins: ks }));
};
