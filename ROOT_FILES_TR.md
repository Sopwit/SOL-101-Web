# Kok Dizin Dosyalari

Bu belge, klasor disinda kalan kok dosyalarin ne is yaptigini hizli okumak icin eklenmistir.

## Kaynak ve Konfig Dosyalari

- `README.md`
  - proje ozetini ve genel kurulum akisini anlatir
- `package.json`
  - frontend komutlari ve npm bagimliliklari
- `vite.config.ts`
  - Vite build, chunk ve polyfill ayarlari
- `eslint.config.mjs`
  - lint kurallari ve ignore listesi
- `postcss.config.mjs`
  - PostCSS genisletme noktasi
- `Anchor.toml`
  - Anchor/Devnet program konfigurasyonu
- `Cargo.toml`
  - Rust workspace konfigurasyonu
- `index.html`
  - Vite istemcisinin HTML giris kabugu
- `.env.example`
  - gerekli environment degiskenlerinin ornek semasi
- `.gitignore`
  - repoya alinmamasi gereken uretilen veya yerel dosyalar

## Uretilen veya Yerel Dosyalar

- `package-lock.json`
  - npm lock dosyasi, elle duzenlenmez
- `Cargo.lock`
  - Rust lock dosyasi, genelde elle duzenlenmez
- `.env`
  - yerel gelistirme ortami
- `.env.server.local`
  - yerel server override dosyasi
- `.DS_Store`
  - macOS tarafindan uretilir, kaynak dosya degildir
