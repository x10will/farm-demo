// Farm semantics only. DT verifies artifact bytes and owns all viewer machinery.
import { projectNonShippingPestSpread } from './non-shipping-pest-spread-projection.mjs';

// Display translations of the existing bounded vocabulary; identities stay in data/inspection.
const BEAT_LABELS = {
  'field-inspection': '田區巡覽',
  'hive-field-alert': '蜂箱與田區提醒',
  'restriction-and-preselected-response': '限制與預選回應',
  'education-visitor-route': '教育參訪路線',
};
const EVENT_LABELS = {
  'hive-field-alert': '蜂箱與田區提醒',
  'crop-health-stage-alert': '作物階段提醒',
  'cohort-presence': '訪客群組在場',
  'cohort-movement': '訪客群組移動',
  // close-workshop-gaps-20261003 design D7.
  'patrol-route-proposal': '巡田路線：AI 提案（模擬）',
};
const NOTICE_LABELS = {
  'explicitly-simulated': '本示範資料皆為模擬',
  'prototype-only-not-operational-advice': '僅供原型展示，非農場操作建議',
};

const TYPE_LABELS = {
  Asset: '設施或資產', Building: '建築物', Face: '田區或建築占地',
  Edge: '通行走廊', Node: '路徑點、交會點或入口',
};
const CROP_KIND_LABELS = { 'tree-per-plant': '逐株果樹', 'field-crop-per-plot': '逐塊田作' };
// Which crop field each basis citation supports, as printed after 作物出處.
const CROP_CITATION_LABELS = { species_name_zh: '模擬作物', scientific_name: '學名', crop_kind: '類別' };
const CONDITION_LABELS = { 'hive-attention': '蜂箱關注', crowded: '擁擠' };
const RESTRICTION_LABELS = { 'visitor-access-pause': '暫停訪客進入' };
const RESPONSE_LABELS = { 'continue-on-preselected-visitor-route': '沿預選參訪路線繼續' };

// A fresh presentation uses only this selected frame and authored static identity.
// Unknown vocabulary stays unavailable; it is never exposed as a visitor label.
function inspectionPresentationForFrame(records, frame, declaration) {
  return Object.fromEntries(records.map(record => {
    const id = record['@id'];
    const states = frame.affected_twin_conditions
      .filter(row => row.affected_twin_ids.includes(id)).map(row => {
        if (row.condition_kind === 'crop-health-stage') {
          const label = declaration.levels.find(level => level.level_id === row.stage_level_id)?.display_label;
          return label ? `模擬作物階段：${label}` : '已提供模擬作物階段，但尚無可讀說明';
        }
        const label = CONDITION_LABELS[row.condition_kind];
        return label ? `模擬狀態：${label}` : '已提供模擬狀態，但尚無可讀說明';
      });
    for (const row of frame.restrictions.filter(row => row.affected_twin_ids.includes(id))) {
      const label = RESTRICTION_LABELS[row.restriction_kind];
      states.push(label ? `模擬限制：${label}` : '已提供模擬限制，但尚無可讀說明');
    }
    for (const row of frame.preselected_responses.filter(row => row.subject_ids.includes(id))) {
      const label = RESPONSE_LABELS[row.response_kind];
      states.push(label ? `模擬預選回應：${label}` : '已提供模擬預選回應，但尚無可讀說明');
    }
    const sources = [
      { label: '場景名稱、拓樸與來源紀錄', href: 'static-snapshot.json' },
      { label: '各時刻的模擬狀態與事件', href: 'composed-frames.json' },
    ];
    if (frame.affected_twin_conditions.some(row => row.condition_kind === 'crop-health-stage'
      && row.affected_twin_ids.includes(id))) {
      sources.push({ label: '模擬作物階段定義', href: 'crop-health-declaration.json' },
        { label: '作物階段情境的離線裁示', href: 'crop-health-decision.md' });
    }
    return [id, {
      title: record.display_label || record.name || '未提供顯示名稱',
      typeLabel: TYPE_LABELS[record['@type']] ?? '未提供可讀類型',
      stateLabel: states.join('；') || '本影格未提供目前狀態',
      timeLabel: `模擬時間：${Math.floor(frame.elapsed_seconds / 60)} 分 ${frame.elapsed_seconds % 60} 秒`,
      events: frame.event_occurrences.filter(row => row.affected_twin_ids.includes(id)).map(row => ({
        label: EVENT_LABELS[row.event_kind] ?? '已提供模擬事件，但尚無可讀說明',
      })),
      notices: [NOTICE_LABELS['explicitly-simulated'], NOTICE_LABELS['prototype-only-not-operational-advice'],
        '非正式候選示範；不提供即時監測、診斷或正式營運服務'],
      sources,
    }];
  }));
}

