import * as anchor from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { Connection } from '@solana/web3.js';
import { SHOP_ITEM_CATALOG } from '../../../../shared/shopCatalog.ts';
import type { InventoryItem, ShopItem } from '../../types.ts';
import { DUAN_SHOP_IDL, DUAN_SHOP_PROGRAM_ID } from './duanShopIdl.ts';

const { AnchorProvider, BorshAccountsCoder, Program, web3 } = anchor;
const PROGRAM_ID = new web3.PublicKey(DUAN_SHOP_PROGRAM_ID);
const coder = new BorshAccountsCoder(DUAN_SHOP_IDL as unknown as Idl);

export type OnchainShopSnapshotCode =
  | 'healthy'
  | 'program_missing'
  | 'shop_uninitialized'
  | 'catalog_unsynced'
  | 'catalog_partial'
  | 'rpc_unreachable'
  | 'decode_failed';

export interface OnchainShopSnapshot {
  items: ShopItem[];
  status: 'healthy' | 'degraded' | 'offline';
  code: OnchainShopSnapshotCode;
  message: string;
  missingItemIds: string[];
}

export interface OnchainPlayerProfileSnapshot {
  exists: boolean;
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalItems: number;
  totalTrades: number;
  achievementCount: number;
  lastSyncedAt: number | null;
}

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

function readAccountField<T>(account: Record<string, unknown>, camelCase: string, snakeCase: string) {
  const value = account[camelCase];
  if (value !== undefined) {
    return value as T;
  }

  return account[snakeCase] as T;
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

function normalizeOnchainItem(account: Record<string, unknown>): ShopItem {
  const itemId = String(readAccountField(account, 'itemId', 'item_id') ?? '');
  const metadata = metadataMap().get(itemId);
  const basePrice = Number(readAccountField(account, 'basePrice', 'base_price')?.toString() ?? 0);
  const price = Number(readAccountField(account, 'price', 'price')?.toString() ?? basePrice);
  const stock = Number(readAccountField(account, 'stock', 'stock') ?? 0);
  const baseStock = Number(readAccountField(account, 'baseStock', 'base_stock') ?? stock);
  const soldCount = Number(readAccountField(account, 'soldCount', 'sold_count')?.toString() ?? 0);
  const restockAtSeconds = Number(readAccountField(account, 'restockAt', 'restock_at')?.toString() ?? 0);
  const restockAt = restockAtSeconds > 0 ? new Date(restockAtSeconds * 1000).toISOString() : null;
  const restockDurationSeconds = Number(readAccountField(account, 'restockDurationSeconds', 'restock_duration_seconds')?.toString() ?? 0);
  const restockDurationMinutes = Math.max(1, Math.round(restockDurationSeconds / 60));

  const nowSeconds = Math.floor(Date.now() / 1000);
  const shouldDisplayRestocked = stock === 0 && restockAtSeconds > 0 && restockAtSeconds <= nowSeconds;

  return {
    id: itemId,
    name: metadata?.name ?? itemId,
    description: metadata?.description ?? '',
    imageUrl: metadata?.imageUrl ?? '',
    category: metadata?.category ?? 'Onchain',
    rarity: metadata?.rarity ?? 'common',
    price,
    basePrice,
    stock: shouldDisplayRestocked ? baseStock : stock,
    baseStock,
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
    .map((entry) => normalizeOnchainItem(coder.decode('ShopItem', entry.info!.data)));
}

function classifyOnchainError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Bilinmeyen zincir hatasi';
  const lower = message.toLowerCase();

  if (
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('403') ||
    lower.includes('429') ||
    lower.includes('503')
  ) {
    return {
      status: 'offline' as const,
      code: 'rpc_unreachable' as const,
      message: 'On-chain veri alinamadi. RPC ulasilamiyor veya gecici olarak cevap vermiyor.',
    };
  }

  return {
    status: 'offline' as const,
    code: 'decode_failed' as const,
    message: `On-chain shop hesaplari okunurken hata alindi: ${message}`,
  };
}

export async function fetchOnchainShopSnapshot(connection: Connection): Promise<OnchainShopSnapshot> {
  try {
    const [shopConfig] = getShopConfigPda();
    const pdas = SHOP_ITEM_CATALOG.map((item) => {
      const [pda] = getShopItemPda(item.id);
      return { itemId: item.id, pda };
    });

    const [programInfo, shopConfigInfo, accountInfos] = await Promise.all([
      connection.getAccountInfo(PROGRAM_ID).catch(() => null),
      connection.getAccountInfo(shopConfig).catch(() => null),
      connection.getMultipleAccountsInfo(pdas.map((entry) => entry.pda)).catch(() => []),
    ]);

    if (!shopConfigInfo) {
      if (!programInfo?.executable) {
        return {
          items: [],
          status: 'degraded',
          code: 'program_missing',
          message: 'Devnet shop programi veya config hesabi bu RPC uzerinden dogrulanamadi. Sistem tekrar kontrol edilmeli.',
          missingItemIds: SHOP_ITEM_CATALOG.map((item) => item.id),
        };
      }

      return {
        items: [],
        status: 'offline',
        code: 'shop_uninitialized',
        message: 'On-chain shop config hesabi bulunamadi. initialize_shop adimi eksik olabilir.',
        missingItemIds: SHOP_ITEM_CATALOG.map((item) => item.id),
      };
    }

    const entries = pdas.map((entry, index) => ({
      ...entry,
      info: accountInfos[index],
    }));

    const presentEntries = entries.filter((entry) => entry.info);
    const missingItemIds = entries
      .filter((entry) => !entry.info)
      .map((entry) => entry.itemId);

    if (presentEntries.length === 0) {
      return {
        items: [],
        status: 'offline',
        code: 'catalog_unsynced',
        message: 'On-chain magaza item hesaplari bulunamadi. sync-shop adimi eksik olabilir.',
        missingItemIds,
      };
    }

    const items = presentEntries.map((entry) => normalizeOnchainItem(coder.decode('ShopItem', entry.info!.data)));

    if (missingItemIds.length > 0) {
      return {
        items,
        status: 'degraded',
        code: 'catalog_partial',
        message: `${missingItemIds.length} item on-chain katalogda eksik. Gosterim kisitli calisiyor.`,
        missingItemIds,
      };
    }

    return {
      items,
      status: 'healthy',
      code: 'healthy',
      message: 'On-chain magaza katalogu aktif.',
      missingItemIds: [],
    };
  } catch (error) {
    const classified = classifyOnchainError(error);
    return {
      items: [],
      ...classified,
      missingItemIds: SHOP_ITEM_CATALOG.map((item) => item.id),
    };
  }
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
      const account = coder.decode('OwnedItem', entry.info!.data) as Record<string, unknown>;
      const itemId = String(readAccountField(account, 'itemId', 'item_id') ?? entry.itemId);
      const quantity = Number(readAccountField(account, 'quantity', 'quantity') ?? 0);
      const totalSpent = Number(readAccountField(account, 'totalSpent', 'total_spent')?.toString() ?? 0);
      const lastPurchaseAt = Number(readAccountField(account, 'lastPurchaseAt', 'last_purchase_at')?.toString() ?? 0);
      const metadata = metadataMap().get(itemId);

      return {
        id: `onchain:${owner.toBase58()}:${itemId}`,
        walletAddress: owner.toBase58(),
        item: {
          id: itemId,
          name: metadata?.name ?? itemId,
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
        acquiredAt: new Date(lastPurchaseAt * 1000).toISOString(),
        purchasePrice: totalSpent,
        quantity,
      };
    });
}

