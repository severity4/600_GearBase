# 600 GearBase — 映奧創意工作室 器材管理與租賃系統

> Google Apps Script Web App，使用 Google Sheets 作為資料庫

## 功能

### 員工後台（Staff Backend）
- 儀表板：器材總覽、租借狀態、營收統計
- 器材管理：類型 + 個體 CRUD，自動內部編號
- 租借管理：建立 / 追蹤 / 更新租借單
- 客戶管理：客戶資料 CRUD
- 庫存管理：存放位置、出入庫紀錄
- 盤點：盤點計畫與結果追蹤
- 付款：付款紀錄管理
- 報表：資料完整性檢查

### 客戶前台（Customer Frontend）
- 器材目錄瀏覽（分類篩選、搜尋）
- 購物車 + 租借申請提交
- 自動建立 draft 租借單

## 專案結構

```
600_GearBase/
├── .clasp.json          # clasp 設定（指向 GAS 專案）
├── .claspignore         # clasp push 忽略清單
├── .gitignore
├── README.md
├── docs/
│   ├── Schema_v1.md     # 資料庫 Schema（21 張表）
│   └── 部署指南.md       # 部署步驟說明
└── src/                 # ← clasp rootDir，push 這裡的檔案到 GAS
    ├── appsscript.json  # GAS 專案設定
    ├── Code.gs          # 主程式（路由、CRUD API、自動編號）
    ├── API.gs           # 資料存取層（通用讀寫查詢）
    ├── StaffApp.html    # 員工後台介面
    ├── CustomerApp.html # 客戶前台介面
    ├── Styles.html      # 共用 CSS
    └── JavaScript.html  # 共用 JS 工具
```

## 開發流程

### 前置需求

```bash
npm install -g @google/clasp
clasp login
```

### 從 GAS 拉取最新版本

```bash
clasp pull
```

### 推送程式碼到 GAS

```bash
clasp push
```

### 部署 Web App

```bash
# 建立新部署
clasp deploy --description "v1.0"

# 或在 GAS 編輯器中：部署 → 管理部署作業
```

### 開啟 GAS 編輯器

```bash
clasp open
```

## 存取 Web App

| 介面 | URL |
|------|-----|
| 員工後台 | `https://script.google.com/macros/s/{DEPLOY_ID}/exec` |
| 客戶前台 | `https://script.google.com/macros/s/{DEPLOY_ID}/exec?mode=customer` |

## Schema

系統使用 21 張 Google Sheets 分頁作為資料庫，詳見 [docs/Schema_v1.md](docs/Schema_v1.md)

## License

Private — 映奧創意工作室 內部使用
