# scripts Klasoru

Bu klasor, repo icindeki operasyonel yardimci betikleri tutar.

Su anki ana betik:

- `sync-onchain-shop.ts`
  - ortak shop katalogunu Anchor programina yazar
  - item PDA'larini hesaplar
  - shop config ve on-chain item durumunu senkronize eder

Pratik kural:

- Buradaki betikler urun runtime'inin kendisi degil, operasyon aracidir
- Betik veri kontrati degistiriyorsa `shared/`, `programs/` ve `src/app/lib/onchain/` birlikte gozden gecirilmelidir
