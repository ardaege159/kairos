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
| Evren | Alpaca `/v2/assets` (NASDAQ/NYSE/ARCA/BATS/AMEX; OTC, warrant, unit, preferred, yatırım fonu yok) + SEC `company_tickers_exchange.json` (CIK) + SEC submissions (SIC, DB'de önbellekli) | `scripts/ingest/universe.ts`; S&P dışı sektör = `sicToSector` (yaklaşık). ETF tespiti ada göre sezgisel. |
| Bilanço | SEC XBRL `frames` → `fundamentals_q` (cik, dönem, values jsonb) | Gelir iki etiket; mali yıl sonu çeyreği yıllıktan türetilir. |
| Fiyat | Alpaca `v2/stocks/bars` `feed=sip` | Sadece `core` (S&P + ekler) `prices_daily`'de; diğerleri metrik hesabında bellekte, detay grafiği `lib/data/alpaca.ts` ile anlık + önbellek. Sebep: DB ücretsiz sınırı (500 MB). |
| Şirket haberi | Marketaux (100 istek/gün, istek başı 3) | `entities[].symbol/match_score/sentiment_score`; UI'de match_score ≥ 10. |
| Küresel haber | RSS: CNBC, MarketWatch, Investing.com, FT, BBC | `lib/news/topics.ts` ile konu/sektör. GDELT kısa sürede 429 verip IP'yi kısıtladı, kullanılmıyor. |
| Ekonomik takvim | FRED releases/dates + federalreserve.gov FOMC sayfası | `lib/calendar/releases.ts` filtresi. |
| Bilanço takvimi | Alpha Vantage EARNINGS_CALENDAR (günde 1 istek) | |
| Federal harcama | USAspending v2: `spending_by_category/recipient` (12 ay, ilk 500 alıcı) + `recipient/{id}` ana şirket + `spending_by_transaction` (30 gün) | `lib/spending/match.ts` ile isim eşleştirme; ana şirketler `spending_recipients`'te önbellekli. |

## Supabase
- Proje: `kairos` (ref `jfyiuodilzjjtpfwyfjw`, eu-west-1, org `ntqsfcvauhmkwfqzyjxm`). URL ve publishable key `.env.local`'de. Eski duraklatılmış "ardaege159's Project" kullanılmıyor.

## Durum
- Aşama 0 tamamlandı. Aşama 1: iskelet + tema + Türkçe menü + boş sayfalar (Bugün dahil) bitti (`phase-1-scaffold` dalı). Supabase Auth: e-posta+şifre girişi (şifre Ayarlar'dan belirlenir) ve yedek magic link; ( `/giris`, `proxy.ts`, `getOwner()` DAL, `OWNER_EMAIL` kısıtı); sahibin gerçek girişi test edilmedi. Kalan: tablolar gelince RLS, Supabase panelinde yeni kayıtları kapatmak, Vercel önizleme. Aşamaların listesi `PLAN.md`'de.
- Bitti: tüm ABD hisseleri + ETF (~12 bin, sunucu tarafı sayfalama `stock_list` view), hisse/ETF detay, Karşılaştır (arama kutusu `components/stock-search.tsx` + `/api/arama`), Sektörler, Bugün, Piyasa ve haberler, hisse haberleri, Kairos Skoru haber bölümü, şirket logoları (Brandfetch, ETF'lerde harf rozeti), izleme listesi + Panel, Karşılaştır'da sektörle kıyas (SPDR sektör ETF'leri), sektör detay sayfası (`lib/sectors/insights.ts`, kural tabanlı açıklama), Federal harcamalar sayfası ve hisse sayfasında federal sözleşmeler. Veri: `npm run veri:yukle` (hepsi; ilk sefer SIC ve alıcı sorguları yüzünden uzun), `veri:fiyat`, `veri:haber`, `veri:harcama`. ETF'ler: 20 günlük ortalama işlem hacmi (`dollar_volume`) ile sıralama, addan tür sınıflandırması (`lib/etf.ts`, sunucu filtresi Postgres regex ile aynı kelime listesinden), ETF sayfasında fon bilgisi ve benzer ETF'ler. Hisse sayfasında olumlu/olumsuz/dikkat listesi (`lib/insights/stock.ts`; "al/sat" dili yok, tavsiye değildir). Portföy: `portfolios` + `portfolio_positions` (sahip RLS), `/portfoy`, `/portfoy/[id]` (kâr/zarar, değer geçmişi, risk), `/portfoy/modeller` (5 kurallı örnek portföy, `lib/portfolio/models.ts`), risk hesabı `lib/portfolio/analytics.ts` (oynaklık, düşüş, beta, yoğunlaşma, spekülatif pay; "Düşük risk" yalnızca hiç uyarı yokken). Yol haritası 2 (`~/.claude/plans/sharded-purring-sutton.md`) P1 bitti: genel arama (üst çubuk, Ctrl+K) + veri güncellik etiketi (`ingest_runs`), temettü/serbest nakit akışı/FD-FAVÖK (nakit akışı SEC'te yalnızca yıllık tam: `*_fy` değerleri mali yıl sonu çeyreğine yazılır; banka geliri için iki ek etiket), Tarayıcı `/tarayici` (`lib/screener.ts`, `stock_list.metrics` jsonb filtreleri, hazır taramalar), S&P 500 ısı haritası (Panel ve Bugün; `lib/treemap.ts`). Bilinen eksik: XOM gibi bazı şirketlerin çeyreklik SEC frame verisi seyrek. P2 bitti: Makro `/makro` (FRED + ECB USD/TRY, `lib/macro/series.ts`, `veri:makro`); federal harcamalar yenilendi (tarihe göre liste, `/harcamalar/islem/[id]` "Ne anlama geliyor?" `lib/spending/explain.ts`, temalar `lib/spending/themes.ts` + `/harcamalar/tema/[key]`, NAICS büyümesi; büyüme 90 gün gecikmeli iki 12 aylık pencereyle, çünkü DoD geç raporlar); Form 4 `scripts/ingest/insiders.ts` (`veri:iceriden`, `.env.local`'de `SEC_USER_AGENT` gerekli: SEC arşivi ad+e-posta ister; kullanıcı onayı olmadan e-postasını kullanma); alarmlar + bildirimler (`alerts`, `notifications`, `scripts/ingest/alerts.ts` veri komutlarının sonunda çalışır, `/bildirimler`, üst çubukta zil); portföyde TL görünümü (`?para=tl`, `lib/portfolio/currency.ts`) ve SPY kıyas çizgisi; değerleme geçmişi (`lib/metrics/history.ts`, Alpaca 3 yıl önbellekli); bilanço sürprizi (Alpha Vantage EARNINGS, günde ≤20 istek, `earnings_history`). Sıradaki: P3 (AI özet, 13F, skor geçmişi, karanlık tema), Vercel + günlük cron (kullanıcı en sona bıraktı).
- Kabuk notu: `node -e "..."` içinde Markdown ters tırnağı kullanma (bash komut olarak çalıştırır); dosya düzenlemelerinde Edit aracı kullan.
- Stitch ekranlarının tam boy görüntüleri bekleniyor (`design/` klasörüne). Chrome uzantısı Stitch sekmesinde donuyor; tekrar denemek yerine kullanıcıdan görüntü iste.
