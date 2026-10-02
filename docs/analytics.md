# 匿名遊玩數據（Google Analytics 4）

遊戲內用 GA4 自訂事件記錄玩家進度（`src/analytics.ts`，Measurement ID `G-1E6L28ZG6Z`）。
itch.io「Third-party analytics」填的 ID 只追蹤專案頁面；遊戲本身在 iframe（`html-classic.itch.zone`）裡，事件由遊戲自己送。

## 什麼時候會送

- 只在 http(s) 正式網站（itch.io、VIVERSE）；本機檔案、Claude Artifact、localhost、自動化測試（navigator.webdriver）都不送
- 玩家可在設定頁「隱私 → 傳送匿名遊玩數據」關掉（存在 `lastlight-colony-settings`）
- 不記任何個人資料；GA 自己產生匿名 client id

## 事件

| 事件 | 參數 | 時機 |
|---|---|---|
| `game_start` | `new_game`、`chapter`、`play_minutes` | 從標題畫面進入遊戲 |
| `chapter_reached` | `chapter`、`play_minutes` | 進入第 2～6 章 |
| `first_raid` | `play_minutes` | 第一次襲擊結束 |
| `route_chosen` | `route`（coop／resist）、`play_minutes` | 第 5 章第一次面對使者 |
| `ending` | `choice`（stay／leave）、`route`、`play_minutes` | 通關 |
| `heartbeat` | `chapter`、`play_minutes` | 每玩 10 分鐘（遊戲時間） |

每個事件都帶 `game_version`。讀檔時不會補送已經發生過的事件。

## GA 後台設定

1. **管理 → 自訂定義 → 建立自訂維度**（範圍：事件）：`chapter`、`route`、`choice`、`new_game`、`game_version`
2. **管理 → 自訂定義 → 建立自訂指標**：`play_minutes`（單位：標準）
3. 測試時看 **管理 → DebugView**；一般報表要 24～48 小時才出現
4. 看各章流失：**探索 → 程序探索（Funnel exploration）**，步驟依序為 `game_start` → `chapter_reached`（chapter = 2）→ … → `ending`
