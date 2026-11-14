# Interviewlenz • product and build plan

## Starting point

The shared repo is ready and contains documentation. For implementation, follow the owner assignments, checkpoint times, acceptance checks, and freeze rule in [CURRENT.md](CURRENT.md).

**Audience.** CS students applying for internships and new-grad software roles who need practice explaining decisions while coding.

**First complete demo.** A student opens a Python problem, explains an approach aloud, writes and runs code, hears a question about that implementation, and receives feedback linked to what they actually said and wrote. They retry the explanation and compare both attempts.

## Full product vision (only the active task table is in scope this weekend)

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

## Ownership and build order

| Stage | Hamza • frontend | Ismail • backend |
|---|---|---|
| 1 • Python room | Scaffold and Monaco page with labeled fixture results | Define the run-code contract and implement the Pyodide browser runner with 3–4 cases |
| 2 • Integration and voice | Replace fixtures with Pyodide results, connect microphone and playback, capture transcript | Issue ephemeral tokens from a server route |
| 3 • Code-aware conversation | Feed each completed Run into the active Live session | Define the text payload and interviewer instructions |
| 4 • Feedback | Show report evidence and retry | Generate findings with one Flash call per finished attempt |
| Final • Submission | Deploy and record backup video | Prepare Devpost and verify links; rehearse together |

## Shared contracts

Keep demo session state in browser memory. Use the same problem and function signature in F1 fixtures and B1 tests. The problem asks whether a list of integers contains a duplicate. B1 publishes the definitive examples in docs/RUN_CODE.md.

| Operation | Input | Output |
|---|---|---|
| Browser Run | Problem ID, submitted Python source, code version | Run ID, version, and per-case expected, actual, and pass fields. Syntax and runner failures use the documented error shape. |
| Voice token | Browser requests access from the app server | A short-lived token for the Live connection |
| Run context | After each Run send text containing the submitted source, version, and latest results (including errors) directly to the active Live session | Live uses that context and the ongoing conversation to ask a spoken follow-up |
| Finish | Transcript with turn IDs, snapshots with versions, runs with IDs | One Gemini Flash response with findings linked to turn IDs, code versions, or run IDs |
| Retry | Student selects Retry | Fresh attempt on the same problem |

The separate text-model checkpoint, question deduplication, and stale-version filtering are post-hackathon work. Code versions in the demo identify the implementation behind each result and report citation.

## Demo rehearsal

Choose a duplicate-detection problem. Start with a correct nested-loop implementation and explain that it runs in linear time. Run the cases. The interviewer should be able to ask how many comparisons occur when every element is different. Explain the quadratic worst case, then discuss a set-based alternative and its memory cost. Finish the session and open the report at the original claim and code version. Retry the explanation. Repeat with a different implementation to verify the follow-up actually depends on the code.
