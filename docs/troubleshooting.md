# Troubleshooting

Find the symptom, apply the fix. Every row was hit while building this repo; the fixes are already in the workflows here.

## Setup

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Environment variable validation failed` | Claude credential missing, empty, or stored as an environment secret the job does not declare | Store it as a repository or organization secret. Set it from your own terminal (`gh secret set` in a non-interactive shell stores an empty value), or pipe it: `pbpaste \| gh secret set ...` |
| `Claude Code is not installed on this repository` | Claude GitHub App not installed on this repository | Add the repository to the App's installation |
| Publish job fails creating the token | Auto-fix App not installed on the repository, or wrong Client ID / key | Check the App's installations, `AUTOFIX_APP_CLIENT_ID`, and that the secret holds the App's `.pem` |
| Review never runs on Auto-fix draft PRs | `allowed_bots` in `claude-code-review.yml` does not name the Auto-fix App | Set it to the App's slug |
| `Workflow initiated by non-human actor` | A bot triggered a Claude workflow | Expected for bot follow-up pushes (skipped by design); otherwise add the bot to `allowed_bots` |

## Auto-fix

| Symptom | Cause | Fix |
|---------|-------|-----|
| No run when a label is added | Label added by a bot using `GITHUB_TOKEN` (such events start no workflows), or a label other than `incident` / `claude` | Add the label as a person or through an App/user token |
| `needs-human`: "already had 3 Auto-fix attempts" | Runaway guard | A person takes over; it is not retried automatically |
| `autofix-failed`: "Tests also pass without the fix" | No test proves the bug | Add a failing test to the issue description or the repo, then re-label |
| `autofix-failed`: "Changed files outside src/" | The fix needs files outside the allowed paths | Widen the path rule in the `Verify the change` step if that is intended |
| `needs-human` with questions | The request is ambiguous | Answer in the issue comments, then remove and re-add the label |
| Two PRs for one bug | Two signals for the same root cause arrived together | The later PR carries `possible-duplicate`; close one |
| Agent changes nothing useful, run is green | Denied tool calls: the agent's command did not match `--allowedTools` (rules match by literal prefix) | Keep the allowlist prefixes broad (`Bash(git checkout:*)`, not `Bash(git checkout -b:*)`) |

## `@claude` and code review

| Symptom | Cause | Fix |
|---------|-------|-----|
| Commits pushed by `@claude` do not trigger CI | `actions/checkout@v6+` keeps `GITHUB_TOKEN` in a place the action cannot replace (claude-code-action#1721) | Keep `checkout@v5` in `claude.yml`. `persist-credentials: false` is not a fix: it breaks `@claude` on private repositories (#1711) |
| A second `@claude` request disappears | Workflow-level concurrency let Claude's own progress comment replace the queued request | Keep concurrency at job level, as in `claude.yml` |
| `@claude` pushed its fix but the run shows failure | `--max-turns` too low | Raise it (40 here) |
| `@claude` says it did not run tests | Test commands not in `--allowedTools` | Add the project's test and lint commands |
| Built-in `/code-review` finds nothing | `fetch-depth: 1` leaves no base commit to diff against | `fetch-depth: 2` in the review checkout |
| Review findings only in the log | The built-in skill's `--comment` does not post from CI | The prompt requests `mcp__github_inline_comment__create_inline_comment`, which is in `--allowedTools` |
| Review comments rely on a rule too literally (false positives) | A broad rule in `CLAUDE.md` | Scope each rule to where it applies |
| No CI at all on a PR | GitHub skips `pull_request` workflows while a PR has merge conflicts | Resolve the conflict |

## Debugging a run

Add `show_full_output: true` to the `claude-code-action` step to print the agent's session (tool calls, denials, final message) in the log, and remove it afterwards: it writes the agent's output into the run log.
