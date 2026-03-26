import '../styles/index.css';
import { useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { Toaster } from './components/ui/sonner';
import { router } from './routes';
import { LanguageProvider } from './contexts/LanguageContext';
import { Buffer } from 'buffer/';

// Solana adapter ve web3 kutuphaneleri tarayici ortaminda Buffer bekledigi icin
// giriste tek seferlik polyfill uygulanir.
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

// Wallet modal bilesenlerinin temel stilleri.
import '@solana/wallet-adapter-react-ui/styles.css';

export default function App() {
  // Bu proje devnet odaklidir. Gecersiz cluster istekleri olsa bile devnet'e
  // geri donulur; mainnet path'i bilincli olarak acik tutulmaz.
  const endpoint = useMemo(() => {
    const configuredEndpoint = import.meta.env.VITE_SOLANA_RPC_URL;
    if (configuredEndpoint) return configuredEndpoint;

    const configuredCluster = import.meta.env.VITE_SOLANA_CLUSTER;
    if (configuredCluster === 'devnet') {
      return clusterApiUrl(configuredCluster);
    }

    return clusterApiUrl('devnet');
  }, []);

  // Demo ve gelistirme akisinda tek wallet adaptoru yeterli oldugu icin
  // Phantom varsayilan secim olarak tanimlanir.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  );

  return (
    <LanguageProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <RouterProvider router={router} />
              <Toaster position="bottom-right" />
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
