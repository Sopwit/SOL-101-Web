import { useState } from 'react';
import { api, type WalletAuthHeaders } from '../services/api';
import { useStore } from '../store';
import { motion } from 'motion/react';
import { ArrowRight, Clock, Plus, Sparkles } from 'lucide-react';
import { MarketListing } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { GlassCard } from '../components/GlassCard';
import { RarityBadge } from '../components/RarityBadge';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { mockInventory, mockMarketListings } from '../lib/mockData';

export function MarketPage() {
  const { connected, publicKey, signMessage } = useWallet();
  const { user } = useStore();
  const { t, language } = useLanguage();
  const [listings] = useState<MarketListing[]>(mockMarketListings);
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Helper for wallet signature
  const createWalletAuth = async (action: string): Promise<WalletAuthHeaders | null> => {
    if (!publicKey || !signMessage) {
      toast.error('Wallet imzalama desteklenmiyor');
      return null;
    }
    const walletAddress = publicKey.toBase58();
    const message = JSON.stringify({
      domain: 'SOL101',
      action,
      walletAddress,
      timestamp: Date.now(),
    });
    const messageBytes = new TextEncoder().encode(message);
    try {
      const signatureBytes = await signMessage(messageBytes);
      const binary = Array.from(signatureBytes, (byte) => String.fromCharCode(byte)).join('');
      const signature = btoa(binary);
      return {
        walletAddress,
        message,
        signature,
      };
    } catch {
      toast.error('İmza işlemi iptal edildi veya başarısız oldu');
      return null;
    }
  };

  // Patch: Create Listing with wallet signature
  const handleCreateListing = async () => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
      return;
    }
    // TODO: Collect listing form values from state (mock for now)
    const walletAddress = publicKey.toBase58();
    const walletAuth = await createWalletAuth('market:createListing');
    if (!walletAuth) return;
    // Example values (replace with real form state)
    const listingData = {
      offeredItemId: mockInventory[0]?.id || '',
      wantedType: 'token' as const,
      wantedTokenAmount: 10,
      wantedItemName: '',
      note: '',
      duration: 24,
    };
    try {
      const response = await api.createListing(walletAddress, listingData, walletAuth);
      if (response.success) {
        toast.success(t('common.success') + '!');
        // Optionally refresh listings here
      } else {
        toast.error(response.error || t('common.error'));
      }
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleTrade = (listing: MarketListing) => {
    setSelectedListing(listing);
    setTradeDialogOpen(true);
  };

  const handleListingClick = (listing: MarketListing) => {
    setSelectedListing(listing);
    setDetailDialogOpen(true);
  };

  // Patch: Send Trade Offer with wallet signature
  const confirmTrade = async () => {
    if (!connected || !publicKey || !selectedListing) {
      toast.error(t('error.walletRequired'));
      return;
    }
    const walletAddress = publicKey.toBase58();
    const walletAuth = await createWalletAuth('market:tradeOffer');
    if (!walletAuth) return;
    // Example values (replace with real form state)
    const tradeData = {
      offeredItemId: mockInventory[0]?.id || undefined,
      offeredTokenAmount: 5,
    };
    try {
      const response = await api.createTradeOffer(selectedListing.id, walletAddress, tradeData, walletAuth);
      if (response.success) {
        toast.success(t('common.success') + '!');
        setTradeDialogOpen(false);
        // Optionally refresh listings here
      } else {
        toast.error(response.error || t('common.error'));
      }
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    return formatDistanceToNow(new Date(expiresAt), { locale: language === 'tr' ? trLocale : enUS });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">{t('market.title')}</h1>
          <p className="text-muted-foreground">
            {t('market.subtitle')}
          </p>
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
              <DialogDescription>
                {t('market.createListingDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('market.offeredItem')}</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.search') + '...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {mockInventory.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('market.wantedItem')}</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={t('market.wantedItem') + '?'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="token">Token</SelectItem>
                    <SelectItem value="item">Item</SelectItem>
                    <SelectItem value="both">Token + Item</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('market.tokenAmount')}</label>
                <Input type="number" placeholder="0" />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('market.wantedItemName')}</label>
                <Input placeholder="Item..." />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('market.duration')}</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.filter') + '...'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 {t('time.hoursAgo')}</SelectItem>
                    <SelectItem value="48">48 {t('time.hoursAgo')}</SelectItem>
                    <SelectItem value="72">72 {t('time.hoursAgo')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('market.note')}</label>
                <Textarea placeholder={t('market.notePlaceholder')} rows={3} />
              </div>

              <Button className="w-full" onClick={handleCreateListing}>
                {t('market.createListing')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Horizontal Listings */}
      <div className="space-y-4">
        {listings.map((listing, index) => (
          <motion.div
            key={listing.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            <GlassCard hover className="p-4 cursor-pointer" onClick={() => handleListingClick(listing)}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-bold">
                    {listing.sellerUsername?.[0] || 'A'}
                  </div>
                  <div>
                    <div className="font-medium">{listing.sellerUsername}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(listing.createdAt), { addSuffix: true, locale: language === 'tr' ? trLocale : enUS })}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1">
                  <Clock className="w-3 h-3" />
                  {getTimeRemaining(listing.expiresAt)}
                </Badge>
              </div>

              {/* Horizontal Trade Display */}
              <div className="flex items-center gap-6">
                {/* Offered Item */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={listing.offeredItem.imageUrl}
                      alt={listing.offeredItem.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">{t('market.offered')}</p>
                    <h3 className="font-bold text-lg mb-1">{listing.offeredItem.name}</h3>
                    <RarityBadge rarity={listing.offeredItem.rarity} />
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-8 h-8 text-primary flex-shrink-0" />

                {/* Wanted */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-24 h-24 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                    {listing.wantedType === 'token' && listing.wantedTokenAmount && (
                      <div className="text-center">
                        <Sparkles className="w-8 h-8 text-secondary mx-auto mb-1" />
                        <p className="text-2xl font-bold text-primary">{listing.wantedTokenAmount}</p>
                      </div>
                    )}
                    {listing.wantedType === 'item' && listing.wantedItemName && (
                      <p className="text-sm font-medium px-2 text-center">{listing.wantedItemName}</p>
                    )}
                    {listing.wantedType === 'both' && (
                      <div className="text-center">
                        {listing.wantedTokenAmount && (
                          <>
                            <Sparkles className="w-6 h-6 text-secondary mx-auto mb-1" />
                            <p className="text-xl font-bold text-primary">{listing.wantedTokenAmount}</p>
                          </>
                        )}
                        {listing.wantedItemName && (
                          <p className="text-xs mt-1">+ {listing.wantedItemName}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">{t('market.wanted')}</p>
                    <p className="font-bold text-lg">
                      {listing.wantedType === 'token' && `${listing.wantedTokenAmount} Token`}
                      {listing.wantedType === 'item' && listing.wantedItemName}
                      {listing.wantedType === 'both' && `${listing.wantedTokenAmount} Token + ${listing.wantedItemName}`}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button onClick={() => handleTrade(listing)} className="whitespace-nowrap">
                    {t('market.sendOffer')}
                  </Button>
                </div>
              </div>

              {/* Note */}
              {listing.note && (
                <p className="text-sm text-muted-foreground mt-4 p-3 bg-muted/30 rounded-lg">
                  {listing.note}
                </p>
              )}
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Trade Dialog */}
      <Dialog open={tradeDialogOpen} onOpenChange={setTradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('market.sendOffer')}</DialogTitle>
            <DialogDescription>
              {t('market.createListingDesc')}
            </DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">{t('market.wanted')}</p>
                {selectedListing.wantedType === 'token' && selectedListing.wantedTokenAmount && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-secondary" />
                    <span className="text-xl font-bold">{selectedListing.wantedTokenAmount} Token</span>
                  </div>
                )}
                {selectedListing.wantedType === 'item' && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">{t('common.search')}</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.search') + '...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {mockInventory.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedListing.wantedType === 'both' && (
                  <div className="space-y-3">
                    {selectedListing.wantedTokenAmount && (
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-secondary" />
                        <span className="text-xl font-bold">{selectedListing.wantedTokenAmount} Token</span>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('common.search')}</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder={t('common.search') + '...'} />
                        </SelectTrigger>
                        <SelectContent>
                          {mockInventory.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              {inv.item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={confirmTrade}>
                {t('market.sendOffer')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('market.title')}</DialogTitle>
            <DialogDescription>
              {selectedListing?.note || t('market.subtitle')}
            </DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-6">
              {/* Seller Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-lg font-bold">
                    {selectedListing.sellerUsername?.[0] || 'A'}
                  </div>
                  <div>
                    <div className="font-bold text-lg">{selectedListing.sellerUsername}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(selectedListing.createdAt), { addSuffix: true, locale: language === 'tr' ? trLocale : enUS })}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="gap-2">
                  <Clock className="w-4 h-4" />
                  {getTimeRemaining(selectedListing.expiresAt)}
                </Badge>
              </div>

              {/* Items */}
              <div className="grid grid-cols-2 gap-6">
                {/* Offered Item */}
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground font-medium">{t('market.offered')}</p>
                  <div className="aspect-square overflow-hidden rounded-lg">
                    <img
                      src={selectedListing.offeredItem.imageUrl}
                      alt={selectedListing.offeredItem.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl mb-2">{selectedListing.offeredItem.name}</h3>
                    <RarityBadge rarity={selectedListing.offeredItem.rarity} />
                  </div>
                </div>

                {/* Wanted */}
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground font-medium">{t('market.wanted')}</p>
                  <div className="aspect-square rounded-lg bg-muted/50 flex items-center justify-center">
                    {selectedListing.wantedType === 'token' && selectedListing.wantedTokenAmount && (
                      <div className="text-center">
                        <Sparkles className="w-16 h-16 text-secondary mx-auto mb-3" />
                        <p className="text-4xl font-bold text-primary">{selectedListing.wantedTokenAmount}</p>
                        <p className="text-sm text-muted-foreground mt-2">Token</p>
                      </div>
                    )}
                    {selectedListing.wantedType === 'item' && selectedListing.wantedItemName && (
                      <p className="text-2xl font-bold text-center px-4">{selectedListing.wantedItemName}</p>
                    )}
                    {selectedListing.wantedType === 'both' && (
                      <div className="text-center px-4">
                        {selectedListing.wantedTokenAmount && (
                          <>
                            <Sparkles className="w-12 h-12 text-secondary mx-auto mb-2" />
                            <p className="text-3xl font-bold text-primary">{selectedListing.wantedTokenAmount}</p>
                            <p className="text-sm text-muted-foreground">Token</p>
                          </>
                        )}
                        {selectedListing.wantedItemName && (
                          <p className="text-lg font-medium mt-3">+ {selectedListing.wantedItemName}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">
                      {selectedListing.wantedType === 'token' && `${selectedListing.wantedTokenAmount} Token`}
                      {selectedListing.wantedType === 'item' && selectedListing.wantedItemName}
                      {selectedListing.wantedType === 'both' && `${selectedListing.wantedTokenAmount} Token + ${selectedListing.wantedItemName}`}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Note */}
              {selectedListing.note && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">{t('market.note')}</p>
                  <p className="text-muted-foreground">{selectedListing.note}</p>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={() => {
                setDetailDialogOpen(false);
                handleTrade(selectedListing);
              }}>
                {t('market.sendOffer')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}