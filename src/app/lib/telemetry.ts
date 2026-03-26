type TelemetryLevel = 'error' | 'warning' | 'info';

interface TelemetryEvent {
  level: TelemetryLevel;
  message: string;
  source: string;
  detail?: string;
  timestamp: string;
  path?: string;
}

declare global {
  interface Window {
    __DUAN_TELEMETRY__?: TelemetryEvent[];
  }
}

const TELEMETRY_BUFFER_LIMIT = 100;
const telemetryEndpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT as string | undefined;

function pushToClientBuffer(event: TelemetryEvent) {
  if (typeof window === 'undefined') {
    return;
  }

  const buffer = window.__DUAN_TELEMETRY__ ?? [];
  buffer.push(event);
  window.__DUAN_TELEMETRY__ = buffer.slice(-TELEMETRY_BUFFER_LIMIT);
}

function sendToEndpoint(event: TelemetryEvent) {
  if (!telemetryEndpoint || typeof navigator === 'undefined') {
    return;
  }

  const payload = JSON.stringify(event);
  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(telemetryEndpoint, blob);
      return;
    }
  } catch {
    // Fall through to fetch.
  }

  void fetch(telemetryEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export function reportEvent(level: TelemetryLevel, source: string, message: string, detail?: string) {
  const event: TelemetryEvent = {
    level,
    source,
    message,
    detail,
    timestamp: new Date().toISOString(),
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
  };

  pushToClientBuffer(event);
  sendToEndpoint(event);
}

export function reportError(source: string, error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const detail = error instanceof Error ? error.stack : typeof error === 'string' ? error : undefined;
  console.error(`[${source}]`, error);
  reportEvent('error', source, message, detail);
}

export function installGlobalTelemetry() {
  if (typeof window === 'undefined') {
    return;
  }

  const onError = (event: ErrorEvent) => {
    reportEvent(
      'error',
      'window.error',
      event.message || 'Beklenmeyen pencere hatasi',
      event.error instanceof Error ? event.error.stack : undefined
    );
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    reportEvent(
      'error',
      'window.unhandledrejection',
      reason instanceof Error ? reason.message : 'Yakala(n)mamis promise hatasi',
      reason instanceof Error ? reason.stack : typeof reason === 'string' ? reason : undefined
    );
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
}
