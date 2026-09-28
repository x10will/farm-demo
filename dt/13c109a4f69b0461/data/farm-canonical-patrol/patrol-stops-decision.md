# 展示選擇 —— AI 建議的巡田站點：規則與分數

Authority: Claude Code lane on Will's instruction, 2026-09-28: 'scenario selector is cheap. patrol stops means the system suggests? observation can be mocked, we don't know how they patrol yet.'

本檔由 Claude Code lane 於 2026-09-28 依 Will 當日的指示寫成，原話：

> "hmm. the use cases are not clear. 巡田 is a feature, identify pest spread is another"

> "scenario selector is cheap. patrol stops means the system suggests? observation can be mocked, we don't know how they patrol yet."

依據是 `AGENTS.md`〈Director mandate〉記錄的 Will 2026-09-24 裁定：demo 與資料選擇由
Director（團隊：dragon5285、AskaYu800304、kevin70504）決定，寫成具名、具日期的決策檔。
這裡的值是**我們替團隊先補上的**，不是團隊的裁示。**Director（團隊）可以隨時用一份較晚的
日期決策檔取代本檔**，不必先問我們；取代時本檔保留為 2026-09-28 的記錄，不改寫位元組。

## 為什麼要這份選擇

2026-09-26 的巡田路線（`2026-09-26-farm-ai-patrol-route.md`）只回答「走哪一條路」。Will 問的是
「系統建議去哪裡看」：一組編號站點，每站說明為什麼要看、看什麼，依擴散風險排序。

## 與既有裁示的關係

- **2026-09-26 巡田路線：沿用它的巡田網與起點，不改寫該檔。** 巡田網是參觀動線網的九個 Node 與
  十條有向 Edge，起點 `visitor-path-network-node-01`。總覽情境照舊使用該檔的路線。
- **巡田情境不用該檔的「到達目標田」分數**，改用本檔的站點規則；兩者並存，各屬一個情境。
- 擴散鏈與逐株起點照 `2026-09-26-farm-cross-farm-spread-scenario.md`，本檔不改。

## 選擇

```
stop network:    the patrol network and start declared in 2026-09-26-farm-ai-patrol-route.md
watch radius:    20.000 m   (horizontal, local_m, from a stop Node to a planting point)
```

### 被看顧的株

與擴散起點 Face 同作物組、在雅歌園邊界內的 Face 裡，**frame 0 健康、之後某一格受害**的種植點。
「受害格」是它第一次高於「健康」的那一格。

### 候選站點與分數（bake 計算，agent 呼叫的是同一個函式）

候選站點是巡田網的每一個 Node。一個 Node 看得到監看半徑內的被看顧株；看不到任何一株的 Node 不是候選。
每個候選的分數：

1. **目標株**：它看得到的株中受害格最早者；平手依序比離「前一格已受害的任一株」較近、離站點較近、stable ID 較小。
2. **受害格**：目標株的受害格。
3. **離已受害株距離**：目標株到它受害前一格已受害的最近一株（邊界外的鄰農場也算），量化到 0.001 m。

### 風險排序與站點

- **排序**：受害格較早者先；平手離已受害株較近者先；再平手取 Node 的 stable ID。
- **選站**：依排序逐一考慮。加入後，若從起點沿 Edge 宣告方向、不重複經過 Node 的路徑，無法依序
  經過全部已選站點，就略過這個候選。站點數上限是格數減 2：frame 0 是提案，最後一格是作業紀錄。
- **路線**：依序經過全部站點、終點是最後一站的簡單有向路徑中最短者；同長取成員 ID 序列較小者。
- **採用規則**：agent 提案的站點、順序與路線必須就是上面的答案；bake 重算每個候選的分數並與記錄比對，
  不相符就拒絕 bake，不會悄悄換成別的。

### 依規則會播出什麼（預期值，由 bake 算出並以測試核對）

| 站 | Node | 目標株 | 受害格 | 離已受害株 | 到站格 |
|---:|---|---|---:|---:|---:|
| 1 | `visitor-path-network-node-09` | `field-eta-tree-0001`（田區 1） | 1 | 35.1 m（鄰農場 tree-0072） | 1 |
| 2 | `visitor-path-network-node-05` | `field-theta-tree-0012`（田區 3） | 3 | 28.2 m | 2 |
| 3 | `visitor-path-network-node-06` | `field-theta-tree-0009`（田區 3） | 5 | 4.5 m | 3 |

- `node-03`（目標 `field-eta-tree-0016`，受害格 5，3.9 m）排在第三，但巡田網從 `node-05` 無法不重複
  經過 Node 而回到 `node-03`，所以略過。
- 路線：`node-01 → node-02 → node-09 → node-03 → node-04 → node-05 → node-06`。
- frame 4 沒有新站；frame 5 是作業紀錄。

### 誰提案、記下什麼

- 提案者：編寫時執行的 PydanticAI agent，模型為 Wimba 上的 `gemma-4-26b-a4b-it-4bit`
  （`http://wimba.local:8080/v1`）。agent 拿到候選站點清單、從起點出發的有向路徑清單與兩個工具：
  `score_stop`（呼叫 bake 的分數函式）與 `walkable`（回答哪些路徑依序經過給定的站點，也是 bake 自己的檢查）。
  它要回依序的站點、每站一句理由與路線。
- 提案不合規則時，bake 的拒絕理由會回給 agent 再試一次（「agent 提案、模擬器評分、agent 修正」），
  但拒絕理由中規則的答案會先刪掉，所以重試是 agent 自己的工作，不是照抄。
- 記錄：agent 與模型名稱、提示與輸入的 SHA-256、每個候選站點與分數、agent 試過的候選、選中的站點與
  理由、路線、執行時間。
- 最佳解用規則就算得出來。**agent 的價值在於把「先看最快會倒的株」變成宣告的輸入並說明每站的理由**；
  我們不宣稱它比規則更聰明。

## 這不是什麼

- 不是真實的巡田排程或作業建議，也不是病蟲害診斷。「AI 建議」標示的是 agent 在 pipeline 的位置。
- player 不規劃、不修補、不重新選站或選路；runtime 沒有 LLM 或路徑搜尋。
- 不改變參觀動線網的幾何、識別碼、方向或標籤。

## 可修訂性

本檔可由後續具日期、具名並載明取代內容的決策檔取代，Director（團隊）優先。
