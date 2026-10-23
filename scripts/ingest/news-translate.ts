// Turkish headlines and short summaries for news items that have none yet, newest first.
//   node --env-file=.env.local scripts/ingest/news-translate.ts [--max=400]
// One LLM request per batch of headlines (AI_API_KEY, default Gemini flash-lite). Also re-cleans the stored
// English title/description (older rows kept HTML entities such as "&#x2019;"). An AI failure leaves the
// items untranslated for the next run and does not fail the job.
import { createClient } from "@supabase/supabase-js";
import { cleanFeedText } from "../../lib/news/text.ts";
import { parseTranslations, translateMessages, type ToTranslate } from "../../lib/news/translate.ts";

const MAX = Number(process.argv.find((a) => a.startsWith("--max="))?.split("=")[1] ?? 400);
const BATCH = 15;
const PARALLEL = 3;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY?.trim();
const aiKey = process.env.AI_API_KEY?.trim();
const AI_BASE = process.env.AI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai";
const AI_MODEL = process.env.AI_MODEL?.trim() || "gemini-flash-lite-latest";
if (!url || !secret) {
  console.error("Supabase anahtarları gerekli (.env.local).");
  process.exit(1);
}
if (!aiKey) {
  console.warn("AI_API_KEY yok: haber çevirisi atlandı.");
  process.exit(0);
}
const db = createClient(url, secret, { auth: { persistSession: false } });

async function ask(items: ToTranslate[]): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(`${AI_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({ model: AI_MODEL, messages: translateMessages(items), temperature: 0.1, max_tokens: 6000, reasoning_effort: "low", response_format: { type: "json_object" } }),
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

const { data, error } = await db.from("news_items").select("id,title,description").is("title_tr", null).order("published_at", { ascending: false }).limit(MAX);
if (error) throw error;
const items: ToTranslate[] = (data ?? []).map((n) => ({ id: n.id, title: cleanFeedText(n.title), description: n.description ? cleanFeedText(n.description) : null }));
const batches: ToTranslate[][] = [];
for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));

let done = 0, failed = 0;
const byId = new Map(items.map((n) => [n.id, n]));
for (let i = 0; i < batches.length; i += PARALLEL) {
  await Promise.all(batches.slice(i, i + PARALLEL).map(async (batch) => {
    const out = parseTranslations(batch, await ask(batch));
    failed += batch.length - out.length;
    for (const t of out) {
      const n = byId.get(t.id)!;
      const { error: ue } = await db.from("news_items").update({ title_tr: t.title_tr, summary_tr: t.summary_tr, title: n.title, description: n.description }).eq("id", t.id);
      if (ue) console.error("güncelleme:", ue.message);
      else done++;
    }
  }));
  console.log(`${Math.min(i + PARALLEL, batches.length)}/${batches.length} parti`);
}
console.log(JSON.stringify({ pending: items.length, translated: done, failed }));
