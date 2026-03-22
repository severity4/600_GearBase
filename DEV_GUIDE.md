# 開發環境設定指南

## 你需要的工具

| 工具 | 安裝方式 | 用途 |
|------|----------|------|
| **Node.js 20 LTS** | [nodejs.org](https://nodejs.org/) | 執行伺服器 |
| **VS Code** | [code.visualstudio.com](https://code.visualstudio.com/) | 編輯器 |
| **Railway CLI** | `npm i -g @railway/cli` | 連線遠端 DB |

## 快速開始（5 分鐘）

### 1. 安裝依賴
```bash
npm install
```

### 2. Railway 設定遠端 DB
```bash
# 登入 Railway
railway login

# 連結到你的 Railway 專案
railway link

# 取得 DATABASE_URL（自動從 Railway 拉）
railway variables
```

### 3. 建立本地 .env
```bash
cp .env.example .env
```

編輯 `.env`，填入 Railway 給的 `DATABASE_URL`：
```
DATABASE_URL=postgresql://postgres:xxxx@xxx.railway.app:5432/railway
JWT_SECRET=dev-secret-12345
NODE_ENV=development
PORT=3000
```

### 4. 啟動開發伺服器
```bash
npm run dev
```

瀏覽器開啟：
- 員工後台：http://localhost:3000/
- 客戶前台：http://localhost:3000/customer

### 5. 第一次使用
開啟後台 → 點「首次使用？建立管理員帳號」→ 填 email + 密碼

---

## 開發工作流

```
編輯程式碼 → nodemon 自動重啟 → 瀏覽器刷新測試
     ↓
git commit → git push → Railway 自動部署
```

### 常用指令

| 指令 | 用途 |
|------|------|
| `npm run dev` | 啟動開發伺服器（nodemon 自動重啟） |
| `npm run build` | 重新組裝前端 HTML |
| `npm run migrate` | 手動執行資料庫 migration |
| `npm start` | 正式環境啟動（Railway 用） |

### 前端修改流程
1. 編輯 `src/StaffApp.html`、`src/CustomerApp.html`、`src/Styles.html`
2. 執行 `npm run build` 重新組裝
3. 刷新瀏覽器

### 後端修改流程
1. 編輯 `server/` 下的檔案
2. nodemon 自動重啟，直接測試

### API 修改流程
1. 後端：`server/routes/*.js` 加路由
2. 前端：`public/js/api.js` 加對應的 API 方法
3. 兩邊都存檔，nodemon 重啟，刷新測試

---

## 專案結構

```
600_GearBase/
├── src/                     # 原始前端模板（HTML/CSS/JS）
│   ├── StaffApp.html        # 員工後台 UI
│   ├── CustomerApp.html     # 客戶前台 UI
│   ├── Styles.html          # 共用 CSS
│   └── JavaScript.html      # 共用工具函式
│
├── server/                  # Express 後端
│   ├── index.js             # 主入口
│   ├── db.js                # PostgreSQL 連線
│   ├── migrate.js           # 資料庫 migration
│   ├── middleware/auth.js   # JWT 認證
│   ├── routes/              # API 路由
│   │   ├── auth.js          # 登入/註冊
│   │   ├── equipment.js     # 器材管理
│   │   ├── rentals.js       # 租借管理
│   │   ├── customers.js     # 客戶管理
│   │   ├── payments.js      # 付款
│   │   ├── venues.js        # 場地管理
│   │   ├── staff.js         # 員工管理
│   │   ├── dashboard.js     # 儀表板/報表
│   │   └── customer-app.js  # 客戶端 API
│   └── services/            # 業務邏輯
│       ├── business-logic.js # 租金計算/折扣/逾期/狀態流
│       ├── id-generator.js  # ID 產生
│       └── email.js         # 寄信服務
│
├── public/                  # 靜態檔案（build 產出）
│   ├── js/api.js            # 前端 API 客戶端
│   ├── staff.html           # （build 產出）
│   └── customer.html        # （build 產出）
│
├── build.js                 # 前端組裝腳本
├── Dockerfile               # Railway 部署
├── railway.json             # Railway 設定
└── .env                     # 環境變數（不進 git）
```

---

## VS Code 推薦套件

在 VS Code 安裝這些：
- **ESLint** - 程式碼品質
- **Prettier** - 格式化
- **Thunder Client** - 測試 API（輕量版 Postman）
- **PostgreSQL** (by Chris Kolkman) - 在 VS Code 裡看 DB

---

## 部署到 Railway

1. 推 code 到 GitHub：`git push origin main`
2. Railway 自動偵測 → 自動 build → 自動部署
3. 第一次需在 Railway Dashboard 加 PostgreSQL plugin
4. 設定環境變數：`JWT_SECRET`、`SMTP_*`（選用）

---

## 從 Google Sheets 匯入舊資料（選用）

如果需要從現有 Google Sheets 匯入資料到 PostgreSQL：
1. 在 Google Sheets 匯出各工作表為 CSV
2. 用 pgAdmin / DBeaver 的 Import 功能匯入
3. 或寫一個簡單的匯入腳本（需要的話可以協助）
