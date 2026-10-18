import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { RISK_LABEL, type RiskReport } from "@/lib/portfolio/analytics";
import { sectorName } from "@/lib/sectors";

const LEVEL_STYLE = {
  low: "bg-gain/10 text-gain",
  medium: "bg-[#eda100]/15 text-[#8a5d00]",
  high: "bg-loss/10 text-loss",
} as const;

export function RiskBadge({ level }: { level: RiskReport["level"] }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_STYLE[level]}`}>{RISK_LABEL[level]}</span>;
}

function Stat({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-ink-muted">
        {label}
        <InfoTip title={label}>{tip}</InfoTip>
      </p>
      <p className="mt-0.5 font-semibold num">{value}</p>
    </div>
  );
}

export function RiskCard({ risk, title = "Risk değerlendirmesi" }: { risk: RiskReport; title?: string }) {
  const p = (v: number | null) => (v == null ? "—" : `%${Math.round(Math.abs(v) * 100)}`);
  return (
    <section className="glass-card p-5" aria-labelledby="risk-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="risk-title" className="flex items-center gap-1 font-semibold">
          {title}
          <InfoTip title="Risk nasıl değerlendiriliyor?">
            Son bir yıllık fiyatlarla, portföyün bugünkü ağırlıkları korunmuş gibi hesaplanır. Oynaklık temel seviyeyi belirler; tek
            varlığa ya da sektöre yoğunlaşma, düşük çeşitlendirme, yüksek beta ve kaldıraçlı/kripto/zarar eden varlıklar riski artırır.
            Geçmiş oynaklık gelecekteki riski garanti etmez.
          </InfoTip>
        </h2>
        <RiskBadge level={risk.level} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Yıllık oynaklık" value={p(risk.vol)} tip="Günlük getirilerin standart sapmasının yıllığa çevrilmiş hali. S&P 500 genelde %15-20 civarındadır." />
        <Stat label="En derin düşüş" value={risk.drawdown == null ? "—" : `−${p(risk.drawdown)}`} tip="Son bir yılda portföyün zirvesinden yaşayacağı en büyük düşüş." />
        <Stat label="Beta" value={risk.beta == null ? "—" : risk.beta.toFixed(2)} tip="Piyasa (SPY) %1 hareket ettiğinde portföyün ortalama ne kadar hareket ettiği. 1'den büyükse piyasadan daha oynak." />
        <Stat label="Etkin varlık sayısı" value={risk.effectiveHoldings.toFixed(1)} tip="Ağırlıkları hesaba katarak portföyün kaç eşit ağırlıklı varlığa denk geldiği. Düşükse çeşitlendirme zayıftır." />
      </div>
      {risk.maxSector ? (
        <p className="mt-3 text-xs text-ink-muted">
          En büyük grup: {risk.maxSector.sector === "ETF" ? "ETF'ler" : sectorName(risk.maxSector.sector)} (%{Math.round(risk.maxSector.weight * 100)})
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {risk.reasons.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm">
            {r.tone === "positive" ? <TrendingUp size={16} className="mt-0.5 shrink-0 text-gain" aria-label="olumlu" />
              : r.tone === "negative" ? <TrendingDown size={16} className="mt-0.5 shrink-0 text-loss" aria-label="olumsuz" />
              : <Minus size={16} className="mt-0.5 shrink-0 text-outline" aria-label="nötr" />}
            <span className="text-ink-muted">{r.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
