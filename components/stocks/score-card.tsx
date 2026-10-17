import { SCORE_PARTS, type ScorePartKey } from "@/lib/score/weights";

function band(score: number) {
  if (score >= 70) return "Sektörüne göre güçlü";
  if (score >= 40) return "Sektör ortalaması civarında";
  return "Sektörüne göre zayıf";
}

export function ScoreCard({ score, parts }: { score: number | null; parts: Record<string, number> }) {
  const r = 52, c = 2 * Math.PI * r;
  const shown = (Object.keys(SCORE_PARTS) as ScorePartKey[]).filter((k) => SCORE_PARTS[k].weight > 0);
  return (
    <section className="glass-card flex flex-col p-5" aria-labelledby="score-title">
      <h2 id="score-title" className="font-semibold">Kairos Skoru</h2>
      {score == null ? (
        <p className="mt-2 text-sm text-ink-muted">Skor için yeterli veri yok.</p>
      ) : (
        <>
          <div className="relative mx-auto my-4 h-36 w-36">
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4648d4" />
                  <stop offset="100%" stopColor="#8127cf" />
                </linearGradient>
              </defs>
              <circle cx="64" cy="64" r={r} fill="none" stroke="#e6e8ea" strokeWidth="10" />
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
                    <span className="text-ink-muted">{SCORE_PARTS[k].label}</span>
                    <span className="font-medium num">{v ?? "—"}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-high" aria-hidden>
                    {v != null ? <div className="h-full rounded-full bg-primary" style={{ width: `${v}%` }} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-ink-muted">
            Her bölüm, hissenin kendi sektöründeki sıralamasıdır (100 = sektörün en iyisi). Haber bileşeni henüz eklenmedi.
            Skor geçmişi özetler, getiri tahmini ya da yatırım tavsiyesi değildir.
          </p>
        </>
      )}
    </section>
  );
}
