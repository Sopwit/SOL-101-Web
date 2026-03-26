import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, normalizeHealthResponse, type ApiHealthResponse } from '../services/api';
import type { SystemStatusItem } from '../types';

interface RuntimeHealthOptions {
  requireAuthority?: boolean;
}

function formatCheckedAt(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function useRuntimeHealthStatus(options: RuntimeHealthOptions = {}) {
  const { requireAuthority = false } = options;
  const [health, setHealth] = useState<ApiHealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await api.getHealth();
    if (!response.success || !response.data) {
      setHealth(null);
      setHealthError(response.error || 'Backend runtime saglik durumu alinamadi.');
      setCheckedAt(new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
      return;
    }

    setHealth(normalizeHealthResponse(response.data));
    setHealthError(null);
    setCheckedAt(formatCheckedAt(response.data.timestamp));
  }, []);

  useEffect(() => {
    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    const handleFocus = () => {
      void refresh();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh]);

  const statusItem = useMemo<SystemStatusItem>(() => {
    if (healthError) {
      return {
        id: 'backend-runtime-health',
        source: 'backend',
        state: 'degraded',
        severity: 'warning',
        title: 'Backend Runtime',
        detail: healthError,
        checkedAt: checkedAt || undefined,
      };
    }

    if (!health) {
      return {
        id: 'backend-runtime-health',
        source: 'backend',
        state: 'degraded',
        severity: 'warning',
        title: 'Backend Runtime',
        detail: 'Backend runtime saglik durumu yeniden kontrol ediliyor.',
        checkedAt: checkedAt || undefined,
      };
    }

    const runtimeIssue = !health.database.connected
      ? health.database.error || 'KV/database baglantisi kullanilamiyor.'
      : !health.solana.rpcReachable
        ? health.solana.rpcError || 'Devnet RPC tarafina erisilemiyor.'
        : !health.solana.programDeployed
          ? 'On-chain program bu RPC uzerinden dogrulanamadi.'
          : !health.solana.shopConfigInitialized
            ? 'Shop config hesabi henuz initialize edilmemis.'
            : requireAuthority && !health.solana.gameAuthoritySecretPresent
              ? 'Game authority secret runtime ortaminda tanimli degil.'
              : requireAuthority && !health.solana.gameAuthorityReady
                ? health.solana.providerError || 'Game authority provider hazir degil.'
                : null;

    return {
      id: 'backend-runtime-health',
      source: 'backend',
      state: runtimeIssue ? 'degraded' : 'healthy',
      severity: runtimeIssue ? 'warning' : 'info',
      title: 'Backend Runtime',
      detail: runtimeIssue || 'Backend runtime, devnet RPC ve authority katmani hazir gorunuyor.',
      checkedAt: checkedAt || undefined,
      context: health.solana.rpcUrl.replace(/^https?:\/\//, ''),
    };
  }, [checkedAt, health, healthError, requireAuthority]);

  return {
    health,
    healthError,
    checkedAt,
    refresh,
    statusItem,
  };
}
