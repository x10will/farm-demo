# 展示選擇 —— 跨農場擴散情境：起點移到模擬鄰農場

Authority: Claude Code lane on Will's instruction, 2026-09-26: 'We identify the gaps and close from our side as much as possible'

本檔由 Claude Code lane 於 2026-09-26 依 Will 當日的指示寫成，原話：

> "We identify the gaps and close from our side as much as possible"

依據是 `AGENTS.md`〈Director mandate〉記錄的 Will 2026-09-24 裁定：情境起點等 demo 選擇由
Director（團隊：dragon5285、AskaYu800304、kevin70504）決定，寫成具名、具日期的決策檔。
這裡的值是**我們替團隊先補上的**，不是團隊的裁示。**Director（團隊）可以隨時用一份較晚的
日期決策檔取代本檔**，不必先問我們；取代時本檔保留為 2026-09-26 的記錄，不改寫位元組。

## 為什麼要這份選擇

Will 2026-09-26（#102 [comment 5845544518](https://github.com/x10will/farm/pull/102#issuecomment-5845544518)）：

> 「所以這個農場外也隨便用data生成一個mock farm，讓病蟲害擴散過去。」

鄰農場見 `farm-twin-topology/director-decisions/2026-09-26-farm-mock-neighbour-farm.md`。
本檔決定擴散**從哪裡開始、各塊何時開始、每塊田裡從哪一株開始**。

## 與既有裁示的關係

- **2026-09-13 擴散規則：計算方式不變，邊界一條由本檔取代。** 同組、邊到邊、離整片受影響
  集合最近、平手取 stable ID、進入第 4 級時觸發、每格升一級都不變，`pest_spread.py` 釘住的
  仍是 09-13 檔。
  09-13 的〈跨農場〉一節寫明鄰近農場是「**延後**，不是否決」，且「上面的規則是寫在『所有同組
  的 Face』之上，所以將來要延伸到鄰近農場，是資料的問題，不是規則的問題」。本檔就是那份資料。

  09-13 的規則表另有一行「邊界：僅限本農場之內」，其〈範圍〉也寫「不授權…鄰近農場的 Face」。
  那兩句當時的理由是「我們現在還不知道 沿山185 有哪些農場有數據」；Will 2026-09-26 的方向
  改為「用 data 生成一個 mock farm」，不再等真實資料。**本檔取代 09-13 的這兩處，且只取代這兩處**：
  規則表的「邊界：僅限本農場之內」與〈範圍〉中「不授權…鄰近農場的 Face」，改為「邊界：本農場，
  加上具日期決策檔宣告為 mock 的鄰農場 Face」。09-13 其餘條文（計算方式、觸發、停止、授權限制）
  照舊有效，檔案不改寫；程式仍以 09-13 檔為規則依據，因為被取代的兩處都不是程式計算的一部分。
- **2026-09-24 裁示三（起點為田區 1）：由本檔取代。** Face 層的起點由 `field-eta` 改為鄰農場；
  田區 1 仍是雅歌園裡第一塊出事的田，時序與 09-24 播出的畫面相同（見下表）。
- **2026-09-26 逐株起點（`2026-09-26-farm-per-plant-origin-field-eta.md`）：只沿用它的 Node 選擇。**
  田區 1 的逐株起點仍是 `field-eta-tree-0001`，它就是離鄰農場最近的那一株（34.479 m）。該檔
  〈不變的東西〉說 09-24 裁示三的起點 Face 不變；那一句由本檔取代（Face 層起點改為鄰農場）。

## 選擇

```
scenario_origin_ids:  urn:npust:smart-agriculture-management-platform:face:mock-neighbour-field
source_cadence:       [3, 4, 5, 5, 5, 5]

within_face_origins:
  mock-neighbour-field   mock-neighbour-field-tree-0072   entry frame 0
  field-eta              field-eta-tree-0001              entry frame 1
  field-theta            field-theta-tree-0012            entry frame 3
```

### 依規則會播出什麼（預期值，由 bake 算出並以測試核對）

| Face | frame 0 | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|---:|
| 鄰農場（組 a） | 3 | 4 | 5 | 5 | 5 | 5 |
| 田區 1 `field-eta`（組 a） | 1 | 2 | 3 | 4 | 5 | 5 |
| 田區 3 `field-theta`（組 a） | 1 | 1 | 1 | 2 | 3 | 4 |
| 田區 2 `field-alpha`（組 b） | 1 | 1 | 1 | 1 | 1 | 1 |
| 溫室 A、B（組 c） | 1 | 1 | 1 | 1 | 1 | 1 |

- 鄰農場在 frame 1 進入第 4 級，觸發傳播；組 a 中離它最近、尚未受影響的是田區 1（33.609 m），
  田區 3 較遠（62.316 m）。田區 1 在 frame 3 進入第 4 級，再傳到田區 3（3.173 m）。
- 田區 1、田區 3 的時序與 09-24 配置（田區 1 起點、節奏 `[1,2,3,4,5,5]`）完全相同；新增的只是
  它前面那一段在農場外的過程。

### 為什麼節奏是 `[3, 4, 5, 5, 5, 5]`

- **鄰農場第一格就要看得見。** 依 2026-09-17 階段呈現裁示，第 1、2 級保留原本外觀，第 3 級起才
  上色。起點從第 3 級開始，觀眾一開場就看到農場外那一塊已經在出事。
- **田區 3 要在結束前上色。** 若沿用 `[1,2,3,4,5,5]`，鄰農場要到 frame 3 才觸發，田區 1 到
  frame 5 才觸發，田區 3 在最後一格才進入第 2 級，沒有顏色，跨兩次傳播的故事就斷了。

### 為什麼選這三株當逐株起點

每塊受影響的 Face 要宣告一株起點與進場格（2026-09-22 逐株規則不推導它）。三株都取**離上一段
來源最近的那一株**，讓畫面讀起來是「從那一側傳進來」：

- `mock-neighbour-field-tree-0072`：鄰農場裡離田區 1 最近的一株（34.198 m）。
- `field-eta-tree-0001`：田區 1 裡離鄰農場最近的一株（34.479 m），沿用 09-26 逐株起點檔。
- `field-theta-tree-0012`：田區 3 裡離田區 1 最近的一株（4.880 m）。

進場格等於該 Face 由規則算出的第一個非健康格（鄰農場 0、田區 1 為 1、田區 3 為 3）。

## 這不是什麼

- 不是病蟲害診斷，不代表任何真實農場的疫情，也不是防治或操作建議。每個狀態都是模擬
  （`explicitly-simulated`；`prototype-only-not-operational-advice`）。
- 不改變擴散規則、逐株規則、健康階梯或其呈現。
- 不改寫任何既有決策檔或收據。

## 可修訂性

本檔可由後續具日期、具名並載明取代內容的決策檔取代，Director（團隊）優先。
