// Prompt and parser for Turkish news headlines and summaries. The model sees only the headline and the
// feed's short description, so the summary may not go beyond them.
export type ToTranslate = { id: string; title: string; description: string | null };
export type Translated = { id: string; title_tr: string; summary_tr: string | null };

export function translateMessages(items: ToTranslate[]) {
  const list = items.map((n, i) => ({ n: i + 1, baslik: n.title, aciklama: n.description?.slice(0, 600) ?? "" }));
  return [
    {
      role: "system" as const,
      content:
        "Bir finans haber sitesi için İngilizce haber başlıklarını Türkçeye çevirirsin. Her haber için JSON döndür: " +
        '{"haberler":[{"n":1,"baslik":"...","ozet":"..."}]}. ' +
        "baslik: başlığın doğal, kısa Türkçe çevirisi (şirket, kişi ve kurum adları, kısaltmalar ve rakamlar aynen kalır). " +
        "ozet: başlık ve açıklamadaki bilgiyle 1-3 cümlelik Türkçe özet; yalnızca verilen bilgiyi kullan, yorum, tahmin ya da yeni bilgi ekleme. " +
        "Açıklama boşsa ya da başlığı tekrar ediyorsa ozet boş metin olsun. Al/sat önerisi verme. Markdown kullanma.",
    },
    { role: "user" as const, content: JSON.stringify(list) },
  ];
}

/** Maps the model's answer back to item ids; drops entries that are missing, empty or misnumbered. */
export function parseTranslations(items: ToTranslate[], content: string | null): Translated[] {
  if (!content) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return [];
  }
  const rows = (parsed as { haberler?: unknown })?.haberler;
  if (!Array.isArray(rows)) return [];
  const out: Translated[] = [];
  const seen = new Set<number>();
  for (const r of rows as { n?: unknown; baslik?: unknown; ozet?: unknown }[]) {
    const n = Number(r?.n);
    const item = items[n - 1];
    const title = typeof r?.baslik === "string" ? r.baslik.trim() : "";
    if (!item || !title || seen.has(n)) continue;
    seen.add(n);
    const summary = typeof r.ozet === "string" ? r.ozet.trim() : "";
    out.push({ id: item.id, title_tr: title.slice(0, 300), summary_tr: summary ? summary.slice(0, 1000) : null });
  }
  return out;
}
