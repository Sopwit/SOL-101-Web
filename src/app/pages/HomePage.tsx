import { Link } from 'react-router';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Coins, MessageSquare, Shield, ShoppingBag, Sparkles, Store, TrendingUp, User, Wallet } from 'lucide-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Button } from '../components/ui/button';
import { MaintenanceStateCard } from '../components/ModuleStateCard';
import { GlassCard } from '../components/GlassCard';
import { useLanguage } from '../contexts/LanguageContext';
import { pageDataCache } from '../lib/pageDataCache';
import { reportError } from '../lib/telemetry';
import { api } from '../services/api';
import { fetchOnchainShopSnapshot } from '../lib/onchain/duanShopClient';

interface PlatformStats {
  totalProfiles: number;
  totalItems: number;
  completedTrades: number;
}

interface HomeTokenInfo {
  symbol: string;
  name: string;
  price: number;
  priceUsd?: number;
  solUsdPrice?: number;
  priceSource?: string;
  livePricing?: boolean;
  totalSupply: number;
  circulatingSupply: number;
  lastUpdated: string;
}

interface HomeRuntimeState {
  cluster: string;
  rpcReachable: boolean;
  programDeployed: boolean;
  shopConfigInitialized: boolean;
}

interface HomeCatalogState {
  itemCount: number;
  status: string;
  code: string;
  missingItemIds: string[];
}

