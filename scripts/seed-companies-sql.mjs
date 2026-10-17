// Prints an idempotent upsert for public.companies from data/sp500-constituents.csv
// (datasets/s-and-p-500-companies, ODC-PDDL). Usage: node scripts/seed-companies-sql.mjs > out.sql
import { readFileSync } from 'node:fs';
import { parseCsv } from './lib-csv.mjs';

const rows = parseCsv(readFileSync(new URL('../data/sp500-constituents.csv', import.meta.url), 'utf8'));
const q = s => (s === '' || s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const values = rows.map(r => {
  const added = /^\d{4}-\d{2}-\d{2}/.test(r['Date added']) ? r['Date added'].slice(0, 10) : '';
  return `(${q(r.Symbol)}, ${Number(r.CIK)}, ${q(r.Security)}, ${q(r['GICS Sector'])}, ${q(r['GICS Sub-Industry'])}, ${q(added)})`;
});
console.log(`insert into public.companies (ticker, cik, name, sector, sub_industry, added_to_index) values
${values.join(',\n')}
on conflict (ticker) do update set cik = excluded.cik, name = excluded.name, sector = excluded.sector,
  sub_industry = excluded.sub_industry, added_to_index = excluded.added_to_index, updated_at = now();
delete from public.companies where ticker not in (${rows.map(r => q(r.Symbol)).join(', ')});`);
console.error(`rows: ${rows.length}, sectors: ${new Set(rows.map(r => r['GICS Sector'])).size}, bad cik: ${rows.filter(r => !Number(r.CIK)).length}`);
