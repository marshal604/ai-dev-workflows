# ai-dev-workflows

**English** | [繁體中文](README.zh-TW.md)

AI-assisted development workflows on GitHub Actions, verified end to end:

- **AI code review** on every PR, plus `@claude` to apply fixes on request.
- **Auto-fix**: an issue (from a monitor, a failing CI run on `main`, or a person) becomes a verified **draft PR**, reviewed by AI and gated by CI, with a human deciding what merges. The agent only investigates and edits files; the workflow verifies, publishes and reports.

`main` is protected: every change needs a PR, a green CI run and a human approval, so nothing an agent produces can merge on its own.

## Flow

1. **Trigger**: an issue gets the `incident` label (a bug, e.g. opened by a monitor through the GitHub API) or the `claude` label (any request). `ci-incident.yml` opens an `incident` issue when CI fails on `main`. Adding the label is the human go-ahead.
2. **Triage** (`autofix.yml`): duplicates of an open incident are closed; an issue that already has an open Auto-fix PR is skipped, unless that PR conflicts with `main`, in which case it is closed and regenerated.
3. **Agent**: Claude runs with a **read-only token**, reads the issue and its comments, fixes only what the issue describes, and returns a structured result (`fixed`, `unreproduced`, `blocked`, `duplicate`) with the root cause and anything else it noticed but did not change.
4. **Verify**: the workflow rejects changes outside `src/`, requires the tests to **fail on the original code and pass with the fix**, and runs typecheck. The agent's claims are never trusted.
5. **Publish**: a separate job uses this repo's own GitHub App token to push `autofix/issue-N` and open a **draft PR**. Pushes made with it trigger CI and AI review. A PR touching the same files as another Auto-fix PR is labeled `possible-duplicate`.
6. **Report**: every outcome ends with one comment and one label on the issue (`autofix-pr`, `needs-human`, `autofix-failed`). Nothing fails silently.

Separately, `claude-code-review.yml` reviews every PR (including Auto-fix drafts) with Claude Code's built-in `/code-review high`, and `claude.yml` lets people ask `@claude` for changes on any issue or PR.

## Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `autofix.yml` | `incident` / `claude` label, or called by `ci-incident.yml` | Triage, agent, verify, publish, report |
| `ci-incident.yml` | CI fails on `main` | Opens one `incident` issue per broken workflow and calls Auto-fix |
| `claude-code-review.yml` | PR opened / updated | AI review as inline comments |
| `claude.yml` | `@claude` in a comment | Conversational changes on issues and PRs |
| `ci.yml` | PRs and `main` | Typecheck and tests; the safety net for every agent change |

## Code review

`claude-code-review.yml` runs Claude Code's built-in `/code-review high` and posts findings as inline PR comments. On the same PR with 4 planted bugs it found 4 of 4 (plus a race condition), while the official `code-review` plugin found 1 of 4 and sometimes ended after 8 seconds with no comments, because the model skipped the plugin's multi-agent pipeline in CI. The built-in review leans toward recall and occasionally posts a speculative finding. A green review check means the review ran, not that the PR is approved.

## Setup

1. Install the [Claude GitHub App](https://github.com/apps/claude) and store `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) as a repository secret.
2. Create your own GitHub App with Contents, Issues and Pull requests set to read and write, and install it on the repository.
3. Store its Client ID as the variable `AUTOFIX_APP_CLIENT_ID` and its private key as the secret `AUTOFIX_APP_PRIVATE_KEY`:
   ```bash
   gh variable set AUTOFIX_APP_CLIENT_ID --repo <owner>/<repo> --body "<client id>"
   gh secret set AUTOFIX_APP_PRIVATE_KEY --repo <owner>/<repo> < path/to/key.pem
   ```
4. Put the App's name in `allowed_bots` in `claude-code-review.yml`.

## Connecting a monitor

A monitor opens an issue through the GitHub API with a token that only has Issues write access:

```bash
curl -X POST https://api.github.com/repos/<owner>/<repo>/issues \
  -H "Authorization: Bearer <token>" -H "Accept: application/vnd.github+json" \
  -d '{"title":"TypeError: ...","body":"What happened, stack trace\n\n<!-- incident-fingerprint: <stable id> -->","labels":["incident"]}'
```

The optional fingerprint comment groups repeats of the same error. `scripts/simulate-incident.ts` reproduces a real error locally and prints exactly this request. Free option: PostHog error tracking can send webhooks on its free plan; Sentry's free plan only sends email alerts.

## Pitfalls found while testing

| Symptom | Cause | Fix (applied here) |
|---------|-------|--------------------|
| Run "succeeded" with no PR and no comment | The agent ran git itself; `git checkout -q -b` did not match the allowlist prefix and it gave up | The agent no longer runs git; the workflow publishes and always reports |
| The agent implemented things the issue did not ask for | A `CLAUDE.md` rule said to follow doc comments | Scope rule: change only what the issue describes, report the rest |
| PR claimed tests failed before the fix when they were never run | Test results were self-reported | The workflow runs the tests itself |
| The agent could not see the issue body | `gh issue view --comments` prints comments only | `gh issue view N --json title,body,comments` |
| Duplicate-PR check never matched | `gh pr list --search "head:autofix/"` does no prefix match | The workflow lists open Auto-fix PRs into the prompt |
| Publish failed after the PR was created | A `[[ ]] &&` loop ended the step under `set -euo pipefail` | `if ... then ... fi` |
| Later steps cannot use the Claude App token | claude-code-action revokes it when the action ends | Publish with this repo's own GitHub App |
| Built-in `/code-review` finds nothing | It reads the diff from local git; `fetch-depth: 1` leaves no base to compare | `fetch-depth: 2` in the review checkout |
| Review findings appear only in the log | The built-in skill's `--comment` does not post from CI | The prompt asks for `mcp__github_inline_comment__create_inline_comment`, listed in `--allowedTools` |
| Commits pushed by `@claude` do not trigger CI | `actions/checkout@v6+` keeps `GITHUB_TOKEN` where the action cannot replace it (claude-code-action#1721) | `claude.yml` pins `checkout@v5`; do not use `persist-credentials: false` (breaks `@claude` on private repos, #1711) |
| A second `@claude` request silently disappears | A workflow-level concurrency group let Claude's own progress comment replace the queued request | Concurrency at job level, so skipped runs never join the queue |
| `@claude` pushed its fix but the run shows failure | `--max-turns` too low | `--max-turns 40` |
| No CI on a PR at all | GitHub does not run `pull_request` workflows while the PR has merge conflicts | Resolve the conflict first |

## Known limits

- The same bug reported by two sources at nearly the same time can produce two PRs; the second is labeled `possible-duplicate`.
- Verification needs tests that can prove a fix; with low coverage the agent reports `blocked` more often.
- Tested on a small TypeScript project with up to about 7 concurrent agent runs.
