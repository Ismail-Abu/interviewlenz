# 24-hour hackathon handoff

**Owners** — Hamza (frontend, F tasks) and Ismail (backend, B tasks).
**Start** — Saturday, November 14, about 3:15 PM ET. No runnable app exists at kickoff.
**Submission deadline** — Sunday, November 15, exact time awaiting organizer confirmation. Code freeze is two hours before the confirmed deadline.
**Merge checkpoints (ET)** — Saturday 6 PM and 9 PM, Sunday 1 AM and 4 AM, then code freeze. If the confirmed freeze comes earlier, bring final preparation forward.

## Scope decision • November 14

Ismail requested a 24-hour build focused on one duplicate-detection interview. This handoff supersedes Stage 0 and the separate review gate in AGENTS.md. Each owner records the check and advances immediately to their next listed task when it passes. Merge and sync at each checkpoint. Use the 6 PM merge to wire the real runner and integrate voice on the shared app.

| Checkpoint | Hamza • frontend | Ismail • backend | Completion check |
|---|---|---|---|
| Sat 6 PM | **F1** Set up Next.js, TypeScript, and Tailwind. Build one Python problem page with prompt, Monaco, Run, and per-case expected, actual, and pass status. Label fixture results and match the B1 contract. | **B1** Use the agreed types in lib/contract.ts and examples in docs/CONTRACT.md. Implement the browser Pyodide runner in lib/runner.ts with four specified duplicate-detection cases. | F1 passes when a clean checkout runs locally and displays labeled fixture results. B1 passes when a correct solution passes every case, a buggy one fails a case, and invalid Python syntax returns the documented error. |
| Sat 9 PM | **F2** Wire Run to the merged runner. Build mic/speaker buttons, display listening/speaking state, and store transcript turns emitted by the Live client. | **B2** Issue a Gemini Live ephemeral token from a server route. Own lib/live.ts: connect, microphone audio input, audio playback, transcript events, and state events. Keep the permanent key server-side. | A real spoken exchange works in the browser and the displayed state follows the exchange. |
| Sun 1 AM | **F3** On every Run, capture the submitted source and version, then send those with its results as text into the active Live session. Keep snapshots and runs in session memory. | **B3** Define the Run message and Live interviewer instructions. Have Live ask its own question about the implementation and test outcome. | Run two different implementations and hear the spoken question change with the code. |
| Sun 4 AM | **F4** Show findings, cited transcript/code evidence, and a Retry button that starts another attempt. | **B4** On Finish, make one Gemini Flash call with transcript, snapshots, and runs. Return findings with references to that evidence. | From the report, locate what the student said and what they wrote. Retry works. |
| Code freeze | Deploy to Vercel, verify HTTPS mic access, and record a backup demo video. | Write the Devpost entry and verify the repo, deployment, and video links. | Both rehearse the pitch against the deployed demo. Submission materials are ready by freeze. |

## Repo setup and shared contract decision

Hamza pushes the bare Next.js scaffold first, within 20 minutes, before either owner adds other files. This applies to the implementation kickoff after the shared setup and contract land. The shared types, endpoint and client contracts, and importable fixtures are committed. Hamza uses fixtures/ for F1, and Ismail implements B1 against the same examples. Coordinate any changes to it with both owners.

## File ownership

- Hamza owns pages under `app/**` and `components/**`, except `app/api/**`.
- Ismail owns `lib/runner.ts`, `lib/runner.worker.ts`, `lib/problems.ts`, `lib/live.ts`, `lib/prompts.ts`, and `app/api/**`.
- Shared, change only after both agree: `lib/contract.ts` and `docs/CONTRACT.md`.

## F1 handoff • Hamza • November 14 • passed

