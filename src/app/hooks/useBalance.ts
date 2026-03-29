import { useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { reportError } from '../lib/telemetry';
import { useStore } from '../store';

export function useBalance() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { setSolBalance, setTokenBalance } = useStore();

  useEffect(() => {
    if (!connected || !publicKey) {
      setSolBalance(0);
      setTokenBalance(0);
      return;
    }

    const getBalance = async () => {
      try {
        const [solLamports, tokenBalance] = await Promise.all([
          connection.getBalance(publicKey),
          getSplTokenBalance(),
        ]);

        setSolBalance(solLamports / 1e9);
        setTokenBalance(tokenBalance);
      } catch (error) {
        reportError('wallet:balance', error, 'Cuzdan bakiyesi okunamadi');
      }
    };

    const getSplTokenBalance = async (): Promise<number> => {
      const mintAddress = import.meta.env.VITE_SOLANA_TOKEN_MINT;
      if (!mintAddress) return 0;

      try {
        const mint = new PublicKey(mintAddress);
        const response = await connection.getParsedTokenAccountsByOwner(publicKey, { mint });

        return response.value.reduce((total, account) => {
          const amount = account.account.data.parsed?.info?.tokenAmount?.uiAmount;
          return total + (typeof amount === 'number' ? amount : 0);
        }, 0);
      } catch (error) {
        reportError('wallet:spl-balance', error, 'SPL token bakiyesi okunamadi');
        return 0;
      }
    };

    getBalance();

    const solSubscriptionId = connection.onAccountChange(publicKey, () => {
      void getBalance();
    }, 'confirmed');

    const interval = setInterval(getBalance, 30000);

    return () => {
      clearInterval(interval);
      void connection.removeAccountChangeListener(solSubscriptionId);
    };
  }, [connected, publicKey, connection, setSolBalance, setTokenBalance]);
}
