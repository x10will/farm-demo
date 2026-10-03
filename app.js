import {createApp} from 'panel-core';
// Load the local site record before evaluating site-dependent panel modules.
if (!globalThis.FARM_DEPLOYMENT) {
 try { const response=await fetch(new URL('./runtime.local.json',import.meta.url));
  if(response.ok)globalThis.FARM_DEPLOYMENT=await response.json(); } catch {}
}
const [{manifest}, {installFarmShell, restorePhoneOverview}, {canonicalAdapter, frameIndexAt},
 {current}, {createPatrolPanel}, {createPestController, createPestPanel},
 {createPatrolCalendarController, patrolClockLabel}, {createSelectionPanel},
 {createFarmBottomSheet, installPhoneClock, installPhoneReset, installPhoneStory},
 {createPhoneDrilldown}, {siteFrom}, {mapLayers}] = await Promise.all([
 import('./manifest.js'), import('./farm-shell.js'), import('./panels/farm-data.js'),
 import('./panels/scenario.js'), import('./panels/patrol-panel.js'), import('./panels/pest-panel.js'),
 import('./panels/patrol-calendar.js'), import('./panels/selection.js'), import('./farm-bottom-sheet.js'),
 import('./phone-drilldown.js'), import('./site.js'), import('./panels/map-layers.js'),
]);
const site = siteFrom();
document.documentElement.dataset.farmSite = site.site_id;
if (site.site_id !== 'farm') {
 window.app=createApp(document.querySelector('#app'),manifest);
 window.app.clock.pause();
 window.app.clock.seek(0);
 installFarmShell(document.querySelector('#app'),window.app);
} else {
// Only the active simulation supplies panel-core's clock and map. Its candidate
// is verified before either is constructed; inactive data is not downloaded.
let bootstrapError = current.error || null;
let calendar = null;
let pest = null;
const active = current.scenario?.useCaseId;
if (!bootstrapError && (active === 'overview' || active === 'patrol' || active === 'pest')) {
 try {
  const {adapter, artifacts, manifest: candidateManifest} = await canonicalAdapter();
  if (active === 'overview') {
   const frames = artifacts['composed-frames.json']?.canonical_frames;
   if (candidateManifest.scenario?.profile !== 'farm-overview-daynight/v1'
     || !frames || frames.length !== 24 || adapter.frameTimesSeconds.length !== frames.length
     || adapter.durationSeconds !== 600) throw new Error('農場導覽候選缺少逐時晝夜影格');
   manifest.clock = {...manifest.clock, duration: adapter.durationSeconds * 1000, step: 25000,
    labelFormat: t => `模擬 ${frames[frameIndexAt(adapter.frameTimesSeconds, t)].environment.time_of_day}`};
  } else if (active === 'patrol') {
   const schedule = artifacts['daily-frames.json']?.daily_schedule;
   const lookup = artifacts['patrol-days-off-outcomes.json'];
   const frames = artifacts['composed-frames.json']?.canonical_frames;
   if (!schedule || !lookup || !frames || adapter.frameTimesSeconds.length !== frames.length) throw new Error('日曆候選缺少已驗證的日期與影格');
   calendar = createPatrolCalendarController({schedule, lookup, frameTimesSeconds: adapter.frameTimesSeconds,
    clearSelection: () => {
     // The existing public select API reveals its card. Reset only an open card,
     // then keep the visitor in the calendar instead of opening another panel.
     if (window.app.layout.some(panel => panel.type === 'selection')) {
      window.app.select(null);
      window.app.focus('farm-patrol');
     }
    }});
   manifest.clock = {...manifest.clock, duration: adapter.durationSeconds * 1000,
    step: schedule.step_seconds * 1000,
    labelFormat: t => {
      const day = frames[frameIndexAt(adapter.frameTimesSeconds, t)].patrol_day;
      return patrolClockLabel(day, !!globalThis.matchMedia?.('(max-width: 767px)').matches);
    }};
  } else {
   pest = createPestController({frameTimesSeconds: adapter.frameTimesSeconds});
   manifest.clock = {...manifest.clock, duration: adapter.durationSeconds * 1000};
   // A dated candidate (2026-10-01-farm-pest-spread-days.md) labels the replay clock by baked day,
   // as 巡田 does; an undated one keeps the demo clock.
   const frames = artifacts['composed-frames.json']?.canonical_frames;
   if (frames?.length && frames.every(frame => frame.date)) {
    manifest.clock.labelFormat = t => {
     const frame = frames[frameIndexAt(adapter.frameTimesSeconds, t)];
     return globalThis.matchMedia?.('(max-width: 767px)').matches
       ? `${Number(frame.date.slice(5, 7))}/${Number(frame.date.slice(8, 10))} · 第${frame.day_number}日`
       : `${frame.date} · 第 ${frame.day_number} 日`;
    };
   }
  }
 } catch (error) { bootstrapError = `無法載入模擬資料：${error.message}`; }
}
manifest.panelTypes['farm-patrol'] = createPatrolPanel({active: active === 'patrol', controller: calendar, error: bootstrapError});
manifest.panelTypes['farm-pest'] = createPestPanel({active: active === 'pest', controller: pest, error: bootstrapError});
manifest.panelTypes.selection = createSelectionPanel({controller: calendar});
const container = document.querySelector('#app');
const sheet = createFarmBottomSheet(container, active || 'overview');
let phoneDrilldown = null;
let selectionView = null;
const sheetPanel = active === 'patrol' ? 'farm-patrol' : active === 'pest' ? 'farm-pest' : 'field-navigation';
const panel = manifest.panelTypes[sheetPanel];
manifest.panelTypes[sheetPanel] = {...panel,
  render(home, ctx) {
    const phoneCtx = sheet.isPhone()
      ? {...ctx, focusEntity: id => {
        if (!phoneDrilldown) return ctx.focusEntity(id);
        void phoneDrilldown.selectField(id).then(selected => { if (!selected) ctx.focusEntity(id); });
      }} : ctx;
    const view = panel.render(sheet.target(home), phoneCtx);
    sheet.track(view, home);
    return view;
  },
  dispose(view) { sheet.untrack(view); panel.dispose(view); },
};
const selection = manifest.panelTypes.selection;
manifest.panelTypes.selection = {...selection,
  render(home, ctx) {
    const view = selection.render(sheet.target(home, 'selection'), ctx);
    selectionView = view;
    view.clearSelection = () => { if (phoneDrilldown) phoneDrilldown.clear(); else window.app.select(null); };
    sheet.track(view, home, 'selection');
    view.ready.then(() => sheet.setSelection(view.phoneSummary, {tree: !!view.treeFaceId}));
    return view;
  },
  update(view, snapshot) {
    selection.update(view, snapshot);
    sheet.setSelection(view.phoneSummary, {tree: !!view.treeFaceId});
  },
  dispose(view) { if (selectionView === view) selectionView = null; sheet.untrack(view); selection.dispose(view); },
};
if (bootstrapError) {
 const refused = new URL(manifest.mapUrl);
 refused.searchParams.set('scenario', 'farm-refused-candidate');
 refused.searchParams.delete('ext');
 manifest.mapUrl = refused.href;
}
window.app=createApp(container,manifest);
mapLayers.attach(window.app.map);
if (sheet.isPhone() && !bootstrapError) {
 phoneDrilldown = createPhoneDrilldown(window.app, {restoreOverview: () => restorePhoneOverview(container)});
 sheet.onSelectionActions({
  onBack: () => { if (selectionView?.treeFaceId) void phoneDrilldown.selectField(selectionView.treeFaceId, {fly: false}); },
  onClear: () => phoneDrilldown.clear(),
 });
}
calendar?.attachClock(window.app.clock);
pest?.attachClock(window.app.clock);
if (sheet.isPhone() && active === 'overview') { window.app.clock.pause(); window.app.clock.seek(0); }
installFarmShell(container,window.app);
installPhoneClock(container,sheet,window.app);
installPhoneReset(container,sheet,window.app,calendar,pest);
installPhoneStory(sheet,window.app,active || 'overview',calendar,pest);
if (!sheet.isPhone() && active === 'patrol') window.app.focus('farm-patrol');
else if (!sheet.isPhone() && active === 'pest') window.app.focus('farm-pest');
}
if('serviceWorker' in navigator){
 // One build per tab (gate review of #109, 2026-09-27, Major 2): whenever a worker takes this
 // tab, ask for its build; a tab whose own build differs saves its layout and reloads, so no tab
 // keeps an old shell under a new build's worker. The static build's worker also tells every
 // open tab its build when it activates, and refuses the tabs it replaced until they reload.
 // Listening starts before registering, so a message sent at activation is never missed.
 const build=globalThis.FARM_DEPLOYMENT?.build;
 let updateRequested=false,refreshing=false;
 const reload=()=>{if(refreshing)return;refreshing=true;try{window.app.save();}catch{}location.reload();};
 const ask=()=>{if(build)navigator.serviceWorker.controller?.postMessage({type:'FARM_BUILD?'});};
 navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='FARM_BUILD'&&build&&event.data.build!==build)reload();});
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested)reload();else ask();});
 ask();
 navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:'./'}).then(reg=>{
  function offer(worker){
   if(!worker||!navigator.serviceWorker.controller)return;
   const button=document.createElement('button');button.className='update-button';button.textContent='有新版本 · 重新載入';
   button.onclick=()=>{window.app.save();updateRequested=true;worker.postMessage({type:'SKIP_WAITING'});};document.body.append(button);
  }
  offer(reg.waiting);reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offer(reg.waiting);});});
 }).catch(()=>{});
}
