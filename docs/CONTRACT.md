# Shared contract

Hamza and Ismail jointly own this document and the [TypeScript definitions](../lib/contract.ts).

## Problem and cases

Ismail supplies the problem in `lib/problems.ts`. The prompt supports Markdown. Each test supplies positional arguments: the outer array contains one argument, itself a list of integers.

```json
{
  "id": "contains-duplicate",
  "title": "Contains Duplicate",
  "prompt": "Return **True** if any integer occurs more than once.",
  "examples": [{"input": [1,2,3,1], "output": true, "explanation": "1 occurs twice."}],
  "constraints": ["The input is a list of integers."],
  "functionName": "contains_duplicate",
  "starterCode": "def contains_duplicate(nums):\n    pass",
  "cases": [
    {"id":"c1","args":[[1,2,3,1]],"expected":true},
    {"id":"c2","args":[[1,2,3,4]],"expected":false},
    {"id":"c3","args":[[]],"expected":false},
    {"id":"c4","args":[[1,1,1,3,3,4,3,2,4,2]],"expected":true}
  ]
}
```

## Common error

Every ApiError has a code, message, and retryable flag. A line number is optional. Allowed codes are syntax_error, timeout, runner_unavailable, provider_unavailable, invalid_request, and unknown_problem.

```json
{"code":"syntax_error","message":"Expected a colon","retryable":false,"line":1}
```

## Browser runner

The problem page calls `preloadRunner(): Promise<void>` when it opens. Ismail owns `lib/runner.ts` and its client-side Pyodide Web Worker. Python execution has a five-second timeout.

The UI increments codeVersion on every edit and captures a snapshot on Run. runCode(req: RunRequest) resolves to a RunResult and never throws. Results echo the submitted version. A parsed program completes even if individual cases raise. For a raised case, actual is null and error describes the exception. stdout is optional. A syntax error, timeout, or unavailable runner returns the error variant. Times are ISO timestamps and durations are milliseconds.

### Correct set-based request

```json
{
  "sessionId": "s1",
  "problemId": "contains-duplicate",
  "codeVersion": 3,
  "language": "python",
  "source": "def contains_duplicate(nums):\n    return len(set(nums)) != len(nums)"
}
```

`language` is `"python"` or `"java"` (proposed November 18; see CURRENT.md). A Java request sends a `class Solution` whose method is named by the problem's optional `java` signature (`lib/problems.ts`); it runs in the browser with CheerpJ (`lib/javaRunner.ts`) and returns the same `RunResult` shape, with Java-style display strings (`true`, `[0, 1]`, `"text"`). `CodeSnapshot` gains an optional `language`; absent means Python.

### Set-based solution

```json
{
  "sessionId": "s1",
  "problemId": "contains-duplicate",
  "status": "completed",
  "codeVersion": 3,
  "ranAt": "2026-11-15T01:00:03Z",
  "durationMs": 25,
  "cases": [
    {
      "caseId": "c1",
      "input": "nums = [1, 2, 3, 1]",
      "expected": "True",
      "actual": "True",
      "pass": true
    },
    {
      "caseId": "c2",
      "input": "nums = [1, 2, 3, 4]",
      "expected": "False",
      "actual": "False",
      "pass": true
    },
    {
      "caseId": "c3",
      "input": "nums = []",
      "expected": "False",
      "actual": "False",
      "pass": true
    },
    {
      "caseId": "c4",
      "input": "nums = [1, 1, 1, 3, 3, 4, 3, 2, 4, 2]",
      "expected": "True",
      "actual": "True",
      "pass": true
    }
  ],
  "passed": 4,
  "total": 4
}
```

### Adjacent-only solution

```json
{
  "sessionId": "s1",
  "problemId": "contains-duplicate",
  "status": "completed",
  "codeVersion": 4,
  "ranAt": "2026-11-15T01:00:04Z",
  "durationMs": 25,
  "cases": [
    {
      "caseId": "c1",
      "input": "nums = [1, 2, 3, 1]",
      "expected": "True",
      "actual": "False",
      "pass": false
    },
    {
      "caseId": "c2",
      "input": "nums = [1, 2, 3, 4]",
      "expected": "False",
      "actual": "False",
      "pass": true
    },
    {
      "caseId": "c3",
      "input": "nums = []",
      "expected": "False",
      "actual": "False",
      "pass": true
    },
    {
      "caseId": "c4",
      "input": "nums = [1, 1, 1, 3, 3, 4, 3, 2, 4, 2]",
      "expected": "True",
      "actual": "True",
      "pass": true
    }
  ],
  "passed": 3,
  "total": 4
}
```

