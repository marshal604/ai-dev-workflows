# ai-dev-workflows

[English](README.md) | **繁體中文**

可以直接套用的 GitHub Actions AI 開發流程，已在這個 repo 端到端驗證過：

- **AI code review**：每個 PR 自動 review，留言 `@claude` 就能要求修正。
- **Auto-fix**：issue 被貼上 `incident` 或 `claude` 標籤後（由人、監控或 main 的 CI 失敗開出），會變成一個經過驗證的 **draft PR**。AI 只拿唯讀 token 修改程式碼；workflow 自己驗證、用自己的 GitHub App 交付，並在 issue 上回報結果。
- **Branch protection**：每次 merge 都要經過人：必須走 PR、CI 要綠燈、要一位人 approve。

要導入到其他 repo，請依序照下方「**導入步驟**」執行。設計原理與限制見 [docs/how-it-works.md](docs/how-it-works.md)；某一步沒有得到預期結果時，查 [docs/troubleshooting.md](docs/troubleshooting.md)。

## Repo 內容

| 路徑 | 作用 |
|------|------|
| `.github/workflows/claude-code-review.yml` | PR 開啟或更新時進行 AI review，留 inline comment |
| `.github/workflows/claude.yml` | issue 或 PR 留言 `@claude`：對話式修改，push 到 PR 分支 |
| `.github/workflows/autofix.yml` | Auto-fix：前置檢查 → AI（唯讀）→ 驗證 → 開 draft PR → 回報 |
| `.github/workflows/ci-incident.yml` | main 的 CI 失敗時開 `incident` issue，並呼叫 `autofix.yml` |
| `.github/workflows/ci.yml` | 專案的 CI；branch protection 的必要檢查，也是所有 AI 修改的安全網 |
| `.github/ISSUE_TEMPLATE/incident.yml` | Auto-fix 能處理的 bug 回報表單 |
| `CLAUDE.md` | **範本**：範例專案的慣例，review 和修正會遵守。每個專案都要改寫 |
| `src/`、`scripts/simulate-incident.ts` | 範例 TypeScript 程式，以及把真實錯誤轉成 `incident` issue 的腳本 |

## 導入步驟

依序執行。每一步最後都有檢查條件，通過後才進行下一步。

### 1. 複製檔案

把 `.github/workflows/`、`.github/ISSUE_TEMPLATE/incident.yml` 和 `CLAUDE.md` 複製到目標 repo。

**完成條件**：目標 repo 裡有 5 個 workflow 檔和 issue 表單。

### 2. 依專案修改

只需要改下面這些地方，其他部分與專案無關。

| 檔案 | 位置 | 改成 |
|------|------|------|
| `ci.yml` | `jobs.test.steps` | 專案的安裝、建置、lint、測試指令。保留 job id `test`（branch protection 要用），或在步驟 5 改成新的 id |
| `ci-incident.yml` | `on.workflow_run.workflows: [CI]` | 專案 CI workflow 的 `name:` |
| `autofix.yml` | `jobs.fix.steps` 的 `setup-node` 和 `npm ci` | 專案的工具鏈設定和安裝指令 |
| `autofix.yml` | `jobs.fix` 的 `--allowedTools` | 把 `npm test` / `npm run typecheck` / `node --test` 換成專案的測試和型別檢查指令 |
| `autofix.yml` | `Verify the change` 步驟 | `grep -vE '^src/'`：AI 可以修改的目錄。`\.test\.ts$`：測試檔的命名規則。`npm test` / `npm run typecheck`：專案的指令 |
| `autofix.yml` | `jobs.fix` 的 prompt | `Fix the root cause in src/` 和 `npm` 指令：跟上面相同的路徑和指令 |
| `claude.yml` | `--allowedTools` | 專案的測試和 lint 指令，讓 `@claude` 能驗證自己的修改 |
| `claude-code-review.yml` | `allowed_bots` | 步驟 3 建立的 GitHub App 的 slug |
| `CLAUDE.md` | 整份 | 專案的慣例，每條規則都要寫清楚適用範圍（寫太廣會造成 review 誤報）。保留「Fixing bugs and incidents」段落，Auto-fix 的範圍規則靠它 |

**完成條件**：上表每一列都已修改或確認適用，而且 `ci.yml` 在目標 repo 的分支上通過。

### 3. 建立 GitHub App 和憑證

1. 在 repo 安裝 **Claude GitHub App**：https://github.com/apps/claude
2. 建立 **Auto-fix GitHub App**（負責開 draft PR；用它 push 會觸發 CI，`GITHUB_TOKEN` 不會）。下面的網址會預先填好設定，`name` 要改成唯一的名稱：
   `https://github.com/settings/apps/new?name=<org>-autofix&url=<repo url>&public=false&webhook_active=false&contents=write&issues=write&pull_requests=write`
   組織用的話，改用 `https://github.com/organizations/<org>/settings/apps/new?...`，參數相同。
