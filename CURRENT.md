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

## F2 handoff • Hamza • November 14 • Run wired to real runner; voice blocked on B2

- **Run → real runner** — Ismail's unmerged B1 branch `claude/sweet-franklin-fovxva` is merged into `f2`; none of his files were edited. Run now calls `runCode` from lib/runner.ts by default. ProblemRoom calls `preloadRunner()` on mount, and the page uses `containsDuplicate` from lib/problems.ts, so components/placeholderProblem.ts is deleted. In `npm run dev` a "Run with" selector still offers the four fixtures as a fallback. Those results are labeled FIXTURE DATA, and real results are not. Timeouts and runner failures get their own headings.
- **Voice panel** — An Interviewer panel has Start interview, mic mute/unmute, End, a state indicator (connecting, listening, interviewer speaking, idle, error), and a scrolling transcript. Turns from `onTurn` are kept in session memory. ApiErrors are shown inline.
- **Files** — components/liveAdapter.ts (new), components/VoicePanel.tsx (new), components/ProblemRoom.tsx, components/runCodeAdapter.ts, components/ResultsPanel.tsx, app/page.tsx, components/placeholderProblem.ts (deleted).
- **Still mocked** — Voice only. `components/liveAdapter.ts` returns a fake token and a scripted MockLiveClient with no audio, and the panel is labeled MOCK VOICE. lib/live.ts and app/api/live-token (B2) have not started.
- **Check** — Edge was driven with Playwright against `npm run dev` with real Pyodide.
  - Correct set solution: 4/4 (first run 680 ms, including Pyodide load).
  - Adjacent-only solution: 3/4, with c1 failing (expected True, got False).
  - Missing colon: "Syntax error on line 1: expected ':'".
  - A solution that prints and raises: c3 shows `IndexError: list index out of range`, and every case shows its stdout.
  - `while True`: "Execution exceeded the 5 second limit" after 5011 ms, and the next run passed 4/4.
  - Voice mock: the states followed t1 and t2, mute stopped turns, and a reconnect kept the transcript with IDs continuing at t3.
  - The console logged no errors. `npm run build` passes. Lint shows only two unused-variable warnings, both in Ismail's dev/runner-check.mjs.
  - **The F2 completion check (a real spoken exchange) has not run.** It needs B2.
