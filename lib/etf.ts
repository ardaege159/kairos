// ETF categories from the fund name. Order matters: the first match wins (a "3X Semiconductor"
// fund is leveraged before it is a sector fund). The same word lists build the JS regex used in the
// UI and the Postgres regex used for server-side filtering, so both agree.

export type EtfCategory = { key: string; label: string; help: string; words: string[] };

export const ETF_CATEGORIES: EtfCategory[] = [
  { key: "kaldirac", label: "Kaldıraçlı / ters", help: "Endeksin günlük hareketini 2-3 katına çıkarmayı ya da tersini almayı hedefler. Kısa vadeli işlem için tasarlanır; uzun süre tutulduğunda endeksten çok farklı sonuç verebilir.",
    words: ["2X", "3X", "Ultra", "UltraPro", "UltraShort", "Leveraged", "Inverse", "Bull", "Bear", "Short", "Daily Target"] },
  { key: "kripto", label: "Kripto", help: "Bitcoin, Ether gibi kripto paraları ya da onların vadeli işlemlerini tutar.",
    words: ["Bitcoin", "Ether", "Ethereum", "Crypto", "Solana", "XRP", "Blockchain"] },
  { key: "emtia", label: "Emtia", help: "Altın, gümüş, petrol gibi emtiaları ya da onların vadeli işlemlerini tutar.",
    words: ["Gold", "Silver", "Oil", "Crude", "Commodity", "Commodities", "Natural Gas", "Copper", "Platinum", "Palladium", "Uranium", "Agriculture"] },
  { key: "tahvil", label: "Tahvil / gelir", help: "Devlet, belediye veya şirket tahvilleri gibi faiz getirili varlıklar tutar; genelde hisse fonlarından daha az dalgalıdır.",
    words: ["Bond", "Bonds", "Treasury", "Treasuries", "Muni", "Municipal", "Credit", "Yield", "Aggregate", "TIPS", "Fixed Income", "Loan", "CLO", "Duration", "Mortgage", "Income", "T-Bill", "Bill", "Bills", "Box", "Cash", "Money Market", "Floating Rate", "Securitized", "High Yield"] },
  { key: "uluslararasi", label: "Uluslararası", help: "ABD dışındaki ülkelerin hisselerini tutar.",
    words: ["International", "Emerging", "Europe", "Eurozone", "Japan", "China", "India", "Developed", "ex-US", "ex US", "World", "Global", "Asia", "Brazil", "Korea", "Taiwan", "EAFE", "Mexico", "Canada", "Germany", "Latin America", "ACWI", "All Country", "All-World", "Foreign", "Non-US", "Australia", "Hong Kong", "Singapore", "Vietnam", "Israel", "Saudi", "Italy", "Spain", "France", "United Kingdom", "Switzerland", "South Africa", "Indonesia", "Chile", "Poland", "Turkey", "Euro", "STOXX", "Pacific", "Frontier"] },
  { key: "sektor", label: "Sektör / tema", help: "Yarı iletken, sağlık, temettü gibi belirli bir sektöre ya da temaya odaklanır.",
    words: ["Semiconductor", "Technology", "Tech", "Health", "Healthcare", "Financial", "Financials", "Energy", "Utilities", "Real Estate", "REIT", "Biotech", "Industrial", "Industrials", "Materials", "Consumer", "Communication", "Innovation", "Cybersecurity", "Robotics", "Clean", "Solar", "AI", "Artificial Intelligence", "Cloud", "Defense", "Aerospace", "Bank", "Banks", "Homebuilders", "Retail", "Internet", "Software", "Dividend", "Infrastructure", "Transportation", "Insurance", "Pharmaceutical", "Space", "Nuclear", "Water", "Biotechnology", "Genomic", "Genomics", "Home Construction", "Memory", "Semiconductors", "Gaming", "Esports", "Cannabis", "Lithium", "Battery", "Electric Vehicle", "Autonomous", "Fintech", "Metaverse", "Quantum", "Drone", "Agribusiness", "Natural Resources", "Midstream", "MLP", "Oil & Gas", "Regional Banks", "Medical", "Medical Devices", "Shipping", "Airline", "Airlines", "Travel", "Media", "Pharma"] },
  { key: "genis", label: "Geniş piyasa endeksi", help: "S&P 500, Nasdaq-100, Russell 2000 gibi geniş bir ABD hisse endeksini izler.",
    words: ["S&P 500", "S&P", "Total Market", "Total Stock", "Russell", "Nasdaq", "Nasdaq-100", "QQQ", "Dow", "Mid-Cap", "Small-Cap", "Large-Cap", "Mid Cap", "Small Cap", "Large Cap", "Core", "Value", "Growth", "Equal Weight", "Momentum", "Quality", "Minimum Volatility", "Broad Market", "Large", "Small", "Mid", "Factor", "Equity", "Multi-Factor", "Dividend Growth", "Buffer", "Covered Call", "Option Income", "U.S. Stock"] },
];

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const jsPatterns = ETF_CATEGORIES.map((c) => new RegExp(`(^|[^A-Za-z0-9])(${c.words.map(esc).join("|")})([^A-Za-z0-9]|$)`, "i"));

/** Postgres (ARE) regex for one category; used with the imatch filter. */
export const pgPattern = (c: EtfCategory) => `(^|[^A-Za-z0-9])(${c.words.map(esc).join("|")})([^A-Za-z0-9]|$)`;

export function classifyEtf(name: string): EtfCategory | null {
  const clean = name.replace(/-\s+/g, "-"); // "Large- Cap" -> "Large-Cap"
  const i = jsPatterns.findIndex((p) => p.test(clean));
  return i >= 0 ? ETF_CATEGORIES[i] : null;
}

export const ETF_CATEGORY_BY_KEY = Object.fromEntries(ETF_CATEGORIES.map((c) => [c.key, c])) as Record<string, EtfCategory>;
