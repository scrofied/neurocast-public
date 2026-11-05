import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("make validates actual storyboard cues, evidence, drafts and raw required fields", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nc-op-pipeline-"));
  const prefix = path.basename(dir) + "_";
  const script = "为什么越忙反而越慢。切换任务需要找回上下文。先关掉通知只留下当前这件事。现在把工作拆成一个动作再开始。";
  const json = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data));
  const ledgerBefore = fs.readFileSync(path.join(ROOT, "usage/library.json"), "utf8");
  try {
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=220:duration=14", "-ar", "48000", path.join(dir, "voice.wav")]);
    json("words.json", { words: Array.from(script).map((text, i) => ({ text, start: i * 0.22, end: (i + 1) * 0.22 })) });
    json("input.json", { title: "开场管线测试", script, audio: "voice.wav", audio_timeline: "words.json", storyboard: "storyboard.json" });
    const data = { hook: "为什么越忙反而越慢", proof: "切换任务需要找回上下文", payoff: "先关掉通知只留一件事", proofAt: "切换任务", payoffAt: "先关掉通知" };
    const shots = [{ type: "narration", data: { keywords: ["先做一件事"] } }];
    const run = (opening, body = shots) => {
      json("storyboard.json", { opening, shots: body });
      return spawnSync(process.execPath, [path.join(ROOT, "scripts/make.mjs"), path.join(dir, "input.json"), "--plan-only", "--no-usage-check"], { cwd: ROOT, encoding: "utf8", timeout: 120000 });
    };
    const opening = { type: "op-quiet-question", at: 0, until: 8, data };
    const good = run(opening);
    assert.equal(good.status, 0, good.stderr + good.stdout);
    const timelinePath = /时间轴：([^\r\n]+)/.exec(good.stdout)?.[1]?.trim();
    assert.ok(timelinePath);
    const timeline = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
    assert.equal(timeline.opening.until, 240);
    assert.equal(typeof timeline.opening.data.proofAt, "number");
    assert.ok(timeline.opening.data.payoffAt > timeline.opening.data.proofAt);
    assert.equal(timeline.opening.data.sound, "quiet");
    for (const [bad, message] of [
      [{ ...opening, data: { ...data, hook: undefined } }, /显式填写 data.hook/],
      [{ ...opening, until: 4 }, /可读时间/],
      [{ ...opening, until: 30 }, /被截断/],
      [{ type: "opening-ai-siceng", at: 0, until: 3, data: {} }, /未定制骨架/],
      [{ ...opening, type: "op-result-first" }, /result.src/],
    ]) {
      const result = run(bad);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, message);
    }
    const resultData = { ...data, result: { src: path.join(ROOT, "examples/0930-ability-audit/assets-src/arena-rank-overall.png"), source: { platform: "测试用现有截图", capturedAt: "2026-10-17" } } };
    const evidence = run({ ...opening, type: "op-result-first", data: resultData });
    assert.equal(evidence.status, 0, evidence.stderr + evidence.stdout);
    const evidenceTimeline = JSON.parse(fs.readFileSync(/时间轴：([^\r\n]+)/.exec(evidence.stdout)[1].trim(), "utf8"));
    assert.match(evidenceTimeline.opening.data.result.src, /^jobs\//);
    assert.equal(evidenceTimeline.opening.data.result.source.capturedAt, "2026-10-17");
    const layered = run(opening, [{ type: "op-quiet-question", data: { ...data, proofAt: 2, payoffAt: 5 } }, ...shots]);
    assert.notEqual(layered.status, 0, layered.stdout);
    assert.match(layered.stderr, /顶层opening与首镜头开场重复/);
    const direct = run(undefined, [{ type: "op-quiet-question", data: { ...data, hook: undefined } }]);
    assert.notEqual(direct.status, 0);
    assert.match(direct.stderr, /显式填写 data.hook/);
    assert.equal(fs.readFileSync(path.join(ROOT, "usage/library.json"), "utf8"), ledgerBefore);
  } finally {
    for (const name of fs.readdirSync(path.join(ROOT, "public/jobs"))) if (name.startsWith(prefix)) fs.rmSync(path.join(ROOT, "public/jobs", name), { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
