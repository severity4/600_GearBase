# GitHub → Google Apps Script 自動部署設定

## 前置需求

1. 已安裝 Node.js (v18+)
2. 已安裝 clasp: `npm install -g @google/clasp`
3. 已登入 clasp: `clasp login`

## 本地開發

```bash
# 安裝依賴
npm install

# 推送程式碼到 GAS
npm run push

# 監聽檔案變更自動推送
npm run push:watch

# 部署新版本
npm run deploy

# 在瀏覽器開啟 GAS 編輯器
npm run open

# 在瀏覽器開啟 Web App
npm run open:web

# 查看執行日誌
npm run logs
```

## GitHub Actions 自動部署設定

當 `main` 分支的 `src/` 目錄有變更時，會自動推送並部署到 GAS。

### 步驟 1：取得 clasp 憑證

在本地終端機執行：

```bash
clasp login
cat ~/.clasprc.json
```

複製整個 JSON 內容。

### 步驟 2：設定 GitHub Secret

1. 前往 GitHub 專案頁面
2. Settings → Secrets and variables → Actions
3. 點擊 **New repository secret**
4. Name: `CLASP_CREDENTIALS`
5. Value: 貼上步驟 1 複製的 JSON 內容
6. 點擊 **Add secret**

### 步驟 3：啟用

推送程式碼到 `main` 分支即會自動部署：

```bash
git push origin main
```

也可以在 GitHub Actions 頁面手動觸發 **workflow_dispatch**。

## 注意事項

- clasp 憑證（`CLASP_CREDENTIALS`）會定期過期，需重新 `clasp login` 並更新 Secret
- `.clasp.json` 中的 `scriptId` 指向你的 GAS 專案，請確認正確
- 部署只會更新已存在的部署版本，不會建立新的 Web App URL
