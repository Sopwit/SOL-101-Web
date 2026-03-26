import type { User, ForumPost, ForumComment, ShopItem, MarketListing, InventoryItem } from '../types';
import { resolveAssetUrl } from '../lib/assetUrls';
import { reportError, reportEvent } from '../lib/telemetry';

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const functionPath = 'make-server-5d6242bb';
const API_BASE_URL = projectId
  ? `https://${projectId}.supabase.co/functions/v1/${functionPath}`
  : '';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ApiHealthResponse {
  status: string;
  service: string;
  env: Record<string, boolean>;
  database: {
    connected: boolean;
    table: string;
    error?: string;
  };
  solana: {
    cluster: 'devnet';
    rpcUrl: string;
    rpcReachable: boolean;
    latestSlot: number | null;
    programId: string;
    programDeployed: boolean;
    shopConfig: string;
    shopConfigInitialized: boolean;
    gameAuthoritySecretPresent: boolean;
    gameAuthorityReady: boolean;
    playerProfileSyncReady: boolean;
    providerError?: string;
    rpcError?: string;
  };
  timestamp: string;
}

export function normalizeHealthResponse(value: ApiHealthResponse | null | undefined): ApiHealthResponse | null {
  if (!value) {
    return null;
  }

  return {
    status: value.status || 'error',
    service: value.service || 'DUAN Edge Functions',
    env: value.env || {},
    database: {
      connected: Boolean(value.database?.connected),
      table: value.database?.table || 'unknown',
      error: value.database?.error,
    },
    solana: {
      cluster: value.solana?.cluster || 'devnet',
      rpcUrl: value.solana?.rpcUrl || 'https://api.devnet.solana.com',
      rpcReachable: Boolean(value.solana?.rpcReachable),
      latestSlot: typeof value.solana?.latestSlot === 'number' ? value.solana.latestSlot : null,
      programId: value.solana?.programId || '',
      programDeployed: Boolean(value.solana?.programDeployed),
      shopConfig: value.solana?.shopConfig || '',
      shopConfigInitialized: Boolean(value.solana?.shopConfigInitialized),
      gameAuthoritySecretPresent: Boolean(value.solana?.gameAuthoritySecretPresent),
      gameAuthorityReady: Boolean(value.solana?.gameAuthorityReady),
      playerProfileSyncReady: Boolean(value.solana?.playerProfileSyncReady),
      providerError: value.solana?.providerError,
      rpcError: value.solana?.rpcError,
    },
    timestamp: value.timestamp || new Date().toISOString(),
  };
}

export interface WalletAuthHeaders {
  walletAddress: string;
  message: string;
  signature: string;
}

export interface AdminSession {
  token: string;
  walletAddress: string;
  expiresAt: string;
}

export interface AdminOverviewResponse {
  summary: {
    users: number;
    posts: number;
    activeListings: number;
    pendingTrades: number;
  };
  recentPosts: ForumPost[];
  recentListings: MarketListing[];
  recentTrades: Array<{
    id: string;
    listingId: string;
    buyerWallet: string;
    status: string;
    createdAt: string;
    marketMode?: string;
    txSignature?: string | null;
  }>;
  tokenInfo: {
    symbol: string;
    name: string;
    price: number;
    totalSupply: number;
    circulatingSupply: number;
    lastUpdated: string;
  } | null;
  checkedAt: string;
}

export interface AdminUserRecord {
  profile: User;
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
    achievements: Array<{ id?: string; name?: string } | string>;
  };
}

export interface AdminAuditLog {
  id: string;
  action: string;
  walletAddress: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function normalizeResponseAssets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeResponseAssets(entry)) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
    if ((key === 'imageUrl' || key === 'avatarUrl') && typeof entryValue === 'string') {
      return [key, resolveAssetUrl(entryValue)];
    }

    return [key, normalizeResponseAssets(entryValue)];
  });

  return Object.fromEntries(entries) as T;
}

