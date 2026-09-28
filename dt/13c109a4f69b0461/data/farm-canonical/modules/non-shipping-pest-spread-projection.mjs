// Non-shipping projection of the spread-affected Faces carried by one
// canonical frame.
//
// Spread is visible as more Faces carrying a declared level, so this reads the
// one frame the caller names and returns every affected twin that frame
// authorizes, or an empty list.  It has no imports, no stored state, and no
// arithmetic on levels: a displayed level is always a level some frame
// declared.
//
// What it deliberately does not do is say *why* a Face is affected.  It never
// reads a group token, never measures anything between Faces, never works out
// which Face reached which, and never looks at a neighbouring frame, an event
// occurrence, a dressing record, terrain, or the frozen snapshot.  A malformed
// record is refused rather than having a value substituted for it.

const PROJECTION_KEYS = ['composedEnvelope', 'currentFrameIndex'];
const STAGE_CONDITION_KIND = 'crop-health-stage';
const SIMULATION_LABEL = 'explicitly-simulated';
const RECOMMENDATION_LABEL = 'prototype-only-not-operational-advice';
const REQUIRED_STAGE_KEYS = [
  'affected_twin_ids',
  'is_biological_control_window',
  'provenance',
  'provenance_source_ids',
  'recommendation_label',
  'simulation_label',
  'stage_level',
  'stage_level_id',
];

export class NonShippingPestSpreadProjectionError extends Error {
  constructor(issues) {
    const sorted = Array.from(new Set(issues)).sort();
    super(sorted.join('; '));
    this.name = 'NonShippingPestSpreadProjectionError';
    this.issues = Object.freeze(sorted);
  }
}

function refuse(issue) {
  throw new NonShippingPestSpreadProjectionError([issue]);
}

function plainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function checkStageRecord(record) {
  for (const key of REQUIRED_STAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      refuse(`stage: ${key} is required and is never defaulted`);
    }
  }
  if (
    typeof record.stage_level !== 'number' ||
    typeof record.stage_level === 'boolean' ||
    !Number.isInteger(record.stage_level)
  ) {
    refuse('stage.stage_level: an integral declared level is required');
  }
  if (!nonEmptyText(record.stage_level_id)) {
    refuse('stage.stage_level_id: a declared level identity is required');
  }
  if (typeof record.is_biological_control_window !== 'boolean') {
    refuse('stage.is_biological_control_window: a declared flag is required');
  }
  if (record.simulation_label !== SIMULATION_LABEL) {
    refuse('stage.simulation_label: the simulated-state label is required');
  }
  if (record.recommendation_label !== RECOMMENDATION_LABEL) {
    refuse('stage.recommendation_label: the non-advice label is required');
  }
  if (!plainObject(record.provenance)) {
    refuse('stage.provenance: resolvable provenance is required');
  }
  const sources = record.provenance_source_ids;
  if (!Array.isArray(sources) || sources.length === 0 || !sources.every(nonEmptyText)) {
    refuse('stage.provenance_source_ids: a resolvable basis is required');
  }
  return sources;
}

