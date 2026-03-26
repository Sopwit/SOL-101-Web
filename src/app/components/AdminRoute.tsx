import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { useLanguage } from '../contexts/LanguageContext';

const OpsPage = lazy(async () => import('../pages/OpsPage').then((module) => ({ default: module.OpsPage })));

export function AdminRoute() {
  const { isAdmin } = useAdminAccess();
  const { t } = useLanguage();

  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-24 text-sm text-muted-foreground">{t('admin.loading')}</div>}>
      <OpsPage />
    </Suspense>
  );
}
