import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { logger } from "npm:hono@4/logger";
import { Buffer } from "node:buffer";
import nacl from "npm:tweetnacl@1.0.3";
import anchor, { type Idl } from "npm:@coral-xyz/anchor@0.32.1";
import { PublicKey } from "npm:@solana/web3.js@1.98.4";
import * as kv from "./kv_store.tsx";
import { DUAN_TO_SOL_RATE } from "../../shared/duanEconomy.ts";
import { LEGACY_SHOP_ITEM_IDS, SHOP_ITEM_CATALOG } from "../../shared/shopCatalog.ts";
import { PROFILE_AVATAR_OPTIONS, PROFILE_BACKGROUND_OPTIONS } from "../../shared/profileCosmetics.ts";
import duanShopIdl from "../../target/idl/duan_shop.json" with { type: "json" };

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

type NativeWalletSessionKind = "connect" | "sign-message" | "sign-transaction";

type NativeWalletSessionStatus = "pending" | "completed" | "failed" | "cancelled";

type NativeWalletSessionRecord = {
  id: string;
  pollToken: string;
  kind: NativeWalletSessionKind;
  authAction: string;
  requestedMessage: string | null;
  transactionBase64: string | null;
  status: NativeWalletSessionStatus;
  walletAddress: string | null;
  signatureBase64: string | null;
  transactionSignature: string | null;
  playerSessionToken: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

const AUTH_MAX_AGE_MS = 5 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 20 * 60 * 1000;
const NATIVE_WALLET_SESSION_TTL_MS = 10 * 60 * 1000;
const NATIVE_PLAYER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const XP_PER_LEVEL = 120;
const DUAN_SHOP_ACHIEVEMENT_BYTES = 32;
const DEFAULT_SOL_USD_PRICE = 0;
const ONLINE_PRESENCE_WINDOW_MS = 2 * 60 * 1000;
const UNITY_EDITOR_DEV_AUTH_SECRET = Deno.env.get("UNITY_EDITOR_DEV_AUTH_SECRET") ?? "";
const DUAN_SHOP_PROGRAM_ID = new anchor.web3.PublicKey(
  Deno.env.get("DUAN_SHOP_PROGRAM_ID") ?? duanShopIdl.address,
);

function generateOpaqueToken(byteLength = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchLiveSolUsdPrice() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch("https://api.coinbase.com/v2/prices/SOL-USD/spot", {
      headers: {
        "accept": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SOL price request failed with ${response.status}`);
    }

    const payload = await response.json();
    const amount = Number(payload?.data?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("SOL price response did not include a valid amount");
    }

    return {
      solUsdPrice: amount,
      source: "coinbase-spot",
      live: true,
    };
  } catch (error) {
    console.error("Failed to fetch live SOL/USD price:", error);
    return {
      solUsdPrice: DEFAULT_SOL_USD_PRICE,
      source: "duan-static-fallback",
      live: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getOnlinePresenceCount() {
  const entries = await kv.getByPrefix("presence:");
  const now = Date.now();

  return entries.filter((entry: any) => {
    const lastSeenAt = new Date(entry?.lastSeenAt ?? 0).getTime();
    return Number.isFinite(lastSeenAt) && now - lastSeenAt <= ONLINE_PRESENCE_WINDOW_MS;
  }).length;
}

async function getResolvedTokenInfo() {
  const marketReference = await fetchLiveSolUsdPrice();
  let tokenInfo = await kv.get("token:info");

  if (!tokenInfo) {
    tokenInfo = {
      symbol: "DUAN",
      name: "DUAN Token",
      price: DUAN_TO_SOL_RATE,
      totalSupply: 1000000,
      circulatingSupply: 500000,
      solUsdPrice: marketReference.solUsdPrice,
      priceUsd: Number((DUAN_TO_SOL_RATE * marketReference.solUsdPrice).toFixed(6)),
      priceSource: marketReference.source,
      livePricing: marketReference.live,
      lastUpdated: new Date().toISOString(),
    };
    await kv.set("token:info", tokenInfo);
    return tokenInfo;
  }

  if (
    tokenInfo.price !== DUAN_TO_SOL_RATE ||
    tokenInfo.solUsdPrice !== marketReference.solUsdPrice ||
    tokenInfo.priceSource !== marketReference.source ||
    tokenInfo.livePricing !== marketReference.live
  ) {
    tokenInfo = {
      ...tokenInfo,
      price: DUAN_TO_SOL_RATE,
      solUsdPrice: marketReference.solUsdPrice,
      priceUsd: Number((DUAN_TO_SOL_RATE * marketReference.solUsdPrice).toFixed(6)),
      priceSource: marketReference.source,
      livePricing: marketReference.live,
      lastUpdated: new Date().toISOString(),
    };
    await kv.set("token:info", tokenInfo);
  }

  return tokenInfo;
}

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

const ACHIEVEMENT_INDEX_MAP = new Map(WEB_ACHIEVEMENTS.map((achievement, index) => [achievement.id, index]));

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
    currencyModel: "offchain-game-currency-with-optional-spl-mirror",
    tokenMint: Deno.env.get("SOLANA_TOKEN_MINT") ?? Deno.env.get("VITE_SOLANA_TOKEN_MINT") ?? null,
    treasury: Deno.env.get("DUAN_SHOP_TREASURY") ?? null,
    programId: Deno.env.get("DUAN_SHOP_PROGRAM_ID") ?? null,
  };
}

function buildShopMetadataManifest() {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
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
      updatedAt: new Date().toISOString(),
    })),
    legacyIds: LEGACY_SHOP_ITEM_IDS,
  };
}

function resolveServerSolanaRpcUrl() {
  return (
    Deno.env.get("ANCHOR_PROVIDER_URL") ??
    Deno.env.get("SOLANA_RPC_URL") ??
    Deno.env.get("VITE_SOLANA_RPC_URL") ??
    "https://api.devnet.solana.com"
  );
}

function resolveGameAuthoritySecretKey() {
  return (
    Deno.env.get("DUAN_SHOP_GAME_AUTHORITY_SECRET_KEY") ??
    Deno.env.get("ANCHOR_WALLET_SECRET_KEY") ??
    null
  );
}

function getAdminWalletAllowlist() {
  const raw = Deno.env.get("ADMIN_WALLETS") ?? Deno.env.get("VITE_ADMIN_WALLETS") ?? "";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function logAdminAction(action: string, walletAddress: string, metadata: Record<string, unknown> = {}) {
  const record = {
    id: `adminlog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    walletAddress,
    metadata,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`admin-log:${record.id}`, record);
  return record;
}

function createServerAnchorProvider() {
  const rawSecretKey = resolveGameAuthoritySecretKey();
  if (!rawSecretKey) {
    return { provider: null, error: "Game authority secret key env tanimli degil." };
  }

  try {
    const secretKey = Uint8Array.from(JSON.parse(rawSecretKey));
    const wallet = new anchor.Wallet(anchor.web3.Keypair.fromSecretKey(secretKey));
    const connection = new anchor.web3.Connection(resolveServerSolanaRpcUrl(), "confirmed");
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    return { provider, error: null };
  } catch (error) {
    return {
      provider: null,
      error: `Game authority secret key parse edilemedi: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function getShopConfigPda() {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("shop-config")],
    DUAN_SHOP_PROGRAM_ID,
  );
}

function getPlayerProfilePda(owner: PublicKey) {
  const [shopConfig] = getShopConfigPda();
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("player-profile"), shopConfig.toBuffer(), owner.toBuffer()],
    DUAN_SHOP_PROGRAM_ID,
  );
}

function encodeAchievementFlags(stats: any) {
  const bytes = new Uint8Array(DUAN_SHOP_ACHIEVEMENT_BYTES);
  const unlockedAchievements = Array.isArray(stats?.achievements) ? stats.achievements : [];

  for (const achievement of unlockedAchievements) {
    const achievementId = typeof achievement === "string" ? achievement : achievement?.id;
    const index = ACHIEVEMENT_INDEX_MAP.get(achievementId);
    if (index === undefined) {
      continue;
    }

    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    bytes[byteIndex] |= 1 << bitIndex;
  }

  return Array.from(bytes);
}

async function syncPlayerProfileOnchain(walletAddress: string, stats: any) {
  const { provider, error } = createServerAnchorProvider();
  if (!provider) {
    return {
      synced: false,
      skipped: true,
      error,
    };
  }

  try {
    anchor.setProvider(provider);
    const program = new anchor.Program(duanShopIdl as Idl, provider);
    const owner = new anchor.web3.PublicKey(walletAddress);
    const [shopConfig] = getShopConfigPda();
    const [playerProfile] = getPlayerProfilePda(owner);

    const signature = await program.methods.upsertPlayerProfile({
      level: Math.max(1, Number(stats?.level || 1)),
      xp: new anchor.BN(Math.max(0, Number(stats?.xp || 0))),
      xpToNextLevel: new anchor.BN(Math.max(0, Number(stats?.xpToNextLevel || XP_PER_LEVEL))),
      totalItems: Math.max(0, Number(stats?.totalItems || 0)),
      totalTrades: Math.max(0, Number(stats?.totalTrades || 0)),
      achievements: encodeAchievementFlags(stats),
    }).accounts({
      shopConfig,
      gameAuthority: provider.wallet.publicKey,
      owner,
      playerProfile,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    return {
      synced: true,
      skipped: false,
      signature,
      playerProfile: playerProfile.toBase58(),
    };
  } catch (syncError) {
    console.error("Failed to sync player profile on-chain:", syncError);
    return {
      synced: false,
      skipped: false,
      error: syncError instanceof Error ? syncError.message : String(syncError),
    };
  }
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
  const playerSessionToken = c.req.header("x-player-session-token");
  const signatureBase64 = c.req.header("x-wallet-signature");
  const rawMessage = c.req.header("x-wallet-message");
  const editorDevAuth = c.req.header("x-duan-dev-auth");

  if (!walletAddress) {
    return { ok: false, status: 401, error: "Missing wallet address header" };
  }

  if (walletAddress !== expectedWalletAddress) {
    return { ok: false, status: 403, error: "Wallet header does not match request wallet address" };
  }

  if (playerSessionToken) {
    const session = await kv.get(`native-player-session:${playerSessionToken}`);
    if (!session) {
      return { ok: false, status: 401, error: "Player session not found" };
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await kv.del(`native-player-session:${playerSessionToken}`);
      return { ok: false, status: 401, error: "Player session expired" };
    }

    if (String(session.walletAddress) !== expectedWalletAddress) {
      return { ok: false, status: 403, error: "Player session wallet mismatch" };
    }

    return { ok: true, mode: "native-player-session" };
  }

  if (!rawMessage) {
    return { ok: false, status: 401, error: "Missing wallet authentication headers" };
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

  if (
    UNITY_EDITOR_DEV_AUTH_SECRET &&
    editorDevAuth &&
    editorDevAuth === UNITY_EDITOR_DEV_AUTH_SECRET
  ) {
    return { ok: true, mode: "editor-dev-auth" };
  }

  if (!signatureBase64) {
    return { ok: false, status: 401, error: "Missing wallet signature" };
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

async function verifyAdminWalletAuth(c: any, expectedAction: string) {
  const walletAddress = c.req.header("x-wallet-address");
  if (!walletAddress) {
    return { ok: false, status: 401, error: "Missing admin wallet address" };
  }

  const auth = await verifyWalletAuth(c, expectedAction, walletAddress);
  if (!auth.ok) {
    return auth;
  }

  const allowlist = getAdminWalletAllowlist();
  if (!allowlist.includes(walletAddress.toLowerCase())) {
    return { ok: false, status: 403, error: "Wallet is not allowed to access admin endpoints" };
  }

  return { ok: true, walletAddress };
}

function generateAdminSessionToken() {
  return generateOpaqueToken();
}

async function createAdminSessionRecord(walletAddress: string) {
  const token = generateAdminSessionToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS).toISOString();
  const session = {
    token,
    walletAddress,
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  await kv.set(`admin-session:${token}`, session);
  return session;
}

async function verifyAdminSession(c: any) {
  const token = c.req.header("x-admin-token");
  if (!token) {
    return { ok: false, status: 401, error: "Missing admin session token" };
  }

  const session = await kv.get(`admin-session:${token}`);
  if (!session) {
    return { ok: false, status: 401, error: "Admin session not found" };
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await kv.del(`admin-session:${token}`);
    return { ok: false, status: 401, error: "Admin session expired" };
  }

  const allowlist = getAdminWalletAllowlist();
  if (!allowlist.includes(String(session.walletAddress).toLowerCase())) {
    return { ok: false, status: 403, error: "Admin wallet is no longer allowlisted" };
  }

  return { ok: true, walletAddress: session.walletAddress, token, expiresAt: session.expiresAt };
}

function createNativeWalletSessionId() {
  return `native_${generateOpaqueToken(12)}`;
}

function getNativeWalletAuthAction(sessionId: string, kind: NativeWalletSessionKind) {
  return `native:${kind}:${sessionId}`;
}

function toPublicNativeWalletSession(session: NativeWalletSessionRecord) {
  return {
    id: session.id,
    kind: session.kind,
    status: session.status,
    requestedMessage: session.requestedMessage,
    transactionBase64: session.transactionBase64,
    authAction: session.authAction,
    error: session.error,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  };
}

function toPrivateNativeWalletSessionResult(session: NativeWalletSessionRecord) {
  return {
    id: session.id,
    kind: session.kind,
    status: session.status,
    walletAddress: session.walletAddress,
    signatureBase64: session.signatureBase64,
    transactionSignature: session.transactionSignature,
    playerSessionToken: session.playerSessionToken,
    error: session.error,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  };
}

async function createNativePlayerSessionRecord(walletAddress: string) {
  const token = generateOpaqueToken();
  const now = new Date();
  const session = {
    token,
    walletAddress,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + NATIVE_PLAYER_SESSION_TTL_MS).toISOString(),
  };

  await kv.set(`native-player-session:${token}`, session);
  return session;
}

async function createNativeWalletSessionRecord(
  kind: NativeWalletSessionKind,
  requestedMessage: string | null,
  transactionBase64: string | null,
) {
  const now = new Date();
  const sessionId = createNativeWalletSessionId();
  const session: NativeWalletSessionRecord = {
    id: sessionId,
    pollToken: generateOpaqueToken(),
    kind,
    authAction: getNativeWalletAuthAction(sessionId, kind),
    requestedMessage,
    transactionBase64,
    status: "pending",
    walletAddress: null,
    signatureBase64: null,
    transactionSignature: null,
    playerSessionToken: null,
    error: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + NATIVE_WALLET_SESSION_TTL_MS).toISOString(),
  };

  await kv.set(`native-wallet-session:${session.id}`, session);
  return session;
}

async function loadNativeWalletSession(sessionId: string) {
  const session = await kv.get(`native-wallet-session:${sessionId}`) as NativeWalletSessionRecord | null;
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now() && session.status === "pending") {
    session.status = "failed";
    session.error = "Session expired";
    session.updatedAt = new Date().toISOString();
    await kv.set(`native-wallet-session:${session.id}`, session);
  }

  return session;
}

async function deleteForumPostCascade(postId: string) {
  const post = await kv.get(`post:${postId}`);
  if (!post) {
    return false;
  }

  const likeEntries = await kv.getByPrefix(`like:${postId}:`);
  const commentEntries = await kv.getByPrefix(`comment:${postId}:`);

  await kv.del(`post:${postId}`);
  await Promise.all([
    ...likeEntries.map((entry: any) => kv.del(`like:${postId}:${entry.walletAddress}`)),
    ...commentEntries.flatMap((entry: any) => {
      return [
        kv.del(`comment:${postId}:${entry.id}`),
        kv.del(createTranslationCacheKey("comment", entry.id, "content", "tr")),
        kv.del(createTranslationCacheKey("comment", entry.id, "content", "en")),
      ];
    }),
    kv.del(createTranslationCacheKey("post", postId, "title", "tr")),
    kv.del(createTranslationCacheKey("post", postId, "title", "en")),
    kv.del(createTranslationCacheKey("post", postId, "content", "tr")),
    kv.del(createTranslationCacheKey("post", postId, "content", "en")),
  ]);

  return true;
}

async function deleteForumCommentCascade(postId: string, commentId: string) {
  const comment = await kv.get(`comment:${postId}:${commentId}`);
  if (!comment) {
    return false;
  }

  await kv.del(`comment:${postId}:${commentId}`);
  await Promise.all([
    kv.del(createTranslationCacheKey("comment", commentId, "content", "tr")),
    kv.del(createTranslationCacheKey("comment", commentId, "content", "en")),
  ]);

  const post = await kv.get(`post:${postId}`);
  if (post) {
    post.commentCount = Math.max(0, Number(post.commentCount || 0) - 1);
    await kv.set(`post:${postId}`, post);
  }

  return true;
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
      "x-duan-dev-auth",
      "x-admin-token",
      "x-player-session-token",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const createNativeWalletSession = async (c: any) => {
  try {
    const payload = await c.req.json().catch(() => ({}));
    const kind = payload?.kind as NativeWalletSessionKind | undefined;
    const requestedMessage = typeof payload?.requestedMessage === "string" ? payload.requestedMessage : null;
    const transactionBase64 = typeof payload?.transactionBase64 === "string" ? payload.transactionBase64 : null;

    if (kind !== "connect" && kind !== "sign-message" && kind !== "sign-transaction") {
      return c.json({ error: "Invalid native wallet session kind" }, 400);
    }

    if (kind === "sign-message" && !requestedMessage) {
      return c.json({ error: "requestedMessage is required for sign-message sessions" }, 400);
    }

    if (kind === "sign-transaction" && !transactionBase64) {
      return c.json({ error: "transactionBase64 is required for sign-transaction sessions" }, 400);
    }

    const session = await createNativeWalletSessionRecord(kind, requestedMessage, transactionBase64);
    return c.json({
      sessionId: session.id,
      pollToken: session.pollToken,
      authAction: session.authAction,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("Error creating native wallet session:", error);
    return c.json({ error: "Failed to create native wallet session" }, 500);
  }
};

app.post("/native-wallet/session", createNativeWalletSession);
app.post("/make-server-5d6242bb/native-wallet/session", createNativeWalletSession);

const getNativeWalletSession = async (c: any) => {
  try {
    const { sessionId } = c.req.param();
    const session = await loadNativeWalletSession(sessionId);
    if (!session) {
      return c.json({ error: "Native wallet session not found" }, 404);
    }

    return c.json(toPublicNativeWalletSession(session));
  } catch (error) {
    console.error("Error loading native wallet session:", error);
    return c.json({ error: "Failed to load native wallet session" }, 500);
  }
};

app.get("/native-wallet/session/:sessionId", getNativeWalletSession);
app.get("/make-server-5d6242bb/native-wallet/session/:sessionId", getNativeWalletSession);

const getNativeWalletSessionResult = async (c: any) => {
  try {
    const { sessionId } = c.req.param();
    const pollToken = c.req.query("token");
    const session = await loadNativeWalletSession(sessionId);
    if (!session) {
      return c.json({ error: "Native wallet session not found" }, 404);
    }

    if (!pollToken || pollToken !== session.pollToken) {
      return c.json({ error: "Invalid native wallet session poll token" }, 403);
    }

    return c.json(toPrivateNativeWalletSessionResult(session));
  } catch (error) {
    console.error("Error loading native wallet session result:", error);
    return c.json({ error: "Failed to load native wallet session result" }, 500);
  }
};

app.get("/native-wallet/session/:sessionId/result", getNativeWalletSessionResult);
app.get("/make-server-5d6242bb/native-wallet/session/:sessionId/result", getNativeWalletSessionResult);

const completeNativeWalletSession = async (c: any) => {
  try {
    const { sessionId } = c.req.param();
    const session = await loadNativeWalletSession(sessionId);
    if (!session) {
      return c.json({ error: "Native wallet session not found" }, 404);
    }

    if (session.status !== "pending") {
      return c.json(toPublicNativeWalletSession(session));
    }

    const payload = await c.req.json().catch(() => ({}));
    const walletAddress = c.req.header("x-wallet-address");
    if (!walletAddress) {
      return c.json({ error: "Missing wallet address header" }, 401);
    }

    const auth = await verifyWalletAuth(c, session.authAction, walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    session.walletAddress = walletAddress;
    session.error = null;

    if (session.kind === "connect") {
      const playerSession = await createNativePlayerSessionRecord(walletAddress);
      session.playerSessionToken = playerSession.token;
    } else if (session.kind === "sign-message") {
      const signatureBase64 = typeof payload?.signatureBase64 === "string" ? payload.signatureBase64 : "";
      if (!signatureBase64) {
        return c.json({ error: "signatureBase64 is required for sign-message sessions" }, 400);
      }

      session.signatureBase64 = signatureBase64;
    } else if (session.kind === "sign-transaction") {
      const transactionSignature = typeof payload?.transactionSignature === "string" ? payload.transactionSignature : "";
      if (!transactionSignature) {
        return c.json({ error: "transactionSignature is required for sign-transaction sessions" }, 400);
      }

      session.transactionSignature = transactionSignature;
    }

    session.status = "completed";
    session.updatedAt = new Date().toISOString();
    await kv.set(`native-wallet-session:${session.id}`, session);

    return c.json(toPublicNativeWalletSession(session));
  } catch (error) {
    console.error("Error completing native wallet session:", error);
    return c.json({ error: "Failed to complete native wallet session" }, 500);
  }
};

app.post("/native-wallet/session/:sessionId/complete", completeNativeWalletSession);
app.post("/make-server-5d6242bb/native-wallet/session/:sessionId/complete", completeNativeWalletSession);

const cancelNativeWalletSession = async (c: any) => {
  try {
    const { sessionId } = c.req.param();
    const session = await loadNativeWalletSession(sessionId);
    if (!session) {
      return c.json({ error: "Native wallet session not found" }, 404);
    }

    if (session.status === "pending") {
      session.status = "cancelled";
      session.error = "User cancelled the session";
      session.updatedAt = new Date().toISOString();
      await kv.set(`native-wallet-session:${session.id}`, session);
    }

    return c.json(toPublicNativeWalletSession(session));
  } catch (error) {
    console.error("Error cancelling native wallet session:", error);
    return c.json({ error: "Failed to cancel native wallet session" }, 500);
  }
};

app.post("/native-wallet/session/:sessionId/cancel", cancelNativeWalletSession);
app.post("/make-server-5d6242bb/native-wallet/session/:sessionId/cancel", cancelNativeWalletSession);

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
app.get("/make-server-5d6242bb/health", async (c) => {
  let databaseConnected = false;
  let databaseError: string | undefined;

  try {
    await kv.ping();
    databaseConnected = true;
  } catch (error) {
    console.error("Health check database error:", error);
    databaseError = error instanceof Error ? error.message : "Unknown database error";
  }

  const rpcUrl = resolveServerSolanaRpcUrl();
  const [shopConfig] = getShopConfigPda();
  const gameAuthoritySecretPresent = Boolean(resolveGameAuthoritySecretKey());
  const { provider, error: providerError } = createServerAnchorProvider();
  const connection = provider?.connection ?? new anchor.web3.Connection(rpcUrl, "confirmed");

  let rpcReachable = false;
  let rpcError: string | undefined;
  let programDeployed = false;
  let shopConfigInitialized = false;
  let latestSlot: number | null = null;

  try {
    latestSlot = await connection.getSlot("confirmed");
    rpcReachable = true;

    const [programAccountInfo, shopConfigInfo] = await Promise.all([
      connection.getAccountInfo(DUAN_SHOP_PROGRAM_ID, "confirmed"),
      connection.getAccountInfo(shopConfig, "confirmed"),
    ]);

    programDeployed = Boolean(programAccountInfo?.executable);
    shopConfigInitialized = Boolean(shopConfigInfo);
  } catch (error) {
    rpcError = error instanceof Error ? error.message : String(error);
  }

  const playerProfileSyncReady = Boolean(
    rpcReachable &&
    programDeployed &&
    shopConfigInitialized &&
    provider &&
    !providerError
  );

  const status = databaseConnected ? "ok" : "error";

  return c.json({
    status,
    service: "DUAN Edge Functions",
    env: {
      supabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
      supabaseServiceRoleKey: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
    },
    database: {
      connected: databaseConnected,
      table: "kv_store_5d6242bb",
      ...(databaseError ? { error: databaseError } : {}),
    },
    solana: {
      cluster: "devnet",
      rpcUrl,
      rpcReachable,
      latestSlot,
      programId: DUAN_SHOP_PROGRAM_ID.toBase58(),
      programDeployed,
      shopConfig: shopConfig.toBase58(),
      shopConfigInitialized,
      gameAuthoritySecretPresent,
      gameAuthorityReady: Boolean(provider && !providerError),
      playerProfileSyncReady,
      ...(providerError ? { providerError } : {}),
      ...(rpcError ? { rpcError } : {}),
    },
    timestamp: new Date().toISOString(),
  }, databaseConnected ? 200 : 500);
});

// ========== PLATFORM STATS ==========

// Get platform statistics
app.get("/make-server-5d6242bb/stats/platform", async (c) => {
  try {
    // Toplam profil sayisi; gercek "online user" metriği degil.
    const profiles = await kv.getByPrefix("profile:");
    const totalProfiles = profiles.length;
    const onlineUsers = await getOnlinePresenceCount();

    // Get total items in all inventories
    const inventoryItems = await kv.getByPrefix("inventory:");
    const totalItems = inventoryItems.length;

    // Get completed trades
    const allTrades = await kv.getByPrefix("trade:");
    const completedTrades = allTrades.filter((trade: any) => trade.status === "completed").length;

    return c.json({
      totalProfiles,
      activeUsers: totalProfiles,
      onlineUsers,
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
    const tokenInfo = await getResolvedTokenInfo();
    return c.json(tokenInfo);
  } catch (error) {
    console.error("Error fetching token info:", error);
    return c.json({ error: "Failed to fetch token info" }, 500);
  }
});

app.post("/make-server-5d6242bb/presence/heartbeat", async (c) => {
  try {
    const payload = await c.req.json();
    const walletAddress = String(payload?.walletAddress ?? "").trim();

    if (!walletAddress) {
      return c.json({ error: "walletAddress is required" }, 400);
    }

    await kv.set(`presence:${walletAddress}`, {
      walletAddress,
      lastSeenAt: new Date().toISOString(),
      source: "web",
    });

    return c.json({ ok: true, walletAddress, lastSeenAt: new Date().toISOString() });
  } catch (error) {
    console.error("Error updating presence heartbeat:", error);
    return c.json({ error: "Failed to update presence heartbeat" }, 500);
  }
});

// Unity ve diger istemciler ortak item katalogunu, ekonomi sabitlerini ve
// Solana baglanti ayarlarini bu endpoint uzerinden okuyabilir.
const getBootstrapConfig = async (c: any) => {
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
};

app.get("/bootstrap/config", getBootstrapConfig);
app.get("/make-server-5d6242bb/bootstrap/config", getBootstrapConfig);

app.get("/make-server-5d6242bb/shop/metadata-manifest", async (c) => {
  try {
    return c.json(buildShopMetadataManifest());
  } catch (error) {
    console.error("Error fetching shop metadata manifest:", error);
    return c.json({ error: "Failed to fetch shop metadata manifest" }, 500);
  }
});

// ========== PROFILE ROUTES ==========

// Get user profile
const getProfileRoute = async (c: any) => {
  try {
    const { walletAddress } = c.req.param();
    const profile = await getOrCreateProfile(walletAddress);
    return c.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
};

app.get("/profile/:walletAddress", getProfileRoute);
app.get("/make-server-5d6242bb/profile/:walletAddress", getProfileRoute);

// Update user profile
const updateProfileRoute = async (c: any) => {
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
};

app.put("/profile/:walletAddress", updateProfileRoute);
app.put("/make-server-5d6242bb/profile/:walletAddress", updateProfileRoute);

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
const getProfileStatsRoute = async (c: any) => {
  try {
    const { walletAddress } = c.req.param();
    const stats = await getOrCreateStats(walletAddress);
    return c.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
};

app.get("/profile/:walletAddress/stats", getProfileStatsRoute);
app.get("/make-server-5d6242bb/profile/:walletAddress/stats", getProfileStatsRoute);

app.get("/make-server-5d6242bb/leaderboard", async (c) => {
  try {
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 25), 1), 100);
    const profiles = await kv.getByPrefix("profile:");
    const statsEntries = await kv.getByPrefix("stats:");

    const leaderboard = statsEntries
      .map((stats: any) => {
        const walletAddress = stats?.walletAddress ?? stats?.playerId ?? null;
        const profile = profiles.find((entry: any) => entry.walletAddress === walletAddress) ?? null;

        return {
          walletAddress,
          username: profile?.username ?? (walletAddress ? `Player_${walletAddress.slice(0, 4)}` : "Unknown"),
          level: Number(stats?.level ?? 1),
          xp: Number(stats?.xp ?? 0),
          totalItems: Number(stats?.totalItems ?? 0),
          totalTrades: Number(stats?.totalTrades ?? 0),
          totalPosts: Number(stats?.totalPosts ?? 0),
          rewardDuanEarned: Number(stats?.rewardDuanEarned ?? 0),
          rewardSolEarned: Number(stats?.rewardSolEarned ?? 0),
        };
      })
      .filter((entry: any) => Boolean(entry.walletAddress))
      .sort((a: any, b: any) =>
        b.level - a.level ||
        b.xp - a.xp ||
        b.totalItems - a.totalItems ||
        b.totalTrades - a.totalTrades ||
        b.totalPosts - a.totalPosts
      )
      .slice(0, limit)
      .map((entry: any, index: number) => ({
        rank: index + 1,
        ...entry,
      }));

    return c.json({
      generatedAt: new Date().toISOString(),
      total: leaderboard.length,
      entries: leaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return c.json({ error: "Failed to fetch leaderboard" }, 500);
  }
});

// ========== INVENTORY ROUTES ==========

// Get user inventory
const getInventoryRoute = async (c: any) => {
  try {
    const { walletAddress } = c.req.param();
    const inventoryKeys = await kv.getByPrefix(`inventory:${walletAddress}:`);
    return c.json(inventoryKeys || []);
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return c.json({ error: "Failed to fetch inventory" }, 500);
  }
};

app.get("/inventory/:walletAddress", getInventoryRoute);
app.get("/make-server-5d6242bb/inventory/:walletAddress", getInventoryRoute);

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

    await deleteForumPostCascade(postId);
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

    const availableQuantity = Math.max(1, Number(offeredInventoryItem.quantity ?? 1));
    const activeListings = await kv.getByPrefix("listing:");
    const reservedQuantity = activeListings.reduce((count: number, listing: any) => {
      if (listing?.status !== "active" || listing?.sellerWallet !== data.sellerWallet) {
        return count;
      }

      if (listing?.offeredItemId === offeredInventoryItem.id || listing?.offeredItem?.id === offeredInventoryItem.item?.id) {
        return count + 1;
      }

      return count;
    }, 0);

    if (reservedQuantity >= availableQuantity) {
      return c.json({ error: "No remaining quantity is available for a new listing" }, 409);
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
      marketMode: data.marketMode || "backend",
      onchainListingPda: data.onchainListingPda || null,
      onchainProgramId: data.onchainProgramId || null,
      onchainStatus: data.onchainListingPda ? "mirrored" : "pending",
      txSignature: data.txSignature || null,
      language: detectContentLanguage(`${data.note || ""} ${data.wantedItemName || ""}`),
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: data.expiresAt || new Date(Date.now() + data.duration * 60 * 60 * 1000).toISOString(),
      listingNonce: data.listingNonce || null,
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
      marketMode: data.marketMode || "backend",
      onchainTradeIntentPda: data.onchainTradeIntentPda || null,
      onchainProgramId: data.onchainProgramId || null,
      txSignature: data.txSignature || null,
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

// ========== ADMIN ROUTES ==========

app.post("/make-server-5d6242bb/admin/session", async (c) => {
  const auth = await verifyAdminWalletAuth(c, "admin:session");
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const session = await createAdminSessionRecord(auth.walletAddress);
    await logAdminAction("admin:create_session", auth.walletAddress, { expiresAt: session.expiresAt });
    return c.json({
      token: session.token,
      walletAddress: session.walletAddress,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("Error creating admin session:", error);
    return c.json({ error: "Failed to create admin session" }, 500);
  }
});

app.get("/make-server-5d6242bb/admin/overview", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const [profiles, posts, listings, trades, tokenInfo, onlineUsers] = await Promise.all([
      kv.getByPrefix("profile:"),
      kv.getByPrefix("post:"),
      kv.getByPrefix("listing:"),
      kv.getByPrefix("trade:"),
      getResolvedTokenInfo(),
      getOnlinePresenceCount(),
    ]);

    const recentPosts = [...posts]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    const recentListings = [...listings]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    const recentTrades = [...trades]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return c.json({
      summary: {
        users: profiles.length,
        onlineUsers,
        posts: posts.length,
        activeListings: listings.filter((entry: any) => entry.status === "active").length,
        pendingTrades: trades.filter((entry: any) => entry.status === "pending").length,
      },
      recentPosts,
      recentListings,
      recentTrades,
      tokenInfo: tokenInfo ?? null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching admin overview:", error);
    return c.json({ error: "Failed to fetch admin overview" }, 500);
  }
});

app.get("/make-server-5d6242bb/admin/users", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const profiles = await kv.getByPrefix("profile:");
    const users = await Promise.all(profiles.map(async (profile: any) => {
      const stats = await kv.get(`stats:${profile.walletAddress}`) ?? createDefaultStats();
      return {
        profile,
        stats,
      };
    }));

    users.sort((a: any, b: any) => {
      const aDate = new Date(a.profile.createdAt ?? 0).getTime();
      const bDate = new Date(b.profile.createdAt ?? 0).getTime();
      return bDate - aDate;
    });

    return c.json(users);
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return c.json({ error: "Failed to fetch admin users" }, 500);
  }
});

app.get("/make-server-5d6242bb/admin/forum/comments", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const posts = await kv.getByPrefix("post:");
    const comments = await Promise.all(posts.map(async (post: any) => {
      const entries = await kv.getByPrefix(`comment:${post.id}:`);
      return entries.map((entry: any) => ({
        ...entry,
        postTitle: post.title,
      }));
    }));

    const flattened = comments.flat();
    flattened.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json(flattened);
  } catch (error) {
    console.error("Error fetching admin forum comments:", error);
    return c.json({ error: "Failed to fetch admin forum comments" }, 500);
  }
});

app.get("/make-server-5d6242bb/admin/forum/posts", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const posts = await kv.getByPrefix("post:");
    posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json(posts);
  } catch (error) {
    console.error("Error fetching admin forum posts:", error);
    return c.json({ error: "Failed to fetch admin forum posts" }, 500);
  }
});

app.delete("/make-server-5d6242bb/admin/forum/posts/:postId", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const { postId } = c.req.param();
    const deleted = await deleteForumPostCascade(postId);
    if (!deleted) {
      return c.json({ error: "Post not found" }, 404);
    }
    await logAdminAction("admin:delete_post", auth.walletAddress, { postId });
    return c.json({ deleted: true });
  } catch (error) {
    console.error("Error admin deleting post:", error);
    return c.json({ error: "Failed to delete post" }, 500);
  }
});

app.delete("/make-server-5d6242bb/admin/forum/comments/:postId/:commentId", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const { postId, commentId } = c.req.param();
    const deleted = await deleteForumCommentCascade(postId, commentId);
    if (!deleted) {
      return c.json({ error: "Comment not found" }, 404);
    }
    await logAdminAction("admin:delete_comment", auth.walletAddress, { postId, commentId });
    return c.json({ deleted: true });
  } catch (error) {
    console.error("Error admin deleting comment:", error);
    return c.json({ error: "Failed to delete comment" }, 500);
  }
});

app.get("/make-server-5d6242bb/admin/market/listings", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const listings = await kv.getByPrefix("listing:");
    listings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json(listings);
  } catch (error) {
    console.error("Error fetching admin market listings:", error);
    return c.json({ error: "Failed to fetch admin market listings" }, 500);
  }
});

app.get("/make-server-5d6242bb/admin/market/trades", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const trades = await kv.getByPrefix("trade:");
    trades.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json(trades);
  } catch (error) {
    console.error("Error fetching admin trades:", error);
    return c.json({ error: "Failed to fetch admin trades" }, 500);
  }
});

app.put("/make-server-5d6242bb/admin/market/trades/:tradeId", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const { tradeId } = c.req.param();
    const { status } = await c.req.json();
    const allowedStatuses = ["pending", "accepted", "completed", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      return c.json({ error: "Invalid trade status" }, 400);
    }

    const trade = await kv.get(`trade:${tradeId}`);
    if (!trade) {
      return c.json({ error: "Trade not found" }, 404);
    }

    trade.status = status;
    trade.updatedAt = new Date().toISOString();
    trade.updatedBy = auth.walletAddress;
    await kv.set(`trade:${tradeId}`, trade);
    await logAdminAction("admin:update_trade", auth.walletAddress, { tradeId, status });
    return c.json({ updated: true, trade });
  } catch (error) {
    console.error("Error admin updating trade:", error);
    return c.json({ error: "Failed to update trade" }, 500);
  }
});

app.delete("/make-server-5d6242bb/admin/market/listings/:listingId", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const { listingId } = c.req.param();
    const listing = await kv.get(`listing:${listingId}`);
    if (!listing) {
      return c.json({ error: "Listing not found" }, 404);
    }

    listing.status = "cancelled";
    listing.cancelledAt = new Date().toISOString();
    listing.cancelledBy = auth.walletAddress;
    await kv.set(`listing:${listingId}`, listing);
    await logAdminAction("admin:cancel_listing", auth.walletAddress, { listingId });
    return c.json({ cancelled: true });
  } catch (error) {
    console.error("Error admin cancelling listing:", error);
    return c.json({ error: "Failed to cancel listing" }, 500);
  }
});

app.get("/make-server-5d6242bb/admin/audit-logs", async (c) => {
  const auth = await verifyAdminSession(c);
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  try {
    const logs = await kv.getByPrefix("admin-log:");
    logs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json(logs.slice(0, 100));
  } catch (error) {
    console.error("Error fetching admin audit logs:", error);
    return c.json({ error: "Failed to fetch admin audit logs" }, 500);
  }
});

// ========== GAME INTEGRATION ROUTES ==========

// Sync game data
const syncGameDataRoute = async (c: any) => {
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

    let normalizedStats = await saveStatsWithAchievements(walletAddress, stats);

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
      normalizedStats = await incrementTotalItems(walletAddress, syncedItemCount);
    }

    const onchainProfile = await syncPlayerProfileOnchain(walletAddress, normalizedStats);

    return c.json({
      synced: true,
      onchainProfileSynced: onchainProfile.synced,
      onchainProfileSkipped: onchainProfile.skipped ?? false,
      onchainProfileSignature: onchainProfile.signature ?? null,
      onchainProfileAddress: onchainProfile.playerProfile ?? null,
      onchainProfileError: onchainProfile.error ?? null,
    });
  } catch (error) {
    console.error("Error syncing game data:", error);
    return c.json({ error: "Failed to sync game data" }, 500);
  }
};

app.post("/game/sync", syncGameDataRoute);
app.post("/make-server-5d6242bb/game/sync", syncGameDataRoute);

const syncGameInventoryRoute = async (c: any) => {
  try {
    const { walletAddress, inventoryItems, allowEmptySnapshot } = await c.req.json();
    const auth = await verifyWalletAuth(c, "game:inventory_sync", walletAddress);
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status);
    }

    if (!Array.isArray(inventoryItems)) {
      return c.json({ error: "inventoryItems must be an array" }, 400);
    }

    const currentInventory = await kv.getByPrefix(`inventory:${walletAddress}:`);
    const normalizedEntries = Array.isArray(inventoryItems)
      ? inventoryItems
          .map((entry: any) => ({
            itemId: String(entry?.itemId ?? "").trim(),
            quantity: Math.max(0, Number(entry?.quantity ?? 0)),
          }))
          .filter((entry: { itemId: string; quantity: number }) => entry.itemId && entry.quantity > 0)
      : [];

    if (!allowEmptySnapshot && normalizedEntries.length === 0 && currentInventory.length > 0) {
      const preservedItemCount = currentInventory.reduce((count: number, entry: any) =>
        count + Math.max(0, Number(entry?.quantity ?? 0)), 0);

      return c.json({
        synced: false,
        skippedEmptySnapshot: true,
        preservedStackCount: currentInventory.length,
        preservedItemCount,
      });
    }

    await Promise.all(currentInventory.map((entry: any) => {
      if (!entry?.id) {
        return Promise.resolve();
      }

      return kv.del(`inventory:${walletAddress}:${entry.id}`);
    }));

    let syncedItemCount = 0;
    let syncedStackCount = 0;

    for (const entry of normalizedEntries) {
      const { itemId, quantity } = entry;
      const item = await getShopItemById(itemId);
      if (!item) {
        console.warn(`Unknown itemId from inventory sync skipped: ${itemId}`);
        continue;
      }

      const inventoryItem = {
        id: `unity_${itemId}`,
        walletAddress,
        item,
        acquiredAt: new Date().toISOString(),
        source: "unity_snapshot",
        quantity,
      };

      await kv.set(`inventory:${walletAddress}:${inventoryItem.id}`, inventoryItem);
      syncedStackCount += 1;
      syncedItemCount += quantity;
    }

    const stats = await getOrCreateStats(walletAddress);
    const normalizedStats = await saveStatsWithAchievements(walletAddress, {
      ...stats,
      totalItems: syncedItemCount,
    });
    const onchainProfile = await syncPlayerProfileOnchain(walletAddress, normalizedStats);

    return c.json({
      synced: true,
      syncedStackCount,
      syncedItemCount,
      onchainProfileSynced: onchainProfile.synced,
      onchainProfileSkipped: onchainProfile.skipped ?? false,
      onchainProfileSignature: onchainProfile.signature ?? null,
      onchainProfileAddress: onchainProfile.playerProfile ?? null,
      onchainProfileError: onchainProfile.error ?? null,
    });
  } catch (error) {
    console.error("Error syncing inventory snapshot:", error);
    return c.json({ error: "Failed to sync inventory snapshot" }, 500);
  }
};

app.post("/game/inventory-sync", syncGameInventoryRoute);
app.post("/make-server-5d6242bb/game/inventory-sync", syncGameInventoryRoute);

// Trigger game event
const triggerGameEventRoute = async (c: any) => {
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
};

app.post("/game/event", triggerGameEventRoute);
app.post("/make-server-5d6242bb/game/event", triggerGameEventRoute);

Deno.serve(app.fetch);
