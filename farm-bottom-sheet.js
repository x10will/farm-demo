// Farm's phone adapter for the two-state tap sheet used in penghu-drone.
// panel-core still owns each panel and its context; only its render root moves.
import {canonicalAdapter, frameIndexAt, phoneCopy} from './panels/farm-data.js';
import {notificationsFor} from './panels/notifications.js';
import {pestAlertsFor} from './panels/pest-panel.js';
import {scenarioHref} from './panels/scenario.js';

const media = matchMedia('(max-width: 767px)');
const cases = [['overview', '農場導覽'], ['patrol', '巡田'], ['pest', '病蟲害']];
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};

export function createFarmBottomSheet(container, active) {
  const sheet = make('section', null, 'farm-phone-sheet');
  sheet.dataset.expanded = 'false';
  sheet.setAttribute('aria-label', '農場操作面板');
  const head = make('div', null, 'farm-sheet-head');
  const top = make('div', null, 'farm-sheet-top');
  const switcher = make('nav', null, 'farm-sheet-switch');
  switcher.setAttribute('aria-label', '選擇用途');
  for (const [id, label] of cases) {
    const link = make('a', label);
    link.href = scenarioHref(id);
    link.onclick = () => { link.href = scenarioHref(id); };
    if (id === active) link.setAttribute('aria-current', 'page');
    switcher.append(link);
  }
  top.append(switcher, make('span', '模擬資料', 'farm-sheet-notice'));
  const clockSlot = make('div', null, 'farm-sheet-clock');
  const toggle = make('button', null, 'farm-sheet-toggle');
  toggle.type = 'button';
  toggle.dataset.sheetToggle = '';
  const summary = make('span', '載入模擬資料…', 'farm-sheet-summary');
  summary.dataset.sheetSummary = '';
  toggle.append(summary);
  head.append(top, clockSlot, toggle);
  const body = make('div', null, 'farm-sheet-body');
  body.dataset.sheetBody = '';
  body.tabIndex = -1;
  const selectionSlot = make('div', null, 'farm-sheet-selection');
  selectionSlot.hidden = true;
  const content = make('div', null, 'farm-sheet-content');
  const footer = make('div', null, 'farm-sheet-footer');
  body.append(selectionSlot, content, footer);
  sheet.append(head, body);
  container.append(sheet);

  let expanded = false;
  let baseSummary = '載入模擬資料…';
  let selectedSummary = null;
  const tracked = new Map();
  const refreshSummary = () => {
    const copy = phoneCopy(selectedSummary || baseSummary);
    if (summary.textContent !== copy) summary.textContent = copy;
  };
  function setExpanded(value) {
    expanded = media.matches && value;
    if (!expanded && media.matches && body.contains(document.activeElement)) toggle.focus({preventScroll: true});
    sheet.dataset.expanded = String(expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? '收合操作面板' : '展開操作面板');
    body.inert = media.matches && !expanded;
    if (expanded && selectedSummary) body.scrollTop = 0;
  }
  const onEscape = event => {
    if (event.key === 'Escape' && expanded) {
      setExpanded(false);
      event.stopPropagation();
    }
  };
  toggle.onclick = () => setExpanded(!expanded);
  document.addEventListener('keydown', onEscape);
  media.addEventListener('change', () => {
    for (const [view, {home, slot}] of tracked)
      (media.matches ? slot === 'selection' ? selectionSlot : content : home).append(view.root);
    setExpanded(false);
  });
  setExpanded(false);
  return {
    isPhone: () => media.matches,
    target: (home, slot) => media.matches ? slot === 'selection' ? selectionSlot : content : home,
    track: (view, home, slot) => tracked.set(view, {home, slot}),
    untrack: view => tracked.delete(view),
    clockSlot,
    footer,
    onPanelReset(callback) {
      content.addEventListener('click', event => {
        if (event.target.closest('[data-farm-reset]')) queueMicrotask(callback);
      }, {capture: true});
    },
    collapse: () => setExpanded(false),
    setSummary: value => { baseSummary = value; refreshSummary(); },
    setSelection: value => {
      selectedSummary = value;
      selectionSlot.hidden = !value;
      if (value && media.matches) body.scrollTop = 0;
      refreshSummary();
    },
  };
}

