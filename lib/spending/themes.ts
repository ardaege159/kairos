// Spending themes: keyword groups searched in USAspending award text to follow where federal money
// is moving. Keyword search is broad (it matches any award text), so amounts are indicative.

export type Theme = { key: string; name: string; keywords: string[]; why: string; match: RegExp };

export const THEMES: Theme[] = [
  { key: "yapay-zeka", name: "Yapay zekâ", keywords: ["artificial intelligence", "machine learning"],
    match: /\b(artificial intelligence|machine learning|\bAI\b|generative|large language)/i,
    why: "Kurumlar veri analizi, istihbarat ve otomasyon için yapay zekâ alıyor. Artış; yazılım, bulut ve çip şirketlerinin kamu gelirine işaret eder." },
  { key: "uzay", name: "Uzay ve uydu", keywords: ["satellite", "space launch", "spacecraft"],
    match: /\b(satellite|space ?craft|launch vehicle|space launch|orbit)/i,
    why: "Uydu takımyıldızları, fırlatma ve uzay savunması bütçeleri. Fırlatma ve uydu üreticileri doğrudan pay alır." },
  { key: "hipersonik", name: "Hipersonik ve füze", keywords: ["hypersonic", "missile"],
    match: /\b(hypersonic|missile|interceptor)/i,
    why: "Füze, önleyici ve hipersonik silah programları; savunma ana yüklenicileri ve roket motoru üreticilerini besler." },
  { key: "insansiz", name: "İnsansız sistemler", keywords: ["unmanned", "drone", "autonomous"],
    match: /\b(unmanned|drone|UAS|UAV|autonomous)/i,
    why: "İnsansız hava, deniz ve kara araçları. Ukrayna sonrası savunma önceliklerinden; daha küçük üreticilere de pay düşer." },
  { key: "siber", name: "Siber güvenlik", keywords: ["cybersecurity", "cyber security"],
    match: /\b(cyber|zero trust)/i,
    why: "Kamu ağlarının korunması. Siber güvenlik yazılımı ve BT hizmeti şirketleri için tekrarlayan gelir kaynağı." },
  { key: "nukleer", name: "Nükleer", keywords: ["nuclear"],
    match: /\b(nuclear|reactor|uranium)/i,
    why: "Nükleer silah modernizasyonu, denizaltı reaktörleri ve yeni nesil reaktörler; enerji ve savunma şirketlerini etkiler." },
  { key: "gemi", name: "Gemi ve denizaltı", keywords: ["shipbuilding", "submarine"],
    match: /\b(shipbuild|submarine|destroyer|frigate|vessel)/i,
    why: "Donanma gemi inşa programları uzun soluklu ve büyük tutarlıdır; tersaneler ve alt yüklenicileri için yıllarca gelir demektir." },
  { key: "yari-iletken", name: "Yarı iletken ve mikroelektronik", keywords: ["semiconductor", "microelectronics"],
    match: /\b(semiconductor|microelectronic|chip)/i,
    why: "Yerli çip üretimi ve güvenli mikroelektronik programları; CHIPS yasası sonrası hızlanan alan." },
  { key: "kuantum", name: "Kuantum", keywords: ["quantum"],
    match: /\bquantum/i,
    why: "Kuantum bilişim ve algılama araştırmaları. Tutarlar küçük ama erken aşama bir sektörün ilk sinyalleridir." },
  { key: "bulut", name: "Bulut ve veri merkezi", keywords: ["cloud computing", "data center"],
    match: /\b(cloud|data center|datacenter)/i,
    why: "Kurumların bulut göçü ve veri merkezi harcamaları; büyük teknoloji ve BT hizmeti şirketlerine gider." },
  { key: "enerji", name: "Şebeke ve enerji depolama", keywords: ["energy storage", "battery", "electric grid"],
    match: /\b(energy storage|batter(y|ies)|grid|microgrid)/i,
    why: "Elektrik şebekesi, mikro şebeke ve batarya yatırımları; elektrik ekipmanı ve kamu hizmeti şirketlerini etkiler." },
  { key: "biyosavunma", name: "Biyosavunma ve aşı", keywords: ["vaccine", "biodefense", "countermeasure"],
    match: /\b(vaccine|biodefense|countermeasure|pandemic)/i,
    why: "Aşı, salgın hazırlığı ve biyolojik tehditlere karşı ilaç stokları; ilaç ve biyoteknoloji şirketleri için." },
  { key: "mineral", name: "Kritik mineraller", keywords: ["critical mineral", "rare earth"],
    match: /\b(critical mineral|rare earth|lithium|gallium|antimony)/i,
    why: "Nadir toprak ve kritik mineral tedarik zinciri; Çin'e bağımlılığı azaltma politikası madencilik şirketlerine yansır." },
];
export const THEME_BY_KEY = Object.fromEntries(THEMES.map((t) => [t.key, t])) as Record<string, Theme>;

/** Themes a single award text belongs to (description, product/service and industry names). */
export function themesOf(text: string): Theme[] {
  return THEMES.filter((t) => t.match.test(text));
}
