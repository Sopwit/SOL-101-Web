import { Link } from 'react-router';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ShoppingBag, MessageSquare, Store, User, TrendingUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/GlassCard';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../services/api';

interface PlatformStats {
  activeUsers: number;
  totalItems: number;
  completedTrades: number;
}

export function HomePage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<PlatformStats>({ activeUsers: 0, totalItems: 0, completedTrades: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await api.getPlatformStats();
        if (response.success && response.data) {
          setStats({
            activeUsers: response.data.activeUsers,
            totalItems: response.data.totalItems,
            completedTrades: response.data.completedTrades,
          });
        } else {
          console.warn('Failed to load platform stats:', response.error);
        }
      } catch (error) {
        console.error('Error loading platform stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: MessageSquare,
      title: t('feature.forum.title'),
      description: t('feature.forum.desc'),
      path: '/forum',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: ShoppingBag,
      title: t('feature.shop.title'),
      description: t('feature.shop.desc'),
      path: '/shop',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Store,
      title: t('feature.market.title'),
      description: t('feature.market.desc'),
      path: '/market',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: User,
      title: t('feature.profile.title'),
      description: t('feature.profile.desc'),
      path: '/profile',
      gradient: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDE1MywgNjksIDI1NSwgMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent animate-gradient">
              {t('home.title')}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              {t('home.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/shop">
                <Button size="lg" className="gap-2">
                  {t('home.exploreShop')}
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/forum">
                <Button size="lg" variant="outline" className="gap-2">
                  {t('home.joinForum')}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            {t('home.features')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
              >
                <Link to={feature.path}>
                  <GlassCard hover className="p-6 h-full group cursor-pointer">
                    <div
                      className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Live Stats Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: t('home.activeUsers'), value: stats.activeUsers, icon: User, color: 'from-blue-500 to-cyan-500' },
              { label: t('home.totalItems'), value: stats.totalItems, icon: ShoppingBag, color: 'from-purple-500 to-pink-500' },
              { label: t('home.completedTrades'), value: stats.completedTrades, icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
              >
                <GlassCard className="p-8 text-center relative overflow-hidden group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                  <stat.icon className="w-12 h-12 mx-auto mb-4 text-primary" />
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                    {loading ? '...' : stat.value.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
