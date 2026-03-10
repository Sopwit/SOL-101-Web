import { ForumPost, ShopItem, MarketListing, InventoryItem } from '../types';

export const mockPosts: ForumPost[] = [
  {
    id: '1',
    walletAddress: '7xKX...9zQp',
    username: 'SolanaWarrior',
    title: 'Just got my first Legendary item! 🎉',
    content: 'After weeks of grinding, finally managed to get the Cosmic Blade! The journey was worth it.',
    imageUrl: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=800&q=80',
    tags: ['#item-showcase', '#achievement'],
    likeCount: 42,
    commentCount: 8,
    createdAt: '2026-03-09T14:30:00Z',
  },
  {
    id: '2',
    walletAddress: 'Bz8M...4kLp',
    username: 'DevnetDegen',
    title: 'My progress after 2 weeks',
    content: 'From zero to hero! Here\'s my collection so far. Special thanks to the community for all the tips!',
    imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80',
    tags: ['#progress'],
    likeCount: 28,
    commentCount: 5,
    createdAt: '2026-03-08T18:15:00Z',
  },
  {
    id: '3',
    walletAddress: '4mNp...7vWq',
    username: 'CryptoCollector',
    title: 'Trading tip: Best time to trade',
    content: 'I\'ve noticed that the market is most active between 6-8 PM UTC. If you\'re looking for specific items, that\'s the best time to check the marketplace.',
    tags: ['#tips', '#trade-request'],
    likeCount: 35,
    commentCount: 12,
    createdAt: '2026-03-07T21:45:00Z',
  },
  {
    id: '4',
    walletAddress: '9pQs...2rTm',
    username: 'NFTHunter',
    title: 'Completed all achievements! 🏆',
    content: 'Finally got 100% completion! The last achievement was the hardest but most rewarding.',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    tags: ['#achievement'],
    likeCount: 67,
    commentCount: 15,
    createdAt: '2026-03-06T10:20:00Z',
  },
];

export const mockShopItems: ShopItem[] = [
  {
    id: '1',
    name: 'Cosmic Blade',
    description: 'A legendary sword forged in the depths of space. Glows with ethereal purple energy.',
    imageUrl: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400&q=80',
    price: 500,
    rarity: 'legendary',
    stock: 3,
    category: 'Weapons',
  },
  {
    id: '2',
    name: 'Stellar Shield',
    description: 'An epic shield that deflects all cosmic attacks. Reinforced with Solana energy.',
    imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80',
    price: 300,
    rarity: 'epic',
    stock: 8,
    category: 'Armor',
  },
  {
    id: '3',
    name: 'Nebula Potion',
    description: 'A rare potion that restores all stats. Tastes like stardust.',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
    price: 150,
    rarity: 'rare',
    stock: 20,
    category: 'Consumables',
  },
  {
    id: '4',
    name: 'Space Helmet',
    description: 'Common protective headgear for space travelers. Basic but reliable.',
    imageUrl: 'https://images.unsplash.com/photo-1617791160536-598cf32026fb?w=400&q=80',
    price: 50,
    rarity: 'common',
    stock: 50,
    category: 'Armor',
  },
  {
    id: '5',
    name: 'Quantum Gauntlets',
    description: 'Epic gloves that enhance your abilities. Made from quantum-entangled materials.',
    imageUrl: 'https://images.unsplash.com/photo-1608481337062-4093bf3ed404?w=400&q=80',
    price: 250,
    rarity: 'epic',
    stock: 12,
    category: 'Armor',
  },
  {
    id: '6',
    name: 'Crystal Amulet',
    description: 'A rare mystical amulet that provides protection. Shimmers with inner light.',
    imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80',
    price: 180,
    rarity: 'rare',
    stock: 15,
    category: 'Accessories',
  },
];

export const mockMarketListings: MarketListing[] = [
  {
    id: '1',
    sellerWallet: '7xKX...9zQp',
    sellerUsername: 'SolanaWarrior',
    offeredItem: mockShopItems[1], // Stellar Shield
    wantedType: 'item',
    wantedItemName: 'Cosmic Blade',
    note: 'Looking to complete my legendary set!',
    expiresAt: '2026-03-11T14:30:00Z',
    status: 'active',
    createdAt: '2026-03-09T14:30:00Z',
  },
  {
    id: '2',
    sellerWallet: 'Bz8M...4kLp',
    sellerUsername: 'DevnetDegen',
    offeredItem: mockShopItems[2], // Nebula Potion
    wantedType: 'token',
    wantedTokenAmount: 200,
    note: 'Quick sale, need tokens fast!',
    expiresAt: '2026-03-12T10:00:00Z',
    status: 'active',
    createdAt: '2026-03-10T08:15:00Z',
  },
  {
    id: '3',
    sellerWallet: '4mNp...7vWq',
    sellerUsername: 'CryptoCollector',
    offeredItem: mockShopItems[4], // Quantum Gauntlets
    wantedType: 'both',
    wantedTokenAmount: 100,
    wantedItemName: 'Crystal Amulet',
    note: 'Will trade for tokens + amulet',
    expiresAt: '2026-03-13T18:00:00Z',
    status: 'active',
    createdAt: '2026-03-09T20:30:00Z',
  },
];

export const mockInventory: InventoryItem[] = [
  {
    id: '1',
    walletAddress: 'current-user',
    item: mockShopItems[3], // Space Helmet
    acquiredAt: '2026-03-05T10:00:00Z',
    txSignature: 'mock-signature-1',
  },
  {
    id: '2',
    walletAddress: 'current-user',
    item: mockShopItems[2], // Nebula Potion
    acquiredAt: '2026-03-06T14:30:00Z',
    txSignature: 'mock-signature-2',
  },
  {
    id: '3',
    walletAddress: 'current-user',
    item: mockShopItems[5], // Crystal Amulet
    acquiredAt: '2026-03-08T09:15:00Z',
    txSignature: 'mock-signature-3',
  },
];
