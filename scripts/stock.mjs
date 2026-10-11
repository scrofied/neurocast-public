// 免费素材站抓取：把「画面需要的真图标 / 真氛围镜头」变成一条命令的事。
//
//   node scripts/stock.mjs sites                                    站点能力 + license + 要不要署名（一张表）
//   node scripts/stock.mjs brands [--color] [--only-missing] [--dry] 用 Simple Icons 补齐 public/brands/ 的真 logo
//   node scripts/stock.mjs icons <合集> <名字…> [--color HEX]        从 Iconify 合集抽矢量图标存本地
//   node scripts/stock.mjs search <站> <关键词> [--type video] [--n 12] [--landscape] [--min 1920]
//   node scripts/stock.mjs get <站:id | 直链> [--res 1080] [--as 名字]  下载到 public/assets/stock/ 并记出处
//   node scripts/stock.mjs license [关键词]                          查库存素材的署名义务（出片前核对）
//
// 三条硬规矩（都是被驳回换来的，别绕过）：
//   1. 库存素材只当「示意画面」，不许顶替真实截图/真数据 —— make.mjs --plan-only 会在证据类槽位直接报错。
//   2. 库存素材不计入「素材占比 ≥20%」—— 那个指标量的是真东西够不够多。
//   3. API key 只从环境变量（PEXELS_API_KEY / PIXABAY_API_KEY / UNSPLASH_ACCESS_KEY）或仓库外的
//      ~/.neurocast/stock.env 读；本脚本任何输出都不回显 key，下载物不进 git。
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const STOCK_DIR = path.join(PUB, "assets", "stock"); // 分镜里写 assets/stock/<站>/<id>.mp4
const STOCK_INDEX = path.join(ROOT, "assets", "stock-index.json"); // 只记出处，不记内容
const ICON_DIR = path.join(PUB, "assets", "icons");
const BRAND_DIR = path.join(PUB, "brands");
const BRAND_LIB = path.join(ROOT, "brands", "library.json");
const CACHE = path.join(ROOT, "assets", ".cache");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const argv = process.argv.slice(2);
const cmd = argv[0] || "sites";
const rest = argv.slice(1);
const flag = (n) => argv.includes(`--${n}`);
const val = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const positional = rest.filter((a, i) => !a.startsWith("--") && !(rest[i - 1] || "").startsWith("--"));

const die = (m) => {
  console.error(`✖ ${m}`);
  process.exit(1);
};
const ok = (m) => console.log(`✓ ${m}`);

// ---------------------------------------------------------------- 网络与凭证

// 站点 license 摘要：attribution = 上片是否必须署名；monetize = 能否用在变现内容里
export const SITES = {
  mixkit: {
    name: "Mixkit",
    kinds: ["video", "sfx"],
    needsKey: false,
    license: "Mixkit Stock Video Free License",
    attribution: false,
    monetize: true,
    note: "无 API，但列表页内嵌 JSON-LD，直链 assets.mixkit.co/videos/<id>/<id>-<高>.mp4 可直接下。⚠ 部分标 Restricted —— 那种不能用于变现内容，脚本会逐条核。",
  },
  pexels: {
    name: "Pexels",
    kinds: ["photo", "video"],
    needsKey: true,
    license: "Pexels License",
    attribution: false,
    monetize: true,
    note: "搜索要 key（免费申请，Authorization 头）；图片 CDN images.pexels.com 直链不要 key。不能原样转卖、不能暗示代言。",
  },
  pixabay: {
    name: "Pixabay",
    kinds: ["photo", "illustration", "vector", "video"],
    needsKey: true,
    license: "Pixabay Content License",
    attribution: false,
    monetize: true,
    note: "搜索要 key（query 参数），限 100 次/60 秒。法律上不要求署名，但 API 条款要求标注来源 —— 我们的角标正好覆盖。",
  },
  unsplash: {
    name: "Unsplash",
    kinds: ["photo"],
    needsKey: true,
    license: "Unsplash License + API 条款",
    attribution: true,
    monetize: true,
    note: "不推荐当默认源：API 条款强制署名 + 必须热链 + 必须回调 download_location，跟本地渲染对不上。",
  },
  svgsilh: {
    name: "SVG Silh",
    kinds: ["icon", "illustration"],
    needsKey: false,
    license: "CC0",
    attribution: false,
    monetize: true,
    note: "直链 svgsilh.com/svg/<id>.svg 可用；搜索页要爬，所以只当补充来源。",
  },
  iconify: {
    name: "Iconify 合集（lucide / tabler / mdi / ph / solar…）",
    kinds: ["icon"],
    needsKey: false,
    license: "MIT / ISC（按合集）",
    attribution: false,
    monetize: true,
    note: "jsdelivr 上一个 npm 包拿全几千个矢量图标，SVG 里写 currentColor，抽出来时直接染成主题色。",
  },
  simpleicons: {
    name: "Simple Icons",
    kinds: ["brand"],
    needsKey: false,
    license: "CC0（SVG 路径）；logo 本身仍是商标",
    attribution: false,
    monetize: true,
    note: "品牌真身 logo。只能如实指代，不许改形误导；索引带官方 hex 色值，默认按真色落盘。",
  },
  flaticon: {
    name: "Flaticon / flaticons.net",
    kinds: ["icon"],
    needsKey: true,
    license: "免费档必须署名",
    attribution: true,
    monetize: true,
    note: "站点被 Cloudflare 挡、免费档不给 SVG → 只当人工下载来源，不做自动抓取。",
  },
  pictogram2: {
    name: "Pictogram2",
    kinds: ["icon"],
    needsKey: false,
    license: "可用，但禁止把原文件再分发/转卖",
    attribution: true,
    monetize: true,
    note: "日语站、无 API，人工下载。",
  },
};

