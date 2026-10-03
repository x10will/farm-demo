# 展示選擇 —— 病蟲害擴散以「日」計：六個影格各有模擬日期

Authority: Will, 2026-10-01, in chat with the Claude Code lane: "The pest spread is hours. is that what pest spread is really like? or should also be days." He then approved the lane after the agronomy answer: "You can use sonnet as coder."

本檔由 Claude Code lane 於 2026-10-01 依 Will 當日的提問寫成，原話：

> "The pest spread is hours. is that what pest spread is really like? or should also be days."

農藝回答是：真菌類病害一個循環約 5–10 天，蚜蟲與葉蟎的族群累積約 1–3 週，田區之間的擴散以天到週計，不是以小時計。Will 接著批准這條 lane：「You can use sonnet as coder.」

依據是 `AGENTS.md`〈Director mandate〉記錄的 Will 2026-09-24 裁定：demo 與資料選擇由 Director（團隊：dragon5285、AskaYu800304、kevin70504）決定，寫成具名、具日期的決策檔。下列日數間隔是這條 lane 在該授權下的合理預設，不是團隊提供的田間觀測；農場團隊可用較晚日期的決策檔取代。

## 取代範圍

本檔只取代 `2026-09-13-farm-pest-spread-rule.md`、`2026-09-22-farm-per-plant-pest-spread.md`、`2026-09-26-farm-cross-farm-spread-scenario.md` 與 `2026-09-28-farm-use-case-scenarios.md` 中「六個 100 秒影格的時間意義」那一句：先前它們只有十分鐘展示時鐘，沒有模擬時間。其餘全部沿用：擴散規則、逐株規則、跨田進入影格、階段（健康、觀察中、初期、擴散中、嚴重）、警示用語與 6 × 100 秒的播放時鐘。

## 選擇

- 六個影格分別是模擬第 **1、3、5、7、10、14** 日。第 N 日的日期是參考日期加 N − 1 天。
- 參考日期（第 1 日）：**2026-09-29**，與巡田日曆的 `reference_date`（`patrol_daily.py`，2026-09-29，「今日」）相同。病蟲害與巡田仍是兩個互不相連的模擬；只是共用同一個起算日，讓兩邊的日期讀起來一致。
- 因此影格日期依序為 2026-09-29、2026-10-01、2026-10-03、2026-10-05、2026-10-08、2026-10-12。
- 播放仍是十分鐘展示時鐘：六格各 100 秒。日期與日數是烤進影格的欄位（`date`、`day_number`），面板只顯示，不計算。
- 面板標籤與巡田同式：`模擬日期 <日期> · 第 N 日`，N 是模擬日數（1、3、5、7、10、14），不是影格序號。

這些日期是模擬展示資料，不是田間觀測、診斷或防治建議。

## 警示卡的時間行（同日補充）

一旦影格以日計，警示卡的「從何時」仍寫 `模擬時間 00:00 起`，出處仍寫 `模擬影格 第 N 格`，與同一畫面的 `模擬日期 … · 第 N 日` 互相矛盾。因此本節取代 `2026-09-28-farm-pest-spread-alert.md` 中 `since text` 這一行的措辭，只限影格有烤入日期時使用：從何時與出處改讀警示起始影格已烤入的日期與日數，不由面板計算。其餘警示用語沿用。無日期的影格仍用舊措辭。

下列兩行是烤製讀取的措辭，`{date}` 與 `{day}` 取自警示起始影格與警示所在影格：

since text dated: 模擬日期 {date} · 第 {day} 日起
source text dated: 模擬日期 {date} · 第 {day} 日

