import test from 'node:test';
import assert from 'node:assert/strict';
import { appendParamsToCallback, isAllowedWalletBridgeCallback, parseWalletBridgeSearch } from '../src/app/lib/walletBridge.ts';

test('parseWalletBridgeSearch extracts action callback and message', () => {
  const result = parseWalletBridgeSearch('?action=sign&callback=sol101%3A%2F%2Fwallet-bridge&message=hello');
  assert.equal(result.action, 'sign');
  assert.equal(result.callback, 'sol101://wallet-bridge');
  assert.equal(result.message, 'hello');
});

test('appendParamsToCallback appends params with existing query support', () => {
  const callback = appendParamsToCallback('sol101://wallet-bridge?foo=bar', { status: 'success' });
  assert.equal(callback, 'sol101://wallet-bridge?foo=bar&status=success');
});

test('isAllowedWalletBridgeCallback accepts allowlisted custom scheme', () => {
  assert.equal(
    isAllowedWalletBridgeCallback('sol101://wallet-bridge', ['sol101://wallet-bridge'], 'https://duan.example.com'),
    true
  );
});

test('isAllowedWalletBridgeCallback accepts same-origin https callback', () => {
  assert.equal(
    isAllowedWalletBridgeCallback('https://duan.example.com/wallet-bridge/callback', [], 'https://duan.example.com'),
    true
  );
});

test('isAllowedWalletBridgeCallback rejects javascript scheme', () => {
  assert.equal(
    isAllowedWalletBridgeCallback('javascript:alert(1)', ['sol101://wallet-bridge'], 'https://duan.example.com'),
    false
  );
});
