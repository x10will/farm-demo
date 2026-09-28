// The demonstration scenario this page plays, from its own URL: ?scenario=pest|patrol, none = 總覽.
// A page plays exactly one scenario; choosing another reloads the page into it, so the clock,
// the playback state and the notifications of two scenarios never share a page.
// Source: lane design 2026-09-28, on Will's instruction the same day: "hmm. the use cases are not
// clear. 巡田 is a feature, identify pest spread is another".

// Who asked for scenarios to stay apart; every refusal that protects that says so.
export const SCENARIO_AUTHORITY = '（依據：Will 2026-09-28 指示「巡田 is a feature, identify pest spread is another」，各情境各自獨立。）';

// Each scenario is its own baked canonical candidate, mounted beside the overview one.
export const SCENARIOS = [
  {id: 'overview', param: null, title: '總覽', mount: 'farm-canonical'},
  {id: 'patrol', param: 'patrol', title: '巡田', mount: 'farm-canonical-patrol'},
  {id: 'pest', param: 'pest', title: '病蟲害擴散', mount: 'farm-canonical-pest'},
];

// {scenario} for a declared value, {error} for anything else. An undeclared value is refused
// rather than played as the overview, so a mistyped link cannot pass for the scenario it named.
export function scenarioFrom(search) {
  const params = new URLSearchParams(search || '');
  if (!params.has('scenario')) return {scenario: SCENARIOS[0]};
  const value = params.get('scenario');
  const scenario = SCENARIOS.find(s => s.param !== null && s.param === value);
  if (scenario) return {scenario};
  return {error: `不認得的情境「${value}」：只提供 ${SCENARIOS.filter(s => s.param).map(s => s.param).join('、')}（或不指定，即總覽）。`
    + '為避免把錯誤的連結當成另一個情境播放，本頁不載入任何情境資料。' + SCENARIO_AUTHORITY};
}

export const current = scenarioFrom(globalThis.location?.search);

// The page URL for another scenario: this page's own URL with only ?scenario= changed.
export function scenarioHref(scenario, href = globalThis.location?.href) {
  const url = new URL(href);
  if (scenario.param) url.searchParams.set('scenario', scenario.param);
  else url.searchParams.delete('scenario');
  return url.href;
}
