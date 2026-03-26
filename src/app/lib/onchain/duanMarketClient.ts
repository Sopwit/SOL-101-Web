import * as anchor from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { Connection } from '@solana/web3.js';
import { DUAN_MARKET_IDL, DUAN_MARKET_PROGRAM_ID } from './duanMarketIdl.ts';

const { AnchorProvider, Program, web3, BN } = anchor;
const PROGRAM_ID = new web3.PublicKey(DUAN_MARKET_PROGRAM_ID);

function anchorWallet(wallet: Pick<WalletContextState, 'publicKey' | 'signTransaction' | 'signAllTransactions'>) {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet does not support transaction signing');
  }

  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions ?? (async (txs: web3.Transaction[]) => {
      return Promise.all(txs.map((tx) => wallet.signTransaction!(tx)));
    }),
  };
}

function createProgram(
  connection: Connection,
  wallet: Pick<WalletContextState, 'publicKey' | 'signTransaction' | 'signAllTransactions'>
) {
  const provider = new AnchorProvider(connection, anchorWallet(wallet), {
    commitment: 'confirmed',
  });

  return new Program(DUAN_MARKET_IDL as unknown as Idl, provider);
}

export function getMarketConfigPda() {
  return web3.PublicKey.findProgramAddressSync([Buffer.from('market-config')], PROGRAM_ID);
}

export function getListingEscrowPda(seller: web3.PublicKey, listingNonce: bigint) {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(listingNonce);

  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('listing'), seller.toBuffer(), nonceBuffer],
    PROGRAM_ID
  );
}

export function getTradeIntentPda(listingEscrow: web3.PublicKey, buyer: web3.PublicKey) {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('trade-intent'), listingEscrow.toBuffer(), buyer.toBuffer()],
    PROGRAM_ID
  );
}

function mapWantedType(wantedType: 'token' | 'item' | 'both') {
  if (wantedType === 'token') return 1;
  if (wantedType === 'item') return 2;
  return 3;
}

function clampItemId(value?: string) {
  return (value || '').trim().slice(0, 32);
}

export async function openOnchainMarketListing(
  connection: Connection,
  wallet: Pick<WalletContextState, 'publicKey' | 'sendTransaction' | 'signTransaction' | 'signAllTransactions'>,
  args: {
    itemId: string;
    wantedType: 'token' | 'item' | 'both';
    wantedTokenAmount?: number;
    wantedItemId?: string;
    durationHours: number;
  }
) {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet is not ready');
  }

  const program = createProgram(connection, wallet);
  const [marketConfig] = getMarketConfigPda();
  const listingNonce = BigInt(Date.now());
  const [listingEscrow] = getListingEscrowPda(wallet.publicKey, listingNonce);
  const expiresAt = Math.floor(Date.now() / 1000) + args.durationHours * 60 * 60;

  const tx = await program.methods
    .openListingEscrow({
      itemId: args.itemId,
      wantedType: mapWantedType(args.wantedType),
      wantedAmount: new BN(Math.max(0, Number(args.wantedTokenAmount || 0))),
      wantedItemId: clampItemId(args.wantedItemId),
      expiresAt: new BN(expiresAt),
      listingNonce: new BN(listingNonce.toString()),
    })
    .accounts({
      marketConfig,
      listingEscrow,
      seller: wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .transaction();

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, 'confirmed');

  return {
    signature,
    listingEscrow: listingEscrow.toBase58(),
    listingNonce: listingNonce.toString(),
    programId: PROGRAM_ID.toBase58(),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export async function createOnchainTradeIntent(
  connection: Connection,
  wallet: Pick<WalletContextState, 'publicKey' | 'sendTransaction' | 'signTransaction' | 'signAllTransactions'>,
  args: {
    listingEscrow: string;
    offeredTokenAmount?: number;
    offeredItemId?: string;
  }
) {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet is not ready');
  }

  const program = createProgram(connection, wallet);
  const [marketConfig] = getMarketConfigPda();
  const listingEscrow = new web3.PublicKey(args.listingEscrow);
  const [tradeIntent] = getTradeIntentPda(listingEscrow, wallet.publicKey);

  const tx = await program.methods
    .createTradeIntent({
      offeredAmount: new BN(Math.max(0, Number(args.offeredTokenAmount || 0))),
      offeredItemId: clampItemId(args.offeredItemId),
    })
    .accounts({
      marketConfig,
      listingEscrow,
      market: marketConfig,
      tradeIntent,
      buyer: wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .transaction();

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, 'confirmed');

  return {
    signature,
    tradeIntent: tradeIntent.toBase58(),
    programId: PROGRAM_ID.toBase58(),
  };
}

export async function cancelOnchainMarketListing(
  connection: Connection,
  wallet: Pick<WalletContextState, 'publicKey' | 'sendTransaction' | 'signTransaction' | 'signAllTransactions'>,
  listing: {
    listingEscrow: string;
  }
) {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet is not ready');
  }

  const program = createProgram(connection, wallet);
  const [marketConfig] = getMarketConfigPda();
  const listingEscrow = new web3.PublicKey(listing.listingEscrow);

  const tx = await program.methods
    .cancelListingEscrow()
    .accounts({
      marketConfig,
      listingEscrow,
      market: marketConfig,
      seller: wallet.publicKey,
    })
    .transaction();

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, 'confirmed');

  return {
    signature,
    listingEscrow: listingEscrow.toBase58(),
    programId: PROGRAM_ID.toBase58(),
  };
}
