// Load daily split-adjusted bars for all S&P 500 tickers from Alpaca (SIP feed; free plan
// allows history up to ~15 min ago) into public.prices_daily.
//   node --env-file=.env.local scripts/ingest/alpaca-prices.mjs [--days=400]
import { createClient } from '@supabase/supabase-js';

const DAYS = Number(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] ?? 400);
const CHUNK = 50; // symbols per request
const { ALPACA_API_KEY_ID, ALPACA_API_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!ALPACA_API_KEY_ID || !ALPACA_API_SECRET_KEY || !SUPABASE_SECRET_KEY) {
  console.error('ALPACA_API_KEY_ID, ALPACA_API_SECRET_KEY ve SUPABASE_SECRET_KEY gerekli (.env.local).');
  process.exit(1);
}
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.trim(), { auth: { persistSession: false } });
const headers = { 'APCA-API-KEY-ID': ALPACA_API_KEY_ID.trim(), 'APCA-API-SECRET-KEY': ALPACA_API_SECRET_KEY.trim() };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function alpaca(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(url, { headers });
    if (r.ok) return r.json();
    if (r.status !== 429 && r.status < 500) throw new Error(`Alpaca HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    await sleep(1500 * attempt);
  }
  throw new Error('Alpaca: tekrar denemeler tükendi');
}

const { data: companies, error } = await db.from('companies').select('ticker').order('ticker');
if (error) throw error;
const tickers = companies.map(c => c.ticker);
const start = new Date(Date.now() - DAYS * 864e5).toISOString();
const end = new Date(Date.now() - 20 * 60e3).toISOString(); // free plan: no data from the last 15 minutes

const { data: run } = await db.from('ingest_runs').insert({ source: 'alpaca_bars' }).select('id').single();
let bars = 0, requests = 0;
const missing = new Set(tickers);
try {
  for (let i = 0; i < tickers.length; i += CHUNK) {
    const symbols = tickers.slice(i, i + CHUNK);
    const rows = [];
    let page;
    do {
      const u = new URL('https://data.alpaca.markets/v2/stocks/bars');
      u.search = new URLSearchParams({ symbols: symbols.join(','), timeframe: '1Day', start, end, limit: '10000',
        feed: 'sip', adjustment: 'split', ...(page ? { page_token: page } : {}) });
      const j = await alpaca(u);
      requests++;
      for (const [ticker, list] of Object.entries(j.bars ?? {})) {
        missing.delete(ticker);
        for (const b of list) rows.push({ ticker, date: b.t.slice(0, 10), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v });
      }
      page = j.next_page_token;
    } while (page);
    for (let k = 0; k < rows.length; k += 5000) {
      const { error: e } = await db.from('prices_daily').upsert(rows.slice(k, k + 5000), { onConflict: 'ticker,date' });
      if (e) throw e;
    }
    bars += rows.length;
    process.stdout.write(`${Math.min(i + CHUNK, tickers.length)}/${tickers.length} hisse, ${bars} bar\n`);
  }
  const detail = { tickers: tickers.length, bars, requests, days: DAYS, missing: [...missing] };
  await db.from('ingest_runs').update({ status: 'ok', finished_at: new Date().toISOString(), detail }).eq('id', run.id);
  console.log(JSON.stringify(detail));
} catch (err) {
  await db.from('ingest_runs').update({ status: 'error', finished_at: new Date().toISOString(), detail: { error: String(err.message ?? err) } }).eq('id', run.id);
  console.error('HATA:', err.message ?? err);
  process.exit(1);
}
