# P1 TASARIM NOTLARI

Son guncelleme: 2026-03-27

Bu dokuman, P1 seviyesinde tasarimi tamamlanmis ama implementasyonu daha buyuk
operasyon veya program gelistirmesi gerektiren iki alani netlestirir:

1. Market settlement modeli
2. Forum medya storage akisi

## 1. Market Settlement Modeli

### Hedef

- Listing olusturma backend feed uzerinden hizli kalabilir.
- Gercek item/token transferi kullanici arayuzunde "teklif var" seviyesinde
  kalmamalidir.
- Oyuncu, trade kabul ettiginde sonuc deterministik, izlenebilir ve geri
  alinabilir olmalidir.

### Onerilen Mimari

- Listing metadata:
  backend
- Trade intent:
  backend + wallet signature
- Settlement:
  on-chain
- Final trade history snapshot:
  backend mirror + on-chain signature

### Asamalar

#### Faz 1

- Listing backend'de olusur.
- Alici teklif gonderirken wallet-imzali trade intent olusur.
- Satici kabul ettiginde backend her iki taraf icin hazirlik kontrolu yapar:
  - item ownership
  - listing stale mi
  - expiration gecti mi
  - gerekli token bakiyesi var mi

#### Faz 2

- `duan_market_settlement` adinda ayri Anchor programi eklenir.
- Program hesaplari:
  - `market-config`
  - `listing-escrow`
  - `trade-intent`
  - opsiyonel `dispute-record`
- Settlement instructionlari:
  - `open_listing_escrow`
  - `create_trade_intent`
  - `accept_trade_intent`
  - `cancel_listing_escrow`
  - `expire_trade_intent`

#### Faz 3

- Web ve Unity listing ekranlari backend feed'i kullanmaya devam eder.
- "Kabul et" islemi backend endpoint yerine dogrudan wallet-signed on-chain
  settlement transaction'a doner.
- Backend sadece mirror/gorunurluk katmani olur.

### Neden Bu Model

- Forum/market feed'i hizli kalir.
- On-chain maliyet sadece settlement aninda dogar.
- Listing feed'i icin gereksiz RPC bagimliligi olusmaz.
- Kullaniciya net audit trail verir:
  listing id + trade intent id + tx signature

### Kabul Kriterleri

- Trade kabulunden sonra item sahipligi zincirde degismis olmali.
- Token karsiligi varsa treasury veya counterparty transferi zincirde izlenmeli.
- Backend trade kaydi `txSignature` ve `settledAt` alanlariyla guncellenmeli.
- Listing stale ise settlement reddedilmeli.

## 2. Forum Medya Storage Akisi

### Hedef

- Su an desteklenen harici `imageUrl` akisi korunur.
- Buna ek olarak kullanicinin dogrudan dosya yukleyebilecegi bir storage hattina
  gecilir.
- Medya URL'leri rastgele harici hostlara bagimli kalmaz.

### Onerilen Mimari

- Depolama:
  Supabase Storage
- Upload yetkilendirme:
  wallet-imzali backend token
- Veri akisi:
  frontend -> signed upload policy -> storage -> public/signed asset URL -> forum post

### Asamalar

#### Faz 1

- `forum/media/upload-token` endpoint'i eklenir.
- Backend wallet signature'ini dogrular.
- Kullaniciya kisa omurlu upload izni doner.

#### Faz 2

- Frontend dosyayi storage bucket'a yukler.
- Upload sonucu dondurulen storage URL, `createPost` icinde `imageUrl` olarak gider.
- Post kartlari mevcut `ImageWithFallback` ile bunu kullanir.

#### Faz 3

- Media moderation ve boyut siniri:
  - mime whitelist
  - max size
  - optional image dimension cap
- Kullanilmayan medya temizligi icin lifecycle kural eklenir.

### Bucket Kurallari

- Bucket:
  `forum-media`
- Kabul edilen tipler:
  `image/png`, `image/jpeg`, `image/webp`
- Maks boyut:
  5 MB
- Path formati:
  `forum/{walletAddress}/{timestamp}-{random}.ext`

### Kabul Kriterleri

- Kullanici wallet auth olmadan upload token alamamali.
- Upload edilen medya forum post detail ve feed icinde gorunmeli.
- Gecersiz mime veya buyuk dosya reddedilmeli.
- Medya URL'si silinirse UI fallback gorseli gostermeli.
