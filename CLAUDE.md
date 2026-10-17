# Kairos

Kişisel kullanım için ABD hisse analiz sitesi: S&P 500 temel analiz (çeyreklik bilanço, F/K, PD/DD…), 15 dk gecikmeli fiyat + grafikler, hisseyle eşleşmiş haberler, global gündem, hisseyle eşleşmiş ABD federal harcamaları ve **Kairos Skoru** (0–100). Tam plan ve veri kaynağı test sonuçları: `PLAN.md`.

## Kullanıcı ve dil
- Kullanıcıyla **Türkçe** konuş. Arayüz metinleri Türkçe; kod, değişken ve commit mesajları İngilizce.
- Kullanıcı Claude Code'da yeni; teknik adımları kısa ve net anlat.

## Kararlar (değiştirmeden önce sor)
- Stack: Next.js (App Router, TypeScript) + Tailwind + Supabase (Postgres, Auth, RLS) + Vercel. Grafik: Recharts.
- Erişim: Supabase e-posta girişi, yalnızca sahibi. Tüm tablolarda RLS.
- Evren: S&P 500. Yalnızca ücretsiz veri kaynakları.
- Tasarım: `design/DESIGN.md` esas (Geist, cam efekti, primary `#4648d4`, secondary `#8127cf`). Stitch React export'undaki `#6366f1` yanlış, kullanma.
- LLM Council yalnızca geliştirmede (kullanıcı isterse); üründe yok.

## Veri kaynakları (hepsi spike'ta doğrulandı)
| Alan | Kaynak | Not |
|---|---|---|
| Bilanço | SEC EDGAR XBRL (`companyfacts`, `frames`) | Anahtarsız, User-Agent gerekli, 10 istek/sn. Gelir için `Revenues` + `RevenueFromContractWithCustomerExcludingAssessedTax` birleştir; yalnızca ~90 günlük dönemleri al (9 aylık kümülatifler karışık geliyor). |
| Fiyat | Alpaca Market Data (`v2/stocks/bars`, `feed=sip`) | Ücretsiz planda son 15 dk hariç; tek istekte çok sembol. En yeni bar için `sort=desc`. |
| Hisse haberi | Marketaux | 100 istek/gün, istek başı 3 makale; `entities[].symbol` + `sentiment_score` var. Sadece izleme listesi için. |
| Global haber | GDELT DOC 2.0 | Anahtarsız; `sourcelang:english` ekle; istemcide retry şart. |
| Federal harcama | USAspending API v2 | Anahtarsız ama yavaş (~15 sn); "Award Amount" ömür boyu toplam. Alıcı adı varyantları için `aliases` tablosu. |

## Çalıştırma
- Geliştirme: `npm run dev` (her sayfa ilk açılışta derlenir, yavaştır). Günlük kullanım: `npm run kullan` (build + production, sayfalar ~50 ms).

## Kurallar
- UI API'yi doğrudan çağırmaz: veri arka planda çekilip Supabase'e yazılır, sayfalar DB'den okur. Vercel Hobby cron günde 1 kez.
- Sayılar (oranlar, skor) **kodla** hesaplanır; AI yalnızca yorum yazar. Skor ağırlıkları tek dosyada (`lib/score/weights.ts`).
- Her sayfada "Yatırım tavsiyesi değildir" uyarısı.
- Gizli anahtarlar `.env.local` içinde (gitignore'da); liste `.env.example`'da (Alpaca, Marketaux, FRED, Alpha Vantage, Supabase, OWNER_EMAIL). Anahtarları asla sohbette isteme, yazdırma veya commit'leme; kullanıcı dosyaya kendisi yapıştırır.
- Supabase/Vercel'de proje veya kaynak oluşturmadan önce kullanıcıdan açık onay al.
- Kaynak testleri: `node --env-file=.env.local scripts/spike/keys-spike.mjs` (anahtarsız olanlar: `scripts/spike/spike.mjs`).

## Supabase
- Proje: `kairos` (ref `jfyiuodilzjjtpfwyfjw`, eu-west-1, org `ntqsfcvauhmkwfqzyjxm`). URL ve publishable key `.env.local`'de. Eski duraklatılmış "ardaege159's Project" kullanılmıyor.

## Durum
- Aşama 0 tamamlandı. Aşama 1: iskelet + tema + Türkçe menü + boş sayfalar (Bugün dahil) bitti (`phase-1-scaffold` dalı). Supabase Auth: e-posta+şifre girişi (şifre Ayarlar'dan belirlenir) ve yedek magic link; ( `/giris`, `proxy.ts`, `getOwner()` DAL, `OWNER_EMAIL` kısıtı); sahibin gerçek girişi test edilmedi. Kalan: tablolar gelince RLS, Supabase panelinde yeni kayıtları kapatmak, Vercel önizleme. Aşamaların listesi `PLAN.md`'de.
- Aşama 2: şema + SEC yükleme bitti; Supabase'de 503 şirket, ~61 bin çeyreklik bilanço satırı (2023Q3–2026Q2). Yeniden yükleme: `node --env-file=.env.local scripts/ingest/sec-fundamentals.mjs` (SUPABASE_SECRET_KEY gerekir). Sıradaki: Alpaca fiyat yükleme + Hisseler listesi + hisse detay sayfası (çeyrek grafikleri, F/K, PD/DD).
- Stitch ekranlarının tam boy görüntüleri bekleniyor (`design/` klasörüne). Chrome uzantısı Stitch sekmesinde donuyor; tekrar denemek yerine kullanıcıdan görüntü iste.
