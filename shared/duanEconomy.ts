type CatalogPriceTarget = {
  id: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category?: string;
};

// Uygulama genelindeki ekonomik gosterimler ve katalog fiyatlari tek kaynaktan
// hesaplanir. Frontend/backend ayrik sabit tutmamaya dikkat edilir.
export const DUAN_TO_SOL_RATE = 0.00001;
export const MATERIAL_ITEM_DUAN_PRICE = 120;
export const BASIC_ITEM_DUAN_PRICE = 240;
export const STANDARD_ITEM_DUAN_PRICE = 520;
export const COMBAT_ITEM_DUAN_PRICE = 980;
export const ELITE_COMBAT_ITEM_DUAN_PRICE = 1480;
export const LEGENDARY_ITEM_DUAN_PRICE = 2450;
export const GOLD_ITEM_DUAN_PRICE = 1750;
export const BERSERKER_ITEM_DUAN_PRICE = 3200;

export function classifyCatalogPriceTier(item: CatalogPriceTarget) {
  if (item.id === 'berserkerarmor') {
    return 'berserker';
  }

  if (item.id.startsWith('altin')) {
    return 'gold';
  }

  if (item.rarity === 'common') {
    if (item.category === 'Materials') {
      return 'material';
    }
    return 'basic';
  }

  if (item.rarity === 'legendary') {
    return 'legendary';
  }

  if (item.category === 'Weapons' || item.category === 'Armor') {
    return item.rarity === 'epic' ? 'elite-combat' : 'combat';
  }

  if (item.category === 'Accessories' || item.category === 'Consumables') {
    return item.rarity === 'epic' ? 'combat' : 'standard';
  }

  return 'standard';
}

export function getCatalogBaseDuanPrice(item: CatalogPriceTarget) {
  const tier = classifyCatalogPriceTier(item);

  switch (tier) {
    case 'material':
      return MATERIAL_ITEM_DUAN_PRICE;
    case 'berserker':
      return BERSERKER_ITEM_DUAN_PRICE;
    case 'gold':
      return GOLD_ITEM_DUAN_PRICE;
    case 'legendary':
      return LEGENDARY_ITEM_DUAN_PRICE;
    case 'elite-combat':
      return ELITE_COMBAT_ITEM_DUAN_PRICE;
    case 'combat':
      return COMBAT_ITEM_DUAN_PRICE;
    case 'basic':
      return BASIC_ITEM_DUAN_PRICE;
    default:
      return STANDARD_ITEM_DUAN_PRICE;
  }
}

export function duanToSol(duanAmount: number) {
  return duanAmount * DUAN_TO_SOL_RATE;
}

export function formatDuanAmount(duanAmount: number) {
  return `${Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(duanAmount)} DUAN`;
}

export function formatSolAmount(solAmount: number) {
  return `${Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(solAmount)} SOL`;
}

export function formatDuanWithSol(duanAmount: number) {
  return `${formatDuanAmount(duanAmount)} • ${formatSolAmount(duanToSol(duanAmount))}`;
}
