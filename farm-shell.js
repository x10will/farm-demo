// Farm-owned additions to the panel-core shell, outside vendor/:
// - the static-build flag (set by deployment-config.js, which only the static build writes);
// - the map data credit (OSM and 政府資料開放授權條款), a compact ⓘ that expands;
// - in the static build, telling the service worker which viewer files this page already
//   loaded, so the ones fetched before it took control are cached for an offline visit.
// Nothing here reads or changes canonical frames or runtime state.

export const deployment = globalThis.FARM_DEPLOYMENT || null;
export const isStatic = deployment?.static === true;

// Notices for the map's context data. notice_ref values in the farm site export:
// odbl-1.0 (roads, river, buildings) and nlsc-dtm-rights (terrain, dataset 176927).
export const CREDITS = [
  {text: '© OpenStreetMap contributors（ODbL 1.0）：外圍道路、河川與建物脈絡', href: 'https://www.openstreetmap.org/copyright'},
  {text: '地形：內政部 2025 年 20 m 數值地形模型（data.gov.tw 資料集 176927）', href: 'https://data.gov.tw/dataset/176927'},
  {text: '依政府資料開放授權條款－第1版 使用', href: 'https://data.gov.tw/license'},
];

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

// Collapsed: a 44 px ⓘ in the map's top-left corner (the viewer's own controls sit top-right,
// and on phones panel-core's deck covers the map's lower part). Open: the notices with their links. Tap again, 關閉 or Escape collapses.
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
    link.href = credit.href; link.target = '_blank'; link.rel = 'noopener';
    item.append(link); list.append(item);
  }
  const close = el('button', '關閉', 'farm-credit-close');
  close.type = 'button';
  panel.append(el('strong', '地圖資料來源與授權'), list, close);
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

function warm(frame) {
  const worker = navigator.serviceWorker?.controller;
  if (worker) worker.postMessage({type: 'FARM_WARM', urls: loadedUrls(frame)});
}

// Map frames this page has attached; one controllerchange listener serves them all.
const frames = new Set();
let listening = false;

function attach(frame, app) {
  const holder = frame.parentElement;
  holder.classList.add('farm-map-holder');
  if (!holder.querySelector('.farm-credit')) holder.append(mapCredit());
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
}
