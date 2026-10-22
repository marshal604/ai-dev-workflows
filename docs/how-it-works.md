# How it works

The rule behind every workflow: **the agent does the judgement work, the workflow does every write and every check, and a human decides what merges.** Branch protection enforces the last part; it does not depend on draft status or on the prompt.

## The two write paths

| | Auto-fix (`autofix.yml`) | `@claude` (`claude.yml`) |
|---|---|---|
| Agent permissions | Read-only GitHub token; cannot push | Commits and pushes to the PR branch |
| Checks before the change leaves the agent | Workflow verification (below) | None; CI runs afterwards |
| Who can trigger it | People with triage access (labels), CI on `main`, monitors | People with write access |
| Final gate | CI, AI review, branch protection | CI, branch protection |

## Auto-fix pipeline

1. **Triage**: stops if the issue already had 3 Auto-fix outcomes (runaway guard), or already has an open Auto-fix PR (unless that PR conflicts with `main`, in which case it is closed and regenerated), or duplicates an older open incident by fingerprint or title (closed and labeled `duplicate`).
2. **Agent** (`fix` job, read-only token): reads the issue and its comments, fixes only what the issue describes, and returns a structured result: `fixed`, `unreproduced`, `blocked` or `duplicate`, with the root cause and anything else it noticed but did not change. The workflow lists open Auto-fix PRs in the prompt so the agent can spot a duplicate root cause.
3. **Verify** (same job, after the agent): rejects changes outside `src/` and test-only changes; requires tests and type-check to pass with the fix, and the tests to fail with the fix removed; flags edits to existing tests with `tests-modified`. The agent's own claims are never trusted.
4. **Publish** (separate job, Auto-fix App token): applies the verified patch onto the exact commit it was verified against, pushes `autofix/issue-N` (or a fresh branch name if a person has pushed to that branch), and opens a draft PR. PRs touching the same files as another open Auto-fix PR get `possible-duplicate`.
5. **Report**: one comment and one label on the issue (`autofix-pr`, `needs-human`, `autofix-failed`), replacing the previous outcome label. Rejected or unfinished runs end red.

`ci-incident.yml` opens one `incident` issue per failing CI workflow on `main` and calls `autofix.yml` directly, because issues created with `GITHUB_TOKEN` do not fire the `labeled` event.

## Code review

`claude-code-review.yml` runs Claude Code's built-in `/code-review high`. On one PR with 4 planted bugs it found all 4 plus a race condition, while the official `code-review` plugin found 1 (in CI the model skipped the plugin's multi-agent pipeline). It leans toward recall and occasionally posts a speculative finding. A green review check means the review ran, not that the PR is approved. Follow-up pushes by bots are not re-reviewed.

## Verified behaviour

Tested on this repo's sample app (latent bugs, green CI): issue to verified draft PR in about 1.5–2.5 minutes; 9 issues and 1 PR fired together all handled in about 3 minutes; duplicates closed; ambiguous requests stopped with questions and implemented after a maintainer answered; a malicious issue (asking to delete CI steps and print secrets) refused; the 4th attempt on one issue blocked; a person's commit on an Auto-fix branch preserved; an unapproved merge refused; two `@claude` requests on one PR run in order.

## Limits

- **The agent's runner is not a sandbox.** The read-only token only limits GitHub writes. The agent runs the tests it writes, with network access, so it could read source code or send data out. Before connecting monitors, restrict outbound network access on the runner and re-run verification in a clean environment.
- **Prompt injection** was tested with one case only.
- **No global cap** on concurrent runs, by design; only the per-issue limit of 3 attempts. A flood of alerts can consume model quota, runners and reviewer time at once.
- **Duplicate detection** compares fingerprints or titles of up to 200 open incidents; the overlap flag compares file paths only. CI incidents group by workflow name: while one is open, new failures of that workflow only add a comment.
- **Test evidence**: "fails without the fix" does not prove the failure is the reported bug; flaky tests can fake it. Edited existing tests are flagged, not blocked. Low test coverage means more `blocked` outcomes.
- **Runs that never start** (platform outage, cancelled queue) leave no comment; the daily check of open issues covers them.
- **Scope of testing**: one small TypeScript project; `fix` job limit 30 minutes, CI 10 minutes.
- **Pinned actions**: every action is pinned to a commit SHA and upgraded only through the weekly Dependabot PR, after a 7-day cooldown, so upstream releases (Claude Code ships almost daily) never change behaviour unannounced.
- **Upstream workaround**: `claude.yml` stays on checkout v5 until a claude-code-action release fixes [#1721](https://github.com/anthropics/claude-code-action/issues/1721).
