import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '../services/api';

export function usePresenceHeartbeat() {
  const { connected, publicKey } = useWallet();

  useEffect(() => {
    if (!connected || !publicKey) {
      return;
    }

    const walletAddress = publicKey.toBase58();

    const sendHeartbeat = () => {
      void api.sendPresenceHeartbeat(walletAddress);
    };

    sendHeartbeat();

    const intervalId = window.setInterval(sendHeartbeat, 45_000);
    const handleFocus = () => sendHeartbeat();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connected, publicKey]);
}
