import { useEffect, useMemo, useRef, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { CheckCircle2, Link2, PenSquare, Wallet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/GlassCard';
import { useLanguage } from '../contexts/LanguageContext';
import { appendParamsToCallback, isAllowedWalletBridgeCallback, parseWalletBridgeSearch } from '../lib/walletBridge';
import { createWalletAuth } from '../lib/walletAuth';
import { api } from '../services/api';
const allowedCallbackPrefixes = (import.meta.env.VITE_WALLET_BRIDGE_ALLOWED_CALLBACK_PREFIXES as string | undefined)
  ?.split(',')
  .map((value) => value.trim())
  .filter(Boolean) ?? [];

function isAllowedCallback(callback: string) {
  return isAllowedWalletBridgeCallback(callback, allowedCallbackPrefixes, window.location.origin);
}

function redirectToCallback(callback: string, params: Record<string, string>) {
  if (!isAllowedCallback(callback)) {
    return;
  }

  window.location.href = appendParamsToCallback(callback, params);
}

export function WalletBridgePage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { t } = useLanguage();
  const { action, callback, message, sessionId } = useMemo(() => parseWalletBridgeSearch(window.location.search), []);
  const [statusText, setStatusText] = useState(t('walletBridge.waiting'));
  const [errorText, setErrorText] = useState('');
  const [nativeKind, setNativeKind] = useState<'connect' | 'sign-message' | 'sign-transaction' | null>(null);
  const [nativeAction, setNativeAction] = useState('');
  const [nativeMessage, setNativeMessage] = useState('');
  const autoActionStarted = useRef(false);
  const callbackAllowed = useMemo(() => isAllowedCallback(callback), [callback]);
  const nativeMode = Boolean(sessionId);

  const handleCancel = () => {
    if (nativeMode) {
      if (!sessionId) {
        return;
      }

      void api.cancelNativeWalletSession(sessionId);
      setStatusText('Istek iptal edildi.');
      return;
    }

    if (!callbackAllowed) {
      setErrorText(t('walletBridge.invalidCallback'));
      return;
    }

    redirectToCallback(callback, {
      action,
      status: 'cancelled',
    });
  };

  useEffect(() => {
    if (!nativeMode) {
      return;
    }

    if (!sessionId) {
      setErrorText('Native wallet session kimligi eksik.');
      return;
    }

    void (async () => {
      const response = await api.getNativeWalletSession(sessionId);
      if (!response.success || !response.data) {
        setErrorText(response.error || 'Native wallet session yuklenemedi.');
        return;
      }

      setNativeKind(response.data.kind);
      setNativeAction(response.data.authAction);
      setNativeMessage(response.data.requestedMessage || '');
      setStatusText(
        response.data.kind === 'sign-transaction'
          ? 'Transaction onayi bekleniyor...'
          : response.data.kind === 'sign-message'
            ? t('walletBridge.requestingSignature')
            : t('walletBridge.waiting')
      );
    })();
  }, [nativeMode, sessionId, t]);

  useEffect(() => {
    if (nativeMode) {
      return;
    }

    if (!callback && action) {
      setErrorText(t('walletBridge.missingCallback'));
      return;
    }

    if (callback && !callbackAllowed) {
      setErrorText(t('walletBridge.callbackNotAllowed'));
    }
  }, [action, callback, callbackAllowed, t]);

  useEffect(() => {
    if (nativeMode) {
      return;
    }

    if (!wallet.connected || !wallet.publicKey || autoActionStarted.current || !callbackAllowed) {
      return;
    }

    if (action === 'connect') {
      autoActionStarted.current = true;
      setStatusText(t('walletBridge.connectedReturning'));
      redirectToCallback(callback, {
        action,
        status: 'success',
        walletAddress: wallet.publicKey.toBase58(),
      });
      return;
    }

    if (action === 'sign' && wallet.signMessage && message) {
      autoActionStarted.current = true;
      setStatusText(t('walletBridge.requestingSignature'));

      void (async () => {
        try {
          const signatureBytes = await wallet.signMessage!(new TextEncoder().encode(message));
          const binary = Array.from(signatureBytes, (byte) => String.fromCharCode(byte)).join('');
          const signature = btoa(binary);
          setStatusText(t('walletBridge.signatureReturning'));
          redirectToCallback(callback, {
            action,
            status: 'success',
            walletAddress: wallet.publicKey!.toBase58(),
            message,
            signature,
          });
        } catch (error) {
          const nextError = error instanceof Error ? error.message : t('walletBridge.signatureProcessFailed');
          setErrorText(nextError);
          setStatusText(t('walletBridge.signatureFailed'));
          autoActionStarted.current = false;
        }
      })();
    }
  }, [action, callback, message, t, wallet]);

  useEffect(() => {
    if (!nativeMode || !wallet.connected || !wallet.publicKey || autoActionStarted.current || !nativeKind || !nativeAction || !sessionId) {
      return;
    }

    autoActionStarted.current = true;

    void (async () => {
      const walletAuth = await createWalletAuth(wallet, nativeAction);
      if (!walletAuth) {
        autoActionStarted.current = false;
        setErrorText(t('walletBridge.signatureProcessFailed'));
        setStatusText(t('walletBridge.signatureFailed'));
        return;
      }

      try {
        if (nativeKind === 'connect') {
          const response = await api.completeNativeWalletSession(sessionId, {}, walletAuth);
          if (!response.success) {
            throw new Error(response.error || 'Native connect tamamlama basarisiz.');
          }

          setStatusText('Wallet baglandi. Unity uygulamasina donebilirsiniz.');
          return;
        }

        if (nativeKind === 'sign-message') {
          if (!wallet.signMessage || !nativeMessage) {
            throw new Error(t('walletBridge.signUnsupported'));
          }

          const signatureBytes = await wallet.signMessage(new TextEncoder().encode(nativeMessage));
          const binary = Array.from(signatureBytes, (byte) => String.fromCharCode(byte)).join('');
          const signatureBase64 = btoa(binary);
          const response = await api.completeNativeWalletSession(sessionId, { signatureBase64 }, walletAuth);
          if (!response.success) {
            throw new Error(response.error || 'Mesaj imzalama oturumu tamamlanamadi.');
          }

          setStatusText('Mesaj imzalandi. Unity uygulamasina donebilirsiniz.');
          return;
        }

        if (!wallet.sendTransaction) {
          throw new Error('Bagli wallet transaction gondermeyi desteklemiyor.');
        }

        const transactionBase64 = (await api.getNativeWalletSession(sessionId)).data?.transactionBase64;
        if (!transactionBase64) {
          throw new Error('Imzalanacak transaction bulunamadi.');
        }

        const transactionBytes = Uint8Array.from(atob(transactionBase64), (char) => char.charCodeAt(0));
        let transaction: Transaction | VersionedTransaction;

        try {
          transaction = VersionedTransaction.deserialize(transactionBytes);
        } catch {
          transaction = Transaction.from(transactionBytes);
        }

        const transactionSignature = await wallet.sendTransaction(transaction, connection);
        const response = await api.completeNativeWalletSession(sessionId, { transactionSignature }, walletAuth);
        if (!response.success) {
          throw new Error(response.error || 'Transaction oturumu tamamlanamadi.');
        }

        setStatusText('Transaction gonderildi. Unity uygulamasina donebilirsiniz.');
      } catch (error) {
        autoActionStarted.current = false;
        setErrorText(error instanceof Error ? error.message : t('walletBridge.signatureProcessFailed'));
        setStatusText(t('walletBridge.signatureFailed'));
      }
    })();
  }, [connection, nativeAction, nativeKind, nativeMessage, nativeMode, sessionId, t, wallet]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 md:px-6">
      <GlassCard className="w-full max-w-3xl overflow-hidden p-0">
        <div className="relative overflow-hidden px-7 py-8 md:px-10 md:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_24%)]" />
          <div className="relative space-y-8">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-border/60 bg-background/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {t('walletBridge.badge')}
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-black tracking-[0.06em]">{t('walletBridge.title')}</h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  {t('walletBridge.subtitle')}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.35rem] border border-border/60 bg-background/60 p-4">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {action === 'connect' ? <Wallet className="h-5 w-5" /> : <PenSquare className="h-5 w-5" />}
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('walletBridge.action')}</p>
                <p className="mt-2 text-lg font-semibold">
                  {nativeMode
                    ? nativeKind === 'sign-transaction'
                      ? 'Transaction imzala'
                      : nativeKind === 'sign-message'
                        ? t('walletBridge.signMessage')
                        : t('walletBridge.connectWallet')
                    : action === 'connect'
                      ? t('walletBridge.connectWallet')
                      : t('walletBridge.signMessage')}
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-border/60 bg-background/60 p-4">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                  <Link2 className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('walletBridge.status')}</p>
                <p className="mt-2 text-lg font-semibold">{statusText}</p>
              </div>
              <div className="rounded-[1.35rem] border border-border/60 bg-background/60 p-4">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t('walletBridge.wallet')}</p>
                <p className="mt-2 break-all text-sm font-medium text-muted-foreground">
                  {wallet.connected && wallet.publicKey ? wallet.publicKey.toBase58() : t('walletBridge.waitingConnection')}
                </p>
              </div>
            </div>

            {errorText && (
              <div className="rounded-[1.35rem] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {errorText}
              </div>
            )}

            {!nativeMode && allowedCallbackPrefixes.length > 0 && (
              <div className="rounded-[1.35rem] border border-border/60 bg-background/50 p-4 text-xs leading-6 text-muted-foreground">
                {t('walletBridge.allowedPrefixes')}: {allowedCallbackPrefixes.join(', ')}
              </div>
            )}

            {!wallet.connected && (
              <div className="flex justify-center">
                <WalletMultiButton className="!h-12 !rounded-full !bg-primary !px-6 !py-2.5 !font-semibold hover:!bg-primary/90" />
              </div>
            )}

            {!nativeMode && action === 'sign' && wallet.connected && !wallet.signMessage && (
              <div className="rounded-[1.35rem] border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                {t('walletBridge.signUnsupported')}
              </div>
            )}

            <div className="flex gap-3">
              <Button className="flex-1" variant="secondary" onClick={handleCancel} disabled={!callbackAllowed}>
                {t('walletBridge.returnUnity')}
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    </main>
  );
}
