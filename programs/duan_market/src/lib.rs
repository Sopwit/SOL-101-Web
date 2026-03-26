use anchor_lang::prelude::*;

declare_id!("9C7JgT4r9D4K1wVtwJAnYXhYzu3PV6PvJEa3TBUnVJWM");

const ITEM_ID_MAX_LEN: usize = 32;

#[program]
pub mod duan_market {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        duan_shop_program: Pubkey,
        settlement_authority: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= 2_500, MarketError::FeeTooHigh);

        let market = &mut ctx.accounts.market_config;
        market.authority = ctx.accounts.authority.key();
        market.duan_shop_program = duan_shop_program;
        market.settlement_authority = settlement_authority;
        market.fee_bps = fee_bps;
        market.bump = ctx.bumps.market_config;
        Ok(())
    }

    pub fn open_listing_escrow(
        ctx: Context<OpenListingEscrow>,
        args: OpenListingArgs,
    ) -> Result<()> {
        require!(
            args.item_id.as_bytes().len() <= ITEM_ID_MAX_LEN,
            MarketError::ItemIdTooLong
        );
        require!(
            args.wanted_item_id.as_bytes().len() <= ITEM_ID_MAX_LEN,
            MarketError::ItemIdTooLong
        );
        require!(args.expires_at > Clock::get()?.unix_timestamp, MarketError::InvalidExpiry);

        let listing = &mut ctx.accounts.listing_escrow;
        listing.market = ctx.accounts.market_config.key();
        listing.seller = ctx.accounts.seller.key();
        listing.item_id = args.item_id;
        listing.wanted_type = args.wanted_type;
        listing.wanted_amount = args.wanted_amount;
        listing.wanted_item_id = args.wanted_item_id;
        listing.status = ListingStatus::Open as u8;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.expires_at = args.expires_at;
        listing.listing_nonce = args.listing_nonce;
        listing.accepted_trade = Pubkey::default();
        listing.bump = ctx.bumps.listing_escrow;

        emit!(ListingOpenedEvent {
            listing: listing.key(),
            seller: listing.seller,
            item_id: listing.item_id.clone(),
            wanted_type: listing.wanted_type,
            wanted_amount: listing.wanted_amount,
            wanted_item_id: listing.wanted_item_id.clone(),
            expires_at: listing.expires_at,
        });

        Ok(())
    }

    pub fn cancel_listing_escrow(ctx: Context<CancelListingEscrow>) -> Result<()> {
        let listing = &mut ctx.accounts.listing_escrow;
        require!(
            listing.status == ListingStatus::Open as u8,
            MarketError::ListingNotOpen
        );

        listing.status = ListingStatus::Cancelled as u8;
        emit!(ListingCancelledEvent {
            listing: listing.key(),
            seller: listing.seller,
        });
        Ok(())
    }

    pub fn create_trade_intent(
        ctx: Context<CreateTradeIntent>,
        args: CreateTradeIntentArgs,
    ) -> Result<()> {
        require!(
            args.offered_item_id.as_bytes().len() <= ITEM_ID_MAX_LEN,
            MarketError::ItemIdTooLong
        );

        let listing = &ctx.accounts.listing_escrow;
        require!(
            listing.status == ListingStatus::Open as u8,
            MarketError::ListingNotOpen
        );
        require!(
            listing.expires_at > Clock::get()?.unix_timestamp,
            MarketError::ListingExpired
        );
        require_keys_neq!(listing.seller, ctx.accounts.buyer.key(), MarketError::SelfTradeBlocked);

        let trade_intent = &mut ctx.accounts.trade_intent;
        trade_intent.listing = listing.key();
        trade_intent.buyer = ctx.accounts.buyer.key();
        trade_intent.offered_amount = args.offered_amount;
        trade_intent.offered_item_id = args.offered_item_id;
        trade_intent.status = TradeIntentStatus::Open as u8;
        trade_intent.created_at = Clock::get()?.unix_timestamp;
        trade_intent.bump = ctx.bumps.trade_intent;

        emit!(TradeIntentCreatedEvent {
            listing: listing.key(),
            trade_intent: trade_intent.key(),
            buyer: trade_intent.buyer,
            offered_amount: trade_intent.offered_amount,
            offered_item_id: trade_intent.offered_item_id.clone(),
        });

        Ok(())
    }

    pub fn accept_trade_intent(ctx: Context<AcceptTradeIntent>) -> Result<()> {
        let listing = &mut ctx.accounts.listing_escrow;
        let trade_intent = &mut ctx.accounts.trade_intent;

        require!(
            listing.status == ListingStatus::Open as u8,
            MarketError::ListingNotOpen
        );
        require!(
            trade_intent.status == TradeIntentStatus::Open as u8,
            MarketError::TradeIntentNotOpen
        );
        require_keys_eq!(trade_intent.listing, listing.key(), MarketError::TradeIntentListingMismatch);

        listing.status = ListingStatus::Accepted as u8;
        listing.accepted_trade = trade_intent.key();
        trade_intent.status = TradeIntentStatus::Accepted as u8;

        emit!(TradeIntentAcceptedEvent {
            listing: listing.key(),
            trade_intent: trade_intent.key(),
            seller: listing.seller,
            buyer: trade_intent.buyer,
        });

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct OpenListingArgs {
    #[max_len(ITEM_ID_MAX_LEN)]
    pub item_id: String,
    pub wanted_type: u8,
    pub wanted_amount: u64,
    #[max_len(ITEM_ID_MAX_LEN)]
    pub wanted_item_id: String,
    pub expires_at: i64,
    pub listing_nonce: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CreateTradeIntentArgs {
    pub offered_amount: u64,
    #[max_len(ITEM_ID_MAX_LEN)]
    pub offered_item_id: String,
}

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        seeds = [b"market-config"],
        bump,
        space = 8 + MarketConfig::INIT_SPACE
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: OpenListingArgs)]
pub struct OpenListingEscrow<'info> {
    #[account(
        seeds = [b"market-config"],
        bump = market_config.bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        init,
        payer = seller,
        seeds = [b"listing", seller.key().as_ref(), &args.listing_nonce.to_le_bytes()],
        bump,
        space = 8 + ListingEscrow::INIT_SPACE
    )]
    pub listing_escrow: Account<'info, ListingEscrow>,
    #[account(mut)]
    pub seller: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListingEscrow<'info> {
    #[account(
        seeds = [b"market-config"],
        bump = market_config.bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        mut,
        seeds = [b"listing", seller.key().as_ref(), &listing_escrow.listing_nonce.to_le_bytes()],
        bump = listing_escrow.bump,
        has_one = seller,
        has_one = market
    )]
    pub listing_escrow: Account<'info, ListingEscrow>,
    #[account(address = listing_escrow.market)]
    pub market: Account<'info, MarketConfig>,
    pub seller: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateTradeIntent<'info> {
    #[account(
        seeds = [b"market-config"],
        bump = market_config.bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        mut,
        has_one = market
    )]
    pub listing_escrow: Account<'info, ListingEscrow>,
    #[account(address = listing_escrow.market)]
    pub market: Account<'info, MarketConfig>,
    #[account(
        init_if_needed,
        payer = buyer,
        seeds = [b"trade-intent", listing_escrow.key().as_ref(), buyer.key().as_ref()],
        bump,
        space = 8 + TradeIntent::INIT_SPACE
    )]
    pub trade_intent: Account<'info, TradeIntent>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptTradeIntent<'info> {
    #[account(
        seeds = [b"market-config"],
        bump = market_config.bump
    )]
    pub market_config: Account<'info, MarketConfig>,
    #[account(
        mut,
        has_one = seller,
        has_one = market
    )]
    pub listing_escrow: Account<'info, ListingEscrow>,
    #[account(address = listing_escrow.market)]
    pub market: Account<'info, MarketConfig>,
    #[account(
        mut,
        has_one = listing
    )]
    pub trade_intent: Account<'info, TradeIntent>,
    #[account(address = trade_intent.listing)]
    pub listing: Account<'info, ListingEscrow>,
    pub seller: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct MarketConfig {
    pub authority: Pubkey,
    pub duan_shop_program: Pubkey,
    pub settlement_authority: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ListingEscrow {
    pub market: Pubkey,
    pub seller: Pubkey,
    #[max_len(ITEM_ID_MAX_LEN)]
    pub item_id: String,
    pub wanted_type: u8,
    pub wanted_amount: u64,
    #[max_len(ITEM_ID_MAX_LEN)]
    pub wanted_item_id: String,
    pub status: u8,
    pub created_at: i64,
    pub expires_at: i64,
    pub listing_nonce: u64,
    pub accepted_trade: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TradeIntent {
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub offered_amount: u64,
    #[max_len(ITEM_ID_MAX_LEN)]
    pub offered_item_id: String,
    pub status: u8,
    pub created_at: i64,
    pub bump: u8,
}

#[event]
pub struct ListingOpenedEvent {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub item_id: String,
    pub wanted_type: u8,
    pub wanted_amount: u64,
    pub wanted_item_id: String,
    pub expires_at: i64,
}

#[event]
pub struct ListingCancelledEvent {
    pub listing: Pubkey,
    pub seller: Pubkey,
}

#[event]
pub struct TradeIntentCreatedEvent {
    pub listing: Pubkey,
    pub trade_intent: Pubkey,
    pub buyer: Pubkey,
    pub offered_amount: u64,
    pub offered_item_id: String,
}

#[event]
pub struct TradeIntentAcceptedEvent {
    pub listing: Pubkey,
    pub trade_intent: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
}

#[repr(u8)]
pub enum ListingStatus {
    Open = 1,
    Accepted = 2,
    Cancelled = 3,
}

#[repr(u8)]
pub enum TradeIntentStatus {
    Open = 1,
    Accepted = 2,
}

#[error_code]
pub enum MarketError {
    #[msg("Item id is too long.")]
    ItemIdTooLong,
    #[msg("Listing expiry must be in the future.")]
    InvalidExpiry,
    #[msg("Fee bps is too high.")]
    FeeTooHigh,
    #[msg("Listing is not open.")]
    ListingNotOpen,
    #[msg("Listing has expired.")]
    ListingExpired,
    #[msg("Trade intent is not open.")]
    TradeIntentNotOpen,
    #[msg("Seller and buyer cannot be the same wallet.")]
    SelfTradeBlocked,
    #[msg("Trade intent does not belong to this listing.")]
    TradeIntentListingMismatch,
}
