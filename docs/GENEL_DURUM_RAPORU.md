# GENEL DURUM RAPORU

Tarih: 2026-03-27

## Ozet

SOL-101 projesi bu asamada devnet odakli calisacak sekilde duzenlenmistir.
Mainnet rollout veya mainnet readiness bu fazin parcasi degildir.

Web tarafi:
- yeni tasarim sistemine buyuk oranda gecirildi
- sayfa ici daginik health kartlari yerine sayfa bazli status rail yapisina alindi
- shop on-chain katalog akisi devnet davranisina gore sertlestirildi

Solana tarafi:
- `duan_shop` programi devnet'e deploy edildi
- shop item katalogu on-chain'e sync edildi
- frontend IDL guncellendi
- game authority yazimi yapildi

Unity tarafi:
- `SolanaInventorySync` artik hayali `player-v1` modeline dayanmiyor
- `duan_shop` programinin `player-profile` ve `owned-item` modeline read-only hizalandi
- wallet ile dogrudan yapilamayan profile save akisi hatali sekilde "calisiyor" gibi davranmiyor

## Son Kapatilan Kritik Sorunlar

### 1. Shop On-Chain Catalog Kiriliyordu

Belirti:
- Magazada itemler ve gorseller gelmiyordu
- status tarafinda su hata goruluyordu:
  `On-chain shop hesaplari okunurken hata alindi: Cannot read properties of undefined (reading 'toString')`

Kok neden:
- On-chain decode edilen Anchor account alanlari frontend tarafinda `camelCase` varsayiliyordu
- Gercek decode ciktilari `snake_case` alanlar donduruyordu
  - `item_id`
  - `base_price`
  - `sold_count`
  - `restock_at`
  - `restock_duration_seconds`
  - `xp_to_next_level`
  - `total_items`
  - `total_trades`

Uygulanan cozum:
- `src/app/lib/onchain/duanShopClient.ts` icinde alan esleme katmani eklendi
- `ShopItem`, `OwnedItem`, `PlayerProfile` decode akislari gercek alan adlarina gore duzeltildi

Sonuc:
- shop itemleri yeniden okunabiliyor
- gorseller geri geliyor
- on-chain status katmani dogru veriyle besleniyor

### 2. Shop "Kapali" Davranisi Fazla Sertti

Belirti:
- `anchor deploy` ve `sync-shop` tamamlanmis olsa bile UI bazen shop'i kapali gibi gosteriyordu

Kok neden:
- tek seferlik RPC/program/config kontrolu anlik hata alirsa UI bunu direkt kritik kesinti gibi yorumluyordu

Uygulanan cozum:
- shop snapshot mantigina tekrar deneme eklendi
- periyodik yenileme eklendi
- pencere focus oldugunda tekrar kontrol eklendi
- status rail icinde endpoint ve son kontrol zamani gosterilmeye baslandi
- `program_missing` durumu devnet akisinda daha yumusak yorumlanir hale getirildi

### 3. Profile'da Gereksiz On-Chain Uyari Vardi

Belirti:
- `On-chain player profile hesabi bulunamadi veya henuz olusmadi.`
- kullanici bunu servis bozuk gibi goruyordu

Gercek durum:
- `player-profile` hesabi her cuzdanda varsayilan olarak olusmaz
- ilk satin alim veya authority tabanli profile sync sonrasi olusmasi dogal olabilir

Uygulanan cozum:
- bu durum artik "degraded service" gibi siniflanmiyor
- devnet akisinda normal bilgilendirme olarak ele aliniyor

## Web Durumu

### Tasarim

Tamamlananlar:
- ortak shell / hero / spacing sistemi
- Shop, Market, Forum, Profile icin uyumlu sayfa dili
- dialog / form / tab primitive'lerinin yeni sisteme alinmasi
- status bilgilerini sayfa ici karmasadan cikarip yan rail yapisina tasima

Durum:
- ana yuzey kalitesi iyi
- mobil/tablet mikro spacing ve son polish turu hala yapilabilir

### Health / Status Katmani

Mevcut durum:
- Shop: on-chain, backend token feed, assets
- Market: backend listing feed, on-chain inventory
- Profile: backend profile, backend stats, on-chain progression
- Forum: backend post feed, backend comment stream

