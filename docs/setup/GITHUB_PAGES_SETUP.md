# GitHub Pages Setup

Bu repo GitHub Pages icin hazirlandi. Workflow dosyasi:

- `.github/workflows/deploy-pages.yml`

## GitHub Uzerinde Yapman Gerekenler

GitHub repo icinde:

1. `Settings`
2. `Secrets and variables`
3. `Actions`

Sonra su degerleri ekle.

## Repository Variables

`VITE_SUPABASE_PROJECT_ID`

```text
qswxfzzpignrowepfwmn
```

`VITE_SOLANA_CLUSTER`

```text
devnet
```

`VITE_SOLANA_RPC_URL`

```text
https://api.devnet.solana.com
```

`VITE_SOLANA_TOKEN_MINT`

```text
FpoDer4w6cDubBgdd4kqdRqru69iJB3KZLoPAvbhSye
```

`VITE_ADMIN_WALLETS`

```text
CvtkeP6o4z8q9yTFnENeVNaeySFDoM7pAq1Km6GCkU7h
```

`VITE_WALLET_BRIDGE_ALLOWED_CALLBACK_PREFIXES`

```text
sol101://wallet-bridge,unitydl://wallet-bridge
```

`VITE_TELEMETRY_ENDPOINT`

Bu opsiyonel. Kullanmiyorsan bos birak veya hic ekleme.

## Repository Secrets

`VITE_SUPABASE_ANON_KEY`

Bu degeri repo `.env` dosyasindaki `VITE_SUPABASE_ANON_KEY` ile ayni olacak sekilde secret olarak ekle.

## Pages Ayari

`Settings > Pages` altinda:

- `Source`: `GitHub Actions`

## Deploy Sirası

Kod `main` branch'ine gittiginde Pages workflow otomatik calisir.

Elle tetiklemek istersen:

1. `Actions`
2. `Deploy GitHub Pages`
3. `Run workflow`

## Solana Tarafi Notu

Pages deploy oncesi Solana tarafinda bunlarin guncel oldugundan emin ol:

1. `duan_shop` devnet deploy guncel mi
2. `duan_market` devnet deploy guncel mi
3. `npm run solana:sync-idl`
4. `npm run solana:sync-market-idl`
5. `npm run solana:sync-shop`
6. `npm run solana:set-game-authority`

Eger Anchor programlarda sonradan degisiklik yapildiysa `anchor deploy` da gerekir.

## Beklenen Davranis

- Router `hash` modunda calisir
- Pages altinda `/home`, `/shop`, `/forum`, `/market`, `/profile`, `/admin` ekranlari acilir
- Admin panel allowlist wallet ile görünür
- DUAN token bakiyesi Pages ortaminda dogru mint ile okunur
