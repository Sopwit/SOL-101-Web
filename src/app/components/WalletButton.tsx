import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect } from 'react';
import { useStore } from '../store';

export function WalletButton() {
  const { publicKey, connected } = useWallet();
  const setUser = useStore((state) => state.setUser);

  useEffect(() => {
    if (connected && publicKey) {
      const address = publicKey.toBase58();
      const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
      setUser({
        walletAddress: address, // Store full address
        username: shortAddress, // Display short address as username
      });
    } else {
      setUser(null);
    }
  }, [connected, publicKey, setUser]);

  return (
    <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !text-primary-foreground !rounded-lg !px-4 !py-2 !h-auto !font-medium transition-all" />
  );
}