### Invalid syntax on line 2

```json
{
  "sessionId": "s1",
  "problemId": "contains-duplicate",
  "status": "error",
  "codeVersion": 5,
  "ranAt": "2026-11-15T01:00:05Z",
  "durationMs": 10,
  "error": {
    "code": "syntax_error",
    "message": "Invalid syntax on line 2",
    "retryable": false,
    "line": 2
  }
}
```

### Python worker could not initialize

```json
{
  "sessionId": "s1",
  "problemId": "contains-duplicate",
  "status": "error",
  "codeVersion": 6,
  "ranAt": "2026-11-15T01:00:06Z",
  "durationMs": 10,
  "error": {
    "code": "runner_unavailable",
    "message": "Python worker could not initialize",
    "retryable": true
  }
}
```

## Session and voice

Hamza keeps sessionId, attemptId, optional priorAttemptId, problemId, turns, snapshots, and runs in browser memory. Each turn has an ID such as t1, a student or interviewer speaker, text, and ISO at. Capture codeVersion, source, and ISO at for each Run snapshot.

Ismail owns app/api/live-token/route.ts. POST /api/live-token accepts {"sessionId":"s1"}. It returns HTTP 200 with token, model from LIVE_MODEL, and ISO expiresAt, or HTTP 503 with a provider_unavailable ApiError.

### Token response (illustrative values)

```json
{
  "token": "example-ephemeral-token",
  "model": "example-live-model",
  "expiresAt": "2026-11-15T01:30:00Z"
}
```

### Token provider error (503)

```json
{
  "code": "provider_unavailable",
  "message": "Voice provider unavailable",
  "retryable": true
}
```

Ismail owns lib/live.ts. connect(token, problem) and startMic() return promises. stopMic() stops capture and end() closes the session. onState, onTurn, and onError register callbacks for LiveState, TranscriptTurn, and ApiError respectively. States are connecting, listening, speaking, idle, and error.

After each Run, sendRunContext(snapshot, result) sends text into the active session. Ismail owns the wording in lib/prompts.ts. For a completed run, use this template with each failed case listed. For a run-level error, report the version and error without inventing case counts.

````text
[RUN v{codeVersion}] {passed}/{total} passed.
Failed: {caseId} input {input} expected {expected} got {actual or error}
Code:
```python
{source}
```
````

## Report and retry

Ismail owns app/api/report/route.ts. POST /api/report accepts an object with a session field containing the complete Session. Make one Gemini Flash call in JSON mode. Return HTTP 200 with Report, 400 with an invalid_request ApiError, or 503 with a provider_unavailable ApiError. Report timestamps are ISO strings.

Each finding has an ID, category, rating, one or two sentences of summary, and evidence. Categories are correctness, clarification, approach, complexity, testing, code_clarity, and spoken_reasoning. Ratings are strong, ok, needs_work, and insufficient_evidence. Only insufficient_evidence may have empty evidence. References identify a turn by ID, code by version and optional line pair, or a run by version and optional case ID. The example assumes t1 contains the student's explanation of set membership.

### Evidence-based report

```json
{
  "reportId": "r1",
  "sessionId": "s1",
  "attemptId": "a1",
  "findings": [
    {
      "id": "f1",
      "category": "spoken_reasoning",
      "rating": "strong",
      "summary": "You explained why a set removes duplicates.",
      "evidence": [
        {
          "kind": "turn",
          "turnId": "t1"
        }
      ]
    },
    {
      "id": "f2",
      "category": "approach",
      "rating": "strong",
      "summary": "Version 3 compares the set size with the input length.",
      "evidence": [
        {
          "kind": "code",
          "codeVersion": 3,
          "lines": [
            1,
            2
          ]
        }
      ]
    },
    {
      "id": "f3",
      "category": "testing",
      "rating": "needs_work",
      "summary": "Version 4 misses the separated duplicate in c1.",
      "evidence": [
        {
          "kind": "run",
          "codeVersion": 4,
          "caseId": "c1"
        }
      ]
    }
  ],
  "nextStep": "Explain why adjacent comparisons miss separated duplicates.",
  "createdAt": "2026-11-15T01:02:00Z"
}
```

Retry is frontend-only. Create a new attemptId, set priorAttemptId, and retain the prior report for comparison.

## Verify the fixtures

