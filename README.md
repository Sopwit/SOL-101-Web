# SOL101 Platform 🚀

Solana Devnet üzerinde çalışan, öğrencilerin birbirleriyle etkileşime geçebildiği tam kapsamlı bir web platformu.

## 🎯 Özellikler

### 🗣️ Forum
- Başarılarınızı ve ilerlemelerinizi paylaşın
- Ekran görüntüsü yükleme desteği
- Beğeni ve yorum sistemi
- Etiket bazlı filtreleme (#item-showcase, #progress, #achievement, #tips, #trade-request)
- En yeni / En çok beğenilen sıralama

### 🛍️ Mağaza
- SOL101 token ile item satın alma
- Nadirlik seviyeleri: Common, Rare, Epic, Legendary
- Kategori ve fiyat filtreleme
- Gerçek zamanlı token bakiyesi takibi
- Legendary item'lar için özel shimmer efekti

### 🤝 Pazar
- Oyuncular arası P2P item takası
- Token, item veya her ikisi ile takas seçenekleri
- İlan süresi yönetimi (24/48/72 saat)
- Gerçek zamanlı countdown timer
- Takas teklifi gönderme sistemi

### 👤 Profil
- Kişisel profil sayfası
- Kullanıcı adı ve bio düzenleme
- SOL ve token bakiyesi görüntüleme
- Envanter yönetimi
- Forum postları ve pazar ilanları sekmesi

## 🎨 Tasarım

**"Cosmic Terminal"** teması ile:
- **Tipografi**: Syne (başlıklar) + JetBrains Mono (içerik)
- **Renkler**: Solana mor (#9945FF) ve yeşil (#14F195) aksan renkleri
- **Light/Dark tema** desteği
- Glassmorphism efekti kartlarda
- Smooth animasyonlar ve geçişler
- Mobile-first responsive tasarım

## 🔧 Teknolojiler

- **React** + **TypeScript**
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **Solana Web3.js** - Blockchain entegrasyonu
- **@solana/wallet-adapter** - Phantom wallet desteği
- **Zustand** - State management
- **Motion** - Animasyonlar
- **Lucide React** - İkonlar

## 🚀 Başlangıç

### Wallet Bağlantısı

1. **Phantom Wallet** yükleyin: [phantom.app](https://phantom.app)
2. Platformda "Connect Wallet" butonuna tıklayın
3. Phantom'da Devnet'e geçin (Settings > Developer Settings > Testnet Mode)
4. Test SOL alın: [faucet.solana.com](https://faucet.solana.com)

### Platform Kullanımı

**Mağaza:**
- Token bakiyeniz başlangıçta 1000 olarak ayarlanmıştır (mock)
- Item satın almak için wallet bağlantısı gereklidir
- Her item'ın nadirlik seviyesi kartın border rengi ile gösterilir

**Forum:**
- Post oluşturmak için wallet gereklidir
- Maksimum 5 post/saat limiti vardır
- Beğeni yapmak için wallet gereklidir

**Pazar:**
- İlan oluşturmak için envanterinizde item olmalıdır
- Takas teklifleri diğer kullanıcılara bildirim olarak gider
- İlanlar belirtilen süre sonunda otomatik expire olur

**Profil:**
- Kullanıcı adı maksimum 20 karakter
- Bio maksimum 150 karakter
- Envanterinizdeki tüm item'lar görüntülenir

## ⚠️ Önemli Notlar

- Bu platform **Solana Devnet** üzerinde çalışır
- Gerçek SOL kullanılmaz - sadece test amaçlıdır
- Tüm işlemler frontend'de mock data ile simüle edilir
- Backend entegrasyonu için Supabase gereklidir (şu an sadece frontend)

## 🎮 Kısayollar

- `/` - Ana sayfa
- `/forum` - Forum
- `/shop` - Mağaza
- `/market` - Pazar
- `/profile` - Profil

## 🌙 Tema

Sağ üstteki ay/güneş ikonuna tıklayarak light/dark tema arasında geçiş yapabilirsiniz.

---

**SOL101 Platform** - Solana ekosisteminde öğren, topla, takas yap! 💜
