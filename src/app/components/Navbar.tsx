import { Link, useLocation } from 'react-router';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { WalletButton } from './WalletButton';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function Navbar() {
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { path: '/forum', label: t('nav.forum') },
    { path: '/shop', label: t('nav.shop') },
    { path: '/', label: t('nav.home') },
    { path: '/market', label: t('nav.market') },
    { path: '/profile', label: t('nav.profile') },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors hover:text-primary relative ${
                  location.pathname === item.path
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                {item.label}
                {location.pathname === item.path && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center gap-4 mt-4 overflow-x-auto pb-2 scrollbar-hide">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-medium whitespace-nowrap transition-colors hover:text-primary px-3 py-1 rounded-lg ${
                location.pathname === item.path
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