From the repo root, compile the shared definitions and imported JSON shapes. Then check the literal values from the same JSON files. The second check preserves literal strings and tuple lengths that TypeScript widens on JSON imports.

```sh
npx -y -p typescript tsc --noEmit --strict lib/contract.ts
npx -y -p typescript tsc --noEmit --strict --resolveJsonModule --esModuleInterop --module esnext --moduleResolution bundler fixtures/check.ts
(
  check=fixtures/.literal-check.ts
  trap 'rm -f "$check"' EXIT
  {
    echo 'import type { Report, RunResult } from "../lib/contract";'
    for file in fixtures/run-*.json fixtures/report.json; do
      kind=RunResult
      [ "$file" = fixtures/report.json ] && kind=Report
      printf '(%s) satisfies %s;\n' "$(cat "$file")" "$kind"
    done
  } > "$check"
  npx -y -p typescript tsc --noEmit --strict "$check"
)
```

## Live code context, reconnect, and transcript IDs (B5/B6, Ismail owns lib/live.ts)

These describe the browser `LiveClient` (`lib/live.ts`) and the `createLiveClient` factory. The `LiveClient` interface in `lib/contract.ts` is unchanged except for the optional `syncCode`.

### syncCode (silent code context)

`syncCode(snapshot: CodeSnapshot): void` (optional on `LiveClient`) makes the current code available to the model as silent context (`turnComplete:false`); a typing pause never asks a question. Call it once after a successful `connect` (initial sync) and after a ~2s editing pause. Coalesced to the latest version; a version that has run is sent as run evidence instead of "not run yet".

### Run evidence vs spoken follow-up

On each Run, `sendRunContext(snapshot, result)` delivers `[RUN vN]` version + line-numbered source + score as silent context immediately (even while a question is outstanding), then requests one spoken follow-up separately, only at a safe boundary. A newer unrun edit stays distinguishable (`[CODE vN] not run yet`) from the last executed version.

### Reconnect (one supported sequence)

Reconnect reuses the **current attempt's existing client** — do not build a new one. On an unexpected close or send failure the client exposes `onState("error")` plus a retryable `onError` and preserves the latest Run (exact codeVersion, source, score, cases), including a Run completed while offline. To recover: obtain a fresh ephemeral token (`POST /api/live-token`, same `sessionId`) and call `connect(freshToken, problem)` on the same client. Do not call `startMic()` afterward: the mic and playback paths persist across the reconnect, so the prior mute choice is preserved. `connect()` is epoch-guarded: double-clicks, a failed retry, and late open/message/error/close events from a superseded socket cannot overwrite the new connection or append turns to a finished attempt. On reconnect the fresh Gemini session is re-seeded with the system instruction, the current code buffer, and the latest Run evidence, then one grounded follow-up; prior transcript turns are not replayed to the model. `end()` clears the preserved Run and invalidates any in-flight reconnect.

### Transcript IDs (attempt-scoped)

IDs stay `t1, t2, ...` and must be unique for the whole attempt. The counter is seeded per client: `createLiveClient(options?: { turnSeed?: number }): LiveClient`. Pass `turnSeed` = the number of turns already in the attempt (e.g. `session.turns.length`) when building the real client **and** the scripted fallback, so numbering continues across a reconnect, an End→Start within the attempt, and a voice-mode switch. Reconnecting the same client needs no seed (it continues on its own). A new attempt (Retry) builds a client with `turnSeed: 0` and may restart at `t1`. Do not use a single global counter shared across unrelated attempts.

### sendCue (pacing; proposed November 19)

`sendCue(text: string): void` (optional on `LiveClient`) gives the interviewer a [TIME] cue to pace itself by. The client delivers it only while the interviewer is waiting for an answer and the candidate has paused, mutes the one-word acknowledgement, and keeps only the newest undelivered cue. The wording lives in lib/prompts.ts (`formatTechnicalTimeCue`) and lib/behavioral.ts (`formatBehavioralTimeCue`).

### Hiring assessment (proposed November 19)

`Report` gains an optional `assessment: HiringAssessment` (lib/contract.ts): `recommendation` is one of `strong_no_hire`, `lean_no_hire`, `lean_hire`, `strong_hire`; plus `summary`, `strengths[]`, `concerns[]` (up to three each), `toRaise`, `caps[]` (plain-language reasons the server lowered the vote), and `proposed` when a cap lowered the evaluator's vote. The caps live in lib/hiring.ts and only ever lower the recommendation. Reports without it (older reports, fixtures) render as before.
