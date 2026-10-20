"use client";

import { useState, useTransition } from "react";
import { StockSearch } from "@/components/stock-search";
import { TickerLogo } from "@/components/ticker-logo";
import { addPosition } from "@/app/(app)/portfoy/actions";
import { formatMoney } from "@/lib/format";

const input = "w-full rounded-[var(--radius-control)] border border-outline-soft bg-elevated/70 px-3 py-2 text-sm outline-none focus:border-primary focus:bg-elevated num";

/** Add a position: pick a ticker (price prefilled), then shares or an amount, price and date. */
export function PositionForm({ portfolioId, today }: { portfolioId: string; today: string }) {
  const [ticker, setTicker] = useState<string | null>(null);
  const [mode, setMode] = useState<"shares" | "amount">("amount");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(today);
  const [message, setMessage] = useState<{ error?: string; ok?: string } | null>(null);
  const [priceNote, setPriceNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Prefill the purchase price with that day's close (or the last trading day before it).
  const prefill = async (t: string, d: string) => {
    try {
      const r = await fetch(`/api/fiyat?t=${encodeURIComponent(t)}&d=${d}`);
      const j = (await r.json()) as { date: string | null; close: number | null };
      if (j.close != null) {
        setPrice(String(Math.round(j.close * 100) / 100));
        setPriceNote(j.date && j.date !== d ? `${j.date} kapanışı (seçilen gün işlem yok)` : `${j.date} kapanışı`);
      } else setPriceNote("Bu tarih için fiyat bulunamadı; fiyatı elle gir.");
    } catch {
      setPriceNote(null);
    }
  };

  const p = Number(price.replace(",", "."));
  const q = Number(qty.replace(",", "."));
  const shares = mode === "shares" ? q : p > 0 ? q / p : 0;
  const total = mode === "shares" ? q * p : q;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker) return setMessage({ error: "Önce bir hisse ya da ETF seç." });
    start(async () => {
      const r = await addPosition(portfolioId, { ticker, shares: Math.round(shares * 10000) / 10000, buy_price: p, buy_date: date });
      if (r.error) setMessage({ error: r.error });
      else {
        setMessage({ ok: `${ticker} eklendi.` });
        setTicker(null);
        setQty("");
        setPrice("");
        setPriceNote(null);
      }
    });
  };

  return (
    <form onSubmit={submit} className="glass-card flex flex-col gap-3 p-5" aria-labelledby="add-title">
      <h2 id="add-title" className="font-semibold">Pozisyon ekle</h2>
      {ticker ? (
        <div className="flex items-center gap-2 text-sm">
          <TickerLogo ticker={ticker} size={24} />
          <span className="font-semibold">{ticker}</span>
          <button type="button" onClick={() => setTicker(null)} className="ml-auto text-primary hover:underline">Değiştir</button>
        </div>
      ) : (
        <div className="flex">
          <StockSearch placeholder="Hisse ya da ETF seç" onSelect={(t, s) => {
            setTicker(t);
            setMessage(null);
            if (date === today && s.price) { setPrice(String(s.price)); setPriceNote("son kapanış"); } else void prefill(t, date);
          }} />
        </div>
      )}
      <div role="group" aria-label="Miktar türü" className="flex self-start rounded-[var(--radius-control)] bg-surface-container/70 p-1 text-xs">
        {(["amount", "shares"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 font-medium ${mode === m ? "bg-elevated text-ink shadow-sm" : "text-ink-muted"}`}>
            {m === "amount" ? "Tutar ($)" : "Adet"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-ink-muted">
          {mode === "amount" ? "Tutar ($)" : "Adet"}
          <input inputMode="decimal" required value={qty} onChange={(e) => setQty(e.target.value)} className={`mt-1 ${input}`} />
        </label>
        <label className="text-xs text-ink-muted">
          Alış fiyatı ($)
          <input inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} className={`mt-1 ${input}`} />
        </label>
        <label className="text-xs text-ink-muted">
          Alış tarihi
          <input type="date" required max={today} value={date} className={`mt-1 ${input}`}
            onChange={(e) => { setDate(e.target.value); if (ticker && e.target.value) void prefill(ticker, e.target.value); }} />
        </label>
      </div>
      {priceNote ? <p className="-mt-1 text-xs text-ink-muted">Alış fiyatı: {priceNote}. İstersen kendi fiyatınla değiştir.</p> : null}
      {shares > 0 && p > 0 ? (
        <p className="text-xs text-ink-muted num">
          {shares.toLocaleString("tr-TR", { maximumFractionDigits: 4 })} adet × {p.toLocaleString("tr-TR")} $ = {formatMoney(total)}
        </p>
      ) : null}
      <button type="submit" disabled={pending}
        className="rounded-[var(--radius-control)] bg-primary transition-colors hover:bg-primary-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Ekleniyor…" : "Portföye ekle"}
      </button>
      {message ? <p role="status" className={`text-sm ${message.error ? "text-loss" : "text-gain"}`}>{message.error ?? message.ok}</p> : null}
      <p className="text-xs text-ink-muted">Geçmiş tarihli alımlar son bir yıl içindeyse değer grafiği o günden başlar.</p>
    </form>
  );
}
