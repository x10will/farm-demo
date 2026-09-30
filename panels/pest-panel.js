import {CANONICAL_BASE, SCENARIO_ERROR, el, frameIndexAt, noticeBar} from './farm-data.js';
import {current} from './scenario.js';
import {launcher, loadPanelCandidate, refusal} from './panel-candidate.js';

const clockText = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function createPestController({frameTimesSeconds, page = globalThis.location,
  replaceState = url => globalThis.history?.replaceState(null, '', url)} = {}) {
  const requested = new URLSearchParams(page?.search || '').get('pestFrame');
  const valid = requested === null || (/^(0|[1-9]\d*)$/.test(requested) && Number(requested) < frameTimesSeconds.length);
  let index = valid ? Number(requested || 0) : 0;
  let error = valid ? null : `無法使用病蟲害影格「${requested}」；此模擬只有 ${frameTimesSeconds.length} 格。`;
  let resetVersion = 0, clock = null, unclock = null, suppressClock = false;
  const listeners = new Set();
  const state = () => ({index, error, resetVersion});
  const emit = () => { for (const listener of listeners) listener(state()); };
  const save = () => {
    if (!page?.href || error) return;
    const url = new URL(page.href);
    url.searchParams.set('pestFrame', String(index));
    replaceState(url.href);
  };
  return {
    getSelection: state,
    subscribe(listener) { listeners.add(listener); listener(state()); return () => listeners.delete(listener); },
    attachClock(nextClock) {
      unclock?.(); clock = nextClock; clock.pause();
      suppressClock = true;
      unclock = clock.subscribe(time => {
        if (suppressClock || error) return;
        const next = frameIndexAt(frameTimesSeconds, time);
        if (next !== index) { index = next; save(); emit(); }
      });
      clock.seek(frameTimesSeconds[index] * 1000);
      suppressClock = false; emit();
    },
    reset() {
      error = null; index = 0; resetVersion++;
      clock?.pause(); clock?.seek(frameTimesSeconds[0] * 1000);
      save(); emit();
    },
    dispose() { unclock?.(); listeners.clear(); },
  };
}

export function pestAlertsFor(narration, frame) {
  return (frame.event_occurrences || []).map(event => ({id: event.occurrence_id,
    text: narration.events?.[event.occurrence_id]}))
    .filter(({text}) => text?.kind === 'pest-spread-alert')
    .map(({id, text}) => ({id, title: text.title, what: text.what,
      where: (text.where || []).map(row => row.label),
      howMuch: (text.how_much || []).map(row => row.label ? `${row.label}：${row.text}` : row.text),
      since: text.since?.text || null,
      atRisk: (text.at_risk || []).map(row => ({id: row.id, label: row.label, reason: row.reason})),
      sourceFrame: Number.isInteger(text.source?.frame_index) ? text.source.frame_index : null,
      decisionRefs: text.source?.decision_refs || [], notice: text.notice || null}));
}

function fact(list, term, values) {
  const dd = el('dd');
  for (const value of [values].flat()) if (value != null) dd.append(el('span', value, 'farm-line'));
  list.append(el('dt', term), dd);
}

export function renderPest(alerts) {
  const box = el('div', null, 'farm-scenario-card');
  if (!alerts.length) box.append(el('p', globalThis.matchMedia?.('(max-width: 767px)').matches
    ? '目前沒有病蟲害警示' : '本影格沒有病蟲害警示', 'farm-caption'));
  for (const alert of alerts) {
    const card = el('section', null, 'farm-alert');
    card.dataset.occurrenceId = alert.id;
    card.setAttribute('role', 'status');
    const facts = el('dl', null, 'farm-facts');
    fact(facts, '什麼', alert.what); fact(facts, '哪裡', alert.where);
    fact(facts, '多少', alert.howMuch); fact(facts, '從何時', alert.since);
    const source = el('dd');
    source.append(el('span', alert.sourceFrame === null ? '影格 —' : `模擬影格 第 ${alert.sourceFrame + 1} 格`, 'farm-line'));
    for (const ref of alert.decisionRefs) {
      const text = typeof ref === 'string' ? ref : ref?.ref || '';
      const name = text.split('@')[0].split('/').at(-1);
      if (typeof ref === 'object' && ref?.path) {
        const link = el('a', name, 'farm-line');
        link.href = CANONICAL_BASE + ref.path;
        link.title = text; link.target = '_blank'; link.rel = 'noopener'; source.append(link);
      } else { const span = el('span', name, 'farm-line'); span.title = text; source.append(span); }
    }
    facts.append(el('dt', '出處'), source);
    const risk = el('ul', null, 'farm-list');
    if (!alert.atRisk.length) risk.append(el('li', '本格沒有列出其他風險田區', 'farm-caption'));
    for (const row of alert.atRisk) {
      const li = el('li', null, 'farm-risk'); li.dataset.faceId = row.id;
      li.append(el('strong', row.label), el('span', row.reason, 'farm-caption')); risk.append(li);
    }
    card.append(el('h4', alert.title), facts, el('h4', '可能受影響的田區'), risk);
    if (alert.notice) card.append(el('p', alert.notice, 'farm-alert-notice'));
    box.append(card);
  }
  return box;
}

