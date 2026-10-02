// Presentation-only overview. All changing values come from its 24 canonical frames.
const fail = detail => { throw new Error(`Farm overview adapter: ${detail}; protecting Will's 2026-10-01 separate overview simulation`); };
const check = (ok, detail) => { if (!ok) fail(detail); };
const FILES = ['static-snapshot.json', 'composed-frames.json', 'overview-daynight-inputs.json',
  'overview-daynight-decision.md', 'modules/farm-overview-adapter.mjs'];
const STATE_KEYS = ['affected_twin_conditions', 'event_occurrences', 'displayed_dynamic_subjects',
  'restrictions', 'preselected_responses'];
const HINTS = new Set(['night', 'dawn', 'day', 'dusk']);
const CROP_KIND_LABELS = {'tree-per-plant': '逐株果樹', 'field-crop-per-plot': '逐塊田作'};
const CROP_CITATION_LABELS = {species_name_zh: '模擬作物', scientific_name: '學名', crop_kind: '類別'};

export function createAdapter({manifest, artifacts, resourceBaseUrl}) {
  const snapshot = artifacts['static-snapshot.json'];
  const composed = artifacts['composed-frames.json'];
  const input = artifacts['overview-daynight-inputs.json'];
  const receipt = new Map((manifest.files || []).map(row => [row.path, row]));
  check(receipt.size === FILES.length && FILES.every(name => receipt.has(name)), 'candidate receipts are incomplete or contain another simulation');
  check(manifest.adapter_entry === 'modules/farm-overview-adapter.mjs'
    && manifest.scenario?.id === 'overview' && manifest.scenario?.variant_id === 'overview'
    && manifest.scenario?.use_case_id === 'overview' && manifest.scenario?.role === 'overview'
    && manifest.scenario?.view_kind === 'overview'
    && manifest.scenario?.profile === 'farm-overview-daynight/v1'
    && composed?.schema === 'farm-overview-daynight/v1'
    && input?.schema === composed.schema,
  'overview candidate identity differs');
  check(snapshot?.snapshot_revision === manifest.snapshot_revision
    && composed?.snapshot_revision === manifest.snapshot_revision
    && composed?.frame_set_revision === manifest.frame_set_revision
    && composed?.frame_set_revision === manifest.composed_revision
    && composed?.acceptance_eligible === false,
  'overview revisions differ');
  const decision = receipt.get('overview-daynight-decision.md');
  const rawInput = receipt.get('overview-daynight-inputs.json');
  check(manifest.offline_decision_source?.sha256 === decision.sha256
    && manifest.scenario_declaration_input?.sha256 === rawInput.sha256
    && input.decision_ref === manifest.scenario.decision_refs?.[0]
    && input.decision_ref.endsWith(`@sha256:${decision.sha256}`)
    && composed.provenance?.decision_ref === input.decision_ref
    && composed.provenance?.input_revision === `sha256:${rawInput.sha256}`
    && composed.provenance?.solar_method?.id === input.solar_method?.id,
  'overview decision, input or solar method is unbound');
  const schedule = composed.demo_sequence;
  const frames = composed.canonical_frames;
  check(schedule?.frame_count === 24 && schedule.step_seconds === 25
    && schedule.duration_seconds === 600 && schedule.time_grain === 'hour'
    && schedule.time_zone === 'Asia/Taipei' && schedule.simulated_date === input.simulated_date
    && Array.isArray(frames) && frames.length === 24,
  'the 24-hour ten-minute clock is incomplete');
  const records = snapshot.static_merge?.merged_topology_artifact?.records;
  check(Array.isArray(records), 'static identity catalogue is missing');
  const ids = new Set(records.map(row => row['@id']));
  check(Array.isArray(manifest.target_face_ids) && manifest.target_face_ids.length > 0
    && manifest.target_face_ids.every(id => ids.has(id)) && ids.has(manifest.target_face_id),
  'declared Farm Face is absent');
  for (let hour = 0; hour < frames.length; hour += 1) {
    const frame = frames[hour], env = frame?.environment, sun = env?.sun;
    check(frame?.frame_index === hour && frame.elapsed_seconds === hour * 25
      && env?.time_of_day === `${String(hour).padStart(2, '0')}:00`
      && HINTS.has(env.preset_hint)
      && sun && Number.isFinite(sun.elevation_deg) && sun.elevation_deg >= -90 && sun.elevation_deg <= 90
      && Number.isFinite(sun.azimuth_deg) && sun.azimuth_deg >= 0 && sun.azimuth_deg < 360
      && frame.environment_provenance?.decision_ref === input.decision_ref
      && frame.environment_provenance?.input_revision === `sha256:${rawInput.sha256}`
      && frame.environment_provenance?.solar_method_id === input.solar_method.id
      && STATE_KEYS.every(key => Array.isArray(frame[key]) && frame[key].length === 0)
      && frame.narrative_beat?.title === `模擬 ${env.time_of_day}`
      && frame.narrative_beat?.event_occurrence_ids?.length === 0
      && frame.narrative_beat?.condition_occurrence_ids?.length === 0,
    `frame ${hour} carries invalid environment or another simulation's state`);
  }
  const inspection = Object.fromEntries(records.map(row => [row['@id'], [
    {label: 'stable_id', value: row['@id']},
    {label: '靜態類型', value: row['@type']},
    ...(row.crop_group ? [{label: '模擬作物分組', value: row.crop_group.token}] : []),
  ]]));
  // Crop identity and lineage are frozen snapshot facts, shared by every hour.
  const staticLinks = new Map(Object.values(snapshot.provenance_catalogs)
    .flatMap(catalog => catalog.links).map(row => [row['@id'], row]));
  for (const record of records.filter(row => row.crop)) {
    const {crop} = record;
    const links = snapshot.static_merge.tier_lineage.fields[record['@id']]?.crop?.effective_link_ids ?? [];
    const sources = links.map(id => {
      check(staticLinks.has(id), `crop lineage link ${id} is absent from the provenance catalogs`);
      return staticLinks.get(id).source_id;
    });
    const decisionFile = String(crop.basis?.decision_ref ?? '').split('@')[0].split('/').at(-1);
    const citations = Object.entries(crop.basis?.citations ?? {})
      .map(([field, where]) => `${CROP_CITATION_LABELS[field] ?? field}：${where}`);
    inspection[record['@id']].push(
      {label: '模擬作物', value: crop.species_name_zh},
      {label: '學名', value: crop.scientific_name},
      {label: '類別', value: CROP_KIND_LABELS[crop.crop_kind] ?? '已提供作物類別，但尚無可讀說明'},
      {label: '作物出處', value: [...(decisionFile ? [decisionFile] : []), ...new Set(sources), ...citations]},
    );
  }
  const sources = [{label: '場景名稱、拓樸與來源紀錄', href: 'static-snapshot.json'},
    {label: '逐時晝夜環境（模擬）', href: 'composed-frames.json'},
    {label: '晝夜示範決策', href: 'overview-daynight-decision.md'}];
  const provenanceLinks = ['manifest.json', ...FILES.filter(name => name !== 'modules/farm-overview-adapter.mjs')]
    .map(path => ({label: path, url: new URL(path, resourceBaseUrl).href}));
  return {
    title: '國立屏東科技大學「智慧化農業管理平台」',
    durationSeconds: schedule.duration_seconds,
    frameTimesSeconds: frames.map(frame => frame.elapsed_seconds),
    selectFrame(index) {
      check(Number.isInteger(index) && index >= 0 && index < frames.length, 'selected frame is absent');
      const frame = frames[index];
      const inspectionPresentation = Object.fromEntries(records.map(row => [row['@id'], {
        title: row.display_label || row.name || '未提供顯示名稱',
        typeLabel: row['@type'] === 'Face' ? '田區或建築占地' : row['@type'] === 'Node' ? '路徑點、交會點或入口'
          : row['@type'] === 'Edge' ? '通行走廊' : '設施或資產',
        stateLabel: '本影格沒有田區動態狀態',
        timeLabel: `模擬 ${frame.environment.time_of_day}（${input.simulated_date}，${input.time_zone}）`,
        events: [], notices: ['本示範資料皆為模擬', '僅供原型展示，非農場操作建議'], sources,
      }]));
      return {
        frameIndex: index, elapsedSeconds: frame.elapsed_seconds,
        environment: frame.environment,
        beatLabel: frame.narrative_beat.title,
        notices: ['本示範資料皆為模擬', '僅供原型展示，非農場操作建議',
          `模擬日期 ${input.simulated_date}・${input.time_zone}`],
        notifications: [], inspection, inspectionPresentation,
        presentation: {}, provenanceLinks,
      };
    },
  };
}
