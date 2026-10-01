// Farm-owned additions to the panel-core shell, outside vendor/:
// - the static-build flag (set by deployment-config.js, which only the static build writes);
// - the map data credit (OSM and 政府資料開放授權條款), a compact ⓘ that expands;
// - in the static build, telling the service worker which viewer files this page already
//   loaded, so the ones fetched before it took control are cached for an offline visit, and
//   every scenario's map page, so switching scenario offline works.
// Nothing here reads or changes canonical frames or runtime state.
import {mapUrl} from './manifest.js';
import {CANONICAL_BASE, DT_BASE, SITE} from './panels/farm-data.js';
import {SCENARIOS, scenarioCatalogue} from './panels/scenario.js';
import {siteFrom} from './site.js';

export const deployment = globalThis.FARM_DEPLOYMENT || null;
export const isStatic = deployment?.static === true;

// Notices for the map's context data. notice_ref values in the farm site export:
// odbl-1.0 (roads, river, buildings) and nlsc-dtm-rights (terrain, dataset 176927).
export const CREDITS = siteFrom().credits || (siteFrom().site_id === 'farm' ? [
  {text: '© OpenStreetMap contributors（ODbL 1.0）：外圍道路、河川與建物脈絡', href: 'https://www.openstreetmap.org/copyright'},
  {text: '地形：內政部 2025 年 20 m 數值地形模型（data.gov.tw 資料集 176927）', href: 'https://data.gov.tw/dataset/176927'},
  {text: '依政府資料開放授權條款－第1版 使用', href: 'https://data.gov.tw/license'},
] : []);

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

// Collapsed: a 44 px ⓘ in the map's top-left corner. Open: the notices and
// farm data lineage links. Tap again, 關閉 or Escape collapses.
export function mapCredit() {
  const root = el('div', null, 'farm-credit');
  root.dataset.creditState = 'collapsed';
  const toggle = el('button', 'ⓘ', 'farm-credit-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '地圖資料來源與授權');
  toggle.setAttribute('aria-expanded', 'false');
  const panel = el('div', null, 'farm-credit-full');
  panel.hidden = true;
  const list = el('ul');
  for (const credit of CREDITS) {
    const item = el('li'), link = el('a', credit.text);
    if (credit.href) { link.href = credit.href; link.target = '_blank'; link.rel = 'noopener'; }
    item.append(link); list.append(item);
  }
  const close = el('button', '關閉', 'farm-credit-close');
  close.type = 'button';
  panel.append(el('strong', '地圖資料來源與授權'), list, close);
  const sources = el('div', null, 'farm-credit-sources');
  sources.append(el('strong', '模擬與出處'));
  for (const [label, href] of [
    ['目前模擬資料與收據', CANONICAL_BASE + 'manifest.json'],
    ['農場場景資料與收據', new URL(`data/${SITE.static_mount}/manifest.json`, DT_BASE).href],
  ]) {
    const link = el('a', label);
    link.href = href; link.target = '_blank'; link.rel = 'noopener';
    sources.append(link);
  }
  panel.insertBefore(sources, close);
  root.append(toggle, panel);
  const set = open => {
    panel.hidden = !open;
    root.dataset.creditState = open ? 'open' : 'collapsed';
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.onclick = () => set(panel.hidden);
  close.onclick = () => { set(false); toggle.focus({preventScroll: true}); };
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { set(false); toggle.focus({preventScroll: true}); } });
  return root;
}

// Same-origin URLs this page and the map iframe have loaded, for the service worker.
function loadedUrls(frame) {
  const urls = new Set();
  for (const w of [window, frame?.contentWindow]) {
    try {
      for (const entry of w.performance.getEntriesByType('resource')) urls.add(entry.name);
      if (w !== window) urls.add(w.location.href);
    } catch { /* a cross-origin or unloaded frame has nothing to add */ }
  }
  return [...urls].filter(url => url.startsWith(new URL('./', document.baseURI).href));
}

// The map iframe URL of every declared scenario, exactly as manifest.js builds it for that
// scenario's page. The worker caches DT files by their full URL, query included, so a scenario
// switched to for the first time while offline finds its viewer page only if it was warmed here.
// Gate review of #112, 2026-09-28, Major 3: overview loaded, offline, switch to pest: no map.
export function scenarioMapUrls() {
  if (SITE.site_id !== 'farm') return SCENARIOS.map(row => {
    const params = new URLSearchParams({site: SITE.site_id});
    if (row.param !== null) params.set('scenario', row.param);
    return mapUrl(`?${params}`);
  });
  return scenarioCatalogue().variants.map(variant => {
    const params = new URLSearchParams();
    if (variant.use_case_id !== 'overview') params.set('scenario', variant.use_case_id);
    params.set('variant', variant.variant_id);
    return mapUrl(`?${params}`);
  });
}

function warm(frame) {
  const worker = navigator.serviceWorker?.controller;
  if (worker) worker.postMessage({type: 'FARM_WARM', urls: [...loadedUrls(frame), ...scenarioMapUrls()]});
}

