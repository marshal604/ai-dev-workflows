# ai-dev-workflows

**English** | [繁體中文](README.zh-TW.md)

Drop-in GitHub Actions workflows for AI-assisted development, verified end to end on this repo:

- **AI code review** on every PR, and `@claude` comments that apply fixes.
- **Auto-fix**: an issue labeled `incident` or `claude` (opened by a person, a monitor, or failing CI on `main`) becomes a verified **draft PR**. The agent edits with a read-only token; the workflow verifies the change, publishes it with its own GitHub App, and reports the outcome on the issue.
- **Branch protection** keeps every merge with a human: PR required, CI green, one approval.

To adopt this in another repository, follow **Adopt in a repository** below step by step. Read [docs/how-it-works.md](docs/how-it-works.md) for the design and its limits, and [docs/troubleshooting.md](docs/troubleshooting.md) when a step does not produce its expected result.

## What is in this repo

| Path | Role |
|------|------|
| `.github/workflows/claude-code-review.yml` | AI review on PR open / update, inline comments |
| `.github/workflows/claude.yml` | `@claude` in an issue or PR comment: conversational changes, pushes to the PR branch |
| `.github/workflows/autofix.yml` | Auto-fix: triage → agent (read-only) → verify → publish draft PR → report |
| `.github/workflows/ci-incident.yml` | Opens an `incident` issue when CI fails on `main` and calls `autofix.yml`; closes it when `main` is green again |
| `.github/workflows/daily-digest.yml` | Weekday Slack digest of work waiting on a person; doubles as a heartbeat |
| `.github/workflows/ci.yml` | The project's CI; the required check and the safety net for every agent change |
| `.github/dependabot.yml` | Weekly, grouped upgrade PR for the SHA-pinned actions, releases at least a week old |
| `.github/ISSUE_TEMPLATE/incident.yml` | Issue form for bug reports Auto-fix can work from |
| `CLAUDE.md` | **Template**: the sample project's conventions that review and fixes follow. Rewrite it for each project |
| `src/`, `scripts/simulate-incident.ts` | Sample TypeScript app and a script that turns a real error into an `incident` issue |

## Adopt in a repository

Work through the steps in order. Each step ends with a check; do not start the next step until it passes.

### 1. Copy the files

Copy `.github/workflows/`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/incident.yml` and `CLAUDE.md` into the target repository. Every action is pinned to a full commit SHA (version in the trailing comment), so nothing changes under you; upgrades arrive only as Dependabot PRs that go through CI and review. If the target repository already has a `dependabot.yml`, merge the `github-actions` entry into it.

**Done when** all six workflow files, `dependabot.yml` and the issue form exist in the target repository.

### 2. Adapt the files to the project

Change exactly these places; everything else is project-independent.

| File | Key | Change it to |
|------|-----|--------------|
| `ci.yml` | `jobs.test.steps` | The project's install, build, lint and test commands. Keep the job id `test` (branch protection requires it) or update step 5 to the new id |
| `ci-incident.yml` | `on.workflow_run.workflows: [CI]` | The `name:` of the project's CI workflow |
| `autofix.yml` | `jobs.fix.steps`: `setup-node` and `npm ci` | The project's toolchain setup and install command |
| `autofix.yml` | `--allowedTools` in `jobs.fix` | Replace `npm test` / `npm run typecheck` / `node --test` with the project's test and type-check commands |
| `autofix.yml` | `Verify the change` step | `grep -vE '^src/'`: the directories the agent may change. `\.test\.ts$`: the test file pattern. `npm test` / `npm run typecheck`: the project's commands |
| `autofix.yml` | prompt in `jobs.fix` | `Fix the root cause in src/` and the `npm` commands: same paths and commands as above |
| `claude.yml` | `--allowedTools` | The project's test and lint commands, so `@claude` can verify its own changes |
| `claude-code-review.yml` | `allowed_bots` | The slug of the GitHub App created in step 3 |
| `CLAUDE.md` | whole file | The project's conventions, scoped precisely (a broad rule produces false-positive review comments). Keep the "Fixing bugs and incidents" section: it is the scope rule Auto-fix depends on |

**Done when** every row above is either changed or confirmed correct for the project, and `ci.yml` passes on a branch of the target repository.

### 3. Create the GitHub Apps and credentials

1. Install the **Claude GitHub App** on the repository: https://github.com/apps/claude
2. Create the **Auto-fix GitHub App** (it publishes draft PRs; pushes made with it trigger CI, unlike `GITHUB_TOKEN`). This URL pre-fills it; change `name` to something unique:
   `https://github.com/settings/apps/new?name=<org>-autofix&url=<repo url>&public=false&webhook_active=false&contents=write&issues=write&pull_requests=write`
   For an organization, use `https://github.com/organizations/<org>/settings/apps/new?...` with the same parameters.
