import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { HomePage } from './pages/HomePage';
import { ForumPage } from './pages/ForumPage';
import { ShopPage } from './pages/ShopPage';
import { MarketPage } from './pages/MarketPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: 'forum', Component: ForumPage },
      { path: 'shop', Component: ShopPage },
      { path: 'market', Component: MarketPage },
      { path: 'profile', Component: ProfilePage },
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
