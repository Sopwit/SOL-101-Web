import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Clock, Plus, Sparkles, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { useConnection } from '@solana/wallet-adapter-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { createWalletAuth } from '../lib/walletAuth';
import { resolveAssetUrl } from '../lib/assetUrls';
import { pageDataCache } from '../lib/pageDataCache';
import { fetchOnchainOwnedItems } from '../lib/onchain/duanShopClient';
import { cancelOnchainMarketListing, createOnchainTradeIntent, openOnchainMarketListing } from '../lib/onchain/duanMarketClient';
import { localizeShopItem } from '../lib/shopItemLocalization';
import { ContentGridSkeleton } from '../components/ContentGridSkeleton';
import { GlassCard } from '../components/GlassCard';
import { EmptyStateCard, LoadingStateCard, MaintenanceStateCard } from '../components/ModuleStateCard';
import { NotificationRail } from '../components/NotificationRail';
import { PageHero } from '../components/PageHero';
import { PageShell } from '../components/PageShell';
import { RarityBadge } from '../components/RarityBadge';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { api } from '../services/api';
import { reportError } from '../lib/telemetry';
import { useAdminAccess } from '../hooks/useAdminAccess';
import type { InventoryItem, MarketListing, SystemStatusItem } from '../types';
import { formatDuanWithSol } from '../../../shared/duanEconomy';

