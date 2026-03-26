import { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

type BridgeAction = 'connect' | 'sign';

function parseSearchParams() {
  const params = new URLSearchParams(window.location.search);
  const action = (params.get('action') === 'sign' ? 'sign' : 'connect') as BridgeAction;
  const callback = params.get('callback') ?? '';
  const message = params.get('message') ?? '';
  return { action, callback, message };
}

function appendParamsToCallback(callback: string, params: Record<string, string>) {
  const separator = callback.includes('?') ? '&' : '?';
  return `${callback}${separator}${new URLSearchParams(params).toString()}`;
}

function redirectToCallback(callback: string, params: Record<string, string>) {
  if (!callback) {
    return;
  }

  window.location.href = appendParamsToCallback(callback, params);
}

export function WalletBridgePage() {
  const wallet = useWallet();
  const { action, callback, message } = useMemo(() => parseSearchParams(), []);
  const [statusText, setStatusText] = useState('Wallet baglantisi bekleniyor...');
  const [errorText, setErrorText] = useState('');
  const autoActionStarted = useRef(false);

  const handleCancel = () => {
    redirectToCallback(callback, {
      action,
      status: 'cancelled',
    });
  };

  useEffect(() => {
    if (!wallet.connected || !wallet.publicKey || autoActionStarted.current) {
      return;
    }

    if (action === 'connect') {
      autoActionStarted.current = true;
      setStatusText('Wallet baglandi, Unity uygulamasina donuluyor...');
      redirectToCallback(callback, {
        action,
        status: 'success',
        walletAddress: wallet.publicKey.toBase58(),
      });
      return;
    }

    if (action === 'sign' && wallet.signMessage && message) {
      autoActionStarted.current = true;
      setStatusText('Imza isteniyor...');

      void (async () => {
        try {
          const signatureBytes = await wallet.signMessage!(new TextEncoder().encode(message));
          const binary = Array.from(signatureBytes, (byte) => String.fromCharCode(byte)).join('');
          const signature = btoa(binary);
          setStatusText('Imza alindi, Unity uygulamasina donuluyor...');
          redirectToCallback(callback, {
            action,
            status: 'success',
            walletAddress: wallet.publicKey!.toBase58(),
            message,
            signature,
          });
        } catch (error) {
          const nextError = error instanceof Error ? error.message : 'Imza islemi basarisiz oldu.';
          setErrorText(nextError);
          setStatusText('Imza alinamadi.');
          autoActionStarted.current = false;
        }
      })();
    }
  }, [action, callback, message, wallet]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-slate-800 bg-slate-900/95">
        <CardHeader>
          <CardTitle>DUAN Wallet Bridge</CardTitle>
          <CardDescription className="text-slate-400">
            Unity ile Solana wallet arasinda baglanti kuruluyor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
            <div><strong>Islem:</strong> {action === 'connect' ? 'Wallet bagla' : 'Mesaj imzala'}</div>
            <div><strong>Durum:</strong> {statusText}</div>
            {wallet.connected && wallet.publicKey && (
              <div><strong>Wallet:</strong> {wallet.publicKey.toBase58()}</div>
            )}
          </div>

          {errorText && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {errorText}
            </div>
          )}

          {!wallet.connected && (
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>
          )}

          {action === 'sign' && wallet.connected && !wallet.signMessage && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              Bagli wallet mesaj imzalamayi desteklemiyor.
            </div>
          )}

          <div className="flex gap-3">
            <Button className="flex-1" variant="secondary" onClick={handleCancel}>
              Unity'ye Don
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
