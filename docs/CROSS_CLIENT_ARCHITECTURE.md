# CROSS CLIENT ARCHITECTURE

Son guncelleme: 2026-03-29

Bu belge, SOL-101 ekosisteminde Unity istemcisi, web istemcisi, Supabase backend
ve Solana devnet katmaninin tek oyuncu deneyimi olarak nasil birlikte
calisacagini tanimlar.

## Hedef

- Unity ve web ayri urun degil, ayni oyuncu hesabinin iki istemcisidir
- Cuzdan kimligi her yerde `walletAddress` ile temsil edilir
- Oyuncu progression, envanter, item sahipligi ve ekonomi tutarsizlasmaz
- On-chain ve off-chain gorev dagilimi net tutulur
- Yeni istemci veya servis eklemek mevcut veri modelini bozmaz

## Canonical Katmanlar

### 1. Kimlik

- Canonical kimlik: Phantom wallet public key
- Web auth: `signMessage`
- Unity auth: WebGL Phantom bridge ile `signMessage`
- Sunucu dogrulama: Ed25519 signature verification

### 2. On-chain state

Solana devnet tarafinda tutulmasi gereken alanlar:

- shop config ve magazaya ait ekonomik state
- player progression mirror
- item sahipligi ve inventory referanslari
- market listing / trade intent / escrow state
- DUAN oyun para birimi icin opsiyonel SPL mirror / settlement referanslari

On-chain katmanin gorevi:

- ekonomik dogruluk
- sahiplik dogrulama
- trade/escrow guvenligi
- istemciler arasi ortak mutabakat

### 3. Off-chain state

Supabase Edge Function + KV/tablolar tarafinda tutulmasi gereken alanlar:

- forum post/comment
- gorsel URL'leri ve metadata snapshot
- analytics ve operational logs
- cache / polling snapshot
- leaderboard projection
- translation cache

Off-chain katmanin gorevi:

- hizli read model
- UX odakli projection
- medya ve sosyal sistemler
- devnet ortaminda maliyet kontrollu cache

## Canonical Veri Akisi

### Profil / progression

1. Unity oyun ici event uretir
2. Unity `game/sync` ile backend'e yazar
3. Backend stats projection'i gunceller
4. Backend uygun ise on-chain `player_profile` mirror sync tetikler
5. Web `profile/:walletAddress`, `stats`, `inventory` endpoint'lerinden ayni state'i okur

### Market / trade

1. Web veya Unity listing/trade intent olusturur
2. On-chain escrow/listing state acilir
3. Backend bu state'i mirror ederek feed ve admin gorunumu uretir
4. Her iki istemci de feed icin backend'i, settlement icin on-chain referansi kullanir

### Shop metadata

1. Ekonomik state on-chain veya backend snapshot'ta tutulur
2. Metadata canonical source `shared/shopCatalog.ts`
3. Buradan manifest uretilir
4. Web runtime `shop/metadata-manifest` endpoint'ini kullanir
5. Unity runtime gerekirse `Assets/StreamingAssets/shop-metadata.json` fallback'ine duser

## Tavsiye Edilen Source of Truth Modeli

- Wallet identity: Phantom public key
- DUAN ekonomik kurallari: shared constants + on-chain validation
- Item metadata: shared manifest
- Feed/read model: Supabase backend
- Final ownership / settlement: Solana program state

## Senkronizasyon Kurallari

- Unity kritik gameplay ilerlemesini lokal hafizada tek basina source of truth yapmamali
- Web UI optimistic update yapabilir ama nihai durum backend/on-chain snapshot ile duzeltilmeli
- Inventory ve progression projection'lari idempotent olmali
- Her istemci stale veriyle calisabilecegi icin polling-first model korunmali

## Gelecege Donuk Uyum Noktalari

- Event queue eklendiginde `game/event` ve market/forum aksiyonlari replay edilebilir olmali
- Mainnet gecisinde RPC URL, DUAN mint ve program id config disina tasinmamali
- Yeni istemciler ayni wallet auth header contract'ini kullanmali
- Leaderboard ve analytics projection katmani write path'ten ayrilabilir olmali
- Metadata manifest versiyonlu kalmali

## Minimum Operasyonel Checklist

- Supabase Edge Function secrets tanimli
- Solana devnet RPC sabitlenmis
- DUAN mint ve program id env/asset seviyesinde tutarli
- Wallet signing sadece Phantom ile ve ayni auth contract ile yapiliyor
- Unity ve web ayni metadata manifest versiyonunu kullaniyor
