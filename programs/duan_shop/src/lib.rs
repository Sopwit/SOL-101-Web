use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("3bssRuvTNFzsGbawzSWtFgycQBXvL1vWXnq44XUSu5y3");

// Item ve achievement alanlari icin sabit boyutlar. Bunlar hesap boyutunu
// ve PDA alan maliyetini dogrudan etkiler.
const ITEM_ID_MAX_LEN: usize = 32;
const ACHIEVEMENT_BYTES: usize = 32;

#[program]
pub mod duan_shop {
    use super::*;

    // Shop konfigurasyonunu kurar ve ilk authority/treasury kaydini yazar.
    pub fn initialize_shop(ctx: Context<InitializeShop>) -> Result<()> {
        let shop = &mut ctx.accounts.shop_config;
        shop.authority = ctx.accounts.authority.key();
        shop.game_authority = ctx.accounts.authority.key();
        shop.treasury = ctx.accounts.treasury.key();
        shop.bump = ctx.bumps.shop_config;
        Ok(())
    }

    // Unity veya backend tarafindan kullanilabilecek oyun yetkisini gunceller.
    pub fn set_game_authority(
        ctx: Context<SetGameAuthority>,
        new_game_authority: Pubkey,
    ) -> Result<()> {
        ctx.accounts.shop_config.game_authority = new_game_authority;
        Ok(())
    }

    // Item kaydini olusturur veya gunceller. Dinamik fiyat her yazimda tekrar
    // hesaplanir ki istemci eski fiyatla kalmasin.
    pub fn upsert_item(ctx: Context<UpsertItem>, args: UpsertItemArgs) -> Result<()> {
        require!(
            args.item_id.as_bytes().len() <= ITEM_ID_MAX_LEN,
            ShopError::ItemIdTooLong
        );

        let shop = &ctx.accounts.shop_config;
        let item = &mut ctx.accounts.shop_item;

        if item.shop == Pubkey::default() {
            item.shop = shop.key();
            item.bump = ctx.bumps.shop_item;
        }

        item.item_id = args.item_id;
        item.base_price = args.base_price;
        item.price = item.calculate_dynamic_price();
        item.base_stock = args.base_stock;
        item.stock = args.stock.unwrap_or(args.base_stock);
        item.sold_count = args.sold_count.unwrap_or(0);
        item.restock_at = args.restock_at.unwrap_or(0);
        item.restock_duration_seconds = args.restock_duration_seconds;
        item.rarity = args.rarity;
        Ok(())
    }

