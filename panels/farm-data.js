// Shared farm data access for the farm panels. Every value comes from a file
// served same-origin beside the app; nothing here derives runtime state.

// The app's own directory: the DT tree sits beside it, at whatever base path the app is
// served: dt/ under run.py's gateway, dt/<id>/ in the static build, whose deployment-config.js
// names it so a page only ever asks for its own build's DT files.
export const APP_BASE = new URL('../', import.meta.url).href;
export const DT_BASE = new URL(globalThis.FARM_DEPLOYMENT?.dtBase || 'dt/', APP_BASE).href;

// Canonical candidate data exported by farm.
export const CANONICAL_BASE = new URL('data/farm-canonical/', DT_BASE).href;

// Simulation notices. Same strings as NOTICE_LABELS in
// packages/farm-player/src/viewer/farm-canonical-adapter.mjs, which exports
// no copy of them; keep the two in step.
export const NOTICES = ['本示範資料皆為模擬', '僅供原型展示，非農場操作建議'];

// Who drew the map's current highlight. The map keeps one highlight, so a
// panel clears it only while it is still the one that drew it.
let highlightOwner = null;
export function claimHighlight(owner) { highlightOwner = owner; }
export function ownsHighlight(owner) { return highlightOwner === owner; }

// Default cache mode on purpose: the map iframe's viewer fetches the same canonical files
// by the same URLs, and a shared HTTP cache (or the static build's service worker) lets
// the second reader take the first one's bytes instead of downloading them again.
// Measured 2026-09-27 on a cold Fast 4G load: with no-store every canonical file came
// down twice (about 4.4 MB each time). Under run.py the gateway answers no-store itself.
const cache = new Map();
export function loadJSON(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    }).catch(error => { cache.delete(url); throw error; }));
  }
  return cache.get(url);
}

// Managed field Faces: ids from the canonical manifest, labels from the
// frozen static snapshot's topology records (joined by stable id only).
export async function managedFaces() {
  const [manifest, snapshot] = await Promise.all([
    loadJSON(CANONICAL_BASE + 'manifest.json'),
    loadJSON(CANONICAL_BASE + 'static-snapshot.json'),
  ]);
  const records = snapshot?.static_merge?.merged_topology_artifact?.records || [];
  const faces = new Map(records.filter(r => r['@type'] === 'Face').map(r => [r['@id'], r]));
  // crop is the snapshot's static, simulated crop name; absent when none is declared.
  return (manifest.target_face_ids || []).map(id => ({id, label: faces.get(id)?.display_label || id.split(':').at(-1),
    crop: faces.get(id)?.crop?.species_name_zh || null}));
}

// The canonical adapter the viewer runs, loaded from the same candidate
// directory, so panels show its labels rather than a second copy of them.
// Only the candidate's JSON artifacts are read; the adapter checks their
// bindings exactly as it does in the viewer.
export async function canonicalAdapter(base = CANONICAL_BASE) {
  const root = new URL(base, globalThis.location?.href).href;
  const manifest = await loadJSON(new URL('manifest.json', root).href);
  const artifacts = Object.fromEntries(await Promise.all((manifest.files || [])
    .filter(f => f.path.endsWith('.json'))
    .map(async f => [f.path, await loadJSON(new URL(f.path, root).href)])));
  const {createAdapter} = await import(new URL(manifest.adapter_entry, root).href);
  return {adapter: createAdapter({manifest, artifacts, resourceBaseUrl: root}), manifest, artifacts};
}

// The canonical frame shown at shell time t (ms): the last frame whose
// authored time is not after t, the rule DT's canonical embed clock seeks by.
export function frameIndexAt(frameTimesSeconds, t) {
  let index = 0;
  while (index + 1 < frameTimesSeconds.length && frameTimesSeconds[index + 1] * 1000 <= t) index++;
  return index;
}

export function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = String(text);
  if (cls) n.className = cls;
  return n;
}

export function noticeBar() {
  const bar = el('div', null, 'farm-notices');
  bar.setAttribute('role', 'note');
  for (const text of NOTICES) bar.append(el('span', text, 'farm-notice'));
  return bar;
}
