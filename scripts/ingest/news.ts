// Load news into Supabase:
//  - company news from Marketaux (entity-tagged, with per-ticker sentiment), within a call budget
//  - global headlines from public RSS feeds of major outlets, tagged with topics/sectors
//   node --env-file=.env.local scripts/ingest/news.ts [--marketaux-calls=30]
// Marketaux free plan: 100 requests/day, 3 articles per request. Items older than 30 days are deleted.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { classify, matchCompanies } from "../../lib/news/topics.ts";

const CALLS = Number(process.argv.find((a) => a.startsWith("--marketaux-calls="))?.split("=")[1] ?? 30);
const { NEXT_PUBLIC_SUPABASE_URL: url, MARKETAUX_API_TOKEN } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secret || !MARKETAUX_API_TOKEN) {
  console.error("Supabase ve Marketaux anahtarları gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });
const sha = (s: string) => createHash("sha1").update(s).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FEEDS = [
  { name: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "CNBC Ekonomi", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html" },
  { name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { name: "Investing.com", url: "https://www.investing.com/rss/news_25.rss" },
  { name: "Financial Times", url: "https://www.ft.com/markets?format=rss" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
];

type NewsRow = {
  id: string; source: "marketaux" | "rss"; kind: "company" | "global"; url: string; title: string; description: string | null;
  image_url: string | null; source_domain: string | null; published_at: string; topic: string | null; sectors: string[];
};
type LinkRow = { news_id: string; ticker: string; match_score: number | null; sentiment: number | null };

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).trim();
const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return m ? decode(m[1]) : null;
};

const { data: run } = await db.from("ingest_runs").insert({ source: "news" }).select("id").single();
try {
  // Universe: every ticker can be linked from Marketaux; only core names are matched from headlines.
  const tickers = new Map<string, { sector: string | null; name: string; core: boolean }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("companies").select("ticker,name,sector,core").range(from, from + 999);
    if (error) throw error;
    for (const c of data ?? []) tickers.set(c.ticker, { sector: c.sector, name: c.name, core: c.core });
    if (!data || data.length < 1000) break;
  }
  const coreNames = [...tickers].filter(([, c]) => c.core).map(([ticker, c]) => ({ ticker, name: c.name }));

  const items = new Map<string, NewsRow>();
  const links: LinkRow[] = [];

  // --- Marketaux ---
  const { data: last } = await db.from("news_items").select("published_at").eq("source", "marketaux").order("published_at", { ascending: false }).limit(1);
  const since = last?.[0]?.published_at
    ? new Date(Date.parse(last[0].published_at) - 3600e3)
    : new Date(Date.now() - 24 * 3600e3);
  let calls = 0, mxArticles = 0, budgetHit = false;
  for (let page = 1; page <= CALLS; page++) {
    const u = new URL("https://api.marketaux.com/v1/news/all");
    u.search = new URLSearchParams({
      countries: "us", filter_entities: "true", must_have_entities: "true", language: "en", limit: "3", page: String(page),
      published_after: since.toISOString().slice(0, 19), api_token: MARKETAUX_API_TOKEN.trim(),
    }).toString();
    const r = await fetch(u);
    calls++;
    if (r.status === 402 || r.status === 429) { budgetHit = true; break; }
    if (!r.ok) throw new Error(`Marketaux HTTP ${r.status}`);
    const j = (await r.json()) as {
      data: { uuid: string; title: string; description: string | null; url: string; image_url: string | null; source: string; published_at: string;
        entities: { symbol: string; match_score: number; sentiment_score: number | null; type: string }[] }[];
      meta: { found: number; returned: number };
    };
    for (const a of j.data) {
      mxArticles++;
      const linked = a.entities.filter((e) => tickers.has(e.symbol));
      const sectors = [...new Set(linked.map((e) => tickers.get(e.symbol)!.sector).filter((s): s is string => !!s))];
      const { topic } = classify(`${a.title} ${a.description ?? ""}`);
      items.set(a.uuid, { id: a.uuid, source: "marketaux", kind: "company", url: a.url, title: a.title, description: a.description,
        image_url: a.image_url, source_domain: a.source, published_at: a.published_at, topic, sectors });
      for (const e of linked) links.push({ news_id: a.uuid, ticker: e.symbol, match_score: e.match_score, sentiment: e.sentiment_score });
    }
    if (j.meta.returned < 3 || page * 3 >= j.meta.found) break;
  }

  // --- RSS ---
  let rssItems = 0;
  for (const f of FEEDS) {
    try {
      const r = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 (Kairos personal reader)" } });
      if (!r.ok) { console.warn(`${f.name}: HTTP ${r.status}`); continue; }
      const xml = await r.text();
      for (const block of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
        const title = tag(block, "title"), link = tag(block, "link"), date = tag(block, "pubDate");
        if (!title || !link || !date || Number.isNaN(Date.parse(date))) continue;
        const description = tag(block, "description");
        const text = `${title} ${description ?? ""}`;
        const { topic, sectors } = classify(text);
        const id = sha(link);
        items.set(id, { id, source: "rss", kind: "global", url: link, title, description: description?.slice(0, 500) ?? null, image_url: null,
          source_domain: f.name, published_at: new Date(Date.parse(date)).toISOString(), topic, sectors });
        for (const t of matchCompanies(title, coreNames)) links.push({ news_id: id, ticker: t, match_score: null, sentiment: null });
        rssItems++;
      }
    } catch (e) {
      console.warn(`${f.name}: ${(e as Error).message}`);
    }
    await sleep(300);
  }

  const rows = [...items.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("news_items").upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) throw error;
  }
  const uniqLinks = [...new Map(links.map((l) => [`${l.news_id}|${l.ticker}`, l])).values()];
  for (let i = 0; i < uniqLinks.length; i += 500) {
    const { error } = await db.from("news_tickers").upsert(uniqLinks.slice(i, i + 500), { onConflict: "news_id,ticker" });
    if (error) throw error;
  }
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
  const { error: de } = await db.from("news_items").delete().lt("published_at", cutoff);
  if (de) throw de;

  const detail = { marketauxCalls: calls, marketauxArticles: mxArticles, budgetHit, rssItems, stored: rows.length, tickerLinks: uniqLinks.length };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail, null, 2));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
