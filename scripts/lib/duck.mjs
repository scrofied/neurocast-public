// 人声侧链包络：把配音轨压成「每帧一条增益」，给 BGM 的 volume 曲线用。
// 换自 swap2 audio_mix.py 的做法：10ms RMS 包络 → 平滑 → 说话时把 BGM 压低、停顿处回满。
// 输出长度 = frames，值域约 0.45~1（1 = 不压）。不写文件、不进 git，直接在 make 时算。
import { spawnSync } from "node:child_process";

const SR = 48000;
const DEPTH = 0.55; // 说话时最多压到 45%
const ATTACK = 0.4; // 30fps 下约 80ms
const RELEASE = 0.08; // 约 400ms

export const duckEnvelope = (file, fps = 30, frames = 0) => {
  const r = spawnSync(
    "ffmpeg",
    ["-v", "error", "-vn", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"],
    { maxBuffer: 512 * 1024 * 1024 },
  );
  if (r.status !== 0 || !r.stdout || r.stdout.length < 4) return null;
  const n = Math.floor(r.stdout.length / 4);
  // Buffer 不保证 4 字节对齐：复制一份再按 Float32 读
  const samples = new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + n * 4));
  const per = Math.max(1, Math.round(SR / fps));
  const total = frames > 0 ? frames : Math.ceil(n / per);
  const target = new Float32Array(total);
  for (let f = 0; f < total; f++) {
    const a = f * per;
    const b = Math.min(n, a + per);
    if (b <= a) {
      target[f] = 0;
      continue;
    }
    let sum = 0;
    for (let i = a; i < b; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / (b - a));
    const db = 20 * Math.log10(rms + 1e-6);
    // -42 dB 以下当静音；-18 dB 以上按满额压低
    target[f] = Math.max(0, Math.min(1, (db + 42) / 24));
  }
  let env = 0;
  const out = new Array(total);
  for (let f = 0; f < total; f++) {
    const x = target[f];
    env += (x - env) * (x > env ? ATTACK : RELEASE);
    out[f] = Math.round((1 - DEPTH * env) * 1000) / 1000;
  }
  return out;
};
