# src Klasoru

Bu klasor React istemcisinin kaynak kodunu barindirir.

Ana alt yapilar:

- `app/pages/`
  - route seviyesindeki ekranlar
- `app/components/`
  - ortak UI bilesenleri
- `app/services/`
  - backend API istemcisi
- `app/lib/`
  - on-chain yardimcilari, cache ve diger ortak frontend araclari
- `styles/`
  - tema, font ve Tailwind giris dosyalari

Veri yolu ozeti:

1. Sayfalar `services/api.ts` ile backend'e gider
2. Ortak ekonomik ve katalog verileri `shared/` klasorunden gelir
3. On-chain akis gerekiyorsa `app/lib/onchain/` kullanilir
