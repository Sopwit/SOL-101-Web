# scripts Klasoru

Bu klasor, repo icindeki operasyonel yardimci betikleri tutar.

Su anki ana betik:

- `sync-onchain-shop.ts`
  - ortak shop katalogunu Anchor programina yazar
  - item PDA'larini hesaplar
  - shop config ve on-chain item durumunu senkronize eder
- `set-game-authority.ts`
  - shop config icindeki `game_authority` alanini gunceller
  - Unity veya backend tarafinin `upsert_player_profile` yazabilmesi icin kullanilir
- `sync-onchain-idl.mjs`
  - `target/idl/duan_shop.json` dosyasini frontend istemcisine kopyalar

Pratik kural:

- Buradaki betikler urun runtime'inin kendisi degil, operasyon aracidir
- Betik veri kontrati degistiriyorsa `shared/`, `programs/` ve `src/app/lib/onchain/` birlikte gozden gecirilmelidir
