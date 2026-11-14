# Interviewlenz

Interviewlenz helps CS students practice explaining their decisions while they code. The planned voice interviewer follows the student's implementation, listens to their reasoning, and asks about the tradeoffs it sees. Built for Hack the Nest 2026 at Eastern Michigan University.

**Project status:** Planning. This repository currently contains the team brief and [full build plan](INTERVIEWLENZ_PLAN.md). The plan includes shared API contracts, acceptance checks, and the first AI prompts for each teammate.

## Start here on a new checkout

Read [the agent instructions](AGENTS.md) and [the current assignments](CURRENT.md) first. Pick the task assigned to your role. The workflow below and the full plan describe the larger build sequence.

## First demo

1. Open a Python problem and explain an approach aloud.
2. Write and run the solution in the browser. Inspect the test results.
3. Hear a question grounded in the code. For example, if a student describes a nested search as linear, the interviewer can ask how many comparisons happen when all elements differ.
4. Review the relevant code and transcript together, then retry the explanation.

## Team workflow

| Owner | First task | Done when |
|---|---|---|
| Both | Choose one problem and agree on the run-code request and response | The same example covers a passing case, a failing case, and an execution error |
| Frontend | Set up the shared Next.js app and build the editor and results view | A teammate can open the room and see labeled sample results |
| Backend | Connect the isolated Python runner and provide a short-lived voice token | One real solution runs and the browser completes a spoken exchange |
| Both | Connect code snapshots, voice, test results, and the report | Changing the implementation changes the spoken follow-up |

Use one issue per task and one branch per issue. Give the coding assistant the relevant section of the plan, the agreed contract, and the completion check. Merge each working step and verify the session together before expanding.

## Planned stack and roadmap

The first session uses Next.js, TypeScript, Monaco, Gemini Live, and Judge0. Verify access to voice and execution early. Keep permanent API keys on the server. The submission milestone includes deployment on Vercel, an evidence-based report, retry, and a recorded backup demo.

Later milestones add job and resume tailoring, behavioral and CS fundamentals rounds, system design, Java, saved progress, and optional delivery feedback. See the [feature inventory and milestone table](INTERVIEWLENZ_PLAN.md).

## Hackathon domain

The team has an MLH / GoDaddy Registry free-domain voucher. Use the [event redemption page](https://mlh.link/godaddyregistry) and enter the code from the team's card privately. The card says the offer expires the Thursday after the event (November 19, 2026).

- [ ] Pick an available domain and redeem the voucher.
- [ ] Add the registered domain to the team's Vercel project and apply the DNS records Vercel supplies at the registrar.
- [ ] Verify that the live site loads over HTTPS and the interview microphone works there.
- [ ] Add the verified live URL to this README and the hackathon submission.