export function HomePage() {
  const { connection } = useConnection();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<PlatformStats>(() => pageDataCache.home.stats ?? { totalProfiles: 0, totalItems: 0, completedTrades: 0 });
  const [tokenInfo, setTokenInfo] = useState<HomeTokenInfo | null>(() => pageDataCache.home.tokenInfo);
  const [runtimeState, setRuntimeState] = useState<HomeRuntimeState | null>(() => pageDataCache.home.runtime);
  const [catalogState, setCatalogState] = useState<HomeCatalogState | null>(() => pageDataCache.home.onchainCatalog);
  const [loading, setLoading] = useState(() => pageDataCache.home.stats === null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async (options?: { silent?: boolean }) => {
      if (!options?.silent && pageDataCache.home.stats === null) {
        setLoading(true);
      }

      try {
        const [statsResponse, tokenResponse, healthResponse, snapshot] = await Promise.all([
          api.getPlatformStats(),
          api.getTokenInfo(),
          api.getHealth(),
          fetchOnchainShopSnapshot(connection),
        ]);

        if (statsResponse.success && statsResponse.data) {
          const nextStats = {
            totalProfiles: statsResponse.data.totalProfiles ?? statsResponse.data.activeUsers,
            totalItems: statsResponse.data.totalItems,
            completedTrades: statsResponse.data.completedTrades,
          };
          setStats(nextStats);
          pageDataCache.home.stats = nextStats;
        }

        if (tokenResponse.success && tokenResponse.data) {
          setTokenInfo(tokenResponse.data);
          pageDataCache.home.tokenInfo = tokenResponse.data;
        }

        if (healthResponse.success && healthResponse.data) {
          const nextRuntime = {
            cluster: healthResponse.data.solana.cluster,
            rpcReachable: healthResponse.data.solana.rpcReachable,
            programDeployed: healthResponse.data.solana.programDeployed,
            shopConfigInitialized: healthResponse.data.solana.shopConfigInitialized,
          };
          setRuntimeState(nextRuntime);
          pageDataCache.home.runtime = nextRuntime;
        }

        const nextCatalog = {
          itemCount: snapshot.items.length,
          status: snapshot.status,
          code: snapshot.code,
          missingItemIds: snapshot.missingItemIds,
        };
        setCatalogState(nextCatalog);
        pageDataCache.home.onchainCatalog = nextCatalog;

        setStatsError(null);
        pageDataCache.home.lastUpdatedAt = Date.now();
      } catch (error) {
        reportError('home:platform-stats', error, 'Platform istatistikleri yuklenemedi');
        setStatsError(error instanceof Error ? error.message : t('common.error'));
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    };

    void loadStats();

    const interval = setInterval(() => {
      void loadStats({ silent: true });
    }, 30000);

    return () => clearInterval(interval);
  }, [connection, t]);

  const sections = [
    {
      icon: MessageSquare,
      title: t('feature.forum.title'),
      description: t('feature.forum.desc'),
      path: '/forum',
      accent: 'from-orange-400 via-amber-300 to-yellow-200',
    },
    {
      icon: ShoppingBag,
      title: t('feature.shop.title'),
      description: t('feature.shop.desc'),
      path: '/shop',
      accent: 'from-cyan-400 via-sky-300 to-teal-200',
    },
    {
      icon: Store,
      title: t('feature.market.title'),
      description: t('feature.market.desc'),
      path: '/market',
      accent: 'from-emerald-400 via-lime-300 to-teal-200',
    },
    {
      icon: User,
      title: t('feature.profile.title'),
      description: t('feature.profile.desc'),
      path: '/profile',
      accent: 'from-fuchsia-400 via-pink-300 to-rose-200',
    },
  ];

  const highlights = [
    {
      icon: TrendingUp,
      title: t('home.liveLayer'),
      description: runtimeState?.rpcReachable ? t('home.liveLayerDesc') : t('home.runtimeLimited'),
    },
    {
      icon: Sparkles,
      title: t('home.economyTitle'),
      description: tokenInfo
        ? `${t('home.tokenPrice')}: ${tokenInfo.price} SOL • ${t('home.tokenPriceUsd')}: ${tokenInfo.priceUsd?.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 4 }) ?? '--'} USD`
        : t('home.economyDesc'),
    },
    {
      icon: Shield,
      title: t('home.identityTitle'),
      description: catalogState
        ? `${t('home.catalogStatus')}: ${catalogState.status} • ${t('home.catalogItems')}: ${catalogState.itemCount}`
        : t('home.identityDesc'),
    },
  ];

  const statCards = [
    { label: t('home.totalProfiles'), value: stats.totalProfiles, icon: User },
    { label: t('home.totalItems'), value: stats.totalItems, icon: ShoppingBag },
    { label: t('home.completedTrades'), value: stats.completedTrades, icon: TrendingUp },
    { label: t('home.catalogItems'), value: catalogState?.itemCount ?? 0, icon: Store },
  ];

  const runtimeCards = [
    {
      label: t('home.networkRuntime'),
      value: runtimeState?.cluster ?? 'devnet',
      detail: runtimeState?.rpcReachable ? t('home.runtimeHealthy') : t('home.runtimeLimited'),
      icon: Shield,
    },
    {
      label: t('home.tokenPrice'),
      value: tokenInfo ? `${tokenInfo.price} SOL` : '--',
      detail: tokenInfo?.livePricing ? t('home.marketReferenceLive') : t('home.marketReferenceFallback'),
      icon: Coins,
    },
    {
      label: t('home.tokenPriceUsd'),
      value: tokenInfo?.priceUsd
        ? `${tokenInfo.priceUsd.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 4 })} USD`
        : '--',
      detail: tokenInfo?.solUsdPrice
        ? `${t('home.solReference')}: ${tokenInfo.solUsdPrice.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 2 })} USD`
        : t('home.economyDesc'),
      icon: Wallet,
    },
  ];

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden px-4 py-16 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.08),transparent)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="container relative z-10 mx-auto">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl"
            >
              <div className="mb-5 inline-flex rounded-full border border-border/60 bg-background/60 px-4 py-1 text-xs font-semibold tracking-[0.24em] text-muted-foreground backdrop-blur">
                {t('home.kicker')}
              </div>
              <h1 className="mb-5 text-5xl font-black tracking-[0.08em] text-foreground md:text-7xl">
                {t('home.title')}
              </h1>
              <p className="mb-8 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                {t('home.subtitle')}
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link to="/shop">
                  <Button size="lg" className="gap-2">
                    {t('home.exploreShop')}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/forum">
                  <Button size="lg" variant="outline">
                    {t('home.joinForum')}
                  </Button>
                </Link>
                <Link to="/market">
                  <Button size="lg" variant="ghost" className="justify-start">
                    {t('home.openMarket')}
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
            >
              <GlassCard className="relative overflow-hidden border-primary/20 p-6 md:p-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.16),transparent_30%)]" />
                <div className="relative space-y-5">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">{t('home.sectionsTitle')}</p>
                    <h2 className="mt-3 text-2xl font-bold">{t('home.sectionsDesc')}</h2>
                  </div>
                  <div className="grid gap-3">
                    {sections.map((section) => (
                      <Link key={section.path} to={section.path}>
                        <div className="group flex items-center gap-4 rounded-2xl border border-border/50 bg-background/50 p-4 transition-colors hover:border-primary/40">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${section.accent} text-slate-950`}>
                            <section.icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold group-hover:text-primary">{section.title}</p>
                            <p className="text-sm text-muted-foreground">{section.description}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-6 md:py-10">
        {statsError && !loading ? (
          <MaintenanceStateCard
            title={t('home.serviceLimitedTitle')}
            description={statsError}
            onAction={() => window.location.reload()}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.2 + index * 0.08 }}
              >
                <GlassCard className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-4xl font-black text-foreground">
                    {loading ? '...' : stat.value.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US')}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 py-6 md:py-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {runtimeCards.map((card) => (
            <GlassCard key={card.label} className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
                <card.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-2xl font-black text-foreground">{card.value}</div>
              <p className="mt-2 text-sm text-muted-foreground">{card.detail}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-14">
        <div className="mb-8 max-w-2xl">
          <h2 className="mb-3 text-3xl font-bold">{t('home.features')}</h2>
          <p className="text-muted-foreground">{t('home.ctaDesc')}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {highlights.map((highlight, index) => (
            <motion.div
              key={highlight.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 + index * 0.1 }}
            >
              <GlassCard className="h-full p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <highlight.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold">{highlight.title}</h3>
                <p className="text-muted-foreground">{highlight.description}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <GlassCard className="overflow-hidden border-primary/20 p-8 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t('home.ctaTitle')}
              </p>
              <h2 className="mb-4 text-3xl font-bold">{t('home.liveLayer')}</h2>
              <p className="max-w-2xl text-muted-foreground">{t('home.updatedSummary')}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link to="/profile">
                <Button size="lg" className="w-full">
                  {t('nav.profile')}
                </Button>
              </Link>
              <Link to="/market">
                <Button size="lg" variant="outline" className="w-full">
                  {t('nav.market')}
                </Button>
              </Link>
            </div>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
