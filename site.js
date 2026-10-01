// Site-owned configuration is injected by the launcher/static builder before app modules load.
// Runtime data still enters exclusively through DT's verified canonical candidate loader.
export const FARM_SITE = {site_id: 'farm', static_mount: 'farm', canonical_mount: 'farm-canonical'};

export function siteFrom(search = globalThis.location?.search, deployment = globalThis.FARM_DEPLOYMENT) {
  const configured = deployment?.siteConfig;
  const requested = new URLSearchParams(search || '').get('site');
  if (!requested || requested === configured?.site_id) return configured || FARM_SITE;
  if (requested === 'farm') return FARM_SITE;
  throw new Error(`未宣告的站點「${requested}」。依據 2026-09-30 A2 brief，站點必須使用自己宣告的設定與候選資料。`);
}

export function siteNotices(site = siteFrom()) {
  return site.site_id === 'farm' ? ['本示範資料皆為模擬', '僅供原型展示，非農場操作建議'] : site.notices || [];
}
