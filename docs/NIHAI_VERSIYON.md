# NIHAI VERSIYON

Bu dosya sabit rapor degil, yasayan uygulama plani olarak tutulur.
Tamamlanan maddeler buradan silinir.
Yeni tespit edilen riskler veya yapilacaklar eklenir.

Son guncelleme: 2026-03-27

## Mevcut Durum

- Proje bu asamada devnet odakli ilerler; mainnet rollout veya mainnet hazirlik
  kapsam dahilinde degildir.
- Web tasarim sistemi genel olarak yeni premium dile tasindi.
- Home, Shop, Market, Forum ve Profile ortak shell, hero ve spacing sistemi kullaniyor.
- Shop icin sag notification rail ve kaynak bazli durum yapisi mevcut.
- Shop on-chain durumu tek kontrol sonucuna bagli kalmiyor; periyodik/focus
  yenileme ve tekrar deneme mantigi ile daha dinamik guncelleniyor.
- Shop ve profile on-chain durumu devnet akisina gore daha dogru yorumlaniyor:
  tekil RPC dogrulama problemi "kapali"ya zorlanmiyor, henuz olusmamis
  `player-profile` hesabi ise servis hatasi gibi sunulmuyor.
- Market, Profile ve Forum icin durum bilgileri sayfa icinden cikarilip
  ilgili status rail yapisina tasindi.
- Wallet bridge callback akisi allowlist mantigi ile sertlestirildi.
- Web tarafinda hafif global telemetry katmani eklendi:
  global `error` / `unhandledrejection` dinleyicileri ve ortak `reportError` yardimcisi aktif.
- DUAN mint ve Solana operasyon scriptleri hazir durumda.
- duan_shop programi devnet'e deploy edildi.
- Frontend IDL sync, on-chain shop sync ve game authority yazimi tamamlandi.
- Web tarafinda temel smoke test katmani eklendi.
- Web smoke testleri wallet bridge disinda on-chain shop snapshot hata
  siniflandirmalarini da kapsayacak sekilde genisletildi.
- Unity tarafinda web/backend/wallet bridge entegrasyon katmani mevcut.
- Unity `SolanaInventorySync` icin sync mode ayrimi ve Anchor config guard katmani eklendi.
  Script artik eksik Anchor kurulumunu production gibi gostermiyor.
- Unity `SolanaInventorySync` artik hayali `player-v1` modelini esas almiyor;
  duan_shop `player-profile` + `owned-item` yapisina read-only hizalama baslatildi.
- Unity tarafinda wallet ile dogrudan profile save denemesi AnchorProgram modunda kapatildi.
  Cunku gercek `upsert_player_profile` instruction'i `game_authority` imzasi istiyor.
- Backend `game/sync` endpoint'i authority tabanli on-chain `upsert_player_profile`
  cagrisi yapacak sekilde genisletildi.
- Unity `PlayerProgressSync` backend sync sonrasinda on-chain profil sync sonucunu
  okuyup warning olarak yuzeye cikarmaya basladi.
- Backend health endpoint'i Solana devnet runtime, program deploy, shop-config ve
  game authority readiness bilgisini dondurecek sekilde genisletildi.
- Profile status rail artik backend game sync yaziminin gercek runtime hazirlik
  durumunu ayri bir status karti olarak gosteriyor.
- Web smoke testleri hata yollari disinda healthy catalog, owned-item ve
  player-profile success-path decode senaryolarini da kapsiyor.
- Shop, Market, Forum ve Profile status rail'leri ortak backend runtime/devnet
  health bilgisini periyodik olarak guncelleyip gosterecek sekilde hizalandi.
- Forum create-post akisinda opsiyonel medya URL girisi, preview ve post/detail
  gorsel gosterimi eklendi.
- Shop, Market, Forum ve Profile icin empty, maintenance ve loading state'leri
  ortak premium kart diliyle standardize edildi.
- Global page spacing ritmi mobil/tablet/Desktop icin biraz daha ferah hale getirildi.
- Market, Forum ve Profile status rail'leri daha ayrintili context bilgileriyle
  zenginlestirildi.
- Market settlement modeli ve forum storage akisi icin P1 tasarim notlari
  dokumante edildi: `P1_TASARIM_NOTLARI.md`
