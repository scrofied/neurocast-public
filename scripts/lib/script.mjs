// 文案 parser for the timed pipeline.
//   # 标题            video title
//   ## 章节           chapter (HUD + progress bar)
//   [口播: x.mp4]     the following paragraphs (until the next ## or marker) are spoken in that clip
//   [配音] / [旁白]    back to the voice-over track (only needed when a clip is followed by voice-over in the same chapter)
//   [图: x.png] [录屏: x.mp4]   screen asset for the next paragraph
//   > 备注 / // 备注   ignored
// Everything else is spoken text. Returns sections in reading order.

const MARK = /^\s*\[(口播|视频|配音|旁白|图|截图|录屏|img|image|video)\s*(?:[:：]\s*([^\]]*))?\]\s*$/i;

export const parseTimedScript = (script) => {
  const text = script.replace(/\r\n/g, "\n").replace(/^﻿/, "");
  const chapters = [];
  const sections = [];
  let title = "";
  let chapter = -1;
  let cur = null; // { kind: "tts"|"talk", clip?, chapter, paras: [] }
  let buf = [];
  let pendingAsset = null;
  let inCode = false;
  const flushPara = () => {
    const p = buf.join("").trim();
    buf = [];
    if (!p) return;
    if (!cur) cur = { kind: "tts", chapter: Math.max(0, chapter), paras: [] };
    cur.paras.push({ text: p, asset: pendingAsset });
    pendingAsset = null;
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
