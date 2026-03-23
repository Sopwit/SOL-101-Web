import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'tr' | 'en';

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
  
  // Navigation
  'nav.home': { tr: 'Ana Sayfa', en: 'Home' },
  'nav.forum': { tr: 'Forum', en: 'Forum' },
  'nav.shop': { tr: 'Mağaza', en: 'Shop' },
  'nav.market': { tr: 'Pazar', en: 'Market' },
  'nav.profile': { tr: 'Profil', en: 'Profile' },
  
  // Home Page
  'home.title': { tr: 'DUAN-GAME', en: 'DUAN-GAME' },
  'home.subtitle': { tr: 'DUAN oyunu için Solana tabanlı eğitim ve ticaret platformu', en: 'Solana-based learning and trading platform for DUAN game' },
  'home.exploreShop': { tr: 'Magazayi Kesfet', en: 'Explore Shop' },
  'home.joinForum': { tr: 'Foruma Git', en: 'Go to Forum' },
  'home.features': { tr: 'Platform Özellikleri', en: 'Platform Features' },
  'home.activeUsers': { tr: 'Aktif Kullanıcılar', en: 'Active Users' },
  'home.totalItems': { tr: 'Toplam Item', en: 'Total Items' },
  'home.completedTrades': { tr: 'Tamamlanan Takas', en: 'Completed Trades' },
  
  // Features
  'feature.forum.title': { tr: 'Forum', en: 'Forum' },
  'feature.forum.desc': { tr: 'Başarılarını paylaş, topluluğa katıl', en: 'Share achievements, join the community' },
  'feature.shop.title': { tr: 'Mağaza', en: 'Shop' },
  'feature.shop.desc': { tr: 'DUAN token ile item satın al', en: 'Purchase items with DUAN tokens' },
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
  
  // Shop
  'shop.title': { tr: 'Mağaza', en: 'Shop' },
  'shop.subtitle': { tr: 'DUAN token ile item satın al', en: 'Purchase items with DUAN tokens' },
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
  'market.wantedItemName': { tr: 'İstenen Item Adı (opsiyonel)', en: 'Wanted Item Name (optional)' },
  'market.duration': { tr: 'İlan Süresi', en: 'Listing Duration' },
  'market.note': { tr: 'Not (opsiyonel)', en: 'Note (optional)' },
  'market.notePlaceholder': { tr: 'İlanınız hakkında not...', en: 'Note about your listing...' },
  
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
  
  // Footer
  'footer.platform': { tr: 'DUAN-GAME - DUAN Oyun Entegrasyonu', en: 'DUAN-GAME - DUAN Game Integration' },
  'footer.network': { tr: 'Solana Devnet', en: 'Solana Devnet' },
  'footer.madeWith': { tr: 'Solana topluluğu için ❤️ ile yapıldı', en: 'Made with ❤️ for Solana community' },
  
  // Wallet
  'wallet.connect': { tr: 'Wallet Bağla', en: 'Connect Wallet' },
  'wallet.disconnect': { tr: 'Bağlantıyı Kes', en: 'Disconnect' },
  'wallet.balance': { tr: 'Bakiye', en: 'Balance' },
  
  // Rarity
  'rarity.common': { tr: 'Yaygın', en: 'Common' },
  'rarity.rare': { tr: 'Nadir', en: 'Rare' },
  'rarity.epic': { tr: 'Epik', en: 'Epic' },
  'rarity.legendary': { tr: 'Efsanevi', en: 'Legendary' },
  
  // Errors
  'error.walletRequired': { tr: 'Bu işlem için wallet bağlantısı gerekli', en: 'Wallet connection required for this action' },
  'error.networkError': { tr: 'Bağlantı hatası', en: 'Network error' },
  'error.unknown': { tr: 'Bir hata oluştu', en: 'An error occurred' },
  
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
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('tr');

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
