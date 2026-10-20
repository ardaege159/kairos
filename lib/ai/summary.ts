// Prompt for the AI stock summary. The model only rewrites facts Kairos already computed (the outlook's
// reasons with their numbers) into readable Turkish; it gets no other data and must not add any.
import type { Reason } from "../insights/thesis.ts";

export type SummaryInput = { ticker: string; name: string; sector: string; price: number | null; score: number | null; stanceLabel: string; reasons: Reason[] };

export function summaryMessages(s: SummaryInput) {
  const lines = s.reasons.map((r) => `- [${r.category}] [${r.tone === "positive" ? "olumlu" : r.tone === "negative" ? "olumsuz" : "takip"}] ${r.title}: ${r.text}${r.source ? ` (Kaynak: ${r.source})` : ""}`);
  return [
    {
      role: "system" as const,
      content:
        "Sen bir hisse senedi analiz sitesinin yazarısın. Kullanıcıya verilen gerçekleri sade, akıcı Türkçeyle 5-7 cümlelik tek bir paragrafta özetlersin. " +
        "Kurallar: yalnızca verilen bilgileri ve rakamları kullan, yeni rakam, tahmin, hedef fiyat ya da haber uydurma. " +
        "Göstergelerin adlarını ve türlerini aynen koru (ör. 'WTI ham petrol' yerine yalnızca 'petrol' ya da 'Brent' yazma), rakamları yuvarlamadan kullan. " +
        "'Al', 'sat', 'tut' gibi öneriler verme; 'görünüm', 'risk', 'destekleyen etken' gibi betimleyici dil kullan. " +
        "Önce şirketin genel durumunu, sonra olumlu etkenleri, sonra riskleri anlat; makro ve sektör etkilerini şirkete nasıl dokunduğuyla bağla. " +
        "Teknik terimleri kısaca açıkla. Başlık, madde işareti ya da Markdown kullanma.",
    },
    {
      role: "user" as const,
      content:
        `Hisse: ${s.ticker} (${s.name}), sektör: ${s.sector}. Son fiyat: ${s.price == null ? "bilinmiyor" : s.price.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $. Kairos Skoru: ${s.score ?? "yok"}/100. ` +
        `Genel görünüm: ${s.stanceLabel}.\nGerçekler:\n${lines.join("\n")}`,
    },
  ];
}
