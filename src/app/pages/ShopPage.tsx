import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, ShoppingCart, Sparkles } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { enUS, tr as trLocale } from 'date-fns/locale';
import { GlassCard } from '../components/GlassCard';
import { RarityBadge } from '../components/RarityBadge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchOnchainShopItems, purchaseOnchainShopItem } from '../lib/onchain/duanShopClient';
import { pageDataCache } from '../lib/pageDataCache';
import { createWalletAuth } from '../lib/walletAuth';
import { localizeShopItem, normalizeShopSearch } from '../lib/shopItemLocalization';
import { resolveAssetUrl } from '../lib/assetUrls';
import { useStore } from '../store';
import { api } from '../services/api';
import type { Rarity, ShopItem } from '../types';
import { duanToSol, formatDuanAmount, formatSolAmount } from '../../../shared/duanEconomy';

interface TokenInfo {
  symbol: string;
  name: string;
  price: number;
  lastUpdated: string;
}

export function ShopPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { connected, publicKey } = wallet;
  const { language, t } = useLanguage();
  const { tokenBalance } = useStore();
  const [items, setItems] = useState<ShopItem[]>(() => pageDataCache.shop.items);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(() => pageDataCache.shop.tokenInfo);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(() => pageDataCache.shop.items.length === 0);
  const [now, setNow] = useState(Date.now());
  const [usingFallbackCatalog, setUsingFallbackCatalog] = useState(() => pageDataCache.shop.usingFallbackCatalog);
  const loadRequestIdRef = useRef(0);

  const loadItems = async (options?: { silent?: boolean }) => {
    const requestId = ++loadRequestIdRef.current;
    const silent = options?.silent ?? false;
    if (!silent && pageDataCache.shop.items.length === 0) {
      setIsLoading(true);
    }

    try {
      const [tokenResponse, fallbackResponse] = await Promise.all([
        api.getTokenInfo(),
        api.getShopItems(),
      ]);

      const fallbackItems = fallbackResponse.success && fallbackResponse.data ? fallbackResponse.data : [];
      if (requestId !== loadRequestIdRef.current) return;

      setUsingFallbackCatalog(true);
      setItems(fallbackItems);
      const nextTokenInfo = tokenResponse.success && tokenResponse.data ? tokenResponse.data : null;
      setTokenInfo(nextTokenInfo);
      pageDataCache.shop.items = fallbackItems;
      pageDataCache.shop.tokenInfo = nextTokenInfo;
      pageDataCache.shop.usingFallbackCatalog = true;

      try {
        const onchainItems = await Promise.race([
          fetchOnchainShopItems(connection),
          new Promise<ShopItem[]>((_, reject) => {
            window.setTimeout(() => reject(new Error('On-chain shop request timed out')), 4000);
          }),
        ]);

        if (requestId !== loadRequestIdRef.current) return;
        if (onchainItems.length > 0) {
          setUsingFallbackCatalog(false);
          setItems(onchainItems);
          pageDataCache.shop.items = onchainItems;
          pageDataCache.shop.usingFallbackCatalog = false;
        }
      } catch (error) {
        console.warn('Using fallback shop catalog:', error);
      }
    } catch (error) {
      console.error('Error loading shop items:', error);
      const fallbackResponse = await api.getShopItems();
      if (requestId !== loadRequestIdRef.current) return;
      if (fallbackResponse.success && fallbackResponse.data) {
        setUsingFallbackCatalog(true);
        setItems(fallbackResponse.data);
        pageDataCache.shop.items = fallbackResponse.data;
        pageDataCache.shop.usingFallbackCatalog = true;
      } else {
        toast.error(t('common.error'));
        setUsingFallbackCatalog(false);
        setItems([]);
        pageDataCache.shop.items = [];
        pageDataCache.shop.usingFallbackCatalog = false;
      }
    } finally {
      if (requestId === loadRequestIdRef.current && !silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
      void loadItems({ silent: true });
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const locale = language === 'tr' ? trLocale : enUS;
  const localizedItems = items.map((item) => localizeShopItem(item, language));
  const normalizedSearchQuery = normalizeShopSearch(searchQuery);
  const rarityFilteredItems = rarityFilter === 'all'
    ? localizedItems
    : localizedItems.filter((item) => item.rarity === rarityFilter);
  const filteredItems = normalizedSearchQuery
    ? rarityFilteredItems.filter((item) => {
        const searchable = normalizeShopSearch(`${item.name} ${item.description} ${item.category}`);
        return searchable.includes(normalizedSearchQuery);
      })
    : rarityFilteredItems;
  const localizedSelectedItem = useMemo(
    () => (selectedItem ? localizeShopItem(selectedItem, language) : null),
    [selectedItem, language]
  );

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
    if (selectedItem.stock <= 0) {
      toast.error(t('shop.unavailablePurchase'));
      return;
    }
    try {
      if (usingFallbackCatalog) {
        const walletAuth = await createWalletAuth(wallet, 'shop:purchase');
        if (!walletAuth) return;
        const response = await api.purchaseItem(publicKey.toBase58(), selectedItem.id, walletAuth);
        if (!response.success) {
          throw new Error(response.error || t('common.error'));
        }
      } else {
        const signature = await purchaseOnchainShopItem(connection, wallet, selectedItem.id);
        console.log('On-chain purchase signature:', signature);
      }

      toast.success(t('shop.purchaseSuccess'));
      setPurchaseDialogOpen(false);
      await loadItems();
    } catch (error) {
      console.error('On-chain purchase failed:', error);
      toast.error(error instanceof Error ? error.message : t('common.error'));
    }
  };

  const getRarityBorderClass = (rarity: Rarity) => ({
    common: 'border-gray-500/30',
    rare: 'border-blue-500/50',
    epic: 'border-purple-500/50',
    legendary: 'border-yellow-500/50 shadow-lg shadow-yellow-500/20',
  }[rarity]);

  const getRestockLabel = (item: ShopItem) => {
    if (!item.restockAt || item.stock > 0) {
      return null;
    }

    const restockAt = new Date(item.restockAt);
    if (Number.isNaN(restockAt.getTime()) || restockAt.getTime() <= now) {
      return null;
    }

    return `${t('shop.restocking')} • ${formatDistanceToNow(restockAt, { addSuffix: false, locale })}`;
  };

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
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{formatDuanAmount(tokenBalance)}</div>
              <div className="text-xs text-muted-foreground">{formatSolAmount(duanToSol(tokenBalance))}</div>
            </div>
          </div>
        </GlassCard>

        {tokenInfo && (
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{tokenInfo.name} ({tokenInfo.symbol})</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{formatSolAmount(tokenInfo.price)}</div>
                <div className="text-xs text-muted-foreground">1 DUAN</div>
              </div>
            </div>
          </GlassCard>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <Input placeholder={t('shop.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1" />
        <Button variant="outline" onClick={() => void loadItems()}>{t('common.search')}</Button>
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
      ) : filteredItems.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <ShoppingCart className="w-14 h-14 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2">{t('shop.emptyTitle')}</h3>
          <p className="text-muted-foreground">{t('shop.emptyDesc')}</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
              <GlassCard hover className={`overflow-hidden h-full flex flex-col border-2 ${getRarityBorderClass(item.rarity)} cursor-pointer`} onClick={() => handlePurchase(item)}>
                <div className="aspect-square overflow-hidden relative group">
                  <img src={resolveAssetUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
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
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">{formatDuanAmount(item.price)}</div>
                        <div className="text-xs text-muted-foreground">{formatSolAmount(duanToSol(item.price))}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('shop.stock')}</span>
                      <span className={item.stock < 10 ? 'text-destructive font-medium' : 'font-medium'}>
                        {item.stock} {t('shop.stockUnit')}
                      </span>
                    </div>
                    {item.price > (item.basePrice ?? item.price) && (
                      <p className="text-xs text-amber-600">{t('shop.dynamicPrice')}</p>
                    )}
                    {item.stock === 0 && (
                      <p className="text-xs font-medium text-destructive">
                        {getRestockLabel(item) || t('shop.outOfStock')}
                      </p>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('shop.purchaseItem')}</DialogTitle>
            <DialogDescription>{t('shop.purchaseDesc')}</DialogDescription>
          </DialogHeader>
          {selectedItem && localizedSelectedItem && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-lg bg-muted/20 p-4">
                <img
                  src={resolveAssetUrl(localizedSelectedItem.imageUrl)}
                  alt={localizedSelectedItem.name}
                  className="h-48 w-auto max-w-full object-contain"
                />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-2">{localizedSelectedItem.name}</h3>
                <RarityBadge rarity={localizedSelectedItem.rarity} />
              </div>
              <p className="text-sm text-muted-foreground">{localizedSelectedItem.description}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('shop.price')}</span>
                  <div className="text-right">
                    <div className="font-semibold">{formatDuanAmount(selectedItem.price)}</div>
                    <div className="text-xs text-muted-foreground">{formatSolAmount(duanToSol(selectedItem.price))}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('shop.stock')}</span>
                  <span className="font-semibold">{selectedItem.stock} {t('shop.stockUnit')}</span>
                </div>
                {selectedItem.stock === 0 && (
                  <p className="text-sm font-medium text-destructive">
                    {getRestockLabel(selectedItem) || t('shop.outOfStock')}
                  </p>
                )}
              </div>
              <Button className="w-full" disabled={selectedItem.stock <= 0} onClick={() => void confirmPurchase()}>
                {selectedItem.stock <= 0 ? t('shop.restocking') : t('shop.confirmPurchase')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
