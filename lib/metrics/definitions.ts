// Display metadata for computed metrics. `better` drives sector percentiles and the score.
// `meaning` is the plain-language explanation shown in info tooltips; `help` is the formula.

export type MetricFormat = "money" | "ratio" | "percent" | "multiple" | "price";
export type MetricGroup = "valuation" | "profitability" | "growth" | "health" | "price";

export type MetricDef = {
  key: string;
  label: string;
  short?: string;
  group: MetricGroup;
  format: MetricFormat;
  better: "higher" | "lower" | null;
  help: string;
  meaning: string;
};

export const METRICS: MetricDef[] = [
  {
    key: "market_cap", label: "Piyasa değeri", group: "valuation", format: "money", better: null,
    help: "Fiyat × dolaşımdaki hisse sayısı.",
    meaning: "Borsanın şirkete bugün biçtiği toplam değer. Şirketin büyüklüğünü gösterir; iyi ya da kötü olduğunu değil.",
  },
  {
    key: "pe", label: "Fiyat/Kazanç", short: "F/K", group: "valuation", format: "multiple", better: "lower",
    help: "Piyasa değeri ÷ son 12 ay net kâr. Zarar edenlerde hesaplanmaz.",
    meaning: "Yatırımcılar şirketin 1 yıllık kârının kaç katını ödüyor? 20 ise, şirket bugünkü kârıyla piyasa değerini 20 yılda kazanır. Düşük F/K hissenin kârına göre ucuz olduğunu, yüksek F/K ise pahalı olduğunu ya da piyasanın hızlı büyüme beklediğini gösterir. En anlamlısı aynı sektörle karşılaştırmaktır.",
  },
  {
    key: "pb", label: "Piyasa değeri/Defter değeri", short: "PD/DD", group: "valuation", format: "multiple", better: "lower",
    help: "Piyasa değeri ÷ özsermaye.",
    meaning: "Borsa şirkete, defterdeki öz varlıklarının kaç katı değer biçiyor? 1'in altı, şirketin varlıklarından daha ucuza satıldığını gösterir. Yazılım gibi varlığı az, markası güçlü şirketlerde doğal olarak yüksektir; bankalarda daha anlamlıdır.",
  },
  {
    key: "ps", label: "Fiyat/Satış", short: "F/S", group: "valuation", format: "multiple", better: "lower",
    help: "Piyasa değeri ÷ son 12 ay gelir.",
    meaning: "Şirketin 1 dolarlık satışı için kaç dolar ödeniyor? Henüz kâr etmeyen şirketleri değerlemede işe yarar, çünkü F/K onlarda hesaplanamaz.",
  },
  {
    key: "ev_sales", label: "Firma değeri/Satış", short: "FD/S", group: "valuation", format: "multiple", better: "lower",
    help: "(Piyasa değeri + uzun vadeli borç − nakit) ÷ son 12 ay gelir.",
    meaning: "F/S'ye benzer ama borcu da hesaba katar: şirketi tamamen satın alan biri borcunu da üstlenir, kasasındaki nakdi de alır. Borçlu şirketleri borçsuzlarla karşılaştırırken daha adildir.",
  },
  {
    key: "eps_ttm", label: "Hisse başı kâr (12 ay)", group: "valuation", format: "price", better: null,
    help: "Son 12 ay net kâr ÷ hisse sayısı.",
    meaning: "Bir hisseye düşen yıllık kâr. Tek başına değil, yıldan yıla nasıl değiştiğine bakarak yorumlanır; büyüyorsa şirket hissedarı için daha çok kazanıyor demektir.",
  },

  {
    key: "gross_margin", label: "Brüt marj", group: "profitability", format: "percent", better: "higher",
    help: "Son 12 ay brüt kâr ÷ gelir.",
    meaning: "Ürünü üretmenin doğrudan maliyeti çıktıktan sonra her 100 dolarlık satıştan kalan para. Yüksek brüt marj güçlü fiyatlama gücüne işaret eder. Bankalar gibi bazı şirketler bu kalemi raporlamaz.",
  },
  {
    key: "operating_margin", label: "Faaliyet marjı", group: "profitability", format: "percent", better: "higher",
    help: "Son 12 ay faaliyet kârı ÷ gelir.",
    meaning: "Üretim, maaş, kira, pazarlama gibi tüm işletme giderlerinden sonra her 100 dolarlık satıştan kalan para. Şirketin asıl işinin ne kadar kârlı olduğunu gösterir; faiz ve vergiyi içermez.",
  },
  {
    key: "net_margin", label: "Net marj", group: "profitability", format: "percent", better: "higher",
    help: "Son 12 ay net kâr ÷ gelir.",
    meaning: "Faiz ve vergi dahil her şey ödendikten sonra her 100 dolarlık satıştan kalan kâr. Tek seferlik gelir veya giderler bu oranı bir dönemliğine şişirebilir ya da düşürebilir.",
  },
  {
    key: "roe", label: "Özsermaye kârlılığı", short: "ROE", group: "profitability", format: "percent", better: "higher",
    help: "Son 12 ay net kâr ÷ özsermaye.",
    meaning: "Hissedarların şirkete bıraktığı her 100 dolarla yılda kaç dolar kâr ediliyor? %15 üstü genelde güçlü sayılır. Çok yüksekse (Apple'daki gibi) şirket hisse geri alımıyla özsermayesini küçültmüş olabilir; borcu da kontrol et.",
  },
  {
    key: "roa", label: "Aktif kârlılığı", short: "ROA", group: "profitability", format: "percent", better: "higher",
    help: "Son 12 ay net kâr ÷ toplam varlıklar.",
    meaning: "Şirketin sahip olduğu tüm varlıklarla ne kadar verimli kâr ettiği. Bankalar gibi varlığı çok büyük şirketlerde doğal olarak düşüktür, o yüzden sektör içinde karşılaştır.",
  },

  {
    key: "revenue_growth_yoy", label: "Gelir büyümesi (çeyrek, yıllık)", group: "growth", format: "percent", better: "higher",
    help: "Son çeyrek geliri ÷ bir yıl önceki aynı çeyrek − 1.",
    meaning: "Son çeyrekte satışlar geçen yılın aynı çeyreğine göre ne kadar arttı? Aynı çeyrekleri karşılaştırmak mevsimsellik etkisini (ör. yılbaşı satışları) ortadan kaldırır.",
  },
  {
    key: "net_income_growth_yoy", label: "Net kâr büyümesi (çeyrek, yıllık)", group: "growth", format: "percent", better: "higher",
    help: "Son çeyrek net kârı ÷ bir yıl önceki aynı çeyrek − 1. Önceki çeyrek zarardaysa hesaplanmaz.",
    meaning: "Son çeyrekte kâr geçen yılın aynı çeyreğine göre ne kadar arttı? Gelirden daha hızlı büyüyorsa şirket daha verimli çalışmaya başlamış demektir.",
  },
  {
    key: "revenue_growth_ttm", label: "Gelir büyümesi (12 ay)", group: "growth", format: "percent", better: "higher",
    help: "Son 12 ay geliri ÷ önceki 12 ay − 1.",
    meaning: "Son bir yılın toplam satışlarının bir önceki yıla göre değişimi. Tek bir çeyreğe göre daha az dalgalıdır; büyümenin kalıcı olup olmadığını görmek için iyidir.",
  },

  {
    key: "debt_to_equity", label: "Borç/Özsermaye", group: "health", format: "ratio", better: "lower",
    help: "Uzun vadeli borç ÷ özsermaye.",
    meaning: "Şirket her 1 dolarlık öz kaynağına karşılık kaç dolar uzun vadeli borç taşıyor? 1'in altı genelde rahat sayılır. Yüksek borç, faizler yükselince ya da satışlar düşünce şirketi zorlayabilir. Kamu hizmetleri gibi sektörlerde doğal olarak yüksektir.",
  },
  {
    key: "current_ratio", label: "Cari oran", group: "health", format: "ratio", better: "higher",
    help: "Dönen varlıklar ÷ kısa vadeli borçlar.",
    meaning: "Şirket önümüzdeki 1 yıl içinde ödemesi gereken borçlarını, 1 yıl içinde nakde dönecek varlıklarıyla kaç kez ödeyebilir? 1'in altı kısa vadeli nakit sıkışıklığına işaret edebilir; 1,5–2 arası genelde rahattır.",
  },
  {
    key: "net_cash", label: "Net nakit", group: "health", format: "money", better: null,
    help: "Nakit − uzun vadeli borç. Negatifse net borç.",
    meaning: "Şirket kasasındaki nakitle tüm uzun vadeli borcunu kapatsa elinde ne kalır? Pozitifse net nakit, negatifse net borç pozisyonundadır.",
  },

  {
    key: "return_1m", label: "1 ay getiri", group: "price", format: "percent", better: "higher",
    help: "Son 21 işlem günü.",
    meaning: "Hisse fiyatının son bir aydaki değişimi. Kısa vadeli hareketler çoğu zaman haberlere ve genel piyasaya bağlıdır.",
  },
  {
    key: "return_3m", label: "3 ay getiri", group: "price", format: "percent", better: "higher",
    help: "Son 63 işlem günü.",
    meaning: "Hisse fiyatının son üç aydaki değişimi. Kairos Skoru'nun momentum bölümünde kullanılır.",
  },
  {
    key: "return_1y", label: "1 yıl getiri", group: "price", format: "percent", better: "higher",
    help: "Son 252 işlem günü.",
    meaning: "Hisse fiyatının son bir yıldaki değişimi (temettü hariç).",
  },
  {
    key: "high_52w", label: "52 hafta en yüksek", group: "price", format: "price", better: null,
    help: "Son 252 işlem günündeki en yüksek fiyat.",
    meaning: "Son bir yılda hissenin gördüğü en yüksek fiyat. Bugünkü fiyatın buna ne kadar yakın olduğu, hissenin zirvede mi düşüşte mi olduğunu gösterir.",
  },
  {
    key: "dollar_volume", label: "Günlük işlem hacmi", short: "Hacim", group: "price", format: "money", better: null,
    help: "Son 20 işlem gününde ortalama kapanış fiyatı × işlem gören adet.",
    meaning: "Hisse ya da ETF'te her gün ortalama ne kadarlık alım satım yapıldığı. Yüksek hacim, kolay alınıp satılabildiğini (likidite) ve piyasanın ilgisini gösterir. ETF'lerin büyüklüğünü kıyaslamak için en pratik ölçüdür.",
  },
  {
    key: "low_52w", label: "52 hafta en düşük", group: "price", format: "price", better: null,
    help: "Son 252 işlem günündeki en düşük fiyat.",
    meaning: "Son bir yılda hissenin gördüğü en düşük fiyat.",
  },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<string, MetricDef>;

export const GROUP_LABELS: Record<MetricGroup, string> = {
  valuation: "Değerleme",
  profitability: "Karlılık",
  growth: "Büyüme",
  health: "Finansal sağlık",
  price: "Fiyat performansı",
};

export const GROUP_MEANINGS: Record<MetricGroup, string> = {
  valuation: "Hissenin şirketin kârına, satışına ve varlıklarına göre ucuz mu pahalı mı olduğu.",
  profitability: "Şirketin satışlarından ve sermayesinden ne kadar kâr çıkardığı.",
  growth: "Satışların ve kârın bir yıl öncesine göre ne kadar arttığı.",
  health: "Şirketin borç yükü ve kısa vadeli ödeme gücü.",
  price: "Hisse fiyatının son dönemdeki hareketi.",
};
