import { Navigate, createBrowserRouter, createHashRouter } from 'react-router';
import { AdminRoute } from './components/AdminRoute';
import { Layout } from './Layout';
import { AuthAwareHomeRedirect } from './components/AuthAwareHomeRedirect';
import { AppErrorPage } from './pages/AppErrorPage';

function LegacyOpsRedirect() {
  return <Navigate to="/admin" replace />;
}

const routes = [
  {
    path: '/wallet-bridge',
    lazy: async () => ({ Component: (await import('./pages/WalletBridgePage')).WalletBridgePage }),
    errorElement: <AppErrorPage />,
  },
  {
    path: '/',
    Component: Layout,
    errorElement: <AppErrorPage />,
    children: [
      { index: true, Component: AuthAwareHomeRedirect },
      { path: 'home', lazy: async () => ({ Component: (await import('./pages/HomePage')).HomePage }) },
      { path: 'forum', lazy: async () => ({ Component: (await import('./pages/ForumPage')).ForumPage }) },
      { path: 'shop', lazy: async () => ({ Component: (await import('./pages/ShopPage')).ShopPage }) },
      { path: 'market', lazy: async () => ({ Component: (await import('./pages/MarketPage')).MarketPage }) },
      { path: 'profile', lazy: async () => ({ Component: (await import('./pages/ProfilePage')).ProfilePage }) },
      { path: 'admin', Component: AdminRoute },
      { path: 'ops', Component: LegacyOpsRedirect },
      { path: '*', lazy: async () => ({ Component: (await import('./pages/NotFoundPage')).NotFoundPage }) },
    ],
  },
];

const routerFactory = import.meta.env.VITE_ROUTER_MODE === 'hash'
  ? createHashRouter
  : createBrowserRouter;

export const router = routerFactory(routes);
