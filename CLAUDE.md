# Kairos

Kişisel kullanım için ABD hisse analiz sitesi: S&P 500 temel analiz (çeyreklik bilanço, F/K, PD/DD…), 15 dk gecikmeli fiyat + grafikler, hisseyle eşleşmiş haberler, global gündem, hisseyle eşleşmiş ABD federal harcamaları ve **Kairos Skoru** (0–100). Tam plan ve veri kaynağı test sonuçları: `PLAN.md`.

## Kullanıcı ve dil
- Kullanıcıyla **Türkçe** konuş. Arayüz metinleri Türkçe; kod, değişken ve commit mesajları İngilizce.
- Kullanıcı Claude Code'da yeni; teknik adımları kısa ve net anlat.

## Kararlar (değiştirmeden önce sor)
- Stack: Next.js (App Router, TypeScript) + Tailwind + Supabase (Postgres, Auth, RLS) + Vercel. Grafik: Recharts.
- Erişim: Supabase e-posta girişi, yalnızca sahibi. Tüm tablolarda RLS.
- Evren: S&P 500 + kullanıcının ek hisseleri (`data/extra-tickers.csv`, `companies.in_sp500=false`; sektör istatistiklerine girmez, S&P sektör eşlerine göre sıralanır). Yalnızca ücretsiz veri kaynakları.
- Tasarım: `design/DESIGN.md` esas (Geist, cam efekti, primary `#4648d4`, secondary `#8127cf`). Stitch React export'undaki `#6366f1` yanlış, kullanma.
- LLM Council yalnızca geliştirmede (kullanıcı isterse); üründe yok.

## Veri kaynakları
| Alan | Kaynak | Not |
|---|---|---|
| Evren | Alpaca  (NASDAQ/NYSE/ARCA/BATS/AMEX; OTC, warrant, unit, preferred, yatırım fonu yok) + SEC  (CIK) + SEC submissions (SIC, DB'de önbellekli) | ; S&P dışı sektör =  (yaklaşık). ETF tespiti ada göre sezgisel. |
| Bilanço | SEC XBRL  →  (cik, dönem, values jsonb) | Gelir iki etiket; mali yıl sonu çeyreği yıllıktan türetilir. |
| Fiyat | Alpaca   | Sadece  (S&P+ekler) 'de; diğerleri hesapta bellekte, detay grafiği  ile anlık + önbellek. DB ücretsiz sınırı (500 MB) yüzünden. |
| Şirket haberi | Marketaux (100 istek/gün, istek başı 3) | ; UI'de match_score ≥ 10. |
| Küresel haber | RSS: CNBC, MarketWatch, Investing.com, FT, BBC |  ile konu/sektör; GDELT 429 ile IP kısıtladı, kullanılmıyor. |
| Ekonomik takvim | FRED releases/dates + federalreserve.gov FOMC sayfası |  filtresi. |
| Bilanço takvimi | Alpha Vantage EARNINGS_CALENDAR (günde 1 istek) | |

## Supabase
- Proje: `kairos` (ref `jfyiuodilzjjtpfwyfjw`, eu-west-1, org `ntqsfcvauhmkwfqzyjxm`). URL ve publishable key `.env.local`'de. Eski duraklatılmış "ardaege159's Project" kullanılmıyor.

## Durum
- Aşama 0 tamamlandı. Aşama 1: iskelet + tema + Türkçe menü + boş sayfalar (Bugün dahil) bitti (`phase-1-scaffold` dalı). Supabase Auth: e-posta+şifre girişi (şifre Ayarlar'dan belirlenir) ve yedek magic link; ( `/giris`, `proxy.ts`, `getOwner()` DAL, `OWNER_EMAIL` kısıtı); sahibin gerçek girişi test edilmedi. Kalan: tablolar gelince RLS, Supabase panelinde yeni kayıtları kapatmak, Vercel önizleme. Aşamaların listesi `PLAN.md`'de.
- Bitti: tüm ABD hisseleri+ETF (~12 bin, sunucu tarafı sayfalama  view), hisse/ETF detay, Karşılaştır (arama kutusu  + ), Sektörler, Bugün, Piyasa ve haberler, hisse haberleri, Kairos Skoru haber bölümü. Veri:  (hepsi, ilk sefer ~40 dk), , . Sıradaki: Vercel + günlük cron, Panel sayfası, izleme listesi.
- Stitch ekranlarının tam boy görüntüleri bekleniyor (`design/` klasörüne). Chrome uzantısı Stitch sekmesinde donuyor; tekrar denemek yerine kullanıcıdan görüntü iste.
