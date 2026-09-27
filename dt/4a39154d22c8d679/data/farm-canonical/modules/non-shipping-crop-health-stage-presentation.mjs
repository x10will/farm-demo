// Non-shipping presentation of the crop health stage and the notifications
// active in one canonical frame.
//
// The stage is shown as state: its declared level identity, its resolvable
// provenance, and its simulated-state and non-advice labels.  Every event
// occurrence active in the frame becomes its own notification carrying its own
// subject, its own labels, and only the restrictions and responses that name
// it.  Two notifications are never merged, and neither inherits the other's
// bindings.
//
// Caller-supplied annotation text is screened rather than trusted: anything
// that reads as a diagnosis, a treatment, an operational instruction, a sensor
// reading, or an attested crop or pest is refused, because the product
// boundary excludes all of them.

const REQUEST_KEYS = ['annotations', 'composedEnvelope', 'currentFrameIndex'];
const STAGE_CONDITION_KIND = 'crop-health-stage';
const SIMULATION_LABEL = 'explicitly-simulated';
const RECOMMENDATION_LABEL = 'prototype-only-not-operational-advice';
const REQUIRED_STAGE_KEYS = [
  'affected_twin_ids',
  'is_biological_control_window',
  'provenance_source_ids',
  'recommendation_label',
  'simulation_label',
  'stage_level',
  'stage_level_id',
];

// A disclaimer is not advice.  The required non-advice label itself contains
// the word, so permitted disclaimers are removed before the screen runs.
const PERMITTED_DISCLAIMERS = [
  'prototype-only-not-operational-advice',
  'not operational advice',
  'non-advice',
  'not advice',
];

// Screened as whole words or phrases against lowercased annotation text.
const REFUSED_FRAMING = [
  'diagnos',
  'recommend',
  'advice',
  'advise',
  'you should',
  'should spray',
  'apply bacillus',
  'treatment',
  'treat this',
  'spray',
  'intervene',
  'intervention',
  'sensor reading',
  'trap count',
  'grows mango',
  'grows cocoa',
  'confirmed',
  'required before',
  'pause harvesting',
  'immediately',
];

export class NonShippingCropHealthStagePresentationError extends Error {
  constructor(issues) {
    const sorted = Array.from(new Set(issues)).sort();
    super(sorted.join('; '));
    this.name = 'NonShippingCropHealthStagePresentationError';
    this.issues = Object.freeze(sorted);
  }
}

function refuse(issue) {
  throw new NonShippingCropHealthStagePresentationError([issue]);
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

function bindingIds(records, key, occurrenceId) {
  const bound = [];
  for (const record of Array.isArray(records) ? records : []) {
    if (!plainObject(record)) {
      continue;
    }
    const causes = record.causal_event_occurrence_ids;
    if (!Array.isArray(causes) || !causes.includes(occurrenceId)) {
      continue;
    }
    const identity = record[key];
    if (nonEmptyText(identity)) {
      bound.push(identity);
    }
  }
  return Object.freeze(bound);
}

export function presentNonShippingCropHealthStage(request) {
  if (!plainObject(request)) {
    refuse('request: a plain presentation request is required');
  }
  for (const key of Object.keys(request)) {
    if (!REQUEST_KEYS.includes(key)) {
      refuse(`request: unsupported field ${key}`);
    }
  }

  const { annotations, composedEnvelope, currentFrameIndex } = request;
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

  const screened = [];
  if (annotations !== undefined) {
    if (!Array.isArray(annotations)) {
      refuse('annotations: a list of annotation strings is required');
    }
    for (const annotation of annotations) {
      if (!nonEmptyText(annotation)) {
        refuse('annotations: every annotation must be non-empty text');
      }
      let lowered = annotation.toLowerCase();
      for (const disclaimer of PERMITTED_DISCLAIMERS) {
        lowered = lowered.split(disclaimer).join(' ');
      }
      for (const framing of REFUSED_FRAMING) {
        if (lowered.includes(framing)) {
          refuse(
            `annotations: ${framing} reads as diagnosis, advice, an operational ` +
              'instruction, a reading, or an attested fact',
          );
        }
      }
      screened.push(annotation);
    }
  }

  const frame = frames[currentFrameIndex];
  if (!plainObject(frame)) {
    refuse('frame: a plain canonical frame is required');
  }

  const conditions = Array.isArray(frame.affected_twin_conditions)
    ? frame.affected_twin_conditions
    : [];
  const declaredStages = conditions.filter(
    (candidate) =>
      plainObject(candidate) && candidate.condition_kind === STAGE_CONDITION_KIND,
  );
  if (declaredStages.length > 1) {
    refuse('frame: more than one crop health stage is declared for this frame');
  }

  let stageState = null;
  if (declaredStages.length === 1) {
    const declared = declaredStages[0];
    for (const key of REQUIRED_STAGE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(declared, key)) {
        refuse(`stage: ${key} is required and is never defaulted`);
      }
    }
    if (declared.simulation_label !== SIMULATION_LABEL) {
      refuse('stage.simulation_label: the simulated-state label is required');
    }
    if (declared.recommendation_label !== RECOMMENDATION_LABEL) {
      refuse('stage.recommendation_label: the non-advice label is required');
    }
    stageState = Object.freeze({
      affected_twin_ids: Object.freeze([...declared.affected_twin_ids]),
      is_biological_control_window: declared.is_biological_control_window,
      provenance_source_ids: Object.freeze([...declared.provenance_source_ids]),
      recommendation_label: declared.recommendation_label,
      simulation_label: declared.simulation_label,
      stage_level: declared.stage_level,
      stage_level_id: declared.stage_level_id,
    });
  }

  const occurrences = Array.isArray(frame.event_occurrences)
    ? frame.event_occurrences
    : [];
  const notifications = [];
  for (const candidate of occurrences) {
    if (!plainObject(candidate)) {
      refuse('event_occurrences: a plain occurrence record is required');
    }
    const occurrenceId = candidate.occurrence_id;
    if (!nonEmptyText(occurrenceId)) {
      refuse('event_occurrences: every occurrence needs a stable identity');
    }
    if (
      candidate.simulation_label !== SIMULATION_LABEL ||
      candidate.recommendation_label !== RECOMMENDATION_LABEL
    ) {
      refuse(`${occurrenceId}: both notification labels are required`);
    }
    const subjects = candidate.subject_ids;
    if (!Array.isArray(subjects) || subjects.length === 0) {
      refuse(`${occurrenceId}: a notification needs its own subject`);
    }
    notifications.push(
      Object.freeze({
        event_kind: candidate.event_kind,
        occurrence_id: occurrenceId,
        preselected_response_ids: bindingIds(
          frame.preselected_responses,
          'preselected_response_id',
          occurrenceId,
        ),
        provenance_source_ids: Object.freeze([
          ...(Array.isArray(candidate.provenance_source_ids)
            ? candidate.provenance_source_ids
            : []),
        ]),
        recommendation_label: candidate.recommendation_label,
        restriction_occurrence_ids: bindingIds(
          frame.restrictions,
          'restriction_occurrence_id',
          occurrenceId,
        ),
        simulation_label: candidate.simulation_label,
        subject_ids: Object.freeze([...subjects]),
      }),
    );
  }

  return Object.freeze({
    annotations: Object.freeze(screened),
    frame_index: currentFrameIndex,
    notifications: Object.freeze(notifications),
    stage_state: stageState,
  });
}
