export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-10">{title}</h1>
      {description ? <p className="mt-1 max-w-[65ch] text-ink-muted">{description}</p> : null}
    </header>
  );
}

/** Placeholder shown until the data pipeline for a section is connected. */
export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card max-w-[65ch] p-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{children}</p>
    </section>
  );
}
