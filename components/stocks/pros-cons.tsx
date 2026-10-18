import { AlertTriangle, CircleCheck, CircleMinus } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import type { Point } from "@/lib/insights/stock";

function Column({ title, points, icon, empty }: { title: string; points: Point[]; icon: React.ReactNode; empty: string }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {points.length ? (
        <ul className="space-y-3">
          {points.map((p) => (
            <li key={p.key}>
              <p className="text-sm font-medium">{p.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{p.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">{empty}</p>
      )}
    </div>
  );
}

export function ProsCons({ pros, cons, watch }: { pros: Point[]; cons: Point[]; watch: Point[] }) {
  return (
    <section className="glass-card mt-4 p-5" aria-labelledby="pc-title">
      <h2 id="pc-title" className="flex items-center gap-1 font-semibold">
        Olumlu ve olumsuz yönler
        <InfoTip title="Bu liste nasıl hazırlanıyor?">
          Bilanço, sektör karşılaştırması, fiyat hareketi, haber tonu ve takvimden kurallarla çıkarılır; her madde dayandığı rakamı söyler.
          Şirketi tanımana yardım eder, al ya da sat önerisi değildir.
        </InfoTip>
      </h2>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <Column title="Olumlu yönler" points={pros} icon={<CircleCheck size={18} className="text-gain" aria-hidden />} empty="Verilerde öne çıkan bir güçlü yön yok." />
        <Column title="Olumsuz yönler" points={cons} icon={<CircleMinus size={18} className="text-loss" aria-hidden />} empty="Verilerde öne çıkan bir zayıf yön yok." />
        <Column title="Dikkat edilecekler" points={watch} icon={<AlertTriangle size={18} className="text-secondary" aria-hidden />} empty="Yakın vadede öne çıkan bir olay yok." />
      </div>
      <p className="mt-4 text-xs text-ink-muted">Yatırım tavsiyesi değildir. Geçmiş veriler gelecekteki sonuçları garanti etmez.</p>
    </section>
  );
}
