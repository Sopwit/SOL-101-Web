import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, ShoppingCart, Sparkles } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { GlassCard } from '../components/GlassCard';
import { RarityBadge } from '../components/RarityBadge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useLanguage } from '../contexts/LanguageContext';
import { createWalletAuth } from '../lib/walletAuth';
import { useStore } from '../store';
import { api } from '../services/api';
import type { Rarity, ShopItem } from '../types';

interface TokenInfo {
  symbol: string;
  name: string;
  price: number;
  totalSupply: number;
  circulatingSupply: number;
  lastUpdated: string;
}

export function ShopPage() {
  const { connected, publicKey, signMessage } = useWallet();
  const { t } = useLanguage();
  const { tokenBalance } = useStore();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadItems = async () => {
    setIsLoading(true);
    const [itemsResponse, tokenResponse] = await Promise.all([
      api.getShopItems({
        rarity: rarityFilter !== 'all' ? rarityFilter : undefined,
        search: searchQuery || undefined,
      }),
      api.getTokenInfo(),
    ]);

    setItems(itemsResponse.success && itemsResponse.data ? itemsResponse.data : []);
    setTokenInfo(tokenResponse.success && tokenResponse.data ? tokenResponse.data : null);
    setIsLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, [rarityFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadItems();
    setIsRefreshing(false);
  };

  const handlePurchase = (item: ShopItem) => {
    setSelectedItem(item);
    setPurchaseDialogOpen(true);
  };

  const confirmPurchase = async () => {
    if (!connected || !publicKey || !selectedItem) {
      toast.error(t('error.walletRequired'));
      return;
    }
    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'shop:purchase');
    if (!walletAuth) return;

    const response = await api.purchaseItem(publicKey.toBase58(), selectedItem.id, walletAuth);
    if (response.success) {
      toast.success(t('shop.purchaseSuccess'));
      setPurchaseDialogOpen(false);
      await loadItems();
    } else {
      toast.error(response.error || t('common.error'));
    }
  };

  const getRarityBorderClass = (rarity: Rarity) => ({
    common: 'border-gray-500/30',
    rare: 'border-blue-500/50',
    epic: 'border-purple-500/50',
    legendary: 'border-yellow-500/50 shadow-lg shadow-yellow-500/20',
  }[rarity]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">{t('shop.title')}</h1>
          <p className="text-muted-foreground">{t('shop.subtitle')}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              <span className="font-medium">{t('shop.tokenBalance')}</span>
            </div>
            <span className="text-2xl font-bold text-primary">{tokenBalance}</span>
          </div>
        </GlassCard>

        {tokenInfo && (
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{tokenInfo.name} ({tokenInfo.symbol})</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Supply: {tokenInfo.circulatingSupply.toLocaleString()} / {tokenInfo.totalSupply.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{tokenInfo.price} SOL</div>
                <div className="text-xs text-muted-foreground">{t('shop.price')}</div>
              </div>
            </div>
          </GlassCard>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <Input placeholder={t('shop.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1" />
        <Button variant="outline" onClick={loadItems}>{t('common.search')}</Button>
        <Select value={rarityFilter} onValueChange={setRarityFilter}>
          <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder={t('shop.rarity')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="common">{t('rarity.common')}</SelectItem>
            <SelectItem value="rare">{t('rarity.rare')}</SelectItem>
            <SelectItem value="epic">{t('rarity.epic')}</SelectItem>
            <SelectItem value="legendary">{t('rarity.legendary')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <GlassCard className="p-12 text-center">{t('common.loading')}</GlassCard>
      ) : items.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <ShoppingCart className="w-14 h-14 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2">Magazada henuz item yok</h3>
          <p className="text-muted-foreground">Mock kartlar kaldirildi. Liste sadece backend'deki gercek item'lar ile dolacak.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, index) => (
            <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
              <GlassCard hover className={`overflow-hidden h-full flex flex-col border-2 ${getRarityBorderClass(item.rarity)} cursor-pointer`} onClick={() => handlePurchase(item)}>
                <div className="aspect-square overflow-hidden relative group">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                  <div className="absolute top-2 right-2">
                    <RarityBadge rarity={item.rarity} />
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-lg mb-2">{item.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{item.description}</p>
                  <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('shop.price')}</span>
                      <span className="text-xl font-bold text-primary">{item.price}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('shop.stock')}</span>
                      <span className={item.stock < 10 ? 'text-destructive font-medium' : 'font-medium'}>{item.stock} {t('shop.stockUnit')}</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('shop.purchaseItem')}</DialogTitle>
            <DialogDescription>{t('shop.purchaseDesc')}</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="aspect-video overflow-hidden rounded-lg">
                <img src={selectedItem.imageUrl} alt={selectedItem.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-2">{selectedItem.name}</h3>
                <RarityBadge rarity={selectedItem.rarity} />
              </div>
              <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
              <Button className="w-full" onClick={() => void confirmPurchase()}>{t('shop.confirmPurchase')}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
