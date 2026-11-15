// Browser side of "Build my interview plan": POST /api/interview-plan
// (lib/contract.ts InterviewPlanRequest). Any failure, including a missing
// route (404), zero-key 503, timeout, or a malformed plan, returns a usable
// role-based fallback built from the same inputs. Never throws.
import type { ApplicationTarget, InterviewPlan } from "@/lib/contract";
import { buildFallbackPlan, normalizeInterviewPlan, PLAN_LIMITS, PLAN_TIMEOUT_MS } from "@/lib/plan";

export type PlanOutcome = { plan: InterviewPlan; fellBack: boolean; notice?: string };

const NOTICE: Record<NonNullable<InterviewPlan["fallbackReason"]>, string> = {
  research_unavailable: "Company research isn't available right now, so this plan is based on the role and what you entered.",
  not_configured: "Company research isn't set up here, so this plan is based on the role and what you entered.",
  timeout: "Company research took too long, so this plan is based on the role and what you entered.",
  no_public_sources: "No public interview information was found for this company, so this plan is based on the role and what you entered.",
  manual: "This plan is based on the role you entered.",
};
export const fallbackNotice = (plan: InterviewPlan) => (plan.fallbackReason ? NOTICE[plan.fallbackReason] : undefined);

export async function requestPlan(application: ApplicationTarget, signal?: AbortSignal): Promise<PlanOutcome> {
  const fallback = (reason: NonNullable<InterviewPlan["fallbackReason"]>): PlanOutcome => {
    const plan = buildFallbackPlan(application, { reason });
    return { plan, fellBack: true, notice: NOTICE[reason] };
  };
  const body = JSON.stringify({ application });
  if (new TextEncoder().encode(body).length > PLAN_LIMITS.bodyBytes) return fallback("research_unavailable");

  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  signal?.addEventListener("abort", onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, PLAN_TIMEOUT_MS);
  try {
    const res = await fetch("/api/interview-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: ctl.signal });
    const json = (await res.json().catch(() => null)) as { plan?: unknown; code?: string; retryable?: boolean } | null;
    if (res.ok && json?.plan) {
      const n = normalizeInterviewPlan(json.plan);
      if (!n.ok) return fallback("research_unavailable");
      return { plan: n.value, fellBack: n.value.source === "role-fallback", notice: fallbackNotice(n.value) };
    }
    if (json?.code === "timeout") return fallback("timeout");
    if (res.status === 404 || (json?.code === "provider_unavailable" && json.retryable === false)) return fallback("not_configured");
    return fallback("research_unavailable");
  } catch {
    return fallback(timedOut ? "timeout" : "research_unavailable");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
