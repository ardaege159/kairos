import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { TickerLogo } from "@/components/ticker-logo";
import { PAGE_SIZE, screenStocks } from "@/lib/data/stocks";
import { formatMetric, formatMoney, formatPercent, formatPrice } from "@/lib/format";
import { METRIC_BY_KEY, type MetricFormat } from "@/lib/metrics/definitions";
import { FILTERS, FILTER_BY_KEY, PRESETS, UNIT_SUFFIX, filterFormat, parseRanges } from "@/lib/screener";
import { SECTOR_TR, sectorName } from "@/lib/sectors";

export const metadata: Metadata = { title: "Tarayıcı" };

type Params = Record<string, string | undefined>;
const flat = (sp: Record<string, string | string[] | undefined>): Params =>
  Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, typeof v === "string" ? v : undefined]));
const href = (p: Params) => `/tarayici?${new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1])).toString()}`;
const input = "w-full rounded-[var(--radius-control)] border border-outline-soft bg-elevated/70 px-2 py-1.5 text-sm outline-none focus:border-primary focus:bg-elevated num";

function fmt(key: string, v: number | null | undefined) {
  const f = filterFormat(key);
  if (f === "score") return v == null ? "—" : String(Math.round(v));
  return formatMetric(v, f as MetricFormat);
}

