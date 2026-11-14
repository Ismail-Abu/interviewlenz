# Interviewlenz, explained in plain English

This file explains the whole project in simple terms: what it does, how the pieces fit, what is real, and what is still fake. **Every AI or teammate who finishes a task updates this file** (see "How to keep this file updated" at the bottom).

**Last updated:** Sat Nov 14, ~4:00 PM ET, after F1, F2 (partial), and B1.

---

## 1. What the app does (the 10-second version)

A student practices a coding interview in the browser. They see a problem, write Python code, and click Run to see which tests pass. While they work, an AI interviewer talks to them by voice and asks questions about the code they actually wrote. At the end they get a report that points to exactly what they said and wrote, and they can retry.

**The demo moment:** the student writes a nested loop and says "this is linear." The interviewer catches it and asks, "How many comparisons happen if every number is different?"

---

## 2. Status board

| Task | Who | What it is | Status |
|---|---|---|---|
| F1 | Hamza | The page: problem on the left, code editor on the right, Run button, results | ✅ Done |
| B1 | Ismail | The thing that actually runs the student's Python code | ✅ Done (on branch, not merged to main yet) |
| F2 | Hamza | Connect Run to the real runner, build the voice panel | 🟡 Run is real. Voice is fake until B2 |
| B2 | Ismail | Voice: secure login token + the code that talks to Gemini Live | ⏳ Not started. **Hamza is waiting on this** |
| F3 / B3 | Both | After each Run, tell the interviewer the code and results so it asks about them | 🟡 Hamza building against fake voice |
| F4 / B4 | Both | End-of-interview report with clickable evidence, plus Retry | 🟡 Hamza building against a fake report |
| Final | Both | Put it online (Vercel), backup video, Devpost write-up | ⏳ Later |

**Branches right now:** `main` (scaffold + contract), `f1` (Hamza's page), `f2` (Hamza's runner wiring + voice panel, includes Ismail's B1), `claude/sweet-franklin-fovxva` (Ismail's B1 runner).
**Merge order:** B1 branch → f1 → f2.

---

## 3. How the pieces fit

```
 Browser (everything the student sees)
 ┌──────────────────────────────────────────────────────────┐
 │  Problem text    Code editor (Monaco)    Voice panel     │
 │                        │                     │           │
 │                   [Run] button          [Start interview]│
 │                        │                     │           │
 │                        ▼                     ▼           │
 │           Runner (Pyodide in a      Live client (talks   │
 │           Web Worker): runs Python  to Gemini by voice)  │
 │           right in the browser             │             │
 └────────────────────────────────────────────┼─────────────┘
                                              │ needs a token
 Our server (Vercel)                          ▼
 ┌──────────────────────────────────────────────────────────┐
 │  /api/live-token  → hands the browser a short-lived pass │
 │  /api/report      → asks Gemini Flash to write the report│
 │  (the real Gemini key lives ONLY here, never in browser) │
 └──────────────────────────────────────────────────────────┘
```

---

## 4. What happens when you click Run (step by step)

1. The editor gives the current code plus a **version number**. The version goes up by 1 every time you type, so we always know which version of the code a result belongs to.
2. `runCode()` (in `lib/runner.ts`) sends the code to a **Web Worker**, a separate background thread, so a bad loop can't freeze the page.
3. Inside the worker, **Pyodide** (real Python compiled to run in the browser) loads the student's code and calls `contains_duplicate()` once for each of the 4 test cases.
4. For each case it records the input, what we expected, what actually came back, pass or fail, any error, and anything the student printed.
5. If the code takes longer than **5 seconds** (for example `while True`), the worker is killed and restarted, and the page shows a timeout.
6. The results come back to the page and show in the results panel with green or red badges.

Pyodide starts loading as soon as the page opens, so the first Run is fast (about 0.7 seconds in testing).

---

## 5. What happens with voice (planned, B2 + F2)

1. Student clicks **Start interview**.
2. The browser asks our server for a **token** (`/api/live-token`). Think of it as a visitor pass that expires soon. This way the real Gemini key never reaches the browser.
3. The browser uses that token to open a live voice connection to **Gemini Live**.
4. The student talks, Gemini listens and talks back, and both sides show up as transcript turns (t1, t2, ...).
5. **After every Run** (F3/B3), we send Gemini a text note with the code version, pass/fail results, and the code itself, so its next question is about *that* code.

Right now this is **fake**: `components/liveAdapter.ts` uses a scripted mock interviewer. The panel is labeled **MOCK VOICE**. When B2 lands, Hamza swaps in the real one.

---

## 6. The report (planned, B4 + F4)

