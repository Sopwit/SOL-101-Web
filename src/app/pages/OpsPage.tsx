import { useEffect, useMemo, useState } from 'react';
import { Database, Search, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { GlassCard } from '../components/GlassCard';
import { NotificationRail } from '../components/NotificationRail';
import { PageHero } from '../components/PageHero';
import { PageShell } from '../components/PageShell';
import { ContentGridSkeleton } from '../components/ContentGridSkeleton';
import { EmptyStateCard, LoadingStateCard, MaintenanceStateCard } from '../components/ModuleStateCard';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useLanguage } from '../contexts/LanguageContext';
import { createWalletAuth } from '../lib/walletAuth';
import { api, normalizeHealthResponse, type AdminAuditLog, type AdminOverviewResponse, type AdminSession, type AdminUserRecord, type ApiHealthResponse } from '../services/api';
import { fetchOnchainShopSnapshot, type OnchainShopSnapshot } from '../lib/onchain/duanShopClient';
import type { ForumComment, ForumPost, MarketListing, SystemStatusItem } from '../types';
import { reportError } from '../lib/telemetry';

interface PlatformStats {
  activeUsers: number;
  totalItems: number;
  completedTrades: number;
  lastUpdated?: string;
}

interface AdminTradeRecord {
  id: string;
  listingId: string;
  buyerWallet: string;
  sellerWallet?: string;
  status: string;
  createdAt: string;
  txSignature?: string | null;
  marketMode?: string;
}

const ADMIN_SESSION_STORAGE_KEY = 'duan-admin-session';

type ConfirmAction =
  | { kind: 'delete-post'; postId: string; label: string }
  | { kind: 'delete-comment'; postId: string; commentId: string; label: string }
  | { kind: 'cancel-listing'; listingId: string; label: string }
  | { kind: 'update-trade'; tradeId: string; status: 'pending' | 'accepted' | 'completed' | 'cancelled'; label: string };

function formatDateTime(value?: string) {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString('tr-TR');
}