export function projectNonShippingPestSpread(inputs) {
  if (!plainObject(inputs)) {
    refuse('inputs: a plain projection request is required');
  }
  for (const key of Object.keys(inputs)) {
    if (!PROJECTION_KEYS.includes(key)) {
      refuse(`inputs: unsupported field ${key}`);
    }
  }

  const { composedEnvelope, currentFrameIndex } = inputs;
  if (!plainObject(composedEnvelope)) {
    refuse('composedEnvelope: a composed canonical-frame envelope is required');
  }
  const frames = composedEnvelope.canonical_frames;
  if (!Array.isArray(frames) || frames.length === 0) {
    refuse('composedEnvelope.canonical_frames: a non-empty frame list is required');
  }
  if (
    typeof currentFrameIndex !== 'number' ||
    typeof currentFrameIndex === 'boolean' ||
    !Number.isInteger(currentFrameIndex) ||
    currentFrameIndex < 0 ||
    currentFrameIndex >= frames.length
  ) {
    refuse('currentFrameIndex: an in-range integral frame index is required');
  }

  // Exactly one frame is read.  No neighbour, no history, no snapshot.
  const frame = frames[currentFrameIndex];
  if (!plainObject(frame)) {
    refuse('frame: a plain canonical frame is required');
  }
  const conditions = frame.affected_twin_conditions;
  if (!Array.isArray(conditions)) {
    refuse('frame.affected_twin_conditions: a condition list is required');
  }

  const declared = conditions.filter(
    (candidate) =>
      plainObject(candidate) && candidate.condition_kind === STAGE_CONDITION_KIND,
  );

  // A record naming a containing Face is a plant group (present-farm-per-plant-
  // stage).  Its structure is checked here; whether each subject is a planting
  // point of that Face needs the snapshot, so the adapter checks that.
  const faceRecords = declared.filter(
    (record) => !Object.prototype.hasOwnProperty.call(record, 'containing_face_id'),
  );
  const groupRecords = declared.filter((record) =>
    Object.prototype.hasOwnProperty.call(record, 'containing_face_id'),
  );

  const projected = [];
  const claimed = [];
  function claim(twin) {
    if (claimed.includes(twin)) {
      refuse(`frame: ${twin} carries more than one declared level in this frame`);
    }
    claimed.push(twin);
  }

  for (const record of faceRecords) {
    const sources = checkStageRecord(record);
    const twins = record.affected_twin_ids;
    if (!Array.isArray(twins) || twins.length !== 1 || !twins.every(nonEmptyText)) {
      refuse('stage.affected_twin_ids: exactly one named twin is required');
    }

    const twin = twins[0];
    claim(twin);

    projected.push(
      Object.freeze({
        is_biological_control_window: record.is_biological_control_window,
        provenance: Object.freeze({ ...record.provenance }),
        provenance_source_ids: Object.freeze([...sources]),
        recommendation_label: record.recommendation_label,
        simulation_label: record.simulation_label,
        stage_level: record.stage_level,
        stage_level_id: record.stage_level_id,
        twin_id: twin,
      }),
    );
  }

  const plantGroups = [];
  for (const record of groupRecords) {
    const sources = checkStageRecord(record);
    if (!nonEmptyText(record.containing_face_id)) {
      refuse('plant group.containing_face_id: the containing Face is required');
    }
    const plants = record.affected_twin_ids;
    if (!Array.isArray(plants) || plants.length === 0 || !plants.every(nonEmptyText)) {
      refuse('plant group.affected_twin_ids: at least one named plant is required');
    }
    for (const plant of plants) {
      claim(plant);
    }
    plantGroups.push(
      Object.freeze({
        condition_occurrence_id: record.condition_occurrence_id,
        containing_face_id: record.containing_face_id,
        is_biological_control_window: record.is_biological_control_window,
        plant_ids: Object.freeze([...plants].sort()),
        provenance: Object.freeze({ ...record.provenance }),
        provenance_source_ids: Object.freeze([...sources]),
        recommendation_label: record.recommendation_label,
        simulation_label: record.simulation_label,
        stage_level: record.stage_level,
        stage_level_id: record.stage_level_id,
      }),
    );
  }
  plantGroups.sort((left, right) =>
    left.containing_face_id === right.containing_face_id
      ? left.stage_level - right.stage_level
      : left.containing_face_id < right.containing_face_id
        ? -1
        : 1,
  );

  // Ordered by twin identity so the same frame always presents the same way.
  projected.sort((left, right) => (left.twin_id < right.twin_id ? -1 : 1));

  return Object.freeze({
    affected_twins: Object.freeze(projected),
    frame_index: currentFrameIndex,
    plant_groups: Object.freeze(plantGroups),
  });
}
