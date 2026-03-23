# DUAN Unity Entegrasyon Kilavuzu

Bu dokuman, DUAN Unity istemcisinin DUAN web/backend katmani ile nasil konusacagini guncel kod tabanina gore aciklar. Hedef; Unity ve web uygulamasinin ayni oyuncu durumunu tutarli, hizli ve mumkun oldugunca es zamanli sekilde paylasmasidir.

## Entegrasyon Hedefi

Unity entegrasyonu bu proje icin opsiyonel degil, cekirdek urun davranisidir.

Beklenen sonuc:

- Unity tarafinda olusan oyun ilerlemesi web tarafina yansir
- Web uzerindeki profil, envanter ve trade verileri oyuncu durumuyla uyumlu kalir
- Event temelli veri akisi dusuk gecikmeyle backend'e ulasir
- Veri semalari iki istemci arasinda normalize edilir

## Iki Uygulama, Tek Oyuncu Modeli

Bu entegrasyonda roller nettir:

- Unity projesi oyuncunun oyunu oynadigi istemcidir
- Web projesi oyuncunun inventory, profil, forum ve market yuzudur
- Her iki istemci ayni backend veri kontratini kullanir

Oyuncu akis ornekleri:

1. Oyuncu Unity'de sandik acar
2. Loot sonucu backend'e event ve sync olarak yazilir
3. Web uygulamasi ayni oyuncunun envanterinde yeni item'i gosterir

1. Oyuncu Unity'de achievement acar
2. Achievement backend uzerinden profile/stats alanina islenir
3. Web tarafindaki profil sayfasi bunu gorur

1. Oyuncu web'de profil veya sosyal alanlari kullanir
2. Unity ayni oyuncu kimligi ile giris yaptiginda bu verilerin ilgili kismini okuyabilir

## Veri Sahipligi

Tutarlilik icin veri sahipligi soyle ele alinmalidir:

- Unity uretir:
  - gameplay event'leri
  - loot kazanimi
  - level progression
  - moment-to-moment player state
- Web/backend saklar ve dagitir:
  - inventory kayitlari
  - profile verisi
  - forum icerigi
  - market/trade verisi
  - ortak oyuncu istatistik gorunumu

Bu sayede oyuncu verisi tek merkezde tutulur; Unity ve web sadece farkli yuzler olur.

## Mevcut Teknik Durum

Bugunku kod tabaninda:

- HTTP tabanli `game/sync` ve `game/event` endpoint'leri vardir
- Profil, stats ve inventory okuma endpoint'leri vardir
- Temel Unity/C# ornegi vardir

Heniz tamamlanmayan kisimlar:

- Gercek zamanli push/subscription katmani
- Idempotent event tekrar kontrolu
- Unity ve web arasinda tum inventory formatlarinin tek semada birlestirilmesi
- Trade/shop akislarinin Unity tarafindan birebir tuketilecegi son veri kontratlari

## Base URL

```text
https://<SUPABASE_PROJECT_ID>.supabase.co/functions/v1/make-server-5d6242bb
```

Frontend tarafinda bu deger `VITE_SUPABASE_PROJECT_ID` ile olusturulur.

## Gerekli Header'lar

Tum isteklerde:

```http
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
```

Not:
- `game/sync` ve `game/event` endpoint'leri mevcut kodda wallet signature zorunlu kilmaz.
- Profil, forum, shop ve market tarafindaki bazi yazma endpoint'leri ayrica wallet-signature ister.

## Kullanilabilir Endpoint'ler

### 1. Oyun verisini senkronize et

`POST /game/sync`

Oyuncunun oyun ici ilerlemesini DUAN stats yapisina yazar.

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

#### Ne yapar

- `stats:<walletAddress>` kaydini olusturur veya gunceller
- `level` ve `xp` alanlarini yazar
- `xpToNextLevel` alanini `level * 100` formulu ile hesaplar
- Yeni achievement id'lerini achievement listesine ekler
- `itemsEarned` icindeki kayitlari envantere `source: "game_reward"` ile ekler

#### Response

```json
{
  "synced": true
}
```

#### Ornek

```ts
const response = await fetch(`${API_BASE_URL}/game/sync`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    walletAddress,
    level: 8,
    xp: 720,
    achievements: ['boss_1_clear', 'speedrun_rank_c'],
    itemsEarned: ['duan-reward-box'],
  }),
});

const result = await response.json();
```

### 2. Oyun eventi gonder

`POST /game/event`

Platform tarafinda event log tutmak veya sonraki isleme akislari icin ham olay yazmak icin kullanilir.

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

#### Onerilen event type ornekleri

- `level_up`
- `achievement_unlocked`
- `item_earned`
- `boss_defeated`
- `quest_completed`
- `milestone_reached`

Sunucu su anda event'i kaydeder ve loglar; event tipine gore ek is mantigi henuz minimal seviyededir.

### 3. Profil oku

`GET /profile/:walletAddress`

Profil kaydi yoksa backend varsayilan bir profil olusturur:

```json
{
  "walletAddress": "wallet_public_key",
  "username": "Player_abcd",
  "bio": "",
  "createdAt": "2026-03-23T10:00:00.000Z"
}
```

### 4. Profil istatistiklerini oku

`GET /profile/:walletAddress/stats`

Response yapisi:

```json
{
  "level": 1,
  "xp": 0,
  "xpToNextLevel": 100,
  "totalPosts": 0,
  "totalItems": 0,
  "totalTrades": 0,
  "achievements": []
}
```

### 5. Envanteri oku

`GET /inventory/:walletAddress`

Oyun tarafi, kullanicinin platform ve oyun kaynakli odullerini tek listede gorebilir.

### 6. Kullaniciyi odullendir

Envantere basit bir kayit dusmek icin:

`POST /inventory/:walletAddress`

#### Request body

```json
{
  "itemId": "reward_chest_01"
}
```

Not:
- Bu endpoint sunucu tarafinda su an signature dogrulamasi yapmiyor.
- Oyun ici odul dagitimi icin `game/sync` icindeki `itemsEarned` alani daha tutarli bir yol olabilir.
- `POST /inventory/:walletAddress` sonucu eklenen kayit sadece `itemId` tasir; `shop/purchase` gibi zengin `item` objesi donmez.

## JavaScript Entegrasyon Ornegi

```ts
const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5d6242bb`;

async function syncGameData(walletAddress, gameData) {
  const response = await fetch(`${API_BASE_URL}/game/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      walletAddress,
      ...gameData,
    }),
  });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }

  return response.json();
}

async function triggerGameEvent(walletAddress, eventType, eventData) {
  const response = await fetch(`${API_BASE_URL}/game/event`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      walletAddress,
      eventType,
      eventData,
    }),
  });

  if (!response.ok) {
    throw new Error(`Event failed: ${response.status}`);
  }

  return response.json();
}
```

## Unity / C# Ornegi

```csharp
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public async System.Threading.Tasks.Task<bool> TriggerGameEvent(
    string apiBaseUrl,
    string anonKey,
    string walletAddress,
    string eventType,
    string eventDataJson)
{
    var payload = JsonUtility.ToJson(new EventRequest
    {
        walletAddress = walletAddress,
        eventType = eventType,
        eventData = eventDataJson
    });

    using var request = new UnityWebRequest($"{apiBaseUrl}/game/event", "POST");
    var bodyRaw = Encoding.UTF8.GetBytes(payload);
    request.uploadHandler = new UploadHandlerRaw(bodyRaw);
    request.downloadHandler = new DownloadHandlerBuffer();
    request.SetRequestHeader("Authorization", $"Bearer {anonKey}");
    request.SetRequestHeader("Content-Type", "application/json");

    var operation = request.SendWebRequest();
    while (!operation.isDone)
    {
        await System.Threading.Tasks.Task.Yield();
    }

    return request.result == UnityWebRequest.Result.Success;
}
```

## Senkronizasyon Stratejisi

Onerilen model:

1. Oyuncu oturum actiginda profil ve stats cekin.
2. Oyun ici belirgin milestone'larda `game/event` cagin.
3. Kritik oyun durumlarinda kucuk event paketleriyle ilerleyin; buyuk state'i gereksiz yere tekrar gondermeyin.
4. Checkpoint, bolum sonu veya oturum kapanisinda `game/sync` ile toplu guncelleme yapin.
5. Web tarafinda ayni oyuncu verisini goruntuleyen ekranlar polling veya ileride eklenecek realtime katman ile yenilenmelidir.
4. UI tarafinda envanter gosterecekseniz `inventory/:walletAddress` verisini ayrica cekin.

## Performans ve Tutarlilik Notlari

Unity ile tam optimize ve es zamanliya yakin bir deneyim icin su kurallar izlenmelidir:

- Her event benzersiz bir istemci event id ile gonderilmelidir
- Ayni event tekrar gonderilse bile backend duplicate islem yapmamalidir
- Buyuk obje yerine degisen alanlar gonderilmelidir
- Inventory, achievement ve stats semalari Unity ve web tarafinda ortak tip mantigi ile tanimlanmalidir
- Kritik ekranlar stale veri gostermemeli; okunma sikligi ve cache suresi kontrollu olmali
- Auth modeli web ve Unity arasinda tek standarda inmeli

## Ornek Akis

Boss kesildi:

1. `POST /game/event` ile `boss_defeated`
2. Gerekliyse local state uzerinde odul hesaplama
3. `POST /game/sync` ile yeni XP, level, achievement ve item listesi

## Hata Yonetimi

Onerilen kontroller:

- `response.ok` kontrolu yapin
- 401/403 icin anon key veya imza gerektiren endpoint kullanimini dogrulayin
- 500 durumunda retry/backoff uygulayin
- Ayni achievement veya item odulunun tekrar gonderilebilme riskini istemci tarafinda da yonetin

Ornek basit retry:

```ts
async function withRetry(requestFn, retries = 3) {
  let lastError;

  for (let i = 0; i < retries; i += 1) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
    }
  }

  throw lastError;
}
```

## Bilinen Sinirlar

- `game/event` verisi su an log/record merkezlidir; event bazli odul motoru yoktur.
- `game/sync` item kayitlari sadece `itemId` saklayabilir; shop satin alimlarindaki kadar zengin item metadata'si olmayabilir.
- Inventory formatlari farkli kaynaklara gore degisebilir:
  - `shop/purchase` sonucu `item` objesi icerir
  - `game/sync` ve `inventory/:walletAddress` bazi kayitlarda sadece `itemId` tasiyabilir

Bu fark uygulama veya oyun istemcisinde normalize edilmelidir.