function shortWallet(value?: string | null) {
  if (!value) {
    return 'N/A';
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function OpsPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, signMessage } = wallet;
  const { walletAddress } = useAdminAccess();
  const { t } = useLanguage();
  const [health, setHealth] = useState<ApiHealthResponse | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [shopSnapshot, setShopSnapshot] = useState<OnchainShopSnapshot | null>(null);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [forumComments, setForumComments] = useState<Array<ForumComment & { postTitle?: string }>>([]);
  const [marketListings, setMarketListings] = useState<MarketListing[]>([]);
  const [marketTrades, setMarketTrades] = useState<AdminTradeRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as AdminSession;
      if (!parsed.token || !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
        window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserWallet, setSelectedUserWallet] = useState<string | null>(null);
  const [tradeStatusFilter, setTradeStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'completed' | 'cancelled'>('all');
  const [auditFilter, setAuditFilter] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actingPostId, setActingPostId] = useState<string | null>(null);
  const [actingCommentId, setActingCommentId] = useState<string | null>(null);
  const [actingListingId, setActingListingId] = useState<string | null>(null);
  const [actingTradeId, setActingTradeId] = useState<string | null>(null);

  const persistAdminSession = (session: AdminSession | null) => {
    setAdminSession(session);
    if (typeof window === 'undefined') {
      return;
    }

    if (!session) {
      window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
  };

  const ensureAdminSession = async () => {
    if (adminSession && new Date(adminSession.expiresAt).getTime() > Date.now()) {
      return adminSession;
    }

    if (!publicKey || !signMessage) {
      throw new Error('Admin oturumu icin cüzdan imzasi gerekiyor.');
    }

    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'admin:session');
    if (!walletAuth) {
      throw new Error('Admin oturumu baslatilamadi.');
    }

    const response = await api.createAdminSession(walletAuth);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Admin session olusturulamadi.');
    }

    persistAdminSession(response.data);
    return response.data;
  };

  const loadDashboard = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const [healthResponse, statsResponse, nextSnapshot] = await Promise.all([
        api.getHealth(),
        api.getPlatformStats(),
        fetchOnchainShopSnapshot(connection),
      ]);

      setHealth(healthResponse.success ? normalizeHealthResponse(healthResponse.data) : null);
      setStats(statsResponse.success ? statsResponse.data ?? null : null);
      setShopSnapshot(nextSnapshot);

      if (publicKey && signMessage) {
        const session = await ensureAdminSession();
        const [overviewResponse, usersResponse, postsResponse, commentsResponse, listingsResponse, tradesResponse, logsResponse] = await Promise.all([
          api.getAdminOverview(session.token),
          api.getAdminUsers(session.token),
          api.getAdminForumPosts(session.token),
          api.getAdminForumComments(session.token),
          api.getAdminMarketListings(session.token),
          api.getAdminMarketTrades(session.token),
          api.getAdminAuditLogs(session.token),
        ]);

        setOverview(overviewResponse.success ? overviewResponse.data ?? null : null);
        setAdminUsers(usersResponse.success ? usersResponse.data ?? [] : []);
        setForumPosts(postsResponse.success ? postsResponse.data ?? [] : []);
        setForumComments(commentsResponse.success ? commentsResponse.data ?? [] : []);
        setMarketListings(listingsResponse.success ? listingsResponse.data ?? [] : []);
        setMarketTrades(tradesResponse.success ? tradesResponse.data ?? [] : []);
        setAuditLogs(logsResponse.success ? logsResponse.data ?? [] : []);
      }

      const nextError = !healthResponse.success
        ? healthResponse.error || 'Backend health verisi alinamadi.'
        : null;
      setError(nextError);
    } catch (caughtError) {
      reportError('ops:dashboard', caughtError, 'Ops dashboard verisi yuklenemedi');
      setError(caughtError instanceof Error ? caughtError.message : 'Ops dashboard verisi yuklenemedi.');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadDashboard();

    const intervalId = window.setInterval(() => {
      void loadDashboard({ silent: true });
    }, 30_000);

    const handleFocus = () => {
      void loadDashboard({ silent: true });
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [connection, publicKey, signMessage]);

  const statusItems = useMemo<SystemStatusItem[]>(() => {
    const items: SystemStatusItem[] = [];

    if (health) {
      items.push({
        id: 'ops-backend',
        source: 'backend',
        state: health.database.connected ? 'healthy' : 'offline',
        severity: health.database.connected ? 'info' : 'error',
        title: 'Backend Database',
        detail: health.database.connected
          ? 'KV store ve edge function saglikli calisiyor.'
          : health.database.error || 'Database tarafina erisilemiyor.',
        checkedAt: new Date(health.timestamp).toLocaleTimeString('tr-TR'),
        context: health.database.table,
      });

      items.push({
        id: 'ops-runtime',
        source: 'backend',
        state: health.solana.playerProfileSyncReady ? 'healthy' : 'degraded',
        severity: health.solana.playerProfileSyncReady ? 'info' : 'warning',
        title: 'Game Authority Runtime',
        detail: health.solana.playerProfileSyncReady
          ? 'Backend runtime game authority ile on-chain profile sync yazimi icin hazir.'
          : health.solana.providerError || health.solana.rpcError || 'Authority sync katmani kisitli calisiyor.',
        checkedAt: new Date(health.timestamp).toLocaleTimeString('tr-TR'),
        context: health.solana.rpcUrl.replace(/^https?:\/\//, ''),
      });
    }

    if (shopSnapshot) {
      items.push({
        id: 'ops-shop',
        source: 'onchain',
        state: shopSnapshot.status,
        severity: shopSnapshot.status === 'healthy' ? 'info' : shopSnapshot.status === 'degraded' ? 'warning' : 'error',
        title: 'On-Chain Shop Catalog',
        detail: shopSnapshot.message,
        context: `${shopSnapshot.items.length} aktif item`,
      });
    }

    if (overview) {
      items.push({
        id: 'ops-admin-feed',
        source: 'backend',
        state: 'healthy',
        severity: 'info',
        title: 'Admin Feed',
        detail: 'Admin endpointleri aktif ve veri sagliyor.',
        checkedAt: formatDateTime(overview.checkedAt),
        context: `${overview.summary.users} kullanici`,
      });
    }

    return items;
  }, [health, overview, shopSnapshot]);

  const metrics = [
    { label: 'Users', value: `${overview?.summary.users ?? stats?.activeUsers ?? 0}` },
    { label: 'Posts', value: `${overview?.summary.posts ?? forumPosts.length}` },
    { label: 'Listings', value: `${overview?.summary.activeListings ?? marketListings.filter((entry) => entry.status === 'active').length}` },
  ];

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return adminUsers;
    }

    return adminUsers.filter((entry) => {
      const username = entry.profile.username?.toLowerCase() ?? '';
      const walletValue = entry.profile.walletAddress.toLowerCase();
      return username.includes(query) || walletValue.includes(query);
    });
  }, [adminUsers, searchQuery]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return forumPosts;
    }

    return forumPosts.filter((entry) =>
      entry.title.toLowerCase().includes(query) ||
      entry.walletAddress.toLowerCase().includes(query) ||
      entry.content.toLowerCase().includes(query),
    );
  }, [forumPosts, searchQuery]);

  const filteredListings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return marketListings;
    }

    return marketListings.filter((entry) =>
      entry.sellerWallet.toLowerCase().includes(query) ||
      entry.offeredItem.name.toLowerCase().includes(query) ||
      (entry.note ?? '').toLowerCase().includes(query),
    );
  }, [marketListings, searchQuery]);

  const filteredComments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return forumComments;
    }

    return forumComments.filter((entry) =>
      entry.content.toLowerCase().includes(query) ||
      entry.walletAddress.toLowerCase().includes(query) ||
      (entry.postTitle ?? '').toLowerCase().includes(query),
    );
  }, [forumComments, searchQuery]);

  const filteredTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return marketTrades.filter((entry) => {
      const matchesSearch = !query
        || entry.id.toLowerCase().includes(query)
        || entry.buyerWallet.toLowerCase().includes(query)
        || entry.listingId.toLowerCase().includes(query);
      const matchesStatus = tradeStatusFilter === 'all' || entry.status === tradeStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [marketTrades, searchQuery, tradeStatusFilter]);

  const filteredAuditLogs = useMemo(() => {
    const query = auditFilter.trim().toLowerCase();
    if (!query) {
      return auditLogs;
    }

    return auditLogs.filter((entry) =>
      entry.action.toLowerCase().includes(query) ||
      entry.walletAddress.toLowerCase().includes(query) ||
      JSON.stringify(entry.metadata).toLowerCase().includes(query),
    );
  }, [auditFilter, auditLogs]);

  const selectedUser = useMemo(
    () => adminUsers.find((entry) => entry.profile.walletAddress === selectedUserWallet) ?? filteredUsers[0] ?? null,
    [adminUsers, filteredUsers, selectedUserWallet],
  );

  const handleDeletePost = async (postId: string) => {
    setActingPostId(postId);
    try {
      const session = await ensureAdminSession();
      const response = await api.adminDeletePost(postId, session.token);
      if (!response.success) {
        throw new Error(response.error || 'Post silinemedi');
      }

      setForumPosts((current) => current.filter((entry) => entry.id !== postId));
      toast.success('Forum postu admin panelinden silindi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Post silinemedi');
    } finally {
      setActingPostId(null);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    setActingListingId(listingId);
    try {
      const session = await ensureAdminSession();
      const response = await api.adminCancelListing(listingId, session.token);
      if (!response.success) {
        throw new Error(response.error || 'Listing iptal edilemedi');
      }

      setMarketListings((current) =>
        current.map((entry) => (entry.id === listingId ? { ...entry, status: 'cancelled' } : entry)),
      );
      toast.success('Listing admin panelinden iptal edildi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Listing iptal edilemedi');
    } finally {
      setActingListingId(null);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    setActingCommentId(commentId);
    try {
      const session = await ensureAdminSession();
      const response = await api.adminDeleteComment(postId, commentId, session.token);
      if (!response.success) {
        throw new Error(response.error || 'Yorum silinemedi');
      }

      setForumComments((current) => current.filter((entry) => entry.id !== commentId));
      setForumPosts((current) => current.map((entry) => (
        entry.id === postId
          ? { ...entry, commentCount: Math.max(0, entry.commentCount - 1) }
          : entry
      )));
      toast.success('Yorum admin panelinden silindi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yorum silinemedi');
    } finally {
      setActingCommentId(null);
    }
  };

  const handleTradeStatusUpdate = async (
    tradeId: string,
    status: 'pending' | 'accepted' | 'completed' | 'cancelled',
  ) => {
    setActingTradeId(tradeId);
    try {
      const session = await ensureAdminSession();
      const response = await api.adminUpdateTradeStatus(tradeId, status, session.token);
      if (!response.success) {
        throw new Error(response.error || 'Trade durumu guncellenemedi');
      }

      setMarketTrades((current) => current.map((entry) => (
        entry.id === tradeId
          ? { ...entry, status }
          : entry
      )));
      toast.success(`Trade durumu ${status} olarak guncellendi.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Trade durumu guncellenemedi');
    } finally {
      setActingTradeId(null);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) {
      return;
    }

    const currentAction = confirmAction;
    setConfirmAction(null);

    if (currentAction.kind === 'delete-post') {
      await handleDeletePost(currentAction.postId);
      return;
    }

    if (currentAction.kind === 'delete-comment') {
      await handleDeleteComment(currentAction.postId, currentAction.commentId);
      return;
    }

    if (currentAction.kind === 'cancel-listing') {
      await handleCancelListing(currentAction.listingId);
      return;
    }

    await handleTradeStatusUpdate(currentAction.tradeId, currentAction.status);
  };

  const exportAuditLogs = () => {
    const payload = JSON.stringify(filteredAuditLogs, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `duan-admin-audit-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
      toast.success('Audit log dosyasi indirildi.');
  };

  return (
    <>
      <PageShell
        hero={(
          <PageHero
            eyebrow="ADMIN CONTROL"
            title={t('admin.heroTitle')}
            description={t('admin.heroDesc')}
            accent="from-cyan-400/15 via-emerald-300/10 to-amber-300/15"
            panelTitle="PRIVATE SIGNALS"
            panelBody={t('admin.heroBody')}
            metrics={metrics}
          />
        )}
      >
        {loading && !health && !shopSnapshot ? (
          <LoadingStateCard
            title="Admin paneli hazirlaniyor"
            description="Backend, devnet, katalog ve moderasyon verileri toplanıyor."
          />
        ) : error && !health ? (
          <MaintenanceStateCard
            title="Admin paneli gecici olarak kisitli"
            description={error}
            onAction={() => { void loadDashboard(); }}
          />
        ) : null}

        <GlassCard className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin Search</div>
              <div className="text-lg font-bold">{t('admin.searchTitle')}</div>
            </div>
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('admin.searchPlaceholder')}
              />
            </div>
          </div>
        </GlassCard>

        <Tabs defaultValue="overview" className="gap-8">
          <TabsList className="w-full flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="overview" className="h-auto flex-none rounded-[1.2rem] border border-border/60 bg-background/70 px-4 py-3">{t('admin.tabs.overview')}</TabsTrigger>
            <TabsTrigger value="system" className="h-auto flex-none rounded-[1.2rem] border border-border/60 bg-background/70 px-4 py-3">{t('admin.tabs.system')}</TabsTrigger>
            <TabsTrigger value="economy" className="h-auto flex-none rounded-[1.2rem] border border-border/60 bg-background/70 px-4 py-3">{t('admin.tabs.economy')}</TabsTrigger>
            <TabsTrigger value="users" className="h-auto flex-none rounded-[1.2rem] border border-border/60 bg-background/70 px-4 py-3">{t('admin.tabs.users')}</TabsTrigger>
            <TabsTrigger value="moderation" className="h-auto flex-none rounded-[1.2rem] border border-border/60 bg-background/70 px-4 py-3">{t('admin.tabs.moderation')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              <GlassCard className="p-6">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Users</div>
                <div className="text-3xl font-black">{overview?.summary.users ?? adminUsers.length}</div>
                <p className="mt-2 text-sm text-muted-foreground">Kayitli profil sayisi</p>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Posts</div>
                <div className="text-3xl font-black">{overview?.summary.posts ?? forumPosts.length}</div>
                <p className="mt-2 text-sm text-muted-foreground">Forum icerik hacmi</p>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Listings</div>
                <div className="text-3xl font-black">{overview?.summary.activeListings ?? 0}</div>
                <p className="mt-2 text-sm text-muted-foreground">Aktif market listing sayisi</p>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pending Trades</div>
                <div className="text-3xl font-black">{overview?.summary.pendingTrades ?? 0}</div>
                <p className="mt-2 text-sm text-muted-foreground">Bekleyen trade intent sayisi</p>
              </GlassCard>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <GlassCard className="p-6 xl:col-span-2">
                <div className="mb-4 flex items-center gap-3">
                  <Database className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-black">Son Aktivite</h3>
                </div>
                <div className="space-y-3">
                  {overview?.recentPosts?.length ? overview.recentPosts.map((post) => (
                    <div key={post.id} className="rounded-2xl border border-border/50 bg-background/55 px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold">{post.title}</div>
                          <div className="text-sm text-muted-foreground">{post.username || shortWallet(post.walletAddress)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(post.createdAt)}</div>
                      </div>
                    </div>
                  )) : (
                    <EmptyStateCard title="Aktivite bulunamadi" description="Overview akisi icin henuz son aktivite verisi yok." />
                  )}
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-black">Admin Scope</h3>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>Aktif admin cüzdan: {walletAddress ?? 'Bagli degil'}</div>
                  <div>Son kontrol: {formatDateTime(overview?.checkedAt ?? health?.timestamp)}</div>
                  <div>Teknik rail sadece admin panelindedir.</div>
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <GlassCard className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-black">Runtime Readiness</h3>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>Backend: {health?.status === 'ok' ? 'Healthy' : 'Check Required'}</div>
                  <div>RPC: {health?.solana.rpcReachable ? 'Ulasilabilir' : 'Sinirli'}</div>
                  <div>Program: {health?.solana.programDeployed ? 'Deploy edildi' : 'Dogrulanamadi'}</div>
                  <div>Shop Config: {health?.solana.shopConfigInitialized ? 'Hazir' : 'Eksik'}</div>
                  <div>Authority: {health?.solana.playerProfileSyncReady ? 'Hazir' : 'Kisitli'}</div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Database className="h-5 w-5 text-primary" />
                  <h3 className="text-xl font-black">Infrastructure Notes</h3>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>RPC URL: {health?.solana.rpcUrl ?? connection.rpcEndpoint}</div>
                  <div>Program ID: {health?.solana.programId ?? 'N/A'}</div>
                  <div>Shop Config PDA: {health?.solana.shopConfig ?? 'N/A'}</div>
                  <div>Database table: {health?.database.table ?? 'N/A'}</div>
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          <TabsContent value="economy" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              <GlassCard className="p-6">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Token Price</div>
                <div className="text-3xl font-black">{overview?.tokenInfo?.price ?? 0}</div>
                <p className="mt-2 text-sm text-muted-foreground">DUAN / SOL oranı</p>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Supply</div>
                <div className="text-3xl font-black">{overview?.tokenInfo?.circulatingSupply ?? 0}</div>
                <p className="mt-2 text-sm text-muted-foreground">Dolasimdaki arz</p>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Catalog Items</div>
                <div className="text-3xl font-black">{shopSnapshot?.items.length ?? 0}</div>
                <p className="mt-2 text-sm text-muted-foreground">On-chain katalog sayisi</p>
              </GlassCard>
              <GlassCard className="p-6">
                <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trades</div>
                <div className="text-3xl font-black">{marketTrades.length}</div>
                <p className="mt-2 text-sm text-muted-foreground">Admin gorunen trade kaydi</p>
              </GlassCard>
            </div>

            {filteredTrades.length ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {filteredTrades.slice(0, 6).map((trade) => (
                  <GlassCard key={trade.id} className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold">{trade.id}</div>
                        <div className="text-sm text-muted-foreground">{shortWallet(trade.buyerWallet)}</div>
                      </div>
                      <Badge variant="outline">{trade.status}</Badge>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      <div>Listing: {trade.listingId}</div>
                      <div>Mode: {trade.marketMode ?? 'backend'}</div>
                      <div>Date: {formatDateTime(trade.createdAt)}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(['accepted', 'completed', 'cancelled'] as const).map((nextStatus) => (
                        <Button
                          key={nextStatus}
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmAction({
                            kind: 'update-trade',
                            tradeId: trade.id,
                            status: nextStatus,
                            label: `${trade.id} kaydini ${nextStatus} durumuna cek`,
                          })}
                          disabled={actingTradeId === trade.id || trade.status === nextStatus}
                        >
                          {nextStatus}
                        </Button>
                      ))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : (
              <EmptyStateCard title="Trade akisi bos" description="Admin ekonomi görünümünde listelenecek trade bulunmuyor." />
            )}
            <GlassCard className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trade Filter</div>
                  <div className="text-lg font-bold">Duruma gore filtrele</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'pending', 'accepted', 'completed', 'cancelled'] as const).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={tradeStatusFilter === status ? 'default' : 'outline'}
                      onClick={() => setTradeStatusFilter(status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {loading && adminUsers.length === 0 ? (
              <ContentGridSkeleton count={6} />
            ) : filteredUsers.length ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
                <div className="grid grid-cols-1 gap-4">
                {filteredUsers.map((entry) => (
                  <GlassCard
                    key={entry.profile.walletAddress}
                    className={`cursor-pointer p-5 ${selectedUser?.profile.walletAddress === entry.profile.walletAddress ? 'border-primary/60' : ''}`}
                    onClick={() => setSelectedUserWallet(entry.profile.walletAddress)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-bold">{entry.profile.username || shortWallet(entry.profile.walletAddress)}</div>
                        <div className="text-sm text-muted-foreground">{entry.profile.walletAddress}</div>
                      </div>
                      <Badge variant="outline">Lv. {entry.stats.level}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                      <div>Posts: {entry.stats.totalPosts}</div>
                      <div>Items: {entry.stats.totalItems}</div>
                      <div>Trades: {entry.stats.totalTrades}</div>
                      <div>XP: {entry.stats.xp}</div>
                    </div>
                  </GlassCard>
                ))}
                </div>
                <GlassCard className="p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-black">{t('admin.userDetail')}</h3>
                  </div>
                  {selectedUser ? (
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div>Kullanici: <span className="font-semibold text-foreground">{selectedUser.profile.username || 'Isimsiz'}</span></div>
                      <div>Wallet: <span className="break-all">{selectedUser.profile.walletAddress}</span></div>
                      <div>Bio: {selectedUser.profile.bio || 'Bos'}</div>
                      <div>Level: {selectedUser.stats.level}</div>
                      <div>Posts: {selectedUser.stats.totalPosts}</div>
                      <div>Items: {selectedUser.stats.totalItems}</div>
                      <div>Trades: {selectedUser.stats.totalTrades}</div>
                      <div>Reward DUAN: {selectedUser.stats.rewardDuanBalance}</div>
                      <div>Reward SOL: {selectedUser.stats.rewardSolBalance}</div>
                    </div>
                  ) : (
                    <EmptyStateCard title="Kullanici sec" description="Sag panelde detaylarini gormek icin bir kullanici sec." />
                  )}
                </GlassCard>
              </div>
            ) : (
              <EmptyStateCard title="Kullanici bulunamadi" description="Arama kriterine uyan admin user kaydi yok." />
            )}
          </TabsContent>

          <TabsContent value="moderation" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <GlassCard className="p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Forum Moderation</div>
                    <div className="text-xl font-black">Son postlar</div>
                  </div>
                  <Badge variant="outline">{filteredPosts.length}</Badge>
                </div>
                <div className="space-y-3">
                  {filteredPosts.slice(0, 8).map((post) => (
                    <div key={post.id} className="rounded-2xl border border-border/50 bg-background/55 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">{post.title}</div>
                          <div className="text-sm text-muted-foreground">{shortWallet(post.walletAddress)} • {formatDateTime(post.createdAt)}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmAction({
                            kind: 'delete-post',
                            postId: post.id,
                            label: `"${post.title}" postunu kalici olarak sil`,
                          })}
                          disabled={actingPostId === post.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          Sil
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredPosts.length === 0 ? (
                    <EmptyStateCard title="Post bulunamadi" description="Moderasyon listesinde post görünmüyor." />
                  ) : null}
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Market Moderation</div>
                    <div className="text-xl font-black">Listing akisı</div>
                  </div>
                  <Badge variant="outline">{filteredListings.length}</Badge>
                </div>
                <div className="space-y-3">
                  {filteredListings.slice(0, 8).map((listing) => (
                    <div key={listing.id} className="rounded-2xl border border-border/50 bg-background/55 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">{listing.offeredItem.name}</div>
                          <div className="text-sm text-muted-foreground">{shortWallet(listing.sellerWallet)} • {formatDateTime(listing.createdAt)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{listing.status}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmAction({
                              kind: 'cancel-listing',
                              listingId: listing.id,
                              label: `${listing.offeredItem.name} listing kaydini iptal et`,
                            })}
                            disabled={actingListingId === listing.id || listing.status !== 'active'}
                          >
                            <Trash2 className="h-4 w-4" />
                            Iptal
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredListings.length === 0 ? (
                    <EmptyStateCard title="Listing bulunamadi" description="Moderasyon listesinde listing görünmüyor." />
                  ) : null}
                </div>
              </GlassCard>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <GlassCard className="p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Comment Moderation</div>
                    <div className="text-xl font-black">Son yorumlar</div>
                  </div>
                  <Badge variant="outline">{filteredComments.length}</Badge>
                </div>
                <div className="space-y-3">
                  {filteredComments.slice(0, 8).map((comment) => (
                    <div key={comment.id} className="rounded-2xl border border-border/50 bg-background/55 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">{comment.postTitle || comment.postId}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{comment.content}</div>
                          <div className="mt-2 text-xs text-muted-foreground">{shortWallet(comment.walletAddress)} • {formatDateTime(comment.createdAt)}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmAction({
                            kind: 'delete-comment',
                            postId: comment.postId,
                            commentId: comment.id,
                            label: `${comment.postTitle || comment.postId} altindaki yorumu sil`,
                          })}
                          disabled={actingCommentId === comment.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          Sil
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredComments.length === 0 ? (
                    <EmptyStateCard title="Yorum bulunamadi" description="Moderasyon listesinde yorum görünmüyor." />
                  ) : null}
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Audit Log</div>
                    <div className="text-xl font-black">{t('admin.auditHistory')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{filteredAuditLogs.length}</Badge>
                    <Button size="sm" variant="outline" onClick={exportAuditLogs}>{t('common.export')}</Button>
                  </div>
                </div>
                <Input
                  value={auditFilter}
                  onChange={(event) => setAuditFilter(event.target.value)}
                  placeholder="Aksiyon, wallet veya metadata icinde ara"
                  className="mb-4"
                />
                <div className="space-y-3">
                  {filteredAuditLogs.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-border/50 bg-background/55 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold">{entry.action}</div>
                          <div className="text-sm text-muted-foreground">{shortWallet(entry.walletAddress)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                  {filteredAuditLogs.length === 0 ? (
                    <EmptyStateCard title="Audit log bos" description="Admin aksiyon gecmisi olustukca burada görünür." />
                  ) : null}
                </div>
              </GlassCard>
            </div>
          </TabsContent>
        </Tabs>
      </PageShell>
      <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.confirmTitle')}</DialogTitle>
            <DialogDescription>
              {confirmAction?.label ?? t('admin.confirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => void executeConfirmedAction()}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NotificationRail
        title="Admin Durum Merkezi"
        description="Tum teknik uyarilar ve runtime sinyalleri yalnizca bu admin panelindeki yan barda gosterilir."
        triggerLabel="Admin Status"
        items={statusItems}
      />
    </>
  );
}
