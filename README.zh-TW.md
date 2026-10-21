# ai-dev-workflows

[English](README.md) | **繁體中文**

在 GitHub Actions 上實作並端到端驗證過的 AI 開發流程：

- **AI code review**：每個 PR 自動 review，也可以留言 `@claude` 要求修改。
- **Auto-fix**：issue（來自監控、main 的 CI 失敗，或人）會變成一個經過驗證的 **draft PR**，由 AI review、CI 把關，最後由人決定要不要 merge。AI 只負責調查和改檔案，驗證、交付和回報都由 workflow 執行。

`main` 開啟了保護：任何修改都要走 PR、CI 通過、一位人 approve，所以 AI 產出的東西不可能自己 merge。

## 流程

1. **觸發**：issue 被貼上 `incident` 標籤（bug，例如監控透過 GitHub API 開的）或 `claude` 標籤（任何需求）。main 的 CI 失敗時，`ci-incident.yml` 會開一個 `incident` issue。貼標籤就代表人同意交給 AI。
2. **前置檢查**（`autofix.yml`）：跟開著的 incident 重複就關閉；已經有開著的 Auto-fix PR 就跳過，但如果那個 PR 跟 main 衝突，就關掉它重新產生。
3. **AI**：Claude 只拿到**唯讀 token**，讀取 issue 和留言，只修 issue 描述的問題，回傳結構化結果（`fixed`、`unreproduced`、`blocked`、`duplicate`），附上根本原因和「注意到但沒動」的其他問題。
4. **驗證**：workflow 會擋下 `src/` 以外的修改，要求測試**在原本的程式碼上失敗、修正後通過**，並跑 typecheck。AI 說了什麼都不算數。
5. **交付**：另一個 job 用這個 repo 自己的 GitHub App token push `autofix/issue-N` 並開 **draft PR**。用這個 token push 會觸發 CI 和 AI review。如果改到跟其他 Auto-fix PR 相同的檔案，會貼上 `possible-duplicate`。
6. **回報**：不管結果是什麼，issue 上都會有一則留言和一個標籤（`autofix-pr`、`needs-human`、`autofix-failed`），不會默默失敗。

另外，`claude-code-review.yml` 會用 Claude Code 內建的 `/code-review high` review 每個 PR（包含 Auto-fix 的 draft PR），`claude.yml` 讓人可以在任何 issue 或 PR 留言 `@claude` 要求修改。

## Workflow

| 檔案 | 觸發條件 | 作用 |
|------|----------|------|
| `autofix.yml` | `incident` / `claude` 標籤，或由 `ci-incident.yml` 呼叫 | 前置檢查、AI、驗證、交付、回報 |
| `ci-incident.yml` | main 的 CI 失敗 | 每個壞掉的 workflow 開一個 `incident` issue 並呼叫 Auto-fix |
| `claude-code-review.yml` | PR 開啟或更新 | 以 inline comment 進行 AI review |
| `claude.yml` | 留言含 `@claude` | 在 issue 和 PR 上對話式修改 |
| `ci.yml` | PR 和 main | typecheck 和測試，是所有 AI 修改的安全網 |

## Code review

`claude-code-review.yml` 執行 Claude Code 內建的 `/code-review high`，把發現的問題以 inline comment 留在 PR 上。同一個埋了 4 個 bug 的 PR 實測：內建版抓到 4 個（外加一個 race condition），官方 `code-review` plugin 只抓到 1 個，而且有時 8 秒就結束、一則留言都沒有，因為模型在 CI 裡跳過了 plugin 的多 agent 流程。內建版偏向多報，偶爾會有推測性的意見。review 檢查顯示綠燈，只代表 review 有跑完，不代表 PR 已被核准。

## 設定