// The shipped filename of the presentation ruling. Its repository path lives inside
// each decision reference and the two deliberately differ, so this name is only ever
// used to look the receipt up in the manifest.
const PRESENTATION_DECISION_PATH = 'crop-health-presentation-decision.md';

function requireBinding(condition, detail) {
  if (!condition) throw new Error(`Farm canonical adapter: ${detail}; protecting the supplied artifact/runtime binding`);
}

export function createAdapter({ manifest, artifacts, resourceBaseUrl }) {
  const snapshot = artifacts['static-snapshot.json'];
  const four = artifacts['four-beat-frames.json'];
  const composed = artifacts['composed-frames.json'];
  const sequence = artifacts['crop-health-stage-sequence.json'];
  const declaration = artifacts['crop-health-declaration.json'];
  requireBinding(snapshot && four && composed && sequence && declaration, 'required candidate artifacts are missing');
  requireBinding(typeof snapshot.snapshot_revision === 'string'
    && snapshot.snapshot_revision === manifest.snapshot_revision
    && four.snapshot_revision === snapshot.snapshot_revision, 'snapshot revision mismatch');
  requireBinding(typeof four.frame_set_revision === 'string'
    && four.frame_set_revision === manifest.frame_set_revision
    && composed.source_frame_set_revision === four.frame_set_revision, 'four-beat frame-set revision mismatch');
  requireBinding(typeof composed.composed_revision === 'string'
    && composed.composed_revision === manifest.composed_revision
    && composed.crop_health_stage_sequence_revision === sequence.sequence_revision, 'composed/stage revision mismatch');
  requireBinding(four.acceptance_eligible === false && composed.acceptance_eligible === false,
    'this adapter is scoped to the non-shipping candidate');
  const frames = composed.canonical_frames;
  requireBinding(Array.isArray(frames) && frames.length === four.canonical_frames.length,
    'canonical frame count mismatch');
  const durationSeconds = four.demo_sequence.duration_seconds;
  requireBinding(Number.isFinite(durationSeconds) && durationSeconds > 0, 'declared duration is missing');
  const frameTimesSeconds = frames.map((frame, index) => {
    requireBinding(frame.frame_index === index && four.canonical_frames[index].frame_index === index
      && Number.isFinite(frame.elapsed_seconds) && frame.elapsed_seconds >= 0
      && frame.elapsed_seconds === four.canonical_frames[index].elapsed_seconds
      && frame.elapsed_seconds < durationSeconds, 'supplied frame index/time mismatch');
    return frame.elapsed_seconds;
  });
  const staticFaces = new Map(snapshot.static_merge.merged_topology_artifact.records
    .filter(row => row['@type'] === 'Face').map(row => [row['@id'], row]));
  const staticLinks = new Map(Object.values(snapshot.provenance_catalogs)
    .flatMap(catalog => catalog.links).map(row => [row['@id'], row]));
  const logicalIds = new Set(snapshot.static_merge.merged_topology_artifact.records.map(row => row['@id']));
  requireBinding(logicalIds.has(manifest.target_face_id), 'selected Face is absent from logical snapshot');
  const targets = manifest.target_face_ids ?? [manifest.target_face_id];
  requireBinding(targets.every(id => logicalIds.has(id)), 'governed Face is absent from logical snapshot');
  if (manifest.pest_spread_chain_revision) {
    const chain = artifacts['pest-spread-chain.json'];
    const report = artifacts['pest-spread-report.json'];
    requireBinding(chain && report && report.blocking === false
      && chain.chain_revision === manifest.pest_spread_chain_revision
      && composed.pest_spread_chain_revision === chain.chain_revision
      && report.source_chain_revision === chain.chain_revision
      && report.source_composed_revision === composed.composed_revision
      && report.report_revision === manifest.pest_spread_report_revision, 'spread report/chain revision mismatch');
  }
  // Presentation tokens: a static, ruled level-to-token mapping shipped beside the
  // ladder. Bound here so an absent, unruled, or incomplete mapping refuses before
  // playback; nothing is defaulted and no token is ever read from a frame.
  const mapping = artifacts['crop-health-presentation.json'];
  requireBinding(mapping && Array.isArray(mapping.tokens) && mapping.tokens.length > 0
    && mapping.ladder_decision_ref === declaration.basis.decision_ref,
  'presentation mapping is absent or was not ruled over this ladder');
  // The mapping must also resolve the ruling that set the tokens themselves, not only
  // the ladder it was ruled over. Checking the ladder alone left every presentation
  // decision reference unread, so an artifact set with the basis and all token
  // references deleted still bound and a regenerated manifest could ship tokens no
  // decision covers. The reference names a repository path while the manifest names
  // the shipped filename, so the digest is the join: the reference must match the
  // receipt the manifest records for the decision that travelled with these tokens.
  const presentationRef = mapping.basis && mapping.basis.decision_ref;
  requireBinding(typeof presentationRef === 'string' && presentationRef.length > 0,
    'presentation mapping resolves no decision reference of its own');
  requireBinding(mapping.tokens.every(token => token.decision_ref === presentationRef),
    'a presentation token resolves a decision its mapping does not');
  const presentationDigest = /@sha256:([0-9a-f]{64})$/.exec(presentationRef);
  requireBinding(Boolean(presentationDigest),
    'presentation decision reference carries no sha256 receipt');
  const presentationReceipt = (manifest.files || [])
    .find(row => row && row.path === PRESENTATION_DECISION_PATH);
  requireBinding(presentationReceipt && presentationReceipt.sha256 === presentationDigest[1],
    'presentation decision reference does not match the shipped decision receipt');
  const tokenByLevelId = new Map();
  for (const token of mapping.tokens) {
    for (const levelId of token.level_ids ?? []) {
      requireBinding(!tokenByLevelId.has(levelId), `presentation mapping assigns ${levelId} to two tokens`);
      tokenByLevelId.set(levelId, token);
    }
  }
  requireBinding(tokenByLevelId.size === declaration.levels.length
    && declaration.levels.every(row => tokenByLevelId.has(row.level_id)),
  'presentation mapping does not cover the declared ladder exactly once');
  // present-farm-per-plant-stage: a plant group's subjects are checked against the
  // snapshot for every frame before any frame is presented. The runtime never
  // presents state for a twin the static scene does not declare, or in a Face the
  // twin does not belong to; canonical frames stay the sole runtime authority, so
  // nothing is repaired or re-assigned to make a candidate pass.
  const topologyRecords = snapshot.static_merge.merged_topology_artifact.records;
  const nodeKinds = new Map(topologyRecords
    .filter(row => row['@type'] === 'Node').map(row => [row['@id'], row.node_kind]));
  const plantingPoints = new Map(topologyRecords
    .filter(row => row['@type'] === 'Node' && row.node_kind === 'planting-point')
    .map(row => [row['@id'], row]));
  for (let index = 0; index < frames.length; index += 1) {
    const projection = projectNonShippingPestSpread({ composedEnvelope: composed, currentFrameIndex: index });
    for (const stage of projection.affected_twins) {
      requireBinding(!nodeKinds.has(stage.twin_id),
        `frame ${index}: a ${nodeKinds.get(stage.twin_id)} Node is not a stage subject: ${stage.twin_id}`);
    }
    for (const group of projection.plant_groups) {
      requireBinding(staticFaces.has(group.containing_face_id),
        `frame ${index}: plant group names no declared Face: ${group.containing_face_id}`);
      for (const plant of group.plant_ids) {
        requireBinding(logicalIds.has(plant), `frame ${index}: plant is absent from the snapshot: ${plant}`);
        requireBinding(plantingPoints.has(plant),
          `frame ${index}: ${plant} is a ${nodeKinds.get(plant) ?? 'non-Node'} subject, not a declared planting point`);
        requireBinding(plantingPoints.get(plant).in_face === group.containing_face_id,
          `frame ${index}: ${plant} declares membership of ${plantingPoints.get(plant).in_face}, not ${group.containing_face_id}`);
      }
    }
  }
  const provenanceLinks = ['manifest.json', 'static-snapshot.json', 'composed-frames.json',
    'crop-health-declaration.json', 'crop-health-decision.md',
    'crop-health-presentation.json', PRESENTATION_DECISION_PATH,
    ...(manifest.pest_spread_chain_revision ? ['pest-spread-chain.json', 'pest-spread-report.json', 'pest-spread-decision.md'] : [])].map(path => ({
    label: path, url: new URL(path, resourceBaseUrl).href,
  }));

  return {
    title: '國立屏東科技大學「智慧化農業管理平台」',
    durationSeconds,
    frameTimesSeconds,
    selectFrame(index) {
      const projection = projectNonShippingPestSpread({ composedEnvelope: composed, currentFrameIndex: index });
      const frame = frames[index];
      requireBinding(projection.affected_twins.length === targets.length
        && projection.affected_twins.every(stage => targets.includes(stage.twin_id)), 'canonical governed Face membership mismatch');
      const inspection = {};
      const presentation = {};
      function append(ids, rows) {
        for (const id of ids) {
          requireBinding(logicalIds.has(id), `logical subject is absent from snapshot: ${id}`);
          (inspection[id] ??= []).push(...rows);
        }
      }
      for (const stage of projection.affected_twins) {
        requireBinding(stage.provenance.scenario_id === four.scenario.scenario_id
          && stage.provenance.scenario_revision === four.scenario.revision, 'stage scenario revision mismatch');
        // The token is a lookup of the frame's declared level, never a derivation.
        const token = tokenByLevelId.get(stage.stage_level_id);
        requireBinding(token, `presentation mapping has no token for ${stage.stage_level_id}`);
        presentation[stage.twin_id] = {
          token_id: token.token_id,
          overrides_baked_appearance: token.overrides_baked_appearance,
          ...(token.overrides_baked_appearance ? { color: token.color } : {}),
          transition: token.transition,
          decision_ref: token.decision_ref,
        };
        const level = declaration.levels.find(row => row.level_id === stage.stage_level_id);
        requireBinding(level && level.level === stage.stage_level
          && level.is_biological_control_window === stage.is_biological_control_window,
          'supplied stage does not match its declared vocabulary');
        append([stage.twin_id], [
          { label: '模擬作物階段', value: level.display_label },
          { label: 'stage_level', value: String(stage.stage_level) },
          { label: 'stage_level_id', value: stage.stage_level_id },
          { label: 'is_biological_control_window', value: String(stage.is_biological_control_window) },
          { label: '來源', value: [...stage.provenance_source_ids] },
        ]);
        // Static inspection only; the current frame still supplies every stage.
        const face = staticFaces.get(stage.twin_id);
        if (face?.crop_group) {
          const links = snapshot.static_merge.tier_lineage.fields[stage.twin_id].crop_group.effective_link_ids;
          append([stage.twin_id], [
            { label: 'stable_id', value: face['@id'] },
            { label: '模擬作物分組', value: face.crop_group.token },
            { label: '分組來源', value: [...new Set(links.map(id => staticLinks.get(id).source_id))] },
            { label: '分組依據連結', value: [...links] },
            { label: '分組裁示', value: face.crop_group.basis.decision_ref },
          ]);
        }
      }
      // Each plant is presented from its own group's declared stage by the same
      // lookup as a Face; nothing is taken from its Face or its neighbours.
      for (const group of projection.plant_groups) {
        requireBinding(group.provenance.scenario_id === four.scenario.scenario_id
          && group.provenance.scenario_revision === four.scenario.revision, 'plant stage scenario revision mismatch');
        const token = tokenByLevelId.get(group.stage_level_id);
        requireBinding(token, `presentation mapping has no token for ${group.stage_level_id}`);
        const level = declaration.levels.find(row => row.level_id === group.stage_level_id);
        requireBinding(level && level.level === group.stage_level
          && level.is_biological_control_window === group.is_biological_control_window,
          'supplied plant stage does not match its declared vocabulary');
        for (const plant of group.plant_ids) {
          presentation[plant] = {
            token_id: token.token_id,
            overrides_baked_appearance: token.overrides_baked_appearance,
            ...(token.overrides_baked_appearance ? { color: token.color } : {}),
            transition: token.transition,
            decision_ref: token.decision_ref,
          };
        }
        append([...group.plant_ids], [
          { label: '模擬作物階段', value: level.display_label },
          { label: 'stage_level', value: String(group.stage_level) },
          { label: 'stage_level_id', value: group.stage_level_id },
          { label: 'is_biological_control_window', value: String(group.is_biological_control_window) },
          { label: '所在田區', value: group.containing_face_id },
          { label: '來源', value: [...group.provenance_source_ids] },
        ]);
      }
      // Static crop fields from the frozen snapshot, for every record that
      // declares one (governed Faces and planting points alike); no frame reads them.
      for (const record of topologyRecords.filter(row => row.crop)) {
        const { crop } = record;
        const links = snapshot.static_merge.tier_lineage.fields[record['@id']]?.crop?.effective_link_ids ?? [];
        const sources = links.map(id => {
          requireBinding(staticLinks.has(id), `crop lineage link ${id} is absent from the provenance catalogs`);
          return staticLinks.get(id).source_id;
        });
        const decisionFile = String(crop.basis?.decision_ref ?? '').split('@')[0].split('/').at(-1);
        const citations = Object.entries(crop.basis?.citations ?? {})
          .map(([field, where]) => `${CROP_CITATION_LABELS[field] ?? field}：${where}`);
        append([record['@id']], [
          { label: '模擬作物', value: crop.species_name_zh },
          { label: '學名', value: crop.scientific_name },
          { label: '類別', value: CROP_KIND_LABELS[crop.crop_kind] ?? '已提供作物類別，但尚無可讀說明' },
          { label: '作物出處', value: [...(decisionFile ? [decisionFile] : []), ...new Set(sources), ...citations] },
        ]);
      }
      for (const event of frame.event_occurrences) {
        append(event.affected_twin_ids, [
          { label: '本影格事件', value: [event.event_kind, event.occurrence_id, ...event.subject_ids] },
          { label: '事件來源', value: [...event.provenance_source_ids] },
        ]);
      }
      for (const restriction of frame.restrictions) {
        append(restriction.affected_twin_ids, [
          { label: '本影格限制', value: [restriction.restriction_kind, restriction.restriction_occurrence_id] },
        ]);
      }
      for (const response of frame.preselected_responses) {
        append(response.subject_ids, [
          { label: '本影格預選回應', value: [response.response_kind, response.preselected_response_id] },
          { label: '回應來源', value: [...response.provenance_source_ids] },
        ]);
        // Frame-wide summary explicitly names its subjects; it is not a Face response.
        append([manifest.target_face_id], [{ label: '本影格預選回應及對象',
          value: [response.response_kind, ...response.subject_ids] }]);
      }
      return {
        frameIndex: index,
        elapsedSeconds: frame.elapsed_seconds,
        beatLabel: BEAT_LABELS[frame.narrative_beat.beat_kind] ?? frame.narrative_beat.beat_kind,
        notices: [NOTICE_LABELS[declaration.simulation_label] ?? declaration.simulation_label,
          NOTICE_LABELS[declaration.recommendation_label] ?? declaration.recommendation_label,
          '非正式候選示範'],
        notifications: frame.event_occurrences.map(row => ({
          id: row.occurrence_id,
          text: EVENT_LABELS[row.event_kind] ?? row.event_kind,
          sourceIds: [...row.provenance_source_ids],
        })),
        inspection,
        inspectionPresentation: inspectionPresentationForFrame(
          snapshot.static_merge.merged_topology_artifact.records, frame, declaration),
        presentation,
        provenanceLinks: provenanceLinks.map(row => ({ ...row })),
      };
    },
  };
}
