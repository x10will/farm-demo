// 模擬與出處: the simulation notices plus where every loaded byte came from.
// Each value is read from the file the app actually loaded.
import {APP_BASE, CANONICAL_BASE, DT_BASE, el, loadJSON, noticeBar} from './farm-data.js';

// The static build carries its deployment record in deployment-config.js
// (window.FARM_DEPLOYMENT); run.py writes the same fields to runtime.local.json.
export function deploymentRecord() {
  return globalThis.FARM_DEPLOYMENT ? Promise.resolve(globalThis.FARM_DEPLOYMENT) : loadJSON(new URL('runtime.local.json', APP_BASE).href);
}

const short = value => (typeof value === 'string' ? value.replace(/^sha256:/, '').slice(0, 12) : '—');
// panel-core's licence is UNSET by owner decision (2026-09-24); VENDOR.json spells it in English.
const licence = value => (typeof value === 'string' && value.startsWith('UNSET') ? '未設定' : value || '—');

export const provenancePanel = {
  id: 'farm-provenance', title: '模擬與出處', icon: 'ⓘ', defaultSize: {w: 4, h: 5},

  render(container) {
    const root = el('div', null, 'farm-panel');
    const list = el('dl', null, 'farm-provenance');
    root.append(noticeBar(), el('p', '非正式候選示範；不提供即時監測、診斷或正式營運服務。', 'farm-caption'), list);
    container.append(root);

    const row = (term, value, href) => {
      const dd = el('dd');
      if (href) { const a = el('a', value); a.href = href; a.target = '_blank'; a.rel = 'noopener'; dd.append(a); }
      else dd.textContent = value;
      list.append(el('dt', term), dd);
    };
    const failed = (term, error) => row(term, `無法讀取（${error.message}）`);

    (async () => {
      const [runtime, manifest] = await Promise.allSettled([
        deploymentRecord(), loadJSON(CANONICAL_BASE + 'manifest.json'),
      ]);
      if (manifest.status === 'fulfilled') {
        const m = manifest.value;
        row('候選資料', `composed ${short(m.composed_revision)} · snapshot ${short(m.snapshot_revision)}`, CANONICAL_BASE + 'manifest.json');
        for (const [name, file] of [['作物階段呈現裁示', 'crop-health-presentation-decision.md'],
          ['作物階段裁示', 'crop-health-decision.md'], ['擴散裁示', 'pest-spread-decision.md'],
          ['巡田路線裁示', 'patrol-route-decision.md'], ['情境裁示', 'scenario-decision.md'],
          ['跨農場擴散情境裁示', 'spread-scenario-decision.md'], ['蟲害警示裁示', 'pest-alert-decision.md'],
          ['巡田站點裁示', 'patrol-stops-decision.md'], ['巡田觀察文字裁示', 'patrol-observation-decision.md'],
          ['巡田步道網裁示', 'patrol-network-decision.md'], ['情境文字', 'scenario-narration.json']]) {
          if ((m.files || []).some(f => f.path === file)) row(name, file, CANONICAL_BASE + file);
        }
      } else failed('候選資料', manifest.reason);

      const generation = runtime.status === 'fulfilled' ? runtime.value : null;
      if (generation) {
        try {
          const inventory = await loadJSON(new URL('generation/inventory.json', DT_BASE).href);
          row('Viewer generation', `${generation.generation} · DT ${short(inventory.sourceRevision)}`);
        } catch (error) { failed('Viewer generation', error); }
        // Copied by run.py or the static build from the generation's staging receipt, which is not served.
        const s = generation.staging;
        if (s) row('Site data', `farm ${short(s.farm_commit)} · DT ${short(s.dt_commit)} · ${s.status}`);
        else row('Site data', '此 generation 沒有 staging 紀錄');
        // Copied by run.py or the static build from vendor/panel-core/VENDOR.json, which is not published.
        const v = generation.panelCore;
        if (v) row('panel-core', `${short(v.sourceCommit)}${v.sourceDirty ? '（dirty）' : ''} · 授權：${licence(v.coreLicense)}`);
        else row('panel-core', '無法讀取 VENDOR.json 釘選');
        row('AI 提問', generation.static ? '靜態版不提供（本機開發版為「模擬 AI」）' : '模擬 AI（fake 模式，非真實模型）');
      } else {
        failed('Viewer generation', runtime.reason);
        failed('panel-core', runtime.reason);
      }
    })();
    return {root};
  },

  update() {},
  describeForAI() {
    return {schemaVersion: 1, kind: 'farm-provenance', visibleFields: ['notices', 'sources'],
      summary: '模擬標示與資料出處（候選資料、裁示、viewer generation、panel-core 版本）；無即時資料。'};
  },
  dispose(view) { view.root.remove(); },
};
