import anchor, { type Idl } from '@coral-xyz/anchor';
import duanShopIdl from '../target/idl/duan_shop.json' with { type: 'json' };
import { SHOP_ITEM_CATALOG } from '../shared/shopCatalog.ts';
import { createAnchorProvider } from './solana-runtime.ts';

// Bu betik ortak shop katalogunu Anchor programina yazar. Runtime frontend
// verisi ile on-chain item tanimlarinin ayni kaynakta kalmasi icin kullanilir.
const PROGRAM_ID = new anchor.web3.PublicKey(duanShopIdl.address);

const rarityMap = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
} as const;

function getShopConfigPda() {
  return anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('shop-config')], PROGRAM_ID);
}

function getShopItemPda(itemId: string) {
  const [shopConfig] = getShopConfigPda();
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('item'), shopConfig.toBuffer(), Buffer.from(itemId)],
    PROGRAM_ID
  );
}

async function main() {
  const provider = createAnchorProvider();
  anchor.setProvider(provider);
  const program = new anchor.Program(duanShopIdl as Idl, provider);
  // Treasury verilmezse deploy eden wallet fallback olarak kullanilir.
  const treasury = process.env.DUAN_SHOP_TREASURY ?? provider.wallet.publicKey.toBase58();
  const expectedProgramId = process.env.DUAN_SHOP_PROGRAM_ID;
  const [shopConfig] = getShopConfigPda();

  if (expectedProgramId && expectedProgramId !== PROGRAM_ID.toBase58()) {
    throw new Error(
      `DUAN_SHOP_PROGRAM_ID mismatch. Env=${expectedProgramId} IDL=${PROGRAM_ID.toBase58()}`
    );
  }

  try {
    await program.methods.initializeShop().accounts({
      shopConfig,
      authority: provider.wallet.publicKey,
      treasury: new anchor.web3.PublicKey(treasury),
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();
    console.log(`Initialized shop config ${shopConfig.toBase58()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('already in use')) {
      throw error;
    }
    console.log(`Shop config ${shopConfig.toBase58()} already exists`);
  }

  for (const item of SHOP_ITEM_CATALOG) {
    const [shopItem] = getShopItemPda(item.id);

    await program.methods.upsertItem({
      itemId: item.id,
      basePrice: new anchor.BN(item.basePrice ?? item.price),
      baseStock: item.baseStock ?? item.stock,
      stock: null,
      soldCount: null,
      restockAt: null,
      restockDurationSeconds: new anchor.BN((item.restockDurationMinutes ?? 20) * 60),
      rarity: rarityMap[item.rarity],
    }).accounts({
      shopConfig,
      authority: provider.wallet.publicKey,
      shopItem,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    console.log(`Upserted ${item.id} -> ${shopItem.toBase58()}`);
  }

  console.log(`Synced ${SHOP_ITEM_CATALOG.length} shop items to ${PROGRAM_ID.toBase58()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
