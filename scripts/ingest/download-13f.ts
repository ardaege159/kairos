// Download the latest SEC Form 13F bulk data sets (one zip per quarter, ~100 MB each) for small-funds.ts.
//   node --env-file=.env.local scripts/ingest/download-13f.ts --dir=data/13f [--count=9]
// Zips already in the folder are kept; older ones that dropped out of the latest `count` are removed.
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const DIR = arg("dir") ?? "data/13f";
const COUNT = Number(arg("count") ?? 9);
const UA = process.env.SEC_USER_AGENT?.trim();
if (!UA) { console.error("SEC_USER_AGENT gerekli (.env.local)."); process.exit(1); }
mkdirSync(DIR, { recursive: true });

const page = await fetch("https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets", { headers: { "User-Agent": UA } });
if (!page.ok) throw new Error(`SEC listesi alınamadı: HTTP ${page.status}`);
// The page lists the data sets newest first.
const links = [...new Set([...(await page.text()).matchAll(/href="([^"]*form13f\.zip)"/g)].map((m) => m[1]))].slice(0, COUNT);
if (links.length < COUNT) throw new Error(`Yalnızca ${links.length} veri seti bulundu`);

const wanted = new Set(links.map((l) => l.split("/").pop()!));
for (const f of readdirSync(DIR)) if (f.endsWith("_form13f.zip") && !wanted.has(f)) { unlinkSync(`${DIR}/${f}`); console.log("silindi (eski):", f); }

for (const link of links) {
  const name = link.split("/").pop()!;
  const path = `${DIR}/${name}`;
  if (existsSync(path) && statSync(path).size > 10_000_000) { console.log("var:", name); continue; }
  const r = await fetch(new URL(link, "https://www.sec.gov"), { headers: { "User-Agent": UA } });
  if (!r.ok || !r.body) throw new Error(`${name}: HTTP ${r.status}`);
  await pipeline(Readable.fromWeb(r.body as import("node:stream/web").ReadableStream), createWriteStream(path));
  console.log("indirildi:", name, Math.round(statSync(path).size / 1e6), "MB");
  await new Promise((res) => setTimeout(res, 1000));
}
