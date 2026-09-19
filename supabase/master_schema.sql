-- ==============================================================================
-- POLYGAME: MASTER CANONICAL DATABASE SCHEMA (v1.5.363 Authoritative)
-- ==============================================================================
-- This script contains the complete, authoritative definitions for all tables,
-- column types, constraints, default values, indexes, and Row Level Security (RLS)
-- policies used by Polygon Gaming.
-- ==============================================================================

-- Enable UUID & cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABLE: users (Core Player Identity, Balances, High Scores & Downlines)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  player_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  linked_wallet_address TEXT,
  wallet_address TEXT,
  username TEXT,
  email TEXT DEFAULT NULL,
  balance_pgt NUMERIC NOT NULL DEFAULT 0.0,
  dex_liquidity_usd NUMERIC NOT NULL DEFAULT 0.0,
  is_admin BOOLEAN DEFAULT false,
  is_ambassador BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  bot_warning INTEGER DEFAULT 0,
  total_earned NUMERIC DEFAULT 0.0,
  total_arcade_plays INTEGER DEFAULT 0,
  
  -- Weekly Leaderboard High Scores (Reset weekly)
  game_highscore INTEGER DEFAULT 0,          -- Astro-Dodge
  invaders_highscore INTEGER DEFAULT 0,      -- Cyber Invaders
  drift_highscore INTEGER DEFAULT 0,         -- Cyber Drift
  stacker_highscore INTEGER DEFAULT 0,       -- Cyber Stacker
  skeet_highscore INTEGER DEFAULT 0,         -- Cyber Skeet
  defense_highscore INTEGER DEFAULT 0,       -- Cyber Defense
  
  -- All-Time Career High Scores (Never reset)
  alltime_game_highscore INTEGER DEFAULT 0,
  alltime_invaders_highscore INTEGER DEFAULT 0,
  alltime_drift_highscore INTEGER DEFAULT 0,
  alltime_stacker_highscore INTEGER DEFAULT 0,
  alltime_skeet_highscore INTEGER DEFAULT 0,
  defense_alltime_best INTEGER DEFAULT 0,
  
  -- PolySpace Fleet Operations
  space_fleet_power INTEGER DEFAULT 100,
  space_warp_level INTEGER DEFAULT 1,
  space_laser_level INTEGER DEFAULT 1,
  space_cargo_level INTEGER DEFAULT 1,
  space_minerals_mined INTEGER DEFAULT 0,
  space_state JSONB DEFAULT '{}'::jsonb,
  
  -- Weekly Cosmic World Boss (Quantum Leviathan)
  boss_weekly_damage NUMERIC DEFAULT 0,
  alltime_boss_damage NUMERIC DEFAULT 0,
  boss_attacks_count INTEGER DEFAULT 0,
  
  -- 4-Tier Referral Program
  referral_code TEXT UNIQUE,
  referred_by_l1 TEXT,
  referred_by_l2 TEXT,
  referred_by_l3 TEXT,
  referred_by_l4 TEXT,
  referrals_count INTEGER DEFAULT 0,
  referrals_l1 INTEGER DEFAULT 0,
  referrals_l2 INTEGER DEFAULT 0,
  referrals_l3 INTEGER DEFAULT 0,
  referrals_l4 INTEGER DEFAULT 0,
  unclaimed_referral_pgt NUMERIC DEFAULT 0.0,
  unclaimed_referral_pol NUMERIC DEFAULT 0.0,
  total_referral_commission NUMERIC DEFAULT 0.0,
  total_referral_pol NUMERIC DEFAULT 0.0,
  
  -- Utility NFTs & Inventory
  owned_nfts JSONB DEFAULT '[]'::jsonb,
  crate_nfts JSONB DEFAULT '[]'::jsonb,
  relics JSONB DEFAULT '{}'::jsonb,
  equipped_nft TEXT,                         -- Featured Showcase NFT on Public Profile & Hub
  
  -- Faucet & Operations
  last_faucet_claim TIMESTAMPTZ,
  faucet_streak INTEGER DEFAULT 0,
  last_vip_faucet_claim TIMESTAMPTZ,
  vip_faucet_streak INTEGER DEFAULT 0,
  unclaimed_vip_faucet_pol NUMERIC DEFAULT 0.0,
  total_vip_faucet_pol NUMERIC DEFAULT 0.0,
  vip_until TIMESTAMPTZ,
  app_version TEXT DEFAULT 'v1.5.363',
  
  -- Weekly Active Parameter & Activity Tiers (Levels 0 to 5)
  weekly_faucet_claims INTEGER DEFAULT 0 NOT NULL,
  weekly_games_played INTEGER DEFAULT 0 NOT NULL,
  weekly_active_tier INTEGER DEFAULT 0 NOT NULL,
  last_weekly_active_tier INTEGER DEFAULT 0 NOT NULL,
  
  -- Security & Verification
  last_turnstile_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes on users
