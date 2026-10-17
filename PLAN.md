# Kairos — Uygulama Planı

## Context
Kairos: ABD hisseleri için **temel analiz + sektör haberleri + global gelişmeler + federal harcamalar** sitesi. Kişisel kullanım (giriş zorunlu, tek kullanıcı), CV'de gösterilebilecek kalitede, **tamamen ücretsiz** kaynaklarla. LLM Council sadece geliştirme sırasında (kritik kararlarda) kullanılacak; üründe yok.

Kararlar (kullanıcıyla netleşti): evren = **S&P 500**; arayüz = **Türkçe**; erişim = **Supabase girişi, yalnızca sahibi**; stack = **Next.js + Supabase + Vercel**; tasarım = Stitch `DESIGN.md` (`design/DESIGN.md`, Geist, cam efekti, #4648d4→#8127cf, zümrüt yeşil).

Klasör şu an boş (yalnızca `.gitignore`, `design/DESIGN.md`, git init). Yeniden kullanılacak kod yok.

## Özellikler (kullanıcı isteği)
1. Hisse detay: bilanço özeti, çeyrek bazlı geçmişle karşılaştırma (sütun grafik), F/K, PD/DD, marjlar, ROE, borç/özsermaye vb.; kimi yerde halka, kimi yerde sütun grafik.
2. Anlık fiyat (15 dk gecikmeli olabilir) + çizgi grafikler.
3. Haberler (sektör + global) → **ilgili hisselerle eşleşmiş**.
4. ABD federal harcamaları (sözleşmeler) → **ilgili hisselerle eşleşmiş**.
5. **Kairos Skoru** (0–100): çarpanlar + sektör yönü + haber/momentum.
6. Karşılaştırma aracı, sektörler sayfası, panel (dashboard).
7. **Bugün** sayfası: günün gelişmeleri (Marketaux + GDELT), bugün açıklanacak ABD verileri (FRED release dates + Fed toplantı takvimi), bugün bilanço açıklayacak S&P 500 şirketleri.

## Mimari
- **Next.js (App Router, TypeScript) + Tailwind**, Geist `next/font`, grafikler **Recharts** (kurulumdan önce Context7 ile güncel API; grafik yaparken `dataviz` skill'i yüklenecek).
- **Supabase**: Postgres + Auth + RLS (tüm tablolar yalnızca giriş yapmış sahibe açık).
- **Vercel**: yayın. Hobby planda cron günde 1 kez (resmi doküman, Ocak 2026) → toplu veri **günlük cron**, fiyat **talep üzerine + 15 dk önbellek**.
- Veri sayfa açılınca API'den değil, **arka planda çekilip Supabase'e yazılır**; UI sadece DB okur. Kaynak çökerse son kayıtlı veri + "güncelleme zamanı" gösterilir.
- Sayılar **kodla hesaplanır**, model sadece yorum yazar.

### Veri kaynakları
| Alan | Kaynak | Durum |
|---|---|---|
| Bilanço | SEC EDGAR XBRL (`companyfacts`, toplu için `frames`), 10 istek/sn, User-Agent zorunlu | Limit resmi sayfadan doğrulandı; `frames` URL'si ve etiket varyantları (Revenues vs RevenueFromContractWithCustomer…) **spike'ta doğrulanacak** |
| Fiyat | **Aday 1: Alpaca Market Data (ücretsiz plan)** — resmi dokümana göre geçmiş veri 200 istek/dk, son 15 dk hariç tüm geçmiş serbest; çoklu-sembol bar isteği → 500 hisse birkaç istekte. Yedek: Twelve Data (8/dk, 800/gün). Finnhub: kullanıcı ücretsiz planı "ayda 100 istek" görmüş → elendi/doğrulanacak | Alpaca çoklu-sembol davranışı **spike'ta doğrulanacak** (hesap + anahtar gerekir) |
| Haber (hisse) | Marketaux (100 istek/gün, istek başı 3 makale) + SEC 8-K | Limit resmi sayfadan; varlık/ticker alanı **doğrulanacak** |
| Haber (global) | GDELT DOC 2.0 (anahtarsız; hız sınırı resmi belgede yok, ~5 sn/istek varsayılacak) | Kullanım şartı **doğrulanacak** |
| Federal harcama | USAspending API v2 `spending_by_award` (anahtarsız) | Resmi dokümandan limit doğrulanacak |
| Ekonomik takvim | FRED (anahtar çalışıyor: 2 haftada 391 kayıt; "FOMC Press Release" her gün listeleniyor → FOMC için statik takvim şart) `fred/releases/dates` (`include_release_dates_with_no_data=true` ile gelecek tarihler; ücretsiz anahtar gerekir) + FOMC tarihleri statik seed (federalreserve.gov) | Anahtar alınınca doğrulanacak; önemli veriler (TÜFE, istihdam, GSYH, PCE) filtrelenecek |
| Bilanço takvimi | Aday: Alpha Vantage `EARNINGS_CALENDAR` (günde 1 istek, ücretsiz 25/gün) | Doğrulanmadı |
| S&P 500 listesi + sektör (GICS) | Tek seferlik statik seed dosyası | Kaynak/lisans seçilecek |
| Ticker↔CIK | SEC ticker eşleme dosyası | Doğrulanacak |
| AI | `lib/llm` soyutlaması; varsayılan OpenRouter `:free` (günlük kota), değiştirilebilir | Anahtarı kullanıcı `.env`'ye koyar |

### Spike sonuçları (2026-10-17, gerçek istekle doğrulandı)
- **SEC:** anahtarsız ve e-postasız genel bir User-Agent ile çalıştı (200). Ticker↔CIK dosyası: 10.443 kayıt. `frames` çalışıyor: CY2024Q1 için `Revenues` 2.095, `RevenueFromContractWithCustomerExcludingAssessedTax` 2.654 şirket → **iki etiket birleştirilmeli** (tek etiket yetmez). `companyfacts` AAPL: 3,8 MB, 503 us-gaap etiketi; her satırda `frame` alanı var. **Dikkat:** Q3 kaydında 9 aylık kümülatif değerler de var (ör. EPS 6.88) → süre ~90 gün olanlar filtrelenmeli.
- **USAspending:** anahtarsız çalıştı ama **14,5 sn** sürdü ve "Award Amount" ömür boyu toplam (milyar dolar, 1993 başlangıçlı sözleşmeler dahil). → dönem içi harcama için `spending_by_category`/zaman filtreli uç noktalara bakılacak; günlük arka plan işi + önbellek şart. Alıcı adı "LOCKHEED MARTIN CORP/CORPORATION" gibi varyantlı → `aliases` tablosu doğrulandı.
- **GDELT:** çalıştı (200, JSON). Sonuçlar çok dilli → sorguya `sourcelang:english` eklenecek; `artlist` modunda makale başına ton alanı yok (title, url, seendate, domain, language, sourcecountry). Not: Node `fetch` bir denemede "fetch failed" verdi, PowerShell aynı isteği geçti → istemcide yeniden deneme (retry) şart.
- **Alpaca (fiyat) — SEÇİLDİ:** ücretsiz anahtarla `v2/stocks/bars` tek istekte 50 sembol × 7 günlük bar döndü (50/50, `BRK.B` dahil); `feed=sip` (tüm piyasa) ücretsiz planda 20 dk önceye kadar çalıştı → 500 hisse ≈ 10 istek/gün. 15 dk bar isteği de çalıştı; son barları almak için `sort=desc` kullanılmalı.
- **Marketaux — doğrulandı:** her makalede `entities[].symbol`, `match_score` ve **`sentiment_score`** var → haber↔hisse eşleştirmesi ve skorun haber bileşeni doğrudan buradan.

### Eşleştirme (haber/harcama → hisse)
- Haber: Marketaux varlık etiketi varsa doğrudan; GDELT için sektör anahtar-kelime haritası + şirket adı eşleşmesi.
- Harcama: alıcı adı normalize → S&P 500 şirket/yan kuruluş takma ad tablosu (`aliases`), her eşleşmede `confidence` ve elle düzeltme imkânı. Yanlış eşleşme riski arayüzde "tahmini eşleşme" etiketiyle belirtilir.

### Kairos Skoru (şeffaf, kodla, tek dosyada ağırlıklar)
Alt skorlar sektör içi yüzdelik sırayla: **Değerleme 25** (F/K, PD/DD), **Karlılık 20** (marjlar, ROE), **Büyüme 20** (çeyreklik YoY gelir/EPS), **Finansal sağlık 15** (borç/özsermaye, cari oran), **Sektör yönü 10** (sektör medyan getirisi, kendi evrenimizden), **Haber/momentum 10**. Detay sayfasında kırılım gösterilir. "Yatırım tavsiyesi değildir" uyarısı her sayfada. Skorun getiri tahmini olduğu iddia edilmez.

## Veri modeli (Supabase, ana tablolar)
`companies` (ticker, cik, ad, sektör), `fundamentals_quarterly` (cik, dönem, kalem, değer), `ratios`, `prices_daily`, `quotes_cache`, `news_items`, `news_tickers`, `awards`, `award_tickers`, `aliases`, `sector_stats`, `scores`, `ai_summaries` (önbellek).

## Sayfalar (Türkçe)
Panel · Hisse detay (fiyat çizgisi, çeyrek sütunları, oran kartları, skor halkası, ilgili haberler, ilgili federal harcamalar) · Karşılaştır · Sektörler · Piyasa & Haberler · Federal Harcamalar · İzleme listesi/Ayarlar. Stitch ekran referansları gelince birebir uygulanır; Fintables esinli yoğun tablo/özet düzeni kullanıcıdan ekran görüntüsü ile alınır.

## Aşamalar (her biri tek başına kullanışlı)
0. **Spike (UI yok):** küçük betiklerle SEC frames, fiyat kaynağı, Marketaux ticker alanı, GDELT, USAspending, hız limitleri doğrulanır; rakamlar bu plana işlenir.
1. İskelet: Next.js + Tailwind teması (`DESIGN.md` token'ları; Stitch export'undaki #6366f1 değil #4648d4 esas), Supabase proje + Auth + RLS, giriş sayfası, Vercel önizleme.
2. Bilanço hattı + hisse detay sayfası (çeyrek grafikleri, oranlar).
3. Fiyatlar + çizgi grafikler.
4. Kairos Skoru + sektör istatistikleri + sektörler sayfası.
5. Haber hattı + eşleştirme.
6. Federal harcama hattı + eşleştirme.
7. Karşılaştırma + panel + cila.
8. AI yorumları (önbellekli, kota korumalı).

## Kritik dosyalar (oluşturulacak)
`design/DESIGN.md` (var) → `tailwind.config.ts`; `lib/sec/*`, `lib/prices/*`, `lib/news/*`, `lib/spending/*`, `lib/score/weights.ts` + `score.ts`, `lib/llm/index.ts`; `app/(app)/*` sayfalar; `app/api/cron/*`; `supabase/migrations/*`; `.env.example` (anahtarsız); `CLAUDE.md` (`/init` ile).

## Doğrulama
- Oran ve skor hesapları için **Vitest** birim testleri (bilinen bir şirketin elle hesaplanmış değerleriyle).
- Spike çıktıları: gerçek istekle SEC/fiyat/haber/harcama örnekleri `scratchpad`'e kaydedilip incelenir.
- Her aşamada Claude in Chrome ile sayfa açılıp ekran görüntüsü + konsol hatası kontrolü.
- Supabase `get_advisors` (güvenlik/RLS), giriş yapmadan veriye erişilemediği test edilir.
- Vercel önizleme dağıtımı; cron'un günlük çalıştığı log'dan doğrulanır.

## Riskler
- Ücretsiz fiyat limiti: 500 hisse için günlük kapanış, detay sayfasında talep üzerine anlık fiyat.
- XBRL etiket farklılıkları: temizleme/eşleme katmanı gerekli (projenin asıl mühendislik kısmı).
- Harcama eşleştirmesi bulanık; güven puanı ve elle düzeltme.
- Ücretsiz model kalitesi: sadece yorum, sayılar kodla.
- Kaynak şartları (Marketaux, GDELT, Finnhub "ticari olmayan"): kişisel kullanımla uyumlu; halka açmadan önce yeniden kontrol.

## Onay/kullanıcı işleri
Supabase/Vercel proje oluşturmadan önce kullanıcıdan açık onay (hesap: ardaegeer1@gmail.com). Kullanıcı: `gh auth login`, OpenRouter + Marketaux (+ gerekirse Finnhub/Twelve Data) anahtarlarını `.env.local`'e koyma; Stitch ekran görüntülerini `design/` klasörüne koyma.
