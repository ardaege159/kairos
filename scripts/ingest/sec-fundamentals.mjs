// Ingest S&P 500 companies + quarterly fundamentals from SEC XBRL frames into Supabase.
//   node --env-file=.env.local scripts/ingest/sec-fundamentals.mjs            (writes to Supabase)
//   node --env-file=.env.local scripts/ingest/sec-fundamentals.mjs --dry      (no DB; prints a summary)
// Needs SUPABASE_SECRET_KEY for writes. Frames return one value per filer per calendar period;
// flows use CYyyyyQn (3-month), balances use CYyyyyQnI (instant). Missing Q4 flows are derived
// as annual (CYyyyy) minus Q1..Q3.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseCsv } from '../lib-csv.mjs';

const DRY = process.argv.includes('--dry');
const QUARTERS = Number(process.argv.find(a => a.startsWith('--quarters='))?.split('=')[1] ?? 12);
const UA = 'Kairos personal research (non-commercial)';

// metric -> ordered tag candidates (first tag that has a value wins)
const FLOWS = {
  revenue: [['us-gaap', 'Revenues', 'USD'], ['us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'USD'], ['us-gaap', 'SalesRevenueNet', 'USD']],
  gross_profit: [['us-gaap', 'GrossProfit', 'USD']],
  operating_income: [['us-gaap', 'OperatingIncomeLoss', 'USD']],
  net_income: [['us-gaap', 'NetIncomeLoss', 'USD']],
  eps_diluted: [['us-gaap', 'EarningsPerShareDiluted', 'USD-per-shares']],
};
const INSTANTS = {
  assets: [['us-gaap', 'Assets', 'USD']],
  liabilities: [['us-gaap', 'Liabilities', 'USD']],
  equity: [['us-gaap', 'StockholdersEquity', 'USD'], ['us-gaap', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'USD']],
  current_assets: [['us-gaap', 'AssetsCurrent', 'USD']],
  current_liabilities: [['us-gaap', 'LiabilitiesCurrent', 'USD']],
  cash: [['us-gaap', 'CashAndCashEquivalentsAtCarryingValue', 'USD']],
  long_term_debt: [['us-gaap', 'LongTermDebtNoncurrent', 'USD'], ['us-gaap', 'LongTermDebt', 'USD']],
  shares_outstanding: [['dei', 'EntityCommonStockSharesOutstanding', 'shares'], ['us-gaap', 'CommonStockSharesOutstanding', 'shares']],
};
const UNIT_LABEL = { USD: 'USD', 'USD-per-shares': 'USD/shares', shares: 'shares' };
const DERIVABLE = new Set(['revenue', 'gross_profit', 'operating_income', 'net_income']);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastCall = 0;
async function secJson(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wait = 130 - (Date.now() - lastCall); // stay under SEC's 10 req/s
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
      if (r.status === 404) return null; // frame not published for this period/tag
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) throw new Error(`HTTP ${r.status} ${url}`);
    } catch (e) {
      if (attempt === 4) throw e;
    }
    await sleep(1000 * attempt);
  }
}

function recentQuarters(n) {
  // Latest fully-ended calendar quarter that SEC has likely published (filings lag ~45 days).
  const now = new Date(Date.now() - 45 * 864e5);
  let y = now.getUTCFullYear(), q = Math.floor(now.getUTCMonth() / 3); // q: 0..3 -> previous quarter index
  if (q === 0) { y -= 1; q = 4; }
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ y, q });
    q -= 1; if (q === 0) { q = 4; y -= 1; }
  }
  return out.reverse();
}

const readList = (file) => parseCsv(readFileSync(new URL(`../../data/${file}`, import.meta.url), 'utf8'));
const sp500 = readList('sp500-constituents.csv');
const sp500Tickers = new Set(sp500.map(c => c.Symbol));
// Owner-tracked tickers outside the index (data/extra-tickers.csv); skipped if already in the S&P 500.
const extras = readList('extra-tickers.csv').filter(c => !sp500Tickers.has(c.Symbol));
const companies = [...sp500, ...extras];
const ciks = new Set(companies.map(c => Number(c.CIK)));
const quarters = recentQuarters(QUARTERS);
const rows = new Map(); // key cik|period|metric -> row
const put = (row) => rows.set(`${row.cik}|${row.period}|${row.metric}`, row);
const stats = { requests: 0, frames404: 0 };

async function loadFrame(taxonomy, tag, unit, period) {
  stats.requests++;
  const j = await secJson(`https://data.sec.gov/api/xbrl/frames/${taxonomy}/${tag}/${unit}/${period}.json`);
  if (!j) stats.frames404++;
  return (j?.data ?? []).filter(d => ciks.has(d.cik));
}

async function collect(metric, candidates, period, storedPeriod, instant) {
  for (const [taxonomy, tag, unit] of candidates) {
    for (const d of await loadFrame(taxonomy, tag, unit, period)) {
      const key = `${d.cik}|${storedPeriod}|${metric}`;
      if (rows.has(key)) continue; // an earlier (preferred) tag already supplied it
      rows.set(key, {
        cik: d.cik, period: storedPeriod, metric, value: d.val, unit: UNIT_LABEL[unit],
        period_start: instant ? null : d.start ?? null, period_end: d.end, source_tag: `${taxonomy}:${tag}`, accn: d.accn ?? null,
      });
    }
  }
}

