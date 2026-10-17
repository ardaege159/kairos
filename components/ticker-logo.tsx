"use client";

import { useState } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;

// Deterministic soft background per ticker for the letter fallback.
const TINTS = ["#e1e0ff", "#f0dbff", "#d7f5e7", "#fde6d8", "#fbe7f0", "#e3eefc"];
const tint = (t: string) => TINTS[[...t].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];

/**
 * Company/ETF logo by ticker from Brandfetch's CDN (their terms ask for hotlinking, not re-hosting,
 * so this is a plain <img>, not next/image). Falls back to a letter badge without a client ID or
 * when the image fails.
 */
export function TickerLogo({ ticker, size = 28, etf = false, className = "" }: { ticker: string; size?: number; etf?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  // Brandfetch maps many small ETF tickers to unrelated brands (even people's photos), so ETFs use the badge.
  if (!CLIENT_ID || failed || etf) {
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-primary-strong ${className}`}
        style={{ ...box, background: tint(ticker), fontSize: Math.max(9, size * 0.36) }}
      >
        {ticker.replace(/[^A-Z]/g, "").slice(0, ticker.length > 3 ? 2 : 3)}
      </span>
    );
  }
  const px = Math.round(size * 2); // 2x for sharp rendering on high-density screens
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Brandfetch requires hotlinking their CDN URL
    <img
      src={`https://cdn.brandfetch.io/ticker/${encodeURIComponent(ticker)}/w/${px}/h/${px}/fallback/lettermark?c=${CLIENT_ID}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="strict-origin-when-cross-origin"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-white object-contain ring-1 ring-outline-soft/60 ${className}`}
      style={box}
    />
  );
}