    // Oyuncu profilini oyun/backend tarafindan senkronize etmek icin kullanilir.
    pub fn upsert_player_profile(
        ctx: Context<UpsertPlayerProfile>,
        args: UpsertPlayerProfileArgs,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.player_profile;

        if profile.owner == Pubkey::default() {
            profile.owner = ctx.accounts.owner.key();
            profile.shop = ctx.accounts.shop_config.key();
            profile.bump = ctx.bumps.player_profile;
        }

        require_keys_eq!(
            profile.owner,
            ctx.accounts.owner.key(),
            ShopError::PlayerProfileOwnerMismatch
        );
        require_keys_eq!(
            profile.shop,
            ctx.accounts.shop_config.key(),
            ShopError::PlayerProfileShopMismatch
        );

        profile.level = args.level;
        profile.xp = args.xp;
        profile.xp_to_next_level = args.xp_to_next_level;
        profile.total_items = args.total_items;
        profile.total_trades = args.total_trades;
        profile.achievements = args.achievements;
        profile.last_synced_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    // Restock zamani geldiyse item durumunu zincir uzerinde tazeler.
    pub fn refresh_item(ctx: Context<RefreshItem>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        ctx.accounts.shop_item.refresh_if_needed(now);
        Ok(())
    }

    // Satin alma akisi: SOL transferi, owned item kaydi ve oyuncu profil
    // sayaçlarinin artirilmasi tek instruction icinde yapilir.
    pub fn purchase_item(ctx: Context<PurchaseItem>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let item = &mut ctx.accounts.shop_item;
        let owned_item = &mut ctx.accounts.owned_item;
        let player_profile = &mut ctx.accounts.player_profile;

        require_keys_eq!(
            ctx.accounts.shop_config.treasury,
            ctx.accounts.treasury.key(),
            ShopError::TreasuryMismatch
        );

        item.refresh_if_needed(now);
        require!(item.stock > 0, ShopError::ItemRestocking);

        let current_price = item.price;

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.treasury.key(),
                current_price,
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        item.stock = item.stock.saturating_sub(1);
        item.sold_count = item.sold_count.saturating_add(1);

        initialize_owned_item_if_needed(
            owned_item,
            ctx.accounts.buyer.key(),
            ctx.accounts.shop_config.key(),
            item.item_id.clone(),
            ctx.bumps.owned_item,
        )?;
        owned_item.quantity = owned_item.quantity.saturating_add(1);
        owned_item.total_spent = owned_item.total_spent.saturating_add(current_price);
        owned_item.last_purchase_at = now;

        initialize_player_profile_if_needed(
            player_profile,
            ctx.accounts.buyer.key(),
            ctx.accounts.shop_config.key(),
            ctx.bumps.player_profile,
        )?;
        player_profile.total_items = player_profile.total_items.saturating_add(1);
        player_profile.last_synced_at = now;

        if item.stock == 0 {
            item.restock_at = now.saturating_add(item.restock_duration_seconds);
        }

        item.price = item.calculate_dynamic_price();

        emit!(ItemPurchasedEvent {
            shop: ctx.accounts.shop_config.key(),
            item: item.key(),
            item_id: item.item_id.clone(),
            buyer: ctx.accounts.buyer.key(),
            purchase_price: current_price,
            stock_after: item.stock,
            sold_count: item.sold_count,
            restock_at: item.restock_at,
            owned_quantity: owned_item.quantity,
        });

        Ok(())
    }

}

fn initialize_owned_item_if_needed(
    owned_item: &mut Account<OwnedItem>,
    owner: Pubkey,
    shop: Pubkey,
    item_id: String,
    bump: u8,
) -> Result<()> {
    // Ilk satin almada ilgili item kaydini olustur, sonraki alimlarda mevcut
    // kaydi koru.
    if owned_item.owner == Pubkey::default() {
        owned_item.owner = owner;
        owned_item.shop = shop;
        owned_item.item_id = item_id;
        owned_item.bump = bump;
    }

    require_keys_eq!(owned_item.owner, owner, ShopError::OwnedItemOwnerMismatch);
    require_keys_eq!(owned_item.shop, shop, ShopError::OwnedItemShopMismatch);
    Ok(())
}

fn initialize_player_profile_if_needed(
    player_profile: &mut Account<PlayerProfile>,
    owner: Pubkey,
    shop: Pubkey,
    bump: u8,
) -> Result<()> {
    // Satin alma akisi oyuncu profilini de lazy-init eder; bu sayede frontend
    // tarafinda ayri bir init zorunlulugu olmaz.
    if player_profile.owner == Pubkey::default() {
        player_profile.owner = owner;
        player_profile.shop = shop;
        player_profile.level = 1;
        player_profile.xp = 0;
        player_profile.xp_to_next_level = 100;
        player_profile.achievements = [0; ACHIEVEMENT_BYTES];
        player_profile.bump = bump;
    }

    require_keys_eq!(
        player_profile.owner,
        owner,
        ShopError::PlayerProfileOwnerMismatch
    );
    require_keys_eq!(
        player_profile.shop,
        shop,
        ShopError::PlayerProfileShopMismatch
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeShop<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        seeds = [b"shop-config"],
        bump,
        space = 8 + ShopConfig::INIT_SPACE
    )]
    pub shop_config: Account<'info, ShopConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetGameAuthority<'info> {
    #[account(
        mut,
        seeds = [b"shop-config"],
        bump = shop_config.bump,
        has_one = authority
    )]
    pub shop_config: Account<'info, ShopConfig>,
    pub authority: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpsertItemArgs {
    pub item_id: String,
    pub base_price: u64,
    pub base_stock: u32,
    pub stock: Option<u32>,
    pub sold_count: Option<u64>,
    pub restock_at: Option<i64>,
    pub restock_duration_seconds: i64,
    pub rarity: u8,
}

#[derive(Accounts)]
#[instruction(args: UpsertItemArgs)]
pub struct UpsertItem<'info> {
    #[account(
        seeds = [b"shop-config"],
        bump = shop_config.bump,
        has_one = authority
    )]
    pub shop_config: Account<'info, ShopConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        seeds = [b"item", shop_config.key().as_ref(), args.item_id.as_bytes()],
        bump,
        space = 8 + ShopItem::INIT_SPACE
    )]
    pub shop_item: Account<'info, ShopItem>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpsertPlayerProfileArgs {
    pub level: u32,
    pub xp: u64,
    pub xp_to_next_level: u64,
    pub total_items: u32,
    pub total_trades: u32,
    pub achievements: [u8; ACHIEVEMENT_BYTES],
}

#[derive(Accounts)]
pub struct UpsertPlayerProfile<'info> {
    #[account(
        seeds = [b"shop-config"],
        bump = shop_config.bump,
        has_one = game_authority
    )]
    pub shop_config: Account<'info, ShopConfig>,
    #[account(mut)]
    pub game_authority: Signer<'info>,
    /// CHECK: The profile PDA itself enforces ownership.
    pub owner: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = game_authority,
        seeds = [b"player-profile", shop_config.key().as_ref(), owner.key().as_ref()],
        bump,
        space = 8 + PlayerProfile::INIT_SPACE
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefreshItem<'info> {
    #[account(
        seeds = [b"shop-config"],
        bump = shop_config.bump
    )]
    pub shop_config: Account<'info, ShopConfig>,
    #[account(
        mut,
        seeds = [b"item", shop_config.key().as_ref(), shop_item.item_id.as_bytes()],
        bump = shop_item.bump,
        constraint = shop_item.shop == shop_config.key() @ ShopError::ShopMismatch
    )]
    pub shop_item: Account<'info, ShopItem>,
}

