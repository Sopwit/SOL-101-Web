# migrations Klasoru

Bu klasor su an dogrudan aktif migration dosyasi barindirmiyor.

Projede kullanilan Supabase migration dosyalari fiilen su klasorde tutulur:

- `supabase/migrations/`

Bu klasor bos veya ayrik tutuluyorsa anlami sunudur:

- uygulamanin tarihsel ya da alternatif migration noktasi olarak ayrilmistir
- aktif veri tabani kurulum akisi icin referans klasor degildir

Pratik kural:

- Yeni veritabani migration'lari burada degil, `supabase/migrations/` altinda tutulmalidir
- Bu klasore kalici migration mantigi eklenmeden once ekip karari verilmelidir
