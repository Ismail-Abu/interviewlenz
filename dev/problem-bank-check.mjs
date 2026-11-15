// Dev-only check for the practice problem bank (not shipped).
//
// A bad problem is worse than a missing one: a student solves it correctly and
// is told they failed. So this runs a known-good Python solution for every
// problem through the REAL Pyodide runner harness and requires 4/4, and runs a
// deliberately wrong one and requires it to fail. It also pins the shape the
// rest of the app assumes (exactly four cases, ids c1–c4, starter code that
// defines the declared entry point).
//
// Requirements: Node 22+ and the dev deps `pyodide` and `esbuild`.
//
// Run: node --experimental-strip-types dev/problem-bank-check.mjs

import { loadPyodide } from "pyodide";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RUNNER_HARNESS } from "../lib/runnerHarness.ts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const { problems, getProblem, randomProblem } = await import(
  pathToFileURL(join(ROOT, "lib", "problems.ts")).href
);

let fails = 0;
const assert = (label, cond, extra) => {
  if (!cond) fails += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`);
};

// Known-good and deliberately-wrong solutions, by entry point.
const SOLUTIONS = {
  contains_duplicate: {
    good: "def contains_duplicate(nums):\n    return len(set(nums)) != len(nums)\n",
    bad: "def contains_duplicate(nums):\n    return False\n",
  },
  two_sum: {
    good:
      "def two_sum(nums, target):\n" +
      "    seen = {}\n" +
      "    for i, n in enumerate(nums):\n" +
      "        if target - n in seen:\n" +
      "            return [seen[target - n], i]\n" +
      "        seen[n] = i\n",
    bad: "def two_sum(nums, target):\n    return [0, 1]\n",
  },
  is_anagram: {
    good: "def is_anagram(s, t):\n    return sorted(s) == sorted(t)\n",
    bad: "def is_anagram(s, t):\n    return len(s) == len(t)\n",
  },
  max_profit: {
    good:
      "def max_profit(prices):\n" +
      "    best = 0\n" +
      "    low = None\n" +
      "    for p in prices:\n" +
      "        if low is None or p < low:\n" +
      "            low = p\n" +
      "        elif p - low > best:\n" +
      "            best = p - low\n" +
      "    return best\n",
    bad: "def max_profit(prices):\n    return 0\n",
  },
};

console.log("== A. Shape the rest of the app assumes");
assert("A1 the bank has more than one problem", problems.length > 1, `${problems.length}`);
assert("A2 ids are unique", new Set(problems.map((p) => p.id)).size === problems.length);
for (const p of problems) {
  assert(`A3 ${p.id}: exactly four cases, ids c1–c4`,
    p.cases.length === 4 && p.cases.map((c) => c.id).join(",") === "c1,c2,c3,c4",
    p.cases.map((c) => c.id).join(","));
  assert(`A4 ${p.id}: starter code defines ${p.functionName}`,
    p.starterCode.includes(`def ${p.functionName}(`));
  assert(`A5 ${p.id}: getProblem finds it`, getProblem(p.id)?.id === p.id);
  assert(`A6 ${p.id}: has a title, prompt and examples`,
    !!p.title && !!p.prompt && p.examples.length > 0);
  assert(`A7 ${p.id}: a known-good solution exists in this check`, !!SOLUTIONS[p.functionName],
    p.functionName);
}

console.log("\n== B. Every problem is actually solvable (real Pyodide)");
const py = await loadPyodide();
py.runPython(RUNNER_HARNESS);

function run(source, problem) {
  const payload = JSON.stringify({
    source,
    functionName: problem.functionName,
    cases: problem.cases.map((c) => ({ id: c.id, args: c.args, expected: c.expected })),
  });
  const raw = py.runPython(`_run_harness(${JSON.stringify(payload)})`);
  return JSON.parse(raw);
}

for (const p of problems) {
  const sol = SOLUTIONS[p.functionName];
  if (!sol) continue;

  const good = run(sol.good, p);
  const passed = (good.cases ?? []).filter((c) => c.pass).length;
  assert(`B1 ${p.id}: the correct solution passes 4/4`, good.kind === "completed" && passed === 4,
    `${good.kind} ${passed}/4` + (good.cases ?? []).filter((c) => !c.pass).map((c) => ` ${c.id}:${c.actual ?? c.error}`).join(""));

  const bad = run(sol.bad, p);
  const badPassed = (bad.cases ?? []).filter((c) => c.pass).length;
  assert(`B2 ${p.id}: a wrong solution does NOT pass 4/4`, !(bad.kind === "completed" && badPassed === 4),
    `${badPassed}/4`);
}

console.log("\n== C. Random selection");
{
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(randomProblem().id);
  assert("C1 random selection reaches every problem", seen.size === problems.length,
    `${seen.size} of ${problems.length}`);

  const excluded = problems[0].id;
  const after = new Set();
  for (let i = 0; i < 300; i++) after.add(randomProblem(excluded).id);
  assert("C2 exclude keeps the named problem out", !after.has(excluded));
  assert("C3 exclude still returns something", after.size === problems.length - 1, `${after.size}`);

  // With a one-problem bank, excluding it must still return it rather than undefined.
  assert("C4 a problem is always returned", !!randomProblem(excluded)?.id);
}

console.log(`\n${fails === 0 ? "problem-bank-check: all checks passed" : `problem-bank-check: ${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
