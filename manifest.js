import {fieldNavigationPanel} from './panels/field-navigation.js';
import {notificationsPanel} from './panels/notifications.js';
import {provenancePanel} from './panels/provenance.js';
import {selectionPanel} from './panels/selection.js';
import {PATROL_PINS_MODULE, scenarioPanel} from './panels/scenario-panel.js';

function mapUrl(search = globalThis.location?.search) {
  const url = new URL(`./${globalThis.FARM_DEPLOYMENT?.dtBase || 'dt/'}docs/viewer-3d/index.html?site=farm&canonical=1&embed=1&compactNav=1`, import.meta.url);
  const requested = new URLSearchParams(search || '').get('scenario');
  if (requested !== null) url.searchParams.set('scenario', requested);
  if (requested === 'patrol') url.searchParams.set('ext', PATROL_PINS_MODULE);
  return url.href;
}
export {mapUrl};

export const manifest = {
  // The id keys the saved layout (panel-core: panel-core:layout:v2:<id>). It changed when the 情境
  // panel arrived, so a browser that saved the older layout starts from the preset below with 情境
  // as the first card, instead of a layout that has no 情境 at all. One layout serves every
  // scenario: the panels are the same, only the candidate they read differs.
  version: 1, id: 'npust-smart-agriculture-panel-scenarios', title: '智慧化農業管理平台', subtitle: '國立屏東科技大學 · 模擬資料原型',
  locale: 'zh-Hant', locales: ['zh-Hant', 'en'], apiBase: './api/',
  // Same-origin DT viewer in embed mode, relative to the app: run.py mounts dt/* beside
  // the app, and the static build copies it to the dt/<id>/ its deployment-config.js names,
  // so any base path works. compactNav=1 asks
  // the viewer for its compact phone navigation (DT embed-098f224e and later; older
  // generations ignore it).
  // The page's scenario goes to the viewer as &scenario=<id> (none for 總覽); a refused value is
  // passed on as given, so the viewer refuses it visibly too instead of playing the overview.
  // The 巡田 scenario also loads the farm's numbered-stop module through DT's same-origin
  // ?ext= embed extension (docs/viewer-3d/embed-extensions.js).
  mapUrl: mapUrl(),
  // The ten-minute canonical demonstration.
  clock: {duration: 600000, rate: 1, labelFormat: t => { const s = Math.floor(t / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, loop: false, step: 100000, rates: [1, 10, 60]},
  streams: {},
  panelTypes: {'farm-scenario': scenarioPanel, 'field-navigation': fieldNavigationPanel, 'farm-provenance': provenancePanel, 'farm-notifications': notificationsPanel,
    // Replaces panel-core's built-in selection card: same type, plus the adapter's crop rows.
    selection: selectionPanel},
  catalogue: [
    {id: 'map', type: 'map', titleKey: '農場地圖', icon: '⌖', defaultSize: {w: 8, h: 8}},
    {id: 'farm-scenario', type: 'farm-scenario', titleKey: '情境', icon: '▤', defaultSize: {w: 4, h: 8}},
    {id: 'field-navigation', type: 'field-navigation', titleKey: '田區導覽', icon: '⌖', defaultSize: {w: 4, h: 7}},
    {id: 'farm-provenance', type: 'farm-provenance', titleKey: '模擬與出處', icon: 'ⓘ', defaultSize: {w: 4, h: 5}},
    {id: 'farm-notifications', type: 'farm-notifications', titleKey: '通知', icon: '◔', defaultSize: {w: 4, h: 5}},
    {id: 'selection', type: 'selection', titleKey: 'selection', icon: '◎', defaultSize: {w: 4, h: 5}},
  ],
  preset: [
    {id: 'map', type: 'map', x: 0, y: 0, w: 8, h: 8},
    // 情境 is first after the map (top right), so it is also the first card of the phone deck,
    // which panel-core orders by row, then column.
    {id: 'farm-scenario', type: 'farm-scenario', x: 8, y: 0, w: 4, h: 8},
    {id: 'farm-notifications', type: 'farm-notifications', x: 0, y: 8, w: 8, h: 5},
    {id: 'field-navigation', type: 'field-navigation', x: 8, y: 8, w: 4, h: 7},
    {id: 'farm-provenance', type: 'farm-provenance', x: 0, y: 13, w: 8, h: 5},
  ],
  theme: {accent: '#6fae5b'},
};