function FilterForm({ p }: { p: Params }) {
  const activeCount = parseRanges(p).length;
  const groups = [...new Set(FILTERS.map((f) => f.group))];
  const sectors = Object.keys(SECTOR_TR).sort((a, b) => sectorName(a).localeCompare(sectorName(b), "tr"));
  return (
    <form action="/tarayici" className="glass-card flex flex-col gap-4 p-5" aria-label="Tarama ölçütleri">
      <div className="flex flex-wrap items-end gap-4">
        <fieldset className="flex gap-3 text-sm">
          <legend className="mb-1 text-xs text-ink-muted">Evren</legend>
          <label className="flex items-center gap-1.5"><input type="radio" name="evren" value="" defaultChecked={p.evren !== "sp500"} /> Tüm ABD hisseleri</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="evren" value="sp500" defaultChecked={p.evren === "sp500"} /> S&amp;P 500</label>
        </fieldset>
        <label className="text-xs text-ink-muted">
          Sektör
          <select name="sektor" defaultValue={p.sektor ?? ""} className={`mt-1 block ${input}`}>
            <option value="">Tümü</option>
            {sectors.map((s) => <option key={s} value={s}>{sectorName(s)}</option>)}
          </select>
        </label>
      </div>
      <details open={activeCount === 0} className="group">
        <summary className="cursor-pointer text-sm font-medium text-primary select-none">
          {activeCount ? `Ölçütleri düzenle (${activeCount} ölçüt seçili)` : "Ölçütler"}
        </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const items = FILTERS.filter((f) => f.group === g);
          return (
            <fieldset key={g} className="rounded-[var(--radius-control)] border border-outline-soft/60 p-3">
              <legend className="px-1 text-xs font-semibold text-ink-muted">{g}</legend>
              <div className="flex flex-col gap-2">
                {items.map((f) => {
                  const m = METRIC_BY_KEY[f.key];
                  return (
                    <div key={f.key} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate">{f.label}</span>
                        {m ? <InfoTip title={f.label} formula={m.help}>{m.meaning}</InfoTip> : null}
                      </span>
                      <input name={`${f.key}_min`} defaultValue={p[`${f.key}_min`] ?? ""} inputMode="decimal" placeholder="en az"
                        aria-label={`${f.label} en az (${UNIT_SUFFIX[f.unit]})`} className={input} />
                      <input name={`${f.key}_max`} defaultValue={p[`${f.key}_max`] ?? ""} inputMode="decimal" placeholder="en çok"
                        aria-label={`${f.label} en çok (${UNIT_SUFFIX[f.unit]})`} className={input} />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
      </details>
      <p className="text-xs text-ink-muted">Yüzdeleri sayı olarak gir (%15 için 15), piyasa değeri ve hacmi milyar dolar olarak. Boş bırakılan alanlar filtrelenmez; verisi olmayan şirketler o ölçüte uymamış sayılır.</p>
      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-[var(--radius-control)] bg-primary transition-colors hover:bg-primary-strong px-5 py-2 text-sm font-semibold text-white">Tara</button>
        <Link href="/tarayici" className="text-sm text-ink-muted hover:text-primary">Temizle</Link>
      </div>
    </form>
  );
}

async function Results({ p }: { p: Params }) {
  const ranges = parseRanges(p);
  const sort = p.sirala && (p.sirala === "score" || FILTER_BY_KEY[p.sirala]) ? p.sirala : "market_cap";
  const dir = p.yon === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(p.sayfa) || 1);
  const { rows, total } = await screenStocks({ ranges, sector: p.sektor || undefined, sp500Only: p.evren === "sp500", sort, dir, page });
  // Columns: always market cap and score, plus every metric being filtered (or sorted) on.
  const cols = [...new Set(["market_cap", ...ranges.map((r) => r.key), sort, "score"])].filter((k) => FILTER_BY_KEY[k]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sortLink = (k: string) => href({ ...p, sirala: k, yon: sort === k && dir === "desc" ? "asc" : "desc", sayfa: undefined });

  return (
    <section className="glass-card overflow-hidden" aria-labelledby="results-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
        <h2 id="results-title" className="font-semibold">{total.toLocaleString("tr-TR")} hisse uyuyor</h2>
        <p className="text-xs text-ink-muted">Sıralamak için sütun başlığına tıkla.</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-ink-muted">Bu ölçütlere uyan hisse yok. Bir ya da iki sınırı gevşetmeyi dene.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="px-4 py-2.5 text-left font-medium">Hisse</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Fiyat</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Günlük</th>
                {cols.map((k) => (
                  <th key={k} scope="col" className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                    <Link href={sortLink(k)} className="inline-flex items-center gap-1 hover:text-ink">
                      {METRIC_BY_KEY[k]?.short ?? FILTER_BY_KEY[k].label}
                      {sort === k ? (dir === "asc" ? <ArrowUp size={12} aria-label="artan" /> : <ArrowDown size={12} aria-label="azalan" />) : null}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((s) => (
                <tr key={s.ticker} className="border-t border-outline-soft/40 hover:bg-elevated/50">
                  <td className="px-4 py-2.5">
                    <Link href={`/hisseler/${s.ticker}`} className="group flex items-center gap-3">
                      <TickerLogo ticker={s.ticker} size={28} />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold group-hover:text-primary">{s.ticker}</span>
                        <span className="max-w-[16rem] truncate text-xs text-ink-muted">{s.name} · {sectorName(s.sector)}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">{formatPrice(s.price)}</td>
                  <td className={`px-4 py-2.5 text-right ${s.change_1d == null ? "" : s.change_1d >= 0 ? "text-gain" : "text-loss"}`}>{formatPercent(s.change_1d, true)}</td>
                  {cols.map((k) => (
                    <td key={k} className="px-4 py-2.5 text-right whitespace-nowrap">
                      {k === "score" ? fmt(k, s.score) : k === "market_cap" ? formatMoney(s.market_cap) : fmt(k, s.metrics[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <nav aria-label="Sayfalar" className="flex items-center justify-end gap-3 px-5 py-3 text-sm">
          {page > 1 ? <Link href={href({ ...p, sayfa: String(page - 1) })} className="inline-flex items-center hover:text-primary"><ChevronLeft size={16} aria-hidden /> Önceki</Link> : null}
          <span className="text-ink-muted num">{page} / {pages}</span>
          {page < pages ? <Link href={href({ ...p, sayfa: String(page + 1) })} className="inline-flex items-center hover:text-primary">Sonraki <ChevronRight size={16} aria-hidden /></Link> : null}
        </nav>
      ) : null}
    </section>
  );
}

async function Screener({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = flat(await searchParams);
  const active = PRESETS.find((x) => Object.entries(x.params).every(([k, v]) => p[k] === v) && parseRanges(p).length === Object.keys(x.params).length);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="presets-title">
        <h2 id="presets-title" className="mb-2 text-sm font-semibold text-ink-muted">Hazır taramalar</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PRESETS.map((x) => (
            <Link key={x.key} href={href({ ...x.params, evren: p.evren, sektor: p.sektor })} aria-current={active?.key === x.key ? "true" : undefined}
              className={`glass-card block p-4 transition-colors hover:border-primary ${active?.key === x.key ? "ring-2 ring-primary" : ""}`}>
              <p className="font-semibold">{x.name}</p>
              <p className="mt-1 text-xs text-ink-muted">{x.summary}</p>
            </Link>
          ))}
        </div>
      </section>
      <FilterForm key={JSON.stringify(p)} p={p} />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Taranıyor" />}>
        <Results p={p} />
      </Suspense>
      <p className="text-xs text-ink-muted">Tarama sonuçları yalnızca verilere göre bir eleme yapar; yatırım tavsiyesi değildir. Tarama adresini yer imlerine ekleyerek aynı taramayı daha sonra tekrar açabilirsin.</p>
    </div>
  );
}

export default function TarayiciPage({ searchParams }: PageProps<"/tarayici">) {
  return (
    <>
      <PageHeader title="Tarayıcı" description="Binlerce ABD hissesini değerleme, kârlılık, büyüme, borç ve fiyat ölçütlerine göre filtrele." />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Tarayıcı yükleniyor" />}>
        <Screener searchParams={searchParams} />
      </Suspense>
    </>
  );
}
