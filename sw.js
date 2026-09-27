// Farm static-build service worker template, derived from vendor/panel-core/sw.js
// (84fc525). app_build.worker() fills in BUILD and ASSETS exactly as for the vendored
// template; build_static.py first fills in FARM_BUILD, DT_PATH and HASHES, so BUILD (the
// cache name) covers them too.
//
// One build, never two (gate review of #109, 2026-09-27, Majors 1-3):
// - The DT tree is published under dt/<id>/, where <id> is derived from its bytes. A page of
//   this build only asks for dt/<id>/ URLs, and only those are runtime-cached here, so
//   neither a page nor this cache can take another build's viewer code, GLBs or frames.
// - Every precached file (the shell, deployment-config.js, the canonical candidate and the
//   generation inventory) is checked against the SHA-256 this build recorded for it, and must
//   be a same-origin 200 that was not redirected. One bad file fails the install.
// - When this worker replaces an older build, the tabs that were open under it are refused
//   everything in scope until they reload, and every tab is told this worker's build; a page
//   whose own build differs reloads (app.js).
// Network fetches bypass the browser HTTP cache (reload for the precache, no-cache at run
// time), so a host's max-age can never hand this build a previous build's bytes. api/ is
// never cached.
const BASE=new URL('./',self.location.href);
const BUILD='d9dd771444c28d9d';
const FARM_BUILD='f23675c97c811387';
const PREFIX='panel-core-'+encodeURIComponent(BASE.pathname)+'-';
const CACHE=PREFIX+BUILD;
const RUNTIME=PREFIX+'dt-'+BUILD;
const ASSETS=["./", "./app.js", "./deployment-config.js", "./dt/4a39154d22c8d679/data/farm-canonical/composed-frames.json", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-decision.md", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-declaration.json", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-presentation-decision.md", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-presentation.json", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-report.json", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-stage-sequence.json", "./dt/4a39154d22c8d679/data/farm-canonical/four-beat-frames.json", "./dt/4a39154d22c8d679/data/farm-canonical/manifest.json", "./dt/4a39154d22c8d679/data/farm-canonical/modules/farm-canonical-adapter.mjs", "./dt/4a39154d22c8d679/data/farm-canonical/modules/non-shipping-crop-health-stage-presentation.mjs", "./dt/4a39154d22c8d679/data/farm-canonical/modules/non-shipping-crop-health-stage-projection.mjs", "./dt/4a39154d22c8d679/data/farm-canonical/modules/non-shipping-pest-spread-projection.mjs", "./dt/4a39154d22c8d679/data/farm-canonical/patrol-route-decision.md", "./dt/4a39154d22c8d679/data/farm-canonical/patrol-route-report.json", "./dt/4a39154d22c8d679/data/farm-canonical/per-plant-spread-report.json", "./dt/4a39154d22c8d679/data/farm-canonical/pest-spread-chain.json", "./dt/4a39154d22c8d679/data/farm-canonical/pest-spread-decision.md", "./dt/4a39154d22c8d679/data/farm-canonical/pest-spread-declaration.json", "./dt/4a39154d22c8d679/data/farm-canonical/pest-spread-report.json", "./dt/4a39154d22c8d679/data/farm-canonical/scenario-inputs.json", "./dt/4a39154d22c8d679/data/farm-canonical/static-snapshot.json", "./dt/4a39154d22c8d679/generation/inventory.json", "./farm-panel.css", "./farm-shell.js", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./index.html", "./manifest.js", "./manifest.webmanifest", "./panels/farm-data.js", "./panels/field-navigation.js", "./panels/notifications.js", "./panels/provenance.js", "./panels/selection.js", "./vendor/panel-core/GRIDSTACK_LICENSE.txt", "./vendor/panel-core/THIRD_PARTY_LICENSES.md", "./vendor/panel-core/core.css", "./vendor/panel-core/core.js", "./vendor/panel-core/map-client.js"];
const HASHES={"./": "b3b924d6b2cbc3d4997cb5eab8a2cd0efd29037b9cbe7a14dabb8810afc0ae86", "./app.js": "03e2f287072f54b72c1ddb30d6f641d426492f11b7710e17daa8524004f4df39", "./deployment-config.js": "7e2540a3604a0b7d833df9907e5d64db86a69edc21574c69270139f6ba6db6c1", "./dt/4a39154d22c8d679/data/farm-canonical/composed-frames.json": "d261f2a95dd19e4dd9d504cb342adb3c7a1552a02b261089229cbdaaf0e62683", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-decision.md": "666ebac3279a4be49fdb0d7b6c994ec2edbe1e6e2a54626339dbd33684246e64", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-declaration.json": "3afe32518de6e62e684b5d9677f9ed2d41ec50f7bfd0824cb76ae170a08dbd5b", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-presentation-decision.md": "8fc29a441666ba5128586ec7cfbe5c80615de425f462474b13ff011189d52b83", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-presentation.json": "9dc7e78bac03453258f8f27e218159b9ce150e4c937f12e3af6122b66fd3cf48", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-report.json": "1ec514427a679cb1a6206b3709f80333440e091f58a1b4de2e2137e3c4feb55c", "./dt/4a39154d22c8d679/data/farm-canonical/crop-health-stage-sequence.json": "b7337a308b376e3238c3502fed2b742c1d674023cf67c87a09d84fb84dfe6699", "./dt/4a39154d22c8d679/data/farm-canonical/four-beat-frames.json": "5f00a2fe196fd8b46533b69298cbc61c65c74e884c6e6b03cc5ea0d0f489b774", "./dt/4a39154d22c8d679/data/farm-canonical/manifest.json": "32c3b5b7fbc3aa16bc8f497660e9ab5868322a3fe6f315e595d60f38bf8adfdf", "./dt/4a39154d22c8d679/data/farm-canonical/modules/farm-canonical-adapter.mjs": "f36951337017e824b66c2f45a4b86d1de9bb93bc1ffc35bec6e6039c7850096c", "./dt/4a39154d22c8d679/data/farm-canonical/modules/non-shipping-crop-health-stage-presentation.mjs": "c3828d76392084ad775deaa99ec0320343948f2936c9563f6a5a91638681e6de", "./dt/4a39154d22c8d679/data/farm-canonical/modules/non-shipping-crop-health-stage-projection.mjs": "d6e4993a08e2c6993e8abf6856d6403b324f38029dcdc37177ec3d1691ead8c3", "./dt/4a39154d22c8d679/data/farm-canonical/modules/non-shipping-pest-spread-projection.mjs": "b1977888b2c2d81c0d96a65f84489fc0c749cc3d21bfc9a2db76a0794aa0c199", "./dt/4a39154d22c8d679/data/farm-canonical/patrol-route-decision.md": "9a7dfd18d932185786f40864005821aa349d3ee5bdb18c5df601b3f62c81f6c5", "./dt/4a39154d22c8d679/data/farm-canonical/patrol-route-report.json": "eaa4eb35ab9aa0646be7b605b1b0a8caf69467e647a4126b0e48b234b35ed773", "./dt/4a39154d22c8d679/data/farm-canonical/per-plant-spread-report.json": "50b50f090bdcd667031bd687fb508b89ad8fb1d098daacbe19efce87cefe2e63", "./dt/4a39154d22c8d679/data/farm-canonical/pest-spread-chain.json": "4ba729d89155c09ad4ddeded5635340e7b532352e1561d9a797f270405de02a5", "./dt/4a39154d22c8d679/data/farm-canonical/pest-spread-decision.md": "8093c074be67e3f6f4f0b64609b59d0fae2127c9f2e69ee4a383dcc94ef80c9e", "./dt/4a39154d22c8d679/data/farm-canonical/pest-spread-declaration.json": "0ec1adeddb77784e18b388addc11192733df5f7d4751d1c7576085e12b92921e", "./dt/4a39154d22c8d679/data/farm-canonical/pest-spread-report.json": "f2250e49540fc5d479c80362bb6bac4c05a96ddf37f73692b6fa4850f011bc5e", "./dt/4a39154d22c8d679/data/farm-canonical/scenario-inputs.json": "1ee9f63ceb9ebba7377d89d2ba9121e76d0627bc48f428c9870ad98547dd9423", "./dt/4a39154d22c8d679/data/farm-canonical/static-snapshot.json": "6e95d08bd487d1ab9e596681ef7489b17cc33fb1e5e2a64a8c1913723343176f", "./dt/4a39154d22c8d679/generation/inventory.json": "0119f0924f3b2d1cbd069d18a19ad3050d69072c584d62708f262011f3d552ec", "./farm-panel.css": "18914e7dee754dbe1582c1209e5f94427c17bc081b0dfcc7fd4f88df2fde2db1", "./farm-shell.js": "05a6616a3ecd6f4e5218c44d8103ab686cc3b5f60f662d610380c1faa4cae77c", "./icons/apple-touch-icon.png": "0cf392b08e8fa8889310ef1ed1bcb446384a5b0f18aeb317e94684ab85b7f7df", "./icons/icon-192.png": "4b6b5b41f03737a7ca714d44fb7dfcc76addec36300c97316135ff7730687e7b", "./icons/icon-512.png": "de1b88863eeb009e29074575ba3556f5167014b85a5b8f86a9c4903e0a20e3db", "./icons/maskable-512.png": "de1b88863eeb009e29074575ba3556f5167014b85a5b8f86a9c4903e0a20e3db", "./index.html": "b3b924d6b2cbc3d4997cb5eab8a2cd0efd29037b9cbe7a14dabb8810afc0ae86", "./manifest.js": "bc0ec9f84e1eac1b8ccf2f964c5d9ebe7f42ab59dd24b3da9aa1aad04fea6ba5", "./manifest.webmanifest": "3a42ae2fd01fa32d24b9780ee02e169f2a0cfa5af0ba5a4b30e35c3ec8b5eeaa", "./panels/farm-data.js": "1e1aecf77c6b245f7a00a1de6804de0f671756819e2d6c0d168e399341b6cde6", "./panels/field-navigation.js": "69d4ebba03e4abe9057c58c2b6197e9ce5b98833330416839d017d8d7395f597", "./panels/notifications.js": "802a39e43a25dc4c9f47fd413d9113e4bf995d1204310dce776836c137378e20", "./panels/provenance.js": "0ceced210af5d5a6dd449bd380572e61763efef4f7b9a39babbb0e83341c586d", "./panels/selection.js": "aada5743cd7d3c87bf324636f0da01e37369c4429873796eb5c2bf932a0ef58f", "./vendor/panel-core/GRIDSTACK_LICENSE.txt": "28d28a6e0b5c6ebca8759b162a644c31cea28aab591060c0d95c7737d8456764", "./vendor/panel-core/THIRD_PARTY_LICENSES.md": "49ae6d444c5a08201f546ba2e14077ac4af6a5696cafd77d477ccdb97dce731c", "./vendor/panel-core/core.css": "472b46d96ebc0ba62ad93e8f9fc7e8916c36bd6f6d1c734c152648cc83bf8476", "./vendor/panel-core/core.js": "7659dd618ecc8c595086f1a6058430ec11079ce3d8cdf4cdb41b13fb66d21004", "./vendor/panel-core/map-client.js": "31fbab87fb9d7bc8d7639771e984856c54f70f57ac983ab421ee7e3033dfb987"};
const DT_PATH='dt/4a39154d22c8d679/';
const DT=new URL(DT_PATH,BASE).href;
const REPLACING=new URL('__farm-replacing',BASE).href;
const STALE=new Set();
const cacheable=response=>response.status===200&&response.type==='basic'&&!response.redirected;
const hex=buffer=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');
// A precached file, fetched and checked: same-origin 200, not redirected, and the bytes this build recorded.
async function verified(path,mode){
  const url=new URL(path,BASE).href;
  const response=await fetch(url,{cache:mode,credentials:'same-origin'});
  if(!cacheable(response))throw new Error(`${path}: HTTP ${response.status} ${response.type}${response.redirected?' redirected':''}`);
  const body=await response.arrayBuffer();
  if(hex(await crypto.subtle.digest('SHA-256',body))!==HASHES[path])throw new Error(`${path}: bytes are not this build's`);
  return new Response(body,{status:200,statusText:response.statusText,headers:response.headers});
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  const entries=await Promise.all(ASSETS.map(async path=>[new URL(path,BASE).href,await verified(path,'reload')]));
  for(const [url,response] of entries)await cache.put(url,response);
  if(self.registration.active)await cache.put(REPLACING,new Response('1'));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE&&k!==RUNTIME).map(k=>caches.delete(k)));
  const cache=await caches.open(CACHE);
  const open=await self.clients.matchAll({includeUncontrolled:true});
  if(await cache.match(REPLACING)){for(const client of open)STALE.add(client.id);await cache.delete(REPLACING);}
  await self.clients.claim();
  for(const client of open)if(client.frameType==='top-level')client.postMessage({type:'FARM_BUILD',build:FARM_BUILD});
})()));
async function runtime(request){
  const cache=await caches.open(RUNTIME);
  const cached=await cache.match(request);if(cached)return cached;
  const response=await fetch(request.url,{cache:'no-cache',credentials:'same-origin'});
  if(cacheable(response))await cache.put(request.url,response.clone());
  return response;
}
async function warm(urls){
  const cache=await caches.open(RUNTIME),shell=await caches.open(CACHE);
  for(const url of urls){
    if(typeof url!=='string'||!url.startsWith(DT)||await shell.match(url,{ignoreSearch:true})||await cache.match(url))continue;
    try{const response=await fetch(url,{cache:'no-cache',credentials:'same-origin'});if(cacheable(response))await cache.put(url,response);}catch{}
  }
}
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='FARM_BUILD?')event.source?.postMessage({type:'FARM_BUILD',build:FARM_BUILD});
  if(event.data?.type==='FARM_WARM'&&Array.isArray(event.data.urls))event.waitUntil(warm(event.data.urls));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  const relative=url.pathname.slice(BASE.pathname.length);
  if(relative.startsWith('api/')||relative.startsWith('__test__/')||relative==='healthz'||relative==='sw.js')return;
  // A tab opened under the build this worker replaced gets nothing until it reloads. Its
  // reload is a navigation, which Chrome tags with the old tab's clientId, so it is let through.
  if(event.request.mode!=='navigate'&&STALE.has(event.clientId)){event.respondWith(Response.error());return;}
  // Positive static-asset allow-list: no API or arbitrary response is cached.
  const path=relative===''?'./':'./'+relative;
  const known=ASSETS.includes(path);
  if(!known&&relative.startsWith(DT_PATH)){event.respondWith(runtime(event.request));return;}
  if(!known)return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(new URL(path,BASE).href);if(cached)return cached;
    // Evicted: refetch, but only this build's bytes are served or stored.
    try{const response=await verified(path,'no-cache');await cache.put(new URL(path,BASE).href,response.clone());return response;}
    catch{return Response.error();}
  }));
});
