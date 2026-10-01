// Independent patrol candidate. Validation may recompute facts, but playback returns only baked frames.
const fail = detail => { throw new Error(`Farm patrol adapter: ${detail}; protecting Will's 2026-09-29 independent-simulation decision`); };
const check = (condition, detail) => { if (!condition) fail(detail); };
const same = (left, right) => {
  const ordered = value => Array.isArray(value) ? value.map(ordered)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]))
      : value;
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
};
const dayNumber = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms / 86400000 : NaN;
};
const dayString = n => new Date(n * 86400000).toISOString().slice(0, 10);
const statusId = days => days === 0 ? 'patrol-status:today' : days <= 2 ? 'patrol-status:recent'
  : days <= 5 ? 'patrol-status:due' : 'patrol-status:overdue';
const SOURCE_FILES = ['static-snapshot.json', 'daily-frames.json', 'composed-frames.json',
  'patrol-days-off-outcomes.json', 'patrol-plan-basis.json', 'patrol-status-declaration.json',
  'scenario-narration.json', 'patrol-decision.md', 'patrol-calendar-direction.md',
  'patrol-profile-source.json', 'patrol-history-source.json', 'modules/farm-patrol-adapter.mjs'];
const FORBIDDEN = ['daily-world.json', 'crop-health-declaration.json', 'crop-health-presentation.json',
  'crop-health-stage-sequence.json', 'pest-spread-decision.md', 'patrol-known-alerts-source.json',
  'patrol-route-decision.md'];
const FACE = 'urn:npust:smart-agriculture-management-platform:face:';
const EXPECTED_FACES = ['field-eta', 'field-theta', 'field-alpha', 'greenhouse-bay-a', 'greenhouse-bay-b'].map(name => FACE + name);
const EXPECTED_STATUSES = [
  {status_id: 'patrol-status:today', label: '今日已巡', color: '#1565C0', min_days: 0, max_days: 0},
  {status_id: 'patrol-status:recent', label: '1–2 天前巡過', color: '#64B5F6', min_days: 1, max_days: 2},
  {status_id: 'patrol-status:due', label: '3–5 天未巡・待巡', color: '#B39DDB', min_days: 3, max_days: 5},
  {status_id: 'patrol-status:overdue', label: '6 天以上未巡・逾期', color: '#6A1B9A', min_days: 6, max_days: null},
];
const CROP_KIND_LABELS = {'tree-per-plant': '逐株果樹', 'field-crop-per-plot': '逐塊田作'};
const CROP_CITATION_LABELS = {species_name_zh: '模擬作物', scientific_name: '學名', crop_kind: '類別'};

