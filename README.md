# DUAN Web

DUAN-GAME etrafinda kurgulanmis bu web uygulamasi; Solana tabanli topluluk, envanter ve ticaret akislarini tek bir yerde toplar. Bu repo; React tabanli istemciyi ve Supabase Edge Functions uzerinde calisan hafif backend katmanini birlikte barindirir. Hedef mimari, Unity istemcisi ile tam entegre, dusuk gecikmeli ve veri tutarliligi yuksek bir deneyim sunmaktir.

## Proje Durumu

Proje ilk mock asamasini gecmis durumda. Uygulama artik:

- Solana cuzdan baglantisini destekler
- Supabase Edge Functions uzerinden veri okuma/yazma yapar
- Profil, forum, shop, market ve oyun entegrasyonu endpoint'lerine sahiptir
- Bazi ekranlarda halen mock veri veya UI-only akis kullanir

Bu nedenle repo hem "canli entegrasyon" hem de "ileride tamamlanacak UI akislari" icerir.

## Moduller

### Ana Sayfa
- Platform istatistiklerini backend'den ceker
- Forum, Shop, Market ve Profil modullerine yonlendirir
- Istatistikler 30 saniyede bir yenilenir

### Forum
- Post listeleme, filtreleme ve siralama desteklenir
- Yeni post olusturma backend'e yazilir
- Like/unlike islemleri backend ile calisir
- UI tarafinda gorsel yukleme alani bulunur ancak dosya yukleme akisi henuz bagli degildir

### Shop
- Token bilgisi backend'den alinabilir
- Item listeleme ve satin alma akislarinin ana yolu backend endpoint'leri uzerinden ilerler
- SPL token mint adresi tanimlanirsa wallet token bakiyesi zincirden okunur
- Token mint adresi yoksa uygulama token bakiyesini `0` gosterir

### Market
- Market endpoint'leri backend tarafinda mevcut
- Listeleme backend verisi ile calisir
- Listing ve trade akislari Supabase Edge Function uzerinden ilerler
- Icerik olusturma akislarinda wallet auth kullanilir

### Profil
- Wallet baglantisi sonrasinda profil ve istatistikler backend'den cekilir
- Profil guncelleme imzali istek ile backend'e yazilir
- Envanter sekmesi backend envanteri ile calisir
- Post ve listing sekmeleri sadeleştirilmistir; bu veriler yeniden eklenecekse backend kaynakli tasarlanmalidir

### Oyun Entegrasyonu
- Unity istemcisi ile tam entegre calisacak sekilde kurgulanmistir
- Oyun tarafindan profil/stats senkronizasyonu yapilabilir
- Oyun event'leri backend'e yazilabilir
- Hedef, web ve Unity tarafinin ayni oyuncu verisini es zamanli veya yakin-gercek-zamanli guncellemesidir
- Bu katman `docs/GAME_INTEGRATION.md` icinde ayrintili olarak anlatilir

## Unity Entegrasyon Hedefi

Bu proje genel bir "oyun baglantisi" katmanindan ziyade Unity ile dogrudan entegre calisacak sekilde gelistirilmektedir.

Hedef davranis:

- Unity istemcisi oyuncu ilerlemesini ve event'lerini DUAN backend'ine gonderecek
- Web paneli ayni oyuncunun envanter, profil, trade ve achievement durumunu yansitacak
- Kritik veri modelleri iki tarafta ortak sema mantigi ile ilerleyecek
- Senkronizasyon mumkun oldugunca dusuk gecikmeli olacak
- Cift tarafli veri tutarliligi icin auth, idempotency ve event-duzeni kurallari netlestirilecek

Mevcut durum:

- HTTP tabanli sync ve event endpoint'leri mevcut
- Unity tarafi icin temel entegrasyon dokumani mevcut
- Tam gercek zamanli transport katmani ve veri normalizasyonu henuz tamamlanmamis

## Iki Repo Mimarisi

Sistem iki ayri repo ile birlikte calisacak:

