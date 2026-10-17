import type { MetricFormat } from "@/lib/metrics/definitions";

const num = (digits: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** 5.01e12 -> "5,01 Tn $", 812e6 -> "812 Mn $". */
export function formatMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1e12) return `${sign}${num(2).format(a / 1e12)} Tn $`;
  if (a >= 1e9) return `${sign}${num(a >= 1e11 ? 0 : 1).format(a / 1e9)} Mr $`;
  if (a >= 1e6) return `${sign}${num(0).format(a / 1e6)} Mn $`;
  return `${sign}${num(0).format(a)} $`;
}

export function formatPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${num(2).format(v)} $`;
}

export function formatPercent(v: number | null | undefined, signed = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = num(Math.abs(v) >= 1 ? 0 : 1).format(Math.abs(v * 100));
  const sign = v < 0 ? "−" : signed && v > 0 ? "+" : "";
  return `${sign}%${s}`;
}

export function formatMultiple(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return num(v >= 100 ? 0 : 1).format(v);
}

export function formatMetric(v: number | null | undefined, format: MetricFormat): string {
  switch (format) {
    case "money":
      return formatMoney(v);
    case "price":
      return formatPrice(v);
    case "percent":
      return formatPercent(v);
    case "ratio":
      return v == null || !Number.isFinite(v) ? "—" : num(2).format(v);
    case "multiple":
      return formatMultiple(v);
  }
}

/** "CY2026Q2" -> "Ç2 '26" */
export function formatPeriod(p: string): string {
  const m = /^CY(\d{4})Q([1-4])$/.exec(p);
  return m ? `Ç${m[2]} '${m[1].slice(2)}` : p;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}
