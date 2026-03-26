# Repo Yapisi ve Sorumluluklar

Bu belge, depodaki ana klasorlerin ne is yaptigini ve hangilerinin kaynak kod, hangilerinin uretilen cikti oldugunu netlestirir.

## Kaynak Klasorler

### `.github/`

- GitHub Actions workflow dosyalari burada tutulur.
- CI, lint ve build kurallari bu klasordedir.
- Kaynak dosyadir; elle guncellenebilir.

### `docs/`

- Kurulum, entegrasyon ve ekip ici rehberler burada bulunur.
- Kod davranisi degistiginde ilgili belge ayni degisiklik setinde guncellenmelidir.

### `functions/server/`

- Supabase Edge Function kaynagi burada yer alir.
- Route tanimlari, wallet auth, forum/shop/market/profile mantigi bu klasordedir.
- `index.tsx` uygulama girisidir.
- `kv_store.tsx` auto-generated veri erisim katmanidir; zorunlu olmadikca elle degistirilmez.

### `shared/`

- Frontend ve backend tarafinin ayni kaynaktan okudugu sabitler vardir.
- Ekonomi oranlari, shop katalogu ve profil kozmetikleri burada tutulur.

### `src/`

- React istemcisi burada yer alir.
- Sayfalar `src/app/pages`, API erisimi `src/app/services`, ortak yardimcilar `src/app/lib` altindadir.

## Uretilen / Gecici Klasorler

### `.vite/`

- Vite gelistirme cache klasorudur.
- Elle duzenlenmez.
- Silinse bile `npm run dev` ile yeniden uretilir.

### `dist/`

- Production build ciktisidir.
- Elle duzenlenmez.
- `npm run build` ile yeniden uretilir.

## Veri Yollari

Projede temel veri akisi su sekildedir:

1. React istemcisi `src/app/services/api.ts` uzerinden Edge Function cagrir.
2. Edge Function `functions/server/index.tsx` uzerinde route bazli is mantigini calistirir.
3. Kalici veri `functions/server/kv_store.tsx` uzerinden Supabase tablosuna yazilir veya okunur.
4. Ortak ekonomik ve katalog sabitleri `shared/` altindan her iki tarafa da tasinir.

## Pratik Kurallar

- `.vite/` ve `dist/` icine yorum, dokumantasyon veya kalici is mantigi eklenmez.
- Yeni route eklenirse `functions/server/index.tsx`, `src/app/services/api.ts` ve ilgili `docs/` dosyasi birlikte guncellenmelidir.
- Yeni ortak sabitler once `shared/` altina alinmali, sonra frontend/backend tarafinda kullanilmalidir.
