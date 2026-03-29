export type BridgeAction = 'connect' | 'sign';

function extractQueryFromHash(hash: string) {
  if (!hash) {
    return '';
  }

  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0 || queryIndex === hash.length - 1) {
    return '';
  }

  return hash.slice(queryIndex + 1);
}

export function parseWalletBridgeSearch(search: string, hash = '') {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(extractQueryFromHash(hash));
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of hashParams.entries()) {
    if (!params.has(key) && value) {
      params.set(key, value);
    }
  }

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
