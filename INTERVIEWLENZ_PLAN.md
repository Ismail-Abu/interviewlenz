# Interviewlenz • product and build plan

## Starting point

Two builders have a product brief and a proposed stack. Repo, deployment, credentials, service quotas, and existing implementation are unverified. First check what already exists and reuse it. Confirm the submission cutoff and required materials with the organizers. Until then, schedule against milestones.

**Audience.** CS students applying for internships and new-grad software roles who need practice explaining decisions while coding.

**First complete demo.** A student opens a Python problem, explains an approach aloud, writes and runs code, hears a question about that implementation, and receives feedback linked to what they actually said and wrote. They retry the explanation and compare both attempts.

## Everything in the product

| Area | What the student can do |
|---|---|
| Home and quick practice | Start without a resume. Pick a problem, topic, difficulty, language, and guided practice or interview simulation. Start with one Python problem. Expand to 3–4 curated problems and Java. |
| Tailored practice | Paste a software job description or enter title, company, and role details. Add resume text or a PDF. Later support job screenshots. Review extracted details before generating the plan. |
| Interview plan | See round sequence, question counts, difficulty, estimated duration, and rationale. Select questions based on role, seniority, job requirements, and resume projects. Link sources for employer-specific claims. When sources are unavailable, label the plan as suggested practice and use a role template. |
| Equipment and controls | Check microphone and speaker, choose optional camera feedback, start or end a session, mute, reconnect, and see whether the interviewer is listening or speaking. |
| Coding room | Read the prompt, examples, constraints, and starter code. Edit in Monaco, run cases, inspect expected and actual outputs, and see compilation errors, runtime errors, timeouts, and service failures. Preserve edits if a run fails. |
| Voice interview | Speak naturally, interrupt to clarify, explain decisions, and answer follow-ups. The interviewer sees recent speech, current code, problem, and latest test results. Follow the conversation through clarification, planning, implementation, testing, and complexity discussion. |
| Coaching | Guided mode offers one timely hint at a time. Simulation mode saves coaching for the report and allows realistic interviewer questions. Coordinate voice and onscreen feedback so a prompt appears once. |
| Other rounds | Behavioral questions use engineering stories and STAR. CS fundamentals probe concepts and resume projects with follow-ups. System design uses a simple diagram or text workspace to discuss requirements, components, scale, failures, and tradeoffs. |
| Delivery feedback | Offer descriptive pace, fillers, answer length, pauses, and hedging feedback where evidence supports it. Use timed speech segments for pauses. Optional on-device camera feedback can describe framing, sustained gaze direction, and posture. Leave camera and delivery metrics out of coding pass decisions. |
| Report and retry | Review correctness, clarification, approach, complexity, testing, code clarity, and spoken reasoning separately. Cite a transcript turn, code version, or test result for each observation. Mark insufficient evidence explicitly. Show one next exercise and compare the original and retried attempt. |
| Progression | In a structured loop, publish the round rubric and pass threshold before starting. Passing unlocks the next round. A missed threshold gives an explanation and retry. Quick practice allows direct access to individual exercises. |
| Accounts and history | Sign in, save selected resume and session details, resume a plan, review prior reports, compare recurring weaknesses, and delete stored sessions. Local history can support the demo on one device. |

## What the two builders own

**Frontend owner** owns the Next.js/TypeScript scaffold, Tailwind, deployment, browser audio and permissions, Monaco, navigation, coaching display, results, reports, and later plan/history screens. Use Recharts only when comparing scores across rounds is useful.

**Backend owner** owns server routes, Gemini token issuance, interviewer instructions, Judge0 execution, curated problems and tests, feedback generation, planning, and later Supabase storage and access controls. Keep permanent credentials server-side. Run submitted code through the isolated execution service.

**Together** own the shared types, a sample session, and the deployed walkthrough. Use one repository and one Vercel project. Create one issue and branch per task. Each issue names its owner, inputs, dependencies, and observable completion check. Merge a working slice before starting the next one.

## Shared contracts to commit first

Use the following as initial application contracts. Provider-specific fields belong inside adapters. All examples below are abbreviated. All responses that depend on a session carry its ID. Give transcript turns timestamps and IDs. Increment the code version on edit. Use a common error shape containing code, message, and retryable.

| Operation | Request example | Response example or failure |
|---|---|---|
| Start session | problemId=pairs, language=python, mode=guided | sessionId=s1, phase=clarify, starterCode; unknown problem |
| Voice token | sessionId=s1 | token, expiresAt; provider unavailable |
| Run code | sessionId=s1, problemId=pairs, version=3, language=python, source | version=3, status=completed, cases with expected/actual/pass; execution unavailable |
| Interview checkpoint | sessionId=s1, version=3, source, recentTurns, lastRun, phase | eventId=q1, version=3, followUp, evidenceIds, or no prompt; stale version |
| Finish/grade | sessionId=s1, roundType, transcript, snapshots, runs | reportId, findings with evidenceIds, nextExercise; incomplete evidence marked per finding |
| Retry | sessionId=s1, priorAttemptId, exerciseId | newAttemptId linked to original; unknown attempt |
| Plan | candidateContext, role, company | planId, rounds, questions per round, rationale, source links or template label; invalid input |
| Advance | planId, roundId, reportId | passed, nextRoundId or retryRoundId; ungraded round |
| History | signed-in user, optional sessionId | owned session summaries or detail; unauthorized |

