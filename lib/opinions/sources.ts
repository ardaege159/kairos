// Independent investors and analysts who publish single-stock write-ups with public RSS feeds.
// Feeds checked on 2026-10-22 (active, posting individual stock analyses). Many posts are partly
// paywalled: only the public part is read, and every summary links to the original.

export type OpinionSource = { key: string; name: string; author: string; feed: string; focus: string };

export const SOURCES: OpinionSource[] = [
  { key: "yavb", name: "Yet Another Value Blog", author: "Andrew Walker", feed: "https://yetanothervalueblog.substack.com/feed",
    focus: "Değer yatırımı ve özel durumlar (bölünme, satın alma, yeniden yapılanma)." },
  { key: "tsoh", name: "The Science of Hitting", author: "Alex Morris", feed: "https://thescienceofhitting.com/feed",
    focus: "Uzun vadeli kaliteli şirketler; ayrıntılı iş modeli analizleri." },
  { key: "bas", name: "Best Anchor Stocks", author: "Leandro", feed: "https://www.bestanchorstocks.com/feed",
    focus: "Rekabet avantajı güçlü, uzun vadeli büyüyen şirketler." },
  { key: "aei", name: "App Economy Insights", author: "App Economy Insights", feed: "https://www.appeconomyinsights.com/feed",
    focus: "Teknoloji şirketlerinin bilanço sonuçlarının görsel ve kısa yorumları." },
  { key: "mbi", name: "MBI Deep Dives", author: "Mohammad Bin Ilyas", feed: "https://mbi-deepdives.com/feed",
    focus: "Teknoloji ve internet şirketlerinin derinlemesine analizleri." },
  { key: "speedwell", name: "Speedwell Research", author: "Speedwell Research", feed: "https://www.speedwellresearch.com/feed",
    focus: "İş modeli odaklı şirket raporları ve bilanço değerlendirmeleri." },
  { key: "ccm", name: "Chit Chat Money", author: "Chit Chat Money", feed: "https://chitchatmoney.substack.com/feed",
    focus: "Tek tek hisse analizleri; başlıkta hisse kodu verilir." },
  { key: "rijnberk", name: "Rijnberk InvestInsights", author: "Rijnberk InvestInsights", feed: "https://rijnberkinvestinsights.substack.com/feed",
    focus: "Kaliteli büyüme şirketleri ve çeyreklik güncellemeler." },
  { key: "cq", name: "Compounding Quality", author: "Compounding Quality", feed: "https://www.compoundingquality.net/feed",
    focus: "Kaliteli şirketler; başarılı fon yöneticilerinin seçtiği hisseleri de derler." },
  { key: "ce", name: "Capital Employed", author: "Capital Employed", feed: "https://www.capitalemployed.com/feed",
    focus: "Haftalık derleme: fonların ve analistlerin yayınladığı hisse önerileri (pitch)." },
];
export const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((s) => [s.key, s])) as Record<string, OpinionSource>;