function visitFacts(block, faceKey, inScope, day) {
  check(Array.isArray(block?.[faceKey]) && Array.isArray(block?.runs)
    && new Set(block[faceKey]).size === block[faceKey].length
    && block[faceKey].every(face => inScope.has(face)), `${day}: patrol faces are invalid`);
  const visits = block.runs.flatMap(run => (run.visits || []).map(visit => ({...visit, run_id: run.run_id})));
  check(visits.length === block[faceKey].length
    && new Set(visits.map(row => row.visit_id)).size === visits.length
    && new Set(visits.map(row => row.face_id)).size === visits.length
    && visits.every(row => block[faceKey].includes(row.face_id)
      && same(row.target_ids, [row.face_id]) && typeof row.run_id === 'string'),
  `${day}: visits differ from declared patrol faces`);
  return visits;
}
function applyVisits(state, visits, day, kind, branchId) {
  const next = new Map(state);
  for (const visit of visits) next.set(visit.face_id,
    {last_patrol_on: day, source: {kind, visit_id: visit.visit_id,
      ...(branchId ? {branch_id: branchId} : {})}});
  return next;
}
function fieldStatus(state, day, id, faces, neighbour) {
  return {snapshot_id: id, as_of: day, faces: [...faces.map(face => {
    const found = state.get(face);
    check(found && Number.isFinite(dayNumber(found.last_patrol_on)), `${day}: missing starting patrol for ${face}`);
    const days = dayNumber(day) - dayNumber(found.last_patrol_on);
    check(Number.isInteger(days) && days >= 0, `${day}: future patrol for ${face}`);
    return {face_id: face, status_id: statusId(days), last_patrol_on: found.last_patrol_on,
      days_since: days, source: found.source};
  }), {face_id: neighbour, status_id: 'patrol-status:out-of-scope',
    last_patrol_on: null, days_since: null, source: null}]};
}
function comparison(day, mask, current, baseline) {
  const base = new Map(baseline.faces.map(row => [row.face_id, row]));
  const keys = ['last_patrol_on', 'days_since', 'status_id'];
  return {finding_id: `finding:${day}:${String(mask).padStart(2, '0')}`, as_of: day,
    overdue_face_ids: current.faces.filter(row => row.status_id === 'patrol-status:overdue').map(row => row.face_id),
    baseline_overdue_face_ids: baseline.faces.filter(row => row.status_id === 'patrol-status:overdue').map(row => row.face_id),
    differences: current.faces.flatMap(row => {
      const previous = base.get(row.face_id);
      return keys.some(key => previous[key] !== row[key]) ? [{face_id: row.face_id,
        baseline: Object.fromEntries(keys.map(key => [key, previous[key]])),
        adjusted: Object.fromEntries(keys.map(key => [key, row[key]]))}] : [];
    })};
}
function pointEqual(a, b) { return a?.lat === b?.lat && a?.lon === b?.lon; }
function validateRoute(planned, authored, profile, snapshot, day, follow, off) {
  check(same(planned.planned_face_ids, authored.planned_face_ids)
    && same(planned.preselected_route_member_ids, authored.preselected_route_member_ids)
    && same(planned.reasons, authored.reasons)
    && planned.plan_id === profile.plan.plan_id, `${day}: route plan differs from authored plan`);
  const members = planned.preselected_route_member_ids;
  const records = new Map(snapshot.static_merge.merged_topology_artifact.records.map(row => [row['@id'], row]));
  check(Array.isArray(members) && members.length >= 3 && members.length % 2 === 1
    && members[0] === profile.plan.route.start_node_id
    && new Set(members.filter((_, i) => i % 2 === 0)).size === (members.length + 1) / 2
    && members.every((id, i) => i % 2 === 0 ? records.get(id)?.['@type'] === 'Node'
      : records.get(id)?.['@type'] === 'Edge' && records.get(id).from_node_id === members[i - 1]
        && records.get(id).to_node_id === members[i + 1]),
  `${day}: route chain is not the declared directed path`);
  check(same(follow.route_member_ids, members) && same(off.route_member_ids, []),
    `${day}: branch route chain differs from plan`);
  const route = planned.route;
  const anchors = new Map(profile.plan.route.field_anchors.map(row => [row.node_id, row.face_id]));
  check(route?.route_id === `patrol-route:${day}` && route.source_type === 'mock-authored'
    && route.start?.node_id === members[0]
    && route.geometry_source?.path === 'set/typed_set.json'
    && /^[0-9a-f]{64}$/.test(route.geometry_source.sha256)
    && Array.isArray(route.path) && route.path.length >= 2
    && route.path.every(point => Number.isFinite(point.lat) && Number.isFinite(point.lon))
    && pointEqual(route.path[0], route.start.point)
    && Array.isArray(route.stops) && route.stops.length >= 2,
  `${day}: route geometry or identity is invalid`);
  let previous = -1;
  const seenFaces = new Set();
  for (const [i, stop] of route.stops.entries()) {
    const position = members.indexOf(stop.anchor_node_id);
    check(stop.stop_id === `patrol-stop:${day}:${i + 1}` && stop.order === i + 1
      && position % 2 === 0 && position > previous
      && anchors.get(stop.anchor_node_id) === stop.face_id
      && planned.planned_face_ids.includes(stop.face_id)
      && planned.reasons.some(reason => reason.face_id === stop.face_id && reason.reason_id === stop.reason_id)
      && route.path.some(point => pointEqual(point, stop.point)),
    `${day}: route stop ${i + 1} is not an ordered authored anchor`);
    previous = position;
    seenFaces.add(stop.face_id);
  }
  check(same(route.stops.map(stop => stop.anchor_node_id),
    members.filter((id, i) => i % 2 === 0 && planned.planned_face_ids.includes(anchors.get(id))))
    && planned.planned_face_ids.every(face => seenFaces.has(face))
    && members.at(-1) === route.stops.at(-1).anchor_node_id
    && pointEqual(route.path.at(-1), route.stops.at(-1).point),
  `${day}: route stops do not cover and end at the declared fields`);
}
function validateCandidate(manifest, artifacts) {
  const snapshot = artifacts['static-snapshot.json'];
  const daily = artifacts['daily-frames.json'];
  const composed = artifacts['composed-frames.json'];
  const lookup = artifacts['patrol-days-off-outcomes.json'];
  const basis = artifacts['patrol-plan-basis.json'];
  const declaration = artifacts['patrol-status-declaration.json'];
  const narration = artifacts['scenario-narration.json'];
  const profile = artifacts['patrol-profile-source.json'];
  const history = artifacts['patrol-history-source.json'];
  const files = new Map((manifest.files || []).map(row => [row.path, row]));
  check(files.size === SOURCE_FILES.length && SOURCE_FILES.every(name => files.has(name))
    && [...files].every(([name, row]) => row.path === name && Number.isInteger(row.byte_count)
      && row.byte_count > 0 && /^[0-9a-f]{64}$/.test(row.sha256))
    && FORBIDDEN.every(name => !files.has(name) && !Object.hasOwn(artifacts, name)),
  'candidate receipts are incomplete or include pest artifacts');
  check(manifest.adapter_entry === 'modules/farm-patrol-adapter.mjs'
    && manifest.scenario?.id === 'patrol-calendar'
    && manifest.scenario?.variant_id === 'patrol-calendar'
    && manifest.scenario?.use_case_id === 'patrol'
    && manifest.scenario?.profile === 'farm-patrol-calendar/v2'
    && manifest.scenario?.view_kind === 'patrol-calendar'
    && profile?.schema === 'farm-patrol-calendar/v2'
    && profile.reference_date === '2026-09-29'
    && history?.schema === 'farm-patrol-history/v2', 'patrol candidate identity differs');
  check(snapshot?.snapshot_revision === manifest.snapshot_revision
    && daily?.snapshot_revision === manifest.snapshot_revision
    && composed?.snapshot_revision === manifest.snapshot_revision
    && daily?.frame_set_revision === manifest.frame_set_revision
    && composed?.source_frame_set_revision === manifest.frame_set_revision
    && composed?.composed_revision === manifest.composed_revision
    && lookup?.outcomes_revision === manifest.days_off_outcomes_revision
    && composed?.days_off_outcomes_revision === manifest.days_off_outcomes_revision
    && basis?.basis_revision === manifest.patrol_plan_basis_revision
    && composed?.patrol_plan_basis_revision === manifest.patrol_plan_basis_revision
    && declaration?.status_revision === manifest.patrol_status_revision
    && composed?.patrol_status_revision === manifest.patrol_status_revision
    && !Object.hasOwn(manifest, 'daily_world_revision')
    && !Object.hasOwn(composed, 'daily_world_revision')
    && !Object.hasOwn(lookup, 'daily_world_revision')
    && !Object.hasOwn(profile, 'world')
    && daily.acceptance_eligible === false && composed.acceptance_eligible === false,
  'candidate revisions differ');
  const decision = files.get('patrol-decision.md');
  const direction = files.get('patrol-calendar-direction.md');
  const decisionPath = profile.decision_input;
  const directionPath = profile.direction_input;
  const refs = [{path: 'patrol-decision.md', ref: `${decisionPath}@sha256:${decision.sha256}`},
    {path: 'patrol-calendar-direction.md', ref: `${directionPath}@sha256:${direction.sha256}`}];
  check(same(narration?.scenario?.decision_refs, refs)
    && same(manifest.scenario.decision_refs, refs.map(row => row.ref))
    && manifest.offline_decision_source?.sha256 === decision.sha256
    && manifest.patrol_profile_input?.sha256 === files.get('patrol-profile-source.json').sha256
    && manifest.patrol_history_input?.sha256 === files.get('patrol-history-source.json').sha256
    && basis.history_source?.receipt?.sha256 === manifest.patrol_history_input.sha256,
  'source receipts and dated decision references differ');
  const faces = profile.in_scope_face_ids;
  const neighbour = profile.out_of_scope_face_id;
  const records = new Map(snapshot.static_merge.merged_topology_artifact.records.map(row => [row['@id'], row]));
  check(same(faces, EXPECTED_FACES) && neighbour === FACE + 'mock-neighbour-field'
    && faces.every(face => records.get(face)?.['@type'] === 'Face')
    && records.get(neighbour)?.['@type'] === 'Face'
    && same(manifest.target_face_ids, faces) && manifest.target_face_id === faces[0]
    && same(declaration?.in_scope_face_ids, faces)
    && same(declaration.statuses, EXPECTED_STATUSES)
    && declaration.schema === 'farm-patrol-status/v1'
    && declaration.fill_opacity === 0.5
    && same(declaration.out_of_scope, {status_id: 'patrol-status:out-of-scope',
      label: '鄰近農場・不在本場巡田範圍', face_ids: [neighbour]})
    && declaration.decision_ref === refs[0].ref
    && declaration.geometry_source?.path === 'set/typed_set.json'
    && /^[0-9a-f]{64}$/.test(declaration.geometry_source.sha256)
    && Array.isArray(declaration.outlines)
    && same(declaration.outlines.map(row => row.face_id), [...faces, neighbour])
    && declaration.outlines.every(row => row.outline.length >= 4
      && row.outline.every(point => Number.isFinite(point.lat) && Number.isFinite(point.lon))),
  'patrol scope, status declaration or geometry provenance differs');
  const seedRows = profile.seed_last_patrols;
  check(Array.isArray(seedRows) && same(seedRows.map(row => row.face_id), faces)
    && new Set(seedRows.map(row => row.seed_id)).size === faces.length
    && seedRows.every(row => Number.isFinite(dayNumber(row.last_patrol_on))
      && dayNumber(row.last_patrol_on) < dayNumber('2026-09-23')),
  'each field needs an authored prehistory last-patrol date');
  let state = new Map(seedRows.map(row => [row.face_id,
    {last_patrol_on: row.last_patrol_on, source: {kind: 'seed', seed_id: row.seed_id}}]));
  const inScope = new Set(faces);
  const schedule = daily.daily_schedule;
  const dates = Array.from({length: 11}, (_, i) => dayString(dayNumber('2026-09-23') + i));
  check(schedule?.reference_date === '2026-09-29' && schedule.initial_date === '2026-09-29'
    && same(schedule.dates, dates) && same(schedule.editable_dates, dates.slice(6))
    && same(schedule.calendar_cells, [null, null, ...dates, null])
    && schedule.step_seconds === 10 && schedule.duration_seconds === 110
    && schedule.time_grain === 'day' && schedule.time_zone === 'Asia/Taipei'
    && history.reference_date === '2026-09-29'
    && same(history.days.map(row => row.date), dates.slice(0, 6))
    && same(profile.plan.days.map(row => row.date), dates.slice(6))
    && lookup?.reference_date === '2026-09-29'
    && lookup.plan_id === profile.plan.plan_id && lookup.baseline_key === ''
    && same(lookup.editable_dates, dates.slice(6)), 'daily calendar dates or plan differ');
  check(Array.isArray(composed.canonical_frames) && composed.canonical_frames.length === 11
    && Array.isArray(daily.canonical_frames) && daily.canonical_frames.length === 11
    && Array.isArray(narration.beats) && narration.beats.length === 11,
  'canonical day count differs');
  check(same(Object.keys(narration).sort(), ['beats', 'reasons', 'scenario', 'schema'])
    && history.days.every(row => !Object.hasOwn(row, 'observations')),
  'patrol narration or history contains pest observations');
  const frames = composed.canonical_frames;
  for (let i = 0; i < 11; i += 1) {
    const frame = frames[i], day = dates[i], patrol = frame?.patrol_day;
    check(frame?.frame_index === i && frame.elapsed_seconds === i * 10
      && frame.date === day && frame.day_id === `patrol-day:${day}`
      && same(daily.canonical_frames[i], {frame_index: i, elapsed_seconds: i * 10,
        date: day, day_id: `patrol-day:${day}`})
      && patrol?.date === day && patrol.day_id === frame.day_id
      && patrol.day_number === i + 1 && patrol.time_grain === 'day'
      && patrol.reference_date === '2026-09-29' && patrol.relative_day === i - 6
      && patrol.phase === (i < 6 ? 'history' : 'plan')
      && ['affected_twin_conditions', 'event_occurrences', 'restrictions',
        'preselected_responses'].every(key => same(frame[key], []))
      && same(frame.narrative_beat?.condition_occurrence_ids, [])
      && narration.beats[i]?.frame_index === i
      && narration.beats[i]?.text === `${day}（模擬）`, `${day}: frame facts are invalid`);
    if (i < 6) {
      const recorded = patrol.recorded_patrol, source = history.days[i];
      check(recorded && same(recorded.recorded_face_ids, source.recorded_face_ids)
        && same(recorded.route_member_ids, []) && same(recorded.runs, source.runs)
        && !Object.hasOwn(recorded, 'observations')
        && recorded.patrolled === Boolean(source.recorded_face_ids.length)
        && patrol.planned_patrol === null && same(patrol.conditional_branches, [])
        && same(patrol.schedule_outcomes, []), `${day}: recorded patrol differs from source`);
      const visits = visitFacts(recorded, 'recorded_face_ids', inScope, day);
      state = applyVisits(state, visits, day, 'recorded-visit');
      check(same(patrol.field_status, fieldStatus(state, day,
        `field-status:${day}:recorded`, faces, neighbour)), `${day}: recorded field status differs from visits`);
    } else {
      const planned = patrol.planned_patrol, authored = profile.plan.days[i - 6];
      const [follow, off] = patrol.conditional_branches || [];
      check(planned && patrol.recorded_patrol === null && patrol.field_status === null
        && patrol.conditional_branches.length === 2
        && follow?.branch_id === `branch:follow-plan:${day}`
        && follow.assumption === 'follow-plan' && follow.patrolled === true
        && same(follow.conditional_face_ids, planned.planned_face_ids)
        && off?.branch_id === `branch:day-off:${day}`
        && !Object.hasOwn(follow, 'observations')
        && !Object.hasOwn(off, 'observations')
        && !Object.hasOwn(patrol, 'world_checkpoint_id')
        && same(off, {branch_id: `branch:day-off:${day}`, assumption: 'day-off',
          patrolled: false, conditional_face_ids: [], route_member_ids: [], runs: []})
        && patrol.schedule_outcomes.length === 32,
      `${day}: planned branches or day-off facts differ`);
      visitFacts(follow, 'conditional_face_ids', inScope, day);
      validateRoute(planned, authored, profile, snapshot, day, follow, off);
      check(planned.reasons.every(reason => basis.rules.some(rule => rule.rule_id === reason.rule_id)
        && reason.input_ids.every(id => basis.inputs.some(input => input.input_id === id
          && input.face_id === reason.face_id))
        && narration.reasons?.[reason.reason_id]?.text === basis.rules.find(rule => rule.rule_id === reason.rule_id)?.text),
      `${day}: recommendation reasons lack authored inputs`);
    }
  }
  check(same(basis.inputs, profile.plan.inputs) && same(basis.rules, profile.plan.rules)
    && basis.plan_id === profile.plan.plan_id && basis.reference_date === '2026-09-29'
    && basis.generation?.source_type === 'mock-authored'
    && basis.inputs.every(input => input.kind === 'last-patrol-date'
      && input.as_of === '2026-09-29'
      && history.days.some(day => day.day_id === input.source?.day_id
        && day.date === input.value && day.recorded_face_ids.includes(input.face_id))),
  'plan basis differs from dated recorded visits');
  check(Array.isArray(lookup.schedules) && lookup.schedules.length === 32
    && new Set(lookup.schedules.map(row => row.schedule_key)).size === 32,
  'lookup does not cover all 32 day-off schedules');
  const baselineByDate = new Map();
  for (let mask = 0; mask < 32; mask += 1) {
    const offDates = dates.slice(6).filter((_, bit) => mask & (1 << bit));
    const key = offDates.join('|');
    const selected = lookup.schedules[mask];
    check(selected?.schedule_key === key && same(selected.off_dates, offDates)
      && selected.days.length === 5, `schedule ${mask}: lookup key differs`);
    let adjusted = new Map(state);
    for (let offset = 0; offset < 5; offset += 1) {
      const day = dates[offset + 6];
      const patrol = frames[offset + 6].patrol_day;
      const branch = patrol.conditional_branches[offDates.includes(day) ? 1 : 0];
      adjusted = applyVisits(adjusted,
        visitFacts(branch, 'conditional_face_ids', inScope, day),
        day, 'conditional-visit', branch.branch_id);
      const id = `field-status:${day}:${String(mask).padStart(2, '0')}`;
      const expected = fieldStatus(adjusted, day, id, faces, neighbour);
      if (mask === 0) baselineByDate.set(day, expected);
      const ref = {date: day, branch_id: branch.branch_id,
        outcome_id: `outcome:${day}:${String(mask).padStart(2, '0')}`};
      const actual = patrol.schedule_outcomes[mask];
      check(same(selected.days[offset], ref)
        && same(actual, {outcome_id: ref.outcome_id, schedule_key: key,
          branch_id: branch.branch_id, field_status: expected,
          comparison: comparison(day, mask, expected, baselineByDate.get(day))}),
      `schedule ${mask} on ${day}: baked status or comparison differs from visits`);
    }
  }
  return {snapshot, daily, composed, narration, frames, faces};
}