- **To finish after B2** — In liveAdapter, POST `{sessionId}` to `/api/live-token` and return the JSON (a 503 returns an ApiError). Return the real client from lib/live.ts and set `USING_MOCK_LIVE` to false. Test on localhost or HTTPS, where microphone access is allowed.
- **Merge order** — Merge B1 (Ismail's branch), then #1 (f1), then #2 (f2). PR #2 contains the B1 commit until B1 lands on main.
- **Contract question for Ismail** — CONTRACT.md does not say how lib/live.ts exports the client. Is it a factory such as `createLiveClient()` or a singleton? The adapter assumes a factory. It also assumes turn IDs stay unique across a reconnect within one session.

## F3 handoff • Hamza • November 14 • passed against mocks (real voice waits on B2)

- **Decision from Ismail** — lib/live.ts will export a factory, `createLiveClient(): LiveClient`. Turn IDs stay unique across reconnects within a session. liveAdapter.ts assumes both.
- **Session memory** — ProblemRoom keeps one attempt's `turns`, `snapshots`, and `runs` in state. `sessionId`, `attemptId`, and `priorAttemptId` live in a ref, and a contract `Session` is assembled from both on Finish. The IDs are minted on first use in an event handler, because Next 16 Cache Components rejects `crypto.randomUUID()` during prerender. The header shows "N snapshots · N runs · N turns".
- **Each Run** — Push a CodeSnapshot `{codeVersion, source, at}`, await `runCode` through runCodeAdapter, push the RunResult, then call `live.sendRunContext(snapshot, result)` if a live session is open.
- **Mock interviewer** — MockLiveClient.sendRunContext emits a scripted interviewer turn built from the result: failing case IDs with input, actual, and expected; "All N/N pass" with a complexity question; or the syntax or runner error. The panel stays labeled MOCK VOICE.
- **Finish** — A header button ends the live session and opens the report view.
- **Files** — components/ProblemRoom.tsx, components/liveAdapter.ts.

## F4 handoff • Hamza • November 14 • passed against fixtures (real report waits on B4)

- **Report** — On Finish, `requestReport(session)` in components/reportAdapter.ts returns fixtures/report.json labeled FIXTURE DATA, with the real sessionId and attemptId echoed. The fixture's evidence (t1, code v3, run v4 c1) is remapped to this attempt's first student turn, latest fully passing run, and first failing run and case, so the links resolve. Version numbers in the summaries are rewritten to match. A finding with no counterpart in the attempt becomes `insufficient_evidence` with no refs, the only rating the contract allows to be empty. A dev "Report" selector offers Fixture, "Fixture: 503 once, then OK", and `/api/report`, which POSTs `{session}` and maps non-200 responses to ApiError.
- **Report view** — Next step is shown prominently at the top. Each finding shows its category, a rating badge (strong green, ok blue, needs_work red, insufficient_evidence grey), its summary, and clickable evidence chips. A turn chip scrolls to and highlights that transcript turn. A code chip shows that snapshot's source with the cited lines highlighted. A run chip shows that run's cases with the cited case highlighted.
- **Retry problem** — The prior record and its report are kept. A new attemptId is created with priorAttemptId set and the same sessionId. Turns, snapshots, and runs are reset, the starter code is restored, and codeVersion returns to 1. After the next Finish both reports appear side by side, and "retry of …" names the prior attempt.
- **Report error** — A 503 shows "Report unavailable", the message, "Your session is saved", and a Retry report button that re-requests the same attempt.
- **Files** — components/reportAdapter.ts (new), components/ReportView.tsx (new), components/ProblemRoom.tsx.

### F3 + F4 check (`npm run dev`, Edge driven with Playwright, real Pyodide runner)

1. Start interview → mock student turn t1.
2. Buggy adjacent-only solution → 3/4. Interviewer t2: "Version 2 passes 3/4. c1 failed — for nums = [1, 2, 3, 1] you returned False but expected True…"
3. Correct set solution → 4/4. Interviewer t3: "All 4/4 cases pass on version 3. What's the time and space complexity…" The header showed **2 snapshots · 2 runs · 3 turns**.
4. Finish → Attempt 1 report labeled FIXTURE DATA, with the next step and three findings.
   - The Transcript t1 chip highlighted t1 and scrolled it into view.
   - The Code v3 · lines 1–2 chip showed the correct solution with 2 lines highlighted.
   - The Run v2 · c1 chip showed 3/4 with c1 highlighted (expected True, got False).
5. Retry problem → 0 snapshots · 0 runs · 0 turns, starter code restored, "Attempt 2" shown.
6. Set Report to "503 once", ran the correct solution, Finish → "Report unavailable / Report provider unavailable / Your session is saved". Retry report → the Attempt 2 report loaded ("retry of" attempt 1).
7. The two cards sat side by side at the same top offset. Attempt 2 had no spoken turn or failing run, so those findings showed Insufficient evidence, and Approach cited Code v2.
8. The browser console logged no errors. `npm run lint` shows 0 errors (two warnings, both in Ismail's dev/runner-check.mjs), and `npm run build` passes.

**Still mocked** — Voice: the token and LiveClient are scripted in components/liveAdapter.ts, labeled MOCK VOICE, until B2. Report: fixtures/report.json is remapped per attempt and labeled FIXTURE DATA, until B4; then set `DEFAULT_REPORT_MODE = "api"`. Run is real (B1 Pyodide). Not done: the real spoken F3 check (hearing the question change with the code), which needs B2 and B3.

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

### B2 • Gemini Live token route + browser Live client — Ismail (implemented; live check pending)

Files added:
- `app/api/live-token/route.ts` — `POST /api/live-token` (Node runtime). Validates `{sessionId}`, mints an ephemeral token with `@google/genai` `ai.authTokens.create` locked to `LIVE_MODEL` + an AUDIO Live session, returns 200 `{token, model, expiresAt}`. Returns 503 `provider_unavailable` on missing env/SDK failure, 400 `invalid_request` on a bad body. The permanent `GEMINI_API_KEY` never leaves the server.
- `lib/live.ts` — client-only `BrowserLiveClient implements LiveClient`, plus `createLiveClient()`. `connect` opens `ai.live.connect` with the ephemeral token (AUDIO + input/output transcription + session resumption); `startMic`/`stopMic` capture mic audio as 16 kHz PCM via a `ScriptProcessorNode` and stream it with `sendRealtimeInput`; incoming audio (`message.data`, 24 kHz PCM) is decoded and played back gaplessly; transcripts come from `serverContent.{input,output}Transcription` and are emitted as `TranscriptTurn`s; state is mapped to connecting/listening/speaking/idle/error; `end()` tears everything down. `sendRunContext` sends the run as text (minimal inline format; B3 finalizes the wording in `lib/prompts.ts`).

Check performed and outcome:
- `tsc --noEmit --strict --skipLibCheck` against `@google/genai@3.3.0`: **clean** for both files (route with Node globals; client with DOM globals). Confirms the SDK calls and the `LiveClient` contract shape compile.
- Route branch logic (bundled real route, SDK stubbed): happy path → 200 with `{token, model, expiresAt}` echoed; bad JSON / missing `sessionId` → 400 `invalid_request`; missing env / create throws / no `token.name` → 503 `provider_unavailable`. **All pass.**
- NOT verified here: the B2 completion check ("a real spoken exchange works in the browser"). It needs the merged Next scaffold, a real `GEMINI_API_KEY` + `LIVE_MODEL`, HTTPS, and a microphone — none available in this environment. Real token issuance and the Live socket are therefore unverified.

Outstanding dependencies / risks:
- **v1alpha vs v1beta is unresolved.** SDK 3.3.0's own docstring says ephemeral tokens are "v1alpha only"; the current docs and README say v1beta. Server defaults to `v1beta` with a `LIVE_API_VERSION` env override; the browser client uses a `v1beta` constant. This is the top integration risk — verify against a live key and flip both if needed (they must match).
- Needs dep `@google/genai` (tested against 3.3.0); not in the repo yet (no `package.json`). Add when the scaffold lands.
- `.env`: `GEMINI_API_KEY` (server-only), `LIVE_MODEL` (a Gemini Live model id). Confirm the exact live model id with the current docs before the demo.
- `lib/live.ts` is client-only (never import on the server) and uses a `ScriptProcessorNode` (self-contained, no served AudioWorklet asset); fine for a sub-10-minute demo, swap to an AudioWorklet later.
- `lib/prompts.ts` not created (that is B3); the interviewer instruction and run-context wording in `lib/live.ts` are placeholders for B3 to finalize.
