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

### F7 • code-context sync UI + transcript path — Hamza • November 14 • branch `f-code-sync` from `f5f80a0`

PR #5 (`f5f80a0`) and the logo PR #8 are unchanged. **Discrepancy:** `syncCode` is in `lib/contract.ts` and the B5 entry but not yet in `docs/CONTRACT.md`. This work follows the type and the B5 notes (silent, coalesced by version, optional).

- **Sync wiring** (`components/ProblemRoom.tsx`)
  - When real voice connects, `client.syncCode?.(snapshot)` is called once with the buffer as it is then, including edits made while connecting. The scripted mock has no `syncCode`, so nothing is sent in mock mode.
  - After that, each edit restarts a 2 s timer, so a burst of edits sends one sync with the latest version.
  - The latest buffer lives in a ref, so neither the timer nor a late-resolving connect reads stale state.
  - `sendRunContext(snapshot, result)` on Run is unchanged. A Run marks its version as synced, so no redundant sync of the same version follows.
  - End, Finish, and Retry cancel a pending sync.
- **Two existing gaps fixed** (connection generation counter):
  - A connect that resolves after End, Finish, or Retry is now ended and dropped. Before, it was kept as a zombie session.
  - State, turn, and error callbacks from an ended connection are ignored, so a late turn can't land in the next attempt.
- **Test seam** (`components/liveAdapter.ts`) — In dev only (compiled out of production builds), a browser test can set `window.__interviewlenzTestLiveClient` to a `LiveClient` factory. It stands in for `lib/live.ts` behind the same token check, event gating, and fallback.

**Checks: Edge via Playwright on `npm run dev`, 25/25 pass (4 consecutive runs).** Every one of these used an injected **test LiveClient** with `/api/live-token` stubbed to 200 — **no Gemini, no `lib/live.ts`**:
1. Connect (with a 1.5 s connect delay and two edits during it) → exactly **one** `syncCode`, after connect, carrying the latest edit (v3). No extra sync while idle.
2. Five edits 250 ms apart → nothing at 1.5 s, then exactly **one** sync, of the latest version (v8), sent 2004 ms after the last edit.
3. Run → `sendRunContext` got the exact source, version v9, and 4/4 results. No `syncCode` for v9 afterwards.
4. Test client emits student `t901` "PURPLE ARMADILLO…" and interviewer `t902` "ZEBRA-42…" → exactly two transcript items, in order, labeled You · t901 and Interviewer · t902. The session shows 2 turns.
5. Finish with an edit pending → the `/api/report` request's `session.turns` is exactly `[t901 student, t902 interviewer]` with the same text. The pending edit was never synced.
6. Retry → a late turn emitted by the old client does not appear, and the new attempt shows 0/0/0 with no syncs. A new connection syncs the starter buffer once (v1); a stale-client turn is ignored while the new client's turn appears.
7. Finish while still connecting → that connection is ended when it resolves and never syncs.