- Web repo: bu repo
- Unity repo: `https://github.com/Sopwit/SOL-101-Unity`

Sorumluluk ayrimi:

- Unity oyunun oynandigi ana istemci olacak
- Web uygulamasi oyuncunun hesap, profil, forum, inventory, market ve sosyal akislarini gosterecek
- Oyuncu ilerlemesi Unity tarafinda uretilecek
- Inventory, profil, achievement, trade ve topluluk verileri web/backend tarafinda saklanacak veya orkestra edilecek

Pratikte bu su anlama gelir:

- Oyuncu oyunu Unity uzerinden oynar
- Kazanilan item, XP, achievement ve event'ler backend'e aktarilir
- Web paneli ayni kullanicinin envanterini, profilini ve sosyal etkilesimlerini gosterir
- Her iki istemci ayni wallet veya oyuncu kimligi etrafinda baglanir

## Source Of Truth

Hedef mimaride veri sahipligi net olmalidir:

- Unity: gameplay state, combat olaylari, loot kazanimi, checkpoint event'leri
- Web/backend: profil, inventory kaydi, forum, market, token bilgisi, oyuncu istatistiklerinin paylasilan gorunumu

Unity bir item kazandiginda bunu dogrudan lokal tek kaynak gibi tutmak yerine backend'e yazmali; web de ayni kaynagi okumali. Boylece iki taraf birbirinden kopmaz.

## Mimari Ozet

### Frontend
- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui ve Radix UI bilesenleri
- Zustand
- next-themes
- Solana wallet adapter

### Backend
- Supabase Edge Functions
- Hono
- Supabase KV benzeri saklama katmani (`functions/server/kv_store.tsx`)
- TweetNaCl ile mesaj imza dogrulama

## Dizin Yapisi

```text
src/
  app/
    components/     UI ve ortak bilesenler
    contexts/       Dil ve benzeri context yapilari
    hooks/          Balance gibi uygulama hook'lari
    lib/            Mock veri ve yardimci kaynaklar
    pages/          Route seviyesindeki ekranlar
    services/       API istemcisi
functions/
  server/
    index.tsx       Edge function route'lari
    kv_store.tsx    Sunucu veri erisim katmani
docs/
  GAME_INTEGRATION.md
  Guidelines.md
  ATTRIBUTIONS.md
  REPO_STRUCTURE_TR.md
  SMOKE_TEST_TR.md
  setup/
    SUPABASE_SETUP.md
    SOLANA_SETUP.md
```

## Ozel Klasorler ve Veri Yollari

Bu repoda her klasor ayni tipte degildir. Gelistirme yaparken su ayrimi koruyun:

- `.github/`: CI ve depo otomasyonlari. Kaynak dosyadir, duzenlenebilir.
- `.vite/`: Vite tarafindan uretilen gelistirme cache'i. Kaynak dosya degildir, elle duzenlenmemelidir.
- `dist/`: `npm run build` sonrasi uretilen production ciktilari. Kaynak dosya degildir, tekrar uretilebilir.
- `docs/`: urun, kurulum ve mimari belgeleri. Kaynak dosyadir, kodla birlikte guncel tutulmalidir.
- `functions/server/`: Supabase Edge Function kaynagi. Veri yazma/okuma ve wallet auth burada merkezilesir.
- `shared/`: frontend ve backend tarafinin ortak kullandigi ekonomik sabitler, kataloglar ve semalar.

Temel veri yolları:

- Frontend API istemcisi: `src/app/services/api.ts`
- Edge Function giris noktasi: `functions/server/index.tsx`
- KV erisim katmani: `functions/server/kv_store.tsx`
- Shop katalog ve ekonomi sabitleri: `shared/shopCatalog.ts`, `shared/duanEconomy.ts`
- Profil kozmetikleri: `shared/profileCosmetics.ts`

Not:

- `.vite/` ve `dist/` klasorleri repoda referans icin gorunse bile el ile guncellenmez.
- Temizlik gerekiyorsa `npm run clean` kullanilabilir.

## Calistirma