1. 安裝 [Claude GitHub App](https://github.com/apps/claude)，把 `CLAUDE_CODE_OAUTH_TOKEN`（`claude setup-token` 產生）存成 repo secret。
2. 建立自己的 GitHub App，Contents、Issues、Pull requests 都設成讀寫，安裝到這個 repo。
3. 把 Client ID 存成 variable `AUTOFIX_APP_CLIENT_ID`，private key 存成 secret `AUTOFIX_APP_PRIVATE_KEY`：
   ```bash
   gh variable set AUTOFIX_APP_CLIENT_ID --repo <owner>/<repo> --body "<client id>"
   gh secret set AUTOFIX_APP_PRIVATE_KEY --repo <owner>/<repo> < path/to/key.pem
   ```
4. 在 `claude-code-review.yml` 的 `allowed_bots` 填入 App 的名稱。

## 接上監控

監控用一個只有 Issues 寫入權限的 token，透過 GitHub API 開 issue：

```bash
curl -X POST https://api.github.com/repos/<owner>/<repo>/issues \
  -H "Authorization: Bearer <token>" -H "Accept: application/vnd.github+json" \
  -d '{"title":"TypeError: ...","body":"發生了什麼、stack trace\n\n<!-- incident-fingerprint: <固定的識別碼> -->","labels":["incident"]}'
```

fingerprint 註解是選擇性的，用來把同一個錯誤的重複告警歸在一起。`scripts/simulate-incident.ts` 會在本機重現真實的錯誤，並印出這個請求。免費的選擇：PostHog 的 error tracking 免費方案可以發 webhook；Sentry 免費方案只有 email 告警。

## 測試時發現的坑

| 症狀 | 原因 | 解法（本 repo 已套用） |
|------|------|------------------------|
| run 顯示成功，卻沒有 PR 也沒有留言 | AI 自己跑 git，`git checkout -q -b` 對不上允許清單的前綴，被擋下後就放棄了 | AI 不再碰 git，由 workflow 交付並一定回報 |
| AI 實作了 issue 沒要求的功能 | `CLAUDE.md` 寫了「依照註解實作」 | 範圍規則：只改 issue 描述的行為，其他只回報 |
| PR 寫「修正前測試失敗」，其實沒跑過 | 測試結果由 AI 自己回報 | 由 workflow 自己跑測試 |
| AI 看不到 issue 本文 | `gh issue view --comments` 只印出留言 | 改用 `gh issue view N --json title,body,comments` |
| 重複 PR 的檢查從來沒比對到 | `gh pr list --search "head:autofix/"` 不支援前綴比對 | 由 workflow 列出開著的 Auto-fix PR 放進 prompt |
| PR 已經開出來，交付卻失敗 | `set -euo pipefail` 下，`[[ ]] &&` 的迴圈讓整個步驟結束 | 改用 `if ... then ... fi` |
| 後續步驟無法使用 Claude App 的 token | claude-code-action 結束時會撤銷 token | 用這個 repo 自己的 GitHub App 交付 |
| 內建 `/code-review` 找不到任何問題 | 它用本機 `git diff` 取 diff，`fetch-depth: 1` 沒有 base 可比 | review 的 checkout 用 `fetch-depth: 2` |
| review 結果只出現在 log | 內建 skill 的 `--comment` 在 CI 不會貼留言 | prompt 明確要求用 `mcp__github_inline_comment__create_inline_comment`，並列入 `--allowedTools` |
| `@claude` push 的 commit 沒觸發 CI | `actions/checkout@v6+` 把 `GITHUB_TOKEN` 存在 action 換不掉的地方（claude-code-action#1721） | `claude.yml` 固定 `checkout@v5`；不要用 `persist-credentials: false`（private repo 會讓 `@claude` 失敗，#1711） |
| 第二個 `@claude` 請求默默消失 | 排隊設在 workflow 層級，Claude 自己的進度留言擠掉了等候中的請求 | 排隊設在 job 層級，被跳過的 run 不會進入排隊 |
| `@claude` 已經 push 修正，run 卻顯示失敗 | `--max-turns` 太低 | `--max-turns 40` |
| PR 完全沒有跑 CI | PR 有衝突時，GitHub 不會執行 `pull_request` workflow | 先解衝突 |

## 已知限制

- 兩個來源幾乎同時回報同一個 bug 時，可能開出兩個 PR，第二個會被貼上 `possible-duplicate`。
- 驗證需要能證明修正的測試；測試覆蓋率低時，AI 會更常回報 `blocked`。
- 只在小型 TypeScript 專案上測過，最多約 7 個 AI 同時執行。
