// The URL names a use case; a deployed catalogue selects the exact replayable variant.
// Will's 2026-09-29 correction requires independent patrol and pest simulations.
export const SCENARIO_AUTHORITY = '（依據：Will 2026-09-29 指示「不是，這是兩個模擬，你要把蟲害跟巡田分開啊，他本來就不應該一個panel」；本原型以可追溯的模擬資料示範。）';

export const SCENARIOS = [
  {id: 'overview', param: null, title: '農場導覽', mount: 'farm-canonical'},
  {id: 'patrol', param: 'patrol', title: '巡田', mount: 'farm-canonical-patrol-calendar'},
  {id: 'pest', param: 'pest', title: '病蟲害擴散', mount: 'farm-canonical-pest'},
];

export const LEGACY_CATALOGUE = {
  use_cases: SCENARIOS.map(s => ({use_case_id: s.id, title: s.title,
    default_variant_id: s.id === 'patrol' ? null : s.id})),
  variants: SCENARIOS.filter(s => s.id !== 'patrol').map(s => ({use_case_id: s.id, variant_id: s.id,
    canonical_id: s.id, title: s.title, role: s.id, view_kind: s.id, mount: s.mount})),
  unavailable: [{use_case_id: 'patrol', variant_id: 'patrol-calendar', reason: 'missing-candidate'}],
};

export const scenarioCatalogue = () => globalThis.FARM_DEPLOYMENT?.scenarioCatalogue || LEGACY_CATALOGUE;

export function resolveScenario(search, catalogue = scenarioCatalogue()) {
  const params = new URLSearchParams(search || '');
  const useCaseId = params.has('scenario') ? params.get('scenario') : 'overview';
  const useCase = catalogue.use_cases?.find(row => row.use_case_id === useCaseId);
  if (!useCase || (params.has('scenario') && useCaseId === 'overview')) {
    return {kind: 'unknown', error: `不認得的情境「${useCaseId}」；為避免把錯誤連結當成另一個情境播放，本頁不載入情境資料。${SCENARIO_AUTHORITY}`};
  }
  const variantId = params.has('variant') ? params.get('variant') : useCase.default_variant_id;
  if (!variantId) return {kind: 'unavailable', error: `情境「${useCaseId}」在此版本沒有可播放的預設候選；保護候選資料與來源一致性。${SCENARIO_AUTHORITY}`};
  const variant = catalogue.variants?.find(row => row.variant_id === variantId);
  if (variant && variant.use_case_id !== useCaseId) return {kind: 'mismatch', error:
    `候選「${variantId}」屬於「${variant.use_case_id}」，不屬於「${useCaseId}」；保護情境與來源一致性。${SCENARIO_AUTHORITY}`};
  if (!variant) {
    const absent = catalogue.unavailable?.find(row => row.use_case_id === useCaseId && row.variant_id === variantId);
    return absent ? {kind: 'unavailable', error: `候選「${variantId}」在此版本不可用（${absent.reason}）；保護候選資料與來源一致性。${SCENARIO_AUTHORITY}`}
      : {kind: 'unknown', error: `不認得的候選「${variantId}」；為避免播放另一個故事，本頁不載入情境資料。${SCENARIO_AUTHORITY}`};
  }
  return {useCase, variant};
}

export function scenarioFrom(search, catalogue = scenarioCatalogue()) {
  const result = resolveScenario(search, catalogue);
  if (result.error) return result;
  const {useCase, variant} = result;
  return {...result, scenario: {id: variant.variant_id, useCaseId: useCase.use_case_id,
    viewKind: variant.view_kind, title: variant.title, mount: variant.mount, role: variant.role,
    canonicalId: variant.canonical_id, manifest: variant.manifest,
    param: useCase.use_case_id === 'overview' ? null : useCase.use_case_id}};
}

export const current = scenarioFrom(globalThis.location?.search);

// A different use case loses the old variant. Independent date/off and pestFrame
// fields remain on the link so a page reload restores both simulations' positions.
export function scenarioHref(useCaseId, variantId, href = globalThis.location?.href, catalogue = scenarioCatalogue()) {
  // Preserve the original helper signature used by legacy callers.
  if (typeof useCaseId === 'object') {
    href = variantId || href;
    variantId = undefined;
    useCaseId = useCaseId.id;
  }
  const url = new URL(href);
  const previous = url.searchParams.get('scenario') || 'overview';
  if (useCaseId === 'overview') url.searchParams.delete('scenario');
  else url.searchParams.set('scenario', useCaseId);
  if (variantId !== undefined) {
    const defaultId = catalogue.use_cases?.find(row => row.use_case_id === useCaseId)?.default_variant_id;
    if (variantId === defaultId) url.searchParams.delete('variant');
    else url.searchParams.set('variant', variantId);
  } else if (previous !== useCaseId) url.searchParams.delete('variant');
  return url.href;
}
