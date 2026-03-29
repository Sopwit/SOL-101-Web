import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHOP_ITEM_CATALOG, LEGACY_SHOP_ITEM_IDS } from "../shared/shopCatalog.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");
const unityRoot = path.resolve(webRoot, "..", "SOL-101-Unity");

const generatedAt = new Date().toISOString();

const manifest = {
  version: 1,
  generatedAt,
  source: "shared/shopCatalog.ts",
  schema: "shop-metadata.schema.json",
  items: SHOP_ITEM_CATALOG.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    rarity: item.rarity,
    imageUrl: item.imageUrl,
    version: 1,
    updatedAt: generatedAt,
  })),
  legacyIds: LEGACY_SHOP_ITEM_IDS,
};

const webOutputDir = path.join(webRoot, "public", "generated");
const unityOutputDir = path.join(unityRoot, "Assets", "StreamingAssets");

fs.mkdirSync(webOutputDir, { recursive: true });
fs.mkdirSync(unityOutputDir, { recursive: true });

fs.writeFileSync(
  path.join(webOutputDir, "shop-metadata-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

fs.writeFileSync(
  path.join(unityOutputDir, "shop-metadata.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log("Shop metadata snapshot exported.");
console.log(`Web: ${path.join(webOutputDir, "shop-metadata-manifest.json")}`);
console.log(`Unity: ${path.join(unityOutputDir, "shop-metadata.json")}`);