3. On the App page, note the **Client ID**, generate a **private key** (`.pem`), and install the App on the target repository only.
4. Store the credentials:
   ```bash
   gh variable set AUTOFIX_APP_CLIENT_ID --repo <owner>/<repo> --body "<client id>"
   gh secret set AUTOFIX_APP_PRIVATE_KEY --repo <owner>/<repo> < path/to/key.pem
   gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo <owner>/<repo>   # run in your own terminal; value from `claude setup-token`
   gh variable set AUTOFIX_REVIEWERS --repo <owner>/<repo> --body "<user or org/team>"   # who reviews Auto-fix PRs
   ```
   Draft PRs get no automatic review request (CODEOWNERS included), so `AUTOFIX_REVIEWERS` is how an Auto-fix PR gets an owner. A team (`org/team`) also needs the Auto-fix App's **Organization > Members: read** permission.
   For a team, replace the personal OAuth token with a Claude Console API key: set the secret `ANTHROPIC_API_KEY`, and in `claude.yml`, `claude-code-review.yml` and `autofix.yml` replace `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` with `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`; in `autofix.yml` also rename the `workflow_call` secret `CLAUDE_CODE_OAUTH_TOKEN` to `ANTHROPIC_API_KEY`.

**Done when** `gh variable list` shows `AUTOFIX_APP_CLIENT_ID`, `gh secret list` shows the private key and the Claude credential, and both Apps list the repository under their installations.

### 4. Create the labels

```bash
gh label create incident --repo <owner>/<repo> --color B60205 --description "Bug for Auto-fix"
gh label create claude --repo <owner>/<repo> --color 7057FF --description "Hand this issue to Auto-fix"
```

Adding either label to an issue is the go-ahead for Auto-fix. Only people with triage access or above can add labels; decide who that is.

**Done when** both labels exist.

### 5. Protect `main`

```bash
gh api -X PUT repos/<owner>/<repo>/branches/main/protection --input - <<'EOF'
{
  "required_status_checks": {"strict": false, "checks": [{"context": "test"}]},
  "enforce_admins": false,
  "required_pull_request_reviews": {"dismiss_stale_reviews": true, "required_approving_review_count": 1, "require_last_push_approval": true},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Use the CI job id from step 2 as the `context`. Do not add either App to a bypass list.

**Done when** `gh api repos/<owner>/<repo>/branches/main/protection` shows the required check, one required approval and `require_last_push_approval: true`.

### 6. Verify end to end

Run each check on the target repository and compare with the expected result.

| Check | How | Expected |
|-------|-----|----------|
| AI review | Open a PR with a small deliberate bug | Inline review comments within a few minutes |
| `@claude` | Comment `@claude fix the review comments` on that PR | Claude pushes a commit; CI runs on it |
| Auto-fix | Open an issue describing a reproducible bug (stack trace or failing input), then add the `incident` label | A draft PR opened by the Auto-fix App within a few minutes; an `autofix-pr` label and a comment on the issue; CI and review run on the PR |
| Unclear request | Open a vague issue ("make shipping cheaper"), add `claude` | No PR; a `needs-human` label and a comment listing what needs deciding |
| Merge gate | Try to merge the draft PR without an approval | Refused by branch protection |

**Done when** every row matches. If one does not, find the symptom in [docs/troubleshooting.md](docs/troubleshooting.md).

## Connecting a monitor

A monitor opens an `incident` issue through the GitHub API, using a token with only Issues write access:

```bash
curl -X POST https://api.github.com/repos/<owner>/<repo>/issues \
  -H "Authorization: Bearer <token>" -H "Accept: application/vnd.github+json" \
  -d '{"title":"TypeError: ...","body":"What happened, stack trace\n\n<!-- incident-fingerprint: <stable id> -->","labels":["incident"]}'
