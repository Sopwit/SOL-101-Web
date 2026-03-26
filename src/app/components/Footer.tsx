import { useLanguage } from '../contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="mt-auto border-t border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-10 md:px-6">
        <div className="rounded-[1.75rem] border border-border/50 bg-card/74 px-6 py-6 shadow-[0_20px_70px_-34px_rgba(15,23,42,0.42)]">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">DUAN</div>
              <div className="mt-2 text-sm text-muted-foreground">{t('footer.platform')}</div>
            </div>

            <div className="text-sm text-muted-foreground">
              {t('footer.network')}
            </div>

            <div className="flex items-center gap-3 text-sm">
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border/50 px-4 py-2 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                Solana
              </a>
              <a
                href="https://phantom.app"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border/50 px-4 py-2 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                Phantom
              </a>
              <a
                href="https://faucet.solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border/50 px-4 py-2 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              >
                {t('footer.faucet')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
