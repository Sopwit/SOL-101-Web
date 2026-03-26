# Solana Kurulumu

Bu belge, DUAN web uygulamasinin Solana tarafini yerelde veya demo ortaminda dogru sekilde ayaga kaldirmak icin gereken ayarlari toplar.

## 1. Ag Secimi

Proje varsayilan olarak `devnet` ile calisacak sekilde tasarlanmistir.

Frontend tarafinda kullanilan degiskenler:

```bash
VITE_SOLANA_CLUSTER=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_SOLANA_TOKEN_MINT=<spl-token-mint-address>
```

Notlar:

- `VITE_SOLANA_RPC_URL` verilirse uygulama bu endpoint'i dogrudan kullanir.
- `VITE_SOLANA_RPC_URL` yoksa uygulama `VITE_SOLANA_CLUSTER` degerine gore baglanir.
- Demo gununde tekil public RPC yerine daha kararlı bir RPC saglayicisi kullanmak daha dogrudur.

## 2. Cuzdan

Gelistirme ve demo icin Phantom veya Solflare yeterlidir.

Beklenen davranis:

- Kullanici wallet baglar
- Frontend public key uzerinden Solana baglantisini kurar
- Yazma islerinde gerekli yerlerde mesaj imzasi alinir

## 3. DUAN Token Gosterimi

Uygulama ekonomik gostergelerde DUAN token degerini ortak sabitten okur:

- `shared/duanEconomy.ts`

Mevcut sistem sabiti:

- `1 DUAN = 0.00001 SOL`

Bu oran hem shop hem market arayuzunde ayni kaynaktan hesaplanir.

## 4. Shop ve On-chain Ayirimi

Shop ekrani iki farkli veri yolunu destekler:

1. Backend katalog:
   - `GET /shop/items`
   - Hizli acilis ve fallback davranisi icin kullanilir
2. On-chain shop:
   - `src/app/lib/onchain/duanShopClient.ts`
   - On-chain veri varsa backend katalogunun ustune yazabilir

Pratikte:

- Sayfa once backend veya cache ile acilir
- On-chain veri arkada denenir
- RPC gecikirse sayfa loading'de asili kalmaz

## 5. Token Mint Adresi

`VITE_SOLANA_TOKEN_MINT` tanimlanirsa frontend DUAN/SPL bakiyesini zincirden okuyabilir.

Tanimli degilse:

- UI yine acilir
- token bakiyesi gercek zincirden okunmaz
- uygulama fallback davranisla devam eder

## 6. Anchor / Program Katmani

Repoda on-chain program tarafina ait dosyalar da bulunur:

- `programs/duan_shop/`
- `Anchor.toml`
- `Cargo.toml`

Bu katman shop satin alma akisinin Solana tarafini temsil eder. Frontend tarafinda ilgili entegrasyon:

- `src/app/lib/onchain/duanShopClient.ts`

## 7. Yerel Dogrulama

Solana baglantisi olan temel senaryolar:

1. Wallet baglanabiliyor mu
2. Shop sayfasi aciliyor mu
3. Backend katalog geliyor mu
4. On-chain istek zaman asimina duserse fallback bozulmadan acik kaliyor mu
5. Profil ve market sayfalari wallet adresi ile veri cekebiliyor mu

## 8. Demo Onerisi

Demo gunu icin onerilen minimum ayar:

- Tek bir kararlı RPC URL kullanin
- Devnet wallet'ta yeterli SOL bulundurun
- Kullanilan token mint adresini ekip icinde sabitleyin
- Shop ve market akisini demo oncesi ayni environment ile en az bir kez bastan test edin