### Gereksinimler
- Node.js 18+
- npm
- Supabase projesi
- Solana test cuzdani, tercihen Phantom

### Environment degiskenleri

Ornek degiskenler icin [`.env.example`](./.env.example) dosyasini baz alin.

Frontend `.env` dosyaniza en az su degerleri eklenmelidir:

```bash
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SOLANA_CLUSTER=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_TOKEN_MINT=your-spl-token-mint-address
```

`VITE_SOLANA_RPC_URL` verilmezse uygulama `VITE_SOLANA_CLUSTER` degerine gore RPC endpoint secmeye calisir. O da verilmezse varsayilan `devnet` olur.

Not:

- `VITE_SUPABASE_URL` bu kod tabaninda aktif olarak kullanilmiyor; `VITE_SUPABASE_PROJECT_ID` yeterlidir.
- `VITE_SOLANA_TOKEN_MINT` opsiyoneldir. Bos birakilirsa token bakiyesi zincirden okunmaz.

Supabase Edge Function tarafinda da su degiskenler tanimli olmalidir:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

SQL migration adimlari icin [SUPABASE_SETUP.md](./docs/setup/SUPABASE_SETUP.md) dosyasini kullanin.
Solana/RPC ve wallet akislari icin [SOLANA_SETUP.md](./docs/setup/SOLANA_SETUP.md) dosyasini kullanin.
Demo veya deploy oncesi temel kontrol icin [SMOKE_TEST_TR.md](./docs/SMOKE_TEST_TR.md) dosyasini kullanin.

### Komutlar

```bash
npm install
npm run dev
```

Diger komutlar:

```bash
npm run clean
npm run build
npm run preview
npm run lint
npm run format
npm run validate
```

## Backend API Ozet

Edge function base path:

```text
https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/make-server-5d6242bb
```

Mevcut route gruplari:

- `GET /health`
- `GET /stats/platform`
- `GET /token/info`
- `GET/PUT /profile/:walletAddress`
- `POST /profile/:walletAddress/cosmetics/unlock`
- `GET /profile/:walletAddress/stats`
- `GET/POST /inventory/:walletAddress`
- `GET/POST /forum/posts`
- `DELETE /forum/posts/:postId`
- `GET/POST /forum/posts/:postId/comments`
- `POST /forum/posts/:postId/like`
- `GET /forum/posts/user/:walletAddress`
- `GET /shop/items`
- `POST /shop/purchase`
- `GET/POST /market/listings`
- `DELETE /market/listings/:listingId`
- `POST /market/listings/:listingId/trade`
- `GET /market/listings/user/:walletAddress`
- `GET /bootstrap/config`
- `POST /game/sync`
- `POST /game/event`

## Wallet Auth

Bazi yazma islemleri ek olarak Solana mesaj imzasi ister. Frontend su header'lari yollar:

```text
Authorization: Bearer <SUPABASE_ANON_KEY>
x-wallet-address: <walletAddress>
x-wallet-message: <json-string-message>
x-wallet-signature: <base64-signature>
Content-Type: application/json
```

Imzalanan mesaj semasi:

```json
{
  "domain": "DUAN",
  "action": "profile:update",
  "walletAddress": "wallet_public_key",
  "timestamp": 1710000000000
}
```

Sunucu mesajin:

- `domain` degerini
- `action` alanini
- wallet adresini
- zaman damgasini
- detached signature gecerligini

dogrular.

## Bilinen Durumlar

- Forum gorsel yukleme UI'da var ancak upload/backing storage entegrasyonu yok.
- `VITE_SOLANA_TOKEN_MINT` tanimlanmadan DUAN token bakiyesi zincirden okunamaz.
- Unity ve web istemcileri icin ortak veri kontratlari halen gelistirilmektedir.

## Diger Dokumanlar

- [Oyun entegrasyonu](./docs/GAME_INTEGRATION.md)
- [Proje gelistirme rehberi](./docs/Guidelines.md)
- [Atiflar](./docs/ATTRIBUTIONS.md)
