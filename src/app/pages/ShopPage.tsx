import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, ShoppingCart, Sparkles } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { enUS, tr as trLocale } from 'date-fns/locale';
import { GlassCard } from '../components/GlassCard';
import { EmptyStateCard, MaintenanceStateCard } from '../components/ModuleStateCard';
import { NotificationRail } from '../components/NotificationRail';
import { PageHero } from '../components/PageHero';
import { PageShell } from '../components/PageShell';
import { RarityBadge } from '../components/RarityBadge';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchOnchainShopSnapshot, purchaseOnchainShopItem, type OnchainShopSnapshot } from '../lib/onchain/duanShopClient';
import { pageDataCache } from '../lib/pageDataCache';
import { localizeShopItem, normalizeShopSearch } from '../lib/shopItemLocalization';
import { resolveAssetUrl } from '../lib/assetUrls';
import { reportError } from '../lib/telemetry';
import { useStore } from '../store';
import { api } from '../services/api';
import { useAdminAccess } from '../hooks/useAdminAccess';
import type { Rarity, ShopItem, SystemStatusItem } from '../types';
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
  const { isAdmin } = useAdminAccess();
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onchainSnapshot, setOnchainSnapshot] = useState<OnchainShopSnapshot | null>(null);
  const [tokenInfoStatus, setTokenInfoStatus] = useState<SystemStatusItem | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [statusCheckedAt, setStatusCheckedAt] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const endpointLabel = useMemo(() => connection.rpcEndpoint.replace(/^https?:\/\//, ''), [connection.rpcEndpoint]);
  const currentItemsRef = useRef(items);

  useEffect(() => {
    currentItemsRef.current = items;
  }, [items]);

  const buildSourceMessage = (source: 'backend' | 'assets' | 'onchain', message: string) => {
    if (language === 'tr') {
      return message;
    }

    const fallbackMap = {
      backend: 'Backend service is degraded or unreachable.',
      assets: 'Some visual assets could not be loaded.',
      onchain: 'On-chain shop data is unavailable.',
    } as const;

    return fallbackMap[source];
  };

  const loadTokenInfo = async (requestId: number) => {
    const response = await api.getTokenInfo();
    if (requestId !== loadRequestIdRef.current) {
      return;
    }

    if (response.success && response.data) {
      setTokenInfo(response.data);
      setTokenInfoStatus({
        id: 'shop-backend-token',
        source: 'backend',
        state: 'healthy',
        severity: 'info',
        title: 'Backend Token Feed',
        detail: language === 'tr'
          ? 'Token fiyat ve supply bilgisi backend servisinden guncel aliniyor.'
          : 'Token price and supply are loading correctly from the backend service.',
      });
      pageDataCache.shop.tokenInfo = response.data;
      return;
    }

    setTokenInfoStatus({
      id: 'shop-backend-token',
      source: 'backend',
      state: 'degraded',
      severity: 'warning',
      title: 'Backend Token Feed',
      detail: response.error || buildSourceMessage('backend', 'Backend token servisi cevap vermiyor. Magaza itemleri acilabilir ancak token ozeti guncel degil.'),
    });
  };

  const readSnapshot = async () => {
    const firstSnapshot = await Promise.race([
      fetchOnchainShopSnapshot(connection),
      new Promise<OnchainShopSnapshot>((resolve) => {
        window.setTimeout(() => {
          resolve({
            items: [],
            status: 'offline',
            code: 'rpc_unreachable',
            message: language === 'tr'
              ? 'On-chain shop istegi zaman asimina ugradi. RPC gec cevap veriyor veya baglanti kopuk.'
              : 'The on-chain shop request timed out. RPC is slow or unavailable.',
            missingItemIds: [],
          });
        }, 4500);
      }),
    ]);

    if (firstSnapshot.status === 'healthy') {
      return firstSnapshot;
    }

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const retrySnapshot = await fetchOnchainShopSnapshot(connection);

      if (retrySnapshot.status === 'healthy') {
        return retrySnapshot;
      }

      if (firstSnapshot.status === 'healthy') {
        return firstSnapshot;
      }

      if (firstSnapshot.code !== retrySnapshot.code) {
        return {
          ...retrySnapshot,
          status: 'degraded',
          message: language === 'tr'
            ? `On-chain durum degisti, sistem yeniden kontrol edildi. Son durum: ${retrySnapshot.message}`
            : `On-chain status changed while rechecking. Latest result: ${retrySnapshot.message}`,
        };
      }

      return retrySnapshot;
    } catch {
      return firstSnapshot;
    }
  };

  const loadItems = async (options?: { silent?: boolean }) => {
    const requestId = ++loadRequestIdRef.current;
    const silent = options?.silent ?? false;
    if (!silent && pageDataCache.shop.items.length === 0) {
      setIsLoading(true);
    }

    try {
      setLoadError(null);
      void loadTokenInfo(requestId);
      const snapshot = await readSnapshot();

      if (requestId !== loadRequestIdRef.current) return;

      setOnchainSnapshot(snapshot);
      setStatusCheckedAt(new Date().toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));

      if (snapshot.items.length > 0) {
        setItems(snapshot.items);
        pageDataCache.shop.items = snapshot.items;
      } else if (!silent && pageDataCache.shop.items.length === 0) {
        setItems([]);
        pageDataCache.shop.items = [];
      }

      if (snapshot.status === 'offline' && currentItemsRef.current.length === 0) {
        setLoadError(snapshot.message);
      } else {
        setLoadError(null);
      }

      pageDataCache.shop.usingFallbackCatalog = false;
    } catch (error) {
      reportError('shop:load', error, 'Magaza itemleri yuklenemedi');
      if (requestId !== loadRequestIdRef.current) return;
      const message = error instanceof Error ? error.message : t('common.error');
      setLoadError(message);
      if (!silent && pageDataCache.shop.items.length === 0) {
        setItems([]);
        pageDataCache.shop.items = [];
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
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleFocus = () => { void loadItems({ silent: true }); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const locale = language === 'tr' ? trLocale : enUS;
  const failedImageCount = failedImageIds.length;
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
  const missingImageMetadataCount = localizedItems.filter((item) => !item.imageUrl).length;

  const systemStatuses = useMemo<SystemStatusItem[]>(() => {
    const statuses: SystemStatusItem[] = [];

    if (onchainSnapshot) {
      statuses.push({
        id: 'shop-onchain',
        source: 'onchain',
        state: onchainSnapshot.status,
        severity: onchainSnapshot.status === 'healthy' ? 'info' : onchainSnapshot.status === 'degraded' ? 'warning' : 'error',
        title: 'On-Chain Catalog',
        detail: onchainSnapshot.message,
        checkedAt: statusCheckedAt || undefined,
        context: endpointLabel,
      });
    }

    if (tokenInfoStatus) {
      statuses.push(tokenInfoStatus);
    }

    if (missingImageMetadataCount > 0 || failedImageCount > 0) {
      const parts = [
        missingImageMetadataCount > 0 ? `${missingImageMetadataCount} item metadata gorseli eksik.` : null,
        failedImageCount > 0 ? `${failedImageCount} gorsel dosyasi yuklenemedi.` : null,
      ].filter(Boolean);

      statuses.push({
        id: 'shop-assets',
        source: 'assets',
        state: 'degraded',
        severity: 'warning',
        title: 'Asset Sync',
        detail: parts.join(' ') || buildSourceMessage('assets', 'Bazi gorseller yuklenemedi.'),
        checkedAt: statusCheckedAt || undefined,
      });
    } else if (localizedItems.length > 0) {
      statuses.push({
        id: 'shop-assets',
        source: 'assets',
        state: 'healthy',
        severity: 'info',
        title: 'Asset Sync',
        detail: language === 'tr'
          ? 'Magaza gorselleri ve PNG assetleri normal gorunuyor.'
          : 'Shop images and PNG assets are rendering correctly.',
        checkedAt: statusCheckedAt || undefined,
      });
    }

    return statuses;
  }, [endpointLabel, failedImageCount, language, localizedItems.length, missingImageMetadataCount, onchainSnapshot, statusCheckedAt, tokenInfoStatus]);
  const sectionOffline = Boolean(
    onchainSnapshot &&
    onchainSnapshot.status === 'offline' &&
    onchainSnapshot.code !== 'program_missing' &&
    items.length === 0
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setFailedImageIds([]);
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
      const signature = await purchaseOnchainShopItem(connection, wallet, selectedItem.id);
      console.log('On-chain purchase signature:', signature);

      toast.success(t('shop.purchaseSuccess'));
      setPurchaseDialogOpen(false);
      await loadItems();
    } catch (error) {
      reportError('shop:purchase', error, 'On-chain satin alim basarisiz');
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

  const registerImageFailure = (itemId: string) => {
    setFailedImageIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
  };

  const renderLoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <GlassCard key={`shop-skeleton-${index}`} className="overflow-hidden border border-border/40">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-4 p-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </GlassCard>
      ))}
    </div>
  );

  return (
    <SectionErrorBoundary
      title="Magaza modulu gecici olarak kapanmis durumda"
      description="Bu bolum render edilirken beklenmeyen bir hata olustu. Uygulamanin geri kalani acik kalir; magaza bolumunu yeniden deneyebilirsin."
    >
      <PageShell
        hero={(
          <PageHero
            eyebrow="ON-CHAIN SHOP"
            title={t('shop.title')}
            description={t('shop.subtitle')}
            accent="from-cyan-400/15 via-sky-300/10 to-emerald-300/20"
            panelTitle="LIVE INVENTORY"
            panelBody="Fiyat, stok ve restock verisi on-chain hesaplardan okunur. Gorseller yerel katalog ile esitlenir."
            metrics={[
              { label: 'Catalog', value: `${items.length}` },
              { label: 'Visible', value: `${filteredItems.length}` },
              { label: 'DUAN', value: `${Math.round(tokenBalance)}` },
            ]}
            actions={(
              <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('common.refresh')}
              </Button>
            )}
          />
        )}
      >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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

      <GlassCard className="p-5 md:p-6">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto_auto] xl:items-center">
          <Input placeholder={t('shop.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1" />
          <Select value={rarityFilter} onValueChange={setRarityFilter}>
            <SelectTrigger className="w-full xl:w-[220px]"><SelectValue placeholder={t('shop.rarity')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="common">{t('rarity.common')}</SelectItem>
              <SelectItem value="rare">{t('rarity.rare')}</SelectItem>
              <SelectItem value="epic">{t('rarity.epic')}</SelectItem>
              <SelectItem value="legendary">{t('rarity.legendary')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void loadItems()} className="xl:min-w-36">{t('common.search')}</Button>
        </div>
      </GlassCard>

      {isLoading ? (
        renderLoadingSkeleton()
      ) : sectionOffline ? (
        <MaintenanceStateCard
          title={language === 'tr' ? 'Magaza Alani Kapali' : 'Shop Section Offline'}
          description={loadError || buildSourceMessage('onchain', 'Magaza verisi su an acilamiyor. On-chain shop hesabi veya RPC tarafini kontrol edin.')}
          onAction={handleRefresh}
        />
      ) : loadError ? (
        <MaintenanceStateCard
          title={t('common.error')}
          description={loadError}
          onAction={handleRefresh}
        />
      ) : filteredItems.length === 0 ? (
        <EmptyStateCard
          title={t('shop.emptyTitle')}
          description={t('shop.emptyDesc')}
          icon={ShoppingCart}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
              <GlassCard hover className={`overflow-hidden h-full flex flex-col border-2 ${getRarityBorderClass(item.rarity)} cursor-pointer`} onClick={() => handlePurchase(item)}>
                <div className="aspect-square overflow-hidden relative group">
                  <ImageWithFallback
                    src={resolveAssetUrl(item.imageUrl)}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    loading={index < 6 ? 'eager' : 'lazy'}
                    decoding="async"
                    onFallback={() => registerImageFailure(item.id)}
                  />
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
                <ImageWithFallback
                  src={resolveAssetUrl(localizedSelectedItem.imageUrl)}
                  alt={localizedSelectedItem.name}
                  className="h-48 w-auto max-w-full object-contain"
                  decoding="async"
                  onFallback={() => registerImageFailure(localizedSelectedItem.id)}
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
      </PageShell>
      {isAdmin && systemStatuses.length > 0 && (
        <NotificationRail
          title="Magaza Durum Merkezi"
          description="Burada shop tarafindaki on-chain, backend ve asset saglik durumlarini ayri ayri gorebilirsin."
          triggerLabel="Shop Status"
          items={systemStatuses.map((status) => ({
            ...status,
            detail: status.state === 'healthy' ? status.detail : status.detail,
          }))}
        />
      )}
    </SectionErrorBoundary>
  );
}
