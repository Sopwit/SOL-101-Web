# public Klasoru

Bu klasor, build sirasinda oldugu gibi kopyalanan statik varliklari barindirir.

Projede su an en kritik kullanim:

- `public/assets/shop-items/`
  - shop ve market ekranlarinda kullanilan item gorselleri

Pratik kurallar:

- Bu klasordeki dosyalar import edilmeden dogrudan URL ile servis edilebilir
- Varlik adlari ASCII ve stabil tutulmalidir
- Gorsel degisecekse dosya adi ve frontend referanslari birlikte guncellenmelidir
- Is mantigi bu klasore konulmamalidir; burada sadece statik icerik tutulmalidir
