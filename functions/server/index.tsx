import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { logger } from "npm:hono@4/logger";
import nacl from "npm:tweetnacl@1.0.3";
import { PublicKey } from "npm:@solana/web3.js@1.98.4";
import * as kv from "./kv_store.tsx";
const app = new Hono();

type AuthClaims = {
  domain: "SOL101";
  action: string;
  walletAddress: string;
  timestamp: number;
};

const AUTH_MAX_AGE_MS = 5 * 60 * 1000;

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
      parsed?.domain !== "SOL101" ||
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

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Initialize shop items on server start
async function initializeShopItems() {
  try {
    const existingItems = await kv.getByPrefix("shop_item:");
    if (existingItems.length === 0) {
      console.log("Initializing shop items...");

      const shopItems = [
        {
          id: 'cosmic-blade',
          name: 'Cosmic Blade',
          description: 'A legendary sword forged in the depths of space. Glows with ethereal purple energy.',
          imageUrl: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400&q=80',
          price: 500,
          rarity: 'legendary',
          stock: 3,
          category: 'Weapons',
        },
        {
          id: 'stellar-shield',
          name: 'Stellar Shield',
          description: 'An epic shield that deflects all cosmic attacks. Reinforced with Solana energy.',
          imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80',
          price: 300,
          rarity: 'epic',
          stock: 8,
          category: 'Armor',
        },
        {
          id: 'nebula-potion',
          name: 'Nebula Potion',
          description: 'A rare potion that restores all stats. Tastes like stardust.',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
          price: 150,
          rarity: 'rare',
          stock: 20,
          category: 'Consumables',
        },
        {
          id: 'space-helmet',
          name: 'Space Helmet',
          description: 'Common protective headgear for space travelers. Basic but reliable.',
          imageUrl: 'https://images.unsplash.com/photo-1617791160536-598cf32026fb?w=400&q=80',
          price: 50,
          rarity: 'common',
          stock: 50,
          category: 'Armor',
        },
        {
          id: 'quantum-gauntlets',
          name: 'Quantum Gauntlets',
          description: 'Epic gloves that enhance your abilities. Made from quantum-entangled materials.',
          imageUrl: 'https://images.unsplash.com/photo-1608481337062-4093bf3ed404?w=400&q=80',
          price: 250,
          rarity: 'epic',
          stock: 12,
          category: 'Armor',
        },
        {
          id: 'crystal-amulet',
          name: 'Crystal Amulet',
          description: 'A rare mystical amulet that provides protection. Shimmers with inner light.',
          imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80',
          price: 180,
          rarity: 'rare',
          stock: 15,
          category: 'Accessories',
        },
      ];

      for (const item of shopItems) {
        await kv.set(`shop_item:${item.id}`, item);
      }

      console.log(`Initialized ${shopItems.length} shop items`);
    }
  } catch (error) {
    console.error("Error initializing shop items:", error);
  }
}

// Initialize shop items
initializeShopItems();

