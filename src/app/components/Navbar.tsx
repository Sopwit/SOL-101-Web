import { Link, useLocation } from 'react-router';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { WalletButton } from './WalletButton';
import { useLanguage } from '../contexts/LanguageContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAdminAccess } from '../hooks/useAdminAccess';

export function Navbar() {
  const location = useLocation();
  const { t } = useLanguage();
  const { connected } = useWallet();
  const { isAdmin } = useAdminAccess();
  const homeTarget = '/home';

  const navItems = [
    { path: '/forum', label: t('nav.forum') },
    { path: '/shop', label: t('nav.shop') },
    { path: '/market', label: t('nav.market') },
    { path: '/profile', label: t('nav.profile') },
  ];

  if (isAdmin) {
    navItems.push({ path: '/admin', label: t('nav.admin') });
  }

  if (!connected) {
    navItems.splice(2, 0, { path: '/home', label: t('nav.home') });
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/72 backdrop-blur-2xl">
      <div className="container mx-auto px-4 py-5 md:px-6">
        <div className="rounded-[1.6rem] border border-border/50 bg-background/74 px-5 py-4 shadow-[0_22px_60px_-36px_rgba(15,23,42,0.5)]">
          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="hidden md:flex items-center">
            <Link
              to={homeTarget}
              className="text-lg font-black tracking-[0.28em] text-foreground transition-colors hover:text-primary"
            >
              DUAN
            </Link>
          </div>

          <div className="hidden md:flex items-center justify-center gap-2.5">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`relative rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                {item.label}
                {location.pathname === item.path && (
                  <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3.5">
            <LanguageToggle />
            <ThemeToggle />
            <WalletButton />
          </div>
          </div>

          <div className="mt-5 md:hidden">
            <div className="flex items-center justify-between gap-4">
              <Link
                to={homeTarget}
                className="text-base font-black tracking-[0.18em] text-foreground transition-colors hover:text-primary"
              >
                DUAN
              </Link>
            </div>
            <div className="scrollbar-hide mt-4 flex items-center justify-center gap-3.5 overflow-x-auto pb-2">
              {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary/10 text-primary'
                  : 'bg-background/60 text-muted-foreground'
              }`}
            >
              {item.label}
            </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
