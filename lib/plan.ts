// Interview plan helpers for the application-first flow (lib/contract.ts,
// "Application-first flow"). Pure and dependency-free: used by the browser
// (fallback plans, edits, validation of /api/interview-plan responses) and by
// the server route. Private candidate material (listing text, resume context)
// is never copied into themes or citations: themes name their source kind only.
import type {
  ApplicationTarget,
  BehavioralContext,
  InterviewPlan,
  PlanCitation,
  PlanRef,
  PlanTheme,
  Problem,
  RoleContext,
} from "./contract";
import { normalizeBehavioralContext } from "./behavioral";
import { getProblem } from "./problems";

export const PLAN_LIMITS = { themes: 8, citations: 8, label: 80, detail: 240, title: 160, publisher: 80, bodyBytes: 16_384 } as const;
// The only problem today. A plan always names a problem that exists.
export const DEFAULT_PROBLEM_ID: Problem["id"] = "contains-duplicate";
export const PLAN_TIMEOUT_MS = 20_000;

export function newPlanId(): string {
  return `plan_${crypto.randomUUID()}`;
}

function line(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

// --- Role-based fallback ----------------------------------------------------

type Seed = { round: PlanTheme["round"]; label: string; detail: string; provenance: PlanTheme["provenance"] };

// Keyword -> generic theme. Matching uses the listing, but the theme text is
// ours: nothing from the listing is copied into the plan.
const LISTING_SIGNALS: { re: RegExp; seed: Omit<Seed, "provenance"> }[] = [
  { re: /\b(debug|incident|on-?call|production|outage)/i, seed: { round: "behavioral", label: "Debugging a production problem", detail: "The listing mentions owning or debugging live systems." } },
  { re: /\b(distributed|scal(e|ing|able)|throughput|latency|high[- ]traffic)/i, seed: { round: "technical", label: "Efficiency at scale", detail: "The listing stresses scale or performance, so expect time and space trade-off questions." } },
  { re: /\b(api|backend|service|microservice|database|sql)/i, seed: { round: "technical", label: "Data structures behind fast lookups", detail: "Backend roles often probe hash-based lookups and their costs." } },
  { re: /\b(team|collaborat|cross[- ]functional|stakeholder|mentor)/i, seed: { round: "behavioral", label: "Working through a disagreement", detail: "The listing emphasizes collaboration." } },
  { re: /\b(ship|deadline|fast[- ]paced|startup|ownership|own)/i, seed: { round: "behavioral", label: "Shipping under a deadline", detail: "The listing emphasizes ownership and pace." } },
  { re: /\b(test|quality|reliab)/i, seed: { round: "technical", label: "Testing edge cases", detail: "The listing mentions quality or reliability, so expect questions about empty and repeated inputs." } },
];

const ROLE_DEFAULTS: Seed[] = [
  { round: "technical", label: "Hash-based lookups and duplicates", detail: "A common early screen for software roles; you will explain the approach and its cost.", provenance: { kind: "role-default" } },
  { round: "technical", label: "Time and space trade-offs", detail: "Interviewers usually ask you to compare a brute-force and a faster approach.", provenance: { kind: "role-default" } },
  { round: "behavioral", label: "A hard bug you debugged", detail: "A common engineering-story opener: what you personally did and how you knew it worked.", provenance: { kind: "role-default" } },
];

export interface FallbackOptions {
  planId?: string;
  now?: Date;
  reason?: NonNullable<InterviewPlan["fallbackReason"]>;
}

// A usable plan from the inputs alone: no network, no model, never throws.
export function buildFallbackPlan(application: ApplicationTarget, opts: FallbackOptions = {}): InterviewPlan {
  const role: RoleContext = application.roleContext ?? {};
  const listing = role.jobDescription ?? "";
  const seeds: Seed[] = [];
  for (const s of LISTING_SIGNALS) {
    if (listing && s.re.test(listing) && !seeds.some((x) => x.label === s.seed.label)) seeds.push({ ...s.seed, provenance: { kind: "job-listing" } });
  }
  const focus = normalizeBehavioralContext(application.resumeContext);
  const resume = focus.ok ? focus.value : undefined;
  if (resume?.project) {
    seeds.unshift({ round: "behavioral", label: "A decision on your own project", detail: "From the project you confirmed: what you built, why, and what happened.", provenance: { kind: "candidate-resume" } });
  }
  for (const d of ROLE_DEFAULTS) if (!seeds.some((x) => x.round === d.round && x.label === d.label)) seeds.push(d);
  // Keep at least one theme per round, at most PLAN_LIMITS.themes overall.
  const picked = [...seeds.filter((s) => s.round === "technical").slice(0, 4), ...seeds.filter((s) => s.round === "behavioral").slice(0, 4)];
  const themes: PlanTheme[] = picked.map((s, i) => ({ id: `th${i + 1}` as PlanTheme["id"], round: s.round, label: s.label, detail: s.detail, provenance: s.provenance }));
  return {
    planId: opts.planId ?? newPlanId(),
    revision: 1,
    createdAt: (opts.now ?? new Date()).toISOString(),
    source: "role-fallback",
    target: pickTarget(role),
    technical: { problemId: DEFAULT_PROBLEM_ID, themeIds: themes.filter((t) => t.round === "technical").map((t) => t.id) },
    behavioral: { ...(resume ? { focus: resume } : {}), themeIds: themes.filter((t) => t.round === "behavioral").map((t) => t.id) },
    themes,
    citations: [],
    fallbackReason: opts.reason ?? "research_unavailable",
  };
}

function pickTarget(role: RoleContext): InterviewPlan["target"] {
  const t: InterviewPlan["target"] = {};
  if (role.company) t.company = role.company;
  if (role.role) t.role = role.role;
  if (role.level) t.level = role.level;
  return t;
}

// --- Validation -------------------------------------------------------------

export type PlanResult = { ok: true; value: InterviewPlan } | { ok: false; message: string };

const PROVENANCE = new Set(["public-research", "job-listing", "candidate-resume", "role-default"]);
const LEVELS = new Set(["intern", "new-grad", "mid", "senior"]);
const REASONS = new Set(["research_unavailable", "not_configured", "timeout", "no_public_sources", "manual"]);

// Validate and bound a plan from /api/interview-plan (or a client edit).
// Drops what it can't trust instead of guessing: unknown citations, theme refs
// to missing citations, https-less URLs. A plan with no themes is rejected.
export function normalizeInterviewPlan(raw: unknown): PlanResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, message: "plan must be an object" };
  const p = raw as Record<string, unknown>;
  const planId = typeof p.planId === "string" && /^plan_[A-Za-z0-9-]{8,64}$/.test(p.planId) ? p.planId : undefined;
  if (!planId) return { ok: false, message: "plan.planId must look like plan_<id>" };
  const revision = Number.isInteger(p.revision) && (p.revision as number) >= 1 ? (p.revision as number) : undefined;
  if (!revision) return { ok: false, message: "plan.revision must be a positive integer" };
  if (p.source !== "researched" && p.source !== "role-fallback") return { ok: false, message: "plan.source is invalid" };
  const createdAt = typeof p.createdAt === "string" && !Number.isNaN(Date.parse(p.createdAt)) ? p.createdAt : undefined;
  if (!createdAt) return { ok: false, message: "plan.createdAt must be an ISO date" };

  const tech = (p.technical ?? {}) as Record<string, unknown>;
  const problemId = typeof tech.problemId === "string" && getProblem(tech.problemId) ? (tech.problemId as Problem["id"]) : undefined;
  if (!problemId) return { ok: false, message: "plan.technical.problemId is not a known problem" };

  const citations: PlanCitation[] = [];
  for (const c of Array.isArray(p.citations) ? p.citations.slice(0, PLAN_LIMITS.citations) : []) {
    const x = (c ?? {}) as Record<string, unknown>;
    const id = typeof x.id === "string" && /^c\d{1,3}$/.test(x.id) ? (x.id as PlanCitation["id"]) : undefined;
    const title = line(x.title, PLAN_LIMITS.title);
    let url: string | undefined;
    try {
      url = typeof x.url === "string" && new URL(x.url).protocol === "https:" ? new URL(x.url).toString() : undefined;
    } catch {
      url = undefined;
    }
    const retrievedAt = typeof x.retrievedAt === "string" && !Number.isNaN(Date.parse(x.retrievedAt)) ? x.retrievedAt : undefined;
    if (!id || !title || !url || !retrievedAt || citations.some((k) => k.id === id)) continue;
    const publisher = line(x.publisher, PLAN_LIMITS.publisher);
    citations.push({ id, title, url, retrievedAt, ...(publisher ? { publisher } : {}) });
  }
  const citationIds = new Set(citations.map((c) => c.id));

  const themes: PlanTheme[] = [];
  for (const t of Array.isArray(p.themes) ? p.themes.slice(0, PLAN_LIMITS.themes) : []) {
    const x = (t ?? {}) as Record<string, unknown>;
    const id = typeof x.id === "string" && /^th\d{1,3}$/.test(x.id) ? (x.id as PlanTheme["id"]) : undefined;
    const round = x.round === "technical" || x.round === "behavioral" ? x.round : undefined;
    const label = line(x.label, PLAN_LIMITS.label);
    const pv = (x.provenance ?? {}) as Record<string, unknown>;
    if (!id || !round || !label || typeof pv.kind !== "string" || !PROVENANCE.has(pv.kind) || themes.some((k) => k.id === id)) continue;
    let provenance: PlanTheme["provenance"];
    if (pv.kind === "public-research") {
      const ids = (Array.isArray(pv.citationIds) ? pv.citationIds : []).filter((c): c is PlanCitation["id"] => typeof c === "string" && citationIds.has(c as PlanCitation["id"]));
      if (!ids.length) continue; // a research claim must cite a kept public source
      provenance = { kind: "public-research", citationIds: ids };
    } else {
      provenance = { kind: pv.kind as "job-listing" | "candidate-resume" | "role-default" };
    }
    const detail = line(x.detail, PLAN_LIMITS.detail);
    themes.push({ id, round, label, provenance, ...(detail ? { detail } : {}) });
  }
  if (!themes.length) return { ok: false, message: "plan.themes is empty" };
  const themeIds = new Set(themes.map((t) => t.id));
  const keepIds = (v: unknown, round: PlanTheme["round"]) =>
    (Array.isArray(v) ? v : []).filter((id): id is PlanTheme["id"] => typeof id === "string" && themeIds.has(id as PlanTheme["id"]) && themes.find((t) => t.id === id)?.round === round);

  const beh = (p.behavioral ?? {}) as Record<string, unknown>;
  const focus = normalizeBehavioralContext(beh.focus);
  if (!focus.ok) return { ok: false, message: focus.message };

  const tg = (p.target ?? {}) as Record<string, unknown>;
  const target: InterviewPlan["target"] = {};
  const company = line(tg.company, 80);
  const role = line(tg.role, 100);
  if (company) target.company = company;
  if (role) target.role = role;
  if (typeof tg.level === "string" && LEVELS.has(tg.level)) target.level = tg.level as RoleContext["level"];

  const fallbackReason = typeof p.fallbackReason === "string" && REASONS.has(p.fallbackReason) ? (p.fallbackReason as InterviewPlan["fallbackReason"]) : undefined;
  return {
    ok: true,
    value: {
      planId,
      revision,
      createdAt,
      source: p.source,
      target,
      technical: { problemId, themeIds: keepIds(tech.themeIds, "technical") },
      behavioral: { ...(focus.value ? { focus: focus.value } : {}), themeIds: keepIds(beh.themeIds, "behavioral") },
      themes,
      citations: p.source === "researched" ? citations : [],
      ...(fallbackReason ? { fallbackReason } : {}),
    },
  };
}

// --- Edits and references ---------------------------------------------------

export interface PlanEdits {
  removeThemeIds?: PlanTheme["id"][];
  behavioralFocus?: BehavioralContext | null; // null removes it
}

// A student edit before the plan is started: same planId, revision + 1.
export function revisePlan(plan: InterviewPlan, edits: PlanEdits): InterviewPlan {
  const drop = new Set(edits.removeThemeIds ?? []);
  const themes = plan.themes.filter((t) => !drop.has(t.id));
  let focus = plan.behavioral.focus;
  if (edits.behavioralFocus === null) focus = undefined;
  else if (edits.behavioralFocus !== undefined) {
    const n = normalizeBehavioralContext(edits.behavioralFocus);
    focus = n.ok ? n.value : focus;
  }
  return {
    ...plan,
    revision: plan.revision + 1,
    themes,
    technical: { ...plan.technical, themeIds: plan.technical.themeIds.filter((id) => !drop.has(id)) },
    behavioral: { ...(focus ? { focus } : {}), themeIds: plan.behavioral.themeIds.filter((id) => !drop.has(id)) },
  };
}

export function planRef(plan: InterviewPlan, round: PlanRef["round"]): PlanRef {
  return { planId: plan.planId, revision: plan.revision, round };
}
