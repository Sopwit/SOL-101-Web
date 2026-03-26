export interface User {
  walletAddress: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  selectedAvatarId?: string;
  selectedBackgroundId?: string;
  ownedAvatarIds?: string[];
  ownedBackgroundIds?: string[];
  createdAt: string;
}

export interface ForumPost {
  id: string;
  walletAddress: string;
  username?: string;
  title: string;
  content: string;
  originalTitle?: string;
  originalContent?: string;
  imageUrl?: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
  isLiked?: boolean;
  language?: 'tr' | 'en';
  isTranslated?: boolean;
}

export interface ForumComment {
  id: string;
  postId: string;
  walletAddress: string;
  username?: string;
  content: string;
  originalContent?: string;
  createdAt: string;
  language?: 'tr' | 'en';
  isTranslated?: boolean;
}

export interface ForumPostWithComments extends ForumPost {
  comments?: ForumComment[];
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  basePrice?: number;
  rarity: Rarity;
  stock: number;
  baseStock?: number;
  category: string;
  soldCount?: number;
  restockAt?: string | null;
  restockDurationMinutes?: number;
}

export interface InventoryItem {
  id: string;
  walletAddress: string;
  item: ShopItem;
  acquiredAt: string;
  purchasePrice?: number;
  txSignature?: string;
  quantity?: number;
}

export type WantedType = 'token' | 'item' | 'both';
export type ListingStatus = 'active' | 'completed' | 'expired' | 'cancelled';

export interface MarketListing {
  id: string;
  sellerWallet: string;
  sellerUsername?: string;
  offeredItemId?: string;
  offeredItem: ShopItem;
  wantedType: WantedType;
  wantedTokenAmount?: number;
  wantedItemName?: string;
  originalWantedItemName?: string;
  note?: string;
  originalNote?: string;
  expiresAt: string;
  status: ListingStatus;
  createdAt: string;
  language?: 'tr' | 'en';
  isTranslated?: boolean;
}
