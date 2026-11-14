# Working on Interviewlenz

Read this file, CURRENT.md, README.md, and INTERVIEWLENZ_PLAN.md before editing. CURRENT.md records the team's latest handoff. The full plan describes the intended product over time. Its sample prompts become actionable only when the corresponding task is active.

1. Identify the task ID assigned in the user's prompt or linked issue. If the user requests a new scope explicitly, follow it and record the decision. If they only ask for context, summarize the current state. If asked to implement without an assignment, identify the open tasks and ask which one to take.
2. On a fork, compare the checkout with the parent repository's main branch before starting. Sync the fork with the parent or bring the latest changes into the working branch without overwriting local work. Use one branch per task. Parent repository: https://github.com/Ismail-Abu/interviewlenz
3. Inspect the actual files and recent changes. If the handoff and implementation disagree, describe the discrepancy before relying on either. Never infer that a planned integration is live.
4. Implement only the assigned task. Use its listed inputs, outputs, owned files, and completion check. Coordinate shared contract changes with the other owner.
5. At handoff, record the task ID, files changed, check performed and outcome, and outstanding dependencies. Update only your task entry in CURRENT.md. Stop at its completion check. The team opens the next task explicitly after reviewing the result.
   During the hackathon, CURRENT.md's schedule overrides this step: advance to your next task as soon as its completion check passes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
