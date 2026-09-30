"""Local ASR with word timestamps (faster-whisper, offline).

usage: python asr_words.py <audio_or_video> <out.json> [model=small]
out: {"duration": s, "segments":[{"start","end","text"}], "words":[{"start","end","text"}]}
"""
import json
import sys

from faster_whisper import WhisperModel


def main():
    src, out = sys.argv[1], sys.argv[2]
    size = sys.argv[3] if len(sys.argv) > 3 else "small"
    model = WhisperModel(size, device="cpu", compute_type="int8")
    segs, info = model.transcribe(
        src,
        language="zh",
        word_timestamps=True,
        vad_filter=True,
        initial_prompt="以下是普通话的句子，包含标点符号。",
    )
    res = {"duration": info.duration, "segments": [], "words": []}
    for s in segs:
        res["segments"].append({"start": s.start, "end": s.end, "text": s.text.strip()})
        for w in s.words or []:
            t = w.word.strip()
            if t:
                res["words"].append({"start": w.start, "end": w.end, "text": t})
    with open(out, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print(f"segments={len(res['segments'])} words={len(res['words'])} dur={info.duration:.1f}")


if __name__ == "__main__":
    main()