#[derive(Accounts)]
pub struct PurchaseItem<'info> {
    #[account(
        seeds = [b"shop-config"],
        bump = shop_config.bump
    )]
    pub shop_config: Account<'info, ShopConfig>,
    #[account(
        mut,
        seeds = [b"item", shop_config.key().as_ref(), shop_item.item_id.as_bytes()],
        bump = shop_item.bump,
        constraint = shop_item.shop == shop_config.key() @ ShopError::ShopMismatch
    )]
    pub shop_item: Account<'info, ShopItem>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = buyer,
        // Her oyuncu + shop + item kimligi icin tek bir sahiplik kaydi tutulur.
        seeds = [b"owned-item", buyer.key().as_ref(), shop_config.key().as_ref(), shop_item.item_id.as_bytes()],
        bump,
        space = 8 + OwnedItem::INIT_SPACE
    )]
    pub owned_item: Account<'info, OwnedItem>,
    #[account(
        init_if_needed,
        payer = buyer,
        // Satin alma aninda oyuncu profili yoksa otomatik olusturulur.
        seeds = [b"player-profile", shop_config.key().as_ref(), buyer.key().as_ref()],
        bump,
        space = 8 + PlayerProfile::INIT_SPACE
    )]
    pub player_profile: Account<'info, PlayerProfile>,
    #[account(mut, address = shop_config.treasury)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct ShopConfig {
    pub authority: Pubkey,
    pub game_authority: Pubkey,
    pub treasury: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ShopItem {
    pub shop: Pubkey,
    #[max_len(ITEM_ID_MAX_LEN)]
    pub item_id: String,
    pub price: u64,
    pub base_price: u64,
    pub stock: u32,
    pub base_stock: u32,
    pub sold_count: u64,
    pub restock_at: i64,
    pub restock_duration_seconds: i64,
    pub rarity: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OwnedItem {
    pub owner: Pubkey,
    pub shop: Pubkey,
    #[max_len(ITEM_ID_MAX_LEN)]
    pub item_id: String,
    pub quantity: u32,
    pub total_spent: u64,
    pub last_purchase_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerProfile {
    pub owner: Pubkey,
    pub shop: Pubkey,
    pub level: u32,
    pub xp: u64,
    pub xp_to_next_level: u64,
    pub total_items: u32,
    pub total_trades: u32,
    pub achievements: [u8; ACHIEVEMENT_BYTES],
    pub last_synced_at: i64,
    pub bump: u8,
}

impl ShopItem {
    // Talep arttikca fiyat artisina izin verir, fakat taban fiyatin cok
    // uzerine kontrolsuz tasmasini sinirlar.
    pub fn calculate_dynamic_price(&self) -> u64 {
        let multiplier_bps = match self.rarity {
            0 => 400_u64,
            1 => 600_u64,
            2 => 800_u64,
            3 => 1200_u64,
            _ => 500_u64,
        };

        let sold_component = self
            .base_price
            .saturating_mul(self.sold_count)
            .saturating_mul(multiplier_bps)
            / 10_000;

        let max_price = self.base_price.saturating_mul(25) / 10;
        let calculated = self.base_price.saturating_add(sold_component);

        calculated.clamp(self.base_price, max_price)
    }

    // Restock zamani gecmisse stogu taban seviyeye donderir ve satis baskisini
    // bir miktar azaltir.
    pub fn refresh_if_needed(&mut self, now: i64) {
        if self.stock == 0 && self.restock_at > 0 && now >= self.restock_at {
            self.stock = self.base_stock;
            self.sold_count = self.sold_count.saturating_mul(35) / 100;
            self.restock_at = 0;
            self.price = self.calculate_dynamic_price();
        }
    }
}

#[event]
pub struct ItemPurchasedEvent {
    pub shop: Pubkey,
    pub item: Pubkey,
    pub item_id: String,
    pub buyer: Pubkey,
    pub purchase_price: u64,
    pub stock_after: u32,
    pub sold_count: u64,
    pub restock_at: i64,
    pub owned_quantity: u32,
}

#[error_code]
pub enum ShopError {
    #[msg("Only the configured authority can perform this action.")]
    Unauthorized,
    #[msg("The provided item id is too long.")]
    ItemIdTooLong,
    #[msg("This item is currently restocking.")]
    ItemRestocking,
    #[msg("The provided treasury does not match the shop configuration.")]
    TreasuryMismatch,
    #[msg("The provided item does not belong to this shop configuration.")]
    ShopMismatch,
    #[msg("The owned item record does not belong to the current owner.")]
    OwnedItemOwnerMismatch,
    #[msg("The owned item record does not belong to this shop configuration.")]
    OwnedItemShopMismatch,
    #[msg("The owned item record does not match the requested item.")]
    OwnedItemItemMismatch,
    #[msg("The player profile does not belong to the current owner.")]
    PlayerProfileOwnerMismatch,
    #[msg("The player profile does not belong to this shop configuration.")]
    PlayerProfileShopMismatch,
}
