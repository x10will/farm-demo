# 展示選擇 —— 三個情境：總覽、巡田、病蟲害擴散

Authority: Claude Code lane on Will's instruction, 2026-09-28: 'hmm. the use cases are not clear. 巡田 is a feature, identify pest spread is another'

本檔由 Claude Code lane 於 2026-09-28 依 Will 當日的指示寫成，原話：

> "hmm. the use cases are not clear. 巡田 is a feature, identify pest spread is another"

> "scenario selector is cheap. patrol stops means the system suggests? observation can be mocked, we don't know how they patrol yet. alert is cheap also. AI narrator really comes from the overall ingest of news, data, the twin."

依據是 `AGENTS.md`〈Director mandate〉記錄的 Will 2026-09-24 裁定：demo 與資料選擇由
Director（團隊：dragon5285、AskaYu800304、kevin70504）決定，寫成具名、具日期的決策檔。
這裡的值是**我們替團隊先補上的**，不是團隊的裁示。**Director（團隊）可以隨時用一份較晚的
日期決策檔取代本檔**，不必先問我們；取代時本檔保留為 2026-09-28 的記錄，不改寫位元組。

## 為什麼要這份選擇

95cc343 的線上 demo 把擴散、巡田路線、蜂箱提醒與訪客群組放在同一條時間軸上。Will 看完說兩個用例
不清楚：巡田是一個功能，找出病蟲害擴散是另一個。把它們拆成可以各自播放的情境，是他說的
「scenario selector is cheap」。

## 選擇

```
scenario overview:  總覽        mount farm-canonical          今天的候選，位元組不變
scenario pest:      病蟲害擴散  mount farm-canonical-pest     擴散鏈 + 每格一則蟲害警示
scenario patrol:    巡田        mount farm-canonical-patrol   擴散鏈 + AI 建議的巡田站點與到站
```

情境卡的標題與一句話說明（bake 從這一段讀取，不寫在程式裡）：

```
pest title:       病蟲害擴散
pest summary:     模擬害蟲從鄰近農場進入同為黃金果的田區 1，再到田區 3；酪梨與甘藍保持健康。
patrol title:     巡田
patrol summary:   AI 依擴散風險建議巡田站點，沿參觀動線依序到站；觀察與作業紀錄都是模擬。
```

- **三個情境共用同一條擴散鏈**：鄰農場 → 田區 1（`field-eta`）→ 田區 3（`field-theta`），同為黃金果；
  田區 2（酪梨）與溫室（甘藍）一直健康。鏈的依據不變：
  `2026-09-26-farm-cross-farm-spread-scenario.md`。
- **每個情境只帶自己的層。** 病蟲害擴散沒有巡田路線與站點；巡田沒有蟲害警示。總覽照舊，包含
  2026-09-26 的 AI 巡田路線（`2026-09-26-farm-ai-patrol-route.md`）。
- **四拍敘事的基底事件（蜂箱提醒、訪客群組）只留在總覽。** 病蟲害擴散與巡田的通知只講自己的故事。
  bake 在四拍 frames 烘好之後、作物階段 compose 之前，拿掉下面列出的事件類別，連同它們造成的狀態
  （蜂箱關注、擁擠）、因它們而有的限制與預選回應、訪客群組的動態主體，以及 beat 裡指向它們的 id；
  留下的記錄若仍指向被拿掉的事件，bake 拒絕，不修補。四拍的 beat、時鐘與每格時間不變，作物階段
  提醒仍 compose 在第二拍，擴散鏈也不變。bake 從下面這一段讀取，不寫在程式裡：

```
pest base drops:     hive-field-alert cohort-presence cohort-movement
patrol base drops:   hive-field-alert cohort-presence cohort-movement
```

- **情境文字檔另列本情境的事件類別**，情境卡只顯示那些。
- **切換情境就是換一個候選**，每個候選各自從 frame 0 開始、各自重置，不共用任何播放狀態。

## 這不是什麼

- 不是真實的巡田作業或疫情監測，也沒有診斷或防治建議。
- 不建 AI narrator。Will："AI narrator really comes from the overall ingest of news, data, the twin."
  那是下一步架構（Vogue、Pool、KG 在編寫時 ingest），見 OpenSpec change
  `add-farm-use-case-scenarios` 的 design D8。

## 可修訂性

本檔可由後續具日期、具名並載明取代內容的決策檔取代，Director（團隊）優先。