// The embedded viewer keeps its own reset buttons. Translate their visible copy
// only at the phone breakpoint; their handlers and desktop labels stay intact.
const observedResetButtons = new WeakSet();
const phoneFramed = new WeakSet();
// Keep the site's authored portrait pose even when an iframe reloads while its
// sheet is expanded (the shorter canvas would otherwise select the wide pose).
// A fixed offset then centres the fields. No frame, route or runtime position is
// read; the viewer still owns camera projection and every resize.
function viewerPhoneFrame(frame, force = false) {
  if (SITE.site_id !== 'farm') return;
  try {
    const viewer = frame.contentWindow?.__dtEmbed;
    const preset = Object.values(frame.contentWindow?.DT_SITE?.viewpoints || {})[0];
    if (!viewer?.ready || !preset || typeof viewer.setCameraPose !== 'function'
        || typeof viewer.translateCameraTarget !== 'function') return;
    const phone = globalThis.matchMedia?.('(max-width: 767px)').matches ?? false;
    if (phone && (force || !phoneFramed.has(viewer)) && preset.portrait
        && viewer.setCameraPose(preset.portrait.pos, preset.portrait.target)
        && viewer.translateCameraTarget(-25, 80, 0)) phoneFramed.add(viewer);
    else if (!phone && phoneFramed.has(viewer)
        && viewer.setCameraPose(preset.pos, preset.target)) phoneFramed.delete(viewer);
  } catch { /* An unloaded iframe cannot be framed yet. */ }
}
export function restorePhoneOverview(container) {
  const frame = container.querySelector('iframe.map-frame');
  if (frame) viewerPhoneFrame(frame, true);
}
function viewerPhoneCopy(frame) {
  if (SITE.site_id !== 'farm') return;
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    const phone = globalThis.matchMedia?.('(max-width: 767px)').matches ?? false;
    // The sheet owns phone controls. The viewer's camera toolbar covers the
    // numbered field pins when the map has only the space above the sheet.
    const chrome = doc.getElementById('farm-phone-chrome');
    if (phone && doc.head && !chrome) {
      const style = doc.createElement('style');
      style.id = 'farm-phone-chrome';
      style.textContent = 'html[data-farm-phone="true"] #dt-embed-navigation{display:none!important}';
      doc.head.append(style);
    }
    if (phone) doc.documentElement.dataset.farmPhone = 'true';
    else { chrome?.remove(); delete doc.documentElement.dataset.farmPhone; }
    const reset = doc.querySelector('#btn-reset');
    if (reset) {
      const label = phone ? '重設' : 'Reset';
      if (reset.textContent !== label) reset.textContent = label;
      if (!observedResetButtons.has(reset)) {
        observedResetButtons.add(reset);
        new MutationObserver(() => viewerPhoneCopy(frame))
          .observe(reset, {childList: true, subtree: true, characterData: true});
      }
    }
    const view = doc.querySelector('#btn-reset-view');
    if (view) {
      view.setAttribute('aria-label', phone ? '重設視角' : 'Reset view');
      const label = view.querySelector('span');
      if (label && label.textContent !== (phone ? '重設' : 'Reset')) label.textContent = phone ? '重設' : 'Reset';
    }
  } catch { /* An unloaded iframe has no controls to label yet. */ }
}

// Map frames this page has attached; one controllerchange listener serves them all.
const frames = new Set();
let listening = false;

function attach(frame, app) {
  const holder = frame.parentElement;
  holder.classList.add('farm-map-holder');
  if (!holder.querySelector('.farm-credit')) holder.append(mapCredit());
  if (siteFrom().site_id !== 'farm') {
    const controls = frame.closest('article')?.querySelector('.replay-controls');
    if (controls && !controls.querySelector('.farm-demo-reset')) {
      const reset = el('button', '重設示範', 'farm-demo-reset');
      reset.type = 'button';
      reset.onclick = () => { app.clock.pause(); app.clock.seek(0); };
      controls.classList.add('farm-site-replay');
      controls.insertBefore(reset, controls.querySelector('output'));
    }
  }
  if (SITE.site_id === 'farm') {
    frame.addEventListener('load', () => viewerPhoneCopy(frame));
    app?.map?.subscribe('ready', () => { viewerPhoneCopy(frame); viewerPhoneFrame(frame); });
    viewerPhoneCopy(frame);
  }
  if (!isStatic || !('serviceWorker' in navigator)) return;
  frames.add(frame);
  if (!listening) {
    listening = true;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      for (const f of frames) { if (f.isConnected) warm(f); else frames.delete(f); }
    });
  }
  app?.map?.subscribe('ready', () => { if (!frame.isConnected) return; warm(frame); setTimeout(() => warm(frame), 15000); });
}

// A layout reset can rebuild the map panel, so every new map iframe is attached once.
export function installFarmShell(container, app) {
  if (isStatic) document.documentElement.dataset.farmDeployment = 'static';
  const seen = new WeakSet();
  const scan = () => {
    for (const frame of container.querySelectorAll('iframe.map-frame')) {
      if (!seen.has(frame)) { seen.add(frame); attach(frame, app); }
    }
  };
  scan();
  new MutationObserver(scan).observe(container, {childList: true, subtree: true});
  globalThis.matchMedia?.('(max-width: 767px)').addEventListener('change', () => {
    for (const frame of container.querySelectorAll('iframe.map-frame')) { viewerPhoneCopy(frame); viewerPhoneFrame(frame); }
  });
}
