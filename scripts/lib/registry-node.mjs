// Load the TSX component registry inside Node (esbuild bundle, packages external) so the planner can
// validate every shot's data against the component's zod schema and generate CATALOG.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let cached = null;
export const loadRegistry = async () => {
  if (cached) return cached;
  const { build } = await import("esbuild");
  // 产物名带 pid：make.mjs / catalog.mjs / motion-audit.mjs 同时跑时，会互相覆盖同一个
  // 文件并 import 到半成品（症状是 REGISTRY undefined → "Cannot read properties of undefined"）
  const outfile = path.join(ROOT, ".cache", `registry.node.${process.pid}.mjs`);
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  await build({
    entryPoints: [path.join(ROOT, "src", "components", "registry.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    jsx: "automatic",
    packages: "external",
    logLevel: "error",
  });
  const mod = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
  const byId = Object.fromEntries(mod.REGISTRY.map((c) => [c.id, c]));
  cached = { list: mod.REGISTRY, byId };
  return cached;
};

const fmtIssue = (iss) => `${iss.path?.length ? iss.path.join(".") : "(root)"}: ${iss.message}`;

// returns { ok, data (defaults applied), issues[] }
export const validateShot = (reg, type, data) => {
  const def = reg.byId[type];
  if (!def) return { ok: false, issues: [`未知组件 "${type}"（可用：${Object.keys(reg.byId).join(", ")}）`] };
  const r = def.schema.safeParse(data ?? {});
  if (r.success) return { ok: true, data: r.data, def };
  return { ok: false, issues: r.error.issues.map(fmtIssue), def };
};