- **Scaffold** — Next.js 16.4.6 (App Router), TypeScript, and Tailwind 4 pushed to main as `d1e122c`. `next dev` also appended its agent-rules block to AGENTS.md.
- **Problem page** (branch `f1`) — `/` shows the Contains Duplicate prompt (Markdown), examples, and constraints on the left. Monaco loads client-only through `next/dynamic` with `ssr: false` and holds the starter code on the right. Each edit increments codeVersion. Run shows a loading state and then a results panel with each case's input, expected, actual, pass/fail, and any error or stdout, plus passed/total. On a run-level error the panel shows the message and line, Monaco marks that line, and the source is left unchanged.
- **Files** — app/page.tsx, app/layout.tsx, app/globals.css, app/favicon.ico, components/ProblemRoom.tsx, components/ProblemPanel.tsx, components/CodeEditor.tsx, components/ResultsPanel.tsx, components/runCodeAdapter.ts, components/placeholderProblem.ts, package.json, package-lock.json, next.config.ts, tsconfig.json, eslint.config.mjs, .gitignore (merged with Next's ignores; `.env.example` stays tracked), AGENTS.md (Next block).
- **Still mocked** — Run results come from fixtures/ and are labeled FIXTURE DATA. A dev selector in the header cycles pass, fail, syntax error, and unavailable, or pins one. The adapter echoes the request's sessionId, codeVersion, and current time over each fixture. The problem is a local copy of the CONTRACT.md example in components/placeholderProblem.ts. `preloadRunner()` is not called yet. Monaco loads from the jsDelivr CDN, so the page needs internet access.
- **Check** — Fresh clone of `f1`, then `npm install && npm run dev`. Edge was driven with Playwright against the page. Problem, editor, and starter code render. Five keystrokes moved the version from v1 to v6. Four Runs showed the loading state and then displayed 4/4 passed; 3/4 with c1 FAIL (expected True, got False); "Syntax error on line 2" with a line-2 marker; and "Python worker could not initialize" with a retry note. The editor text was unchanged and the browser console logged no errors. `npm run lint` and `npm run build` pass.
- **Dependencies for F2** — Ismail's `lib/runner.ts` (`runCode`, `preloadRunner`) and `lib/problems.ts`. Wiring means replacing the body of `runCodeAdapter` with `return runCode(req)`, setting `USING_FIXTURES` to false, and importing the problem from lib/problems.ts. The F2 voice work needs `lib/live.ts` and `app/api/live-token/route.ts`.

## F2 handoff • Hamza • November 14 • frontend done, blocked on B1/B2

- **Built** (branch `f2`, stacked on `f1`) — An Interviewer panel under the problem has Start interview, a mic mute/unmute toggle, End, and a live state indicator: connecting, listening, interviewer speaking, idle, or error. It also shows a scrolling transcript. Turns from `onTurn` are stored in session memory in ProblemRoom alongside sessionId. Token and client errors (ApiError) are shown inline.
- **Files** — components/liveAdapter.ts (new), components/VoicePanel.tsx (new), components/ProblemRoom.tsx.
- **Still mocked** — All voice goes through `components/liveAdapter.ts`. `fetchLiveToken` returns a fake token, and `createLiveClient` returns a scripted MockLiveClient that implements the contract's LiveClient with no real audio. The panel is labeled MOCK VOICE. Run still uses the F1 fixtures, because lib/runner.ts has not merged.
- **Check** — Edge was driven with Playwright against `npm run dev`. Start moved the state to Listening. The mock student turn t1 switched the state to "Interviewer speaking", and interviewer turn t2 switched it back to Listening. Mute moved it to Idle, and no turns arrived in the next 3 s. After End and Start again, the transcript was kept and turn IDs continued at t3. Run still returned 4/4 with voice active, and the console logged no errors. `npm run lint` and `npm run build` pass. **The F2 completion check (a real spoken exchange) has not run.** It needs B1 and B2.
- **To finish once Ismail merges** —
  1. In runCodeAdapter, call `return runCode(req)` and set `USING_FIXTURES` to false. Call `preloadRunner()` on mount.
  2. In liveAdapter, POST `{sessionId}` to `/api/live-token` and return the JSON (a 503 returns an ApiError). Return the real client from lib/live.ts and set `USING_MOCK_LIVE` to false.
  3. Test over HTTPS or localhost, where microphone access is allowed.
- **Contract question for Ismail** — CONTRACT.md does not say how lib/live.ts exports the client. Is it a factory such as `createLiveClient()` or a singleton? The adapter assumes a factory. It also assumes turn IDs stay unique across a reconnect within one session.

## Mocked for demo

Label any shown preview as mocked. These features need no working integrations during the sprint.

- Accounts and history
- Multi-round gating
- Job and resume tailoring
- Java execution
- Camera and delivery feedback

## Handoff log

### B1 • Browser Pyodide runner — Ismail (complete, check passed)

Files added:
- `lib/problems.ts` — the contains-duplicate `Problem`, cases c1-c4, matching `docs/CONTRACT.md`. Exports `containsDuplicate`, `problems`, `getProblem`.
- `lib/runnerHarness.ts` — the Python harness as a string, shared by the worker and the dev check (single source of truth, no duplicated logic).
- `lib/runner.worker.ts` — classic Web Worker. Loads Pyodide v0.29.5 from jsDelivr (`cdn.jsdelivr.net/pyodide/v0.29.5/full/pyodide.js`), defines the student code once, runs each case, captures stdout per case via redirected `sys.stdout`, formats display strings with Python `repr` (True/False, lists), fails only the raising case with its error text, and returns `syntax_error` + line on a parse error.
- `lib/runner.ts` — client-side only (never import on the server). `preloadRunner()` (idempotent), `runCode()` never throws, echoes sessionId/problemId/codeVersion, 5s timeout terminates and recreates the worker and returns `timeout` (retryable), load failure returns `runner_unavailable` (retryable), unknown id returns `unknown_problem`.
- `dev/runner-check.mjs` — dev-only completion check (not shipped).

Check performed and outcome — ran `dev/runner-check.mjs` (esbuild-bundles the real `lib/runner.ts`; a Pyodide-backed fake Worker uses the same protocol and the same harness as the browser worker). **ALL CHECKS PASSED:**
- (a) correct set-based solution → `completed`, 4/4, deep-equals `fixtures/run-pass.json` (minus runtime ranAt/durationMs).
- (b) buggy adjacent-only solution → `completed`, 3/4, c1 fails (actual `False`), deep-equals `fixtures/run-fail.json`.
- (c) invalid syntax → `status: error`, `syntax_error`, line 2, `retryable: false`; shape matches `fixtures/run-syntax-error.json`.
- also verified: unknown_problem; runner_unavailable (shape matches `fixtures/run-unavailable.json`); 5s timeout + recovery; per-case exception + per-case stdout capture.
- Static types: `tsc --noEmit --strict` clean (dom pass for runner/problems/harness/contract; webworker pass for the worker).

Outstanding dependencies:
- No Next.js scaffold exists in the repo yet (origin/main and this branch). The handoff says Hamza pushes the bare scaffold first; it is not present. B1 does not depend on it. `lib/runner.ts` uses the standard Next worker pattern `new Worker(new URL("./runner.worker.ts", import.meta.url))` and drops into the scaffold unchanged.
- To run the dev check: Node 22+ plus dev deps not yet in the repo (no `package.json` yet). After the scaffold lands: `npm i -D pyodide@0.29.5 esbuild`, then `node --experimental-strip-types dev/runner-check.mjs`.
- Next on the schedule is B2 (`lib/live.ts`, `app/api/live-token/route.ts`); not started. Open it explicitly.
