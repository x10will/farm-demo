import {fieldNavigationPanel} from './panels/field-navigation.js';
import {notificationsPanel} from './panels/notifications.js';
import {provenancePanel} from './panels/provenance.js';
import {selectionPanel} from './panels/selection.js';

export const manifest = {
  version: 1, id: 'npust-smart-agriculture-panel', title: '智慧化農業管理平台', subtitle: '國立屏東科技大學 · 模擬資料原型',
  locale: 'zh-Hant', locales: ['zh-Hant', 'en'], apiBase: './api/',
  // Same-origin DT viewer in embed mode, relative to the app: run.py mounts dt/* beside
  // the app, and the static build copies it to the dt/<id>/ its deployment-config.js names,
  // so any base path works. compactNav=1 asks
  // the viewer for its compact phone navigation (DT embed-098f224e and later; older
  // generations ignore it).
  mapUrl: new URL(`./${globalThis.FARM_DEPLOYMENT?.dtBase || 'dt/'}docs/viewer-3d/index.html?site=farm&canonical=1&embed=1&compactNav=1`, import.meta.url).href,
  // The ten-minute canonical demonstration.
  clock: {duration: 600000, rate: 1, labelFormat: t => { const s = Math.floor(t / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, loop: false, step: 100000, rates: [1, 10, 60]},
  streams: {},
  panelTypes: {'field-navigation': fieldNavigationPanel, 'farm-provenance': provenancePanel, 'farm-notifications': notificationsPanel,
    // Replaces panel-core's built-in selection card: same type, plus the adapter's crop rows.
    selection: selectionPanel},
  catalogue: [
    {id: 'map', type: 'map', titleKey: '農場地圖', icon: '⌖', defaultSize: {w: 8, h: 8}},
    {id: 'field-navigation', type: 'field-navigation', titleKey: '田區導覽', icon: '⌖', defaultSize: {w: 4, h: 7}},
    {id: 'farm-provenance', type: 'farm-provenance', titleKey: '模擬與出處', icon: 'ⓘ', defaultSize: {w: 4, h: 5}},
    {id: 'farm-notifications', type: 'farm-notifications', titleKey: '通知', icon: '◔', defaultSize: {w: 4, h: 5}},
    {id: 'selection', type: 'selection', titleKey: 'selection', icon: '◎', defaultSize: {w: 4, h: 5}},
  ],
  preset: [
    {id: 'map', type: 'map', x: 0, y: 0, w: 8, h: 8},
    {id: 'field-navigation', type: 'field-navigation', x: 8, y: 0, w: 4, h: 7},
    {id: 'farm-provenance', type: 'farm-provenance', x: 8, y: 7, w: 4, h: 5},
    {id: 'farm-notifications', type: 'farm-notifications', x: 0, y: 8, w: 8, h: 4},
  ],
  theme: {accent: '#6fae5b'},
};
