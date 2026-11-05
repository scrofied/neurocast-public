import { isStock } from "./assets.mjs";

const atPath = (data, key) => key.split(".").reduce((o, k) => o?.[k], data);
const strings = (data, path = "data") => {
  if (typeof data === "string") return [{ value: data, path }];
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).flatMap(([key, value]) => strings(value, `${path}.${key}`));
};

export const openingSignature = (def, data = {}, enabled = true) => ({
  id: def.id,
  visual: def.opening?.signature?.visual ?? def.id,
  sound: enabled ? data.sound ?? def.opening?.signature?.sound ?? "embedded" : "muted",
});

export const openingQuality = ({ def, data = {}, provided = data, range = {}, available, fps = 30, hasVoice = true, sfxEnabled = true, originOf = (s) => s }) => {
  const errors = [], warnings = [];
  const from = range.at ?? 0;
  const until = range.until ?? from + Math.round((def.opening?.sec ?? 3) * fps);
  const duration = until - from;
  if (def.layer !== "opening") errors.push(`${def.id} 不是开场组件`);
  if (def.opening?.draft) errors.push(`${def.id} 是未定制骨架；请选择正式模板，或完成定制和预览后移除 opening.draft`);
  for (const { value, path } of strings(data)) if (/<(?:第\s*0\s*帧|钩子里|几秒给|待填|请填|占位)[^>]*>|\$\{d\./.test(value)) errors.push(`${path} 仍是占位文案`);
  for (const field of def.opening?.requiredData ?? []) {
    const value = atPath(provided, field);
    if (typeof value !== "string" || !value.trim()) errors.push(`${def.id} 请为本片显式填写 data.${field}，不能使用布局演示的默认内容`);
  }
  if (!Number.isFinite(from) || !Number.isFinite(until) || from < 0 || duration <= 0) errors.push("opening.at/until 必须构成非负且递增的有效区间");
  if (Number.isFinite(available) && until > available) errors.push(`开场结束帧 ${until} 超出所在镜头/视频的 ${available} 帧，会被截断`);
  if (duration < def.minSec * fps || duration > def.maxSec * fps) warnings.push(`${def.id} 时长 ${(duration / fps).toFixed(1)}s，组件建议 ${def.minSec}~${def.maxSec}s；按台词编排，不统一砍成3秒`);
  const beats = def.opening?.beats;
  if (beats) {
    const scale = def.cueUnit === "sec" ? fps : 1;
    const proof = atPath(data, beats.proof) * scale, payoff = atPath(data, beats.payoff) * scale;
    if (!Number.isFinite(proof) || !Number.isFinite(payoff) || proof < 0 || proof >= payoff) errors.push("解释/证据锚点必须早于第一步兑现锚点，且都是非负数");
    else {
      if (payoff + Math.round(0.8 * fps) > duration) errors.push(`第一步出现在 ${(payoff / fps).toFixed(1)}s，但没有至少0.8秒可读时间；延长until或提前payoffAt`);
      if (proof > 5 * fps) warnings.push("5秒内还没给解释或证据，请提前proofAt");
      if (payoff > 9 * fps) warnings.push("第一步兑现晚于9秒，请检查前10秒承接");
    }
  } else if (!def.opening?.chapter && duration < 5 * fps && available >= 10 * fps) warnings.push("此模板只负责短钩子；请在5~10秒正文安排证据/第一步，并预览前10秒衔接");
  if (def.opening?.requiredData?.some((k) => k.endsWith(".src"))) {
    for (const field of def.assetFields ?? []) {
      const src = atPath(data, field);
      const parent = atPath(data, field.split(".").slice(0, -1).join("."));
      if (isStock(originOf(src)) || isStock(parent?.origin) || parent?.source?.kind === "stock") errors.push(`${field} 是库存示意画面，不能用于真实结果/对照举证`);
    }
  }
  if (data.sound === "quiet" && !hasVoice) warnings.push("quiet不加音效，当前也没有检测到人声；请确认是否有意制作无声开场");
  if (!sfxEnabled && data.sound && data.sound !== "quiet") warnings.push("sfx已关闭，开场的声音编排不会播放");
  return { errors, warnings, duration };
};

export const recentOpeningMatches = (signature, videos = [], self, count = 3) => videos.filter((v) => v.id !== self).slice(-count).filter((v) => v.opening && (v.opening.id === signature.id || (v.opening.visual === signature.visual && v.opening.sound === signature.sound)));
