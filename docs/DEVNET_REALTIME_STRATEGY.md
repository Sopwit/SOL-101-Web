# DEVNET REALTIME STRATEGY

Son guncelleme: 2026-03-27

Bu proje yakin vadede devnet odakli kalacagi icin realtime guncellemeler de
devnet pratiklerine gore secilmelidir.

## Hedef

- Shop, market ve forum ekranlari kullaniciya "bayat veri" hissi vermesin
- RPC ve backend maliyeti gereksiz yukselmesin
- Web ve Unity ayni olay diline yaklassin

## Onerilen Katmanlar

### Shop

- birincil:
  kisa interval polling
- destek:
  window focus refresh
- event tabanli:
  purchase sonrasi optimistic refresh

Onerilen aralik:
- shop snapshot:
  20-30 saniye
- token feed:
  30-60 saniye

### Market

- listing feed:
  20 saniye polling
- create/cancel trade sonrasi:
  anlik refresh

### Forum

- post feed:
  30 saniye polling
- detail acikken comments:
  15 saniye polling veya manual refresh

### Ops Dashboard

- health:
  30 saniye polling
- focus refresh:
  aktif

## Neden SSE/WebSocket Degil

Devnet asamasinda:

- backend complexity artiyor
- reconnect/state management maliyeti yukseliyor
- test ortami icin polling yeterli ve daha tahmin edilebilir

Bu nedenle once polling-first model tercih edilir.

## P2 Sonrasi Gecis Kriteri

Asagidaki kosullardan ikisi saglanirsa SSE/WebSocket'e gecis degerlendirilir:

- ayni anda yuksek sayida aktif kullanici
- market/forum feed'inde 5-10 saniyeden dusuk gecikme ihtiyaci
- backend event bus veya queue katmaninin hazir olmasi
- ops dashboard'da olay tabanli alarm ihtiyaci
