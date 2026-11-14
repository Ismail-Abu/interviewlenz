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

Hamza pushes the bare Next.js scaffold first, within 20 minutes, before either owner adds other files. This applies to the implementation kickoff after the shared setup and contract land. Build against the shared contract. Coordinate any changes to it with both owners.

## File ownership

- Hamza owns pages under `app/**` and `components/**`, except `app/api/**`.
- Ismail owns `lib/runner.ts`, `lib/runner.worker.ts`, `lib/problems.ts`, `lib/live.ts`, `lib/prompts.ts`, and `app/api/**`.
- Shared, change only after both agree: `lib/contract.ts` and `docs/CONTRACT.md`.

## Mocked for demo

Label any shown preview as mocked. These features need no working integrations during the sprint.

- Accounts and history
- Multi-round gating
- Job and resume tailoring
- Java execution
- Camera and delivery feedback
