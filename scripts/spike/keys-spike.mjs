// Kairos spike: Alpaca prices + Marketaux news. Run: node --env-file=.env.local scripts/spike/keys-spike.mjs
// Never prints key values.
const { ALPACA_API_KEY_ID: kid, ALPACA_API_SECRET_KEY: ksec, MARKETAUX_API_TOKEN: mtok } = process.env;
const present = v => (v && v.trim() ? `set (${v.trim().length} chars)` : 'MISSING');
console.log('keys:', { alpacaId: present(kid), alpacaSecret: present(ksec), marketaux: present(mtok) });
const scrub = s => [kid, ksec, mtok].filter(Boolean).reduce((a, k) => a.split(k.trim()).join('***'), String(s));

const SYMBOLS = 'AAPL,MSFT,NVDA,AMZN,GOOGL,META,BRK.B,LLY,AVGO,JPM,TSLA,UNH,XOM,V,PG,JNJ,MA,HD,COST,MRK,ABBV,CVX,PEP,KO,ADBE,WMT,CRM,BAC,TMO,MCD,CSCO,ACN,LIN,ORCL,ABT,NFLX,AMD,DHR,WFC,TXN,DIS,PM,INTU,CAT,VZ,AMGN,IBM,QCOM,GE,LMT'.split(',');

async function alpaca(feed) {
  const end = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const start = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
  let page, calls = 0, bars = 0;
  const got = new Set();
  do {
    const u = new URL('https://data.alpaca.markets/v2/stocks/bars');
    u.search = new URLSearchParams({ symbols: SYMBOLS.join(','), timeframe: '1Day', start, end, limit: '10000', feed, adjustment: 'split', ...(page ? { page_token: page } : {}) });
    const r = await fetch(u, { headers: { 'APCA-API-KEY-ID': kid.trim(), 'APCA-API-SECRET-KEY': ksec.trim() } });
    calls++;
    const txt = await r.text();
    if (!r.ok) return { feed, status: r.status, body: scrub(txt).slice(0, 300) };
    const j = JSON.parse(txt);
    for (const [s, arr] of Object.entries(j.bars || {})) { got.add(s); bars += arr.length; }
    page = j.next_page_token;
  } while (page && calls < 10);
  const missing = SYMBOLS.filter(s => !got.has(s));
  return { feed, status: 200, calls, symbolsRequested: SYMBOLS.length, symbolsReturned: got.size, bars, missing };
}

async function alpacaLatest() {
  const r = await fetch('https://data.alpaca.markets/v2/stocks/AAPL/bars?timeframe=15Min&limit=3&feed=sip&start=' + new Date(Date.now() - 3 * 24 * 3600e3).toISOString() + '&end=' + new Date(Date.now() - 16 * 60e3).toISOString(), { headers: { 'APCA-API-KEY-ID': kid.trim(), 'APCA-API-SECRET-KEY': ksec.trim() } });
  const txt = await r.text();
  if (!r.ok) return { status: r.status, body: scrub(txt).slice(0, 300) };
  const j = JSON.parse(txt);
  return { status: 200, lastBars: (j.bars || []).slice(-2) };
}

async function marketaux() {
  const u = new URL('https://api.marketaux.com/v1/news/all');
  u.search = new URLSearchParams({ symbols: 'AAPL,LMT', filter_entities: 'true', language: 'en', limit: '3', api_token: mtok.trim() });
  const r = await fetch(u);
  const txt = await r.text();
  if (!r.ok) return { status: r.status, body: scrub(txt).slice(0, 300) };
  const j = JSON.parse(txt);
  return {
    status: 200, meta: j.meta,
    articles: (j.data || []).map(a => ({
      title: a.title, published: a.published_at, source: a.source,
      entities: (a.entities || []).map(e => ({ symbol: e.symbol, name: e.name, type: e.type, match: e.match_score, sentiment: e.sentiment_score })),
    })),
  };
}

const res = {};
for (const [k, fn] of [['alpaca_sip_daily', () => alpaca('sip')], ['alpaca_iex_daily', () => alpaca('iex')], ['alpaca_sip_15min_delayed', alpacaLatest], ['marketaux', marketaux]]) {
  try { res[k] = await fn(); } catch (e) { res[k] = { error: scrub(e.message) }; }
}
console.log(scrub(JSON.stringify(res, null, 2)));
