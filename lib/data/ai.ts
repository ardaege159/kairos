import "server-only";
import { createHash } from "node:crypto";
import { after, connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getOwner } from "@/lib/supabase/server";
import { summaryMessages, type SummaryInput } from "@/lib/ai/summary";

// Any OpenAI-compatible chat endpoint. Defaults target Google Gemini's free tier; the lite model is
// several times faster there and good enough for rewriting computed facts.
const BASE = process.env.AI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL = process.env.AI_MODEL?.trim() || "gemini-flash-lite-latest";

export const aiEnabled = () => !!process.env.AI_API_KEY?.trim();

export type AiSummaryState = { text: string | null; model: string | null; at: string | null; pending: boolean };

// Tickers whose summary is being written in this server process (one request to the model at a time each).
const inFlight = new Set<string>();

async function generate(input: SummaryInput, hash: string, key: string) {
  try {
    // Free-tier responses can take a minute or more; this runs after the page has been sent.
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      // Gemini "thinking" models spend output tokens on reasoning first: keep it low and leave room for the text.
      body: JSON.stringify({ model: MODEL, messages: summaryMessages(input), temperature: 0.3, max_tokens: 2000, reasoning_effort: process.env.AI_REASONING?.trim() || "low" }),
      signal: AbortSignal.timeout(170_000),
    });
    if (!r.ok) {
      console.error("AI özet hatası", r.status, (await r.text()).slice(0, 200));
      return;
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const text = j.choices?.[0]?.message?.content?.trim();
    const db = createAdminClient();
    if (!text || !db) return;
    const { error } = await db.from("ai_summaries")
      .upsert({ ticker: input.ticker, input_hash: hash, summary: text, model: MODEL, created_at: new Date().toISOString() }, { onConflict: "ticker" });
    if (error) console.error("AI özet kaydedilemedi", error.message);
  } catch (e) {
    console.error("AI özet hatası", e instanceof Error ? e.message : e);
  } finally {
    inFlight.delete(input.ticker);
  }
}

/**
 * Cached AI summary for a stock. Never waits for the model: when the cache is missing, or older than
 * today and the outlook's facts changed, a rewrite is queued after the response and the page shows
 * the previous text (or a "being written" note) until the next visit.
 */
export async function getAiSummary(input: SummaryInput): Promise<AiSummaryState | null> {
  await connection();
  const key = process.env.AI_API_KEY?.trim();
  if (!key || !(await getOwner())) return null;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const hash = createHash("sha1").update(JSON.stringify(input)).digest("hex");
  const { data: cached } = await supabase.from("ai_summaries").select("input_hash,summary,model,created_at").eq("ticker", input.ticker).maybeSingle();
  const fresh = cached && (cached.input_hash === hash || cached.created_at.slice(0, 10) === today);
  let pending = inFlight.has(input.ticker);
  if (!fresh && !pending) {
    inFlight.add(input.ticker);
    pending = true;
    after(() => generate(input, hash, key));
  }
  return { text: cached?.summary ?? null, model: cached?.model ?? null, at: cached?.created_at ?? null, pending };
}
