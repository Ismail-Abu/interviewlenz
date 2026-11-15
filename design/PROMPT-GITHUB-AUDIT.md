# Prompt — audit the whole GitHub state

Paste everything below the line into a fresh chat with repo and `gh` access.

---

You are auditing the GitHub state of `Ismail-Abu/interviewlenz` — a two-person
hackathon repo (Ismail: backend / `lib`, `app/api`; Hamza: frontend
`components/**`, `app/**`) that has accumulated many branches and stacked pull
requests. Several PRs were merged indirectly through integration branches rather
than on their own, so **the PR list does not reflect what is actually shipped.**

Your job is to establish the truth and report it. **Do not merge, close, delete,
push, or change any setting unless the user explicitly tells you to.** Read-only
until asked.

Read `AGENTS.md` and `CURRENT.md` first for ownership rules and the handoff log.

## 1. Ground truth: what does `main` actually contain?

```bash
git fetch --all --prune
git log --oneline --first-parent origin/main | head -40
git rev-list --count origin/main
```

List the files that exist on `main` (`git ls-tree -r --name-only origin/main`
— note `ls-tree` **without `-r` lists only directories**, which silently
produces wrong counts).

## 2. Which open PRs are already shipped?

This is the main event. For **every** open PR, test whether its head is already
an ancestor of `main`, and whether it differs from `main` in any file other
than `CURRENT.md`:

```bash
git merge-base --is-ancestor origin/<head> origin/main && echo CONTAINED
git diff --name-only origin/main...origin/<head> | grep -v '^CURRENT.md$'
```

A PR that is **contained in `main`** and has **no non-`CURRENT.md` diff** is
finished work that was never closed. Report those separately from live ones.

Beware stacked PRs: a chain like `b8 → b7 → f-code-sync` looks like a pending
merge train while every link is already in `main`. Also check each open PR's
**base branch** — a PR whose base is itself a dead branch cannot reach `main`
even if merged.

## 3. Hidden conflicts between "clean" PRs

GitHub reports each PR as MERGEABLE by comparing it to `main` **alone**, so two
PRs that both edit the same file each show CLEAN while being mutually
conflicting. Find these yourself:

```bash
# overlapping files between two PRs
comm -12 <(git diff --name-only origin/main...origin/<a> | sort) \
         <(git diff --name-only origin/main...origin/<b> | sort)

# does it actually conflict?
git switch -c tmp-collide origin/<a>
git merge --no-commit --no-ff origin/<b>; git diff --name-only --diff-filter=U
git merge --abort; git switch -; git branch -D tmp-collide
```

Report, for each overlap, which file and whether the content truly conflicts or
merges cleanly. Pay special attention to `app/globals.css`, `lib/contract.ts`
and `CURRENT.md` — the three files multiple people touch.

## 4. Branch hygiene

List every remote branch with its last commit date and author. Classify each as
**merged into main**, **live work**, or **stale**. Call out branches the team
asked to preserve, and never propose deleting one without saying what would be
lost.

## 5. CI reality check

The repo has a PR workflow at `.github/workflows/pr.yml` running `npm ci`,
lint, `npm run test:ci` and a production build.

- Compare the checks listed in `scripts/ci-checks.mjs` against the `.mjs` files
  actually in `dev/`. Report any check that exists but **is not run by CI**, and
  say for each whether it is excluded on purpose or was simply missed.
- Inspect any unlisted one before judging it — some need a real API key, a
  browser, a running server, or an absolute path to someone's local machine, and
  those are correctly excluded.
- Confirm the workflow runs on `pull_request` only, and state plainly whether
  direct pushes to `main` are therefore unguarded.

## 6. Secrets and visibility

```bash
for pat in 'AIza[0-9A-Za-z_-]{30,}' 'sk-[A-Za-z0-9]{20,}' \
           'gh[pousr]_[A-Za-z0-9]{20,}' 'BEGIN [A-Z ]*PRIVATE KEY'; do
  git log --all --oneline -G"$pat"
done
git log --all --diff-filter=A --name-only --pretty=format: | sort -u | grep -iE '(^|/)\.env'
```

Report counts and commit SHAs only — **never print a secret value.** Also report
current repo visibility, and what would become public if it were flipped
(all branches, all PR comments, the full history).

## 7. What to produce

A single report with:

1. **`main` in one line** — SHA, commit count, what it ships.
2. **PR table** — number, head → base, author, and one of: *merged*,
   *shipped-but-open*, *live*, *orphaned base*.
3. **Conflicts** — every pair of open PRs that will collide, the file, and which
   should merge first.
4. **CI gaps** — checks not covered, and whether that is deliberate.
5. **Risks** — anything that would bite at merge or release time.
6. **A recommended order of operations**, as a numbered list the user can
   approve step by step.

State what you verified by command versus what you inferred. If the handoff in
`CURRENT.md` disagrees with the repo, describe the discrepancy and trust the
repo. Do not take any action until the user picks from your recommendations.
