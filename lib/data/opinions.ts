import "server-only";
import { marketCache, ownerOnly, sharedDb } from "./shared";
import type { Stance } from "@/lib/opinions/extract";
import { SOURCE_BY_KEY, type OpinionSource } from "@/lib/opinions/sources";

export type Opinion = {
  ticker: string; stance: Stance; focus: "ana" | "yan"; summary: string; points: string[];
  post: { id: string; title: string; url: string; published_at: string; source: OpinionSource | null };
};


type Raw = { ticker: string; stance: Stance; focus: "ana" | "yan"; summary: string; points: string[]; opinion_posts: { id: string; title: string; url: string; published_at: string; source: string } };
const SELECT = "ticker,stance,focus,summary,points,opinion_posts!inner(id,title,url,published_at,source)";
const toOpinion = (r: Raw): Opinion => ({
  ticker: r.ticker, stance: r.stance, focus: r.focus, summary: r.summary, points: Array.isArray(r.points) ? r.points : [],
  post: { id: r.opinion_posts.id, title: r.opinion_posts.title, url: r.opinion_posts.url, published_at: r.opinion_posts.published_at, source: SOURCE_BY_KEY[r.opinion_posts.source] ?? null },
});

/** Latest opinions, newest posts first; optionally only one ticker or one source. */
export async function getOpinions(opts: { ticker?: string; source?: string; days?: number; limit?: number } = {}): Promise<Opinion[]> {
  await ownerOnly();
  return getOpinionsCached(opts);
}

async function getOpinionsCached(opts: { ticker?: string; source?: string; days?: number; limit?: number }): Promise<Opinion[]> {
  "use cache";
  marketCache();
  const supabase = sharedDb();
  let q = supabase.from("opinion_mentions").select(SELECT).order("published_at", { ascending: false, referencedTable: "opinion_posts" }).limit(opts.limit ?? 80);
  if (opts.ticker) q = q.eq("ticker", opts.ticker);
  if (opts.source) q = q.eq("opinion_posts.source", opts.source);
  if (opts.days) q = q.gte("opinion_posts.published_at", new Date(Date.now() - opts.days * 864e5).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  // PostgREST orders the parent rows by the embedded column only within groups: sort here to be sure.
  return (data as unknown as Raw[]).map(toOpinion).sort((a, b) => b.post.published_at.localeCompare(a.post.published_at));
}

/** Per-ticker tally of recent opinions (main-subject mentions count double). */
export function tally(ops: Opinion[]) {
  const by = new Map<string, { ticker: string; olumlu: number; olumsuz: number; notr: number; score: number; sources: Set<string> }>();
  for (const o of ops) {
    const e = by.get(o.ticker) ?? by.set(o.ticker, { ticker: o.ticker, olumlu: 0, olumsuz: 0, notr: 0, score: 0, sources: new Set() }).get(o.ticker)!;
    e[o.stance]++;
    e.score += o.focus === "ana" ? 2 : 1;
    if (o.post.source) e.sources.add(o.post.source.name);
  }
  return [...by.values()].sort((a, b) => b.score - a.score);
}
