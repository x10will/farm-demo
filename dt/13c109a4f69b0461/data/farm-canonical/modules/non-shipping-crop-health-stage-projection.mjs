// Non-shipping projection of the crop health stage carried by one canonical
// frame.
//
// The projection reads exactly one frame — the one the caller names — and
// returns the stage that frame authorizes, or nothing.  It has no imports, no
// stored state, and no arithmetic on levels: a displayed level is always a
// level some frame declared.  It never reads a neighbouring frame, an event
// occurrence, a dressing record, terrain, or the frozen snapshot, and it
// refuses a malformed record instead of substituting a value for it.

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

export class NonShippingCropHealthStageProjectionError extends Error {
  constructor(issues) {
    const sorted = Array.from(new Set(issues)).sort();
    super(sorted.join('; '));
    this.name = 'NonShippingCropHealthStageProjectionError';
    this.issues = Object.freeze(sorted);
  }
}

function refuse(issue) {
  throw new NonShippingCropHealthStageProjectionError([issue]);
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

export function projectNonShippingCropHealthStage(inputs) {
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

  const stages = conditions.filter(
    (candidate) =>
      plainObject(candidate) && candidate.condition_kind === STAGE_CONDITION_KIND,
  );
  if (stages.length > 1) {
    refuse('frame: more than one crop health stage is declared for this frame');
  }
  if (stages.length === 0) {
    return Object.freeze({
      frame_index: currentFrameIndex,
      stage: null,
    });
  }

  const declared = stages[0];
  for (const key of REQUIRED_STAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(declared, key)) {
      refuse(`stage: ${key} is required and is never defaulted`);
    }
  }
  if (
    typeof declared.stage_level !== 'number' ||
    typeof declared.stage_level === 'boolean' ||
    !Number.isInteger(declared.stage_level)
  ) {
    refuse('stage.stage_level: an integral declared level is required');
  }
  if (!nonEmptyText(declared.stage_level_id)) {
    refuse('stage.stage_level_id: a declared level identity is required');
  }
  if (typeof declared.is_biological_control_window !== 'boolean') {
    refuse('stage.is_biological_control_window: a declared flag is required');
  }
  if (declared.simulation_label !== SIMULATION_LABEL) {
    refuse('stage.simulation_label: the simulated-state label is required');
  }
  if (declared.recommendation_label !== RECOMMENDATION_LABEL) {
    refuse('stage.recommendation_label: the non-advice label is required');
  }
  if (!plainObject(declared.provenance)) {
    refuse('stage.provenance: resolvable provenance is required');
  }
  const sources = declared.provenance_source_ids;
  if (!Array.isArray(sources) || sources.length === 0 || !sources.every(nonEmptyText)) {
    refuse('stage.provenance_source_ids: a resolvable basis is required');
  }
  const twins = declared.affected_twin_ids;
  if (!Array.isArray(twins) || twins.length === 0 || !twins.every(nonEmptyText)) {
    refuse('stage.affected_twin_ids: at least one named twin is required');
  }

  return Object.freeze({
    frame_index: currentFrameIndex,
    stage: Object.freeze({
      affected_twin_ids: Object.freeze([...twins]),
      is_biological_control_window: declared.is_biological_control_window,
      provenance: Object.freeze({ ...declared.provenance }),
      provenance_source_ids: Object.freeze([...sources]),
      recommendation_label: declared.recommendation_label,
      simulation_label: declared.simulation_label,
      stage_level: declared.stage_level,
      stage_level_id: declared.stage_level_id,
    }),
  });
}
