import { AnchorProvider, BorshAccountsCoder, BN, Idl, Program, web3 } from '@coral-xyz/anchor';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { Connection } from '@solana/web3.js';
import { SHOP_ITEM_CATALOG } from '../../../../shared/shopCatalog';
import type { InventoryItem, ShopItem } from '../../types';
import { DUAN_SHOP_IDL, DUAN_SHOP_PROGRAM_ID } from './duanShopIdl';

const PROGRAM_ID = new web3.PublicKey(DUAN_SHOP_PROGRAM_ID);
const coder = new BorshAccountsCoder(DUAN_SHOP_IDL as unknown as Idl);

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

function metadataMap() {
  return new Map(SHOP_ITEM_CATALOG.map((item) => [item.id, item]));
}

export function getShopConfigPda() {
  return web3.PublicKey.findProgramAddressSync([Buffer.from('shop-config')], PROGRAM_ID);
}

export function getShopItemPda(itemId: string) {
  const [shopConfig] = getShopConfigPda();
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('item'), shopConfig.toBuffer(), Buffer.from(itemId)],
    PROGRAM_ID
  );
}

export function getOwnedItemPda(owner: web3.PublicKey, itemId: string) {
  const [shopConfig] = getShopConfigPda();
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('owned-item'), owner.toBuffer(), shopConfig.toBuffer(), Buffer.from(itemId)],
    PROGRAM_ID
  );
}

export function getPlayerProfilePda(owner: web3.PublicKey) {
  const [shopConfig] = getShopConfigPda();
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('player-profile'), shopConfig.toBuffer(), owner.toBuffer()],
    PROGRAM_ID
  );
}

function normalizeOnchainItem(account: any): ShopItem {
  const metadata = metadataMap().get(account.itemId);
  const basePrice = Number(account.basePrice.toString());
  const stock = Number(account.stock);
  const soldCount = Number(account.soldCount.toString());
  const restockAtSeconds = Number(account.restockAt.toString());
  const restockAt = restockAtSeconds > 0 ? new Date(restockAtSeconds * 1000).toISOString() : null;
  const restockDurationMinutes = Math.max(1, Math.round(Number(account.restockDurationSeconds.toString()) / 60));

  const nowSeconds = Math.floor(Date.now() / 1000);
  const shouldDisplayRestocked = stock === 0 && restockAtSeconds > 0 && restockAtSeconds <= nowSeconds;

  return {
    id: account.itemId,
    name: metadata?.name ?? account.itemId,
    description: metadata?.description ?? '',
    imageUrl: metadata?.imageUrl ?? '',
    category: metadata?.category ?? 'Onchain',
    rarity: metadata?.rarity ?? 'common',
    price: Number(account.price.toString()),
    basePrice,
    stock: shouldDisplayRestocked ? Number(account.baseStock) : stock,
    baseStock: Number(account.baseStock),
    soldCount,
    restockAt: shouldDisplayRestocked ? null : restockAt,
    restockDurationMinutes,
  };
}

export async function fetchOnchainShopItems(connection: Connection): Promise<ShopItem[]> {
  const pdas = SHOP_ITEM_CATALOG.map((item) => {
    const [pda] = getShopItemPda(item.id);
    return { itemId: item.id, pda };
  });

  const infos = await connection.getMultipleAccountsInfo(pdas.map((entry) => entry.pda));

  const accountInfos = pdas.map((entry, index) => ({
    ...entry,
    info: infos[index],
  }));

  return accountInfos
    .filter((entry) => entry.info)
    .map((entry) => normalizeOnchainItem(coder.decode('shopItem', entry.info!.data)));
}

