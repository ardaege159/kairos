// GICS sector names are stored in English (source data); show them in Turkish.
export const SECTOR_TR: Record<string, string> = {
  "Information Technology": "Bilgi teknolojileri",
  "Health Care": "Sağlık",
  Financials: "Finans",
  "Consumer Discretionary": "İhtiyari tüketim",
  "Communication Services": "İletişim hizmetleri",
  Industrials: "Sanayi",
  "Consumer Staples": "Temel tüketim",
  Energy: "Enerji",
  Utilities: "Kamu hizmetleri",
  "Real Estate": "Gayrimenkul",
  Materials: "Hammadde",
};

/** SPDR Select Sector ETFs: the usual price proxy for each GICS sector. */
export const SECTOR_ETF: Record<string, string> = {
  "Information Technology": "XLK",
  "Health Care": "XLV",
  Financials: "XLF",
  "Consumer Discretionary": "XLY",
  "Communication Services": "XLC",
  Industrials: "XLI",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  Utilities: "XLU",
  "Real Estate": "XLRE",
  Materials: "XLB",
};

const slugify = (s: string) =>
  s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** URL slug from the Turkish name: "Information Technology" -> "bilgi-teknolojileri". */
export const sectorSlug = (sector: string) => slugify(SECTOR_TR[sector] ?? sector);
export const sectorFromSlug = (slug: string) => Object.keys(SECTOR_TR).find((s) => sectorSlug(s) === slug) ?? null;

export const sectorName = (s: string | null | undefined) => (s ? SECTOR_TR[s] ?? s : "Sektör yok");

type Range = [from: number, to: number, sector: string];

// SEC SIC code -> closest GICS sector, for companies outside the S&P 500 (which carries real GICS).
// Approximate by design: SIC is an industry code from 1937, GICS a market classification. More specific
// ranges come first; the first match wins.
const SIC_RANGES: Range[] = [
  [1531, 1531, "Consumer Discretionary"], // operative builders (homebuilders)
  [2830, 2836, "Health Care"],
  [2840, 2844, "Consumer Staples"], // soap, cosmetics
  [3020, 3021, "Consumer Discretionary"], // rubber footwear
  [3570, 3579, "Information Technology"], // computers
  [3630, 3639, "Consumer Discretionary"], // household appliances
  [3651, 3652, "Consumer Discretionary"], // household audio/video
  [3660, 3679, "Information Technology"], // communications equipment, semiconductors
  [3710, 3716, "Consumer Discretionary"], // motor vehicles and parts
  [3750, 3751, "Consumer Discretionary"], // motorcycles, bicycles
  [3812, 3812, "Industrials"], // defense navigation/electronics
  [3820, 3829, "Information Technology"], // measuring instruments
  [3840, 3851, "Health Care"], // medical instruments
  [3860, 3869, "Information Technology"],
  [3870, 3879, "Consumer Discretionary"], // watches
  [4950, 4959, "Industrials"], // waste management
  [5122, 5122, "Health Care"], // drug wholesale
  [5140, 5149, "Consumer Staples"], // grocery wholesale
  [5331, 5331, "Consumer Staples"], // variety stores
  [5400, 5499, "Consumer Staples"], // food stores
  [5912, 5912, "Consumer Staples"], // drug stores
  [6500, 6553, "Real Estate"],
  [6798, 6798, "Real Estate"], // REITs
  [7310, 7319, "Communication Services"], // advertising
  [7370, 7379, "Information Technology"], // software and IT services
  [7800, 7899, "Communication Services"], // motion pictures
  [8200, 8299, "Consumer Discretionary"], // education
  [8000, 8099, "Health Care"],
  [8700, 8799, "Industrials"], // engineering and management services

  [100, 999, "Consumer Staples"],
  [1000, 1099, "Materials"],
  [1200, 1399, "Energy"],
  [1400, 1499, "Materials"],
  [1500, 1799, "Industrials"],
  [2000, 2199, "Consumer Staples"],
  [2200, 2399, "Consumer Discretionary"],
  [2400, 2499, "Materials"],
  [2500, 2599, "Consumer Discretionary"],
  [2600, 2699, "Materials"],
  [2700, 2799, "Communication Services"],
  [2800, 2899, "Materials"],
  [2900, 2999, "Energy"],
  [3000, 3099, "Materials"],
  [3100, 3199, "Consumer Discretionary"],
  [3200, 3399, "Materials"],
  [3400, 3699, "Industrials"],
  [3700, 3799, "Industrials"],
  [3800, 3899, "Industrials"],
  [3900, 3999, "Consumer Discretionary"],
  [4000, 4799, "Industrials"],
  [4800, 4899, "Communication Services"],
  [4900, 4999, "Utilities"],
  [5000, 5199, "Industrials"],
  [5200, 5999, "Consumer Discretionary"],
  [6000, 6799, "Financials"],
  [7000, 7099, "Consumer Discretionary"],
  [7200, 7299, "Consumer Discretionary"],
  [7300, 7399, "Industrials"],
  [7500, 7599, "Consumer Discretionary"],
  [7900, 7999, "Consumer Discretionary"],
  [8100, 8999, "Industrials"],
  [9995, 9995, "Financials"], // blank checks (SPACs)
];

export function sicToSector(sic: number | null | undefined): string | null {
  if (sic == null) return null;
  return SIC_RANGES.find(([a, b]) => sic >= a && sic <= b)?.[2] ?? null;
}
