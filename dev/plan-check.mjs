// Dev check for the application-first plan contract (lib/plan.ts). Pure: no
// network, no key. Also (re)generates docs/examples/plan-fallback.json with
// --write, so the example can't drift from buildFallbackPlan.
//
// Run: node --experimental-strip-types dev/plan-check.mjs [--write]

import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), "plan-check-"));
const out = await build({ entryPoints: [join(ROOT, "lib", "plan.ts")], bundle: true, format: "esm", platform: "node", write: false, logLevel: "error" });
writeFileSync(join(dir, "plan.mjs"), out.outputFiles[0].text);
const { buildFallbackPlan, normalizeInterviewPlan, revisePlan, planRef, DEFAULT_PROBLEM_ID } = await import(pathToFileURL(join(dir, "plan.mjs")).href);

let fails = 0;
// Key-order-independent JSON (the validator may emit keys in another order).
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const assert = (label, cond, extra) => { if (!cond) fails += 1; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond || extra === undefined ? "" : `  (${extra})`}`); };

const LISTING = "SECRET-LISTING-MARKER Synthetic Payments Co is hiring a Backend Intern to build APIs, debug production issues, and work cross-functionally at high throughput. Contact recruiter@synthetic.example.";
const APP = {
  roleContext: { company: "Synthetic Payments Co", role: "Backend Engineering Intern", level: "intern", jobDescription: LISTING },
  resumeContext: { project: { name: "CampusEats Orders Service", summary: "Built the order API for a student food-delivery app." }, focus: { skill: "Debugging production issues" } },
};

console.log("== 1. Fallback plan");
{
  const p = buildFallbackPlan(APP, { planId: "plan_00000000-0000-4000-8000-000000000001", now: new Date("2026-11-15T18:00:00Z"), reason: "research_unavailable" });
  assert("1a valid by the shared validator", normalizeInterviewPlan(p).ok, JSON.stringify(normalizeInterviewPlan(p)));
  assert("1b role-fallback, no citations, selected problem exists", p.source === "role-fallback" && p.citations.length === 0 && p.technical.problemId === DEFAULT_PROBLEM_ID);
  const s = JSON.stringify(p);
  assert("1c no listing text, no contact details in the plan", !s.includes("SECRET-LISTING-MARKER") && !s.includes("recruiter@") && !("jobDescription" in p.target));
  assert("1d listing-derived themes are marked job-listing; resume theme marked candidate-resume", p.themes.some((t) => t.provenance.kind === "job-listing") && p.themes.some((t) => t.provenance.kind === "candidate-resume"));
  assert("1e both rounds have themes; theme ids match their round", p.technical.themeIds.length > 0 && p.behavioral.themeIds.length > 0 && p.technical.themeIds.every((id) => p.themes.find((t) => t.id === id).round === "technical"));
  assert("1f confirmed resume context becomes the behavioral focus", p.behavioral.focus?.project?.name === "CampusEats Orders Service");
  const manual = buildFallbackPlan({ roleContext: { role: "Software Engineer" } }, { reason: "manual" });
  assert("1g manual role only (no listing, no resume) -> usable role-default plan", normalizeInterviewPlan(manual).ok && manual.themes.every((t) => t.provenance.kind === "role-default") && !manual.behavioral.focus);
  const empty = buildFallbackPlan({ roleContext: {} });
  assert("1h empty input still yields a usable plan", normalizeInterviewPlan(empty).ok);
  if (process.argv.includes("--write")) {
    writeFileSync(join(ROOT, "docs", "examples", "plan-fallback.json"), JSON.stringify({ plan: p }, null, 2) + "\n");
    console.log("      wrote docs/examples/plan-fallback.json");
  }
  const onDisk = JSON.parse(readFileSync(join(ROOT, "docs", "examples", "plan-fallback.json"), "utf8"));
  assert("1i docs/examples/plan-fallback.json matches buildFallbackPlan", JSON.stringify(onDisk.plan) === JSON.stringify(p));
}

console.log("== 2. Researched example + validation");
{
  const ex = JSON.parse(readFileSync(join(ROOT, "docs", "examples", "plan-researched.json"), "utf8")).plan;
  const n = normalizeInterviewPlan(ex);
  assert("2a researched example is valid and unchanged by normalization", n.ok && canon(n.value) === canon(ex), n.ok ? "" : n.message);
  const bad = structuredClone(ex);
  bad.citations[0].url = "http://insecure.example/x";
  const nb = normalizeInterviewPlan(bad);
  assert("2b non-https citation dropped, and research themes citing only it are dropped", nb.ok && !nb.value.citations.some((c) => c.id === "c1") && !nb.value.themes.some((t) => t.id === "th1") && nb.value.themes.some((t) => t.id === "th2"));
  const fake = structuredClone(ex);
  fake.themes[0].provenance.citationIds = ["c9"];
  assert("2c a research theme citing a missing source is dropped", !normalizeInterviewPlan(fake).value.themes.some((t) => t.id === "th1"));
  const fb = structuredClone(ex);
  fb.source = "role-fallback";
  assert("2d a fallback plan never carries citations", normalizeInterviewPlan(fb).value.citations.length === 0);
  assert("2e unknown problem rejected", !normalizeInterviewPlan({ ...ex, technical: { problemId: "no-such-problem", themeIds: [] } }).ok);
  assert("2f bad planId rejected", !normalizeInterviewPlan({ ...ex, planId: "123" }).ok);
  const ctl = structuredClone(ex);
  ctl.themes[0].label = "x\u0000y" + "z".repeat(200);
  assert("2g text fields stripped of control chars and bounded", normalizeInterviewPlan(ctl).value.themes[0].label.length <= 81 && !normalizeInterviewPlan(ctl).value.themes[0].label.includes("\u0000"));
}

console.log("== 3. Edits and references");
{
  const ex = JSON.parse(readFileSync(join(ROOT, "docs", "examples", "plan-researched.json"), "utf8")).plan;
  const r = revisePlan(ex, { removeThemeIds: ["th3"], behavioralFocus: { project: { name: "Renamed Project" } } });
  assert("3a edit keeps planId, bumps revision, removes the theme everywhere", r.planId === ex.planId && r.revision === 2 && !r.themes.some((t) => t.id === "th3") && !r.technical.themeIds.includes("th3"));
  assert("3b edited focus replaces the confirmed focus", r.behavioral.focus?.project?.name === "Renamed Project" && !r.behavioral.focus.focus);
  assert("3c removing the focus", !revisePlan(ex, { behavioralFocus: null }).behavioral.focus);
  assert("3d planRef pins id + revision + round", JSON.stringify(planRef(r, "technical")) === JSON.stringify({ planId: ex.planId, revision: 2, round: "technical" }));
  assert("3e original plan object is not mutated", ex.revision === 1 && ex.themes.some((t) => t.id === "th3"));
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PLAN CHECKS PASSED");
process.exit(fails ? 1 : 0);
