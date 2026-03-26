# DUAN Unity Entegrasyon Kilavuzu

Bu belge, Unity istemcisi ile DUAN web/backend katmaninin mevcut kod tabanina gore nasil konusacagini aciklar. Amaç, Unity ve web istemcisinin ayni oyuncu verisini tutarli sekilde paylasmasidir.

## Entegrasyon Rol Dagilimi

- Unity:
  - gameplay olaylarini uretir
  - item/loot/level ilerlemesini tetikler
  - oyun akisini oyuncuya sunar
- Web + backend:
  - profil, forum, market ve inventory gorunumunu sunar
  - ortak istatistikleri saklar
  - sosyal ve ekonomik veriyi dagitir

Bu projede hedef, iki farkli urun degil tek oyuncu deneyiminin iki istemcisidir.

## Base URL

```text
https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/make-server-5d6242bb
```

## Gerekli Header'lar

Tum backend isteklerinde en az su header'lar bulunmalidir:

```http
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
```

Not:

- `game/sync` ve `game/event` endpoint'leri mevcut kodda wallet signature zorunlu kilmaz.
- Profil, forum, shop ve market tarafindaki bazi yazma endpoint'leri wallet imzasi ister.

## Oyun Tarafinin Kullanabilecegi Endpoint'ler

### 1. Oyun verisini senkronize et

`POST /game/sync`

Oyuncunun level, xp, achievement ve odul item bilgisini backend tarafina yazar.

#### Request body

```json
{
  "walletAddress": "wallet_public_key",
  "level": 5,
  "xp": 350,
  "achievements": ["first_win", "speedrunner"],
  "itemsEarned": ["starter-sword", "crystal-key"]
}
```

#### Mevcut davranis

- `stats:<walletAddress>` kaydi olusturulur veya guncellenir
- Seviye kuralı `XP_PER_LEVEL = 120` uzerinden normalize edilir
- `xpToNextLevel` buna gore hesaplanir
- Yeni achievement girdileri stats altina eklenir
- `itemsEarned` item'lari inventory kaydi olarak eklenir

#### Response

```json
{
  "synced": true
}
```

### 2. Oyun eventi gonder

`POST /game/event`

Oyun ici olaylari backend tarafina loglamak veya sonraki is akislari icin kaydetmek icin kullanilir.

#### Request body

```json
{
  "walletAddress": "wallet_public_key",
  "eventType": "boss_defeated",
  "eventData": {
    "bossName": "Dragon King",
    "difficulty": "hard",
    "rewardTokens": 100,
    "timestamp": "2026-03-10T12:00:00Z"
  }
}
```

#### Response

```json
{
  "processed": true
}
```

### 3. Profil oku

`GET /profile/:walletAddress`

Profil yoksa backend varsayilan profil olusturur. Mevcut varsayilan profil alanlari:

```json
{
  "walletAddress": "wallet_public_key",
  "username": "Player_abcd",
  "bio": "",
  "selectedAvatarId": "default-avatar",
  "selectedBackgroundId": "default-background",
  "ownedAvatarIds": ["default-avatar"],
  "ownedBackgroundIds": ["default-background"]
}
```

### 4. Profil istatistiklerini oku

`GET /profile/:walletAddress/stats`

Mevcut response semasi sadece level/xp degil, odul bakiyelerini de icerir:

```json
{
  "level": 1,
  "xp": 0,
  "xpToNextLevel": 120,
  "totalPosts": 0,
  "totalItems": 0,
  "totalTrades": 0,
  "rewardDuanBalance": 0,
  "rewardSolBalance": 0,
  "rewardDuanEarned": 0,
  "rewardSolEarned": 0,
  "achievements": []
}
```

### 5. Envanteri oku

`GET /inventory/:walletAddress`

Unity tarafı, oyuncunun market/shop/game kaynakli item kayitlarini tek listede okuyabilir.

### 6. Oyuncuya item kaydi ekle

`POST /inventory/:walletAddress`

#### Request body

```json
{
  "itemId": "reward_chest_01"
}
```

#### Mevcut davranis

- `itemId` katalogda bulunursa inventory kaydi ilgili `item` objesi ile yazilir
- bulunamazsa endpoint hata dondurur
- bu akış sunucu tarafinda su an wallet signature istemez

Not:

- Oyun odulleri icin daha tutarli yol genelde `game/sync` icindeki `itemsEarned` alanidir
- Bu sayede sync ve inventory mantigi ayni request icinde ilerler

## Unity Tarafi Icin Onerilen Senaryo

Oyun icinde bir event oldugunda:

1. Kritik ilerleme veya odul varsa `POST /game/sync`
2. Ham olay kaydi gerekiyorsa `POST /game/event`
3. Web tarafinda profil veya inventory gorunumu ayni wallet ile okunur

## Bilinen Sinirlar

- Gercek zamanli push/subscription katmani yok
- Event idempotency mekanizmasi tam kurulmus degil
- Unity tarafinda tum item formatlari icin tek son sema henuz finalize edilmedi
- Shop ve market akislari Unity istemcisi tarafinda son veri kontratina tamamen baglanmis degil

Bu belge, mevcut kaynak kodu yansitir; davranis degisirse `functions/server/index.tsx` ile birlikte guncellenmelidir.
