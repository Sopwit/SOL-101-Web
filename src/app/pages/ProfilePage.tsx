import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, Sparkles, Edit2, Save, Trophy, TrendingUp, Package } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { RarityBadge } from '../components/RarityBadge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { createWalletAuth } from '../lib/walletAuth';
import { useStore } from '../store';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import type { InventoryItem } from '../types';

interface ProfileStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalPosts: number;
  totalItems: number;
  totalTrades: number;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    unlockedAt: string;
  }>;
}

export function ProfilePage() {
  const { connected, publicKey, signMessage } = useWallet();
  const { t } = useLanguage();
  const { user, solBalance, tokenBalance } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const normalizeInventory = (items: InventoryItem[] | undefined): InventoryItem[] =>
    (items || []).filter((item): item is InventoryItem => Boolean(item?.item?.id && item?.item?.name));

  const loadProfileData = async () => {
    if (!publicKey) return;

    setLoading(true);
    try {
      const walletAddress = publicKey.toBase58();

      const [statsResponse, profileResponse, inventoryResponse] = await Promise.all([
        api.getProfileStats(walletAddress),
        api.getProfile(walletAddress),
        api.getInventory(walletAddress),
      ]);

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      if (profileResponse.success && profileResponse.data) {
        setUsername(profileResponse.data.username || '');
        setBio(profileResponse.data.bio || '');
      }

      if (inventoryResponse.success && inventoryResponse.data) {
        setInventory(normalizeInventory(inventoryResponse.data));
      } else {
        setInventory([]);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      loadProfileData();
    }
  }, [connected, publicKey]);

  const handleSave = async () => {
    if (!publicKey) return;
    const walletAddress = publicKey.toBase58();
    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'profile:update');
    if (!walletAuth) return;
    try {
        const response = await api.updateProfile(walletAddress, { username, bio }, walletAuth);
      if (response.success) {
        setIsEditing(false);
        await loadProfileData();
        toast.success(t('common.success') + '!');
      } else {
        toast.error(response.error || t('common.error'));
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(t('common.error'));
    }
  };

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-20">
        <GlassCard className="p-12 text-center">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">{t('profile.walletRequired')}</h2>
          <p className="text-muted-foreground mb-6">
            {t('profile.walletRequiredDesc')}
          </p>
          <Button>{t('profile.connectWallet')}</Button>
        </GlassCard>
      </div>
    );
  }

  const walletAddress = publicKey?.toBase58() || '';
  const shortAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
  const xpProgress = stats ? (stats.xp / stats.xpToNextLevel) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="relative mb-8">
        <div className="h-48 bg-gradient-to-br from-primary via-secondary to-primary rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />
        </div>

        <div className="relative px-6 -mt-16">
          <GlassCard className="p-6">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-bold ring-4 ring-background">
                  {username?.[0] || 'A'}
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
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        maxLength={20}
                        placeholder={t('profile.username') + '...'}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">{t('profile.bio')}</label>
                      <Textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={150}
                        placeholder={t('profile.bio') + '...'}
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleSave} className="gap-2">
                      <Save className="w-4 h-4" />
                      {t('common.save')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h1 className="text-2xl font-bold mb-1">{username || shortAddress}</h1>
                        <p className="text-sm text-muted-foreground font-mono">{shortAddress}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                        <Edit2 className="w-4 h-4" />
                        {t('common.edit')}
                      </Button>
                    </div>
                    {bio && (
                      <p className="text-muted-foreground mb-4">{bio}</p>
                    )}

                    {/* XP Progress */}
                    {stats && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t('profile.experience')}</span>
                          <span className="font-medium">
                            {stats.xp} / {stats.xpToNextLevel} XP
                          </span>
                        </div>
                        <Progress value={xpProgress} className="h-2" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  <span className="font-medium">SOL {t('wallet.balance')}</span>
                </div>
                <span className="text-xl font-bold">{solBalance.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-secondary" />
                  <span className="font-medium">Token {t('wallet.balance')}</span>
                </div>
                <span className="text-xl font-bold text-primary">{tokenBalance}</span>
              </div>
            </div>

            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold">{stats.level}</div>
                  <div className="text-xs text-muted-foreground">{t('profile.level')}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg">
                  <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{stats.totalItems}</div>
                  <div className="text-xs text-muted-foreground">{t('profile.items')}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg">
                  <Trophy className="w-6 h-6 text-secondary mx-auto mb-2" />
                  <div className="text-2xl font-bold">{stats.achievements.length}</div>
                  <div className="text-xs text-muted-foreground">{t('profile.achievements')}</div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inventory">{t('profile.inventory')} ({inventory.length})</TabsTrigger>
          <TabsTrigger value="achievements">{t('profile.achievements')} {stats && `(${stats.achievements.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {inventory.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {inventory.map((inv, index) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <GlassCard hover className="overflow-hidden group">
                  <div className="aspect-square overflow-hidden relative">
                    <img
                      src={inv.item.imageUrl}
                      alt={inv.item.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold mb-2">{inv.item.name}</h3>
                    <RarityBadge rarity={inv.item.rarity} />
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(inv.acquiredAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
              ))}
            </div>
          ) : (
            <GlassCard className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-bold mb-2">{t('profile.inventory')}</h3>
              <p className="text-muted-foreground">
                {loading ? t('common.loading') : 'Envanterde henuz Supabase uzerinden gelen item bulunmuyor.'}
              </p>
            </GlassCard>
          )}
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          {stats && stats.achievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.achievements.map((achievement, index) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <GlassCard hover className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{achievement.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-bold mb-1">{achievement.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {achievement.description}
                        </p>
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
              <p className="text-muted-foreground">
                {t('profile.noAchievementsDesc')}
              </p>
            </GlassCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
