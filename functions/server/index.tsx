import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { logger } from "npm:hono@4/logger";
import nacl from "npm:tweetnacl@1.0.3";
import { PublicKey } from "npm:@solana/web3.js@1.98.4";
import * as kv from "./kv_store.tsx";
import { DUAN_TO_SOL_RATE } from "../../shared/duanEconomy.ts";
import { LEGACY_SHOP_ITEM_IDS, SHOP_ITEM_CATALOG } from "../../shared/shopCatalog.ts";
import { PROFILE_AVATAR_OPTIONS, PROFILE_BACKGROUND_OPTIONS } from "../../shared/profileCosmetics.ts";

// DUAN Edge Function:
// Bu dosya forum, shop, market, profil ve oyun senkronizasyonunun ortak
// backend giris noktasidir. Frontend veri kontratlari burada merkezilesir.
const app = new Hono();

type AuthClaims = {
  domain: "DUAN";
  action: string;
  walletAddress: string;
  timestamp: number;
};

const AUTH_MAX_AGE_MS = 5 * 60 * 1000;
const XP_PER_LEVEL = 120;

// Web tarafinda tetiklenen davranislari anlamli odullere baglayan basit
// achievement matrisi. Profil/stats tarafi bu liste uzerinden normalize edilir.
const WEB_ACHIEVEMENTS = [
  {
    id: "first_post",
    name: "İlk Yayın",
    description: "Forumda ilk paylaşımını oluştur.",
    icon: "📝",
    rewardDuan: 40,
    rewardSol: 0.001,
    isUnlocked: (_profile: any, stats: any) => (stats.totalPosts || 0) >= 1,
  },
  {
    id: "forum_regular",
    name: "Forum Müdavimi",
    description: "Forumda toplam 5 paylaşım yap.",
    icon: "📡",
    rewardDuan: 90,
    rewardSol: 0.002,
    isUnlocked: (_profile: any, stats: any) => (stats.totalPosts || 0) >= 5,
  },
  {
    id: "first_purchase",
    name: "İlk Alım",
    description: "Mağazadan ilk itemini edin.",
    icon: "🛍️",
    rewardDuan: 50,
    rewardSol: 0.0015,
    isUnlocked: (_profile: any, stats: any) => (stats.totalItems || 0) >= 1,
  },
  {
    id: "collector",
    name: "Koleksiyoncu",
    description: "Toplam 5 item topla.",
    icon: "🎒",
    rewardDuan: 110,
    rewardSol: 0.003,
    isUnlocked: (_profile: any, stats: any) => (stats.totalItems || 0) >= 5,
  },
  {
    id: "first_trade",
    name: "İlk Takas",
    description: "Pazarda ilk takas teklifini gönder.",
    icon: "🤝",
    rewardDuan: 60,
    rewardSol: 0.002,
    isUnlocked: (_profile: any, stats: any) => (stats.totalTrades || 0) >= 1,
  },
  {
    id: "market_maker",
    name: "Pazar Kurucusu",
    description: "Toplam 3 takas aktivitesi tamamla.",
    icon: "📈",
    rewardDuan: 130,
    rewardSol: 0.004,
    isUnlocked: (_profile: any, stats: any) => (stats.totalTrades || 0) >= 3,
  },
  {
    id: "profile_customized",
    name: "Kimlik Oluşturuldu",
    description: "Biyografi doldur ve profil görünümünü özelleştir.",
    icon: "🎨",
    rewardDuan: 70,
    rewardSol: 0.0015,
    isUnlocked: (profile: any) =>
      Boolean(profile.bio?.trim()) &&
      profile.selectedAvatarId !== PROFILE_AVATAR_OPTIONS[0].id &&
      profile.selectedBackgroundId !== PROFILE_BACKGROUND_OPTIONS[0].id,
  },
  {
    id: "community_operator",
    name: "Topluluk Operatörü",
    description: "Forum, mağaza ve pazar aktivitelerini birlikte kullan.",
    icon: "⚙️",
    rewardDuan: 160,
    rewardSol: 0.005,
    isUnlocked: (_profile: any, stats: any) =>
      (stats.totalPosts || 0) >= 3 &&
      (stats.totalItems || 0) >= 2 &&
      (stats.totalTrades || 0) >= 1,
  },
] as const;

function detectContentLanguage(text: string): "tr" | "en" {
  const normalized = text.toLocaleLowerCase("tr-TR");
  const turkishCharPattern = /[çğıöşü]/;
  const turkishWords = ["ve", "bir", "bu", "ile", "için", "gibi", "çok", "daha", "şu", "forum", "mağaza"];
  const englishWords = ["the", "and", "with", "for", "this", "that", "shop", "forum", "market", "build"];
  const turkishScore =
    (turkishCharPattern.test(normalized) ? 2 : 0) +
    turkishWords.reduce((count, word) => count + (normalized.includes(` ${word} `) ? 1 : 0), 0);
  const englishScore = englishWords.reduce((count, word) => count + (normalized.includes(` ${word} `) ? 1 : 0), 0);
  return turkishScore >= englishScore ? "tr" : "en";
}

function createTranslationCacheKey(scope: "post" | "comment", id: string, field: string, language: string) {
  return `translation:${scope}:${id}:${field}:${language}`;
}

function getRuntimeSolanaConfig() {
  return {
    duanToSolRate: DUAN_TO_SOL_RATE,
    tokenMint: Deno.env.get("SOLANA_TOKEN_MINT") ?? Deno.env.get("VITE_SOLANA_TOKEN_MINT") ?? null,
    treasury: Deno.env.get("DUAN_SHOP_TREASURY") ?? null,
    programId: Deno.env.get("DUAN_SHOP_PROGRAM_ID") ?? null,
  };
}

