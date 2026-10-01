// Shared farm data access for the farm panels. Every value comes from a file
// served same-origin beside the app; nothing here derives runtime state.
import {current} from './scenario.js';
import {siteFrom, siteNotices} from '../site.js';

// The app's own directory: the DT tree sits beside it, at whatever base path the app is
// served: dt/ under run.py's gateway, dt/<id>/ in the static build, whose deployment-config.js
// names it so a page only ever asks for its own build's DT files.
export const APP_BASE = new URL('../', import.meta.url).href;
export const DT_BASE = new URL(globalThis.FARM_DEPLOYMENT?.dtBase || 'dt/', APP_BASE).href;
export const SITE = siteFrom();

// Canonical candidate data exported by farm: the mount of the scenario this page plays
// (data/farm-canonical/ for 總覽, data/farm-canonical-<id>/ for the others; see scenario.js).
// For a refused ?scenario= value no candidate is read at all: every request under this base
// fails with the refusal, so no panel can show another scenario's data in its place.
export const SCENARIO = current.scenario || null;
export const SCENARIO_ERROR = current.error || null;
export const canonicalBaseFor = scenario => new URL(`data/${scenario ? scenario.mount : 'farm-canonical-refused'}/`, DT_BASE).href;
export const CANONICAL_BASE = canonicalBaseFor(SCENARIO);

// Simulation notices. Same strings as NOTICE_LABELS in
// packages/farm-player/src/viewer/farm-canonical-adapter.mjs, which exports
// no copy of them; keep the two in step.
export const NOTICES = siteNotices(SITE);

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
  if (SCENARIO_ERROR && String(url).startsWith(CANONICAL_BASE)) return Promise.reject(new Error(SCENARIO_ERROR));
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    }).catch(error => { cache.delete(url); throw error; }));
  }
  return cache.get(url);
}

// Managed field Faces: ids from the canonical manifest, labels from the
// verified static snapshot's topology records (joined by stable id only).
export async function managedFaces(load = () => canonicalAdapter()) {
  const {manifest, artifacts} = await load();
  const snapshot = artifacts['static-snapshot.json'];
  const records = snapshot?.static_merge?.merged_topology_artifact?.records || [];
  const faces = new Map(records.filter(r => r['@type'] === 'Face').map(r => [r['@id'], r]));
  // crop is the snapshot's static, simulated crop name; absent when none is declared.
  return (manifest.target_face_ids || []).map(id => ({id, label: faces.get(id)?.display_label || id.split(':').at(-1),
    crop: faces.get(id)?.crop?.species_name_zh || null}));
}

// The same DT loader used by the map verifies the static-package binding and
// every candidate receipt before any panel receives its adapter or artifacts.
// The injection seam lets offline tests supply that same loader and file reads.
const verifiedCandidates = new Map();
export function canonicalAdapter(base = CANONICAL_BASE, options) {
  const root = new URL(base, globalThis.location?.href).href;
  if (SCENARIO_ERROR && root === CANONICAL_BASE) return Promise.reject(new Error(SCENARIO_ERROR));
  const expectedManifest = root === CANONICAL_BASE ? SCENARIO?.manifest : null;
  if (options) return loadVerifiedCandidate(root, {...options, catalogueManifest: options.catalogueManifest ?? expectedManifest});
  if (!verifiedCandidates.has(root)) {
    verifiedCandidates.set(root, loadVerifiedCandidate(root, {catalogueManifest: expectedManifest}).catch(error => {
      verifiedCandidates.delete(root);
      throw error;
    }));
  }
  return verifiedCandidates.get(root);
}

async function loadVerifiedCandidate(root, {fetchResource = fetch, loadCandidate,
  staticManifestUrl = new URL(`data/${SITE.static_mount}/manifest.json`, DT_BASE).href, catalogueManifest} = {}) {
  let manifest, artifacts;
  try {
    const response = await fetchResource(staticManifestUrl);
    if (!response.ok) throw new Error(`${staticManifestUrl}: HTTP ${response.status}`);
    const staticManifestBytes = await response.arrayBuffer();
    const manifestUrl = new URL('manifest.json', root).href;
    let verifiedFetch = fetchResource;
    if (catalogueManifest) {
      if (root === CANONICAL_BASE && catalogueManifest.path !== `${SCENARIO.mount}/manifest.json`) {
        throw new Error('selected manifest path does not match the catalogue mount');
      }
      const selected = await fetchResource(manifestUrl);
      if (!selected.ok) throw new Error(`${manifestUrl}: HTTP ${selected.status}`);
      const bytes = await selected.arrayBuffer();
      const digest = [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (bytes.byteLength !== catalogueManifest.byte_count
        || digest !== String(catalogueManifest.sha256).replace(/^sha256:/, '')) {
        throw new Error('selected manifest catalogue receipt mismatch');
      }
      // DT must consume exactly the verified bytes, not a second fetch that could change.
      verifiedFetch = url => String(url) === manifestUrl
        ? Promise.resolve({ok: true, status: 200, arrayBuffer: async () => bytes,
          json: async () => JSON.parse(new TextDecoder().decode(bytes))})
        : fetchResource(url);
    }
    const verify = loadCandidate || (await import(new URL('docs/viewer-common/canonical-site-playback.mjs', DT_BASE).href)).loadCanonicalAdapter;
    const adapter = await verify({manifestUrl, staticManifestBytes,
      fetchResource: verifiedFetch, importModule: async url => {
        const module = await import(url);
        return {createAdapter(input) {
          ({manifest, artifacts} = input);
          return module.createAdapter(input);
        }};
      }});
    if (root === CANONICAL_BASE && catalogueManifest
      && ((manifest.scenario?.id ?? 'overview') !== SCENARIO.id
        || (manifest.scenario?.use_case_id ?? (manifest.scenario?.id ?? 'overview')) !== SCENARIO.useCaseId
        || (manifest.scenario?.role ?? SCENARIO.role) !== SCENARIO.role)) {
      throw new Error('selected candidate identity does not match the catalogue use case and variant');
    }
    return {adapter, manifest, artifacts};
  } catch (error) {
    throw new Error(`候選資料驗證失敗，影格與情境文字必須來自同一份有收據且綁定靜態套件的候選資料；`
      + `依據 2026-09-29 use-case review R1，回應 Will「Mock data is fine, so long as we have data lineage and the scenario explanable」：${error.message}`, {cause: error});
  }
}

// The canonical frame shown at shell time t (ms): the last frame whose
// authored time is not after t, the rule DT's canonical embed clock seeks by.
export function frameIndexAt(frameTimesSeconds, t) {
  let index = 0;
  while (index + 1 < frameTimesSeconds.length && frameTimesSeconds[index + 1] * 1000 <= t) index++;
  return index;
}

// A phone-only display label; the verified source strings and IDs remain intact.
export function phoneCopy(text) {
  const value = String(text);
  return globalThis.matchMedia?.('(max-width: 767px)').matches
    ? value.replaceAll('模擬鄰近農場（mock，非真實農場）', '鄰近農場（模擬）') : value;
}

export function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = phoneCopy(text);
  if (cls) n.className = cls;
  return n;
}

export function noticeBar(notices = NOTICES) {
  const bar = el('div', null, 'farm-notices');
  bar.setAttribute('role', 'note');
  for (const text of notices) bar.append(el('span', text, 'farm-notice'));
  return bar;
}
