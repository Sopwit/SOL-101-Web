# shared Klasoru

Bu klasor, frontend ve backend tarafinin ayni kaynaktan okudugu ortak sabitleri ve veri tanimlarini tutar.

Mevcut ana dosyalar:

- `duanEconomy.ts`
  - DUAN/SOL orani
  - shop fiyat katmanlari
- `shopCatalog.ts`
  - ortak item katalogu
  - stok ve restock varsayimlari
- `profileCosmetics.ts`
  - profil simgesi ve arka plan secenekleri

Pratik kural:

- Ekonomi, katalog veya kozmetik degisiklikleri once burada yapilmali
- Ayni sabit frontend ve backend tarafinda kopyalanmamalidir