Regression (from #5, **not** test-client):
- A. Real routes (503 without a key) → "MOCK VOICE (no API key)" and "FIXTURE DATA (no API key)".
- B. Real `lib/live.ts` with a stubbed 200 token → opens the Gemini `v1beta` socket, then falls back cleanly with no error banner.
- C. Stubbed 200 report → no fixture badge, all evidence links land, Retry resets.

`npm run lint` clean; `npm run build` passes.

**Known, not fixed:** Monaco 0.55.1 sometimes logs `Uncaught (in promise) Canceled` when the editor is disposed (Finish right after an edit). It reproduces by disposing the editor directly, independent of this change. It never reaches a page `error` or `unhandledrejection` listener, so it can't be filtered from app code, and nothing is visible to the user.

**Not done (needs Ismail's transcription fix and a real mic):** say a distinctive sentence, rename a variable without Run, ask what changed, then check that the transcript shows what was actually said and the spoken reply names the new variable.

### F8 • Reconnect UI + attempt-scoped turn seeds — Hamza • November 14 • PR #10 (`f-code-sync`)

**Tested commit `4db348f`** (tree `778913ff293b4922ff91aac4853985ac41f32868`) = `f88c92f` (F7) + Ismail's `5b7f31b` (PR #9; merged as `504d129`, clean, both handoffs kept) + this frontend change. Per `docs/CONTRACT.md` "Live code context, reconnect, and transcript IDs". Frontend files only: `components/ProblemRoom.tsx`, `components/VoicePanel.tsx`, `components/liveAdapter.ts`.

- **Seeds** — Start passes the attempt's accepted-turn count as `turnSeed` to `createLiveClient` and to the scripted `MockLiveClient`, which is now seeded per instance instead of using a global counter. End → Start within an attempt builds a new client from the latest count. Retry resets the count to 0 and keeps the prior report.
- **Reconnect** — When the real client reports `state "error"` (its disconnect signal; a mic failure only raises `onError`), the client is kept and the panel shows **Connection lost** and **Reconnect**. Clicking it fetches a fresh token for the same `sessionId` and calls `connect(freshToken, problem)` on the **same** client. There is no `openVoice`, no new client, no `startMic`, and no switch to the mock, so the mute choice is kept.
  - The button is disabled while pending.
  - A failed token or connect shows the error and Reconnect stays available.
  - If End, Finish, or Retry happens while pending, the late result is ignored.
  - Success clears the error.
  - The existing initial sync, 2 s editor sync, and Run wiring are unchanged.
- **Two small fixes found while testing** — `onError` no longer flips the mute toggle (it did, which broke mute preservation), and End clears a stale disconnect error.

**Automated checks** (Edge via Playwright on `npm run dev`, no key). All reconnect and turn-ID checks used the **test LiveClient** (it mirrors lib/live.ts: seeded IDs; disconnect = `state "error"` + retryable `onError`), with `/api/live-token` stubbed per request:

| Check | Result |
|---|---|
| First Start seeds 0; End → Start seeds 2; IDs t1, t2, t3 | PASS |
| Scripted fallback seeded (intro is t4); IDs unique | PASS |
| Real client after the mock seeded with the current count (4) | PASS |
| Disconnect → Reconnect + "Connection lost" + error shown | PASS |
| Double-click while pending → one token request; button disabled | PASS |
| Token 503 → error shown, no `connect()`, retry allowed | PASS |
| Token OK but socket fails → error shown, retry allowed | PASS |
| Success → `connect()` on the **same** client with a fresh token each time (3 connects, 3 tokens); no new client; mic not restarted; still muted; no mock; error cleared | PASS |
| IDs keep increasing after reconnect (t4 → t5) | PASS |
| End during token fetch → no `connect()`, no stray error | PASS |
| Finish during token fetch → no `connect()`; Retry empty, seeded 0, restarts at t1; prior report kept beside the new one | PASS |

These ran three consecutive times with 30/30 each. Also on `4db348f`:
- F7 sync/transcript suite, 25/25 (test client; the Run used real Pyodide).
- Regression A/B/C (no-key fallbacks with real Pyodide; real `lib/live.ts` socket attempt; stubbed-200 report evidence links + Retry).
- All seven of Ismail's `dev/live-*-check.mjs` checks pass.
- `npm run lint` clean; `npm run build` passes.

**Real-mic walkthrough — not run (no credentials or human mic on this machine).** Status per step, waiting on Ismail's configured laptop at `4db348f`:

| Step | Result |
|---|---|
| Distinctive sentence appears once, correct speaker | not run |
| 4/4 then 2/4; interviewer uses the latest result, one specific question | not run |
| Disconnect → restore network → Reconnect: voice returns, mute kept, IDs increase, Gemini names the latest Run | not run |
| Finish → `/api/report` 200, real report, evidence links resolve | not run |
| Retry → empty attempt, prior report available | not run |

PR #10 stays open until these are recorded.

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

### B7 • Live interviewer grounding fix — backend (requested by Ismail; branch `b7-live-grounding` from PR #10 `29d03ed`, which contains PR #9 `5b7f31b`)

**Code commit `ff43edb`** (tree `8e9c1f1e2a349e2a18e1bd16f34c945f26faa9e5`). Files: `app/api/live-token/route.ts`, `lib/live.ts`, `lib/prompts.ts`, `dev/live-grounding-check.mjs` (new), plus small updates to `dev/live-{queue,stages,run-evidence,disconnect}-check.mjs`. **No `components/` change and no `lib/contract.ts` change.**

**Root cause, from the code and SDK 3.3.0 (`authTokens.create` docs, "Case 2").** A token minted with `liveConnectConstraints` locks the *entire* `LiveConnectConfig`. `lib/live.ts` set `systemInstruction` only on the client `connect()` config, so it was ignored. That explains why the diagnostic instruction worked in the token config and was ignored client-only. For the same reason, no turn-detection settings ever took effect.

Traced one Run: `ProblemRoom.handleRun` captures `{codeVersion, source}` before awaiting the runner → `sendRunContext` → `latestRun` → `pumpEvidence` (silent `[RUN vN]`) → `pumpFollowup` (`turnComplete:true` ask) → interviewer transcript. Defects reproduced before editing (13/30 of the new checks failed):
- no instruction or turn detection in the token
- no opening question
- a follow-up during an 850 ms pause
- **a late v6 result replaced v7, so the question was about v6**
- no reconnect notice
- no correlation trace

**Fix:**
1. **Token route** locks `systemInstruction: interviewerInstructions(containsDuplicate)` (one shared builder, canonical problem: function, prompt, examples, constraints) and `realtimeInputConfig.automaticActivityDetection` (`silenceDurationMs: 1200`, `prefixPaddingMs: 300`, `END_SENSITIVITY_LOW`) into the single-use token. The key stays server-side, and the response is still only `{token, model, expiresAt}`. `lib/live.ts` no longer sends an instruction.
2. **Instruction** covers:
   - English only; open by asking for the approach; one focused question, then wait; a short mid-sentence pause is not an answer
   - follow up on an incomplete answer or a contradiction with the code; discuss the supplied Run; complexity → space → edge case when time allows
   - how `[START]`, `[CODE vN]` (silent, not run), `[RUN vN] P/T` (exact code + observed results; the latest is the highest version), and `[RECONNECTED]` arrive
   - when asked: give the latest Run version, its score, and a code detail; say exactly what is missing; mention a reconnect only after `[RECONNECTED]`
3. **`lib/live.ts`:**
   - one `[START]` opening per attempt (never on reconnect), treated as an outstanding question
   - an older Run completing late never replaces newer evidence (traced `superseded`); one coalesced follow-up, about the latest Run
   - follow-up waits `STUDENT_SETTLE_MS` = 1500 ms after the student's last speech, and resumed speech cancels it
   - one silent `[RECONNECTED]` notice only after an observed drop
   - the existing epoch guards, single listeners, persistent mic, interruption, and mute are unchanged
4. **Local correlation trace (opt-in):** set `globalThis.__ILZ_LIVE_TRACE__ = []` in a dev console. Stages: `connected`/`reconnected`, `opening`, `queued`, `superseded`, `written` (evidence on the active socket), `asked` (follow-up written), `confirmed` (the interviewer reply names that version or score), `turn`. Each carries connection id, run id, version, and score. **Metadata only:** no audio, source, transcript text, or tokens. Off unless the array exists.
5. `createLiveClient({ followupSettleMs })` is optional (default 1500), used by the deterministic checks. The UI call site is unchanged.

**Commands and results** (no key needed):
- `node --experimental-strip-types dev/live-grounding-check.mjs` → **30/30 pass**:
  - token locks the builder's instruction for the canonical problem, single-use, no key in the response
  - turn detection 1200 ms > 850 ms; no diagnostic phrases
  - one opening on first connect, none on reconnect
  - Run while a question is outstanding → evidence only, no second question
  - **850 ms mid-sentence pause → no follow-up; resumed speech re-arms the wait; then exactly one follow-up (v5 4/4)**
  - trace v5 queued → written → confirmed, metadata only
  - **two rapid Runs → one question, about v7 2/4; late v6 never replaces v7**
  - **edit after Run → `[CODE v8] not run yet`, latest Run evidence still v7**
  - **reconnect with a pending Run → one `[RECONNECTED]`, v9 evidence restored, one follow-up (after the settle window), no opening, stale socket ignored**
- All seven existing checks pass: `live-transcript`, `live-queue`, `live-stages`, `live-run-evidence`, `live-disconnect`, `live-reconnect`, `live-turnid`. The queue, stages, run-evidence, and disconnect stubs now complete the opening exchange and use settle 0; their original assertions are unchanged.
- Frontend suites (test LiveClient) on this branch: sync 25/25, reconnect 30/30. The no-key regression is unchanged (503 → labeled fallbacks; real `lib/live.ts` opens the `v1beta` socket and falls back cleanly).
- `npm run lint` clean; `npm run build` passes.

**Spoken acceptance: PENDING. There's no key or mic on this machine, so no human has heard it.** Browser steps for Ismail are in the PR. Expected trace while doing them: `connected` → `opening` → for each Run `queued` → `written` → `asked` → `confirmed`; after Wi-Fi off/on + Reconnect, `reconnected` and the latest Run `written` again.

### B8 • Report path + public route safeguards — backend (requested by Ismail; branch `b8-report-path` from #12 `3752036`)

**Code commit `e9102c9`** (tree `2f7a45417d245698a06f5cfad71219870e549c7c`). Base: #12 (B7 voice grounding), which contains #10 and #9. **No voice work has spoken acceptance yet** (no comments from Ismail on #9, #10, or #12). Files: `app/api/report/route.ts`, `app/api/live-token/route.ts`, `dev/report-check.mjs` (new). No UI, `lib/contract.ts`, or `docs/CONTRACT.md` change.

**Trace (existing code).** Finish (`ProblemRoom.handleFinish`) builds the Session → `reportAdapter.requestReport` (`auto`) → `POST /api/report` → `generateContent` with a JSON schema → server-side evidence validation → `ReportView` resolves chips: turn by id, code by `snapshots.findLast(v)`, run by `runs.findLast(v)`. Evidence validation already existed. Gaps were reproduced with `dev/report-check.mjs` before editing:
- Malformed Session elements and oversized bodies were **sent to Gemini** (6 paid calls in the check) and came back as a misleading 503.
- A `null` model response **crashed the route** (TypeError → 500).
- No usable findings or no `nextStep` still returned 200 with a **made-up generic next step**.
- Line ranges could exceed the snapshot (`[40, 7]`).
- `spoken_reasoning` could cite an interviewer turn.
- No transcript → nothing prevented speech-based findings.
- No snapshot/run timestamps or earlier-vs-later rule in the prompt.
- No provider timeout.
- Missing key reported as retryable.

**Fixes.**
- **Report request:** full Session validation (turn/snapshot/run/case shapes, unique `tN` ids, known problem → `unknown_problem`) and bounds (256 KB body, 400 turns, 4 KB per turn, 200 snapshots/runs, 20 KB per source, 20 cases), all checked before any provider call.
- **Model output:** null, non-object, or malformed nested output never crashes.
  - Code refs must be captured snapshots, with line ranges inside them.
  - Run refs must exist, and case IDs must belong to that run.
  - `spoken_reasoning` may cite only student turns.
  - Refs are de-duplicated; at most 7 findings, summaries capped at 400 characters.
  - Zero usable findings or no `nextStep` → **503 retryable, no report** (nothing invented).
- **No transcript:** `spoken_reasoning` and `clarification` are forced to `insufficient_evidence` with "No transcript was captured…", and the prompt says not to describe speech.
- **Grounding:** timestamps on snapshots and runs, plus a rule to keep an earlier claim or implementation separate from a later improvement, each citing the evidence from that time.
- **Timeouts and errors:** report 25 s and token mint 10 s (SDK timeout + abort + race) → `503 {code:"timeout", retryable:true}`. Missing key/model → `503 … retryable:false`. Errors are generic, nothing is logged, and no provider detail or key reaches the browser.
- **Token route:** 1 KB body cap, `sessionId` limited to `[A-Za-z0-9_-]{1,128}`.

**Automated results (no key; SDK stubbed):**
- `node --experimental-strip-types dev/report-check.mjs` → **46/46 pass**:
  - **Request:** 10 validation/size cases with zero provider calls; not-configured is non-retryable.
  - **Grounded nested→set attempt:** one call; the earlier "linear" claim cites t2 + v2 lines 2–4, and the later set fix cites v5 + t4 + run v5. Timestamps and the earlier-vs-later rule are in the prompt; a timeout is set.
  - **Invented evidence (t99, v42, run v9 c1, case c9, lines 40–45, interviewer turn as speech):** dropped or downgraded.
  - **Malformed nested output (invalid JSON, null, object findings, all-unusable findings, missing nextStep, empty text):** 503 retryable, no findings.
  - **Missing transcript:** no invented speech.
  - **Provider error:** 503, no detail leaked.
  - **Hung provider and hung token mint:** 503 timeout.
  - **Token route:** body cap, sessionId format, not-configured, and leak checks.
- All eight `dev/live-*-check.mjs` pass. `npm run lint` clean; `npm run build` passes.
- UI suites (test LiveClient): sync 25/25, reconnect 30/30. The no-key regression is unchanged; both real routes answer `503 … not configured, retryable:false`, and the UI shows its labeled fallbacks.
- **UI observation (stubbed `/api/report`, no UI change):**
  - double-click Finish → **1** report request, 1 card
  - a real 200 report shows **no fixture badge**, and its code chip opens the cited lines
  - Retry → Attempt 2 at 0/0/0; after it finishes, Attempt 1's real report is still shown beside it

**Frontend dependency for Hamza (not blocking the real-key check):** `components/reportAdapter.ts` `auto` mode falls back to the fixture on *any* failure. Reproduce: stub `/api/report` → `503 {"code":"provider_unavailable","retryable":true}` (or `{"code":"timeout","retryable":true}`), then Finish. **Observed:** "FIXTURE DATA (no API key)" fixture report, no Retry report. **Expected:** with `retryable:true` (provider failure or timeout), show the error card with **Retry report**, keeping the attempt. Fall back to the labeled fixture only when `retryable:false` (not configured) or the route is missing. The routes now send exactly that signal.

**Public usage / cost exposure for Ismail before launch.** Both routes are unauthenticated:
- `/api/live-token` mints single-use Live tokens. Each allows a session starting within 2 min, with a 30-min message window.
- `/api/report` makes one Flash call per request, with prompts up to the 256 KB cap.
- **No rate limit or origin check exists.** Add a Vercel WAF rate-limit rule on `/api/*` (e.g. ~10/min per IP), a Google Cloud budget alert and quota cap on the key, and optionally an Origin check or a challenge (e.g. Turnstile). Consider shortening the 30-min token window for the demo.

**Real-provider results: NOT RUN.** There's no key or mic on this machine. Steps for the real-key run are in the PR.

## Release • interviewlenz.us — November 14 (prepared; NOT live)

**Release candidate code: `9362d24`** (tree `8839aa14e7642f8c07dfcf5d02dab20cafc4c64c`) on branch `release-candidate`. The branch head adds only this CURRENT.md entry. It is one clean merge of the two lines from `f5f80a0`:
- **Backend line:** #5 ⊂ #9 ⊂ #10 ⊂ #12 ⊂ **#13 `23b167d`**
- **UI line:** #5 ⊂ #8 ⊂ **#11 `995e7a2`**
- plus one planned UI follow-up: the Reconnect button uses `btn.primary`, the "one-line change after #10 and #11 merge" from #11

`main` (`a18d179`) is an ancestor, so the release fast-forwards `main`. Excluded on purpose: `live-context-wip` (`a599be3`, superseded draft; branch left untouched).

**Acceptance status:** no voice or report work has spoken or real-key acceptance. There are no comments from Ismail on #9, #10, #12, or #13.

**Automated checks on a fresh GitHub clone at `9362d24` (`npm ci` from the lockfile, Node 22.18, npm 10.9, no `.env.local`):**
- `npm run lint` clean; `npm run build` passes (`/`, `/api/live-token`, `/api/report`, icons).
- All 10 dev checks pass: `live-{disconnect,grounding,queue,reconnect,run-evidence,stages,transcript,turnid}`, `report-check` (46), `runner-check`.
- **Production server (`next start`):**
  - landing 23/23, including **Skip → coding round**, and the role/resume data staying in the browser (no request carries it)
  - regression A/B/C: the no-key routes return `503 not configured`, the UI shows labeled mock voice and fixture report; real `lib/live.ts` opens the `v1beta` socket and falls back cleanly; a stubbed report's evidence chips land and Retry works
  - report UI: double-click Finish makes 1 request; real report has no badge; Attempt 1's report kept after Retry
  - the dev test seam is absent from the production bundle
- **Dev server:** voice sync 25/25, reconnect 30/30 (test LiveClient).

**Known limitations at this commit:**
- **Local-only preview:** landing-page resume screenshots, job fields, the "Your interview loop" preview, and the room's "Practicing for…" chip stay in the browser tab. Nothing tailors the interview yet. All of it is labeled PREVIEW.
- **Report failure fallback:** fixed by F9 (`5419848`, on top of this release candidate). Until it merges into the release, a retryable report failure or timeout at `9362d24` still shows the "(no API key)" fixture.
- **DOMPurify in the runtime editor:** browsers run Monaco 0.55.1 from jsDelivr, which bundles DOMPurify 3.2.7 (affected by GHSA-6688-9rhm-gjv2 / -mrv2-3pqr-j5jr / -c6gr-qvv4-5v3f). Practical exposure is low: the only editor content is the student's own code, and there are no Python hover providers. The `npm audit` hit (`monaco-editor@0.57.0` / `dompurify@3.4.15`) is in an unused npm copy, absent from the client bundle. Not changed before the deadline.
- **Public routes:** both API routes are unauthenticated, with request and size caps and timeouts but **no rate limit**. See "Remaining exposure" below.

**Hosting and domain: NOT DONE (needs Vercel, Porkbun, Gemini, and a mic; none on Hamza's machine):**
- **Vercel:** not linked (the repo has 0 GitHub deployments). To do: import `Ismail-Abu/interviewlenz`, Framework Next.js, defaults, production branch `main`.
- **Server env (Production + Preview), names only:**
  - `GEMINI_API_KEY`, `LIVE_MODEL`, `REPORT_MODEL` (required; match `.env.example`)
  - leave unset: `LIVE_API_VERSION` (defaults to `v1beta`), `REPORT_TIMEOUT_MS`, `LIVE_TOKEN_TIMEOUT_MS`
  - no `NEXT_PUBLIC_*` variables exist
  - **Function duration:** check Settings → Functions allows ≥ 30 s; the report call can take up to 25 s.
- **Models with the production key:** not verified here. B2 recorded `LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025` and `REPORT_MODEL=gemini-3.8-flash` working with Ismail's key on `v1beta`.
- **DNS at Porkbun (public lookup, Nov 14):**
  - NS: Porkbun (`fortaleza`, `maceio`, `curitiba`, `salvador`)
  - apex A: `207.207.210.107` and `207.207.210.229` (Porkbun parking)
  - `www`: CNAME `pixie.porkbun.com` (parking)
  - apex MX, TXT, CAA: **none public**; confirm email forwarding in the dashboard before editing
  - HTTPS on apex and `www`: no connection
  - **Not live.** Add `interviewlenz.us` and `www` in Vercel → Domains, then copy the exact A / CNAME values Vercel shows for this project. Replace only the parking A records and the `www` CNAME; keep everything else.
- **Remaining exposure for Ismail:** anyone can mint Live tokens or trigger Flash reports. Configure a Vercel WAF rate limit on `/api/*`, a Google Cloud budget alert, and an API quota cap on the key. Nothing here shows whether those exist.

**Rollback:** no production deployment exists yet. After the first deploy, record its Vercel deployment URL here. Rollback is Vercel → Deployments → previous → "Promote to Production" (or "Instant Rollback").

**Deadline:** still "Sunday, November 15, exact time awaiting organizer confirmation". Freeze code 2 hours before the confirmed time.

**Live checks on https://interviewlenz.us: NONE RUN.** A token HTTP 200 alone is not voice acceptance.

### F9 • Report fallback: real failures retry, fixture only without a service — Hamza • November 14 • branch `f9-report-retry` from release candidate `fa84be6`

**Tested code commit `5419848`** (tree `07dde279428e78d26052634ee97dea4e850351db`) = release candidate `9362d24`/`fa84be6` + this change. Files: `components/reportAdapter.ts` and `components/ReportView.tsx` only. No backend, contract, or session-shape change. Checked first: #14 still at `fa84be6`, no newer heads, no other local work.

**Trace.** Finish → `ProblemRoom.loadReport(session)` → `requestReport(session, "auto")` → `POST /api/report`. Before, `auto` replaced **any** failure with `fixtures/report.json` labeled "(no API key)". Retry report → `handleRetryReport(attemptId)` → `loadReport(record.session)` re-sends the stored Session, so a retry is the same attempt.

**Now, in `auto` mode:**
| Route response | UI |
|---|---|
| 200 | real report |
| 503 `provider_unavailable`, `retryable:false` (not configured) | labeled fixture "(no API key)": the zero-key demo is unchanged |
| 404 / not an API response | labeled fixture "(report service unavailable)" |
| 503 / timeout with `retryable:true`, or a network error | error card ("Report timed out" / "Report unavailable") with **Retry report**, same attempt |
| 400 `invalid_request` / `unknown_problem` | error card, **no fixture**, no Retry (re-sending identical data can't succeed) |

**Checks** (Edge via Playwright on `next start`; `/api/report` stubbed per case unless noted). **16/16 pass:**
- Timeout on Finish → "Report timed out" + Retry report, no fixture. **Retry → real report, no fixture badge.** Exactly 2 requests. **The retry body is byte-identical to the first (same ids, turns, snapshots, runs).** Still one attempt card; the evidence chip opens the cited lines; Retry problem → empty Attempt 2; no page errors.
- Retryable provider failure → error + Retry. Dropped connection → "Couldn't reach the report service…" + Retry.
- Invalid request (400) → error text shown, no fixture, no Retry.
- Not configured → "FIXTURE DATA (no API key)". Route missing → "FIXTURE DATA (report service unavailable)".
- **Zero-key demo against the real route (no stub, no key) → "FIXTURE DATA (no API key)".**

Also on `5419848`:
- landing 23/23 (`next start`)
- regression A/B/C unchanged
- all 10 dev checks pass (`live-*` ×8, `report-check`, `runner-check`)
- `npm run lint` clean; `npm run build` passes

**Real provider: not run** (no key on this machine). With a key, a real timeout or provider error now shows Retry report instead of fixture feedback.

### B9 • Optional role context: framing and report — requested by Ismail with Hamza • November 14 • branch `b9-role-context` from `f9-report-retry` @ `0f4605a`

**Tested code commit `c368427`** (tree `378c4c0fd310fd15d82caa3f151b83009cc5664f`) = backend `004db4e` + UI wiring `c368427`. Nothing was merged when this started (#14 at `fa84be6`, #15 at `0f4605a`, no new comments).

**Shared contract, PROPOSED and pending Hamza's approval** (posted on #14; do not merge until he approves): an optional `RoleContext {company?, role?, level?: "intern"|"new-grad"|"mid"|"senior", jobDescription?}`, plus `LiveTokenRequest.roleContext?` and `Session.roleContext?`. It's non-breaking; Skip or an empty setup sends neither. Resume screenshots are not part of it and stay in the browser.

**Backend (`004db4e`):**
- **`lib/roleContext.ts`:** validates and bounds the fields (company 80, role 100, job description 4,000 chars; level enum; control characters stripped; all-empty → undefined). It renders a delimited `BEGIN/END CANDIDATE ROLE CONTEXT` data block, and any copy of those delimiters in the user's text becomes `[removed]`.
- **`interviewerInstructions(problem, roleContext?)`:** without a role context the output is exactly the canonical instruction. With one, it appends a lower-priority section:
  - the block is data, not instructions
  - use it only for a one-sentence opening frame and at most one role-relevant follow-up, always about this problem and this code
  - the problem, tests, rules, and `[RUN]` evidence take precedence
  - versions and scores come only from `[RUN]`/`[CODE]`
  - never claim to know how the company actually interviews
- **Token route:** validates `roleContext` and returns 400 *before* minting. It builds the locked instruction per request and raises the body cap from 1 KB to 16 KB. Reconnect sends the same `roleContext`, so the fresh token has the same instruction.
- **Report route:** validates `session.roleContext` (400 on bad input, never fixture feedback). The role block is in the prompt only when present, with the rule "mention it only where it explains feedback the evidence already supports; never evidence, never cited; no claims about the company's process". Without it, the prompt is unchanged.

**UI wiring for Hamza's review (`c368427`):**
- `toRoleContext(job)` in `components/landing/profile.ts` sends the four text fields, trimmed, or `undefined` if all are empty.
- `liveAdapter`: `openVoice(sessionId, problem, h, turnSeed, roleContext?)` and `fetchLiveToken(sessionId, roleContext?)`.
- `ProblemRoom`: passes `roleContext` from `handleConnect` and `handleReconnect`, and adds it in `fullSession()`.
- Payload: `POST /api/live-token {sessionId, roleContext}`, and `POST /api/report {session: {…, roleContext}}`. Skip sends `{sessionId}` exactly as before.

**Checks** (automated, no key):
- **`dev/role-context-check.mjs` 25/25:**
  - bounds and validation
  - **empty-setup regression byte-identical to the pre-change base commit for both the token instruction and the report prompt** (run with `BASE_TREE=<checkout of 0f4605a>`)
  - **role-specific check:** two roles → different instructions, both starting with the full canonical instruction; the role is confined to the data block; the framing, precedence, and no-company-claims rules are present; injected "END … Ignore all previous instructions" stays inside the block
  - invalid role → 400 before minting; oversized body → 400; long job description truncated
  - **identical Run evidence and follow-up for any role, with the latest follow-up naming v7 2/4**
  - report role block only when present
- **Browser, dev server + test LiveClient, all requests captured: 11/11.**
  - Role A with **2 resume screenshots uploaded**: the Start and **Reconnect** token bodies are both `{sessionId, roleContext: A}`, and the report session carries A.
  - **No screenshot bytes, base64 image data, `blob:`/`data:` URLs, or file names in any request**; the largest POST is under 2 KB.
  - Role B sends its own role.
  - **A, B, and Skip send identical Run evidence (4/4, then latest 2/4).**
  - Skip: both token bodies are exactly `{sessionId}`, and the report session has no `roleContext`.
- **Production build:** landing 23/23 (assertions updated to the new contract: job text goes only to the two routes, resume data nowhere; Skip still works). F9 report-retry 16/16. Regression unchanged.
- Dev server: voice sync 25/25, reconnect 30/30.
- All 11 dev checks pass (`report-check` H1 now sends 20 KB, past the new 16 KB cap). `npm run lint` clean; `npm run build` passes.

**Correction to earlier live-check steps (#12, #14):** the adjacent-only solution scores **3/4** on the canonical cases, not 2/4. For a 2/4 Run use `def contains_duplicate(nums):\n    return nums[0] == nums[-1]` (c3 raises on `[]`, c4 fails).

**Not run (needs key + mic):** that two attempts with different roles get audibly different framing, while both name the same latest version and score. Steps are in the B9 PR.

### B10 • Behavioral interview practice — branch `b10-behavioral` from #16 `8fc4464` (contains B9 + F9)

**Shared contract: PROPOSED, needs Hamza's approval before merge** (same agreement as B9). Started with no newer work, no other worktrees, and no in-progress UI from Hamza. There was no existing mode picker; the only "Behavioral" was a landing preview label.

#### Step 1 — generic behavioral round: **tested commit `f55f835`**
- **Contract:**
  - `RoundType = "coding" | "behavioral"`
  - `Session = CodingSession | BehavioralSession`; an omitted `roundType` means coding, so older payloads and fixtures are unchanged
  - a `BehavioralSession` has **no** `problemId`, snapshots, or runs
  - four behavioral `Finding` categories: specificity, personal_contribution, reasoning, outcome
  - `LiveTokenRequest.roundType?`; `LiveClient.connect(token, problem?)`
- **Server:**
  - The token route locks `behavioralInstructions()` for `roundType: "behavioral"`: one engineering-story question, then one follow-up probing a missing detail in the student's own words; never coding. An unknown round returns 400. Role framing uses title, company, and level only, never the raw listing.
  - Report route: behavioral validation. An **empty transcript** gets a 200 insufficient-evidence report; a **sparse one** (under 40 student words) gets a 200 report saying what's missing; neither calls the model. Otherwise the behavioral rubric runs, and **only this attempt's student turns** are evidence (interviewer turns, invented IDs, code refs, and coding categories are dropped or downgraded). The coding path is unchanged.
- **Client (`lib/live.ts` `round`):** behavioral `[START]` opening; Run and code calls are inert; reconnect sends one `[RECONNECTED]` recap with the current question and recent turns verbatim (asking for the follow-up if the student had answered); IDs stay continuous.
- **UI:**
  - Landing has **Skip to a behavioral round** and **Start behavioral round**.
  - `BehavioralRoom`: current question, a whose-turn line, mute/end/reconnect, transcript, and Finish; works at phone width.
  - Report: an **exact-quote** evidence panel per attempt, and **Practice again** for behavioral (Retry report still reuses the attempt).
  - Zero-key demo: a scripted behavioral mock ("We fixed the database" → "what did you personally investigate or change?"), and a labeled behavioral fixture.
  - Corrected stale landing copy: B9 sends role details, so "nothing is uploaded" was no longer true.
- **Checks:**
  - `dev/behavioral-check.mjs` 28/28: instruction selection (an omitted round is still the exact coding instruction), no coding text in any behavioral message, inert Run/code, recap verbatim, IDs continuous, report empty/sparse/rubric/student-only evidence/400s, an old coding payload with no `roundType`, zero-key behavior.
  - Browser 27/27: Skip → Behavioral → answer → follow-up → mute → Finish → exact quote → Practice again; **two attempts with different `t1`/`t2` each open their own quote**; phone layout; zero-key mock and real deterministic report with no code evidence.
  - Coding regression: landing, sync, reconnect, role, F9 report-retry, and all 12 dev checks; lint clean.
- **Needs a human (real key + mic):** the real interviewer's follow-up adapting to two different answers.


#### Step 2 — Tailor this interview: **tested commit `0093b75`**
- **Contract (PROPOSED, same review):** `BehavioralContext { project?: {name, summary?}; focus?: {skill, detail?} }` on `BehavioralSession` and `LiveTokenRequest` (behavioral only; 400 on a coding token). `TailoringRequest` / `TailoringSuggestion` for the new route. Limits in `lib/behavioral.ts`: 3,500,000 request bytes, 4 pages, 8000 listing chars, 80/240-char context fields.
- **`POST /api/analyze-tailoring` (new):**
  - Rejects before any model call: `content-length` or body bytes over 3,500,000 (UTF-8 bytes, not characters), more than 4 images, types other than PNG/JPEG/WebP, non-base64 data, bytes that don't match the declared type, listings over 8000 chars, and requests with neither resume nor listing.
  - Uploaded and pasted content goes to the model as data; 25 s timeout → 503 `timeout`; missing key → 503 not configured (`retryable:false`).
  - Returns at most one project (only if pages were sent; needs an excerpt) and one focus (only if a listing was sent; its excerpt must actually be in the listing). Emails, links, and phone numbers are removed. Nothing is logged.
- **Landing (`TailorPanel`):**
  - **Tailor this interview** is collapsed by default. The disclosure says what goes to Gemini before **Prepare my interview**. Selecting files, typing, or opening the form sends nothing.
  - Pages are re-encoded in the browser (JPEG, long side 1600 → 1100 px floor). The exact serialized body is checked against 3,500,000 bytes before sending. If it can't fit: remove pages, enter details manually, or start a generic round. Five or six pages → "at most 4".
  - Duplicate clicks send one request. Editing inputs or Skip mid-flight drops the late response.
  - The editable preview shows verbatim excerpts separately ("not sent to the interviewer"), with Remove buttons. **Enter details manually** works without any upload.
  - Landing copy corrected: screenshots stay in the tab *unless* the student selects Prepare.
- **Round:**
  - The confirmed context (never excerpts, files, or the listing) goes into the token instruction (project → ask about it; focus → student picks a story; both → connect without assuming an incident; "not evidence") and the `[START]` opening.
  - It's resent on every Reconnect and reused by Practice again with no new analysis. It shows as "Tailored: …" in the room, and the report prompt labels it NOT evidence.
  - No context → byte-identical Step 1 instruction and opening.
- **Checks:**
  - `dev/tailoring-check.mjs` 44/44: the bounds above, all four input combinations, excerpt enforcement, contact removal, timeout, not configured, injection delimiters, report labeling, no console output.
  - Browser `drive-tailor` 34/34. **Completion check:** correct "CampusEats Delivery API" → "CampusEats Orders Service", remove the focus, start → the token, `[START]` extra, and room use the corrected name; Reconnect and Practice again resend it with **one** analysis request total. Also covered: stale/Skip mid-flight, timeout → manual focus-only, listing-only, remove-all → generic, 5 pages, ladder fits 3 large pages at 3.30 MB, 4 can't fit, unreadable file → generic, phone width.
  - Regression: the Step 1 behavioral, landing, sync, reconnect, role, and report-retry drivers, plus all stubbed dev checks; lint; `next build`. Zero-key: the real route answers "not configured", and the panel offers manual or generic.
  - The too-large browser case stubs the canvas encoder: real synthetic noise pages still compress under the cap at 1100 px.
- **Needs a human (real key):** extraction quality on a real resume screenshot and listing, and hearing an opening about the corrected project.

#### Step 3 — verification: **tested commit `ff26911`**, draft PR #19 (base `b9-role-context`)
- Rebased onto Ismail's coding-room merge `35ecda9`, then reran everything on the combined head. Typecheck, `eslint .`, and `next build` pass; all stubbed dev checks pass (`live-check` needs a real key and wasn't run).
- Browser checks committed under `dev/browser/`: `drive-behavioral` 27/27, `drive-tailor` 34/34, and `drive-b10-coding` 10/10. With a tailoring context confirmed, a coding round still sends no `roundType`/`behavioralContext`. The set solution scores 4/4 (v2) and unconditional `return False` scores 2/4 (v3); both reach Live with the latest version, and the report gets the old coding shape. F9 zero-key fallbacks still work. The landing, sync, reconnect, role, and report-retry suites pass.
- PR #19 carries the contract proposal for Hamza, the screenshots (branch `pr-assets/b10`, images only, never merge), and a 5-step real-mic walkthrough for Ismail with two contrasting answers.
- **Outstanding:** Hamza's contract approval, after which `docs/CONTRACT.md` gets B9 + B10; Ismail's real key + mic walkthrough; extraction quality on a real resume; the setup copy decision noted in `35ecda9`. Next task after merge: the combined multi-round interview.

#### Step 3 — verification: **in progress** (on `b752373`, no app code changed)
- Done: coding regression in the browser (`drive-b10-coding` 10/10). With a confirmed tailoring context on the landing page, Start practice still sends a coding token with no `roundType` or `behavioralContext`; set solution 4/4 (v2) and unconditional `return False` 2/4 (v3) both reach Live with the latest version and source; the report session is the old coding shape; the F9 zero-key fixture fallback and zero-key mock voice still work; no analysis request is made.
- Already covered by Steps 1–2: four input combinations, oversized/unreadable/too many pages, timeout, edit/remove, duplicate clicks, stale responses, manual fallback, instruction selection, opening, reconnect, report for both rounds, two attempts with different t1 quotes, rejection of invented and interviewer turn IDs.
- Left: move the scratchpad browser drivers into the repo (`dev/`), post the B9/B10 contract proposal for Hamza, write a real-mic walkthrough for Ismail with two contrasting answers, and open the focused PR with the tested SHA, screenshots, and remaining manual acceptance.

## CI handoff • automated PR checks • November 15 • passed on GitHub Actions

Branch `ci/pr-checks`. PR **#17** → **`main`**. Tested commit **`b6b3133`**.

Originally based on `b10-behavioral` (`b2ef7f5`) and targeted there. Retargeted to `main` once `main` moved ahead: `main` (`984f26b`) now carries the unrun-draft fix (via its own merge `52a4f98`) plus PR #18's 2-round flow, streamlined homepage, and mobile editor, and is ahead of `b10-behavioral` in features. Merging `main` in conflicted on `components/StartScreen.tsx` — **took main's version**, since this branch adds CI only and must not change Hamza's components. Its diff against `main` is CI files alone (workflow, `scripts/ci-checks.mjs`, `dev/unrun-draft-check.mjs`, `package.json`, `README.md`, this entry).

**No file in `dev/` is touched**, so the browser drivers moving into `dev/` (B10 Step 3) stay uncontested.

### Files

- `.github/workflows/pr.yml` (new) — `on: pull_request` + `workflow_dispatch`; `permissions: contents: read`; `concurrency: pr-checks-${{ github.event.pull_request.number || github.ref }}` with `cancel-in-progress: true`; Node 22 with npm cache; `npm ci` → `npm run lint` → `npm run test:ci` → `npm run build`; 20-minute timeout.
- `scripts/ci-checks.mjs` (new) — runs the deterministic `dev/` checks as child processes with `--experimental-strip-types`. Explicit allowlist, not a glob. Every check runs even after a failure; exits 1 naming each failing check.
- `package.json` — adds `"test:ci": "node scripts/ci-checks.mjs"` and `engines.node: ">=22"`.
- `README.md` — new **Checks** section: the four commands and the "Still needs a human" table.

### Local command

```sh
npm ci && npm run lint && npm run test:ci && npm run build
```

### In CI (13 deterministic checks)

`runner-check` · `report-check` · `behavioral-check` · `tailoring-check` · `role-context-check` · `live-grounding-check` · `live-queue-check` · `live-stages-check` · `live-transcript-check` · `live-turnid-check` · `live-reconnect-check` · `live-disconnect-check` · `live-run-evidence-check`

All stub `@google/genai` through the esbuild alias; `runner-check` drives the local `pyodide` package. None needs a key, network, port, dev server, or browser.

**Excluded on purpose: `dev/live-check.mjs`.** It imports the real `GoogleGenAI`, reads `GEMINI_API_KEY`/`LIVE_MODEL` from `.env.local`, mints a real ephemeral token, and opens a real Live socket; on a clean runner its `readFileSync("../.env.local")` throws before the key check reports. The allowlist is explicit so it cannot be picked up by a `live-*.mjs` glob, and so new `dev/` browser drivers do not silently enlist.

### Checks performed

| Check | Result |
|---|---|
| Actions run [43676131163](https://github.com/Ismail-Abu/interviewlenz/actions/runs/43676131163) on `e7bfa86`, `pull_request` | **success**, 1m46s. Steps: checkout, setup-node, `npm ci`, Lint, Deterministic checks, Production build — all green |
| `npm run test:ci` on the runner | `all 13 checks passed` on Node 22.23.4. Slowest: `live-grounding` 7863 ms, `runner-check` 6785 ms |
| Red path (throwaway branch, since deleted) | A probe exiting 3 → step **failure**, `Production build` **skipped**, job failed with exit 1, summary `FAIL ../scripts/_fail-probe.mjs (21 ms, exit 3)` and `ci-checks: 1 of 14 FAILED: ../scripts/_fail-probe.mjs`. The other 13 still ran |
| `cancel-in-progress` | Two rapid runs on one ref: the superseded run `43676438058` went to **cancelled** when `43676456466` started |
| No credentials needed | The green run used no secrets; `GEMINI_API_KEY`/`LIVE_MODEL`/`REPORT_MODEL` are unset on the runner |

**Not run locally:** this machine has no Node installed, so `npm run test:ci` was never executed here. Every result above comes from GitHub Actions.

### Regression test added — dependency resolved

`dev/unrun-draft-check.mjs` (new; no existing `dev/` file touched), in CI via the allowlist. 19 assertions, all passing.

Scenario: a v3 Run scores 2/4, the student edits to v4 and presses Finish without running. It asserts `buildPrompt` labels v4 `(unrun draft; no test results for this version)`, leaves v3 unlabelled, retains the v4 source, states 2/4 on v3, attributes no run to v4, and emits exactly one run line; that `buildValidators` keeps v4 citable as `kind:code` while dropping an invented `kind:run` v4 citation; that a version which *was* run gets no false marker; and that an attempt with no Runs still sends the draft.

This was originally blocked: the fix lived only on `fix/coding-room-bash` (`ebade66`) and was absent from the then-base. Resolved — the fix reached `main` via `52a4f98`, and `b10-behavioral` via the merge `35ecda9` recorded below.

Covers the report half only. The `components/ProblemRoom.tsx` half (appending the unrun draft snapshot at Finish) is React and belongs with B10's browser drivers.

**Proven as a regression guard** (run locally on Node 22.23.5, working tree restored clean afterwards):

| State of `buildPrompt` | Result |
|---|---|
| With the fix (current `main`) | `unrun-draft-check: all checks passed`, exit 0 |
| Marker lines reverted | `unrun-draft-check: 2 FAILED` — **A1** "v4 is labelled an unrun draft" and **D2** "it is labelled unrun" — check exit **1**, `test:ci` exit **1** |

So a revert of the report-side fix turns CI red. Only 2 of the 19 assertions fail, which is correct: the reverted hunk is the snapshot label alone, and the section-B evidence-validation assertions do not depend on it (they guard `buildValidators`, a separate failure mode).

### Still needs a human

- `node dev/live-check.mjs` — real key, real Live socket.
- The in-browser spoken walkthrough — real key, HTTPS/localhost, a person at a microphone.
- The real end-of-session report — `REPORT_MODEL` and a real Gemini call.
- The deployed-site mic check over HTTPS.

Deployment, branch protection, and application features are left to their current owners.
### Coding-room bug bash • mobile editor, keyboard access, and final coding draft

Branched from behavioral handoff 20bc1a3, which includes PR #16. Coordinated the coding setup disclosure and shared-component scope on that commit. Coding setup now names Gemini and both uses of job details; resume screenshots stay local in the coding path. Behavioral analysis opt-in wording belongs beside its own action.

Changed ProblemRoom, CodeEditor, StartScreen, ReportView and the coding report prompt. Loaded Monaco at 390×844 measured 5 px before and 379 px after. At 1366×768 it measured 377 px both times. Verified in Chrome with the real browser Python worker: typed set solution → 4/4, results visible, Finish reachable. Keyboard exit on macOS: Ctrl+Shift+M, Shift+Tab to Run; keyboard activation and subsequent navigation to Finish passed on both viewport sizes.

Both viewport sizes: a v3 Run scored 2/4; after editing and finishing, the report request included v3 and v4 ISO-dated snapshots and exactly one Run, v3. The report displayed v4 as an unrun draft. An edit followed by Finish with no Runs saved the draft and showed no runs. The report prompt marks snapshots with no matching Run as unrun. Browser checks used the no-key report fallback. Lint, production build, report/token and behavioral regression checks passed.

### Integration release • Full Mock, streamlined homepage, and verified release candidate
**Branch:** `integration/release-full-mock`  
**Base ancestry:** Unified `origin/b10-behavioral` (`b2ef7f5`) + `origin/fix/coding-room-bash` (`ebade66`).

**Delivered Student Capabilities:**
1. **Streamlined Homepage:**
   - Single hero action: "Start practice" with clear framing for both coding and behavioral practice.
   - Three actionable practice modes directly selectable on 1366×768 without scrolling: **Coding**, **Behavioral**, and **Full mock** (2-round).
   - Collapsed optional personalization with mode-specific disclosures (job details sent to Gemini; resume screenshots stay local unless "Prepare my interview" is chosen for behavioral tailoring).
   - Stale copy removed ("nothing is uploaded", "tailoring isn't live", unavailable round cards).
2. **Full Mock Practice (Coding + Behavioral in one continuous loop):**
   - Starts with Python Coding round (starter code, Pyodide runner, live voice).
   - Finishing coding round presents an intentional transition screen ("Continue to Behavioral Round →" or "View Coding Feedback First").
   - Voice session, audio listeners, and WebSocket teardown cleanly before Round 2 starts.
   - Fresh behavioral session mints carrying confirmed personalization.
   - Finishing behavioral round opens the **Full Mock Summary** featuring both Round 1 and Round 2 score cards, evidence-backed practice takeaways, transcript/code quotes, inline "Retry report", and per-round "Practice this round again" preserving the other round's results.
3. **Coding-Room & Mobile Fixes:**
   - Mobile editor height (`390×844`) verified at 360px (no squishing/collapsing) via `@source` directives and `.mobile-editor-pane`.
   - Monaco keyboard navigation: `Ctrl+M` (Mac: `Ctrl+Shift+M`), then `Shift+Tab` to leave editor.
   - Unrun draft preservation: editing after a test run preserves the unrun draft with an ISO timestamp without falsely attributing prior test scores to it.
4. **Automated Verification:**
   - `dev/integration-browser-check.mjs`: 4/4 suites passed (Homepage, Coding, Full Mock 2-Round, Mobile Viewport).
   - Regression suites: `dev/tailoring-check.mjs` (44/44), `dev/behavioral-check.mjs` (28/28), `dev/live-reconnect-check.mjs` (14/14), `dev/live-disconnect-check.mjs` (8/8), `dev/runner-check.mjs` (all passed), `dev/report-check.mjs` (all passed).
   - `npm run lint`: clean (0 errors, 0 warnings).
   - Production Turbopack build (`next build`): 100% clean in 5.2s.

**Real-Mic Walkthrough for Ismail:**
1. **Coding Practice:** Start Coding round with mic enabled → Speak initial approach ("I plan to use a hash set") → Interviewer speaks prompt → Run set solution (4/4) → Interviewer asks about space-time complexity.
2. **Behavioral Practice:** Start Behavioral round → Interviewer asks opening question → Speak engineering project story → Interviewer asks specific follow-up probing a detail from your answer.
3. **Full Mock:** Complete both rounds back-to-back, verify dual summary cards and quote evidence.
