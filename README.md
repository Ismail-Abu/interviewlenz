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

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. No API keys or `.env.local` are needed. Without keys, the interviewer uses a scripted voice labeled **MOCK VOICE (no API key)**, and the report uses sample data labeled **FIXTURE DATA (no API key)**. Python runs for real in the browser.

## Checks

Node 22 or newer. From a clean checkout:

```sh
npm ci
npm run lint
npm run test:ci
npm run build
```

`npm run test:ci` runs the deterministic checks in `dev/` through
`scripts/ci-checks.mjs`. They stub `@google/genai`, so they need no API key, no
network, no microphone, and no dev server. Every check runs even if an earlier
one fails; the summary lists `PASS`/`FAIL` per check and the command exits
non-zero naming each failure.

The same four commands run on every pull request via
[`.github/workflows/pr.yml`](.github/workflows/pr.yml).

`scripts/ci-checks.mjs` holds an explicit allowlist rather than a glob over
`dev/*.mjs`, so a new check joins CI only when it is added there on purpose.

### Still needs a human

These are not in CI and must be run by hand on a configured machine:

| Check | Why it cannot run unattended |
|---|---|
| `node dev/live-check.mjs` | Reads `GEMINI_API_KEY` and `LIVE_MODEL` from `.env.local` and opens a real Gemini Live socket. |
| In-browser spoken walkthrough | Needs a real key, HTTPS or localhost, and a person speaking into a microphone. |
| Real end-of-session report | Needs `REPORT_MODEL` and a real Gemini call. |
| Deployed-site mic check over HTTPS | Needs the Vercel deployment and a browser. |

## Deploy to Vercel

1. Push the branch to GitHub, then go to [vercel.com/new](https://vercel.com/new) and import the repository. Vercel detects Next.js, so keep the default build command (`npm run build`) and output settings.
2. Deploy. The app works immediately in no-key mode, with mock voice and the fixture report.
3. To use real voice and reports later, add these variables under **Project → Settings → Environment Variables**, then redeploy:

   | Name | Purpose |
   |---|---|
   | `GEMINI_API_KEY` | Server-only Gemini key. Never prefix it with `NEXT_PUBLIC_`. |
   | `LIVE_MODEL` | Gemini Live model used for the voice interviewer |
   | `REPORT_MODEL` | Gemini model used for the end-of-session report |

4. Open the deployed URL over HTTPS and check that the browser allows microphone access.

Never commit keys. `.env.example` lists the names only, and `.env*` files are git-ignored.

## Morning of submission

The team has an MLH / GoDaddy Registry free-domain voucher. Use the [event redemption page](https://mlh.link/godaddyregistry) and enter the code from the team's card privately. The card says the offer expires the Thursday after the event (November 19, 2026).

- [ ] Pick an available domain and redeem the voucher.
- [ ] Add the registered domain to the team's Vercel project and apply the DNS records Vercel supplies at the registrar.
- [ ] Verify that the live site loads over HTTPS and the interview microphone works there.
- [ ] Add the verified live URL to this README and the hackathon submission.
