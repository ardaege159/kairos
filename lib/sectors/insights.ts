// Rule-based, data-backed explanation of a sector's recent move. No language model: every sentence
// is produced from numbers we hold, and the UI labels them as likely drivers, not proven causes.

export type Member = {
  ticker: string;
  name: string;
  market_cap: number | null;
  return_1m: number | null;
  return_3m: number | null;
};
export type SectorMedians = { return_1m: number | null; return_3m: number | null; revenue_growth_yoy: number | null; net_margin: number | null; pe: number | null };
export type Reason = { key: string; title: string; text: string; tone: "positive" | "negative" | "neutral" };
export type Contributor = { ticker: string; name: string; return_3m: number; weight: number; contribution: number };

const pct = (v: number) => `%${(Math.abs(v) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
const signed = (v: number) => `${v < 0 ? "−" : "+"}${pct(v)}`;

/** Cap-weighted contribution of each member to the sector's 3-month move. */
export function contributions(members: Member[]): Contributor[] {
  const valid = members.filter((m): m is Member & { market_cap: number; return_3m: number } => m.market_cap != null && m.market_cap > 0 && m.return_3m != null);
  const total = valid.reduce((s, m) => s + m.market_cap, 0);
  if (!total) return [];
  return valid
    .map((m) => ({ ticker: m.ticker, name: m.name, return_3m: m.return_3m, weight: m.market_cap / total, contribution: (m.market_cap / total) * m.return_3m }))
    .sort((a, b) => b.contribution - a.contribution);
}

export function sectorInsights(input: {
  label: string;
  sector: SectorMedians;
  market: SectorMedians;               // medians across all S&P 500 members
  rank3m: number | null;               // 1 = best of `sectorCount`
  sectorCount: number;
  members: Member[];
  topics: { label: string; count: number }[]; // last 7 days, this sector's headlines
  spendingShare: number | null;        // share of matched federal contract dollars
  spendingRank: number | null;
  earningsSoon: number;                // members reporting in the next 14 days
}): { headline: string; reasons: Reason[]; leaders: Contributor[]; laggards: Contributor[] } {
  const { label, sector: s, market: m } = input;
  const reasons: Reason[] = [];
  const contrib = contributions(input.members);
  const leaders = contrib.filter((c) => c.contribution > 0).slice(0, 5);
  const laggards = [...contrib].reverse().filter((c) => c.contribution < 0).slice(0, 5);

  let headline = `${label} sektörü hakkında yeterli fiyat verisi yok.`;
  if (s.return_3m != null && input.rank3m != null) {
    const pos = input.rank3m <= 3 ? "öne çıkan" : input.rank3m > input.sectorCount - 3 ? "geride kalan" : "orta sıralardaki";
    headline = `${label}, son 3 ayda tipik hissesinin ${signed(s.return_3m)} getirisiyle ${input.sectorCount} sektör arasında ${input.rank3m}. sırada; şu an ${pos} sektörlerden.`;
  }

  // Momentum: is the move speeding up or fading?
  if (s.return_1m != null && s.return_3m != null) {
    const pace = s.return_3m / 3;
    if (s.return_3m > 0 && s.return_1m > pace + 0.01) {
      reasons.push({ key: "momentum", title: "Yükseliş hızlanıyor", tone: "positive",
        text: `Son bir aydaki ${signed(s.return_1m)}, üç aylık ortalama aylık hızın (${signed(pace)}) üzerinde. Alımlar son haftalarda yoğunlaşmış.` });
    } else if (s.return_3m > 0 && s.return_1m < 0) {
      reasons.push({ key: "momentum", title: "Son ayda soluklanıyor", tone: "neutral",
        text: `Üç aylık yükselişe rağmen son bir ayda ${signed(s.return_1m)}. Kâr satışı ya da gündem değişimi olabilir.` });
    } else if (s.return_3m < 0 && s.return_1m > 0) {
      reasons.push({ key: "momentum", title: "Toparlanma işaretleri", tone: "positive",
        text: `Üç ayda gerilese de son bir ayda ${signed(s.return_1m)} ile toparlanıyor.` });
    } else if (s.return_3m < 0 && s.return_1m < pace - 0.01) {
      reasons.push({ key: "momentum", title: "Düşüş derinleşiyor", tone: "negative",
        text: `Son bir aydaki ${signed(s.return_1m)}, üç aylık ortalama hızdan daha kötü.` });
    }
  }

  // Breadth: broad-based or carried by a few large names?
  const withReturn = input.members.filter((x) => x.return_3m != null);
  if (withReturn.length >= 5 && contrib.length) {
    const up = withReturn.filter((x) => x.return_3m! > 0).length / withReturn.length;
    const totalMove = contrib.reduce((a, c) => a + c.contribution, 0);
    const top3 = contrib.slice(0, 3).reduce((a, c) => a + c.contribution, 0);
    const concentrated = totalMove > 0 && top3 / totalMove > 0.6;
    reasons.push({
      key: "breadth",
      title: concentrated ? "Hareket birkaç büyük hisseye dayalı" : up >= 0.6 ? "Yükseliş sektöre yayılmış" : up <= 0.4 ? "Hisselerin çoğu geride" : "Karışık görünüm",
      tone: concentrated ? "neutral" : up >= 0.6 ? "positive" : up <= 0.4 ? "negative" : "neutral",
      text: `Sektördeki hisselerin ${pct(up)}'i son 3 ayda yükselişte.${concentrated ? ` Piyasa değeri ağırlıklı getirinin çoğunu ${contrib.slice(0, 3).map((c) => c.ticker).join(", ")} taşıyor.` : ""}`,
    });
  }

  // Fundamentals vs the whole market.
  if (s.revenue_growth_yoy != null && m.revenue_growth_yoy != null) {
    const diff = s.revenue_growth_yoy - m.revenue_growth_yoy;
    if (Math.abs(diff) >= 0.03) {
      reasons.push({ key: "growth", title: diff > 0 ? "Gelirler piyasadan hızlı büyüyor" : "Gelir büyümesi piyasanın gerisinde", tone: diff > 0 ? "positive" : "negative",
        text: `Tipik şirketin son çeyrek gelir büyümesi ${signed(s.revenue_growth_yoy)}; S&P 500 genelinde ${signed(m.revenue_growth_yoy)}.` });
    }
  }
  if (s.pe != null && m.pe != null && m.pe > 0) {
    const rel = s.pe / m.pe - 1;
    if (Math.abs(rel) >= 0.15) {
      reasons.push({ key: "valuation", title: rel < 0 ? "Piyasaya göre ucuz" : "Piyasaya göre pahalı", tone: rel < 0 ? "positive" : "neutral",
        text: `Medyan F/K ${s.pe.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}, piyasa medyanı ${m.pe.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}. ${rel < 0 ? "Düşük değerleme yatırımcıyı çekiyor olabilir." : "Yatırımcılar yüksek büyüme fiyatlıyor."}` });
    }
  }

  // News flow.
  const topics = input.topics.filter((t) => t.count >= 2).slice(0, 3);
  if (topics.length) {
    reasons.push({ key: "news", title: "Gündemdeki konular", tone: "neutral",
      text: `Son 7 günde bu sektörü ilgilendiren başlıklarda en çok ${topics.map((t) => `${t.label} (${t.count})`).join(", ")} öne çıktı.` });
  }

  if (input.spendingShare != null && input.spendingRank != null && input.spendingRank <= 3 && input.spendingShare >= 0.05) {
    reasons.push({ key: "spending", title: "Federal sözleşmelerden büyük pay", tone: "positive",
      text: `Son 12 ayda halka açık şirketlere giden federal sözleşme tutarının ${pct(input.spendingShare)}'i bu sektöre gitti (${input.spendingRank}. sırada).` });
  }
  if (input.earningsSoon > 0) {
    reasons.push({ key: "earnings", title: "Bilanço dönemi yaklaşıyor", tone: "neutral",
      text: `Önümüzdeki 2 haftada sektörden ${input.earningsSoon} şirket çeyrek sonuçlarını açıklayacak; yön için kritik dönem.` });
  }

  return { headline, reasons, leaders, laggards };
}
