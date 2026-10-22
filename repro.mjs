// Usage: node repro.mjs [next version]
// Builds the app, starts `next start` with the OTel preload, sends 10 page and
// 10 API requests, and counts the OTel SDK's "ended Span" warnings.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

// REPRO_KEEP_INSTALL=1 keeps node_modules as it is (e.g. with a patched
// next/dist/server/base-server.js) instead of installing the version asked.
if (process.env.REPRO_KEEP_INSTALL !== "1") {
  const version = process.argv[2] ?? "16.4.2";
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  pkg.dependencies.next = version;
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--silent"], { stdio: "inherit" });
}
execFileSync("npx", ["next", "build"], { stdio: "ignore" });

const port = 3123;
let log = "";
const server = spawn("npx", ["next", "start", "-p", String(port)], {
  env: { ...process.env, NODE_OPTIONS: "--require ./otel-preload.cjs" },
});
server.stdout.on("data", (chunk) => (log += chunk));
server.stderr.on("data", (chunk) => (log += chunk));
try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ok = await fetch(`http://localhost:${port}/items/0`).then((r) => r.ok, () => false);
    if (ok) break;
    await sleep(1000);
  }
  const installed = JSON.parse(readFileSync("node_modules/next/package.json", "utf8")).version;
  const warnings = () =>
    log.split("\n").filter((line) => line.includes("Cannot execute the operation on ended Span")).length;
  for (const [kind, path] of [
    ["page", "/items/"],
    ["route handler", "/api/items/"],
  ]) {
    log = "";
    for (let i = 1; i <= 10; i += 1) await fetch(`http://localhost:${port}${path}${i}`).then((r) => r.text());
    await sleep(1000);
    console.log(`next ${installed}, ${kind}: ${warnings()} "ended Span" warnings over 10 requests`);
  }
} finally {
  server.kill();
}