For the first demo, keep session state in the browser and pass relevant evidence to server routes. After a test run or a meaningful edit, send a versioned snapshot to the interviewer context. If a separate text model proposes a follow-up, pass it into the active voice session at a turn boundary. Deduplicate by event ID and discard stale observations. A text chip alone does not complete the spoken follow-up milestone.

## Build order and handoffs

| Stage | Frontend owner | Backend owner | Move on when |
|---|---|---|---|
| 0 • Shared foundation | Create or reuse repo, invite teammate, scaffold app, deploy shell | With frontend, commit contract examples, sample problem and sample responses; document environment variable names | Both can clone, run, and open the same deployed version |
| 1 • Prove dependencies | Make a minimal browser microphone and playback screen | Mint a short-lived Gemini Live token; submit Python to Judge0 and check actual access and limits | Hear a real spoken reply and see one passing and one failing executed case |
| 2 • Coding room | Render prompt, Monaco, run button, and test results | Supply a curated Python problem, test harness, run route and error handling | Both laptops can edit, run, and correct a solution |
| 3 • Voice with code | Connect transcript, snapshot, and test state; handle mute/reconnect | Build interviewer instructions and context delivery; coordinate follow-up timing | Change the code and hear a question that reflects that change |
| 4 • Report and retry | Show findings, linked evidence, retry and comparison | Generate a structured report from real session evidence; retain both attempts | A student can explain a decision again and see what improved |
| 5 • Submission | Rehearse deployed flow and record backup demo | Verify setup instructions, service failure handling, and project description | Working link, repo, and required submission materials are ready |
| 6 • Tailoring | Build job/resume setup, editable extraction, plan preview | Parse inputs, implement role templates and sourced company research, generate questions | Two different roles yield explainably different practice plans |
| 7 • More rounds | Add round navigation, design workspace, readiness and retry UI | Add behavioral, fundamentals, design rubrics and progression rules | Each enabled round runs through questions, feedback, and advancement |
| 8 • Breadth and history | Add Java selector, library, sign-in, history and progress views | Verify Java runner, extend problem set, save user-owned sessions and reports | A returning student can retrieve their own sessions and run each advertised language |
| 9 • Optional coaching and uploads | Camera opt-in, delivery indicators, screenshot input | Add timed speech metrics, validate upload extraction, integrate optional camera observations | Coding still works with camera off and quiet thinking does not lower the coding score |

## Time and fallback decisions

At kickoff, one person confirms the cutoff while the other opens the shared repo. Aim to spend the first quarter of available time on foundation and dependency checks, the middle half on the coding room, spoken follow-up, and report, and the final quarter on deployment checks, submission, and rehearsal. These are planning targets. Stage 5 takes priority as the cutoff approaches. Attempt later stages once you have a submission you can demonstrate.

Test the actual account and model access before depending on any free tier. Use an available text model for reports if the proposed Pro model is unavailable. If voice is down, keep a labeled text practice path. If execution is down, preserve the code and show that tests could not run. For a live-service outage during judging, use a clearly labeled recording of a successful session.

## First AI prompts

**Frontend issue 1**

> Inspect the existing repo. Set up the shared Next.js and TypeScript app if needed. Build a quick-practice page for one Python problem with a prompt, editor, Run button, and results panel. Use labeled development fixtures matching the agreed contract until execution is connected. Include loading and error states. Document how the teammate runs it. Finish by verifying the page and reporting which data is still mocked.

**Backend issue 1**

> In the shared repo, write a sample Python problem with one normal case and one edge case. Implement the server-side execution adapter and run-code route using the agreed contract. Preserve the code version in results. Verify with a correct solution, an incorrect solution, and a provider error. Record the actual verification results. Keep credentials in server environment variables.

**Backend issue 2 and frontend handoff**

> Implement short-lived voice token issuance for the available Gemini Live model. Document the response shape and one failure example. Coordinate with the frontend owner to complete a real microphone-to-spoken-reply exchange on the deployed page.

For later issues, give the AI one row of the build table, one owner's task, actual contract examples, and the completion check. Ask it to list changed files, real checks performed, and any remaining fixtures.

## Demo rehearsal

Choose a duplicate-detection problem. Start with a correct nested-loop implementation and explain that it runs in linear time. Run the cases. The interviewer should be able to ask how many comparisons occur when every element is different. Explain the quadratic worst case, then discuss a set-based alternative and its memory cost. Finish the session and open the report at the original claim and code version. Retry the explanation. Repeat with a different implementation to verify the follow-up actually depends on the code.
