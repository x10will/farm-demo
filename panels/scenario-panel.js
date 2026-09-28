// 情境: the scenario selector and the active scenario's card (總覽, 巡田 or 病蟲害擴散).
// State comes only from the current canonical frame of this page's scenario candidate (the frame
// the panel clock selects, as in 通知); text comes only from that candidate's
// scenario-narration.json. Nothing is computed, accumulated, repaired or invented here: the
// affected counts, the visited stops and the work log are baked into the candidate.
// Source: lane design 2026-09-28, on Will's instruction the same day: "hmm. the use cases are not
// clear. 巡田 is a feature, identify pest spread is another"; and "patrol stops means the system
// suggests? observation can be mocked, we don't know how they patrol yet. alert is cheap also."
import {CANONICAL_BASE, SCENARIO, SCENARIO_ERROR, el, frameIndexAt, loadJSON, noticeBar} from './farm-data.js';
import {SCENARIOS, SCENARIO_AUTHORITY, scenarioHref} from './scenario.js';

// The farm's numbered-stop module, loaded by the viewer through DT's same-origin ?ext= extension.
export const PATROL_PINS_MODULE = new URL('../map-ext/patrol-pins.js', import.meta.url).href;
// The app command and event shared with that module (map-ext/patrol-pins.js).
export const PINS_COMMAND = 'farm-patrol-stops';
export const PINS_READY = 'farm-patrol-pins-ready';
export const NARRATION = 'scenario-narration.json';

export const STOP_LABEL = 'AI 建議（模擬）';

const clock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const narrated = (narration, frame, kind) => (frame.event_occurrences || [])
  .map(event => ({id: event.occurrence_id, text: narration.events?.[event.occurrence_id]}))
  .filter(({text}) => text?.kind === kind);

// The pest alerts of one frame: each pest-spread-alert occurrence the frame lists, with its
// narration text. An alert shows only on the frames that list it.
export function pestAlertsFor(narration, frame) {
  return narrated(narration, frame, 'pest-spread-alert').map(({id, text}) => ({
    id, title: text.title, what: text.what,
    where: (text.where || []).map(w => w.label),
    // Several fields can be affected at once, so each count names its field.
    howMuch: (text.how_much || []).map(h => (h.label ? `${h.label}：${h.text}` : h.text)),
    since: text.since?.text || null,
    atRisk: (text.at_risk || []).map(r => ({id: r.id, label: r.label, reason: r.reason})),
    sourceFrame: Number.isInteger(text.source?.frame_index) ? text.source.frame_index : null,
    decisionRefs: text.source?.decision_refs || [],
    // The hotline notice under the alert (lane design 2026-09-28, acceptance item 2) is the
    // narration's own wording, so a later dated decision that rewords it reaches the card.
    notice: text.notice || null,
  }));
}

// The patrol of one frame: the frame's own stops in their baked order, ticked from the frame's
// visited_stop_ids; each stop's card text from the narration; an observation for each visited
// stop (the narration's patrol-stop-visited text for that stop); the work log only on a frame
// that lists a patrol-work-log occurrence.
export function patrolFor(narration, frame) {
  const route = frame.patrol_route || null;
  const visited = new Set(route?.visited_stop_ids || []);
  const observations = new Map(Object.values(narration.events || {})
    .filter(e => e?.kind === 'patrol-stop-visited' && e.stop_id).map(e => [e.stop_id, e]));
  const stops = (route?.stops || []).map(stop => {
    const text = narration.stops?.[stop.stop_id] || {};
    const seen = visited.has(stop.stop_id);
    // The pin sits at the narration's anchor only when the narration names the frame's anchor Node.
    const anchor = text.node_id === stop.anchor_node_id ? text.anchor || null : null;
    return {id: stop.stop_id, order: stop.order, target: text.target_label || stop.target_id, why: text.why || null,
      lookFor: text.look_for || null, label: text.label || STOP_LABEL, anchor, visited: seen,
      observation: seen ? observations.get(stop.stop_id)?.text || null : null};
  });
  const proposal = narrated(narration, frame, 'patrol-stops-proposal').map(({id, text}) => ({id, title: text.title, what: text.what}))[0] || null;
  const workLog = narrated(narration, frame, 'patrol-work-log').map(({id, text}) => ({id, title: text.title, text: text.text,
    lines: text.lines || []}))[0] || null;
  return {hasRoute: Boolean(route), proposal, stops, workLog};
}

