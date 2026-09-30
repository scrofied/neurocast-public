import { rng } from "./anim";

// sample target points from rendered text (offscreen canvas)
const cache = new Map<string, { x: number; y: number }[]>();

export const sampleText = (text: string, font: string, fontSize: number, maxPts: number, step = 6) => {
  const key = `${text}|${font}|${fontSize}|${maxPts}|${step}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = `900 ${fontSize}px ${font}`;
  const w = Math.ceil(ctx.measureText(text).width) + 20;
  const h = Math.ceil(fontSize * 1.3);
  c.width = w;
  c.height = h;
  ctx.font = `900 ${fontSize}px ${font}`;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 10, h / 2);
  const img = ctx.getImageData(0, 0, w, h).data;
  let pts: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step) if (img[(y * w + x) * 4 + 3] > 128) pts.push({ x: x - w / 2, y: y - h / 2 });
  if (pts.length > maxPts) {
    const r = rng(pts.length);
    pts = pts.filter(() => r() < maxPts / pts.length);
  }
  cache.set(key, pts);
  return pts;
};
