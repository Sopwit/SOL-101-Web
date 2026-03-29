export type BridgeAction = 'connect' | 'sign';

export function parseWalletBridgeSearch(search: string) {
  const params = new URLSearchParams(search);
  const action = (params.get('action') === 'sign' ? 'sign' : 'connect') as BridgeAction;
  const callback = params.get('callback') ?? '';
  const message = params.get('message') ?? '';
  const sessionId = params.get('session') ?? '';
  return { action, callback, message, sessionId };
}

export function appendParamsToCallback(callback: string, params: Record<string, string>) {
  const separator = callback.includes('?') ? '&' : '?';
  return `${callback}${separator}${new URLSearchParams(params).toString()}`;
}

export function isAllowedWalletBridgeCallback(
  callback: string,
  allowedPrefixes: string[],
  currentOrigin?: string
) {
  if (!callback) {
    return false;
  }

  try {
    const parsed = new URL(callback);
    if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
      return false;
    }

    if (allowedPrefixes.some((prefix) => callback.startsWith(prefix))) {
      return true;
    }

    return Boolean(currentOrigin) && parsed.origin === currentOrigin;
  } catch {
    return false;
  }
}
