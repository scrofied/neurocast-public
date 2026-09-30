// Doubao (Volcengine) TTS adapter — placeholder, not wired yet.
// Contract: synthesize(text, opts) -> { file: absolute wav/mp3 path, words: [{ text, start, end }] } (seconds)
// Once words[] timestamps exist, planner uses them instead of the chars-per-second estimate.
export const synthesize = async (text, { appId, token, voice } = {}) => {
  if (!appId || !token || !voice) {
    throw new Error("[E_TTS_CONFIG] 豆包 TTS 未配置：需要 tts.appId / tts.token / tts.voice（克隆音色 ID）");
  }
  throw new Error("[E_TTS_TODO] 豆包 TTS 适配器尚未实现，等克隆音色就绪后接入");
};
