import { createBrowserRouter, createHashRouter } from 'react-router';
import { Layout } from './Layout';
import { AuthAwareHomeRedirect } from './components/AuthAwareHomeRedirect';
import { AppErrorPage } from './pages/AppErrorPage';
import { ForumPage } from './pages/ForumPage';
import { ShopPage } from './pages/ShopPage';
import { MarketPage } from './pages/MarketPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { WalletBridgePage } from './pages/WalletBridgePage';

const routes = [
  {
    path: '/wallet-bridge',
    Component: WalletBridgePage,
    errorElement: <AppErrorPage />,
  },
  {
    path: '/',
    Component: Layout,
    errorElement: <AppErrorPage />,
    children: [
      { index: true, Component: AuthAwareHomeRedirect },
      { path: 'forum', Component: ForumPage },
      { path: 'shop', Component: ShopPage },
      { path: 'market', Component: MarketPage },
      { path: 'profile', Component: ProfilePage },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

const routerFactory = import.meta.env.VITE_ROUTER_MODE === 'hash'
  ? createHashRouter
  : createBrowserRouter;

export const router = routerFactory(routes);
