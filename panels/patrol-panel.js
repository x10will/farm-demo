import {CANONICAL_BASE, SCENARIO_ERROR, claimHighlight, el, noticeBar} from './farm-data.js';
import {current} from './scenario.js';
import {launcher, loadPanelCandidate, refusal} from './panel-candidate.js';

export const PATROL_PINS_MODULE = new URL('../map-ext/patrol-pins.js', import.meta.url).href;
export const PINS_COMMAND = 'farm-patrol-stops';
export const STATUS_COMMAND = 'farm-patrol-status';
export const PINS_READY = 'farm-patrol-pins-ready';

const emptyPins = {stops: []};
const emptyStatus = {faces: []};

// These are lookups of canonical rows. The panel never ages a visit, selects a
// different route or infers a field status from the static snapshot.
export function selectedPatrolDay(frame, state) {
  const day = frame?.patrol_day;
  if (!day || state?.error || day.date !== state?.date) return null;
  if (day.phase === 'history') return {day, status: day.field_status, branch: null, outcome: null};
  const outcome = day.schedule_outcomes?.find(row => row.outcome_id === state.dayRef?.outcome_id);
  const branch = day.conditional_branches?.find(row => row.branch_id === state.dayRef?.branch_id);
  return outcome && branch ? {day, status: outcome.field_status, branch, outcome} : null;
}

export function statusPayload(selected, declaration) {
  if (!selected || !declaration) return emptyStatus;
  const colours = new Map(declaration.statuses.map(row => [row.status_id, row.color]));
  const outlines = new Map(declaration.outlines.map(row => [row.face_id, row.outline]));
  return {faces: selected.status.faces.flatMap(row => {
    const fill = colours.get(row.status_id), outline = outlines.get(row.face_id);
    return fill && outline ? [{id: row.face_id, outline, fill, opacity: declaration.fill_opacity}] : [];
  })};
}

export function calendarPinsPayload(selected, labels) {
  if (!selected || selected.day.phase !== 'plan') return emptyPins;
  const route = selected.day.planned_patrol.route;
  const skipped = selected.branch.assumption === 'day-off';
  const suffix = skipped ? '，休巡・未執行' : '';
  return {stops: route.stops.map(stop => ({id: stop.stop_id, order: stop.order,
    lat: stop.point.lat, lon: stop.point.lon, visited: false,
    title: `巡田點 ${stop.order}：${labels.get(stop.face_id) || stop.face_id}（步道點，模擬建議${suffix}）`})),
    start: {id: route.start.node_id, lat: route.start.point.lat, lon: route.start.point.lon,
      title: `巡田起點（模擬${suffix}）`},
    path: route.path.map(point => ({lat: point.lat, lon: point.lon})),
    style: skipped ? 'skipped' : 'suggested'};
}

const sourceText = source => source ? `${source.kind} · ${source.visit_id || source.seed_id}` : '範圍外';
const statusText = row => `${row.last_patrol_on || '—'} · ${row.days_since ?? '—'} 天`;

