// Plain-language reading of one federal contract action: what was bought, how big it is for the
// company and what kind of revenue it implies. Rule-based; every point cites the numbers it uses.
import { themesOf, type Theme } from "./themes.ts";

export type ActionInput = {
  amount: number;
  action_date: string;
  modification: string | null;
  award_type: string | null;
  description: string | null;
  agency: string | null;
  sub_agency: string | null;
  naics_desc: string | null;
  psc_desc: string | null;
  total_obligation: number | null;
  potential_value: number | null;
  pop_start: string | null;
  pop_end: string | null;
  competition: string | null;
  offers: number | null;
};
export type CompanyContext = { name: string; revenue: number | null; federal12m: number | null } | null;
export type Point = { title: string; detail: string; tone: "positive" | "negative" | "neutral" };

const x = (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
export const money = (v: number) =>
  Math.abs(v) >= 1e9 ? `${x(v / 1e9)} milyar $` : Math.abs(v) >= 1e6 ? `${x(v / 1e6)} milyon $` : `${x(v / 1e3)} bin $`;
const pct = (v: number) => `%${(v * 100).toLocaleString("tr-TR", { maximumFractionDigits: v < 0.01 ? 2 : 1 })}`;

// Agency -> what its money usually signals.
const AGENCIES: [RegExp, string][] = [
  [/defense|army|navy|air force|missile|darpa|space force/i, "savunma bütçesinden; Kongre'nin savunma harcama önceliklerini yansıtır"],
  [/aeronautics and space|nasa/i, "NASA bütçesinden; sivil uzay programları"],
  [/veterans/i, "Gaziler İşleri bütçesinden; çoğunlukla süregelen sağlık hizmeti ödemeleri"],
  [/health and human|medicare|centers for disease|national institutes/i, "sağlık bütçesinden"],
  [/energy/i, "Enerji Bakanlığı'ndan; nükleer silah tesisleri, laboratuvarlar ve enerji projeleri"],
  [/homeland/i, "İç Güvenlik bütçesinden; sınır, siber ve afet güvenliği"],
  [/general services/i, "GSA'dan; kurumlar arası ortak alımlar (BT, bina, araç)"],
  [/state|agency for international/i, "dış ilişkiler ve yardım bütçesinden"],
];

const TYPES: [RegExp, string][] = [
  [/delivery order|task order/i, "Mevcut bir çerçeve anlaşma altında verilmiş sipariş. Çerçeve anlaşma şirketin daha önce kazandığı bir ihaledir; bu sipariş onun kullanıldığını gösterir."],
  [/definitive/i, "Doğrudan verilmiş, kapsamı belirli bir sözleşme."],
  [/purchase order/i, "Standart bir satın alma siparişi."],
  [/bpa call/i, "Toplu alım anlaşması (BPA) altında verilmiş bir çağrı siparişi."],
  [/idc|indefinite|idv/i, "Miktarı önceden belirsiz çerçeve sözleşme: tavanı yüksek olsa da gerçek harcama siparişlere bağlıdır."],
];

function years(a: string, b: string) {
  return (Date.parse(b) - Date.parse(a)) / (365.25 * 864e5);
}

export function explainAction(a: ActionInput, company: CompanyContext): { themes: Theme[]; points: Point[] } {
  const points: Point[] = [];
  const isNew = a.modification === "0" || a.modification === "" ;
  const routine = /express report|monthly|invoice|fy\d{2}.*(qtr|quarter)|incremental funding|funding/i.test(a.description ?? "");

  // 1. New business or continuation
  if (isNew && !routine) points.push({ tone: "positive", title: "Yeni sözleşme ya da sipariş",
    detail: "Bu işlem bir sözleşmenin ilk kaydı (değişiklik numarası 0). Yeni iş anlamına gelebilir; ancak çerçeve anlaşmalardaki siparişler de böyle görünür." });
  else if (routine) points.push({ tone: "neutral", title: "Süregelen bir programın dönemsel ödemesi",
    detail: "Açıklama dönemsel bir rapor ya da ek fon aktarımına benziyor. Şirket için yeni iş değil, zaten bilinen bir gelir akışının devamı." });
  else points.push({ tone: "neutral", title: "Mevcut sözleşmeye ek",
    detail: `Sözleşmede ${a.modification} numaralı değişiklik: ek fon, kapsam genişlemesi ya da opsiyon kullanımı. Sözleşmenin sürdüğünü ve büyüyebildiğini gösterir.` });

  // 2. Size for the company
  if (company?.revenue && company.revenue > 0) {
    const share = a.amount / company.revenue;
    const tone = share >= 0.05 ? "positive" : "neutral";
    const level = share >= 0.05 ? "şirket için büyük" : share >= 0.01 ? "kayda değer" : "şirketin ölçeğine göre küçük";
    points.push({ tone, title: `Şirket için önemi: ${level}`,
      detail: `${money(a.amount)}; ${company.name} şirketinin son 12 aylık gelirine (${money(company.revenue)}) oranı ${pct(share)}.${share < 0.01 ? " Tek başına fiyatı etkilemesi beklenmez." : ""}` });
  }
  if (company?.federal12m && company.revenue && company.revenue > 0) {
    const fed = company.federal12m / company.revenue;
    if (fed >= 0.2) points.push({ tone: "neutral", title: "Devlet ana müşterisi",
      detail: `Son 12 ayda federal sözleşmelerden ${money(company.federal12m)} aldı; gelirine oranı yaklaşık ${pct(Math.min(fed, 1))}. Bütçe kararları bu şirket için doğrudan önemlidir.` });
  }

  // 3. Forward visibility
  if (a.potential_value && a.total_obligation != null && a.potential_value > a.total_obligation * 1.5 && a.potential_value > a.amount * 2) {
    points.push({ tone: "positive", title: "İleriye dönük potansiyel",
      detail: `Bugüne kadar ${money(a.total_obligation)} ayrıldı, ama opsiyonlarla birlikte toplam değer ${money(a.potential_value)}. Opsiyonlar kullanılırsa gelecek yıllara gelir taşır (garantili değildir).` });
  }
  if (a.pop_start && a.pop_end) {
    const y = years(a.pop_start, a.pop_end);
    if (y >= 2) points.push({ tone: "positive", title: "Çok yıllık iş",
      detail: `İş süresi ${a.pop_start.slice(0, 4)}–${a.pop_end.slice(0, 4)} (yaklaşık ${x(y)} yıl): tek seferlik değil, yıllara yayılan gelir.` });
  }

  // 4. Competition
  if (a.competition) {
    if (/not (available for )?compet|not competed|sole/i.test(a.competition)) points.push({ tone: "positive", title: "Rekabetsiz verildi",
      detail: "Sözleşme ihaleye açılmadan verildi; genelde yalnızca bu şirketin sağlayabildiği bir ürün ya da devam eden bir program söz konusudur. Rakiplere karşı güçlü konuma işaret eder." });
    else if (/full and open/i.test(a.competition)) points.push({ tone: "neutral", title: "Açık ihaleyle kazanıldı",
      detail: `Tam rekabetli ihale${a.offers ? ` (${a.offers} teklif)` : ""}: şirket rakiplerine karşı kazandı.` });
  }

  // 5. Contract type and budget
  const type = TYPES.find(([re]) => re.test(a.award_type ?? ""));
  if (type) points.push({ tone: "neutral", title: `Sözleşme türü: ${a.award_type!.toLowerCase()}`, detail: type[1] });
  const agency = AGENCIES.find(([re]) => re.test(`${a.agency ?? ""} ${a.sub_agency ?? ""}`));
  if (agency) points.push({ tone: "neutral", title: "Hangi bütçeden?", detail: `Para ${agency[1]}.` });

  const themes = themesOf([a.description, a.psc_desc, a.naics_desc].filter(Boolean).join(" "));
  return { themes, points };
}
