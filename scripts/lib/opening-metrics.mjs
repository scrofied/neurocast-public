export const RULES = { bounce2sMax: 0.35, finish5sMin: 0.5, finish10sMin: null };

export const parseMetrics = (args) => {
  const metrics = {};
  let video;
  for (const arg of args) {
    const at = arg.indexOf("=");
    const key = arg.slice(0, at), value = arg.slice(at + 1);
    if (at < 1) throw new Error(`指标要写成 key=value：${arg}`);
    if (key === "video") { if (!value.trim()) throw new Error("video不能为空"); video = value.trim(); continue; }
    if (!["bounce2s", "finish5s", "finish10s", "plays"].includes(key)) throw new Error(`未知指标 ${key}`);
    if (!/^\d+(?:\.\d+)?%?$/.test(value)) throw new Error(`${key} 必须是非负数字或百分比`);
    const percent = value.endsWith("%");
    let n = Number(value.replace(/%$/, ""));
    if (!Number.isFinite(n)) throw new Error(`${key} 必须是有限数字`);
    if (key === "plays") {
      if (percent || !Number.isSafeInteger(n)) throw new Error("plays必须是非负整数");
    } else {
      if (percent || n > 1) n /= 100;
      if (n < 0 || n > 1) throw new Error(`${key} 必须在0~1或0%~100%之间`);
    }
    metrics[key] = n;
  }
  if (!Object.keys(metrics).length) throw new Error("至少提供一个留存指标或plays");
  if (metrics.finish5s != null && metrics.finish10s != null && metrics.finish10s > metrics.finish5s) throw new Error("同口径下10秒留存不能高于5秒留存");
  return { metrics, video };
};

export const verdict = (metrics, rules = RULES) => {
  const m = metrics ?? {};
  if (![m.bounce2s, m.finish5s, m.finish10s].some((v) => v != null)) return "待数据";
  if (!(m.plays > 0)) return "缺播放样本量，待复盘";
  const bad = (m.bounce2s != null && m.bounce2s > rules.bounce2sMax) || (m.finish5s != null && m.finish5s < rules.finish5sMin) || (rules.finish10sMin != null && m.finish10s != null && m.finish10s < rules.finish10sMin);
  return bad ? "低于项目参考线，需对照复盘" : "有数据，需结合选题与样本对照";
};

export const previewEnd = (duration, fps = 30) => {
  if (!Number.isInteger(duration) || duration <= 0 || !Number.isFinite(fps) || fps <= 0) throw new Error("时间轴时长/fps无效");
  return Math.min(duration, Math.round(10 * fps)) - 1;
};