3. 在 App 頁面記下 **Client ID**，產生 **private key**（`.pem`），並只安裝到目標 repo。
4. 存入憑證：
   ```bash
   gh variable set AUTOFIX_APP_CLIENT_ID --repo <owner>/<repo> --body "<client id>"
   gh secret set AUTOFIX_APP_PRIVATE_KEY --repo <owner>/<repo> < path/to/key.pem
   gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo <owner>/<repo>   # 在自己的終端機執行；值來自 `claude setup-token`
   ```
   團隊使用時，把個人 OAuth token 換成 Claude Console 的 API key：設定 secret `ANTHROPIC_API_KEY`；在 `claude.yml`、`claude-code-review.yml`、`autofix.yml` 把 `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` 換成 `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`；`autofix.yml` 的 `workflow_call` secret `CLAUDE_CODE_OAUTH_TOKEN` 也要改名為 `ANTHROPIC_API_KEY`。

**完成條件**：`gh variable list` 有 `AUTOFIX_APP_CLIENT_ID`，`gh secret list` 有 private key 和 Claude 憑證，兩個 App 的安裝清單裡都有這個 repo。

### 4. 建立標籤

```bash
gh label create incident --repo <owner>/<repo> --color B60205 --description "Bug for Auto-fix"
gh label create claude --repo <owner>/<repo> --color 7057FF --description "Hand this issue to Auto-fix"
```

在 issue 貼上任一個標籤，就代表同意交給 Auto-fix。只有 triage 以上權限的人能貼標籤，要決定由誰負責。

**完成條件**：兩個標籤都存在。

### 5. 保護 `main`

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

`context` 填步驟 2 的 CI job id。不要把任何一個 App 加進繞過名單。

**完成條件**：`gh api repos/<owner>/<repo>/branches/main/protection` 顯示必要檢查、需要 1 位 approve、`require_last_push_approval: true`。

### 6. 端到端驗證

在目標 repo 逐項檢查，比對預期結果。

| 檢查 | 做法 | 預期 |
|------|------|------|
| AI review | 開一個故意帶小 bug 的 PR | 幾分鐘內出現 inline review 留言 |
| `@claude` | 在該 PR 留言 `@claude 照 review 意見修正` | Claude push 一個 commit，CI 對它執行 |
| Auto-fix | 開一個描述可重現 bug 的 issue（附 stack trace 或會失敗的輸入），貼上 `incident` | 幾分鐘內 Auto-fix App 開出 draft PR；issue 上有 `autofix-pr` 標籤和留言；PR 上有跑 CI 和 review |
| 模糊需求 | 開一個模糊的 issue（「運費便宜一點」），貼上 `claude` | 沒有 PR；出現 `needs-human` 標籤，留言列出需要決定的事 |
| Merge 把關 | 不經 approve 直接 merge 那個 draft PR | 被 branch protection 拒絕 |

**完成條件**：每一列都符合。不符合時，到 [docs/troubleshooting.md](docs/troubleshooting.md) 找對應的症狀。

## 接上監控

監控用一個只有 Issues 寫入權限的 token，透過 GitHub API 開 `incident` issue：

```bash
curl -X POST https://api.github.com/repos/<owner>/<repo>/issues \
  -H "Authorization: Bearer <token>" -H "Accept: application/vnd.github+json" \
  -d '{"title":"TypeError: ...","body":"發生了什麼、stack trace\n\n<!-- incident-fingerprint: <固定的識別碼> -->","labels":["incident"]}'
```

fingerprint 註解會把同一個錯誤的重複告警歸到同一個 issue。`scripts/simulate-incident.ts` 會從真實錯誤產生這個請求。完成 [docs/how-it-works.md](docs/how-it-works.md#limits) 列出的執行環境強化後，才接上監控。

## 日常運作

- 貼上 `incident` / `claude` 標籤就會啟動 Auto-fix；結果會在 issue 上留一則留言加一個標籤：`autofix-pr`、`needs-human` 或 `autofix-failed`。
- 每天看一次 `needs-human` 和 `autofix-failed` 的 issue。在留言回答問題後要重試，把標籤拿掉再貼回去。
- 每個 issue 最多自動嘗試 3 次，之後由人接手。
- 全部停用：`gh workflow disable autofix.yml`（`ci-incident.yml`、`claude.yml` 同理），再取消執行中的 run。移除 Auto-fix App 的安裝或刪除它的 private key，會立刻停止所有自動交付。
