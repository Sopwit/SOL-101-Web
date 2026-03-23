import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Clock, Plus, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { createWalletAuth } from '../lib/walletAuth';
import { GlassCard } from '../components/GlassCard';
import { RarityBadge } from '../components/RarityBadge';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { api } from '../services/api';
import type { MarketListing } from '../types';

export function MarketPage() {
  const { connected, publicKey, signMessage } = useWallet();
  const { t, language } = useLanguage();
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [offeredItemId, setOfferedItemId] = useState('');
  const [wantedType, setWantedType] = useState<'token' | 'item' | 'both'>('token');
  const [wantedTokenAmount, setWantedTokenAmount] = useState('');
  const [wantedItemName, setWantedItemName] = useState('');
  const [duration, setDuration] = useState('24');
  const [note, setNote] = useState('');

  const loadListings = async () => {
    setIsLoading(true);
    const response = await api.getMarketListings({ status: 'active' });
    setListings(response.success && response.data ? response.data : []);
    setIsLoading(false);
  };

  useEffect(() => {
    loadListings();
  }, []);

  const handleCreateListing = async () => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
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
    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'market:create_trade');
    if (!walletAuth) return;
    const response = await api.createTradeOffer(selectedListing.id, publicKey.toBase58(), {}, walletAuth);
    if (response.success) {
      toast.success(t('common.success'));
      setTradeDialogOpen(false);
    } else {
      toast.error(response.error || t('common.error'));
    }
  };

  const getTimeRemaining = (expiresAt: string) =>
    formatDistanceToNow(new Date(expiresAt), { locale: language === 'tr' ? trLocale : enUS });

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
                <Input value={offeredItemId} onChange={(e) => setOfferedItemId(e.target.value)} placeholder="inventory item id" />
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
                <Input type="number" value={wantedTokenAmount} onChange={(e) => setWantedTokenAmount(e.target.value)} placeholder="0" />
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

      {isLoading ? (
        <GlassCard className="p-12 text-center">{t('common.loading')}</GlassCard>
      ) : listings.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Clock className="w-14 h-14 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2">Pazarda henuz ilan yok</h3>
          <p className="text-muted-foreground">Mock listing'ler kaldirildi. Burada sadece backend'deki gercek ilanlar gosterilecek.</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {listings.map((listing, index) => (
            <motion.div key={listing.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
              <GlassCard hover className="p-4 cursor-pointer" onClick={() => { setSelectedListing(listing); setDetailDialogOpen(true); }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-medium">{listing.sellerUsername || listing.sellerWallet}</div>
                    <div className="text-xs text-muted-foreground">{getTimeRemaining(listing.expiresAt)}</div>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Clock className="w-3 h-3" />
                    {listing.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={listing.offeredItem.imageUrl} alt={listing.offeredItem.name} className="w-full h-full object-cover" />
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
                    <p className="font-bold text-lg">
                      {listing.wantedType === 'token' && `${listing.wantedTokenAmount} Token`}
                      {listing.wantedType === 'item' && listing.wantedItemName}
                      {listing.wantedType === 'both' && `${listing.wantedTokenAmount} Token + ${listing.wantedItemName}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button onClick={() => { setSelectedListing(listing); setTradeDialogOpen(true); }}>
                      {t('market.sendOffer')}
                    </Button>
                  </div>
                </div>
                {listing.note && <p className="text-sm text-muted-foreground mt-4 p-3 bg-muted/30 rounded-lg">{listing.note}</p>}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={tradeDialogOpen} onOpenChange={setTradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('market.sendOffer')}</DialogTitle>
            <DialogDescription>Trade offer backend uzerinden gonderilecek.</DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">{t('market.wanted')}</p>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-secondary" />
                  <span className="font-bold">
                    {selectedListing.wantedType === 'token' && `${selectedListing.wantedTokenAmount} Token`}
                    {selectedListing.wantedType === 'item' && selectedListing.wantedItemName}
                    {selectedListing.wantedType === 'both' && `${selectedListing.wantedTokenAmount} Token + ${selectedListing.wantedItemName}`}
                  </span>
                </div>
              </div>
              <Button className="w-full" onClick={() => void confirmTrade()}>{t('market.sendOffer')}</Button>
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
              <img src={selectedListing.offeredItem.imageUrl} alt={selectedListing.offeredItem.name} className="w-full aspect-video object-cover rounded-lg" />
              <p className="text-sm text-muted-foreground">{selectedListing.note || 'Ek not bulunmuyor.'}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
