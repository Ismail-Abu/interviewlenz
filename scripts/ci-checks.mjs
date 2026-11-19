// Runs the deterministic dev checks that need no credentials, no network, no
// microphone, and no dev server. Used by `npm run test:ci` and by CI.
//
// The list below is an explicit allowlist, NOT a glob over dev/*.mjs. Two
// reasons:
//   1. dev/live-check.mjs talks to the real Gemini API. It reads a key from
//      .env.local and opens a real Live socket, so it can only run manually on
//      a configured machine. It must never be in this list.
//   2. dev/ is shared ground (the behavioral agent is moving browser drivers
//      into it). A glob would silently enlist new files, including ones that
//      need a browser. New checks join CI only by being added here on purpose.
//
// Every check runs; a failure does not stop the rest. The exit code is 1 if any
// check failed, and the summary names each failing check.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Deterministic: @google/genai is stubbed via an esbuild alias, or the check is
// pure (runner-check drives the local pyodide npm package). No real key is used
// even where a stub value is assigned to process.env.
const CHECKS = [
  "runner-check.mjs",
  "problem-bank-check.mjs",
  "report-check.mjs",
  "unrun-draft-check.mjs",
  "score-check.mjs",
  "sponsor-check.mjs",
  "behavioral-check.mjs",
  "tailoring-check.mjs",
  "role-context-check.mjs",
  "live-freshness-check.mjs",
  "live-grounding-check.mjs",
  "live-queue-check.mjs",
  "live-stages-check.mjs",
  "live-transcript-check.mjs",
  "live-turnid-check.mjs",
  "live-reconnect-check.mjs",
  "live-disconnect-check.mjs",
  "live-run-evidence-check.mjs",
  "live-code-sync-check.mjs",
  "java-runner-check.mjs",
  "plan-check.mjs",
];

// Needs real credentials or a human; never run unattended.
const MANUAL_ONLY = ["live-check.mjs"];

const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  console.error(
    `ci-checks: Node 22+ required (found ${process.versions.node}). ` +
      "The checks import TypeScript directly and need --experimental-strip-types.",
  );
  process.exit(1);
}

function run(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings=ExperimentalWarning", join("dev", file)],
      { cwd: ROOT, stdio: "inherit" },
    );
    child.on("error", (err) => resolve({ file, ok: false, code: null, ms: Date.now() - started, err }));
    child.on("close", (code) => resolve({ file, ok: code === 0, code, ms: Date.now() - started }));
  });
}

const missing = CHECKS.filter((f) => !existsSync(join(ROOT, "dev", f)));
if (missing.length) {
  console.error(`ci-checks: listed check(s) not found in dev/: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`ci-checks: ${CHECKS.length} deterministic checks on Node ${process.versions.node}`);
console.log(`ci-checks: skipping (needs a real key or a human): ${MANUAL_ONLY.join(", ")}\n`);

const results = [];
for (const file of CHECKS) {
  console.log(`\n===== ${file} =====`);
  const r = await run(file);
  if (r.err) console.error(`ci-checks: could not start ${file}: ${r.err.message}`);
  results.push(r);
}

const failed = results.filter((r) => !r.ok);

console.log("\n===== summary =====");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.file}  (${r.ms} ms${r.ok ? "" : `, exit ${r.code}`})`);
}

if (failed.length) {
  console.error(`\nci-checks: ${failed.length} of ${results.length} FAILED: ${failed.map((r) => r.file).join(", ")}`);
  process.exit(1);
}

console.log(`\nci-checks: all ${results.length} checks passed.`);