const started = Date.now();
for (const { y, q } of quarters) {
  const p = `CY${y}Q${q}`;
  for (const [metric, cands] of Object.entries(FLOWS)) await collect(metric, cands, p, p, false);
  for (const [metric, cands] of Object.entries(INSTANTS)) await collect(metric, cands, `${p}I`, p, true);
  process.stdout.write(`${p} ✓  rows=${rows.size}\n`);
}

// Fiscal Q4 is usually only reported inside the 10-K annual total, so it is missing from the
// 3-month frames. Derive it: annual minus the three preceding quarters. The fiscal year can end
// in any month (Apple: September, Walmart: January), so locate the missing quarter from the
// annual period's end date (shifted back 45 days so a Jan 31 year-end maps to calendar Q4).
const quarterOf = (isoDate) => {
  const d = new Date(Date.parse(isoDate) - 45 * 864e5);
  return { y: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) + 1 };
};
const prevQuarter = ({ y, q }) => (q === 1 ? { y: y - 1, q: 4 } : { y, q: q - 1 });
const inRange = new Set(quarters.map(x => `CY${x.y}Q${x.q}`));
const years = [...new Set(quarters.map(x => x.y)), quarters.at(-1).y + 1];
let derived = 0;
for (const y of years) {
  for (const metric of Object.keys(FLOWS).filter(m => DERIVABLE.has(m))) {
    const annual = new Map();
    for (const [taxonomy, tag, unit] of FLOWS[metric]) {
      for (const d of await loadFrame(taxonomy, tag, unit, `CY${y}`)) if (!annual.has(d.cik)) annual.set(d.cik, { ...d, tag: `${taxonomy}:${tag}`, unit });
    }
    for (const [cik, a] of annual) {
      const last = quarterOf(a.end);
      const target = `CY${last.y}Q${last.q}`;
      if (!inRange.has(target) || rows.has(`${cik}|${target}|${metric}`)) continue;
      const parts = [];
      for (let p = prevQuarter(last), i = 0; i < 3; p = prevQuarter(p), i++) parts.push(rows.get(`${cik}|CY${p.y}Q${p.q}|${metric}`));
      if (parts.some(x => !x)) continue;
      put({ cik, period: target, metric, value: a.val - parts.reduce((s, x) => s + Number(x.value), 0), unit: UNIT_LABEL[a.unit],
        period_start: null, period_end: a.end, source_tag: `derived:${a.tag}`, accn: a.accn ?? null });
      derived++;
    }
  }
}

const all = [...rows.values()];
const coverage = {};
for (const r of all) (coverage[r.metric] ??= new Set()).add(r.cik);
const summary = {
  quarters: `${quarters[0].y}Q${quarters[0].q}..${quarters.at(-1).y}Q${quarters.at(-1).q}`,
  issuers: ciks.size, rows: all.length, derivedQ4: derived, ...stats, seconds: Math.round((Date.now() - started) / 1000),
  coverage: Object.fromEntries(Object.entries(coverage).map(([k, v]) => [k, v.size])),
};
console.log(JSON.stringify(summary, null, 2));

if (DRY) {
  const dir = process.env.KAIROS_DRY_DIR ?? 'scripts/ingest/.dry';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/sample-aapl.json`, JSON.stringify(all.filter(r => r.cik === 320193), null, 2));
  console.log(`dry run: wrote ${dir}/sample-aapl.json`);
  process.exit(0);
}

const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!secret) { console.error('SUPABASE_SECRET_KEY eksik (.env.local). Yazma yapılmadı.'); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secret, { auth: { persistSession: false } });

const { data: run } = await db.from('ingest_runs').insert({ source: 'sec_frames' }).select('id').single();
try {
  const companyRows = companies.map(c => ({
    ticker: c.Symbol, cik: Number(c.CIK), name: c.Security, sector: c['GICS Sector'], sub_industry: c['GICS Sub-Industry'] || null,
    added_to_index: /^\d{4}-\d{2}-\d{2}/.test(c['Date added'] ?? '') ? c['Date added'].slice(0, 10) : null,
    in_sp500: sp500Tickers.has(c.Symbol), updated_at: new Date().toISOString(),
  }));
  let e = (await db.from('companies').upsert(companyRows, { onConflict: 'ticker' })).error;
  if (e) throw e;
  e = (await db.from('companies').delete().not('ticker', 'in', `(${companyRows.map(c => `"${c.ticker}"`).join(',')})`)).error;
  if (e) throw e;
  for (let i = 0; i < all.length; i += 1000) {
    const batch = all.slice(i, i + 1000).map(r => ({ ...r, fetched_at: new Date().toISOString() }));
    const { error } = await db.from('fundamentals_quarterly').upsert(batch, { onConflict: 'cik,period,metric' });
    if (error) throw error;
  }
  await db.from('ingest_runs').update({ status: 'ok', finished_at: new Date().toISOString(), detail: summary }).eq('id', run.id);
  console.log(`yazıldı: ${companyRows.length} şirket, ${all.length} bilanço satırı`);
} catch (err) {
  await db.from('ingest_runs').update({ status: 'error', finished_at: new Date().toISOString(), detail: { ...summary, error: String(err.message ?? err) } }).eq('id', run?.id);
  console.error('HATA:', err.message ?? err);
  process.exit(1);
}
