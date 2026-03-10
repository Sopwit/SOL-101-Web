import { useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useStore } from '../store';

export function useBalance() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { setSolBalance } = useStore();

  useEffect(() => {
    if (!connected || !publicKey) {
      setSolBalance(0);
      return;
    }

    // Get SOL balance
    const getBalance = async () => {
      try {
        const balance = await connection.getBalance(publicKey);
        setSolBalance(balance / 1e9); // Convert lamports to SOL
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    getBalance();

    // Update balance every 30 seconds
    const interval = setInterval(getBalance, 30000);

    return () => clearInterval(interval);
  }, [connected, publicKey, connection, setSolBalance]);
}
