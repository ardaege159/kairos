import "server-only";
import { createHash } from "node:crypto";
import { connection } from "next/server";
import { createClient, getOwner } from "@/lib/supabase/server";
import { summaryMessages, type SummaryInput } from "@/lib/ai/summary";

// Any OpenAI-compatible chat endpoint. Defaults target Google Gemini's free tier.
const BASE = process.env.AI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL = process.env.AI_MODEL?.trim() || "gemini-flash-latest";

export const aiEnabled = () => !!process.env.AI_API_KEY?.trim();

/**
 * Cached AI summary for a stock: rebuilt at most once a day, and only when the outlook's facts changed;
 * otherwise served from the database. Falls back to the cached text (or null) on any model error.
 */
export async function getAiSummary(input: SummaryInput): Promise<{ text: string; model: string | null; at: string } | null> {
  await connection();
  const key = process.env.AI_API_KEY?.trim();
  if (!key || !(await getOwner())) return null;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const hash = createHash("sha1").update(JSON.stringify(input)).digest("hex");
  const { data: cached } = await supabase.from("ai_summaries").select("input_hash,summary,model,created_at").eq("ticker", input.ticker).maybeSingle();
  if (cached && (cached.input_hash === hash || cached.created_at.slice(0, 10) === today)) {
    return { text: cached.summary, model: cached.model, at: cached.created_at };
  }
  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, messages: summaryMessages(input), temperature: 0.3, max_tokens: 700 }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) {
      console.error("AI özet hatası", r.status, (await r.text()).slice(0, 200));
      return cached ? { text: cached.summary, model: cached.model, at: cached.created_at } : null;
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const text = j.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    const row = { ticker: input.ticker, input_hash: hash, summary: text, model: MODEL, created_at: new Date().toISOString() };
    await supabase.from("ai_summaries").upsert(row, { onConflict: "ticker" });
    return { text, model: MODEL, at: row.created_at };
  } catch (e) {
    console.error("AI özet hatası", e instanceof Error ? e.message : e);
    return cached ? { text: cached.summary, model: cached.model, at: cached.created_at } : null;
  }
}
