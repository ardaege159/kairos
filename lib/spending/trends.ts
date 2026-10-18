// Helpers for federal spending trends: growth, fiscal-quarter labels and NAICS sector names.

/** Year-over-year change; null when there is no meaningful base. */
export function growth(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return current / previous - 1;
}

/** US federal fiscal year starts on 1 October: FY2026 Q1 = Oct–Dec 2025. */
export function fqLabel(fy: number, q: number): string {
  return `MY${String(fy).slice(2)} Ç${q}`;
}

/** The fiscal quarter containing `iso` (YYYY-MM-DD). */
export function fiscalQuarterOf(iso: string): { fy: number; q: number } {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
  return { fy: m >= 10 ? y + 1 : y, q: Math.floor(((m + 2) % 12) / 3) + 1 };
}

const NAICS_SECTORS: [string, string][] = [
  ["11", "Tarım"], ["21", "Madencilik ve enerji çıkarımı"], ["22", "Kamu hizmetleri"], ["23", "İnşaat"],
  ["31", "İmalat"], ["32", "İmalat"], ["33", "İmalat"], ["42", "Toptan ticaret"], ["44", "Perakende"], ["45", "Perakende"],
  ["48", "Ulaştırma"], ["49", "Ulaştırma ve depolama"], ["51", "Bilgi ve yazılım"], ["52", "Finans ve sigorta"],
  ["53", "Gayrimenkul ve kiralama"], ["54", "Mühendislik, Ar-Ge ve danışmanlık"], ["55", "Holding yönetimi"],
  ["56", "İdari destek ve tesis hizmetleri"], ["61", "Eğitim"], ["62", "Sağlık hizmetleri"], ["71", "Eğlence"],
  ["72", "Konaklama ve yiyecek"], ["81", "Diğer hizmetler"], ["92", "Kamu yönetimi"],
];
const NAICS_MAP = new Map(NAICS_SECTORS);
export const naicsSector = (code: string) => NAICS_MAP.get(code.slice(0, 2)) ?? "Diğer";