let envFile;
const keyOf = (name) => {
  if (process.env[name]) return process.env[name];
  if (envFile === undefined) {
    const p = path.join(os.homedir(), ".neurocast", "stock.env");
    try {
      envFile = Object.fromEntries(
        fs
          .readFileSync(p, "utf8")
          .split(/\r?\n/)
          .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/.exec(l))
          .filter(Boolean)
          .map((m) => [m[1], m[2]])
      );
    } catch {
      envFile = null;
    }
  }
  return envFile?.[name];
};
const needKey = (site, env) => {
  const k = keyOf(env);
  if (k) return k;
  die(
    `${SITES[site].name} 的搜索要 API key（免费申请）。放法：环境变量 ${env}，或写进仓库外的 ~/.neurocast/stock.env（一行 ${env}=xxx）。` +
      `\n  本脚本不会把 key 打进任何输出；那个文件也别放进仓库。`
  );
};

const req = async (url, { headers = {}, binary = false, timeout = 60000 } = {}) => {
  const res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(timeout), redirect: "follow" });
  if (!res.ok) {
    const body = binary ? "" : (await res.text().catch(() => "")).slice(0, 200);
    return { status: res.status, error: `HTTP ${res.status}${body ? " " + body : ""}` };
  }
  return { status: res.status, ok: true, buf: binary ? Buffer.from(await res.arrayBuffer()) : null, text: binary ? null : await res.text() };
};

const readJson = (p, d) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")) : d);
const writeJson = (p, j) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(j, null, 1) + "\n", "utf8");
};
const loadIndex = () => readJson(STOCK_INDEX, { rule: "库存素材：只当示意画面，不计入素材占比，署名要求见 attribution", items: {} });
const saveIndex = (j) => writeJson(STOCK_INDEX, j);
const md5 = (buf) => crypto.createHash("md5").update(buf).digest("hex").slice(0, 12);

// 视频/图片探尺寸：有 ffprobe 就用它，没有就留空（渲染时 prepAssets 自己会量）
const probeDims = (abs, isVideo) => {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height,duration:format=duration", "-of", "json", abs], { encoding: "utf8" });
    const j = JSON.parse(out);
    const s = (j.streams || [])[0] || {};
    return { width: s.width || null, height: s.height || null, duration: Number(j.format?.duration || s.duration) || null };
  } catch {
    return isVideo ? {} : {};
  }
};

// ---------------------------------------------------------------- brands：真身 logo

