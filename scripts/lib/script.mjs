// 文案 parser for the timed pipeline.
//   # 标题            video title
//   ## 章节           chapter (HUD + progress bar)
//   [口播: x.mp4]     the following paragraphs (until the next ## or marker) are spoken in that clip
//   [配音] / [旁白]    back to the voice-over track (only needed when a clip is followed by voice-over in the same chapter)
//   [图: x.png] [录屏: x.mp4]   screen asset for the next paragraph
//   [logo: ...] [出处: ...] ...  素材槽位：写自己一行、不朗读，自动分镜时直接点名组件（见 detect.mjs SLOT_SPEC）
//   > 备注 / // 备注   ignored
// Everything else is spoken text. Returns sections in reading order.

const MARK = /^\s*\[(口播|视频|配音|旁白|图|截图|录屏|img|image|video)\s*(?:[:：]\s*([^\]]*))?\]\s*$/i;

// 素材槽位标记。名字必须是这些之一（避免把正文里的中括号误判成指令）
export const SLOT_NAMES = ["logo", "品牌墙", "出处", "来源", "文档", "表格", "对比", "vs", "头像", "评论墙", "评论", "原文", "金句", "证据", "流程", "路径", "层层", "圈注"];
const SLOT = new RegExp(`^\\s*\\[(${SLOT_NAMES.join("|")})\\s*[:：]\\s*([^\\]]*)\\]\\s*$`, "i");
export { SLOT as SLOT_MARK };

export const parseTimedScript = (script) => {
  const text = script.replace(/\r\n/g, "\n").replace(/^﻿/, "");
  const chapters = [];
  const sections = [];
  let title = "";
  let chapter = -1;
  let cur = null; // { kind: "tts"|"talk", clip?, chapter, paras: [] }
  let buf = [];
  let pendingAsset = null;
  let pendingSlots = [];
  let inCode = false;
  const flushPara = () => {
    const p = buf.join("").trim();
    buf = [];
    if (!p) {
      // 只有槽位标记的一段（[logo: …] 紧跟空行）：没有正文可挂，就挂到本节最后一段上
      if (pendingSlots.length && cur?.paras.length) {
        const last = cur.paras[cur.paras.length - 1];
        last.slots = [...(last.slots || []), ...pendingSlots];
      }
      pendingAsset = null;
      pendingSlots = [];
      return;
    }
    if (!cur) cur = { kind: "tts", chapter: Math.max(0, chapter), paras: [] };
    cur.paras.push({ text: p, asset: pendingAsset, slots: pendingSlots.length ? pendingSlots : undefined });
    pendingAsset = null;
    pendingSlots = [];
  };
  const closeSection = () => {
    flushPara();
    if (cur && cur.paras.length) sections.push(cur);
    cur = null;
  };
  for (const raw of text.split("\n")) {
    const ln = raw.trim();
    if (/^```/.test(ln)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (/^>/.test(ln) || /^\/\//.test(ln)) continue;
    const h1 = ln.match(/^#\s+(.+)$/);
    if (h1) {
      if (!title) title = h1[1].trim();
      continue;
    }
    const h = ln.match(/^#{2,3}\s*(.+)$/);
    if (h) {
      closeSection();
      chapters.push({ title: h[1].trim().replace(/\s*[（(].*[)）]\s*$/, "") });
      chapter = chapters.length - 1;
      continue;
    }
    const sm = ln.match(SLOT);
    if (sm) {
      // 槽位标记不朗读、不进字幕。它和 [图:] 一样先把上一段收口，自己只挂到接下来那一段上
      // —— 这样一段正文一个画面，不会整章的镜头都换成同一个素材组件。
      const keep = buf.join("").trim() ? null : pendingAsset;
      flushPara();
      if (keep) pendingAsset = keep;
      pendingSlots.push({ name: sm[1].toLowerCase(), value: (sm[2] || "").trim(), raw: ln });
      continue;
    }
    const m = ln.match(MARK);
    if (m) {
      const kind = m[1].toLowerCase();
      if (["口播", "视频", "video"].includes(kind) && m[2]) {
        closeSection();
        cur = { kind: "talk", clip: m[2].trim(), chapter: Math.max(0, chapter), paras: [] };
      } else if (["配音", "旁白"].includes(kind)) {
        closeSection();
        cur = { kind: "tts", chapter: Math.max(0, chapter), paras: [] };
      } else if (m[2]) {
        flushPara();
        pendingAsset = m[2].trim();
      }
      continue;
    }
    if (!ln) {
      flushPara();
      continue;
    }
    // strip light markdown that is never spoken
    buf.push(ln.replace(/\*\*|__/g, "").replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1").replace(/^\s*(?:[-*+•]|\d{1,2}[.、)）])\s+/, ""));
  }
  if (inCode) throw Object.assign(new Error("讲稿里的代码块 ``` 没有闭合"), { code: "E_CODE_FENCE" });
  closeSection();
  if (!chapters.length) chapters.push({ title: "" });
  if (!sections.length) throw Object.assign(new Error("讲稿里没有可朗读的正文"), { code: "E_EMPTY" });
  return { title, chapters, sections };
};

// spoken text of a section: paragraphs joined; the paragraph boundaries are kept for beat splitting
export const sectionText = (sec) => {
  let s = "";
  const paraStarts = [];
  for (const p of sec.paras) {
    paraStarts.push(Array.from(s).length);
    s += p.text + "\n";
  }
  return { text: s, paraStarts };
};
