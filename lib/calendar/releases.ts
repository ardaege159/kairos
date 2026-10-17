// FRED release names we show, with Turkish labels and importance (2 = usually moves markets).
export type ReleaseInfo = { pattern: RegExp; label: string; importance: 1 | 2; help: string };

export const RELEASES: ReleaseInfo[] = [
  { pattern: /^Consumer Price Index$/i, label: "Enflasyon (TÜFE)", importance: 2, help: "Tüketici fiyatlarındaki aylık değişim. Beklentiden yüksek gelirse faiz indirimi ihtimali azalır, hisseler genelde baskılanır." },
  { pattern: /^Employment Situation$/i, label: "İstihdam raporu", importance: 2, help: "Tarım dışı istihdam ve işsizlik oranı. Ekonominin gücünü ve Fed'in faiz kararlarını doğrudan etkiler." },
  { pattern: /^Gross Domestic Product$/i, label: "Büyüme (GSYH)", importance: 2, help: "ABD ekonomisinin çeyreklik büyümesi." },
  { pattern: /^Personal Income and Outlays$/i, label: "Kişisel gelir ve harcama (PCE)", importance: 2, help: "Fed'in en çok izlediği enflasyon ölçüsü PCE bu raporla açıklanır." },
  { pattern: /^Producer Price Index$/i, label: "Üretici fiyatları (ÜFE)", importance: 2, help: "Şirketlerin maliyet enflasyonu; tüketici fiyatlarına öncü sayılır." },
  { pattern: /Retail (and Food Services )?Sales|Advance Monthly Sales/i, label: "Perakende satışlar", importance: 2, help: "Tüketici harcamalarının aylık değişimi; ekonominin yaklaşık üçte ikisi tüketimdir." },
  { pattern: /^Job Openings and Labor Turnover Survey$/i, label: "Açık iş pozisyonları (JOLTS)", importance: 1, help: "İş gücü piyasasının ne kadar sıkı olduğunu gösterir." },
  { pattern: /^Unemployment Insurance Weekly Claims Report$/i, label: "Haftalık işsizlik başvuruları", importance: 1, help: "İşten çıkarmalardaki değişimi haftalık olarak gösterir." },
  { pattern: /^New Residential Construction$/i, label: "Konut başlangıçları", importance: 1, help: "Yeni konut inşaatları; faize duyarlı konut sektörünün nabzı." },
  { pattern: /^Existing Home Sales$/i, label: "İkinci el konut satışları", importance: 1, help: "Konut piyasasının talep tarafı." },
  { pattern: /^Industrial Production and Capacity Utilization$/i, label: "Sanayi üretimi", importance: 1, help: "Fabrika, maden ve enerji üretimindeki değişim." },
  { pattern: /^University of Michigan/i, label: "Tüketici güveni (Michigan)", importance: 1, help: "Tüketicilerin ekonomiye ve enflasyona bakışı." },
  { pattern: /Durable Goods/i, label: "Dayanıklı mal siparişleri", importance: 1, help: "Şirketlerin yatırım iştahına öncü gösterge." },
  { pattern: /^Construction Spending$/i, label: "İnşaat harcamaları", importance: 1, help: "Konut ve ticari inşaat harcamaları." },
];

export const FOMC_RELEASE_ID = 9001;
export const FOMC_INFO = {
  label: "Fed faiz kararı (FOMC)",
  help: "Fed'in politika faizini belirlediği toplantının karar günü. Faiz kararı ve açıklama tüm piyasayı etkiler. Yıldızlı toplantılarda Fed üyelerinin faiz ve ekonomi tahminleri de yayımlanır.",
};

export function releaseInfo(name: string): ReleaseInfo | undefined {
  return RELEASES.find((r) => r.pattern.test(name));
}