// Simple Icons 取源：钉死版本号，从 jsdelivr 拿「文件清单 + 索引」。
//   ① 不钉版本会踩坑：jsdelivr 的 @latest 对索引文件是缓存的旧版，同一时刻
//      `@latest/icons/openai.svg` 有、`@latest/_data/simple-icons.json` 里没有 —— 匹配结果自相矛盾。
//   ② v16 起 OpenAI / Canva / Adobe / Microsoft 这类牌子被商标压力撤下了，所以按「新版→旧版」依次找，
//      撤下的从旧版取；两版都没有的（剪映/飞书/语雀/WPS/京东/Midjourney/VS Code）只能官网抓或人工放文件。
const SI_DATA_PATHS = ["/data/simple-icons.json", "/_data/simple-icons.json"]; // v16 挪了目录
const slugify = (s) => {
  let x = String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!/^[a-z0-9]/i.test(s)) x = "dot" + x; // ".ENV" -> "dotenv"
  return x;
};
const norm = (s) => slugify(s);

// → { versions: ["16.34.0","15.0.0"], bySlug: { slug: {title, hex, ver, aliases[]} } }
const siCatalog = async (fresh) => {
  fs.mkdirSync(CACHE, { recursive: true });
  const cache = path.join(CACHE, "simple-icons-catalog.json");
  const age = fs.existsSync(cache) ? (Date.now() - fs.statSync(cache).mtimeMs) / 86400000 : 999;
  if (!fresh && age < 30) {
    try {
      return readJson(cache, null);
    } catch {
      /* 缓存坏了重取 */
    }
  }
  const latest = await req("https://registry.npmjs.org/simple-icons/latest", { timeout: 30000 });
  if (!latest.ok) die(`拿 simple-icons 版本失败：${latest.error}`);
  const v = JSON.parse(latest.text).version;
  const versions = [v, `${Number(v.split(".")[0]) - 1}.0.0`];
  const bySlug = {};
  for (const ver of versions) {
    const flat = await req(`https://data.jsdelivr.com/v1/package/npm/simple-icons@${ver}/flat`, { timeout: 90000 });
    if (!flat.ok) {
      console.warn(`  ! 版本 ${ver} 清单拿不到（${flat.error}），跳过`);
      continue;
    }
    const slugs = new Set((JSON.parse(flat.text).files || []).filter((f) => /^\/icons\/[a-z0-9.+-]+\.svg$/i.test(f.name)).map((f) => f.name.replace(/^\/icons\//, "").replace(/\.svg$/i, "")));
    let idx = null;
    for (const p of SI_DATA_PATHS) {
      const r = await req(`https://cdn.jsdelivr.net/npm/simple-icons@${ver}${p}`, { timeout: 90000 });
      if (r.ok) {
        idx = JSON.parse(r.text);
        break;
      }
    }
    const meta = {};
    for (const i of idx || []) meta[norm(i.title)] = { title: i.title, hex: i.hex, aliases: Object.values(i.aliases || {}).flat().filter((x) => typeof x === "string") };
    for (const s of slugs) {
      if (bySlug[s]) continue; // 新版优先
      const m = meta[s];
      bySlug[s] = { title: m?.title || s, hex: m?.hex || null, aliases: m?.aliases || [], ver };
    }
    console.log(`  · simple-icons@${ver}：${slugs.size} 个图标${idx ? "" : "（索引没取到，只按 slug 匹配）"}`);
  }
  const cat = { fetchedAt: new Date().toISOString().slice(0, 10), versions, count: Object.keys(bySlug).length, bySlug };
  writeJson(cache, cat);
  return cat;
};

// 一个牌子 → 该用哪个 slug：显式 si > slug 命中 > 标题/别名精确 > 标题/别名包含
const siMatch = (cat, cands) => {
  const set = cands.map(norm).filter(Boolean);
  for (const c of set) if (cat.bySlug[c]) return { slug: c, ...cat.bySlug[c] };
  const entries = Object.entries(cat.bySlug);
  for (const c of set) {
    const exact = entries.find(([, v]) => norm(v.title) === c || v.aliases.some((a) => norm(a) === c));
    if (exact) return { slug: exact[0], ...exact[1] };
  }
  for (const c of set) {
    if (c.length < 4) continue; // 短词包含匹配会把 "jd" 命中一堆无关牌子
    const near = entries.find(([, v]) => norm(v.title).includes(c) || v.aliases.some((a) => norm(a).includes(c)));
    if (near) return { slug: near[0], ...near[1] };
  }
  return null;
};

const runBrands = async () => {
  const lib = readJson(BRAND_LIB, { brands: {} });
  const cat = await siCatalog(flag("fresh"));
  ok(`Simple Icons 目录：${cat.count} 个 slug（${cat.versions.join(" / ")}）`);
  const rows = [];
  let changed = 0;
  let wrote = 0;
  for (const [key, b] of Object.entries(lib.brands)) {
    const file = b.file || `${key}.svg`;
    const abs = path.join(BRAND_DIR, file);
    if (fs.existsSync(abs) && fs.statSync(abs).size > 120 && flag("only-missing")) continue;
    // 候选：库里显式写的 si 优先，其次 key 和文案里的叫法（chatgpt→openai、twitter→x、douyin→tiktok 都靠这层）
    const cands = [b.si, key, ...(b.aliases || [])].filter(Boolean);
    const hit = siMatch(cat, cands);
    if (!hit) {
      rows.push({ key, status: "Simple Icons 没有（撤标或从未收录）→ 官网抓/人工放" });
      continue;
    }
    // 命中的 slug 不在候选里 = 拿隔壁牌子顶替（chatgpt→openai、douyin→tiktok），要看得见、要你确认
    const near = cands.map(norm).includes(hit.slug) ? "" : `≈用「${hit.title}」的标 `;
    if (flag("dry")) {
      rows.push({ key, status: `可取 ${near}${hit.slug}@v${hit.ver.split(".")[0]} #${hit.hex || "?"}` });
      continue;
    }
    const r = await req(`https://cdn.jsdelivr.net/npm/simple-icons@${hit.ver}/icons/${hit.slug}.svg`, { timeout: 60000 });
    if (!r.ok) {
      rows.push({ key, status: `下载失败 ${r.error}` });
      continue;
    }
    // 官方真色：包里的 SVG 写 currentColor，走 <Img> 会渲成黑色 —— 落盘前把真色烤进去。
    // 但我们的片子是深色底，GitHub/Cursor 那种「官方色≈黑」的标烤成黑就等于隐形，
    // 所以按 Rec.601 亮度算，暗到看不出来的（<70/255）烤成白色；正红/橙这种饱和色虽然数值不高但显眼，保留真色。
    // 官方 hex 始终记进 brands/library.json，信息不丢。
    const lum = (h) => (!h || !/^[0-9a-f]{6}$/i.test(h) ? null : 0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16));
    const want = (val("color", "") || "").replace(/^#/, "");
    const official = hit.hex || "FFFFFF";
    const dark = lum(official) !== null && lum(official) < 70;
    const color = want || (dark ? "FFFFFF" : official);
    let svg = r.text;
    svg = /fill="currentColor"/i.test(svg) ? svg.replace(/fill="currentColor"/gi, `fill="#${color}"`) : svg.replace(/<svg\b([^>]*)>/i, (m, attrs) => (/\sfill="/i.test(attrs) ? m : `<svg${attrs} fill="#${color}">`));
    fs.mkdirSync(BRAND_DIR, { recursive: true });
    fs.writeFileSync(abs, svg, "utf8");
    wrote++;
    if (b.si !== hit.slug || b.hex !== official) {
      b.si = hit.slug;
      b.hex = official;
      changed = 1;
    }
    rows.push({ key, status: `✓ ${near}${hit.slug}（${hit.title}）#${color}${dark && !want ? ` ←官方 #${official} 太暗，烤白` : ""} ${svg.length}B` });
  }
  if (changed) writeJson(BRAND_LIB, lib);
  for (const r of rows) console.log(`  ${r.key.padEnd(14)} ${r.status}`);
  const got = rows.filter((r) => r.status.startsWith("✓") || r.status.startsWith("可取")).length;
  console.log(`\n命中 ${got} / ${rows.length}${flag("dry") ? "（--dry 没落盘）" : `，落盘 ${wrote} 个文件到 public/brands/`}`);
  const no = rows.filter((r) => r.status.startsWith("Simple Icons 没有")).map((r) => r.key);
  if (no.length) console.log(`  还得人工/官网抓：${no.join("、")}`);
  if (wrote) console.log("  下一步：node scripts/brands.mjs sync（生成 brands.generated.ts）");
};

// ---------------------------------------------------------------- icons：Iconify 合集

const ICON_LICENSE = { lucide: "ISC", tabler: "MIT", mdi: "Apache-2.0", ph: "MIT", solar: "CC BY 4.0", ri: "MIT", bi: "MIT", si: "MIT" };
const runIcons = async () => {
  const [collection, ...names] = positional;
  if (!collection || !names.length) die("用法：node scripts/stock.mjs icons <合集> <名字…> [--color HEX]\n  合集：lucide / tabler / mdi / ph / solar / ri / bi（名字用 - 连接，如 brain robot-ai）");
  const color = (val("color", "currentColor") || "currentColor").replace(/^#/, "");
  const r = await req(`https://cdn.jsdelivr.net/npm/@iconify-json/${collection}@latest/icons.json`, { timeout: 180000 });
  if (!r.ok) die(`拿 @iconify-json/${collection} 失败：${r.error}`);
  const j = JSON.parse(r.text);
  const aliases = j.aliases || {};
  const all = { ...j.icons, ...j.chars && { _chars: j.chars } };
  fs.mkdirSync(ICON_DIR, { recursive: true });
  const idx = readJson(path.join(ROOT, "assets", "icons-index.json"), {});
  const done = [];
  for (const raw of names) {
    const name = raw.toLowerCase();
    const body = all[name]?.body ?? all[aliases[name]?.alias]?.body;
    if (!body) {
      const near = Object.keys(all).filter((k) => k.includes(name.split("-")[0])).slice(0, 6);
      console.log(`  ✖ ${collection}:${name} 不在合集里${near.length ? `，相近的有：${near.join("、")}` : ""}`);
      continue;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">${body.replaceAll("currentColor", `#${color}`)}</svg>`;
    const rel = `assets/icons/${collection}-${name}.svg`;
    fs.writeFileSync(path.join(PUB, rel), svg, "utf8");
    idx[rel] = { site: "iconify", collection, name, color, license: ICON_LICENSE[collection] || "见合集仓库", attribution: /CC BY/i.test(ICON_LICENSE[collection] || ""), bytes: svg.length, fetchedAt: new Date().toISOString().slice(0, 10) };
    done.push(rel);
    console.log(`  ✓ ${rel}${color === "currentColor" ? "（保留 currentColor，内联时可染色）" : ` #${color}`}`);
  }
  writeJson(path.join(ROOT, "assets", "icons-index.json"), idx);
  if (done.length) console.log(`\n分镜里这样引用：src: "${done[done.length - 1]}"  · 出处记在 assets/icons-index.json（${done.length} 个本次新增）`);
};

// ---------------------------------------------------------------- search

const mixkitItems = async (site, q, n) => {
  const url = `https://mixkit.co/free-stock-video/search/?q=${encodeURIComponent(q)}`;
  const r = await req(url, { timeout: 60000 });
  if (!r.ok) die(`Mixkit 抓取失败：${r.error}`);
  const items = [];
  // 页面里的 JSON-LD 标签带额外属性（data-test-id=…），别把正则写死成 <script type="…">
  for (const m of r.text.matchAll(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/gs)) {
    let j;
    try {
      j = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const walk = (x) => {
      if (!x || typeof x !== "object") return;
      if ((Array.isArray(x["@type"]) ? x["@type"].includes("VideoObject") : x["@type"] === "VideoObject") && x.contentUrl) items.push(x);
      for (const v of Object.values(x)) (Array.isArray(v) ? v : [v]).forEach(walk);
    };
    walk(j);
  }
  return items.slice(0, Number(n) > 0 ? Number(n) : 12).map((v) => {
    const id = /\/videos\/(\d+)\//.exec(v.contentUrl)?.[1] || /(\d+)\/?$/.exec(String(v["@id"]).replace(/#video$/, ""))?.[1];
    const res = Number(val("res", 1080));
    return {
      site: "mixkit",
      id,
      kind: "video",
      title: (v.name || "").trim(),
      url: `https://assets.mixkit.co/videos/${id}/${id}-${res}.mp4`,
      quality: (v.videoQuality || []).join("/"),
      sizes: [v.contentUrl, v.embedUrl].filter(Boolean),
      author: "Mixkit",
      page: String(v["@id"] || "").replace(/#video$/, ""),
      license: /restricted/i.test(v.copyrightNotice || "") ? "Restricted（不能用于变现内容）" : "Free",
      monetize: !/restricted/i.test(v.copyrightNotice || ""),
      attribution: false,
      thumb: v.thumbnailUrl,
    };
  });
};

const pexelsSearch = async (site, q, n, opts, type) => {
  const key = needKey("pexels", "PEXELS_API_KEY");
  const ep = type === "video" ? "videos/search" : "search";
  const p = new URLSearchParams({ query: q, per_page: String(n), locale: "zh-CN" });
  if (opts.landscape) p.set("orientation", "landscape");
  if (opts.min) p.set("size", "large");
  const r = await req(`https://api.pexels.com/v1/${ep}?${p}`, { headers: { authorization: key } });
  if (!r.ok) die(`Pexels 搜索失败：${r.error}`);
  const j = JSON.parse(r.text);
  const wantRes = Number(val("res", 1080));
  return (type === "video" ? j.videos : j.photos).map((x) => {
    // 视频原片常是 4K（一条几百 MB），默认取「不超过 --res 的最大档」，1080 足够 1920x1080 成片
    const files = type === "video" ? (x.video_files || []).slice().sort((a, b) => b.height - a.height) : null;
    const best = files ? files.find((f) => f.height <= wantRes) || files[files.length - 1] : null;
    return {
      site: "pexels",
      id: x.id,
      kind: type,
      title: x.alt || x.description || "",
      url: type === "video" ? best?.link : x.src?.original,
      preview: type === "video" ? x.image : x.src?.medium,
      width: type === "video" ? best?.width : x.width,
      height: type === "video" ? best?.height : x.height,
      duration: x.duration || null,
      author: x.user?.name || x.photographer || "",
      page: x.url || `https://www.pexels.com/${type}/${x.id}/`,
      license: "Pexels License",
      monetize: true,
      attribution: false,
      variants: files ? files.map((f) => `${f.height}p`).join(" ") : undefined,
    };
  });
};

const pixabaySearch = async (site, q, n, opts, type) => {
  const key = needKey("pixabay", "PIXABAY_API_KEY");
  const p = new URLSearchParams({ key, q, per_page: String(Math.min(n, 200)), safesearch: "true" });
  if (opts.landscape) p.set("orientation", "horizontal");
  if (opts.min) p.set("min_width", String(opts.min));
  const ep = type === "video" ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/";
  if (type !== "video") p.set("image_type", opts.type && opts.type !== "photo" ? opts.type : "photo");
  const r = await req(`${ep}?${p}`, { timeout: 60000 });
  if (!r.ok) die(`Pixabay 搜索失败：${r.error}（key 只在这次请求里用，不回显）`);
  const j = JSON.parse(r.text);
  return (j.hits || []).map((x) =>
    type === "video"
      ? {
          site: "pixabay",
          id: x.id,
          kind: "video",
          title: x.tags,
          url: x.videos?.large?.url || x.videos?.medium?.url || x.videos?.tiny?.url,
          width: x.videos?.large?.width,
          height: x.videos?.large?.height,
          duration: x.duration,
          author: x.user,
          page: x.pageURL,
          license: "Pixabay Content License",
          monetize: true,
          attribution: false,
          variants: Object.entries(x.videos || {}).map(([k, v]) => `${k}:${v.width}x${v.height}`).join(" "),
        }
      : {
          site: "pixabay",
          id: x.id,
          kind: x.type || "photo",
          title: x.tags,
          url: x.fullHDURL || x.imageURL || x.largeImageURL,
          width: x.width,
          height: x.height,
          author: x.user,
          page: x.pageURL,
          license: "Pixabay Content License",
          monetize: true,
          attribution: false,
        }
  );
};

const searchers = { mixkit: mixkitItems, pexels: pexelsSearch, pixabay: pixabaySearch };

const runSearch = async () => {
  const [site, ...qparts] = positional;
  if (!site || !qparts.length) die(`用法：node scripts/stock.mjs search <${Object.keys(searchers).join("|")}> <关键词> [--type video|photo|illustration|vector] [--n 12] [--landscape] [--min 1920]`);
  const fn = searchers[site] || die(`本站不做自动抓取（${site}）：${SITES[site]?.note ?? "未知站点"}\n  可抓的：${Object.keys(searchers).join(" / ")}`);
  const type = val("type", site === "mixkit" ? "video" : "photo");
  const opts = { landscape: flag("landscape"), min: Number(val("min", 0)) || 0, type };
  const items = await fn(site, qparts.join(" "), Number(val("n", 12)), opts, type);
  if (!items.length) die("没搜到（换个关键词，或去掉 --min/--landscape 限制）");
  console.log(`\n${SITES[site].name} · "${qparts.join(" ")}" · ${type} —— 挑一个再 node scripts/stock.mjs get ${site}:<id>\n`);
  for (const it of items) {
    const dim = it.width ? `${it.width}x${it.height}` : (it.quality || "-");
    console.log(`  ${site}:${String(it.id).padEnd(7)} ${String(it.kind).padEnd(6)} ${dim.padEnd(11)} ${it.duration ? `${Math.round(it.duration)}s`.padEnd(6) : "      "}${(it.author || "-").padEnd(16)} ${it.license}${it.attribution ? " · 要署名" : ""}`);
    console.log(`      ${(it.title || "").slice(0, 74)}`);
  }
  console.log(`\n  规矩：库存画面只能当「示意画面」，不许顶替真实截图；不计入素材占比；带 Restricted 的别用在变现片里。`);
};

// ---------------------------------------------------------------- get

const runGet = async () => {
  const spec = positional[0];
  if (!spec) die("用法：node scripts/stock.mjs get <站:id | 直链> [--res 1080] [--as 名字] [--kind video]");
  let item;
  const m = /^([a-z]+):(.+)$/i.exec(spec);
  if (m && searchers[m[1]] && /^\d+$/.test(m[2])) {
    const site = m[1].toLowerCase();
    const id = m[2];
    // 用 search 的同一个通道拿直链：mixkit 直接拼 URL，pexels/pixabay 走详情接口
    if (site === "mixkit") {
      const res = Number(val("res", 1080));
      item = { site, id, kind: "video", url: `https://assets.mixkit.co/videos/${id}/${id}-${res}.mp4`, author: "Mixkit", license: "Mixkit Stock Video Free License", monetize: true, attribution: false, page: `https://mixkit.co/free-stock-video/${id}/` };
    } else if (site === "pexels") {
      const key = needKey("pexels", "PEXELS_API_KEY");
      const h = { authorization: key };
      let r = await req(`https://api.pexels.com/videos/videos/${id}`, { headers: h });
      let kind = "video";
      if (!r.ok) {
        r = await req(`https://api.pexels.com/v1/photos/${id}`, { headers: h });
        kind = "photo";
      }
      if (!r.ok) die(`Pexels 取 ${id} 失败：${r.error}`);
      const x = JSON.parse(r.text);
      const wantRes = Number(val("res", 1080));
      const files = (x.video_files || []).slice().sort((a, b) => b.height - a.height);
      const best = files.find((f) => f.height <= wantRes) || files[files.length - 1];
      item = kind === "video" ? { site, id, kind, url: best?.link, width: best?.width, height: best?.height, duration: x.duration, author: x.user?.name, page: x.url, license: "Pexels License", monetize: true, attribution: false } : { site, id, kind, url: x.src?.original, width: x.width, height: x.height, author: x.photographer, page: x.url, license: "Pexels License", monetize: true, attribution: false };
    } else {
      die(`pixabay 的 id 不能单独下载（直链在搜索响应里）。请先 search，再把结果里的直链传给 get：\n  node scripts/stock.mjs search pixabay <关键词> --type ${val("type", "photo")}`);
    }
  } else {
    const url = m && !searchers[m[1]] ? spec : spec;
    const site = /mixkit\.co/.test(url) ? "mixkit" : /pexels\./.test(url) ? "pexels" : /pixabay\./.test(url) ? "pixabay" : /unsplash/.test(url) ? "unsplash" : "other";
    const ext = (/\.(mp4|webm|mov|jpg|jpeg|png|webp|svg|wav|mp3)(\?|$)/i.exec(url)?.[1] || "mp4").toLowerCase();
    item = { site, id: (/(?:mixkit-)?(\d{3,})/g.exec(url)?.[1] || crypto.randomBytes(3).toString("hex")), kind: /\.(mp4|webm|mov)/i.test(ext) ? "video" : ext === "svg" ? "icon" : "image", url, ext, author: "", page: "", license: "待核", monetize: true, attribution: false };
  }
  if (!item.url) die("没拿到直链");
  const isVid = item.kind === "video";
  const ext = item.ext || (isVid ? "mp4" : /\.svg($|\?)/i.test(item.url) ? "svg" : item.site === "pexels" ? "jpeg" : "png");
  const name = val("as") || `${item.id}`;
  const rel = `assets/stock/${item.site}/${name}.${ext}`;
  const abs = path.join(PUB, rel);
  const r = await req(item.url, { binary: true, timeout: 300000 });
  if (!r.ok) die(`下载失败：${r.error}`);
  if (!r.buf?.length) die("下载内容为空");
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, r.buf);
  const dims = probeDims(abs, isVid);
  const j = loadIndex();
  j.items[rel] = {
    site: item.site,
    kind: item.kind,
    id: item.id,
    url: item.url,
    page: item.page || null,
    author: item.author || null,
    license: item.license,
    monetize: item.monetize !== false,
    attribution: !!item.attribution,
    bytes: r.buf.length,
    md5: md5(r.buf),
    fetchedAt: new Date().toISOString().slice(0, 10),
    ...dims,
  };
  saveIndex(j);
  console.log(`✓ ${rel}  ${(r.buf.length / 1048576).toFixed(1)}MB${dims.width ? ` ${dims.width}x${dims.height}` : ""}${dims.duration ? ` ${Math.round(dims.duration)}s` : ""}`);
  console.log(`  出处：${item.license}${item.attribution ? " —— ⚠ 必须署名" : " —— 不要求署名（但角标仍写「示意画面」）"}${item.monetize === false ? "\n  ⚠ 这条是 Restricted license，不能用在变现内容（抖音/YouTube 恰是变现场景）" : ""}`);
  console.log(`  分镜里写 src: "${rel}"；make.mjs 会照常拷进 job、量比例、进台账，台账里这条会带 stock 标记。`);
};

// ---------------------------------------------------------------- license / sites

const runLicense = () => {
  const q = positional.join(" ").toLowerCase();
  const j = loadIndex();
  const keys = Object.keys(j.items).filter((k) => !q || k.toLowerCase().includes(q) || String(j.items[k].author).toLowerCase().includes(q));
  if (!keys.length) return console.log(`台账里没有${q ? `匹配「${q}」的` : ""}库存素材（assets/stock-index.json）`);
  console.log(`库存素材 ${keys.length} 条（assets/stock-index.json）：\n`);
  for (const k of keys) {
    const a = j.items[k];
    console.log(`  ${k}`);
    console.log(`    ${a.site} · ${a.kind} · ${a.license} · 作者 ${a.author || "-"} · 抓于 ${a.fetchedAt}`);
    console.log(`    署名：${a.attribution ? "★ 必须（上屏带作者，或片尾列出处）" : "不要求"} · 变现：${a.monetize === false ? "✖ Restricted，不能用" : "可以"} · 页面：${a.page || a.url}`);
  }
  const must = keys.filter((k) => j.items[k].attribution);
  const banned = keys.filter((k) => j.items[k].monetize === false);
  console.log(`\n  必须署名 ${must.length} 条${banned.length ? ` · 不能用于变现 ${banned.length} 条` : ""}`);
};

const runSites = () => {
  console.log(`\n${"站点".padEnd(20)}${"内容".padEnd(26)}key   署名  变现  自动抓取\n`);
  for (const [k, s] of Object.entries(SITES)) {
    const auto = searchers[k] ? "search+get" : k === "iconify" || k === "simpleicons" ? "icons/brands" : "只能人工";
    console.log(`  ${s.name.slice(0, 18).padEnd(20)}${s.kinds.join("/").padEnd(26)}${(s.needsKey ? "要" : "不要 ").padEnd(6)}${(s.attribution ? "要" : "不要 ").padEnd(6)}${(s.monetize ? "能" : "看条").padEnd(6)}${auto}`);
    console.log(`      ${s.note}`);
  }
  console.log(`\n  key 放法：环境变量 PEXELS_API_KEY / PIXABAY_API_KEY / UNSPLASH_ACCESS_KEY，或仓库外的 ~/.neurocast/stock.env`);
  console.log(`  下载物落在 public/assets/stock/（不进 git），出处记在 assets/stock-index.json（进 git）\n`);
};

if (cmd === "brands") await runBrands();
else if (cmd === "icons") await runIcons();
else if (cmd === "search") await runSearch();
else if (cmd === "get") await runGet();
else if (cmd === "license") runLicense();
else if (cmd === "sites") runSites();
else die(`未知命令 ${cmd}（可用：sites / brands / icons / search / get / license）`);
