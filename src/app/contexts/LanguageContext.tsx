import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Language = 'tr' | 'en';
const LANGUAGE_STORAGE_KEY = 'duan-language';

interface Translations {
  [key: string]: {
    tr: string;
    en: string;
  };
}

const translations: Translations = {
  // Common
  'common.loading': { tr: 'Yükleniyor...', en: 'Loading...' },
  'common.error': { tr: 'Hata', en: 'Error' },
  'common.success': { tr: 'Başarılı', en: 'Success' },
  'common.cancel': { tr: 'İptal', en: 'Cancel' },
  'common.save': { tr: 'Kaydet', en: 'Save' },
  'common.edit': { tr: 'Düzenle', en: 'Edit' },
  'common.delete': { tr: 'Sil', en: 'Delete' },
  'common.search': { tr: 'Ara', en: 'Search' },
  'common.filter': { tr: 'Filtrele', en: 'Filter' },
  'common.all': { tr: 'Tümü', en: 'All' },
  'common.refresh': { tr: 'Güncelle', en: 'Refresh' },
  'common.confirm': { tr: 'Onayla', en: 'Confirm' },
  'common.close': { tr: 'Kapat', en: 'Close' },
  'common.export': { tr: 'Dışa Aktar', en: 'Export' },
  
  // Navigation
  'nav.home': { tr: 'Ana Sayfa', en: 'Home' },
  'nav.forum': { tr: 'Forum', en: 'Forum' },
  'nav.shop': { tr: 'Mağaza', en: 'Shop' },
  'nav.market': { tr: 'Pazar', en: 'Market' },
  'nav.profile': { tr: 'Profil', en: 'Profile' },
  'nav.admin': { tr: 'Admin', en: 'Admin' },
  
  // Home Page
  'home.title': { tr: 'DUAN', en: 'DUAN' },
  'home.subtitle': { tr: 'Solana destekli oyuncu profili, global forum, dinamik mağaza ve canlı pazar akışını tek platformda birleştirir.', en: 'Brings Solana-backed player identity, global forum, dynamic shop, and live market flow into one platform.' },
  'home.kicker': { tr: 'OYUN EKOSISTEMI MERKEZI', en: 'GAME ECOSYSTEM HUB' },
  'home.exploreShop': { tr: 'Magazayi Kesfet', en: 'Explore Shop' },
  'home.joinForum': { tr: 'Foruma Git', en: 'Go to Forum' },
  'home.openMarket': { tr: 'Pazari Incele', en: 'Browse Market' },
  'home.features': { tr: 'Platform Modulleri', en: 'Platform Modules' },
  'home.totalProfiles': { tr: 'Toplam Oyuncu Profili', en: 'Total Player Profiles' },
  'home.onlineUsers': { tr: 'Cevrimici Oyuncular', en: 'Online Players' },
  'home.totalItems': { tr: 'Toplam Item', en: 'Total Items' },
  'home.completedTrades': { tr: 'Tamamlanan Takas', en: 'Completed Trades' },
  'home.liveLayer': { tr: 'Canli operasyon katmani', en: 'Live operations layer' },
  'home.liveLayerDesc': { tr: 'Forum, magazadaki stok dengesi, profil ilerlemesi ve pazar hareketleri backend ile canli olarak guncellenir.', en: 'Forum, shop stock balance, profile progression, and market activity refresh live through the backend.' },
  'home.economyTitle': { tr: 'DUAN ekonomisi tek ekranda', en: 'DUAN economy in one view' },
  'home.economyDesc': { tr: 'Magaza fiyatlari, DUAN/SOL karsiligi ve oyuncu odul akislari ortak ekonomi katmanindan beslenir.', en: 'Shop prices, DUAN/SOL conversions, and player reward flows are driven from a shared economy layer.' },
  'home.identityTitle': { tr: 'Oyuncu kimligi ve ilerleme', en: 'Player identity and progression' },
  'home.identityDesc': { tr: 'Profil, seviye, kozmetik ve basarilar tek oyuncu kimligi etrafinda toplanir; web ve oyun akislarini ayni cizgide tutar.', en: 'Profile, level, cosmetics, and achievements stay anchored to one player identity across web and gameplay flows.' },
  'home.sectionsTitle': { tr: 'Her sekme artik ayni sisteme bagli', en: 'Every section now runs on the same system' },
  'home.sectionsDesc': { tr: 'Forum sosyal akis icin, magaza ekonomik denge icin, pazar oyuncular arasi takas icin, profil ise butun ilerlemenin merkezi olarak calisir.', en: 'Forum handles social flow, shop handles economic balance, market handles player trading, and profile acts as the center of progression.' },
  'home.ctaTitle': { tr: 'Demo veya canli kullanim icin hazir', en: 'Ready for demo or live usage' },
  'home.ctaDesc': { tr: 'Wallet bagla, forumda akisi baslat, magazadan ekipman al ve pazarda kendi ilanini ac.', en: 'Connect your wallet, start the forum flow, buy gear from the shop, and open your own market listing.' },
  'home.serviceLimitedTitle': { tr: 'Ana ekran servis durumu kisitli', en: 'Homepage service status is limited' },
  'home.networkRuntime': { tr: 'Ag ve Runtime', en: 'Network and Runtime' },
  'home.runtimeHealthy': { tr: 'Devnet ve backend sinyalleri saglikli gorunuyor.', en: 'Devnet and backend signals look healthy.' },
  'home.runtimeLimited': { tr: 'Devnet veya backend tarafinda gecici kisit algilandi.', en: 'A temporary limitation was detected in devnet or backend services.' },
  'home.tokenPrice': { tr: 'Token Fiyati', en: 'Token Price' },
  'home.tokenPriceUsd': { tr: 'Tahmini USD Degeri', en: 'Estimated USD Value' },
  'home.marketReferenceLive': { tr: 'Canli piyasa referansi aktif.', en: 'Live market reference is active.' },
  'home.marketReferenceFallback': { tr: 'Canli fiyat kaynagi su an erisilemiyor; sabit ekonomi verisi kullaniliyor.', en: 'Live price source is currently unavailable; using static economy data.' },
  'home.solReference': { tr: 'SOL referansi', en: 'SOL reference' },
  'home.circulatingSupply': { tr: 'Dolasimdaki Arz', en: 'Circulating Supply' },
  'home.catalogStatus': { tr: 'Katalog Durumu', en: 'Catalog Status' },
  'home.catalogItems': { tr: 'Katalog Itemleri', en: 'Catalog Items' },
  'home.updatedSummary': { tr: 'Ana ekran artik platform istatistikleri, token verisi, devnet runtime ve on-chain katalog durumu ile guncel sistem fotografini verir.', en: 'The homepage now presents an up-to-date system snapshot with platform stats, token data, devnet runtime, and on-chain catalog state.' },
  'home.lastUpdated': { tr: 'Son guncelleme', en: 'Last updated' },
  
  // Features
  'feature.forum.title': { tr: 'Forum', en: 'Forum' },
  'feature.forum.desc': { tr: 'Başarılarını paylaş, topluluğa katıl', en: 'Share achievements, join the community' },
  'feature.shop.title': { tr: 'Mağaza', en: 'Shop' },
  'feature.shop.desc': { tr: 'DUAN oyun para birimi ile item satın al', en: 'Purchase items with DUAN game currency' },
  'feature.market.title': { tr: 'Pazar', en: 'Market' },
  'feature.market.desc': { tr: 'Diğer oyuncularla takas yap', en: 'Trade with other players' },
  'feature.profile.title': { tr: 'Profil', en: 'Profile' },
  'feature.profile.desc': { tr: 'Oyuncu hesabini ve envanterini yonet', en: 'Manage your player account and inventory' },
  
  // Forum
  'forum.title': { tr: 'Forum', en: 'Forum' },
  'forum.subtitle': { tr: 'Başarılarını paylaş, topluluğa katıl', en: 'Share achievements, join the community' },
  'forum.newPost': { tr: 'Yeni Post', en: 'New Post' },
  'forum.createPost': { tr: 'Post Oluştur', en: 'Create Post' },
  'forum.createPostDesc': { tr: 'Topluluğunuza katkıda bulunmak için yeni bir post oluşturun.', en: 'Create a new post to contribute to your community.' },
  'forum.title.label': { tr: 'Başlık', en: 'Title' },
  'forum.description.label': { tr: 'Açıklama', en: 'Description' },
  'forum.image.label': { tr: 'Görsel', en: 'Image' },
  'forum.tags.label': { tr: 'Etiketler', en: 'Tags' },
  'forum.sort.newest': { tr: 'En Yeni', en: 'Newest' },
  'forum.sort.popular': { tr: 'En Çok Beğenilen', en: 'Most Liked' },
  'forum.sort.trending': { tr: 'Trend Olanlar', en: 'Trending' },
  'forum.filter.timeframe': { tr: 'Zaman Aralığı', en: 'Time Frame' },
  'forum.filter.today': { tr: 'Bugün', en: 'Today' },
  'forum.filter.week': { tr: 'Bu Hafta', en: 'This Week' },
  'forum.filter.month': { tr: 'Bu Ay', en: 'This Month' },
  'forum.filter.allTime': { tr: 'Tüm Zamanlar', en: 'All Time' },
  'forum.imageHint': { tr: 'Görsel yükleme sonraki aşamada medya servisine bağlanacak. Şimdilik metin ve etiket odaklı ilerliyoruz.', en: 'Image upload will be connected to the media service in the next phase. For now, posts focus on text and tags.' },
  'forum.emptyTitle': { tr: 'Forum akışı henüz boş', en: 'Forum feed is still empty' },
  'forum.emptyDesc': { tr: 'Topluluk gönderileri doğrudan backend üzerinden yayınlanır. İlk paylaşımı oluşturarak akışı başlatabilirsin.', en: 'Community posts are published directly from the backend. Create the first post to start the feed.' },
  'forum.deletePost': { tr: 'Gönderiyi Sil', en: 'Delete Post' },
  'forum.deleteSuccess': { tr: 'Gönderi kaldırıldı', en: 'Post removed' },
  'forum.deleteOwnOnly': { tr: 'Yalnızca kendi gönderini silebilirsin', en: 'You can only delete your own post' },
  'forum.comments': { tr: 'Yorumlar', en: 'Comments' },
  'forum.commentPlaceholder': { tr: 'Yorumunu yaz...', en: 'Write your comment...' },
  'forum.sendComment': { tr: 'Yorum Gönder', en: 'Send Comment' },
  'forum.commentSuccess': { tr: 'Yorum eklendi', en: 'Comment added' },
  'forum.noComments': { tr: 'Henüz yorum yok. İlk yorumu sen yaz.', en: 'No comments yet. Be the first to comment.' },
  'forum.translated': { tr: 'Ceviri gorunumu', en: 'Translated view' },
  
  // Shop
  'shop.title': { tr: 'Mağaza', en: 'Shop' },
  'shop.subtitle': { tr: 'DUAN oyun para birimi ile item satın al', en: 'Purchase items with DUAN game currency' },
  'shop.tokenBalance': { tr: 'Token Bakiyesi:', en: 'Token Balance:' },
  'shop.price': { tr: 'Fiyat:', en: 'Price:' },
  'shop.stock': { tr: 'Stok:', en: 'Stock:' },
  'shop.stockUnit': { tr: 'adet', en: 'units' },
  'shop.purchase': { tr: 'Satın Al', en: 'Purchase' },
  'shop.purchaseItem': { tr: 'Item Satın Al', en: 'Purchase Item' },
  'shop.purchaseDesc': { tr: 'Seçtiğiniz itemi satın almak için aşağıdaki detayları inceleyin.', en: 'Review the details below to purchase the selected item.' },
  'shop.confirmPurchase': { tr: 'Satın Almayı Onayla', en: 'Confirm Purchase' },
  'shop.currentBalance': { tr: 'Mevcut Bakiye:', en: 'Current Balance:' },
  'shop.remainingBalance': { tr: 'Kalan Bakiye:', en: 'Remaining Balance:' },
  'shop.searchPlaceholder': { tr: 'Item ara...', en: 'Search items...' },
  'shop.rarity': { tr: 'Nadirlik', en: 'Rarity' },
  'shop.insufficientBalance': { tr: 'Yetersiz token bakiyesi', en: 'Insufficient token balance' },
  'shop.purchaseSuccess': { tr: 'Item başarıyla satın alındı!', en: 'Item purchased successfully!' },
  'shop.addedToInventory': { tr: 'envanterinize eklendi', en: 'added to your inventory' },
  'shop.refreshSuccess': { tr: 'Mağaza güncellendi!', en: 'Shop updated!' },
  'shop.emptyTitle': { tr: 'Mağazada henüz item yok', en: 'No items in the shop yet' },
  'shop.emptyDesc': { tr: "Liste yalnızca backend'deki gerçek item'lar ile doldurulur.", en: 'The list is populated only with real items from the backend.' },
  'shop.supply': { tr: 'Arz', en: 'Supply' },
  'shop.restocking': { tr: 'Malzeme tedarik ediliyor', en: 'Restocking supplies' },
  'shop.restockIn': { tr: 'Yenileme süresi', en: 'Restock in' },
  'shop.outOfStock': { tr: 'Tükendi', en: 'Out of stock' },
  'shop.dynamicPrice': { tr: 'Talep fiyatı yükseltti', en: 'Demand increased the price' },
  'shop.unavailablePurchase': { tr: 'Bu ürün şu anda satın alınamıyor', en: 'This item is currently unavailable for purchase' },
  
  // Market
  'market.title': { tr: 'Pazar', en: 'Market' },
  'market.subtitle': { tr: 'Diğer oyuncularla item takas et', en: 'Trade items with other players' },
  'market.createListing': { tr: 'İlan Oluştur', en: 'Create Listing' },
  'market.createListingDesc': { tr: 'Diğer oyuncularla takas yapmak için yeni bir ilan oluşturun.', en: 'Create a new listing to trade with other players.' },
  'market.offered': { tr: 'Teklif Edilen', en: 'Offered' },
  'market.wanted': { tr: 'İstenen', en: 'Wanted' },
  'market.sendOffer': { tr: 'Takas Teklifi Gönder', en: 'Send Trade Offer' },
  'market.offeredItem': { tr: 'Teklif Edilen Item', en: 'Offered Item' },
  'market.wantedItem': { tr: 'İstenen Şey', en: 'Wanted' },
  'market.tokenAmount': { tr: 'Token Miktarı (opsiyonel)', en: 'Token Amount (optional)' },
  'market.tokenAmountHint': { tr: 'Silah, zırh ve özel ekipmanlar için yüksek değerli teklifler açın. Pazar gerçek envanter itemleriyle çalışır.', en: 'Use higher-value offers for weapons, armor, and special gear. The market works with real inventory items.' },
  'market.wantedItemName': { tr: 'İstenen Item Adı (opsiyonel)', en: 'Wanted Item Name (optional)' },
  'market.duration': { tr: 'İlan Süresi', en: 'Listing Duration' },
  'market.note': { tr: 'Not (opsiyonel)', en: 'Note (optional)' },
  'market.notePlaceholder': { tr: 'İlanınız hakkında not...', en: 'Note about your listing...' },
  'market.emptyTitle': { tr: 'Aktif pazar ilanı yok', en: 'No active market listings' },
  'market.emptyDesc': { tr: 'Pazar akışı canlı backend ilanları ile dolar. Envanterindeki bir item için ilk ilanı sen açabilirsin.', en: 'The market feed is populated by live backend listings. You can open the first listing for an item in your inventory.' },
  'market.tradeBackendHint': { tr: 'Teklif onayı backend üzerinden kaydedilir ve takas istatistiklerine işlenir.', en: 'Trade confirmation is stored through the backend and counted in trade stats.' },
  'market.inventoryRequired': { tr: 'İlan açmak için envanterinden bir item seçmelisin.', en: 'Select an item from your inventory to create a listing.' },
  'market.noInventoryItems': { tr: 'İlan açılabilir item bulunamadı. Önce mağazadan veya oyundan item edin.', en: 'No inventory items are available for listing yet. Get an item from the shop or the game first.' },
  'market.feed': { tr: 'Global Akış', en: 'Global Feed' },
  'market.myListings': { tr: 'İlanlarım', en: 'My Listings' },
  'market.cancelListing': { tr: 'İlanı Kapat', en: 'Close Listing' },
  'market.cancelSuccess': { tr: 'İlan kapatıldı', en: 'Listing closed' },
  'market.selfOfferBlocked': { tr: 'Kendi ilanına teklif gönderemezsin.', en: 'You cannot send an offer to your own listing.' },
  'market.translated': { tr: 'Ceviri gorunumu', en: 'Translated view' },
  'market.listingClosed': { tr: 'Bu ilan artık aktif değil.', en: 'This listing is no longer active.' },
  'market.noAdditionalNote': { tr: 'Ek not bulunmuyor.', en: 'No additional note.' },
  
  // Profile
  'profile.title': { tr: 'Profil', en: 'Profile' },
  'profile.walletRequired': { tr: 'Wallet Bağlantısı Gerekli', en: 'Wallet Connection Required' },
  'profile.walletRequiredDesc': { tr: 'Profilinizi görüntülemek için wallet bağlantısı yapmanız gerekiyor.', en: 'You need to connect your wallet to view your profile.' },
  'profile.connectWallet': { tr: 'Wallet Bağla', en: 'Connect Wallet' },
  'profile.username': { tr: 'Kullanıcı Adı', en: 'Username' },
  'profile.bio': { tr: 'Bio', en: 'Bio' },
  'profile.experience': { tr: 'Deneyim', en: 'Experience' },
  'profile.level': { tr: 'Seviye', en: 'Level' },
  'profile.items': { tr: 'Item', en: 'Items' },
  'profile.trades': { tr: 'Takas', en: 'Trades' },
  'profile.achievements': { tr: 'Başarı', en: 'Achievements' },
  'profile.inventory': { tr: 'Envanter', en: 'Inventory' },
  'profile.posts': { tr: 'Postlar', en: 'Posts' },
  'profile.listings': { tr: 'İlanlar', en: 'Listings' },
  'profile.noAchievements': { tr: 'Henüz Başarı Yok', en: 'No Achievements Yet' },
  'profile.noAchievementsDesc': { tr: 'DUAN oyununda ilerleyerek ve platform aktivitelerine katılarak başarılar kazanın!', en: 'Earn achievements by progressing in DUAN game and participating in platform activities!' },
  'profile.unlocked': { tr: 'Kazanıldı:', en: 'Unlocked:' },
  'profile.rewardVault': { tr: 'Ödül Kasası', en: 'Reward Vault' },
  'profile.rewardDuan': { tr: 'DUAN ödülü', en: 'DUAN reward' },
  'profile.rewardSol': { tr: 'SOL ödülü', en: 'SOL reward' },
  'profile.rewardTotal': { tr: 'Toplam kazanılan', en: 'Total earned' },
  'profile.rewardSpendable': { tr: 'Harcanabilir bakiye', en: 'Spendable balance' },
  'profile.cosmetics': { tr: 'Profil Kozmetikleri', en: 'Profile Cosmetics' },
  'profile.avatarTheme': { tr: 'Profil Simgesi', en: 'Profile Icon' },
  'profile.backgroundTheme': { tr: 'Arka Plan', en: 'Background' },
  'profile.apply': { tr: 'Uygula', en: 'Apply' },
  'profile.selected': { tr: 'Seçili', en: 'Selected' },
  'profile.unlockWithDuan': { tr: 'DUAN ile aç', en: 'Unlock with DUAN' },
  'profile.unlockWithSol': { tr: 'SOL ile aç', en: 'Unlock with SOL' },
  'profile.progressRule': { tr: 'Her 120 XP yeni bir seviye kazandırır. Post, alışveriş, takas ve profil özelleştirmesi XP üretir.', en: 'Every 120 XP grants a new level. Posts, purchases, trades, and profile customization generate XP.' },
  'profile.integratedStats': { tr: 'Web aktiviteleri backend istatistiklerine, oyun içi sahiplik ise on-chain sayımlara işlenir.', en: 'Web activity feeds backend stats, while in-game ownership is reflected by on-chain counts.' },
  'profile.noInventory': { tr: 'Envanterde henüz on-chain veya platform üzerinden kazanılmış item bulunmuyor.', en: 'No items earned from on-chain or platform activity are in the inventory yet.' },
  
  // Footer
  'footer.platform': { tr: 'DUAN-GAME - DUAN Oyun Entegrasyonu', en: 'DUAN-GAME - DUAN Game Integration' },
  'footer.network': { tr: 'Solana Devnet', en: 'Solana Devnet' },
  'footer.madeWith': { tr: 'Solana topluluğu için ❤️ ile yapıldı', en: 'Made with ❤️ for Solana community' },
  'footer.faucet': { tr: 'Faucet', en: 'Faucet' },
  
  // Wallet
  'wallet.connect': { tr: 'Wallet Bağla', en: 'Connect Wallet' },
  'wallet.disconnect': { tr: 'Bağlantıyı Kes', en: 'Disconnect' },
  'wallet.balance': { tr: 'Bakiye', en: 'Balance' },
  'walletBridge.title': { tr: 'DUAN Wallet Bridge', en: 'DUAN Wallet Bridge' },
  'walletBridge.badge': { tr: 'Unity Bridge', en: 'Unity Bridge' },
  'walletBridge.subtitle': { tr: 'Unity ile Solana wallet arasinda kontrollu bir baglanti kuruluyor. Islem tamamlaninca uygulamaya geri donus otomatik yapilir.', en: 'A controlled connection is established between Unity and the Solana wallet. Once the flow is complete, the app redirects back automatically.' },
  'walletBridge.waiting': { tr: 'Wallet baglantisi bekleniyor...', en: 'Waiting for wallet connection...' },
  'walletBridge.invalidCallback': { tr: 'Gecersiz veya izin verilmeyen callback adresi.', en: 'Invalid or disallowed callback address.' },
  'walletBridge.missingCallback': { tr: 'Callback adresi eksik.', en: 'Callback address is missing.' },
  'walletBridge.callbackNotAllowed': { tr: 'Callback adresi izin verilen prefix listesinde degil.', en: 'Callback address is not in the allowed prefix list.' },
  'walletBridge.connectedReturning': { tr: 'Wallet baglandi, Unity uygulamasina donuluyor...', en: 'Wallet connected, returning to the Unity app...' },
  'walletBridge.requestingSignature': { tr: 'Imza isteniyor...', en: 'Requesting signature...' },
  'walletBridge.signatureReturning': { tr: 'Imza alindi, Unity uygulamasina donuluyor...', en: 'Signature received, returning to the Unity app...' },
  'walletBridge.signatureFailed': { tr: 'Imza alinamadi.', en: 'Signature could not be obtained.' },
  'walletBridge.signatureProcessFailed': { tr: 'Imza islemi basarisiz oldu.', en: 'The signature flow failed.' },
  'walletBridge.action': { tr: 'Islem', en: 'Action' },
  'walletBridge.status': { tr: 'Durum', en: 'Status' },
  'walletBridge.wallet': { tr: 'Wallet', en: 'Wallet' },
  'walletBridge.connectWallet': { tr: 'Wallet bagla', en: 'Connect wallet' },
  'walletBridge.signMessage': { tr: 'Mesaj imzala', en: 'Sign message' },
  'walletBridge.waitingConnection': { tr: 'Baglanti bekleniyor', en: 'Waiting for connection' },
  'walletBridge.allowedPrefixes': { tr: 'Izin verilen callback prefixleri', en: 'Allowed callback prefixes' },
  'walletBridge.signUnsupported': { tr: 'Bagli wallet mesaj imzalamayi desteklemiyor.', en: 'The connected wallet does not support message signing.' },
  'walletBridge.returnUnity': { tr: "Unity'ye Don", en: 'Return to Unity' },
  
  // Rarity
  'rarity.common': { tr: 'Yaygın', en: 'Common' },
  'rarity.rare': { tr: 'Nadir', en: 'Rare' },
  'rarity.epic': { tr: 'Epik', en: 'Epic' },
  'rarity.legendary': { tr: 'Efsanevi', en: 'Legendary' },
  
  // Errors
  'error.walletRequired': { tr: 'Bu işlem için wallet bağlantısı gerekli', en: 'Wallet connection required for this action' },
  'error.networkError': { tr: 'Bağlantı hatası', en: 'Network error' },
  'error.unknown': { tr: 'Bir hata oluştu', en: 'An error occurred' },
  'error.pageTitle': { tr: 'Sayfa şu anda yüklenemiyor', en: 'This page cannot be loaded right now' },
  'error.pageDesc': { tr: 'İstenen ekranda beklenmeyen bir hata oluştu. Geri dönüp tekrar deneyebilir veya ana sayfaya geçebilirsin.', en: 'An unexpected issue occurred on this screen. You can go back and try again or return to the homepage.' },
  'error.serviceTitle': { tr: 'Servise şu anda erişilemiyor', en: 'The service is currently unavailable' },
  'error.serviceDesc': { tr: 'Veri servisi, cüzdan bağlantısı veya ağ isteği şu anda yanıt vermiyor olabilir. Lütfen birkaç saniye sonra tekrar dene.', en: 'The data service, wallet connection, or network request may not be responding right now. Please try again in a few seconds.' },
  'error.retry': { tr: 'Tekrar Dene', en: 'Try Again' },
  
  // Time
  'time.now': { tr: 'şimdi', en: 'now' },
  'time.minutesAgo': { tr: 'dakika önce', en: 'minutes ago' },
  'time.hoursAgo': { tr: 'saat önce', en: 'hours ago' },
  'time.daysAgo': { tr: 'gün önce', en: 'days ago' },
  
  // 404 Page
  'notFound.title': { tr: 'Sayfa Bulunamadı', en: 'Page Not Found' },
  'notFound.description': { tr: 'Aradığınız sayfa mevcut değil veya taşınmış olabilir.', en: 'The page you are looking for does not exist or may have been moved.' },
  'notFound.goHome': { tr: 'Ana Sayfaya Dön', en: 'Go to Homepage' },
  'notFound.goBack': { tr: 'Geri Dön', en: 'Go Back' },
  'language.change': { tr: 'Dil Degistir', en: 'Change Language' },
  'language.tr': { tr: 'Turkce', en: 'Turkish' },
  'language.en': { tr: 'Ingilizce', en: 'English' },
  'admin.loading': { tr: 'Admin paneli yukleniyor...', en: 'Loading admin panel...' },
  'admin.heroTitle': { tr: 'Kontrol ve Operasyon Merkezi', en: 'Control and Operations Center' },
  'admin.heroDesc': { tr: 'Devnet runtime, backend sagligi, on-chain katalog ve moderasyon akislarini admin panelinde yonet.', en: 'Manage devnet runtime, backend health, on-chain catalog, and moderation flows from the admin panel.' },
  'admin.heroBody': { tr: 'Admin paneli otomatik yenilenir, odak geri geldiginde sinyalleri tekrar toplar ve teknik uyarilari son kullanici arayuzunden ayirir.', en: 'The admin panel refreshes automatically, refetches signals on focus, and keeps technical warnings away from the end-user UI.' },
  'admin.searchTitle': { tr: 'Kullanici, post ve listing icinde hizli filtre', en: 'Quick filter across users, posts, and listings' },
  'admin.searchPlaceholder': { tr: 'Wallet, username, post basligi veya item adi ara', en: 'Search wallet, username, post title, or item name' },
  'admin.tabs.overview': { tr: 'Genel', en: 'Overview' },
  'admin.tabs.system': { tr: 'Sistem', en: 'System' },
  'admin.tabs.economy': { tr: 'Ekonomi', en: 'Economy' },
  'admin.tabs.users': { tr: 'Kullanicilar', en: 'Users' },
  'admin.tabs.moderation': { tr: 'Moderasyon', en: 'Moderation' },
  'admin.confirmTitle': { tr: 'Admin Islemi Onayi', en: 'Admin Action Confirmation' },
  'admin.confirmDesc': { tr: 'Bu admin aksiyonunu uygulamak istedigine emin misin?', en: 'Are you sure you want to apply this admin action?' },
  'admin.auditLog': { tr: 'Audit Log', en: 'Audit Log' },
  'admin.auditHistory': { tr: 'Admin aksiyon gecmisi', en: 'Admin action history' },
  'admin.tradeFilterTitle': { tr: 'Duruma gore filtrele', en: 'Filter by status' },
  'admin.userDetail': { tr: 'Kullanici Detayi', en: 'User Detail' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') {
      return 'tr';
    }

    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'tr' || stored === 'en' ? stored : 'tr';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
