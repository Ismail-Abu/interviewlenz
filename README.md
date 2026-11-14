# Interviewlenz

Interviewlenz helps CS students practice explaining their decisions while they code. The planned voice interviewer follows the student's implementation, listens to their reasoning, and asks about the tradeoffs it sees. Built for Hack the Nest 2026 at Eastern Michigan University.

**Project status:** Planning. This repository currently contains the team brief and [full build plan](INTERVIEWLENZ_PLAN.md). The plan includes shared API contracts, acceptance checks, and the proposed product roadmap.

## Start here on a new checkout

Read [the agent instructions](AGENTS.md) and [the current assignments](CURRENT.md) first. Pick the task assigned to your role. The workflow below and the full plan describe the larger build sequence.

## First demo

1. Open a Python problem and explain an approach aloud.
2. Write and run the solution in the browser. Inspect the test results.
3. Hear a question grounded in the code. For example, if a student describes a nested search as linear, the interviewer can ask how many comparisons happen when all elements differ.
4. Review the relevant code and transcript together, then retry the explanation.

## Team and stack

Hamza owns frontend and Ismail owns backend. Follow the [active task table and merge times](CURRENT.md). Each teammate advances when their completion check passes.

The demo uses Next.js, TypeScript, Tailwind, Monaco, browser-side Pyodide, Gemini Live, Gemini Flash, and Vercel. Pyodide runs Python locally within the browser sandbox with no runner credentials or per-submission fee. The [RapidAPI pricing page](https://rapidapi.com/judge0-official/api/judge0-ce/pricing) lists per-use Basic pricing, so the demo has no dependency on a hosted runner allowance.

Gemini Live ephemeral tokens are in preview and support only the v1beta Live API. Longer sessions must reconnect about every 10 minutes using session resumption. Keep the demo session under 10 minutes. [Google token guide](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)

## Morning of submission

The team has an MLH / GoDaddy Registry free-domain voucher. Use the [event redemption page](https://mlh.link/godaddyregistry) and enter the code from the team's card privately. The card says the offer expires the Thursday after the event (November 19, 2026).

- [ ] Pick an available domain and redeem the voucher.
- [ ] Add the registered domain to the team's Vercel project and apply the DNS records Vercel supplies at the registrar.
- [ ] Verify that the live site loads over HTTPS and the interview microphone works there.
- [ ] Add the verified live URL to this README and the hackathon submission.
