"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "kairos-theme";
const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const LABEL: Record<ThemeChoice, string> = { system: "Tema: sistem", light: "Tema: açık", dark: "Tema: koyu" };

/** Inline script for <head>: applies the saved choice before first paint (no light flash in dark mode). */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();
function read(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "dark" || t === "light" ? t : "system";
  } catch {
    return "system";
  }
}
function apply(t: ThemeChoice) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // storage blocked: the choice still applies for this page view
  }
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
}

/** Cycles system → light → dark; "system" follows the operating system setting. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => "system" as ThemeChoice,
  );
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <button type="button" onClick={() => apply(next)} aria-label={`${LABEL[theme]}. Değiştirmek için tıkla.`} title={LABEL[theme]}
      className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-elevated/70 hover:text-ink">
      <Icon size={18} aria-hidden />
    </button>
  );
}