// Ceviri servisi yanit vermezse akis bozulmaz; orijinal metin fallback olarak
// korunur. Bu sayede forum ve market global gorunse de veri akisi kirilmaz.
async function translateText(text: string, sourceLanguage: "tr" | "en", targetLanguage: "tr" | "en") {
  if (!text || sourceLanguage === targetLanguage) {
    return text;
  }

  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${sourceLanguage}|${targetLanguage}`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "accept": "application/json",
      },
    });
    if (!response.ok) {
      return text;
    }

    const payload = await response.json();
    const translatedText = payload?.responseData?.translatedText;
    return typeof translatedText === "string" && translatedText.trim() ? translatedText.trim() : text;
  } catch (error) {
    console.error("Translation request failed:", error);
    return text;
  }
}

async function translateForumPost(post: any, targetLanguage?: string) {
  if ((targetLanguage !== "tr" && targetLanguage !== "en") || !post.language || post.language === targetLanguage) {
    return {
      ...post,
      originalTitle: post.originalTitle ?? post.title,
      originalContent: post.originalContent ?? post.content,
      isTranslated: false,
    };
  }

  const titleCacheKey = createTranslationCacheKey("post", post.id, "title", targetLanguage);
  const contentCacheKey = createTranslationCacheKey("post", post.id, "content", targetLanguage);
  let translatedTitle = await kv.get(titleCacheKey);
  let translatedContent = await kv.get(contentCacheKey);

  if (!translatedTitle) {
    translatedTitle = await translateText(post.title, post.language, targetLanguage);
    await kv.set(titleCacheKey, translatedTitle);
  }
  if (!translatedContent) {
    translatedContent = await translateText(post.content, post.language, targetLanguage);
    await kv.set(contentCacheKey, translatedContent);
  }

  return {
    ...post,
    originalTitle: post.title,
    originalContent: post.content,
    title: translatedTitle,
    content: translatedContent,
    isTranslated: translatedTitle !== post.title || translatedContent !== post.content,
  };
}

async function translateForumComment(comment: any, targetLanguage?: string) {
  if ((targetLanguage !== "tr" && targetLanguage !== "en") || !comment.language || comment.language === targetLanguage) {
    return {
      ...comment,
      originalContent: comment.originalContent ?? comment.content,
      isTranslated: false,
    };
  }

  const contentCacheKey = createTranslationCacheKey("comment", comment.id, "content", targetLanguage);
  let translatedContent = await kv.get(contentCacheKey);
  if (!translatedContent) {
    translatedContent = await translateText(comment.content, comment.language, targetLanguage);
    await kv.set(contentCacheKey, translatedContent);
  }

  return {
    ...comment,
    originalContent: comment.content,
    content: translatedContent,
    isTranslated: translatedContent !== comment.content,
  };
}

async function translateMarketListing(listing: any, targetLanguage?: string) {
  if ((targetLanguage !== "tr" && targetLanguage !== "en") || !listing.language || listing.language === targetLanguage) {
    return {
      ...listing,
      originalNote: listing.originalNote ?? listing.note,
      originalWantedItemName: listing.originalWantedItemName ?? listing.wantedItemName,
      isTranslated: false,
    };
  }

  const nextListing = {
    ...listing,
    originalNote: listing.note,
    originalWantedItemName: listing.wantedItemName,
  };

  if (listing.note) {
    const noteCacheKey = createTranslationCacheKey("post", listing.id, "market-note", targetLanguage);
    let translatedNote = await kv.get(noteCacheKey);
    if (!translatedNote) {
      translatedNote = await translateText(listing.note, listing.language, targetLanguage);
      await kv.set(noteCacheKey, translatedNote);
    }
    nextListing.note = translatedNote;
  }

  if (listing.wantedItemName) {
    const wantedItemCacheKey = createTranslationCacheKey("post", listing.id, "market-wanted", targetLanguage);
    let translatedWantedItemName = await kv.get(wantedItemCacheKey);
    if (!translatedWantedItemName) {
      translatedWantedItemName = await translateText(listing.wantedItemName, listing.language, targetLanguage);
      await kv.set(wantedItemCacheKey, translatedWantedItemName);
    }
    nextListing.wantedItemName = translatedWantedItemName;
  }

  nextListing.isTranslated =
    nextListing.note !== listing.note ||
    nextListing.wantedItemName !== listing.wantedItemName;

  return nextListing;
}

function createDefaultProfile(walletAddress: string) {
  return {
    walletAddress,
    username: `Player_${walletAddress.slice(0, 4)}`,
    bio: "",
    selectedAvatarId: PROFILE_AVATAR_OPTIONS[0].id,
    selectedBackgroundId: PROFILE_BACKGROUND_OPTIONS[0].id,
    ownedAvatarIds: [PROFILE_AVATAR_OPTIONS[0].id],
    ownedBackgroundIds: [PROFILE_BACKGROUND_OPTIONS[0].id],
    createdAt: new Date().toISOString(),
  };
}

function createDefaultStats() {
  return {
    level: 1,
    xp: 0,
    xpToNextLevel: XP_PER_LEVEL,
    totalPosts: 0,
    totalItems: 0,
    totalTrades: 0,
    rewardDuanBalance: 0,
    rewardSolBalance: 0,
    rewardDuanEarned: 0,
    rewardSolEarned: 0,
    achievements: [],
  };
}

function applyLevelProgression(stats: any) {
  const xp = Math.max(0, Number(stats.xp || 0));
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  return {
    ...stats,
    xp,
    level,
    xpToNextLevel: level * XP_PER_LEVEL,
  };
}

async function getOrCreateProfile(walletAddress: string) {
  const existingProfile = await kv.get(`profile:${walletAddress}`);
  if (existingProfile) {
    return {
      ...createDefaultProfile(walletAddress),
      ...existingProfile,
      walletAddress,
      ownedAvatarIds: Array.from(new Set(existingProfile.ownedAvatarIds || [PROFILE_AVATAR_OPTIONS[0].id])),
      ownedBackgroundIds: Array.from(new Set(existingProfile.ownedBackgroundIds || [PROFILE_BACKGROUND_OPTIONS[0].id])),
    };
  }

  const profile = createDefaultProfile(walletAddress);
  await kv.set(`profile:${walletAddress}`, profile);
  return profile;
}

async function saveStatsWithAchievements(walletAddress: string, stats: any) {
  const profile = await getOrCreateProfile(walletAddress);
  const normalizedStats = applyLevelProgression({
    ...createDefaultStats(),
    ...stats,
    achievements: [...(stats.achievements || [])],
  });

  for (const achievement of WEB_ACHIEVEMENTS) {
    const alreadyUnlocked = normalizedStats.achievements.some((entry: any) => entry.id === achievement.id);
    if (alreadyUnlocked || !achievement.isUnlocked(profile, normalizedStats)) {
      continue;
    }

    normalizedStats.achievements.push({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      rewardDuan: achievement.rewardDuan,
      rewardSol: achievement.rewardSol,
      unlockedAt: new Date().toISOString(),
    });
    normalizedStats.rewardDuanBalance += achievement.rewardDuan;
    normalizedStats.rewardSolBalance += achievement.rewardSol;
    normalizedStats.rewardDuanEarned += achievement.rewardDuan;
    normalizedStats.rewardSolEarned += achievement.rewardSol;
  }

  await kv.set(`stats:${walletAddress}`, normalizedStats);
  return normalizedStats;
}

async function getOrCreateStats(walletAddress: string) {
  const existingStats = await kv.get(`stats:${walletAddress}`);
  if (!existingStats) {
    return saveStatsWithAchievements(walletAddress, createDefaultStats());
  }

  return saveStatsWithAchievements(walletAddress, existingStats);
}

async function mutateStats(walletAddress: string, updater: (stats: any) => void | Promise<void>) {
  const stats = await getOrCreateStats(walletAddress);
  await updater(stats);
  return saveStatsWithAchievements(walletAddress, stats);
}

function getCosmeticDefinition(slot: "avatar" | "background", cosmeticId: string) {
  const source = slot === "avatar" ? PROFILE_AVATAR_OPTIONS : PROFILE_BACKGROUND_OPTIONS;
  return source.find((item) => item.id === cosmeticId) || null;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseAuthClaims(rawMessage: string): AuthClaims | null {
  try {
    const parsed = JSON.parse(rawMessage);
    if (
      parsed?.domain !== "DUAN" ||
      typeof parsed?.action !== "string" ||
      typeof parsed?.walletAddress !== "string" ||
      typeof parsed?.timestamp !== "number"
    ) {
      return null;
    }
    return parsed as AuthClaims;
  } catch {
    return null;
  }
}

async function verifyWalletAuth(c: any, expectedAction: string, expectedWalletAddress: string) {
  const walletAddress = c.req.header("x-wallet-address");
  const signatureBase64 = c.req.header("x-wallet-signature");
  const rawMessage = c.req.header("x-wallet-message");

  if (!walletAddress || !signatureBase64 || !rawMessage) {
    return { ok: false, status: 401, error: "Missing wallet authentication headers" };
  }

  if (walletAddress !== expectedWalletAddress) {
    return { ok: false, status: 403, error: "Wallet header does not match request wallet address" };
  }

  const claims = parseAuthClaims(rawMessage);
  if (!claims) {
    return { ok: false, status: 400, error: "Invalid wallet message format" };
  }

  if (claims.action !== expectedAction) {
    return { ok: false, status: 403, error: "Wallet message action mismatch" };
  }

  if (claims.walletAddress !== expectedWalletAddress) {
    return { ok: false, status: 403, error: "Wallet message address mismatch" };
  }

  if (Date.now() - claims.timestamp > AUTH_MAX_AGE_MS) {
    return { ok: false, status: 401, error: "Wallet message has expired" };
  }

  try {
    const messageBytes = new TextEncoder().encode(rawMessage);
    const signatureBytes = decodeBase64ToBytes(signatureBase64);
    const publicKeyBytes = new PublicKey(walletAddress).toBytes();
    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!verified) {
      return { ok: false, status: 401, error: "Invalid wallet signature" };
    }

    return { ok: true };
  } catch (error) {
    console.error("Wallet auth verification failed:", error);
    return { ok: false, status: 400, error: "Malformed wallet authentication data" };
  }
}

// Tum route'larda temel request log'u acik tutulur.
app.use('*', logger(console.log));

// Frontend ve wallet imza header'lari icin acik CORS tanimi.
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-wallet-address",
      "x-wallet-message",
      "x-wallet-signature",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Shop katalogu runtime baslangicinda ortak sabitlerden senkronize edilir.
async function initializeShopItems() {
  try {
    console.log("Syncing shop item catalog...");

    for (const legacyId of LEGACY_SHOP_ITEM_IDS) {
      await kv.del(`shop_item:${legacyId}`);
    }

    for (const item of SHOP_ITEM_CATALOG) {
      const existingItem = await kv.get(`shop_item:${item.id}`);
      const mergedItem = existingItem
        ? {
            ...existingItem,
            name: item.name,
            description: item.description,
            imageUrl: item.imageUrl,
            rarity: item.rarity,
            category: item.category,
            basePrice: item.basePrice ?? existingItem.basePrice ?? existingItem.price,
            baseStock: item.baseStock ?? existingItem.baseStock ?? existingItem.stock,
            restockDurationMinutes: item.restockDurationMinutes ?? existingItem.restockDurationMinutes ?? 20,
          }
        : item;

      const { item: normalized } = normalizeShopItemState(mergedItem);
      await kv.set(`shop_item:${item.id}`, normalized);
    }

    console.log(`Synced ${SHOP_ITEM_CATALOG.length} shop items`);
  } catch (error) {
    console.error("Error initializing shop items:", error);
  }
}

async function getShopItemById(itemId: string) {
  const item = await kv.get(`shop_item:${itemId}`);
  if (item) {
    return item;
  }

  return SHOP_ITEM_CATALOG.find((catalogItem) => catalogItem.id === itemId) || null;
}

function calculateDynamicPrice(item: any) {
  const basePrice = item.basePrice ?? item.price ?? 0;
  const soldCount = item.soldCount ?? 0;
  const rarityMultiplier = {
    common: 0.04,
    rare: 0.06,
    epic: 0.08,
    legendary: 0.12,
  }[item.rarity] ?? 0.05;
  const rawPrice = basePrice * (1 + soldCount * rarityMultiplier);
  const cappedPrice = Math.min(rawPrice, basePrice * 2.5);
  return Math.max(basePrice, Math.round(cappedPrice));
}

function normalizeShopItemState(item: any) {
  const now = Date.now();
  const baseStock = item.baseStock ?? item.stock ?? 0;
  const normalized = {
    ...item,
    basePrice: item.basePrice ?? item.price,
    stock: Math.max(0, Math.min(item.stock ?? baseStock, baseStock)),
    baseStock,
    soldCount: item.soldCount ?? 0,
    restockAt: item.restockAt ?? null,
    restockDurationMinutes: item.restockDurationMinutes ?? 20,
  };

  let changed = false;

  if (normalized.stock <= 0 && normalized.restockAt) {
    const restockAtMs = new Date(normalized.restockAt).getTime();
    if (!Number.isNaN(restockAtMs) && restockAtMs <= now) {
      normalized.stock = normalized.baseStock;
      normalized.soldCount = Math.max(0, Math.floor(normalized.soldCount * 0.35));
      normalized.restockAt = null;
      changed = true;
    }
  }

  const dynamicPrice = calculateDynamicPrice(normalized);
  if (normalized.price !== dynamicPrice) {
    normalized.price = dynamicPrice;
    changed = true;
  }

  return { item: normalized, changed };
}

async function getLiveShopItem(itemId: string) {
  const item = await getShopItemById(itemId);
  if (!item) {
    return null;
  }

  const { item: normalized, changed } = normalizeShopItemState(item);
  if (changed) {
    await kv.set(`shop_item:${normalized.id}`, normalized);
  }

  return normalized;
}

async function incrementTotalItems(walletAddress: string, amount = 1) {
  await mutateStats(walletAddress, (stats) => {
    stats.totalItems = (stats.totalItems || 0) + amount;
  });
}

async function findInventoryItem(walletAddress: string, offeredItemId: string) {
  const directMatch = await kv.get(`inventory:${walletAddress}:${offeredItemId}`);
  if (directMatch) {
    return directMatch;
  }

  const inventoryItems = await kv.getByPrefix(`inventory:${walletAddress}:`);
  return inventoryItems.find((inventoryItem: any) =>
    inventoryItem.id === offeredItemId ||
    inventoryItem.item?.id === offeredItemId
  ) || null;
}

// Initialize shop items
initializeShopItems();

// Health check endpoint
app.get("/make-server-5d6242bb/health", (c) => {
  return kv.ping()
    .then(() => c.json({
      status: "ok",
      service: "DUAN Edge Functions",
      env: {
        supabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
        supabaseServiceRoleKey: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
      },
      database: {
        connected: true,
        table: "kv_store_5d6242bb",
      },
      timestamp: new Date().toISOString(),
    }))
    .catch((error) => {
      console.error("Health check database error:", error);
      return c.json({
        status: "error",
        service: "DUAN Edge Functions",
        env: {
          supabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
          supabaseServiceRoleKey: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
        },
        database: {
          connected: false,
          table: "kv_store_5d6242bb",
          error: error instanceof Error ? error.message : "Unknown database error",
        },
        timestamp: new Date().toISOString(),
      }, 500);
    });
});

// ========== PLATFORM STATS ==========

// Get platform statistics
app.get("/make-server-5d6242bb/stats/platform", async (c) => {
  try {
    // Get active users (users who have profiles)
    const profiles = await kv.getByPrefix("profile:");
    const activeUsers = profiles.length;

    // Get total items in all inventories
    const inventoryItems = await kv.getByPrefix("inventory:");
    const totalItems = inventoryItems.length;

    // Get completed trades
    const allTrades = await kv.getByPrefix("trade:");
    const completedTrades = allTrades.filter((trade: any) => trade.status === "completed").length;

    return c.json({
      activeUsers,
      totalItems,
      completedTrades,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching platform stats:", error);
    return c.json({ error: "Failed to fetch platform stats" }, 500);
  }
});

// Get token price and supply info
app.get("/make-server-5d6242bb/token/info", async (c) => {
  try {
    // Get or initialize token info
    let tokenInfo = await kv.get("token:info");

    if (!tokenInfo) {
      // Initialize with default values
      tokenInfo = {
        symbol: "DUAN",
        name: "DUAN Token",
        price: DUAN_TO_SOL_RATE,
        totalSupply: 1000000,
        circulatingSupply: 500000,
        lastUpdated: new Date().toISOString(),
      };
      await kv.set("token:info", tokenInfo);
    } else if (tokenInfo.price !== DUAN_TO_SOL_RATE) {
      tokenInfo = {
        ...tokenInfo,
        price: DUAN_TO_SOL_RATE,
        lastUpdated: new Date().toISOString(),
      };
      await kv.set("token:info", tokenInfo);
    }

    return c.json(tokenInfo);
  } catch (error) {
    console.error("Error fetching token info:", error);
    return c.json({ error: "Failed to fetch token info" }, 500);
  }
});

// Unity ve diger istemciler ortak item katalogunu, ekonomi sabitlerini ve
// Solana baglanti ayarlarini bu endpoint uzerinden okuyabilir.
app.get("/make-server-5d6242bb/bootstrap/config", async (c) => {
  try {
    return c.json({
      gameplay: {
        xpPerLevel: XP_PER_LEVEL,
      },
      solana: getRuntimeSolanaConfig(),
      shopCatalog: SHOP_ITEM_CATALOG,
      cosmetics: {
        avatars: PROFILE_AVATAR_OPTIONS,
        backgrounds: PROFILE_BACKGROUND_OPTIONS,
      },
    });
  } catch (error) {
    console.error("Error fetching bootstrap config:", error);
    return c.json({ error: "Failed to fetch bootstrap config" }, 500);
  }
});

// ========== PROFILE ROUTES ==========

// Get user profile
app.get("/make-server-5d6242bb/profile/:walletAddress", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const profile = await getOrCreateProfile(walletAddress);
    return c.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
});

// Update user profile
app.put("/make-server-5d6242bb/profile/:walletAddress", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const updates = await c.req.json();

    const auth = await verifyWalletAuth(c, "profile:update", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const currentProfile = await getOrCreateProfile(walletAddress);

    const updatedProfile = {
      ...currentProfile,
      ...updates,
      walletAddress, // Prevent overwriting wallet address
    };

    await kv.set(`profile:${walletAddress}`, updatedProfile);
    await mutateStats(walletAddress, (stats) => {
      if (updatedProfile.bio?.trim()) {
        stats.xp = Math.max(stats.xp || 0, 30);
      }
    });
    return c.json(updatedProfile);
  } catch (error) {
    console.error("Error updating profile:", error);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

app.post("/make-server-5d6242bb/profile/:walletAddress/cosmetics/unlock", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const { slot, cosmeticId } = await c.req.json();
    const auth = await verifyWalletAuth(c, "profile:unlock_cosmetic", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    if (slot !== "avatar" && slot !== "background") {
      return c.json({ error: "Invalid cosmetic slot" }, 400);
    }

    const cosmetic = getCosmeticDefinition(slot, cosmeticId);
    if (!cosmetic) {
      return c.json({ error: "Cosmetic not found" }, 404);
    }

    const profile = await getOrCreateProfile(walletAddress);
    const stats = await getOrCreateStats(walletAddress);
    const ownedKey = slot === "avatar" ? "ownedAvatarIds" : "ownedBackgroundIds";
    const selectedKey = slot === "avatar" ? "selectedAvatarId" : "selectedBackgroundId";
    const owned = Array.from(new Set(profile[ownedKey] || []));

    if (!owned.includes(cosmetic.id) && cosmetic.price > 0) {
      if (cosmetic.currency === "duan" && (stats.rewardDuanBalance || 0) < cosmetic.price) {
        return c.json({ error: "Yetersiz DUAN odul bakiyesi" }, 400);
      }
      if (cosmetic.currency === "sol" && (stats.rewardSolBalance || 0) < cosmetic.price) {
        return c.json({ error: "Yetersiz SOL odul bakiyesi" }, 400);
      }

      if (cosmetic.currency === "duan") {
        stats.rewardDuanBalance -= cosmetic.price;
      } else {
        stats.rewardSolBalance -= cosmetic.price;
      }
      owned.push(cosmetic.id);
    }

    profile[ownedKey] = owned;
    profile[selectedKey] = cosmetic.id;
    await kv.set(`profile:${walletAddress}`, profile);

    stats.xp = (stats.xp || 0) + 20;
    const updatedStats = await saveStatsWithAchievements(walletAddress, stats);
    return c.json({ profile, stats: updatedStats });
  } catch (error) {
    console.error("Error unlocking cosmetic:", error);
    return c.json({ error: "Failed to unlock cosmetic" }, 500);
  }
});

// Get profile stats
app.get("/make-server-5d6242bb/profile/:walletAddress/stats", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const stats = await getOrCreateStats(walletAddress);
    return c.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});

// ========== INVENTORY ROUTES ==========

// Get user inventory
app.get("/make-server-5d6242bb/inventory/:walletAddress", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const inventoryKeys = await kv.getByPrefix(`inventory:${walletAddress}:`);
    return c.json(inventoryKeys || []);
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return c.json({ error: "Failed to fetch inventory" }, 500);
  }
});

// Add item to inventory
app.post("/make-server-5d6242bb/inventory/:walletAddress", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const { itemId } = await c.req.json();
    const item = await getShopItemById(itemId);

    if (!item) {
      return c.json({ error: "Item not found" }, 404);
    }

    const inventoryItem = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      walletAddress,
      item,
      acquiredAt: new Date().toISOString(),
    };

    await kv.set(`inventory:${walletAddress}:${inventoryItem.id}`, inventoryItem);
    await incrementTotalItems(walletAddress);
    return c.json(inventoryItem);
  } catch (error) {
    console.error("Error adding to inventory:", error);
    return c.json({ error: "Failed to add to inventory" }, 500);
  }
});

// ========== FORUM ROUTES ==========

// Get all posts
app.get("/make-server-5d6242bb/forum/posts", async (c) => {
  try {
    const tag = c.req.query("tag");
    const sort = c.req.query("sort") || "newest";
    const walletAddress = c.req.query("walletAddress");
    const language = c.req.query("language");

    let posts = await kv.getByPrefix("post:");

    if (tag && tag !== "all") {
      posts = posts.filter((post: any) => post.tags?.includes(tag));
    }

    if (sort === "popular") {
      posts.sort((a: any, b: any) => (b.likeCount || 0) - (a.likeCount || 0));
    } else {
      posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    if (walletAddress) {
      posts = await Promise.all(posts.map(async (post: any) => ({
        ...post,
        isLiked: Boolean(await kv.get(`like:${post.id}:${walletAddress}`)),
      })));
    }

    posts = await Promise.all(posts.map((post: any) => translateForumPost(post, language)));

    return c.json(posts || []);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return c.json({ error: "Failed to fetch posts" }, 500);
  }
});

// Create new post
app.post("/make-server-5d6242bb/forum/posts", async (c) => {
  try {
    const data = await c.req.json();
    const auth = await verifyWalletAuth(c, "forum:create_post", data.walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const post = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ...data,
      language: detectContentLanguage(`${data.title || ""} ${data.content || ""}`),
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`post:${post.id}`, post);

    // Update user stats
    await mutateStats(data.walletAddress, (stats) => {
      stats.totalPosts = (stats.totalPosts || 0) + 1;
      stats.xp = (stats.xp || 0) + 40;
    });

    return c.json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    return c.json({ error: "Failed to create post" }, 500);
  }
});

// Like/unlike post
app.post("/make-server-5d6242bb/forum/posts/:postId/like", async (c) => {
  try {
    const { postId } = c.req.param();
    const { walletAddress } = await c.req.json();
    const auth = await verifyWalletAuth(c, "forum:like_post", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const likeKey = `like:${postId}:${walletAddress}`;
    const existingLike = await kv.get(likeKey);

    const post = await kv.get(`post:${postId}`);
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (existingLike) {
      // Unlike
      await kv.del(likeKey);
      post.likeCount = Math.max(0, (post.likeCount || 0) - 1);
      await kv.set(`post:${postId}`, post);
      return c.json({ liked: false, likeCount: post.likeCount });
    } else {
      // Like
      await kv.set(likeKey, { postId, walletAddress, likedAt: new Date().toISOString() });
      post.likeCount = (post.likeCount || 0) + 1;
      await kv.set(`post:${postId}`, post);
      return c.json({ liked: true, likeCount: post.likeCount });
    }
  } catch (error) {
    console.error("Error liking post:", error);
    return c.json({ error: "Failed to like post" }, 500);
  }
});

app.delete("/make-server-5d6242bb/forum/posts/:postId", async (c) => {
  try {
    const { postId } = c.req.param();
    const { walletAddress } = await c.req.json();
    const auth = await verifyWalletAuth(c, "forum:delete_post", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const post = await kv.get(`post:${postId}`);
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (post.walletAddress !== walletAddress) {
      return c.json({ error: "You can only delete your own posts" }, 403);
    }

    const likeEntries = await kv.getByPrefix(`like:${postId}:`);
    const commentEntries = await kv.getByPrefix(`comment:${postId}:`);

    await kv.del(`post:${postId}`);
    await Promise.all([
      ...likeEntries.map((entry: any) => kv.del(`like:${postId}:${entry.walletAddress}`)),
      ...commentEntries.flatMap((entry: any) => {
        const deletes = [
          kv.del(`comment:${postId}:${entry.id}`),
          kv.del(createTranslationCacheKey("comment", entry.id, "content", "tr")),
          kv.del(createTranslationCacheKey("comment", entry.id, "content", "en")),
        ];
        return deletes;
      }),
      kv.del(createTranslationCacheKey("post", postId, "title", "tr")),
      kv.del(createTranslationCacheKey("post", postId, "title", "en")),
      kv.del(createTranslationCacheKey("post", postId, "content", "tr")),
      kv.del(createTranslationCacheKey("post", postId, "content", "en")),
    ]);
    return c.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    return c.json({ error: "Failed to delete post" }, 500);
  }
});

app.get("/make-server-5d6242bb/forum/posts/:postId/comments", async (c) => {
  try {
    const { postId } = c.req.param();
    const language = c.req.query("language");
    const post = await kv.get(`post:${postId}`);
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }
    const comments = await kv.getByPrefix(`comment:${postId}:`);
    comments.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return c.json(await Promise.all(comments.map((comment: any) => translateForumComment(comment, language))));
  } catch (error) {
    console.error("Error fetching comments:", error);
    return c.json({ error: "Failed to fetch comments" }, 500);
  }
});

app.post("/make-server-5d6242bb/forum/posts/:postId/comments", async (c) => {
  try {
    const { postId } = c.req.param();
    const { walletAddress, content } = await c.req.json();
    const auth = await verifyWalletAuth(c, "forum:create_comment", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const post = await kv.get(`post:${postId}`);
    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (!content || !String(content).trim()) {
      return c.json({ error: "Comment content is required" }, 400);
    }

    const profile = await getOrCreateProfile(walletAddress);
    const comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      postId,
      walletAddress,
      username: profile.username,
      content: String(content).trim(),
      language: detectContentLanguage(String(content).trim()),
      createdAt: new Date().toISOString(),
    };

    await kv.set(`comment:${postId}:${comment.id}`, comment);
    post.commentCount = (post.commentCount || 0) + 1;
    await kv.set(`post:${postId}`, post);
    await mutateStats(walletAddress, (stats) => {
      stats.xp = (stats.xp || 0) + 15;
    });

    return c.json(comment);
  } catch (error) {
    console.error("Error creating comment:", error);
    return c.json({ error: "Failed to create comment" }, 500);
  }
});

// Get posts by user
app.get("/make-server-5d6242bb/forum/posts/user/:walletAddress", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const allPosts = await kv.getByPrefix("post:");
    const userPosts = allPosts.filter((post: any) => post.walletAddress === walletAddress);
    return c.json(userPosts || []);
  } catch (error) {
    console.error("Error fetching user posts:", error);
    return c.json({ error: "Failed to fetch user posts" }, 500);
  }
});

// ========== SHOP ROUTES ==========

// Get shop items
app.get("/make-server-5d6242bb/shop/items", async (c) => {
  try {
    const rarity = c.req.query("rarity");
    const search = c.req.query("search");

    let items = await kv.getByPrefix("shop_item:");
    items = await Promise.all(items.map(async (item: any) => {
      const { item: normalized, changed } = normalizeShopItemState(item);
      if (changed) {
        await kv.set(`shop_item:${normalized.id}`, normalized);
      }
      return normalized;
    }));

    if (rarity && rarity !== "all") {
      items = items.filter((item: any) => item.rarity === rarity);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter((item: any) =>
        item.name.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }

    return c.json(items || []);
  } catch (error) {
    console.error("Error fetching shop items:", error);
    return c.json({ error: "Failed to fetch shop items" }, 500);
  }
});

// Purchase item
app.post("/make-server-5d6242bb/shop/purchase", async (c) => {
  try {
    const { walletAddress, itemId } = await c.req.json();
    const auth = await verifyWalletAuth(c, "shop:purchase", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    // Get item
    const item = await getLiveShopItem(itemId);
    if (!item) {
      return c.json({ error: "Item not found" }, 404);
    }

    if (item.stock <= 0) {
      return c.json({
        error: "Item is currently restocking",
        restockAt: item.restockAt,
      }, 409);
    }

    const purchaseSnapshot = { ...item };
    const updatedItem = {
      ...item,
      stock: item.stock - 1,
      soldCount: (item.soldCount ?? 0) + 1,
    };

    if (updatedItem.stock <= 0) {
      updatedItem.stock = 0;
      updatedItem.restockAt = new Date(Date.now() + (updatedItem.restockDurationMinutes ?? 20) * 60 * 1000).toISOString();
    }

    updatedItem.price = calculateDynamicPrice(updatedItem);
    await kv.set(`shop_item:${updatedItem.id}`, updatedItem);

    // Add to inventory
    const inventoryItem = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      walletAddress,
      purchasePrice: purchaseSnapshot.price,
      item: purchaseSnapshot,
      acquiredAt: new Date().toISOString(),
      txSignature: `tx_${Date.now()}`, // Gecici backend imzasi, zincir islemi degil.
    };

    await kv.set(`inventory:${walletAddress}:${inventoryItem.id}`, inventoryItem);
    await incrementTotalItems(walletAddress);
    await mutateStats(walletAddress, (stats) => {
      stats.xp = (stats.xp || 0) + 30;
    });

    return c.json({ transaction: inventoryItem.txSignature, item: inventoryItem, shopItem: updatedItem });
  } catch (error) {
    console.error("Error purchasing item:", error);
    return c.json({ error: "Failed to purchase item" }, 500);
  }
});

// ========== MARKET ROUTES ==========

// Get market listings
app.get("/make-server-5d6242bb/market/listings", async (c) => {
  try {
    const status = c.req.query("status") || "active";
    const language = c.req.query("language");

    let listings = await kv.getByPrefix("listing:");

    if (status !== "all") {
      listings = listings.filter((listing: any) => listing.status === status);
    }

    listings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json(await Promise.all((listings || []).map((listing: any) => translateMarketListing(listing, language))));
  } catch (error) {
    console.error("Error fetching listings:", error);
    return c.json({ error: "Failed to fetch listings" }, 500);
  }
});

// Create listing
app.post("/make-server-5d6242bb/market/listings", async (c) => {
  try {
    const data = await c.req.json();
    const auth = await verifyWalletAuth(c, "market:create_listing", data.sellerWallet);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    if (!data.offeredItemId) {
      return c.json({ error: "offeredItemId is required" }, 400);
    }

    const offeredInventoryItem = await findInventoryItem(data.sellerWallet, data.offeredItemId);
    if (!offeredInventoryItem) {
      return c.json({ error: "Offered inventory item not found" }, 404);
    }

    const offeredItem = offeredInventoryItem.item || {
      id: offeredInventoryItem.itemId,
      name: offeredInventoryItem.itemId,
      description: "",
      imageUrl: "",
      price: 0,
      rarity: "common",
      stock: 1,
      category: "Inventory",
    };

    const listing = {
      id: `listing_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ...data,
      offeredItemId: offeredInventoryItem.id,
      offeredItem,
      language: detectContentLanguage(`${data.note || ""} ${data.wantedItemName || ""}`),
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + data.duration * 60 * 60 * 1000).toISOString(),
    };

    await kv.set(`listing:${listing.id}`, listing);
    await mutateStats(data.sellerWallet, (stats) => {
      stats.xp = (stats.xp || 0) + 25;
    });
    return c.json(listing);
  } catch (error) {
    console.error("Error creating listing:", error);
    return c.json({ error: "Failed to create listing" }, 500);
  }
});

