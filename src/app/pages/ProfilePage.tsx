import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, Sparkles, Edit2, Save, Trophy, TrendingUp, Package, Palette, Brush } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { NotificationRail } from '../components/NotificationRail';
import { PageHero } from '../components/PageHero';
import { PageShell } from '../components/PageShell';
import { RarityBadge } from '../components/RarityBadge';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { createWalletAuth } from '../lib/walletAuth';
import { resolveAssetUrl } from '../lib/assetUrls';
import { useStore } from '../store';
import { fetchOnchainOwnedItems, fetchOnchainPlayerProfile } from '../lib/onchain/duanShopClient';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useRuntimeHealthStatus } from '../hooks/useRuntimeHealthStatus';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { pageDataCache } from '../lib/pageDataCache';
import { reportError } from '../lib/telemetry';
import { mergeInventorySources } from '../lib/inventory';
import { ContentGridSkeleton } from '../components/ContentGridSkeleton';
import { EmptyStateCard, LoadingStateCard, MaintenanceStateCard } from '../components/ModuleStateCard';
import type { InventoryItem, SystemStatusItem, User } from '../types';
import { duanToSol, formatDuanAmount, formatSolAmount } from '../../../shared/duanEconomy';
import {
  PROFILE_AVATAR_OPTIONS,
  PROFILE_BACKGROUND_OPTIONS,
  getAvatarOptionById,
  getBackgroundOptionById,
} from '../../../shared/profileCosmetics';

interface ProfileStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalPosts: number;
  totalItems: number;
  totalTrades: number;
  rewardDuanBalance: number;
  rewardSolBalance: number;
  rewardDuanEarned: number;
  rewardSolEarned: number;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    rewardDuan?: number;
    rewardSol?: number;
    unlockedAt: string;
  }>;
}

function formatCosmeticCost(currency: 'duan' | 'sol', price: number) {
  if (currency === 'duan') {
    return formatDuanAmount(price);
  }

  return formatSolAmount(price);
}

