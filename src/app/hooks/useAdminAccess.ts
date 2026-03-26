import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

function normalizeWalletAddress(value: string) {
  return value.trim().toLowerCase();
}

function parseAdminWallets(rawValue: string | undefined) {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeWalletAddress);
}

export function useAdminAccess() {
  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const adminWallets = useMemo(
    () => parseAdminWallets(import.meta.env.VITE_ADMIN_WALLETS),
    [],
  );

  const isAdmin = connected && walletAddress
    ? adminWallets.includes(normalizeWalletAddress(walletAddress))
    : false;

  return {
    adminWallets,
    hasAdminWallets: adminWallets.length > 0,
    isAdmin,
    walletAddress,
  };
}
