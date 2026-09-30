# 巡田預覽後的產品方向修正 — 2026-09-29

來源：Will，2026-09-29，在 Codex 對話中看過本機 build `2785703ba5fef73d` 後。由 Codex 原樣記錄產品方向，不代稱為 Director 團隊的資料裁示。

> 1) playbacking: I thought it's one timeline. history is history. Next we can move dates.
> 2) suggested is suggested routes, this can have a panel, but this is the same day today, you only see different 1-2-3-4
> 3) idle for three days is one future but not a fixed scenario. The real use case is probably using a baseline of going suggested routes every day from now on, and the user can mark a few days off. that probably calls for a calender widget

## 已明確的修正

1. 只有一條巡田日期時間軸，歷史是同一份紀錄；使用者可以移動日期。
2. 建議呈現當日巡田路線，允許一個專屬路線面板；路線的查看／選擇和日期移動分離。
3. 未來比較的 baseline 是每天依建議巡田；休巡日期由使用者在日曆選取。「停巡三天」只是一種可能的排程，不是產品固定情境。

本紀錄取代前一變更 design D1 的「歷史／建議／停巡 3 天」入口、D2 的使用者可見 variant reload 模型、D7／D9 的固定停巡比較與 D13 的三段播放旅程。它不抹去前一候選、收據、code review 或測試結果，但那些結果不能證明修正後旅程已完成。

持續有效：模擬標示與資料 lineage；一份歷史；按天而非按小時；地圖 focus 不產生已巡事實；canonical frames 是 runtime facts 的權威；非 live AI、非科學診斷；單一地圖與簡化 UX；實作可由 agents 平行處理。

## 仍需一句語義釐清

「different 1-2-3-4」可以指同一天的四條候選路線，也可以指同一條路線中的四個依序站點。Codex 最初回覆曾暫時寫成 1 -> 2 -> 3 -> 4，但那是解讀，並不是使用者已裁定的資料模型。這個差異會改變 route identity、選取行為與 baseline，因此在此不將任一解讀當成已確認需求。

目前不要求使用者重新批准已明確的三項方向，也不請使用者決定模擬日期、資料、演算法或實作工具。路線編號的語義釐清後，延續既有實作授權。
