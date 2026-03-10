export interface User {
  walletAddress: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface ForumPost {
  id: string;
  walletAddress: string;
  username?: string;
  title: string;
  content: string;
  imageUrl?: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
  isLiked?: boolean;
}

export interface ForumComment {
  id: string;
  postId: string;
  walletAddress: string;
  username?: string;
  content: string;
  createdAt: string;
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  rarity: Rarity;
  stock: number;
  category: string;
}

export interface InventoryItem {
  id: string;
  walletAddress: string;
  item: ShopItem;
  acquiredAt: string;
  txSignature?: string;
}

export type WantedType = 'token' | 'item' | 'both';
export type ListingStatus = 'active' | 'completed' | 'expired' | 'cancelled';

export interface MarketListing {
  id: string;
  sellerWallet: string;
  sellerUsername?: string;
  offeredItem: ShopItem;
  wantedType: WantedType;
  wantedTokenAmount?: number;
  wantedItemName?: string;
  note?: string;
  expiresAt: string;
  status: ListingStatus;
  createdAt: string;
}
