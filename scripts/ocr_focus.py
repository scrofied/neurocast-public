"""Locate UI targets in a screenshot with local OCR.

usage: python ocr_focus.py <image> <json list of target phrases>
prints JSON: {"width":W,"height":H,"hits":[{"q":..., "x":..,"y":..,"w":..,"found":bool}]}
coordinates normalised 0..1
"""
import json
import sys

from PIL import Image


def main():
    path = sys.argv[1]
    targets = json.loads(sys.argv[2]) if len(sys.argv) > 2 else []
    im = Image.open(path)
    W, H = im.size
    out = {"width": W, "height": H, "hits": []}
    if not targets:
        print(json.dumps(out, ensure_ascii=False))
        return
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception:
        out["error"] = "rapidocr_onnxruntime not installed"
        print(json.dumps(out, ensure_ascii=False))
        return
    ocr = RapidOCR()
    res, _ = ocr(path)
    boxes = []
    for box, text, score in res or []:
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        boxes.append({"text": text, "x0": min(xs), "x1": max(xs), "y0": min(ys), "y1": max(ys)})

    def score(q, t):
        if q in t:
            return 1.0 - (len(t) - len(q)) / max(20, len(t) * 3)
        common = sum(1 for c in set(q) if c in t)
        return common / max(1, len(set(q))) * 0.7

    for q in targets:
        best, bs = None, 0.0
        for b in boxes:
            s = score(q, b["text"])
            if s > bs:
                best, bs = b, s
        if best and bs >= 0.5:
            out["hits"].append({
                "q": q,
                "x": (best["x0"] + best["x1"]) / 2 / W,
                "y": (best["y0"] + best["y1"]) / 2 / H,
                "w": max(0.08, (best["x1"] - best["x0"]) / W * 1.6),
                "found": True,
                "text": best["text"],
            })
        else:
            out["hits"].append({"q": q, "found": False})
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
