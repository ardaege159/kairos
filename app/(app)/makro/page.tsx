import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck, CircleMinus, Info } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { PageHeader } from "@/components/page-header";
import { Sparkline } from "@/components/sparkline";
import { getMacro } from "@/lib/data/macro";
import { formatDate } from "@/lib/format";
import { GROUPS, realRate, type MacroDef, type MacroView, type Tone } from "@/lib/macro/series";

export const metadata: Metadata = { title: "Makro" };

const n = (v: number, d = 2) => v.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
function fmt(def: MacroDef, v: number | null | undefined): string {
  if (v == null) return "—";
  switch (def.unit) {
    case "%": return `%${n(v)}`;
    case "$": return `${n(v)} $`;
    case "₺": return `${n(v)} ₺`;
    case "bin kişi": return `${v >= 0 ? "+" : "−"}${Math.round(Math.abs(v)).toLocaleString("tr-TR")} bin`;
    default: return n(v);
  }
}
// Change shown in the series' own terms: points for rates, % for prices and indices.
function change(def: MacroDef, now: number, before: number | null | undefined): string | null {
  if (before == null) return null;
  if (def.unit === "%" || def.unit === "puan" || def.unit === "bin kişi") {
    const d = now - before;
    return def.unit === "bin kişi" ? `${d >= 0 ? "+" : "−"}${Math.round(Math.abs(d)).toLocaleString("tr-TR")} bin` : `${d >= 0 ? "+" : "−"}${n(Math.abs(d))} puan`;
  }
  if (!before) return null;
  const p = (now / before - 1) * 100;
  return `${p >= 0 ? "+" : "−"}%${n(Math.abs(p), 1)}`;
}

/** Observation date as released: "Eylül 2026" for monthly data, "2026 2. çeyrek" for quarterly. */
function obsDate(def: MacroDef, iso: string) {
  if (def.freq === "q") return `${iso.slice(0, 4)} ${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}. çeyrek`;
  if (def.freq === "m") return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  return formatDate(iso);
}

const TONE: Record<Tone, { Icon: typeof Info; cls: string }> = {
  positive: { Icon: CircleCheck, cls: "text-gain" },
  negative: { Icon: CircleMinus, cls: "text-loss" },
  neutral: { Icon: Info, cls: "text-primary" },
};

function Card({ v }: { v: MacroView }) {
  const { def, last } = v;
  const spark = v.series.slice(def.transform === "level" && v.series.length > 400 ? -260 : -36).map((o) => o.value);
  const m = last ? change(def, last.value, v.monthAgo?.value) : null;
  const y = last ? change(def, last.value, v.yearAgo?.value) : null;
  return (
    <section className="glass-card flex flex-col gap-2 p-4" aria-labelledby={`m-${def.id}`}>
      <h3 id={`m-${def.id}`} className="flex items-center gap-1 text-sm text-ink-muted">
        {def.name}
        <InfoTip title={def.name}>{def.meaning}</InfoTip>
      </h3>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold num">{fmt(def, last?.value)}</p>
          <p className="text-xs text-ink-muted">{last ? obsDate(def, last.date) : "veri yok"}</p>
        </div>
        <div className="w-28 shrink-0"><Sparkline values={spark} height={36} /></div>
      </div>
      <p className="flex flex-wrap gap-x-3 text-xs text-ink-muted num">
        {m ? <span>{def.freq === "q" ? "Önceki çeyrek" : "1 ay"}: {m}</span> : null}
        {y ? <span>1 yıl: {y}</span> : null}
      </p>
      {v.reading ? (
        <p className={`flex gap-1.5 text-xs ${TONE[v.reading.tone].cls}`}>
          {(() => { const I = TONE[v.reading.tone].Icon; return <I size={14} className="mt-px shrink-0" aria-hidden />; })()}
          <span className="text-ink">{v.reading.text}</span>
        </p>
      ) : null}
    </section>
  );
}

async function Macro() {
  const views = await getMacro();
  if (!views.some((v) => v.last)) {
    return (
      <section className="glass-card max-w-[65ch] p-6">
        <h2 className="font-semibold">Makro veriler henüz yüklenmedi</h2>
        <p className="mt-2 text-sm text-ink-muted">Terminalde <code>npm run veri:makro</code> komutunu çalıştır (birkaç saniye sürer).</p>
      </section>
    );
  }
  const by = Object.fromEntries(views.map((v) => [v.def.id, v]));
  const real = realRate(by.DFF?.last?.value ?? null, by.CPIAUCSL?.last?.value ?? null);
  const signals = views.filter((v) => v.reading).sort((a, b) => (a.reading!.tone === "negative" ? 0 : a.reading!.tone === "neutral" ? 1 : 2) - (b.reading!.tone === "negative" ? 0 : b.reading!.tone === "neutral" ? 1 : 2));
  const negatives = signals.filter((s) => s.reading!.tone === "negative").length;
  const positives = signals.filter((s) => s.reading!.tone === "positive").length;

  return (
    <div className="flex flex-col gap-6">
      <section className="glass-card p-5" aria-labelledby="summary-title">
        <h2 id="summary-title" className="font-semibold">Özet</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {signals.length} göstergeden {negatives} tanesi olumsuz, {positives} tanesi olumlu sinyal veriyor. Göstergeler aynı yönü
          göstermediğinde piyasa genelde kararsız seyreder; tek bir veriden sonuç çıkarma.
        </p>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {real ? (
            <li className="flex gap-2 text-sm"><Info size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden /><span><b>Reel faiz.</b> {real.text}</span></li>
          ) : null}
          {signals.map((s) => {
            const { Icon, cls } = TONE[s.reading!.tone];
            return (
              <li key={s.def.id} className="flex gap-2 text-sm">
                <Icon size={16} className={`mt-0.5 shrink-0 ${cls}`} aria-hidden />
                <span><b>{s.def.name}.</b> {s.reading!.text}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          Açıklanacak veri tarihleri için <Link href="/bugun" className="text-primary hover:underline">Bugün</Link> sayfasındaki takvime bak.
          Kaynak: FRED (St. Louis Fed). Yorumlar kurallarla üretilir, tahmin değildir.
        </p>
      </section>

      {(Object.keys(GROUPS) as MacroDef["group"][]).map((g) => (
        <section key={g} aria-labelledby={`g-${g}`}>
          <h2 id={`g-${g}`} className="mb-3 font-semibold">{GROUPS[g]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {views.filter((v) => v.def.group === g).map((v) => <Card key={v.def.id} v={v} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function MakroPage() {
  return (
    <>
      <PageHeader title="Makro" description="ABD ekonomisinin ve piyasaların nabzı: faizler, enflasyon, istihdam, büyüme, korku endeksi, dolar ve petrol." />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Makro veriler yükleniyor" />}>
        <Macro />
      </Suspense>
    </>
  );
}
