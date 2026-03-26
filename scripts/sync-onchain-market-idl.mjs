import { Console } from 'node:console';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const console = new Console(process.stdout, process.stderr);

const source = resolve('target/idl/duan_market.json');
const destination = resolve('src/app/lib/onchain/duan_market.json');

if (!existsSync(source)) {
  console.error(`IDL not found: ${source}`);
  console.error('Run `anchor build` before syncing the market frontend IDL.');
  process.exit(1);
}

copyFileSync(source, destination);
console.log(`Synced market IDL to ${destination}`);
