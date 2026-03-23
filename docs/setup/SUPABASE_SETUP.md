# Supabase Kurulumu

Bu proje su an veri katmaninda `public.kv_store_5d6242bb` tablosunu kullanir. Frontend dogrudan tabloya yazmaz; tum yazma ve okuma isleri Supabase Edge Function uzerinden gider.

## 1. SQL migration

Supabase SQL Editor veya CLI ile su dosyayi calistir:

- [`supabase/migrations/20260323_init_duan_kv.sql`](../../supabase/migrations/20260323_init_duan_kv.sql)

Bu migration:

- `kv_store_5d6242bb` tablosunu olusturur
- Prefix sorgular icin index ekler
- `updated_at` trigger'ini kurar
- RLS'i aktif eder

Not:
- Bu tabloda client policy acmadik. Bu bilincli bir tercih. Anon key ile frontend tabloya dogrudan erisemez.
- Edge Function `service role key` ile calistigi icin RLS'i bypass eder.

## 2. Edge Function secrets

Function runtime icin su secret'lar tanimli olmali:

```bash
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## 3. Frontend env

Frontend `.env` icin gerekli alanlar:

```bash
VITE_SUPABASE_PROJECT_ID=<project-id>
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SOLANA_CLUSTER=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_TOKEN_MINT=<spl-token-mint-address>
```

## 4. Dogrulama

Deploy sonrasi su endpoint'i cagir:

```text
GET /functions/v1/make-server-5d6242bb/health
```

Beklenen sonuc:

- `status: "ok"`
- `database.connected: true`
- `database.table: "kv_store_5d6242bb"`

Eger `database.connected: false` donerse sorun artik soyut bir 500 degil, dogrudan secret veya tablo kurulum sorunudur.