```

The fingerprint comment marks repeats of the same error. Have the monitor (or the small relay that turns its webhook into this request) first look for an open issue with the same fingerprint and comment on it instead, as `ci-incident.yml` does; otherwise every repeat opens an issue and starts an Auto-fix run that only closes it as a duplicate. `scripts/simulate-incident.ts` builds exactly this request from a real error. Connect a monitor only after the execution-environment hardening listed in [docs/how-it-works.md](docs/how-it-works.md#limits).

## Slack notifications

The workflows post to one Slack channel through an Incoming Webhook, and only at the moments that matter: a new incident, the points where a person must act, and one digest each weekday morning. Everything else stays on GitHub.

| Event | Slack | Who acts |
|---|---|---|
| New incident, after deduplication, first attempt only | "New incident" with source; for CI, the breaking commit and "Revert first" | Auto-fix starts; for CI, the pusher reverts |
| Repeat or duplicate of an open incident | Nothing | The workflow comments on the original |
| Draft PR opened for an incident | "Review needed" with root cause and PR link, mentioning `SLACK_REVIEW_MENTION` (default `SLACK_MENTION`) | `AUTOFIX_REVIEWERS` |
| Incident blocked, unreproduced or rejected by verification | "Needs a person" with the reason, mentioning `SLACK_MENTION` | The duty owner |
| Incident closed before its outcome (main recovered, resolved by hand) | Nothing; a CI recovery also closes the incident's Auto-fix PR | |
| `claude` request, whatever the outcome | Nothing; GitHub notifies the requester and requests review from `AUTOFIX_REVIEWERS` | The requester |
| Auto-fix itself failed (triage, publish, timeout, quota) | "Auto-fix itself failed" with the run log, mentioning `SLACK_TOOLING_MENTION` | Whoever maintains these workflows |
| Weekday 09:00 (Asia/Taipei; edit the cron in `daily-digest.yml`) | Digest: incidents with no owner and no PR, Auto-fix PRs open over a day, failed runs; "All clear" otherwise | The duty owner |
| Closures, retries, label changes, `@claude` progress | Nothing | |

The digest doubles as a heartbeat: a weekday without it means the webhook or Actions is broken. Messages name `owner/repo#N`, so several repositories can share a channel; set the secret and variables at organization level (`gh secret set --org`, `gh variable set --org`), with repository-level overrides where teams rotate separately. Outages, payments, auth, security and data loss still go to the monitor's own alerting and on-call; Auto-fix runs alongside it, not instead of it.

Setup: create a Slack app at https://api.slack.com/apps (Blank app, bot scope `incoming-webhook`, no events), turn on **Incoming Webhooks**, add a webhook for the channel. Create it from a shared or service account: a webhook stops working when the person who installed it leaves. Then:
```bash
gh secret set SLACK_WEBHOOK_URL --repo <owner>/<repo>    # run in your own terminal and paste the URL; never paste it into a chat
gh variable set SLACK_MENTION --repo <owner>/<repo> --body '<!subteam^GROUP_ID>'          # duty group (paid Slack), or '<@MEMBER_ID>'
gh variable set SLACK_TOOLING_MENTION --repo <owner>/<repo> --body '<@MEMBER_ID>'         # the workflow maintainer
gh variable set SLACK_REVIEW_MENTION --repo <owner>/<repo> --body '<@MEMBER_ID>'          # optional; only if reviewers differ from the duty owner
gh workflow run daily-digest.yml --repo <owner>/<repo>                                     # posts the first digest now
```
A member ID comes from Slack: profile, **...**, **Copy member ID**. Unset mentions post without a ping; without the secret nothing is posted. A message that cannot be delivered after retries turns the outcome run red; a failed "New incident" post never blocks the fix.

GitHub's own Slack app (`/github subscribe`) is not needed and is noisier: it posts a card for every labelled issue, duplicates included, and posts closures to the channel as well as the thread.

**Done when** the manual digest run posts, a test incident posts "New incident" then "Review needed" (or "Needs a person"), and a `claude` request posts nothing.

## Day-to-day operation

Team rules to agree on before the pilot:

- **One duty owner per week.** A handover changes two variables, `AUTOFIX_REVIEWERS` and `SLACK_MENTION` (or nothing, when both point at a rotating GitHub team and Slack user group). Review requests already sent stay with the previous owner, so hand open Auto-fix PRs over in person.
- **Acknowledge by assigning yourself** to the issue or PR, and react to the Slack message with `:eyes:` (taking it) and `:white_check_mark:` (done), so the channel shows who has what.
- **Work the daily queue** from the digest, or directly: [incidents with no owner and no PR](../../issues?q=is%3Aopen+label%3Aincident+no%3Aassignee+-label%3Aautofix-pr) (this includes incidents whose run never started or died) and [open Auto-fix PRs](../../pulls?q=is%3Aopen+head%3Aautofix%2F). Slack is the nudge; this queue is the record.
- **Broken main: revert first.** Whoever pushed the breaking commit reverts it (the duty owner if they are unavailable); the Auto-fix PR is the follow-up, not the mitigation. When main goes green, the CI issue and its Auto-fix PR close themselves.

Mechanics:

- An `incident` / `claude` label starts Auto-fix; the outcome lands on the issue as one comment plus one label: `autofix-pr`, `needs-human` or `autofix-failed`.
- To retry after answering a question in the comments, remove and re-add the `incident` / `claude` label (not `needs-human`).
- A CI issue closes itself when CI is green again on the current main, so the next break opens a fresh issue.
- Each issue gets at most 3 Auto-fix attempts; after that it stays with a person.
- To stop everything: `gh workflow disable autofix.yml` (likewise `ci-incident.yml`, `claude.yml`, `daily-digest.yml`), then cancel running runs. Uninstalling the Auto-fix App or deleting its private key stops all publishing at once.