CREATE INDEX IF NOT EXISTS idx_users_player_id ON public.users (player_id);
CREATE INDEX IF NOT EXISTS idx_users_linked_wallet ON public.users (LOWER(linked_wallet_address));
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON public.users (LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users (user_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users (referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by_l1 ON public.users (referred_by_l1);
CREATE INDEX IF NOT EXISTS idx_users_weekly_active_tier ON public.users (weekly_active_tier);
CREATE INDEX IF NOT EXISTS idx_users_last_weekly_active_tier ON public.users (last_weekly_active_tier);
CREATE INDEX IF NOT EXISTS idx_users_game_highscore ON public.users (game_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_invaders_highscore ON public.users (invaders_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_drift_highscore ON public.users (drift_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_stacker_highscore ON public.users (stacker_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_skeet_highscore ON public.users (skeet_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_defense_highscore ON public.users (defense_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_balance_pgt ON public.users (balance_pgt DESC);
CREATE INDEX IF NOT EXISTS idx_users_dex_liquidity ON public.users (dex_liquidity_usd DESC);

-- ==============================================================================
-- 2. TABLE: user_stakes (Vault Staking Positions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT,
  pool TEXT NOT NULL DEFAULT 'pgt',
  amount NUMERIC NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard',
  apy NUMERIC NOT NULL,
  staked_at TIMESTAMPTZ DEFAULT NOW(),
  lock_until TIMESTAMPTZ NOT NULL,
  last_harvest TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stakes_wallet ON public.user_stakes (LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_user_stakes_active ON public.user_stakes (active);

-- ==============================================================================
-- 3. TABLE: arcade_sessions (Anti-Cheat Server Validated Game Sessions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.arcade_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  game_name TEXT,
  score INTEGER DEFAULT 0,
  bonus_items INTEGER DEFAULT 0,
  bonus_tokens INTEGER DEFAULT 0,
  payout_pgt NUMERIC DEFAULT 0.0,
  nft_multiplier NUMERIC DEFAULT 1.0,
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'expired'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  relics_dropped_count INTEGER DEFAULT 0,
  last_relic_dropped_at TIMESTAMPTZ DEFAULT NULL,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_arcade_sessions_player ON public.arcade_sessions (player_id);
CREATE INDEX IF NOT EXISTS idx_arcade_sessions_created ON public.arcade_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arcade_sessions_status ON public.arcade_sessions (status);
CREATE INDEX IF NOT EXISTS idx_arcade_sessions_player_daily ON public.arcade_sessions (player_id, status, created_at DESC);

-- ==============================================================================
-- 4. TABLE: withdrawals_history (On-Chain Token Claims & Quota Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.withdrawals_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_pgt NUMERIC NOT NULL,
  amount NUMERIC,
  nonce NUMERIC,
  ip_address TEXT,
  tx_hash TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_player ON public.withdrawals_history (player_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_wallet ON public.withdrawals_history (LOWER(wallet_address), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON public.withdrawals_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_nonce ON public.withdrawals_history (nonce);

-- ==============================================================================
-- 5. TABLE: relics (Quantum Relics Harvest & Polygon ERC-721 Stash)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.relics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  relic_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  is_minted_onchain BOOLEAN DEFAULT false,
  onchain_token_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, relic_id)
);

CREATE INDEX IF NOT EXISTS idx_relics_player ON public.relics (player_id);
CREATE INDEX IF NOT EXISTS idx_relics_relic_id ON public.relics (relic_id);

-- ==============================================================================
-- 6. TABLE: global_settings (Dynamic Master Admin Control Panel Settings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.global_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  progressive_jackpot_pgt NUMERIC DEFAULT 5000.0,
  weekly_tournament_pool_pgt NUMERIC DEFAULT 200000.0,
  arcade_last_reset TIMESTAMPTZ DEFAULT NOW(),
  max_daily_plays_per_game INTEGER DEFAULT 35,
  max_weekly_withdrawals INTEGER DEFAULT 5,
  account_quarantine_days INTEGER DEFAULT 7,
  max_withdraw_pgt NUMERIC DEFAULT 25000.0,
  min_withdraw_pgt NUMERIC DEFAULT 10.0,
  faucet_base_pgt NUMERIC DEFAULT 50.0,
  arcade_ceiling_base_pgt NUMERIC DEFAULT 75.0,
  catastrophe_circuit_breaker_pgt NUMERIC DEFAULT 1000.0,
  game_rules_json JSONB DEFAULT '{}'::jsonb,
  game_payout_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Weekly Cosmic World Boss (Quantum Leviathan)
  boss_level INTEGER DEFAULT 1,
  boss_current_hp NUMERIC DEFAULT 5000000,
  boss_max_hp NUMERIC DEFAULT 5000000,
  
  -- Note: discord_webhook_url, discord_admin_webhook_url, and discord_announcements_webhook_url
  -- have been isolated into public.admin_discord_secrets with Row Level Security (RLS) to prevent client exposure.
    -- Cloudflare Turnstile Arcade Anti-Bot Shield (PLAN-010)
  turnstile_arcade_enabled BOOLEAN DEFAULT true,
  turnstile_arcade_frequency INTEGER DEFAULT 3,
  turnstile_arcade_vip_bypass BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.global_settings (id, progressive_jackpot_pgt, weekly_tournament_pool_pgt)
VALUES (1, 5000.0, 200000.0)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 6b. TABLE: admin_discord_secrets (Protected Webhook URLs with RLS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_discord_secrets (
  id INTEGER PRIMARY KEY DEFAULT 1,
  discord_webhook_url TEXT,
  discord_admin_webhook_url TEXT,
  discord_announcements_webhook_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_discord_secrets ENABLE ROW LEVEL SECURITY;
-- Strict RLS: No public SELECT or UPDATE policies. Accessible only via SECURITY DEFINER Master Admin RPCs.

-- ==============================================================================
-- 7. TABLE: daily_quests (Daily Player Quest Progression)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quests_progress JSONB DEFAULT '{}'::jsonb,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, quest_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_quests_player_date ON public.daily_quests (player_id, quest_date);

-- ==============================================================================
-- 8. TABLE: bet_wins (Mini-Game Casino Wins & High Multipliers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bet_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  wager_pgt NUMERIC NOT NULL,
  payout_pgt NUMERIC NOT NULL,
  multiplier NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bet_wins_player ON public.bet_wins (player_id);
CREATE INDEX IF NOT EXISTS idx_bet_wins_created ON public.bet_wins (created_at DESC);

-- ==============================================================================
-- 9. TABLE: user_ips (Multi-Account IP Sentinel & Geolocation Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_user_ips_player ON public.user_ips (player_id);
CREATE INDEX IF NOT EXISTS idx_user_ips_ip ON public.user_ips (ip_address);

-- ==============================================================================
-- 10. TABLE: weekly_leaderboard_history (Archive of Tournament Results)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_history (
  id BIGSERIAL PRIMARY KEY,
  week_label TEXT NOT NULL,
  game_type TEXT DEFAULT 'overall',
  rank INTEGER NOT NULL,
  player_id TEXT,
  wallet_address TEXT,
  astrododge_score INTEGER DEFAULT 0,
  invaders_score INTEGER DEFAULT 0,
  drift_score INTEGER DEFAULT 0,
  stacker_score INTEGER DEFAULT 0,
  skeet_score INTEGER DEFAULT 0,
  defense_score INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  prize_pgt NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_lh_week ON public.weekly_leaderboard_history (week_label);
CREATE INDEX IF NOT EXISTS idx_weekly_lh_player ON public.weekly_leaderboard_history (player_id);

-- ==============================================================================
-- 11. TABLE: referral_commissions (PGT Downline Payout History)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upline_player_id TEXT NOT NULL,
  downline_player_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  commission_pgt NUMERIC NOT NULL,
  action_type TEXT NOT NULL,
  downline_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_comm_upline ON public.referral_commissions (upline_player_id);
CREATE INDEX IF NOT EXISTS idx_ref_comm_created ON public.referral_commissions (created_at DESC);

-- ==============================================================================
-- 12. TABLE: pol_referral_commissions (On-Chain Store POL Affiliate Commissions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pol_referral_commissions (
  tx_hash TEXT PRIMARY KEY,
  buyer_wallet TEXT NOT NULL,
  referrer_player_id TEXT NOT NULL,
  amount_pol NUMERIC NOT NULL,
  commission_pol NUMERIC NOT NULL,
  item_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pol_ref_comm_referrer ON public.pol_referral_commissions (referrer_player_id);

-- ==============================================================================
-- 13. TABLE: pol_payout_requests (Affiliate POL Withdrawal Pipeline)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pol_payout_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  username TEXT,
  amount_pol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'rejected'
  tx_hash TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pol_payout_status ON public.pol_payout_requests (status);

-- ==============================================================================
-- 14. TABLE: game_metrics (Arcade Volume, Payouts & Playtime Analytics)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.game_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_name TEXT UNIQUE NOT NULL,
  total_wagered NUMERIC DEFAULT 0,
  total_payout NUMERIC DEFAULT 0,
  total_playtime_seconds BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 15. TABLE: boss_reset_history (World Boss Weekly Slayer & Bounty Archive)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.boss_reset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label TEXT NOT NULL,
  boss_level INT NOT NULL,
  total_damage NUMERIC DEFAULT 0,
  distributed_total NUMERIC DEFAULT 0,
  hunters_count INT DEFAULT 0,
  slain BOOLEAN DEFAULT false,
  top_hunters JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 16. TABLE: mines_sessions (Server-Authoritative Mines Game Sessions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mines_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  bet_pgt NUMERIC NOT NULL,
  mines_count INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cashed_out', 'busted'
  step INT NOT NULL DEFAULT 0,
  current_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  revealed_tiles INT[] DEFAULT '{}',
  mine_positions INT[] NOT NULL,
  payout_pgt NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mines_sessions_wallet ON public.mines_sessions (LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_mines_sessions_status ON public.mines_sessions (status);

-- ==============================================================================
-- 17. TABLE: nft_sales (On-Site Store Sales Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.nft_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_player_id TEXT NOT NULL,
  nft_id TEXT NOT NULL,
  price_pgt NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 18. TABLE: pgt_supply_history (Treasury & Deflation Tracking)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pgt_supply_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  amount_pgt NUMERIC NOT NULL,
  total_supply_after NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 19. TABLE: admin_security_config (Master Admin Salted Passkey Storage)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_security_config (
  id INT PRIMARY KEY DEFAULT 1,
  admin_key_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row_admin_sec CHECK (id = 1)
);

ALTER TABLE public.admin_security_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_security_config FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.admin_security_config TO service_role;

-- ==============================================================================
-- 20. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert users" ON public.users;
CREATE POLICY "Allow public insert users" ON public.users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update users" ON public.users;
CREATE POLICY "Allow public update users" ON public.users FOR UPDATE USING (true);

ALTER TABLE public.user_stakes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read user_stakes" ON public.user_stakes;
CREATE POLICY "Allow public read user_stakes" ON public.user_stakes FOR SELECT USING (true);

ALTER TABLE public.arcade_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read arcade_sessions" ON public.arcade_sessions;
CREATE POLICY "Allow public read arcade_sessions" ON public.arcade_sessions FOR SELECT USING (true);

ALTER TABLE public.withdrawals_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read withdrawals_history" ON public.withdrawals_history;
CREATE POLICY "Allow public read withdrawals_history" ON public.withdrawals_history FOR SELECT USING (true);

ALTER TABLE public.relics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read relics" ON public.relics;
CREATE POLICY "Allow public read relics" ON public.relics FOR SELECT USING (true);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read global_settings" ON public.global_settings;
CREATE POLICY "Allow public read global_settings" ON public.global_settings FOR SELECT USING (true);

ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read daily_quests" ON public.daily_quests;
CREATE POLICY "Allow public read daily_quests" ON public.daily_quests FOR SELECT USING (true);

ALTER TABLE public.bet_wins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read bet_wins" ON public.bet_wins;
CREATE POLICY "Allow public read bet_wins" ON public.bet_wins FOR SELECT USING (true);

ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read user_ips" ON public.user_ips;
CREATE POLICY "Allow public read user_ips" ON public.user_ips FOR SELECT USING (true);

ALTER TABLE public.weekly_leaderboard_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read weekly_leaderboard_history" ON public.weekly_leaderboard_history;
CREATE POLICY "Allow public read weekly_leaderboard_history" ON public.weekly_leaderboard_history FOR SELECT USING (true);

ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read referral_commissions" ON public.referral_commissions;
CREATE POLICY "Allow public read referral_commissions" ON public.referral_commissions FOR SELECT USING (true);

ALTER TABLE public.pol_referral_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read pol_referral_commissions" ON public.pol_referral_commissions;
CREATE POLICY "Allow public read pol_referral_commissions" ON public.pol_referral_commissions FOR SELECT USING (true);

ALTER TABLE public.pol_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select pol_payout_requests" ON public.pol_payout_requests;
CREATE POLICY "Allow public select pol_payout_requests" ON public.pol_payout_requests FOR SELECT USING (true);

ALTER TABLE public.game_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read game_metrics" ON public.game_metrics;
CREATE POLICY "Allow public read game_metrics" ON public.game_metrics FOR SELECT USING (true);

ALTER TABLE public.boss_reset_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read boss_reset_history" ON public.boss_reset_history;
CREATE POLICY "Allow public read boss_reset_history" ON public.boss_reset_history FOR SELECT USING (true);

ALTER TABLE public.mines_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read mines_sessions" ON public.mines_sessions;
CREATE POLICY "Allow public read mines_sessions" ON public.mines_sessions FOR SELECT USING (true);

ALTER TABLE public.nft_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read nft_sales" ON public.nft_sales;
CREATE POLICY "Allow public read nft_sales" ON public.nft_sales FOR SELECT USING (true);

ALTER TABLE public.pgt_supply_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read pgt_supply_history" ON public.pgt_supply_history;
CREATE POLICY "Allow public read pgt_supply_history" ON public.pgt_supply_history FOR SELECT USING (true);

-- ==============================================================================
-- 21. TABLE: bot_security_logs (Incident Audit Log for Automated Scripts & Bots)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bot_security_logs (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  game_name TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bot_security_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to bot_security_logs" ON public.bot_security_logs;
CREATE POLICY "Allow read access to bot_security_logs" ON public.bot_security_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert to bot_security_logs" ON public.bot_security_logs;
CREATE POLICY "Allow insert to bot_security_logs" ON public.bot_security_logs FOR INSERT WITH CHECK (true);

