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

// Polyfill Buffer for Solana libraries
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

export default function App() {
  // Solana RPC endpoint - Devnet için
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);

  // Configure wallets
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