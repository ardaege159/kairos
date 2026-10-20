// Macro dashboard: FRED series, how to display them and a rule-based one-line reading of each.
// Pure (tested). Readings describe the data; they are not forecasts.

export type Obs = { date: string; value: number };
export type Tone = "positive" | "negative" | "neutral";
export type Transform = "level" | "yoy" | "mom_diff";
export type MacroDef = {
  id: string;
  name: string;
  group: "faiz" | "enflasyon" | "buyume" | "piyasa";
  transform: Transform;     // what is shown: the level, the % change over 12 months, or the monthly difference
  unit: "%" | "puan" | "$" | "bin kişi" | "endeks" | "₺";
  source?: "fred" | "frankfurter"; // default FRED
  freq?: "m" | "q";         // monthly or quarterly release (default: daily/weekly)
  meaning: string;
  read?: (v: number, ctx: { yearAgo: number | null }) => { text: string; tone: Tone } | null;
};

export const GROUPS: Record<MacroDef["group"], string> = {
  faiz: "Faizler",
  enflasyon: "Enflasyon",
  buyume: "Büyüme ve istihdam",
  piyasa: "Piyasa ve emtia",
};

const pp = (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export const MACRO: MacroDef[] = [
  { id: "DFF", name: "Fed politika faizi", group: "faiz", transform: "level", unit: "%",
    meaning: "Bankaların birbirine gecelik borç verdiği faiz; Fed'in belirlediği hedef aralığın içinde kalır. Yükseldikçe borçlanma pahalanır, hisse değerlemeleri baskılanır." },
  { id: "DGS2", name: "2 yıllık tahvil faizi", group: "faiz", transform: "level", unit: "%",
    meaning: "Piyasanın önümüzdeki iki yılda Fed faizinin nerede olacağına dair beklentisini yansıtır. Fed faizinin altındaysa piyasa indirim bekliyor demektir." },
  { id: "DGS10", name: "10 yıllık tahvil faizi", group: "faiz", transform: "level", unit: "%",
    meaning: "Konut kredisinden şirket değerlemelerine kadar uzun vadeli her şeyin temel faizi. Yükselmesi özellikle büyüme hisselerinin değerlemesini aşağı çeker.",
    read: (v, { yearAgo }) => yearAgo == null ? null : v - yearAgo >= 0.5
      ? { tone: "negative", text: `Bir yılda ${pp(v - yearAgo)} puan yükseldi: uzun vadeli borçlanma pahalandı, yüksek F/K'lı hisseler için baskı.` }
      : v - yearAgo <= -0.5 ? { tone: "positive", text: `Bir yılda ${pp(yearAgo - v)} puan düştü: değerlemeler için destekleyici.` } : null },
  { id: "T10Y2Y", name: "Getiri eğrisi (10Y − 2Y)", group: "faiz", transform: "level", unit: "puan",
    meaning: "Uzun vadeli faiz ile kısa vadeli faiz arasındaki fark. Negatife dönmesi (ters eğri) tarihsel olarak resesyonlardan önce görülmüştür; ancak zamanlaması belirsizdir.",
    read: (v) => v < 0 ? { tone: "negative", text: "Eğri ters: kısa vadeli faiz uzun vadeliden yüksek. Geçmişte resesyonlardan önce görülen bir işaret." }
      : v < 0.5 ? { tone: "neutral", text: "Eğri düz: piyasa uzun vadede güçlü büyüme fiyatlamıyor." }
      : { tone: "positive", text: "Eğri pozitif eğimli: normal bir görünüm." } },
  { id: "MORTGAGE30US", name: "30 yıllık konut kredisi faizi", group: "faiz", transform: "level", unit: "%",
    meaning: "ABD'de konut alımının maliyeti. Yüksek seyretmesi konut, inşaat ve mobilya gibi sektörleri yavaşlatır.",
    read: (v) => v >= 7 ? { tone: "negative", text: "%7'nin üstünde: konut talebi ve inşaat sektörü için baskı." } : null },

  { id: "CPIAUCSL", freq: "m", name: "Enflasyon (TÜFE, yıllık)", group: "enflasyon", transform: "yoy", unit: "%",
    meaning: "Tüketici fiyatlarının bir yılda ne kadar arttığı. Fed'in hedefi yaklaşık %2'dir; hedefin üstünde kalması faiz indirimlerini geciktirir.",
    read: (v) => v > 3 ? { tone: "negative", text: `%${pp(v)}: Fed'in %2 hedefinin belirgin üstünde; faiz indirimi için alan dar.` }
      : v > 2.3 ? { tone: "neutral", text: `%${pp(v)}: hedefin biraz üstünde.` } : { tone: "positive", text: `%${pp(v)}: Fed hedefine yakın.` } },
  { id: "CPILFESL", freq: "m", name: "Çekirdek enflasyon (yıllık)", group: "enflasyon", transform: "yoy", unit: "%",
    meaning: "Gıda ve enerji hariç fiyat artışı. Geçici dalgalanmaları dışarıda bıraktığı için Fed'in asıl izlediği eğilimi daha iyi gösterir.",
    read: (v) => v > 3 ? { tone: "negative", text: "Fiyat artışı enerji dışında da yaygın: kalıcı enflasyon riski." } : null },

  { id: "UNRATE", freq: "m", name: "İşsizlik oranı", group: "buyume", transform: "level", unit: "%",
    meaning: "İş arayıp bulamayanların oranı. Hızlı yükselmesi ekonominin yavaşladığının en güvenilir işaretlerindendir.",
    read: (v, { yearAgo }) => yearAgo == null ? null : v - yearAgo >= 0.5
      ? { tone: "negative", text: `Bir yılda ${pp(v - yearAgo)} puan arttı: iş piyasası soğuyor; geçmişte bu hızda artışlar resesyonlara eşlik etti.` }
      : v - yearAgo <= 0 ? { tone: "positive", text: "Bir yıl öncesine göre artmadı: iş piyasası sağlam." } : null },
  { id: "PAYEMS", freq: "m", name: "Tarım dışı istihdam (aylık değişim)", group: "buyume", transform: "mom_diff", unit: "bin kişi",
    meaning: "Bir ayda eklenen iş sayısı. Ayda 100-150 binin üstü sağlıklı kabul edilir; eksi değerler ekonominin daraldığına işaret eder.",
    read: (v) => v < 0 ? { tone: "negative", text: "Geçen ay istihdam azaldı." } : v < 75 ? { tone: "neutral", text: "İstihdam artışı zayıf." } : { tone: "positive", text: "İstihdam artmaya devam ediyor." } },
  { id: "A191RL1Q225SBEA", freq: "q", name: "GSYH büyümesi (yıllıklandırılmış)", group: "buyume", transform: "level", unit: "%",
    meaning: "Ekonominin son çeyrekte, bu hızla bir yıl sürse ne kadar büyüyeceği. ABD için uzun dönem ortalaması yaklaşık %2'dir.",
    read: (v) => v < 0 ? { tone: "negative", text: "Ekonomi son çeyrekte daraldı." } : v >= 2 ? { tone: "positive", text: "Büyüme uzun dönem ortalamasının üstünde." } : null },

  { id: "VIXCLS", name: "VIX (korku endeksi)", group: "piyasa", transform: "level", unit: "endeks",
    meaning: "S&P 500 opsiyonlarından hesaplanan, önümüzdeki 30 gün için beklenen oynaklık. 20'nin altı sakin, 30'un üstü panik dönemleridir.",
    read: (v) => v >= 30 ? { tone: "negative", text: "Piyasada panik düzeyinde belirsizlik." } : v >= 20 ? { tone: "neutral", text: "Belirsizlik ortalamanın üstünde." } : { tone: "positive", text: "Piyasa sakin." } },
  { id: "BAMLH0A0HYM2", name: "Yüksek getirili tahvil primi", group: "piyasa", transform: "level", unit: "puan",
    meaning: "Riskli şirket tahvillerinin devlet tahviline göre ödediği ek faiz. Açılması yatırımcıların iflas riskinden kaygılandığını gösterir.",
    read: (v) => v >= 5 ? { tone: "negative", text: "Prim yüksek: kredi piyasasında stres var." } : v <= 3.5 ? { tone: "positive", text: "Prim düşük: yatırımcılar risk almaya istekli." } : null },
  { id: "DTWEXBGS", name: "Dolar endeksi (geniş)", group: "piyasa", transform: "level", unit: "endeks",
    meaning: "Doların ticaret ortaklarının paralarına karşı değeri. Güçlü dolar, gelirinin çoğunu yurt dışından elde eden ABD şirketlerinin dolar cinsinden kârını azaltır.",
    read: (v, { yearAgo }) => yearAgo == null ? null : v / yearAgo - 1 >= 0.05
      ? { tone: "negative", text: "Dolar bir yılda %5'ten fazla değer kazandı: çok uluslu şirketlerin yurt dışı kârları için olumsuz." }
      : v / yearAgo - 1 <= -0.05 ? { tone: "positive", text: "Dolar bir yılda %5'ten fazla değer kaybetti: ihracatçı ve çok uluslu şirketler için olumlu." } : null },
  { id: "DCOILWTICO", name: "Petrol (WTI)", group: "piyasa", transform: "level", unit: "$",
    meaning: "ABD ham petrol fiyatı (varil). Yükselişi enerji şirketlerine yarar; havayolları, kimya ve tüketici harcamaları için maliyettir ve enflasyonu besler.",
    read: (v, { yearAgo }) => yearAgo == null ? null : v / yearAgo - 1 >= 0.2
      ? { tone: "neutral", text: `Bir yılda %${Math.round((v / yearAgo - 1) * 100)} arttı: enerji hisseleri için olumlu, enflasyon için yukarı yönlü risk.` }
      : v / yearAgo - 1 <= -0.2 ? { tone: "neutral", text: `Bir yılda %${Math.round((1 - v / yearAgo) * 100)} düştü: enerji hisseleri için baskı, enflasyon için rahatlatıcı.` } : null },
  { id: "USDTRY", name: "Dolar/TL", group: "piyasa", transform: "level", unit: "₺", source: "frankfurter",
    meaning: "Bir doların kaç lira ettiği (Avrupa Merkez Bankası referans kuru). TL değer kaybettikçe dolar cinsinden yatırımların TL karşılığı, hisse fiyatı değişmese bile artar.",
    read: (v, { yearAgo }) => yearAgo == null ? null
      : { tone: "neutral", text: `TL bir yılda dolara karşı %${Math.round((1 - yearAgo / v) * 100)} değer kaybetti: dolar bazlı bir yatırım, hisseler yerinde saysa bile TL'de yaklaşık %${Math.round((v / yearAgo - 1) * 100)} kazandırdı.` } },
];
export const MACRO_BY_ID = Object.fromEntries(MACRO.map((m) => [m.id, m])) as Record<string, MacroDef>;

/** Last observation on or before `date`. `obs` must be sorted by date ascending. */
export function valueAt(obs: Obs[], date: string): Obs | null {
  for (let i = obs.length - 1; i >= 0; i--) if (obs[i].date <= date) return obs[i];
  return null;
}

const shiftDate = (iso: string, months: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

/** Apply the series transform: returns the displayed series (sorted ascending). */
export function transform(obs: Obs[], t: Transform): Obs[] {
  if (t === "level") return obs;
  const out: Obs[] = [];
  obs.forEach((o, i) => {
    if (t === "mom_diff") {
      if (i > 0) out.push({ date: o.date, value: o.value - obs[i - 1].value });
    } else {
      const base = obs.find((x) => x.date === shiftDate(o.date, -12));
      if (base && base.value) out.push({ date: o.date, value: (o.value / base.value - 1) * 100 });
    }
  });
  return out;
}

export type MacroView = { def: MacroDef; series: Obs[]; last: Obs | null; monthAgo: Obs | null; yearAgo: Obs | null; reading: { text: string; tone: Tone } | null };

export function macroView(def: MacroDef, raw: Obs[]): MacroView {
  const series = transform([...raw].sort((a, b) => a.date.localeCompare(b.date)), def.transform);
  const last = series.at(-1) ?? null;
  const monthAgo = last ? valueAt(series, shiftDate(last.date, -1)) : null;
  const yearAgo = last ? valueAt(series, shiftDate(last.date, -12)) : null;
  const reading = last && def.read ? def.read(last.value, { yearAgo: yearAgo?.value ?? null }) : null;
  return { def, series, last, monthAgo: monthAgo?.date === last?.date ? null : monthAgo, yearAgo, reading };
}

/** Latest value and the values 3, 6 and 12 months earlier for every series (input to macro-impact rules). */
export function macroSnapshot(views: MacroView[]): Record<string, { now: number | null; m3: number | null; m6: number | null; y1: number | null }> {
  return Object.fromEntries(views.map((v) => {
    const last = v.last;
    const at = (months: number) => (last ? valueAt(v.series, shiftDate(last.date, -months))?.value ?? null : null);
    return [v.def.id, { now: last?.value ?? null, m3: at(3), m6: at(6), y1: at(12) }];
  }));
}

/** Real policy rate: Fed funds minus headline inflation. */
export function realRate(fedFunds: number | null, inflation: number | null): { value: number; text: string; tone: Tone } | null {
  if (fedFunds == null || inflation == null) return null;
  const v = fedFunds - inflation;
  return v > 1
    ? { value: v, tone: "neutral", text: `Reel faiz +${pp(v)} puan: para politikası sıkı, Fed'in indirim yapmak için alanı var.` }
    : v < 0 ? { value: v, tone: "neutral", text: `Reel faiz ${pp(v)} puan: para politikası gevşek, enflasyon faizden yüksek.` }
    : { value: v, tone: "neutral", text: `Reel faiz ${pp(v)} puan: nötre yakın.` };
}