export async function fetchOnchainPlayerProfile(
  connection: Connection,
  owner: web3.PublicKey
): Promise<OnchainPlayerProfileSnapshot> {
  const [pda] = getPlayerProfilePda(owner);
  const info = await connection.getAccountInfo(pda);

  if (!info) {
    return {
      exists: false,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      totalItems: 0,
      totalTrades: 0,
      achievementCount: 0,
      lastSyncedAt: null,
    };
  }

  const account = coder.decode('PlayerProfile', info.data) as Record<string, unknown>;
  const achievements = (readAccountField<number[]>(account, 'achievements', 'achievements') ?? []) as number[];

  const achievementCount = achievements.reduce((count, byte) => {
    let bitCount = 0;
    let value = byte;
    while (value > 0) {
      bitCount += value & 1;
      value >>= 1;
    }
    return count + bitCount;
  }, 0);

  return {
    exists: true,
    level: Number(readAccountField(account, 'level', 'level') ?? 1),
    xp: Number(readAccountField(account, 'xp', 'xp')?.toString() ?? 0),
    xpToNextLevel: Number(readAccountField(account, 'xpToNextLevel', 'xp_to_next_level')?.toString() ?? 100),
    totalItems: Number(readAccountField(account, 'totalItems', 'total_items') ?? 0),
    totalTrades: Number(readAccountField(account, 'totalTrades', 'total_trades') ?? 0),
    achievementCount,
    lastSyncedAt: Number(readAccountField(account, 'lastSyncedAt', 'last_synced_at')?.toString() ?? 0),
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
