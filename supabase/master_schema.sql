-- ==============================================================================
-- POLYGAME: MASTER CANONICAL DATABASE SCHEMA (v1.5.130+)
-- ==============================================================================
-- This script contains the complete, authoritative definitions for all tables,
-- column types, constraints, default values, indexes, and Row Level Security (RLS)
-- policies used by Polygon Gaming.
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABLE: users (Core Player Identity, Balances, High Scores & Downlines)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  player_id TEXT UNIQUE NOT NULL,
  linked_wallet_address TEXT,
  wallet_address TEXT,
  username TEXT,
  balance_pgt NUMERIC NOT NULL DEFAULT 0.0,
  balance_1flr NUMERIC NOT NULL DEFAULT 0.0,
  
  -- Weekly Leaderboard High Scores
  game_highscore INTEGER DEFAULT 0,          -- Astro-Dodge
  invaders_highscore INTEGER DEFAULT 0,      -- Cyber Invaders
  drift_highscore INTEGER DEFAULT 0,         -- Cyber Drift
  catcher_highscore INTEGER DEFAULT 0,       -- Cyber Stacker (retained for backwards compatibility)
  
  -- All-Time Career High Scores
  alltime_game_highscore INTEGER DEFAULT 0,
  alltime_invaders_highscore INTEGER DEFAULT 0,
  alltime_drift_highscore INTEGER DEFAULT 0,
  alltime_catcher_highscore INTEGER DEFAULT 0,
  
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
  referral_pgt_earned NUMERIC DEFAULT 0.0,
  referral_pol_earned NUMERIC DEFAULT 0.0,
  
  -- Utility NFTs & Inventory
  owned_nfts JSONB DEFAULT '[]'::jsonb,
  crate_nfts JSONB DEFAULT '[]'::jsonb,
  
  -- Faucet & Operations
  last_faucet_claim TIMESTAMPTZ,
  faucet_streak INTEGER DEFAULT 0,
  vip_until TIMESTAMPTZ,
  is_ambassador BOOLEAN DEFAULT false,
  app_version TEXT DEFAULT 'v1.5.130',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes on users
