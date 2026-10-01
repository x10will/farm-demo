// Phone-only presentation picking. The host supplies accepted Face rings from
// its verified static snapshot; this only chooses what the phone sheet shows.
// The current supplied patrol IDs pass through the native DT picker unchanged.
// This never derives runtime data or changes the viewer's runtime state.
const COMMAND = 'farm-phone-drilldown';
const READY = 'farm-phone-drilldown-ready';
const FIELD_TAP = 'farm-phone-field-tap';
const TREE_TAP = 'farm-phone-tree-tap';
const NEAR_TREE_PX = 22;
const FIELD_EDGE_PX = 22; // the rendered crop canopy extends past its ground ring
const TAP_MOVE_PX = 8;

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < 1e-7 && x >= Math.min(ax, bx) && x <= Math.max(ax, bx)
      && y >= Math.min(ay, by) && y <= Math.max(ay, by)) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function distanceToRingSquared(x, y, ring) {
  let best = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2);
  }
  return best;
}

export default function install(api) {
  const {THREE, scene, camera} = api;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const point = new THREE.Vector3();
  const ground = new THREE.Vector3();
  let fields = new Map();
  let treeToFace = new Map();
  let patrolStopIds = new Set();
  let selectedFieldId = null;
  let treeMeshes = new Map();
  let lastTap = null;
  let pointerDown = null;
  let ignoreViewerPickUntil = 0;

  const collect = () => {
    treeMeshes = new Map();
    scene.traverse(object => {
      if (!object.isMesh) return;
      const id = object.userData?.propId;
      if (treeToFace.has(id)) treeMeshes.set(id, object);
    });
  };
  const onCommand = (name, payload) => {
    if (name === 'farm-patrol-stops') {
      patrolStopIds = new Set((Array.isArray(payload?.stops) ? payload.stops : [])
        .filter(row => typeof row?.id === 'string' && row.id.startsWith('patrol-stop:'))
        .map(row => row.id));
      return;
    }
    if (name !== COMMAND || !Array.isArray(payload?.fields) || !Array.isArray(payload?.trees)) return;
    fields = new Map(payload.fields.filter(row => typeof row?.id === 'string' && Array.isArray(row.ring)
      && row.ring.length >= 4 && row.ring.every(vertex => Array.isArray(vertex) && vertex.length >= 3
        && vertex.every(Number.isFinite)))
      .map(row => [row.id, row.ring]));
    treeToFace = new Map(payload.trees.filter(row => typeof row?.id === 'string' && fields.has(row.faceId))
      .map(row => [row.id, row.faceId]));
    selectedFieldId = fields.has(payload.selectedFieldId) ? payload.selectedFieldId : null;
    collect();
  };
  const faceAt = (x, y) => {
    const rect = document.querySelector('#canvas-container canvas')?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    camera.updateMatrixWorld(true);
    ndc.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    ray.setFromCamera(ndc, camera);
    let nearest = null, nearestDistance = FIELD_EDGE_PX ** 2;
    for (const [id, ring] of fields) {
      const elevation = ring.reduce((sum, vertex) => sum + vertex[2], 0) / ring.length;
      const along = (elevation - ray.ray.origin.z) / ray.ray.direction.z;
      if (along <= 0) continue;
      ray.ray.at(along, ground);
      if (inRing(ground.x, ground.y, ring)) return id;
      const screenRing = ring.map(vertex => {
        const projected = point.set(...vertex).project(camera);
        return [rect.left + (projected.x + 1) * rect.width / 2,
          rect.top + (1 - projected.y) * rect.height / 2];
      });
      const distance = distanceToRingSquared(x, y, screenRing);
      if (distance < nearestDistance) { nearest = id; nearestDistance = distance; }
    }
    return nearest;
  };
  const onPointerDown = event => {
    pointerDown = event.target === document.querySelector('#canvas-container canvas')
      ? {x: event.clientX, y: event.clientY, id: event.pointerId} : null;
  };
  const onPointerUp = event => {
    if (event.target !== document.querySelector('#canvas-container canvas')) return;
    const start = pointerDown;
    pointerDown = null;
    if (start && (start.id !== event.pointerId
      || Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MOVE_PX)) return;
    lastTap = {x: event.clientX, y: event.clientY, at: performance.now(), level1: !selectedFieldId};
  };
  const onClick = event => {
    if (event.target !== document.querySelector('#canvas-container canvas')) return;
    // Leave the click to DT, which gives its registered markers priority.
    // Retain the static Face fallback for a click without pointer events.
    if (!lastTap || performance.now() - lastTap.at >= 900)
      lastTap = {x: event.clientX, y: event.clientY, at: performance.now(), level1: !selectedFieldId};
  };
  const nearbyTree = (x, y, faceId) => {
    const rect = document.querySelector('#canvas-container canvas')?.getBoundingClientRect();
    if (!rect) return null;
    let best = null, bestSquared = NEAR_TREE_PX * NEAR_TREE_PX;
    camera.updateMatrixWorld(true);
    for (const [id, mesh] of treeMeshes) {
      if (treeToFace.get(id) !== faceId || !mesh.visible) continue;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      mesh.updateWorldMatrix(true, false);
      mesh.geometry.boundingBox.getCenter(point).applyMatrix4(mesh.matrixWorld).project(camera);
      if (point.z < -1 || point.z > 1) continue;
      const px = rect.left + (point.x + 1) * rect.width / 2;
      const py = rect.top + (1 - point.y) * rect.height / 2;
      const distance = (px - x) ** 2 + (py - y) ** 2;
      if (distance < bestSquared) { best = id; bestSquared = distance; }
    }
    return best;
  };
  const onSelect = event => {
    if (patrolStopIds.has(event.detail?.id)) {
      lastTap = null;
      return;
    }
    if (lastTap?.level1 && performance.now() - lastTap.at < 900) {
      // A native stop pick has had first claim. All other level-one taps still
      // choose only an accepted static Face, including an empty viewer pick.
      ignoreViewerPickUntil = lastTap.at + 900;
      const id = faceAt(lastTap.x, lastTap.y);
      lastTap = null;
      event.stopImmediatePropagation();
      if (id) api.appEvent(FIELD_TAP, {id});
      return;
    }
    if (!selectedFieldId || performance.now() < ignoreViewerPickUntil) {
      // Delayed ordinary picks during the initial field flight stay blocked.
      event.stopImmediatePropagation();
      return;
    }
    if (!fields.size) return;
    if (!lastTap || performance.now() - lastTap.at > 900) return;
    const {x, y} = lastTap;
    lastTap = null;
    const nativeTreeFace = treeToFace.get(event.detail?.id);
    const hitFace = nativeTreeFace || faceAt(x, y);
    if (nativeTreeFace === selectedFieldId) {
      // Use the nearby-tree app event path so the host's flight guard does
      // not restore the field after a valid native tree pick.
      event.stopImmediatePropagation();
      api.appEvent(TREE_TAP, {id: event.detail.id});
      return;
    }
    if (hitFace === selectedFieldId) {
      const nearest = nearbyTree(x, y, selectedFieldId);
      event.stopImmediatePropagation();
      api.appEvent(nearest ? TREE_TAP : FIELD_TAP, {id: nearest || selectedFieldId});
      return;
    }
    event.stopImmediatePropagation();
    if (hitFace) api.appEvent(FIELD_TAP, {id: hitFace});
  };

  api.onAppCommand(onCommand);
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('dt:select', onSelect, true);
  window.addEventListener('dt:details-loaded', collect);
  api.appEvent(READY, {});
  // Extensions can land in either order. Reuse the patrol panel's ready
  // handshake so this guard receives the current supplied IDs even if late.
  api.appEvent('farm-patrol-pins-ready', {});
  return () => {
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('dt:select', onSelect, true);
    window.removeEventListener('dt:details-loaded', collect);
  };
}
