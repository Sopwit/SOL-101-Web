# Supabase Kurulumu

Bu proje su an veri katmaninda `public.kv_store_5d6242bb` tablosunu kullanir. Frontend dogrudan tabloya yazmaz; tum yazma ve okuma isleri Supabase Edge Function uzerinden gider.

## Mimari Ozet

Temel akış su sekildedir:

1. Frontend `src/app/services/api.ts` uzerinden Edge Function cagirir
2. Edge Function `functions/server/index.tsx` icinde is mantigini calistirir
3. Kalici veri `kv_store_5d6242bb` tablosunda tutulur

Bu nedenle sadece frontend env tanimlamak yeterli degildir; Edge Function secrets ve migration da eksiksiz olmalidir.

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

CLI kullaniyorsaniz ornek akıs:

```bash
supabase secrets set SUPABASE_URL=https://<project-id>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
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

Not:

- `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` frontend `.env` dosyasi icin degildir.
- Bunlar Edge Function runtime secret olarak tanimlanmalidir.

## 4. Function Deploy

Bu repoda Supabase function giris noktasi:

- `functions/server/index.tsx`

Deploy mantigi:

- Supabase project baglantisi kurulur
- migration uygulanir
- secrets tanimlanir
- function deploy edilir

Ornek komutlar:

```bash
supabase link --project-ref <project-id>
supabase db push
supabase functions deploy make-server-5d6242bb --no-verify-jwt
```

Not:

- `Authorization: Bearer <anon-key>` kontrolu uygulama icinde oldugu icin deploy komutunuzda `--no-verify-jwt` kullanimi mevcut akışla uyumludur.
- Supabase tarafinda farkli bir güvenlik modeli kurulacaksa bu karar hem frontend hem backend dokumanlarina islenmelidir.

## 5. Dogrulama

Deploy sonrasi su endpoint'i cagir:

```text
GET /functions/v1/make-server-5d6242bb/health
```

Beklenen sonuc:

- `status: "ok"`
- `database.connected: true`
- `database.table: "kv_store_5d6242bb"`

Eger `database.connected: false` donerse sorun artik soyut bir 500 degil, dogrudan secret veya tablo kurulum sorunudur.

Ek kontrol listesi:

- `GET /token/info` calisiyor mu
- `GET /shop/items` veri donduruyor mu
- `GET /stats/platform` bos hata vermeden cevap veriyor mu
- Forum veya market yazma endpoint'leri imzali istek aldiginda 401 yerine beklenen cevabi donuyor mu
