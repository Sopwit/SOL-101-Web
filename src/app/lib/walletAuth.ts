import type { WalletContextState } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import type { WalletAuthHeaders } from '../services/api';

export async function createWalletAuth(
  wallet: Pick<WalletContextState, 'publicKey' | 'signMessage'>,
  action: string
): Promise<WalletAuthHeaders | null> {
  if (!wallet.publicKey || !wallet.signMessage) {
    toast.error('Wallet imzalama desteklenmiyor');
    return null;
  }

  const walletAddress = wallet.publicKey.toBase58();
  const message = JSON.stringify({
    domain: 'DUAN',
    action,
    walletAddress,
    timestamp: Date.now(),
  });

  try {
    const signatureBytes = await wallet.signMessage(new TextEncoder().encode(message));
    const binary = Array.from(signatureBytes, (byte) => String.fromCharCode(byte)).join('');

    return {
      walletAddress,
      message,
      signature: btoa(binary),
    };
  } catch {
    toast.error('Imza islemi iptal edildi veya basarisiz oldu');
    return null;
  }
}
