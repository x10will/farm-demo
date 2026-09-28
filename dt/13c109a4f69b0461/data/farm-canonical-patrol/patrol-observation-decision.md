# 展示選擇 —— 巡田站點卡、模擬觀察與作業紀錄的用語

Authority: Claude Code lane on Will's instruction, 2026-09-28: 'scenario selector is cheap. patrol stops means the system suggests? observation can be mocked, we don't know how they patrol yet.'

本檔由 Claude Code lane 於 2026-09-28 依 Will 當日的指示寫成，原話：

> "patrol stops means the system suggests? observation can be mocked, we don't know how they patrol yet."

依據是 `AGENTS.md`〈Director mandate〉記錄的 Will 2026-09-24 裁定：demo 與資料選擇由
Director（團隊：dragon5285、AskaYu800304、kevin70504）決定，寫成具名、具日期的決策檔。
這裡的值是**我們替團隊先補上的**，不是團隊的裁示。**Director（團隊）可以隨時用一份較晚的
日期決策檔取代本檔**，不必先問我們；取代時本檔保留為 2026-09-28 的記錄，不改寫位元組。

## 為什麼要這份選擇

巡田情境每站要一張卡（為什麼、看什麼）、到站時一則觀察、最後一份作業紀錄。我們不知道團隊實際怎麼
巡田，所以觀察與紀錄都是模擬，而且每一則都要自己說出「實際巡田方式仍未確認」。

## 選擇

### 用語（bake 從這一段讀取，不寫在程式裡）

```
proposal title:   巡田站點：AI 建議（模擬）
proposal what:    依擴散風險排序的 {count} 個巡田站點；先看最快會受害的株（模擬）
route reason:     站序依擴散風險排列：先到最早會受害的株，同時受害時先到離已受害株較近者；沿步道方向走不到的站略過（模擬）
stop label:       AI 建議（模擬）
stop why:         {target}預計在模擬時間 {mm}:{ss} 受害，是此站看得到的株中最早的；離已受害株 {distance} m
stop look for:    看{target}一帶的葉片與果實有無蟲害痕跡（模擬提示）
visit title:      巡田第 {order} 站：{node}（模擬）
observation:      模擬觀察：{target}一帶目前為「{stage}」。實際巡田方式仍未確認，此觀察為模擬。
work log title:   作業紀錄（模擬）
work log entry:   第 {order} 站 {node}：{target}「{stage}」
work log footer:  以上為模擬作業紀錄；實際巡田方式與紀錄格式仍未確認。
```

- `{target}` 是目標株的顯示標籤（例如「模擬田區 1 · 第 1 株（明確模擬）」）；`{node}` 是站點 Node 的
  簡短名稱（例如「node-09」）；`{stage}` 是目標株在到站那一格的階段顯示標籤（讀自作物階段定義）；
  `{mm}:{ss}` 是受害格的模擬時間；`{distance}` 是站點分數中的「離已受害株距離」，取到 0.1 m。
- 卡片另外照登 agent 對該站的理由原文，標為 AI 建議（模擬）；上面的句子則由規則的分數填入。
- 觀察內容只描述 frames 裡已有的階段，不做診斷、不給處置。
- 作業紀錄列出每一站到站那一格的階段，數字由 bake 從 frames 算出。

## 這不是什麼

- 不是真實的巡田紀錄，也不是團隊的作業格式。
- 不是病蟲害診斷或防治建議。

## 可修訂性

本檔可由後續具日期、具名並載明取代內容的決策檔取代，Director（團隊）優先。
