import test from 'node:test';
import assert from 'node:assert/strict';
import * as anchor from '@coral-xyz/anchor';
import { DUAN_SHOP_IDL } from '../src/app/lib/onchain/duanShopIdl.ts';
import {
  fetchOnchainOwnedItems,
  fetchOnchainPlayerProfile,
  fetchOnchainShopSnapshot,
  getOwnedItemPda,
  getPlayerProfilePda,
} from '../src/app/lib/onchain/duanShopClient.ts';
import { SHOP_ITEM_CATALOG } from '../shared/shopCatalog.ts';

const { BorshAccountsCoder, BN, web3 } = anchor;
const coder = new BorshAccountsCoder(DUAN_SHOP_IDL);

function createFakeConnection(overrides = {}) {
  return {
    async getAccountInfo(publicKey) {
      return overrides.getAccountInfo?.(publicKey) ?? null;
    },
    async getMultipleAccountsInfo(publicKeys) {
      return overrides.getMultipleAccountsInfo?.(publicKeys) ?? [];
    },
  };
}

async function encodeAccount(name, data) {
  return coder.encode(name, data);
}

test('fetchOnchainShopSnapshot returns program_missing when program is not deployed', async () => {
  const connection = createFakeConnection({
    getAccountInfo: async () => null,
    getMultipleAccountsInfo: async (publicKeys) => publicKeys.map(() => null),
  });

  const snapshot = await fetchOnchainShopSnapshot(connection);
  assert.equal(snapshot.code, 'program_missing');
  assert.equal(snapshot.status, 'degraded');
  assert.equal(snapshot.items.length, 0);
});

test('fetchOnchainShopSnapshot returns shop_uninitialized when config account is missing', async () => {
  let callCount = 0;
  const connection = createFakeConnection({
    getAccountInfo: async () => {
      callCount += 1;
      return callCount === 1 ? { executable: true } : null;
    },
    getMultipleAccountsInfo: async (publicKeys) => publicKeys.map(() => null),
  });

  const snapshot = await fetchOnchainShopSnapshot(connection);
  assert.equal(snapshot.code, 'shop_uninitialized');
  assert.equal(snapshot.status, 'offline');
});

test('fetchOnchainShopSnapshot returns catalog_unsynced when no item accounts exist', async () => {
  let callCount = 0;
  const connection = createFakeConnection({
    getAccountInfo: async () => {
      callCount += 1;
      return callCount <= 2 ? { executable: true, data: new Uint8Array() } : null;
    },
    getMultipleAccountsInfo: async (publicKeys) => publicKeys.map(() => null),
  });

  const snapshot = await fetchOnchainShopSnapshot(connection);
  assert.equal(snapshot.code, 'catalog_unsynced');
  assert.equal(snapshot.status, 'offline');
  assert.equal(snapshot.missingItemIds.length, SHOP_ITEM_CATALOG.length);
});

test('fetchOnchainShopSnapshot returns healthy items when on-chain catalog is present', async () => {
  let accountInfoCalls = 0;
  const shopPublicKey = new web3.PublicKey('11111111111111111111111111111111');
  const allItemBuffers = await Promise.all(
    SHOP_ITEM_CATALOG.map(async (item, index) => ({
      executable: false,
      data: await encodeAccount('ShopItem', {
        shop: shopPublicKey,
        item_id: item.id,
        price: new BN(item.price + index),
        base_price: new BN(item.basePrice ?? item.price),
        stock: Math.max(1, item.stock),
        base_stock: Math.max(1, item.baseStock ?? item.stock),
        sold_count: new BN(index),
        restock_at: new BN(0),
        restock_duration_seconds: new BN(900),
        rarity: 0,
        bump: 254,
      }),
    }))
  );

  const connection = createFakeConnection({
    getAccountInfo: async () => {
      accountInfoCalls += 1;
      if (accountInfoCalls === 1) {
        return { executable: true, data: new Uint8Array() };
      }

      return { executable: false, data: new Uint8Array() };
    },
    getMultipleAccountsInfo: async () => allItemBuffers,
  });

  const snapshot = await fetchOnchainShopSnapshot(connection);
  assert.equal(snapshot.code, 'healthy');
  assert.equal(snapshot.status, 'healthy');
  assert.equal(snapshot.items.length, SHOP_ITEM_CATALOG.length);
  assert.equal(snapshot.items[0].id, SHOP_ITEM_CATALOG[0].id);
  assert.equal(snapshot.items[0].name, SHOP_ITEM_CATALOG[0].name);
  assert.equal(snapshot.items[0].imageUrl, SHOP_ITEM_CATALOG[0].imageUrl);
  assert.equal(snapshot.items[0].stock, Math.max(1, SHOP_ITEM_CATALOG[0].stock));
});

test('fetchOnchainOwnedItems decodes quantity and metadata from owned-item accounts', async () => {
  const owner = web3.Keypair.generate().publicKey;
  const shopPublicKey = new web3.PublicKey('11111111111111111111111111111111');
  const targetItem = SHOP_ITEM_CATALOG[0];
  const [ownedItemPda] = getOwnedItemPda(owner, targetItem.id);
  const ownedItemBuffer = await encodeAccount('OwnedItem', {
    owner,
    shop: shopPublicKey,
    item_id: targetItem.id,
    quantity: 3,
    total_spent: new BN(targetItem.price * 3),
    last_purchase_at: new BN(1_710_000_000),
    bump: 200,
  });

  const connection = createFakeConnection({
    getAccountInfo: async (publicKey) => (
      publicKey.toBase58() === ownedItemPda.toBase58()
        ? { executable: false, data: ownedItemBuffer }
        : null
    ),
  });

  const inventory = await fetchOnchainOwnedItems(connection, owner);
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].item.id, targetItem.id);
  assert.equal(inventory[0].item.name, targetItem.name);
  assert.equal(inventory[0].quantity, 3);
  assert.equal(inventory[0].purchasePrice, targetItem.price * 3);
});

test('fetchOnchainPlayerProfile decodes progression snapshot and achievement count', async () => {
  const owner = web3.Keypair.generate().publicKey;
  const shopPublicKey = new web3.PublicKey('11111111111111111111111111111111');
  const [playerProfilePda] = getPlayerProfilePda(owner);
  const profileBuffer = await encodeAccount('PlayerProfile', {
    owner,
    shop: shopPublicKey,
    level: 7,
    xp: new BN(420),
    xp_to_next_level: new BN(500),
    total_items: 12,
    total_trades: 4,
    achievements: [0b00000111, 0b00000001, ...Array.from({ length: 30 }, () => 0)],
    last_synced_at: new BN(1_710_000_123),
    bump: 99,
  });

  const connection = createFakeConnection({
    getAccountInfo: async (publicKey) => (
      publicKey.toBase58() === playerProfilePda.toBase58()
        ? { executable: false, data: profileBuffer }
        : null
    ),
  });

  const snapshot = await fetchOnchainPlayerProfile(connection, owner);
  assert.equal(snapshot.exists, true);
  assert.equal(snapshot.level, 7);
  assert.equal(snapshot.xp, 420);
  assert.equal(snapshot.xpToNextLevel, 500);
  assert.equal(snapshot.totalItems, 12);
  assert.equal(snapshot.totalTrades, 4);
  assert.equal(snapshot.achievementCount, 4);
  assert.equal(snapshot.lastSyncedAt, 1_710_000_123);
});