// The frame's beat title, as the scenario candidate words it (the viewer shows the same text
// through the candidate's adapter). Baked per frame and checked against the frames at export;
// 2026-09-28-farm-scenario-beat-labels.md.
export function beatFor(narration, index) {
  const beat = narration?.beats?.[index];
  return beat && beat.frame_index === index && typeof beat.text === 'string' ? beat.text : null;
}

// What the map module draws: one numbered pin per stop at its narration anchor, ticked when visited.
export function pinsPayload(patrol) {
  return {stops: patrol.stops.filter(s => Number.isFinite(s.anchor?.lon) && Number.isFinite(s.anchor?.lat))
    .map(s => ({id: s.id, order: s.order, lon: s.anchor.lon, lat: s.anchor.lat, visited: s.visited,
      title: `巡田點 ${s.order}：${s.target}（${s.label}）`}))};
}

// Who asked for the narration's byte check: the lane gate review of #112, 2026-09-28, run on
// Will's instruction the same day (Major 1: a narration edited after the bake was shown as is).
const NARRATION_HASH_AUTHORITY = '（依據：lane gate review 2026-09-28，依 Will 同日的指示）';
const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');

// The narration's bytes, checked against the SHA-256 the candidate's manifest records for it, so
// the text shown is the one baked with these frames. Fetched here, not through loadJSON, because
// the check needs the bytes as served.
async function verifiedNarration(url, sha256) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (hex(await crypto.subtle.digest('SHA-256', bytes)) !== sha256) {
    throw new Error(`${NARRATION} 的位元組與候選資料 manifest.json 記下的 SHA-256 不符；這項檢查確保顯示的情境文字就是與本候選影格一起烘焙的那一份，因此不顯示任何情境文字${NARRATION_HASH_AUTHORITY}`);
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Loads this page's candidate: its frames and, for a scenario, its narration, which must be one
// of the candidate's manifest files (so it carries the candidate's receipt), have the bytes that
// file records, and name this scenario.
export async function loadScenario(base = CANONICAL_BASE, scenario = SCENARIO) {
  const [manifest, composed] = await Promise.all([loadJSON(base + 'manifest.json'), loadJSON(base + 'composed-frames.json')]);
  const frames = composed.canonical_frames;
  if (scenario.id === 'overview') return {frames, narration: null};
  const entry = (manifest.files || []).find(f => f.path === NARRATION);
  if (!entry) {
    throw new Error(`候選資料沒有列出 ${NARRATION}；情境文字必須隨候選資料的收據一起發布，因此不顯示任何情境文字${SCENARIO_AUTHORITY}`);
  }
  const narration = await verifiedNarration(base + NARRATION, entry.sha256);
  if (narration?.scenario?.id !== scenario.id) {
    throw new Error(`${NARRATION} 屬於情境「${narration?.scenario?.id}」而非「${scenario.id}」；為免混用兩個情境的資料，不顯示${SCENARIO_AUTHORITY}`);
  }
  return {frames, narration};
}

function selector(active) {
  const nav = el('nav', null, 'farm-scenarios');
  nav.setAttribute('aria-label', '情境');
  for (const scenario of SCENARIOS) {
    const link = el('a', scenario.title, 'farm-scenario-choice');
    link.dataset.scenario = scenario.id;
    link.href = scenarioHref(scenario);
    if (scenario.id === active?.id) { link.setAttribute('aria-current', 'page'); link.className += ' is-current'; }
    nav.append(link);
  }
  return nav;
}

function field(list, term, values) {
  const dd = el('dd');
  for (const value of [values].flat()) if (value != null) dd.append(el('span', value, 'farm-line'));
  list.append(el('dt', term), dd);
}

function decisionRef(ref) {
  // A ref is "path@sha256:…", or {ref, path} with the candidate-relative copy to link to.
  const text = typeof ref === 'string' ? ref : ref?.ref || '';
  const name = text.split('@')[0].split('/').at(-1) || text;
  if (typeof ref === 'object' && ref?.path) {
    const a = el('a', name, 'farm-line'); a.href = CANONICAL_BASE + ref.path; a.target = '_blank'; a.rel = 'noopener'; a.title = text;
    return a;
  }
  const span = el('span', name, 'farm-line'); span.title = text;
  return span;
}

export function renderPest(alerts) {
  const box = el('div', null, 'farm-scenario-card');
  if (!alerts.length) box.append(el('p', '本影格沒有病蟲害警示', 'farm-caption'));
  for (const alert of alerts) {
    const card = el('section', null, 'farm-alert');
    card.dataset.occurrenceId = alert.id;
    card.setAttribute('role', 'status');
    const facts = el('dl', null, 'farm-facts');
    field(facts, '什麼', alert.what);
    field(facts, '哪裡', alert.where);
    field(facts, '多少', alert.howMuch);
    field(facts, '從何時', alert.since);
    const source = el('dd');
    source.append(el('span', alert.sourceFrame === null ? '影格 —' : `模擬影格 第 ${alert.sourceFrame + 1} 格`, 'farm-line'),
      ...alert.decisionRefs.map(decisionRef));
    facts.append(el('dt', '出處'), source);
    const risk = el('ul', null, 'farm-list');
    if (!alert.atRisk.length) risk.append(el('li', '本格沒有列出其他風險田區', 'farm-caption'));
    for (const r of alert.atRisk) {
      const li = el('li', null, 'farm-risk');
      li.dataset.faceId = r.id;
      li.append(el('strong', r.label), el('span', r.reason, 'farm-caption'));
      risk.append(li);
    }
    card.append(el('h4', alert.title), facts, el('h4', '可能受影響的田區'), risk);
    if (alert.notice) card.append(el('p', alert.notice, 'farm-alert-notice'));
    box.append(card);
  }
  return box;
}

export function renderPatrol(patrol, narration) {
  const box = el('div', null, 'farm-scenario-card');
  if (narration.scenario.route_reason) box.append(el('p', `路線順序：${narration.scenario.route_reason}`, 'farm-caption'));
  if (!patrol.hasRoute) box.append(el('p', '本影格未提供巡田路線', 'farm-caption'));
  if (patrol.proposal) {
    const head = el('div', null, 'farm-proposal');
    head.dataset.occurrenceId = patrol.proposal.id;
    head.append(el('h4', patrol.proposal.title));
    if (patrol.proposal.what) head.append(el('p', patrol.proposal.what, 'farm-caption'));
    box.append(head);
  }
  const list = el('ol', null, 'farm-stops');
  for (const stop of patrol.stops) {
    const li = el('li', null, `farm-stop${stop.visited ? ' is-visited' : ''}`);
    li.dataset.stopId = stop.id;
    const head = el('div', null, 'farm-stop-head');
    head.append(el('span', String(stop.order), 'farm-stop-number'), el('strong', stop.target), el('span', stop.label, 'farm-badge'),
      el('span', stop.visited ? '✓ 已巡' : '未巡', 'farm-stop-tick'));
    li.append(head);
    if (stop.why) li.append(el('span', `為什麼：${stop.why}`, 'farm-caption'));
    if (stop.lookFor) li.append(el('span', `看什麼：${stop.lookFor}`, 'farm-caption'));
    if (stop.observation) li.append(el('span', `觀察紀錄：${stop.observation}`, 'farm-observation'));
    list.append(li);
  }
  box.append(list);
  if (patrol.workLog) {
    const log = el('section', null, 'farm-worklog');
    log.dataset.occurrenceId = patrol.workLog.id;
    log.append(el('h4', patrol.workLog.title || '作業紀錄（模擬）'));
    if (patrol.workLog.text) log.append(el('p', patrol.workLog.text));
    if (patrol.workLog.lines.length) {
      const ul = el('ul', null, 'farm-list');
      for (const line of patrol.workLog.lines) ul.append(el('li', line));
      log.append(ul);
    }
    box.append(log);
  }
  return box;
}

export function renderOverview() {
  const box = el('div', null, 'farm-scenario-card');
  box.append(el('p', '六堆雅歌園有機教育農場的數位分身原型：田區、溫室、步道與建物都是作者建立並標示為模擬的配置，'
    + '地圖上的作物狀態與事件由預先烘焙的模擬影格逐格播放，不是即時監測。'));
  const list = el('ul', null, 'farm-list');
  const pointer = (id, text) => {
    const scenario = SCENARIOS.find(s => s.id === id);
    const li = el('li'), a = el('a', scenario.title);
    a.href = scenarioHref(scenario);
    a.dataset.scenario = id;
    li.append(a, el('span', `：${text}`));
    return li;
  };
  list.append(pointer('patrol', 'AI 依擴散風險建議巡田點，逐點打勾，最後留下作業紀錄（模擬）。'),
    pointer('pest', '鄰近農場的蟲害警示，看它如何逐格擴散到同作物的田區（模擬）。'));
  box.append(list);
  return box;
}

export function createScenarioPanel({scenario = SCENARIO, error = SCENARIO_ERROR, load = () => loadScenario(CANONICAL_BASE, scenario)} = {}) {
  return {
    id: 'farm-scenario', title: '情境', icon: '▤', defaultSize: {w: 4, h: 8},

    render(container, ctx) {
      const root = el('div', null, 'farm-panel');
      const when = el('output', '', 'farm-status');
      const body = el('div');
      root.append(noticeBar(), selector(scenario), when, body);
      container.append(root);
      const refuse = text => {
        const refusal = el('p', text, 'farm-refusal');
        refusal.setAttribute('role', 'alert');
        body.replaceChildren(refusal);
      };
      if (error) { refuse(error); return {root, ready: Promise.resolve()}; }
      if (scenario.id === 'overview') { body.append(renderOverview()); return {root, ready: Promise.resolve()}; }

      let loaded = null, shown = null, t = 0, patrol = null;
      const sendPins = () => { if (patrol) ctx.map.send('appCommand', {name: PINS_COMMAND, payload: pinsPayload(patrol)}); };
      const show = () => {
        if (!loaded) return;
        const index = frameIndexAt(loaded.frames.map(f => f.elapsed_seconds), t);
        if (index === shown) return;
        shown = index;
        const frame = loaded.frames[index];
        when.textContent = `模擬時間 ${clock(frame.elapsed_seconds)} · 第 ${index + 1} 格`;
        const beat = beatFor(loaded.narration, index);
        const title = el('h3', beat || '本影格未提供段落標題', beat ? 'farm-beat' : 'farm-caption');
        if (scenario.id === 'pest') body.replaceChildren(title, renderPest(pestAlertsFor(loaded.narration, frame)));
        else {
          patrol = patrolFor(loaded.narration, frame);
          body.replaceChildren(title, renderPatrol(patrol, loaded.narration));
          sendPins();
        }
      };
      body.append(el('p', '載入情境…', 'farm-caption'));
      ctx.map.subscribe('time', ({t: next} = {}) => { if (Number.isFinite(next)) { t = next; show(); } });
      // The map module announces itself once it can draw (again after a map reload) and is sent
      // the current frame's stops then; each later frame sends them again.
      ctx.map.subscribe('appEvent', ({name} = {}) => { if (name === PINS_READY) sendPins(); });
      const ready = load().then(value => {
        loaded = value;
        body.replaceChildren();
        const {summary, decision_refs: refs = []} = value.narration.scenario;
        if (summary) root.insertBefore(el('p', summary, 'farm-caption'), when);
        if (refs.length) {
          const sources = el('p', '情境決策：', 'farm-caption farm-scenario-sources');
          sources.append(...refs.map(decisionRef));
          root.insertBefore(sources, when);
        }
        show();
      }).catch(error => refuse(`無法載入情境資料：${error.message}`));
      return {root, ready, clearPins: () => { if (patrol) ctx.map.send('appCommand', {name: PINS_COMMAND, payload: {stops: []}}); }};
    },

    update() {},
    describeForAI() {
      return {schemaVersion: 1, kind: 'farm-scenario', visibleFields: ['scenario', 'frame', 'pest-alert', 'patrol-stops', 'work-log'],
        summary: `目前情境：${scenario?.title || '無（網址的情境不被接受）'}。警示、巡田點與觀察皆為模擬，非防治或操作建議。`};
    },
    dispose(view) { view.clearPins?.(); view.root.remove(); },
  };
}

export const scenarioPanel = createScenarioPanel();
