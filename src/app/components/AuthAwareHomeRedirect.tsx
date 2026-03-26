import { useWallet } from '@solana/wallet-adapter-react';
import { Navigate } from 'react-router';
import { HomePage } from '../pages/HomePage';

export function AuthAwareHomeRedirect() {
  const { connected } = useWallet();

  if (connected) {
    return <Navigate to="/shop" replace />;
  }

  return <HomePage />;
}
