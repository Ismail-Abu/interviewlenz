// Shape and validation for POST /api/generate-problem. Kept out of
// lib/contract.ts on purpose: the shared Problem type is pinned to the one
// runner-verified problem ("contains-duplicate"), and a generated problem has
// NOT been run against its own tests. It is a practice prompt, never evidence.
import { containsDuplicate } from "../../../lib/problems";

export interface GeneratedCase {
  id: "c1" | "c2" | "c3" | "c4";
  args: unknown[];
  expected: unknown;
}

export interface GeneratedProblem {
  id: string;
  title: string;
  prompt: string;
  functionName: string;
  starterCode: string;
  cases: GeneratedCase[];
}

export interface GenerateProblemResponse {
  problem: GeneratedProblem;
  // "gemini": generated for this role and company. "fallback": an existing
  // problem, because generation is not configured or did not return valid output.
  source: "gemini" | "fallback";
  // Generated tests have not been executed; the expected values come from the model.
  verified: boolean;
  fallbackReason?: "not_configured" | "unavailable" | "timeout" | "invalid_output";
}

export const LIMITS = { role: 80, company: 60, title: 80, prompt: 1500, starter: 800, json: 400 } as const;

const IDENT = /^[a-z_][a-z0-9_]{0,39}$/;
const CASE_IDS = ["c1", "c2", "c3", "c4"] as const;

export function cleanLabel(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function parseJsonValue(v: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof v !== "string" || v.length > LIMITS.json) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(v) };
  } catch {
    return { ok: false };
  }
}

// Model output -> GeneratedProblem, or null when anything is missing or off.
// Arguments and expected values arrive as JSON strings (the response schema
// can't express "any JSON"), and are parsed and bounded here.
export function normalizeGenerated(raw: unknown): GeneratedProblem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = cleanLabel(r.title, LIMITS.title);
  const prompt = typeof r.prompt === "string" ? r.prompt.trim().slice(0, LIMITS.prompt) : "";
  const functionName = typeof r.functionName === "string" ? r.functionName.trim() : "";
  const starterCode = typeof r.starterCode === "string" ? r.starterCode.replace(/\r\n/g, "\n").trimEnd() : "";
  if (!title || !prompt || !IDENT.test(functionName)) return null;
  if (!starterCode || starterCode.length > LIMITS.starter || !new RegExp(`^def ${functionName}\\(`, "m").test(starterCode)) return null;
  if (!Array.isArray(r.cases) || r.cases.length !== 4) return null;

  const cases: GeneratedCase[] = [];
  for (const [i, c] of (r.cases as unknown[]).entries()) {
    if (!c || typeof c !== "object") return null;
    const cc = c as Record<string, unknown>;
    const args = parseJsonValue(cc.argsJson);
    const expected = parseJsonValue(cc.expectedJson);
    if (!args.ok || !expected.ok || !Array.isArray(args.value)) return null;
    cases.push({ id: CASE_IDS[i], args: args.value, expected: expected.value });
  }
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "generated";
  return { id: `generated-${slug}`, title, prompt, functionName, starterCode, cases };
}

export function fallbackResponse(reason: NonNullable<GenerateProblemResponse["fallbackReason"]>): GenerateProblemResponse {
  const p = containsDuplicate;
  return {
    problem: {
      id: p.id,
      title: p.title,
      prompt: p.prompt,
      functionName: p.functionName,
      starterCode: p.starterCode,
      cases: p.cases.map((c) => ({ id: c.id as GeneratedCase["id"], args: c.args, expected: c.expected })),
    },
    source: "fallback",
    verified: true,
    fallbackReason: reason,
  };
}
