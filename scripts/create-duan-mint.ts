import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import { createAnchorProvider } from './solana-runtime.ts';

const ENV_PATH = resolve('.env');
const DEFAULT_DECIMALS = Number(process.env.DUAN_TOKEN_DECIMALS ?? '0');
const DEFAULT_MINT_AMOUNT = BigInt(process.env.DUAN_INITIAL_SUPPLY ?? '100000');

function updateEnvMintAddress(mintAddress: string) {
  const current = readFileSync(ENV_PATH, 'utf8');
  const next = current.match(/^VITE_SOLANA_TOKEN_MINT=.*$/m)
    ? current.replace(/^VITE_SOLANA_TOKEN_MINT=.*$/m, `VITE_SOLANA_TOKEN_MINT=${mintAddress}`)
    : `${current.trimEnd()}\nVITE_SOLANA_TOKEN_MINT=${mintAddress}\n`;

  writeFileSync(ENV_PATH, `${next.endsWith('\n') ? next : `${next}\n`}`);
}

async function main() {
  const provider = createAnchorProvider();
  const connection = provider.connection;
  const payer = provider.wallet.payer;
  const owner = provider.wallet.publicKey;

  const mint = await createMint(
    connection,
    payer,
    owner,
    owner,
    DEFAULT_DECIMALS,
  );

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner,
  );

  await mintTo(
    connection,
    payer,
    mint,
    ata.address,
    owner,
    DEFAULT_MINT_AMOUNT,
  );

  updateEnvMintAddress(mint.toBase58());

  console.log(`Created DUAN mint: ${mint.toBase58()}`);
  console.log(`Owner ATA: ${ata.address.toBase58()}`);
  console.log(`Minted ${DEFAULT_MINT_AMOUNT.toString()} tokens with ${DEFAULT_DECIMALS} decimals`);
  console.log('Updated .env -> VITE_SOLANA_TOKEN_MINT');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
