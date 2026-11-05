import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadRegistry, validateShot } from "../lib/registry-node.mjs";
import { openingQuality, openingSignature, recentOpeningMatches } from "../lib/opening-quality.mjs";
import { parseMetrics, verdict, previewEnd } from "../lib/opening-metrics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reg = await loadRegistry();
const quiet = reg.byId["op-quiet-question"];
const provided = { hook: "为什么越忙反而越慢", proof: "切换任务需要找回上下文", payoff: "先关掉通知" };
const check = (extra = {}) => openingQuality({ def: quiet, data: quiet.schema.parse(provided), provided, range: { at: 0, until: 240 }, available: 360, ...extra });

test("registry has unique IDs and new opening defaults render", () => {
  assert.equal(new Set(reg.list.map((c) => c.id)).size, reg.list.length);
  for (const id of ["op-result-first", "op-quiet-question", "op-proof-compare", "op-three-beat"]) {
    const c = reg.byId[id];
    assert.ok(validateShot(reg, id, c.example).ok, id);
    assert.equal(c.layer, "opening");
    assert.ok(c.opening.sec >= c.minSec && c.opening.sec <= c.maxSec);
  }
});

test("production requires explicit copy while intentional quiet is allowed", () => {
  assert.deepEqual(check().errors, []);
  assert.deepEqual(check().warnings, []);
  assert.equal(check({ provided: {} }).errors.length, 3);
  assert.match(check({ hasVoice: false }).warnings.join(), /没有检测到人声/);
  assert.match(check({ data: { ...quiet.schema.parse(provided), sound: "pulse" }, sfxEnabled: false }).warnings.join(), /sfx已关闭/);
});

test("draft and placeholder copy cannot pass", () => {
  const draft = reg.byId["opening-ai-siceng"];
  assert.ok(draft.opening.draft);
  assert.match(check({ def: draft }).errors.join(), /未定制骨架/);
  assert.match(check({ data: { ...provided, hook: "<第0帧大字>" } }).errors.join(), /占位文案/);
  assert.equal(quiet.schema.safeParse({ ...provided, hook: "字".repeat(37) }).success, false);
  assert.equal(quiet.schema.safeParse({ ...provided, hook: "第一行\n第二行" }).success, false);
});

test("timing checks reject truncation and leave payoff reading time", () => {
  assert.match(check({ range: { at: -1, until: 240 } }).errors.join(), /有效区间/);
  assert.match(check({ range: { at: 250, until: 240 } }).errors.join(), /有效区间/);
  assert.match(check({ available: 120 }).errors.join(), /被截断/);
  assert.match(check({ range: { until: 160 } }).errors.join(), /可读时间/);
  assert.match(check({ data: { proofAt: 150, payoffAt: 60 } }).errors.join(), /早于/);
  assert.equal(quiet.schema.safeParse({ ...provided, proofAt: 150, payoffAt: 60 }).success, false);
  assert.equal(check({ range: { at: 60, until: 300 } }).errors.length, 0);
  const seconds = { def: { ...quiet, cueUnit: "sec" }, data: { ...provided, proofAt: 2, payoffAt: 5 } };
  assert.deepEqual(check(seconds).errors, []);
  assert.match(check({ ...seconds, range: { until: 160 } }).errors.join(), /可读时间/);
});

test("real evidence requires source and cannot come from stock", () => {
  const def = reg.byId["op-result-first"];
  assert.equal(def.schema.safeParse({ ...provided, result: { src: "result.png" } }).success, false);
  const p = { ...provided, result: { src: "jobs/test/a1.png", source: { platform: "本次操作截图" } } };
  const data = def.schema.parse(p);
  assert.deepEqual(check({ def, data, provided: p }).errors, []);
  assert.match(check({ def, data, provided: p, originOf: () => "D:/assets/stock/pexels/1.png" }).errors.join(), /库存/);
  assert.equal(def.schema.safeParse({ ...p, result: { ...p.result, source: { kind: "stock", platform: "库存" } } }).success, false);
  assert.match(check({ def, data, provided }).errors.join(), /result.src/);
});

test("repetition tracks actual mechanism and excludes current video", () => {
  const signature = openingSignature(quiet, { sound: "quiet" });
  assert.equal(openingSignature(quiet, {}, false).sound, "muted");
  const videos = [{ id: "old", opening: signature }, { id: "same", opening: signature }, { id: "other" }, { id: "new", opening: { ...signature, id: "renamed" } }];
  assert.deepEqual(recentOpeningMatches(signature, videos, "same", 2).map((v) => v.id), ["new"]);
});

test("retention metrics support 2/5/10 seconds and strict numeric validation", () => {
  assert.deepEqual(parseMetrics(["video=片一", "bounce2s=28%", "finish5s=0.61", "finish10s=47", "plays=2100"]), { video: "片一", metrics: { bounce2s: 0.28, finish5s: 0.61, finish10s: 0.47, plays: 2100 } });
  for (const arg of ["plays=-1", "plays=1.5", "plays=10%", "plays=9007199254740992", "bounce2s=NaN", "finish5s=Infinity", "finish10s=101%", "bounce2s=30junk", "finish5s=-0.1", "video=", "unknown=1"]) assert.throws(() => parseMetrics([arg]), arg);
  assert.throws(() => parseMetrics(["finish5s=40%", "finish10s=60%"]));
  assert.match(verdict({ finish10s: 0.5 }), /播放样本量/);
  assert.equal(verdict({}), "待数据");
  assert.match(verdict({ finish5s: 0.6, plays: 20 }), /对照/);
});

test("ten-second preview never exceeds a short source", () => {
  assert.equal(previewEnd(120), 119);
  assert.equal(previewEnd(301), 299);
  assert.equal(previewEnd(1), 0);
  assert.equal(previewEnd(900, 60), 599);
  assert.throws(() => previewEnd(0));
});

test("new-video only creates an isolated project, never registers a placeholder", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nc-opening-test-"));
  const index = path.join(ROOT, "src/openings/index.ts");
  const before = fs.readFileSync(index, "utf8");
  const title = '测试标题 "quoted" ${notCode}';
  const args = [path.join(ROOT, "scripts/new-video.mjs"), "测试", "opening-test", "--at", dir, "--title", title];
  try {
    const r = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const project = path.join(dir, "neurocast-opening-test");
    assert.equal(JSON.parse(fs.readFileSync(path.join(project, "input.json"), "utf8")).title, title);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(project, "storyboard.json"), "utf8")), { keywords: [], shots: [] });
    assert.equal(fs.readFileSync(index, "utf8"), before);
    assert.match(fs.readFileSync(path.join(project, "文案.md"), "utf8"), /\[口播: assets\/presenter\.mp4\]/);
    assert.notEqual(spawnSync(process.execPath, args).status, 0);
    assert.notEqual(spawnSync(process.execPath, [args[0], "测试", "../bad", "--at", dir]).status, 0);
    for (const workspace of [ROOT, path.join(ROOT, "out"), path.join(ROOT, "..child")]) {
      const denied = spawnSync(process.execPath, [args[0], "测试", "opening-test", "--at", workspace], { encoding: "utf8" });
      assert.notEqual(denied.status, 0);
      assert.match(denied.stderr, /母 skill 之外/);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
