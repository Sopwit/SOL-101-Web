# DUAN Smoke Test Kontrol Listesi

Bu belge, demo veya deploy oncesi uygulamanin temel akislarini hizlica dogrulamak icin kullanilir.

## 1. Genel Sistem

- Uygulama aciliyor mu
- Ust menu ve sayfa gecisleri calisiyor mu
- Beklenmeyen runtime hata ekrani gorunmuyor mu
- Dil degistirme calisiyor mu
- Tema degistirme calisiyor mu

## 2. Wallet

- Wallet baglanabiliyor mu
- Wallet bagli degilken korumali aksiyonlar anlamli hata veriyor mu
- Wallet baglandiginda profil ve market gibi sayfalar dogru kullanici ile aciliyor mu

## 3. Ana Sayfa

- Platform istatistikleri geliyor mu
- Geri donuldugunde sayfa uzun loading'e dusmeden aciliyor mu
- Aktif kullanici, item ve trade sayilari backend verisi ile doluyor mu

## 4. Forum

- Post listesi gorunuyor mu
- Yeni post olusturulabiliyor mu
- Post arayuz dili farkliysa ceviri gorunuyor mu
- Like atildiginda sayi ve durum tutarli kaliyor mu
- Yorum eklenebiliyor mu
- Kendi postunu silme butonu gorunuyor mu ve calisiyor mu

## 5. Shop

- Item listesi hizli aciliyor mu
- Fiyatlar DUAN ve SOL karsiligi ile gorunuyor mu
- Stok ve restock bilgisi anlamli gorunuyor mu
- Satin alma sonrasi basari mesaji geliyor mu
- Satin alinan item profil/envanter tarafina yansiyor mu

## 6. Market

- Global akış aciliyor mu
- `Ilanlarim` sekmesi dogru kullanicinin ilanlarini gosteriyor mu
- Envanterden item secerek ilan olusturulabiliyor mu
- Pazar metinleri arayuz diline gore cevriliyor mu
- Kendi ilanini kapatma akisi calisiyor mu
- Kendi ilanina teklif gonderilemedigi dogrulaniyor mu

## 7. Profil

- Profil verisi wallet degisiminde dogru yenileniyor mu
- Username ve bio guncellenebiliyor mu
- Kozmetik secimi/acma akisi calisiyor mu
- Seviye, XP, basari ve odul bakiyeleri dogru gorunuyor mu
- Envanter ve istatistik alanlari bos veya kirik state'e dusmuyor mu

## 8. Backend ve Servis

- `GET /health` basarili mi
- `GET /shop/items` veri donduruyor mu
- `GET /stats/platform` veri donduruyor mu
- Forum ve market yazma endpoint'leri imzali istek ile cevap veriyor mu

## 9. Son Kontrol

- `npm run lint`
- `npm run build`
- gerekiyorsa `cargo check`

Bu kontrol listesi, deploy veya demo oncesi minimum kabul kriteridir.
