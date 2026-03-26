# DUAN Web

Canli uygulama:

- https://sopwit.github.io/SOL-101-Web/

DUAN Web, Unity tabanli oyun akisini destekleyen Solana odakli bir web platformudur. Proje; oyuncu profili, forum, magazа, pazar, admin paneli ve backend operasyon katmanini tek repoda toplar. Frontend React/Vite ile, backend ise Supabase Edge Functions + Hono ile calisir.

## Guncel Durum

Bu repo artik ilk mock asamasinin otesindedir. Uygulama su anda:

- devnet odakli Solana baglantisi kullanir
- GitHub Pages uzerinden yayinlanabilir
- on-chain shop katalogu ve sahiplik verisini okuyabilir
- backend uzerinden forum, profil, market mirror ve admin operasyonlarini yonetebilir
- Unity ile ortak veri modeli mantigina gore ilerler

Not:

- Bu proje su an `mainnet` hedeflemez
- ana operasyon ortami `devnet`tir
- market settlement tarafinda Anchor program katmani baslamis olsa da tum akislar tamamen on-chain degildir

## Ana Moduller

### Home

- platform ozeti sunar
- toplam oyuncu profili, cevrimici oyuncu, toplam item ve tamamlanan takas metriklerini gosterir
- token ekonomisi, runtime sagligi ve katalog ozeti verir
- veri 30 saniyelik polling ile yenilenir

### Forum

- backend tabanli gonderi akisi
- yorumlar, begeni ve temel moderasyon aksiyonlari
- opsiyonel gorsel URL destegi
- dil ve feed filtreleme

### Shop

- on-chain shop snapshot uzerinden item listesi
- backend token ozeti
- asset fallback sistemi
- kaynak bazli durum sinyalleri
- satin alma akislarinda Anchor tabanli shop mantigi

### Market

- backend mirror ile calisan listing/trade akisi
- `duan_market` on-chain katmani icin istemci ve program iskeleti
- admin tarafinda trade ve listing kontrolu

### Profile

- backend profil verisi
- on-chain `player-profile` ve `owned-item` okuma
- inventory, progression ve kozmetik yapisi

### Admin Panel

- wallet allowlist ile korunan ayri yonetim alani
- admin session token mantigi
- overview, system, economy, users ve moderation sekmeleri
- audit log, yorum/gonderi silme, listing iptali, trade durumu guncelleme

## Mimari Ozet

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui + Radix UI
- Zustand
- Solana Wallet Adapter

### Backend

- Supabase Edge Functions
- Hono
- Supabase tabanli KV store
- wallet signature dogrulama
- admin session token mekanizmasi

### Solana

- Anchor workspace
- `duan_shop`
- `duan_market`
- IDL sync scriptleri
- devnet deploy akisi

### Unity Entegrasyonu

Unity repo:

- https://github.com/Sopwit/SOL-101-Unity

Hedef model:

- Unity gameplay state uretir
- web profil, sosyal akis ve ekonomi tarafini gosterir
- backend ve Solana, iki istemci arasinda ortak veri omurgasi olur

## Source Of Truth

Pratikte veri sahipligi su sekilde ilerler:

- Unity: gameplay, event, loot ve progression tetikleyicileri
- Web/backend: profil, forum, market mirror, admin operasyonlari
- Solana: shop katalogu, satin alma, owned item ve ilgili on-chain state

Bu ayrim tam bitmis degil ama proje genelinde bu yone dogru ilerleniyor.

## Klasor Ozetleri

```text
src/app/                Uygulama ekranlari, hook'lar, servisler ve ortak bilesenler
functions/server/       Supabase Edge Function giris noktasi ve KV katmani
shared/                 Frontend ve backend tarafinin ortak kullandigi sabitler
programs/               Anchor programlari
scripts/                Solana build/sync yardimci komutlari
docs/                   Kurulum, mimari ve operasyon dokumani
tests/                  Smoke testler
```

Kritik giris noktalar:

- `src/app/services/api.ts`
- `functions/server/index.tsx`
- `shared/shopCatalog.ts`
- `shared/duanEconomy.ts`
- `programs/duan_shop/src/lib.rs`
- `programs/duan_market/src/lib.rs`

## Calistirma

### Gereksinimler

- Node.js 18+
- npm
- Supabase projesi
- devnet Solana cuzdani
- tercihen Phantom

### Lokal Gelistirme

```bash
npm install
npm run dev
```

### Temel Komutlar

```bash
npm run build
npm run lint
npm run validate
npm run test:smoke
```

### Solana Komutlari

```bash
npm run solana:build
npm run solana:sync-idl
npm run solana:sync-market-idl
npm run solana:sync-shop
npm run solana:set-game-authority
npm run solana:bootstrap
```

Not:

- program kodu degisti ama zincire alinmadiysa ek olarak `anchor deploy` gerekir
- proje devnet-first calisir

## Environment

Ornekler icin [`.env.example`](./.env.example) dosyasina bak.

Frontend tarafinda tipik olarak gerekenler:

```bash
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SOLANA_CLUSTER=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_TOKEN_MINT=your-devnet-token-mint-address
VITE_ADMIN_WALLETS=your-admin-wallet-address
VITE_WALLET_BRIDGE_ALLOWED_CALLBACK_PREFIXES=yourapp://wallet-bridge
```

Backend tarafinda tipik olarak gerekenler:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DUAN_SHOP_GAME_AUTHORITY_SECRET_KEY=your-secret-key
```

Guvenlik notu:

- gercek secret, private key veya service role key repoya yazilmaz
- GitHub Actions `Secrets` ve `Variables` kullanilir

## GitHub Pages

Pages workflow hazirdir. Kurulum notlari:

- [GITHUB_PAGES_SETUP.md](./docs/setup/GITHUB_PAGES_SETUP.md)

Temel mantik:

- router `hash` modunda calisir
- deploy GitHub Actions uzerinden yapilir
- `main` branch push ile Pages guncellenir

## Diger Dokumanlar

- [NIHAI_VERSIYON.md](./docs/NIHAI_VERSIYON.md)
- [GENEL_DURUM_RAPORU.md](./docs/GENEL_DURUM_RAPORU.md)
- [SOLANA_SETUP.md](./docs/setup/SOLANA_SETUP.md)
- [SUPABASE_SETUP.md](./docs/setup/SUPABASE_SETUP.md)
- [GAME_INTEGRATION.md](./docs/GAME_INTEGRATION.md)
- [SHARED_METADATA_STRATEGY.md](./docs/SHARED_METADATA_STRATEGY.md)
- [DEVNET_REALTIME_STRATEGY.md](./docs/DEVNET_REALTIME_STRATEGY.md)

## Mevcut Sinirlar

- proje devnet odaklidir
- canli oracle mantigi DUAN icin dogrudan market fiyatı degil, SOL/USD referansindan turetilmis tahmini degerdir
- market settlement tam olarak production-grade on-chain hale gelmis degildir
- Unity entegrasyonu ileridir ama tum runtime senaryolari bitmis sayilmaz

## Onerilen Sonraki Adimlar

- GitHub Pages variable/secret ayarlarini tamamlamak
- devnet deploy ve IDL sync adimlarini son haliyle dogrulamak
- Unity runtime dogrulamalarini Editor ve WebGL tarafinda tamamlamak
- README ve dokumanlar ile kodun birlikte guncel kalmasini surdurmek
