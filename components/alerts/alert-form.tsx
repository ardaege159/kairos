"use client";

import { useState, useTransition } from "react";
import { StockSearch } from "@/components/stock-search";
import { TickerLogo } from "@/components/ticker-logo";
import { createAlert, deleteAlert } from "@/app/(app)/bildirimler/actions";
import { ALERT_LABEL, type AlertKind } from "@/lib/alerts/evaluate";

const input = "w-full rounded-[var(--radius-control)] border border-outline-soft bg-elevated/70 px-3 py-2 text-sm outline-none focus:border-primary focus:bg-elevated";

/** Create an alert. With `ticker` the stock is fixed (stock page); without it, a search picks one. */
export function AlertForm({ ticker: fixed, price }: { ticker?: string; price?: number | null }) {
  const [ticker, setTicker] = useState<string | null>(fixed ?? null);
  const [kind, setKind] = useState<AlertKind>("price_below");
  const [threshold, setThreshold] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker) return setMsg({ error: "Önce bir hisse seç." });
    start(async () => {
      const r = await createAlert({ ticker, kind, threshold: Number(threshold.replace(",", ".")), note });
      setMsg(r);
      if (r.ok) { setThreshold(""); setNote(""); if (!fixed) setTicker(null); }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Alarm kur">
      {!fixed ? (
        ticker ? (
          <div className="flex items-center gap-2 text-sm">
            <TickerLogo ticker={ticker} size={22} /><span className="font-semibold">{ticker}</span>
            <button type="button" onClick={() => setTicker(null)} className="ml-auto text-primary hover:underline">Değiştir</button>
          </div>
        ) : (
          <div className="flex"><StockSearch placeholder="Alarm için hisse seç" onSelect={(t) => { setTicker(t); setMsg(null); }} /></div>
        )
      ) : null}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <label className="text-xs text-ink-muted">
          Koşul
          <select value={kind} onChange={(e) => setKind(e.target.value as AlertKind)} className={`mt-1 ${input}`}>
            {(Object.keys(ALERT_LABEL) as AlertKind[]).map((k) => <option key={k} value={k}>{ALERT_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-muted">
          Eşik
          <input required inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)}
            placeholder={kind.startsWith("price") && price ? String(Math.round(price)) : kind === "move_abs" ? "5" : "60"} className={`mt-1 num ${input}`} />
        </label>
      </div>
      <label className="text-xs text-ink-muted">
        Not (isteğe bağlı)
        <input value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="ör. destek seviyesi, ekleme yap" className={`mt-1 ${input}`} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-[var(--radius-control)] bg-primary transition-colors hover:bg-primary-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Kaydediliyor…" : "Alarm kur"}
      </button>
      {msg ? <p role="status" className={`text-sm ${msg.error ? "text-loss" : "text-gain"}`}>{msg.error ?? msg.ok}</p> : null}
    </form>
  );
}

export function DeleteAlertButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => deleteAlert(id))} className="text-xs text-ink-muted hover:text-loss disabled:opacity-50">
      {pending ? "Siliniyor…" : "Sil"}
    </button>
  );
}
