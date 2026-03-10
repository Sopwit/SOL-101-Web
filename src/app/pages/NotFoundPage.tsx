import { Link } from 'react-router';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/GlassCard';
import { useLanguage } from '../contexts/LanguageContext';

export function NotFoundPage() {
  const { t } = useLanguage();
  
  return (
    <div className="container mx-auto px-4 py-20">
      <GlassCard className="max-w-2xl mx-auto p-12 text-center">
        <div className="text-9xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-3xl font-bold mb-4">{t('notFound.title')}</h1>
        <p className="text-muted-foreground mb-8">
          {t('notFound.description')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/">
            <Button className="gap-2">
              <Home className="w-5 h-5" />
              {t('notFound.goHome')}
            </Button>
          </Link>
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="w-5 h-5" />
            {t('notFound.goBack')}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}