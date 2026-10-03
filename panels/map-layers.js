// The one owner of the embedded map's layer visibility, shared by the desktop 圖層 list in
// 田區導覽 and the phone layers button. The viewer announces its layers at ready (and again
// when a progressive site's details land) and echoes nothing per command, so the intended
// visible set is kept here and sent in full. This changes presentation only; it never reads
// or changes canonical frames or runtime state.
import {SCENARIO} from './farm-data.js';

// The viewer remembers every toggle in its own localStorage, per device, so two devices can
// open the same build with different layers showing. Will found nodes hidden on his phone
// and shown on desktop (2026-10-03). Each map load therefore starts from these defaults
// instead of whatever that device last stored: every layer the viewer offers is shown,
// except the ones below.
//
// nodes: off. Will, 2026-10-03: "Node off is good cu they overlap with mesh."
// terrainFaults, diagnosis: off, as the viewer ships them; they are DT developer views.
export const DEFAULT_HIDDEN = new Set(['nodes', 'terrainFaults', 'diagnosis']);
// Developer views stay reachable on desktop, labelled as such, and are not offered on phone.
export const DEVELOPER_LAYERS = new Set(['terrainFaults', 'diagnosis']);

// Visitor-facing names for the viewer's layer ids. An id missing here keeps the viewer's label.
export const LAYER_LABELS = {
  terrain: '地形',
  nodes: '節點',
  edges: '參觀動線',
  props: '作物與設施',
  contextProps: '周邊設施',
  'root-context-roads': '道路',
  'generic-edge': '其他路段',
  'root-context-river-ribbon': '河川',
  'root-context-trees': '樹木',
  'root-context-buildings': '建物',
  'root-supported-labels': '地名標籤',
  'root-context-field-ridges': '田埂',
  'root-context-waterways': '水路',
  'root-context-rice-paddies': '水田',
  'root-context-field-faces': '周邊農地',
  terrainFaults: '地形檢查（開發用）',
  diagnosis: '診斷圖（開發用）',
};

export function createMapLayers({useCase = SCENARIO?.useCaseId} = {}) {
  let map = null;
  let layers = [];
  let visible = new Set();
  const listeners = new Set();
  const notify = () => { for (const fn of listeners) fn(); };
  const send = () => !!map?.send('setLayers', {layers: [...visible]});

  // A new map load starts from the defaults. Late layers (a progressive site's details) join
  // with their defaults and leave the choices already made alone.
  function announce(list, {late = false} = {}) {
    if (!Array.isArray(list)) return;
    const known = new Set(layers.map(layer => layer.id));
    const ids = list.filter(layer => typeof layer?.id === 'string');
    // Patrol hides place labels through its map extension, so that toggle would do nothing.
    layers = ids.filter(layer => !(useCase === 'patrol' && layer.id === 'root-supported-labels'))
      .map(layer => ({id: layer.id, label: LAYER_LABELS[layer.id] || layer.label || layer.id,
        developer: DEVELOPER_LAYERS.has(layer.id)}));
    const next = new Set();
    for (const {id} of ids) {
      if (late && known.has(id) ? visible.has(id) : !DEFAULT_HIDDEN.has(id)) next.add(id);
    }
    visible = next;
    send();
    notify();
  }

  return {
    // Bind once to the app-wide map API, which outlives any one panel.
    attach(target) {
      if (map || !target) return;
      map = target;
      map.subscribe('ready', info => announce(info?.layers));
      map.subscribe('appEvent', ({name, payload} = {}) => {
        if (name === 'dt:details-loaded') announce(payload?.layers, {late: true});
      });
    },
    list: () => layers.map(layer => ({...layer, visible: visible.has(layer.id)})),
    isVisible: id => visible.has(id),
    // Returns false, and keeps the previous state, when the map cannot take the command.
    set(id, on) {
      if (!layers.some(layer => layer.id === id)) return false;
      const previous = visible;
      visible = new Set(visible);
      if (on) visible.add(id); else visible.delete(id);
      if (!send()) { visible = previous; notify(); return false; }
      notify();
      return true;
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

export const mapLayers = createMapLayers();
