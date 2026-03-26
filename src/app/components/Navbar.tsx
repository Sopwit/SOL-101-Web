import { Link, useLocation } from 'react-router';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { WalletButton } from './WalletButton';
import { useLanguage } from '../contexts/LanguageContext';
import { useWallet } from '@solana/wallet-adapter-react';

export function Navbar() {
  const location = useLocation();
  const { t } = useLanguage();
  const { connected } = useWallet();

  const navItems = [
    { path: '/forum', label: t('nav.forum') },
    { path: '/shop', label: t('nav.shop') },
    { path: '/market', label: t('nav.market') },
    { path: '/profile', label: t('nav.profile') },
  ];

  if (!connected) {
    navItems.splice(2, 0, { path: '/', label: t('nav.home') });
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="hidden md:flex items-center">
            <Link
              to="/"
              className="text-lg font-black tracking-[0.22em] text-foreground transition-colors hover:text-primary"
            >
              DUAN
            </Link>
          </div>

          <div className="hidden md:flex items-center justify-center gap-6">
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

          <div className="flex items-center justify-end gap-3">
            <LanguageToggle />
            <ThemeToggle />
            <WalletButton />
          </div>
      </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center justify-between gap-4">
          <Link
            to="/"
            className="text-base font-black tracking-[0.18em] text-foreground transition-colors hover:text-primary"
          >
            DUAN
          </Link>
        </div>
        <div className="md:hidden flex items-center justify-center gap-4 mt-4 overflow-x-auto pb-2 scrollbar-hide">
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
