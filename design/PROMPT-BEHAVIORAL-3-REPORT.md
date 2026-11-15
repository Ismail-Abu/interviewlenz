# Build prompt 3 of 3 — Behavioral report

Paste everything below the line into a fresh chat with repo access.

---

You are redesigning the **end-of-round report** of Interviewlenz, with the
behavioral round as the priority.
Repo: `https://github.com/Ismail-Abu/interviewlenz`, branch `main`.
Stack: Next.js 16.4.6 (App Router), TypeScript, Tailwind 4, Node 22.

Read `AGENTS.md` and `CURRENT.md` first. Branch: `f-behavioral-report`.

This is **3 of 3** parallel tasks. The others own `components/BehavioralRoom.tsx`
(task 1) and `components/VoicePanel.tsx` (task 2). **Do not edit those two
files** — you will collide.

## Your scope

- `components/ReportView.tsx` — the whole file is yours
- `components/report/*` — new presentational components you create
- `app/globals.css` — tokens only, and only if they are not already there

Do not touch `app/api/**`, `lib/**`, `dev/**`, `scripts/**`, `.github/**`,
`components/BehavioralRoom.tsx`, or `components/VoicePanel.tsx`.

**Do not change the report contract or the API route.** `Report`, `Finding` and
`EvidenceRef` in `lib/contract.ts` are shared and owned by the backend; render
what you are given. If you believe a field is missing, say so in the PR rather
than adding it.

## Design tokens

Add to `app/globals.css` **only if not already present**:

```css
@theme inline {
  --color-cream:        #FBF6EC;
  --color-cream-2:      #F6EEE0;
  --color-cream-3:      #F3E8D6;
  --color-ink:          #3A302C;
  --color-ink-muted:    #75665C;
  --color-maroon:       #9B3B50;
  --color-maroon-hover: #B04A60;
  --color-maroon-deep:  #8C2F43;
  --color-maroon-soft:  #C77D8C;
  --color-panel:        #1C1817;
  --color-panel-2:      #2A2422;
}
```

Cards `rounded-[26px]`, chips fully rounded, elevation
`0 10px 18px -6px rgb(90 68 50 / 0.13)` instead of borders. Do not use
`--color-brand-coral` (`#fe6b73`) on cream — ~2.1:1, fails contrast. The current
evidence panel uses `border-brand-coral/40`; replace it.

Make the report **cream**, matching the landing and behavioral pages. The one
exception is the code evidence block, which stays a dark `rounded` code surface
even on cream — code reads better dark, and that keeps it consistent with the
editor.

## What the report is

Read `components/ReportView.tsx` first. It renders one card per attempt, and it
serves **both round types**:

- `isBehavioralSession(session)` is true → the attempt has **no code, no
  snapshots and no runs**. Its evidence is the student's transcript turns only.
  The categories are `specificity`, `personal_contribution`, `reasoning`,
  `outcome` (see `lib/behavioral.ts`).
- Otherwise it is a coding attempt, with code and run evidence, plus the
  unrun-draft disclosure.

Each card currently shows: a loading skeleton, a fixture badge when running
without a key, attempt stats, an error state with a retry, the `nextStep` line,
the list of findings with their `rating`, and a clickable evidence panel that
reveals the cited transcript quote, code lines, or run.

Keep every one of those paths working. This is a visual redesign.

## Redesign brief

- **Lead with the verdict.** The `nextStep` is the single most useful line in
  the report; give it the top of the card at ~20px in ink, not a footnote.
- **Findings as cards, not a list.** One `rounded-[26px]` cream-2 card per
  finding: the category as a small letter-spaced maroon caps label, the rating
  as a pill, the summary as readable body text, and the evidence chips beneath.
- **Rating pills** need cream-safe colours. Suggested: `strong` `#2E7D4F`,
  `ok` `#B07A1E`, `needs_work` `--color-maroon`, `insufficient_evidence`
  `--color-ink-muted` — each as tinted background with the darker colour as
  text. All clear 4.5:1 on cream; verify if you change them.
- **Evidence should feel like receipts.** A transcript quote should look like a
  pulled quote — a maroon left rule, the student's words, the turn label. Make
  the link between a finding and its evidence obvious when selected.
- **Behavioral empty states matter.** A behavioral attempt legitimately has no
  code or runs, and `insufficient_evidence` is a real rating when the student
  barely spoke. Neither is an error — do not style them like one. The existing
  copy "This behavioral attempt has no code or runs." should read as a calm
  note.
- **Distinguish the two round types** at a glance: a behavioral card should be
  recognisably a behavioral card, not a coding card with empty sections.

Reference for the visual language: `design/concept-c-demo.png` and
`design/COVER-PAGE-BRIEF.md`, both already in the repo.

## Behaviour that must not change

Keep the attempt-record props and the retry handler (`onRetryReport`) exactly as
they are; `ProblemRoom.tsx` is not yours.

Keep the coding-side disclosure intact: when the last snapshot's `codeVersion`
differs from the last run's, the card shows the **unrun draft** with the last
run's version and score. A backend dev check and the report prompt both depend
on that behaviour being surfaced — do not drop it while restyling.

**These `data-testid` attributes are asserted by existing browser drivers — keep
every one, on an element that still does the same thing:**

`report-fixture-badge` · `attempt-stats` · `report-error` · `next-step` ·
`evidence-panel` · `evidence-quote` · `evidence-code` · `evidence-run`

Keep `role="alert"` on the error state.

## Responsive and accessibility

Works at 390px: cards stack, evidence panels stay readable, long code lines
scroll inside their block rather than widening the page. Body text ≥ 4.5:1.
Evidence chips are real buttons, keyboard-reachable, with a visible focus ring
using `--color-maroon-soft`.

## Verify

```bash
npm ci && npm run lint && npm run test:ci && npm run build
```

`npm run test:ci` runs 14 deterministic checks, including `report-check` and
`unrun-draft-check`. Those exercise the API route, not React, so they must stay
green — if one breaks you edited something outside your scope.

Then `npm run dev` and view a report for **both** a behavioral attempt and a
coding attempt. Without an API key the report comes from fixtures and is clearly
badged; that is the expected zero-key path and is enough to check the layout.

Open a PR against `main`. Note which round types you viewed and confirm the
unrun-draft disclosure still appears on the coding side.
