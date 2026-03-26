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
    <WalletMultiButton className="!h-11 !rounded-full !bg-primary !px-5 !py-2.5 !text-primary-foreground !font-semibold !shadow-[0_16px_32px_-18px_rgba(34,197,94,0.38)] transition-all hover:!bg-primary/90" />
  );
}
