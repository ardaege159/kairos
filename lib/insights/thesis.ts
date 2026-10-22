// "Kairos görünümü": a bull and bear case for one stock, combining company data (stockPoints), its own
// valuation history, the sector's momentum, macro conditions and federal spending themes. Every
// reason carries its numbers; the stance is a weighted balance, descriptive and not a recommendation.
import type { MacroEffect } from "./macro-impact.ts";
import type { Point } from "./stock.ts";

export type Category = "Şirket" | "Değerleme" | "Sektör" | "Makro" | "Federal harcama" | "Yatırımcılar";
export type Reason = { category: Category; title: string; text: string; tone: "positive" | "negative" | "neutral"; weight: number; source?: string | null };
export type Stance = "olumlu" | "karisik" | "olumsuz";
export const STANCE_LABEL: Record<Stance, string> = { olumlu: "Olumlu ağırlıklı", karisik: "Karışık", olumsuz: "Olumsuz ağırlıklı" };

export type ThesisInput = {
  name: string;
  sectorName: string;
  points: { pros: Point[]; cons: Point[]; watch: Point[] };
  macro: MacroEffect[];
  sector: { rank: number; of: number; return3m: number | null } | null;          // rank 1 = strongest 3-month sector
  valuation: { metric: string; now: number; median: number } | null;            // own-history multiple
  federal: { amount12m: number; revenue: number | null; growth: number | null; themes: { name: string; growth: number }[] } | null;
  investors?: { holders: string[]; buyers: string[]; sellers: string[]; quarter: string } | null;   // 13F, latest quarter
};

