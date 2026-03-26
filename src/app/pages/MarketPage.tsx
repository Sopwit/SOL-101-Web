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
import { localizeShopItem } from '../lib/shopItemLocalization';
import { GlassCard } from '../components/GlassCard';
import { RarityBadge } from '../components/RarityBadge';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { api } from '../services/api';
import type { InventoryItem, MarketListing } from '../types';
import { formatDuanWithSol } from '../../../shared/duanEconomy';

export function MarketPage() {
  const { connection } = useConnection();
  const { connected, publicKey, signMessage } = useWallet();
  const { t, language } = useLanguage();
  const [listings, setListings] = useState<MarketListing[]>(() => pageDataCache.market.listings);
  const [myListings, setMyListings] = useState<MarketListing[]>(() => pageDataCache.market.myListings);
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(() => pageDataCache.market.listings.length === 0);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [activeView, setActiveView] = useState<'feed' | 'mine'>('feed');
  const [isCancellingListingId, setIsCancellingListingId] = useState<string | null>(null);

  const [offeredItemId, setOfferedItemId] = useState('');
  const [wantedType, setWantedType] = useState<'token' | 'item' | 'both'>('token');
  const [wantedTokenAmount, setWantedTokenAmount] = useState('');
  const [wantedItemName, setWantedItemName] = useState('');
  const [duration, setDuration] = useState('24');
  const [note, setNote] = useState('');

  const walletAddress = publicKey?.toBase58() ?? '';

  const loadListings = async () => {
    if (pageDataCache.market.listings.length === 0 || pageDataCache.market.language !== language) {
      setIsLoading(true);
    }
    try {
      const [globalResponse, ownResponse] = await Promise.all([
        api.getMarketListings({ status: 'active', language }),
        connected && walletAddress ? api.getListingsByWallet(walletAddress, language) : Promise.resolve({ success: true, data: [] as MarketListing[] }),
      ]);

      const nextListings = globalResponse.success && globalResponse.data ? globalResponse.data : [];
      const nextMyListings = ownResponse.success && ownResponse.data ? ownResponse.data : [];
      setListings(nextListings);
      setMyListings(nextMyListings);
      pageDataCache.market.listings = nextListings;
      pageDataCache.market.myListings = nextMyListings;
      pageDataCache.market.language = language;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadListings();
  }, [language, connected, walletAddress]);

  useEffect(() => {
    const loadInventory = async () => {
      if (!connected || !publicKey) {
        setInventoryItems([]);
        return;
      }

      setInventoryLoading(true);
      try {
        const nextInventory = await fetchOnchainOwnedItems(connection, publicKey);
        setInventoryItems(nextInventory);
      } finally {
        setInventoryLoading(false);
      }
    };

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
    const response = await api.createListing(
      publicKey.toBase58(),
      {
        offeredItemId,
        wantedType,
        wantedTokenAmount: wantedTokenAmount ? Number(wantedTokenAmount) : undefined,
        wantedItemName: wantedItemName || undefined,
        note: note || undefined,
        duration: Number(duration),
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
    const response = await api.createTradeOffer(selectedListing.id, publicKey.toBase58(), {}, walletAuth);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">{t('market.title')}</h1>
          <p className="text-muted-foreground">{t('market.subtitle')}</p>
        </div>

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
                  <p className="text-xs text-muted-foreground mt-2">{t('market.noInventoryItems')}</p>
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
      </div>

      <div className="flex gap-3 mb-6">
        <Button variant={activeView === 'feed' ? 'default' : 'outline'} onClick={() => setActiveView('feed')}>
          {t('market.feed')}
        </Button>
        <Button variant={activeView === 'mine' ? 'default' : 'outline'} onClick={() => setActiveView('mine')}>
          {t('market.myListings')}
        </Button>
      </div>

      {isLoading ? (
        <GlassCard className="p-12 text-center">{t('common.loading')}</GlassCard>
      ) : visibleListings.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Clock className="w-14 h-14 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2">{t('market.emptyTitle')}</h3>
          <p className="text-muted-foreground">{t('market.emptyDesc')}</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {visibleListings.map((rawListing, index) => {
            const listing = getLocalizedListing(rawListing);
            return (
            <motion.div key={listing.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
              <GlassCard hover className="p-4 cursor-pointer" onClick={() => { setSelectedListing(listing); setDetailDialogOpen(true); }}>
                <div className="flex items-center justify-between mb-4">
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
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={resolveAssetUrl(listing.offeredItem.imageUrl)} alt={listing.offeredItem.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">{t('market.offered')}</p>
                      <h3 className="font-bold text-lg mb-1">{listing.offeredItem.name}</h3>
                      <RarityBadge rarity={listing.offeredItem.rarity} />
                    </div>
                  </div>
                  <ArrowRight className="w-8 h-8 text-primary flex-shrink-0" />
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
                {listing.note && <p className="text-sm text-muted-foreground mt-4 p-3 bg-muted/30 rounded-lg">{listing.note}</p>}
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
              <img src={resolveAssetUrl(selectedListing.offeredItem.imageUrl)} alt={selectedListing.offeredItem.name} className="w-full aspect-video object-cover rounded-lg" />
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
    </div>
  );
}
