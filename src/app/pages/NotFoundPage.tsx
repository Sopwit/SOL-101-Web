import { Link } from 'react-router';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/GlassCard';
import { useLanguage } from '../contexts/LanguageContext';

export function NotFoundPage() {
  const { t } = useLanguage();
  
  return (
    <div className="container mx-auto px-4 py-24 md:px-6">
      <GlassCard className="mx-auto max-w-3xl p-12 text-center md:p-14">
        <div className="mb-5 text-9xl font-black tracking-[0.08em] bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          404
        </div>
        <h1 className="mb-4 text-4xl font-black">{t('notFound.title')}</h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-8 text-muted-foreground">
          {t('notFound.description')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/home">
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
