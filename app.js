import {createApp} from 'panel-core';
import {manifest} from './manifest.js';
import {installFarmShell} from './farm-shell.js';
window.app=createApp(document.querySelector('#app'),manifest);
installFarmShell(document.querySelector('#app'),window.app);
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
