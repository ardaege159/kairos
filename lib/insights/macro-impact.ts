// Which macro conditions are in force now, and how each tends to affect a sector or a kind of stock.
// These are textbook sensitivities (rates vs long-duration equities, oil vs energy, etc.), stated as
// tendencies with the numbers behind them, not forecasts. Pure (tested).

export type MacroSnapshot = Record<string, { now: number | null; m3: number | null; m6: number | null; y1: number | null; date?: string | null; name?: string }>;
export type StockTraits = { sector: string | null; pe: number | null; debtToEquity: number | null; marketCap: number | null };
export type MacroEffect = { key: string; title: string; text: string; tone: "positive" | "negative"; weight: number; source: string | null };

type Condition = {
  key: string;
  active: (m: MacroSnapshot) => boolean;
  title: (m: MacroSnapshot) => string;
  /** +1 tailwind, -1 headwind, 0 not relevant; with the reason for this stock. */
  effect: (s: StockTraits) => { sign: 1 | -1; why: string } | null;
};

const n = (v: number, d = 1) => v.toLocaleString("tr-TR", { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (a: number, b: number) => Math.round((a / b - 1) * 100);
const has = (m: MacroSnapshot, id: string, k: "m3" | "m6" | "y1") => m[id]?.now != null && m[id]?.[k] != null;
const d = (m: MacroSnapshot, id: string, k: "m3" | "m6" | "y1") => m[id].now! - m[id][k]!;

const GROWTH = new Set(["Information Technology", "Communication Services", "Consumer Discretionary"]);
const RATE_SENSITIVE = new Set(["Real Estate", "Utilities"]);
const DEFENSIVE = new Set(["Consumer Staples", "Health Care", "Utilities"]);
const CYCLICAL = new Set(["Consumer Discretionary", "Industrials", "Financials", "Materials"]);
const MULTINATIONAL = new Set(["Information Technology", "Materials", "Industrials"]);

const CONDITIONS: Condition[] = [
  {
    key: "inflation_down",
    active: (m) => has(m, "CPIAUCSL", "m3") && d(m, "CPIAUCSL", "m3") <= -0.3,
    title: (m) => `Enflasyon düşüyor: son 3 ayda %${n(m.CPIAUCSL.m3!)} → %${n(m.CPIAUCSL.now!)}`,
    effect: (s) => GROWTH.has(s.sector ?? "") || RATE_SENSITIVE.has(s.sector ?? "") || (s.pe ?? 0) > 30
      ? { sign: 1, why: "Düşen enflasyon faiz indirimi beklentisini güçlendirir; gelecekteki kârları bugüne daha değerli kılar. Büyüme ve faize duyarlı hisseler genelde bundan yararlanır." } : null,
  },
  {
    key: "inflation_up",
    active: (m) => has(m, "CPIAUCSL", "m3") && d(m, "CPIAUCSL", "m3") >= 0.3,
    title: (m) => `Enflasyon yükseliyor: son 3 ayda %${n(m.CPIAUCSL.m3!)} → %${n(m.CPIAUCSL.now!)}`,
    effect: (s) => ["Energy", "Materials"].includes(s.sector ?? "")
      ? { sign: 1, why: "Enerji ve hammadde fiyatları enflasyonla birlikte yükselme eğilimindedir; bu sektörler fiyat artışını gelirine yansıtabilir." }
      : GROWTH.has(s.sector ?? "") || RATE_SENSITIVE.has(s.sector ?? "") || (s.pe ?? 0) > 30
        ? { sign: -1, why: "Yükselen enflasyon faiz indirimlerini geciktirir; yüksek değerlemeli ve faize duyarlı hisseler baskı görür." } : null,
  },
  {
    key: "yields_up",
    active: (m) => has(m, "DGS10", "m3") && d(m, "DGS10", "m3") >= 0.3,
    title: (m) => `10 yıllık faiz yükseliyor: son 3 ayda %${n(m.DGS10.m3!, 2)} → %${n(m.DGS10.now!, 2)}`,
    effect: (s) => RATE_SENSITIVE.has(s.sector ?? "")
      ? { sign: -1, why: "Gayrimenkul ve kamu hizmetleri borçla büyür ve tahvile alternatif görülür; faiz yükselince ikisi de cazibe kaybeder." }
      : (s.pe ?? 0) > 35 ? { sign: -1, why: `F/K ${n(s.pe!)} gibi yüksek değerlemeler uzak gelecekteki kâra dayanır; faiz yükseldikçe bu kârın bugünkü değeri düşer.` }
      : (s.debtToEquity ?? 0) > 1.5 ? { sign: -1, why: "Borcu yüksek şirketlerin yeniden borçlanma maliyeti artar." } : null,
  },
  {
    key: "yields_down",
    active: (m) => has(m, "DGS10", "m3") && d(m, "DGS10", "m3") <= -0.3,
    title: (m) => `10 yıllık faiz düşüyor: son 3 ayda %${n(m.DGS10.m3!, 2)} → %${n(m.DGS10.now!, 2)}`,
    effect: (s) => RATE_SENSITIVE.has(s.sector ?? "") || (s.pe ?? 0) > 35 || (s.debtToEquity ?? 0) > 1.5
      ? { sign: 1, why: "Düşen uzun vadeli faiz, borçlu ve yüksek değerlemeli şirketlerin hem finansman maliyetini hem değerleme baskısını azaltır." } : null,
  },
  {
    key: "fed_cutting",
    active: (m) => has(m, "DFF", "m6") && d(m, "DFF", "m6") <= -0.25,
    title: (m) => `Fed faiz indiriyor: 6 ayda %${n(m.DFF.m6!, 2)} → %${n(m.DFF.now!, 2)}`,
    effect: (s) => (s.marketCap ?? Infinity) < 10e9 || ["Real Estate", "Consumer Discretionary"].includes(s.sector ?? "")
      ? { sign: 1, why: "Faiz indirimleri kredi maliyetini düşürür; küçük şirketler, konut ve tüketici harcamasına bağlı sektörler genelde ilk yararlananlardır." } : null,
  },
  {
    key: "fed_hiking",
    active: (m) => has(m, "DFF", "m6") && d(m, "DFF", "m6") >= 0.25,
    title: (m) => `Fed faiz artırıyor: 6 ayda %${n(m.DFF.m6!, 2)} → %${n(m.DFF.now!, 2)}`,
    effect: (s) => (s.marketCap ?? Infinity) < 10e9 || (s.debtToEquity ?? 0) > 1.5 || RATE_SENSITIVE.has(s.sector ?? "")
      ? { sign: -1, why: "Faiz artışları borçlu ve küçük şirketlerin finansmanını zorlaştırır." }
      : s.sector === "Financials" ? { sign: 1, why: "Yüksek faiz bankaların kredi ile mevduat faizi arasındaki marjını genişletebilir." } : null,
  },
  {
    key: "oil_up",
    active: (m) => has(m, "DCOILWTICO", "m3") && pct(m.DCOILWTICO.now!, m.DCOILWTICO.m3!) >= 15,
    title: (m) => `WTI ham petrol 3 ayda %${pct(m.DCOILWTICO.now!, m.DCOILWTICO.m3!)} yükseldi (${n(m.DCOILWTICO.now!, 2)} $)`,
    effect: (s) => s.sector === "Energy" ? { sign: 1, why: "Petrol fiyatı enerji şirketlerinin gelir ve kârını doğrudan artırır." }
      : s.sector === "Consumer Discretionary" ? { sign: -1, why: "Benzin pahalandıkça tüketicinin diğer harcamalara ayırdığı para azalır." }
      : s.sector === "Industrials" ? { sign: -1, why: "Yakıt, taşıma ve hammadde maliyetleri artar; havayolu ve lojistik şirketleri en çok etkilenenlerdir." } : null,
  },
  {
    key: "oil_down",
    active: (m) => has(m, "DCOILWTICO", "m3") && pct(m.DCOILWTICO.now!, m.DCOILWTICO.m3!) <= -15,
    title: (m) => `WTI ham petrol 3 ayda %${-pct(m.DCOILWTICO.now!, m.DCOILWTICO.m3!)} düştü (${n(m.DCOILWTICO.now!, 2)} $)`,
    effect: (s) => s.sector === "Energy" ? { sign: -1, why: "Düşen petrol fiyatı enerji şirketlerinin gelirini azaltır." }
      : ["Consumer Discretionary", "Industrials"].includes(s.sector ?? "") ? { sign: 1, why: "Yakıt maliyeti düşer, tüketicinin cebinde daha çok para kalır." } : null,
  },
  {
    key: "dollar_up",
    active: (m) => has(m, "DTWEXBGS", "m3") && pct(m.DTWEXBGS.now!, m.DTWEXBGS.m3!) >= 3,
    title: (m) => `Dolar güçleniyor: 3 ayda %${pct(m.DTWEXBGS.now!, m.DTWEXBGS.m3!)}`,
    effect: (s) => MULTINATIONAL.has(s.sector ?? "") ? { sign: -1, why: "Bu sektördeki şirketler gelirinin önemli kısmını yurt dışından elde eder; güçlü dolar bu gelirin dolar karşılığını azaltır." } : null,
  },
  {
    key: "dollar_down",
    active: (m) => has(m, "DTWEXBGS", "m3") && pct(m.DTWEXBGS.now!, m.DTWEXBGS.m3!) <= -3,
    title: (m) => `Dolar zayıflıyor: 3 ayda %${-pct(m.DTWEXBGS.now!, m.DTWEXBGS.m3!)}`,
    effect: (s) => MULTINATIONAL.has(s.sector ?? "") ? { sign: 1, why: "Yurt dışı gelirin dolar karşılığı artar, ihracat rekabeti kolaylaşır." } : null,
  },
  {
    key: "jobs_weak",
    active: (m) => has(m, "UNRATE", "y1") && d(m, "UNRATE", "y1") >= 0.4,
    title: (m) => `İşsizlik artıyor: bir yılda %${n(m.UNRATE.y1!)} → %${n(m.UNRATE.now!)}`,
    effect: (s) => CYCLICAL.has(s.sector ?? "") ? { sign: -1, why: "İş piyasası soğudukça tüketim ve yatırım yavaşlar; döngüsel sektörler ilk etkilenenlerdir." }
      : DEFENSIVE.has(s.sector ?? "") ? { sign: 1, why: "Yavaşlama dönemlerinde gıda, sağlık ve elektrik gibi vazgeçilmez harcamalar daha dayanıklıdır." } : null,
  },
  {
    key: "growth_strong",
    active: (m) => (m.A191RL1Q225SBEA?.now ?? 0) >= 2.5,
    title: (m) => `Ekonomi güçlü büyüyor: son çeyrek yıllıklandırılmış %${n(m.A191RL1Q225SBEA.now!)}`,
    effect: (s) => CYCLICAL.has(s.sector ?? "") ? { sign: 1, why: "Güçlü büyüme şirket yatırımlarını, kredi talebini ve tüketimi destekler." } : null,
  },
  {
    key: "contraction",
    active: (m) => m.A191RL1Q225SBEA?.now != null && m.A191RL1Q225SBEA.now < 0,
    title: (m) => `Ekonomi daraldı: son çeyrek %${n(m.A191RL1Q225SBEA.now!)}`,
    effect: (s) => CYCLICAL.has(s.sector ?? "") ? { sign: -1, why: "Daralma döneminde döngüsel şirketlerin satışları ve kârları ilk düşenlerdir." }
      : DEFENSIVE.has(s.sector ?? "") ? { sign: 1, why: "Savunmacı sektörlerin talebi ekonomik döngüden daha az etkilenir." } : null,
  },
  {
    key: "curve_inverted",
    active: (m) => m.T10Y2Y?.now != null && m.T10Y2Y.now < 0,
    title: (m) => `Getiri eğrisi ters (${n(m.T10Y2Y.now!, 2)} puan)`,
    effect: (s) => s.sector === "Financials" ? { sign: -1, why: "Bankalar kısa vadeli borçlanıp uzun vadeli kredi verir; eğri ters olunca bu marj daralır." } : null,
  },
  {
    key: "fear_high",
    active: (m) => (m.VIXCLS?.now ?? 0) >= 25,
    title: (m) => `Piyasada belirsizlik yüksek (VIX ${n(m.VIXCLS.now!)})`,
    effect: (s) => DEFENSIVE.has(s.sector ?? "") ? { sign: 1, why: "Belirsizlik dönemlerinde yatırımcılar savunmacı sektörlere yönelir." }
      : (s.pe ?? 0) > 40 ? { sign: -1, why: "Risk iştahı azaldığında en yüksek değerlemeli hisseler en sert düşenler olur." } : null,
  },
  {
    key: "mortgage_high",
    active: (m) => (m.MORTGAGE30US?.now ?? 0) >= 7,
    title: (m) => `Konut kredisi faizi yüksek (%${n(m.MORTGAGE30US.now!, 2)})`,
    effect: (s) => s.sector === "Real Estate" ? { sign: -1, why: "Yüksek konut kredisi faizi gayrimenkul talebini ve değerlemelerini baskılar." } : null,
  },
  {
    key: "credit_stress",
    active: (m) => (m.BAMLH0A0HYM2?.now ?? 0) >= 5,
    title: (m) => `Kredi piyasasında stres (yüksek getirili tahvil primi ${n(m.BAMLH0A0HYM2.now!, 2)} puan)`,
    effect: (s) => (s.debtToEquity ?? 0) > 1.5 || (s.marketCap ?? Infinity) < 5e9 ? { sign: -1, why: "Borçlu ve küçük şirketlerin borç bulması zorlaşır ve pahalanır." } : null,
  },
];

// The series each condition reads, for the "source and date" line under every macro reason.
const SOURCE: Record<string, string> = {
  inflation_down: "CPIAUCSL", inflation_up: "CPIAUCSL", yields_up: "DGS10", yields_down: "DGS10", fed_cutting: "DFF", fed_hiking: "DFF",
  oil_up: "DCOILWTICO", oil_down: "DCOILWTICO", dollar_up: "DTWEXBGS", dollar_down: "DTWEXBGS", jobs_weak: "UNRATE",
  growth_strong: "A191RL1Q225SBEA", contraction: "A191RL1Q225SBEA", curve_inverted: "T10Y2Y", fear_high: "VIXCLS",
  mortgage_high: "MORTGAGE30US", credit_stress: "BAMLH0A0HYM2",
};
function sourceOf(m: MacroSnapshot, key: string): string | null {
  const s = m[SOURCE[key]];
  if (!s?.date) return null;
  const date = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${s.date}T00:00:00Z`));
  return `${s.name ?? SOURCE[key]} · FRED · ${date} verisi`;
}

export function activeConditions(m: MacroSnapshot): { key: string; title: string }[] {
  return CONDITIONS.filter((c) => c.active(m)).map((c) => ({ key: c.key, title: c.title(m) }));
}

/** Macro conditions in force that touch this stock, with direction and reason. */
export function macroEffects(m: MacroSnapshot, s: StockTraits): MacroEffect[] {
  const out: MacroEffect[] = [];
  for (const c of CONDITIONS) {
    if (!c.active(m)) continue;
    const e = c.effect(s);
    if (e) out.push({ key: c.key, title: c.title(m), text: e.why, tone: e.sign > 0 ? "positive" : "negative", weight: 0.5, source: sourceOf(m, c.key) });
  }
  return out;
}
