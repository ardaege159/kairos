// Kairos Phase 0 spike: verify free public data sources. Read-only GETs/POST-search, no keys.
const UA = 'KairosPersonalResearch/0.1 (personal non-commercial project)';
const out = {};
const t = async (name, fn) => {
  const t0 = Date.now();
  try { out[name] = { ok: true, ms: 0, ...(await fn()) }; }
  catch (e) { out[name] = { ok: false, error: String(e.message || e).slice(0, 300) }; }
  if (out[name].ms === 0) out[name].ms = Date.now() - t0;
};
const get = async (url, headers = {}) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate', ...headers } });
  const text = await r.text();
  return { status: r.status, text, ct: r.headers.get('content-type') };
};

await t('sec_ticker_map', async () => {
  const r = await get('https://www.sec.gov/files/company_tickers.json');
  if (r.status !== 200) return { status: r.status, body: r.text.slice(0, 200) };
  const j = JSON.parse(r.text);
  const rows = Object.values(j);
  const aapl = rows.find(x => x.ticker === 'AAPL');
  return { status: 200, count: rows.length, sample: aapl };
});

await t('sec_frames_Revenues_CY2024Q1', async () => {
  const r = await get('https://data.sec.gov/api/xbrl/frames/us-gaap/Revenues/USD/CY2024Q1.json');
  if (r.status !== 200) return { status: r.status, body: r.text.slice(0, 200) };
  const j = JSON.parse(r.text);
  return { status: 200, count: j.data.length, first: j.data[0] };
});

await t('sec_frames_RevenueFromContract_CY2024Q1', async () => {
  const r = await get('https://data.sec.gov/api/xbrl/frames/us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax/USD/CY2024Q1.json');
  if (r.status !== 200) return { status: r.status, body: r.text.slice(0, 200) };
  const j = JSON.parse(r.text);
  return { status: 200, count: j.data.length };
});

await t('sec_companyfacts_AAPL', async () => {
  const r = await get('https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json');
  if (r.status !== 200) return { status: r.status, body: r.text.slice(0, 200) };
  const j = JSON.parse(r.text);
  const tags = Object.keys(j.facts['us-gaap']);
  const eps = j.facts['us-gaap'].EarningsPerShareDiluted?.units?.['USD/shares']?.slice(-3);
  return { status: 200, bytes: r.text.length, usgaapTags: tags.length, hasRevContract: tags.includes('RevenueFromContractWithCustomerExcludingAssessedTax'), hasRevenues: tags.includes('Revenues'), epsLast3: eps };
});

await t('usaspending_awards', async () => {
  const body = {
    filters: { award_type_codes: ['A', 'B', 'C', 'D'], time_period: [{ start_date: '2025-10-01', end_date: '2026-09-30' }], recipient_search_text: ['Lockheed Martin'] },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date'],
    limit: 3, page: 1, sort: 'Award Amount', order: 'desc',
  };
  const r = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA }, body: JSON.stringify(body) });
  const text = await r.text();
  if (r.status !== 200) return { status: r.status, body: text.slice(0, 300) };
  const j = JSON.parse(text);
  return { status: 200, results: j.results };
});

await t('gdelt_doc_oil', async () => {
  const u = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent('oil prices') + '&mode=artlist&maxrecords=5&format=json&timespan=1d';
  const r = await get(u);
  if (r.status !== 200) return { status: r.status, body: r.text.slice(0, 200) };
  let j; try { j = JSON.parse(r.text); } catch { return { status: 200, nonJson: r.text.slice(0, 200) }; }
  return { status: 200, n: j.articles?.length, fields: Object.keys(j.articles?.[0] || {}), sample: j.articles?.[0]?.title };
});

console.log(JSON.stringify(out, null, 2));
