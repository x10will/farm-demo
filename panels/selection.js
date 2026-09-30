// 選取項目: replaces panel-core's built-in selection card for this app. It
// shows what panel-core reports as selected (a map click, or 選取 in 田區導覽)
// with the crop rows the canonical adapter composes for that stable id. The
// crop rows come from the frozen snapshot and are the same in every frame;
// nothing is derived here.
import {canonicalAdapter, canonicalBaseFor, el, noticeBar, SCENARIO} from './farm-data.js';

export const CROP_ROW_LABELS = ['模擬作物', '學名', '類別', '作物出處'];

// The adapter's crop rows for one stable id, in its order; [] when none.
export function cropRowsFor({adapter}, id) {
  const rows = adapter.selectFrame(0).inspection[id] || [];
  return CROP_ROW_LABELS.map(label => rows.find(row => row.label === label)).filter(Boolean);
}

export function createSelectionPanel({load = () => canonicalAdapter(),
  phone = () => globalThis.matchMedia?.('(max-width: 767px)').matches ?? false} = {}) {
  const panel = {
    id: 'selection', title: '選取項目', icon: '◎', defaultSize: {w: 4, h: 5},

    render(container, ctx) {
      const root = el('div', null, 'farm-panel');
      const body = el('div', null, 'farm-selection-body');
      root.append(noticeBar(), body);
      container.append(root);
      const view = {root, body, ctx, candidate: null, cropCandidate: null, error: null};
      view.ready = load().then(async candidate => {
        view.candidate = candidate;
        // The patrol and pest inspection projections omit static crop rows. The
        // verified overview adapter already composes those rows for the same IDs.
        if (SCENARIO && SCENARIO.useCaseId !== 'overview') {
          try { view.cropCandidate = await canonicalAdapter(canonicalBaseFor({mount: 'farm-canonical'})); }
          catch (error) { view.cropError = error; }
        }
      }, error => { view.error = error; })
        .then(() => panel.update(view));
      return view;
    },

    update(view) {
      const entity = view.ctx.getSelectedEntity?.();
      view.body.replaceChildren();
      view.phoneSummary = null;
      view.treeFaceId = null;
      if (!entity) { view.body.append(el('p', '尚未選取田區或植株', 'farm-caption')); return; }
      const records = view.candidate?.artifacts['static-snapshot.json'].static_merge.merged_topology_artifact.records || [];
      const record = records.find(r => r['@id'] === entity.id);
      const humanLabel = label => label && !/^urn(?::|npust)/i.test(label) ? label : null;
      const name = record?.display_label || (phone()
        ? humanLabel(entity.label) || '模擬項目' : entity.label || entity.id);
      const treeNumber = record?.node_kind === 'planting-point' ? name.match(/第\s*(\d+)\s*株/)?.[1] : null;
      if (treeNumber && record.in_face) view.treeFaceId = record.in_face;
      const title = el('div', null, 'farm-selection-title');
      title.append(el('h3', name));
      const clear = el('button', '✕', 'farm-selection-clear');
      clear.type = 'button';
      clear.setAttribute('aria-label', '清除選取');
      clear.onclick = () => view.clearSelection?.();
      title.append(clear);
      view.body.append(title);
      if (!phone()) view.body.append(el('p', entity.id, 'farm-caption farm-selection-id'));
      view.phoneSummary = name.replace(/\s*（[^）]*明確模擬[^）]*）/g, '');
      if (view.error) { view.body.append(el('p', `無法載入作物資料：${view.error.message}`, 'farm-status')); return; }
      if (!view.candidate) { view.body.append(el('p', '載入作物資料…', 'farm-status')); return; }
      const rows = cropRowsFor(view.candidate, entity.id);
      if (!rows.length && view.cropCandidate) rows.push(...cropRowsFor(view.cropCandidate, entity.id));
      if (!rows.length && view.cropError) {
        view.body.append(el('p', `無法載入作物資料：${view.cropError.message}`, 'farm-status'));
        return;
      }
      if (!rows.length) { view.body.append(el('p', '此選取沒有模擬作物資料', 'farm-caption')); return; }
      const crop = rows.find(row => row.label === '模擬作物')?.value;
      if (crop) view.phoneSummary += ` · ${Array.isArray(crop) ? crop[0] : crop}（模擬）`;
      const list = el('dl', null, 'farm-provenance');
      if (treeNumber && phone()) {
        const number = el('dd');
        number.append(el('div', treeNumber));
        list.append(el('dt', '株號'), number);
      }
      let disclosure;
      for (const row of rows) {
        const value = Array.isArray(row.value) ? row.value : [row.value];
        const source = row.label === '作物出處';
        const dd = el('dd', null, source ? 'farm-selection-source-row' : null);
        for (const item of value) dd.append(el('div', row.label === '模擬作物' ? `${item}（模擬）` : item));
        list.append(el('dt', row.label, source ? 'farm-selection-source-row' : null), dd);
        if (source) {
          disclosure = el('details', null, 'farm-selection-sources');
          disclosure.append(el('summary', '出處'));
          for (const item of value) {
            const line = el('div', null, 'farm-selection-source');
            const text = String(item);
            const match = text.match(/https?:\/\/[^\s<>]+/);
            if (match) {
              const url = new URL(match[0]);
              const prefix = text.slice(0, match.index).replace(/[：:\s]+$/, '');
              const link = el('a', prefix ? `${prefix} · ${url.hostname}` : url.hostname);
              link.href = url.href;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              line.append(link);
            } else line.textContent = text;
            disclosure.append(line);
          }
        }
      }
      view.body.append(list);
      if (disclosure) view.body.append(disclosure);
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
