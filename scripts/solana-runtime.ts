import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import anchor from '@coral-xyz/anchor';

function expandHome(filePath: string) {
  if (filePath.startsWith('~/')) {
    return resolve(homedir(), filePath.slice(2));
  }

  return resolve(filePath);
}

function resolveRpcUrl() {
  return (
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.VITE_SOLANA_RPC_URL ||
    'https://api.devnet.solana.com'
  );
}

function resolveWalletPath() {
  return process.env.ANCHOR_WALLET || '~/.config/solana/id.json';
}

export function createAnchorProvider() {
  const connection = new anchor.web3.Connection(resolveRpcUrl(), 'confirmed');
  const walletPath = expandHome(resolveWalletPath());
  const secretKey = Uint8Array.from(JSON.parse(readFileSync(walletPath, 'utf8')) as number[]);
  const wallet = new anchor.Wallet(anchor.web3.Keypair.fromSecretKey(secretKey));

  return new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
}
