# 展示選擇 —— 病蟲害擴散警示：害蟲、用語與熱線

Authority: Claude Code lane on Will's instruction, 2026-09-28: 'hmm. the use cases are not clear. 巡田 is a feature, identify pest spread is another'

本檔由 Claude Code lane 於 2026-09-28 依 Will 當日的指示寫成，原話：

> "hmm. the use cases are not clear. 巡田 is a feature, identify pest spread is another"

> "alert is cheap also."

依據是 `AGENTS.md`〈Director mandate〉記錄的 Will 2026-09-24 裁定：demo 與資料選擇由
Director（團隊：dragon5285、AskaYu800304、kevin70504）決定，寫成具名、具日期的決策檔。
這裡的值是**我們替團隊先補上的**，不是團隊的裁示。**Director（團隊）可以隨時用一份較晚的
日期決策檔取代本檔**，不必先問我們；取代時本檔保留為 2026-09-28 的記錄，不改寫位元組。

## 為什麼要這份選擇

病蟲害擴散情境要一張警示卡，回答：什麼、在哪裡、多少、從何時開始、出處，以及哪些田有風險、為什麼。
擴散鏈早就有了（`2026-09-26-farm-cross-farm-spread-scenario.md`），但鏈裡只有階段，沒有害蟲名稱，
也沒有給觀眾讀的句子。

## 選擇

### 害蟲：東方果實蠅（模擬）

黃金果（*Pouteria caimito*）是熱帶果樹，屏東平原的熱帶果園常見的果實害蟲是東方果實蠅
（*Bactrocera dorsalis*）。我們選它，是因為觀眾一聽就懂「果樹、會飛、會跨園」，
不是因為雅歌園或任何鄰近農場有這個疫情。**畫面上每次出現都標「模擬」。**

### 用語（bake 從這一段讀取，不寫在程式裡）

```
pest name:       東方果實蠅（Bactrocera dorsalis）
alert title:     蟲害擴散警示（模擬）
alert what:      模擬害蟲「{pest}」危害{crop}；模擬情境，非真實疫情
how much text:   受影響植株 {affected}／{total}（模擬）
since text:      模擬時間 {mm}:{ss} 起
at risk reason:  與受害的{origin}同為{crop}（模擬）
notice:          本展示不提供防治建議；實際疫情請洽高雄農改場或 0800-069880
```

- `{pest}` 是上面的害蟲名稱；`{crop}` 讀自起點 Face 的模擬 `crop` 欄位（`species_name_zh`）；
  `{origin}` 是起點 Face 的顯示標籤。
- **熱線那一行照本 lane 2026-09-28 設計（CTO 依 Will 當日指示所寫）指定的原文登錄**，一字不改；
  Will 的原話沒有這一行。號碼或單位若過時，由較晚的決策檔更正。

### 數字怎麼算（由 bake 從 frames 算出，panel 不重算）

- **在哪裡：** 這一格階段高於「健康」的 Face。
- **多少：** 每塊受影響的 Face，這一格階段高於「健康」的種植點數，除以該 Face 宣告的種植點數。
- **從何時：** 起點 Face 第一次高於「健康」的那一格，換成模擬時間。
- **有風險的田：** 與起點 Face 同作物組、在雅歌園邊界內、這一格仍健康的 Face。

每一格一則警示事件（`pest-spread-alert`），只在那一格有效。

## 這不是什麼

- 不是病蟲害診斷，也不是防治建議；卡上不出現任何用藥、清園或處置字眼。
- 不宣稱雅歌園或任何真實農場有東方果實蠅疫情。

## 可修訂性

本檔可由後續具日期、具名並載明取代內容的決策檔取代，Director（團隊）優先。
