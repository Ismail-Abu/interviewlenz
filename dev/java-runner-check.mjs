// Dev check for the in-browser Java runner's logic, run on a LOCAL JVM (the
// browser uses the same classes under CheerpJ). Generates each problem's
// harness with lib/javaHarness.ts and runs IlzMem.run() from public/cheerpj/ilz-runner.jar
// against correct, buggy, non-compiling, throwing and never-ending solutions.
// Skips (passes with a notice) when no JDK is installed.
//
// Run: node dev/java-runner-check.mjs

import { build } from "esbuild";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
// public/cheerpj/ is compiled for Java 21 (CheerpJ's runtime), so a local JDK
// must be 21 or newer to load it.
let jdk = 0;
try {
  const v = execFileSync("javac", ["-version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  jdk = Number(/javac (\d+)/.exec(v)?.[1] ?? 0);
} catch {
  // no JDK
}
if (jdk < 21) {
  console.log(`SKIP  needs JDK 21+ on PATH (found ${jdk || "none"}); the Java runner logic was not exercised`);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "java-runner-"));
async function load(entry) {
  const out = await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", write: false, logLevel: "error" });
  const p = join(dir, `m${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(p, out.outputFiles[0].text);
  return import(pathToFileURL(p).href);
}
const { buildJavaHarness } = await load(join(ROOT, "lib", "javaHarness.ts"));
const bank = await load(join(ROOT, "lib", "problems.ts"));

// Tiny driver: IlzMem.run(<solution file>, <harness file>, <ms>) -> stdout.
writeFileSync(join(dir, "Drive.java"), `import java.nio.file.*;
public class Drive { public static void main(String[] a) throws Exception {
  System.out.print(IlzMem.run(new String(Files.readAllBytes(Paths.get(a[0])), "UTF-8"), new String(Files.readAllBytes(Paths.get(a[1])), "UTF-8"), Integer.parseInt(a[2])));
} }`);
const cp = [join(ROOT, "public", "cheerpj", "ilz-runner.jar"), dir].join(delimiter);
execFileSync("javac", ["-cp", cp, "-d", dir, join(dir, "Drive.java")]);

let n = 0;
function run(problem, solution, ms = 5000) {
  const sol = join(dir, `sol${++n}.java`), har = join(dir, `har${n}.java`);
  writeFileSync(sol, solution);
  writeFileSync(har, buildJavaHarness(problem, problem.java));
  const started = Date.now();
  const r = spawnSync("java", ["-cp", cp, "Drive", sol, har, String(ms)], { encoding: "utf8", timeout: 30000 });
  return { json: JSON.parse(r.stdout || "null"), ms: Date.now() - started, stderr: r.stderr };
}
let fails = 0;
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };
const score = (j) => (j?.kind === "completed" ? `${j.cases.filter((c) => c.pass).length}/${j.cases.length}` : JSON.stringify(j));

const CORRECT = {
  "contains-duplicate": `import java.util.*;
class Solution {
    public boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int n : nums) if (!seen.add(n)) return true;
        return false;
    }
}`,
  "two-sum": `import java.util.*;
class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> at = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer j = at.get(target - nums[i]);
            if (j != null) return new int[] { j, i };
            at.put(nums[i], i);
        }
        return new int[0];
    }
}`,
  "valid-anagram": `class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] count = new int[26];
        for (char c : s.toCharArray()) count[c - 'a']++;
        for (char c : t.toCharArray()) if (--count[c - 'a'] < 0) return false;
        return true;
    }
}`,
  "max-profit": `class Solution {
    public int maxProfit(int[] prices) {
        int best = 0, low = Integer.MAX_VALUE;
        for (int p : prices) { low = Math.min(low, p); best = Math.max(best, p - low); }
        return best;
    }
}`,
};

console.log("== 1. A correct Java solution passes every case, for every bank problem");
for (const p of bank.problems) {
  const r = run(p, CORRECT[p.id]);
  assert(`1 ${p.id}: 4/4`, score(r.json) === "4/4", score(r.json) + " " + r.stderr.slice(0, 200));
}

const cd = bank.containsDuplicate;
console.log("== 2. Results look like the Python runner's (input, expected, actual, stdout)");
{
  const r = run(cd, `class Solution {
    public boolean containsDuplicate(int[] nums) {
        System.out.println("len " + nums.length);
        for (int i = 1; i < nums.length; i++) if (nums[i] == nums[i - 1]) return true;
        return false;
    }
}`);
  const c1 = r.json?.cases?.[0];
  assert("2a buggy adjacent-only solution: 3/4 with c1 failing", score(r.json) === "3/4" && c1?.pass === false, score(r.json));
  assert("2b c1 shows Java-style input/expected/actual", c1?.input === "nums = [1, 2, 3, 1]" && c1?.expected === "true" && c1?.actual === "false", JSON.stringify(c1));
  assert("2c System.out is captured per case", c1?.stdout === "len 4\n", JSON.stringify(c1?.stdout));
  const ts = run(bank.twoSum, CORRECT["two-sum"]).json?.cases?.[0];
  assert("2d int[] results render like [0, 1]", ts?.actual === "[0, 1]" && ts?.expected === "[0, 1]" && ts?.input === "nums = [2, 7, 11, 15], target = 9", JSON.stringify(ts));
  const an = run(bank.validAnagram, CORRECT["valid-anagram"]).json?.cases?.[0];
  assert("2e String inputs render quoted", an?.input === 's = "anagram", t = "nagaram"', JSON.stringify(an));
}

console.log("== 3. Errors");
{
  const syn = run(cd, `class Solution {
    public boolean containsDuplicate(int[] nums) {
        return nums.length > 1
    }
}`).json;
  assert("3a syntax error -> syntax_error on the right line", syn?.kind === "error" && syn.code === "syntax_error" && syn.line === 3 && /';' expected/.test(syn.message), JSON.stringify(syn));
  const type = run(cd, `class Solution {
    public boolean containsDuplicate(int[] nums) {
        int x = "text";
        return false;
    }
}`).json;
  assert("3b type error -> syntax_error with its line", type?.code === "syntax_error" && type.line === 3, JSON.stringify(type));
  const missing = run(cd, cd.java.starterCode).json;
  assert("3c the empty starter reports 'missing return statement'", missing?.code === "syntax_error" && /missing return/.test(missing.message), JSON.stringify(missing));
  const thr = run(cd, `class Solution {
    public boolean containsDuplicate(int[] nums) {
        return nums[0] == nums[1];
    }
}`).json;
  const c3 = thr?.cases?.find((c) => c.caseId === "c3");
  assert("3d an exception fails only that case, with its name", thr?.kind === "completed" && c3?.pass === false && /ArrayIndexOutOfBoundsException/.test(c3?.error ?? ""), JSON.stringify(c3));
  const wrongName = run(cd, `class Answer { }`).json;
  assert("3e no Solution class -> a compile error, not a crash", wrongName?.code === "syntax_error", JSON.stringify(wrongName));
}

console.log("== 4. Runaway code ends as a timeout instead of hanging");
{
  const loops = {
    "while (true) with braces": "while (true) { }",
    "braceless for": "for (;;) ;",
    "nested loops": "for (int i = 0; ; i++) { for (int j = 0; j < 10; j++) { } }",
    "do-while": "int k = 0; do { k++; } while (true);",
  };
  for (const [name, body] of Object.entries(loops)) {
    const r = run(cd, `class Solution {
    public boolean containsDuplicate(int[] nums) {
        ${body}
    }
}`, 1500);
    assert(`4 ${name}: timeout within the limit`, r.json?.code === "timeout" && r.ms < 10000, `${JSON.stringify(r.json)} in ${r.ms} ms`);
  }
  const rec = run(cd, `class Solution {
    public boolean containsDuplicate(int[] nums) { return containsDuplicate(nums); }
}`, 1500).json;
  assert("4e infinite recursion fails cleanly (StackOverflowError or timeout)", rec?.code === "timeout" || rec?.cases?.every((c) => /StackOverflowError/.test(c.error ?? "")), JSON.stringify(rec).slice(0, 160));
  const lines = run(cd, `class Solution {
    public boolean containsDuplicate(int[] nums) {
        for (int i = 0; i < nums.length; i++)
            for (int j = i + 1; j < nums.length; j++)
                if (nums[i] == nums[j]) return true;
        return false;
    }
}`).json;
  assert("4f the guard leaves working braceless nested loops correct", score(lines) === "4/4", score(lines));
}

console.log(fails ? `\n${fails} check(s) FAILED` : "\nALL JAVA RUNNER CHECKS PASSED");
process.exit(fails ? 1 : 0);
