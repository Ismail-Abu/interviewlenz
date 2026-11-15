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

## F5 handoff • Hamza • November 14 • passed with zero keys

- **Base** — The integration merge had not landed on main: main only had two docs commits that cancel out, and B2 is still on Ismail's branch. Branched `f5-polish` from `f3` and merged origin/main. No `lib/**` or `app/api/**` files were edited.
- **No-key fallback, voice** — `openVoice()` in components/liveAdapter.ts POSTs `/api/live-token`. If the route is missing (404), returns an ApiError (Ismail's route returns 503 when `GEMINI_API_KEY` or `LIVE_MODEL` is unset), is unreachable, or the real client fails to connect, it uses the scripted MockLiveClient with the badge **MOCK VOICE (no API key)**. To use the real client once lib/live.ts is merged, set `REAL_CLIENT = createLiveClient` (one line, commented in the file).
- **No-key fallback, report** — components/reportAdapter.ts defaults to `auto`. It POSTs `/api/report` and on any failure returns the fixture labeled **FIXTURE DATA (no API key)**. The Dev menu still offers fixture-only, simulated 503 (Retry report), and api-only.
- **Demo-story mock** — On start: "Hi! Before you code, walk me through how you'd approach Contains Duplicate." A scripted student then claims two loops are linear. After a passing run, `detectApproach()` checks the source: two `for` lines mean a nested loop, which gets "All cases pass. You said this is linear. How many comparisons happen when every element is different?"; `set(` or `in seen` means a set, which gets "Nice. What's the space cost of the set, and when might that matter?" A failing run gets the case ID, input, expected, and actual. Errors get the error message.
- **Fixture report fits the story** — When there's no failing run but a nested loop passed, the testing finding becomes a complexity finding. It cites the "linear" turn, the loop lines, and that run, and the next step matches. Approach cites only a passing set-based snapshot, with text and lines matching that code. Spoken reasoning cites the student turn that mentions a set.
- **Start screen** — It shows Interviewlenz, the pitch "A coding interview that listens to how you explain your code", **Start practice**, and an optional "Test my microphone" (`getUserMedia`, then tracks stopped). If the mic is denied or unsupported, a friendly message appears, the room shows a note, and the mock interviewer still runs. Pyodide preloads while the start screen is up.
- **Polish** — Fixed dark theme (no OS light mode, Geist font instead of the scaffold's Arial). Larger type for projectors: 17px prompt, 16px editor, 15–16px transcript and results. Skeletons for the editor, running tests, and the report. The results panel and voice status row have fixed heights. Pass/fail and ratings use an icon, a word, and color. Dev selectors moved into a "Dev" menu so the header fits at 1366px.
- **README** — "Run locally" (zero keys) and "Deploy to Vercel" sections, with `GEMINI_API_KEY`, `LIVE_MODEL`, and `REPORT_MODEL` to add later. No keys committed; only `.env.example` is tracked.
- **Files** — components/liveAdapter.ts, components/reportAdapter.ts, components/ProblemRoom.tsx, components/VoicePanel.tsx, components/ResultsPanel.tsx, components/ReportView.tsx, components/ProblemPanel.tsx, components/CodeEditor.tsx, components/StartScreen.tsx (new), components/Skeletons.tsx (new), app/globals.css, app/layout.tsx, README.md, CURRENT.md.

### F5 check (fresh clone of `f5-polish`, no `.env.local`, `npm install && npm run dev`, Edge via Playwright)

1. **Start screen** at 1366×768 shows the name, pitch, and Start practice. "Test my microphone" → ✓ Microphone ready.
2. **Problem room** → Start interview → badge "MOCK VOICE (no API key)". Interviewer t1 gives the intro, and the scripted student t2 claims "That's linear".
3. **Nested-loop solution** (real Pyodide) → ✓ 4/4. Interviewer t3: "All cases pass. You said this is linear. How many comparisons happen when every element is different?" The results panel and editor bounding boxes were identical before and after the run (no layout jump).
4. **Set solution** → ✓ 4/4. Interviewer t5: "Nice. What's the space cost of the set, and when might that matter?" The session held 2 snapshots · 2 runs · 6 turns.
5. **Finish** → report badge "FIXTURE DATA (no API key)", with a next step about quadratic vs set.
   - Transcript t4 and t2 chips highlighted those turns, scrolled into view.
   - Code v3 lines 2–4 highlighted `seen = set()` through `if n in seen:`.
   - Code v2 lines 2–4 highlighted both `for` lines and the comparison.
   - Run v2 showed 4/4.
6. **Retry** → 0/0/0 and starter code restored. At 1920×1080: adjacent-only solution → interviewer t8: "c1 fails: for nums = [1, 2, 3, 1] the expected answer is True, but your code returned False…" Finish → two report cards side by side.
7. **Layout** — No horizontal overflow at 1366×768 or 1920×1080.
8. **Mic denied** (simulated `NotAllowedError`) → friendly message on the start screen and a note in the room. The mock interviewer still started.
9. **Browser console** — Only the expected 404s for `POST /api/live-token` and `POST /api/report`, which aren't on this branch. With Ismail's routes merged and no key these become 503s; the browser logs them either way, and the app falls back as designed.
10. **Lint and build** — `npm run lint`: 0 errors; the two warnings are in Ismail's dev/runner-check.mjs. `npm run build`: passes.

**Still mocked** — Voice uses the scripted MockLiveClient, including the student's lines, since there is no mic audio. Report content is fixtures/report.json, remapped per attempt. Run is real. **Outstanding** — Merge B1/B2 (Ismail's branch) and set `REAL_CLIENT` in liveAdapter.ts for real voice with a key. B4 `/api/report` is not started; `auto` mode will pick it up automatically.

### F5 follow-up • real voice wired — Hamza • November 14

- **Synced** — Merged main (PR #6: B3 + B4) into `f5-polish`. The merge was clean, and every handoff is preserved: F1–F5, B1, B2, the integration notes, models/API version, B2 verified, B3, B4, and Ismail's switch list.
- **Voice** — `components/liveAdapter.ts` sets `REAL_CLIENT = createLiveClient` from `@/lib/live`. `openVoice()` still POSTs `/api/live-token` first. On non-200, a connect error, or no socket within 10 s, it uses the scripted interviewer with the badge "MOCK VOICE (no API key)" or "MOCK VOICE (voice connection failed)". With a working key the badge is absent. The real client's events are held until `connect()` settles and dropped if it fails, because lib/live.ts emits its error before throwing. That keeps a stale error off the fallback.
- **Report** — Left at `auto` as decided. It POSTs `/api/report` first (B4) and falls back to the labeled fixture only on failure. Ismail's note suggested `"api"`; `auto` covers that path and also keeps the no-key demo working.
- **Observed** — `npm run dev`, Edge via Playwright, **no `.env.local` on this machine**:
  - A. Real routes return **503** for both live-token and report → "MOCK VOICE (no API key)" and "FIXTURE DATA (no API key)"; the flow completes.
  - B. With `/api/live-token` stubbed to 200 (fake token), the browser opened `wss://generativelanguage.googleapis.com/…v1beta…BidiGenerateContentConstrained`, which proves the real client is used. The fake token failed, the badge read "MOCK VOICE (voice connection failed)", and no error banner appeared.
  - C. With `/api/report` stubbed to 200, the report rendered with **no** FIXTURE DATA label. Evidence links landed correctly: turn t2 highlighted; code v2 lines 2–3 highlighted (`for i…`, `for j…`); run v2 with c1 highlighted; code v3 lines 2–4 highlighted (`seen = set()` … `if n in seen:`). Retry reset to 0/0/0.
  - `npm run lint`: 0 problems. `npm run build`: passes, with `/api/live-token` and `/api/report` as dynamic routes.
- **Not done: the real spoken check.** Saying "this is linear", hearing the two code-specific replies, and getting a real Gemini report were not performed. This machine has no `GEMINI_API_KEY`/`LIVE_MODEL`/`REPORT_MODEL` and no one speaking into a microphone, and the stubs in B and C don't exercise Gemini itself. Ismail's B2–B4 checks verified the Live socket, the question wording, and the report route with his key, but not through this UI. **#5 is not merged yet**, pending that spoken check.

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

### Integration • merged to main — November 14

Merged `origin/f3` (F1, F2, B1, F3, F4) and `origin/claude/sweet-franklin-fovxva` (B2) into `main`. Both merges were clean: f3's B1 files are byte-identical to the B1 branch, and B2 only added `app/api/live-token/route.ts` + `lib/live.ts` (no file-ownership overlap). `CURRENT.md` keeps all six handoff entries (F1-F4, B1, B2) and the shared sections once.

Changes made during integration:
- Added deps: `@google/genai` (dependency), `pyodide@0.29.5` + `esbuild` (devDependencies) — B2 and the B1 dev check need them; they were missing from `package.json`.
- `app/api/live-token/route.ts`: removed `export const runtime = "nodejs"` — Next 16 `cacheComponents` rejects route-segment `runtime` and route handlers are Node by default. No behavior change.
- `dev/runner-check.mjs`: silenced two lint warnings (unused destructured vars).

Verified:
- `npm run lint` — clean (0 problems).
- `npm run build` — passes, including the full TypeScript typecheck of the merged tree (route + `lib/live.ts` against `@google/genai`, all F components).
- `npm run dev` — serves and renders the page (header, problem, controls, editor).
- Correct `contains_duplicate` solution via the real Pyodide runner → **4/4 passed, no fixtures** (4 PASS / 0 FAIL), driven in headless Chromium. Verified against the production build (`next start`): the sandbox's HTTPS proxy intercepts the dev HMR WebSocket, which stalls Turbopack dev hydration headlessly (a harness limitation, not a code issue — direct CDN fetch, build, and types all pass).
- `.env.example` lists `GEMINI_API_KEY`, `LIVE_MODEL`, `REPORT_MODEL`; `.gitignore` ignores `.env*.local` (confirmed `.env.local` is ignored).

Not verified (unchanged from B2): the real voice spoken-exchange path needs a live `GEMINI_API_KEY` + `LIVE_MODEL` and a microphone; the v1alpha/v1beta token API version is still the open risk.

### Models and API version (chosen Nov 14, from the live models list)

Queried `GET /v1beta/models` with the real key. Chosen and written to `.env.local` (gitignored, key never committed):
- `LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025` — native-audio, `bidiGenerateContent`.
- `REPORT_MODEL=gemini-3.8-flash` — newest Flash with `generateContent`.
- **API version: `v1beta`** (both the token route default `LIVE_API_VERSION` and the `lib/live.ts` client constant).

### B2 • verified live — Ismail (branch b3-b4)

- `POST /api/live-token {sessionId:"test"}` on `npm run dev` → **HTTP 200** with a real ephemeral token (`auth_tokens/...`), `model`, and ISO `expiresAt`.
- `dev/live-check.mjs` mints a token and opens a real Live session, sends one text turn, and collects the response. On **v1beta**: session opened and **~35 KB of audio returned** → Live works. (The SDK prints a "v1alpha only" advisory warning, but v1beta works end to end, so v1beta is what the route and client use.) This closes the open B2 v1alpha/v1beta risk.

### B3 • interviewer brain — Ismail (branch b3-b4)

- `lib/prompts.ts` (new): `interviewerInstructions(problem)` (friendly-but-rigorous system instruction: explain approach before coding, 1-2 sentence turns, never give the solution, check stated complexity against the actual code and challenge a linear claim on a nested loop, ask complexity + an edge case after all tests pass) and `formatRunContext(snapshot, result)` (the docs/CONTRACT.md run message: version, passed/total, failing cases with input/expected/actual-or-error, line-numbered source, ending "Ask one short question about this specific code and result.").
- `lib/live.ts`: system instruction on `connect` now comes from `interviewerInstructions`; `sendRunContext` uses `formatRunContext` and is queued at a turn boundary (if the interviewer is mid-answer, it holds the run message and flushes it on the next `turnComplete` so it never cuts them off), sent with `turnComplete: true` so the interviewer asks about the run.
- Check (text path via REPORT_MODEL, since driving a spoken mic exchange headlessly isn't feasible; voice itself is proven in B2): fed `interviewerInstructions` + a "this is linear" student line + two `formatRunContext` messages. Nested-loop question: *"you mentioned this runs in linear time—how many comparisons actually happen in your nested loops if every number is unique?"* (challenges complexity). Set question: *"What are the time and space complexities of this approach?"* The two questions differ and the nested-loop one challenges the complexity claim. **PASS.**

### B4 • real report — Ismail (branch b3-b4)

- `app/api/report/route.ts` (new): `POST {session}`. 400 `invalid_request` on a non-JSON body or a session missing required fields (verified). Calls `REPORT_MODEL` with `responseMimeType: application/json` + a response schema; the prompt carries the rubric categories, transcript turns with IDs, snapshots with `codeVersion` + line-numbered source, and runs with per-case results. Server-side: validates every evidence ref (turnId / codeVersion / caseId must exist in the session), drops invalid refs, downgrades any non-`insufficient_evidence` finding left with no refs to `insufficient_evidence` (empty list), and fills `reportId`, `sessionId`, `attemptId`, `createdAt`. 503 `provider_unavailable` on missing env or any Gemini error.
- Check: POSTed a realistic session (snapshots v2 nested-loop + v3 set, 2 runs, 3 turns where the student claims "linear") → **HTTP 200**, 4 findings, 6 evidence refs, **0 unresolved**, and `spoken_reasoning` rated **needs_work** ("claimed ... linear time, which contradicts what the code actually does"). `nextStep` is one concrete practice item.
- Finish: `npm run lint` clean; `npm run build` passes (TypeScript included); both `/api/live-token` and `/api/report` present in the build.

### What Hamza needs in components/ to use the real voice and report (f5-polish)

Backend is ready on `main` once b3-b4 merges; these are the only switches, all in files Hamza owns:
- `components/liveAdapter.ts`: set `USING_MOCK_LIVE = false`; replace `createLiveClient()` to return `createLiveClient()` from `@/lib/live`; replace `fetchLiveToken` to `POST /api/live-token` with `{ sessionId }` and return the JSON (or the `ApiError` on non-200).
- `components/reportAdapter.ts`: set `DEFAULT_REPORT_MODE = "api"` (the `"api"` branch already calls `POST /api/report`).
- Requires `.env.local` with `GEMINI_API_KEY`, `LIVE_MODEL`, `REPORT_MODEL` (values above) on any machine that runs it; voice needs HTTPS + mic in the browser.

### B5 • Live code-context sync (versioned) — Ismail (branch `live-context-sync`, WIP off PR #5)

Separates updating the model's code context from requesting a spoken turn, and keeps the Live session aware of edits between Runs.

Client contract (shared, proposed addition — non-breaking): `LiveClient.syncCode?(snapshot)` added in `lib/contract.ts` as an **optional** method, so the scripted `MockLiveClient` stays valid. `syncCode` updates context silently (`turnComplete:false`); `sendRunContext` is the only spoken-turn request (`turnComplete:true`).
- `lib/prompts.ts`: `formatCodeContext(snapshot)` — a line-numbered `[CODE vN] current working buffer (not run yet)` block, no question.
- `lib/live.ts`: versioned queue. Tracks `currentBufferVersion`/source (a higher version supersedes; a late older Run never lowers it) and `lastSentVersion`. `syncCode` coalesces superseded edits to the latest. Edits/Runs that arrive while the interviewer speaks are held and flushed at the next `turnComplete` (never interrupting). A Run carries the exact source/version/results captured for it; if the student has edited past it, it is delivered as historical evidence with the current buffer alongside. An edit and a Run on the same version are not sent/asked twice. `end()` clears the queue.

Checks performed and outcome:
- `dev/live-queue-check.mjs` (deterministic; real client, `@google/genai` stubbed to capture every `sendClientContent`). **All 10 pass.** Message order recorded:
  1. initial sync → `[CODE v1]` tc:false
  2. idle pauses → `[CODE v2]` tc:false, `[CODE v3]` tc:false
  3. edits v4,v5 while speaking → nothing mid-turn; at `turnComplete` → `[CODE v5]` tc:false (v4 coalesced)
  4. v4 Run after v5 edit → `[RUN v4]` tc:true (historical, names v5 as current); when both queued in a turn → one message `[RUN v4, CODE v5]` tc:true
  5. edit v5 + Run v5 → one ask `[RUN v5]` tc:true, no duplicate `[CODE v5]`
  6. `end()` → reconnect sends only `[CODE v1]` (no stale v9)
- SDK/Live (real key, `v1beta`, production native-audio `LIVE_MODEL`): a `turnComplete:false` code update produced **0** messages in a 3.5 s window (no spoken turn), and after a `turnComplete:true` ask the spoken reply transcript was *"The distinctive constant name is QUOKKA_THRESHOLD_7."* — i.e. the spoken answer references a distinctive detail from an **unrun** edit. 
- `npm run lint` clean; `npm run build` passes (TypeScript included).

What Hamza wires in `components/` (after this merges): call `client.syncCode?.(snapshot)` once after `connect` (initial sync) and on a debounced editor pause (paused-edit snapshot); keep calling `sendRunContext` on Run. No change to the existing calls.

Not done from the cloud session: the `f5-demo` working tree + its four modified files live on the laptop and can't be read here, so they are not in this branch. The in-browser spoken walkthrough (human speaking into the mic) is still Hamza's/your live confirmation; the Live mechanism above is verified against Gemini.

### B6 • Transcription fix — Ismail (branch `b6-transcription-stages`, off f5f80a0)

Ismail's browser retest (recorded): Gemini received both implementations after Run, including the update (code-delivery path works). The transcript did not display. Silent edit sync was outside this test.

Trace (one exchange, ephemeral token → Gemini events → `lib/live.ts` → `onTurn` → UI), credentials/raw audio never logged:
- **First point where text disappears: the ephemeral token configuration.** With the token the route minted (`liveConnectConstraints.config` = `{ responseModalities:[AUDIO], sessionResumption:{} }`), a real session returns audio and `turnComplete` but **zero** `outputTranscription` text. The locked config is authoritative, so the browser's `inputAudioTranscription`/`outputAudioTranscription` request was ignored. Adding transcription to the token config makes the transcript appear ("Banana is yellow." in the trace).
- `lib/live.ts` buffering and `onTurn` are correct (deterministic check `dev/live-transcript-check.mjs`, 4/4): text chunks accumulate, a `finished` completion event with no text still flushes, `turnComplete` flushes a turn with no `finished`, no double-emit, student before interviewer, ids `t1…`.

Fix (backend, mine):
- `app/api/live-token/route.ts`: add `inputAudioTranscription: {}` and `outputAudioTranscription: {}` to the token's `liveConnectConstraints.config`.
- `lib/live.ts`: handle transcription presence and the `finished` flag separately, so a text-less completion event still flushes the turn.
- Code delivery is preserved: `sendRunContext` / `sendRealtimeInput` are unchanged.

Verified: fixed route end-to-end — `POST /api/live-token` → connect → spoken reply transcript "An apple is a fruit." (audio + transcription both present). `npm run lint` clean; `npm run build` passes. No `components/` changes; the frontend already renders `onTurn` turns, so no frontend handoff is needed for this bug.

Pending (human, in browser): say a distinctive sentence, hear one reply, confirm the panel shows both turns once with correct speakers, and that Finish's report request carries those same turn IDs. Not observable from the cloud session.

### B6 • Interview stages + answer tracking — Ismail (branch `b6-transcription-stages`, commit 2)

Grounds the interviewer in the actual Problem and enforces one outstanding question at a time.
- `lib/prompts.ts`: `interviewerInstructions(problem)` now includes the prompt, the worked examples (expected behavior), the constraints, and the `functionName`, plus the staged protocol: start by asking for the approach; ask exactly one question then wait; only a spoken student answer advances (an edit, Run, silence, or the interviewer's own words do not); follow up on a missing detail or on the exact operation that contradicts the code; after a Run discuss that version and its results; end with time complexity, then space, then one edge case, one at a time.
- `lib/live.ts`: tracks an `outstanding` question (set when the interviewer asks / we request a turn; cleared only by a student turn). While outstanding, a Run is held (silent code context may still go out) and raised as a single ask at the next boundary after the student answers. Reset on `end()` (so Retry starts clean).

Checks:
- `dev/live-stages-check.mjs` (deterministic): a Run while a question is outstanding sends no ask; after the student answers it is raised as one ask; two Runs while answering still produce exactly one ask; an edit while outstanding does not count as an answer. **All pass.**
- Grounded prompt (real model, text): student "nested loop … I think it's linear" + a passing Run → one question *"you have a nested loop … how many comparisons when all elements are unique?"* (one question, challenges the claim, references the real code).
- `npm run lint` clean; `npm run build` passes.

Pending (human, in browser): claim linear + run passing code → worst-case question and wait; answer + switch to a set → space-usage follow-up; then an edge-case question; and confirm an extra Run while answering does not skip a stage or add a second question. The gate is verified deterministically above; the spoken multi-turn flow is the live confirmation.

### B6 • Run-evidence delivery + disconnect preservation (PR #9, continues from d62133b) — Ismail

Fixes two cases from Ismail's browser retest.

1. **Stale score (Gemini reported the latest run as 4/4 when v3 scored 2/4).** The client now *separates sending completed-Run evidence from requesting a spoken follow-up*. On every Run it sends `[RUN vN] score + line-numbered source` as **silent** context (`turnComplete:false`) immediately — even while a question is outstanding — so the model's run state is always accurate (version + source + score kept together in one message). The spoken follow-up (`turnComplete:true`) is a separate, gated step. A version that has run is never also labeled `[CODE vN] not run yet`.
2. **Lost Run on disconnect.** `sendRunContext`/`syncCode` now record the Run/buffer even with no open socket. An unexpected close or a send failure exposes the disconnected state (`onState("error")` + a retryable `onError`) and **preserves** the latest Run for the attempt; `connect()` on the same client restores the buffer + latest Run to the fresh session and re-asks. `end()` (and therefore Retry) clears it.

Partial-transcript safety: the follow-up fires only after a *completed* student turn and never while `pendingInput` is non-empty, so an interim transcript cannot trigger a question mid-answer.

Deterministic regression tests — all pass:
- `dev/live-run-evidence-check.mjs` (new): v3 2/4 evidence delivered promptly while outstanding; v3 never re-labeled "not run yet"; version+source+score in one message; follow-up after the answer states 2/4 (not 4/4); partial transcript triggers nothing, completed answer raises one follow-up.
- `dev/live-disconnect-check.mjs` (new): socket close and send failure both expose the error state; a Run while disconnected is not transmitted but is restored (evidence + one grounded follow-up) on reconnect; `end()` clears it.
- `dev/live-queue-check.mjs` (updated to the separated evidence/ask protocol), `dev/live-stages-check.mjs` and `dev/live-transcript-check.mjs` (unchanged): all pass. The commit-1 transcription fix is untouched.
- `npm run lint` clean; `npm run build` passes.

Gemini-side verification (real key, v1beta, native-audio; mic/browser not used): after v2 4/4 then a silent `[RUN v3] 2/4`, asked "most recent run version and score?" → **"Version 3 passed 2/4 tests."** (no longer 4/4). On a reconnect that re-delivers the v3 evidence, the interviewer grounded its question in the v3 set implementation (it asked about complexity rather than restating the score verbatim, which is acceptable).

Pending (human, in browser) — left to Ismail: on one real socket, claim linear, run v2 4/4, edit to v3, run v3 2/4 while answering, and confirm Gemini identifies v3 as 2/4 and asks one question grounded in that code; then force a socket close, run again, and confirm the evidence and a grounded question survive the reconnect.

### B6 • Browser reconnect + attempt-scoped transcript IDs (PR #9) — Ismail

Addresses Hamza's two PR #9 findings (the queue 4d "failure" was a stale B5 expectation, already fixed at `7285bbb`).

Changed files (branch `b6-transcription-stages`): `lib/live.ts` (reconnect + turn-ID), `docs/CONTRACT.md` (new "Live code context, reconnect, and transcript IDs" section), `CURRENT.md`, and new `dev/live-reconnect-check.mjs` + `dev/live-turnid-check.mjs`. No frontend, token-route, `f5-polish`, `live-context-wip`, or `lib/contract.ts` changes.

- **Reconnect** now runs on the current attempt's existing client. `connect()` doubles as reconnect: it is epoch-guarded so a double-click, a failed retry, or late open/message/error/close events from a superseded socket cannot overwrite the new connection or append turns to a finished attempt. One mic + one playback path persist across a reconnect (no second `startMic()`), preserving mute. An unexpected close/send-failure exposes `onState("error")` + a retryable `onError` and preserves the latest Run (incl. a Run completed offline); `connect(freshToken, problem)` restores the buffer + latest-Run evidence, then one grounded follow-up. `end()` clears it and invalidates any in-flight reconnect.
- **Transcript IDs** are attempt-scoped: `createLiveClient(options?: { turnSeed?: number })`. Reconnecting the same client continues numbering; an End→Start within the attempt builds a fresh client seeded with `turnSeed = turns-so-far`; a new attempt (Retry) seeds 0. No global counter.

Checks (all pass):
- Deterministic (7 suites): `live-transcript`, `live-queue`, `live-stages`, `live-run-evidence`, `live-disconnect`, and new `live-reconnect` (restore after fresh-token reconnect with correct version/source/score/cases + one follow-up; double-reconnect keeps only the latest socket and ignores stale callbacks; failed retry preserves the Run; End during reconnect restores nothing and old events add no turns; cleared evidence does not replay) and `live-turnid` (unique t1..t4 across reconnect and End→Start; Retry may restart).
- `npm run lint` clean; `npm run build` passes.
- Direct Gemini (real key, `v1beta`, native-audio; no mic): a fresh-session restore of the v3 2/4 evidence answered "Version 3 passed 2 out of 4 test cases." — identifies v3 2/4 after reconnect. (The 4/4 → 2/4 within one socket was already confirmed.)

Pending (human, in browser) — Hamza wires the reconnect control on PR #10, then the full walkthrough (below in the handoff) is run with a real key + mic.
