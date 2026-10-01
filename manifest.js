import {fieldNavigationPanel} from './panels/field-navigation.js';
import {notificationsPanel} from './panels/notifications.js';
import {provenancePanel} from './panels/provenance.js';
import {selectionPanel} from './panels/selection.js';
import {PATROL_PINS_MODULE, patrolPanel} from './panels/patrol-panel.js';
import {pestPanel} from './panels/pest-panel.js';
import {scenarioFrom} from './panels/scenario.js';

function mapUrl(search = globalThis.location?.search) {
  const url = new URL(`./${globalThis.FARM_DEPLOYMENT?.dtBase || 'dt/'}docs/viewer-3d/index.html?site=farm&canonical=1&embed=1&compactNav=1`, import.meta.url);
  const requested = new URLSearchParams(search || '').get('scenario');
  const resolved = scenarioFrom(search);
  if (resolved.scenario) {
    const chosen = resolved.scenario;
    // The DT registry identifies a candidate by variant ID; the page URL keeps its use-case ID.
    if (chosen.id !== 'overview') url.searchParams.set('scenario', chosen.canonicalId || chosen.id);
    if (chosen.viewKind === 'patrol-calendar')
      url.searchParams.set('ext', PATROL_PINS_MODULE);
    if (globalThis.matchMedia?.('(max-width: 767px)').matches)
      url.searchParams.append('ext', new URL('./map-ext/phone-drilldown.js', import.meta.url).href);
  } else if (requested !== null) {
    // A refused link must also be refused by the viewer, never replaying overview.
    url.searchParams.set('scenario', resolved.kind === 'unknown' && !globalThis.FARM_DEPLOYMENT?.scenarioCatalogue
      ? requested : 'farm-refused-scenario');
  }
  return url.href;
}
export {mapUrl};

const activeSimulation = scenarioFrom(globalThis.location?.search).scenario?.useCaseId || 'overview';
const primaryPanel = activeSimulation === 'pest' ? 'farm-pest' : 'farm-patrol';
const secondaryPanel = primaryPanel === 'farm-pest' ? 'farm-patrol' : 'farm-pest';
const primaryHeight = activeSimulation === 'overview' ? 3 : 8;
const phone = globalThis.matchMedia?.('(max-width: 767px)').matches ?? false;
const phonePanel = activeSimulation === 'patrol' ? 'farm-patrol'
  : activeSimulation === 'pest' ? 'farm-pest' : 'field-navigation';

export const manifest = {
  // Each simulation remembers its layout. Desktop keeps both named panels;
  // phone starts with the map and only the active use case's panel.
  version: 1, id: `npust-smart-agriculture-panel-${phone ? 'phone-sheet' : 'simulations'}-${activeSimulation}`, title: '智慧化農業管理平台', subtitle: '國立屏東科技大學 · 模擬資料原型',
  locale: 'zh-Hant', locales: ['zh-Hant', 'en'], apiBase: './api/',
  // Same-origin DT viewer in embed mode, relative to the app: run.py mounts dt/* beside
  // the app, and the static build copies it to the dt/<id>/ its deployment-config.js names,
  // so any base path works. compactNav=1 asks
  // the viewer for its compact phone navigation (DT embed-098f224e and later; older
  // generations ignore it).
  // The page's scenario goes to the viewer as &scenario=<id> (none for 總覽); a refused value
  // also gives the viewer a refused scenario, never a different candidate.
  // 巡田 loads its status and numbered-stop module through DT's same-origin ?ext= extension.
  mapUrl: mapUrl(),
  // The active candidate supplies the final clock labels and frame step in app.js.
  clock: {duration: 600000, rate: 1, labelFormat: t => { const s = Math.floor(t / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, loop: false, step: 100000, rates: [1, 10, 60]},
  streams: {},
  panelTypes: {'farm-patrol': patrolPanel, 'farm-pest': pestPanel,
    'field-navigation': fieldNavigationPanel, 'farm-provenance': provenancePanel, 'farm-notifications': notificationsPanel,
    // Replaces panel-core's built-in selection card: same type, plus the adapter's crop rows.
    selection: selectionPanel},
  catalogue: [
    {id: 'map', type: 'map', titleKey: '農場地圖', icon: '⌖', defaultSize: {w: 8, h: 8}},
    {id: 'farm-patrol', type: 'farm-patrol', titleKey: '巡田', icon: '⌖', defaultSize: {w: 4, h: 8}},
    {id: 'farm-pest', type: 'farm-pest', titleKey: '病蟲害擴散', icon: '◔', defaultSize: {w: 4, h: 6}},
    {id: 'field-navigation', type: 'field-navigation', titleKey: '田區導覽', icon: '⌖', defaultSize: {w: 4, h: 7}},
    {id: 'farm-provenance', type: 'farm-provenance', titleKey: '模擬與出處', icon: 'ⓘ', defaultSize: {w: 4, h: 5}},
    {id: 'farm-notifications', type: 'farm-notifications', titleKey: '通知', icon: '◔', defaultSize: {w: 4, h: 5}},
    {id: 'selection', type: 'selection', titleKey: 'selection', icon: '◎', defaultSize: {w: 4, h: 5}},
  ],
  preset: phone ? [
    {id: 'map', type: 'map', x: 0, y: 0, w: 8, h: 8},
    {id: phonePanel, type: phonePanel, x: 8, y: 0, w: 4, h: 8},
  ] : [
    {id: 'map', type: 'map', x: 0, y: 0, w: 8, h: 8},
    {id: primaryPanel, type: primaryPanel, x: 8, y: 0, w: 4, h: primaryHeight},
    {id: secondaryPanel, type: secondaryPanel, x: 8, y: primaryHeight, w: 4, h: 3},
    {id: 'farm-notifications', type: 'farm-notifications', x: 0, y: 8, w: 8, h: 5},
    {id: 'field-navigation', type: 'field-navigation', x: 8, y: primaryHeight + 3, w: 4, h: 7},
    {id: 'farm-provenance', type: 'farm-provenance', x: 0, y: 13, w: 8, h: 5},
  ],
  layout: {phone: {order: [phonePanel]}},
  theme: {accent: '#6fae5b'},
};
