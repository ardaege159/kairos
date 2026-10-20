"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * Small "i" button that explains a term. Opens on hover and keyboard focus, toggles on tap,
 * closes with Escape or an outside tap.
 */
export function InfoTip({
  title,
  children,
  formula,
  align = "start",
}: {
  title: string;
  children: React.ReactNode;
  formula?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`${title} nedir?`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-outline hover:text-primary"
      >
        <Info size={14} strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-6 z-30 w-72 max-w-[80vw] rounded-[var(--radius-control)] border border-outline-soft bg-elevated p-3 text-left text-sm font-normal text-ink shadow-[0_10px_30px_rgb(99_102_241/0.18)] ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          <span className="block font-semibold">{title}</span>
          <span className="mt-1 block leading-relaxed text-ink-muted">{children}</span>
          {formula ? <span className="mt-2 block border-t border-outline-soft/60 pt-2 text-xs text-ink-muted">Hesap: {formula}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
