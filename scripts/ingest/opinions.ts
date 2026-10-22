// Independent investors' stock opinions from their RSS feeds -> opinion_posts, opinion_mentions.
//   node --env-file=.env.local scripts/ingest/opinions.ts [--days=45] [--max=30]
// Each new post is read once: an LLM (AI_API_KEY, default Gemini flash-lite) extracts the stocks the author
// argues about, with stance and a short Turkish summary; tickers are validated against our company list.
// Only the summary and the link are stored, never the post's text.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { extractMessages, htmlToText, parseMentions } from "../../lib/opinions/extract.ts";
import { SOURCES } from "../../lib/opinions/sources.ts";
import { cleanIssuer } from "../../lib/investors/thirteenf.ts";
import { companyMatcher } from "./lib-cusip.ts";

const arg = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d);
const DAYS = arg("days", 45), MAX = arg("max", 30);
const { NEXT_PUBLIC_SUPABASE_URL: url } = process.env;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
const aiKey = process.env.AI_API_KEY?.trim();
const AI_BASE = process.env.AI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai";
const AI_MODEL = process.env.AI_MODEL?.trim() || "gemini-flash-lite-latest";
// Second reading for posts where the fast model found nothing: slower but more thorough.
const AI_MODEL_STRONG = process.env.AI_MODEL_STRONG?.trim() || "gemini-flash-latest";
if (!url || !secret || !aiKey) {
  console.error("Supabase anahtarları ve AI_API_KEY gerekli (.env.local).");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });

type Item = { title: string; link: string; date: Date; html: string };
function parseFeed(xml: string): Item[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const it = m[1];
    const tag = (t: string) => it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? "";
    return { title: htmlToText(tag("title"), 300), link: htmlToText(tag("link"), 500), date: new Date(tag("pubDate")), html: tag("content:encoded") || tag("description") };
  }).filter((i) => i.link.startsWith("http") && !Number.isNaN(i.date.getTime()));
}

async function ask(messages: ReturnType<typeof extractMessages>, model = AI_MODEL): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(`${AI_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 2500, reasoning_effort: "low", response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(170_000),
      });
      if (r.status === 429) { await new Promise((res) => setTimeout(res, 30_000)); continue; }
      if (!r.ok) { console.error("AI", r.status, (await r.text()).slice(0, 160)); return null; }
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      return j.choices?.[0]?.message?.content ?? null;
    } catch (e) {
      console.error("AI", e instanceof Error ? e.message : e);
    }
  }
  return null;
}

const { data: run } = await db.from("ingest_runs").insert({ source: "opinions" }).select("id").single();
try {
  // Ticker -> company name, to check that the model's ticker belongs to the company it named.
  const listing = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("companies").select("ticker,name").range(from, from + 999);
    if (error) throw error;
    for (const c of data ?? []) listing.set(c.ticker, c.name);
    if (!data || data.length < 1000) break;
  }
  const ctx = await companyMatcher(db);
  const byName = (company: string) => ctx.match(cleanIssuer(company))?.ticker ?? null;
  const since = Date.now() - DAYS * 864e5;
  const queue: { source: (typeof SOURCES)[number]; item: Item; id: string }[] = [];
  for (const source of SOURCES) {
    const r = await fetch(source.feed, { headers: { "User-Agent": "Mozilla/5.0 (Kairos RSS reader)" }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (!r?.ok) { console.error("RSS alınamadı:", source.name); continue; }
    for (const item of parseFeed(await r.text())) {
      if (item.date.getTime() < since) continue;
      queue.push({ source, item, id: createHash("sha1").update(item.link).digest("hex") });
    }
  }
  const ids = queue.map((q) => q.id);
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db.from("opinion_posts").select("id").in("id", ids.slice(i, i + 300));
    for (const d of data ?? []) seen.add(d.id);
  }
  // Newest first, a bounded number per run (the free model can take a minute per post).
  const todo = queue.filter((q) => !seen.has(q.id)).sort((a, b) => b.item.date.getTime() - a.item.date.getTime()).slice(0, MAX);
  let posts = 0, mentions = 0, failed = 0, retried = 0;
  for (const { source, item, id } of todo) {
    const text = htmlToText(item.html);
    if (text.length < 200) continue; // nothing to read (image-only or empty preview)
    const messages = extractMessages({ source: source.name, author: source.author, title: item.title, text });
    const raw = await ask(messages);
    if (raw == null) { failed++; continue; } // not recorded: retried next run
    let found = parseMentions(raw, listing, byName);
    if (!found.length) {
      const again = await ask(messages, AI_MODEL_STRONG);
      if (again != null) { found = parseMentions(again, listing, byName); if (found.length) retried++; }
    }
    const { error: pe } = await db.from("opinion_posts").upsert({ id, source: source.key, title: item.title, url: item.link, published_at: item.date.toISOString(), mentions: found.length }, { onConflict: "id" });
    if (pe) throw pe;
    if (found.length) {
      const { error: me } = await db.from("opinion_mentions").upsert(found.map((m) => ({ post_id: id, ...m })), { onConflict: "post_id,ticker" });
      if (me) throw me;
    }
    posts++; mentions += found.length;
    console.log(`${source.name}: ${item.title.slice(0, 60)} -> ${found.map((m) => `${m.ticker}(${m.stance})`).join(", ") || "hisse yok"}`);
  }
  const detail = { feeds: SOURCES.length, recent: queue.length, processed: posts, mentions, failed, foundOnSecondReading: retried };
  await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), detail }).eq("id", run!.id);
  console.log(JSON.stringify(detail));
} catch (err) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), detail: { error: message } }).eq("id", run!.id);
  console.error("HATA:", message);
  process.exit(1);
}
