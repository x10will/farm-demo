// Phone presentation state only. IDs and tree membership come from the verified
// static snapshot; canonical frames remain the sole authority for runtime data.
import {canonicalAdapter} from './panels/farm-data.js';

const COMMAND = 'farm-phone-drilldown';

export function createPhoneDrilldown(app, {restoreOverview} = {}) {
  let selectedFieldId = null;
  let fieldFlightUntil = 0;
  const data = canonicalAdapter().then(({manifest, artifacts}) => {
    const snapshot = artifacts['static-snapshot.json'];
    const records = snapshot.static_merge.merged_topology_artifact.records;
    const byId = new Map(records.map(record => [record['@id'], record]));
    const faces = new Map((manifest.target_face_ids || [])
      .filter(id => byId.get(id)?.face_kind === 'field_block')
      .map(id => [id, byId.get(id)]));
    // The accepted Director ring is the rendered footprint. A Producer record's
    // legacy polygon can be in a different local frame (field-alpha is).
    const rings = new Map(snapshot.static_merge.geometry_catalog
      .filter(row => faces.has(row.target_id) && row.field_name === 'geometry_payload'
        && row.value?.payload_kind === 'face-polygon' && Array.isArray(row.value.ring))
      .map(row => [row.target_id, row.value.ring]));
    const trees = new Map(records.filter(record => record.node_kind === 'planting-point' && faces.has(record.in_face))
      .map(record => [record['@id'], record]));
    return {faces, rings, trees};
  }, () => ({faces: new Map(), rings: new Map(), trees: new Map()}));
  const configure = async () => {
    const {faces, rings, trees} = await data;
    app.map.send('appCommand', {name: COMMAND, payload: {
      fields: [...rings].map(([id, ring]) => ({id, ring})),
      trees: [...trees.values()].map(record => ({id: record['@id'], faceId: record.in_face})),
      selectedFieldId,
    }});
  };
  const selectField = async (id, {fly = true} = {}) => {
    const {faces} = await data;
    const record = faces.get(id);
    if (!record) return false;
    const move = fly && selectedFieldId !== id;
    selectedFieldId = id;
    if (move) fieldFlightUntil = performance.now() + 1100;
    app.select({id, label: record.display_label || id, type: 'Face', properties: {}});
    if (move) app.map.send('flyTo', {target: {id}});
    await configure();
    return true;
  };
  const selectTree = async id => {
    const {trees} = await data;
    const record = trees.get(id);
    if (!record || record.in_face !== selectedFieldId) return false;
    app.select({id, label: record.display_label || id, type: 'Node', properties: {}});
    return true;
  };
  const clear = () => {
    selectedFieldId = null;
    app.select(null);
    void configure();
    restoreOverview?.();
  };
  app.map.subscribe('ready', () => { void configure(); });
  app.map.subscribe('select', ({entity} = {}) => {
    // The viewer may post its own pick before the iframe extension can cancel
    // it. At level 1 only Farm's polygon tap decides the sheet selection.
    if (!selectedFieldId) { if (entity) app.select(null); return; }
    if (performance.now() < fieldFlightUntil && entity?.id !== selectedFieldId)
      void selectField(selectedFieldId, {fly: false});
  });
  app.map.subscribe('appEvent', ({name, payload} = {}) => {
    if (name === 'farm-phone-drilldown-ready') void configure();
    if (name === 'farm-phone-field-tap') void selectField(payload?.id);
    if (name === 'farm-phone-tree-tap') void selectTree(payload?.id);
  });
  return {selectField, clear};
}
