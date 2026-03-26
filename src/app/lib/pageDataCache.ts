import type { MarketListing, ShopItem, ForumPost, ForumComment, InventoryItem, User } from '../types';

type TokenInfoCache = {
  symbol: string;
  name: string;
  price: number;
  priceUsd?: number;
  solUsdPrice?: number;
  priceSource?: string;
  livePricing?: boolean;
  totalSupply: number;
  circulatingSupply: number;
  lastUpdated: string;
};

export const pageDataCache: {
  home: {
    stats: {
      totalProfiles: number;
      onlineUsers: number;
      totalItems: number;
      completedTrades: number;
    } | null;
    tokenInfo: TokenInfoCache | null;
    runtime: {
      cluster: string;
      rpcReachable: boolean;
      programDeployed: boolean;
      shopConfigInitialized: boolean;
    } | null;
    onchainCatalog: {
      itemCount: number;
      status: string;
      code: string;
      missingItemIds: string[];
    } | null;
    lastUpdatedAt: number | null;
  };
  shop: {
    items: ShopItem[];
    tokenInfo: TokenInfoCache | null;
    usingFallbackCatalog: boolean;
  };
  forum: {
    posts: ForumPost[];
    filter: string | null;
    language: string | null;
    commentsByPost: Record<string, ForumComment[]>;
  };
  market: {
    listings: MarketListing[];
    myListings: MarketListing[];
    language: string | null;
  };
  profile: {
    walletAddress: string | null;
    profile: User | null;
    stats: {
      level: number;
      xp: number;
      xpToNextLevel: number;
      totalPosts: number;
      totalItems: number;
      totalTrades: number;
      rewardDuanBalance: number;
      rewardSolBalance: number;
      rewardDuanEarned: number;
      rewardSolEarned: number;
      achievements: Array<{
        id: string;
        name: string;
        description: string;
        icon: string;
        rewardDuan?: number;
        rewardSol?: number;
        unlockedAt: string;
      }>;
    } | null;
    inventory: InventoryItem[];
  };
} = {
  home: {
    stats: null,
    tokenInfo: null,
    runtime: null,
    onchainCatalog: null,
    lastUpdatedAt: null,
  },
  shop: {
    items: [],
    tokenInfo: null,
    usingFallbackCatalog: false,
  },
  forum: {
    posts: [],
    filter: null,
    language: null,
    commentsByPost: {},
  },
  market: {
    listings: [],
    myListings: [],
    language: null,
  },
  profile: {
    walletAddress: null,
    profile: null,
    stats: null,
    inventory: [],
  },
};
