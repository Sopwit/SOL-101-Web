import anchor, { type Idl } from '@coral-xyz/anchor';
import duanShopIdl from '../target/idl/duan_shop.json' with { type: 'json' };
import { createAnchorProvider } from './solana-runtime.ts';

const PROGRAM_ID = new anchor.web3.PublicKey(duanShopIdl.address);

function getShopConfigPda() {
  return anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('shop-config')], PROGRAM_ID);
}

async function main() {
  const provider = createAnchorProvider();
  anchor.setProvider(provider);
  const gameAuthority = process.env.DUAN_SHOP_GAME_AUTHORITY ?? provider.wallet.publicKey.toBase58();
  const program = new anchor.Program(duanShopIdl as Idl, provider);
  const [shopConfig] = getShopConfigPda();

  const signature = await program.methods.setGameAuthority(
    new anchor.web3.PublicKey(gameAuthority)
  ).accounts({
    shopConfig,
    authority: provider.wallet.publicKey,
  }).rpc();

  console.log(`Updated game authority on ${shopConfig.toBase58()}`);
  console.log(`Signature: ${signature}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
