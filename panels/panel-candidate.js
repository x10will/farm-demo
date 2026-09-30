import {CANONICAL_BASE, SCENARIO, canonicalAdapter, el} from './farm-data.js';
import {SCENARIO_AUTHORITY, scenarioHref} from './scenario.js';

// The candidate loader has already verified every artifact against its receipt.
// Both simulation panels use this only while active; an inactive card is a link.
export async function loadPanelCandidate(base = CANONICAL_BASE, scenario = SCENARIO, options) {
  const {adapter, manifest, artifacts} = await canonicalAdapter(base, options);
  const frames = artifacts['composed-frames.json']?.canonical_frames;
  const file = (manifest.files || []).find(row => row.path === 'scenario-narration.json');
  if (!file) throw new Error(`候選資料沒有列出 scenario-narration.json；情境文字必須隨候選資料的收據一起發布。${SCENARIO_AUTHORITY}`);
  const narration = artifacts['scenario-narration.json'];
  if (narration?.scenario?.id !== scenario?.id) {
    throw new Error(`scenario-narration.json 屬於情境「${narration?.scenario?.id}」而非「${scenario?.id}」；保護情境與來源一致性。${SCENARIO_AUTHORITY}`);
  }
  const records = artifacts['static-snapshot.json']?.static_merge?.merged_topology_artifact?.records || [];
  const labels = new Map(records.filter(row => row['@type'] === 'Face')
    .map(row => [row['@id'], row.display_label || row['@id']]));
  return {adapter, manifest, artifacts, frames, narration, labels, base};
}

export function launcher(target, activeTitle, error = null) {
  const root = el('div', null, 'farm-panel farm-simulation-launcher');
  if (error) refusal(root, error);
  root.append(el('p', `地圖目前顯示：${activeTitle}`, 'farm-caption'));
  const link = el('a', '在地圖上播放這個模擬', 'farm-launch-link');
  link.href = scenarioHref(target);
  // The active controller can replace URL state after this inactive panel renders.
  // Read it at activation so switching carries the visitor's latest date or frame.
  link.onclick = () => { link.href = scenarioHref(target); };
  root.append(link);
  return root;
}

export function refusal(body, message) {
  const node = el('p', message, 'farm-refusal');
  node.setAttribute('role', 'alert');
  body.replaceChildren(node);
}