export async function purchaseOnchainShopItem(
  connection: Connection,
  wallet: Pick<WalletContextState, 'publicKey' | 'sendTransaction' | 'signTransaction' | 'signAllTransactions'>,
  itemId: string
) {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet is not ready');
  }

  const provider = new AnchorProvider(connection, anchorWallet(wallet), {
    commitment: 'confirmed',
  });
  const program = new Program(DUAN_SHOP_IDL as unknown as Idl, provider);
  const [shopConfig] = getShopConfigPda();
  const [shopItem] = getShopItemPda(itemId);
  const [ownedItem] = getOwnedItemPda(wallet.publicKey, itemId);
  const [playerProfile] = getPlayerProfilePda(wallet.publicKey);
  const shopConfigInfo = await program.account.shopConfig.fetch(shopConfig);

  const tx = await program.methods
    .purchaseItem()
    .accounts({
      shopConfig,
      shopItem,
      buyer: wallet.publicKey,
      ownedItem,
      playerProfile,
      treasury: shopConfigInfo.treasury,
      systemProgram: web3.SystemProgram.programId,
    })
    .transaction();

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

export async function fetchOnchainOwnedItems(connection: Connection, owner: web3.PublicKey): Promise<InventoryItem[]> {
  const accountInfos = await Promise.all(
    SHOP_ITEM_CATALOG.map(async (item) => {
      const [pda] = getOwnedItemPda(owner, item.id);
      return { itemId: item.id, pda, info: await connection.getAccountInfo(pda) };
    })
  );

  return accountInfos
    .filter((entry) => entry.info)
    .map((entry) => {
      const account = coder.decode('ownedItem', entry.info!.data) as {
        itemId: string;
        quantity: number;
        totalSpent: BN;
        lastPurchaseAt: BN;
      };
      const metadata = metadataMap().get(account.itemId);

      return {
        id: `onchain:${owner.toBase58()}:${account.itemId}`,
        walletAddress: owner.toBase58(),
        item: {
          id: account.itemId,
          name: metadata?.name ?? account.itemId,
          description: metadata?.description ?? '',
          imageUrl: metadata?.imageUrl ?? '',
          category: metadata?.category ?? 'Onchain',
          rarity: metadata?.rarity ?? 'common',
          price: metadata?.price ?? 0,
          basePrice: metadata?.basePrice ?? metadata?.price ?? 0,
          stock: metadata?.stock ?? 0,
          baseStock: metadata?.baseStock ?? metadata?.stock ?? 0,
          soldCount: metadata?.soldCount ?? 0,
          restockAt: metadata?.restockAt ?? null,
          restockDurationMinutes: metadata?.restockDurationMinutes ?? 15,
        },
        acquiredAt: new Date(Number(account.lastPurchaseAt.toString()) * 1000).toISOString(),
        purchasePrice: Number(account.totalSpent.toString()),
        quantity: Number(account.quantity),
      };
    });
}

export async function fetchOnchainPlayerProfile(connection: Connection, owner: web3.PublicKey) {
  const [pda] = getPlayerProfilePda(owner);
  const info = await connection.getAccountInfo(pda);

  if (!info) {
    return null;
  }

  const account = coder.decode('playerProfile', info.data) as {
    level: number;
    xp: BN;
    xpToNextLevel: BN;
    totalItems: number;
    totalTrades: number;
    achievements: number[];
    lastSyncedAt: BN;
  };

  const achievementCount = (account.achievements ?? []).reduce((count, byte) => {
    let bitCount = 0;
    let value = byte;
    while (value > 0) {
      bitCount += value & 1;
      value >>= 1;
    }
    return count + bitCount;
  }, 0);

  return {
    level: Number(account.level),
    xp: Number(account.xp.toString()),
    xpToNextLevel: Number(account.xpToNextLevel.toString()),
    totalItems: Number(account.totalItems),
    totalTrades: Number(account.totalTrades),
    achievementCount,
    lastSyncedAt: Number(account.lastSyncedAt.toString()),
  };
}

export type UpsertItemArgs = {
  itemId: string;
  basePrice: BN;
  baseStock: number;
  stock: number | null;
  soldCount: BN | null;
  restockAt: BN | null;
  restockDurationSeconds: BN;
  rarity: number;
};
