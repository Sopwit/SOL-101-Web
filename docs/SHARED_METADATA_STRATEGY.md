# SHARED METADATA STRATEGY

Son guncelleme: 2026-03-27

Bu dokuman shop item metadata'sinin web, backend, Unity ve Solana tarafinda tek
kaynaktan yonetilmesi icin hedef modeli tanimlar.

## Problem

Su an:

- fiyat, stok, sahiplik:
  on-chain
- isim, aciklama, gorsel:
  local katalog / backend mirror

Bu hibrit model hizli ama iki risk uretiyor:

- `item_id` ile local katalog eslesmesi bozulursa gorsel kaybolur
- Unity ve web ayni item'i farkli metadata ile gosterebilir

## Hedef

Tek `item_id` etrafinda su katmanlar hizalansin:

- on-chain:
  ekonomik ve sahiplik state
- signed metadata manifest:
  isim, aciklama, rarity, kategori, image URL
- local fallback snapshot:
  offline/devnet gelistirme icin

## Onerilen Model

### 1. Metadata Manifest

JSON manifest alanlari:

- `id`
- `name`
- `description`
- `category`
- `rarity`
- `imageUrl`
- `version`
- `updatedAt`

### 2. Source of Truth

- Devnet gelistirme:
  repo icindeki signed manifest snapshot
- Runtime:
  backend'in serve ettigi imzali manifest
- On-chain:
  yalnizca `item_id` referansi ve ekonomi state

### 3. Runtime Akisi

1. Web/Unity item hesaplarini on-chain'den okur
2. `item_id` listesi ile metadata manifest cache'ini eslestirir
3. Manifest eksikse local fallback snapshot kullanir
4. UI status rail bunu `metadata degraded` olarak bildirir

## Dosya Organizasyonu

- `shared/shopCatalog.ts`
  local fallback snapshot
- `shared/shopMetadata.schema.json`
  metadata schema
- backend endpoint:
  `/shop/metadata-manifest`
- Unity:
  `StreamingAssets/shop-metadata.json` fallback

## Kabul Kriterleri

- Web ve Unity ayni `item_id` icin ayni isim/gorsel gosterir
- Manifest eksik olsa bile item tamamen kaybolmaz
- Status rail metadata kaynagini ayri olarak raporlar