app.delete("/make-server-5d6242bb/market/listings/:listingId", async (c) => {
  try {
    const { listingId } = c.req.param();
    const { walletAddress } = await c.req.json();
    const auth = await verifyWalletAuth(c, "market:cancel_listing", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const listing = await kv.get(`listing:${listingId}`);
    if (!listing) {
      return c.json({ error: "Listing not found" }, 404);
    }
    if (listing.sellerWallet !== walletAddress) {
      return c.json({ error: "You can only cancel your own listings" }, 403);
    }

    listing.status = "cancelled";
    listing.cancelledAt = new Date().toISOString();
    await kv.set(`listing:${listingId}`, listing);
    return c.json({ cancelled: true });
  } catch (error) {
    console.error("Error cancelling listing:", error);
    return c.json({ error: "Failed to cancel listing" }, 500);
  }
});

// Create trade offer
app.post("/make-server-5d6242bb/market/listings/:listingId/trade", async (c) => {
  try {
    const { listingId } = c.req.param();
    const data = await c.req.json();

    const auth = await verifyWalletAuth(c, "market:create_trade", data.buyerWallet);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const listing = await kv.get(`listing:${listingId}`);
    if (!listing) {
      return c.json({ error: "Listing not found" }, 404);
    }
    if (listing.status !== "active") {
      return c.json({ error: "Listing is no longer active" }, 409);
    }
    if (listing.sellerWallet === data.buyerWallet) {
      return c.json({ error: "You cannot send an offer to your own listing" }, 400);
    }

    const trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      listingId,
      ...data,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    await kv.set(`trade:${trade.id}`, trade);

    // Update stats
    await mutateStats(data.buyerWallet, (stats) => {
      stats.totalTrades = (stats.totalTrades || 0) + 1;
      stats.xp = (stats.xp || 0) + 35;
    });

    return c.json({ tradeId: trade.id });
  } catch (error) {
    console.error("Error creating trade:", error);
    return c.json({ error: "Failed to create trade" }, 500);
  }
});

// Get listings by user
app.get("/make-server-5d6242bb/market/listings/user/:walletAddress", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const language = c.req.query("language");
    const allListings = await kv.getByPrefix("listing:");
    const userListings = allListings.filter((listing: any) => listing.sellerWallet === walletAddress);
    userListings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json(await Promise.all((userListings || []).map((listing: any) => translateMarketListing(listing, language))));
  } catch (error) {
    console.error("Error fetching user listings:", error);
    return c.json({ error: "Failed to fetch user listings" }, 500);
  }
});