class ApiService {
  private getConfigError(): string | null {
    if (!projectId) return 'Supabase project ID eksik. VITE_SUPABASE_PROJECT_ID tanimlanmali.';
    if (!publicAnonKey) return 'Supabase anon key eksik. VITE_SUPABASE_ANON_KEY tanimlanmali.';
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    walletAuth?: WalletAuthHeaders,
    adminToken?: string,
  ): Promise<ApiResponse<T>> {
    const configError = this.getConfigError();
    if (configError) {
      reportEvent('error', `api:${endpoint}`, configError);
      return { success: false, error: configError };
    }

    try {
      const url = `${API_BASE_URL}${endpoint}`;
      console.log(`API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          ...(walletAuth
            ? {
                'x-wallet-address': walletAuth.walletAddress,
                'x-wallet-message': walletAuth.message,
                'x-wallet-signature': walletAuth.signature,
              }
            : {}),
          ...(adminToken
            ? {
                'x-admin-token': adminToken,
              }
            : {}),
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        reportEvent('error', `api:${endpoint}`, errorData.error || 'Bir hata olustu', JSON.stringify(errorData));
        return { success: false, error: errorData.error || 'Bir hata oluştu' };
      }

      const data = normalizeResponseAssets(await response.json() as T);
      return { success: true, data };
    } catch (error) {
      reportError(`api:${endpoint}`, error, 'Baglanti hatasi');
      return { success: false, error: 'Bağlantı hatası - Server çalışmıyor olabilir' };
    }
  }

  async getHealth(): Promise<ApiResponse<ApiHealthResponse>> {
    const response = await this.request<ApiHealthResponse>(`/health`, { method: 'GET' });

    if (!response.success) {
      return response;
    }

    return {
      ...response,
      data: normalizeHealthResponse(response.data),
    };
  }

  async createAdminSession(walletAuth: WalletAuthHeaders): Promise<ApiResponse<AdminSession>> {
    return this.request(`/admin/session`, { method: 'POST' }, walletAuth);
  }

  // Profile API
  async getProfile(walletAddress: string): Promise<ApiResponse<User>> {
    return this.request(`/profile/${walletAddress}`, { method: 'GET' });
  }

  async updateProfile(walletAddress: string, data: Partial<User>, walletAuth?: WalletAuthHeaders): Promise<ApiResponse<User>> {
    return this.request(`/profile/${walletAddress}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, walletAuth);
  }

  async unlockProfileCosmetic(
    walletAddress: string,
    data: { slot: 'avatar' | 'background'; cosmeticId: string },
    walletAuth?: WalletAuthHeaders
  ): Promise<ApiResponse<{ profile: User; stats: {
    rewardDuanBalance: number;
    rewardSolBalance: number;
    rewardDuanEarned: number;
    rewardSolEarned: number;
  } }>> {
    return this.request(`/profile/${walletAddress}/cosmetics/unlock`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, walletAuth);
  }

  async getProfileStats(walletAddress: string): Promise<ApiResponse<{
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
  }>> {
    return this.request(`/profile/${walletAddress}/stats`, { method: 'GET' });
  }

  // Inventory API
  async getInventory(walletAddress: string): Promise<ApiResponse<InventoryItem[]>> {
    return this.request(`/inventory/${walletAddress}`, { method: 'GET' });
  }

  async addToInventory(walletAddress: string, itemId: string): Promise<ApiResponse<InventoryItem>> {
    return this.request(`/inventory/${walletAddress}`, {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    });
  }

  // Forum API
  async getPosts(filters?: { tag?: string; sort?: string; walletAddress?: string; language?: string }): Promise<ApiResponse<ForumPost[]>> {
    const params = new URLSearchParams();
    if (filters?.tag) params.append('tag', filters.tag);
    if (filters?.sort) params.append('sort', filters.sort);
    if (filters?.walletAddress) params.append('walletAddress', filters.walletAddress);
    if (filters?.language) params.append('language', filters.language);
    
    return this.request(`/forum/posts?${params.toString()}`, { method: 'GET' });
  }

  async createPost(walletAddress: string, data: {
    title: string;
    content: string;
    imageUrl?: string;
    tags: string[];
  }, walletAuth?: WalletAuthHeaders): Promise<ApiResponse<ForumPost>> {
    return this.request(`/forum/posts`, {
      method: 'POST',
      body: JSON.stringify({ ...data, walletAddress }),
    }, walletAuth);
  }

  async likePost(postId: string, walletAddress: string, walletAuth?: WalletAuthHeaders): Promise<ApiResponse<{ liked: boolean; likeCount: number }>> {
    return this.request(`/forum/posts/${postId}/like`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress }),
    }, walletAuth);
  }

  async deletePost(postId: string, walletAddress: string, walletAuth?: WalletAuthHeaders): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request(`/forum/posts/${postId}`, {
      method: 'DELETE',
      body: JSON.stringify({ walletAddress }),
    }, walletAuth);
  }

  async getComments(postId: string, language?: string): Promise<ApiResponse<ForumComment[]>> {
    const params = new URLSearchParams();
    if (language) params.append('language', language);
    const suffix = params.toString();
    return this.request(`/forum/posts/${postId}/comments${suffix ? `?${suffix}` : ''}`, { method: 'GET' });
  }

  async createComment(
    postId: string,
    walletAddress: string,
    data: { content: string },
    walletAuth?: WalletAuthHeaders
  ): Promise<ApiResponse<ForumComment>> {
    return this.request(`/forum/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress, ...data }),
    }, walletAuth);
  }

  async getPostsByWallet(walletAddress: string): Promise<ApiResponse<ForumPost[]>> {
    return this.request(`/forum/posts/user/${walletAddress}`, { method: 'GET' });
  }

  // Shop API
  async getShopItems(filters?: { rarity?: string; search?: string }): Promise<ApiResponse<ShopItem[]>> {
    const params = new URLSearchParams();
    if (filters?.rarity) params.append('rarity', filters.rarity);
    if (filters?.search) params.append('search', filters.search);
    
    return this.request(`/shop/items?${params.toString()}`, { method: 'GET' });
  }

  async purchaseItem(walletAddress: string, itemId: string, walletAuth?: WalletAuthHeaders): Promise<ApiResponse<{
    transaction: string;
    item: InventoryItem;
  }>> {
    return this.request(`/shop/purchase`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress, itemId }),
    }, walletAuth);
  }

  // Market API
  async getMarketListings(filters?: { status?: string; language?: string }): Promise<ApiResponse<MarketListing[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.language) params.append('language', filters.language);
    
    return this.request(`/market/listings?${params.toString()}`, { method: 'GET' });
  }

  async createListing(walletAddress: string, data: {
    offeredItemId: string;
    wantedType: 'token' | 'item' | 'both';
    wantedTokenAmount?: number;
    wantedItemName?: string;
    note?: string;
    duration: number; // hours
    marketMode?: 'backend' | 'hybrid' | 'onchain';
    onchainListingPda?: string;
    onchainProgramId?: string;
    txSignature?: string;
    expiresAt?: string;
    listingNonce?: string;
  }, walletAuth?: WalletAuthHeaders): Promise<ApiResponse<MarketListing>> {
    return this.request(`/market/listings`, {
      method: 'POST',
      body: JSON.stringify({ ...data, sellerWallet: walletAddress }),
    }, walletAuth);
  }

  async createTradeOffer(listingId: string, walletAddress: string, data: {
    offeredItemId?: string;
    offeredTokenAmount?: number;
    marketMode?: 'backend' | 'hybrid' | 'onchain';
    onchainTradeIntentPda?: string;
    onchainProgramId?: string;
    txSignature?: string;
  }, walletAuth?: WalletAuthHeaders): Promise<ApiResponse<{ tradeId: string }>> {
    return this.request(`/market/listings/${listingId}/trade`, {
      method: 'POST',
      body: JSON.stringify({ ...data, buyerWallet: walletAddress }),
    }, walletAuth);
  }

  async getListingsByWallet(walletAddress: string, language?: string): Promise<ApiResponse<MarketListing[]>> {
    const params = new URLSearchParams();
    if (language) params.append('language', language);
    const suffix = params.toString();
    return this.request(`/market/listings/user/${walletAddress}${suffix ? `?${suffix}` : ''}`, { method: 'GET' });
  }

  async cancelListing(listingId: string, walletAddress: string, walletAuth?: WalletAuthHeaders): Promise<ApiResponse<{ cancelled: boolean }>> {
    return this.request(`/market/listings/${listingId}`, {
      method: 'DELETE',
      body: JSON.stringify({ walletAddress }),
    }, walletAuth);
  }

  // Game Integration Webhooks
  async syncGameData(walletAddress: string, gameData: {
    level?: number;
    xp?: number;
    achievements?: string[];
    itemsEarned?: string[];
  }): Promise<ApiResponse<{ synced: boolean }>> {
    return this.request(`/game/sync`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress, ...gameData }),
    });
  }

  async triggerGameEvent(walletAddress: string, eventType: string, eventData: unknown): Promise<ApiResponse<{ processed: boolean }>> {
    return this.request(`/game/event`, {
      method: 'POST',
      body: JSON.stringify({ walletAddress, eventType, eventData }),
    });
  }

  // Platform Statistics
  async getPlatformStats(): Promise<ApiResponse<{
    totalProfiles: number;
    activeUsers: number;
    totalItems: number;
    completedTrades: number;
    lastUpdated: string;
  }>> {
    return this.request(`/stats/platform`, { method: 'GET' });
  }

  // Token Information
  async getTokenInfo(): Promise<ApiResponse<{
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
  }>> {
    return this.request(`/token/info`, { method: 'GET' });
  }

  async getAdminOverview(adminToken: string): Promise<ApiResponse<AdminOverviewResponse>> {
    return this.request(`/admin/overview`, { method: 'GET' }, undefined, adminToken);
  }

  async getAdminUsers(adminToken: string): Promise<ApiResponse<AdminUserRecord[]>> {
    return this.request(`/admin/users`, { method: 'GET' }, undefined, adminToken);
  }

  async getAdminForumPosts(adminToken: string): Promise<ApiResponse<ForumPost[]>> {
    return this.request(`/admin/forum/posts`, { method: 'GET' }, undefined, adminToken);
  }

  async adminDeletePost(postId: string, adminToken: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request(`/admin/forum/posts/${postId}`, { method: 'DELETE' }, undefined, adminToken);
  }

  async getAdminForumComments(adminToken: string): Promise<ApiResponse<Array<ForumComment & { postTitle?: string }>>> {
    return this.request(`/admin/forum/comments`, { method: 'GET' }, undefined, adminToken);
  }

  async adminDeleteComment(postId: string, commentId: string, adminToken: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request(`/admin/forum/comments/${postId}/${commentId}`, { method: 'DELETE' }, undefined, adminToken);
  }

  async getAdminMarketListings(adminToken: string): Promise<ApiResponse<MarketListing[]>> {
    return this.request(`/admin/market/listings`, { method: 'GET' }, undefined, adminToken);
  }

  async getAdminMarketTrades(adminToken: string): Promise<ApiResponse<Array<{
    id: string;
    listingId: string;
    buyerWallet: string;
    sellerWallet?: string;
    status: string;
    createdAt: string;
    txSignature?: string | null;
    marketMode?: string;
  }>>> {
    return this.request(`/admin/market/trades`, { method: 'GET' }, undefined, adminToken);
  }

  async adminCancelListing(listingId: string, adminToken: string): Promise<ApiResponse<{ cancelled: boolean }>> {
    return this.request(`/admin/market/listings/${listingId}`, { method: 'DELETE' }, undefined, adminToken);
  }

  async adminUpdateTradeStatus(
    tradeId: string,
    status: 'pending' | 'accepted' | 'completed' | 'cancelled',
    adminToken: string,
  ): Promise<ApiResponse<{ updated: boolean; trade: unknown }>> {
    return this.request(`/admin/market/trades/${tradeId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }, undefined, adminToken);
  }

  async getAdminAuditLogs(adminToken: string): Promise<ApiResponse<AdminAuditLog[]>> {
    return this.request(`/admin/audit-logs`, { method: 'GET' }, undefined, adminToken);
  }
}

export const api = new ApiService();
