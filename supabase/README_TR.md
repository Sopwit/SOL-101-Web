# supabase Klasoru

Bu klasor, Supabase CLI ve deploy akisina ait proje dosyalarini barindirir.

Alt klasorler:

- `functions/`
  - deploy edilen function giris dosyalari
- `migrations/`
  - veritabani migration dosyalari
- `.temp/`
  - CLI tarafindan uretilen gecici dosyalar

Not:

- `supabase/functions/make-server-5d6242bb/index.ts` dosyasi bir bridge dosyasidir
- asil backend mantigi `functions/server/index.tsx` icinde yazilir
