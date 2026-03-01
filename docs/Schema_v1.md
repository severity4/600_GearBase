# 映奧創意工作室 — 器材管理與租賃 App Schema（最終版）

> **版本：** v1.1
> **日期：** 2026-03-01
> **平台：** Google Workspace (Sheets + Forms + Docs + Apps Script + Drive)

---

## 目錄

1. [資料表總覽](#1-資料表總覽)
2. [存放位置 Storage_Locations](#2-存放位置-storage_locations)
3. [器材類型 Equipment_Types](#3-器材類型-equipment_types)
4. [器材個體 Equipment_Units](#4-器材個體-equipment_units)
5. [配件綁定 Accessory_Bindings](#5-配件綁定-accessory_bindings)
6. [保養紀錄 Maintenance_Logs](#6-保養紀錄-maintenance_logs)
7. [客戶資料 Customers](#7-客戶資料-customers)
8. [員工 Staff](#8-員工-staff)
9. [租借單（主約）Rentals](#9-租借單主約-rentals)
10. [租借明細 Rental_Items](#10-租借明細-rental_items)
11. [服務項目 Service_Items](#11-服務項目-service_items)
12. [附約 Rental_Addendums](#12-附約-rental_addendums)
13. [折扣規則 Discount_Rules](#13-折扣規則-discount_rules)
14. [逾期規則 Overdue_Rules](#14-逾期規則-overdue_rules)
15. [損壞賠償 Damage_Records](#15-損壞賠償-damage_records)
16. [損耗容忍度 Wear_Tolerance](#16-損耗容忍度-wear_tolerance)
17. [折讓/退款單 Credit_Notes](#17-折讓退款單-credit_notes)
18. [付款紀錄 Payments](#18-付款紀錄-payments)
19. [出入庫紀錄 Inventory_Logs](#19-出入庫紀錄-inventory_logs)
20. [列印範本 Print_Templates](#20-列印範本-print_templates)
21. [盤點計畫 Stocktake_Plans](#21-盤點計畫-stocktake_plans)
22. [盤點結果明細 Stocktake_Results](#22-盤點結果明細-stocktake_results)
23. [資料關聯圖](#23-資料關聯圖)
24. [Google Workspace 對應實作](#24-google-workspace-對應實作)
25. [設計決策紀錄](#25-設計決策紀錄)

---

## 1. 資料表總覽

| # | 資料表 | 說明 |
|---|--------|------|
| 1 | Storage_Locations | 倉儲位置管理（倉庫、區域、貨架） |
| 2 | Equipment_Types | 器材/道具「類型」定義（品名、日租費、市值） |
| 3 | Equipment_Units | 器材/道具「個體」（同類型可有多件，各有序號） |
| 4 | Accessory_Bindings | 配件與主器材的綁定關係 |
| 5 | Maintenance_Logs | 保養/維修紀錄 |
| 6 | Customers | 客戶資料 |
| 7 | Staff | 員工與權限 |
| 8 | Rentals | 租借單（主約） |
| 9 | Rental_Items | 租借明細（每筆器材） |
| 10 | Service_Items | 服務項目（教學、運送、架設等） |
| 11 | Rental_Addendums | 附約（續租、變更） |
| 12 | Discount_Rules | 折扣規則 |
| 13 | Overdue_Rules | 逾期費規則 |
| 14 | Damage_Records | 損壞賠償紀錄 |
| 15 | Wear_Tolerance | 損耗容忍度（依分類設定） |
| 16 | Credit_Notes | 折讓/退款單（含審批流程） |
| 17 | Payments | 付款紀錄（支援分次付款、退款） |
| 18 | Inventory_Logs | 出入庫紀錄（出借/歸還/入庫點檢） |
| 19 | Print_Templates | 列印範本（租借明細、點檢單、收據、賠償明細） |
| 20 | Stocktake_Plans | 盤點計畫（定期/循環/抽盤排程管理） |
| 21 | Stocktake_Results | 盤點結果明細（帳實比對與差異處理） |

---

## 2. 存放位置 Storage_Locations

> 管理倉庫、樓層、區域、貨架等存放位置。支援階層結構（倉庫 → 樓層 → 區域 → 貨架/櫃位）。
> 美術道具量大時，快速找到器材存放在哪裡非常重要。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `location_id` | String (PK) | ✅ | 位置 ID，例如 `LOC-001` |
| `name` | String | ✅ | 位置名稱，例如「A 倉庫」「B1 - 道具區 - 第 3 架」 |
| `location_type` | Enum | ✅ | `warehouse`(倉庫) / `floor`(樓層) / `zone`(區域) / `shelf`(貨架/櫃位) / `other` |
| `parent_location_id` | String (FK) | | 上層位置 ID（建立階層，例如樓層屬於某倉庫） |
| `floor_number` | String | | 樓層編號（例如 `B1`、`1F`、`2F`），方便快速查詢 |
| `address` | String | | 實際地址（若為獨立倉庫） |
| `capacity_note` | String | | 容量說明，例如「可放約 30 箱道具」 |
| `responsible_staff` | String (FK) | | 負責管理的員工 |
| `active` | Boolean | ✅ | 是否仍在使用 |
| `notes` | String | | 備註 |

### 位置階層範例

```
LOC-001 A倉庫（warehouse）
  ├── LOC-002 B1 地下室（floor）
  │     ├── LOC-010 大型道具區（zone）
  │     │     ├── LOC-011 家具道具（shelf）
  │     │     └── LOC-012 場景佈置（shelf）
  │     └── LOC-013 車輛停放區（zone）
  ├── LOC-003 1F 一樓（floor）
  │     ├── LOC-020 攝影器材區（zone）
  │     │     ├── LOC-021 攝影機櫃（shelf）
  │     │     ├── LOC-022 鏡頭櫃（shelf）
  │     │     └── LOC-023 配件櫃（shelf）
  │     └── LOC-024 音訊設備區（zone）
  └── LOC-004 2F 二樓（floor）
        ├── LOC-030 美術道具區（zone）
        │     ├── LOC-031 服裝道具（shelf）
        │     └── LOC-032 特效材料（shelf）
        └── LOC-033 備品倉庫（zone）

LOC-050 B倉庫（warehouse）
  └── LOC-051 1F（floor）
        └── LOC-052 外景道具區（zone）
```

---

## 3. 器材類型 Equipment_Types

> 定義「一種器材」的基本資訊，例如「Chronos 2.1-HD 高速攝影機」

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `type_id` | String (PK) | ✅ | 類型 ID，例如 `ET-001` |
| `name` | String | ✅ | 器材名稱 |
| `category` | String | ✅ | 大分類（見下方分類表） |
| `sub_category` | String | | 子分類，例如「定焦鏡」「變焦鏡」 |
| `model` | String | | 型號 |
| `brand` | String | | 品牌 |
| `daily_rate` | Number | ✅ | 日租費 (NT$) |
| `replacement_value` | Number | ✅ | 器材市值 / 賠償價 (NT$) |
| `deposit_required` | Number | | 建議押金 (NT$) |
| `is_consumable` | Boolean | ✅ | 是否為消耗品（消耗品不退還） |
| `is_batch_item` | Boolean | ✅ | 是否支援批次出租（例如 50 張椅子） |
| `batch_unit` | String | | 批次單位（例如「組」「套」「箱」） |
| `description` | String | | 器材說明 |
| `image_url` | String | | 照片連結（Google Drive） |
| `active` | Boolean | ✅ | 是否仍在使用（停用不刪除） |
| `created_by` | String (FK) | ✅ | 登記人員（建立這筆類型的員工，FK → Staff） |
| `created_at` | Date | ✅ | 建立日期 |

### 分類對照表

| category 值 | 說明 | 範例 |
|-------------|------|------|
| `camera` | 攝影機 | Chronos 2.1-HD |
| `lens` | 鏡頭 | Nikon 50mm F2.8 |
| `audio` | 音訊設備 | Hollyland SOLIDCOM |
| `lighting` | 燈光設備 | LED 平板燈 |
| `monitor` | 監看設備 | Atomos Ninja V |
| `transmission` | 無線圖傳 | Teradek Bolt LT |
| `tripod` | 腳架/雲台 | Sachtler FSB6 |
| `motion` | 運動控制 | 9.Solutions C-Pan Arm |
| `teleprompter` | 讀稿機 | 20吋讀稿機套組 |
| `accessory` | 通用配件 | 電池、線材 |
| `prop_furniture` | 道具 - 家具 | 沙發、桌椅 |
| `prop_wardrobe` | 道具 - 服裝 | 戲服、飾品 |
| `prop_set` | 道具 - 場景佈置 | 背景板、植栽 |
| `prop_fx` | 道具 - 特效材料 | 煙霧彈、假血（消耗品） |
| `prop_vehicle` | 道具 - 車輛 | 道具車 |
| `prop_other` | 道具 - 其他 | 未分類道具 |

---

## 4. 器材個體 Equipment_Units

> 同一類型器材可能有多件，每件都有自己的序號和狀態。
> 例如：有 3 顆 Nikon 50mm 鏡頭，每顆是一筆 Unit。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `unit_id` | String (PK) | ✅ | 個體 ID，例如 `EU-001` |
| `type_id` | String (FK) | ✅ | 所屬器材類型 |
| `serial_number` | String | | 原廠序號 |
| `internal_code` | String | ✅ | 公司內部編號（貼標用），**系統自動產生**，格式：`{分類代碼}-{年份}-{流水號}`，例如 `CAM-2026-001`、`LEN-2026-002`、`PROP-F-2026-001` |
| `purchase_date` | Date | | 購入日期 |
| `purchase_cost` | Number | | 購入成本 (NT$) |
| `current_condition` | Enum | ✅ | `excellent` / `good` / `fair` / `poor` |
| `location_id` | String (FK) | | 存放位置（對應 Storage_Locations） |
| `batch_quantity` | Number | | 批次品的數量（例如「50」張椅子） |
| `status` | Enum | ✅ | `available` / `reserved` / `rented` / `maintenance` / `retired` |
| `notes` | String | | 備註 |
| `created_by` | String (FK) | ✅ | 登記人員（建立這筆資料的員工，FK → Staff） |
| `created_at` | Date | ✅ | 建立日期 |

### 內部編號自動產生規則

- **格式：** `{分類代碼}-{西元年份}-{三位流水號}`
- **時機：** 建立 Equipment_Unit 時由 Apps Script 自動填入，不可手動修改
- **流水號：** 每個分類每年獨立計數，從 001 開始
- **範例：** 2026 年第 2 台攝影機 → `CAM-2026-002`

| category 值 | 代碼 | 範例 |
|-------------|------|------|
| `camera` | CAM | CAM-2026-001 |
| `lens` | LEN | LEN-2026-001 |
| `audio` | AUD | AUD-2026-001 |
| `lighting` | LGT | LGT-2026-001 |
| `monitor` | MON | MON-2026-001 |
| `transmission` | TRX | TRX-2026-001 |
| `tripod` | TRI | TRI-2026-001 |
| `motion` | MOT | MOT-2026-001 |
| `teleprompter` | TLP | TLP-2026-001 |
| `accessory` | ACC | ACC-2026-001 |
| `prop_furniture` | PROP-F | PROP-F-2026-001 |
| `prop_wardrobe` | PROP-W | PROP-W-2026-001 |
| `prop_set` | PROP-S | PROP-S-2026-001 |
| `prop_fx` | PROP-X | PROP-X-2026-001 |
| `prop_vehicle` | PROP-V | PROP-V-2026-001 |
| `prop_other` | PROP-O | PROP-O-2026-001 |

---

## 5. 配件綁定 Accessory_Bindings

> 配件永遠跟隨主器材出租，不可單獨借出。
> 例如：Chronos 攝影機綁定 8 個配件，讀稿機綁定 10+ 配件。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `binding_id` | String (PK) | ✅ | 綁定 ID |
| `parent_type_id` | String (FK) | ✅ | 主器材類型 ID |
| `accessory_type_id` | String (FK) | ✅ | 配件類型 ID |
| `quantity` | Number | ✅ | 隨附數量（例如電池 ×3） |
| `is_mandatory` | Boolean | ✅ | 是否為必要配件（缺少則不可出借） |
| `notes` | String | | 備註 |

---

## 6. 保養紀錄 Maintenance_Logs

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `log_id` | String (PK) | ✅ | 紀錄 ID |
| `unit_id` | String (FK) | ✅ | 對應器材個體 |
| `maintenance_type` | Enum | ✅ | `routine`(定期保養) / `repair`(維修) / `firmware`(韌體更新) / `calibration`(校正) / `cleaning`(清潔) |
| `description` | String | ✅ | 保養/維修內容描述 |
| `performed_by` | String (FK) | ✅ | 執行人員 (staff_id) |
| `vendor` | String | | 外部廠商（若外送維修） |
| `cost` | Number | | 費用 (NT$) |
| `start_date` | Date | ✅ | 開始日期 |
| `end_date` | Date | | 完成日期 |
| `next_scheduled` | Date | | 下次排程保養日期 |
| `before_photo_url` | String | | 保養前照片 (Google Drive) |
| `after_photo_url` | String | | 保養後照片 (Google Drive) |
| `status` | Enum | ✅ | `scheduled` / `in_progress` / `completed` |
| `notes` | String | | 備註 |

---

## 7. 客戶資料 Customers

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `customer_id` | String (PK) | ✅ | 客戶 ID，例如 `CU-001` |
| `name` | String | ✅ | 租借人姓名 |
| `phone` | String | ✅ | 聯絡電話 |
| `email` | String | | 電子郵件 |
| `id_number` | String | | 身分證字號 / 統一編號 |
| `company_name` | String | | 公司名稱（企業客戶） |
| `id_doc_url` | String | | 身分證件掃描檔 (Google Drive) |
| `id_doc_verified` | Boolean | ✅ | 證件是否已驗證 |
| `id_doc_verified_by` | String (FK) | | 驗證人員 |
| `id_doc_verified_at` | Date | | 驗證日期 |
| `id_doc_return_status` | Enum | ✅ | `not_collected`(未收取) / `held`(保管中) / `returned`(已歸還) / `na`(不適用) |
| `id_doc_return_date` | Date | | 證件歸還日期 |
| `blacklisted` | Boolean | ✅ | 是否列入黑名單 |
| `blacklist_reason` | String | | 黑名單原因 |
| `notes` | String | | 備註 |
| `created_at` | Date | ✅ | 建立日期 |

---

## 8. 員工 Staff

> 區分角色權限，並支援「準備器材」與「當天承辦」為不同人員。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `staff_id` | String (PK) | ✅ | 員工 ID |
| `name` | String | ✅ | 姓名 |
| `email` | String | ✅ | Google Workspace 帳號 |
| `phone` | String | | 聯絡電話 |
| `role` | Enum | ✅ | `admin`(主管) / `manager`(可核准折扣) / `staff`(一般員工) / `viewer`(唯讀) |
| `can_approve_discount` | Boolean | ✅ | 是否有折扣核准權限 |
| `active` | Boolean | ✅ | 是否在職 |

---

## 9. 租借單（主約）Rentals

> 一張主約代表一次租借交易，支援預約制並容許提早/延後。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `rental_id` | String (PK) | ✅ | 合約編號，例如 `RENT-2026-001`（自動遞增） |
| `customer_id` | String (FK) | ✅ | 對應客戶 |
| `rental_start` | Date | ✅ | 預定租借開始日 |
| `rental_end` | Date | ✅ | 預定歸還日 |
| `actual_pickup_date` | Date | | 實際取件日（可能提早） |
| `actual_return_date` | Date | | 實際歸還日（可能延後） |
| `total_days` | Number | | 實際租借天數（自動計算） |
| `subtotal` | Number | | 小計 (NT$) |
| `discount_total` | Number | | 總折扣金額 (NT$) |
| `overdue_fee` | Number | | 逾期費用 (NT$) |
| `tax_rate` | Number | ✅ | 稅率，預設 `0.05`（5%） |
| `tax_amount` | Number | | 營業稅 (NT$) |
| `total_amount` | Number | | 合計應付金額 (NT$) |
| `deposit_amount` | Number | | 押金金額 (NT$) |
| `deposit_status` | Enum | ✅ | `pending` / `received` / `returned` / `deducted` |
| `deposit_received_by` | String (FK) | | 收取押金的員工（承辦人） |
| `delivery_required` | Boolean | ✅ | 是否需要運送服務 |
| `delivery_address` | String | | 運送地址（客戶填寫，需要運送時必填） |
| `delivery_contact` | String | | 現場收件聯絡人 |
| `delivery_contact_phone` | String | | 現場收件聯絡電話 |
| `delivery_notes` | String | | 運送備註（例如「地下室入口、需貨梯」） |
| `use_purpose` | String | | 用途說明（特殊用途揭露，合約第11條） |
| `use_risk_category` | Enum | | `standard`(一般室內) / `outdoor_run`(路跑活動) / `car_mount`(車拍) / `water_activity`(水上活動) / `aerial`(空拍/高空) / `pyro_fx`(煙火/特效) / `extreme_weather`(極端天候) / `other_high_risk`(其他高風險) |
| `risk_acknowledged` | Boolean | | 客戶是否已簽署高風險告知書（合約第 11 條） |
| `risk_surcharge` | Number | | 高風險加收費用 (NT$) |
| `risk_doc_url` | String | | 高風險告知書/切結書 (Google Drive) |
| `contract_url` | String | | 電子合約 PDF 連結 (Google Drive) |
| `contract_signed` | Boolean | ✅ | 電子合約是否已簽署 |
| `invoice_required` | Boolean | ✅ | 是否需要開立發票 |
| `tax_id_number` | String | | 統一編號（公司戶開發票用） |
| `invoice_title` | String | | 發票抬頭 |
| `invoice_number` | String | | 發票號碼（開立後填寫） |
| `invoice_status` | Enum | ✅ | `not_required` / `pending` / `issued` / `voided` |
| `invoice_url` | String | | 發票檔案連結 (Google Drive) |
| `rental_detail_pdf_url` | String | | 租借明細單 PDF (Google Drive)，由 Apps Script 自動產生 |
| `prepared_by` | String (FK) | ✅ | 準備器材的員工 |
| `handled_by` | String (FK) | ✅ | 當天承辦人員 |
| `approved_by` | String (FK) | | 核准人（如有折扣需主管核准） |
| `status` | Enum | ✅ | `draft` / `reserved` / `active` / `returned` / `overdue` / `cancelled` |
| `cancellation_date` | Date | | 取消日期 |
| `cancellation_reason` | String | | 取消原因 |
| `cancellation_fee` | Number | | 取消手續費 (NT$) |
| `cancellation_refund_amount` | Number | | 取消後應退金額 (NT$) |
| `cancellation_approved_by` | String (FK) | | 取消核准人 |
| `created_at` | Timestamp | ✅ | 建立時間 |
| `updated_at` | Timestamp | ✅ | 最後更新時間 |

### 狀態流程

```
draft → reserved → active → returned
                      ↓
                   overdue → returned
         ↓
      cancelled
```

---

## 10. 租借明細 Rental_Items

> 一筆租借單可包含多項器材，支援批次出租。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `item_id` | String (PK) | ✅ | 明細 ID |
| `rental_id` | String (FK) | ✅ | 對應租借單 |
| `type_id` | String (FK) | ✅ | 器材類型 |
| `unit_id` | String (FK) | | 器材個體（批次品可留空） |
| `quantity` | Number | ✅ | 數量（批次品填實際數量） |
| `daily_rate_snapshot` | Number | ✅ | 當時日租費（快照，歷史不變） |
| `replacement_value_snapshot` | Number | ✅ | 當時市值快照 |
| `days` | Number | ✅ | 租借天數 |
| `line_total` | Number | ✅ | 原價小計 (NT$) |
| `discount_rule_id` | String (FK) | | 套用的折扣規則（NULL = 無折扣） |
| `discount_amount` | Number | | 折扣金額 (NT$) |
| `line_total_after_discount` | Number | ✅ | 折扣後小計 (NT$) |
| `condition_out` | String | | 出借時器材狀態描述 |
| `condition_out_photo_url` | String | | 出借時照片 (Google Drive) |
| `condition_in` | String | | 歸還時器材狀態描述 |
| `condition_in_photo_url` | String | | 歸還時照片 (Google Drive) |
| `checked_out_by` | String (FK) | | 出借點檢人員 |
| `checked_in_by` | String (FK) | | 歸還點檢人員 |
| `return_status` | Enum | ✅ | `with_customer`(客戶持有中) / `returned`(已歸還) / `partial_returned`(部分歸還，限批次品) / `lost`(遺失) |
| `returned_quantity` | Number | | 已歸還數量（批次品用，例如 50 張椅子歸還 45 張） |
| `return_date` | Date | | 實際歸還日期（可能不同項目不同天歸還） |

---

## 11. 服務項目 Service_Items

> 記錄租借單附帶的非器材服務項目（教學、運送、架設等）。獨立計價，不受折扣規則影響。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `service_item_id` | String (PK) | ✅ | 服務明細 ID |
| `rental_id` | String (FK) | ✅ | 對應租借單 |
| `service_type` | Enum | ✅ | `teaching`(教學指導) / `delivery`(運送) / `setup`(架設) / `pickup`(到府取件) / `insurance`(保險加購) / `other`(其他) |
| `description` | String | ✅ | 服務內容說明 |
| `quantity` | Number | ✅ | 數量（例如教學 2 小時） |
| `unit` | String | ✅ | 單位（例如「小時」「趟」「組」） |
| `unit_price` | Number | ✅ | 單價 (NT$) |
| `line_total` | Number | ✅ | 小計 (NT$) |
| `performed_by` | String (FK) | | 執行人員 |
| `service_date` | Date | | 服務日期 |
| `service_address` | String | | 服務地點（若與主單運送地址不同時填寫） |
| `notes` | String | | 備註 |

---

## 12. 附約 Rental_Addendums

> 處理續租、時間變更、新增器材等情況，以附約形式追加，不修改主約。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `addendum_id` | String (PK) | ✅ | 附約 ID，例如 `RENT-2026-001-A1` |
| `rental_id` | String (FK) | ✅ | 對應主約 |
| `addendum_type` | Enum | ✅ | `extension`(續租) / `add_item`(新增器材) / `remove_item`(移除器材) / `date_change`(日期變更) / `other`(其他) |
| `description` | String | ✅ | 變更內容說明 |
| `original_end_date` | Date | | 原歸還日（續租時填） |
| `new_end_date` | Date | | 新歸還日（續租時填） |
| `additional_amount` | Number | | 附約追加金額 (NT$) |
| `addendum_contract_url` | String | | 附約 PDF 連結 (Google Drive) |
| `signed` | Boolean | ✅ | 是否已簽署 |
| `created_by` | String (FK) | ✅ | 建立者 |
| `approved_by` | String (FK) | | 核准人 |
| `created_at` | Timestamp | ✅ | 建立時間 |

---

## 13. 折扣規則 Discount_Rules

> 彈性設定：可針對單一器材、整個分類、或全部器材設定多天折扣。
> 沒有對應規則的器材 = 不打折。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `rule_id` | String (PK) | ✅ | 規則 ID |
| `rule_name` | String | ✅ | 規則名稱，例如「Chronos 長租優惠」 |
| `applies_to` | Enum | ✅ | `equipment`(指定器材) / `category`(整個分類) / `all`(全部) |
| `target_id` | String | | 對應的 `type_id` 或 `category` 值 |
| `min_days` | Number | ✅ | 最少租借天數才觸發 |
| `max_days` | Number | | 上限天數（NULL = 無上限） |
| `discount_type` | Enum | ✅ | `percentage`(百分比) / `fixed_per_day`(每日固定減免) |
| `discount_value` | Number | ✅ | 折扣值（例如 `10` = 10% 或 NT$10/天） |
| `requires_approval` | Boolean | ✅ | 是否需主管核准 |
| `active` | Boolean | ✅ | 是否啟用 |
| `created_at` | Date | ✅ | 建立日期 |

### 折扣範例

| rule_name | applies_to | target_id | min_days | max_days | discount_type | discount_value |
|-----------|-----------|-----------|----------|----------|---------------|----------------|
| Chronos 3天優惠 | equipment | ET-001 | 3 | 5 | percentage | 10 |
| Chronos 6天+ | equipment | ET-001 | 6 | NULL | percentage | 15 |
| 攝影機類長租 | category | camera | 5 | NULL | percentage | 8 |
| 道具家具週租 | category | prop_furniture | 7 | NULL | percentage | 20 |

---

## 14. 逾期規則 Overdue_Rules

> 按日租費倍率計算逾期費。可依分類設定不同倍率。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `overdue_rule_id` | String (PK) | ✅ | 規則 ID |
| `applies_to` | Enum | ✅ | `category` / `all` |
| `target_category` | String | | 對應分類（若 `all` 則留空） |
| `multiplier` | Number | ✅ | 逾期日租費倍率，例如 `1.5` = 日租費的 1.5 倍 |
| `grace_period_hours` | Number | | 寬限時數（例如超過 2 小時才算逾期一天） |
| `max_penalty_rate` | Number | | 逾期罰款上限比率（例如 `0.3` = 器材市值的 30%） |
| `forced_purchase_days` | Number | | 超過此天數視為買斷（例如 `15`），NULL = 不啟用 |
| `forced_purchase_note` | String | | 買斷條款說明 |
| `active` | Boolean | ✅ | 是否啟用 |

### 逾期範例

| applies_to | target_category | multiplier | grace_period_hours |
|-----------|----------------|------------|-------------------|
| category | camera | 1.5 | 4 |
| category | lens | 1.5 | 4 |
| category | prop_furniture | 1.2 | 12 |
| all | | 1.5 | 4 |

---

## 15. 損壞賠償 Damage_Records

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `damage_id` | String (PK) | ✅ | 損壞記錄 ID |
| `rental_id` | String (FK) | ✅ | 對應租借單 |
| `unit_id` | String (FK) | ✅ | 受損器材個體 |
| `damage_description` | String | ✅ | 損壞描述 |
| `damage_severity` | Enum | ✅ | `minor`(輕微) / `moderate`(中度) / `severe`(嚴重) / `total_loss`(全損) |
| `within_tolerance` | Boolean | ✅ | 是否在損耗容忍度內（免賠） |
| `repair_cost` | Number | | 維修費用 (NT$) |
| `compensation_amount` | Number | | 賠償金額 (NT$)（全損時 = replacement_value） |
| `photo_url` | String | | 損壞照片 (Google Drive) |
| `assessed_by` | String (FK) | ✅ | 評估人員 |
| `status` | Enum | ✅ | `pending` / `customer_notified` / `resolved` / `disputed` |
| `resolution_notes` | String | | 處理結果說明 |
| `damage_report_pdf_url` | String | | 損壞賠償明細 PDF (Google Drive)，由 Apps Script 自動產生 |
| `created_at` | Date | ✅ | 記錄日期 |

---

## 16. 損耗容忍度 Wear_Tolerance

> 不同分類的器材有不同的磨損標準。
> 例如：道具允許輕微刮傷，但攝影鏡頭不允許任何刮傷。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `tolerance_id` | String (PK) | ✅ | ID |
| `category` | String | ✅ | 對應的器材分類 |
| `acceptable_wear` | String | ✅ | 可接受的損耗描述，例如「輕微表面磨損、不影響功能」 |
| `unacceptable_wear` | String | ✅ | 不可接受的損耗，例如「鏡片刮傷、結構變形」 |
| `assessment_checklist` | String | | 點檢清單項目（逗號分隔） |
| `notes` | String | | 備註 |

### 容忍度範例

| category | acceptable_wear | unacceptable_wear |
|----------|----------------|-------------------|
| camera | 機身輕微使用痕跡 | 感光元件損壞、LCD 破裂 |
| lens | 鏡身輕微磨損 | 鏡片刮傷、發霉、入塵 |
| prop_furniture | 輕微磕碰、表面磨損 | 結構斷裂、布面破損 |
| prop_fx | 不適用（消耗品） | 不適用 |
| teleprompter | 外框輕微磨損 | 玻璃破裂、反射鏡損壞 |

---

## 17. 折讓/退款單 Credit_Notes

> 處理因器材故障、服務瑕疵、提前歸還等情況的折讓或退款。
> 每筆折讓單會對應到一筆 Payment（負數金額），完整追蹤原因和審批流程。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `credit_note_id` | String (PK) | ✅ | 折讓單 ID，例如 `CN-2026-001` |
| `rental_id` | String (FK) | ✅ | 對應租借單 |
| `credit_type` | Enum | ✅ | `equipment_malfunction`(器材故障折讓) / `early_return`(提前歸還退費) / `service_issue`(服務瑕疵) / `goodwill`(善意折讓) / `deposit_deduction`(押金扣抵後退還) / `overcharge`(多收退還) / `other`(其他) |
| `related_item_id` | String (FK) | | 對應的租借明細 item_id（若針對特定器材） |
| `related_damage_id` | String (FK) | | 對應的損壞紀錄（若因器材問題給折讓） |
| `original_amount` | Number | ✅ | 原始應收金額 (NT$) |
| `credit_amount` | Number | ✅ | 折讓/退款金額 (NT$)（正數表示退給客戶的錢） |
| `reason` | String | ✅ | 折讓原因詳細說明 |
| `evidence_url` | String | | 佐證資料（照片、對話截圖等，Google Drive） |
| `requested_by` | String (FK) | ✅ | 申請人（員工） |
| `approved_by` | String (FK) | | 核准人（主管） |
| `approval_status` | Enum | ✅ | `pending`(待審) / `approved`(已核准) / `rejected`(駁回) |
| `rejection_reason` | String | | 駁回原因 |
| `refund_method` | Enum | | `cash`(現金) / `transfer`(轉帳) / `deposit_offset`(從押金扣抵) / `next_rental_credit`(折抵下次租金) |
| `refund_status` | Enum | ✅ | `pending`(待退款) / `completed`(已退款) / `offset`(已扣抵) |
| `created_at` | Timestamp | ✅ | 建立時間 |

### 常見折讓情境

| 情境 | credit_type | 說明 |
|------|-------------|------|
| 攝影機租出後發現感光元件有問題 | equipment_malfunction | 折讓該器材部分或全部租金 |
| 客戶提前 2 天歸還 | early_return | 退還多收的 2 天租金 |
| 出借時配件少給 | service_issue | 因配件不齊折讓部分費用 |
| 老客戶下次合作折抵 | goodwill | 善意折讓，折抵下次租金 |
| 押金扣除賠償後退差額 | deposit_deduction | 押金 5,000 - 賠償 2,000 = 退 3,000 |
| 帳單計算錯誤多收 | overcharge | 退還多收金額 |

### 折讓流程

```
員工提出折讓申請 (pending)
    ↓
主管審核
    ├── approved → 執行退款/扣抵 → refund_status = completed/offset
    │                              → 自動建立一筆 Payment（負數金額）
    └── rejected → 記錄駁回原因
```

---

## 18. 付款紀錄 Payments

> 支援分次付款（先付押金、後付租金等）。退款和折讓以負數金額記錄，並關聯折讓單。
> 金流有兩種路徑：客戶直接匯公司帳戶，或先匯承辦人個人帳戶再轉入公司。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `payment_id` | String (PK) | ✅ | 付款 ID |
| `rental_id` | String (FK) | ✅ | 對應租借單 |
| `payment_type` | Enum | ✅ | `deposit`(押金) / `rental_fee`(租金) / `overdue_fee`(逾期費) / `damage_fee`(賠償金) / `deposit_refund`(押金退還) / `refund`(退款) / `credit_note`(折讓) |
| `amount` | Number | ✅ | 金額 (NT$)（收入為正數，退款/折讓為負數） |
| `credit_note_id` | String (FK) | | 對應折讓單（當 payment_type = credit_note 或 refund 時填寫） |
| `payment_method` | Enum | ✅ | `cash`(現金) / `transfer`(轉帳) / `credit_card`(信用卡) / `line_pay` / `other` |
| `payer_account_last5` | String | | 匯款人帳號後五碼（承辦人填寫，用於對帳確認） |
| `receive_channel` | Enum | ✅ | `company_direct`(直接匯公司帳戶) / `staff_relay`(先匯承辦人，再轉公司) |
| `received_by` | String (FK) | ✅ | 收款人員（承辦人） |
| `relay_status` | Enum | | `pending`(待轉入公司) / `transferred`(已轉入公司) / `na`(不適用，直接匯公司)。僅 `staff_relay` 時使用 |
| `relay_date` | Date | | 承辦人轉入公司帳戶的日期 |
| `relay_proof_url` | String | | 轉帳證明截圖 (Google Drive) |
| `payment_date` | Date | ✅ | 客戶付款日期 |
| `receipt_url` | String | | 收據/匯款截圖 (Google Drive) |
| `receipt_pdf_url` | String | | 付款收據 PDF (Google Drive)，由 Apps Script 自動產生 |
| `notes` | String | | 備註 |

### 金流路徑說明

```
路徑 A：直接匯公司（company_direct）
客戶 ──匯款──> 公司帳戶
                └─ relay_status = na

路徑 B：經承辦人中轉（staff_relay）
客戶 ──匯款──> 承辦人個人帳戶 ──轉帳──> 公司帳戶
                │                         │
                └─ relay_status = pending  └─ relay_status = transferred
                   payment_date 記錄          relay_date 記錄
                                              relay_proof_url 附轉帳截圖
```

### 範例

| payment_id | receive_channel | received_by | relay_status | payment_date | relay_date |
|------------|----------------|-------------|-------------|-------------|------------|
| PAY-001 | company_direct | S-003 | na | 2026-03-01 | |
| PAY-002 | staff_relay | S-001 | pending | 2026-03-01 | |
| PAY-002 | staff_relay | S-001 | transferred | 2026-03-01 | 2026-03-03 |

---

## 19. 出入庫紀錄 Inventory_Logs

> 完整記錄每件器材的出庫（出借）與入庫（歸還）流程。
> 入庫時執行標準化點檢，確認器材狀態後才正式歸架入庫。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `log_id` | String (PK) | ✅ | 紀錄 ID |
| `unit_id` | String (FK) | ✅ | 器材個體 |
| `rental_id` | String (FK) | | 對應租借單（新品入庫無租借單） |
| `log_type` | Enum | ✅ | `check_out`(出庫出借) / `check_in`(歸還入庫) / `new_stock`(新品入庫) / `transfer`(調撥移庫) / `maintenance_out`(送修出庫) / `maintenance_in`(修畢入庫) |
| `log_date` | Timestamp | ✅ | 出入庫時間 |
| `performed_by` | String (FK) | ✅ | 執行人員 |
| `from_location_id` | String (FK) | | 從哪個位置（出庫時填） |
| `to_location_id` | String (FK) | | 到哪個位置（入庫時填，器材歸架位置） |
| `condition_before` | Enum | ✅ | 點檢前狀態 `excellent` / `good` / `fair` / `poor` / `damaged` |
| `condition_after` | Enum | | 點檢後確認狀態（入庫時必填） |
| `checklist_completed` | Boolean | ✅ | 是否完成點檢清單 |
| `checklist_details` | String | | 點檢項目與結果（JSON 或逗號分隔） |
| `accessories_complete` | Boolean | | 配件是否齊全（主器材入庫時必填） |
| `missing_accessories` | String | | 缺少的配件描述 |
| `needs_maintenance` | Boolean | ✅ | 入庫後是否需要送修/保養 |
| `needs_cleaning` | Boolean | ✅ | 入庫後是否需要清潔 |
| `damage_found` | Boolean | ✅ | 是否發現新損壞 |
| `damage_id` | String (FK) | | 若發現損壞，對應建立的 Damage_Records |
| `photo_urls` | String | | 點檢照片（多張，逗號分隔 Google Drive 連結） |
| `inspection_certificate_url` | String | | 驗收證明文件 (Google Drive) |
| `inspection_deadline` | Date | | 點檢期限（預設歸還後 3 個工作天） |
| `inspection_completed_at` | Timestamp | | 實際完成點檢時間 |
| `inspection_overdue` | Boolean | ✅ | 是否超過點檢期限 |
| `checklist_pdf_url` | String | | 出入庫點檢單 PDF (Google Drive)，由 Apps Script 自動產生 |
| `notes` | String | | 備註 |

### 入庫標準流程

```
器材歸還
    ↓
1. 建立 Inventory_Log（log_type = check_in）
    ↓
2. 外觀點檢
   ├── 對照出庫時的 condition_out 照片
   ├── 逐項檢查點檢清單（checklist_details）
   └── 拍攝入庫照片（photo_urls）
    ↓
3. 配件清點
   ├── 齊全 → accessories_complete = true
   └── 缺少 → accessories_complete = false，記錄 missing_accessories
    ↓
4. 狀態評估
   ├── 無損壞 → damage_found = false
   │            condition_after 填寫確認狀態
   │            Equipment_Units.status → available
   │            Equipment_Units.location_id → 歸架位置
   │
   └── 有損壞 → damage_found = true
              → 自動建立 Damage_Records
              ├── 輕微（容忍度內）→ Equipment_Units.status → available
              └── 需維修 → needs_maintenance = true
                          Equipment_Units.status → maintenance
                          → 自動建立 Maintenance_Logs（scheduled）
    ↓
5. 清潔判斷
   ├── 不需要 → needs_cleaning = false
   └── 需清潔 → needs_cleaning = true（排入清潔排程）
    ↓
6. 歸架入庫
   → Equipment_Units.location_id 更新為 to_location_id
   → Equipment_Units.current_condition 更新為 condition_after
   → Equipment_Units.status 更新為 available / maintenance
```

### 出入庫類型說明

| log_type | 觸發情境 | 關鍵動作 |
|----------|---------|---------|
| `check_out` | 客戶取件出借 | 記錄出庫狀態、拍照、清空 location_id |
| `check_in` | 客戶歸還器材 | 完整點檢流程、歸架 |
| `new_stock` | 新購器材入庫 | 建立 Unit、初始點檢、指定存放位置 |
| `transfer` | 倉庫間調撥 | 更新 from/to location |
| `maintenance_out` | 送外部維修 | Unit.status → maintenance |
| `maintenance_in` | 維修完成回庫 | 重新點檢、更新狀態 |

---

## 20. 列印範本 Print_Templates

> 管理所有可列印文件的 Google Docs 範本。由 Apps Script 自動套印資料後轉出 PDF，存入 Google Drive。
> 支援四種列印情境：租借明細單、出入庫點檢單、付款收據、損壞賠償明細。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `template_id` | String (PK) | ✅ | 範本 ID，例如 `TPL-001` |
| `template_name` | String | ✅ | 範本名稱，例如「租借明細單」 |
| `template_type` | Enum | ✅ | `rental_detail`(租借明細單) / `checklist`(出入庫點檢單) / `receipt`(付款收據) / `damage_report`(損壞賠償明細) |
| `google_doc_template_id` | String | ✅ | Google Docs 範本文件 ID（用於 Apps Script 複製套印） |
| `output_folder_id` | String | ✅ | PDF 輸出資料夾 ID (Google Drive) |
| `paper_size` | Enum | ✅ | `A4` / `letter` / `A5` |
| `orientation` | Enum | ✅ | `portrait`(直式) / `landscape`(橫式) |
| `include_company_header` | Boolean | ✅ | 是否包含公司抬頭（映奧創意工作室） |
| `include_signature_line` | Boolean | ✅ | 是否包含簽名欄位 |
| `include_photos` | Boolean | ✅ | 是否嵌入器材照片（點檢單/損壞報告適用） |
| `version` | String | ✅ | 範本版本號，例如 `1.0` |
| `active` | Boolean | ✅ | 是否啟用 |
| `notes` | String | | 備註 |
| `created_at` | Date | ✅ | 建立日期 |
| `updated_at` | Date | ✅ | 最後更新日期 |

### 四種列印範本說明

| template_type | 資料來源 | PDF 存入欄位 | 內容摘要 |
|---------------|---------|-------------|---------|
| `rental_detail` | Rentals + Rental_Items + Service_Items + Discount_Rules | `Rentals.rental_detail_pdf_url` | 客戶資訊、租借器材清單、服務項目、費用明細、折扣、稅額、總計、合約條款摘要 |
| `checklist` | Inventory_Logs + Equipment_Units + Accessory_Bindings | `Inventory_Logs.checklist_pdf_url` | 器材名稱、編號、出/入庫狀態、配件清點、點檢項目勾選欄、照片、簽名欄 |
| `receipt` | Payments + Rentals + Customers | `Payments.receipt_pdf_url` | 付款人資訊、付款方式、金額、日期、匯款帳號後五碼、承辦人、收款確認章 |
| `damage_report` | Damage_Records + Equipment_Units + Wear_Tolerance | `Damage_Records.damage_report_pdf_url` | 受損器材資訊、損壞描述與照片、嚴重程度、容忍度比對、維修/賠償費用、處理結果 |

### 列印流程（Apps Script 自動化）

```
1. 使用者在 Sheets 中點擊「產生 PDF」按鈕
   ↓
2. Apps Script 讀取 Print_Templates 取得對應範本
   ↓
3. 複製 Google Docs 範本，將 {{placeholder}} 替換為實際資料
   ├── {{customer_name}} → 客戶姓名
   ├── {{rental_id}} → 合約編號
   ├── {{items_table}} → 器材明細表格
   ├── {{total_amount}} → 總金額
   └── ... 其他動態欄位
   ↓
4. 嵌入照片（若 include_photos = true）
   ↓
5. 轉出 PDF，存入指定 Drive 資料夾
   ↓
6. 將 PDF 連結回寫到對應資料表欄位
   ↓
7. （選擇性）自動寄 Email 給客戶
```

---

## 21. 盤點計畫 Stocktake_Plans

> 管理定期盤點排程。支援依分類/位置分層盤點（高價器材月盤、一般器材季盤、道具半年盤）以及年度全面盤點。
> 循環盤點每次只清點一部分器材，全面盤點則清點所有器材。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `plan_id` | String (PK) | ✅ | 盤點計畫 ID，例如 `SP-2026-001` |
| `plan_name` | String | ✅ | 計畫名稱，例如「2026 Q1 攝影器材月盤」「2026 年度全面盤點」 |
| `stocktake_type` | Enum | ✅ | `full`(全面盤點) / `cycle`(循環盤點) / `spot_check`(抽盤) |
| `scope_type` | Enum | ✅ | `all`(全部器材) / `category`(指定分類) / `location`(指定位置) |
| `scope_categories` | String | | 盤點範圍的分類清單（逗號分隔，例如 `camera,lens,monitor`），scope_type = category 時填寫 |
| `scope_location_id` | String (FK) | | 盤點範圍的位置 ID（FK → Storage_Locations），scope_type = location 時填寫 |
| `scheduled_date` | Date | ✅ | 預定盤點日期 |
| `deadline` | Date | ✅ | 盤點完成期限 |
| `assigned_to` | String (FK) | ✅ | 負責執行的員工（FK → Staff） |
| `supervised_by` | String (FK) | | 督導人員（FK → Staff），全面盤點時建議安排 |
| `status` | Enum | ✅ | `scheduled`(排程中) / `in_progress`(進行中) / `completed`(已完成) / `cancelled`(取消) |
| `total_expected` | Number | | 應盤數量（計畫啟動時自動統計） |
| `total_counted` | Number | | 已盤數量（隨盤點進度自動更新） |
| `total_matched` | Number | | 帳實相符數量 |
| `total_discrepancy` | Number | | 差異數量 |
| `completion_rate` | Number | | 完成率（%，自動計算 total_counted / total_expected） |
| `summary_notes` | String | | 盤點總結說明 |
| `report_pdf_url` | String | | 盤點報告 PDF (Google Drive) |
| `created_by` | String (FK) | ✅ | 建立此計畫的員工 |
| `created_at` | Date | ✅ | 建立日期 |
| `completed_at` | Date | | 實際完成日期 |

### 建議盤點頻率

| 分類 | 建議頻率 | 原因 |
|------|---------|------|
| `camera`, `lens`, `monitor`, `transmission` | 每月 | 高單價、流動率高，帳實差異影響大 |
| `audio`, `lighting`, `tripod`, `motion`, `teleprompter` | 每季 | 中等價值，流動率中等 |
| `accessory` | 每季 | 數量多、單價低，但容易遺失 |
| `prop_furniture`, `prop_wardrobe`, `prop_set`, `prop_vehicle`, `prop_other` | 每半年 | 數量大但流動率較低 |
| `prop_fx` | 每季 | 消耗品，需確認庫存量是否足夠 |
| 全部 | 每年一次（年底） | 年度全面盤點，與財務結算對齊 |

### 盤點流程

```
1. 建立盤點計畫（Stocktake_Plans）
   ├── 選擇盤點類型（全面/循環/抽盤）
   ├── 設定範圍（全部/指定分類/指定位置）
   └── 指定執行人員與期限
   ↓
2. 系統自動產生待盤清單
   └── 依範圍篩選 Equipment_Units（status ≠ retired）
       自動填入 total_expected
   ↓
3. 執行人員逐筆盤點
   ├── 核對實物是否存在（found / missing / extra）
   ├── 確認位置是否正確
   ├── 確認狀態是否正確
   └── 記錄到 Stocktake_Results
   ↓
4. 差異處理
   ├── 位置錯誤 → 更新 Equipment_Units.location_id
   ├── 狀態錯誤 → 更新 Equipment_Units.status / current_condition
   ├── 找不到 → 標記 missing，啟動追查
   ├── 多出來 → 標記 extra，確認是否為未登記器材
   └── 數量差異（批次品）→ 更新 batch_quantity
   ↓
5. 完成盤點
   ├── 計畫狀態 → completed
   ├── 產生盤點報告 PDF
   └── 督導人員覆核簽認
```

---

## 22. 盤點結果明細 Stocktake_Results

> 每筆盤點明細對應一件器材個體（或一組批次品）。記錄帳面資料與實際狀況的比對結果。

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `result_id` | String (PK) | ✅ | 結果明細 ID |
| `plan_id` | String (FK) | ✅ | 對應盤點計畫 |
| `unit_id` | String (FK) | ✅ | 對應器材個體 |
| `expected_location_id` | String (FK) | | 帳面存放位置（從 Equipment_Units.location_id 帶入） |
| `actual_location_id` | String (FK) | | 實際發現位置（盤點人員填寫） |
| `location_match` | Boolean | ✅ | 位置是否相符 |
| `expected_status` | Enum | ✅ | 帳面狀態（從 Equipment_Units.status 帶入） |
| `actual_status` | Enum | ✅ | 實際狀態（盤點人員填寫）`available` / `rented` / `maintenance` / `damaged` / `missing` / `extra` |
| `status_match` | Boolean | ✅ | 狀態是否相符 |
| `expected_condition` | Enum | ✅ | 帳面器材狀況（從 Equipment_Units.current_condition 帶入） |
| `actual_condition` | Enum | ✅ | 實際器材狀況（盤點人員填寫）`excellent` / `good` / `fair` / `poor` / `damaged` |
| `condition_match` | Boolean | ✅ | 狀況是否相符 |
| `expected_quantity` | Number | | 帳面數量（批次品用，從 Equipment_Units.batch_quantity 帶入） |
| `actual_quantity` | Number | | 實際清點數量（批次品用） |
| `quantity_match` | Boolean | | 數量是否相符（批次品用） |
| `result` | Enum | ✅ | `matched`(完全相符) / `location_wrong`(位置不符) / `status_wrong`(狀態不符) / `condition_wrong`(狀況不符) / `quantity_wrong`(數量不符) / `missing`(找不到) / `extra`(多出來的) / `multiple_issues`(多重差異) |
| `photo_url` | String | | 盤點拍照 (Google Drive) |
| `resolution_action` | Enum | | `none`(無需處理) / `location_updated`(已更新位置) / `status_updated`(已更新狀態) / `condition_updated`(已更新狀況) / `quantity_adjusted`(已調整數量) / `investigation`(調查中) / `write_off`(報廢除帳) / `new_registration`(新登記) |
| `resolution_notes` | String | | 差異處理說明 |
| `resolved_by` | String (FK) | | 處理人員 |
| `resolved_at` | Date | | 處理日期 |
| `counted_by` | String (FK) | ✅ | 盤點人員 |
| `counted_at` | Timestamp | ✅ | 盤點時間 |

### 盤點結果類型說明

| result 值 | 說明 | 建議處理 |
|-----------|------|---------|
| `matched` | 帳面與實際完全相符 | 無需處理 |
| `location_wrong` | 器材在，但不在帳面位置 | 更新 Equipment_Units.location_id |
| `status_wrong` | 狀態不符（例如帳面 available 但實際已出借） | 調查並更新狀態 |
| `condition_wrong` | 器材狀況與帳面不符（例如帳面 good 但實際 poor） | 更新 current_condition，視需要建立 Maintenance_Logs |
| `quantity_wrong` | 批次品數量與帳面不符 | 調查差異原因，更新 batch_quantity |
| `missing` | 帳面有但實際找不到 | 啟動追查：確認是否在外租借、送修中、或真的遺失 |
| `extra` | 實際有但帳面沒有（未登記器材） | 確認來源後建立新的 Equipment_Unit |
| `multiple_issues` | 多種差異同時存在 | 逐項處理並記錄 |

---

## 23. 資料關聯圖

> 含盤點系統的關聯

```
Storage_Locations ──< Storage_Locations (parent 階層)
       │
       └──< Equipment_Units (存放位置)

Equipment_Types ──< Equipment_Units
       │                    │
       │                    ├── Inventory_Logs (出入庫) ──> Storage_Locations
       │                    │
       │                    ├── Maintenance_Logs
       │                    │
       ├── Accessory_Bindings (parent ↔ accessory)
       │
       ├── Wear_Tolerance (by category)
       │
       └── Discount_Rules (by type/category)

Customers ──< Rentals ──< Rental_Items ──> Equipment_Types
                │              │                    │
                │              │              Equipment_Units
                │              │
                ├── Service_Items (服務項目)
                │
                ├── Rental_Addendums (附約)
                │
                ├── Damage_Records ──> Equipment_Units
                │
                ├── Credit_Notes (折讓/退款) ──> Damage_Records
                │        │
                │        └──> Payments (核准後自動建立負數 Payment)
                │
                ├── Payments (多筆，含退款)
                │
                ├── Overdue_Rules (計算逾期費)
                │
                └── Staff (prepared_by / handled_by / approved_by)

Print_Templates ──> Rentals (rental_detail PDF)
               ──> Inventory_Logs (checklist PDF)
               ──> Payments (receipt PDF)
               ──> Damage_Records (damage_report PDF)

Stocktake_Plans ──< Stocktake_Results ──> Equipment_Units
       │                                       │
       ├── Staff (assigned_to / supervised_by)  └── Storage_Locations (actual vs expected)
       └── Storage_Locations (scope_location_id)

Staff ──> Rentals
     ──> Equipment_Types (created_by)
     ──> Equipment_Units (created_by)
     ──> Maintenance_Logs
     ──> Damage_Records
     ──> Payments
     ──> Storage_Locations (responsible_staff)
     ──> Stocktake_Plans (assigned_to / supervised_by / created_by)
     ──> Stocktake_Results (counted_by / resolved_by)
```

---

## 24. Google Workspace 對應實作

| Schema 表 | Google 工具 | 說明 |
|-----------|------------|------|
| Storage_Locations | Google Sheets | 倉儲位置管理（階層式） |
| Equipment_Types | Google Sheets | 器材類型主表 |
| Equipment_Units | Google Sheets | 每件器材一行 |
| Accessory_Bindings | Google Sheets | 配件綁定關係 |
| Maintenance_Logs | Google Sheets + Drive | 保養紀錄 + 照片 |
| Customers | Google Sheets + Drive | 客戶資料 + 證件掃描 |
| Staff | Google Sheets | 員工權限管理 |
| Rentals | Google Sheets + Apps Script | 主約 + 自動編號 |
| Rental_Items | Google Sheets | 租借明細 |
| Service_Items | Google Sheets | 服務項目 |
| Rental_Addendums | Google Sheets + Docs | 附約 + PDF 產生 |
| Discount_Rules | Google Sheets | 折扣規則表 |
| Overdue_Rules | Google Sheets | 逾期規則表 |
| Damage_Records | Google Sheets + Drive | 損壞紀錄 + 照片 |
| Wear_Tolerance | Google Sheets | 損耗標準表 |
| Credit_Notes | Google Sheets + Drive | 折讓/退款單 + 佐證資料 |
| Payments | Google Sheets | 付款紀錄（含退款） |
| Inventory_Logs | Google Sheets + Drive + Forms | 出入庫點檢紀錄 + 照片 + 點檢表單 |
| Print_Templates | Google Sheets + Docs + Apps Script + Drive | 範本管理 + 套印產生 PDF + 存檔 |
| Stocktake_Plans | Google Sheets + Apps Script | 盤點計畫排程 + 自動產生待盤清單 |
| Stocktake_Results | Google Sheets + Forms + Drive + Apps Script | 盤點結果填報（可用 Forms）+ 照片 + 差異報告 PDF |
| 合約產生 | Google Docs + Apps Script | 範本套印 → PDF → Drive |
| 租借申請入口 | Google Forms → Sheets | 客戶線上申請 |
| 電子簽署 | Google Forms / Docs | 線上確認簽署 |

---

## 25. 設計決策紀錄

| # | 議題 | 決策 | 原因 |
|---|------|------|------|
| 1 | 同品項多件管理 | 配件類拆分為 Type + Unit 兩層 | 需個別追蹤狀態與序號 |
| 2 | 配件出租方式 | 綁定主器材，不可單獨借出 | 業務需求：讀稿機/攝影機配件必須完整 |
| 3 | 保養紀錄 | 獨立 Maintenance_Logs 表 | 支援定期保養排程與外送維修追蹤 |
| 4 | 預約制 | Rentals 有 reserved 狀態 + actual 日期欄位 | 行業變動大，實際取件/歸還時間可能不同 |
| 5 | 續租/變更 | 以附約 (Addendum) 方式處理 | 不修改主約，保留完整變更歷史 |
| 6 | 逾期費 | 按日租費倍率計算 | 簡單明確，可依分類設不同倍率 |
| 7 | 付款紀錄 | 獨立 Payments 表，支援多筆 | 押金可能先付給承辦人，後續再付租金 |
| 8 | 合約簽署 | 電子合約（Google Docs → PDF） | 減少列印，線上簽署 |
| 9 | 員工角色 | 區分 prepared_by 與 handled_by | 準備器材的人與當天承辦可能不同 |
| 10 | 美術道具 | 透過 category 擴充 + is_consumable 標記 | 統一管理，消耗品另行處理 |
| 11 | 批次出租 | is_batch_item + batch_quantity | 支援「50 張椅子」等批量道具管理 |
| 12 | 損耗容忍度 | 依 category 設定不同標準 | 攝影器材與道具磨損標準不同 |
| 13 | 存放位置管理 | 階層式倉儲位置（倉庫→樓層→區域→貨架） | 美術道具量大，需快速定位存放位置 |
| 14 | 折讓/退款 | 獨立 Credit_Notes 表 + 審批流程 | 器材故障折讓、提前歸還退費、押金扣抵等需完整追蹤原因與核准紀錄 |
| 15 | 金流路徑 | Payments 加入 receive_channel + relay 欄位 | 客戶可能匯公司帳戶或承辦人個人帳戶，需追蹤中轉狀態避免款項遺漏 |
| 16 | 匯款驗證 | Payments 加入 payer_account_last5 | 承辦人填寫對方帳號後五碼，方便對帳確認 |
| 17 | 入庫流程 | 獨立 Inventory_Logs 表 + 標準化點檢流程 | 歸還時需點檢外觀、配件、狀態，決定歸架或送修，並自動更新器材狀態與位置 |
| 18 | 服務項目 | 獨立 Service_Items 表 | 教學、運送、架設等非器材服務需獨立計價追蹤 |
| 19 | 發票追蹤 | Rentals 加入 invoice 欄位群 | 需追蹤統一編號、發票狀態、檔案連結 |
| 20 | 證件管理 | Customers 加入驗證與歸還狀態 | 證件收取後需追蹤驗證與歸還流程 |
| 21 | 逾期買斷 | Overdue_Rules 加入 forced_purchase_days | 合約規定逾期 15 天視為買斷 |
| 22 | 罰款上限 | Overdue_Rules 加入 max_penalty_rate | 逾期罰款不超過器材市值 30% |
| 23 | 驗收證明 | Inventory_Logs 加入 inspection 欄位 | 歸還後需出具驗收證明，3 個工作天內完成 |
| 24 | 高風險用途 | Rentals 加入 use_risk_category 結構化分類 | 路跑、車拍、水上活動等需額外告知與加收費用 |
| 25 | 取消政策 | Rentals 加入 cancellation 欄位群 | 需追蹤取消原因、手續費、退款金額 |
| 26 | 部分歸還 | Rental_Items 加入 return_status 欄位 | 批次品可能分批歸還，需追蹤各項目歸還狀態 |
| 27 | 點檢期限 | Inventory_Logs 加入 inspection_deadline | 歸還後 3 個工作天內須完成點檢，逾期標記 |
| 28 | 內部編號自動產生 | internal_code 由 Apps Script 自動產生 | 格式「分類代碼-年份-流水號」，建立 Unit 時自動填入，避免人工編碼錯誤 |
| 29 | 列印範本系統 | 獨立 Print_Templates 表 + 四種範本 | Google Docs 範本套印→PDF，支援租借明細、點檢單、收據、賠償報告，自動回寫連結 |
| 30 | 運送地址 | Rentals 加入 delivery 欄位群 + Service_Items 加入 service_address | 運送服務需客戶填寫地址與現場聯絡人，個別服務可指定不同地點 |
| 31 | 登記人員追蹤 | Equipment_Types 與 Equipment_Units 加入 created_by (FK → Staff) | 追蹤每筆器材類型與個體資料是由哪位員工建立的，便於稽核與問題追溯 |
| 32 | 盤點系統 | 新增 Stocktake_Plans + Stocktake_Results 兩張表 | 分層盤點（高價月盤、中價季盤、道具半年盤）+ 年度全面盤點，記錄帳實差異與處理結果，支援循環盤點與抽盤 |