// Health check endpoint
app.get("/make-server-5d6242bb/health", (c) => {
  return c.json({ status: "ok" });
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
        price: 0.001, // Price in SOL
        totalSupply: 1000000,
        circulatingSupply: 500000,
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

// ========== PROFILE ROUTES ==========

// Get user profile
app.get("/make-server-5d6242bb/profile/:walletAddress", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const profile = await kv.get(`profile:${walletAddress}`);

    if (!profile) {
      // Create default profile
      const newProfile = {
        walletAddress,
        username: `Player_${walletAddress.slice(0, 4)}`,
        bio: "",
        createdAt: new Date().toISOString(),
      };
      await kv.set(`profile:${walletAddress}`, newProfile);
      return c.json(newProfile);
    }

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

    const currentProfile = await kv.get(`profile:${walletAddress}`) || {
      walletAddress,
      createdAt: new Date().toISOString(),
    };

    const updatedProfile = {
      ...currentProfile,
      ...updates,
      walletAddress, // Prevent overwriting wallet address
    };

    await kv.set(`profile:${walletAddress}`, updatedProfile);
    return c.json(updatedProfile);
  } catch (error) {
    console.error("Error updating profile:", error);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

// Get profile stats
app.get("/make-server-5d6242bb/profile/:walletAddress/stats", async (c) => {
  try {
    const { walletAddress } = c.req.param();
    const stats = await kv.get(`stats:${walletAddress}`) || {
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      totalPosts: 0,
      totalItems: 0,
      totalTrades: 0,
      achievements: [],
    };

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

    const inventoryItem = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      walletAddress,
      itemId,
      acquiredAt: new Date().toISOString(),
    };

    await kv.set(`inventory:${walletAddress}:${inventoryItem.id}`, inventoryItem);
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

    let posts = await kv.getByPrefix("post:");

    if (tag && tag !== "all") {
      posts = posts.filter((post: any) => post.tags?.includes(tag));
    }

    if (sort === "popular") {
      posts.sort((a: any, b: any) => (b.likeCount || 0) - (a.likeCount || 0));
    } else {
      posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

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
      likeCount: 0,
      commentCount: 0,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`post:${post.id}`, post);

    // Update user stats
    const stats = await kv.get(`stats:${data.walletAddress}`) || {
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      totalPosts: 0,
      totalItems: 0,
      totalTrades: 0,
      achievements: [],
    };
    stats.totalPosts = (stats.totalPosts || 0) + 1;
    stats.xp = (stats.xp || 0) + 10; // Award XP for posting
    await kv.set(`stats:${data.walletAddress}`, stats);

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
      return c.json({ liked: false });
    } else {
      // Like
      await kv.set(likeKey, { postId, walletAddress, likedAt: new Date().toISOString() });
      post.likeCount = (post.likeCount || 0) + 1;
      await kv.set(`post:${postId}`, post);
      return c.json({ liked: true });
    }
  } catch (error) {
    console.error("Error liking post:", error);
    return c.json({ error: "Failed to like post" }, 500);
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
    const item = await kv.get(`shop_item:${itemId}`);
    if (!item) {
      return c.json({ error: "Item not found" }, 404);
    }

    // Add to inventory
    const inventoryItem = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      walletAddress,
      item,
      acquiredAt: new Date().toISOString(),
      txSignature: `tx_${Date.now()}`, // Mock transaction
    };

    await kv.set(`inventory:${walletAddress}:${inventoryItem.id}`, inventoryItem);

    // Update stats
    const stats = await kv.get(`stats:${walletAddress}`) || {
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      totalPosts: 0,
      totalItems: 0,
      totalTrades: 0,
      achievements: [],
    };
    stats.totalItems = (stats.totalItems || 0) + 1;
    await kv.set(`stats:${walletAddress}`, stats);

    return c.json({ transaction: inventoryItem.txSignature, item: inventoryItem });
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

    let listings = await kv.getByPrefix("listing:");

    if (status !== "all") {
      listings = listings.filter((listing: any) => listing.status === status);
    }

    return c.json(listings || []);
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

    const listing = {
      id: `listing_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      ...data,
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + data.duration * 60 * 60 * 1000).toISOString(),
    };

    await kv.set(`listing:${listing.id}`, listing);
    return c.json(listing);
  } catch (error) {
    console.error("Error creating listing:", error);
    return c.json({ error: "Failed to create listing" }, 500);
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

    const trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      listingId,
      ...data,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    await kv.set(`trade:${trade.id}`, trade);

    // Update stats
    const stats = await kv.get(`stats:${data.buyerWallet}`) || {
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      totalPosts: 0,
      totalItems: 0,
      totalTrades: 0,
      achievements: [],
    };
    stats.totalTrades = (stats.totalTrades || 0) + 1;
    await kv.set(`stats:${data.buyerWallet}`, stats);

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
    const allListings = await kv.getByPrefix("listing:");
    const userListings = allListings.filter((listing: any) => listing.sellerWallet === walletAddress);
    return c.json(userListings || []);
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

    const stats = await kv.get(`stats:${walletAddress}`) || {
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      totalPosts: 0,
      totalItems: 0,
      totalTrades: 0,
      achievements: [],
    };

    // Update stats from game
    if (level !== undefined) stats.level = level;
    if (xp !== undefined) {
      stats.xp = xp;
      stats.xpToNextLevel = stats.level * 100; // Simple XP formula
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

    await kv.set(`stats:${walletAddress}`, stats);

    // Add items to inventory
    if (itemsEarned && Array.isArray(itemsEarned)) {
      for (const itemId of itemsEarned) {
        const inventoryItem = {
          id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          walletAddress,
          itemId,
          acquiredAt: new Date().toISOString(),
          source: "game_reward",
        };
        await kv.set(`inventory:${walletAddress}:${inventoryItem.id}`, inventoryItem);
      }
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