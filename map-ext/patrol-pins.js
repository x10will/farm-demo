// Numbered 巡田 stop pins on the DT map, loaded by the viewer through its same-origin embed
// extension (?ext=, DT docs/viewer-3d/embed-extensions.js and embed-author-guide.md). Farm code,
// not DT's: the patrol panel sends canonical stops and a selected route through
// `farm-patrol-stops`, and supplied face outlines and colours through `farm-patrol-status`.
// The commands replace their own layers independently. Legacy stop-only commands keep
// their visited ticks; no route, status or field boundary is inferred here.
export const COMMAND = 'farm-patrol-stops';
export const STATUS_COMMAND = 'farm-patrol-status';
export const READY = 'farm-patrol-pins-ready';
const PIN_HEIGHT_M = 4;
const PIN_SCREEN_SIZE = 0.06; // fraction of the view height, so a pin reads the same at any zoom
const ROUTE_WIDTH_M = 3;
const ROUTE_LIFT_M = 0.25;
const TERRAIN_STEP_M = 2;
const DASH_ON_M = 4;
const DASH_PERIOD_M = 7;
const STATUS_LIFT_M = 0.3;
const STATUS_OUTLINE_WIDTH_M = 1.5;

function texture(THREE, marker, {planned = false, skipped = false, start = false} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2);
  const visited = !planned && marker.visited;
  g.fillStyle = visited ? '#2f8f46' : start ? (skipped ? '#858d94' : '#d9822b') : '#ffffff'; g.fill();
  g.lineWidth = 10; g.strokeStyle = visited || start ? '#ffffff' : skipped ? '#858d94' : '#d9822b'; g.stroke();
  g.fillStyle = visited || start ? '#ffffff' : '#1d1a12';
  g.font = `bold ${start ? 58 : 64}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(start ? '起' : visited ? `${marker.order}✓` : String(marker.order), 64, 68);
  const map = new THREE.CanvasTexture(canvas);
  if ('SRGBColorSpace' in THREE) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// The path is already selected and ordered in the canonical frame. Tessellation here only
// follows its straight segments closely enough to sample the viewer's ground beneath them.
function routeGeometry(THREE, api, path, skipped) {
  if (!Array.isArray(path) || path.length < 2 || !path.every(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lon))) return null;
  const points = path.map(p => api.geoToLocal(p.lat, p.lon));
  if (!points.every(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))) return null;
  const vertices = [];
  const height = (x, y) => {
    const ground = api.sampleGround(x, y);
    return (Number.isFinite(ground) ? ground : 0) + ROUTE_LIFT_M;
  };
  const triangle = (a, b, c) => vertices.push(...a, ...b, ...c);
  const quad = (ax, ay, bx, by) => {
    const length = Math.hypot(bx - ax, by - ay);
    if (length === 0) return;
    const ox = (by - ay) / length * ROUTE_WIDTH_M / 2;
    const oy = (ax - bx) / length * ROUTE_WIDTH_M / 2;
    const a = [ax + ox, ay + oy, height(ax + ox, ay + oy)];
    const b = [ax - ox, ay - oy, height(ax - ox, ay - oy)];
    const c = [bx + ox, by + oy, height(bx + ox, by + oy)];
    const d = [bx - ox, by - oy, height(bx - ox, by - oy)];
    triangle(a, b, c); triangle(b, d, c);
  };
  // Round joins close the wedge at bends without redirecting the authored route.
  const join = (x, y) => {
    const z = height(x, y), center = [x, y, z], count = 12;
    for (let i = 0; i < count; i++) {
      const angleA = i * Math.PI * 2 / count, angleB = (i + 1) * Math.PI * 2 / count;
      const ax = x + Math.cos(angleA) * ROUTE_WIDTH_M / 2, ay = y + Math.sin(angleA) * ROUTE_WIDTH_M / 2;
      const bx = x + Math.cos(angleB) * ROUTE_WIDTH_M / 2, by = y + Math.sin(angleB) * ROUTE_WIDTH_M / 2;
      triangle(center, [ax, ay, height(ax, ay)], [bx, by, height(bx, by)]);
    }
  };
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay);
    if (!length) continue;
    const drawInterval = (start, end) => {
      for (let distance = start; distance < end - 1e-8;) {
        const next = Math.min(end, distance + TERRAIN_STEP_M);
        const first = (distance - walked) / length, last = (next - walked) / length;
        quad(ax + (bx - ax) * first, ay + (by - ay) * first,
          ax + (bx - ax) * last, ay + (by - ay) * last);
        distance = next;
      }
    };
    const end = walked + length;
    if (skipped) {
      for (let cycle = Math.floor(walked / DASH_PERIOD_M); cycle * DASH_PERIOD_M < end; cycle++) {
        const start = Math.max(walked, cycle * DASH_PERIOD_M);
        const dashEnd = Math.min(end, cycle * DASH_PERIOD_M + DASH_ON_M);
        if (dashEnd > start) drawInterval(start, dashEnd);
      }
    } else drawInterval(walked, end);
    walked += length;
  }
  if (!skipped) for (const [x, y] of points) join(x, y);
  if (!vertices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

// Status outlines are authored typed-set geometry. Triangulation changes only how those
// supplied faces are drawn; it does not infer a field boundary or a simulation status.
function statusGeometry(THREE, api, outline) {
  if (!Array.isArray(outline) || outline.length < 3 ||
      !outline.every(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lon))) return null;
  const points = outline.map(p => api.geoToLocal(p.lat, p.lon));
  if (!points.every(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))) return null;
  if (points.length > 3 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points.pop();
  if (points.length < 3) return null;
  const triangles = THREE.ShapeUtils.triangulateShape(points.map(([x, y]) => new THREE.Vector2(x, y)), []);
  if (!triangles.length) return null;
  const height = (x, y) => {
    const ground = api.sampleGround(x, y);
    return (Number.isFinite(ground) ? ground : 0) + STATUS_LIFT_M;
  };
  const vertex = ([x, y]) => [x, y, height(x, y)];
  const fillVertices = [];
  for (const triangle of triangles) for (const index of triangle) fillVertices.push(...vertex(points[index]));
  const fill = new THREE.BufferGeometry();
  fill.setAttribute('position', new THREE.Float32BufferAttribute(fillVertices, 3));

  const outlineVertices = [];
  const pushTriangle = (a, b, c) => outlineVertices.push(...a, ...b, ...c);
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
    const length = Math.hypot(bx - ax, by - ay);
    if (!length) continue;
    const ox = (by - ay) / length * STATUS_OUTLINE_WIDTH_M / 2;
    const oy = (ax - bx) / length * STATUS_OUTLINE_WIDTH_M / 2;
    for (let distance = 0; distance < length - 1e-8;) {
      const next = Math.min(length, distance + TERRAIN_STEP_M);
      const first = distance / length, last = next / length;
      const x0 = ax + (bx - ax) * first, y0 = ay + (by - ay) * first;
      const x1 = ax + (bx - ax) * last, y1 = ay + (by - ay) * last;
      const a = [x0 + ox, y0 + oy, height(x0 + ox, y0 + oy)];
      const b = [x0 - ox, y0 - oy, height(x0 - ox, y0 - oy)];
      const c = [x1 + ox, y1 + oy, height(x1 + ox, y1 + oy)];
      const d = [x1 - ox, y1 - oy, height(x1 - ox, y1 - oy)];
      pushTriangle(a, b, c); pushTriangle(b, d, c);
      distance = next;
    }
    // A small round join closes the outside wedge without extending the authored edge.
    const center = [bx, by, height(bx, by)], count = 12;
    for (let step = 0; step < count; step++) {
      const angleA = step * Math.PI * 2 / count, angleB = (step + 1) * Math.PI * 2 / count;
      const x0 = bx + Math.cos(angleA) * STATUS_OUTLINE_WIDTH_M / 2;
      const y0 = by + Math.sin(angleA) * STATUS_OUTLINE_WIDTH_M / 2;
      const x1 = bx + Math.cos(angleB) * STATUS_OUTLINE_WIDTH_M / 2;
      const y1 = by + Math.sin(angleB) * STATUS_OUTLINE_WIDTH_M / 2;
      pushTriangle(center, [x0, y0, height(x0, y0)], [x1, y1, height(x1, y1)]);
    }
  }
  const ribbon = new THREE.BufferGeometry();
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(outlineVertices, 3));
  return {fill, ribbon};
}

export default function setup(api) {
  const {THREE} = api;
  // Patrol-only presentation choice: 2026-09-29-farm-patrol-map-focus.md.
  // Keep background place names from covering the numbered stops, including
  // deferred labels and later layer commands from the existing navigation panel.
  const placeLabels = new Map();
  const hidePlaceLabels = () => {
    for (const root of api.scene.children) {
      if (root.userData?.context_role !== 'supported-labels') continue;
      if (!placeLabels.has(root)) placeLabels.set(root, root.visible);
      root.visible = false;
    }
  };
  hidePlaceLabels();
  const stopHidingLabels = api.onFrame(hidePlaceLabels);
  const group = new THREE.Group();
  group.name = 'farm-patrol-pins';
  api.scene.add(group);
  const statusGroup = new THREE.Group();
  statusGroup.name = 'farm-patrol-status';
  api.scene.add(statusGroup);
  let owned = [];
  let statusOwned = [];
  const clear = () => {
    for (const {object, unregister, dispose} of owned) { unregister(); group.remove(object); dispose(); }
    owned = [];
  };
  const clearStatus = () => {
    for (const {object, geometry, material} of statusOwned) {
      statusGroup.remove(object); geometry.dispose(); material.dispose();
    }
    statusOwned = [];
  };
  const drawStatus = payload => {
    clearStatus();
    for (const face of Array.isArray(payload?.faces) ? payload.faces : []) {
      if (typeof face?.id !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(face.fill) ||
          !Number.isFinite(face.opacity) || face.opacity < 0 || face.opacity > 1) continue;
      const geometry = statusGeometry(THREE, api, face.outline);
      if (!geometry) continue;
      for (const [kind, shape, renderOrder, opacity] of [
        ['fill', geometry.fill, 800, face.opacity],
        ['outline', geometry.ribbon, 850, 1],
      ]) {
        const material = new THREE.MeshBasicMaterial({color: face.fill, side: THREE.DoubleSide,
          depthTest: false, depthWrite: false, transparent: true, opacity, toneMapped: false});
        const mesh = new THREE.Mesh(shape, material);
        mesh.name = `farm-patrol-status-${kind}-${face.id}`;
        mesh.renderOrder = renderOrder;
        mesh.raycast = () => {};
        statusGroup.add(mesh);
        statusOwned.push({object: mesh, geometry: shape, material});
      }
    }
  };
  const addPin = (marker, {planned, skipped, start} = {}) => {
    if (!Number.isFinite(marker?.lon) || !Number.isFinite(marker?.lat) || (!start && !Number.isFinite(marker?.order))) return;
    const [x, y] = api.geoToLocal(marker.lat, marker.lon);
    const ground = api.sampleGround(x, y);
    const z = Number.isFinite(ground) ? ground : 0;
    const pin = new THREE.Group();
    pin.name = start ? 'farm-patrol-start' : `farm-patrol-pin-${marker.order}`;
    const map = texture(THREE, marker, {planned, skipped, start});
    const material = new THREE.SpriteMaterial({map, depthTest: false, sizeAttenuation: false});
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(PIN_SCREEN_SIZE, PIN_SCREEN_SIZE, 1);
    sprite.position.set(x, y, z + PIN_HEIGHT_M);
    sprite.renderOrder = 1000;
    const stemGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, z + PIN_HEIGHT_M)]);
    const stemMaterial = new THREE.LineBasicMaterial({color: skipped ? 0x858d94 : !planned && marker.visited ? 0x2f8f46 : 0xd9822b, depthTest: false});
    const stem = new THREE.Line(stemGeometry, stemMaterial);
    stem.renderOrder = 999;
    pin.add(stem, sprite);
    group.add(pin);
    const properties = {lon: marker.lon, lat: marker.lat, visited: Boolean(!planned && marker.visited)};
    if (!start) properties.order = marker.order;
    const unregister = api.registerPickable(pin, {id: String(marker.id), label: String(marker.title || (start ? '巡田起點' : `巡田點 ${marker.order}`)),
      type: start ? 'patrol-start' : 'patrol-stop', properties});
    owned.push({object: pin, unregister, dispose: () => { map.dispose(); material.dispose(); stemGeometry.dispose(); stemMaterial.dispose(); }});
  };
  const draw = payload => {
    clear();
    const planned = Array.isArray(payload?.path) || payload?.start != null || payload?.style === 'suggested' || payload?.style === 'skipped';
    const skipped = payload?.style === 'skipped';
    const geometry = routeGeometry(THREE, api, payload?.path, skipped);
    if (geometry) {
      const material = new THREE.MeshBasicMaterial({color: skipped ? 0x858d94 : 0xf29a38,
        side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, opacity: skipped ? 0.8 : 0.95, toneMapped: false});
      const route = new THREE.Mesh(geometry, material);
      route.name = 'farm-patrol-route';
      route.renderOrder = 900;
      group.add(route);
      owned.push({object: route, unregister: () => {}, dispose: () => { geometry.dispose(); material.dispose(); }});
    }
    if (planned && payload?.start) addPin(payload.start, {planned, skipped, start: true});
    for (const stop of Array.isArray(payload?.stops) ? payload.stops : []) addPin(stop, {planned, skipped});
  };
  api.onDispose(() => {
    clear(); clearStatus(); api.scene.remove(group); api.scene.remove(statusGroup);
    stopHidingLabels();
    for (const [root, visible] of placeLabels) root.visible = visible;
  });
  api.onAppCommand((name, payload) => {
    if (name === COMMAND) draw(payload);
    else if (name === STATUS_COMMAND) drawStatus(payload);
  });
  // The host re-sends both current layers when it hears this (early commands are not kept).
  api.appEvent(READY, {});
}
