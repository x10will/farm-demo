// 選取項目: replaces panel-core's built-in selection card for this app. It
// shows the selected field, tree or baked patrol stop and its canonical details.
import {CANONICAL_BASE, canonicalAdapter, canonicalBaseFor, el, noticeBar, SCENARIO} from './farm-data.js';
import {selectedPatrolDay} from './patrol-panel.js';

export const CROP_ROW_LABELS = ['模擬作物', '學名', '類別', '作物出處'];
export const PATROL_STOP_PREFIX = 'patrol-stop:';

// The adapter's crop rows for one stable id, in its order; [] when none.
export function cropRowsFor({adapter}, id) {
  const rows = adapter.selectFrame(0).inspection[id] || [];
  return CROP_ROW_LABELS.map(label => rows.find(row => row.label === label)).filter(Boolean);
}

function cropList(rows) {
  const list = el('dl', null, 'farm-provenance');
  for (const row of rows) {
    const value = Array.isArray(row.value) ? row.value : [row.value];
    const dd = el('dd');
    for (const item of value) dd.append(el('div', row.label === '模擬作物' ? `${item}（模擬）` : item));
    list.append(el('dt', row.label), dd);
  }
  return list;
}

function renderStop(view, entity) {
  const {candidate, state} = view;
  const frames = candidate.artifacts['composed-frames.json']?.canonical_frames;
  const selected = selectedPatrolDay(frames?.[state?.index], state);
  const planned = selected?.day.planned_patrol;
  const stop = planned?.route.stops.find(row => row.stop_id === entity.id);
  if (!stop) {
    view.phoneSummary = entity.label || '巡田點（模擬）';
    view.body.append(el('h3', entity.label || entity.id), el('p', entity.id, 'farm-caption'),
      el('p', '所選日期的已驗證路線未提供此巡田點；請從本日建議路線重新選取。', 'farm-caption'));
    return;
  }
  const records = candidate.artifacts['static-snapshot.json'].static_merge.merged_topology_artifact.records;
  const field = records.find(row => row['@id'] === stop.face_id);
  const narration = candidate.artifacts['scenario-narration.json'];
  const basis = candidate.artifacts['patrol-plan-basis.json'];
  const reason = planned.reasons.find(row => row.reason_id === stop.reason_id);
  const status = selected.status.faces.find(row => row.face_id === stop.face_id);
  const statusLabel = candidate.artifacts['patrol-status-declaration.json'].statuses
    .find(row => row.status_id === status?.status_id)?.label;
  const fieldLabel = field?.display_label || stop.face_id;
  view.phoneSummary = `巡田點 ${stop.order} · ${fieldLabel}`;
  view.body.append(el('h3', `巡田點 ${stop.order}：${fieldLabel}`),
    el('p', `${selected.day.date} · ${entity.id}`, 'farm-caption'),
    el('p', '本日建議路線（步道點，模擬）', 'farm-badge'),
    el('p', selected.branch.assumption === 'day-off'
      ? '這天休巡：建議路線未執行。' : '建議路線，尚未執行。', 'farm-stop-tick'));
  const rows = cropRowsFor(candidate, stop.face_id);
  if (rows.length) view.body.append(cropList(rows));
  else view.body.append(el('p', '此田區沒有模擬作物資料', 'farm-caption'));
  if (narration.reasons?.[stop.reason_id]?.text) {
    view.body.append(el('p', `為什麼：${narration.reasons[stop.reason_id].text}`, 'farm-caption farm-daily-reason'));
  }
  for (const id of reason?.input_ids || []) {
    const input = basis.inputs.find(row => row.input_id === id);
    if (input?.kind === 'last-patrol-date') view.body.append(el('p',
      `建議依據（截至 ${input.as_of}）：上次巡田 ${input.value}`, 'farm-caption'));
  }
  if (status) view.body.append(el('p', '假設依所選排程執行到當日結束（模擬）', 'farm-caption'),
    el('p', `最近巡田：${status.last_patrol_on} · 已過 ${status.days_since} 天 · ${statusLabel || status.status_id}`, 'farm-patrol-field-status'));
  const sources = el('details', null, 'farm-daily-source');
  sources.append(el('summary', '巡田點出處'));
  for (const path of ['manifest.json', 'static-snapshot.json', 'composed-frames.json',
    'scenario-narration.json', 'patrol-plan-basis.json', 'patrol-status-declaration.json',
    ...(narration.scenario?.decision_refs || []).map(row => row.path)]) {
    const link = el('a', path, 'farm-line');
    link.href = new URL(path, view.base).href; link.target = '_blank'; link.rel = 'noopener';
    sources.append(link);
  }
  sources.append(el('p', `路線 ${planned.route.route_id} · 理由 ${stop.reason_id}`, 'farm-caption'));
  if (status?.source) sources.append(el('p',
    `巡田來源：${status.source.kind} · ${status.source.visit_id || status.source.seed_id}`, 'farm-caption'));
  if (selected.outcome) sources.append(el('p',
    `分支 ${selected.branch.branch_id} · 結果 ${selected.outcome.outcome_id}`, 'farm-caption'));
  view.body.append(sources);
}

export function createSelectionPanel({load = () => canonicalAdapter(), controller = null, base = CANONICAL_BASE,
  phone = () => globalThis.matchMedia?.('(max-width: 767px)').matches ?? false} = {}) {
  const panel = {
    id: 'selection', title: '選取項目', icon: '◎', defaultSize: {w: 4, h: 5},

    render(container, ctx) {
      const root = el('div', null, 'farm-panel');
      const body = el('div', null, 'farm-selection-body');
      root.append(noticeBar(), body);
      container.append(root);
      const view = {root, body, ctx, base, candidate: null, cropCandidate: null,
        error: null, disposed: false, state: null};
      view.stop = controller?.subscribe(state => { view.state = state; panel.update(view); });
      view.ready = load().then(async candidate => {
        if (view.disposed) return;
        view.candidate = candidate;
        // Patrol and pest inspection projections omit static crop rows. The
        // verified overview adapter composes those same rows for matching IDs.
        if (SCENARIO && SCENARIO.useCaseId !== 'overview') {
          try { view.cropCandidate = await canonicalAdapter(canonicalBaseFor({mount: 'farm-canonical'})); }
          catch (error) { view.cropError = error; }
        }
      }, error => { if (!view.disposed) view.error = error; })
        .then(() => panel.update(view));
      return view;
    },

    update(view) {
      if (view.disposed) return;
      const entity = view.ctx.getSelectedEntity?.();
      view.body.replaceChildren();
      view.phoneSummary = null;
      view.treeFaceId = null;
      if (!entity) { view.body.append(el('p', '尚未選取田區或植株', 'farm-caption')); return; }
      if (entity.id.startsWith(PATROL_STOP_PREFIX) && view.candidate) { renderStop(view, entity); return; }
      const records = view.candidate?.artifacts['static-snapshot.json'].static_merge.merged_topology_artifact.records || [];
      const record = records.find(row => row['@id'] === entity.id);
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
      return {schemaVersion: 1, kind: 'farm-selection', visibleFields: ['selection', 'crop', 'patrol-stop'],
        summary: '目前選取的模擬田區、植株或巡田點與其作物、理由、所選排程的巡田狀態及出處；無即時資料，非操作建議。'};
    },
    dispose(view) { view.disposed = true; view.stop?.(); view.root.remove(); },
  };
  return panel;
}

export const selectionPanel = createSelectionPanel();
