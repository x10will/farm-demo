// Phone-only presentation picking. The host supplies IDs from its verified
// static snapshot; the rendered Face meshes define the on-screen tap region.
// This never reads canonical frames or changes the viewer's runtime state.
const COMMAND = 'farm-phone-drilldown';
const READY = 'farm-phone-drilldown-ready';
const FIELD_TAP = 'farm-phone-field-tap';
const TREE_TAP = 'farm-phone-tree-tap';
const NEAR_TREE_PX = 22;

export default function install(api) {
  const {THREE, scene, camera} = api;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const point = new THREE.Vector3();
  let faces = new Set();
  let treeToFace = new Map();
  let selectedFieldId = null;
  let faceMeshes = [];
  let treeMeshes = new Map();
  let lastTap = null;

  const collect = () => {
    faceMeshes = [];
    treeMeshes = new Map();
    scene.traverse(object => {
      if (!object.isMesh) return;
      const id = object.userData?.propId;
      if (faces.has(id)) faceMeshes.push(object);
      if (treeToFace.has(id)) treeMeshes.set(id, object);
    });
  };
  const onCommand = (name, payload) => {
    if (name !== COMMAND || !Array.isArray(payload?.faces) || !Array.isArray(payload?.trees)) return;
    faces = new Set(payload.faces.filter(id => typeof id === 'string'));
    treeToFace = new Map(payload.trees.filter(row => typeof row?.id === 'string' && faces.has(row.faceId))
      .map(row => [row.id, row.faceId]));
    selectedFieldId = faces.has(payload.selectedFieldId) ? payload.selectedFieldId : null;
    collect();
  };
  const onPointerUp = event => {
    if (event.target !== document.querySelector('#canvas-container canvas')) return;
    lastTap = {x: event.clientX, y: event.clientY, at: performance.now()};
  };
  const faceAt = (x, y) => {
    const rect = document.querySelector('#canvas-container canvas')?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    camera.updateMatrixWorld(true);
    ndc.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(faceMeshes, false).find(hit => hit.object.visible)?.object.userData.propId || null;
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
    if (!faces.size || !lastTap || performance.now() - lastTap.at > 900) return;
    const {x, y} = lastTap;
    lastTap = null;
    if (!faceMeshes.length) collect();
    const nativeTreeFace = treeToFace.get(event.detail?.id);
    const hitFace = faceAt(x, y) || nativeTreeFace || null;
    if (!selectedFieldId) {
      if (!hitFace) return;
      event.stopImmediatePropagation();
      api.appEvent(FIELD_TAP, {id: hitFace});
      return;
    }
    if (nativeTreeFace === selectedFieldId) return;
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
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('dt:select', onSelect, true);
  window.addEventListener('dt:details-loaded', collect);
  api.appEvent(READY, {});
  return () => {
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('dt:select', onSelect, true);
    window.removeEventListener('dt:details-loaded', collect);
  };
}
