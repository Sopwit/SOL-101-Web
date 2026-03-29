import type { InventoryItem, MarketListing } from '../types';

export function mergeInventorySources(onchainInventory: InventoryItem[], backendInventory: InventoryItem[]) {
  const merged = new Map<string, InventoryItem>();

  for (const item of backendInventory) {
    const key = item.item?.id ? `item:${item.item.id}` : `entry:${item.id}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, item);
      continue;
    }

    merged.set(key, {
      ...existing,
      item: item.item ?? existing.item,
      quantity: (existing.quantity ?? 1) + (item.quantity ?? 1),
      acquiredAt: new Date(existing.acquiredAt).getTime() >= new Date(item.acquiredAt).getTime()
        ? existing.acquiredAt
        : item.acquiredAt,
    });
  }

  for (const item of onchainInventory) {
    const key = item.item?.id ? `item:${item.item.id}` : `entry:${item.id}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, item);
      continue;
    }

    merged.set(key, {
      ...existing,
      ...item,
      item: item.item ?? existing.item,
      quantity: Math.max(item.quantity ?? 1, existing.quantity ?? 1),
      acquiredAt: item.acquiredAt || existing.acquiredAt,
    });
  }

  return Array.from(merged.values()).sort((left, right) =>
    new Date(right.acquiredAt).getTime() - new Date(left.acquiredAt).getTime(),
  );
}

export function getActiveReservedQuantity(itemId: string, listings: MarketListing[]) {
  return listings.reduce((count, listing) => {
    if (listing.status !== 'active') {
      return count;
    }

    return listing.offeredItem?.id === itemId ? count + 1 : count;
  }, 0);
}

export function buildMarketAvailableInventoryItems(inventory: InventoryItem[], listings: MarketListing[]) {
  return inventory
    .map((entry) => {
      const quantity = entry.quantity ?? 1;
      const reservedQuantity = getActiveReservedQuantity(entry.item.id, listings);
      const availableQuantity = Math.max(0, quantity - reservedQuantity);

      return {
        ...entry,
        reservedQuantity,
        availableQuantity,
      };
    })
    .filter((entry) => entry.availableQuantity > 0);
}
