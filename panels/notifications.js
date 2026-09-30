// 通知: the current canonical frame's event occurrences, as the viewer's
// adapter labels them. The panel clock only chooses which frame to read; every
// event, label, route and target is read from that frame or the static
// snapshot, and nothing is computed, repaired or invented here.
import {canonicalAdapter, claimHighlight, el, frameIndexAt, noticeBar, ownsHighlight} from './farm-data.js';

const PATROL_KIND = 'patrol-route-proposal';
const tail = id => String(id).split(':').at(-1);

// Plain rows for one frame. `adapter.selectFrame` supplies the label text and
// the source ids; the frame supplies the patrol block; the snapshot supplies
// display labels, joined by stable id only.
export function notificationsFor({adapter, artifacts}, index) {
  const view = adapter.selectFrame(index);
  const frame = artifacts['composed-frames.json'].canonical_frames[index];
  const records = new Map(artifacts['static-snapshot.json'].static_merge.merged_topology_artifact.records
    .map(r => [r['@id'], r]));
  const label = id => records.get(id)?.display_label || records.get(id)?.name || tail(id);
  return view.notifications.map(n => {
    const event = frame.event_occurrences.find(e => e.occurrence_id === n.id);
    const row = {id: n.id, text: n.text, sourceIds: [...n.sourceIds]};
    if (event?.event_kind === PATROL_KIND) {
      const route = frame.patrol_route;
      row.patrol = route ? {
        memberIds: [...route.member_ids],
        route: route.member_ids.filter(id => records.get(id)?.['@type'] === 'Node').map(label),
        target: label(route.target_face_id),
      } : null;
    }
    return row;
  });
}

export function createNotificationsPanel({load = () => canonicalAdapter()} = {}) {
  return {
    id: 'farm-notifications', title: '通知', icon: '◔', defaultSize: {w: 4, h: 5},

    render(container, ctx) {
      const root = el('div', null, 'farm-panel');
      const when = el('output', '載入模擬事件…', 'farm-status');
      const list = el('ul', null, 'farm-list');
      const status = el('output', '', 'farm-status');
      root.append(noticeBar(), when, list, status);
      container.append(root);

      // A reset to t=0 clears the patrol route this panel drew, so frame 0
      // looks as it did before any click; a later selection or 標示 owns the
      // highlight instead and is left alone.
      let candidate = null, shown = null, t = 0;
      const show = () => {
        if (!candidate) return;
        const index = frameIndexAt(candidate.adapter.frameTimesSeconds, t);
        if (index === shown) return;
        shown = index;
        const view = candidate.adapter.selectFrame(index);
        const seconds = candidate.adapter.frameTimesSeconds[index];
        when.textContent = view.date ? `模擬日期 ${view.date} · 第 ${index + 1} 日`
          : `模擬時間 ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} · 第 ${index + 1} 格`;
        const rows = notificationsFor(candidate, index);
        list.replaceChildren();
        if (!rows.length) list.append(el('li', '本影格沒有事件', 'farm-caption'));
        for (const row of rows) {
          const li = el('li', null, 'farm-notification');
          li.dataset.occurrenceId = row.id;
          li.title = row.id;
          li.append(el('strong', row.text), el('span', `出處：${row.sourceIds.map(tail).join('、') || '—'}`, 'farm-caption'));
          if (row.patrol) {
            li.append(el('span', `路線：${row.patrol.route.join(' → ')}`, 'farm-caption'),
              el('span', `目標田區：${row.patrol.target}`, 'farm-caption'));
            const mark = el('button', '在地圖標示路線', 'farm-button');
            mark.type = 'button';
            mark.onclick = () => {
              const sent = ctx.map.send('highlight', {ids: row.patrol.memberIds});
              status.textContent = sent ? '已送出：標示巡田路線' : '地圖不接受此指令，未送出';
              if (sent) claimHighlight(PATROL_KIND);
            };
            li.append(mark);
          } else if ('patrol' in row) {
            li.append(el('span', '本影格未提供巡田路線', 'farm-caption'));
          }
          list.append(li);
        }
      };
      // panel-core moves the map highlight to a map selection.
      ctx.map.subscribe('select', ({entity} = {}) => { if (entity) claimHighlight('map-selection'); });
      ctx.map.subscribe('time', ({t: next} = {}) => {
        if (!Number.isFinite(next)) return;
        if (next === 0 && t !== 0 && ownsHighlight(PATROL_KIND)) {
          ctx.map.send('highlight', {ids: []});
          claimHighlight(null);
          status.textContent = '';
        }
        t = next; show();
      });
      const ready = load().then(loaded => { candidate = loaded; show(); })
        .catch(error => { when.textContent = `無法載入模擬事件：${error.message}`; });
      return {root, ready};
    },

    update() {},
    describeForAI() {
      return {schemaVersion: 1, kind: 'farm-notifications', visibleFields: ['frame', 'events', 'sources', 'patrol-route'],
        summary: '目前影格的模擬事件通知與出處；巡田路線為 AI 提案（模擬），非操作建議。'};
    },
    dispose(view) { view.root.remove(); },
  };
}

export const notificationsPanel = createNotificationsPanel();