// ========== GAME INTEGRATION ROUTES ==========

// Sync game data
app.post("/make-server-5d6242bb/game/sync", async (c) => {
  try {
    const { walletAddress, level, xp, achievements, itemsEarned } = await c.req.json();
    const auth = await verifyWalletAuth(c, "game:sync", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const stats = await getOrCreateStats(walletAddress);

    // Update stats from game
    if (level !== undefined && xp === undefined) {
      stats.xp = Math.max(stats.xp || 0, Math.max(0, level - 1) * XP_PER_LEVEL);
    }
    if (xp !== undefined) {
      stats.xp = xp;
    }

    // Add new achievements
    if (achievements && Array.isArray(achievements)) {
      const existingAchievements = stats.achievements || [];
      const newAchievements = achievements.filter((a: string) =>
        !existingAchievements.some((ea: any) => ea.id === a)
      ).map((a: string) => ({
        id: a,
        name: a,
        description: `Achievement: ${a}`,
        icon: "🏆",
        unlockedAt: new Date().toISOString(),
      }));
      stats.achievements = [...existingAchievements, ...newAchievements];
    }

    await saveStatsWithAchievements(walletAddress, stats);

    // Add items to inventory
    let syncedItemCount = 0;
    if (itemsEarned && Array.isArray(itemsEarned)) {
      for (const itemId of itemsEarned) {
        const item = await getShopItemById(itemId);
        if (!item) {
          console.warn(`Unknown itemId from game sync skipped: ${itemId}`);
          continue;
        }

        const inventoryItem = {
          id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          walletAddress,
          item,
          acquiredAt: new Date().toISOString(),
          source: "game_reward",
        };
        await kv.set(`inventory:${walletAddress}:${inventoryItem.id}`, inventoryItem);
        syncedItemCount += 1;
      }
    }

    if (syncedItemCount > 0) {
      await incrementTotalItems(walletAddress, syncedItemCount);
    }

    return c.json({ synced: true });
  } catch (error) {
    console.error("Error syncing game data:", error);
    return c.json({ error: "Failed to sync game data" }, 500);
  }
});

// Trigger game event
app.post("/make-server-5d6242bb/game/event", async (c) => {
  try {
    const { walletAddress, eventType, eventData } = await c.req.json();
    const auth = await verifyWalletAuth(c, "game:event", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    const event = {
      id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      walletAddress,
      eventType,
      eventData,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`event:${event.id}`, event);

    // Process event based on type
    console.log(`Processing game event: ${eventType} for ${walletAddress}`, eventData);

    return c.json({ processed: true });
  } catch (error) {
    console.error("Error triggering game event:", error);
    return c.json({ error: "Failed to trigger game event" }, 500);
  }
});

Deno.serve(app.fetch);
