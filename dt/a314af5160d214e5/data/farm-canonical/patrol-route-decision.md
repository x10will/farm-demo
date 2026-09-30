# 展示選擇 —— AI 提案的巡田路線

Authority: Claude Code lane on Will's instruction, 2026-09-26: 'We identify the gaps and close from our side as much as possible'

本檔由 Claude Code lane 於 2026-09-26 依 Will 當日的指示寫成，原話：

> "We identify the gaps and close from our side as much as possible"

依據是 `AGENTS.md`〈Director mandate〉記錄的 Will 2026-09-24 裁定：demo 與資料選擇由
Director（團隊：dragon5285、AskaYu800304、kevin70504）決定，寫成具名、具日期的決策檔。
這裡的值是**我們替團隊先補上的**，不是團隊的裁示。**Director（團隊）可以隨時用一份較晚的
日期決策檔取代本檔**，不必先問我們；取代時本檔保留為 2026-09-26 的記錄，不改寫位元組。

## 為什麼要這份選擇

2026-10-03 workshop 要呈現「AI agent 可以在哪裡幫忙」。專案自己的提案早就想要巡田路線
（`docs/background/poc-issues-deck-20260623.md` 第 2 項：「依熱區地圖與流行病傳播趨勢，
自動規劃巡航…產出最佳航線」），但版本庫裡沒有任何巡田模型。workshop 研究第三部分建議的做法是
「agent 提案、模擬器評分、agent 修正」，而且提案發生在**編寫時**，不是播放時：

- `AGENTS.md`〈Spatial and runtime truth〉：canonical frames 是路線的唯一 runtime 權威；
  player 不得推導、修補或重新規劃路線。
- `packages/farm-build/src/farm_build/frame_baker/preselected_route.py` 拒收 `planner`、
  `algorithm`、`route_request`、`start_node_id`、`goal_node_id` 等欄位，只收
  `selection: "scenario-preselected"`。

所以 AI 只在 bake 之前提一個路線；路線寫進情境輸入，連同出處一起 bake；player 只重播。

## 選擇

### 巡田網：沿用已宣告的參觀動線網，不另畫新路

巡田點與巡田路段就是拓樸裡已宣告的 `visitor-path-network-*`：九個 Node（`node-01`…`node-09`）
與十條有向 Edge。它們是 2026-09-01 目視判讀的場內步道（`reference/sources/derived/farm-site-export/visitor-path-network-visual-trace-20260901.json`），
本來就沿著三塊田與溫室走。另畫一套巡田路會是同一條步道的第二份幾何，違反 `AGENTS.md`
〈Gate provenance〉「Prefer reuse to reimplementation」。本檔只宣告這些 Node 與 Edge **兼作巡田用**；
它們的幾何、識別碼與標籤不變。

```
patrol network:  visitor-path-network node-01 .. node-09 and its ten Edges, as declared
patrol start:    visitor-path-network-node-01
reach distance:  3.000 m   (edge-to-edge, local_m, from a route's last Node to the target Face)
```

- **起點 `node-01`**：步道網南端、離民宿與溫室 A 最近的端點（距溫室 A 6.42 m）。巡田從建物那一側出發。
- **路線只能順著 Edge 的宣告方向走**（`preselected_route.py` 的既有規則）。從 `node-01` 出發的
  每一條不重複經過 Node 的有向路徑，都是候選。

### 路線意圖：先到下一塊會倒的田

- **目標田**：由 bake 從擴散鏈算出——雅歌園邊界內、第一塊由健康轉為受影響的 Face。依
  `2026-09-26-farm-cross-farm-spread-scenario.md`，那是田區 1（`field-eta`，frame 1 進入第 2 級、
  frame 2 上色）。目標不寫死在本檔；情境改了，目標跟著鏈條走。
- **分數**（由 bake 計算，agent 呼叫的是同一個函式）：
  1. 路線最後一個 Node 與目標田的邊到邊距離不超過 3.000 m，才算「到達」；
  2. 到達的路線中，沿 Edge 的總長越短越好；同長時取 stable ID 序列較小者。
- **採用規則**：agent 的提案必須是所有候選中分數最好的一條，bake 重算分數並與提案記錄比對；
  不相符就拒絕 bake，不會悄悄換成別條。

### 誰提案、記下什麼

- 提案者：編寫時執行的 PydanticAI agent，模型為 Wimba 上的 `gemma-4-26b-a4b-it-4bit`
  （`http://wimba:8080/v1`）。agent 拿到的是候選清單、每條候選由 bake 算出的分數，以及擴散鏈；
  它要回一條路線與一句理由。
- 記在情境輸入與報告裡的出處：agent 與模型名稱、提示與輸入的 SHA-256、試過的每一條候選與其分數、
  選中的那一條、理由原文、執行日期。
- 這一步的最佳解用窮舉就找得到（候選只有十條上下）。**agent 的價值在於把「先到下一塊會倒的田」
  這個意圖變成一條宣告的輸入，並說明理由**；我們不宣稱它比窮舉更聰明。

### 畫面上怎麼呈現

- 路線與提案事件都進 canonical frames，事件在整段十分鐘都有效。
- 通知文字：「巡田路線：AI 提案（模擬）」，並列出路線經過的 Node 顯示標籤與目標田。
- 通知旁照舊顯示「本示範資料皆為模擬」與「僅供原型展示，非農場操作建議」。

## 這不是什麼

- 不是真實的巡田排程或作業建議，也不是病蟲害診斷；「AI 提案」四個字是展示 agent 可以放在
  pipeline 的哪一段，不是推薦農友照著走。
- player 不規劃、不修補、不重新選路；runtime 沒有任何 LLM 或路徑搜尋。
- 不改變參觀路線（四拍敘事第四拍的 `education-pavilion-entrance → visitor-corridor →
  field-learning-stop`）；巡田路線是另一層，兩者並存。
- 不改變步道網的幾何、識別碼、方向或標籤。

## 可修訂性

本檔可由後續具日期、具名並載明取代內容的決策檔取代，Director（團隊）優先。
