import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/GlassCard';
import { useLanguage } from '../contexts/LanguageContext';

export function AppErrorPage() {
  const error = useRouteError();
  const { t } = useLanguage();
  const errorMessage = error instanceof Error ? error.message : null;

  const title = isRouteErrorResponse(error)
    ? t('error.pageTitle')
    : t('error.serviceTitle');

  const description = isRouteErrorResponse(error)
    ? t('error.pageDesc')
    : t('error.serviceDesc');

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <GlassCard className="w-full max-w-3xl p-12 text-center md:p-14">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-destructive/10 text-destructive">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="mb-4 text-4xl font-black">{title}</h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
        {errorMessage ? (
          <div className="mx-auto mb-8 max-w-2xl rounded-[1.25rem] border border-border/50 bg-muted/20 px-4 py-3 text-left text-sm text-muted-foreground">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">Error Detail</div>
            <div className="break-words">{errorMessage}</div>
          </div>
        ) : null}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button className="gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
            {t('error.retry')}
          </Button>
          <Link to="/home">
            <Button variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              {t('notFound.goHome')}
            </Button>
          </Link>
          <Button variant="ghost" className="gap-2" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4" />
            {t('notFound.goBack')}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