export function renderPatrolDay({selected, state, schedule, artifacts, labels, controller, base = CANONICAL_BASE}, ctx) {
  const box = el('div', null, 'farm-scenario-card farm-calendar');
  const fixedDate = el('p', null, 'farm-fixed-date');
  fixedDate.append(el('span', '模擬今日 2026-09-29（固定示範日期，不讀取裝置時間）', 'farm-copy-desktop'),
    el('span', '今天（模擬）9/29', 'farm-copy-phone'));
  box.append(fixedDate);
  const grid = el('div', null, 'farm-calendar-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', '巡田日期');
  for (const weekday of ['一', '二', '三', '四', '五', '六', '日']) grid.append(el('span', weekday, 'farm-calendar-weekday'));
  for (const date of schedule.calendar_cells) {
    if (date === null) { grid.append(el('span', '', 'farm-calendar-empty')); continue; }
    const [year, month, day] = date.split('-').map(Number);
    const off = state.offDates.includes(date);
    const phase = date === schedule.reference_date ? '今日' : schedule.editable_dates.includes(date) ? '建議' : '歷史';
    const button = el('button', `${month}/${day}${off ? ' · 休' : ''}`, 'farm-calendar-day');
    button.type = 'button';
    button.dataset.date = date;
    button.setAttribute('aria-label', `${year}年${month}月${day}日 · ${phase}${off ? ' · 休巡' : ''}`);
    button.setAttribute('aria-pressed', String(state.date === date));
    if (state.date === date) button.className += ' is-selected';
    if (date === schedule.reference_date) button.className += ' is-today';
    if (off) button.className += ' is-off';
    button.onclick = () => controller.selectDate(date);
    grid.append(button);
  }
  box.append(grid);
  if (state.error || !selected) {
    refusal(box, state.error || '巡田日期沒有已驗證的模擬結果。');
    const reset = el('button', '重設巡田', 'farm-button');
    reset.type = 'button'; reset.dataset.farmReset = ''; reset.onclick = () => controller.reset();
    box.append(reset);
    return box;
  }
  const {day, status, branch, outcome} = selected;
  const declaration = artifacts['patrol-status-declaration.json'];
  const label = id => labels.get(id) || id;
  box.append(el('p', `${day.date} · ${day.phase === 'history' ? '巡田歷史紀錄' : '本日建議（模擬）'}`, 'farm-daily-kind'));
  if (day.phase === 'plan') {
    const toggle = el('label', null, 'farm-toggle farm-calendar-toggle');
    const check = el('input');
    check.type = 'checkbox'; check.checked = state.offDates.includes(day.date);
    check.onchange = () => controller.setDayOff(day.date, check.checked);
    toggle.append(check, el('span', '這天休巡'));
    box.append(toggle);
  }
  const legend = el('div', null, 'farm-patrol-legend');
  for (const item of declaration.statuses) {
    const row = el('span', item.label, 'farm-patrol-legend-item');
    const swatch = el('span', '', 'farm-patrol-swatch');
    swatch.style.backgroundColor = item.color;
    row.prepend(swatch);
    legend.append(row);
  }
  legend.append(el('span', declaration.out_of_scope.label, 'farm-caption'));
  box.append(legend, el('p', day.phase === 'history'
    ? '顏色＝依巡田紀錄，到當日結束的巡田新舊'
    : '顏色＝假設依所選排程執行到當日結束', 'farm-caption farm-patrol-colour-caption'));
  const statuses = new Map(declaration.statuses.map(row => [row.status_id, row.label]));
  statuses.set(declaration.out_of_scope.status_id, declaration.out_of_scope.label);
  const differences = new Map((outcome?.comparison?.differences || []).map(row => [row.face_id, row]));
  const fields = el('ul', null, 'farm-list farm-patrol-fields');
  for (const row of status.faces) {
    const li = el('li', null, 'farm-daily-field farm-patrol-field');
    li.dataset.faceId = row.face_id;
    const detail = el('span', `${statusText(row)} · ${statuses.get(row.status_id) || row.status_id}`, 'farm-patrol-field-status');
    li.append(el('strong', label(row.face_id)), detail);
    const difference = differences.get(row.face_id);
    if (difference) li.append(el('span', `（每日巡田基準：${statusText(difference.baseline)} · ${statuses.get(difference.baseline.status_id)}）`, 'farm-caption'));
    const focus = el('button', '查看田區', 'farm-button');
    focus.type = 'button';
    focus.onclick = () => { ctx.focusEntity(row.face_id); claimHighlight('map-selection'); };
    li.append(focus); fields.append(li);
  }
  box.append(el('h4', '田區巡田狀態（模擬）'), fields);
  if (day.phase === 'history') {
    box.append(el('p', day.recorded_patrol.patrolled ? '此日已巡田區（模擬紀錄）' : '此日未巡田', 'farm-caption'));
    if (day.recorded_patrol.recorded_face_ids.length) {
      const visits = el('ul', null, 'farm-list');
      for (const id of day.recorded_patrol.recorded_face_ids) visits.append(el('li', label(id)));
      box.append(visits);
    }
  } else {
    const planned = day.planned_patrol;
    box.append(el('h4', '本日建議路線（模擬）'));
    const route = el('ol', null, `farm-list farm-daily-route${branch.assumption === 'day-off' ? ' is-skipped' : ''}`);
    route.append(el('li', '起點（步道）', 'farm-daily-start'));
    const basis = artifacts['patrol-plan-basis.json'];
    const shownReasons = new Set();
    for (const stop of planned.route.stops) {
      const li = el('li', null, 'farm-daily-field farm-daily-stop');
      li.dataset.faceId = stop.face_id; li.dataset.stopId = stop.stop_id;
      li.append(el('span', String(stop.order), 'farm-daily-stop-number'), el('strong', `${label(stop.face_id)}（步道點）`));
      const focus = el('button', '查看田區', 'farm-button');
      focus.type = 'button';
      focus.onclick = () => { ctx.focusEntity(stop.face_id); claimHighlight('map-selection'); };
      const select = el('button', '選取巡田點', 'farm-button');
      select.type = 'button';
      select.onclick = () => { ctx.focusEntity(stop.stop_id); claimHighlight('map-selection'); };
      li.append(focus, select);
      if (!shownReasons.has(stop.face_id)) {
        const reason = planned.reasons.find(row => row.face_id === stop.face_id);
        const rule = basis.rules.find(row => row.rule_id === reason?.rule_id);
        if (reason) li.append(el('p', `${label(stop.face_id)}：${artifacts['scenario-narration.json'].reasons?.[reason.reason_id]?.text || rule?.text || reason.reason_id}`, 'farm-caption farm-daily-reason'));
        shownReasons.add(stop.face_id);
      }
      route.append(li);
    }
    box.append(route, el('p', branch.assumption === 'day-off' ? '這天休巡：建議路線未執行。' : '建議路線，尚未執行。', 'farm-caption'));
  }
  const reset = el('button', '重設巡田', 'farm-button');
  reset.type = 'button'; reset.dataset.farmReset = ''; reset.onclick = () => controller.reset();
  box.append(reset);
  const sources = el('details', null, 'farm-daily-source');
  sources.append(el('summary', '資料與裁示來源'));
  sources.append(el('p', day.phase === 'history'
    ? '顏色＝依巡田紀錄，到當日結束的巡田新舊'
    : '顏色＝假設依所選排程執行到當日結束', 'farm-caption farm-phone-provenance'));
  for (const [title, path] of [['巡田裁示', 'patrol-decision.md'], ['巡田狀態聲明', 'patrol-status-declaration.json'],
    ['巡田歷史來源', 'patrol-history-source.json'], ['排程與規則來源', 'patrol-profile-source.json'],
    ['逐日影格', 'daily-frames.json'], ['排程結果索引', 'patrol-days-off-outcomes.json'],
    ['建議依據', 'patrol-plan-basis.json'], ['日曆方向', 'patrol-calendar-direction.md']]) {
    const link = el('a', title, 'farm-line');
    link.href = base + path; link.target = '_blank'; link.rel = 'noopener';
    sources.append(link);
  }
  for (const row of status.faces) sources.append(el('p', `${label(row.face_id)}：${sourceText(row.source)}`, 'farm-caption'));
  if (outcome) sources.append(el('p', `排程 ${state.scheduleKey || '每日巡田基準'} · 結果 ${outcome.outcome_id} · 比較 ${outcome.comparison.finding_id}`, 'farm-caption'));
  box.append(sources);
  return box;
}

