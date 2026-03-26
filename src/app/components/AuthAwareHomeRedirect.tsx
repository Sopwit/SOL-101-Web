import { useWallet } from '@solana/wallet-adapter-react';
import { Navigate } from 'react-router';

export function AuthAwareHomeRedirect() {
  const { connected } = useWallet();

  if (connected) {
    return <Navigate to="/shop" replace />;
  }

  return <Navigate to="/home" replace />;
}