const p = (v: number) => `%${Math.round(Math.abs(v) * 100)}`;
const x = (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
const money = (v: number) => (v >= 1e9 ? `${x(v / 1e9)} milyar $` : `${x(v / 1e6)} milyon $`);
const lower = (s: string) => s.charAt(0).toLocaleLowerCase("tr") + s.slice(1);

export function buildThesis(t: ThesisInput) {
  const reasons: Reason[] = [];
  for (const q of t.points.pros) reasons.push({ category: "Şirket", title: q.title, text: q.detail, tone: "positive", weight: q.strength });
  for (const q of t.points.cons) reasons.push({ category: "Şirket", title: q.title, text: q.detail, tone: "negative", weight: q.strength });
  for (const q of t.points.watch) reasons.push({ category: "Şirket", title: q.title, text: q.detail, tone: "neutral", weight: 0 });

  if (t.valuation) {
    const diff = t.valuation.now / t.valuation.median - 1;
    if (diff >= 0.3) reasons.push({ category: "Değerleme", tone: "negative", weight: 0.6, title: "Kendi geçmişine göre pahalı",
      text: `${t.valuation.metric} ${x(t.valuation.now)}, son yılların medyanı ${x(t.valuation.median)}: ${p(diff)} yukarıda. Beklentiler yüksek; hayal kırıklığında düşüş sert olabilir.` });
    else if (diff <= -0.2) reasons.push({ category: "Değerleme", tone: "positive", weight: 0.6, title: "Kendi geçmişine göre ucuz",
      text: `${t.valuation.metric} ${x(t.valuation.now)}, son yılların medyanı ${x(t.valuation.median)}: ${p(diff)} aşağıda. Nedeni geçici bir sorunsa toparlanma alanı var.` });
  }

  if (t.sector && t.sector.return3m != null) {
    const top = t.sector.rank <= 3, bottom = t.sector.rank > t.sector.of - 3;
    if (top) reasons.push({ category: "Sektör", tone: "positive", weight: 0.6, title: "Sektörü güçlü",
      text: `${t.sectorName}, son 3 ayda ${t.sector.of} sektör arasında ${t.sector.rank}. sırada (medyan hisse ${t.sector.return3m >= 0 ? "+" : "−"}${p(t.sector.return3m)}). Para bu sektöre akıyor.` });
    else if (bottom) reasons.push({ category: "Sektör", tone: "negative", weight: 0.6, title: "Sektörü zayıf",
      text: `${t.sectorName}, son 3 ayda ${t.sector.of} sektör arasında ${t.sector.rank}. sırada (medyan hisse ${t.sector.return3m >= 0 ? "+" : "−"}${p(t.sector.return3m)}). Sektör genelinde satış baskısı var.` });
  }

  for (const m of t.macro) reasons.push({ category: "Makro", title: m.title, text: m.text, tone: m.tone, weight: m.weight, source: m.source });

  if (t.federal) {
    const f = t.federal;
    const share = f.revenue ? f.amount12m / f.revenue : null;
    if (f.growth != null && f.growth >= 0.15 && f.amount12m >= 1e8) reasons.push({ category: "Federal harcama", tone: "positive", weight: share != null && share >= 0.1 ? 0.7 : 0.4,
      title: "Devletten gelen iş artıyor", text: `Federal sözleşmeleri bir yılda ${p(f.growth)} arttı (son 12 ay ${money(f.amount12m)}${share != null ? `, gelirinin yaklaşık ${p(share)} kadarı` : ""}).` });
    else if (f.growth != null && f.growth <= -0.15 && f.amount12m >= 1e8) reasons.push({ category: "Federal harcama", tone: "negative", weight: share != null && share >= 0.1 ? 0.7 : 0.4,
      title: "Devletten gelen iş azalıyor", text: `Federal sözleşmeleri bir yılda ${p(f.growth)} azaldı (son 12 ay ${money(f.amount12m)}).` });
    for (const th of f.themes) {
      if (th.growth >= 0.15) reasons.push({ category: "Federal harcama", tone: "positive", weight: 0.4, title: `${th.name} harcaması artıyor`,
        text: `Şirket, federal harcamanın bir yılda ${p(th.growth)} arttığı "${th.name}" temasında en büyük alıcılar arasında.` });
      else if (th.growth <= -0.15) reasons.push({ category: "Federal harcama", tone: "negative", weight: 0.3, title: `${th.name} harcaması azalıyor`,
        text: `Şirketin büyük pay aldığı "${th.name}" temasında federal harcama bir yılda ${p(th.growth)} azaldı.` });
    }
  }

  // Famous investors (13F): crowding is weak evidence on its own, so these carry small weights.
  const inv = t.investors;
  if (inv) {
    const names = (xs: string[]) => xs.slice(0, 4).join(", ") + (xs.length > 4 ? ` ve ${xs.length - 4} kişi daha` : "");
    if (inv.buyers.length >= 2) reasons.push({ category: "Yatırımcılar", tone: "positive", weight: 0.4, title: "Takip edilen yatırımcılar alıyor",
      text: `${inv.quarter} döneminde ${names(inv.buyers)} pozisyon açtı ya da artırdı.` });
    else if (inv.holders.length >= 3) reasons.push({ category: "Yatırımcılar", tone: "positive", weight: 0.3, title: "Takip edilen yatırımcıların portföyünde",
      text: `${names(inv.holders)} bu hisseyi tutuyor (${inv.quarter}).` });
    if (inv.sellers.length >= 2 && inv.buyers.length === 0) reasons.push({ category: "Yatırımcılar", tone: "negative", weight: 0.3, title: "Takip edilen yatırımcılar azaltıyor",
      text: `${inv.quarter} döneminde ${names(inv.sellers)} pozisyonunu azalttı ya da sattı.` });
  }

  const plus = reasons.filter((r) => r.tone === "positive").reduce((s, r) => s + r.weight, 0);
  const minus = reasons.filter((r) => r.tone === "negative").reduce((s, r) => s + r.weight, 0);
  const net = plus - minus;
  const stance: Stance = net >= 1 ? "olumlu" : net <= -1 ? "olumsuz" : "karisik";
  const top = (tone: Reason["tone"]) => reasons.filter((r) => r.tone === tone).sort((a, b) => b.weight - a.weight).slice(0, 3).map((r) => lower(r.title));
  const pos = top("positive"), neg = top("negative");
  const summary = `${t.name} için görünüm ${STANCE_LABEL[stance].toLocaleLowerCase("tr")}.`
    + (pos.length ? ` Öne çıkan olumlu etkenler: ${pos.join(", ")}.` : "")
    + (neg.length ? ` Başlıca riskler: ${neg.join(", ")}.` : "");
  return { stance, label: STANCE_LABEL[stance], plus, minus, net, reasons, summary };
}