export function createPatrolPanel({active = current.scenario?.useCaseId === 'patrol',
  controller = null, error = SCENARIO_ERROR, load = () => loadPanelCandidate()} = {}) {
  return {id: 'farm-patrol', title: '巡田', icon: '⌖', defaultSize: {w: 4, h: 8},
    render(container, ctx) {
      if (!active) {
        const root = launcher('patrol', error ? '無可播放模擬' : current.scenario?.title || '總覽', error);
        container.append(root);
        return {root, ready: Promise.resolve()};
      }
      const root = el('div', null, 'farm-panel');
      const badge = el('span', '地圖顯示中', 'farm-active-badge');
      const body = el('div');
      root.append(noticeBar(), badge, body);
      container.append(root);
      if (error || !controller) {
        refusal(body, error || '巡田日曆沒有已驗證的日期與排程結果。');
        return {root, ready: Promise.resolve()};
      }
      let loaded = null, state = controller.getSelection(), disposed = false;
      const send = () => {
        if (disposed || !loaded) return;
        const selected = selectedPatrolDay(loaded.frames[state.index], state);
        ctx.map.send('appCommand', {name: STATUS_COMMAND,
          payload: statusPayload(selected, loaded.artifacts['patrol-status-declaration.json'])});
        ctx.map.send('appCommand', {name: PINS_COMMAND,
          payload: calendarPinsPayload(selected, loaded.labels)});
      };
      const show = () => {
        if (disposed || !loaded) return;
        const selected = selectedPatrolDay(loaded.frames[state.index], state);
        body.replaceChildren(renderPatrolDay({...loaded, selected, state, schedule: controller.schedule, controller}, ctx));
        send();
      };
      const stop = controller.subscribe(next => { state = next; show(); });
      ctx.map.subscribe('ready', send);
      ctx.map.subscribe('appEvent', ({name} = {}) => { if (name === PINS_READY) send(); });
      body.append(el('p', '載入巡田模擬…', 'farm-caption'));
      const ready = load().then(value => { if (disposed) return; loaded = value; show(); })
        .catch(reason => { if (!disposed) refusal(body, `無法載入巡田資料：${reason.message}`); });
      return {root, ready, clearLayers: () => {
        disposed = true; stop();
        ctx.map.send('appCommand', {name: STATUS_COMMAND, payload: emptyStatus});
        ctx.map.send('appCommand', {name: PINS_COMMAND, payload: emptyPins});
      }};
    },
    update() {},
    describeForAI() { return {schemaVersion: 1, kind: 'farm-patrol', visibleFields: ['date', 'field-status', 'planned-route', 'sources'],
      summary: '巡田紀錄與假設排程皆為模擬，非農場操作建議。'}; },
    dispose(view) { view.clearLayers?.(); view.root.remove(); },
  };
}

export const patrolPanel = createPatrolPanel();
