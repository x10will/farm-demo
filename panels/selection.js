// 選取項目: replaces panel-core's built-in selection card for this app. It
// shows what panel-core reports as selected (a map click, or 選取 in 田區導覽)
// with the crop rows the canonical adapter composes for that stable id. The
// crop rows come from the frozen snapshot and are the same in every frame;
// nothing is derived here.
import {canonicalAdapter, el, noticeBar} from './farm-data.js';

export const CROP_ROW_LABELS = ['模擬作物', '學名', '類別', '作物出處'];

// The adapter's crop rows for one stable id, in its order; [] when none.
export function cropRowsFor({adapter}, id) {
  const rows = adapter.selectFrame(0).inspection[id] || [];
  return CROP_ROW_LABELS.map(label => rows.find(row => row.label === label)).filter(Boolean);
}

export function createSelectionPanel({load = () => canonicalAdapter()} = {}) {
  const panel = {
    id: 'selection', title: '選取項目', icon: '◎', defaultSize: {w: 4, h: 5},

    render(container, ctx) {
      const root = el('div', null, 'farm-panel');
      const body = el('div', null, 'farm-selection-body');
      root.append(noticeBar(), body);
      container.append(root);
      const view = {root, body, ctx, candidate: null, error: null};
      view.ready = load().then(candidate => { view.candidate = candidate; }, error => { view.error = error; })
        .then(() => panel.update(view));
      return view;
    },

    update(view) {
      const entity = view.ctx.getSelectedEntity?.();
      view.body.replaceChildren();
      if (!entity) { view.body.append(el('p', '尚未選取田區或植株', 'farm-caption')); return; }
      const records = view.candidate?.artifacts['static-snapshot.json'].static_merge.merged_topology_artifact.records || [];
      const record = records.find(r => r['@id'] === entity.id);
      view.body.append(el('h3', record?.display_label || entity.label || entity.id));
      const id = el('p', entity.id, 'farm-caption');
      view.body.append(id);
      if (view.error) { view.body.append(el('p', `無法載入作物資料：${view.error.message}`, 'farm-status')); return; }
      if (!view.candidate) { view.body.append(el('p', '載入作物資料…', 'farm-status')); return; }
      const rows = cropRowsFor(view.candidate, entity.id);
      if (!rows.length) { view.body.append(el('p', '此選取沒有模擬作物資料', 'farm-caption')); return; }
      const list = el('dl', null, 'farm-provenance');
      for (const row of rows) {
        const value = Array.isArray(row.value) ? row.value : [row.value];
        const dd = el('dd');
        for (const item of value) dd.append(el('div', row.label === '模擬作物' ? `${item}（模擬）` : item));
        list.append(el('dt', row.label), dd);
      }
      view.body.append(list);
    },

    describeForAI() {
      return {schemaVersion: 1, kind: 'farm-selection', visibleFields: ['selection', 'crop'],
        summary: '目前選取的模擬田區或植株與其模擬作物、學名、類別與出處；無即時資料，非操作建議。'};
    },
    dispose(view) { view.root.remove(); },
  };
  return panel;
}

export const selectionPanel = createSelectionPanel();
