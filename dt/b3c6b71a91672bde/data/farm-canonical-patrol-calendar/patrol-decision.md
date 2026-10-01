# Two independent simulations — 2026-09-29

## Authority and correction

Will asked: 「那我就不懂了，9/21之前不變色，9/21巡完還變色?」 and then corrected the interpretation: 「不是，這是兩個模擬，你要把蟲害跟巡田分開啊，他本來就不應該一個panel」.

The previous answer and implementation treated patrol colours as pest severity. That interpretation was wrong. This decision implements Will's product direction using the team's mock-data mandate recorded in AGENTS.md. Opus 5.5 at xhigh selected this design on 2026-09-29; Codex records and implements it. These are authored demonstration choices, not farm observations or operational advice.

This supersedes the shared pest world, stage-derived observations and B detection-delay comparisons in `unify-patrol-date-and-calendar`; patrol's use of the history-colour pest cadence; the single scenario panel/tab-bar decision; and the earlier 9/21 patrol reference date. Existing dated decisions, generated exports and verification receipts remain historical evidence and are not rewritten.

## Experience

巡田 and 病蟲害擴散 have separately registered panels and independent saved state. One map displays the active simulation. Its panel has the controls and a 地圖顯示中 badge; the other panel is a compact launcher. Switching uses the existing scenario URL and a page reload. Patrol owns `date` and `off`; pest owns `pestFrame`. Switching or resetting one preserves the other's fields. The published overview remains the no-scenario landing page.

Patrol uses a fixed, labelled 模擬今日 2026-09-29, independent of the device clock: history 9/23–9/28, plan 9/29–10/3, 11 daily frames of 10 seconds. Pest retains its independent 00:00–10:00 simulation. Patrol's calendar shows those days within two Monday–Sunday weeks. Only plan dates can be marked off. Patrol reset restores 9/29 and daily attendance; pest reset restores its frame 0 and pauses.

Patrol colours describe time since the last patrol **at the end of the selected day**, including that day's recorded or hypothetical visit. History and hypothetical plan captions explicitly distinguish those meanings. All hypothetical visits follow the selected schedule. The list exposes last patrol, elapsed days, status and any difference from following the suggestions every day. Suggested route stops remain numbered and are not real completed visits. History has no route in this mock. Off-day routes are grey and dashed. Remove pest observations, automatic field selection, variant tabs and the redundant restore-baseline button from patrol.

## Authored mock records and rules

| Stable face | Short name | Last patrol before the displayed history |
|---|---|---|
| field-eta | A | 2026-09-20 |
| field-theta | B | 2026-09-19 |
| field-alpha | C | 2026-09-16 |
| greenhouse-bay-a | GA | 2026-09-21 |
| greenhouse-bay-b | GB | 2026-09-18 |

`mock-neighbour-field` is explicitly outside this farm's patrol scope. It has no patrol fill or invented visit. Each in-scope field must have its authored starting record.

Recorded visits: 9/23 A+GB; 9/24 B; 9/25 GA; 9/26 none; 9/27 A; 9/28 C+GA+GB. These are simulated records, with stable visit IDs.

Suggested plan: 9/29 B (`mock-rule:longest-gap`); 9/30 A, 10/1 B, 10/2 A, 10/3 A+B (`mock-rule:fixed-rotation`). Planning inputs are A's last patrol 9/27 and B's last patrol 9/24, as of 9/29. A and B have the provided mock route anchors; this is a limitation of the authored demonstration, not a claim that other fields are physically unreachable. Skipping a day does not re-plan later routes.

Routes reuse declared topology: A follows 01→02→09→03, inspecting 09 then 03. B follows 01→02→09→03→04→05→06, inspecting 05 then 06. A+B follows that same B chain, inspecting 09, 03, 05, 06 in that order. No runtime planning or live AI is introduced.

| Status | Days since patrol | Display label | Fill |
|---|---|---|---|
| patrol-status:today | 0 | 今日已巡 | #1565C0 |
| patrol-status:recent | 1–2 | 1–2 天前巡過 | #64B5F6 |
| patrol-status:due | 3–5 | 3–5 天未巡・待巡 | #B39DDB |
| patrol-status:overdue | 6 or more | 6 天以上未巡・逾期 | #6A1B9A |
| patrol-status:out-of-scope | none | 鄰近農場・不在本場巡田範圍 | none |

The thresholds and palette communicate patrol recency only, with opacity 0.5. They make every historical daily step visibly change at least one field. C stays overdue until its 9/28 patrol. Following the baseline leaves no overdue field on 9/29–10/3. Taking 9/29 off leaves B due that day and overdue on 9/30. Taking all five plan days off leaves A and B overdue on 10/3. These are testable mock outcomes, not agronomic claims.

## Canonical data and presentation

The `patrol-calendar` candidate uses `farm-patrol-calendar/v2`. Every historical state and all 32 possible attendance schedules are baked into canonical frames, with last-visit or seed references and baseline comparison rows. Conditions, events, restrictions and responses are empty. No pest world, crop-health stage data, observation-delay calculation or known pest alert enters the new candidate.

The shipped status declaration contains the palette, thresholds, scope and copied typed-set outlines, plus the input path and SHA-256. The adapter validates the supplied facts but does not repair them or substitute calculated runtime state. The panel selects baked rows and looks up labels/colours. Farm's public map extension renders those rows through `farm-patrol-status`; no DT or panel-core vendor code is changed. Fill/outline/route/pin render orders are 800/850/900/999–1000, and status fills do not intercept picking.

The release ships this decision, the unchanged original calendar direction, authored profile/history, status declaration, plan basis, attendance outcomes, narration, static snapshot, daily and composed frames, adapter and receipt manifest. Old pest-world and crop-health artifacts are excluded. This records the lineage of all demo choices without pinning changing source modules as evidence.

The exact schema and independent worker boundaries are in the adjacent implementation contract. No diagnosis, real monitoring, treatment, runtime rerouting, generic scenario framework, live AI, production deployment or publication is part of this correction.
