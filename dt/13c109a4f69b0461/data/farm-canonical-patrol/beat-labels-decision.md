# 展示選擇 —— 病蟲害擴散與巡田情境的每格段落標題

Authority: Claude Code lane on Will's instruction, 2026-09-28: 'hmm. the use cases are not clear. 巡田 is a feature, identify pest spread is another'

本檔由 Claude Code lane 於 2026-09-28 依 Will 當日的指示寫成，原話：

> "hmm. the use cases are not clear. 巡田 is a feature, identify pest spread is another"

依據是 `AGENTS.md`〈Director mandate〉記錄的 Will 2026-09-24 裁定：demo 與資料選擇由
Director（團隊：dragon5285、AskaYu800304、kevin70504）決定，寫成具名、具日期的決策檔。
這裡的值是**我們替團隊先補上的**，不是團隊的裁示。**Director（團隊）可以隨時用一份較晚的
日期決策檔取代本檔**，不必先問我們；取代時本檔保留為 2026-09-28 的記錄，不改寫位元組。

## 為什麼要這份選擇

檢視器每一格上方有一行段落標題。病蟲害擴散與巡田兩個情境沿用總覽的標題（例如第 1 格
「蜂箱與田區提醒」），觀眾看不出兩個情境各在講什麼。這裡讓每個情境每一格有自己的標題：
病蟲害擴散講擴散走到哪一步，巡田講走到哪一站。總覽的標題不變。

## 選擇

### 用語（bake 從這一段讀取，不寫在程式裡）

```
pest origin beat:    鄰近農場出現蟲害（模擬）
pest reach beat:     蟲害擴散至{faces}（模擬）
pest grow beat:      {faces} 受害植株增加（模擬）
pest last beat:      {faces} 持續擴散；其他作物維持健康（模擬）
patrol propose beat: AI 建議 {count} 個巡田點（模擬）
patrol visit beat:   巡田點 {order}：{target}
patrol travel beat:  前往巡田點 {order}（模擬）
patrol done beat:    {count} 個巡田點皆已到站（模擬）
patrol log beat:     作業紀錄（模擬）
```

### 每一格用哪一句（由 bake 從 frames 判定，panel 與檢視器只照登）

「受影響」指這一格有任一株（或整塊 Face）階段高於「健康」。`{faces}` 是田區顯示標籤，以「、」相連，
不含起點（鄰近農場）。

- **病蟲害擴散**
  - 第 0 格：受影響的只有起點（鄰近農場）→ `pest origin beat`。
  - 最後一格 → `pest last beat`，`{faces}` 為這一格所有受影響的田區。
  - 這一格有新的田區受影響 → `pest reach beat`，`{faces}` 為新受影響的田區。
  - 否則 → `pest grow beat`，`{faces}` 為受害株數比上一格多的田區。
- **巡田**
  - 最後一格帶作業紀錄事件 → `patrol log beat`。
  - 這一格有新到站的巡田點 → `patrol visit beat`，`{order}` 為站序，`{target}` 為目標株的顯示標籤。
  - 第 0 格（尚未到站）→ `patrol propose beat`，`{count}` 為 frames 宣告的站數。
  - 所有站都已到 → `patrol done beat`；尚有未到的站 → `patrol travel beat`，`{order}` 為下一站。

## 這不是什麼

- 不是新的執行期狀態；每一句只重述該格 frames 已宣告的內容，匯出時逐格核對，說得和 frames 不一樣就拒絕匯出。
- 不是病蟲害診斷或巡田作業建議。

## 可修訂性

本檔可由後續具日期、具名並載明取代內容的決策檔取代，Director（團隊）優先。