When the student clicks **Finish**, the whole session goes to `/api/report`: transcript, every code snapshot, and every run. Gemini Flash returns **findings** like "complexity: needs work," and each one points to proof: a transcript turn, a code version, or a test run. Clicking the proof jumps to it. **Retry** starts a new attempt and keeps the old report so you can compare.

Right now the report uses a fake file (`fixtures/report.json`) labeled **FIXTURE DATA**.

---

## 7. Real vs fake right now

| Piece | Real or fake |
|---|---|
| Problem page, editor, Run button, results | ✅ Real |
| Running Python (Pyodide) | ✅ Real (on the f2 branch) |
| Voice interviewer | ❌ Fake (scripted mock) |
| Sending code to the interviewer after Run | ❌ Fake (being built against the mock) |
| Report | ❌ Fake (fixture file) |
| Accounts, history, multiple rounds, resume tailoring, Java, camera | ❌ Not building. Mocked for the demo if shown |

---

## 8. Where things live (file map)

**Hamza's files (the screens)**
- `app/page.tsx`: the main page.
- `components/ProblemRoom.tsx`: holds everything together: code, version, results, voice state.
- `components/ProblemPanel.tsx`: shows the problem text.
- `components/CodeEditor.tsx`: the Monaco code editor (same editor as VS Code).
- `components/ResultsPanel.tsx`: shows test results.
- `components/VoicePanel.tsx`: Start, mute, End, the state light, and the transcript.
- `components/runCodeAdapter.ts`: the one place Run goes through. It can switch between the real runner and fake results.
- `components/liveAdapter.ts`: the one place voice goes through. It's fake until B2.

**Ismail's files (the engine)**
- `lib/problems.ts`: the Contains Duplicate problem and its 4 test cases.
- `lib/runner.ts`: `preloadRunner()` and `runCode()`.
- `lib/runner.worker.ts`: the background thread that runs Python.
- `lib/runnerHarness.ts`: the Python code that runs each test case and captures results.
- `dev/runner-check.mjs`: a test script that proves the runner works (not part of the app).
- *(coming)* `lib/live.ts`, `app/api/live-token/route.ts`, `lib/prompts.ts`, `app/api/report/route.ts`.

**Shared (change only if both agree)**
- `lib/contract.ts`: the agreed **shapes of data** passed between the two halves.
- `docs/CONTRACT.md`: the same contract, explained with examples.
- `fixtures/*.json`: fake example results that match the contract, used until real pieces exist.

---

## 9. Words you'll see

- **Contract:** the agreement on what data looks like (names and fields) so Hamza and Ismail can build separately and it still fits together.
- **Fixture:** a fake, hand-written example result used for testing before the real thing works.
- **Mock:** a fake stand-in for a real service (like the scripted voice interviewer).
- **Adapter:** a single "plug" file. Swapping fake for real means changing just that file.
- **Pyodide:** Python that runs inside the web browser. No server and no cost.
- **Web Worker:** a background thread in the browser, so heavy work doesn't freeze the page.
- **Monaco:** the code editor from VS Code, embedded in our page.
- **Gemini Live:** Google's real-time voice AI. It listens and talks back.
- **Ephemeral token:** a short-lived pass the browser uses to talk to Gemini without seeing our real key.
- **codeVersion:** a counter that goes up on every edit, so each result is tied to the exact code that produced it.
- **Session / attempt:** one practice session. A Retry is a new attempt inside the same session.
- **Branch / PR / merge:** a branch is a separate copy to work on, a PR (pull request) asks to add it to main, and a merge adds it.
- **Vercel:** the free hosting that puts the app online.

---

## 10. Open questions and blockers

- **Ismail → B2 is the critical path.** Hamza's real voice can't work until `lib/live.ts` and `/api/live-token` exist.
- **Agreed:** `lib/live.ts` exports a factory, `createLiveClient()`, and turn IDs stay unique across reconnects.
- **Deadline:** still waiting on organizers. Code freeze is 2 hours before it.
- **Fonts:** the app loads Geist fonts from Google at build time. That's fine on Vercel. If venue Wi-Fi is blocked during a local build, switch to local fonts.

---

## How to keep this file updated

Whenever a task's completion check passes (or something important changes), the person or AI finishing it must:
1. Update the **Status board** (section 2) and **Real vs fake** (section 7).
2. Add or adjust anything in sections 3–6 and 8 that changed, in plain English. No jargon without a definition in section 9.
3. Update **Open questions and blockers** (section 10).
4. Change the **Last updated** line at the top.
Keep it short and readable. This file is for understanding, not for code details (those go in CURRENT.md).
