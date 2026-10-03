// 田區導覽: drives the map over panel-core.map (flyTo, highlight, setLayers)
// and relays the map's own selection. It sends commands and repeats what the
// map reports; it never derives frame state.
import {claimHighlight, el, managedFaces, noticeBar, phoneCopy} from './farm-data.js';
import {mapLayers} from './map-layers.js';

export const fieldNavigationPanel = {
  id: 'field-navigation', title: '田區導覽', icon: '⌖', defaultSize: {w: 4, h: 7},

  render(container, ctx) {
    const root = el('div', null, 'farm-panel');
    const status = el('output', '等待地圖就緒…', 'farm-status');
    const selection = el('output', '地圖選取：無', 'farm-selection');
    const faces = el('ul', null, 'farm-list');
    const layers = el('div', null, 'farm-layers');
    const clear = el('button', '清除標示', 'farm-button');
    clear.type = 'button';
    root.append(noticeBar(), el('h3', '田區'), faces, clear, el('h3', '圖層', 'farm-layers-heading'), layers,
      el('h3', '地圖選取', 'farm-selection-heading'), selection, status);
    container.append(root);

    // panel-core queues commands until the map is ready and returns false
    // only when the map cannot take the command at all.
    const send = (type, payload, done) => {
      const queued = !ctx.map.readyInfo;
      const sent = ctx.map.send(type, payload);
      status.textContent = !sent ? '地圖不接受此指令，未送出' : queued ? `地圖尚未就緒，已排入：${done.replace(/^已送出：/, '')}` : done;
      return sent;
    };
    let highlighted = null;
    const markRows = () => {
      for (const li of faces.children) li.classList.toggle('is-highlighted', li.dataset.faceId === highlighted);
    };

    managedFaces(ctx.loadCandidate).then(list => {
      for (const face of list) {
        const li = el('li', null, 'farm-row');
        li.dataset.faceId = face.id;
        const fly = el('button', '飛到', 'farm-button'), mark = el('button', '標示', 'farm-button');
        const pick = el('button', '選取', 'farm-button');
        fly.type = mark.type = pick.type = 'button';
        if (globalThis.matchMedia?.('(max-width: 767px)').matches)
          pick.setAttribute('aria-label', `選取${phoneCopy(face.label)}`);
        fly.onclick = () => send('flyTo', {target: {id: face.id}}, `已送出：飛到 ${face.label}`);
        mark.onclick = () => {
          if (send('highlight', {ids: [face.id]}, `已送出：標示 ${face.label}`)) { highlighted = face.id; markRows(); claimHighlight('field-navigation'); }
        };
        li.append(el('span', face.label, 'farm-label'));
        if (face.crop) li.append(el('span', `${face.crop}（模擬）`, 'farm-crop'));
        // panel-core selects it (選取項目 shows its crop rows), flies to it and highlights it.
        pick.onclick = () => {
          ctx.focusEntity(face.id); status.textContent = `已選取：${face.label}`; highlighted = face.id; markRows();
          claimHighlight('field-navigation');
        };
        li.append(fly, mark, pick);
        if (!globalThis.matchMedia?.('(max-width: 767px)').matches) li.title = face.id;
        faces.append(li);
      }
    }).catch(error => { status.textContent = `無法載入田區清單：${error.message}`; });

    clear.onclick = () => {
      if (send('highlight', {ids: []}, '已送出：清除標示')) { highlighted = null; markRows(); claimHighlight('field-navigation'); }
    };

    // Layer visibility belongs to the shared map-layers store; this list is one view of it.
    const renderLayers = () => {
      layers.replaceChildren();
      for (const layer of mapLayers.list()) {
        const label = el('label', null, 'farm-toggle'), box = el('input');
        box.type = 'checkbox';
        box.checked = layer.visible;
        box.dataset.layerId = layer.id;
        box.onchange = () => {
          if (mapLayers.set(layer.id, box.checked)) status.textContent = `已送出：${layer.label}${box.checked ? '顯示' : '隱藏'}`;
          else { box.checked = !box.checked; status.textContent = '地圖不接受此指令，未送出'; }
        };
        label.append(box, el('span', layer.label));
        layers.append(label);
      }
    };
    const stopLayers = mapLayers.subscribe(renderLayers);
    renderLayers();
    ctx.map.subscribe('ready', () => {
      highlighted = null; markRows();
      status.textContent = '地圖已就緒';
    });
    ctx.map.subscribe('select', ({entity} = {}) => {
      // The viewer moves its highlight box to a map selection, so the
      // panel's own marker no longer describes what the map shows.
      if (entity) { highlighted = null; markRows(); }
      selection.textContent = entity ? `地圖選取：${entity.label || entity.id}（${entity.id}）` : '地圖選取：無';
      selection.title = entity?.id || '';
      selection.dataset.entityId = entity?.id || '';
    });
    return {root, stopLayers};
  },

  update() {},
  describeForAI() {
    return {schemaVersion: 1, kind: 'farm-field-navigation', visibleFields: ['fields', 'layers', 'selection'],
      summary: '模擬田區清單與地圖圖層控制；只轉述地圖回報的選取，無即時資料，非操作建議。'};
  },
  dispose(view) { view.stopLayers?.(); view.root.remove(); },
};
