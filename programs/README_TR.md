# programs Klasoru

Bu klasor, DUAN projesinin Solana program kaynaklarini barindirir.

Su an aktif program:

- `programs/duan_shop/`

Bu programin rolu:

- on-chain shop durumunu tutmak
- item fiyat/stok bilgisini saklamak
- satin alma sonrasinda oyuncu sahipligini ve profil sayaçlarini guncellemek

Frontend ile baglantili dosyalar:

- `src/app/lib/onchain/duanShopClient.ts`
- `shared/shopCatalog.ts`
- `shared/duanEconomy.ts`

Pratik kurallar:

- Bu klasor kaynak koddur, elle duzenlenebilir
- On-chain veri kontrati degisirse frontend ve backend entegrasyonu birlikte gozden gecirilmelidir
- PDA seed degisiklikleri dokumanda ve istemci kodunda ayni turde guncellenmelidir
