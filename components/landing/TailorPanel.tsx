"use client";

import { useEffect, useRef, useState } from "react";
import type { BehavioralContext } from "@/lib/contract";
import { TAILORING_LIMITS } from "@/lib/behavioral";
import { btn } from "../ui/buttons";
import type { JobInfo, ResumeImage } from "./profile";
import { analyzeTailoring, draftToContext, prepareRequest, type Draft } from "./tailor";

interface Props {
  resume: ResumeImage[];
  job: JobInfo;
  onContextChange: (ctx: BehavioralContext | undefined) => void;
  onStartGeneric: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "error"; message: string; tooLarge?: boolean }
  | { kind: "ready"; empty: boolean };

const field = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-600";

// Optional personalization for the behavioral round. Analysis runs ONLY on
// "Prepare my interview"; the preview is editable and its edits are what the
// interviewer receives. Excerpts are shown for checking and never sent on.
export function TailorPanel({ resume, job, onContextChange, onStartGeneric }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const reqId = useRef(0);
  const abort = useRef<AbortController | null>(null);

  // Inputs fingerprint: a change while a request is in flight makes it stale.
  const inputs = JSON.stringify([resume.map((r) => r.id), job.listing.trim(), job.role.trim(), job.company.trim(), job.level]);
  const inputsAtRequest = useRef<string | null>(null);
  useEffect(() => {
    if (status.kind === "preparing" && inputsAtRequest.current !== inputs) {
      abort.current?.abort();
      reqId.current += 1; // ignore whatever comes back
      setStatus({ kind: "idle" });
    }
  }, [inputs, status.kind]);
  // Unmounting (Start or Skip) also cancels and ignores the request.
  useEffect(
    () => () => {
      reqId.current += 1;
      abort.current?.abort();
    },
    [],
  );

  const update = (d: Draft | null) => {
    setDraft(d);
    onContextChange(d ? draftToContext(d) : undefined);
  };

  async function prepare() {
    if (status.kind === "preparing") return; // duplicate clicks
    if (resume.length > TAILORING_LIMITS.maxImages) {
      setStatus({
        kind: "error",
        tooLarge: true,
        message: `Tailoring reads at most ${TAILORING_LIMITS.maxImages} resume pages. Remove ${resume.length - TAILORING_LIMITS.maxImages} above, enter the details manually, or start a generic round.`,
      });
      return;
    }
    const id = ++reqId.current;
    inputsAtRequest.current = inputs;
    setStatus({ kind: "preparing" });
    const listing = job.listing.trim();
    const role = { company: job.company.trim() || undefined, role: job.role.trim() || undefined, level: job.level || undefined };
    const prepared = await prepareRequest(resume, {
      ...(listing ? { jobListing: listing } : {}),
      ...(role.company || role.role || role.level ? { roleContext: role } : {}),
    });
    if (id !== reqId.current) return;
    if (!prepared.ok) {
      setStatus(
        prepared.reason === "too-large"
          ? { kind: "error", tooLarge: true, message: `These ${resume.length} pages can't fit legibly in one request. Remove a page, enter the details manually, or start a generic round.` }
          : { kind: "error", message: "A selected file couldn't be read as an image. Remove it, enter the details manually, or start a generic round." },
      );
      return;
    }
    const ctl = new AbortController();
    abort.current = ctl;
    const res = await analyzeTailoring(prepared.body, ctl.signal);
    if (id !== reqId.current) return; // stale: inputs changed, Skip, or a newer request
    if (!res.ok) {
      const msg =
        res.error.code === "timeout"
          ? "Tailoring took too long. Try again, enter the details manually, or start a generic round."
          : res.error.retryable
            ? "Tailoring is unavailable right now. Try again, enter the details manually, or start a generic round."
            : res.error.code === "invalid_request"
              ? `Couldn't prepare this: ${res.error.message}. Enter the details manually or start a generic round.`
              : "Tailoring isn't available here. Enter the details manually or start a generic round.";
      setStatus({ kind: "error", message: msg });
      return;
    }
    const s = res.suggestion;
    update({
      ...(s.project ? { project: { name: s.project.name, summary: s.project.summary ?? "", excerpt: s.project.excerpt } } : {}),
      ...(s.focus ? { focus: { skill: s.focus.skill, detail: s.focus.detail ?? "", excerpt: s.focus.excerpt } } : {}),
    });
    setStatus({ kind: "ready", empty: !s.project && !s.focus });
  }

  const manual = () => {
    update({ project: { name: "", summary: "" }, focus: { skill: "", detail: "" } });
    setStatus({ kind: "ready", empty: false });
  };

  const hasInput = resume.length > 0 || job.listing.trim().length > 0;

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6" data-testid="tailor-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="tailor-toggle"
        className={`${btn.neutral} px-4 py-2 text-base`}
      >
        {open ? "Hide tailoring" : "Tailor this interview"}
      </button>
      <span className="ml-3 text-sm text-zinc-500">Optional, for the behavioral round.</span>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm leading-relaxed text-zinc-300" data-testid="tailor-disclosure">
            When you select <strong>Prepare my interview</strong>, the resume pages you added above (resized in your browser)
            and the job listing are sent to Google Gemini to suggest one project and one practice focus. Nothing is sent before
            that. The files and the listing are not used in the interview itself: only the project and focus you confirm below.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={prepare}
              disabled={status.kind === "preparing" || !hasInput}
              data-testid="prepare-tailoring"
              className={`${btn.primary} px-5 py-2.5 text-base`}
            >
              {status.kind === "preparing" ? "Preparing…" : "Prepare my interview"}
            </button>
            <button type="button" onClick={manual} data-testid="manual-tailoring" className={`${btn.neutral} px-5 py-2.5 text-base`}>
              Enter details manually
            </button>
          </div>
          {!hasInput && <p className="text-sm text-zinc-500">Add resume pages or a job listing above to prepare, or enter details manually.</p>}

          {status.kind === "error" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200" role="alert" data-testid="tailor-error">
              {status.message}
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={manual} className={`${btn.neutral} px-3 py-1.5 text-sm`}>
                  Enter details manually
                </button>
                <button type="button" onClick={onStartGeneric} className={`${btn.neutral} px-3 py-1.5 text-sm`}>
                  Start a generic round
                </button>
              </div>
            </div>
          )}
          {status.kind === "ready" && status.empty && !draft?.project && !draft?.focus && (
            <p className="text-sm text-zinc-400" data-testid="tailor-empty">
              Nothing specific enough was found. Enter details manually or start a generic round.
            </p>
          )}

          {draft && (draft.project || draft.focus) && (
            <div className="grid gap-4 lg:grid-cols-2" data-testid="tailor-preview">
              {draft.project && (
                <fieldset className="flex flex-col gap-2 rounded-xl border border-zinc-800 p-4">
                  <legend className="px-1 text-sm font-semibold text-zinc-300">Project to ask about</legend>
                  <input
                    className={field}
                    value={draft.project.name}
                    onChange={(e) => update({ ...draft, project: { ...draft.project!, name: e.target.value } })}
                    placeholder="Project name"
                    name="tailor-project-name"
                    aria-label="Project name"
                  />
                  <textarea
                    className={`${field} min-h-16`}
                    value={draft.project.summary}
                    onChange={(e) => update({ ...draft, project: { ...draft.project!, summary: e.target.value } })}
                    placeholder="One line about it (optional)"
                    name="tailor-project-summary"
                    aria-label="Project summary"
                  />
                  {draft.project.excerpt && (
                    <blockquote className="border-l-2 border-zinc-600 pl-3 text-sm italic text-zinc-400" data-testid="project-excerpt">
                      From your resume (verbatim, not sent to the interviewer): “{draft.project.excerpt}”
                    </blockquote>
                  )}
                  <button type="button" onClick={() => update({ ...draft, project: undefined })} className={`${btn.neutral} self-start px-3 py-1 text-sm`} data-testid="remove-project">
                    Remove project
                  </button>
                </fieldset>
              )}
              {draft.focus && (
                <fieldset className="flex flex-col gap-2 rounded-xl border border-zinc-800 p-4">
                  <legend className="px-1 text-sm font-semibold text-zinc-300">Practice focus</legend>
                  <input
                    className={field}
                    value={draft.focus.skill}
                    onChange={(e) => update({ ...draft, focus: { ...draft.focus!, skill: e.target.value } })}
                    placeholder="Skill, e.g. debugging under pressure"
                    name="tailor-focus-skill"
                    aria-label="Practice focus"
                  />
                  <textarea
                    className={`${field} min-h-16`}
                    value={draft.focus.detail}
                    onChange={(e) => update({ ...draft, focus: { ...draft.focus!, detail: e.target.value } })}
                    placeholder="Why it matters (optional)"
                    name="tailor-focus-detail"
                    aria-label="Focus detail"
                  />
                  {draft.focus.excerpt && (
                    <blockquote className="border-l-2 border-zinc-600 pl-3 text-sm italic text-zinc-400" data-testid="focus-excerpt">
                      From the listing (verbatim, not sent to the interviewer): “{draft.focus.excerpt}”
                    </blockquote>
                  )}
                  <button type="button" onClick={() => update({ ...draft, focus: undefined })} className={`${btn.neutral} self-start px-3 py-1 text-sm`} data-testid="remove-focus">
                    Remove focus
                  </button>
                </fieldset>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
