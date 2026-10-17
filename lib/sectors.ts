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

export const sectorName = (s: string) => SECTOR_TR[s] ?? s;
