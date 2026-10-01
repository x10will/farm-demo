import {frameIndexAt} from './farm-data.js';

// The replay-clock label for a baked patrol frame. Phone shows M/D · 第N日, desktop the full
// date; both read the frame's own patrol_day, nothing is computed here.
export function patrolClockLabel(patrolDay, phone) {
  const {date, day_number: day} = patrolDay;
  return phone ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} · 第${day}日` : date;
}

// The verified schedule supplies dates and clock offsets. The lookup supplies only IDs;
// all displayed attendance, field statuses and comparisons remain in canonical frames.
export function createPatrolCalendarController({schedule, lookup, frameTimesSeconds,
  page = globalThis.location, replaceState = (url) => globalThis.history?.replaceState(null, '', url),
  clearSelection = () => {}} = {}) {
  const dates = schedule.dates;
  const editable = new Set(schedule.editable_dates);
  const schedules = new Map(lookup.schedules.map(row => [row.schedule_key, row]));
  const params = new URLSearchParams(page?.search || '');
  const requestedDate = params.get('date');
  const requestedOff = params.get('off');
  let date = requestedDate || schedule.initial_date;
  let offDates = requestedOff ? requestedOff.split(',') : [];
  let error = null;
  if (!dates.includes(date)) error = `無法使用日期「${date}」；此模擬日曆只提供 ${dates[0]} 至 ${dates.at(-1)}。`;
  else if (offDates.some(value => !editable.has(value)) || new Set(offDates).size !== offDates.length)
    error = `無法使用休巡日期「${requestedOff}」；只能選擇日曆中今日與未來的日期。`;
  offDates = [...offDates].sort();
  if (!error && !schedules.has(offDates.join('|')))
    error = `休巡組合「${requestedOff}」沒有已驗證的模擬結果。`;

  const listeners = new Set();
  let clock = null;
  let unclock = null;
  let suppressClock = false;
  let resetVersion = 0;
  const selection = () => {
    const key = offDates.join('|');
    const scheduleRow = error ? null : schedules.get(key);
    return {date: error ? null : date, offDates: [...offDates], scheduleKey: key,
      scheduleRow, dayRef: scheduleRow?.days.find(row => row.date === date) || null,
      error, index: dates.indexOf(date), resetVersion};
  };
  const emit = () => { for (const listener of listeners) listener(selection()); };
  const saveUrl = () => {
    if (error || !page?.href) return;
    const url = new URL(page.href);
    url.searchParams.set('date', date);
    if (offDates.length) url.searchParams.set('off', offDates.join(','));
    else url.searchParams.delete('off');
    replaceState(url.href);
  };
  const onClock = time => {
    if (suppressClock || error) return;
    const next = dates[frameIndexAt(frameTimesSeconds, time)];
    if (next !== date) { date = next; saveUrl(); emit(); }
  };
  const seek = value => {
    if (!clock) return;
    clock.pause();
    clock.seek(frameTimesSeconds[dates.indexOf(value)] * 1000);
  };
  return {
    get schedule() { return schedule; },
    getSelection: selection,
    subscribe(listener) { listeners.add(listener); listener(selection()); return () => listeners.delete(listener); },
    attachClock(nextClock) {
      unclock?.();
      clock = nextClock;
      clock.pause();
      suppressClock = true;
      unclock = clock.subscribe(onClock);
      clock.seek(frameTimesSeconds[dates.indexOf(error ? schedule.initial_date : date)] * 1000);
      suppressClock = false;
      emit();
    },
    selectDate(value) {
      if (!dates.includes(value)) return false;
      if (error) return false;
      date = value;
      saveUrl();
      seek(value);
      emit();
      return true;
    },
    setDayOff(value, checked) {
      if (error || !editable.has(value)) return false;
      const next = [...new Set(checked ? [...offDates, value] : offDates.filter(day => day !== value))].sort();
      if (!schedules.has(next.join('|'))) return false;
      offDates = next;
      saveUrl();
      emit();
      return true;
    },
    reset() {
      error = null;
      offDates = [];
      date = schedule.initial_date;
      resetVersion += 1;
      clearSelection();
      saveUrl();
      seek(date);
      emit();
    },
    dispose() { unclock?.(); listeners.clear(); },
  };
}
