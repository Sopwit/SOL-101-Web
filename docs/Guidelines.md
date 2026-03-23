# DUAN Gelistirme Rehberi

Bu dosya, repo uzerinde calisan ekip uyeleri icin teknik ve dokumantasyon odakli ortak kurallari toplar. Amac; kod, arayuz ve belgeler arasindaki anlamsal kopuklugu azaltmaktir.

## Temel Ilkeler

- Belgeler koddan geri kalmamali.
- Mock ve production benzeri akislar acik bicimde ayristirilmali.
- Frontend'de gorunen her kritik davranisin backend karsiligi veya "heniz bagli degil" notu olmali.
- Wallet imzasi gerektiren islemler hem kodda hem dokumanda ayni action ismini kullanmali.
- Yeni bir ozellik tamamlandiginda ilgili `README` veya `docs/` dosyasi ayni PR icinde guncellenmeli.
- Unity entegrasyonu birincil senaryo kabul edilmeli; veri modeli kararlarinda Unity istemcisi ilk sinif vatandas gibi ele alinmali.
- Web ve Unity ayri urunler degil, tek oyuncu deneyiminin iki istemcisi olarak ele alinmali.

## Dokumantasyon Kurallari

- `README.md` yuksek seviyeli urun durumu ve kurulum icin referans kaynaktir.
- `docs/GAME_INTEGRATION.md` sadece guncel, gercek endpoint'leri icermelidir.
- Bilinen eksikler dokumanlardan saklanmamalidir; "tamamlanmadi", "mock", "UI-only" gibi ibareler net kullanilmalidir.
- Endpoint, environment variable, route veya auth yapisi degistiginde ayni degisiklik ilgili dokumanda da yapilmalidir.
- Kod ile dokuman uyusmuyorsa kaynak gercek kabul edilir ve dokuman hemen duzeltilir.

## Frontend Kurallari

- Dil destegi olan yeni metinler `LanguageContext` icine eklenmelidir.
- Wallet gerektiren aksiyonlar kullaniciya acik hata mesaji dondurmelidir.
- Demo verisi kullanilan ekranlarda fallback davranisi bilincli olmali; sessizce gercek veriymis gibi davranilmamali.
- Shop, Market ve Profil ekranlarinda mock veriden gercek API'a gecis yapilirken veri formati normalize edilmelidir.

## Backend Kurallari

- Yazan endpoint'ler mumkun oldugunca tutarli auth davranisi gostermelidir.
- Wallet signature isteyen endpoint'lerde action isimleri frontend ile birebir ayni olmalidir.
- Veri semalari kaynaga gore degisiyorsa bu fark ya normalize edilmeli ya da acikca belgelenmelidir.
- Default/fallback response'lar istemciyi bozmayacak sekilde tahmin edilebilir olmali.
- Unity ve web icin ayri ayri degil, paylasilabilir veri kontratlari tasarlanmalidir.
- Es zamanliya yakin deneyim icin endpoint'ler idempotency, ordering ve partial update mantigi dusunulerek tasarlanmalidir.
- Inventory, profile, stats ve achievement gibi alanlarda backend ortak source of truth olmalidir.

## Auth ve Guvenlik

- Imzalanan mesaj semasi standart tutulmali:
  - `domain`
  - `action`
  - `walletAddress`
  - `timestamp`
- Message action isimleri snake_case veya kebab/camel karisik olmayacak sekilde tek standarda indirilmeli.
- `AUTH_MAX_AGE_MS` gibi sure sinirlari degisirse client akislari ve dokuman birlikte gozden gecirilmeli.

## UI ve Tasarim

- Mevcut tema "cosmic / glass" cizgisini korumali.
- Light/dark tema destegi bozulmamali.
- Mobil gorunum ikinci sinif kabul edilmemeli; yeni bilesenler dar ekranlarda da test edilmelidir.
- shadcn/ui bilesenleri kullaniliyorsa proje stil diline uyarlanmis halleri tercih edilmelidir.

## Kod Organizasyonu

- Route seviyesindeki ekranlar `src/app/pages` altinda kalmali.
- Ortak UI bilesenleri `src/app/components` icinde tutulmali.
- API cagrilari `src/app/services/api.ts` uzerinden merkezilesmeli.
- Gecici mock veri `src/app/lib/mockData.ts` disina tasmamalidir.

## Test ve Dogrulama

- Yeni endpoint eklendiginde en azindan manuel dogrulama senaryosu dokumante edilmelidir.
- Mock -> real API gecislerinde bos veri, hatali auth ve network error senaryolari kontrol edilmelidir.
- Diger ekip uyeleri icin "hangi kisim gercek, hangi kisim demo" sorusu dokumana bakarak cevaplanabilmelidir.
- Unity istemcisi ve web istemcisi ayni oyuncu icin tutarli veri goruyor mu sorusu her kritik ozellikte test edilmelidir.

## Her Ozellik Sonrasi Kontrol Listesi

- Kod tamamlandi mi
- Wallet/auth akisi dogrulandi mi
- UI text'leri iki dilde eklendi mi
- `README.md` veya ilgili `docs/` dosyasi guncellendi mi
- Mock kullanimlari gerekiyorsa acikca not edildi mi