export function createPestPanel({active = current.scenario?.useCaseId === 'pest',
  controller = null, error = SCENARIO_ERROR, load = () => loadPanelCandidate()} = {}) {
  return {id: 'farm-pest', title: '病蟲害擴散', icon: '◔', defaultSize: {w: 4, h: 6},
    render(container) {
      if (!active) {
        const root = launcher('pest', error ? '無可播放模擬' : current.scenario?.title || '總覽', error);
        container.append(root);
        return {root, ready: Promise.resolve()};
      }
      const root = el('div', null, 'farm-panel');
      const badge = el('span', '地圖顯示中', 'farm-active-badge');
      const when = el('output', '', 'farm-status');
      const body = el('div');
      root.append(noticeBar(), badge, when, el('p', '病蟲害模擬時間與巡田日期互不相連。', 'farm-caption farm-pest-clock-note'), body);
      container.append(root);
      if (error || !controller) {
        refusal(body, error || '病蟲害時間軸沒有已驗證的模擬影格。');
        return {root, ready: Promise.resolve()};
      }
      let loaded = null, state = controller.getSelection(), disposed = false;
      const show = () => {
        if (disposed || !loaded) return;
        if (state.error) {
          refusal(body, state.error);
          const reset = el('button', '重設', 'farm-button');
          reset.type = 'button'; reset.dataset.farmReset = ''; reset.onclick = () => controller.reset();
          body.append(reset);
          return;
        }
        const frame = loaded.frames[state.index];
        when.textContent = `模擬時間 ${clockText(frame.elapsed_seconds)} · 第 ${state.index + 1} 格`;
        const beat = loaded.narration.beats?.[state.index];
        const heading = el('h3', beat?.frame_index === state.index ? beat.text
          : globalThis.matchMedia?.('(max-width: 767px)').matches ? '目前沒有段落標題' : '本影格未提供段落標題', 'farm-beat');
        const reset = el('button', '重設', 'farm-button');
        reset.type = 'button'; reset.dataset.farmReset = ''; reset.onclick = () => controller.reset();
        body.replaceChildren(heading, renderPest(pestAlertsFor(loaded.narration, frame)), reset);
      };
      const stop = controller.subscribe(next => { state = next; show(); });
      body.append(el('p', '載入病蟲害模擬…', 'farm-caption'));
      const ready = load().then(value => {
        if (disposed) return;
        loaded = value;
        const {summary, decision_refs: refs = []} = value.narration.scenario || {};
        if (summary) root.insertBefore(el('p', summary, 'farm-caption'), when);
        if (refs.length) {
          const sources = el('p', '情境決策：', 'farm-caption farm-scenario-sources');
          for (const ref of refs) {
            const text = typeof ref === 'string' ? ref : ref?.ref || '';
            const name = text.split('@')[0].split('/').at(-1);
            if (typeof ref === 'object' && ref?.path) {
              const link = el('a', name, 'farm-line');
              link.href = CANONICAL_BASE + ref.path; link.title = text; link.target = '_blank'; link.rel = 'noopener';
              sources.append(link);
            } else { const span = el('span', name, 'farm-line'); span.title = text; sources.append(span); }
          }
          root.insertBefore(sources, when);
        }
        show();
      }).catch(reason => { if (!disposed) refusal(body, `無法載入病蟲害資料：${reason.message}`); });
      return {root, ready, stop: () => { disposed = true; stop(); }};
    },
    update() {},
    describeForAI() { return {schemaVersion: 1, kind: 'farm-pest', visibleFields: ['frame', 'pest-alert', 'sources'],
      summary: '病蟲害擴散與警示皆為模擬，非診斷或防治建議。'}; },
    dispose(view) { view.stop?.(); view.root.remove(); },
  };
}

export const pestPanel = createPestPanel();