export function MarketPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { connected, publicKey, signMessage } = wallet;
  const { isAdmin } = useAdminAccess();
  const { t, language } = useLanguage();
  const [listings, setListings] = useState<MarketListing[]>(() => pageDataCache.market.listings);
  const [myListings, setMyListings] = useState<MarketListing[]>(() => pageDataCache.market.myListings);
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(() => pageDataCache.market.listings.length === 0);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [marketFeedError, setMarketFeedError] = useState<string | null>(null);
  const [statusCheckedAt, setStatusCheckedAt] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'feed' | 'mine'>('feed');
  const [isCancellingListingId, setIsCancellingListingId] = useState<string | null>(null);

  const [offeredItemId, setOfferedItemId] = useState('');
  const [wantedType, setWantedType] = useState<'token' | 'item' | 'both'>('token');
  const [wantedTokenAmount, setWantedTokenAmount] = useState('');
  const [wantedItemName, setWantedItemName] = useState('');
  const [duration, setDuration] = useState('24');
  const [note, setNote] = useState('');

  const walletAddress = publicKey?.toBase58() ?? '';

  const loadInventory = async () => {
    if (!connected || !publicKey) {
      setInventoryItems([]);
      return;
    }

    setInventoryLoading(true);
    try {
      setInventoryError(null);
      const nextInventory = await fetchOnchainOwnedItems(connection, publicKey);
      setInventoryItems(nextInventory);
    } catch (error) {
      reportError('market:onchain-inventory', error, 'On-chain inventory yuklenemedi');
      setInventoryItems([]);
      setInventoryError(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setInventoryLoading(false);
      setStatusCheckedAt(new Date().toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    }
  };

  const loadListings = async () => {
    if (pageDataCache.market.listings.length === 0 || pageDataCache.market.language !== language) {
      setIsLoading(true);
    }
    try {
      const [globalResponse, ownResponse] = await Promise.all([
        api.getMarketListings({ status: 'active', language }),
        connected && walletAddress ? api.getListingsByWallet(walletAddress, language) : Promise.resolve({ success: true, data: [] as MarketListing[] }),
      ]);

      setMarketFeedError(globalResponse.success ? null : (globalResponse.error || 'Market feed backend tarafindan yuklenemedi.'));
      const nextListings = globalResponse.success && globalResponse.data ? globalResponse.data : [];
      const nextMyListings = ownResponse.success && ownResponse.data ? ownResponse.data : [];
      setListings(nextListings);
      setMyListings(nextMyListings);
      pageDataCache.market.listings = nextListings;
      pageDataCache.market.myListings = nextMyListings;
      pageDataCache.market.language = language;
    } finally {
      setIsLoading(false);
      setStatusCheckedAt(new Date().toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    }
  };

  useEffect(() => {
    void loadListings();
  }, [language, connected, walletAddress]);

  useEffect(() => {
    void loadInventory();
  }, [connected, publicKey, connection]);

  useEffect(() => {
    if (!selectedListing) {
      return;
    }

    const nextListing = [...listings, ...myListings].find((listing) => listing.id === selectedListing.id);
    if (nextListing) {
      setSelectedListing(getLocalizedListing(nextListing));
    }
  }, [selectedListing, listings, myListings, language]);

  const handleCreateListing = async () => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
      return;
    }
    if (!offeredItemId) {
      toast.error(t('market.inventoryRequired'));
      return;
    }
    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'market:create_listing');
    if (!walletAuth) return;

    let onchainPayload: {
      marketMode: 'backend' | 'hybrid' | 'onchain';
      onchainListingPda?: string;
      onchainProgramId?: string;
      txSignature?: string;
      expiresAt?: string;
      listingNonce?: string;
    };

    try {
      const onchainResult = await openOnchainMarketListing(connection, wallet, {
        itemId: offeredItemId,
        wantedType,
        wantedTokenAmount: wantedTokenAmount ? Number(wantedTokenAmount) : undefined,
        wantedItemId: wantedItemName || undefined,
        durationHours: Number(duration),
      });

      onchainPayload = {
        marketMode: 'hybrid',
        onchainListingPda: onchainResult.listingEscrow,
        onchainProgramId: onchainResult.programId,
        txSignature: onchainResult.signature,
        expiresAt: onchainResult.expiresAt,
        listingNonce: onchainResult.listingNonce,
      };
    } catch (error) {
      reportError('market:onchain-open-listing', error, 'On-chain market listing acilamadi');
      toast.error(error instanceof Error ? error.message : 'On-chain market listing acilamadi');
      return;
    }

    const response = await api.createListing(
      publicKey.toBase58(),
      {
        offeredItemId,
        wantedType,
        wantedTokenAmount: wantedTokenAmount ? Number(wantedTokenAmount) : undefined,
        wantedItemName: wantedItemName || undefined,
        note: note || undefined,
        duration: Number(duration),
        ...onchainPayload,
      },
      walletAuth
    );

    if (response.success) {
      toast.success(t('common.success'));
      setOfferedItemId('');
      setWantedTokenAmount('');
      setWantedItemName('');
      setNote('');
      setActiveView('mine');
      await loadListings();
    } else {
      toast.error(response.error || t('common.error'));
    }
  };

  const confirmTrade = async () => {
    if (!connected || !publicKey || !selectedListing) {
      toast.error(t('error.walletRequired'));
      return;
    }
    if (selectedListing.sellerWallet === walletAddress) {
      toast.error(t('market.selfOfferBlocked'));
      return;
    }
    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'market:create_trade');
    if (!walletAuth) return;

    let onchainPayload: {
      marketMode: 'backend' | 'hybrid' | 'onchain';
      onchainTradeIntentPda?: string;
      onchainProgramId?: string;
      txSignature?: string;
    } = { marketMode: 'backend' };

    if (selectedListing.onchainListingPda) {
      try {
        const onchainResult = await createOnchainTradeIntent(connection, wallet, {
          listingEscrow: selectedListing.onchainListingPda,
          offeredTokenAmount: selectedListing.wantedTokenAmount,
        });

        onchainPayload = {
          marketMode: 'hybrid',
          onchainTradeIntentPda: onchainResult.tradeIntent,
          onchainProgramId: onchainResult.programId,
          txSignature: onchainResult.signature,
        };
      } catch (error) {
        reportError('market:onchain-trade-intent', error, 'On-chain trade intent olusturulamadi');
        toast.error(error instanceof Error ? error.message : 'On-chain trade intent olusturulamadi');
        return;
      }
    }

    const response = await api.createTradeOffer(selectedListing.id, publicKey.toBase58(), onchainPayload, walletAuth);
    if (response.success) {
      toast.success(t('common.success'));
      setTradeDialogOpen(false);
      await loadListings();
    } else {
      toast.error(response.error || t('common.error'));
    }
  };

  const handleCancelListing = async (listingId: string) => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
      return;
    }

    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'market:cancel_listing');
    if (!walletAuth) return;

    setIsCancellingListingId(listingId);
    try {
      const currentListing = [...listings, ...myListings].find((entry) => entry.id === listingId);
      if (currentListing?.onchainListingPda) {
        try {
          await cancelOnchainMarketListing(connection, wallet, {
            listingEscrow: currentListing.onchainListingPda,
          });
        } catch (error) {
          reportError('market:onchain-cancel-listing', error, 'On-chain market listing iptal edilemedi');
          toast.error(error instanceof Error ? error.message : 'On-chain listing iptal edilemedi');
          return;
        }
      }

      const response = await api.cancelListing(listingId, walletAddress, walletAuth);
      if (response.success) {
        toast.success(t('market.cancelSuccess'));
        if (selectedListing?.id === listingId) {
          setDetailDialogOpen(false);
          setSelectedListing(null);
        }
        await loadListings();
      } else {
        toast.error(response.error || t('common.error'));
      }
    } finally {
      setIsCancellingListingId(null);
    }
  };

  const getTimeRemaining = (expiresAt: string) =>
    formatDistanceToNow(new Date(expiresAt), { locale: language === 'tr' ? trLocale : enUS });

  const formatWantedTokenAmount = (amount?: number) => {
    if (!amount) return null;
    return formatDuanWithSol(amount);
  };

  const visibleListings = useMemo(
    () => (activeView === 'mine' ? myListings : listings),
    [activeView, listings, myListings]
  );

  const localizedInventoryItems = useMemo(
    () => inventoryItems.map((inventoryItem) => ({
      ...inventoryItem,
      item: localizeShopItem(inventoryItem.item, language),
    })),
    [inventoryItems, language]
  );

  const renderWanted = (listing: MarketListing) => {
    if (listing.wantedType === 'token') return formatWantedTokenAmount(listing.wantedTokenAmount);
    if (listing.wantedType === 'item') return listing.wantedItemName;
    return `${formatWantedTokenAmount(listing.wantedTokenAmount) ?? '0 DUAN'} + ${listing.wantedItemName}`;
  };

  const getLocalizedListing = (listing: MarketListing) => ({
    ...listing,
    offeredItem: localizeShopItem(listing.offeredItem, language),
  });

  const systemStatuses: SystemStatusItem[] = [
    {
      id: 'market-backend-feed',
      source: 'backend',
      state: marketFeedError ? 'degraded' : 'healthy',
      severity: marketFeedError ? 'warning' : 'info',
      title: 'Backend Listing Feed',
      detail: marketFeedError || 'Pazar ilan akisi backend uzerinden normal calisiyor.',
      checkedAt: statusCheckedAt || undefined,
      context: `${listings.length} aktif ilan`,
    },
    {
      id: 'market-onchain-inventory',
      source: 'onchain',
      state: inventoryError ? 'degraded' : 'healthy',
      severity: inventoryError ? 'warning' : 'info',
      title: 'On-Chain Inventory',
      detail: inventoryError || 'Ilan acilabilir envanter itemlari on-chain hesaptan aliniyor.',
      checkedAt: statusCheckedAt || undefined,
      context: inventoryError ? connection.rpcEndpoint.replace(/^https?:\/\//, '') : `${inventoryItems.length} item hazir`,
    },
    {
      id: 'market-onchain-settlement',
      source: 'onchain',
      state: 'healthy',
      severity: 'info',
      title: 'On-Chain Settlement Layer',
      detail: visibleListings.some((listing) => listing.onchainListingPda)
        ? 'Market feed icinde on-chain listing mirror kayitlari goruluyor.'
        : 'Settlement katmani hazir. Henuz mirrored listing gorunmuyor; ilk on-chain listing acildiginda burada izlenecek.',
      checkedAt: statusCheckedAt || undefined,
      context: visibleListings.some((listing) => listing.onchainListingPda)
        ? `${visibleListings.filter((listing) => listing.onchainListingPda).length} mirrored listing`
        : 'duan_market',
    },
  ];

  return (
    <>
      <PageShell
        hero={(
          <PageHero
            eyebrow="PLAYER MARKET"
            title={t('market.title')}
            description={t('market.subtitle')}
            accent="from-emerald-400/15 via-lime-300/10 to-cyan-300/15"
            panelTitle="TRADING LAYER"
            panelBody="Ilan akisi backend uzerinden akar; ilan acmak icin kullanicinin on-chain envanterindeki itemlar kullanilir."
            metrics={[
              { label: 'Feed', value: `${listings.length}` },
              { label: 'Mine', value: `${myListings.length}` },
              { label: 'Inventory', value: `${inventoryItems.length}` },
            ]}
            actions={(
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-5 h-5" />
                    {t('market.createListing')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{t('market.createListing')}</DialogTitle>
                    <DialogDescription>{t('market.createListingDesc')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('market.offeredItem')}</label>
                      <Select value={offeredItemId} onValueChange={setOfferedItemId}>
                        <SelectTrigger>
                          <SelectValue placeholder={inventoryLoading ? t('common.loading') : t('market.offeredItem')} />
                        </SelectTrigger>
                        <SelectContent>
                          {localizedInventoryItems.map((inventoryItem) => (
                            <SelectItem key={inventoryItem.id} value={inventoryItem.item.id}>
                              {inventoryItem.item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {inventoryItems.length === 0 && !inventoryLoading && (
                        <p className="text-xs text-muted-foreground mt-2">{inventoryError || t('market.noInventoryItems')}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('market.wantedItem')}</label>
                      <Select value={wantedType} onValueChange={(value: 'token' | 'item' | 'both') => setWantedType(value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="token">Token</SelectItem>
                          <SelectItem value="item">Item</SelectItem>
                          <SelectItem value="both">Token + Item</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('market.tokenAmount')}</label>
                      <Input type="number" value={wantedTokenAmount} onChange={(e) => setWantedTokenAmount(e.target.value)} placeholder="150" />
                      <p className="text-xs text-muted-foreground mt-2">{t('market.tokenAmountHint')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('market.wantedItemName')}</label>
                      <Input value={wantedItemName} onChange={(e) => setWantedItemName(e.target.value)} placeholder="Item..." />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('market.duration')}</label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24">24 saat</SelectItem>
                          <SelectItem value="48">48 saat</SelectItem>
                          <SelectItem value="72">72 saat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('market.note')}</label>
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                    </div>
                    <Button className="w-full" onClick={() => void handleCreateListing()}>{t('market.createListing')}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          />
        )}
      >
      <GlassCard className="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Market Views</p>
            <h2 className="mt-2 text-2xl font-bold">{t('market.title')}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant={activeView === 'feed' ? 'default' : 'outline'} onClick={() => setActiveView('feed')}>
              {t('market.feed')}
            </Button>
            <Button variant={activeView === 'mine' ? 'default' : 'outline'} onClick={() => setActiveView('mine')}>
              {t('market.myListings')}
            </Button>
          </div>
        </div>
      </GlassCard>

      {isLoading ? (
        <>
          <LoadingStateCard
            title="Market katmani hazirlaniyor"
            description="Ilan akisi ve kullanici envanteri senkronize ediliyor."
          />
          <ContentGridSkeleton count={3} imageClassName="h-28" contentLines={4} />
        </>
      ) : marketFeedError && visibleListings.length === 0 ? (
        <MaintenanceStateCard
          title="Market feed gecici olarak kisitli"
          description={marketFeedError}
          onAction={() => { void loadListings(); }}
        />
      ) : visibleListings.length === 0 ? (
        <EmptyStateCard
          title={t('market.emptyTitle')}
          description={t('market.emptyDesc')}
          icon={Clock}
        />
      ) : (
        <div className="space-y-5 md:space-y-6">
          {visibleListings.map((rawListing, index) => {
            const listing = getLocalizedListing(rawListing);
            return (
            <motion.div key={listing.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
              <GlassCard hover className="cursor-pointer p-5 md:p-6" onClick={() => { setSelectedListing(listing); setDetailDialogOpen(true); }}>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{listing.sellerUsername || listing.sellerWallet}</div>
                    <div className="text-xs text-muted-foreground">{getTimeRemaining(listing.expiresAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {listing.isTranslated && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        {t('market.translated')}
                      </Badge>
                    )}
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      {listing.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-6 xl:flex-row xl:items-center">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <ImageWithFallback src={resolveAssetUrl(listing.offeredItem.imageUrl)} alt={listing.offeredItem.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">{t('market.offered')}</p>
                      <h3 className="font-bold text-lg mb-1">{listing.offeredItem.name}</h3>
                      <RarityBadge rarity={listing.offeredItem.rarity} />
                    </div>
                  </div>
                  <ArrowRight className="hidden w-8 h-8 text-primary xl:block flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">{t('market.wanted')}</p>
                    <p className="font-bold text-lg">{renderWanted(listing)}</p>
                  </div>
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {listing.sellerWallet === walletAddress ? (
                      <Button
                        variant="outline"
                        className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); void handleCancelListing(listing.id); }}
                        disabled={isCancellingListingId === listing.id || listing.status !== 'active'}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('market.cancelListing')}
                      </Button>
                    ) : (
                      <Button onClick={() => { setSelectedListing(listing); setTradeDialogOpen(true); }} disabled={listing.status !== 'active'}>
                        {t('market.sendOffer')}
                      </Button>
                    )}
                  </div>
                </div>
                {listing.note && <p className="mt-5 rounded-2xl bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">{listing.note}</p>}
              </GlassCard>
            </motion.div>
          )})}
        </div>
      )}

      <Dialog open={tradeDialogOpen} onOpenChange={setTradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('market.sendOffer')}</DialogTitle>
            <DialogDescription>{t('market.tradeBackendHint')}</DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">{t('market.wanted')}</p>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-secondary" />
                  <span className="font-bold">{renderWanted(selectedListing)}</span>
                </div>
              </div>
              {selectedListing.status !== 'active' ? (
                <p className="text-sm text-destructive">{t('market.listingClosed')}</p>
              ) : (
                <Button className="w-full" onClick={() => void confirmTrade()}>{t('market.sendOffer')}</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          {selectedListing && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>{selectedListing.offeredItem.name}</DialogTitle>
                <DialogDescription>{selectedListing.sellerUsername || selectedListing.sellerWallet}</DialogDescription>
              </DialogHeader>
              <ImageWithFallback src={resolveAssetUrl(selectedListing.offeredItem.imageUrl)} alt={selectedListing.offeredItem.name} className="w-full aspect-video object-cover rounded-lg" />
              <p className="text-sm text-muted-foreground">{selectedListing.note || t('market.noAdditionalNote')}</p>
              {selectedListing.sellerWallet === walletAddress && (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => void handleCancelListing(selectedListing.id)}
                  disabled={isCancellingListingId === selectedListing.id || selectedListing.status !== 'active'}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('market.cancelListing')}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      </PageShell>
      {isAdmin ? (
        <NotificationRail
          title="Market Durum Merkezi"
          description="Burada pazar tarafindaki backend feed ve on-chain envanter durumunu ayri ayri gorebilirsin."
          triggerLabel="Market Status"
          items={systemStatuses}
        />
      ) : null}
    </>
  );
}
