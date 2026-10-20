// Well-known investors whose US stock portfolios are public through quarterly SEC 13F filings.
// CIKs verified against SEC submissions (filer name and latest 13F-HR) on 2026-10-20.

export type Investor = { key: string; cik: number; person: string; fund: string; style: string; news: string[] };

export const INVESTORS: Investor[] = [
  { key: "buffett", cik: 1067983, person: "Warren Buffett", fund: "Berkshire Hathaway", news: ["Buffett", "Berkshire"],
    style: "Değer yatırımının en bilinen ismi. Güçlü markası ve rekabet avantajı olan şirketleri makul fiyata alıp yıllarca tutar; portföyü az sayıda büyük pozisyonda yoğunlaşır." },
  { key: "ackman", cik: 1336528, person: "Bill Ackman", fund: "Pershing Square", news: ["Ackman", "Pershing Square"],
    style: "Az sayıda (genelde 10'dan az) kaliteli şirkette yoğunlaşır, yönetimi değişime zorlayan aktivist yatırımcıdır." },
  { key: "burry", cik: 1649339, person: "Michael Burry", fund: "Scion Asset Management", news: ["Burry", "Scion"],
    style: "2008 konut krizini önceden gören 'Büyük Açık'ın yatırımcısı. Karşıt görüşlü, sık pozisyon değiştiren bir değer yatırımcısı; fonunu 2025 sonunda kapattı." },
  { key: "druckenmiller", cik: 1536411, person: "Stanley Druckenmiller", fund: "Duquesne Family Office", news: ["Druckenmiller", "Duquesne"],
    style: "Makro trendleri izleyerek sektörler arasında hızlı geçiş yapar; uzun yıllar zarar yılı olmadan yüksek getiri elde etmesiyle bilinir." },
  { key: "dalio", cik: 1350694, person: "Ray Dalio", fund: "Bridgewater Associates", news: ["Dalio", "Bridgewater"],
    style: "Dünyanın en büyük hedge fonlarından. Makro ekonomik modellerle yönetilir; hisse tarafı çok sayıda pozisyona ve ETF'lere yayılmıştır." },
  { key: "tepper", cik: 1656456, person: "David Tepper", fund: "Appaloosa", news: ["Tepper", "Appaloosa"],
    style: "Kriz dönemlerinde ucuzlamış varlıkları cesurca toplamasıyla tanınır; son yıllarda büyük teknoloji ve Çin hisselerinde yoğunlaştı." },
  { key: "loeb", cik: 1040273, person: "Dan Loeb", fund: "Third Point", news: ["Loeb", "Third Point"],
    style: "Aktivist yatırımcı; şirket yönetimlerine açık mektuplarla değişim baskısı yapar." },
  { key: "klarman", cik: 1061768, person: "Seth Klarman", fund: "Baupost Group", news: ["Klarman", "Baupost"],
    style: "Temkinli değer yatırımcısı; 'güvenlik marjı' kavramını öne çıkarır ve uygun fırsat yoksa nakitte beklemekten çekinmez." },
  { key: "icahn", cik: 921669, person: "Carl Icahn", fund: "Icahn Capital", news: ["Icahn"],
    style: "Onlarca yıllık aktivist yatırımcı; büyük paylar alıp yönetim kurulunda söz sahibi olmaya çalışır." },
  { key: "wood", cik: 1697748, person: "Cathie Wood", fund: "ARK Invest", news: ["Cathie Wood", "ARK Invest"],
    style: "Yapay zekâ, genetik, robotik ve kripto gibi 'yıkıcı yenilik' temalarına yatırım yapar; oynaklığı yüksek büyüme hisseleri ağırlıklıdır." },
  { key: "lilu", cik: 1709323, person: "Li Lu", fund: "Himalaya Capital", news: ["Li Lu", "Himalaya Capital"],
    style: "Charlie Munger'ın yakın çalışma arkadaşı; çok az sayıda şirkette uzun vadeli, yoğun pozisyon taşır." },
  { key: "pabrai", cik: 1549575, person: "Mohnish Pabrai", fund: "Dalal Street", news: ["Pabrai"],
    style: "Buffett'ı örnek alan değer yatırımcısı; 'az riskle yüksek getiri' fırsatlarını arar, portföyü birkaç hissede yoğunlaşır." },
  { key: "akre", cik: 1112520, person: "Chuck Akre", fund: "Akre Capital", news: ["Akre"],
    style: "Yüksek sermaye getirisi olan, kârını yeniden yatırabilen 'bileşik büyüme makinesi' şirketleri uzun süre tutar." },
  { key: "smith", cik: 1569205, person: "Terry Smith", fund: "Fundsmith", news: ["Terry Smith", "Fundsmith"],
    style: "'İyi şirketleri al, fazla ödeme, hiçbir şey yapma' felsefesi; yüksek kârlılıklı, istikrarlı şirketleri uzun süre tutar." },
  { key: "soros", cik: 1029160, person: "George Soros", fund: "Soros Fund Management", news: ["Soros"],
    style: "Efsanevi makro yatırımcının aile ofisi; bugün profesyonel ekiplerce yönetilir, portföyü geniş ve sık değişir." },
  { key: "coleman", cik: 1167483, person: "Chase Coleman", fund: "Tiger Global", news: ["Tiger Global", "Chase Coleman"],
    style: "Teknoloji ve internet şirketlerine odaklanan büyüme yatırımcısı." },
  { key: "gates", cik: 1166559, person: "Bill Gates", fund: "Gates Foundation Trust", news: ["Gates Foundation"],
    style: "Gates Vakfı'nın varlıkları; uzun süredir Berkshire, Microsoft ve istikrarlı temettü şirketlerinde yoğunlaşır." },
  { key: "mandel", cik: 1061165, person: "Stephen Mandel", fund: "Lone Pine Capital", news: ["Lone Pine"],
    style: "Temel analize dayalı büyüme yatırımcısı; kaliteli teknoloji ve tüketici şirketlerinde yoğunlaşır." },
  { key: "laffont", cik: 1135730, person: "Philippe Laffont", fund: "Coatue", news: ["Coatue"],
    style: "Teknoloji odaklı yatırımcı; yapay zekâ ve yazılım şirketlerinde ağırlıklıdır." },
];
export const INVESTOR_BY_KEY = Object.fromEntries(INVESTORS.map((i) => [i.key, i])) as Record<string, Investor>;
export const INVESTOR_BY_CIK = new Map(INVESTORS.map((i) => [i.cik, i]));