CREATE INDEX IF NOT EXISTS idx_users_player_id ON users (player_id);
CREATE INDEX IF NOT EXISTS idx_users_linked_wallet ON users (LOWER(linked_wallet_address));
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users (LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users (user_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users (referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by_l1 ON users (referred_by_l1);
CREATE INDEX IF NOT EXISTS idx_users_game_highscore ON users (game_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_invaders_highscore ON users (invaders_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_drift_highscore ON users (drift_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_catcher_highscore ON users (catcher_highscore DESC);
CREATE INDEX IF NOT EXISTS idx_users_space_power ON users (space_fleet_power DESC);
CREATE INDEX IF NOT EXISTS idx_users_balance_pgt ON users (balance_pgt DESC);

-- ==============================================================================
-- 2. TABLE: user_stakes (Vault Staking Positions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_stakes (
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

CREATE INDEX IF NOT EXISTS idx_user_stakes_wallet ON user_stakes (LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_user_stakes_active ON user_stakes (active);

-- ==============================================================================
-- 3. TABLE: arcade_sessions (Anti-Cheat Server Validated Game Sessions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS arcade_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  game_type TEXT NOT NULL, -- 'astrododge', 'invaders', 'drift', 'stacker'
  score INTEGER DEFAULT 0,
  bonus_items INTEGER DEFAULT 0,
  bonus_tokens INTEGER DEFAULT 0,
  payout_pgt NUMERIC DEFAULT 0.0,
  nft_multiplier NUMERIC DEFAULT 1.0,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_arcade_sessions_player ON arcade_sessions (player_id);
CREATE INDEX IF NOT EXISTS idx_arcade_sessions_created ON arcade_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arcade_sessions_status ON arcade_sessions (status);

-- ==============================================================================
-- 4. TABLE: withdrawals_history (On-Chain Token Claims & Weekly Quota Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS withdrawals_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_pgt NUMERIC NOT NULL,
  tx_hash TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_player ON withdrawals_history (player_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON withdrawals_history (created_at DESC);

-- ==============================================================================
-- 5. TABLE: relics (Quantum Relics Harvest & Polygon ERC-721 Stash)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS relics (
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

CREATE INDEX IF NOT EXISTS idx_relics_player ON relics (player_id);
CREATE INDEX IF NOT EXISTS idx_relics_relic_id ON relics (relic_id);

-- ==============================================================================
-- 6. TABLE: global_settings (Dynamic Master Admin Control Panel Settings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS global_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  progressive_jackpot_pgt NUMERIC DEFAULT 5000.0,
  weekly_tournament_pool_pgt NUMERIC DEFAULT 200000.0,
  arcade_last_reset TIMESTAMPTZ DEFAULT NOW(),
  max_daily_plays_per_game INTEGER DEFAULT 25,
  max_weekly_withdrawals INTEGER DEFAULT 5,
  max_withdraw_pgt NUMERIC DEFAULT 100000.0,
  min_withdraw_pgt NUMERIC DEFAULT 50.0,
  game_rules_json JSONB DEFAULT '{}'::jsonb,
  game_payout_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Weekly Cosmic World Boss (Quantum Leviathan)
  boss_level INTEGER DEFAULT 1,
  boss_current_hp NUMERIC DEFAULT 5000000,
  boss_max_hp NUMERIC DEFAULT 5000000,
  
  discord_webhook_url TEXT,
  discord_admin_webhook_url TEXT,
  discord_announcements_webhook_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure default row exists
INSERT INTO global_settings (id, progressive_jackpot_pgt, weekly_tournament_pool_pgt)
VALUES (1, 5000.0, 200000.0)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 7. TABLE: daily_quests (Daily Player Quest Progression)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quests_progress JSONB DEFAULT '{}'::jsonb,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, quest_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_quests_player_date ON daily_quests (player_id, quest_date);

-- ==============================================================================
-- 8. TABLE: bet_wins (Mini-Game Casino Wins & High Multipliers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS bet_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  wager_pgt NUMERIC NOT NULL,
  payout_pgt NUMERIC NOT NULL,
  multiplier NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bet_wins_player ON bet_wins (player_id);
CREATE INDEX IF NOT EXISTS idx_bet_wins_created ON bet_wins (created_at DESC);

-- ==============================================================================
-- 9. TABLE: user_ips (Multi-Account IP Sentinel & Geolocation Audit)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  wallet_address TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_ips_ip ON user_ips (ip_address);
CREATE INDEX IF NOT EXISTS idx_user_ips_player ON user_ips (player_id);

-- ==============================================================================
-- 10. TABLE: nft_sales (In-Game NFT Purchase History)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS nft_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  nft_id TEXT NOT NULL,
  cost_pgt NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_sales_player ON nft_sales (player_id);

-- ==============================================================================
-- 11. TABLE: referral_commissions (4-Tier Real-Time Commission Audit Stream)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upline_player_id TEXT NOT NULL,
  downline_player_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  commission_pgt NUMERIC NOT NULL,
  action_type TEXT NOT NULL,
  downline_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_comm_upline ON referral_commissions (upline_player_id);
CREATE INDEX IF NOT EXISTS idx_ref_comm_created ON referral_commissions (created_at DESC);

-- ==============================================================================
-- 12. TABLE: pgt_supply_history (Treasury & Deflation Tracking)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS pgt_supply_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  total_supply NUMERIC DEFAULT 1000000000,
  circulating_supply NUMERIC DEFAULT 0,
  staked_supply NUMERIC DEFAULT 0,
  burned_supply NUMERIC DEFAULT 0
);

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES & GRANTS
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE arcade_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE relics ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pgt_supply_history ENABLE ROW LEVEL SECURITY;

-- Public Read Policies (Allow frontend to view public leaderboards, settings & state)
CREATE POLICY "Public Read users" ON users FOR SELECT USING (true);
CREATE POLICY "Public Read user_stakes" ON user_stakes FOR SELECT USING (true);
CREATE POLICY "Public Read arcade_sessions" ON arcade_sessions FOR SELECT USING (true);
CREATE POLICY "Public Read withdrawals_history" ON withdrawals_history FOR SELECT USING (true);
CREATE POLICY "Public Read relics" ON relics FOR SELECT USING (true);
CREATE POLICY "Public Read global_settings" ON global_settings FOR SELECT USING (true);
CREATE POLICY "Public Read daily_quests" ON daily_quests FOR SELECT USING (true);
CREATE POLICY "Public Read bet_wins" ON bet_wins FOR SELECT USING (true);
CREATE POLICY "Public Read user_ips" ON user_ips FOR SELECT USING (true);
CREATE POLICY "Public Read nft_sales" ON nft_sales FOR SELECT USING (true);
CREATE POLICY "Public Read referral_commissions" ON referral_commissions FOR SELECT USING (true);
CREATE POLICY "Public Read pgt_supply_history" ON pgt_supply_history FOR SELECT USING (true);

-- Allow Client Upserts for Non-Sensitive User Progression (Throttled by saveToDB)
CREATE POLICY "Public Insert/Update users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Insert user_ips" ON user_ips FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert/Update daily_quests" ON daily_quests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Insert/Update relics" ON relics FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 14. ANTI-CHEAT TRIGGERS: Balance & Progression Shield
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- When invoked directly from the public PostgREST API (anon or authenticated role)
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    -- On INSERT: Force starting balances to 0.0
    IF TG_OP = 'INSERT' THEN
      NEW.balance_pgt := 0.0;
      NEW.balance_1flr := 0.0;
    -- On UPDATE: Revert client-side balance mutations
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;
      IF NEW.balance_1flr IS DISTINCT FROM OLD.balance_1flr THEN
        NEW.balance_1flr := OLD.balance_1flr;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();

-- Grant schema permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

