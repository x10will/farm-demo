// Numbered 巡田 stop pins on the DT map, loaded by the viewer through its same-origin embed
// extension (?ext=, DT docs/viewer-3d/embed-extensions.js and embed-author-guide.md). Farm code,
// not DT's: the 情境 panel sends each frame's stops as the app command `farm-patrol-stops`
// ({stops: [{id, order, lon, lat, visited, title}]}, read from the canonical frame and the
// scenario narration), and this module only draws what it is sent: a numbered pin per stop,
// ticked green once the frame lists it as visited. Every command replaces all pins, so a
// coalesced or repeated command never leaves a stale pin. It computes no route and no state.
export const COMMAND = 'farm-patrol-stops';
export const READY = 'farm-patrol-pins-ready';
const PIN_HEIGHT_M = 4;
const PIN_SCREEN_SIZE = 0.06; // fraction of the view height, so a pin reads the same at any zoom

function texture(THREE, stop) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fillStyle = stop.visited ? '#2f8f46' : '#ffffff'; g.fill();
  g.lineWidth = 10; g.strokeStyle = stop.visited ? '#ffffff' : '#d9822b'; g.stroke();
  g.fillStyle = stop.visited ? '#ffffff' : '#1d1a12';
  g.font = 'bold 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(stop.visited ? `${stop.order}✓` : String(stop.order), 64, 68);
  const map = new THREE.CanvasTexture(canvas);
  if ('SRGBColorSpace' in THREE) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export default function setup(api) {
  const {THREE} = api;
  const group = new THREE.Group();
  group.name = 'farm-patrol-pins';
  api.scene.add(group);
  let owned = [];
  const clear = () => {
    for (const {object, unregister, dispose} of owned) { unregister(); group.remove(object); dispose(); }
    owned = [];
  };
  const draw = stops => {
    clear();
    for (const stop of stops) {
      if (!Number.isFinite(stop?.lon) || !Number.isFinite(stop?.lat) || !Number.isFinite(stop?.order)) continue;
      const [x, y] = api.geoToLocal(stop.lat, stop.lon);
      const ground = api.sampleGround(x, y);
      const z = Number.isFinite(ground) ? ground : 0;
      const pin = new THREE.Group();
      pin.name = `farm-patrol-pin-${stop.order}`;
      const map = texture(THREE, stop);
      const material = new THREE.SpriteMaterial({map, depthTest: false, sizeAttenuation: false});
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(PIN_SCREEN_SIZE, PIN_SCREEN_SIZE, 1);
      sprite.position.set(x, y, z + PIN_HEIGHT_M);
      sprite.renderOrder = 1000;
      const stemGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, z + PIN_HEIGHT_M)]);
      const stemMaterial = new THREE.LineBasicMaterial({color: stop.visited ? 0x2f8f46 : 0xd9822b, depthTest: false});
      const stem = new THREE.Line(stemGeometry, stemMaterial);
      stem.renderOrder = 999;
      pin.add(stem, sprite);
      group.add(pin);
      const unregister = api.registerPickable(pin, {id: String(stop.id), label: String(stop.title || `巡田點 ${stop.order}`),
        type: 'patrol-stop', properties: {lon: stop.lon, lat: stop.lat, order: stop.order, visited: Boolean(stop.visited)}});
      owned.push({object: pin, unregister, dispose: () => { map.dispose(); material.dispose(); stemGeometry.dispose(); stemMaterial.dispose(); }});
    }
  };
  api.onDispose(() => { clear(); api.scene.remove(group); });
  api.onAppCommand((name, payload) => { if (name === COMMAND) draw(Array.isArray(payload?.stops) ? payload.stops : []); });
  // The host sends the current stops when it hears this (commands sent before now are not kept).
  api.appEvent(READY, {});
}