Kural:
- bu tip uyarilar yalnizca ilgili sayfanin kendi status rail'inde gorunur
- kullaniciya popup/toast olarak daginik sekilde verilmez

### Testler

Calisanlar:
- `npm run lint`
- `npm run build`
- `npm run test:smoke`

Smoke coverage:
- wallet bridge callback guvenligi
- on-chain shop snapshot hata siniflandirmalari

Eksik:
- route-level testler
- success-path on-chain veri akislari
- sayfa bazli integration testler

## Solana / Devnet Durumu

### Mevcut Zincir Durumu

Tamamlananlar:
- `anchor deploy`
- `solana:sync-idl`
- `solana:sync-shop`
- `solana:set-game-authority`
- DUAN mint tanimi ve frontend baglantisi

Aktif varsayim:
- sistem devnet'te calisir
- RPC ve UI yorumlari devnet dalgalanmasini tolere edecek sekilde tasarlanir

### Bilincli Mimari Not

`duan_shop` programinda:
- satin alma ve item sahipligi on-chain
- `player-profile` progression verisi on-chain destekli
- fakat profile write yetkisi `game_authority` uzerinde

Bu ne anlama gelir:
- istemci wallet'i kendi basina `upsert_player_profile` cagrisi yapamaz
- backend veya guvenli authority katmani gerekir

## Backend Durumu

Tamamlananlar:
- `game/sync` endpoint'i authority tabanli on-chain `upsert_player_profile` cagirabilecek sekilde genisletildi
- wallet auth dogrulamasi aktif
- shop / market / forum / profile backend akislarinda temel stabilite var

Operasyonel blocker:
- gercek ortamda `DUAN_SHOP_GAME_AUTHORITY_SECRET_KEY` tanimlanmadan on-chain profile write dogrulanmis sayilmaz

## Unity Durumu

### Tamamlananlar

- `SolanaInventorySync` sync mode ayrimi
- Anchor config guard
- `player-profile` PDA ve `owned-item` read path hizalamasi
- istemci tarafinda yapilamayan save'in yanlis pozitif davranisinin kapatilmasi
- backend sync sonucunda on-chain profile sync warning'i yuzeye cikarilmasi

### Kritik Not

Unity API klasorundeki dosyalar isim olarak kafa karistirici olsa da su an birebir duplicate degiller:
- `Apiclient.cs` = Solana JSON-RPC istemcisi (`SolanaApiClient`)
- `DuanApiClient.cs` = backend HTTP istemcisi (`DuanApiClient`)
- `Apiconfig.cs` = Solana chain/runtime config (`SolanaConfig`)
- `DuanApiConfig.cs` = backend/wallet bridge config (`DuanApiConfig`)

Yani bunlar "ayni isi yapan iki dosya" degil, fakat adlandirma legacy ve duzenlenmesi gerekiyor.

## Kalan P0

1. Backend runtime'da `DUAN_SHOP_GAME_AUTHORITY_SECRET_KEY` ile `game/sync` on-chain profile write akisini gercekten calistirip dogrulamak.
2. Unity tarafinda `owned-item` ve `player-profile` okumasini Editor ve WebGL build icinde canli test etmek.
3. Unity API klasorundeki legacy adlandirmayi temizlemek.
4. Shop metadata stratejisini netlestirmek.
5. Web test katmanini route-level ve success-path akislarla genisletmek.

## Kalan P1

1. Forum medya upload servisi.
2. Market settlement/escrow modeli.
3. Mobile/tablet spacing polish.
4. Empty/maintenance/skeleton state standardizasyonu.
5. Status/health deneyimini daha ayrintili hale getirmek.

## Mevcut Riskler

- Unity runtime dogrulamasi henuz editor/webgl canli test ile kapanmadi.
- Backend authority secret tanimsizsa profile write zincire gitmez.
- Shop metadata hala hibrit.
- Market ve Forum cekirdegi backend tabanli.
- Test kapsami hala sinirli.

## Onerilen Siradaki Adim

En mantikli teknik sira:

1. Backend authority secret ile on-chain profile sync'i gercek ortamda dogrula
2. Unity runtime devnet testi yap
3. Unity API legacy isimlendirmesini temizle
4. Sonra route-level testleri genislet