- Ops dashboard route'u eklendi; backend health, devnet runtime ve on-chain
  shop snapshot tek ekranda izlenebilir durumda.
- Shared metadata stratejisi dokumante edildi: `SHARED_METADATA_STRATEGY.md`
- Devnet realtime/polling stratejisi dokumante edildi: `DEVNET_REALTIME_STRATEGY.md`
- Hata sonrasi ana sayfaya zorla donus akisi eklendi; bagli wallet olsa bile
  `/?forceHome=1` ile Home ekrani acilabiliyor.
- Global route crash fallback yumusatildi; tek rota hatasi tum uygulamayi sert
  servis ekranina dusurmuyor.
- `duan_market` Anchor program iskeleti workspace'e eklendi ve `anchor build`
  ile derlendi.
- Web tarafinda `duan_market` on-chain istemcisi eklendi; market listing/trade
  akisi on-chain-first + backend mirror mantigina gecmeye basladi.
- Backend market mirror kayitlari on-chain PDA/program/signature alanlarini
  tasiyacak sekilde genisletildi.
- Market IDL sync script'i eklendi: `npm run solana:sync-market-idl`

## Simdi Yapilacaklar

### P0

- Devnet runtime dogrulamasi:
  shop, profile ve game sync akislarini gercek devnet verisiyle tekrar kontrol et.
- Unity tarafinda owned-item / player-profile okumasini Unity Editor ve WebGL build icinde dogrula.
- Backend runtime secret'larini tanimla ve health/status ciktisinda hazir
  gorundugunu dogrulayip `game/sync` on-chain profile write akisini gercek
  ortamda test et.
- Shop metadata stratejisini netlestir:
  gorsel/aciklama zincire mi tasinacak, signed off-chain metadata mi kullanilacak.
- Unity API klasorundeki duplicate/legacy dosyalari temizle:
  `Apiclient.cs` / `DuanApiClient.cs`
  `Apiconfig.cs` / `DuanApiConfig.cs`
- Web test katmanini route-level ve gercek success-path on-chain veri akis
  testleri ile daha da genislet.

### P1

- Son UI polish turunu fiziksel cihaz testleriyle dogrula.

### P2

- `duan_market` programini deploy/runtime ortaminda dogrula ve devnet'e ac.
- Unity market client katmanini `duan_market` PDA ve mirror modeliyle hizala.
- Binary upload/storage akisi istenirse forum medya servisini object storage ile tamamla.
- Mainnet readiness checklist.

## Kritik Riskler

- Unity on-chain inventory read akisi kod olarak hizalandi ama Editor/WebGL runtime
  dogrulamasi henuz yapilmadi.
- Shop ekonomik veri olarak on-chain, metadata olarak hibrit.
- Market ve Forum cekirdegi halen backend tabanli.
- Web tarafinda sadece temel smoke test var; entegrasyon kapsami henuz dar.
- Web tarafinda hata yollari icin smoke coverage var; success-path ve route-level
  kapsami halen sinirli.
- Unity API klasorunde tarihsel katmanlar karisik.
- Mevcut duan_shop programinda oyuncu ilerlemesi icin write yetkisi `game_authority`
  uzerinde; backend secret/runtime tanimi olmadan on-chain profile sync calismaz.
- `player-profile` hesabi satin alim veya authority sync olmadan her cuzdanda
  otomatik var olmayacagi icin UI bunu servis kesintisi ile karistirmamali.

## Mimari Karar Bekleyen Konular

- Shop tam on-chain mi, hibrit mi?
- Market listing backend, settlement on-chain mi olacak?
- Forum tamamen backend mi kalacak?
- Unity source-of-truth hangi verilerde backend, hangi verilerde Solana olacak?
- Oyuncu progression zincire ne kadar yazilacak?
- Devnet surecinde hangi saglik sinyalleri "uyari", hangileri yalnizca
  "bilgilendirme" olarak gosterilecek?

## Onerilen Sonraki Adim

En dogru siradaki is:

1. Backend game authority secret'i ile on-chain profile sync'i gercek ortamda dogrulamak
2. Unity read path'ini Editor/WebGL uzerinde dogrulamak
3. Sonra web test katmanini genisletmek
