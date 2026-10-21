# ai-incident-autofix

[English](README.md) | **繁體中文**

issue（來自監控、main 的 CI 失敗，或人）會變成一個經過驗證的 **draft PR**，由 AI review、CI 把關，最後由人決定要不要 merge。AI 只負責調查和改檔案，驗證、交付和回報都由 workflow 執行。

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

## 已知限制

- 兩個來源幾乎同時回報同一個 bug 時，可能開出兩個 PR，第二個會被貼上 `possible-duplicate`。
- 驗證需要能證明修正的測試；測試覆蓋率低時，AI 會更常回報 `blocked`。
- 只在小型 TypeScript 專案上測過，最多約 7 個 AI 同時執行。
