// Farm wrappers around panel-core's key-value, time-series and headline-list panels.
// They render supplied canonical samples; the adapter alone selects samples/events.
import {canonicalAdapter, el, frameIndexAt, noticeBar, SITE} from './farm-data.js';

export function projectionAt(candidate, milliseconds) {
  const index = frameIndexAt(candidate.adapter.frameTimesSeconds, milliseconds);
  const projection = candidate.adapter.project(index, milliseconds / 1000);
  return {...projection, entityLabels: projection.entityLabels || candidate.adapter.entityLabels};
}

export const sampleTime = value => value ? String(value).replace('T', ' ') : '時間未提供';
export const sampleLabel = sample => `${sampleTime(sample.sampled_at ?? sample.sampledAt)} · ${sample.simulation_label ?? sample.simulationLabel ?? ''}`;
export function readingValue(sample, site = SITE) {
  if ('state' in sample) return site.state_labels?.[sample.state] || sample.state;
  return `${sample.value} ${sample.unit || ''}`.trim();
}

export function readingsFor(projection, card, site = SITE) {
  return (projection.telemetry || []).filter(sample => card.metrics.includes(sample.metric)).map(sample => ({
    sample,
    label: `${projection.entityLabels?.[sample.entity_id] || sample.entity_id} · ${site.metric_labels?.[sample.metric] || sample.metric}`,
    text: `${readingValue(sample, site)} · ${sampleLabel(sample)}`,
  }));
}

export function createTelemetryPanel(kind, {load = () => canonicalAdapter(), site = SITE,
  loadBuiltins = async () => (await import('../vendor/panel-core/core.js')).builtins} = {}) {
  const card = site.cards?.[kind] || {title: kind, metrics: []};
  return {
    id: `farm-${kind}`, title: card.title, icon: kind === 'water' ? '◌' : kind === 'scada' ? '↻' : '☁', defaultSize: {w: 4, h: 8},
    render(container, ctx) {
      const root = el('div', null, `farm-panel farm-telemetry farm-${kind}`);
      const notices = noticeBar(), when = el('output', '載入 canonical 模擬樣本…', 'farm-status');
      const values = el('div'), trends = el('div', null, 'farm-trends'), advisories = el('div');
      const alerts = el('div', null, 'farm-telemetry-alerts');
      const empty = el('p', '此時沒有已提供的樣本', 'farm-caption'); empty.hidden = true;
      root.append(notices, when, values, empty, trends, advisories, alerts); container.append(root);
      const view = {root, ready: null};
      let candidate, builtins, valueView, headlineView, milliseconds = 0, disposed = false, shown = null;
      const seriesViews = new Map();
      const draw = () => {
        if (!candidate || !builtins || disposed) return;
        const projection = projectionAt(candidate, milliseconds);
        // Every 5-second sample may change inside a single frame. Never gate on frame index.
        const signature = JSON.stringify([projection.telemetry, projection.notifications, projection.alerts]);
        if (signature === shown) return;
        shown = signature;
        const rows = readingsFor(projection, card, site);
        notices.replaceChildren(...(projection.notices || []).map(text => el('span', text, 'farm-notice')));
        when.textContent = `示範 ${Math.floor(milliseconds / 1000)} s · ${projection.beatLabel || ''}`;
        root.dataset.elapsedSeconds = String(milliseconds / 1000);
        builtins['key-value'].update(valueView, {records: [{payload: Object.fromEntries(rows.map(row => [row.label, row.text]))}]});
        empty.hidden = rows.length > 0;
        if (card.trend_metric) {
          const selected = rows.filter(row => row.sample.metric === card.trend_metric);
          for (const {sample, label} of selected) {
            if (!seriesViews.has(sample.entity_id)) {
              const section = el('section', null, 'farm-trend');
              section.dataset.entityId = sample.entity_id;
              section.append(el('h3', `${label} 趨勢`)); trends.append(section);
              seriesViews.set(sample.entity_id, {section, view: builtins['time-series'].render(section, ctx)});
            }
            const series = seriesViews.get(sample.entity_id);
            const history = (projection.telemetryHistory || []).filter(row => row.entity_id === sample.entity_id && row.metric === card.trend_metric);
            builtins['time-series'].update(series.view, {records: history.map(row => ({timestamp: row.sampled_at,
              payload: {value: row.value, unit: `${row.unit || ''} · ${row.simulation_label}`}}))});
            series.view.value.textContent = `${readingValue(sample, site)} · ${sampleLabel(sample)}`;
            // panel-core formats timestamps in the machine zone. Preserve the authored
            // offset/date here so the simulated night is readable on any workstation.
            [...series.view.body.children].forEach((tr, i) => {
              tr.children[0].textContent = sampleTime(history.slice(-6).reverse()[i].sampled_at);
            });
          }
          for (const [id, series] of seriesViews) series.section.hidden = !selected.some(row => row.sample.entity_id === id);
        }
        const notifications = kind === 'weather' ? (projection.notifications || []).filter(row =>
          (card.advisory_kinds || ['simulated-announcement']).includes(row.kind)) : [];
        builtins['headline-list'].update(headlineView, {records: notifications.map(row => ({timestamp: row.sampledAt,
          payload: {headline: `${row.text} · ${sampleLabel(row)}`}}))});
        alerts.replaceChildren();
        if (kind === 'water') {
          for (const row of projection.alerts || []) {
            const item = el('article', null, 'farm-alert'); item.dataset.occurrenceId = row.id;
            item.append(el('strong', row.text), el('small', sampleLabel(row), 'farm-caption')); alerts.append(item);
          }
        }
      };
      ctx.map.subscribe('time', ({t} = {}) => { if (Number.isFinite(t)) { milliseconds = t; draw(); } });
      view.ready = Promise.all([load(), loadBuiltins()]).then(([loaded, types]) => {
        if (disposed) return;
        candidate = loaded; builtins = types;
        valueView = builtins['key-value'].render(values, ctx);
        headlineView = builtins['headline-list'].render(advisories, ctx);
        draw();
      }).catch(error => { if (!disposed) when.textContent = `無法載入模擬樣本：${error.message}`; });
      view.close = () => {
        disposed = true;
        if (builtins) {
          builtins['key-value'].dispose(valueView); builtins['headline-list'].dispose(headlineView);
          for (const series of seriesViews.values()) builtins['time-series'].dispose(series.view);
        }
      };
      return view;
    },
    update() {},
    describeForAI() { return {schemaVersion: 1, kind: `farm-${kind}`, visibleFields: ['sample time', 'simulation label', 'canonical telemetry', 'authored events'],
      summary: '只顯示已驗證候選資料中的模擬樣本與事件；時鐘不計算狀態或觸發警示。'}; },
    dispose(view) { view.close(); view.root.remove(); },
  };
}

export const telemetryPanels = Object.fromEntries(['scada', 'water', 'weather'].map(kind => [`farm-${kind}`, createTelemetryPanel(kind)]));
