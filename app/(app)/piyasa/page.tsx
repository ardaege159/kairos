import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewsList } from "@/components/news/news-list";
import { TopicPulse } from "@/components/news/topic-pulse";
import { PageHeader } from "@/components/page-header";
import { getNews, requestTime } from "@/lib/data/news";
import { TOPICS, TOPIC_LABEL } from "@/lib/news/topics";

export const metadata: Metadata = { title: "Piyasa ve haberler" };

async function Market({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const topic = typeof sp.konu === "string" && TOPIC_LABEL[sp.konu] ? sp.konu : undefined;
  const [now, recent, global, company] = await Promise.all([
    requestTime(),
    getNews({ kind: "global", hours: 48, limit: 150 }),
    getNews({ kind: "global", topic, limit: 40 }),
    getNews({ kind: "company", topic, limit: 40 }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Konu" className="flex flex-wrap gap-2">
        <Link href="/piyasa" aria-current={!topic ? "page" : undefined}
          className={`rounded-full px-3 py-1 text-sm ${!topic ? "bg-primary text-white" : "bg-white/60 text-ink-muted hover:text-ink"}`}>
          Tümü
        </Link>
        {TOPICS.map((t) => (
          <Link key={t.key} href={`/piyasa?konu=${t.key}`} aria-current={topic === t.key ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${topic === t.key ? "bg-primary text-white" : "bg-white/60 text-ink-muted hover:text-ink"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="glass-card p-5 lg:col-span-2" aria-labelledby="global-title">
          <h2 id="global-title" className="mb-3 font-semibold">{topic ? `${TOPIC_LABEL[topic]}: küresel gelişmeler` : "Küresel gelişmeler"}</h2>
          <NewsList now={now} items={global} emptyText="Bu konuda yakın zamanda haber yok." />
        </section>
        <div className="flex flex-col gap-4">
          <section className="glass-card p-5" aria-labelledby="pulse-title">
            <h2 id="pulse-title" className="mb-3 font-semibold">Son 48 saatte konular</h2>
            <TopicPulse items={recent} linkBase="/piyasa" />
          </section>
          <section className="glass-card p-5" aria-labelledby="company-title">
            <h2 id="company-title" className="mb-3 font-semibold">Şirket haberleri</h2>
            <NewsList now={now} items={company} emptyText="Bu konuda şirket haberi yok." />
          </section>
        </div>
      </div>
    </div>
  );
}

export default function PiyasaPage({ searchParams }: PageProps<"/piyasa">) {
  return (
    <>
      <PageHeader title="Piyasa ve haberler" description="Hisselerle eşleşmiş şirket haberleri ve piyasayı etkileyen küresel gelişmeler, konulara göre." />
      <Suspense fallback={<div className="glass-card h-96 animate-pulse" aria-label="Haberler yükleniyor" />}>
        <Market searchParams={searchParams} />
      </Suspense>
    </>
  );
}
