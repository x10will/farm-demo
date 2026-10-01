# Director decision — crop health stage ladder for the Farm demonstration

Authority: Director decision under user delegation, 2026-09-02, for the OpenSpec change
`author-farm-crop-health-stage`. This file is the lineage record for the declared stage
vocabulary: cite it by repository path and SHA-256 wherever a stage level resolves its
basis.

Every value below is a DECLARED PRESENTATION-AND-SIMULATION CHOICE with its basis. None
is a measurement, an agronomic model, a pest-development model, or an observation of
六堆雅歌園有機教育農場. A simulated or author-created label discloses status; it does not
make an unsupported assertion grounded, so the basis is stated explicitly here rather
than implied by the label.

## Why a ladder at all

The programme this prototype serves argues one thing above the rest: an organic farm
cannot spray, biological control is effective only inside an early-infestation window,
and the value of monitoring is that it finds the infestation while that window is still
open. A field block whose condition never changes cannot carry that argument, and a
continuous severity number would invite the player to interpolate — which the playback
capability forbids outright.

Five discrete levels are therefore declared, with the window named as one of them.

## The five levels

| Level | Identity | Display label | Window |
| --- | --- | --- | --- |
| 1 | `…:crop-health-stage:healthy-v1` | 健康 | no |
| 2 | `…:crop-health-stage:under-observation-v1` | 觀察中 | no |
| 3 | `…:crop-health-stage:early-onset-v1` | 初期 | **yes** |
| 4 | `…:crop-health-stage:advancing-v1` | 擴散中 | no |
| 5 | `…:crop-health-stage:severe-v1` | 嚴重 | no |

Identity prefix in full:
`urn:npust:smart-agriculture-management-platform:crop-health-stage:`

### Basis for the count and the ordering

Five is the smallest ladder that can show a before, the window itself, and a visible
consequence of missing it, while leaving one step on each side so the window does not
sit at an endpoint. Basis: the programme's monitoring-and-early-response argument
(sub-project one, 監測預警 → 初期蟲害 → 生物防治) as reported in the 沿山185 corridor
briefing material already summarised in `docs/background/05-yanshan185-agri.md` and
`docs/background/屏科大-智慧化農業管理平台.md`. Those summaries are cited here as the
rationale for a declared choice; they are not admitted as coordinate, agronomic, or
site-state evidence, and the admitted `E1` source's accepted locators do not cover this
material.

### Basis for naming level 3 as the window

The same material states that biological control works only in the early phase and that
the demonstration exists to show that phase. Level 3 is therefore the only level flagged
`is_biological_control_window`. No other level may carry that flag, and the flag asserts
nothing about any real infestation.

### Deliberate omissions

- **No crop.** No admitted source states what this farm grows. Level labels name a stage
  of the simulation, never a cultivar.
- **No pest.** The corridor's monitored species rotate by year in the programme material;
  naming one here would turn a declared ladder into an entomological claim.
- **No threshold, count, rate, or unit.** A level is an opaque declared step. Nothing in
  this ladder may be read as a trap count, a population figure, a percentage, or a speed.
- **No treatment and no recovery.** The ladder declares states, not interventions. The
  do-nothing baseline that consumes it advances monotonically; any later change that
  wants recovery must author it explicitly and supersede this note.

## Authority limits

- `authority_scope`: `simulation-input`.
- `surveyed_or_measured_claim`: false.
- The ladder MUST NOT be presented as diagnosis, monitoring output, a sensor reading, an
  operational instruction, or a treatment recommendation.
- The ladder grants no runtime authority. A stage value is authorized only where a
  canonical frame places it on a stable twin ID.
