import {createApp} from 'panel-core';
import {manifest} from './manifest.js';
import {installFarmShell} from './farm-shell.js';
import {canonicalAdapter, frameIndexAt} from './panels/farm-data.js';
import {current} from './panels/scenario.js';
import {createPatrolPanel} from './panels/patrol-panel.js';
import {createPestController, createPestPanel} from './panels/pest-panel.js';
import {createPatrolCalendarController} from './panels/patrol-calendar.js';
import {createFarmBottomSheet, installPhoneClock, installPhoneReset, installPhoneStory} from './farm-bottom-sheet.js';

// Only the active simulation supplies panel-core's clock and map. Its candidate
// is verified before either is constructed; inactive data is not downloaded.
let bootstrapError = current.error || null;
let calendar = null;
let pest = null;
const active = current.scenario?.useCaseId;
if (!bootstrapError && (active === 'patrol' || active === 'pest')) {
 try {
  const {adapter, artifacts} = await canonicalAdapter();
  if (active === 'patrol') {
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
      const date = frames[frameIndexAt(adapter.frameTimesSeconds, t)].patrol_day.date;
      return globalThis.matchMedia?.('(max-width: 767px)').matches
        ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : date;
    }};
  } else {
   pest = createPestController({frameTimesSeconds: adapter.frameTimesSeconds});
   manifest.clock = {...manifest.clock, duration: adapter.durationSeconds * 1000};
  }
 } catch (error) { bootstrapError = `無法載入模擬資料：${error.message}`; }
}
manifest.panelTypes['farm-patrol'] = createPatrolPanel({active: active === 'patrol', controller: calendar, error: bootstrapError});
manifest.panelTypes['farm-pest'] = createPestPanel({active: active === 'pest', controller: pest, error: bootstrapError});
const container = document.querySelector('#app');
const sheet = createFarmBottomSheet(container, active || 'overview');
const sheetPanel = active === 'patrol' ? 'farm-patrol' : active === 'pest' ? 'farm-pest' : 'field-navigation';
const panel = manifest.panelTypes[sheetPanel];
manifest.panelTypes[sheetPanel] = {...panel,
  render(home, ctx) {
    const view = panel.render(sheet.target(home), ctx);
    sheet.track(view, home);
    return view;
  },
  dispose(view) { sheet.untrack(view); panel.dispose(view); },
};
const selection = manifest.panelTypes.selection;
manifest.panelTypes.selection = {...selection,
  render(home, ctx) {
    const view = selection.render(sheet.target(home, 'selection'), ctx);
    view.clearSelection = () => window.app.select(null);
    sheet.track(view, home, 'selection');
    view.ready.then(() => sheet.setSelection(view.phoneSummary));
    return view;
  },
  update(view, snapshot) {
    selection.update(view, snapshot);
    sheet.setSelection(view.phoneSummary);
  },
  dispose(view) { sheet.untrack(view); selection.dispose(view); },
};
if (bootstrapError) {
 const refused = new URL(manifest.mapUrl);
 refused.searchParams.set('scenario', 'farm-refused-candidate');
 refused.searchParams.delete('ext');
 manifest.mapUrl = refused.href;
}
window.app=createApp(container,manifest);
calendar?.attachClock(window.app.clock);
pest?.attachClock(window.app.clock);
if (sheet.isPhone() && active === 'overview') { window.app.clock.pause(); window.app.clock.seek(0); }
installFarmShell(container,window.app);
installPhoneClock(container,sheet,window.app);
installPhoneReset(container,sheet,window.app,calendar,pest);
installPhoneStory(sheet,window.app,active || 'overview',calendar,pest);
if (!sheet.isPhone() && active === 'patrol') window.app.focus('farm-patrol');
else if (!sheet.isPhone() && active === 'pest') window.app.focus('farm-pest');
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
   const button=document.createElement('button');button.className='update-button';button.textContent='Update available · Reload';
   button.onclick=()=>{window.app.save();updateRequested=true;worker.postMessage({type:'SKIP_WAITING'});};document.body.append(button);
  }
  offer(reg.waiting);reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offer(reg.waiting);});});
 }).catch(()=>{});
}