export function createAdapter({manifest, artifacts, resourceBaseUrl}) {
  const {snapshot, daily, narration, frames} = validateCandidate(manifest, artifacts);
  const records = snapshot.static_merge.merged_topology_artifact.records;
  const inspection = Object.fromEntries(records.map(row => [row['@id'], [
    {label: 'stable_id', value: row['@id']},
    {label: '靜態類型', value: row['@type']},
    ...(row.crop_group ? [{label: '模擬作物分組', value: row.crop_group.token}] : []),
  ]]));
  // The same static crop representation as the canonical adapter. Crop fields
  // explain the selected record; they never supply the day's patrol state.
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
  const inspectionPresentation = Object.fromEntries(records.map(row => [row['@id'], {
    title: row.display_label || row.name || '未提供顯示名稱',
    typeLabel: row['@type'] === 'Face' ? '田區或建築占地' : row['@type'] === 'Node' ? '路徑點、交會點或入口'
      : row['@type'] === 'Edge' ? '通行走廊' : '設施或資產',
    stateLabel: '巡田狀態請見巡田面板',
    timeLabel: '模擬今日 2026-09-29（固定示範日期）',
    events: [],
    notices: ['本示範資料皆為模擬', '僅供原型展示，非農場操作建議'],
    sources: [{label: '場景名稱、拓樸與來源紀錄', href: 'static-snapshot.json'},
      {label: '逐日巡田紀錄', href: 'composed-frames.json'}],
  }]));
  const provenanceLinks = ['manifest.json', ...SOURCE_FILES.filter(name => name !== 'modules/farm-patrol-adapter.mjs')]
    .map(path => ({label: path, url: new URL(path, resourceBaseUrl).href}));
  return {
    title: '國立屏東科技大學「智慧化農業管理平台」',
    durationSeconds: daily.daily_schedule.duration_seconds,
    frameTimesSeconds: frames.map(frame => frame.elapsed_seconds),
    selectFrame(index) {
      check(Number.isInteger(index) && index >= 0 && index < frames.length, 'selected frame is absent');
      const frame = frames[index];
      return {frameIndex: index, elapsedSeconds: frame.elapsed_seconds,
        date: frame.patrol_day.date, beatLabel: narration.beats[index].text,
        notices: ['本示範資料皆為模擬', '僅供原型展示，非農場操作建議',
          '模擬今日 2026-09-29（固定示範日期，不讀取裝置時間）'],
        notifications: [], inspection, inspectionPresentation,
        presentation: {}, provenanceLinks};
    },
  };
}
