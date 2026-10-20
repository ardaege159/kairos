import { InfoTip } from "@/components/info-tip";
import { Sparkline } from "@/components/sparkline";
import { formatDate } from "@/lib/format";
import { SCORE_PARTS, type ScorePartKey } from "@/lib/score/weights";

function band(score: number) {
  if (score >= 70) return "Sektörüne göre güçlü";
  if (score >= 40) return "Sektör ortalaması civarında";
  return "Sektörüne göre zayıf";
}

/** Score over time from the daily snapshots (score_history); starts accumulating from the first run. */
function ScoreTrend({ history }: { history: { date: string; score: number }[] }) {
  if (!history.length) return null;
  const first = history[0], last = history.at(-1)!;
  const monthAgo = [...history].reverse().find((h) => Date.parse(h.date) <= Date.parse(last.date) - 30 * 864e5) ?? first;
  const delta = last.score - monthAgo.score;
  return (
    <div className="mt-4 border-t border-outline-soft/50 pt-3">
      <p className="flex items-baseline justify-between text-xs text-ink-muted">
        <span>Skor geçmişi</span>
        {history.length > 1 ? (
          <span className={`font-semibold num ${delta > 0 ? "text-gain" : delta < 0 ? "text-loss" : ""}`}>
            {delta > 0 ? "+" : delta < 0 ? "−" : "±"}{Math.abs(delta)} puan · {formatDate(monthAgo.date)}&apos;den beri
          </span>
        ) : null}
      </p>
      {history.length > 1 ? (
        <div className="mt-1"><Sparkline values={history.map((h) => h.score)} height={32} /></div>
      ) : (
        <p className="mt-1 text-xs text-ink-muted">Günlük kayıt {formatDate(first.date)} tarihinde başladı; çizgi her veri güncellemesinde uzar.</p>
      )}
    </div>
  );
}

export function ScoreCard({ score, parts, history = [] }: { score: number | null; parts: Record<string, number>; history?: { date: string; score: number }[] }) {
  const r = 52, c = 2 * Math.PI * r;
  const shown = (Object.keys(SCORE_PARTS) as ScorePartKey[]).filter((k) => SCORE_PARTS[k].weight > 0);
  return (
    <section className="glass-card flex flex-col p-5" aria-labelledby="score-title">
      <h2 id="score-title" className="flex items-center gap-1 font-semibold">
        Kairos Skoru
        <InfoTip title="Kairos Skoru" align="end">
          Hisseyi kendi sektöründeki S&amp;P 500 şirketleriyle karşılaştıran 0–100 arası bir özet. Değerleme, karlılık, büyüme,
          finansal sağlık, fiyat momentumu ve sektörün yönü ayrı ayrı puanlanıp ağırlıklı ortalaması alınır. 50 sektör
          ortalaması demektir. Geçmişi özetler; geleceği tahmin etmez.
        </InfoTip>
      </h2>
      {score == null ? (
        <p className="mt-2 text-sm text-ink-muted">Skor için yeterli veri yok.</p>
      ) : (
        <>
          <div className="relative mx-auto my-4 h-36 w-36">
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" />
                  <stop offset="100%" stopColor="var(--color-secondary)" />
                </linearGradient>
              </defs>
              <circle cx="64" cy="64" r={r} fill="none" stroke="var(--color-surface-high)" strokeWidth="10" />
              <circle cx="64" cy="64" r={r} fill="none" stroke="url(#scoreGrad)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${(score / 100) * c} ${c}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold tracking-tight text-primary num">{score}</span>
              <span className="text-xs text-ink-muted">/ 100</span>
            </div>
          </div>
          <p className="text-center text-sm font-medium">{band(score)}</p>
          <ul className="mt-4 space-y-2.5">
            {shown.map((k) => {
              const v = parts[k];
              return (
                <li key={k} className="text-sm">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 text-ink-muted">
                      {SCORE_PARTS[k].label} <span className="text-xs">(ağırlık %{SCORE_PARTS[k].weight})</span>
                      <InfoTip title={SCORE_PARTS[k].label}>{SCORE_PARTS[k].meaning}</InfoTip>
                    </span>
                    <span className="font-medium num">{v ?? "—"}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-high" aria-hidden>
                    {v != null ? <div className="h-full rounded-full bg-primary" style={{ width: `${v}%` }} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <ScoreTrend history={history} />
          <p className="mt-4 text-xs text-ink-muted">
            Her bölüm, hissenin kendi sektöründeki sıralamasıdır (100 = sektörün en iyisi). Skor bugünkü verileri özetler; getiri tahmini ya
            da yatırım tavsiyesi değildir.
          </p>
        </>
      )}
    </section>
  );
}