// Keep panel-core's own replay inputs and handlers. Moving the node retains its
// clock subscriptions; putting it back restores the desktop map card verbatim.
export function installPhoneClock(container, sheet, app) {
  const controls = container.querySelector('.panel-map .replay-controls');
  if (!controls) return;
  const coreLabel = controls.querySelector('output');
  const phoneLabel = make('output', '', 'farm-phone-clock-label');
  app.clock.subscribe(() => {
    phoneLabel.textContent = coreLabel?.textContent.replace(/^回放\s*/, '') || '';
  });
  let home = controls.parentElement;
  let next = controls.nextSibling;
  const place = () => {
    if (media.matches) {
      if (phoneLabel.parentElement !== controls) controls.append(phoneLabel);
      if (controls.parentElement !== sheet.clockSlot) {
        home = controls.parentElement;
        next = controls.nextSibling;
        sheet.clockSlot.append(controls);
      }
    } else {
      phoneLabel.remove();
      if (controls.parentElement !== home && home?.isConnected)
        home.insertBefore(controls, next?.parentElement === home ? next : null);
    }
  };
  media.addEventListener('change', place);
  new MutationObserver(place).observe(container, {childList: true, subtree: true});
  place();
}

export function installPhoneReset(container, sheet, app, calendar, pest) {
  const reset = container.querySelector('.panel-manager [data-action="reset"]');
  const home = reset?.parentElement;
  if (!reset || !home) return;
  const desktopText = reset.textContent;
  const panelResets = !!calendar || !!pest;
  const place = () => {
    (sheet.isPhone() && !panelResets ? sheet.footer : home).append(reset);
    reset.textContent = sheet.isPhone() ? '重設' : desktopText;
  };
  if (panelResets) sheet.onPanelReset(() => {
    if (sheet.isPhone()) { app.reset(); sheet.collapse(); }
  });
  reset.addEventListener('click', () => {
    if (!sheet.isPhone()) return;
    app.clock.pause();
    if (calendar) calendar.reset();
    else if (pest) pest.reset();
    else app.clock.seek(0);
    sheet.collapse();
  });
  media.addEventListener('change', place);
  place();
}

export function installPhoneStory(sheet, app, active, calendar, pest) {
  const toast = make('output', '', 'farm-phone-toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.hidden = true;
  document.body.append(toast);
  let timer = null;
  const dismiss = () => { clearTimeout(timer); toast.hidden = true; toast.textContent = ''; };
  const showToast = text => {
    toast.textContent = phoneCopy(text);
    toast.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(dismiss, 4000);
  };
  if (active === 'overview') sheet.setSummary('點地圖上的田區查看');
  canonicalAdapter().then(candidate => {
    const frames = candidate.artifacts['composed-frames.json'].canonical_frames;
    const narration = candidate.artifacts['scenario-narration.json'];
    let lastIndex = frameIndexAt(candidate.adapter.frameTimesSeconds, app.clock.time);
    let seen = new Set(notificationsFor(candidate, lastIndex).map(row => row.id));
    const update = () => {
      const index = frameIndexAt(candidate.adapter.frameTimesSeconds, app.clock.time);
      const frame = frames[index];
      if (active === 'patrol') {
        const state = calendar?.getSelection();
        const day = frames[state?.index]?.patrol_day;
        if (state?.error || !day) sheet.setSummary('請重新選擇巡田日期（模擬）');
        else {
          const [, month, dayNumber] = day.date.split('-').map(Number);
          const date = `${month}/${dayNumber}`;
          const count = day.planned_patrol?.route?.stops?.length;
          sheet.setSummary(day.phase === 'history' ? `${date} · 巡田紀錄（模擬）`
            : state.offDates.includes(day.date) ? `${date} · 休巡，路線未執行（模擬）`
              : `${date} · 建議巡 ${count} 點（模擬）`);
        }
      } else if (active === 'pest') {
        const alert = pestAlertsFor(narration, frame)[0];
        const beat = narration.beats?.[index]?.text;
        const title = beat || alert?.title;
        sheet.setSummary(title ? `${title}${title.includes('模擬') ? '' : '（模擬）'}`
          : '目前沒有病蟲害警示（模擬）');
      }
      if (sheet.isPhone() && !app.clock.paused && index > lastIndex) {
        const fresh = [], pestFresh = [];
        for (let i = lastIndex + 1; i <= index; i++) {
          const alerts = active === 'pest'
            ? new Map(pestAlertsFor(narration, frames[i]).map(a => [a.id, a])) : new Map();
          for (const row of notificationsFor(candidate, i)) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            const alert = alerts.get(row.id);
            if (alert) pestFresh.push(narration.beats?.[i]?.text || alert.title);
            else fresh.push(row.text);
          }
        }
        const messages = [...pestFresh, ...fresh];
        if (messages.length) {
          const first = messages[0];
          showToast(`${first}${first.includes('模擬') ? '' : '（模擬）'}`
            + `${messages.length > 1 ? `，另 ${messages.length - 1} 則` : ''}`);
        }
      }
      if (index < lastIndex) {
        dismiss();
        seen = new Set(notificationsFor(candidate, index).map(row => row.id));
      }
      lastIndex = index;
    };
    app.clock.subscribe(update);
    calendar?.subscribe(update);
    pest?.subscribe(update);
    update();
  }).catch(() => sheet.setSummary('模擬資料暫時無法載入'));
}
