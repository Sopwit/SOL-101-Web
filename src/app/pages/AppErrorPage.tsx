import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/GlassCard';
import { useLanguage } from '../contexts/LanguageContext';

export function AppErrorPage() {
  const error = useRouteError();
  const { t } = useLanguage();

  const title = isRouteErrorResponse(error)
    ? t('error.pageTitle')
    : t('error.serviceTitle');

  const description = isRouteErrorResponse(error)
    ? t('error.pageDesc')
    : t('error.serviceDesc');

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <GlassCard className="max-w-2xl w-full p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold mb-3">{title}</h1>
        <p className="text-muted-foreground mb-8">{description}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button className="gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
            {t('error.retry')}
          </Button>
          <Link to="/">
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