export function ProfilePage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { connected, publicKey, signMessage } = wallet;
  const { isAdmin } = useAdminAccess();
  const { t } = useLanguage();
  const { solBalance, tokenBalance } = useStore();
  const { statusItem: runtimeStatusItem } = useRuntimeHealthStatus({ requireAuthority: true });
  const walletAddress = publicKey?.toBase58() || '';
  const cachedProfile = pageDataCache.profile.walletAddress === walletAddress ? pageDataCache.profile.profile : null;
  const cachedStats = pageDataCache.profile.walletAddress === walletAddress ? pageDataCache.profile.stats : null;
  const cachedInventory = pageDataCache.profile.walletAddress === walletAddress ? pageDataCache.profile.inventory : [];
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<User | null>(cachedProfile);
  const [username, setUsername] = useState(cachedProfile?.username || '');
  const [bio, setBio] = useState(cachedProfile?.bio || '');
  const [stats, setStats] = useState<ProfileStats | null>(cachedStats);
  const [inventory, setInventory] = useState<InventoryItem[]>(cachedInventory);
  const [loading, setLoading] = useState(() => connected && publicKey ? cachedProfile === null : false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileSourceErrors, setProfileSourceErrors] = useState({
    backendProfile: null as string | null,
    backendStats: null as string | null,
    backendInventory: null as string | null,
    onchainInventory: null as string | null,
    onchainProfile: null as string | null,
  });
  const [statusCheckedAt, setStatusCheckedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const loadProfileData = async () => {
    if (!publicKey) return;
    const requestId = ++loadRequestIdRef.current;

    setLoading(true);
    try {
      setLoadError(null);
      const [statsResponse, profileResponse, backendInventoryResponse, onchainInventory, onchainProfile] = await Promise.all([
        api.getProfileStats(walletAddress),
        api.getProfile(walletAddress),
        api.getInventory(walletAddress),
        fetchOnchainOwnedItems(connection, publicKey),
        fetchOnchainPlayerProfile(connection, publicKey),
      ]);

      if (requestId !== loadRequestIdRef.current) return;

      const profileNotInitializedMessage = onchainProfile.exists
        ? null
        : 'On-chain player profile henuz olusmamis. Devnet akisi icin bu normal; ilk satin alim veya oyun sync sonrasi otomatik olusur.';

      setProfileSourceErrors({
        backendProfile: profileResponse.success ? null : (profileResponse.error || 'Backend profil kaydi alinamadi.'),
        backendStats: statsResponse.success ? null : (statsResponse.error || 'Backend profil istatistikleri alinamadi.'),
        backendInventory: backendInventoryResponse.success ? null : (backendInventoryResponse.error || 'Backend envanteri alinamadi.'),
        onchainInventory: null,
        onchainProfile: profileNotInitializedMessage,
      });

      if (profileResponse.success && profileResponse.data) {
        setProfile(profileResponse.data);
        setUsername(profileResponse.data.username || '');
        setBio(profileResponse.data.bio || '');
        pageDataCache.profile.walletAddress = walletAddress;
        pageDataCache.profile.profile = profileResponse.data;
      }

      if (statsResponse.success && statsResponse.data) {
        const nextStats = {
          ...statsResponse.data,
          totalItems: onchainProfile.exists
            ? Math.max(statsResponse.data.totalItems, onchainProfile.totalItems)
            : statsResponse.data.totalItems,
          totalTrades: onchainProfile.exists ? onchainProfile.totalTrades : statsResponse.data.totalTrades,
        };
        setStats(nextStats);
        pageDataCache.profile.walletAddress = walletAddress;
        pageDataCache.profile.stats = nextStats;
      } else if (onchainProfile.exists) {
        const nextStats = {
          level: 1,
          xp: 0,
          xpToNextLevel: 120,
          totalPosts: 0,
          totalItems: onchainProfile.totalItems,
          totalTrades: onchainProfile.totalTrades,
          rewardDuanBalance: 0,
          rewardSolBalance: 0,
          rewardDuanEarned: 0,
          rewardSolEarned: 0,
          achievements: [],
        };
        setStats(nextStats);
        pageDataCache.profile.walletAddress = walletAddress;
        pageDataCache.profile.stats = nextStats;
      }

      const nextInventory = mergeInventorySources(
        onchainInventory,
        backendInventoryResponse.success && backendInventoryResponse.data ? backendInventoryResponse.data : [],
      );
      setInventory(nextInventory);
      pageDataCache.profile.walletAddress = walletAddress;
      pageDataCache.profile.inventory = nextInventory;
    } catch (error) {
      reportError('profile:load', error, 'Profil yuklenemedi');
      const message = error instanceof Error ? error.message : t('common.error');
      setLoadError(message);
      setProfileSourceErrors((current) => ({
        ...current,
        onchainInventory: message,
      }));
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
        setStatusCheckedAt(new Date().toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }));
      }
    }
  };

  useEffect(() => {
    if (!connected || !publicKey) {
      setProfile(null);
      setStats(null);
      setInventory([]);
      setUsername('');
      setBio('');
      setLoading(false);
      return;
    }

    if (pageDataCache.profile.walletAddress !== walletAddress) {
      setProfile(null);
      setStats(null);
      setInventory([]);
      setUsername('');
      setBio('');
      setLoading(true);
    }

    if (connected && publicKey) {
      void loadProfileData();
    }
  }, [connected, publicKey, connection, walletAddress]);

  const handleSave = async () => {
    if (!publicKey) return;
    const walletAddress = publicKey.toBase58();
    setIsSaving(true);
    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'profile:update');
    if (!walletAuth) {
      setIsSaving(false);
      return;
    }

    try {
      const response = await api.updateProfile(walletAddress, { username, bio }, walletAuth);
      if (response.success) {
        setIsEditing(false);
        await loadProfileData();
        toast.success(t('common.success'));
      } else {
        toast.error(response.error || t('common.error'));
      }
    } catch (error) {
      reportError('profile:save', error, 'Profil kaydi basarisiz');
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlockCosmetic = async (slot: 'avatar' | 'background', cosmeticId: string) => {
    if (!publicKey) return;

    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'profile:unlock_cosmetic');
    if (!walletAuth) return;

    setUnlockingId(cosmeticId);
    try {
      const response = await api.unlockProfileCosmetic(publicKey.toBase58(), { slot, cosmeticId }, walletAuth);
      if (!response.success) {
        toast.error(response.error || t('common.error'));
        return;
      }

      await loadProfileData();
      toast.success(t('common.success'));
    } catch (error) {
      reportError('profile:unlock-cosmetic', error, 'Kozmetik acma istegi basarisiz');
      toast.error(t('common.error'));
    } finally {
      setUnlockingId(null);
    }
  };

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-24 md:px-6">
        <EmptyStateCard
          title={t('profile.walletRequired')}
          description={t('profile.walletRequiredDesc')}
          icon={Wallet}
        />
      </div>
    );
  }

  const shortAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
  const xpProgress = stats ? Math.min(100, (stats.xp / stats.xpToNextLevel) * 100) : 0;
  const totalInventoryCount = inventory.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  const selectedAvatar = getAvatarOptionById(profile?.selectedAvatarId);
  const selectedBackground = getBackgroundOptionById(profile?.selectedBackgroundId);
  const ownedAvatarIds = new Set(profile?.ownedAvatarIds || [PROFILE_AVATAR_OPTIONS[0].id]);
  const ownedBackgroundIds = new Set(profile?.ownedBackgroundIds || [PROFILE_BACKGROUND_OPTIONS[0].id]);

  const cosmeticSections = [
    {
      slot: 'avatar' as const,
      title: t('profile.avatarTheme'),
      icon: Palette,
      options: PROFILE_AVATAR_OPTIONS,
      ownedIds: ownedAvatarIds,
      selectedId: profile?.selectedAvatarId,
    },
    {
      slot: 'background' as const,
      title: t('profile.backgroundTheme'),
      icon: Brush,
      options: PROFILE_BACKGROUND_OPTIONS,
      ownedIds: ownedBackgroundIds,
      selectedId: profile?.selectedBackgroundId,
    },
  ];

  const profileStatuses: SystemStatusItem[] = [
    {
      id: 'profile-backend-profile',
      source: 'backend',
      state: profileSourceErrors.backendProfile ? 'degraded' : 'healthy',
      severity: profileSourceErrors.backendProfile ? 'warning' : 'info',
      title: 'Backend Profile',
      detail: profileSourceErrors.backendProfile || 'Kullanici adi, bio ve kozmetik secimleri backend profilinden yukleniyor.',
      checkedAt: statusCheckedAt || undefined,
      context: profile?.username ? 'Profil kaydi hazir' : 'Varsayilan profil',
    },
    {
      id: 'profile-backend-stats',
      source: 'backend',
      state: profileSourceErrors.backendStats ? 'degraded' : 'healthy',
      severity: profileSourceErrors.backendStats ? 'warning' : 'info',
      title: 'Backend Stats',
      detail: profileSourceErrors.backendStats || 'Reward ve sosyal istatistikler backend uzerinden aliniyor.',
      checkedAt: statusCheckedAt || undefined,
    },
    {
      ...runtimeStatusItem,
      id: 'profile-backend-sync',
      title: 'Backend Game Sync',
      detail: runtimeStatusItem.state === 'healthy'
        ? 'Backend runtime game authority ile player-profile sync yazimi icin hazir.'
        : runtimeStatusItem.detail,
    },
    {
      id: 'profile-onchain-layer',
      source: 'onchain',
      state: profileSourceErrors.onchainInventory && profileSourceErrors.backendInventory ? 'degraded' : 'healthy',
      severity: profileSourceErrors.onchainInventory && profileSourceErrors.backendInventory ? 'warning' : 'info',
      title: 'Unified Inventory',
      detail:
        profileSourceErrors.onchainInventory && profileSourceErrors.backendInventory
          ? `${profileSourceErrors.backendInventory} ${profileSourceErrors.onchainInventory}`
          : profileSourceErrors.onchainInventory ||
            profileSourceErrors.backendInventory ||
            profileSourceErrors.onchainProfile ||
            'Inventory backend ve on-chain kaynaklari birlestirilerek okunuyor.',
      checkedAt: statusCheckedAt || undefined,
      context:
        profileSourceErrors.onchainInventory && profileSourceErrors.backendInventory
          ? connection.rpcEndpoint.replace(/^https?:\/\//, '')
          : `${totalInventoryCount} item / ${stats?.level ?? 1}. seviye`,
    },
  ];

  if (loading && !profile && !stats && inventory.length === 0) {
    return (
      <>
        <PageShell
          hero={(
            <PageHero
              eyebrow="PLAYER PROFILE"
              title={shortAddress}
              description={t('profile.walletRequiredDesc')}
              accent="from-fuchsia-400/15 via-pink-300/10 to-rose-300/15"
              panelTitle="ACCOUNT SNAPSHOT"
              panelBody="Kimlik, kozmetik secimleri ve backend ile on-chain inventory tek panelde toplanir."
              metrics={[
                { label: 'SOL', value: solBalance.toFixed(2) },
                { label: 'DUAN', value: `${Math.round(tokenBalance)}` },
                { label: 'Items', value: '...' },
              ]}
            />
          )}
        >
          <LoadingStateCard
            title="Profil verileri hazirlaniyor"
            description="Backend profil, reward istatistikleri ve cift-kaynak inventory birlestiriliyor."
          />
          <ContentGridSkeleton count={3} imageClassName="h-28" contentLines={4} />
        </PageShell>
        <NotificationRail
          title="Profil Durum Merkezi"
          description="Burada profil modulu icin backend ve on-chain katmanlarin saglik durumunu gorebilirsin."
          triggerLabel="Profile Status"
          items={profileStatuses}
        />
      </>
    );
  }

  return (
    <>
      <PageShell
        hero={(
          <PageHero
            eyebrow="PLAYER PROFILE"
            title={profile?.username || shortAddress}
            description={profile?.bio || t('profile.walletRequiredDesc')}
            accent="from-fuchsia-400/15 via-pink-300/10 to-rose-300/15"
            panelTitle="ACCOUNT SNAPSHOT"
            panelBody="Kimlik, kozmetik secimleri ve backend ile on-chain inventory tek panelde toplanir."
            metrics={[
              { label: 'SOL', value: solBalance.toFixed(2) },
              { label: 'DUAN', value: `${Math.round(tokenBalance)}` },
              { label: 'Items', value: `${totalInventoryCount}` },
            ]}
          />
        )}
      >
      <div className="relative">
        <div className="h-48 rounded-2xl relative overflow-hidden" style={{ background: selectedBackground.gradient }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.28))]" />
        </div>

        <div className="relative -mt-16 px-4 md:px-6">
          <GlassCard className="p-6 md:p-7">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="relative">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold ring-4 ring-background shadow-xl"
                  style={{ background: selectedAvatar.gradient }}
                >
                  {selectedAvatar.symbol}
                </div>
                {stats && (
                  <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                    {t('profile.level')} {stats.level}
                  </div>
                )}
              </div>

              <div className="flex-1 w-full">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('profile.username')}</label>
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} placeholder={`${t('profile.username')}...`} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('profile.bio')}</label>
                      <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={150} placeholder={`${t('profile.bio')}...`} rows={3} />
                    </div>
                    <p className="text-xs text-muted-foreground">{t('profile.integratedStats')}</p>
                    <Button onClick={() => void handleSave()} className="gap-2" disabled={isSaving}>
                      <Save className="w-4 h-4" />
                      {isSaving ? t('common.loading') : t('common.save')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-2 gap-4">
                      <div>
                        <h1 className="text-2xl font-bold mb-1">{profile?.username || shortAddress}</h1>
                        <p className="text-sm text-muted-foreground font-mono">{shortAddress}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                        <Edit2 className="w-4 h-4" />
                        {t('common.edit')}
                      </Button>
                    </div>
                    {profile?.bio && <p className="text-muted-foreground mb-4">{profile.bio}</p>}

                    {stats && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t('profile.experience')}</span>
                          <span className="font-medium">{stats.xp} / {stats.xpToNextLevel} XP</span>
                        </div>
                        <Progress value={xpProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground">{t('profile.progressRule')}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-5">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  <span className="font-medium">SOL {t('wallet.balance')}</span>
                </div>
                <span className="text-xl font-bold">{solBalance.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-secondary" />
                  <span className="font-medium">DUAN {t('wallet.balance')}</span>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-primary">{formatDuanAmount(tokenBalance)}</div>
                  <div className="text-xs text-muted-foreground">{formatSolAmount(duanToSol(tokenBalance))}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-muted/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-secondary" />
                  <span className="font-medium">{t('profile.rewardVault')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('profile.rewardDuan')}</span>
                  <span className="font-semibold">{formatDuanAmount(stats?.rewardDuanBalance || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">{t('profile.rewardSol')}</span>
                  <span className="font-semibold">{formatSolAmount(stats?.rewardSolBalance || 0)}</span>
                </div>
              </div>
            </div>

            {stats && (
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-5 text-center">
                  <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold">{stats.level}</div>
                  <div className="text-xs text-muted-foreground">{t('profile.level')}</div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-5 text-center">
                  <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{Math.max(stats.totalItems, totalInventoryCount)}</div>
                  <div className="text-xs text-muted-foreground">{t('profile.items')}</div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-secondary/10 to-secondary/5 p-5 text-center">
                  <Trophy className="w-6 h-6 text-secondary mx-auto mb-2" />
                  <div className="text-2xl font-bold">{stats.achievements.length}</div>
                  <div className="text-xs text-muted-foreground">{t('profile.achievements')}</div>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 text-center">
                  <Sparkles className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{stats.totalTrades}</div>
                  <div className="text-xs text-muted-foreground">{t('profile.trades')}</div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <GlassCard className="p-6 md:p-7">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{t('profile.cosmetics')}</h2>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {cosmeticSections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div key={section.slot} className="space-y-3">
                <div className="flex items-center gap-2">
                  <SectionIcon className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold">{section.title}</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {section.options.map((option) => {
                    const owned = section.ownedIds.has(option.id);
                    const selected = section.selectedId === option.id;
                    const actionLabel = selected
                      ? t('profile.selected')
                      : owned
                        ? t('profile.apply')
                        : option.currency === 'duan'
                          ? t('profile.unlockWithDuan')
                          : t('profile.unlockWithSol');

                    return (
                      <div key={option.id} className="rounded-[1.35rem] border border-border/60 bg-background/60 p-4">
                        <div className="mb-4 flex h-24 items-center justify-center rounded-2xl text-2xl font-bold text-white" style={{ background: option.gradient }}>
                          {'symbol' in option ? option.symbol : option.name}
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{option.name}</div>
                            <div className="text-xs text-muted-foreground">{formatCosmeticCost(option.currency, option.price)}</div>
                          </div>
                          <Button
                            size="sm"
                            variant={selected ? 'secondary' : owned ? 'outline' : 'default'}
                            disabled={selected || unlockingId === option.id}
                            onClick={() => void handleUnlockCosmetic(section.slot, option.id)}
                          >
                            {unlockingId === option.id ? t('common.loading') : actionLabel}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inventory">{t('profile.inventory')} ({totalInventoryCount})</TabsTrigger>
          <TabsTrigger value="achievements">{t('profile.achievements')} {stats && `(${stats.achievements.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {inventory.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {inventory.map((inv, index) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <GlassCard hover className="group overflow-hidden">
                    <div className="aspect-square overflow-hidden relative">
                      <ImageWithFallback src={resolveAssetUrl(inv.item.imageUrl)} alt={inv.item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="font-bold">{inv.item.name}</h3>
                        {(inv.quantity ?? 1) > 1 && <span className="text-xs font-semibold text-primary">x{inv.quantity}</span>}
                      </div>
                      <RarityBadge rarity={inv.item.rarity} />
                      <p className="text-xs text-muted-foreground mt-2">{new Date(inv.acquiredAt).toLocaleDateString('tr-TR')}</p>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          ) : (
            loadError ? (
              <MaintenanceStateCard
                title={t('profile.inventory')}
                description={loadError}
                onAction={() => { void loadProfileData(); }}
              />
            ) : (
              <EmptyStateCard
                title={t('profile.inventory')}
                description={loading ? t('common.loading') : t('profile.noInventory')}
                icon={Package}
              />
            )
          )}
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          {stats && stats.achievements.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {stats.achievements.map((achievement, index) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <GlassCard hover className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{achievement.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-bold mb-1">{achievement.name}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{achievement.description}</p>
                        <div className="flex items-center gap-4 text-xs font-medium mb-2">
                          <span>{t('profile.rewardDuan')}: {formatDuanAmount(achievement.rewardDuan || 0)}</span>
                          <span>{t('profile.rewardSol')}: {formatSolAmount(achievement.rewardSol || 0)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('profile.unlocked')} {new Date(achievement.unlockedAt).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          ) : (
            <GlassCard className="p-12 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-bold mb-2">{t('profile.noAchievements')}</h3>
              <p className="text-muted-foreground">{t('profile.noAchievementsDesc')}</p>
            </GlassCard>
          )}
        </TabsContent>
      </Tabs>
      </PageShell>
      {isAdmin ? (
        <NotificationRail
          title="Profil Durum Merkezi"
          description="Burada profil modulu icin backend ve on-chain katmanlarin saglik durumunu gorebilirsin."
          triggerLabel="Profile Status"
          items={profileStatuses}
        />
      ) : null}
    </>
  );
}
