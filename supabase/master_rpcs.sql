-- ==============================================================================
-- POLYGAME: MASTER CANONICAL STORED PROCEDURES (RPCs) (Authoritative)
-- ==============================================================================
-- NOTE: This file is auto-assembled from domain modules in `supabase/rpcs/`.
-- To modify procedures, edit the appropriate file in `supabase/rpcs/` and run:
--   python scripts/build_master_rpcs.py
-- ==============================================================================

-- 0. SCHEMA INITIALIZATION & COLUMN GUARANTEES
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

ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS game_type TEXT DEFAULT 'overall';
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS wallet_address TEXT;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS astrododge_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS invaders_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS drift_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS stacker_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS skeet_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS defense_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS best_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS prize_pgt NUMERIC DEFAULT 0;

ALTER TABLE public.weekly_leaderboard_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to weekly_leaderboard_history" ON public.weekly_leaderboard_history;
CREATE POLICY "Allow public read access to weekly_leaderboard_history" ON public.weekly_leaderboard_history FOR SELECT TO anon, authenticated, service_role USING (true);
DROP POLICY IF EXISTS "Allow service role insert to weekly_leaderboard_history" ON public.weekly_leaderboard_history;
CREATE POLICY "Allow service role insert to weekly_leaderboard_history" ON public.weekly_leaderboard_history FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS web3_auth_id UUID;
CREATE INDEX IF NOT EXISTS idx_users_web3_auth_id ON public.users(web3_auth_id) WHERE web3_auth_id IS NOT NULL;
ALTER TABLE public.users DROP COLUMN IF EXISTS wallet_address;
DROP INDEX IF EXISTS public.idx_users_wallet_address;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stacker_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_stacker_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS skeet_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_skeet_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS defense_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS defense_alltime_best INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_arcade_plays INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_faucet_claims INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_games_played INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_active_tier INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_weekly_active_tier INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dex_liquidity_usd NUMERIC DEFAULT 0.0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bot_warning INTEGER DEFAULT 0;

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


-- Ensure arcade_sessions has duration and relic tracking columns
ALTER TABLE public.arcade_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.arcade_sessions ADD COLUMN IF NOT EXISTS relics_dropped_count INTEGER DEFAULT 0;
ALTER TABLE public.arcade_sessions ADD COLUMN IF NOT EXISTS last_relic_dropped_at TIMESTAMPTZ DEFAULT NULL;

-- ------------------------------------------------------------------------------
-- Enforce Authenticated-Only User Management (Guest DB Accounts Deprecated)
-- ------------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.users FROM anon, public;
GRANT SELECT ON TABLE public.users TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role, postgres;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users FOR SELECT TO anon, authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow public insert users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated insert users" ON public.users;
CREATE POLICY "Allow authenticated insert users" ON public.users 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR web3_auth_id = auth.uid()));

DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated update users" ON public.users;
CREATE POLICY "Allow authenticated update users" ON public.users 
  FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR web3_auth_id = auth.uid())) 
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR web3_auth_id = auth.uid()));

-- ==============================================================================
-- 1. UTILITY & IDENTITY RPCS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: resolve_player_id
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.resolve_player_id(TEXT);
DROP FUNCTION IF EXISTS resolve_player_id(TEXT);

CREATE OR REPLACE FUNCTION resolve_player_id(p_wallet TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_clean TEXT := LOWER(TRIM(COALESCE(p_wallet, '')));
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT player_id INTO v_pid
  FROM users
  WHERE LOWER(player_id) = v_clean
     OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean
     OR LOWER(COALESCE(user_id::TEXT, '')) = v_clean
  LIMIT 1;

  IF v_pid IS NOT NULL THEN
    RETURN v_pid;
  END IF;

  RETURN v_clean;
END;
$$;
GRANT EXECUTE ON FUNCTION resolve_player_id(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: compute_weekly_active_tier
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.compute_weekly_active_tier(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.compute_weekly_active_tier(INT, INT);
DROP FUNCTION IF EXISTS compute_weekly_active_tier(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS compute_weekly_active_tier(INT, INT);

CREATE OR REPLACE FUNCTION compute_weekly_active_tier(p_faucets BIGINT, p_games BIGINT)
RETURNS INT 
LANGUAGE plpgsql 
IMMUTABLE 
AS $$
DECLARE
  v_f BIGINT := GREATEST(0, COALESCE(p_faucets, 0));
  v_g BIGINT := GREATEST(0, COALESCE(p_games, 0));
BEGIN
  IF v_f >= 6 AND v_g >= 50 THEN
    RETURN 5; -- 👑 Level 5: Apex Legend
  ELSIF v_f >= 5 AND v_g >= 25 THEN
    RETURN 4; -- 💎 Level 4: Elite Champion
  ELSIF v_f >= 3 AND v_g >= 5 THEN
    RETURN 3; -- 🥇 Level 3: Veteran
  ELSIF v_f >= 2 AND v_g >= 1 THEN
    RETURN 2; -- 🥈 Level 2: Contender
  ELSIF v_f >= 1 THEN
    RETURN 1; -- 🥉 Level 1: Scout
  ELSE
    RETURN 0; -- ⚪ Level 0: Dormant
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION compute_weekly_active_tier(p_faucets INT, p_games INT)
RETURNS INT 
LANGUAGE plpgsql 
IMMUTABLE 
AS $$
BEGIN
  RETURN compute_weekly_active_tier(p_faucets::BIGINT, p_games::BIGINT);
END;
$$;

GRANT EXECUTE ON FUNCTION compute_weekly_active_tier(BIGINT, BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION compute_weekly_active_tier(INT, INT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: is_season1_apex_unlocked
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_season1_apex_unlocked(JSONB);
DROP FUNCTION IF EXISTS is_season1_apex_unlocked(JSONB);

CREATE OR REPLACE FUNCTION is_season1_apex_unlocked(p_relics JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_r JSONB := COALESCE(p_relics, '{}'::jsonb);
  v_val JSONB;
  v_owned_count INT := 0;
  v_ids TEXT[] := ARRAY[
    'relic_astrododge_prism',
    'relic_astrododge_deflector',
    'relic_astrododge_compass',
    'relic_invaders_core',
    'relic_invaders_dynamo',
    'relic_invaders_transmitter',
    'relic_drift_chronometer',
    'relic_drift_capacitor',
    'relic_drift_overdrive',
    'relic_stacker_foundation',
    'relic_stacker_keystone',
    'relic_stacker_monolith',
    'relic_space_darkmatter',
    'relic_space_warpcoil',
    'relic_space_plasma',
    'relic_apex_singularity',
    'relic_apex_genesis'
  ];
  v_id TEXT;
  v_is_owned BOOLEAN;
  v_num INT;
BEGIN
  IF v_r IS NULL OR v_r::text IN ('{}', 'null', '""', '[]') THEN
    RETURN false;
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    v_is_owned := false;
    v_val := v_r->v_id;

    -- Check known aliases if not found directly under canonical key
    IF v_val IS NULL THEN
      IF v_id = 'relic_astrododge_compass' THEN v_val := v_r->'relic_astrododge_chrono';
      ELSIF v_id = 'relic_invaders_core' THEN v_val := v_r->'relic_invaders_pulsar';
      ELSIF v_id = 'relic_drift_chronometer' THEN v_val := v_r->'relic_drift_tachometer';
      ELSIF v_id = 'relic_drift_capacitor' THEN v_val := v_r->'relic_drift_flux';
      ELSIF v_id = 'relic_drift_overdrive' THEN v_val := v_r->'relic_drift_supercharger';
      ELSIF v_id = 'relic_stacker_foundation' THEN v_val := v_r->'relic_stacker_bedrock';
      ELSIF v_id = 'relic_space_warpcoil' THEN v_val := v_r->'relic_space_coil';
      ELSIF v_id = 'relic_space_plasma' THEN v_val := v_r->'relic_space_harvester';
      END IF;
    END IF;

    IF v_val IS NOT NULL THEN
      -- Case 1: Object with total / unminted / onchain or token_ids
      IF jsonb_typeof(v_val) = 'object' THEN
        IF COALESCE((v_val->>'total')::int, 0) > 0 
           OR COALESCE((v_val->>'unminted')::int, 0) > 0 
           OR COALESCE((v_val->>'onchain')::int, 0) > 0 
           OR (v_val->'token_ids' IS NOT NULL AND jsonb_array_length(COALESCE(v_val->'token_ids', '[]'::jsonb)) > 0) THEN
          v_is_owned := true;
        END IF;
      -- Case 2: Direct number count
      ELSIF jsonb_typeof(v_val) = 'number' THEN
        IF (v_val::text)::int > 0 THEN
          v_is_owned := true;
        END IF;
      -- Case 3: Boolean flag
      ELSIF jsonb_typeof(v_val) = 'boolean' THEN
        IF (v_val::text)::boolean = true THEN
          v_is_owned := true;
        END IF;
      -- Case 4: String number
      ELSIF jsonb_typeof(v_val) = 'string' THEN
        BEGIN
          v_num := (v_val#>>'{}')::int;
          IF v_num > 0 THEN v_is_owned := true; END IF;
        EXCEPTION WHEN OTHERS THEN
          v_is_owned := true;
        END;
      END IF;
    END IF;

    IF v_is_owned THEN
      v_owned_count := v_owned_count + 1;
    END IF;
  END LOOP;

  RETURN (v_owned_count >= 17);
END;
$$;
GRANT EXECUTE ON FUNCTION is_season1_apex_unlocked(JSONB) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: get_user_referral_multiplier
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_referral_multiplier(TEXT);
CREATE OR REPLACE FUNCTION get_user_referral_multiplier(p_wallet TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_nft_boost NUMERIC := 1.0;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
BEGIN
  IF v_pid IS NULL THEN RETURN 1.0; END IF;

  SELECT vip_until, is_ambassador, owned_nfts INTO v_user
  FROM users WHERE player_id = v_pid;

  IF NOT FOUND THEN RETURN 1.0; END IF;

  -- 1. VIP boost (2.0x)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > NOW() THEN
    v_vip_mult := 2.0;
  END IF;

  -- 2. Ambassador boost (1.5x)
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 1.5;
  END IF;

  -- 3. Utility NFT Referral boost
  IF v_user.owned_nfts IS NOT NULL AND jsonb_typeof(v_user.owned_nfts) = 'array' THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_user.owned_nfts) elem WHERE elem->>'id' = 'nft_affiliate_guild') THEN
      v_nft_boost := 1.65;
    ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_user.owned_nfts) elem WHERE elem->>'id' = 'nft_referral_beacon') THEN
      v_nft_boost := 1.25;
    END IF;
  END IF;

  RETURN (v_nft_boost * v_vip_mult * v_amb_mult);
END;
$$;
GRANT EXECUTE ON FUNCTION get_user_referral_multiplier(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: process_referral_commissions
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_referral_commissions(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.process_referral_commissions(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS process_referral_commissions(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS process_referral_commissions(TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.process_referral_commissions(
  claiming_wallet TEXT,
  claim_amount NUMERIC,
  claim_action TEXT DEFAULT 'Gameplay'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(claiming_wallet);
  v_downline RECORD;
  v_upline_pid TEXT;
  v_rates NUMERIC[] := ARRAY[0.10, 0.05, 0.02, 0.01]; -- 10%, 5%, 2%, 1%
  v_tier INTEGER;
  v_upline_keys TEXT[];
  v_mult NUMERIC;
  v_commission NUMERIC;
  v_downline_name TEXT;
  v_new_entry JSONB;
  v_time_str TEXT;
  v_action_str TEXT;
BEGIN
  IF v_pid IS NULL OR claim_amount IS NULL OR claim_amount <= 0 THEN
    RETURN;
  END IF;

  v_action_str := COALESCE(claim_action, 'Gameplay');

  -- Disallow referral commissions on casino / bet games
  IF LOWER(v_action_str) IN ('bet win', 'casino', 'roshambo', 'spinner', 'plinko', 'crash', 'gambling') THEN
    RETURN;
  END IF;

  SELECT referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4, username, player_id, linked_wallet_address
  INTO v_downline
  FROM users WHERE player_id = v_pid;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_downline.username IS NOT NULL AND TRIM(v_downline.username) <> '' AND UPPER(TRIM(v_downline.username)) <> 'EMPTY' THEN
    v_downline_name := TRIM(v_downline.username);
  ELSIF v_downline.linked_wallet_address IS NOT NULL AND TRIM(v_downline.linked_wallet_address) <> '' THEN
    v_downline_name := 'Player_' || SUBSTRING(TRIM(v_downline.linked_wallet_address) FROM 1 FOR 8);
  ELSE
    v_downline_name := 'Player_' || SUBSTRING(v_downline.player_id FROM 1 FOR 8);
  END IF;

  v_time_str := TO_CHAR(NOW(), 'HH12:MI:SS AM');
  v_upline_keys := ARRAY[v_downline.referred_by_l1, v_downline.referred_by_l2, v_downline.referred_by_l3, v_downline.referred_by_l4];

  FOR v_tier IN 1..4 LOOP
    v_upline_pid := resolve_player_id(v_upline_keys[v_tier]);
    IF v_upline_pid IS NOT NULL AND v_upline_pid <> '' AND v_upline_pid <> v_pid THEN
      v_mult := get_user_referral_multiplier(v_upline_pid);
      v_commission := ROUND(claim_amount * v_rates[v_tier] * v_mult, 4);

      IF v_commission > 0 THEN
        v_new_entry := jsonb_build_object(
          'name', v_downline_name,
          'player_id', v_pid,
          'level', v_tier,
          'action', v_action_str,
          'commission', v_commission,
          'currency', 'PGT',
          'time', v_time_str,
          'created_at', NOW()
        );

        UPDATE users
        SET unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + v_commission,
            total_referral_commission = COALESCE(total_referral_commission, 0) + v_commission,
            referrals_list = (
              SELECT jsonb_agg(elem)
              FROM (
                SELECT elem
                FROM jsonb_array_elements(jsonb_build_array(v_new_entry) || COALESCE(referrals_list, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
                ORDER BY ord ASC
                LIMIT 50
              ) sub
            )
        WHERE player_id = v_upline_pid;

        BEGIN
          INSERT INTO referral_commissions (upline_player_id, downline_player_id, tier, commission_pgt, action_type, downline_username)
          VALUES (v_upline_pid, v_pid, v_tier, v_commission, v_action_str, v_downline_name);
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION process_referral_commissions(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_referral_commissions(TEXT, NUMERIC, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: harvest_referral_rewards
-- Source: fix_arcade_referral_commissions_and_ledger.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.harvest_referral_rewards(TEXT);
DROP FUNCTION IF EXISTS harvest_referral_rewards(TEXT);

CREATE OR REPLACE FUNCTION harvest_referral_rewards(user_wallet TEXT) 
RETURNS NUMERIC AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  unclaimed_amt NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(user_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RAISE EXCEPTION '%', COALESCE(v_guard.p_error_msg, 'Authentication failed: unauthorized caller.');
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT COALESCE(unclaimed_referral_pgt, 0) INTO unclaimed_amt
  FROM users WHERE LOWER(player_id) = LOWER(v_pid);

  IF unclaimed_amt IS NULL OR unclaimed_amt <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE users SET
    balance_pgt = COALESCE(balance_pgt, 0) + unclaimed_amt,
    unclaimed_referral_pgt = 0
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN unclaimed_amt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION harvest_referral_rewards(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION harvest_referral_rewards(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: reconcile_referral_trees
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reconcile_referral_trees();
DROP FUNCTION IF EXISTS public.reconcile_referral_trees(TEXT);
DROP FUNCTION IF EXISTS reconcile_referral_trees();
DROP FUNCTION IF EXISTS reconcile_referral_trees(TEXT);

CREATE OR REPLACE FUNCTION public.reconcile_referral_trees(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_scanned_count INT := 0;
  v_repaired_chains INT := 0;
  v_updated_counters INT := 0;
  r RECORD;
  v_parent RECORD;
  v_expected_l2 TEXT;
  v_expected_l3 TEXT;
  v_expected_l4 TEXT;
BEGIN
  -- Strict Master Admin Passkey Verification
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Master Admin Passkey');
  END IF;

  -- 1. Audit and repair all upstream referral chains (L2, L3, L4 from L1 root)
  FOR r IN 
    SELECT player_id, linked_wallet_address, referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4
    FROM public.users 
    WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' AND referred_by_l1 <> 'EMPTY'
  LOOP
    v_scanned_count := v_scanned_count + 1;

    -- Fetch parent's upstream chain
    SELECT referred_by_l1, referred_by_l2, referred_by_l3
    INTO v_parent
    FROM public.users
    WHERE LOWER(player_id) = LOWER(r.referred_by_l1)
       OR (linked_wallet_address IS NOT NULL AND linked_wallet_address <> '' AND LOWER(linked_wallet_address) = LOWER(r.referred_by_l1))
    LIMIT 1;

    IF FOUND THEN
      v_expected_l2 := NULLIF(v_parent.referred_by_l1, '');
      v_expected_l3 := NULLIF(v_parent.referred_by_l2, '');
      v_expected_l4 := NULLIF(v_parent.referred_by_l3, '');

      -- Prevent self-loops
      IF v_expected_l2 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l2 = r.linked_wallet_address) THEN v_expected_l2 := NULL; END IF;
      IF v_expected_l3 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l3 = r.linked_wallet_address) THEN v_expected_l3 := NULL; END IF;
      IF v_expected_l4 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l4 = r.linked_wallet_address) THEN v_expected_l4 := NULL; END IF;

      IF COALESCE(r.referred_by_l2, '') IS DISTINCT FROM COALESCE(v_expected_l2, '') OR
         COALESCE(r.referred_by_l3, '') IS DISTINCT FROM COALESCE(v_expected_l3, '') OR
         COALESCE(r.referred_by_l4, '') IS DISTINCT FROM COALESCE(v_expected_l4, '') THEN
        
        UPDATE public.users
        SET referred_by_l2 = v_expected_l2,
            referred_by_l3 = v_expected_l3,
            referred_by_l4 = v_expected_l4,
            updated_at = NOW()
        WHERE player_id = r.player_id;

        v_repaired_chains := v_repaired_chains + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Recalculate downline counters across all users
  UPDATE public.users u
  SET 
    referrals_l1 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l1) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l1) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l2 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l2) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l2) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l3 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l3) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l3) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l4 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l4) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l4) = LOWER(u.linked_wallet_address)))
    );

  -- 3. Synchronize referrals_count total (L1 + L2 + L3 + L4)
  UPDATE public.users
  SET referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0),
      updated_at = NOW();

  GET DIAGNOSTICS v_updated_counters = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'scanned_accounts', v_scanned_count,
    'repaired_chains', v_repaired_chains,
    'synchronized_users', v_updated_counters,
    'message', format('Referral reconciliation completed successfully: %s accounts scanned, %s chains repaired, %s downline counters synchronized.', v_scanned_count, v_repaired_chains, v_updated_counters)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reconcile_referral_trees(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: link_wallet_to_account
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.link_wallet_to_account(TEXT, UUID);
DROP FUNCTION IF EXISTS link_wallet_to_account(TEXT, UUID);

CREATE OR REPLACE FUNCTION link_wallet_to_account(p_wallet TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_owner UUID;
  v_old_row RECORD;
  v_merged_pgt NUMERIC := 0;
  v_merged_earned NUMERIC := 0;
  v_merged_ref_pgt NUMERIC := 0;
  v_merged_ref_pol NUMERIC := 0;
  v_merged_ref_count INT := 0;
  v_merged_dodge INT := 0;
  v_merged_invaders INT := 0;
  v_merged_drift INT := 0;
  v_merged_stacker INT := 0;
  v_merged_skeet INT := 0;
  v_merged_all_dodge INT := 0;
  v_merged_all_invaders INT := 0;
  v_merged_all_drift INT := 0;
  v_merged_all_stacker INT := 0;
  v_merged_all_skeet INT := 0;
  v_merged_stakes JSONB := '[]'::jsonb;
  v_merged_nfts JSONB := '[]'::jsonb;
  v_merged_relics JSONB := '{}'::jsonb;
  v_merged_space JSONB := '{}'::jsonb;
  v_merged_vip TIMESTAMPTZ := NULL;
  v_merged_amb BOOLEAN := false;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  -- 0. Strict 42-character EVM wallet address format validation
  IF p_wallet IS NULL OR p_wallet !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid Web3 EVM wallet address format.');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing user_id parameter.');
  END IF;

  -- 0b. Authenticated caller authorization check (prevents account takeover)
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Authenticated session does not match target account UUID.');
  END IF;

  -- 1. Prevent stealing a wallet already linked to ANOTHER Google user
  SELECT user_id INTO v_existing_owner 
  FROM users 
  WHERE LOWER(linked_wallet_address) = p_wallet
    AND user_id IS NOT NULL 
    AND user_id <> p_user_id;

  IF v_existing_owner IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'This wallet is already linked to another Google account.'
    );
  END IF;

  -- 2. Fetch unauthenticated standalone wallet row if it exists
  -- Strictly matches linked_wallet_address (never synthetic player_id)
  SELECT *
  INTO v_old_row
  FROM users
  WHERE LOWER(linked_wallet_address) = p_wallet
    AND user_id IS NULL;

  IF FOUND THEN
    v_merged_pgt := COALESCE(v_old_row.balance_pgt, 0);
    v_merged_earned := COALESCE(v_old_row.total_earned, 0);
    v_merged_ref_pgt := COALESCE(v_old_row.unclaimed_referral_pgt, v_old_row.unclaimed_referral_rewards, 0);
    v_merged_ref_pol := COALESCE(v_old_row.unclaimed_referral_pol, 0);
    v_merged_ref_count := COALESCE(v_old_row.referrals_count, 0);
    v_merged_dodge := COALESCE(v_old_row.game_highscore, 0);
    v_merged_invaders := COALESCE(v_old_row.invaders_highscore, 0);
    v_merged_drift := COALESCE(v_old_row.drift_highscore, 0);
    v_merged_stacker := COALESCE(v_old_row.stacker_highscore, 0);
    v_merged_skeet := COALESCE(v_old_row.skeet_highscore, 0);
    v_merged_all_dodge := COALESCE(v_old_row.alltime_game_highscore, v_merged_dodge);
    v_merged_all_invaders := COALESCE(v_old_row.alltime_invaders_highscore, v_merged_invaders);
    v_merged_all_drift := COALESCE(v_old_row.alltime_drift_highscore, v_merged_drift);
    v_merged_all_stacker := COALESCE(v_old_row.alltime_stacker_highscore, v_merged_stacker);
    v_merged_all_skeet := COALESCE(v_old_row.alltime_skeet_highscore, v_merged_skeet);
    v_merged_stakes := COALESCE(v_old_row.stakes, '[]'::jsonb);
    v_merged_nfts := COALESCE(v_old_row.owned_nfts, '[]'::jsonb);
    v_merged_relics := COALESCE(v_old_row.relics, '{}'::jsonb);
    v_merged_space := COALESCE(v_old_row.space_state, '{}'::jsonb);
    v_merged_vip := v_old_row.vip_until;
    v_merged_amb := COALESCE(v_old_row.is_ambassador, false);

    -- Delete the unauthenticated duplicate row after reading metrics
    DELETE FROM users 
    WHERE LOWER(linked_wallet_address) = p_wallet
      AND user_id IS NULL;
  END IF;

  -- 3. Merge balance, highscores, stakes, referrals, relics, NFTs, VIP status, and link wallet directly to the Google account row
  UPDATE users 
  SET linked_wallet_address = p_wallet,
      balance_pgt = COALESCE(balance_pgt, 0) + v_merged_pgt,
      total_earned = COALESCE(total_earned, 0) + v_merged_earned,
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + v_merged_ref_pgt,
      unclaimed_referral_pol = COALESCE(unclaimed_referral_pol, 0) + v_merged_ref_pol,
      referrals_count = COALESCE(referrals_count, 0) + v_merged_ref_count,
      game_highscore = GREATEST(COALESCE(game_highscore, 0), v_merged_dodge),
      invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), v_merged_invaders),
      drift_highscore = GREATEST(COALESCE(drift_highscore, 0), v_merged_drift),
      stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), v_merged_stacker),
      skeet_highscore = GREATEST(COALESCE(skeet_highscore, 0), v_merged_skeet),
      alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_merged_all_dodge),
      alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_merged_all_invaders),
      alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_merged_all_drift),
      alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_merged_all_stacker),
      alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_merged_all_skeet),
      stakes = CASE 
        WHEN jsonb_typeof(v_merged_stakes) = 'array' AND jsonb_array_length(v_merged_stakes) > 0 THEN COALESCE(stakes, '[]'::jsonb) || v_merged_stakes 
        ELSE COALESCE(stakes, '[]'::jsonb) 
      END,
      owned_nfts = CASE 
        WHEN jsonb_typeof(v_merged_nfts) = 'array' AND jsonb_array_length(v_merged_nfts) > 0 THEN COALESCE(owned_nfts, '[]'::jsonb) || v_merged_nfts 
        ELSE COALESCE(owned_nfts, '[]'::jsonb) 
      END,
      relics = CASE
        WHEN v_merged_relics <> '{}'::jsonb THEN COALESCE(relics, '{}'::jsonb) || v_merged_relics
        ELSE COALESCE(relics, '{}'::jsonb)
      END,
      space_state = CASE 
        WHEN v_merged_space <> '{}'::jsonb THEN v_merged_space 
        ELSE COALESCE(space_state, '{}'::jsonb) 
      END,
      vip_until = CASE 
        WHEN v_merged_vip IS NOT NULL AND (vip_until IS NULL OR v_merged_vip > vip_until) THEN v_merged_vip 
        ELSE vip_until 
      END,
      is_ambassador = (COALESCE(is_ambassador, false) OR v_merged_amb),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Wallet linked & 100% account progress merged successfully!', 
    'wallet', p_wallet,
    'merged_pgt', v_merged_pgt,
    'merged_ref_rewards', v_merged_ref_pgt
  );
END;
$$;

REVOKE ALL ON FUNCTION link_wallet_to_account(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: get_caller_player_id
-- Resolves the verified player_id of the active authenticated session (auth.uid()).
-- Returns NULL if the caller is unauthenticated.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_caller_player_id();
DROP FUNCTION IF EXISTS get_caller_player_id();

CREATE OR REPLACE FUNCTION public.get_caller_player_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_pid TEXT;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT player_id INTO v_pid
  FROM public.users
  WHERE user_id = v_auth_uid OR web3_auth_id = v_auth_uid
  LIMIT 1;

  RETURN v_pid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_caller_player_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_caller_player_id() FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: assert_caller_player_id
-- Core Anti-Framing Identity Guard:
-- 1. Verifies that the caller has an active authenticated session (auth.uid()).
-- 2. If target ID is specified, strictly asserts that it resolves to the caller's
--    own account.
-- 3. If an unauthorized target ID is passed, logs an anti-cheat warning against
--    the CALLER's account and returns a MISMATCH status.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.assert_caller_player_id(TEXT);
DROP FUNCTION IF EXISTS assert_caller_player_id(TEXT);

CREATE OR REPLACE FUNCTION public.assert_caller_player_id(
  p_target_id TEXT,
  OUT p_status TEXT,       -- 'OK', 'UNAUTHENTICATED', 'PROFILE_NOT_FOUND', 'MISMATCH', 'ACCOUNT_BANNED'
  OUT p_player_id TEXT,    -- The verified player_id of the caller
  OUT p_error_msg TEXT     -- User-facing error message
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_role TEXT := auth.role();
  v_auth_uid UUID := auth.uid();
  v_caller_pid TEXT;
  v_resolved_target TEXT;
  v_target_auth_uid UUID;
  v_target_web3_auth_uid UUID;
  v_target_wallet TEXT;
  v_target_is_banned BOOLEAN;
  v_caller_wallet TEXT;
BEGIN
  -- 1. Service role or internal server execution without JWT:
  IF v_role = 'service_role' OR (v_role IS NULL AND v_auth_uid IS NULL) THEN
    p_status := 'OK';
    p_player_id := public.resolve_player_id(p_target_id);
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 2. Authenticated user with active Supabase Auth session (Google OAuth or Web3 SIWE):
  IF v_auth_uid IS NOT NULL THEN
    -- Match by primary Google/Web3 user_id OR secondary web3_auth_id:
    SELECT player_id, COALESCE(is_banned, false) INTO v_caller_pid, v_target_is_banned
    FROM public.users
    WHERE user_id = v_auth_uid OR web3_auth_id = v_auth_uid
    LIMIT 1;

    -- Fallback: If not yet linked via web3_auth_id, resolve caller profile from verified wallet identity
    IF v_caller_pid IS NULL THEN
      -- A) Check JWT claims
      v_caller_wallet := LOWER(COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'address',
        auth.jwt() -> 'user_metadata' ->> 'wallet_address',
        CASE WHEN auth.jwt() -> 'user_metadata' ->> 'sub' ~ '^0x[a-fA-F0-9]{40}$' THEN auth.jwt() -> 'user_metadata' ->> 'sub' ELSE NULL END,
        CASE WHEN auth.jwt() ->> 'email' ~ '^0x[a-fA-F0-9]{40}@' THEN SPLIT_PART(auth.jwt() ->> 'email', '@', 1) ELSE NULL END
      ));

      -- B) Check auth.users table
      IF v_caller_wallet IS NULL THEN
        BEGIN
          SELECT LOWER(COALESCE(
            raw_user_meta_data ->> 'address',
            raw_user_meta_data ->> 'wallet_address',
            CASE WHEN raw_user_meta_data ->> 'sub' ~ '^0x[a-fA-F0-9]{40}$' THEN raw_user_meta_data ->> 'sub' ELSE NULL END,
            CASE WHEN email ~ '^0x[a-fA-F0-9]{40}@' THEN SPLIT_PART(email, '@', 1) ELSE NULL END
          )) INTO v_caller_wallet
          FROM auth.users
          WHERE id = v_auth_uid;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;

      -- C) Check auth.identities table
      IF v_caller_wallet IS NULL THEN
        BEGIN
          SELECT LOWER(COALESCE(
            identity_data ->> 'address',
            identity_data ->> 'wallet_address',
            CASE WHEN provider_id ~ '^0x[a-fA-F0-9]{40}$' THEN provider_id ELSE NULL END
          )) INTO v_caller_wallet
          FROM auth.identities
          WHERE user_id = v_auth_uid
          LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;

      -- D) If caller wallet was verified, resolve profile and auto-heal web3_auth_id
      IF v_caller_wallet IS NOT NULL AND v_caller_wallet ~ '^0x[a-f0-9]{40}$' THEN
        SELECT player_id, COALESCE(is_banned, false) INTO v_caller_pid, v_target_is_banned
        FROM public.users
        WHERE LOWER(linked_wallet_address) = v_caller_wallet OR LOWER(player_id) = v_caller_wallet
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_caller_pid IS NOT NULL THEN
          UPDATE public.users
          SET web3_auth_id = v_auth_uid, updated_at = NOW()
          WHERE player_id = v_caller_pid AND (web3_auth_id IS NULL OR web3_auth_id <> v_auth_uid);
        END IF;
      END IF;
    END IF;

    -- Still no profile found
    IF v_caller_pid IS NULL THEN
      p_status := 'PROFILE_NOT_FOUND';
      p_player_id := NULL;
      p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist for this session.';
      RETURN;
    END IF;

    -- Enforce ban check on authenticated sessions
    IF v_target_is_banned THEN
      p_status := 'ACCOUNT_BANNED';
      p_player_id := v_caller_pid;
      p_error_msg := 'ACCOUNT_BANNED: Your account has been permanently suspended.';
      RETURN;
    END IF;

    -- Anti-Framing Assertion:
    -- If target ID was passed by client, it MUST resolve to the caller's own player_id.
    IF p_target_id IS NOT NULL AND TRIM(p_target_id) <> '' THEN
      v_resolved_target := public.resolve_player_id(p_target_id);
      IF v_resolved_target IS NOT NULL AND LOWER(v_resolved_target) <> LOWER(v_caller_pid) THEN
        -- Framing / impersonation attempt:
        PERFORM public.record_bot_warning(
          v_caller_pid,
          'identity_impersonation_attempt',
          'Security Sentinel',
          jsonb_build_object('attempted_target', p_target_id, 'resolved_target', v_resolved_target)
        );
        p_status := 'MISMATCH';
        p_player_id := v_caller_pid;
        p_error_msg := 'SECURITY_VIOLATION: You cannot perform actions on behalf of another player.';
        RETURN;
      END IF;
    END IF;

    p_status := 'OK';
    p_player_id := v_caller_pid;
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 3. Anonymous Web3 Wallet / Guest Caller (v_auth_uid IS NULL):
  -- For Web3 wallets and guest players accessing via anon PostgREST key,
  -- p_target_id must be provided and resolve to a valid, unbanned account.
  IF p_target_id IS NULL OR TRIM(p_target_id) = '' THEN
    p_status := 'UNAUTHENTICATED';
    p_player_id := NULL;
    p_error_msg := 'AUTHENTICATION_REQUIRED: Please sign in with Google or connect your wallet.';
    RETURN;
  END IF;

  v_resolved_target := public.resolve_player_id(p_target_id);

  IF v_resolved_target IS NULL THEN
    p_status := 'PROFILE_NOT_FOUND';
    p_player_id := NULL;
    p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist.';
    RETURN;
  END IF;

  SELECT user_id, web3_auth_id, linked_wallet_address, COALESCE(is_banned, false)
  INTO v_target_auth_uid, v_target_web3_auth_uid, v_target_wallet, v_target_is_banned
  FROM public.users
  WHERE player_id = v_resolved_target
  LIMIT 1;

  IF NOT FOUND THEN
    p_status := 'PROFILE_NOT_FOUND';
    p_player_id := NULL;
    p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist.';
    RETURN;
  END IF;

  IF v_target_is_banned THEN
    p_status := 'ACCOUNT_BANNED';
    p_player_id := v_resolved_target;
    p_error_msg := 'SECURITY_VIOLATION: Account is suspended.';
    RETURN;
  END IF;

  -- Prevent unauthenticated anon callers from acting on pure Google OAuth accounts (accounts without a linked Web3 wallet)
  -- Hybrid accounts with a linked Web3 wallet are legitimately accessible via wallet connection.
  IF (v_target_auth_uid IS NOT NULL OR v_target_web3_auth_uid IS NOT NULL) AND (v_target_wallet IS NULL OR TRIM(v_target_wallet) = '') THEN
    p_status := 'UNAUTHENTICATED';
    p_player_id := NULL;
    p_error_msg := 'AUTHENTICATION_REQUIRED: This account is linked to Google Auth. Please sign in with Google to continue.';
    RETURN;
  END IF;

  p_status := 'OK';
  p_player_id := v_resolved_target;
  p_error_msg := NULL;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_caller_player_id(TEXT) TO authenticated, service_role, anon;

-- ==============================================================================
-- 2. ARCADE SESSIONS & HIGH SCORES (ANTI-CHEAT HARVESTING)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: start_arcade_session
-- Source: bind_relic_drops_to_arcade_session.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_arcade_session(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.start_arcade_session(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS start_arcade_session(TEXT, TEXT);
DROP FUNCTION IF EXISTS start_arcade_session(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT,
  p_turnstile_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_session_id UUID;
  v_daily_completed_count INTEGER;
  v_max_daily_plays INTEGER := 35; -- Default fallback to 35 plays/day
  v_clean_game TEXT;
  v_game_key TEXT;
  v_game_settings JSONB;
  v_user RECORD;
  v_is_vip_only BOOLEAN := false;
  v_limit_reached BOOLEAN := false;
  
  -- Turnstile Sentinel variables
  v_turnstile_enabled BOOLEAN := true;
  v_turnstile_freq INTEGER := 3;
  v_turnstile_vip_bypass BOOLEAN := false;
  v_completed_since_turnstile INTEGER := 0;
  v_midnight_utc TIMESTAMPTZ;
  v_effective_check_time TIMESTAMPTZ;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_clean_game := LOWER(REPLACE(COALESCE(p_game_name, 'arcade'), ' ', ''));

  IF v_clean_game LIKE '%astro%' OR v_clean_game = 'astrododge' THEN
    v_game_key := 'AstroDodge';
  ELSIF v_clean_game LIKE '%invader%' THEN
    v_game_key := 'Cyber Invaders';
  ELSIF v_clean_game LIKE '%drift%' THEN
    v_game_key := 'Cyber Drift';
  ELSIF v_clean_game LIKE '%stacker%' OR v_clean_game LIKE '%catcher%' THEN
    v_game_key := 'Cyber Stacker';
  ELSIF v_clean_game LIKE '%skeet%' THEN
    v_game_key := 'Cyber Skeet';
  ELSIF v_clean_game LIKE '%defense%' THEN
    v_game_key := 'defense';
  ELSE
    v_game_key := COALESCE(p_game_name, 'arcade');
  END IF;

  -- Load Max Daily Plays, Turnstile Settings & VIP Settings from Global Settings
  SELECT 
    COALESCE(max_daily_plays_per_game, 35),
    game_payout_settings,
    COALESCE(turnstile_arcade_enabled, true),
    COALESCE(turnstile_arcade_frequency, 3),
    COALESCE(turnstile_arcade_vip_bypass, false)
  INTO 
    v_max_daily_plays,
    v_game_settings,
    v_turnstile_enabled,
    v_turnstile_freq,
    v_turnstile_vip_bypass
  FROM public.global_settings 
  WHERE id = 1 
  LIMIT 1;

  -- Check VIP requirement for the game
  IF v_game_settings IS NOT NULL AND v_clean_game LIKE '%stacker%' THEN
    v_is_vip_only := COALESCE((v_game_settings->'stacker'->>'vip_only')::boolean, false);
  ELSIF v_game_settings IS NOT NULL AND v_clean_game LIKE '%defense%' THEN
    v_is_vip_only := COALESCE((v_game_settings->'defense'->>'vip_only')::boolean, false);
  END IF;

  -- Load user record
  SELECT * INTO v_user FROM public.users WHERE player_id = v_pid;

  -- Verify player VIP status if game is VIP-only
  IF v_is_vip_only THEN
    IF v_user IS NULL OR (v_user.vip_until IS NULL OR v_user.vip_until <= NOW()) THEN
      IF NOT COALESCE(v_user.is_admin, false) AND NOT COALESCE(v_user.is_ambassador, false) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'This game is exclusive to VIP Pass holders! Upgrade to VIP to play.',
          'vip_required', true
        );
      END IF;
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 🛡️ CLOUDFLARE TURNSTILE SERVER SENTINEL (PLAN-010 Option A)
  -- --------------------------------------------------------------------------
  IF v_turnstile_enabled THEN
    -- Check VIP bypass & Admin exemption
    IF NOT (v_turnstile_vip_bypass AND v_user.vip_until IS NOT NULL AND v_user.vip_until > NOW()) 
       AND NOT COALESCE(v_user.is_admin, false) THEN
      
      -- Midnight UTC of today (ensures automatic daily reset)
      v_midnight_utc := DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');
      
      -- The effective check start time is the latest of: last Turnstile check OR midnight UTC
      IF v_user.last_turnstile_at IS NOT NULL AND v_user.last_turnstile_at > v_midnight_utc THEN
        v_effective_check_time := v_user.last_turnstile_at;
      ELSE
        v_effective_check_time := v_midnight_utc;
      END IF;

      -- Count completed arcade games across all games since effective check time
      SELECT COUNT(*) INTO v_completed_since_turnstile
      FROM public.arcade_sessions
      WHERE player_id = v_pid
        AND status = 'completed'
        AND created_at >= v_effective_check_time;

      -- If threshold reached, require Turnstile token
      IF v_completed_since_turnstile >= v_turnstile_freq THEN
        IF p_turnstile_token IS NULL OR TRIM(p_turnstile_token) = '' THEN
          RETURN jsonb_build_object(
            'success', false,
            'turnstile_required', true,
            'completed_since_turnstile', v_completed_since_turnstile,
            'turnstile_frequency', v_turnstile_freq,
            'error', 'Human verification required before starting this session.'
          );
        END IF;

        -- Validate token basic structure (Turnstile tokens are base64/hex strings >= 20 chars)
        IF LENGTH(TRIM(p_turnstile_token)) < 20 THEN
          PERFORM public.record_bot_warning(
            v_pid, 
            'fake_turnstile_token', 
            v_game_key, 
            jsonb_build_object('token_length', LENGTH(TRIM(p_turnstile_token)))
          );
          RETURN jsonb_build_object(
            'success', false,
            'turnstile_required', true,
            'error', 'Invalid security verification token.'
          );
        END IF;

        -- Token accepted: update last_turnstile_at on the user record
        UPDATE public.users
        SET last_turnstile_at = NOW(),
            updated_at = NOW()
        WHERE player_id = v_pid;
      END IF;
    END IF;
  END IF;

  -- Query Completed Sessions for this specific game in Last 24 Hours (Daily PGT reward limit)
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM public.arcade_sessions
  WHERE player_id = v_pid
    AND (game_name = v_game_key OR LOWER(game_name) = v_clean_game)
    AND status = 'completed'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  IF v_daily_completed_count >= v_max_daily_plays THEN
    v_limit_reached := true;
  END IF;

  v_session_id := gen_random_uuid();

  -- Insert session with status = 'in_progress' so player can earn relics & high scores
  INSERT INTO public.arcade_sessions (
    id,
    player_id,
    game_name,
    status,
    created_at,
    started_at
  ) VALUES (
    v_session_id,
    v_pid,
    v_game_key,
    'in_progress',
    NOW(),
    NOW()
  );

  -- Atomically increment career total_arcade_plays
  UPDATE public.users 
  SET total_arcade_plays = COALESCE(total_arcade_plays, 0) + 1,
      updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'game_name', v_game_key,
    'started_at', NOW(),
    'daily_limit_reached', v_limit_reached,
    'completed_today', v_daily_completed_count,
    'max_daily_plays', v_max_daily_plays,
    'turnstile_verified', (p_turnstile_token IS NOT NULL AND TRIM(p_turnstile_token) <> '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_arcade_session(TEXT, TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: end_arcade_session
-- Source: fix_end_arcade_session_weekly_active_tier.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);

CREATE OR REPLACE FUNCTION public.end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0,
  p_relic_multiplier NUMERIC DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_session RECORD;
  v_now TIMESTAMPTZ;
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER;
  v_clamped_items INTEGER;
  v_clamped_tokens INTEGER;
  v_all_nfts JSONB;
  v_server_nft_bonus_pct NUMERIC := 0.0;
  v_authoritative_nft_mult NUMERIC := 1.0;
  v_clamped_nft_mult NUMERIC;
  v_user RECORD;
  v_vip_mult NUMERIC;
  v_amb_mult NUMERIC;
  v_relic_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC;
  v_raw_pgt NUMERIC;
  v_bonus_token_pgt NUMERIC := 0.0;
  v_final_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_game_key TEXT;
  v_is_new_high BOOLEAN;
  v_max_daily_plays INTEGER;
  v_daily_completed_count INTEGER;
  v_global_earn_mult NUMERIC := 1.0;
  v_game_settings JSONB;
  v_harvest_enabled BOOLEAN := true;
  v_limit_reached BOOLEAN := false;
  v_new_weekly_games INTEGER := 0;
  v_current_weekly_faucets INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
  v_max_velocity_rate NUMERIC := 0.75;
  v_velocity_cap NUMERIC := 0.0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_now := NOW();
  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  -- Cap bonus tokens to maximum 20 (equivalent to 100 PGT max bonus)
  v_clamped_tokens := GREATEST(0, LEAST(COALESCE(p_bonus_tokens, 0), 20));
  v_vip_mult := 1.0;
  v_amb_mult := 1.0;
  v_total_multiplier := 1.0;
  v_raw_pgt := 0.0;
  v_bonus_token_pgt := 0.0;
  v_final_pgt := 0.0;
  v_new_balance := 0.0;
  v_is_new_high := false;
  v_max_daily_plays := 35;
  v_daily_completed_count := 0;
  v_global_earn_mult := 1.0;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid AND (player_id = v_pid OR LOWER(player_id) = LOWER(v_pid))
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or belongs to another player');
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session has already been finalized and claimed');
  END IF;

  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  IF COALESCE(v_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  v_duration_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_session.started_at, v_session.created_at)))::INTEGER;

  -- ----------------------------------------------------------------------------
  -- HARD SCORE LIMIT SENTINEL (500,000 PTS):
  -- Any score > 500,000 triggers an immediate bot warning, awards 0 PGT, burns session,
  -- and rejects submission without updating high scores.
  -- ----------------------------------------------------------------------------
  IF v_clamped_score > 500000 THEN
    PERFORM public.record_bot_warning(
      v_pid,
      'score_limit_500k_exceeded',
      COALESCE(v_session.game_name, 'Arcade'),
      jsonb_build_object(
        'submitted_score', p_score,
        'max_allowed_score', 500000,
        'duration_seconds', v_duration_seconds,
        'bonus_tokens', v_clamped_tokens
      )
    );

    UPDATE arcade_sessions
    SET status = 'completed',
        score = 0,
        bonus_items = 0,
        bonus_tokens = 0,
        payout_pgt = 0.0,
        completed_at = v_now,
        duration_seconds = v_duration_seconds
    WHERE id = v_session_uuid;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Score exceeds 500,000 limit. Submission blocked and bot warning recorded.',
      'bot_warning', true,
      'payout_pgt', 0.0,
      'new_balance', COALESCE(v_user.balance_pgt, 0)
    );
  END IF;

  -- Quick Deaths Handling (< 2s):
  -- Genuine instant deaths (score 0 or minimal) complete cleanly with 0 payout.
  -- Only reject if claiming an impossible score (> 250 pts or > 2 items) in under 2 seconds.
  IF v_duration_seconds < 2 THEN
    IF v_clamped_score > 250 OR v_clamped_items > 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Session ended too quickly for submitted score');
    ELSE
      UPDATE arcade_sessions
      SET status = 'completed',
          score = v_clamped_score,
          bonus_items = v_clamped_items,
          bonus_tokens = v_clamped_tokens,
          payout_pgt = 0.0,
          completed_at = v_now,
          duration_seconds = v_duration_seconds
      WHERE id = v_session_uuid;

      RETURN jsonb_build_object(
        'success', true,
        'payout', 0.0,
        'payout_pgt', 0.0,
        'new_balance', COALESCE(v_user.balance_pgt, 0),
        'weekly_games_played', COALESCE(v_user.weekly_games_played, 0),
        'weekly_active_tier', COALESCE(v_user.weekly_active_tier, 0)
      );
    END IF;
  END IF;

  SELECT COALESCE(earn_multiplier, 1.0), COALESCE(max_daily_plays_per_game, 35), game_payout_settings
  INTO v_global_earn_mult, v_max_daily_plays, v_game_settings
  FROM global_settings WHERE id = 1 LIMIT 1;


  v_game_clean := LOWER(REPLACE(COALESCE(v_session.game_name, 'astrododge'), ' ', ''));

  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_key := 'astrododge';
  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_key := 'invaders';
  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_key := 'drift';
  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_key := 'stacker';
  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_key := 'skeet';
  ELSIF v_game_clean LIKE '%defense%' THEN
    v_game_key := 'defense';
  ELSE
    v_game_key := v_game_clean;
  END IF;

  -- ----------------------------------------------------------------------------
  -- PHYSICAL ARCADE DURATION RATE-CLAMPS (Calibrated per game mechanics):
  -- 1. Orbs / Items: Road generation max 3 items/sec (+ 5 grace buffer)
  -- 2. Bonus Tokens: Max 1 token per 15 seconds (+ 1 grace buffer)
  -- 3. Realistic Score Velocity: Calibrated to speed and scoring formulas per game
  -- ----------------------------------------------------------------------------
  v_clamped_items := LEAST(v_clamped_items, GREATEST(5, v_duration_seconds * 3));
  v_clamped_tokens := LEAST(v_clamped_tokens, GREATEST(1, v_duration_seconds / 15));

  IF v_game_key = 'drift' THEN
    -- Cyber Drift: 10 pts/m + 150 pts/orb. At 167-200 km/h, velocity is 800-1,200 pts/sec
    v_clamped_score := LEAST(v_clamped_score, GREATEST(1500, v_duration_seconds * 1200));
  ELSIF v_game_key = 'skeet' THEN
    -- Cyber Skeet: Clays yield up to 500 pts * 10x combo = 5,000 pts per hit.
    -- High-intensity arcade runs legitimately reach 3,000 - 4,500 pts/sec.
    v_clamped_score := LEAST(v_clamped_score, GREATEST(3000, v_duration_seconds * 4500));
    v_max_velocity_rate := 1.75;
  ELSIF v_game_key = 'invaders' THEN
    v_clamped_score := LEAST(v_clamped_score, GREATEST(500, v_duration_seconds * 350));
  ELSIF v_game_key = 'astrododge' THEN
    v_clamped_score := LEAST(v_clamped_score, GREATEST(500, v_duration_seconds * 250));
  ELSE
    v_clamped_score := LEAST(v_clamped_score, GREATEST(500, v_duration_seconds * 500));
  END IF;

  v_harvest_enabled := COALESCE((v_game_settings->v_game_key->>'harvest_enabled')::boolean, true);

  -- Count Completed Sessions in Last 24 Hours
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE (player_id = v_pid OR LOWER(player_id) = LOWER(v_pid))
    AND game_name = v_session.game_name
    AND status = 'completed'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  IF v_daily_completed_count >= v_max_daily_plays THEN
    v_limit_reached := true;
  END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- ----------------------------------------------------------------------------
  -- 🛡️ STRICT SERVER-SIDE NFT MULTIPLIER VALIDATION
  -- Sourced authoritatively from users.owned_nfts and users.crate_nfts.
  -- Completely eliminates client parameter tampering (e.g. nft=10000).
  --   • nft_rare_shield ('Viper Shield'): +15%
  --   • nft_pulse_blaster / nft_hyper_drive ('Pulse Blaster'): +30%
  --   • nft_epic_yield ('Apex Matrix'): +50%
  -- ----------------------------------------------------------------------------
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);
  v_server_nft_bonus_pct := 0.0;
  IF v_all_nfts ? 'nft_rare_shield' THEN
    v_server_nft_bonus_pct := v_server_nft_bonus_pct + 15.0;
  END IF;
  IF v_all_nfts ? 'nft_pulse_blaster' OR v_all_nfts ? 'nft_hyper_drive' THEN
    v_server_nft_bonus_pct := v_server_nft_bonus_pct + 30.0;
  END IF;
  IF v_all_nfts ? 'nft_epic_yield' THEN
    v_server_nft_bonus_pct := v_server_nft_bonus_pct + 50.0;
  END IF;

  v_authoritative_nft_mult := 1.0 + (v_server_nft_bonus_pct / 100.0);
  -- Cap client's requested multiplier strictly to what they actually own
  v_clamped_nft_mult := LEAST(GREATEST(1.0, COALESCE(p_nft_multiplier, 1.0)), v_authoritative_nft_mult);

  -- ----------------------------------------------------------------------------
  -- 🛡️ STRICT SERVER-SIDE RELIC MULTIPLIER VALIDATION
  -- Sourced authoritatively from users.relics.
  -- 1.5x Apex Multiplier is granted ONLY if all 17 Serie 1 Relics are unlocked!
  -- Client parameter p_relic_multiplier cannot grant this bonus if relics are missing.
  -- ----------------------------------------------------------------------------
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  ELSE
    v_relic_mult := 1.0;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas & High Scores (Strictly bounded <= 500,000)
  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_name := 'AstroDodge';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET game_highscore = v_clamped_score, alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_name := 'Cyber Invaders';
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_name := 'Cyber Drift';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_name := 'Cyber Stacker';
    v_raw_pgt := ((v_clamped_items * 0.45) + (v_clamped_score / 1500.0)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.stacker_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET stacker_highscore = v_clamped_score, 
          alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_name := 'Cyber Skeet';
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.skeet_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET skeet_highscore = v_clamped_score, 
          alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%defense%' THEN
    v_game_name := 'Cyber Defense';
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.defense_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET defense_highscore = v_clamped_score, 
          defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSE
    v_game_name := v_session.game_name;
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
  END IF;

  -- Base Game Earn Ceiling: 125.00 PGT for high-scoring Cyber Skeet, 75.00 PGT standard for other arcades
  IF v_game_key = 'skeet' THEN
    v_raw_pgt := LEAST(v_raw_pgt, 125.00);
  ELSE
    v_raw_pgt := LEAST(v_raw_pgt, 75.00);
  END IF;

  -- Bonus Token / Block / Coin PGT Cap: Maximum 100.00 PGT
  v_bonus_token_pgt := LEAST(v_clamped_tokens * 5.0, 100.00);

  -- Apply multipliers or pause payout if limit reached
  IF v_limit_reached OR NOT v_harvest_enabled THEN
    v_final_pgt := 0.0;
  ELSE
    v_final_pgt := ROUND(((v_raw_pgt * v_total_multiplier) + v_bonus_token_pgt)::numeric, 2);

    -- Payout Velocity Sentinel: Sessions under 3 seconds cannot earn more than 1.00 PGT
    IF v_duration_seconds < 3 THEN
      v_final_pgt := LEAST(v_final_pgt, 1.00);
    END IF;

    -- Dynamic Velocity Clamping: Calibrated per-game rate * user's verified total multiplier
    v_velocity_cap := GREATEST(2.00, ROUND((v_duration_seconds * v_max_velocity_rate * v_total_multiplier)::numeric, 2));
    v_final_pgt := LEAST(v_final_pgt, v_velocity_cap);

    -- Catastrophe Circuit-Breaker (1,000.00 PGT): protects against theoretical numeric overflows
    v_final_pgt := LEAST(v_final_pgt, 1000.00);
  END IF;

  -- Update Arcade Session as Completed
  UPDATE arcade_sessions
  SET status = 'completed',
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt,
      completed_at = v_now,
      duration_seconds = v_duration_seconds
  WHERE id = v_session_uuid;

  -- Credit PGT balance if payout > 0
  IF v_final_pgt > 0 THEN
    v_new_balance := ROUND((COALESCE(v_user.balance_pgt, 0) + v_final_pgt)::numeric, 2);

    UPDATE users
    SET balance_pgt = v_new_balance,
        total_earned = ROUND((COALESCE(total_earned, 0) + v_final_pgt)::numeric, 2),
        updated_at = v_now
    WHERE player_id = v_pid;

    -- Process 4-Tier Referral Commissions for upline network
    PERFORM process_referral_commissions(v_pid, v_final_pgt, v_game_name || ' Arcade');
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  -- Update weekly active quest progression with canonical weekly_active_tier
  v_new_weekly_games := COALESCE(v_user.weekly_games_played, 0) + 1;
  v_current_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_current_weekly_faucets, v_new_weekly_games);

  UPDATE users
  SET weekly_games_played = v_new_weekly_games,
      weekly_active_tier = v_new_weekly_tier,
      updated_at = v_now
  WHERE player_id = v_pid;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_uuid,
    'game_name', v_game_name,
    'score', v_clamped_score,
    'final_score', v_clamped_score,
    'payout_pgt', v_final_pgt,
    'bonus_token_pgt', v_bonus_token_pgt,
    'new_balance', v_new_balance,
    'is_new_high', v_is_new_high,
    'new_high_score', v_is_new_high,
    'daily_limit_reached', v_limit_reached,
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', v_new_weekly_tier,
    'completed_today', v_daily_completed_count + 1,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: submit_arcade_highscore
-- Source: add_cyber_skeet.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_player_id TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_stacker_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL,
  p_skeet_highscore INTEGER DEFAULT NULL,
  p_defense_highscore INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_stacker_val INTEGER := COALESCE(p_stacker_highscore, p_catcher_highscore);
  v_max_score INTEGER := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_max_score := GREATEST(
    COALESCE(p_game_highscore, 0),
    COALESCE(p_invaders_highscore, 0),
    COALESCE(p_drift_highscore, 0),
    COALESCE(v_stacker_val, 0),
    COALESCE(p_skeet_highscore, 0),
    COALESCE(p_defense_highscore, 0)
  );

  IF v_max_score > 500000 THEN
    PERFORM public.record_bot_warning(
      v_pid,
      'score_limit_500k_exceeded',
      'submit_arcade_highscore',
      jsonb_build_object('submitted_score', v_max_score, 'max_allowed_score', 500000)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Score exceeds 500,000 limit. Bot warning recorded.');
  END IF;

  UPDATE users
  SET 
    game_highscore = GREATEST(COALESCE(game_highscore, 0), LEAST(COALESCE(p_game_highscore, 0), 500000)),
    invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), LEAST(COALESCE(p_invaders_highscore, 0), 500000)),
    drift_highscore = GREATEST(COALESCE(drift_highscore, 0), LEAST(COALESCE(p_drift_highscore, 0), 500000)),
    stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), LEAST(COALESCE(v_stacker_val, 0), 500000)),
    skeet_highscore = GREATEST(COALESCE(skeet_highscore, 0), LEAST(COALESCE(p_skeet_highscore, 0), 500000)),
    defense_highscore = GREATEST(COALESCE(defense_highscore, 0), LEAST(COALESCE(p_defense_highscore, 0), 500000)),
    alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0), LEAST(COALESCE(p_game_highscore, 0), 500000)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), LEAST(COALESCE(p_invaders_highscore, 0), 500000)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), LEAST(COALESCE(p_drift_highscore, 0), 500000)),
    alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0), LEAST(COALESCE(v_stacker_val, 0), 500000)),
    alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0), LEAST(COALESCE(p_skeet_highscore, 0), 500000)),
    defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), COALESCE(defense_highscore, 0), LEAST(COALESCE(p_defense_highscore, 0), 500000)),
    updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;


-- ==============================================================================
-- 3. QUANTUM RELICS SYSTEM (SESSION-BOUND & ON-CHAIN SYNC)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: grant_relic_drop
-- Source: bind_relic_drops_to_arcade_session.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS grant_relic_drop(TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_amount INT DEFAULT 1,
    p_session_id TEXT DEFAULT NULL,
    p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_guard RECORD;
    v_actual_player_id TEXT;
    v_current_relics JSONB;
    v_relic_obj JSONB;
    v_total INT;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_updated_relics JSONB;
    v_clean_relic_id TEXT := LOWER(TRIM(COALESCE(p_relic_id, '')));
    v_session RECORD;
    v_session_uuid UUID;
    v_context TEXT;
    v_is_internal BOOLEAN := false;
    v_is_admin BOOLEAN := false;
BEGIN
    -- 1. Verify True Internal Engine Calls via PostgreSQL Call Stack (Cannot be spoofed over HTTP)
    GET DIAGNOSTICS v_context = PG_CONTEXT;
    IF v_context LIKE '%claim_polyspace_expedition%' THEN
        v_is_internal := true;
    END IF;

    -- 2. Verify Master Admin Passkey (if provided)
    IF p_admin_passkey IS NOT NULL AND TRIM(p_admin_passkey) <> '' THEN
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_admin_passkey') THEN
            v_is_admin := public.verify_admin_passkey(p_admin_passkey);
        END IF;
    END IF;

    -- Authenticate caller & anti-framing guard
    IF NOT v_is_internal AND NOT v_is_admin THEN
        v_guard := public.assert_caller_player_id(p_player_id);
        IF v_guard.p_status <> 'OK' THEN
            RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
        END IF;
        v_actual_player_id := v_guard.p_player_id;
    ELSE
        v_actual_player_id := resolve_player_id(p_player_id);
        IF v_actual_player_id IS NULL OR v_actual_player_id = '' THEN
            v_actual_player_id := LOWER(TRIM(COALESCE(p_player_id, '')));
        END IF;
    END IF;

    -- Security Guard: Check if player account is suspended
    IF EXISTS (SELECT 1 FROM public.users WHERE player_id = v_actual_player_id AND is_banned = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player account suspended for security violations');
    END IF;

    -- 3. Anti-Cheat: Reject bulk drop amounts (strictly 1 relic per event)
    IF p_amount IS NOT NULL AND p_amount > 1 THEN
        IF NOT v_is_internal AND NOT v_is_admin THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_bulk_amount',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'amount', p_amount, 'source', 'direct_rpc_probe')
            );
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
    END IF;

    -- 4. Anti-Cheat: Bind client drops directly to an active, validated arcade session
    IF NOT v_is_internal AND NOT v_is_admin THEN
        -- Case A: Missing Session ID
        IF p_session_id IS NULL OR TRIM(p_session_id) = '' THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_missing_session',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'amount', p_amount, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case B: Malformed UUID
        BEGIN
            v_session_uuid := p_session_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_malformed_session_uuid',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END;

        -- Case C: Session lookup
        SELECT * INTO v_session
        FROM public.arcade_sessions
        WHERE id = v_session_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_session_not_found',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case D: Session belonging to another player (Identity spoofing)
        IF LOWER(v_session.player_id) <> LOWER(v_actual_player_id) THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_stolen_session',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'session_owner', v_session.player_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case E: Inactive / Finished Session
        IF v_session.status <> 'in_progress' THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_inactive_session',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'session_status', v_session.status, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case F: Max 3 relics per session
        IF COALESCE(v_session.relics_dropped_count, 0) >= 3 THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_capacity_exceeded',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Update session relic counters
        UPDATE public.arcade_sessions
        SET relics_dropped_count = COALESCE(relics_dropped_count, 0) + 1,
            last_relic_dropped_at = NOW()
        WHERE id = v_session_uuid;
    END IF;

    -- 5. Strict Whitelist Validation (Season 1)
    -- Both arcade games and PolySpace can drop Season 1 relics including Mythic Apex
    IF v_clean_relic_id NOT IN (
        -- AstroDodge (Serie 1)
        'relic_astrododge_prism', 'relic_astrododge_deflector', 'relic_astrododge_compass',
        -- Cyber Invaders (Serie 1)
        'relic_invaders_core', 'relic_invaders_dynamo', 'relic_invaders_transmitter',
        -- Cyber Drift (Serie 1)
        'relic_drift_chronometer', 'relic_drift_capacitor', 'relic_drift_overdrive',
        -- Cyber Stacker (Serie 1)
        'relic_stacker_foundation', 'relic_stacker_keystone', 'relic_stacker_monolith',
        -- PolySpace Fleet (Serie 1)
        'relic_space_darkmatter', 'relic_space_warpcoil', 'relic_space_plasma',
        -- Universal Apex (Serie 1) - Allowed across all games
        'relic_apex_singularity', 'relic_apex_genesis'
    ) THEN
        -- Allow Season 2 ONLY if admin passkey is verified
        IF v_is_admin AND v_clean_relic_id IN (
            'relic_exp1_a', 'relic_exp1_b', 'relic_exp1_c',
            'relic_exp2_a', 'relic_exp2_b', 'relic_exp2_c',
            'relic_exp3_a', 'relic_exp3_b', 'relic_exp3_c'
        ) THEN
            -- Allowed for Admin
            NULL;
        ELSE
            IF NOT v_is_internal AND NOT v_is_admin THEN
                PERFORM public.record_bot_warning(
                    v_actual_player_id,
                    'unauthorized_relic_probe_invalid_id',
                    'Relics System',
                    jsonb_build_object('relic_id', v_clean_relic_id, 'source', 'direct_rpc_probe')
                );
            END IF;
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;
    END IF;

    -- 6. Persist to Player Ledger
    SELECT relics INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF v_current_relics IS NULL THEN
        v_current_relics := '{}'::jsonb;
    END IF;

    IF v_current_relics ? v_clean_relic_id THEN
        v_relic_obj := v_current_relics -> v_clean_relic_id;
        v_total := COALESCE((v_relic_obj ->> 'total')::INT, 0) + COALESCE(p_amount, 1);
        v_unminted := COALESCE((v_relic_obj ->> 'unminted')::INT, 0) + COALESCE(p_amount, 1);
        v_onchain := COALESCE((v_relic_obj ->> 'onchain')::INT, 0);
        v_token_ids := COALESCE(v_relic_obj -> 'token_ids', '[]'::jsonb);
    ELSE
        v_total := COALESCE(p_amount, 1);
        v_unminted := COALESCE(p_amount, 1);
        v_onchain := 0;
        v_token_ids := '[]'::jsonb;
    END IF;

    v_updated_relics := jsonb_set(
        v_current_relics,
        ARRAY[v_clean_relic_id],
        jsonb_build_object(
            'total', v_total,
            'unminted', v_unminted,
            'onchain', v_onchain,
            'token_ids', v_token_ids
        )
    );

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN jsonb_build_object(
        'success', true,
        'relic_id', v_clean_relic_id,
        'added', COALESCE(p_amount, 1),
        'new_total', v_total,
        'relics', v_updated_relics
    );
END;
$$;

-- Backward-compatible 3-argument wrapper
CREATE OR REPLACE FUNCTION public.grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.grant_relic_drop(p_player_id, p_relic_id, p_amount, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: sync_onchain_relics
-- Source: restore_poss_relics_and_shield_all_users.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_onchain_relics(TEXT, JSONB);
DROP FUNCTION IF EXISTS sync_onchain_relics(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.sync_onchain_relics(
    p_player_id TEXT,
    p_chain_relics JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_guard RECORD;
    v_actual_player_id TEXT;
    v_current_relics JSONB;
    v_updated_relics JSONB := '{}'::jsonb;
    v_key TEXT;
    v_item JSONB;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_total INT;
BEGIN
    -- Authenticate caller & anti-framing guard
    v_guard := public.assert_caller_player_id(p_player_id);
    IF v_guard.p_status <> 'OK' THEN
        RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
    END IF;
    v_actual_player_id := v_guard.p_player_id;

    SELECT COALESCE(relics, '{}'::jsonb) INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    -- 1. Initialize result with all existing relics from DB, strictly preserving unminted counts
    FOR v_key IN SELECT jsonb_object_keys(v_current_relics) LOOP
        v_item := v_current_relics->v_key;
        v_unminted := COALESCE((v_item->>'unminted')::int, 0);
        v_updated_relics := jsonb_set(
            v_updated_relics,
            ARRAY[v_key],
            jsonb_build_object(
                'unminted', v_unminted,
                'onchain', 0,
                'total', v_unminted,
                'token_ids', '[]'::jsonb
            ),
            true
        );
    END LOOP;

    -- 2. Overlay verified on-chain counts & token IDs from p_chain_relics
    IF p_chain_relics IS NOT NULL AND jsonb_typeof(p_chain_relics) = 'object' THEN
        FOR v_key IN SELECT jsonb_object_keys(p_chain_relics) LOOP
            v_onchain := COALESCE((p_chain_relics->v_key->>'onchain')::int, 0);
            v_token_ids := COALESCE(p_chain_relics->v_key->'token_ids', '[]'::jsonb);
            
            IF v_updated_relics ? v_key THEN
                v_unminted := COALESCE((v_updated_relics->v_key->>'unminted')::int, 0);
            ELSE
                v_unminted := 0;
            END IF;

            v_total := v_unminted + v_onchain;

            v_updated_relics := jsonb_set(
                v_updated_relics,
                ARRAY[v_key],
                jsonb_build_object(
                    'unminted', v_unminted,
                    'onchain', v_onchain,
                    'total', v_total,
                    'token_ids', v_token_ids
                ),
                true
            );
        END LOOP;
    END IF;

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN v_updated_relics;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_onchain_relics(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_onchain_relics(TEXT, JSONB) TO service_role;


-- ==============================================================================
-- 4. FAUCETS, DEX LIQUIDITY & VIP POL YIELDS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC 1: claim_faucet (Server-Validated PGT Faucet)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS claim_faucet(TEXT);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.claim_faucet(
  p_player_id TEXT DEFAULT NULL,
  p_nft_boost_percent NUMERIC DEFAULT 0.0,
  p_1flr_balance NUMERIC DEFAULT 0.0,
  p_staked_pgt NUMERIC DEFAULT 0.0,
  p_onchain_pgt NUMERIC DEFAULT 0.0,
  p_lp_pgt NUMERIC DEFAULT 0.0,
  p_lp_usd NUMERIC DEFAULT 0.0,
  p_wallet TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_guard RECORD;
  v_raw_id TEXT := COALESCE(NULLIF(TRIM(p_player_id), ''), NULLIF(TRIM(p_wallet), ''));
  v_pid TEXT;
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_hours NUMERIC := 24.0;
  v_is_vip BOOLEAN := false;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_lp_mult NUMERIC := 1.0;
  v_streak INTEGER := 0;
  v_streak_boost NUMERIC := 0.0;
  v_ref_count INTEGER := 0;
  v_ref_boost NUMERIC := 0.0;
  v_all_nfts JSONB;
  v_nft_boost NUMERIC := 0.0;
  v_total_boost_percent NUMERIC := 0.0;
  v_staked_pgt_total NUMERIC := 0.0;
  v_base_payout NUMERIC := 50.0;
  v_final_payout NUMERIC := 50.0;
  v_new_balance NUMERIC := 0;
  v_new_weekly_faucets INTEGER := 0;
  v_current_weekly_games INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(v_raw_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- 1. Fetch dynamic base payout from global_settings (defaults to 50.0 if not configured)
  BEGIN
    SELECT COALESCE(faucet_base_pgt, 50.0) INTO v_base_payout 
    FROM public.global_settings 
    WHERE id = 1 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_base_payout := 50.0;
  END;

  IF v_base_payout IS NULL OR v_base_payout <= 0 THEN
    v_base_payout := 50.0;
  END IF;

  -- 2. VIP Status Check (Server-authoritative via users.vip_until)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_is_vip := true;
    v_vip_mult := 2.0;
    v_cooldown_hours := 21.6; -- 10% faster cooldown
  END IF;

  -- 3. Ambassador Status Check (Server-authoritative via users.is_ambassador)
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- 4. Check Serie 1 Apex Relics Multiplier (1.5x) from DB relics
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  -- 5. Check Tiered DEX Liquidity Provider Multiplier strictly based on DB users.dex_liquidity_usd
  -- ( = 1.1x,  = 1.2x,  = 1.3x)
  IF COALESCE(v_user.dex_liquidity_usd, 0) >= 150 THEN
    v_lp_mult := 1.30;
  ELSIF COALESCE(v_user.dex_liquidity_usd, 0) >= 100 THEN
    v_lp_mult := 1.20;
  ELSIF COALESCE(v_user.dex_liquidity_usd, 0) >= 50 THEN
    v_lp_mult := 1.10;
  END IF;

  -- 6. Enforce Faucet Cooldown (24h standard, 21.6h VIP)
  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Faucet on cooldown',
      'next_claim', v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')
    );
  END IF;

  -- 7. Daily streak calculation (within 48h preserves/increments streak)
  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + INTERVAL '48 hours') THEN
    v_streak := LEAST(COALESCE(v_user.faucet_streak, 0) + 1, 7);
  ELSE
    v_streak := 1;
  END IF;
  v_streak_boost := LEAST(v_streak * 2.0, 10.0); -- +2% per day, max +10%

  -- 8. Server-authoritative Referral Boost (+1% per L1 ref up to 20%, 30% if >= 100)
  -- Sourced dynamically from actual verified downline accounts in users
  SELECT COUNT(*) INTO v_ref_count
  FROM public.users
  WHERE (LOWER(referred_by_l1) = LOWER(v_pid) 
     OR (v_user.linked_wallet_address IS NOT NULL AND v_user.linked_wallet_address <> '' AND LOWER(referred_by_l1) = LOWER(v_user.linked_wallet_address)));
  IF v_ref_count >= 100 THEN
    v_ref_boost := 30.0;
  ELSE
    v_ref_boost := LEAST(v_ref_count * 1.0, 20.0);
  END IF;

  -- 9. Server-authoritative NFT Boost (Copper Core +10%, Silver Charger +25%, Gold Turbine/Quantum Core +50%)
  -- Sourced strictly from users.owned_nfts and users.crate_nfts
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);
  v_nft_boost := 0.0;
  IF v_all_nfts ? 'nft_gold_turbine' OR v_all_nfts ? 'nft_quantum_core' THEN
    v_nft_boost := v_nft_boost + 50.0;
  END IF;
  IF v_all_nfts ? 'nft_silver_charger' THEN
    v_nft_boost := v_nft_boost + 25.0;
  END IF;
  IF v_all_nfts ? 'nft_common_boost' THEN
    v_nft_boost := v_nft_boost + 10.0;
  END IF;

  -- 10. Calculate combined additive boost percent (NFT + Streak + Referral, clamped to max 125%)
  v_total_boost_percent := LEAST(v_nft_boost + v_streak_boost + v_ref_boost, 125.0);
  v_final_payout := v_base_payout * (1.0 + (v_total_boost_percent / 100.0));

  -- 11. Staked PGT Whale (+25%) - Calculated authoritatively from public.user_stakes
  SELECT COALESCE(SUM(amount), 0) INTO v_staked_pgt_total
  FROM public.user_stakes
  WHERE (LOWER(wallet_address) = LOWER(v_user.player_id) 
         OR (v_user.linked_wallet_address IS NOT NULL AND LOWER(wallet_address) = LOWER(v_user.linked_wallet_address)))
    AND active = true
    AND pool = 'pgt';

  IF v_staked_pgt_total >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.25; 
  END IF;

  -- 12. PGT Balance / Whale Multiplier (+10%) - Authoritative from DB balance or admin
  IF (LOWER(COALESCE(v_user.linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
      OR (COALESCE(v_user.balance_pgt, 0) + v_staked_pgt_total) >= 1000000) THEN 
    v_final_payout := v_final_payout * 1.10; 
  END IF;

  -- 13. Apply Multiplicative Multipliers: Relics (1.5x), VIP (2.0x), Ambassador (2.0x), DEX LP (1.1x–1.3x)
  v_final_payout := v_final_payout * v_relic_mult * v_vip_mult * v_amb_mult * v_lp_mult;
  
  -- Anti-Cheat Circuit Breaker: Absolute maximum ceiling sanity check (1,500 PGT)
  v_final_payout := ROUND(LEAST(v_final_payout, 1500.00), 2);

  v_new_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0) + 1;
  v_current_weekly_games := COALESCE(v_user.weekly_games_played, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_new_weekly_faucets, v_current_weekly_games);

  -- 14. Update users record. Note: dex_liquidity_usd is NEVER updated from client parameter!
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_payout,
      last_faucet_claim = v_now,
      faucet_streak = v_streak,
      weekly_faucet_claims = v_new_weekly_faucets,
      weekly_active_tier = v_new_weekly_tier,
      updated_at = v_now
  WHERE LOWER(player_id) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  PERFORM process_referral_commissions(v_pid, v_final_payout, 'Faucet Claim');

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_final_payout,
    'payout', v_final_payout,
    'multiplier', ROUND((v_final_payout / v_base_payout), 2),
    'streak', v_streak,
    'new_balance', v_new_balance,
    'weekly_faucet_claims', v_new_weekly_faucets,
    'weekly_active_tier', v_new_weekly_tier,
    'claimed_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM anon;
-- ------------------------------------------------------------------------------
-- RPC 2: claim_vip_faucet (Server-Validated VIP POL Faucet)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.claim_vip_faucet(
  p_player_id TEXT DEFAULT NULL,
  p_nft_boost_percent NUMERIC DEFAULT 0.0,
  p_1flr_balance NUMERIC DEFAULT 0.0,
  p_staked_pgt NUMERIC DEFAULT 0.0,
  p_onchain_pgt NUMERIC DEFAULT 0.0,
  p_lp_pgt NUMERIC DEFAULT 0.0,
  p_lp_usd NUMERIC DEFAULT 0.0,
  p_wallet TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_guard RECORD;
  v_raw_id TEXT := COALESCE(NULLIF(TRIM(p_player_id), ''), NULLIF(TRIM(p_wallet), ''));
  v_pid TEXT;
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_hours NUMERIC := 21.6; -- 24h * 0.90 (VIP 10% faster cooldown)
  v_vip_mult NUMERIC := 2.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_lp_mult NUMERIC := 1.0;
  v_streak INTEGER := 0;
  v_streak_boost NUMERIC := 0.0;
  v_ref_count INTEGER := 0;
  v_ref_boost NUMERIC := 0.0;
  v_all_nfts JSONB;
  v_nft_boost NUMERIC := 0.0;
  v_total_boost_percent NUMERIC := 0.0;
  v_staked_pgt_total NUMERIC := 0.0;
  v_base_payout NUMERIC := 0.005;
  v_final_payout NUMERIC := 0.005;
  v_new_unclaimed NUMERIC := 0.0;
  v_new_total NUMERIC := 0.0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(v_raw_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- 1. Must be an active VIP
  IF v_user.vip_until IS NULL OR v_user.vip_until <= v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP Membership required');
  END IF;

  -- 2. Fetch base payout (0.005 POL)
  BEGIN
    SELECT COALESCE(vip_faucet_base_pol, 0.005) INTO v_base_payout 
    FROM public.global_settings 
    WHERE id = 1 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_base_payout := 0.005;
  END;

  IF v_base_payout IS NULL OR v_base_payout <= 0 THEN
    v_base_payout := 0.005;
  END IF;

  -- 3. Ambassador Status Check
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- 4. Check Serie 1 Apex Relics Multiplier (1.5x)
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  -- 5. Tiered DEX Liquidity Provider Multiplier
  IF COALESCE(v_user.dex_liquidity_usd, 0) >= 150 THEN
    v_lp_mult := 1.30;
  ELSIF COALESCE(v_user.dex_liquidity_usd, 0) >= 100 THEN
    v_lp_mult := 1.20;
  ELSIF COALESCE(v_user.dex_liquidity_usd, 0) >= 50 THEN
    v_lp_mult := 1.10;
  END IF;

  -- 6. Enforce Cooldown (21.6 hours for VIP)
  IF v_user.last_vip_faucet_claim IS NOT NULL AND v_now < (v_user.last_vip_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'VIP Faucet on cooldown',
      'next_claim', v_user.last_vip_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')
    );
  END IF;

  -- 7. Daily streak (shared consecutive platform streak between PGT and VIP faucets)
  IF (v_user.last_vip_faucet_claim IS NOT NULL AND v_now < (v_user.last_vip_faucet_claim + INTERVAL '48 hours'))
     OR (v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + INTERVAL '48 hours')) THEN
    v_streak := LEAST(GREATEST(COALESCE(v_user.vip_faucet_streak, 0) + 1, COALESCE(v_user.claim_streak, 1)), 7);
  ELSE
    v_streak := 1;
  END IF;
  v_streak_boost := LEAST(v_streak * 2.0, 10.0);

  -- 8. Referral Boost
  -- Sourced dynamically from actual verified downline accounts in users
  SELECT COUNT(*) INTO v_ref_count
  FROM public.users
  WHERE (LOWER(referred_by_l1) = LOWER(v_pid) 
     OR (v_user.linked_wallet_address IS NOT NULL AND v_user.linked_wallet_address <> '' AND LOWER(referred_by_l1) = LOWER(v_user.linked_wallet_address)));
  IF v_ref_count >= 100 THEN
    v_ref_boost := 30.0;
  ELSE
    v_ref_boost := LEAST(v_ref_count * 1.0, 20.0);
  END IF;

  -- 9. Server-authoritative NFT Boost (Copper Core +10%, Silver Charger +25%, Gold Turbine/Quantum Core +50%)
  -- Supports active catalog IDs (nft_gold_turbine, nft_silver_charger, nft_common_boost) and legacy aliases
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);
  v_nft_boost := 0.0;
  IF (v_all_nfts ? 'nft_gold_turbine') OR (v_all_nfts ? 'nft_quantum_core') OR (v_all_nfts ? 'nft_gold_faucet')
     OR (v_all_nfts @> '[{"id":"nft_gold_turbine"}]'::jsonb)
     OR (v_all_nfts @> '[{"id":"nft_quantum_core"}]'::jsonb)
     OR (v_all_nfts @> '[{"id":"nft_gold_faucet"}]'::jsonb) THEN
    v_nft_boost := v_nft_boost + 50.0;
  END IF;
  IF (v_all_nfts ? 'nft_silver_charger') OR (v_all_nfts ? 'nft_silver_faucet')
     OR (v_all_nfts @> '[{"id":"nft_silver_charger"}]'::jsonb)
     OR (v_all_nfts @> '[{"id":"nft_silver_faucet"}]'::jsonb) THEN
    v_nft_boost := v_nft_boost + 25.0;
  END IF;
  IF (v_all_nfts ? 'nft_common_boost') OR (v_all_nfts ? 'nft_copper_faucet')
     OR (v_all_nfts @> '[{"id":"nft_common_boost"}]'::jsonb)
     OR (v_all_nfts @> '[{"id":"nft_copper_faucet"}]'::jsonb) THEN
    v_nft_boost := v_nft_boost + 10.0;
  END IF;

  -- 10. Combined additive boost (NFT + Streak + Referral, clamped to max 125%)
  v_total_boost_percent := LEAST(v_nft_boost + v_streak_boost + v_ref_boost, 125.0);
  v_final_payout := v_base_payout * (1.0 + (v_total_boost_percent / 100.0));

  -- 11. Staked PGT Whale (+25%) - Calculated authoritatively from public.user_stakes
  -- Queries user_stakes using player_id and linked_wallet_address (users table has no wallet_address field)
  SELECT COALESCE(SUM(amount), 0) INTO v_staked_pgt_total
  FROM public.user_stakes
  WHERE (LOWER(wallet_address) = LOWER(v_user.player_id) 
         OR (v_user.linked_wallet_address IS NOT NULL AND LOWER(wallet_address) = LOWER(v_user.linked_wallet_address)))
    AND active = true
    AND pool = 'pgt';

  IF v_staked_pgt_total >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.25; 
  END IF;
  
  -- 12. PGT Balance / Whale Multiplier (+10%) - Authoritative from DB balance or admin
  IF (LOWER(COALESCE(v_user.linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
      OR LOWER(COALESCE(v_user.player_id, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
      OR (COALESCE(v_user.balance_pgt, 0) + v_staked_pgt_total) >= 1000000) THEN 
    v_final_payout := v_final_payout * 1.10; 
  END IF;

  -- 13. Multipliers: Relics (1.5x), VIP (2.0x), Ambassador (2.0x), Liquidity Provider (1.10x, 1.20x, or 1.30x)
  v_final_payout := v_final_payout * v_relic_mult * v_vip_mult * v_amb_mult * v_lp_mult;
  
  -- Sanity clamp: Maximum 0.250000 POL per VIP claim
  v_final_payout := ROUND(LEAST(v_final_payout, 0.250000), 6);

  v_new_unclaimed := COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) + v_final_payout;
  v_new_total := COALESCE(v_user.total_vip_faucet_pol, 0.0) + v_final_payout;

  -- 14. Update users record without touching dex_liquidity_usd
  UPDATE public.users
  SET
    unclaimed_vip_faucet_pol = v_new_unclaimed,
    total_vip_faucet_pol = v_new_total,
    last_vip_faucet_claim = v_now,
    vip_faucet_streak = v_streak,
    updated_at = v_now
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN jsonb_build_object(
    'success', true,
    'payout_pol', v_final_payout,
    'payout', v_final_payout,
    'multiplier', ROUND((v_final_payout / v_base_payout), 2),
    'streak', v_streak,
    'unclaimed_vip_pol', v_new_unclaimed,
    'unclaimed_vip_faucet_pol', v_new_unclaimed,
    'total_vip_pol', v_new_total,
    'total_vip_faucet_pol', v_new_total,
    'last_vip_faucet_claim', v_now,
    'claimed_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC 3: sync_user_dex_liquidity (USD Value Hard-Clamped)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_user_dex_liquidity(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.sync_user_dex_liquidity(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS sync_user_dex_liquidity(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS sync_user_dex_liquidity(TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.sync_user_dex_liquidity(
  p_player_id TEXT,
  p_lp_usd NUMERIC,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_canonical_id TEXT;
  v_clean_usd NUMERIC;
  v_is_admin BOOLEAN := false;
  v_caller TEXT := LOWER(COALESCE(CURRENT_USER, ''));
BEGIN
  -- Admin passkey allows manual adjustment from admin panel, or service_role allows verified backend sync
  IF v_caller = 'service_role' THEN
    v_is_admin := true;
  ELSIF p_admin_passkey IS NOT NULL THEN
    v_is_admin := public.verify_admin_passkey(p_admin_passkey);
  END IF;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admin or verified service role can update DEX liquidity.');
  END IF;

  v_canonical_id := public.resolve_player_id(p_player_id);
  IF v_canonical_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  v_clean_usd := ROUND(LEAST(GREATEST(COALESCE(p_lp_usd, 0.0), 0.0), 10000.0), 2);

  UPDATE public.users
  SET 
    dex_liquidity_usd = v_clean_usd,
    updated_at = NOW()
  WHERE player_id = v_canonical_id;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_canonical_id,
    'dex_liquidity_usd', v_clean_usd,
    'is_admin_override', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_dex_liquidity(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_dex_liquidity(TEXT, NUMERIC, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: request_vip_faucet_pol_payout
-- Source: add_vip_pol_faucet.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_vip_faucet_pol_payout(TEXT);
DROP FUNCTION IF EXISTS public.request_vip_faucet_pol_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS request_vip_faucet_pol_payout(TEXT);
DROP FUNCTION IF EXISTS request_vip_faucet_pol_payout(TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.request_vip_faucet_pol_payout(
  p_player_id TEXT,
  p_amount NUMERIC DEFAULT 5.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_user RECORD;
  v_min_payout NUMERIC := 5.0;
  v_payout_wallet TEXT;
  v_request_id UUID;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Determine minimum payout threshold
  BEGIN
    SELECT COALESCE(vip_faucet_min_payout_pol, 5.0) INTO v_min_payout
    FROM public.global_settings
    WHERE id = 1
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_min_payout := 5.0;
  END;

  IF p_amount < v_min_payout THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum payout request is ' || v_min_payout || ' POL');
  END IF;

  IF COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient accumulated VIP POL balance (Has ' || COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) || ' POL)');
  END IF;

  -- Resolve destination EVM wallet
  v_payout_wallet := LOWER(COALESCE(v_user.linked_wallet_address, ''));
  IF v_payout_wallet IS NULL OR v_payout_wallet = '' OR v_payout_wallet LIKE '0xpgt%' OR v_payout_wallet LIKE '0xg%' OR LENGTH(v_payout_wallet) < 42 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No linked Web3 EVM wallet found on your profile! Please link a Web3 wallet to receive payouts.');
  END IF;

  -- Deduct on-site balance
  UPDATE public.users
  SET 
    unclaimed_vip_faucet_pol = GREATEST(0.0, unclaimed_vip_faucet_pol - p_amount),
    updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  -- Insert pending payout request for Master Admin
  INSERT INTO public.pol_payout_requests (wallet_address, username, amount_pol, status, source)
  VALUES (v_payout_wallet, COALESCE(v_user.username, ''), p_amount, 'pending', 'vip_faucet')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount_pol', p_amount,
    'payout_wallet', v_payout_wallet,
    'new_unclaimed_balance', GREATEST(0.0, COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) - p_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_vip_faucet_pol_payout(TEXT, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.request_vip_faucet_pol_payout(TEXT, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC 1: credit_nft_referral_commission (Server-Authoritative Catalog & Inventory)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS credit_nft_referral_commission(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.credit_nft_referral_commission(
  buyer_wallet TEXT,
  pol_price NUMERIC,
  item_name TEXT DEFAULT 'NFT Purchase',
  p_tx_hash TEXT DEFAULT NULL,
  p_item_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_buyer RECORD;
  v_parent RECORD;
  v_buyer_id TEXT;
  v_parent_id TEXT;
  v_resolved_item_id TEXT;
  v_catalog_price NUMERIC;
  v_commission NUMERIC;
  v_buyer_name TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_time_str TEXT := TO_CHAR(NOW(), 'HH12:MI:SS AM');
  v_action_str TEXT;
  v_new_entry JSONB;
  v_clean_hash TEXT := LOWER(TRIM(COALESCE(p_tx_hash, '')));
  v_buyer_nfts JSONB;
  v_guard RECORD;
BEGIN
  -- 1. Anti-Cheat: Require valid EVM transaction hash format (66-char hex)
  IF v_clean_hash = '' OR v_clean_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Transaction hash required for on-chain referral verification');
  END IF;

  IF NOT (v_clean_hash ~ '^0x[a-f0-9]{64}$') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Invalid EVM transaction hash format');
  END IF;

  -- 2. Anti-Replay: Check if transaction hash has already been credited
  IF EXISTS (SELECT 1 FROM public.pol_referral_commissions WHERE LOWER(tx_hash) = v_clean_hash) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Transaction hash has already been credited for referral commission');
  END IF;

  -- 3. Authoritative Catalog Item & Price Resolution (Ignore untrusted client pol_price)
  IF p_item_id IS NOT NULL AND TRIM(p_item_id) <> '' THEN
    v_resolved_item_id := LOWER(TRIM(p_item_id));
  ELSE
    -- Fallback mapping from item_name if p_item_id is not directly passed
    IF LOWER(item_name) LIKE '%copper core%' THEN v_resolved_item_id := 'nft_common_boost';
    ELSIF LOWER(item_name) LIKE '%silver charger%' THEN v_resolved_item_id := 'nft_silver_charger';
    ELSIF LOWER(item_name) LIKE '%gold turbine%' THEN v_resolved_item_id := 'nft_gold_turbine';
    ELSIF LOWER(item_name) LIKE '%viper shield%' THEN v_resolved_item_id := 'nft_rare_shield';
    ELSIF LOWER(item_name) LIKE '%pulse blaster%' THEN v_resolved_item_id := 'nft_pulse_blaster';
    ELSIF LOWER(item_name) LIKE '%apex matrix%' THEN v_resolved_item_id := 'nft_epic_yield';
    ELSIF LOWER(item_name) LIKE '%referral beacon%' THEN v_resolved_item_id := 'nft_referral_beacon';
    ELSIF LOWER(item_name) LIKE '%affiliate guild%' THEN v_resolved_item_id := 'nft_affiliate_guild';
    ELSIF LOWER(item_name) LIKE '%omni lord%' THEN v_resolved_item_id := 'nft_legendary_king';
    ELSIF LOWER(item_name) LIKE '%rare yield vault%' THEN v_resolved_item_id := 'nft_yield_vault_rare';
    ELSIF LOWER(item_name) LIKE '%epic yield vault%' THEN v_resolved_item_id := 'nft_yield_vault_epic';
    ELSIF LOWER(item_name) LIKE '%yield vault%' THEN v_resolved_item_id := 'nft_yield_vault';
    ELSIF LOWER(item_name) LIKE '%yearly%' OR LOWER(item_name) LIKE '%365%' THEN v_resolved_item_id := 'nft_vip_pass_yearly';
    ELSIF LOWER(item_name) LIKE '%vip%' THEN v_resolved_item_id := 'nft_vip_pass';
    ELSE v_resolved_item_id := NULL;
    END IF;
  END IF;

  CASE v_resolved_item_id
    WHEN 'nft_common_boost' THEN v_catalog_price := 5.0;
    WHEN 'nft_silver_charger' THEN v_catalog_price := 15.0;
    WHEN 'nft_gold_turbine' THEN v_catalog_price := 40.0;
    WHEN 'nft_rare_shield' THEN v_catalog_price := 15.0;
    WHEN 'nft_pulse_blaster' THEN v_catalog_price := 40.0;
    WHEN 'nft_epic_yield' THEN v_catalog_price := 60.0;
    WHEN 'nft_referral_beacon' THEN v_catalog_price := 10.0;
    WHEN 'nft_affiliate_guild' THEN v_catalog_price := 100.0;
    WHEN 'nft_legendary_king' THEN v_catalog_price := 300.0;
    WHEN 'nft_yield_vault' THEN v_catalog_price := 50.0;
    WHEN 'nft_yield_vault_rare' THEN v_catalog_price := 150.0;
    WHEN 'nft_yield_vault_epic' THEN v_catalog_price := 300.0;
    WHEN 'nft_vip_pass' THEN v_catalog_price := 100.0;
    WHEN 'nft_vip_pass_yearly' THEN v_catalog_price := 900.0;
    ELSE v_catalog_price := NULL;
  END CASE;

  IF v_catalog_price IS NULL OR v_resolved_item_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Unrecognized or non-commissionable NFT catalog item');
  END IF;

  v_commission := ROUND(v_catalog_price * 0.10, 4);

  -- 4. Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(buyer_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'reason', v_guard.p_error_msg);
  END IF;
  v_buyer_id := v_guard.p_player_id;

  -- 5. Fetch buyer record
  SELECT player_id, linked_wallet_address, username, referred_by_l1, owned_nfts, crate_nfts
  INTO v_buyer
  FROM public.users
  WHERE player_id = v_buyer_id
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(TRIM(buyer_wallet))
     OR LOWER(player_id) = LOWER(TRIM(buyer_wallet))
  LIMIT 1;

  IF v_buyer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Buyer not found');
  END IF;

  -- 6. Check for Level 1 referrer
  IF v_buyer.referred_by_l1 IS NULL OR TRIM(v_buyer.referred_by_l1) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No Level 1 referrer assigned');
  END IF;

  v_parent_id := resolve_player_id(v_buyer.referred_by_l1);
  IF v_parent_id IS NULL OR v_parent_id = '' THEN
    v_parent_id := LOWER(TRIM(v_buyer.referred_by_l1));
  END IF;

  -- Prevent self-referral loop
  IF LOWER(v_parent_id) = LOWER(v_buyer.player_id) OR 
     (v_buyer.linked_wallet_address IS NOT NULL AND LOWER(v_parent_id) = LOWER(v_buyer.linked_wallet_address)) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Self referral prohibited');
  END IF;

  -- 8. Lock and fetch parent referrer record
  SELECT player_id, linked_wallet_address, username, unclaimed_referral_pol, total_referral_pol, referrals_list
  INTO v_parent
  FROM public.users
  WHERE player_id = v_parent_id
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(TRIM(v_buyer.referred_by_l1))
     OR LOWER(player_id) = LOWER(TRIM(v_buyer.referred_by_l1))
  FOR UPDATE;

  IF v_parent IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Referrer account not found');
  END IF;

  -- 9. Format display name & action string
  IF v_buyer.username IS NOT NULL AND TRIM(v_buyer.username) <> '' AND UPPER(TRIM(v_buyer.username)) <> 'EMPTY' THEN
    v_buyer_name := TRIM(v_buyer.username);
  ELSE
    v_buyer_name := 'Player_' || SUBSTRING(v_buyer.player_id FROM 1 FOR 8);
  END IF;

  v_action_str := COALESCE(NULLIF(TRIM(item_name), ''), v_resolved_item_id);

  -- 10. Construct referral activity entry
  v_new_entry := jsonb_build_object(
    'name', v_buyer_name,
    'player', v_buyer_name,
    'player_id', v_buyer.player_id,
    'level', 1,
    'action', v_action_str,
    'item_id', v_resolved_item_id,
    'amount', v_catalog_price,
    'commission', v_commission,
    'currency', 'POL',
    'tx_hash', v_clean_hash,
    'time', v_time_str,
    'created_at', v_now
  );

  -- 11. Record into pol_referral_commissions to permanently prevent replay
  INSERT INTO public.pol_referral_commissions (
    tx_hash,
    buyer_wallet,
    referrer_player_id,
    amount_pol,
    commission_pol,
    item_name,
    created_at
  ) VALUES (
    v_clean_hash,
    v_buyer.player_id,
    v_parent.player_id,
    v_catalog_price,
    v_commission,
    v_action_str,
    v_now
  );

  -- 12. Credit 10% POL to parent referrer and prepend to rolling 50-item ledger
  UPDATE public.users
  SET 
    unclaimed_referral_pol = COALESCE(unclaimed_referral_pol, 0) + v_commission,
    total_referral_pol = COALESCE(total_referral_pol, 0) + v_commission,
    referrals_list = (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(jsonb_build_array(v_new_entry) || COALESCE(v_parent.referrals_list, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord ASC
        LIMIT 50
      ) sub
    ),
    updated_at = v_now
  WHERE player_id = v_parent.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_parent.player_id,
    'commission_pol', v_commission,
    'catalog_price', v_catalog_price,
    'item_id', v_resolved_item_id,
    'buyer', v_buyer_name,
    'action', v_action_str,
    'tx_hash', v_clean_hash
  );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_nft_referral_commission(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_nft_referral_commission(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: request_pol_referral_payout
-- Source: fix_nft_pol_referral_commissions.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_pol_referral_payout(TEXT);
DROP FUNCTION IF EXISTS public.request_pol_referral_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS request_pol_referral_payout(TEXT);
DROP FUNCTION IF EXISTS request_pol_referral_payout(TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.request_pol_referral_payout(
  p_user_wallet TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_username TEXT;
  v_unclaimed NUMERIC;
  v_payout_wallet TEXT;
  v_request_id UUID;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_user_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'reason', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  p_user_wallet := LOWER(TRIM(p_user_wallet));

  IF p_amount <= 0.001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Minimum payout request is 0.001 POL');
  END IF;

  -- Lock user record
  SELECT 
    username, 
    COALESCE(unclaimed_referral_pol, 0),
    COALESCE(linked_wallet_address, p_user_wallet)
  INTO 
    v_username, 
    v_unclaimed,
    v_payout_wallet
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_user_wallet
     OR LOWER(player_id) = p_user_wallet
  FOR UPDATE;

  IF v_unclaimed IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'User profile not found');
  END IF;

  IF v_unclaimed < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Insufficient unclaimed POL referral balance');
  END IF;

  -- Deduct from user's unclaimed POL pool
  UPDATE public.users
  SET unclaimed_referral_pol = GREATEST(0, unclaimed_referral_pol - p_amount),
      updated_at = NOW()
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_user_wallet
     OR LOWER(player_id) = p_user_wallet;

  -- Create pending payout request for Master Admin approval
  INSERT INTO public.pol_payout_requests (wallet_address, username, amount_pol, status)
  VALUES (v_payout_wallet, COALESCE(v_username, ''), p_amount, 'pending')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount_pol', p_amount,
    'payout_wallet', v_payout_wallet
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_pol_referral_payout(TEXT, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.request_pol_referral_payout(TEXT, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: bind_referral_code
-- Hardened with assert_caller_player_id anti-framing guard, banned referrer check,
-- and loop prevention.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.bind_referral_code(TEXT, TEXT);
DROP FUNCTION IF EXISTS bind_referral_code(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.bind_referral_code(
  p_user_wallet TEXT,
  p_ref_code TEXT
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, extensions
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_ref_user RECORD;
  v_cur_user RECORD;
  v_clean_ref TEXT;
BEGIN
  -- 1. Anti-framing & identity assertion: caller MUST be p_user_wallet
  v_guard := public.assert_caller_player_id(p_user_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_clean_ref := LOWER(TRIM(COALESCE(p_ref_code, '')));
  IF v_clean_ref = '' OR v_clean_ref = 'empty' OR v_clean_ref = 'null' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or empty referral code');
  END IF;

  SELECT * INTO v_cur_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target user not found');
  END IF;

  -- Defense 1: Reject if already has a referrer linked
  IF v_cur_user.referred_by_l1 IS NOT NULL AND v_cur_user.referred_by_l1 <> '' AND v_cur_user.referred_by_l1 <> 'EMPTY' THEN
    RETURN jsonb_build_object('success', false, 'message', 'User already has a referrer linked');
  END IF;

  -- Defense 2: Registration Window Lock (Max 15 minutes since account creation)
  -- Referral links are only valid on initial signup/registration, never retroactive.
  IF v_cur_user.created_at < (NOW() - INTERVAL '15 minutes') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code can only be linked within 15 minutes of account registration');
  END IF;

  -- Defense 3: Activity Lock (Established accounts cannot be bound retroactively)
  IF COALESCE(v_cur_user.total_arcade_plays, 0) > 0 
     OR COALESCE(v_cur_user.faucet_streak, 0) > 0 
     OR v_cur_user.last_faucet_claim IS NOT NULL 
     OR COALESCE(v_cur_user.total_earned, 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code cannot be applied to established active accounts');
  END IF;

  -- Match against referral_code, player_id, or linked_wallet_address
  SELECT * INTO v_ref_user 
  FROM public.users 
  WHERE LOWER(COALESCE(referral_code, '')) = v_clean_ref 
     OR LOWER(player_id) = v_clean_ref 
     OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean_ref;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code not found in database');
  END IF;

  -- Defense 4: Ban Shield (Reject suspended accounts universally)
  IF COALESCE(v_ref_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'message', 'This referral code is suspended');
  END IF;

  IF LOWER(v_ref_user.player_id) = LOWER(v_pid) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot refer yourself');
  END IF;

  -- Prevent circular referral
  IF LOWER(COALESCE(v_ref_user.referred_by_l1, '')) = LOWER(v_pid) 
     OR LOWER(COALESCE(v_ref_user.referred_by_l2, '')) = LOWER(v_pid)
     OR LOWER(COALESCE(v_ref_user.referred_by_l3, '')) = LOWER(v_pid)
     OR LOWER(COALESCE(v_ref_user.referred_by_l4, '')) = LOWER(v_pid) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Circular referral loop detected');
  END IF;

  -- Crucial: ALWAYS store player_id in referred_by_l1..l4
  UPDATE public.users
  SET referred_by_l1 = v_ref_user.player_id,
      referred_by_l2 = NULLIF(v_ref_user.referred_by_l1, ''),
      referred_by_l3 = NULLIF(v_ref_user.referred_by_l2, ''),
      referred_by_l4 = NULLIF(v_ref_user.referred_by_l3, ''),
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  -- Increment Level 1 Referrer Counters
  UPDATE public.users 
  SET referrals_count = COALESCE(referrals_count, 0) + 1,
      referrals_l1 = COALESCE(referrals_l1, 0) + 1,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_ref_user.player_id);

  -- Increment Level 2 Referrer Counters
  IF v_ref_user.referred_by_l1 IS NOT NULL AND v_ref_user.referred_by_l1 <> '' THEN
    UPDATE public.users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l2 = COALESCE(referrals_l2, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l1);
  END IF;

  -- Increment Level 3 Referrer Counters
  IF v_ref_user.referred_by_l2 IS NOT NULL AND v_ref_user.referred_by_l2 <> '' THEN
    UPDATE public.users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l3 = COALESCE(referrals_l3, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l2);
  END IF;

  -- Increment Level 4 Referrer Counters
  IF v_ref_user.referred_by_l3 IS NOT NULL AND v_ref_user.referred_by_l3 <> '' THEN
    UPDATE public.users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l4 = COALESCE(referrals_l4, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l3);
  END IF;

  RETURN jsonb_build_object('success', true, 'referrer', v_ref_user.player_id, 'ref_code', v_clean_ref);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bind_referral_code(TEXT, TEXT) TO anon, authenticated, service_role;


-- ==============================================================================
-- 5. CASINO MINI-GAMES & MINES (1 IN 10,000 PROGRESSIVE JACKPOT)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: play_roshambo
-- Source: update_jackpot_probability_to_1_in_10000.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.play_roshambo(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS play_roshambo(TEXT, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION public.play_roshambo(
  p_wallet TEXT, 
  p_bet NUMERIC, 
  p_choice TEXT
) RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_cpu_choice TEXT;
  v_outcome TEXT;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_rand NUMERIC;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  p_choice := LOWER(TRIM(p_choice));
  IF p_bet <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  -- 95% RTP: 30% Win (2.0x), 35% Tie (1.0x), 35% Lose (0.0x)
  v_rand := random();
  IF v_rand < 0.30 THEN
    v_outcome := 'win';
    v_payout := p_bet * 2.0;
    IF p_choice = 'rock' THEN v_cpu_choice := 'scissors';
    ELSIF p_choice = 'paper' THEN v_cpu_choice := 'rock';
    ELSE v_cpu_choice := 'paper'; END IF;
  ELSIF v_rand < 0.65 THEN
    v_outcome := 'tie';
    v_payout := p_bet * 1.0;
    v_cpu_choice := p_choice;
  ELSE
    v_outcome := 'lose';
    v_payout := 0.0;
    IF p_choice = 'rock' THEN v_cpu_choice := 'paper';
    ELSIF p_choice = 'paper' THEN v_cpu_choice := 'scissors';
    ELSE v_cpu_choice := 'rock'; END IF;
  END IF;

  -- 1 in 10,000 server-side Progressive Jackpot win roll (0.0001)
  IF random() < 0.0001 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout FROM global_jackpot WHERE id = 1 FOR UPDATE;
    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN v_jackpot_payout := 2000; END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    UPDATE global_jackpot 
    SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        updated_at = NOW()
    WHERE id = 1
    RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;
  END IF;

  -- Update user balance atomically
  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'outcome', v_outcome, 
    'result', v_outcome,
    'cpu_choice', v_cpu_choice, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.play_roshambo(TEXT, NUMERIC, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.play_roshambo(TEXT, NUMERIC, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: play_spinner
-- Source: update_jackpot_probability_to_1_in_10000.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.play_spinner(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS play_spinner(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.play_spinner(
  p_wallet TEXT, 
  p_bet NUMERIC
) RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_rand NUMERIC;
  v_multiplier NUMERIC;
  v_payout NUMERIC;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_segment INT;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_bet <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  v_rand := random();
  IF v_rand < 0.45 THEN v_multiplier := 0; v_segment := 0;
  ELSIF v_rand < 0.70 THEN v_multiplier := 1.2; v_segment := 1;
  ELSIF v_rand < 0.86 THEN v_multiplier := 0.5; v_segment := 2;
  ELSIF v_rand < 0.95 THEN v_multiplier := 2.0; v_segment := 3;
  ELSIF v_rand < 0.985 THEN v_multiplier := 5.0; v_segment := 4;
  ELSE v_multiplier := 10.0; v_segment := 5; END IF;

  v_payout := p_bet * v_multiplier;

  -- 1 in 10,000 server-side Progressive Jackpot win roll (0.0001)
  IF random() < 0.0001 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout FROM global_jackpot WHERE id = 1 FOR UPDATE;
    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN v_jackpot_payout := 2000; END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    UPDATE global_jackpot 
    SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        updated_at = NOW()
    WHERE id = 1
    RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;
  END IF;

  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'multiplier', v_multiplier, 
    'segment', v_segment, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.play_spinner(TEXT, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.play_spinner(TEXT, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: play_plinko
-- Source: update_jackpot_probability_to_1_in_10000.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.play_plinko(TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS play_plinko(TEXT, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION public.play_plinko(
  p_wallet TEXT, 
  p_bet NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_bucket INT := 0;
  v_multiplier NUMERIC;
  v_payout NUMERIC;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_step INT;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_bet <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  -- 8-row binomial Plinko simulation (50% left / 50% right)
  FOR v_step IN 1..8 LOOP
    IF random() >= 0.5 THEN
      v_bucket := v_bucket + 1;
    END IF;
  END LOOP;

  -- Bucket to Multiplier map (~95.8% RTP)
  CASE v_bucket
    WHEN 0 THEN v_multiplier := 16.0;
    WHEN 1 THEN v_multiplier := 3.0;
    WHEN 2 THEN v_multiplier := 1.3;
    WHEN 3 THEN v_multiplier := 0.7;
    WHEN 4 THEN v_multiplier := 0.2;
    WHEN 5 THEN v_multiplier := 0.7;
    WHEN 6 THEN v_multiplier := 1.3;
    WHEN 7 THEN v_multiplier := 3.0;
    WHEN 8 THEN v_multiplier := 16.0;
    ELSE v_multiplier := 0.2;
  END CASE;

  v_payout := ROUND(p_bet * v_multiplier, 2);

  -- 1 in 10,000 server-side Progressive Jackpot win roll (0.0001)
  IF random() < 0.0001 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout FROM global_jackpot WHERE id = 1 FOR UPDATE;
    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN v_jackpot_payout := 2000; END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    UPDATE global_jackpot 
    SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        updated_at = NOW()
    WHERE id = 1
    RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;
  END IF;

  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'bucket', v_bucket, 
    'multiplier', v_multiplier, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.play_plinko(TEXT, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.play_plinko(TEXT, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: play_crash
-- Source: harden_crash_house_edge_and_jackpot_rules.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.play_crash(TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS play_crash(TEXT, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION public.play_crash(
  p_wallet TEXT, 
  p_bet NUMERIC, 
  p_target NUMERIC
) RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_crash_point NUMERIC;
  v_won BOOLEAN := false;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
  v_instant_bust_chance NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_bet <= 0 OR p_target < 1.01 THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Invalid parameters'); 
  END IF;

  SELECT balance_pgt INTO v_balance FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  FOR UPDATE;

  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'User row not found'); 
  END IF;
  
  IF v_balance < p_bet THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); 
  END IF;

  -- --------------------------------------------------------------------------
  -- 1. CRASH POINT CALCULATION WITH LOW-MULTIPLIER HOUSE EDGE PENALTY
  -- --------------------------------------------------------------------------
  -- If player targets ultra-low multipliers (< 1.05x), bust chance is 8.0% (-7.08% EV)
  -- If player targets standard multipliers (>= 1.05x), bust chance is 4.0% (-3.84% EV)
  IF p_target < 1.05 THEN
    v_instant_bust_chance := 0.080; -- 8.0% instant crash at 1.00x
  ELSE
    v_instant_bust_chance := 0.040; -- 4.0% instant crash at 1.00x
  END IF;

  IF random() < v_instant_bust_chance THEN
    v_crash_point := 1.00;
  ELSE
    -- Inverse uniform crash distribution (RTP = 0.96) up to 100.00x
    v_crash_point := GREATEST(1.01, ROUND((0.96 / (1.0 - (random() * 0.9904)))::numeric, 2));
    IF v_crash_point > 100.0 THEN v_crash_point := 100.0; END IF;
  END IF;

  -- Win / loss determination
  IF v_crash_point >= p_target THEN
    v_won := true;
    v_payout := p_bet * p_target;
  ELSE
    v_won := false;
    v_payout := 0;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. PROGRESSIVE JACKPOT (1 in 10,000 roll)
  -- --------------------------------------------------------------------------
  -- Qualification Rule: Player must target >= 1.10x to be eligible to win.
  -- 1.01x grinders still feed the 1% contribution, but cannot win the pool.
  IF p_target >= 1.10 AND random() < 0.0001 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout 
    FROM global_jackpot WHERE id = 1 FOR UPDATE;

    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN 
      v_jackpot_payout := 2000; 
    END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    -- 1% of every wager fuels the jackpot pool
    UPDATE global_jackpot 
    SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        updated_at = NOW()
    WHERE id = 1
    RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3. BALANCE SETTLEMENT
  -- --------------------------------------------------------------------------
  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'won', v_won, 
    'crash_point', v_crash_point, 
    'target', p_target, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.play_crash(TEXT, NUMERIC, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.play_crash(TEXT, NUMERIC, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: compute_mines_multiplier
-- Source: mines_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.compute_mines_multiplier(INT, INT, NUMERIC);
DROP FUNCTION IF EXISTS public.compute_mines_multiplier(INT, INT);
DROP FUNCTION IF EXISTS compute_mines_multiplier(INT, INT, NUMERIC);
DROP FUNCTION IF EXISTS compute_mines_multiplier(INT, INT);
CREATE OR REPLACE FUNCTION compute_mines_multiplier(p_mines INT, p_step INT, p_rtp NUMERIC DEFAULT 0.94)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_mult NUMERIC := p_rtp;
  v_total_tiles NUMERIC := 25.0;
  v_safe_tiles NUMERIC := 25.0 - p_mines;
  i INT;
BEGIN
  IF p_step < 1 OR p_step > v_safe_tiles THEN
    RETURN 0;
  END IF;

  FOR i IN 0..(p_step - 1) LOOP
    v_mult := v_mult * ((v_total_tiles - i) / (v_safe_tiles - i));
  END LOOP;

  RETURN ROUND(v_mult, 2);
END;
$$;
GRANT EXECUTE ON FUNCTION compute_mines_multiplier(INT, INT, NUMERIC) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: start_mines_game
-- Source: mines_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_mines_game(TEXT, NUMERIC, INT);
DROP FUNCTION IF EXISTS start_mines_game(TEXT, NUMERIC, INT);
CREATE OR REPLACE FUNCTION start_mines_game(
  p_wallet TEXT,
  p_bet NUMERIC,
  p_mines INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_is_banned BOOLEAN;
  v_mines_count INT := GREATEST(1, LEAST(24, COALESCE(p_mines, 3)));
  v_mine_positions INT[] := '{}';
  v_pos INT;
  v_session_id BIGINT;
  v_next_mult NUMERIC;
  v_new_jackpot NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_bet < 10 THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum bet is 10 PGT'); END IF;
  IF p_bet > 5000 THEN RETURN jsonb_build_object('success', false, 'error', 'Maximum bet is 5,000 PGT'); END IF;

  -- Lock user row and check balance & ban status
  SELECT balance_pgt, COALESCE(is_banned, false) INTO v_balance, v_is_banned 
  FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_is_banned THEN RETURN jsonb_build_object('success', false, 'error', 'Account is suspended'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  -- Deduct bet upfront immediately
  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid);

  -- 1% of bet contributed to Global Progressive Jackpot
  UPDATE global_jackpot 
  SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      updated_at = NOW()
  WHERE id = 1
  RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;

  -- Expire any previous unclosed active sessions for this player
  UPDATE mines_sessions
  SET status = 'busted', updated_at = NOW()
  WHERE (LOWER(player_id) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(v_pid))
    AND status = 'active';

  -- Generate M distinct random mine coordinates (0..24)
  WHILE array_length(v_mine_positions, 1) IS NULL OR array_length(v_mine_positions, 1) < v_mines_count LOOP
    v_pos := FLOOR(random() * 25)::INT;
    IF NOT (v_mine_positions @> ARRAY[v_pos]) THEN
      v_mine_positions := array_append(v_mine_positions, v_pos);
    END IF;
  END LOOP;

  -- Calculate first step multiplier preview (94% RTP with 1,000x cap)
  v_next_mult := compute_mines_multiplier(v_mines_count, 1, 0.94);

  -- Create active session in DB
  INSERT INTO mines_sessions (
    player_id,
    wallet_address,
    bet_amount,
    mines_count,
    mine_positions,
    revealed_tiles,
    current_multiplier,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_pid,
    p_wallet,
    p_bet,
    v_mines_count,
    v_mine_positions,
    '{}',
    1.00,
    'active',
    NOW(),
    NOW()
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'mines_count', v_mines_count,
    'next_multiplier', v_next_mult,
    'jackpot_amount', v_new_jackpot
  );
END;
$$;
GRANT EXECUTE ON FUNCTION start_mines_game(TEXT, NUMERIC, INT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION start_mines_game(TEXT, NUMERIC, INT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: reveal_mines_tile
-- Source: mines_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reveal_mines_tile(TEXT, BIGINT, INT);
DROP FUNCTION IF EXISTS public.reveal_mines_tile(TEXT, UUID, INT);
DROP FUNCTION IF EXISTS reveal_mines_tile(TEXT, BIGINT, INT);
DROP FUNCTION IF EXISTS reveal_mines_tile(TEXT, UUID, INT);
CREATE OR REPLACE FUNCTION reveal_mines_tile(
  p_wallet TEXT,
  p_session_id BIGINT,
  p_tile_index INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_session RECORD;
  v_is_mine BOOLEAN;
  v_revealed_count INT;
  v_safe_total INT;
  v_current_mult NUMERIC;
  v_next_mult NUMERIC;
  v_all_cleared BOOLEAN := false;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_tile_index < 0 OR p_tile_index > 24 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tile index');
  END IF;

  -- Lock active session
  SELECT * INTO v_session 
  FROM mines_sessions 
  WHERE id = p_session_id 
    AND (LOWER(player_id) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(v_pid))
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active game session not found');
  END IF;

  -- Check if tile was already revealed
  IF v_session.revealed_tiles @> ARRAY[p_tile_index] THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tile already revealed');
  END IF;

  -- Check if tile is a mine
  v_is_mine := (v_session.mine_positions @> ARRAY[p_tile_index]);

  IF v_is_mine THEN
    -- MINE HIT: Round lost!
    UPDATE mines_sessions
    SET status = 'busted',
        payout = 0,
        revealed_tiles = array_append(revealed_tiles, p_tile_index),
        updated_at = NOW()
    WHERE id = p_session_id;

    -- Log Game Metrics (Wager lost, 0 payout)
    BEGIN
      PERFORM log_game_metric('Cyber Mines', v_session.bet_amount, 0, 1);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'mine',
      'tile_hit', p_tile_index,
      'all_mines', v_session.mine_positions,
      'payout', 0
    );
  ELSE
    -- SAFE GEM HIT!
    v_revealed_count := COALESCE(array_length(v_session.revealed_tiles, 1), 0) + 1;
    v_safe_total := 25 - v_session.mines_count;
    v_current_mult := compute_mines_multiplier(v_session.mines_count, v_revealed_count, 0.94);

    -- Check if all safe tiles found OR reached 1,000x max multiplier cap!
    IF v_revealed_count >= v_safe_total OR v_current_mult >= 1000.00 THEN
      v_all_cleared := true;
      v_current_mult := LEAST(v_current_mult, 1000.00);
      v_payout := ROUND(v_session.bet_amount * v_current_mult, 2);

      -- Settle win in users table
      UPDATE users
      SET balance_pgt = balance_pgt + v_payout, updated_at = NOW()
      WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid)
      RETURNING balance_pgt INTO v_new_balance;

      -- Mark session cashed out
      UPDATE mines_sessions
      SET status = 'cashed_out',
          payout = v_payout,
          current_multiplier = v_current_mult,
          revealed_tiles = array_append(revealed_tiles, p_tile_index),
          updated_at = NOW()
      WHERE id = p_session_id;

      -- Log Game Metrics
      BEGIN
        PERFORM log_game_metric('Cyber Mines', v_session.bet_amount, v_payout, 1);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      RETURN jsonb_build_object(
        'success', true,
        'status', 'gem',
        'tile', p_tile_index,
        'revealed_count', v_revealed_count,
        'current_multiplier', v_current_mult,
        'next_multiplier', v_current_mult,
        'all_cleared', true,
        'payout', v_payout,
        'new_balance', v_new_balance,
        'all_mines', v_session.mine_positions
      );
    ELSE
      -- Still more safe tiles remaining
      v_next_mult := compute_mines_multiplier(v_session.mines_count, v_revealed_count + 1, 0.94);

      UPDATE mines_sessions
      SET current_multiplier = v_current_mult,
          revealed_tiles = array_append(revealed_tiles, p_tile_index),
          updated_at = NOW()
      WHERE id = p_session_id;

      RETURN jsonb_build_object(
        'success', true,
        'status', 'gem',
        'tile', p_tile_index,
        'revealed_count', v_revealed_count,
        'current_multiplier', v_current_mult,
        'next_multiplier', v_next_mult,
        'all_cleared', false
      );
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION reveal_mines_tile(TEXT, BIGINT, INT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION reveal_mines_tile(TEXT, BIGINT, INT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: cashout_mines_game
-- Source: mines_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cashout_mines_game(TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.cashout_mines_game(TEXT, UUID);
DROP FUNCTION IF EXISTS cashout_mines_game(TEXT, BIGINT);
DROP FUNCTION IF EXISTS cashout_mines_game(TEXT, UUID);
CREATE OR REPLACE FUNCTION cashout_mines_game(
  p_wallet TEXT,
  p_session_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_session RECORD;
  v_multiplier NUMERIC;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- Lock active session
  SELECT * INTO v_session 
  FROM mines_sessions 
  WHERE id = p_session_id 
    AND (LOWER(player_id) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(v_pid))
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active game session not found');
  END IF;

  IF COALESCE(array_length(v_session.revealed_tiles, 1), 0) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must reveal at least 1 safe tile to cash out');
  END IF;

  -- Calculate payout based on verified current multiplier (capped at 1,000x)
  v_multiplier := LEAST(COALESCE(v_session.current_multiplier, 1.00), 1000.00);
  v_payout := ROUND(v_session.bet_amount * v_multiplier, 2);

  -- 1 in 25,000 server-side Progressive Jackpot win roll on cashout
  IF random() < 0.00004 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout 
    FROM global_jackpot WHERE id = 1 FOR UPDATE;
    
    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN 
      v_jackpot_payout := 2000; 
    END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    SELECT COALESCE(current_amount, amount, 2000) INTO v_new_jackpot 
    FROM global_jackpot WHERE id = 1;
  END IF;

  -- Credit payout to user balance
  UPDATE users
  SET balance_pgt = balance_pgt + v_payout, updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  -- Mark session as cashed out
  UPDATE mines_sessions
  SET status = 'cashed_out',
      payout = v_payout,
      current_multiplier = v_multiplier,
      updated_at = NOW()
  WHERE id = p_session_id;

  -- Log game metrics to game_metrics table for Admin Panel House Net Profit tracking
  BEGIN
    PERFORM log_game_metric('Cyber Mines', v_session.bet_amount, v_payout, 1);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'payout', v_payout,
    'multiplier', v_multiplier,
    'new_balance', v_new_balance,
    'all_mines', v_session.mine_positions,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout,
    'jackpot_amount', v_new_jackpot
  );
END;
$$;
GRANT EXECUTE ON FUNCTION cashout_mines_game(TEXT, BIGINT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION cashout_mines_game(TEXT, BIGINT) FROM anon;


-- ==============================================================================
-- 6. POLYSPACE FLEET OPERATIONS (MINING, MODULES & OUTPOSTS)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: claim_polyspace_expedition
-- Source: atomic_polyspace_expedition_claim.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_polyspace_expedition(TEXT);
DROP FUNCTION IF EXISTS public.claim_polyspace_expedition(TEXT, TEXT);
DROP FUNCTION IF EXISTS claim_polyspace_expedition(TEXT);
DROP FUNCTION IF EXISTS claim_polyspace_expedition(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.claim_polyspace_expedition(
  p_player_id TEXT,
  p_expedition_id TEXT DEFAULT 'ALL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_expeditions JSONB;
  v_remaining_expeditions JSONB := '[]'::jsonb;
  v_claimed_count INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_now_ms BIGINT;
  v_target_all BOOLEAN := false;
  v_exp JSONB;
  v_exp_id TEXT;
  v_exp_type TEXT;
  v_exp_name TEXT;
  v_exp_start BIGINT;
  v_exp_end BIGINT;
  
  -- Upgrades & Multipliers
  v_cargo_level INTEGER := 1;
  v_laser_level INTEGER := 1;
  v_warp_level INTEGER := 1;
  v_cargo_mult NUMERIC := 1.0;
  v_laser_mult NUMERIC := 1.0;
  v_variance NUMERIC;
  v_is_critical BOOLEAN := false;
  
  -- Single Expedition Rewards
  v_base_iron NUMERIC := 0;
  v_base_tit NUMERIC := 0;
  v_base_quant NUMERIC := 0;
  v_base_pgt NUMERIC := 0.5;
  v_item_iron NUMERIC := 0;
  v_item_tit NUMERIC := 0;
  v_item_quant NUMERIC := 0;
  v_item_pgt NUMERIC := 0;
  v_item_pgt_ore INTEGER := 0;
  v_pgt_ore_chance NUMERIC := 0.0;
  
  -- Aggregate Transaction Totals
  v_tot_iron NUMERIC := 0;
  v_tot_tit NUMERIC := 0;
  v_tot_quant NUMERIC := 0;
  v_tot_pgt_ore INTEGER := 0;
  v_tot_pgt NUMERIC := 0;
  v_final_pgt NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  
  -- Relic Drops
  v_relic_chance NUMERIC := 0.0;
  v_discovered_relic JSONB := NULL;
  v_relic_rand NUMERIC;
  v_relic_id TEXT;
  
  -- Mission Logs
  v_logs JSONB;
  v_new_log JSONB;
  v_last_exp_name TEXT := 'PolySpace Fleet';
  v_last_was_critical BOOLEAN := false;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- Convert server NOW() to millisecond epoch
  v_now_ms := (EXTRACT(EPOCH FROM v_now) * 1000)::bigint;

  -- 2. Pessimistic Row Lock (Serializes concurrent requests across multiple browser windows)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  -- 3. Security Checks
  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  -- 4. Inspect space_state
  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);

  IF jsonb_array_length(v_expeditions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active expeditions found');
  END IF;

  v_target_all := (p_expedition_id IS NULL OR UPPER(TRIM(p_expedition_id)) = 'ALL' OR TRIM(p_expedition_id) = '');

  -- Extract Ship Upgrades
  v_cargo_level := GREATEST(1, COALESCE((v_space_state->>'cargoLevel')::integer, 1));
  v_laser_level := GREATEST(1, COALESCE((v_space_state->>'laserLevel')::integer, 1));
  v_warp_level  := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));

  v_cargo_mult := 1.0 + ((v_cargo_level - 1) * 0.25);
  v_laser_mult := 1.0 + ((v_laser_level - 1) * 0.18);

  -- 5. Iterate & Process Eligible Expeditions
  FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions)
  LOOP
    v_exp_id   := v_exp->>'id';
    v_exp_type := LOWER(COALESCE(v_exp->>'type', 'asteroids'));
    v_exp_name := COALESCE(v_exp->>'name', 'Exploration Fleet');
    v_exp_end  := COALESCE((v_exp->>'endTime')::bigint, 0);

    -- Check if target matches
    IF (v_target_all OR v_exp_id = p_expedition_id) THEN
      v_exp_start := COALESCE((v_exp->>'startTime')::bigint, 0);

      -- Anti-Cheat: Validate Warp Drive level requirement for destination
      IF (v_exp_type = 'nebula' AND v_warp_level < 2) OR
         (v_exp_type = 'void' AND v_warp_level < 3) OR
         (v_exp_type = 'sector9' AND v_warp_level < 4) OR
         (v_exp_type = 'deepspace' AND v_warp_level < 5) OR
         (v_exp_type = 'odyssey' AND v_warp_level < 6) THEN
        -- Destination requires higher warp level than player has; discard illegitimate mission
        CONTINUE;
      END IF;

      -- Check if expedition is finished
      IF v_now_ms >= v_exp_end THEN
        -- Anti-Cheat: Validate minimum elapsed flight duration against forged timestamps (accounting for max warp boost)
        IF v_exp_start > 0 AND (v_now_ms - v_exp_start) < (
          CASE
            WHEN v_exp_type = 'asteroids' THEN 120000 -- 2 min min
            WHEN v_exp_type = 'nebula' THEN 1200000 -- 20 min min
            WHEN v_exp_type = 'void' THEN 4800000 -- 1.3 hr min
            WHEN v_exp_type = 'sector9' THEN 14400000 -- 4 hr min
            WHEN v_exp_type = 'deepspace' THEN 43200000 -- 12 hr min
            WHEN v_exp_type = 'odyssey' THEN 100800000 -- 28 hr min
            ELSE 120000
          END
        ) THEN
          -- Timestamp was backdated or forged; keep unfinished
          v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
          CONTINUE;
        END IF;

        -- Anti-Cheat: Cryptographic Server Signature Verification
        IF v_exp->>'serverSig' IS NOT NULL THEN
          -- Validate signature against both canonical player_id and linked_wallet_address
          IF v_exp->>'serverSig' <> MD5('poly_exp_' || v_pid || '_' || (v_exp->>'startTime') || '_' || (v_exp->>'endTime') || '_' || v_exp_type || '_pgt_secret_fleet_v1')
             AND (v_user.linked_wallet_address IS NULL OR v_exp->>'serverSig' <> MD5('poly_exp_' || LOWER(v_user.linked_wallet_address) || '_' || (v_exp->>'startTime') || '_' || (v_exp->>'endTime') || '_' || v_exp_type || '_pgt_secret_fleet_v1')) THEN
            -- Signature mismatch: Discard without incrementing bot warnings
            INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
            VALUES (v_pid, 'invalid_expedition_signature', 'PolySpace Fleet Sentinel', jsonb_build_object('exp_id', v_exp_id, 'details', 'Signature mismatch, skipped without penalty'), NOW());
            CONTINUE;
          END IF;
        ELSE
          -- Legacy / Non-signed: Must not be backdated beyond account creation
          IF v_exp_start < (EXTRACT(EPOCH FROM v_user.created_at) * 1000) THEN
            INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
            VALUES (v_pid, 'invalid_backdated_expedition', 'PolySpace Fleet Sentinel', jsonb_build_object('exp_id', v_exp_id, 'startTime', v_exp_start, 'now', v_now_ms), NOW());
            CONTINUE;
          END IF;
        END IF;

        -- Anti-Cheat: Cap maximum concurrent claims to user's fleet slot capacity (3 to 5)
        IF v_claimed_count >= LEAST(5, 3 + (v_warp_level / 10)) THEN
          CONTINUE;
        END IF;

        v_claimed_count := v_claimed_count + 1;
        v_last_exp_name := v_exp_name;

        -- Base Yields by Destination
        IF v_exp_type = 'asteroids' THEN
          v_base_iron := 40 * v_cargo_mult;
          v_base_tit := 0;
          v_base_quant := 0;
          v_base_pgt := 0.5;
          v_relic_chance := 0.008;
          v_pgt_ore_chance := 0.02;
        ELSIF v_exp_type = 'nebula' THEN
          v_base_iron := 110 * v_cargo_mult;
          v_base_tit := 35 * v_cargo_mult;
          v_base_quant := 0;
          v_base_pgt := 1.7;
          v_relic_chance := 0.016;
          v_pgt_ore_chance := 0.05;
        ELSIF v_exp_type = 'void' THEN
          v_base_iron := 240 * v_cargo_mult;
          v_base_tit := 80 * v_cargo_mult;
          v_base_quant := 20 * v_cargo_mult;
          v_base_pgt := 3.8;
          v_relic_chance := 0.024;
          v_pgt_ore_chance := 0.10;
        ELSIF v_exp_type = 'sector9' THEN
          v_base_iron := 550 * v_cargo_mult;
          v_base_tit := 180 * v_cargo_mult;
          v_base_quant := 45 * v_cargo_mult;
          v_base_pgt := 7.2;
          v_relic_chance := 0.036;
          v_pgt_ore_chance := 0.18;
        ELSIF v_exp_type = 'deepspace' THEN
          v_base_iron := 1100 * v_cargo_mult;
          v_base_tit := 380 * v_cargo_mult;
          v_base_quant := 100 * v_cargo_mult;
          v_base_pgt := 13.7;
          v_relic_chance := 0.056;
          v_pgt_ore_chance := 0.30;
        ELSIF v_exp_type = 'odyssey' THEN
          v_base_iron := 2200 * v_cargo_mult;
          v_base_tit := 850 * v_cargo_mult;
          v_base_quant := 250 * v_cargo_mult;
          v_base_pgt := 24.5;
          v_relic_chance := 0.080;
          v_pgt_ore_chance := 0.50;
        ELSE
          v_base_iron := 40 * v_cargo_mult;
          v_base_tit := 0;
          v_base_quant := 0;
          v_base_pgt := 0.5;
          v_relic_chance := 0.008;
          v_pgt_ore_chance := 0.02;
        END IF;

        -- Apply Laser Multiplier and ±20% Exploration Variance (0.80 to 1.20)
        v_variance := 0.80 + (random() * 0.40);
        v_item_pgt := ROUND((v_base_pgt * v_laser_mult * v_variance)::numeric, 2);
        v_item_iron := FLOOR(v_base_iron);
        v_item_tit := FLOOR(v_base_tit);
        v_item_quant := FLOOR(v_base_quant);
        v_item_pgt_ore := 0;

        -- 10% Critical Success Roll (3x Mega Payout)
        v_is_critical := (random() < 0.10);
        IF v_is_critical THEN
          v_item_iron := v_item_iron * 3;
          v_item_tit := v_item_tit * 3;
          v_item_quant := v_item_quant * 3;
          v_item_pgt := ROUND((v_item_pgt * 3.0)::numeric, 2);
          v_relic_chance := LEAST(1.0, v_relic_chance * 1.5);
          v_last_was_critical := true;
        END IF;

        -- Rare PGT Ore Roll (Requires Laser Level >= 35)
        IF v_laser_level >= 35 AND random() < v_pgt_ore_chance THEN
          v_item_pgt_ore := 1;
          IF (v_exp_type = 'deepspace' AND random() < 0.15) OR (v_exp_type = 'odyssey' AND random() < 0.30) THEN
            v_item_pgt_ore := 2;
          END IF;
          IF v_is_critical THEN
            v_item_pgt_ore := v_item_pgt_ore + 1;
          END IF;
        END IF;

        -- In-Game Quantum Relic Drop Roll
        IF random() < v_relic_chance THEN
          v_relic_rand := random();
          IF (v_exp_type IN ('odyssey', 'deepspace')) AND v_relic_rand < 0.10 THEN
            v_relic_id := CASE WHEN random() < 0.5 THEN 'relic_apex_singularity' ELSE 'relic_apex_genesis' END;
          ELSIF v_relic_rand < 0.20 THEN
            v_relic_id := 'relic_space_plasma';
          ELSIF v_relic_rand < 0.55 THEN
            v_relic_id := 'relic_space_warpcoil';
          ELSE
            v_relic_id := 'relic_space_darkmatter';
          END IF;

          -- Grant In-Game Relic via canonical procedure
          IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_relic_drop') THEN
            BEGIN
              PERFORM public.grant_relic_drop(v_user.player_id, v_relic_id, 1);
              v_discovered_relic := jsonb_build_object('id', v_relic_id, 'amount', 1);
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
        END IF;

        -- Accumulate Totals
        v_tot_iron := v_tot_iron + v_item_iron;
        v_tot_tit := v_tot_tit + v_item_tit;
        v_tot_quant := v_tot_quant + v_item_quant;
        v_tot_pgt_ore := v_tot_pgt_ore + v_item_pgt_ore;
        v_tot_pgt := v_tot_pgt + v_item_pgt;

        -- Create Mission Log Entry
        v_new_log := jsonb_build_object(
          'id', 'log_' || (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint || '_' || FLOOR(random() * 1000)::text,
          'name', v_exp_name,
          'time', to_char(v_now AT TIME ZONE 'UTC', 'HH24:MI UTC'),
          'timestamp', v_now_ms,
          'earnedIron', v_item_iron,
          'earnedTit', v_item_tit,
          'earnedQuant', v_item_quant,
          'earnedPgtOre', v_item_pgt_ore,
          'earnedPgt', v_item_pgt,
          'isCritical', v_is_critical
        );

        v_logs := COALESCE(v_space_state->'missionLogs', '[]'::jsonb);
        v_logs := jsonb_build_array(v_new_log) || v_logs;
        -- Keep last 20 logs
        IF jsonb_array_length(v_logs) > 20 THEN
          SELECT jsonb_agg(elem) INTO v_logs
          FROM (SELECT elem FROM jsonb_array_elements(v_logs) WITH ORDINALITY arr(elem, idx) WHERE idx <= 20) sub;
        END IF;
        v_space_state := jsonb_set(v_space_state, '{missionLogs}', v_logs);

      ELSE
        -- Single target was found but has not finished yet
        IF NOT v_target_all THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Expedition is still in progress',
            'remaining_seconds', GREATEST(0, (v_exp_end - v_now_ms) / 1000)
          );
        END IF;
        -- Keep unfinished expedition
        v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
      END IF;
    ELSE
      -- Keep non-matching expedition
      v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
    END IF;
  END LOOP;

  -- 6. Guard: Check if anything was claimed
  IF v_claimed_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Expedition already claimed or not found'
    );
  END IF;

  -- 7. High-Laser Multiplier Safety Cap: Generous 3,500 PGT ceiling per transaction
  v_final_pgt := ROUND(LEAST(3500.0, GREATEST(0.0, v_tot_pgt))::numeric, 2);

  -- 8. Mutate Space State
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_remaining_expeditions);
  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(COALESCE((v_space_state->>'iron')::numeric, 0) + v_tot_iron));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(COALESCE((v_space_state->>'titanium')::numeric, 0) + v_tot_tit));
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(COALESCE((v_space_state->>'quantum')::numeric, 0) + v_tot_quant));
  v_space_state := jsonb_set(v_space_state, '{pgtOre}', to_jsonb(COALESCE((v_space_state->>'pgtOre')::integer, 0) + v_tot_pgt_ore));
  v_space_state := jsonb_set(v_space_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_space_state->>'mineralsMinedTotal')::numeric, 0) + v_tot_iron + v_tot_tit + v_tot_quant + v_tot_pgt_ore));
  v_space_state := jsonb_set(v_space_state, '{pgtMinedTotal}', to_jsonb(ROUND((COALESCE((v_space_state->>'pgtMinedTotal')::numeric, 0) + v_final_pgt)::numeric, 2)));

  -- 9. Atomic Balance Mutation on Users Table
  UPDATE public.users
  SET balance_pgt = ROUND(COALESCE(balance_pgt, 0) + v_final_pgt, 2),
      total_earned = ROUND(COALESCE(total_earned, 0) + v_final_pgt, 2),
      space_state = v_space_state,
      updated_at = v_now
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- 10. Process 4-Tier Referral Commissions
  IF v_final_pgt > 0 THEN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
      BEGIN
        PERFORM public.process_referral_commissions(
          v_user.player_id,
          v_final_pgt,
          'PolySpace Fleet (' || v_claimed_count || ' Expedition' || (CASE WHEN v_claimed_count > 1 THEN 's' ELSE '' END) || ')'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- 11. Return Authoritative Response
  RETURN jsonb_build_object(
    'success', true,
    'claimed_count', v_claimed_count,
    'earned_iron', v_tot_iron,
    'earned_tit', v_tot_tit,
    'earned_quant', v_tot_quant,
    'earned_pgt_ore', v_tot_pgt_ore,
    'earned_pgt', v_final_pgt,
    'is_critical', v_last_was_critical,
    'discovered_relic', v_discovered_relic,
    'exp_name', v_last_exp_name,
    'new_balance', v_new_balance,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_polyspace_expedition(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: cancel_polyspace_expeditions
-- Source: add_cancel_polyspace_expeditions_rpc.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cancel_polyspace_expeditions(TEXT, TEXT);
DROP FUNCTION IF EXISTS cancel_polyspace_expeditions(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.cancel_polyspace_expeditions(
  p_player_id TEXT,
  p_expedition_id TEXT DEFAULT 'ALL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_expeditions JSONB;
  v_remaining_expeditions JSONB := '[]'::jsonb;
  v_cancelled_count INTEGER := 0;
  v_target_all BOOLEAN := false;
  v_exp JSONB;
  v_exp_id TEXT;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Pessimistic Row Lock (Prevents race conditions with active claims)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);

  IF jsonb_array_length(v_expeditions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active expeditions to cancel');
  END IF;

  v_target_all := (p_expedition_id IS NULL OR UPPER(TRIM(p_expedition_id)) = 'ALL' OR TRIM(p_expedition_id) = '');

  IF v_target_all THEN
    v_cancelled_count := jsonb_array_length(v_expeditions);
    v_remaining_expeditions := '[]'::jsonb;
  ELSE
    FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions)
    LOOP
      v_exp_id := v_exp->>'id';
      IF v_exp_id = p_expedition_id THEN
        v_cancelled_count := v_cancelled_count + 1;
      ELSE
        v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
      END IF;
    END LOOP;
  END IF;

  IF v_cancelled_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expedition not found or already ended');
  END IF;

  -- Update space_state: clears/filters expeditions, strictly leaves balances, minerals, and modules unchanged
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_remaining_expeditions);

  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_count', v_cancelled_count,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_polyspace_expeditions(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: upgrade_polyspace_module
-- Source: seal_polyspace_module_levels_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upgrade_polyspace_module(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.upgrade_polyspace_module(TEXT, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS upgrade_polyspace_module(TEXT, TEXT);
DROP FUNCTION IF EXISTS upgrade_polyspace_module(TEXT, NUMERIC, JSONB);
CREATE OR REPLACE FUNCTION public.upgrade_polyspace_module(
  p_player_id TEXT,
  p_module_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_part TEXT;
  v_lvl_key TEXT;
  v_cur_lvl INTEGER := 1;
  v_new_lvl INTEGER;
  v_cost_iron INTEGER;
  v_cost_tit INTEGER;
  v_cost_pgt NUMERIC;
  v_cur_iron NUMERIC;
  v_cur_tit NUMERIC;
  v_cur_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_warp INTEGER;
  v_laser INTEGER;
  v_cargo INTEGER;
  v_shield INTEGER;
  v_turret INTEGER;
  v_fleet_power INTEGER;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_part := LOWER(TRIM(COALESCE(p_module_type, '')));
  IF v_part NOT IN ('warp', 'laser', 'cargo', 'shield', 'turret') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid module type. Must be warp, laser, cargo, shield, or turret.');
  END IF;

  v_lvl_key := v_part || 'Level';

  -- 2. Acquire Pessimistic Row Lock (Serializes concurrent upgrades)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended');
  END IF;

  -- 3. Extract Current Module Level
  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_cur_lvl := GREATEST(1, COALESCE((v_space_state->>v_lvl_key)::integer, 1));

  IF v_cur_lvl >= 50 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Maximum Level 50 already reached for ' || UPPER(v_part));
  END IF;

  -- 4. Calculate Canonical Upgrade Costs:
  -- costIron = FLOOR(40 * 1.22^(lvl-1))
  -- costTit  = FLOOR(10 * 1.22^(lvl-1))
  -- costPgt  = FLOOR(50 * 1.22^(lvl-1))
  v_cost_iron := FLOOR(40 * POW(1.22, v_cur_lvl - 1));
  v_cost_tit  := FLOOR(10 * POW(1.22, v_cur_lvl - 1));
  v_cost_pgt  := FLOOR(50 * POW(1.22, v_cur_lvl - 1));

  v_cur_iron := COALESCE((v_space_state->>'iron')::numeric, 0);
  v_cur_tit  := COALESCE((v_space_state->>'titanium')::numeric, 0);
  v_cur_pgt  := COALESCE(v_user.balance_pgt, 0);

  -- 5. Strict Balance Verification
  IF v_cur_iron < v_cost_iron THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Insufficient Iron. Required: ' || v_cost_iron || ', Available: ' || FLOOR(v_cur_iron)
    );
  END IF;
  IF v_cur_tit < v_cost_tit THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Insufficient Titanium. Required: ' || v_cost_tit || ', Available: ' || FLOOR(v_cur_tit)
    );
  END IF;
  IF v_cur_pgt < v_cost_pgt THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Insufficient PGT balance. Required: ' || v_cost_pgt || ' PGT, Available: ' || ROUND(v_cur_pgt, 2) || ' PGT'
    );
  END IF;

  -- 6. Deduct Resources & Increment Level
  v_new_lvl := v_cur_lvl + 1;
  v_space_state := jsonb_set(v_space_state, ('{' || v_lvl_key || '}')::text[], to_jsonb(v_new_lvl));
  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(ROUND((v_cur_iron - v_cost_iron)::numeric, 2)));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(ROUND((v_cur_tit - v_cost_tit)::numeric, 2)));

  -- 7. Compute Accurate Fleet Power
  v_warp   := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));
  v_laser  := GREATEST(1, COALESCE((v_space_state->>'laserLevel')::integer, 1));
  v_cargo  := GREATEST(1, COALESCE((v_space_state->>'cargoLevel')::integer, 1));
  v_shield := GREATEST(1, COALESCE((v_space_state->>'shieldLevel')::integer, 1));
  v_turret := GREATEST(1, COALESCE((v_space_state->>'turretLevel')::integer, 1));

  v_fleet_power := (v_warp * 100) + (v_laser * 80) + (v_cargo * 50) + (v_shield * 60) + (v_turret * 90);
  v_space_state := jsonb_set(v_space_state, '{fleetPower}', to_jsonb(v_fleet_power));

  -- 8. Atomic Database Mutation
  UPDATE public.users
  SET balance_pgt = ROUND(COALESCE(balance_pgt, 0) - v_cost_pgt, 2),
      space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- 9. Return Response
  RETURN jsonb_build_object(
    'success', true,
    'module', v_part,
    'new_level', v_new_lvl,
    'cost_iron', v_cost_iron,
    'cost_tit', v_cost_tit,
    'cost_pgt', v_cost_pgt,
    'new_balance', v_new_balance,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upgrade_polyspace_module(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: smelt_space_ore
-- Source: seal_world_boss_and_minerals_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.smelt_space_ore(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS smelt_space_ore(TEXT, TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.smelt_space_ore(
  p_player_id TEXT,
  p_recipe TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_recipe TEXT;
  
  v_cur_iron NUMERIC := 0;
  v_cur_tit NUMERIC := 0;
  v_cur_quantum NUMERIC := 0;
  v_cur_pgt_ore NUMERIC := 0;
  
  v_cost_iron NUMERIC := 0;
  v_cost_tit NUMERIC := 0;
  v_cost_quantum NUMERIC := 0;
  
  v_gain_tit NUMERIC := 0;
  v_gain_quantum NUMERIC := 0;
  v_gain_pgt_ore NUMERIC := 0;
  
  v_recipe_name TEXT := '';
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_recipe := LOWER(TRIM(COALESCE(p_recipe, '')));

  -- 2. Validate Recipe Parameters
  IF v_recipe = 'quantum_10x' THEN
    v_cost_tit := 1000;
    v_gain_quantum := 300;
    v_recipe_name := '1,000 Titanium Ore ➔ +300 Quantum Ore';
  ELSIF v_recipe IN ('quantum_100x', 'quantum_10000') THEN
    v_cost_tit := 10000;
    v_gain_quantum := 3000;
    v_recipe_name := '10,000 Titanium Ore ➔ +3,000 Quantum Ore (10x Refinery)';
  ELSIF v_recipe = 'titanium_10x' THEN
    v_cost_iron := 1500;
    v_gain_tit := 400;
    v_recipe_name := '1,500 Iron Ore ➔ +400 Titanium Ore';
  ELSIF v_recipe IN ('titanium_100x', 'titanium_15000') THEN
    v_cost_iron := 15000;
    v_gain_tit := 4000;
    v_recipe_name := '15,000 Iron Ore ➔ +4,000 Titanium Ore (10x Refinery)';
  ELSIF v_recipe IN ('pgt_ore', 'pgtore', 'pgt_ore_bulk', 'pgtore_bulk') THEN
    v_cost_quantum := 5000;
    v_gain_pgt_ore := 2;
    v_recipe_name := '5,000 Quantum Crystals ➔ +2 Rare PGT Ore';
  ELSIF v_recipe = 'quantum' THEN
    v_cost_tit := 100;
    v_gain_quantum := 30;
    v_recipe_name := '100 Titanium Ore ➔ +30 Quantum Ore';
  ELSIF v_recipe = 'titanium' THEN
    v_cost_iron := 150;
    v_gain_tit := 40;
    v_recipe_name := '150 Iron Ore ➔ +40 Titanium Ore';
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Unknown refinery recipe: ' || p_recipe);
  END IF;

  -- 3. Row Locking
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player account not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_cur_iron     := COALESCE((v_space_state->>'iron')::NUMERIC, 0);
  v_cur_tit      := COALESCE((v_space_state->>'titanium')::NUMERIC, 0);
  v_cur_quantum  := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);
  v_cur_pgt_ore  := COALESCE((v_space_state->>'pgtOre')::NUMERIC, 0);

  -- 4. Verify Mineral Resources
  IF v_cost_iron > 0 AND v_cur_iron < v_cost_iron THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Requires ' || v_cost_iron::TEXT || ' Iron Ore! You have ' || FLOOR(v_cur_iron)::TEXT
    );
  END IF;

  IF v_cost_tit > 0 AND v_cur_tit < v_cost_tit THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Requires ' || v_cost_tit::TEXT || ' Titanium Ore! You have ' || FLOOR(v_cur_tit)::TEXT
    );
  END IF;

  IF v_cost_quantum > 0 AND v_cur_quantum < v_cost_quantum THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Requires ' || v_cost_quantum::TEXT || ' Quantum Crystals! You have ' || FLOOR(v_cur_quantum)::TEXT
    );
  END IF;

  -- 5. Deduct Inputs & Add Outputs
  v_cur_iron     := GREATEST(0, v_cur_iron - v_cost_iron);
  v_cur_tit      := GREATEST(0, v_cur_tit - v_cost_tit) + v_gain_tit;
  v_cur_quantum  := GREATEST(0, v_cur_quantum - v_cost_quantum) + v_gain_quantum;
  v_cur_pgt_ore  := v_cur_pgt_ore + v_gain_pgt_ore;

  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(v_cur_quantum));
  v_space_state := jsonb_set(v_space_state, '{pgtOre}', to_jsonb(v_cur_pgt_ore));

  -- 6. Update Database
  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'recipe', v_recipe,
    'recipe_name', v_recipe_name,
    'message', '🏭 REFINERY SMELTED: ' || v_recipe_name,
    'space_state', v_space_state,
    'new_iron', v_cur_iron,
    'new_titanium', v_cur_tit,
    'new_quantum', v_cur_quantum,
    'new_pgt_ore', v_cur_pgt_ore
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.smelt_space_ore(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: scan_polyspace_anomaly
-- Source: seal_world_boss_and_minerals_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.scan_polyspace_anomaly(TEXT);
DROP FUNCTION IF EXISTS scan_polyspace_anomaly(TEXT);
CREATE OR REPLACE FUNCTION public.scan_polyspace_anomaly(
  p_player_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_now_ms BIGINT;
  v_last_scan_ms BIGINT;
  v_cooldown_ms BIGINT := 21600000; -- 6 hours in milliseconds
  v_roll NUMERIC;
  v_reward_type TEXT;
  v_msg TEXT;
  v_cur_iron NUMERIC := 0;
  v_cur_tit NUMERIC := 0;
  v_cur_quant NUMERIC := 0;
  v_expeditions JSONB;
  v_has_active_exp BOOLEAN := false;
  v_exp JSONB;
  v_new_exps JSONB := '[]'::jsonb;
  v_remaining_ms BIGINT;
  v_hrs_left NUMERIC;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Row Locking
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player account not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_now_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_last_scan_ms := COALESCE((v_space_state->>'lastAnomalyScanTime')::BIGINT, 0);

  -- 3. Strict 6-Hour Cooldown Verification
  IF (v_now_ms - v_last_scan_ms) < v_cooldown_ms THEN
    v_hrs_left := ROUND(((v_cooldown_ms - (v_now_ms - v_last_scan_ms)) / 3600000.0)::NUMERIC, 1);
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Scanner recharging! Available in ' || v_hrs_left::TEXT || ' hours.'
    );
  END IF;

  v_cur_iron  := COALESCE((v_space_state->>'iron')::NUMERIC, 0);
  v_cur_tit   := COALESCE((v_space_state->>'titanium')::NUMERIC, 0);
  v_cur_quant := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);

  -- 4. Roll Deterministic Anomaly Outcome
  v_roll := random();

  IF v_roll < 0.35 THEN
    -- Check if player has active expeditions
    IF jsonb_array_length(v_expeditions) > 0 THEN
      FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions) LOOP
        v_remaining_ms := COALESCE((v_exp->>'endTime')::BIGINT, 0) - v_now_ms;
        IF v_remaining_ms > 0 THEN
          v_has_active_exp := true;
          v_exp := jsonb_set(v_exp, '{endTime}', to_jsonb(v_now_ms + ROUND(v_remaining_ms * 0.75)::BIGINT));
        END IF;
        v_new_exps := v_new_exps || jsonb_build_array(v_exp);
      END LOOP;
    END IF;

    IF v_has_active_exp THEN
      v_reward_type := 'wormhole';
      v_msg := '🌀 ANOMALY DISCOVERED: Temporal Wormhole! Active expedition timers cut by 25%!';
      v_space_state := jsonb_set(v_space_state, '{expeditions}', v_new_exps);
    ELSE
      v_reward_type := 'magnetic_surge';
      v_cur_iron := v_cur_iron + 80;
      v_msg := '🌀 ANOMALY DISCOVERED: Magnetic Field Surge! +80 Iron recovered!';
      v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    END IF;

  ELSIF v_roll < 0.65 THEN
    -- Ghost ship salvage
    v_reward_type := 'ghost_ship';
    v_cur_iron := v_cur_iron + 100;
    v_cur_tit := v_cur_tit + 40;
    v_cur_quant := v_cur_quant + 15;
    v_msg := '🛸 ANOMALY DISCOVERED: Derelict Ghost Ship Salvaged! +100 Iron, +40 Tit, & +15 Quant Ore!';
    v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
    v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(v_cur_quant));

  ELSE
    -- Cosmic Resource Shower
    v_reward_type := 'resource_shower';
    v_cur_iron := v_cur_iron + 140;
    v_cur_tit := v_cur_tit + 50;
    v_msg := '🌌 ANOMALY DISCOVERED: Cosmic Resource Shower! +140 Iron & +50 Titanium!';
    v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
  END IF;

  -- 5. Stamp Cooldown & Save State
  v_space_state := jsonb_set(v_space_state, '{lastAnomalyScanTime}', to_jsonb(v_now_ms));

  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'reward_type', v_reward_type,
    'message', v_msg,
    'space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.scan_polyspace_anomaly(TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: poke_allied_outpost
-- Source: emergency_patch_drop_credit_arcade_payout_and_ban_nower.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.poke_allied_outpost(TEXT, TEXT);
DROP FUNCTION IF EXISTS poke_allied_outpost(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.poke_allied_outpost(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_warp_level INTEGER;
  v_bonus_iron INTEGER;
  v_bonus_pgt NUMERIC := 20.00;
  v_new_balance NUMERIC;
  v_state JSONB;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Enforce 1/day UTC cooldown
  IF (v_state->>'lastPokeDate') IS NOT NULL AND (v_state->>'lastPokeDate') >= v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Allied Outpost already poked today (1/day limit)! Resets at midnight UTC.');
  END IF;

  -- Clamp warp level strictly between 1 and 50 (prevents memory-injected levels like 999)
  v_warp_level := LEAST(GREATEST(1, COALESCE((v_state->>'warpLevel')::integer, 1)), 50);
  v_bonus_iron := 20 * v_warp_level;

  -- Update space state minerals and cooldown
  v_state := jsonb_set(v_state, '{lastPokeDate}', to_jsonb(v_today_str));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(COALESCE((v_state->>'iron')::numeric, 0) + v_bonus_iron));
  v_state := jsonb_set(v_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_state->>'mineralsMinedTotal')::numeric, 0) + v_bonus_iron));
  v_state := jsonb_set(v_state, '{pgtMinedTotal}', to_jsonb(ROUND(COALESCE((v_state->>'pgtMinedTotal')::numeric, 0) + v_bonus_pgt, 2)));

  -- Atomically credit PGT balance and update state
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_bonus_pgt,
      total_earned = COALESCE(total_earned, 0) + v_bonus_pgt,
      space_state = v_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- Process referral commissions (20 PGT base)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_bonus_pgt, 'PolySpace Outpost Poke');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_iron', v_bonus_iron,
    'bonus_pgt', v_bonus_pgt,
    'new_balance', v_new_balance,
    'space_state', v_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.poke_allied_outpost(TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: launch_outpost_raid
-- Source: emergency_patch_drop_credit_arcade_payout_and_ban_nower.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.launch_outpost_raid(TEXT, TEXT);
DROP FUNCTION IF EXISTS launch_outpost_raid(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.launch_outpost_raid(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_fleet_power INTEGER;
  v_enemy_power INTEGER;
  v_iron NUMERIC;
  v_stolen_pgt NUMERIC;
  v_stolen_iron INTEGER;
  v_stolen_titanium INTEGER;
  v_new_balance NUMERIC;
  v_state JSONB;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Enforce 1/day UTC cooldown
  IF (v_state->>'lastRaidDate') IS NOT NULL AND (v_state->>'lastRaidDate') >= v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Outpost Raid already launched today (1/day limit)! Resets at midnight UTC.');
  END IF;

  -- Require 15 Iron fuel
  v_iron := COALESCE((v_state->>'iron')::numeric, 0);
  IF v_iron < 15 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raid requires 15 Iron for Fuel!');
  END IF;

  v_fleet_power := COALESCE((v_state->>'fleetPower')::integer, 50);
  v_enemy_power := FLOOR(80 + RANDOM() * (v_fleet_power * 1.2));

  -- Deduct iron fuel and set raid date
  v_state := jsonb_set(v_state, '{lastRaidDate}', to_jsonb(v_today_str));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(v_iron - 15));

  IF v_fleet_power < v_enemy_power THEN
    -- Defeat: record updated state with cooldown and fuel consumed
    UPDATE public.users SET space_state = v_state, updated_at = NOW() WHERE player_id = v_user.player_id;
    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'enemy_power', v_enemy_power,
      'fleet_power', v_fleet_power,
      'message', format('Raid Defeated! Enemy Outpost defense (%s Power) was too strong.', v_enemy_power),
      'space_state', v_state
    );
  END IF;

  -- Victory: calculate reward securely server-side (16 to 24 PGT)
  v_stolen_pgt := ROUND((16.0 + RANDOM() * 8.0)::numeric, 2);
  v_stolen_iron := FLOOR(25 + RANDOM() * 25);
  v_stolen_titanium := FLOOR(5 + RANDOM() * 5);

  v_state := jsonb_set(v_state, '{raidsWon}', to_jsonb(COALESCE((v_state->>'raidsWon')::integer, 0) + 1));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(COALESCE((v_state->>'iron')::numeric, 0) + v_stolen_iron));
  v_state := jsonb_set(v_state, '{titanium}', to_jsonb(COALESCE((v_state->>'titanium')::numeric, 0) + v_stolen_titanium));
  v_state := jsonb_set(v_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_state->>'mineralsMinedTotal')::numeric, 0) + v_stolen_iron + v_stolen_titanium));
  v_state := jsonb_set(v_state, '{pgtMinedTotal}', to_jsonb(ROUND(COALESCE((v_state->>'pgtMinedTotal')::numeric, 0) + v_stolen_pgt, 2)));

  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_stolen_pgt,
      total_earned = COALESCE(total_earned, 0) + v_stolen_pgt,
      space_state = v_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_stolen_pgt, 'PolySpace Outpost Raid');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'victory', true,
    'enemy_power', v_enemy_power,
    'fleet_power', v_fleet_power,
    'stolen_pgt', v_stolen_pgt,
    'stolen_iron', v_stolen_iron,
    'stolen_titanium', v_stolen_titanium,
    'new_balance', v_new_balance,
    'space_state', v_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.launch_outpost_raid(TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: start_polyspace_expedition
-- Source: fix_polyspace_expedition_launch_rpc.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_polyspace_expedition(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.start_polyspace_expedition(TEXT, TEXT);
DROP FUNCTION IF EXISTS start_polyspace_expedition(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS start_polyspace_expedition(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.start_polyspace_expedition(
  p_player_id TEXT,
  p_destination TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_expeditions JSONB := '[]'::jsonb;
  v_warp_level INTEGER := 1;
  v_max_slots INTEGER := 3;
  v_active_count INTEGER := 0;
  v_available_slots INTEGER := 0;
  v_launch_count INTEGER := 1;
  v_base_duration_ms BIGINT;
  v_duration_ms BIGINT;
  v_dest_name TEXT;
  v_start_ms BIGINT;
  v_end_ms BIGINT;
  v_new_exp JSONB;
  v_guard RECORD;
  i INTEGER;
BEGIN
  -- 1. Caller authentication & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Row Lock & Load User Profile
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_warp_level := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));
  v_max_slots := LEAST(5, 3 + (v_warp_level / 10));

  -- 3. Validate Destination & Warp Level Requirements
  IF LOWER(p_destination) = 'asteroids' THEN
    v_dest_name := 'Alpha Asteroid Belt';
    v_base_duration_ms := 900000; -- 15 mins (15 * 60 * 1000)
  ELSIF LOWER(p_destination) = 'nebula' THEN
    IF v_warp_level < 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Neon Nebula requires Warp Drive Level 2!');
    END IF;
    v_dest_name := 'Neon Nebula';
    v_base_duration_ms := 7200000; -- 2 hours (2 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'void' THEN
    IF v_warp_level < 3 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Deep Void Exoplanet requires Warp Drive Level 3!');
    END IF;
    v_dest_name := 'Deep Void Exoplanet';
    v_base_duration_ms := 28800000; -- 8 hours (8 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'sector9' THEN
    IF v_warp_level < 4 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Deep Space Sector 9 requires Warp Drive Level 4!');
    END IF;
    v_dest_name := 'Deep Space Sector 9';
    v_base_duration_ms := 86400000; -- 24 hours (24 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'deepspace' THEN
    IF v_warp_level < 5 THEN
      RETURN jsonb_build_object('success', false, 'error', '3-Day Deep-Space Expedition requires Warp Drive Level 5!');
    END IF;
    v_dest_name := '3-Day Deep-Space Expedition';
    v_base_duration_ms := 259200000; -- 72 hours (72 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'odyssey' THEN
    IF v_warp_level < 6 THEN
      RETURN jsonb_build_object('success', false, 'error', '7-Day Deep-Space Odyssey requires Warp Drive Level 6!');
    END IF;
    v_dest_name := '7-Day Deep-Space Odyssey';
    v_base_duration_ms := 604800000; -- 7 days (7 * 24 * 3600 * 1000)
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unknown expedition destination: ' || COALESCE(p_destination, 'NULL'));
  END IF;

  -- 4. Slot Capacity Check
  IF v_space_state->'expeditions' IS NOT NULL AND jsonb_typeof(v_space_state->'expeditions') = 'array' THEN
    v_expeditions := v_space_state->'expeditions';
    v_active_count := jsonb_array_length(v_expeditions);
  ELSE
    v_expeditions := '[]'::jsonb;
    v_active_count := 0;
  END IF;

  v_available_slots := GREATEST(0, v_max_slots - v_active_count);
  IF v_available_slots <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'All ' || v_max_slots || ' Fleet Slots are currently in use! Wait for an expedition to finish.');
  END IF;

  -- Clamp requested launch count strictly between 1 and available slots
  v_launch_count := LEAST(GREATEST(1, COALESCE(p_count, 1)), v_available_slots);

  -- 5. Calculate Server Duration with Warp Drive Speed Boost Reduction (+5% speed per level)
  v_duration_ms := ROUND(v_base_duration_ms / (1.0 + ((v_warp_level - 1) * 0.05)))::BIGINT;
  v_start_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_end_ms := v_start_ms + v_duration_ms;

  -- 6. Generate and Append Expedition Objects
  FOR i IN 0..(v_launch_count - 1) LOOP
    v_new_exp := jsonb_build_object(
      'id', 'exp_' || (v_start_ms + i) || '_' || SUBSTRING(MD5(RANDOM()::TEXT || i::TEXT) FROM 1 FOR 5),
      'type', LOWER(p_destination),
      'name', v_dest_name || CASE WHEN v_launch_count > 1 THEN ' #' || (i + 1) ELSE '' END,
      'startTime', v_start_ms,
      'endTime', v_end_ms,
      'serverSig', MD5('poly_exp_' || v_pid || '_' || v_start_ms || '_' || v_end_ms || '_' || LOWER(p_destination) || '_pgt_secret_fleet_v1')
    );
    v_expeditions := v_expeditions || jsonb_build_array(v_new_exp);
  END LOOP;

  -- 7. Persist to Database
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_expeditions);

  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'space_state', v_space_state,
    'launched_count', v_launch_count,
    'destination', v_dest_name,
    'duration_ms', v_duration_ms,
    'end_time', v_end_ms
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_polyspace_expedition(TEXT, TEXT, INTEGER) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: save_polyspace_state (SEALED AGAINST EXPEDITION & MINERAL INJECTION)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_polyspace_state(TEXT, JSONB);
DROP FUNCTION IF EXISTS save_polyspace_state(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.save_polyspace_state(
  p_player_id TEXT,
  p_space_state JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_current_state JSONB;
  v_merged_state JSONB;
  v_guard RECORD;
BEGIN
  -- 1. Caller authentication & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_space_state IS NULL OR jsonb_typeof(p_space_state) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid space_state object.');
  END IF;

  -- 2. Lock & Load User Profile
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
  END IF;

  v_current_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Anti-tamper probe detection: if caller attempts to wipe or backdate server cooldowns
  IF v_current_state->>'lastPokeDate' IS NOT NULL AND 
     (p_space_state->>'lastPokeDate' IS NULL OR p_space_state->>'lastPokeDate' < v_current_state->>'lastPokeDate') THEN
    PERFORM public.record_bot_warning(
      v_pid,
      'cooldown_wipe_attempt',
      'PolySpace Fleet Sentinel',
      jsonb_build_object('field', 'lastPokeDate', 'attempted', p_space_state->>'lastPokeDate')
    );
  END IF;

  v_merged_state := v_current_state || p_space_state;

  -- CRITICAL ANTI-CHEAT: Never allow client to overwrite or inject expeditions!
  -- Expeditions must strictly be managed via start_polyspace_expedition & claim_polyspace_expedition
  v_merged_state := jsonb_set(v_merged_state, '{expeditions}', COALESCE(v_current_state->'expeditions', '[]'::jsonb));

  -- CRITICAL COOLDOWN PRESERVATION: Client can NEVER wipe, modify, or roll back server daily cooldowns!
  IF v_current_state->>'lastPokeDate' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastPokeDate}', to_jsonb(v_current_state->>'lastPokeDate'));
  ELSE
    v_merged_state := v_merged_state - 'lastPokeDate';
  END IF;

  IF v_current_state->>'lastRaidDate' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastRaidDate}', to_jsonb(v_current_state->>'lastRaidDate'));
  ELSE
    v_merged_state := v_merged_state - 'lastRaidDate';
  END IF;

  IF v_current_state->>'lastAnomalyScanTime' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastAnomalyScanTime}', to_jsonb((v_current_state->>'lastAnomalyScanTime')::bigint));
  END IF;

  IF v_current_state->>'lastOpDate' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastOpDate}', to_jsonb(v_current_state->>'lastOpDate'));
  ELSE
    v_merged_state := v_merged_state - 'lastOpDate';
  END IF;

  v_merged_state := jsonb_set(v_merged_state, '{raidsWon}', to_jsonb(COALESCE((v_current_state->>'raidsWon')::integer, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_current_state->>'mineralsMinedTotal')::numeric, 0)));

  -- Anti-tamper clamps: Module levels cannot increase without upgrade_polyspace_module RPC
  v_merged_state := jsonb_set(v_merged_state, '{warpLevel}', to_jsonb(COALESCE((v_current_state->>'warpLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{laserLevel}', to_jsonb(COALESCE((v_current_state->>'laserLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{cargoLevel}', to_jsonb(COALESCE((v_current_state->>'cargoLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{shieldLevel}', to_jsonb(COALESCE((v_current_state->>'shieldLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{turretLevel}', to_jsonb(COALESCE((v_current_state->>'turretLevel')::integer, 1)));

  -- Space Minerals cannot increase without server claims
  v_merged_state := jsonb_set(v_merged_state, '{iron}', to_jsonb(LEAST(COALESCE((v_merged_state->>'iron')::numeric, 0), COALESCE((v_current_state->>'iron')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{titanium}', to_jsonb(LEAST(COALESCE((v_merged_state->>'titanium')::numeric, 0), COALESCE((v_current_state->>'titanium')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{quantum}', to_jsonb(LEAST(COALESCE((v_merged_state->>'quantum')::numeric, 0), COALESCE((v_current_state->>'quantum')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{pgtOre}', to_jsonb(LEAST(COALESCE((v_merged_state->>'pgtOre')::numeric, 0), COALESCE((v_current_state->>'pgtOre')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{pgtMinedTotal}', to_jsonb(COALESCE((v_current_state->>'pgtMinedTotal')::numeric, 0)));

  -- Fleet Power recalculation
  v_merged_state := jsonb_set(
    v_merged_state,
    '{fleetPower}',
    to_jsonb(
      (GREATEST(1, COALESCE((v_merged_state->>'warpLevel')::integer, 1)) * 100) +
      (GREATEST(1, COALESCE((v_merged_state->>'laserLevel')::integer, 1)) * 80) +
      (GREATEST(1, COALESCE((v_merged_state->>'cargoLevel')::integer, 1)) * 50) +
      (GREATEST(1, COALESCE((v_merged_state->>'shieldLevel')::integer, 1)) * 60) +
      (GREATEST(1, COALESCE((v_merged_state->>'turretLevel')::integer, 1)) * 90)
    )
  );

  UPDATE public.users
  SET space_state = v_merged_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object('success', true, 'space_state', v_merged_state);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_polyspace_state(TEXT, JSONB) TO authenticated, service_role, anon;

-- ==============================================================================

-- 7. VAULT STAKING POSITIONS (PGT)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: get_user_stakes
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_stakes(TEXT);
DROP FUNCTION IF EXISTS get_user_stakes(TEXT);

CREATE OR REPLACE FUNCTION get_user_stakes(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_stakes JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(s)) INTO v_stakes
  FROM (
    SELECT id, pool, amount, tier, apy,
           (EXTRACT(EPOCH FROM staked_at) * 1000) as "stakedAt",
           (EXTRACT(EPOCH FROM lock_until) * 1000) as "lockUntil",
           (EXTRACT(EPOCH FROM last_harvest) * 1000) as "lastHarvest",
           active
    FROM user_stakes
    WHERE (LOWER(wallet_address) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(p_wallet))
      AND active = true
  ) s;

  RETURN jsonb_build_object('success', true, 'stakes', COALESCE(v_stakes, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION get_user_stakes(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: deposit_stake
-- Source: seal_referral_staking_and_nft_pol_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.deposit_stake(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT);
DROP FUNCTION IF EXISTS deposit_stake(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT);

CREATE OR REPLACE FUNCTION public.deposit_stake(
  p_wallet TEXT,
  p_pool TEXT,
  p_amount NUMERIC,
  p_tier TEXT DEFAULT 'day',
  p_apy NUMERIC DEFAULT NULL,
  p_duration_ms BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_balance NUMERIC;
  v_pool TEXT := LOWER(TRIM(COALESCE(p_pool, 'pgt')));
  v_tier TEXT := LOWER(TRIM(COALESCE(p_tier, 'day')));
  v_base_apy NUMERIC;
  v_lock_interval INTERVAL;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_nft_boost NUMERIC := 1.0;
  v_all_nfts JSONB;
  v_final_apy NUMERIC;
  v_now TIMESTAMPTZ := NOW();
  v_lock_until TIMESTAMPTZ;
  v_stake_id UUID;
  v_active_stakes_count INTEGER := 0;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid deposit amount');
  END IF;

  -- Lock user row
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User account not found');
  END IF;

  -- Check maximum active stakes (cap at 25)
  SELECT COUNT(*) INTO v_active_stakes_count
  FROM public.user_stakes
  WHERE (LOWER(wallet_address) = LOWER(v_user.player_id) 
         OR LOWER(wallet_address) = LOWER(COALESCE(v_user.linked_wallet_address, ''))
         OR LOWER(wallet_address) = LOWER(p_wallet))
    AND active = true;

  IF v_active_stakes_count >= 25 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum limit of 25 active stakes reached');
  END IF;

  -- Check token balance (PGT Staking)
  IF v_pool = 'pgt' THEN
    v_balance := COALESCE(v_user.balance_pgt, 0);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid pool: Only PGT staking is supported');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT token balance');
  END IF;

  -- Authoritative Base APY and Lock Duration (ignores client parameters)
  IF v_tier = 'year' THEN
    v_base_apy := 3.0;
    v_lock_interval := INTERVAL '365 days';
  ELSIF v_tier = 'month' THEN
    v_base_apy := 2.0;
    v_lock_interval := INTERVAL '30 days';
  ELSE
    v_tier := 'day';
    v_base_apy := 1.0;
    v_lock_interval := INTERVAL '1 day';
  END IF;

  -- VIP Boost (2.0x)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  -- Ambassador Boost (1.10x)
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 1.10;
  END IF;

  -- NFT Staking Boosts (Calculated authoritatively from owned_nfts & crate_nfts)
  -- Supports active catalog string arrays ('["..."]') and legacy object arrays ('[{"id":"..."}]')
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);

  -- 1. Epic Yield (+5% APY -> 1.05x)
  IF (v_all_nfts ? 'nft_epic_yield')
     OR (v_all_nfts @> '[{"id":"nft_epic_yield"}]'::jsonb)
     OR (v_all_nfts @> '["nft_epic_yield"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 1.05;
  END IF;

  -- 2. Yield Vault Common (+15% APY -> 1.15x)
  IF (v_all_nfts ? 'nft_yield_vault')
     OR (v_all_nfts @> '[{"id":"nft_yield_vault"}]'::jsonb)
     OR (v_all_nfts @> '["nft_yield_vault"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 1.15;
  END IF;

  -- 3. Yield Vault Rare (+50% APY -> 1.50x)
  IF (v_all_nfts ? 'nft_yield_vault_rare')
     OR (v_all_nfts @> '[{"id":"nft_yield_vault_rare"}]'::jsonb)
     OR (v_all_nfts @> '["nft_yield_vault_rare"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 1.50;
  END IF;

  -- 4. Yield Vault Epic (+100% APY -> 2.00x)
  IF (v_all_nfts ? 'nft_yield_vault_epic')
     OR (v_all_nfts @> '[{"id":"nft_yield_vault_epic"}]'::jsonb)
     OR (v_all_nfts @> '["nft_yield_vault_epic"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 2.00;
  END IF;

  -- Calculate final authoritative APY (clamped to max 50.0% APY ceiling)
  v_final_apy := ROUND(LEAST(50.0, v_base_apy * v_vip_mult * v_amb_mult * v_nft_boost), 4);
  v_lock_until := v_now + v_lock_interval;

  -- Deduct balance
  UPDATE public.users
  SET balance_pgt = balance_pgt - p_amount,
      staked_balance_pgt = COALESCE(staked_balance_pgt, 0) + p_amount,
      updated_at = v_now
  WHERE player_id = v_user.player_id;

  -- Insert authoritative record into user_stakes
  INSERT INTO public.user_stakes (wallet_address, pool, amount, tier, apy, staked_at, lock_until, last_harvest, active)
  VALUES (v_user.player_id, 'pgt', p_amount, v_tier, v_final_apy, v_now, v_lock_until, v_now, true)
  RETURNING id INTO v_stake_id;

  RETURN jsonb_build_object(
    'success', true,
    'stake_id', v_stake_id,
    'amount', p_amount,
    'pool', 'pgt',
    'tier', v_tier,
    'apy', v_final_apy,
    'lock_until', v_lock_until,
    'new_balance', v_balance - p_amount
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: unstake_position
-- Source: seal_referral_staking_and_nft_pol_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.unstake_position(TEXT, UUID);
DROP FUNCTION IF EXISTS unstake_position(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.unstake_position(
  p_wallet TEXT,
  p_stake_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_reward NUMERIC := 0;
  v_total_return NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_elapsed_seconds NUMERIC;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT * INTO v_stake
  FROM public.user_stakes
  WHERE id = p_stake_id
  FOR UPDATE;

  IF NOT FOUND OR v_stake.active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stake position not active or not found');
  END IF;

  -- 1. STRICT CALLER OWNERSHIP CHECK
  IF LOWER(v_stake.wallet_address) <> LOWER(v_user.player_id)
     AND (v_user.linked_wallet_address IS NULL OR LOWER(v_stake.wallet_address) <> LOWER(v_user.linked_wallet_address))
     AND LOWER(v_stake.wallet_address) <> LOWER(p_wallet) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not own this stake position');
  END IF;

  -- 2. STRICT LOCK EXPIRATION CHECK
  IF v_now < v_stake.lock_until THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Stake position is still locked',
      'lock_until', v_stake.lock_until,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_stake.lock_until - v_now))::INTEGER
    );
  END IF;

  -- 3. Yield calculation from last_harvest
  v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stake.last_harvest, v_stake.staked_at)));
  v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
  IF v_reward < 0 THEN v_reward := 0; END IF;
  v_total_return := v_stake.amount + v_reward;

  -- 4. Mark stake inactive
  UPDATE public.user_stakes
  SET active = false,
      last_harvest = v_now
  WHERE id = p_stake_id;

  -- 5. Credit return & yield to user balance
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_return,
      staked_balance_pgt = GREATEST(0, COALESCE(staked_balance_pgt, 0) - v_stake.amount),
      total_staking_yield = COALESCE(total_staking_yield, 0) + v_reward,
      updated_at = v_now
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- Process referral commissions internally on yield if reward > 0
  IF v_reward > 0 THEN
    PERFORM public.process_referral_commissions(v_user.player_id, v_reward, 'Staking Yield');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'stake_id', p_stake_id,
    'principal', v_stake.amount,
    'reward', v_reward,
    'yield', v_reward,
    'payback', v_total_return,
    'total_return', v_total_return,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.unstake_position(TEXT, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unstake_position(TEXT, UUID) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: unstake_all
-- Source: patch_arcade_session_overload_and_unstake_all.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.unstake_all(TEXT);
DROP FUNCTION IF EXISTS public.unstake_all(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.unstake_all(TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.unstake_all(
  p_wallet TEXT,
  p_pool TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_count INTEGER := 0;
  v_total_payout_pgt NUMERIC := 0;
  v_total_yield_pgt NUMERIC := 0;
  v_total_staked_deduct_pgt NUMERIC := 0;
  v_reward NUMERIC;
  v_elapsed_seconds NUMERIC;
  v_clean_pool TEXT := LOWER(TRIM(COALESCE(p_pool, '')));
  v_new_balance NUMERIC := 0;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User account not found');
  END IF;

  -- STRICT GUARD: Only select stakes that have NO TIME LEFT (lock_until <= v_now)
  FOR v_stake IN
    SELECT * FROM public.user_stakes
    WHERE (LOWER(wallet_address) = LOWER(v_user.player_id)
           OR LOWER(wallet_address) = LOWER(COALESCE(v_user.linked_wallet_address, ''))
           OR LOWER(wallet_address) = LOWER(p_wallet))
      AND active = true
      AND (v_clean_pool = '' OR LOWER(pool) = v_clean_pool)
      AND lock_until <= v_now
    FOR UPDATE
  LOOP
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stake.last_harvest, v_stake.staked_at)));
    v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
    IF v_reward < 0 THEN v_reward := 0; END IF;

    v_count := v_count + 1;

    v_total_payout_pgt := v_total_payout_pgt + v_stake.amount + v_reward;
    v_total_yield_pgt := v_total_yield_pgt + v_reward;
    v_total_staked_deduct_pgt := v_total_staked_deduct_pgt + v_stake.amount;

    UPDATE public.user_stakes
    SET active = false,
        last_harvest = v_now
    WHERE id = v_stake.id;
  END LOOP;

  IF v_count > 0 THEN
    UPDATE public.users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_payout_pgt,
        staked_balance_pgt = GREATEST(0, COALESCE(staked_balance_pgt, 0) - v_total_staked_deduct_pgt),
        total_staking_yield = COALESCE(total_staking_yield, 0) + v_total_yield_pgt,
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING balance_pgt INTO v_new_balance;

    IF v_total_yield_pgt > 0 THEN
      PERFORM public.process_referral_commissions(v_user.player_id, v_total_yield_pgt, 'Staking Yield');
    END IF;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'unstaked_count', v_count,
    'total_payout', v_total_payout_pgt,
    'payback', v_total_payout_pgt,
    'total_yield', v_total_yield_pgt,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unstake_all(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unstake_all(TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: unstake_all_matured (Backward-compatible delegate)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.unstake_all_matured(TEXT);
DROP FUNCTION IF EXISTS public.unstake_all_matured(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.unstake_all_matured(
  p_wallet TEXT,
  p_pool TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN public.unstake_all(p_wallet, p_pool);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unstake_all_matured(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unstake_all_matured(TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: harvest_yield
-- Source: seal_referral_staking_and_nft_pol_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.harvest_yield(TEXT, UUID);
DROP FUNCTION IF EXISTS harvest_yield(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.harvest_yield(
  p_wallet TEXT,
  p_stake_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_reward NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_elapsed_seconds NUMERIC;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT * INTO v_stake
  FROM public.user_stakes
  WHERE id = p_stake_id
  FOR UPDATE;

  IF NOT FOUND OR v_stake.active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stake position not active or not found');
  END IF;

  -- STRICT CALLER OWNERSHIP CHECK
  IF LOWER(v_stake.wallet_address) <> LOWER(v_user.player_id)
     AND (v_user.linked_wallet_address IS NULL OR LOWER(v_stake.wallet_address) <> LOWER(v_user.linked_wallet_address))
     AND LOWER(v_stake.wallet_address) <> LOWER(p_wallet) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not own this stake position');
  END IF;

  -- Yield calculation from last_harvest
  v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stake.last_harvest, v_stake.staked_at)));
  v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
  IF v_reward < 0 THEN v_reward := 0; END IF;

  IF v_reward <= 0.0001 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No substantial yield accumulated yet');
  END IF;

  -- Update last_harvest
  UPDATE public.user_stakes
  SET last_harvest = v_now
  WHERE id = p_stake_id;

  -- Credit yield
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_reward,
      total_staking_yield = COALESCE(total_staking_yield, 0) + v_reward,
      updated_at = v_now
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  PERFORM public.process_referral_commissions(v_user.player_id, v_reward, 'Staking Yield');

  RETURN jsonb_build_object(
    'success', true,
    'stake_id', p_stake_id,
    'yield', v_reward,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.harvest_yield(TEXT, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.harvest_yield(TEXT, UUID) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: harvest_all_yield
-- Source: seal_referral_staking_and_nft_pol_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.harvest_all_yield(TEXT);
DROP FUNCTION IF EXISTS public.harvest_all_yield(TEXT, TEXT);
DROP FUNCTION IF EXISTS harvest_all_yield(TEXT);
DROP FUNCTION IF EXISTS harvest_all_yield(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.harvest_all_yield(
  p_wallet TEXT,
  p_pool TEXT DEFAULT 'pgt'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_count INTEGER := 0;
  v_total_yield NUMERIC := 0;
  v_reward NUMERIC;
  v_elapsed_seconds NUMERIC;
  v_new_balance NUMERIC := 0;
  v_pool TEXT := LOWER(TRIM(COALESCE(p_pool, 'pgt')));
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  FOR v_stake IN
    SELECT * FROM public.user_stakes
    WHERE (LOWER(wallet_address) = LOWER(v_user.player_id)
           OR LOWER(wallet_address) = LOWER(COALESCE(v_user.linked_wallet_address, ''))
           OR LOWER(wallet_address) = LOWER(p_wallet))
      AND LOWER(pool) = v_pool
      AND active = true
    FOR UPDATE
  LOOP
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stake.last_harvest, v_stake.staked_at)));
    v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
    IF v_reward > 0 THEN
      v_total_yield := v_total_yield + v_reward;
      v_count := v_count + 1;
      UPDATE public.user_stakes SET last_harvest = v_now WHERE id = v_stake.id;
    END IF;
  END LOOP;

  IF v_total_yield > 0 THEN
    UPDATE public.users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_yield,
        total_staking_yield = COALESCE(total_staking_yield, 0) + v_total_yield,
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING balance_pgt INTO v_new_balance;

    PERFORM public.process_referral_commissions(v_user.player_id, v_total_yield, 'Staking Yield');
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'harvested_count', v_count,
    'harvested_amount', v_total_yield,
    'yield', v_total_yield,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.harvest_all_yield(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.harvest_all_yield(TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: credit_verified_deposit (SERVICE ROLE ONLY)
-- Cryptographically verified on-chain Polygon PGT token deposits.
-- Insecure deposit_pgt_onchain is permanently dropped and revoked.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.deposit_pgt_onchain(TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.deposit_pgt_onchain(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS deposit_pgt_onchain(TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS deposit_pgt_onchain(TEXT, NUMERIC);

DROP FUNCTION IF EXISTS public.credit_verified_deposit(TEXT, TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS credit_verified_deposit(TEXT, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.credit_verified_deposit(
  p_player_id TEXT,
  p_tx_hash TEXT,
  p_from_wallet TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_clean_tx TEXT := LOWER(TRIM(COALESCE(p_tx_hash, '')));
  v_clean_wallet TEXT := LOWER(TRIM(COALESCE(p_from_wallet, '')));
  v_user RECORD;
  v_new_balance NUMERIC;
  v_burn NUMERIC;
  v_treasury NUMERIC;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Strict validation of transaction hash format (64-char hex with 0x prefix)
  IF v_clean_tx = '' OR v_clean_tx !~ '^0x[a-f0-9]{64}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid transaction hash format.');
  END IF;

  -- Validate amount is positive
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid deposit amount.');
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  -- 1. Locate player profile
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR (v_clean_wallet != '' AND LOWER(linked_wallet_address) = v_clean_wallet)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player profile not found in database.');
  END IF;

  -- 2. Replay Protection: Atomically insert tx_hash into processed_deposits
  BEGIN
    INSERT INTO public.processed_deposits (tx_hash, player_id, wallet_address, amount, status, created_at)
    VALUES (
      v_clean_tx,
      v_user.player_id,
      COALESCE(v_clean_wallet, v_user.linked_wallet_address, v_user.player_id),
      p_amount,
      'confirmed',
      v_now
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'This transaction has already been processed and credited.');
  END;

  -- 3. Atomically credit verified PGT balance to player
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + p_amount,
      updated_at = v_now
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- 4. Record 50% Burn & 50% Treasury metrics
  v_burn := p_amount * 0.50;
  v_treasury := p_amount * 0.50;

  UPDATE public.global_burn_metrics
  SET total_burned_pgt = COALESCE(total_burned_pgt, 0) + v_burn,
      total_treasury_pgt = COALESCE(total_treasury_pgt, 0) + v_treasury,
      updated_at = v_now
  WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_user.player_id,
    'tx_hash', v_clean_tx,
    'deposited', p_amount,
    'new_balance_pgt', v_new_balance,
    'message', 'On-chain PGT deposit verified and credited successfully.'
  );
END;
$$;

-- 4. SECURE ACCESS CONTROL: STRICTLY RESTRICT TO service_role ONLY
REVOKE ALL ON FUNCTION public.credit_verified_deposit(TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_verified_deposit(TEXT, TEXT, TEXT, NUMERIC) TO service_role;


-- ==============================================================================

-- 8. WITHDRAWALS & ON-SITE STORE
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: request_withdrawal_voucher
-- Source: fix_and_harden_withdrawals_atomic.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_withdrawal_voucher(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.request_withdrawal_voucher(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS request_withdrawal_voucher(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS request_withdrawal_voucher(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.request_withdrawal_voucher(
  p_player_id TEXT,
  p_wallet_address TEXT,
  p_amount NUMERIC,
  p_ip_address TEXT,
  p_nonce NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_norm_wallet TEXT := LOWER(TRIM(COALESCE(p_wallet_address, '')));
  v_user RECORD;
  v_gs RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_seven_days_ago TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_min_limit NUMERIC := 10.0;
  v_max_limit NUMERIC := 25000.0;
  v_max_weekly INTEGER := 5;
  v_quarantine_days INTEGER := 7;
  v_recent_count INTEGER := 0;
  v_new_balance NUMERIC := 0.0;
  v_account_age_days NUMERIC := 0.0;
  v_clean_ip TEXT := TRIM(COALESCE(p_ip_address, 'unknown'));
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  IF v_norm_wallet = '' AND v_pid ~ '^0x[a-f0-9]{40}$' THEN
    v_norm_wallet := v_pid;
  END IF;

  -- 1. Lock user row FOR UPDATE to prevent parallel race conditions
  SELECT * INTO v_user FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR (v_norm_wallet != '' AND LOWER(linked_wallet_address) = v_norm_wallet)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found in database.');
  END IF;

  -- 2. Banned player check
  IF COALESCE(v_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Security Alert: Account has been permanently suspended.');
  END IF;

  -- 3. Dynamic limits from global_settings
  BEGIN
    SELECT * INTO v_gs FROM public.global_settings WHERE id = 1 LIMIT 1;
    IF FOUND THEN
      v_min_limit := COALESCE(v_gs.min_withdraw_pgt, 10.0);
      v_max_limit := COALESCE(v_gs.max_withdraw_pgt, 25000.0);
      v_max_weekly := COALESCE(v_gs.max_weekly_withdrawals, 5);
      v_quarantine_days := COALESCE(v_gs.account_quarantine_days, 7);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_min_limit := 10.0;
    v_max_limit := 25000.0;
    v_max_weekly := 5;
    v_quarantine_days := 7;
  END;

  -- 4. Amount limits validation
  IF p_amount IS NULL OR p_amount < v_min_limit THEN
    RETURN jsonb_build_object('success', false, 'error', format('Minimum single withdrawal limit is %s PGT per transaction.', v_min_limit));
  END IF;

  IF p_amount > v_max_limit THEN
    RETURN jsonb_build_object('success', false, 'error', format('Security Limit: Maximum single withdrawal limit is %s PGT per transaction.', v_max_limit));
  END IF;

  -- 5. Account age quarantine validation
  IF v_quarantine_days > 0 THEN
    IF v_user.created_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', format('Account Security Quarantine: Account creation timestamp missing. You must wait %s day(s) before making on-chain withdrawals.', v_quarantine_days));
    END IF;

    v_account_age_days := EXTRACT(EPOCH FROM (v_now - v_user.created_at)) / 86400.0;
    IF v_account_age_days < v_quarantine_days THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Account Security Quarantine: New accounts must be at least %s days old before making on-chain withdrawals (%s day(s) remaining).', v_quarantine_days, CEIL(v_quarantine_days - v_account_age_days))
      );
    END IF;
  END IF;

  -- 6. Off-chain balance check
  IF COALESCE(v_user.balance_pgt, 0.0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient off-chain PGT balance.');
  END IF;

  -- 7. Rolling 7-day quota enforcement (across player_id, linked wallet, and IP)
  SELECT COUNT(*) INTO v_recent_count
  FROM public.withdrawals_history
  WHERE created_at >= v_seven_days_ago
    AND (
      LOWER(player_id) = LOWER(v_user.player_id)
      OR (v_norm_wallet != '' AND LOWER(wallet_address) = v_norm_wallet)
      OR (v_clean_ip != 'unknown' AND ip_address = v_clean_ip)
    );

  IF v_recent_count >= v_max_weekly THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Weekly Limit Reached: Maximum %s withdrawals allowed per 7-day period (%s/%s used). Please wait for previous withdrawals to mature out of the 7-day window.', v_max_weekly, v_recent_count, v_max_weekly)
    );
  END IF;

  -- 8. Deduct balance atomically
  UPDATE public.users
  SET balance_pgt = balance_pgt - p_amount,
      updated_at = v_now
  WHERE LOWER(player_id) = LOWER(v_user.player_id)
  RETURNING balance_pgt INTO v_new_balance;

  -- 9. Insert into withdrawals_history with IP tracking
  INSERT INTO public.withdrawals_history (
    player_id,
    wallet_address,
    amount,
    nonce,
    ip_address,
    created_at
  ) VALUES (
    v_user.player_id,
    COALESCE(NULLIF(v_norm_wallet, ''), LOWER(COALESCE(v_user.linked_wallet_address, v_user.player_id))),
    p_amount,
    p_nonce,
    v_clean_ip,
    v_now
  );

  -- 10. Update user_ips sentinel
  IF v_clean_ip != 'unknown' THEN
    BEGIN
      INSERT INTO public.user_ips (player_id, ip_address, last_seen)
      VALUES (v_user.player_id, v_clean_ip, v_now)
      ON CONFLICT (player_id) 
      DO UPDATE SET ip_address = EXCLUDED.ip_address, last_seen = EXCLUDED.last_seen;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_user.player_id,
    'wallet_address', COALESCE(NULLIF(v_norm_wallet, ''), LOWER(COALESCE(v_user.linked_wallet_address, v_user.player_id))),
    'amount', p_amount,
    'nonce', p_nonce,
    'new_balance', v_new_balance,
    'weekly_used', v_recent_count + 1,
    'weekly_limit', v_max_weekly
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal_voucher(TEXT, TEXT, NUMERIC, TEXT, NUMERIC) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: cancel_withdrawal_voucher
-- Source: fix_and_harden_withdrawals_atomic.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cancel_withdrawal_voucher(TEXT, UUID);
DROP FUNCTION IF EXISTS cancel_withdrawal_voucher(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.cancel_withdrawal_voucher(
  p_nonce NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Find the withdrawal record by nonce
  SELECT * INTO v_rec FROM public.withdrawals_history WHERE nonce = p_nonce LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal record not found for nonce.');
  END IF;

  -- Refund balance to user
  UPDATE public.users
  SET balance_pgt = balance_pgt + v_rec.amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_rec.player_id);

  -- Remove unconsumed withdrawal history record
  DELETE FROM public.withdrawals_history WHERE id = v_rec.id;

  RETURN jsonb_build_object('success', true, 'refunded_amount', v_rec.amount, 'player_id', v_rec.player_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_withdrawal_voucher(NUMERIC) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: refund_failed_withdrawal
-- Allows a player to rollback their own unconsumed withdrawal voucher if
-- the on-chain MetaMask transaction fails, reverts, or is rejected.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.refund_failed_withdrawal(UUID);
DROP FUNCTION IF EXISTS refund_failed_withdrawal(UUID);
CREATE OR REPLACE FUNCTION public.refund_failed_withdrawal(
  p_player_id TEXT,
  p_nonce NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_rec RECORD;
  v_new_balance NUMERIC;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 1. Find the unconsumed withdrawal record matching the nonce and player
  SELECT * INTO v_rec 
  FROM public.withdrawals_history 
  WHERE nonce = p_nonce 
    AND (LOWER(player_id) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(v_pid))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal voucher not found or does not belong to this account.');
  END IF;

  -- 2. Refund balance to user
  UPDATE public.users
  SET balance_pgt = balance_pgt + v_rec.amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_rec.player_id)
  RETURNING balance_pgt INTO v_new_balance;

  -- 3. Delete the unconsumed withdrawal history record
  DELETE FROM public.withdrawals_history WHERE id = v_rec.id;

  RETURN jsonb_build_object(
    'success', true,
    'refunded_amount', v_rec.amount,
    'new_balance', v_new_balance,
    'player_id', v_rec.player_id,
    'nonce', p_nonce
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_failed_withdrawal(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_failed_withdrawal(TEXT, NUMERIC) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: buy_onsite_nft
-- Source: add_buy_onsite_nft_rpc.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.buy_onsite_nft(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.buy_onsite_nft(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS buy_onsite_nft(TEXT, TEXT);
DROP FUNCTION IF EXISTS buy_onsite_nft(TEXT, TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION buy_onsite_nft(p_wallet TEXT, p_nft_id TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_balance NUMERIC;
  v_cost NUMERIC;
  v_existing_nfts JSONB;
  v_crate_nfts JSONB;
  v_nft_name TEXT;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN json_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_nft_id = 'nft_relic_seeker' THEN
    v_cost := 1000000.0;
    v_nft_name := 'Quantum Relic Seeker';
  ELSE
    RETURN json_build_object('success', false, 'error', 'Unknown on-site NFT identifier');
  END IF;

  SELECT balance_pgt, COALESCE(owned_nfts, '[]'::jsonb), COALESCE(crate_nfts, '[]'::jsonb)
  INTO v_balance, v_existing_nfts, v_crate_nfts
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player profile not found');
  END IF;

  -- Check if already owned in owned_nfts or crate_nfts
  IF (v_existing_nfts @> jsonb_build_array(p_nft_id)) OR (v_crate_nfts @> jsonb_build_array(p_nft_id)) THEN
    RETURN json_build_object('success', false, 'error', 'You already own this NFT!');
  END IF;

  IF v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient PGT balance (Requires 1,000,000 PGT)');
  END IF;

  -- Append to crate_nfts
  v_crate_nfts := v_crate_nfts || jsonb_build_array(p_nft_id);

  UPDATE users
  SET balance_pgt = balance_pgt - v_cost,
      crate_nfts = v_crate_nfts,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

  RETURN json_build_object(
    'success', true,
    'nft_id', p_nft_id,
    'nft_name', v_nft_name,
    'new_balance', v_balance - v_cost,
    'crate_nfts', v_crate_nfts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION buy_onsite_nft(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION buy_onsite_nft(TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: sync_onchain_nfts
-- Source: seal_nft_sync_exploit_and_sanitize_dobby.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_onchain_nfts(TEXT, JSONB);
DROP FUNCTION IF EXISTS sync_onchain_nfts(TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.sync_onchain_nfts(
    p_player_id TEXT,
    p_chain_nfts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_player_id TEXT;
    v_user RECORD;
    v_sanitized JSONB := '[]'::jsonb;
    v_elem TEXT;
    v_is_admin BOOLEAN := FALSE;
    v_allowed_chain_nfts CONSTANT TEXT[] := ARRAY[
        'nft_common_boost', 'nft_silver_charger', 'nft_gold_turbine',
        'nft_rare_shield', 'nft_pulse_blaster', 'nft_epic_yield',
        'nft_referral_beacon', 'nft_affiliate_guild', 'nft_legendary_king',
        'nft_yield_vault', 'nft_yield_vault_rare', 'nft_yield_vault_epic'
    ];
    v_guard RECORD;
BEGIN
    -- Authenticate caller & anti-framing guard
    v_guard := public.assert_caller_player_id(p_player_id);
    IF v_guard.p_status <> 'OK' THEN
        RETURN '[]'::jsonb;
    END IF;
    v_actual_player_id := v_guard.p_player_id;

    SELECT player_id, linked_wallet_address, is_admin, COALESCE(owned_nfts, '[]'::jsonb) AS owned_nfts
    INTO v_user
    FROM public.users
    WHERE LOWER(player_id) = LOWER(v_actual_player_id)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_actual_player_id)
    LIMIT 1;

    IF v_user IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    v_is_admin := COALESCE(v_user.is_admin, FALSE) OR 
                  (v_user.linked_wallet_address IS NOT NULL AND LOWER(v_user.linked_wallet_address) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d') OR
                  LOWER(v_user.player_id) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';

    -- Security Guard 1: Must have a valid linked Web3 wallet to claim any on-chain NFTs
    IF v_user.linked_wallet_address IS NULL OR TRIM(v_user.linked_wallet_address) = '' OR NOT (LOWER(v_user.linked_wallet_address) ~ '^0x[a-f0-9]{40}$') THEN
        IF p_chain_nfts IS NOT NULL AND jsonb_typeof(p_chain_nfts) = 'array' AND jsonb_array_length(p_chain_nfts) > 0 THEN
            PERFORM public.record_bot_warning(
                v_user.player_id,
                'nft_sync_no_wallet',
                'Exploit attempt: sync_onchain_nfts called with non-empty NFTs on an account without linked Web3 wallet.',
                jsonb_build_object('payload', p_chain_nfts)
            );
        END IF;
        -- Return unmodified current inventory
        RETURN v_user.owned_nfts;
    END IF;

    -- Security Guard 2: Filter and sanitize verified multiplier NFTs
    IF p_chain_nfts IS NOT NULL AND jsonb_typeof(p_chain_nfts) = 'array' THEN
        FOR v_elem IN SELECT jsonb_array_elements_text(p_chain_nfts) LOOP
            v_elem := LOWER(TRIM(COALESCE(v_elem, '')));
            
            -- Non-multiplier items (e.g. VIP passes, consumable passes, unknown IDs) are silently skipped
            -- Never penalize legitimate players who hold VIP passes or other tokens in their wallet!
            IF v_elem = '' OR v_elem LIKE 'nft_vip_pass%' OR v_elem = 'nft_relic_seeker' OR NOT (v_elem = ANY(v_allowed_chain_nfts)) THEN
                CONTINUE;
            END IF;

            -- Avoid duplicates in v_sanitized
            IF NOT (v_sanitized ? v_elem) THEN
                v_sanitized := v_sanitized || jsonb_build_array(v_elem);
            END IF;
        END LOOP;
    END IF;

    UPDATE public.users
    SET owned_nfts = v_sanitized,
        updated_at = NOW()
    WHERE player_id = v_user.player_id;

    RETURN v_sanitized;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_onchain_nfts(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_onchain_nfts(TEXT, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: activate_vip_pass
-- Source: seal_vip_pass_activation_exploit.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.activate_vip_pass(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.activate_vip_pass(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS activate_vip_pass(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS activate_vip_pass(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.activate_vip_pass(
  p_player_id TEXT,
  p_pass_type TEXT DEFAULT 'nft_vip_pass'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_days INTEGER := 30;
  v_user RECORD;
  v_base_time TIMESTAMPTZ;
  v_new_vip TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_crate_nfts JSONB;
  v_owned_nfts JSONB;
  v_consumed BOOLEAN := false;
  v_activities JSONB;
  v_new_activity JSONB;
  v_time_str TEXT;
  v_clean_pass TEXT := LOWER(TRIM(COALESCE(p_pass_type, '')));
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 1. Validate Pass Type Whitelist
  IF v_clean_pass = 'nft_vip_pass_yearly' THEN
    v_days := 365;
  ELSIF v_clean_pass = 'nft_vip_pass' THEN
    v_days := 30;
  ELSE
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid VIP pass type. Must be nft_vip_pass (30 days) or nft_vip_pass_yearly (365 days).'
    );
  END IF;

  -- 3. Row-Lock User Record FOR UPDATE
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player profile not found');
  END IF;

  -- 4. Check Suspended Status
  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  v_crate_nfts := COALESCE(v_user.crate_nfts, '[]'::jsonb);
  v_owned_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb);

  -- 5. Mandatory Consumption Check (Prioritize off-chain crate pass first, then on-chain)
  IF v_crate_nfts @> jsonb_build_array(v_clean_pass) THEN
    -- Remove the first occurrence of this pass from crate_nfts array
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_crate_nfts
    FROM (
      SELECT elem, row_number() OVER () AS rn
      FROM jsonb_array_elements_text(v_crate_nfts) AS elem
    ) sub
    WHERE NOT (elem = v_clean_pass AND rn = (
      SELECT min(rn) FROM (
        SELECT elem, row_number() OVER () AS rn
        FROM jsonb_array_elements_text(COALESCE(v_user.crate_nfts, '[]'::jsonb)) AS elem
      ) t WHERE t.elem = v_clean_pass
    ));
    v_consumed := true;

  ELSIF v_owned_nfts @> jsonb_build_array(v_clean_pass) THEN
    -- Remove the first occurrence of this pass from owned_nfts array
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_owned_nfts
    FROM (
      SELECT elem, row_number() OVER () AS rn
      FROM jsonb_array_elements_text(v_owned_nfts) AS elem
    ) sub
    WHERE NOT (elem = v_clean_pass AND rn = (
      SELECT min(rn) FROM (
        SELECT elem, row_number() OVER () AS rn
        FROM jsonb_array_elements_text(COALESCE(v_user.owned_nfts, '[]'::jsonb)) AS elem
      ) t WHERE t.elem = v_clean_pass
    ));
    v_consumed := true;
  END IF;

  -- CRITICAL ANTI-CHEAT GATE: ABORT IF NO PASS WAS CONSUMED
  IF NOT v_consumed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Activation failed: No valid VIP pass (' || v_clean_pass || ') found in backpack or crate inventory'
    );
  END IF;

  -- 6. Calculate New VIP Expiration (extends existing VIP if currently active)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_base_time := v_user.vip_until;
  ELSE
    v_base_time := v_now;
  END IF;

  v_new_vip := v_base_time + (v_days || ' days')::INTERVAL;

  -- 7. Record In-Game Activity
  v_time_str := to_char(v_now AT TIME ZONE 'UTC', 'HH24:MI:SS');
  v_new_activity := jsonb_build_object(
    'user', 'You',
    'action', 'activated VIP Pass',
    'reward', '+' || v_days || ' Days VIP',
    'time', v_time_str
  );
  v_activities := jsonb_build_array(v_new_activity) || COALESCE(v_user.activities, '[]'::jsonb);
  IF jsonb_array_length(v_activities) > 20 THEN
    SELECT jsonb_agg(elem) INTO v_activities
    FROM (
      SELECT elem FROM jsonb_array_elements(v_activities) WITH ORDINALITY AS t(elem, ord)
      WHERE ord <= 20
    ) s;
  END IF;

  -- 8. Persist Updates Atomically
  UPDATE public.users
  SET 
    vip_until = v_new_vip,
    crate_nfts = v_crate_nfts,
    owned_nfts = v_owned_nfts,
    activities = v_activities,
    updated_at = v_now
  WHERE player_id = v_pid;

  RETURN jsonb_build_object(
    'success', true,
    'vip_until', v_new_vip,
    'days_added', v_days,
    'crate_nfts', v_crate_nfts,
    'owned_nfts', v_owned_nfts
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.activate_vip_pass(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.activate_vip_pass(TEXT, TEXT) FROM anon;


-- ==============================================================================
-- 9. COSMIC WORLD BOSS (QUANTUM LEVIATHAN)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: strike_world_boss
-- Source: seal_world_boss_and_minerals_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.strike_world_boss(TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.strike_world_boss(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.strike_world_boss(TEXT);
DROP FUNCTION IF EXISTS strike_world_boss(TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS strike_world_boss(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS strike_world_boss(TEXT);

CREATE OR REPLACE FUNCTION public.strike_world_boss(
  p_player_id TEXT,
  p_damage NUMERIC DEFAULT NULL,
  p_crystals_cost NUMERIC DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_current_quantum NUMERIC := 0;
  v_new_quantum NUMERIC := 0;
  v_strikes_count INT := 1;
  v_actual_cost NUMERIC := 1000;
  
  -- Fleet power & combat stats computed strictly server-side
  v_warp INT := 1;
  v_laser INT := 1;
  v_cargo INT := 1;
  v_shield INT := 1;
  v_turret INT := 1;
  v_fleet_power INT := 100;
  v_crit_chance NUMERIC := 0.10;
  v_server_strike_dmg NUMERIC := 0;
  v_server_crit_count INT := 0;
  v_single_dmg NUMERIC;
  
  v_new_player_dmg NUMERIC;
  v_alltime_dmg NUMERIC;
  v_attacks INT;
  v_total_server_dmg NUMERIC;
  v_boss_level INT := 1;
  v_boss_pool NUMERIC := 10000;
  v_boss_hp NUMERIC := 5000000;
  v_boss_max_hp NUMERIC := 5000000;
  v_game_settings JSONB;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Validate Crystal Cost & Strikes
  IF p_crystals_cost IS NULL OR p_crystals_cost < 1000 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Striking the World Boss requires at least 1,000 Quantum Crystals.');
  END IF;

  v_strikes_count := GREATEST(1, FLOOR(p_crystals_cost / 1000));
  v_actual_cost := v_strikes_count * 1000;

  -- 3. Acquire Pessimistic Row Lock (prevents concurrent crystal spending)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player account not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- 4. Verify Quantum Crystal balance
  v_current_quantum := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);
  IF v_current_quantum < v_actual_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient Quantum Crystals! You have ' || FLOOR(v_current_quantum)::TEXT || ' but need ' || v_actual_cost::TEXT || ' Crystals.'
    );
  END IF;

  -- 5. DETERMINISTIC SERVER-SIDE COMBAT CALCULATION (Client p_damage is 100% IGNORED)
  v_warp   := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::INT, 1));
  v_laser  := GREATEST(1, COALESCE((v_space_state->>'laserLevel')::INT, 1));
  v_cargo  := GREATEST(1, COALESCE((v_space_state->>'cargoLevel')::INT, 1));
  v_shield := GREATEST(1, COALESCE((v_space_state->>'shieldLevel')::INT, 1));
  v_turret := GREATEST(1, COALESCE((v_space_state->>'turretLevel')::INT, 1));

  -- Fleet Power: (warp * 100) + (laser * 80) + (cargo * 50) + (shield * 60) + (turret * 90)
  v_fleet_power := (v_warp * 100) + (v_laser * 80) + (v_cargo * 50) + (v_shield * 60) + (v_turret * 90);
  v_fleet_power := GREATEST(100, v_fleet_power);

  -- Critical strike chance: 10% base + 2.5% per laser level, capped at 50%
  v_crit_chance := LEAST(0.50, 0.10 + (v_laser * 0.025));

  -- Simulate strikes deterministically
  v_server_strike_dmg := 0;
  v_server_crit_count := 0;

  FOR i IN 1..v_strikes_count LOOP
    -- Single strike damage: (fleetPower * 12) * (0.90 + random() * 0.35)
    v_single_dmg := FLOOR((v_fleet_power * 12) * (0.90 + (random() * 0.35)));
    IF random() < v_crit_chance THEN
      v_single_dmg := FLOOR(v_single_dmg * 1.85);
      v_server_crit_count := v_server_crit_count + 1;
    END IF;
    v_server_strike_dmg := v_server_strike_dmg + v_single_dmg;
  END LOOP;

  -- 6. Deduct Crystals & Update Space State
  v_new_quantum := GREATEST(0, v_current_quantum - v_actual_cost);
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(v_new_quantum));

  -- 7. Atomically Update Player Boss Damage
  UPDATE public.users
  SET 
    space_state = v_space_state,
    boss_weekly_damage = COALESCE(boss_weekly_damage, 0) + v_server_strike_dmg,
    alltime_boss_damage = COALESCE(alltime_boss_damage, 0) + v_server_strike_dmg,
    boss_attacks_count = COALESCE(boss_attacks_count, 0) + v_strikes_count,
    updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING boss_weekly_damage, alltime_boss_damage, boss_attacks_count
  INTO v_new_player_dmg, v_alltime_dmg, v_attacks;

  -- 8. Update Global Boss Health & Read Level Settings
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_hp, v_boss_max_hp, v_game_settings
  FROM public.global_settings
  WHERE id = 1;

  -- Calculate dynamically scaled pool based on level (10,000 * 1.10^(level-1))
  v_boss_pool := ROUND(10000.0 * POWER(1.10, GREATEST(0, v_boss_level - 1)));
  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, v_boss_pool);
  END IF;

  v_boss_hp := GREATEST(0, v_boss_hp - v_server_strike_dmg);

  UPDATE public.global_settings
  SET boss_current_hp = v_boss_hp
  WHERE id = 1;

  -- 9. Read Global Weekly Total Damage
  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_server_dmg
  FROM public.users
  WHERE boss_weekly_damage > 0;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_user.player_id,
    'strike_damage', v_server_strike_dmg,
    'critical_hits', v_server_crit_count,
    'crystals_deducted', v_actual_cost,
    'remaining_quantum', v_new_quantum,
    'player_weekly_damage', v_new_player_dmg,
    'player_attacks_count', v_attacks,
    'total_server_damage', v_total_server_dmg,
    'boss_level', v_boss_level,
    'boss_current_hp', v_boss_hp,
    'boss_max_hp', v_boss_max_hp,
    'boss_is_slain', (v_boss_hp <= 0),
    'weekly_pool_pgt', v_boss_pool,
    'estimated_share_pct', CASE WHEN v_total_server_dmg > 0 THEN ROUND((v_new_player_dmg / v_total_server_dmg) * 100, 2) ELSE 0 END,
    'estimated_pgt_payout', CASE WHEN v_total_server_dmg > 0 THEN ROUND((v_new_player_dmg / v_total_server_dmg) * v_boss_pool, 2) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.strike_world_boss(TEXT, NUMERIC, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.strike_world_boss(TEXT, NUMERIC, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: distribute_weekly_boss_prizes
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.distribute_weekly_boss_prizes();
DROP FUNCTION IF EXISTS public.distribute_weekly_boss_prizes(TEXT);
CREATE OR REPLACE FUNCTION public.distribute_weekly_boss_prizes(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_boss_level INT := 1;
  v_boss_current_hp NUMERIC := 5000000;
  v_boss_max_hp NUMERIC := 5000000;
  v_boss_pool NUMERIC := 10000;
  v_total_damage NUMERIC := 0;
  v_game_settings JSONB;
  v_winner RECORD;
  v_payout NUMERIC;
  v_payout_count INT := 0;
  v_distributed_total NUMERIC := 0;
  v_top_hunters JSONB := '[]'::jsonb;
  v_new_level INT := 1;
  v_new_max_hp NUMERIC := 5000000;
  v_new_pool NUMERIC := 10000;
  v_is_slain BOOLEAN := false;
  v_configured_pool NUMERIC := NULL;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  -- Read current Boss state from global_settings
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_current_hp, v_boss_max_hp, v_game_settings
  FROM public.global_settings
  WHERE id = 1;

  -- Dynamic Prize Pool formula: 10,000 * 1.20^(level - 1)
  v_boss_pool := ROUND(10000.0 * POWER(1.20, GREATEST(0, v_boss_level - 1)));

  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_configured_pool := (v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC;
    -- If admin explicitly paused the pool (0 PGT), respect 0
    IF v_configured_pool = 0 THEN
      v_boss_pool := 0;
    -- If admin explicitly configured a custom pool larger than dynamic, honor it
    ELSIF v_configured_pool > v_boss_pool THEN
      v_boss_pool := v_configured_pool;
    END IF;
  END IF;

  -- Calculate total weekly damage dealt across all attacking commanders
  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_damage
  FROM public.users
  WHERE boss_weekly_damage > 0;

  v_is_slain := (v_boss_current_hp <= 0);

  -- Safety: If pool is set to 0, pause prize distribution but reset weekly damage
  IF v_boss_pool <= 0 THEN
    UPDATE public.users SET boss_weekly_damage = 0 WHERE boss_weekly_damage > 0;
    RETURN jsonb_build_object(
      'success', true,
      'victory', v_is_slain,
      'slain', v_is_slain,
      'distributed', false,
      'message', 'World Boss weekly pool set to 0 PGT. Prize payout paused.',
      'boss_level', v_boss_level,
      'defeated_level', v_boss_level,
      'winner_count', 0,
      'payout_count', 0,
      'distributed_total_pgt', 0,
      'distributed_total', 0,
      'pool_pgt', 0
    );
  END IF;

  -- =========================================================================
  -- CASE A: BOSS WAS SLAIN (HP <= 0) -> VICTORY!
  -- Distribute Prize Pool + Level Up (+50% HP, +20% Pool)
  -- =========================================================================
  IF v_is_slain AND v_total_damage > 0 AND v_boss_pool > 0 THEN
    -- Capture Top 5 Boss Hunters for Announcement
    SELECT jsonb_agg(sub) INTO v_top_hunters
    FROM (
      SELECT 
        COALESCE(NULLIF(username, ''), SUBSTRING(player_id, 1, 8)) AS name,
        boss_weekly_damage AS damage,
        ROUND((boss_weekly_damage / v_total_damage) * v_boss_pool, 2) AS payout_pgt
      FROM public.users
      WHERE boss_weekly_damage > 0
      ORDER BY boss_weekly_damage DESC
      LIMIT 5
    ) sub;

    -- Distribute proportional payouts to all attacking commanders
    FOR v_winner IN
      SELECT player_id, boss_weekly_damage
      FROM public.users
      WHERE boss_weekly_damage > 0
    LOOP
      v_payout := ROUND((v_winner.boss_weekly_damage / v_total_damage) * v_boss_pool, 4);

      IF v_payout > 0 THEN
        UPDATE public.users
        SET 
          balance_pgt = COALESCE(balance_pgt, 0) + v_payout,
          total_earned = COALESCE(total_earned, 0) + v_payout,
          updated_at = NOW()
        WHERE player_id = v_winner.player_id;

        v_payout_count := v_payout_count + 1;
        v_distributed_total := v_distributed_total + v_payout;
      END IF;
    END LOOP;

    -- Calculate Next Week's Scaled Level, HP (+50%), and Pool (+20%)
    v_new_level := v_boss_level + 1;
    v_new_max_hp := ROUND(5000000.0 * POWER(1.50, v_new_level - 1));
    v_new_pool := ROUND(10000.0 * POWER(1.20, v_new_level - 1));

    -- Update game_payout_settings with new pool
    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "vip_only": false, "test_mode": false, "harvest_enabled": true, "leaderboard_enabled": true}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    -- Reset Boss to New Scaled Level for the fresh week
    UPDATE public.global_settings
    SET 
      boss_level = v_new_level,
      boss_max_hp = v_new_max_hp,
      boss_current_hp = v_new_max_hp,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
    WHERE id = 1;

    -- Record in boss_reset_history (wrapped in exception block to guarantee safety)
    BEGIN
      INSERT INTO public.boss_reset_history (
        week_label,
        boss_level,
        total_damage,
        distributed_total,
        hunters_count,
        slain,
        top_hunters,
        created_at
      ) VALUES (
        TO_CHAR(NOW(), 'YYYY-MM-DD'),
        v_boss_level,
        v_total_damage,
        v_distributed_total,
        v_payout_count,
        true,
        COALESCE(v_top_hunters, '[]'::jsonb),
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Reset all players' weekly boss damage to 0
    UPDATE public.users
    SET boss_weekly_damage = 0
    WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'victory', true,
      'slain', true,
      'distributed', true,
      'message', 'Quantum Leviathan was slain! Weekly prize pool distributed and Boss ascended to Level ' || v_new_level::TEXT || '!',
      'defeated_level', v_boss_level,
      'boss_level', v_boss_level,
      'next_level', v_new_level,
      'new_level', v_new_level,
      'winner_count', v_payout_count,
      'payout_count', v_payout_count,
      'hunters_count', v_payout_count,
      'total_damage_dealt', v_total_damage,
      'total_damage', v_total_damage,
      'pool_pgt', v_boss_pool,
      'distributed_total_pgt', v_distributed_total,
      'distributed_total', v_distributed_total,
      'next_max_hp', v_new_max_hp,
      'new_max_hp', v_new_max_hp,
      'next_pool_pgt', v_new_pool,
      'new_pool', v_new_pool,
      'top_hunters', COALESCE(v_top_hunters, '[]'::jsonb)
    );

  -- =========================================================================
  -- CASE B: BOSS SURVIVED (HP > 0) -> ESCAPED!
  -- Withhold Prize Pool (0 PGT) & Reset to Level 1 (5M HP, 10k PGT)
  -- =========================================================================
  ELSE
    v_new_level := 1;
    v_new_max_hp := 5000000;
    v_new_pool := 10000;

    -- Update game_payout_settings to base pool
    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "vip_only": false, "test_mode": false, "harvest_enabled": true, "leaderboard_enabled": true}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    -- Reset Boss to Level 1 Base Stats
    UPDATE public.global_settings
    SET 
      boss_level = v_new_level,
      boss_max_hp = v_new_max_hp,
      boss_current_hp = v_new_max_hp,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
    WHERE id = 1;

    -- Record in boss_reset_history
    BEGIN
      INSERT INTO public.boss_reset_history (
        week_label,
        boss_level,
        total_damage,
        distributed_total,
        hunters_count,
        slain,
        top_hunters,
        created_at
      ) VALUES (
        TO_CHAR(NOW(), 'YYYY-MM-DD'),
        v_boss_level,
        v_total_damage,
        0,
        0,
        false,
        '[]'::jsonb,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Reset all players' weekly boss damage to 0
    UPDATE public.users
    SET boss_weekly_damage = 0
    WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'slain', false,
      'distributed', false,
      'message', 'Quantum Leviathan escaped! Level reset to 1 for the fresh week.',
      'boss_level', v_boss_level,
      'defeated_level', v_boss_level,
      'next_level', 1,
      'new_level', 1,
      'winner_count', 0,
      'payout_count', 0,
      'hunters_count', 0,
      'total_damage_dealt', v_total_damage,
      'total_damage', v_total_damage,
      'survived_hp', GREATEST(0, v_boss_current_hp),
      'boss_current_hp', GREATEST(0, v_boss_current_hp),
      'pool_pgt', v_boss_pool,
      'distributed_total_pgt', 0,
      'distributed_total', 0,
      'next_max_hp', v_new_max_hp,
      'new_max_hp', v_new_max_hp,
      'next_pool_pgt', v_new_pool,
      'new_pool', v_new_pool,
      'top_hunters', '[]'::jsonb
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.distribute_weekly_boss_prizes(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.distribute_weekly_boss_prizes(TEXT) FROM anon, authenticated;


-- ==============================================================================
-- 10. QUESTS & PROGRESSION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: claim_daily_quest
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_daily_quest(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_daily_quest(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.claim_daily_quest(
  p_wallet TEXT,
  p_quest_type TEXT,
  p_client_quests JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_q JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_reward NUMERIC := 0;
  v_new_balance NUMERIC;
  v_server_games INT := 0;
  v_server_wins INT := 0;
  v_client_games INT := 0;
  v_client_mining INT := 0;
  v_client_wins INT := 0;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;
  
  SELECT * INTO v_user
  FROM users
  WHERE player_id = v_pid OR LOWER(linked_wallet_address) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'message', 'SECURITY_VIOLATION: Account suspended.');
  END IF;

  v_q := v_user.daily_quests;
  IF v_q IS NULL OR (v_q->>'date') IS NULL OR (v_q->>'date') <> v_today THEN
    v_q := jsonb_build_object(
      'date', v_today,
      'games', 0, 'mining', 0, 'wins', 0,
      'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
      'master_claimed', false,
      'streak_days', COALESCE((v_q->>'streak_days')::int, 0),
      'last_streak_date', COALESCE(v_q->>'last_streak_date', '')
    );
  END IF;

  -- 1. Sync from verified client quests payload if matching today's date
  IF p_client_quests IS NOT NULL AND jsonb_typeof(p_client_quests) = 'object' THEN
    IF COALESCE(p_client_quests->>'date', '') = v_today THEN
      v_client_games := LEAST(GREATEST(0, COALESCE((p_client_quests->>'games')::int, 0)), 100);
      v_client_mining := LEAST(GREATEST(0, COALESCE((p_client_quests->>'mining')::int, 0)), 100);
      v_client_wins := LEAST(GREATEST(0, COALESCE((p_client_quests->>'wins')::int, 0)), 100);

      IF v_client_games > COALESCE((v_q->>'games')::int, 0) THEN
        v_q := jsonb_set(v_q, '{games}', to_jsonb(v_client_games));
      END IF;
      IF v_client_mining > COALESCE((v_q->>'mining')::int, 0) THEN
        v_q := jsonb_set(v_q, '{mining}', to_jsonb(v_client_mining));
      END IF;
      IF v_client_wins > COALESCE((v_q->>'wins')::int, 0) THEN
        v_q := jsonb_set(v_q, '{wins}', to_jsonb(v_client_wins));
      END IF;
    END IF;
  END IF;

  -- 2. Authoritative server-side activity fallback
  -- Check completed arcade sessions today across all devices
  SELECT COUNT(*) INTO v_server_games
  FROM arcade_sessions
  WHERE (player_id = v_user.player_id OR (v_user.linked_wallet_address IS NOT NULL AND LOWER(player_id) = LOWER(v_user.linked_wallet_address)))
    AND status = 'completed'
    AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;
  v_q := jsonb_set(v_q, '{games}', to_jsonb(GREATEST(COALESCE((v_q->>'games')::int, 0), v_server_games)));

  -- Check recorded bet wins today across all devices (SAFEGUARD: filter out losses & pushes)
  SELECT COUNT(*) INTO v_server_wins
  FROM bet_wins
  WHERE (player_id = v_user.player_id OR wallet_address = v_user.player_id OR (v_user.linked_wallet_address IS NOT NULL AND (LOWER(player_id) = LOWER(v_user.linked_wallet_address) OR LOWER(wallet_address) = LOWER(v_user.linked_wallet_address))))
    AND (payout > bet_amount OR COALESCE(outcome, 'win') = 'win')
    AND payout > 0
    AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;
  v_q := jsonb_set(v_q, '{wins}', to_jsonb(GREATEST(COALESCE((v_q->>'wins')::int, 0), v_server_wins)));

  -- 3. Evaluate quest requirements & enforce atomic single-claim checks
  IF p_quest_type = 'games' THEN
    IF COALESCE((v_q->>'games')::int, 0) < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Play & finish 3 Arcade games first!');
    END IF;
    IF COALESCE((v_q->>'games_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Games quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{games_claimed}', 'true');
    v_reward := 10;

  ELSIF p_quest_type = 'mining' THEN
    IF COALESCE((v_q->>'mining')::int, 0) < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Mine at least 3 Ore Shards first!');
    END IF;
    IF COALESCE((v_q->>'mining_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Mining quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{mining_claimed}', 'true');
    v_reward := 10;

  ELSIF p_quest_type = 'wins' THEN
    IF COALESCE((v_q->>'wins')::int, 0) < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Win at least 3 PGT wager rounds first!');
    END IF;
    IF COALESCE((v_q->>'wins_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Wins quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{wins_claimed}', 'true');
    v_reward := 10;

  ELSIF p_quest_type = 'master' THEN
    IF NOT (
      (COALESCE((v_q->>'games_claimed')::boolean, false) OR COALESCE((v_q->>'games')::int, 0) >= 3) AND
      (COALESCE((v_q->>'mining_claimed')::boolean, false) OR COALESCE((v_q->>'mining')::int, 0) >= 3) AND
      (COALESCE((v_q->>'wins_claimed')::boolean, false) OR COALESCE((v_q->>'wins')::int, 0) >= 3)
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Complete all 3 daily quests first!');
    END IF;
    IF COALESCE((v_q->>'master_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Master quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{master_claimed}', 'true');
    v_reward := 25;

    -- Update streak days on master claim
    IF COALESCE(v_q->>'last_streak_date', '') <> v_today THEN
      DECLARE
        v_yesterday TEXT := TO_CHAR((NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day', 'YYYY-MM-DD');
        v_streak INT := COALESCE((v_q->>'streak_days')::int, 0);
      BEGIN
        IF (v_q->>'last_streak_date') = v_yesterday THEN
          v_streak := v_streak + 1;
        ELSE
          v_streak := 1;
        END IF;
        v_q := jsonb_set(v_q, '{streak_days}', to_jsonb(v_streak));
        v_q := jsonb_set(v_q, '{last_streak_date}', to_jsonb(v_today));
      END;
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid quest type');
  END IF;

  v_new_balance := COALESCE(v_user.balance_pgt, 0) + v_reward;

  UPDATE users
  SET balance_pgt = v_new_balance,
      daily_quests = v_q,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'new_balance', v_new_balance,
    'daily_quests', v_q
  );
END;
$$;

-- Backward-compatible 2-argument wrapper
CREATE OR REPLACE FUNCTION public.claim_daily_quest(
  p_wallet TEXT,
  p_quest_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.claim_daily_quest(p_wallet, p_quest_type, NULL::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT, JSONB) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: sync_daily_quests
-- Multi-device daily quests synchronization (Desktop & Mobile)
-- Authoritatively aggregates completed arcade sessions, wager wins, and client mining.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_daily_quests(TEXT);
DROP FUNCTION IF EXISTS public.sync_daily_quests(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.sync_daily_quests(
  p_wallet TEXT,
  p_client_quests JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_q JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_server_games INT := 0;
  v_server_wins INT := 0;
  v_client_games INT := 0;
  v_client_mining INT := 0;
  v_client_wins INT := 0;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user
  FROM users
  WHERE player_id = v_pid OR LOWER(linked_wallet_address) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'message', 'SECURITY_VIOLATION: Account suspended.');
  END IF;

  v_q := v_user.daily_quests;
  IF v_q IS NULL OR (v_q->>'date') IS NULL OR (v_q->>'date') <> v_today THEN
    v_q := jsonb_build_object(
      'date', v_today,
      'games', 0, 'mining', 0, 'wins', 0,
      'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
      'master_claimed', false,
      'streak_days', COALESCE((v_q->>'streak_days')::int, 0),
      'last_streak_date', COALESCE(v_q->>'last_streak_date', '')
    );
  END IF;

  -- 1. Count actual completed arcade games today across all devices
  SELECT COUNT(*) INTO v_server_games
  FROM arcade_sessions
  WHERE (player_id = v_user.player_id OR (v_user.linked_wallet_address IS NOT NULL AND LOWER(player_id) = LOWER(v_user.linked_wallet_address)))
    AND status = 'completed'
    AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;

  -- 2. Count actual wager wins today across all devices
  SELECT COUNT(*) INTO v_server_wins
  FROM bet_wins
  WHERE (player_id = v_user.player_id OR wallet_address = v_user.player_id OR (v_user.linked_wallet_address IS NOT NULL AND (LOWER(player_id) = LOWER(v_user.linked_wallet_address) OR LOWER(wallet_address) = LOWER(v_user.linked_wallet_address))))
    AND (payout > bet_amount OR COALESCE(outcome, 'win') = 'win')
    AND payout > 0
    AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;

  -- 3. Parse client quests payload if matching today's date
  IF p_client_quests IS NOT NULL AND jsonb_typeof(p_client_quests) = 'object' THEN
    IF COALESCE(p_client_quests->>'date', '') = v_today THEN
      v_client_games := LEAST(GREATEST(0, COALESCE((p_client_quests->>'games')::int, 0)), 100);
      v_client_mining := LEAST(GREATEST(0, COALESCE((p_client_quests->>'mining')::int, 0)), 100);
      v_client_wins := LEAST(GREATEST(0, COALESCE((p_client_quests->>'wins')::int, 0)), 100);
    END IF;
  END IF;

  -- 4. Merge highest progress from server tables, existing DB quests, and client
  v_q := jsonb_set(v_q, '{games}', to_jsonb(GREATEST(v_server_games, COALESCE((v_q->>'games')::int, 0), v_client_games)));
  v_q := jsonb_set(v_q, '{wins}', to_jsonb(GREATEST(v_server_wins, COALESCE((v_q->>'wins')::int, 0), v_client_wins)));
  v_q := jsonb_set(v_q, '{mining}', to_jsonb(GREATEST(COALESCE((v_q->>'mining')::int, 0), v_client_mining)));

  -- Update database record with synced progress
  UPDATE users
  SET daily_quests = v_q,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'daily_quests', v_q
  );
END;
$$;

-- Backward-compatible 1-argument wrapper
CREATE OR REPLACE FUNCTION public.sync_daily_quests(
  p_wallet TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.sync_daily_quests(p_wallet, NULL::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_daily_quests(TEXT, JSONB) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.sync_daily_quests(TEXT) TO authenticated, service_role, anon;


-- ==============================================================================
-- 11. ADMINISTRATION & AUTOMATION CYCLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: verify_admin_passkey
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.verify_admin_passkey(TEXT);
DROP FUNCTION IF EXISTS verify_admin_passkey(TEXT);

CREATE OR REPLACE FUNCTION public.verify_admin_passkey(p_passkey TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_salt TEXT;
  v_computed TEXT;
BEGIN
  IF p_passkey IS NULL OR TRIM(p_passkey) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT admin_key_hash, salt INTO v_hash, v_salt
  FROM public.admin_security_config
  WHERE id = 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_computed := encode(extensions.digest(TRIM(p_passkey) || v_salt, 'sha256'::text), 'hex');
  RETURN (v_computed = v_hash);
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: admin_update_global_settings
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_update_global_settings(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.admin_update_global_settings(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_global_settings(JSONB);
CREATE OR REPLACE FUNCTION public.admin_update_global_settings(
  p_payload JSONB,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.global_settings
  SET
    earn_multiplier = COALESCE((p_payload->>'earn_multiplier')::numeric, earn_multiplier),
    faucet_base_pgt = COALESCE((p_payload->>'faucet_base_pgt')::numeric, faucet_base_pgt),
    vip_faucet_base_pol = COALESCE((p_payload->>'vip_faucet_base_pol')::numeric, vip_faucet_base_pol),
    vip_faucet_min_payout_pol = COALESCE((p_payload->>'vip_faucet_min_payout_pol')::numeric, vip_faucet_min_payout_pol),
    site_message = COALESCE(p_payload->>'site_message', site_message),
    min_withdraw_pgt = COALESCE((p_payload->>'min_withdraw_pgt')::numeric, min_withdraw_pgt),
    max_withdraw_pgt = COALESCE((p_payload->>'max_withdraw_pgt')::numeric, max_withdraw_pgt),
    max_weekly_withdrawals = COALESCE((p_payload->>'max_weekly_withdrawals')::int, max_weekly_withdrawals),
    max_daily_plays_per_game = COALESCE((p_payload->>'max_daily_plays_per_game')::int, max_daily_plays_per_game),
    account_quarantine_days = COALESCE((p_payload->>'account_quarantine_days')::int, account_quarantine_days),
    discord_webhook_url = COALESCE(p_payload->>'discord_webhook_url', discord_webhook_url),
    discord_admin_webhook_url = COALESCE(p_payload->>'discord_admin_webhook_url', discord_admin_webhook_url),
    discord_announcements_webhook_url = COALESCE(p_payload->>'discord_announcements_webhook_url', discord_announcements_webhook_url),
    game_payout_settings = CASE 
      WHEN p_payload ? 'game_payout_settings' THEN p_payload->'game_payout_settings'
      ELSE game_payout_settings
    END,
    turnstile_arcade_enabled = CASE
      WHEN p_payload ? 'turnstile_arcade_enabled' THEN (p_payload->>'turnstile_arcade_enabled')::boolean
      ELSE turnstile_arcade_enabled
    END,
    turnstile_arcade_frequency = CASE
      WHEN p_payload ? 'turnstile_arcade_frequency' THEN (p_payload->>'turnstile_arcade_frequency')::int
      ELSE turnstile_arcade_frequency
    END,
    turnstile_arcade_vip_bypass = CASE
      WHEN p_payload ? 'turnstile_arcade_vip_bypass' THEN (p_payload->>'turnstile_arcade_vip_bypass')::boolean
      ELSE turnstile_arcade_vip_bypass
    END
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_global_settings(JSONB, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_update_global_settings(JSONB, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: update_game_payout_settings
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_game_payout_settings(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.update_game_payout_settings(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.update_game_payout_settings(JSONB);
CREATE OR REPLACE FUNCTION public.update_game_payout_settings(
  p_settings JSONB,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.global_settings
  SET game_payout_settings = p_settings
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_game_payout_settings(JSONB, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_game_payout_settings(JSONB, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: reset_arcade_leaderboard_scores
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reset_arcade_leaderboard_scores();
DROP FUNCTION IF EXISTS public.reset_arcade_leaderboard_scores(TEXT);
CREATE OR REPLACE FUNCTION public.reset_arcade_leaderboard_scores(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE users
  SET
    game_highscore = 0,
    invaders_highscore = 0,
    drift_highscore = 0,
    stacker_highscore = 0,
    skeet_highscore = 0,
    defense_highscore = 0,
    weekly_faucet_claims = 0,
    weekly_games_played = 0,
    weekly_active_tier = 0
  WHERE
    game_highscore > 0
    OR invaders_highscore > 0
    OR drift_highscore > 0
    OR stacker_highscore > 0
    OR skeet_highscore > 0
    OR defense_highscore > 0
    OR weekly_faucet_claims > 0
    OR weekly_games_played > 0
    OR weekly_active_tier > 0;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_reset', v_updated_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_arcade_leaderboard_scores(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reset_arcade_leaderboard_scores(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: distribute_weekly_arcade_prizes
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.distribute_weekly_arcade_prizes();
DROP FUNCTION IF EXISTS public.distribute_weekly_arcade_prizes(TEXT);
CREATE OR REPLACE FUNCTION public.distribute_weekly_arcade_prizes(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_week_label TEXT := TO_CHAR(NOW(), 'YYYY-MM-DD');
  v_settings JSONB;
  v_rec RECORD;
  v_rank INT;
  v_prize NUMERIC;
  v_pool NUMERIC;
  v_total_distributed NUMERIC := 0;
  v_total_winners INT := 0;
  v_games_processed TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  -- Fetch Dynamic Settings from global_settings
  SELECT game_payout_settings INTO v_settings FROM global_settings WHERE id = 1;

  -- 1. ASTRO-DODGE POOL
  v_pool := COALESCE((v_settings->'astrododge'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, game_highscore AS score
      FROM users WHERE COALESCE(game_highscore, 0) > 0 ORDER BY game_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, astrododge_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'astrododge', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'astrododge');
  END IF;

  -- 2. CYBER INVADERS POOL
  v_pool := COALESCE((v_settings->'invaders'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, invaders_highscore AS score
      FROM users WHERE COALESCE(invaders_highscore, 0) > 0 ORDER BY invaders_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, invaders_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'invaders', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'invaders');
  END IF;

  -- 3. CYBER DRIFT POOL
  v_pool := COALESCE((v_settings->'drift'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, drift_highscore AS score
      FROM users WHERE COALESCE(drift_highscore, 0) > 0 ORDER BY drift_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, drift_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'drift', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'drift');
  END IF;

  -- 4. CYBER STACKER POOL
  v_pool := COALESCE((v_settings->'stacker'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, stacker_highscore AS score
      FROM users WHERE COALESCE(stacker_highscore, 0) > 0 ORDER BY stacker_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, stacker_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'stacker', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'stacker');
  END IF;

  -- 5. CYBER SKEET POOL
  v_pool := COALESCE((v_settings->'skeet'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, skeet_highscore AS score
      FROM users WHERE COALESCE(skeet_highscore, 0) > 0 ORDER BY skeet_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, skeet_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'skeet', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'skeet');
  END IF;

  -- 6. CYBER DEFENSE POOL
  v_pool := COALESCE((v_settings->'defense'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, defense_highscore AS score
      FROM users WHERE COALESCE(defense_highscore, 0) > 0 ORDER BY defense_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, defense_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'defense', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'defense');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', v_total_distributed,
    'winner_count', v_total_winners,
    'games_processed', v_games_processed
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.distribute_weekly_arcade_prizes(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.distribute_weekly_arcade_prizes(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: snapshot_weekly_activity_tiers
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.snapshot_weekly_activity_tiers();
DROP FUNCTION IF EXISTS public.snapshot_weekly_activity_tiers(TEXT);
CREATE OR REPLACE FUNCTION public.snapshot_weekly_activity_tiers(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.users
  SET 
    last_weekly_active_tier = CASE 
      WHEN COALESCE(weekly_active_tier, 0) > 0 THEN weekly_active_tier
      ELSE COALESCE(last_weekly_active_tier, 0)
    END,
    weekly_faucet_claims = 0,
    weekly_games_played = 0,
    weekly_active_tier = 0,
    updated_at = NOW()
  WHERE 
    COALESCE(weekly_active_tier, 0) > 0 
    OR COALESCE(weekly_faucet_claims, 0) > 0 
    OR COALESCE(weekly_games_played, 0) > 0;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_snapshotted', v_updated_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.snapshot_weekly_activity_tiers(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.snapshot_weekly_activity_tiers(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: execute_weekly_payout_and_reset
-- Source: fix_weekly_reset_activity_counters.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.execute_weekly_payout_and_reset();
DROP FUNCTION IF EXISTS public.execute_weekly_payout_and_reset(TEXT);
CREATE OR REPLACE FUNCTION public.execute_weekly_payout_and_reset(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_arcade_res JSONB;
  v_boss_res JSONB;
  v_activity_res JSONB;
  v_scores_res JSONB;
BEGIN
  -- Strict Master Admin Passkey Verification
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Master Admin Passkey');
  END IF;

  -- 1. Distribute Arcade Leaderboard Prizes (Step 1)
  v_arcade_res := public.distribute_weekly_arcade_prizes(p_admin_passkey);

  -- 2. Distribute World Boss Bounty Loot (Step 2)
  BEGIN
    v_boss_res := public.distribute_weekly_boss_prizes(p_admin_passkey);
  EXCEPTION WHEN OTHERS THEN
    v_boss_res := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  -- 3. Snapshot Activity Tiers & Reset Active Counters (Step 3)
  v_activity_res := public.snapshot_weekly_activity_tiers(p_admin_passkey);

  -- 4. Reset Weekly Arcade Scores to 0 (Step 4)
  v_scores_res := public.reset_arcade_leaderboard_scores(p_admin_passkey);

  -- 5. Extra Safeguard: Zero out active weekly faucet/gameplay counters
  UPDATE public.users 
  SET weekly_faucet_claims = 0,
      weekly_games_played = 0,
      weekly_active_tier = 0
  WHERE COALESCE(weekly_faucet_claims, 0) > 0 
     OR COALESCE(weekly_games_played, 0) > 0 
     OR COALESCE(weekly_active_tier, 0) > 0;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', COALESCE((v_arcade_res->>'total_distributed')::numeric, 0),
    'winner_count', COALESCE((v_arcade_res->>'winner_count')::int, 0),
    'games_processed', v_arcade_res->'games_processed',
    'week_label', v_arcade_res->>'week_label',
    'arcade_payout', v_arcade_res,
    'boss_payout', v_boss_res,
    'activity_snapshot', v_activity_res,
    'scores_reset', v_scores_res
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_weekly_payout_and_reset(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.execute_weekly_payout_and_reset(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: complete_pol_payout_request
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.complete_pol_payout_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.complete_pol_payout_request(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.complete_pol_payout_request(
  p_request_id UUID,
  p_tx_hash TEXT,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.pol_payout_requests
  SET status = 'paid',
      tx_hash = p_tx_hash,
      processed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_pol_payout_request(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.complete_pol_payout_request(UUID, TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC 2: reject_pol_payout_request (Master Admin Fraud Payout Rejection)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reject_pol_payout_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_pol_payout_request(UUID);
DROP FUNCTION IF EXISTS public.reject_pol_payout_request(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.reject_pol_payout_request(
  p_request_id UUID,
  p_reason TEXT DEFAULT 'Fraudulent or unverified transaction',
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.pol_payout_requests
  SET status = 'rejected',
      processed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', 'rejected', 'reason', p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_pol_payout_request(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reject_pol_payout_request(UUID, TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: toggle_ambassador_status
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.toggle_ambassador_status(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.toggle_ambassador_status(TEXT, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION public.toggle_ambassador_status(
  p_target_wallet TEXT,
  p_is_ambassador BOOLEAN,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_id TEXT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  p_target_wallet := LOWER(TRIM(p_target_wallet));

  SELECT resolve_player_id(p_target_wallet) INTO v_player_id;

  IF v_player_id IS NULL THEN
    SELECT player_id INTO v_player_id
    FROM users
    WHERE LOWER(player_id) = p_target_wallet 
       OR LOWER(linked_wallet_address) = p_target_wallet
    LIMIT 1;
  END IF;

  IF v_player_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  UPDATE users
  SET is_ambassador = p_is_ambassador,
      updated_at = NOW()
  WHERE player_id = v_player_id;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_player_id,
    'is_ambassador', p_is_ambassador
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_ambassador_status(TEXT, BOOLEAN, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toggle_ambassador_status(TEXT, BOOLEAN, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: prune_old_arcade_sessions
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.prune_old_arcade_sessions(INTEGER);
DROP FUNCTION IF EXISTS public.prune_old_arcade_sessions(INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.prune_old_arcade_sessions(
  p_days INTEGER DEFAULT 7,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  DELETE FROM arcade_sessions
  WHERE created_at < (NOW() - (p_days || ' days')::INTERVAL);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted);
END;
$$;
GRANT EXECUTE ON FUNCTION public.prune_old_arcade_sessions(INTEGER, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.prune_old_arcade_sessions(INTEGER, TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: prune_old_bet_wins
-- Source: add_bet_losses_and_pruning.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.prune_old_bet_wins(INTEGER);
DROP FUNCTION IF EXISTS public.prune_old_bet_wins(INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.prune_old_bet_wins(
  p_days INTEGER DEFAULT 30,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  DELETE FROM public.bet_wins
  WHERE created_at < (NOW() - (p_days || ' days')::INTERVAL);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted, 'purged_count', v_deleted);
END;
$$;
GRANT EXECUTE ON FUNCTION public.prune_old_bet_wins(INTEGER, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.prune_old_bet_wins(INTEGER, TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: reset_arcade_game_metrics
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reset_arcade_game_metrics();
DROP FUNCTION IF EXISTS public.reset_arcade_game_metrics(TEXT);
CREATE OR REPLACE FUNCTION public.reset_arcade_game_metrics(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  DELETE FROM arcade_game_metrics;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_arcade_game_metrics(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reset_arcade_game_metrics(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: sanitize_user_email_protection
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sanitize_user_email_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := NULL;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: toggle_user_ban
-- Source: add_anti_bot_detection_and_warning_system.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.toggle_user_ban(TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.toggle_user_ban(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS toggle_user_ban(TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS toggle_user_ban(TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.toggle_user_ban(
  p_target_wallet TEXT,
  p_is_banned BOOLEAN,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  v_pid := resolve_player_id(p_target_wallet);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_target_wallet, '')));
  END IF;

  UPDATE public.users
  SET is_banned = p_is_banned,
      updated_at = NOW()
  WHERE player_id = v_pid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'player_id', v_pid, 'is_banned', p_is_banned);
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_user_ban(TEXT, BOOLEAN, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toggle_user_ban(TEXT, BOOLEAN, TEXT) FROM anon;



-- ==============================================================================
-- 12. MASTER POSTGREST ANTI-CHEAT TRIGGER (SECURITY INVOKER)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: prevent_direct_balance_mutation
-- Source: drop_is_liquidity_provider_and_sync_dex_usd.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_r_key TEXT;
  v_old_unm INT;
  v_new_unm INT;
  v_merged_r JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_fleet_warp INT;
  v_allowed_slots INT;
  v_exp_arr JSONB;
BEGIN
  -- Restrict direct PostgREST client queries (anon & authenticated roles)
  -- Legitimate SECURITY DEFINER procedures run as 'postgres' and bypass this check.
  IF LOWER(CURRENT_USER) IN ('anon', 'authenticated') THEN

    IF TG_OP = 'INSERT' THEN
      -- 1. Anti-Bot Registration Guard: Reject automated test fixtures
      IF NEW.auth_provider IS NOT NULL AND (NEW.auth_provider ILIKE '%fixture%' OR NEW.auth_provider ILIKE '%__test%') THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Test fixtures disallowed in production.';
      END IF;

      -- Player ID must start with 0x and be at least 5 characters (supports 0xpgt..., 0xg..., 0xguest..., and 42-char EVM addresses)
      IF NEW.player_id IS NULL 
         OR NEW.player_id ILIKE 'test_%'
         OR NEW.player_id NOT ILIKE '0x%'
         OR LENGTH(NEW.player_id) < 5 THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Invalid player ID format.';
      END IF;

      IF NEW.username IS NOT NULL AND NEW.username ILIKE '%__test__%' THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Test fixtures disallowed in production.';
      END IF;

      IF NEW.linked_wallet_address IS NOT NULL AND NEW.linked_wallet_address <> '' THEN
        IF NEW.linked_wallet_address ~ '00000000000000000000' THEN
          RAISE EXCEPTION 'REGISTRATION_REJECTED: Dummy wallet address rejected.';
        END IF;
      END IF;

      -- 2. Sanitize newly inserted accounts against elevated balances & privileges
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.dex_liquidity_usd := 0.0;
      NEW.is_banned := false;
      NEW.bot_warning := 0;
      NEW.vip_until := NULL;
      NEW.total_earned := 0.0;
      NEW.total_arcade_plays := 0;
      NEW.game_highscore := 0;
      NEW.invaders_highscore := 0;
      NEW.drift_highscore := 0;
      NEW.stacker_highscore := 0;
      NEW.skeet_highscore := 0;
      NEW.defense_highscore := 0;
      NEW.boss_weekly_damage := 0;
      NEW.alltime_boss_damage := 0;
      NEW.boss_attacks_count := 0;
      NEW.weekly_faucet_claims := 0;
      NEW.weekly_games_played := 0;
      NEW.weekly_active_tier := 0;
      NEW.last_weekly_active_tier := 0;
      NEW.faucet_streak := 0;
      NEW.vip_faucet_streak := 0;
      NEW.unclaimed_referral_pgt := 0.0;
      NEW.unclaimed_referral_pol := 0.0;
      NEW.total_referral_commission := 0.0;
      NEW.total_referral_pol := 0.0;
      NEW.unclaimed_vip_faucet_pol := 0.0;
      NEW.total_vip_faucet_pol := 0.0;
      NEW.owned_nfts := '[]'::jsonb;
      NEW.crate_nfts := '[]'::jsonb;
      NEW.relics := '{}'::jsonb;
      NEW.last_turnstile_at := NULL;
      NEW.daily_quests := jsonb_build_object(
        'date', v_today,
        'games', 0, 'mining', 0, 'wins', 0,
        'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
        'master_claimed', false, 'streak_days', 0, 'last_streak_date', ''
      );

      -- Prevent setting fake referrals on account creation
      NEW.referrals_count := 0;
      NEW.referrals_l1 := 0;
      NEW.referrals_l2 := 0;
      NEW.referrals_l3 := 0;
      NEW.referrals_l4 := 0;
      NEW.referrals_list := '[]'::jsonb;
      NEW.referred_by_l1 := NULL;
      NEW.referred_by_l2 := NULL;
      NEW.referred_by_l3 := NULL;
      NEW.referred_by_l4 := NULL;

      -- Prevent squatting on existing player IDs or wallet addresses with referral_code on account creation
      IF NEW.referral_code IS NOT NULL AND NEW.referral_code <> '' THEN
        IF EXISTS (
          SELECT 1 FROM public.users 
          WHERE LOWER(player_id) = LOWER(NEW.referral_code) 
             OR (linked_wallet_address IS NOT NULL AND LOWER(linked_wallet_address) = LOWER(NEW.referral_code))
        ) THEN
          NEW.referral_code := 'ref_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 8);
        END IF;
      END IF;

      -- Clamp starting minerals & space statistics
      IF NEW.space_state IS NOT NULL THEN
        NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{fleetPower}', '380'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{raidsWon}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{pgtMinedTotal}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{mineralsMinedTotal}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'iron')::numeric, 50), 50)));
        NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'titanium')::numeric, 10), 10)));
        NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{expeditions}', '[]'::jsonb);
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Immutable registration timestamp
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;

      -- 2. Immutable balances (PGT mutations MUST go through SECURITY DEFINER RPCs)
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;

      -- 3. Immutable roles, LP status, and VIP / ban status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.dex_liquidity_usd IS DISTINCT FROM OLD.dex_liquidity_usd THEN
        NEW.dex_liquidity_usd := OLD.dex_liquidity_usd;
      END IF;
      IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
        NEW.is_banned := OLD.is_banned;
      END IF;
      IF NEW.bot_warning < OLD.bot_warning THEN
        NEW.bot_warning := OLD.bot_warning;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
      END IF;

      -- 4. Immutable career total_arcade_plays (server RPC controlled only)
      IF NEW.total_arcade_plays IS DISTINCT FROM OLD.total_arcade_plays THEN
        NEW.total_arcade_plays := OLD.total_arcade_plays;
      END IF;

      -- 4b. Immutable Turnstile verification timestamp (server RPC controlled only)
      IF NEW.last_turnstile_at IS DISTINCT FROM OLD.last_turnstile_at THEN
        NEW.last_turnstile_at := OLD.last_turnstile_at;
      END IF;

      -- 5. Immutable faucet timestamps & streaks (seals cooldown-wiping exploit)
      IF NEW.last_faucet_claim IS DISTINCT FROM OLD.last_faucet_claim THEN
        NEW.last_faucet_claim := OLD.last_faucet_claim;
      END IF;
      IF NEW.faucet_streak IS DISTINCT FROM OLD.faucet_streak THEN
        NEW.faucet_streak := OLD.faucet_streak;
      END IF;
      IF NEW.last_vip_faucet_claim IS DISTINCT FROM OLD.last_vip_faucet_claim THEN
        NEW.last_vip_faucet_claim := OLD.last_vip_faucet_claim;
      END IF;
      IF NEW.vip_faucet_streak IS DISTINCT FROM OLD.vip_faucet_streak THEN
        NEW.vip_faucet_streak := OLD.vip_faucet_streak;
      END IF;

      -- 6. Immutable weekly activity counters
      IF NEW.weekly_faucet_claims IS DISTINCT FROM OLD.weekly_faucet_claims THEN
        NEW.weekly_faucet_claims := OLD.weekly_faucet_claims;
      END IF;
      IF NEW.weekly_games_played IS DISTINCT FROM OLD.weekly_games_played THEN
        NEW.weekly_games_played := OLD.weekly_games_played;
      END IF;
      IF NEW.weekly_active_tier IS DISTINCT FROM OLD.weekly_active_tier THEN
        NEW.weekly_active_tier := OLD.weekly_active_tier;
      END IF;

      -- 7. High score ceiling (max 500,000 pts) & rollback prevention
      IF NEW.game_highscore > 500000 THEN
        NEW.game_highscore := OLD.game_highscore;
      ELSIF NEW.game_highscore < OLD.game_highscore THEN
        NEW.game_highscore := OLD.game_highscore;
      END IF;

      IF NEW.invaders_highscore > 500000 THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      ELSIF NEW.invaders_highscore < OLD.invaders_highscore THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      END IF;

      IF NEW.drift_highscore > 500000 THEN
        NEW.drift_highscore := OLD.drift_highscore;
      ELSIF NEW.drift_highscore < OLD.drift_highscore THEN
        NEW.drift_highscore := OLD.drift_highscore;
      END IF;

      IF NEW.stacker_highscore > 500000 THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      ELSIF NEW.stacker_highscore < OLD.stacker_highscore THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      END IF;

      IF NEW.skeet_highscore > 500000 THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      ELSIF NEW.skeet_highscore < OLD.skeet_highscore THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      END IF;

      IF NEW.defense_highscore > 500000 THEN
        NEW.defense_highscore := OLD.defense_highscore;
      ELSIF NEW.defense_highscore < OLD.defense_highscore THEN
        NEW.defense_highscore := OLD.defense_highscore;
      END IF;

      -- Also clamp all-time score equivalents if client attempts direct update
      IF NEW.alltime_game_highscore > 500000 THEN NEW.alltime_game_highscore := OLD.alltime_game_highscore; END IF;
      IF NEW.alltime_invaders_highscore > 500000 THEN NEW.alltime_invaders_highscore := OLD.alltime_invaders_highscore; END IF;
      IF NEW.alltime_drift_highscore > 500000 THEN NEW.alltime_drift_highscore := OLD.alltime_drift_highscore; END IF;
      IF NEW.alltime_stacker_highscore > 500000 THEN NEW.alltime_stacker_highscore := OLD.alltime_stacker_highscore; END IF;
      IF NEW.alltime_skeet_highscore > 500000 THEN NEW.alltime_skeet_highscore := OLD.alltime_skeet_highscore; END IF;
      IF NEW.defense_alltime_best > 500000 THEN NEW.defense_alltime_best := OLD.defense_alltime_best; END IF;

      -- 8. Immutable referral commissions & VIP POL yields
      IF NEW.unclaimed_referral_pgt IS DISTINCT FROM OLD.unclaimed_referral_pgt THEN
        NEW.unclaimed_referral_pgt := OLD.unclaimed_referral_pgt;
      END IF;
      IF NEW.unclaimed_referral_pol IS DISTINCT FROM OLD.unclaimed_referral_pol THEN
        NEW.unclaimed_referral_pol := OLD.unclaimed_referral_pol;
      END IF;
      IF NEW.total_referral_commission IS DISTINCT FROM OLD.total_referral_commission THEN
        NEW.total_referral_commission := OLD.total_referral_commission;
      END IF;
      IF NEW.total_referral_pol IS DISTINCT FROM OLD.total_referral_pol THEN
        NEW.total_referral_pol := OLD.total_referral_pol;
      END IF;
      IF NEW.unclaimed_vip_faucet_pol IS DISTINCT FROM OLD.unclaimed_vip_faucet_pol THEN
        NEW.unclaimed_vip_faucet_pol := OLD.unclaimed_vip_faucet_pol;
      END IF;
      IF NEW.total_vip_faucet_pol IS DISTINCT FROM OLD.total_vip_faucet_pol THEN
        NEW.total_vip_faucet_pol := OLD.total_vip_faucet_pol;
      END IF;

      -- Immutable referral tree statistics, referral list & upline parent links on direct client UPDATE
      -- Once an upline is established, it can NEVER be stolen, overwritten, or modified by client queries.
      IF NEW.referred_by_l1 IS DISTINCT FROM OLD.referred_by_l1 THEN
        NEW.referred_by_l1 := OLD.referred_by_l1;
      END IF;
      IF NEW.referred_by_l2 IS DISTINCT FROM OLD.referred_by_l2 THEN
        NEW.referred_by_l2 := OLD.referred_by_l2;
      END IF;
      IF NEW.referred_by_l3 IS DISTINCT FROM OLD.referred_by_l3 THEN
        NEW.referred_by_l3 := OLD.referred_by_l3;
      END IF;
      IF NEW.referred_by_l4 IS DISTINCT FROM OLD.referred_by_l4 THEN
        NEW.referred_by_l4 := OLD.referred_by_l4;
      END IF;
      IF NEW.referrals_count IS DISTINCT FROM OLD.referrals_count THEN
        NEW.referrals_count := OLD.referrals_count;
      END IF;
      IF NEW.referrals_l1 IS DISTINCT FROM OLD.referrals_l1 THEN
        NEW.referrals_l1 := OLD.referrals_l1;
      END IF;
      IF NEW.referrals_l2 IS DISTINCT FROM OLD.referrals_l2 THEN
        NEW.referrals_l2 := OLD.referrals_l2;
      END IF;
      IF NEW.referrals_l3 IS DISTINCT FROM OLD.referrals_l3 THEN
        NEW.referrals_l3 := OLD.referrals_l3;
      END IF;
      IF NEW.referrals_l4 IS DISTINCT FROM OLD.referrals_l4 THEN
        NEW.referrals_l4 := OLD.referrals_l4;
      END IF;
      IF NEW.referrals_list IS DISTINCT FROM OLD.referrals_list THEN
        NEW.referrals_list := OLD.referrals_list;
      END IF;

      -- Immutable referral_code: Once assigned, a user can NEVER alter or hijack their referral code
      IF OLD.referral_code IS NOT NULL AND OLD.referral_code <> '' AND OLD.referral_code <> 'EMPTY' THEN
        IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
          NEW.referral_code := OLD.referral_code;
        END IF;
      END IF;

      -- On initial referral_code assignment, prevent squatting on existing player IDs or wallet addresses
      IF NEW.referral_code IS NOT NULL AND NEW.referral_code <> '' THEN
        IF EXISTS (
          SELECT 1 FROM public.users 
          WHERE LOWER(player_id) = LOWER(NEW.referral_code) 
             OR (linked_wallet_address IS NOT NULL AND LOWER(linked_wallet_address) = LOWER(NEW.referral_code))
        ) THEN
          NEW.referral_code := OLD.referral_code;
        END IF;
      END IF;

      -- 9. Immutable Inventory: owned_nfts & crate_nfts
      IF NEW.owned_nfts IS DISTINCT FROM OLD.owned_nfts THEN
        NEW.owned_nfts := OLD.owned_nfts;
      END IF;
      IF NEW.crate_nfts IS DISTINCT FROM OLD.crate_nfts THEN
        NEW.crate_nfts := OLD.crate_nfts;
      END IF;

      -- 10. Immutable Relics Inventory (Mutations MUST go through SECURITY DEFINER RPCs)
      -- Direct client saves (anon/authenticated) can NEVER delete, clobber, or alter existing relics
      IF NEW.relics IS DISTINCT FROM OLD.relics THEN
        NEW.relics := OLD.relics;
      END IF;

      -- 11. PolySpace Fleet Upgrades & Mineral Protections
      IF NEW.space_state IS NOT NULL THEN
        -- Preserve existing state fields so partial client updates cannot wipe fleet or minerals
        IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
          NEW.space_state := OLD.space_state || NEW.space_state;
        END IF;

        -- 11a. Module Levels (Module upgrades MUST go through upgrade_polyspace_module RPC)
        -- Direct PostgREST client updates cannot increase module levels!
        IF COALESCE((NEW.space_state->>'warpLevel')::integer, 1) > COALESCE((OLD.space_state->>'warpLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', to_jsonb(COALESCE((OLD.space_state->>'warpLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'laserLevel')::integer, 1) > COALESCE((OLD.space_state->>'laserLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', to_jsonb(COALESCE((OLD.space_state->>'laserLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'cargoLevel')::integer, 1) > COALESCE((OLD.space_state->>'cargoLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', to_jsonb(COALESCE((OLD.space_state->>'cargoLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'shieldLevel')::integer, 1) > COALESCE((OLD.space_state->>'shieldLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', to_jsonb(COALESCE((OLD.space_state->>'shieldLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'turretLevel')::integer, 1) > COALESCE((OLD.space_state->>'turretLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', to_jsonb(COALESCE((OLD.space_state->>'turretLevel')::integer, 1)));
        END IF;

        -- 11b. Space Minerals (Can only be earned via expeditions, smelting, anomalies, or boss)
        -- Direct PostgREST client updates cannot inflate mineral balances!
        IF COALESCE((NEW.space_state->>'iron')::numeric, 0) > COALESCE((OLD.space_state->>'iron')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(COALESCE((OLD.space_state->>'iron')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'titanium')::numeric, 0) > COALESCE((OLD.space_state->>'titanium')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(COALESCE((OLD.space_state->>'titanium')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'quantum')::numeric, 0) > COALESCE((OLD.space_state->>'quantum')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', to_jsonb(COALESCE((OLD.space_state->>'quantum')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'pgtOre')::numeric, 0) > COALESCE((OLD.space_state->>'pgtOre')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', to_jsonb(COALESCE((OLD.space_state->>'pgtOre')::numeric, 0)));
        END IF;

        -- 11c. Space Career Statistics & Milestones (Server RPC controlled only)
        -- Direct PostgREST client updates cannot inflate raidsWon, pgtMinedTotal, or mineralsMinedTotal!
        IF COALESCE((NEW.space_state->>'raidsWon')::numeric, 0) > COALESCE((OLD.space_state->>'raidsWon')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{raidsWon}', to_jsonb(COALESCE((OLD.space_state->>'raidsWon')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'pgtMinedTotal')::numeric, 0) > COALESCE((OLD.space_state->>'pgtMinedTotal')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{pgtMinedTotal}', to_jsonb(COALESCE((OLD.space_state->>'pgtMinedTotal')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'mineralsMinedTotal')::numeric, 0) > COALESCE((OLD.space_state->>'mineralsMinedTotal')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((OLD.space_state->>'mineralsMinedTotal')::numeric, 0)));
        END IF;

        -- 11d. Fleet Power (Deterministic calculation from validated module levels)
        NEW.space_state := jsonb_set(
          NEW.space_state,
          '{fleetPower}',
          to_jsonb(
            (GREATEST(1, COALESCE((NEW.space_state->>'warpLevel')::integer, 1)) * 100) +
            (GREATEST(1, COALESCE((NEW.space_state->>'laserLevel')::integer, 1)) * 80) +
            (GREATEST(1, COALESCE((NEW.space_state->>'cargoLevel')::integer, 1)) * 50) +
            (GREATEST(1, COALESCE((NEW.space_state->>'shieldLevel')::integer, 1)) * 60) +
            (GREATEST(1, COALESCE((NEW.space_state->>'turretLevel')::integer, 1)) * 90)
          )
        );

        -- 11e. Protect Outpost & Deep-Space Cooldowns from Client Rollback/Wiping
        IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
          -- Never allow client to wipe or backdate lastPokeDate
          IF OLD.space_state->>'lastPokeDate' IS NOT NULL THEN
            IF NEW.space_state->>'lastPokeDate' IS NULL OR NEW.space_state->>'lastPokeDate' < OLD.space_state->>'lastPokeDate' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastPokeDate}', OLD.space_state->'lastPokeDate');
            END IF;
          END IF;

          -- Never allow client to wipe or backdate lastRaidDate
          IF OLD.space_state->>'lastRaidDate' IS NOT NULL THEN
            IF NEW.space_state->>'lastRaidDate' IS NULL OR NEW.space_state->>'lastRaidDate' < OLD.space_state->>'lastRaidDate' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastRaidDate}', OLD.space_state->'lastRaidDate');
            END IF;
          END IF;

          -- Never allow client to roll back anomaly scan timestamp
          IF OLD.space_state->>'lastAnomalyScanTime' IS NOT NULL THEN
            IF COALESCE((NEW.space_state->>'lastAnomalyScanTime')::bigint, 0) < COALESCE((OLD.space_state->>'lastAnomalyScanTime')::bigint, 0) THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastAnomalyScanTime}', OLD.space_state->'lastAnomalyScanTime');
            END IF;
          END IF;

          -- 11f. Immutable Fleet Expeditions (Server RPC Controlled Only)
          -- Direct PostgREST client updates (anon/authenticated) can NEVER alter or inject expeditions!
          -- Expeditions are strictly managed via start_polyspace_expedition, claim_polyspace_expedition, and cancel_polyspace_expedition
          IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
            NEW.space_state := jsonb_set(NEW.space_state, '{expeditions}', COALESCE(OLD.space_state->'expeditions', '[]'::jsonb));
          END IF;
        END IF;
      END IF;

      -- 12. Immutable Daily Quests: Direct client updates (anon/authenticated) can NEVER alter daily_quests
      -- Daily quests are strictly server-authoritative and managed via claim_daily_quest RPC.
      IF NEW.daily_quests IS DISTINCT FROM OLD.daily_quests THEN
        NEW.daily_quests := OLD.daily_quests;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------------------------
-- Ensure trigger is bound to public.users
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trigger_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();
-- ------------------------------------------------------------------------------
-- RPC: delete_user_account (Hardened against unauthenticated deletion & Master Admin protected)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_user_account(UUID, TEXT);
DROP FUNCTION IF EXISTS public.delete_user_account(UUID);
DROP FUNCTION IF EXISTS public.delete_user_account(TEXT);
DROP FUNCTION IF EXISTS delete_user_account(UUID, TEXT);
DROP FUNCTION IF EXISTS delete_user_account(UUID);
DROP FUNCTION IF EXISTS delete_user_account(TEXT);
CREATE OR REPLACE FUNCTION public.delete_user_account(
  p_user_id UUID DEFAULT NULL,
  p_wallet TEXT DEFAULT NULL
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE
  v_caller TEXT := LOWER(COALESCE(CURRENT_USER, ''));
  v_auth_uid UUID := auth.uid();
  v_clean_wallet TEXT := LOWER(TRIM(COALESCE(p_wallet, '')));
  v_pid TEXT;
  v_deleted_count INT := 0;
  v_admin_wallet TEXT := '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';
BEGIN
  -- 1. HARD SHIELD: Master Admin wallet can NEVER be deleted
  IF v_clean_wallet = v_admin_wallet THEN
    RETURN jsonb_build_object('success', false, 'error', 'Security Violation: Master Admin account cannot be deleted under any circumstance.');
  END IF;

  -- Check if target resolves to Master Admin
  IF v_clean_wallet <> '' THEN
    v_pid := resolve_player_id(v_clean_wallet);
    IF LOWER(COALESCE(v_pid, '')) = v_admin_wallet THEN
      RETURN jsonb_build_object('success', false, 'error', 'Security Violation: Master Admin account cannot be deleted.');
    END IF;
  END IF;

  -- 2. Authenticated Social / Email Deletions (Google / Email)
  IF p_user_id IS NOT NULL THEN
    IF v_caller IN ('anon', 'authenticated') AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You can only delete your own authenticated account.');
    END IF;

    DELETE FROM public.users 
    WHERE (user_id = p_user_id OR web3_auth_id = p_user_id)
      AND LOWER(COALESCE(linked_wallet_address, '')) <> v_admin_wallet;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully by authenticated user_id.', 'deleted_rows', v_deleted_count);

  -- 3. Web3 Wallet Deletions
  ELSIF v_clean_wallet <> '' THEN
    IF v_caller IN ('anon', 'authenticated') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Direct wallet deletion is disabled for security. Web3 accounts cannot be deleted via unauthenticated API calls.');
    END IF;

    DELETE FROM public.users 
    WHERE (LOWER(player_id) = v_clean_wallet 
       OR LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean_wallet)
      AND LOWER(COALESCE(linked_wallet_address, '')) <> v_admin_wallet
      AND LOWER(player_id) <> v_admin_wallet;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully by wallet/player_id.', 'deleted_rows', v_deleted_count);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Missing user ID or wallet address.');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.delete_user_account(UUID, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: bind_web3_user_session
-- Source: bind_web3_auth_user.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.bind_web3_user_session(TEXT);
DROP FUNCTION IF EXISTS bind_web3_user_session(TEXT);
CREATE OR REPLACE FUNCTION public.bind_web3_user_session(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_auth_uid UUID;
  v_target_wallet TEXT;
  v_user_row RECORD;
  v_placeholder_row RECORD;
  v_auth_wallet TEXT;
BEGIN
  -- 1. Must be called by an authenticated user (Supabase Auth session)
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED', 'message', 'Must have an active Supabase Auth session.');
  END IF;

  v_target_wallet := LOWER(TRIM(p_wallet));
  IF v_target_wallet IS NULL OR v_target_wallet !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_WALLET', 'message', 'Invalid Web3 EVM wallet address.');
  END IF;

  -- 2. Verify caller authenticity:
  -- If JWT claims or auth.users contain an address, assert that caller owns this wallet!
  v_auth_wallet := LOWER(COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'address',
    auth.jwt() -> 'user_metadata' ->> 'wallet_address',
    CASE WHEN auth.jwt() -> 'user_metadata' ->> 'sub' ~ '^0x[a-fA-F0-9]{40}$' THEN auth.jwt() -> 'user_metadata' ->> 'sub' ELSE NULL END,
    CASE WHEN auth.jwt() ->> 'email' ~ '^0x[a-fA-F0-9]{40}@' THEN SPLIT_PART(auth.jwt() ->> 'email', '@', 1) ELSE NULL END
  ));

  IF v_auth_wallet IS NULL THEN
    BEGIN
      SELECT LOWER(COALESCE(
        raw_user_meta_data ->> 'address',
        raw_user_meta_data ->> 'wallet_address',
        CASE WHEN raw_user_meta_data ->> 'sub' ~ '^0x[a-fA-F0-9]{40}$' THEN raw_user_meta_data ->> 'sub' ELSE NULL END,
        CASE WHEN email ~ '^0x[a-fA-F0-9]{40}@' THEN SPLIT_PART(email, '@', 1) ELSE NULL END
      )) INTO v_auth_wallet
      FROM auth.users
      WHERE id = v_auth_uid;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_auth_wallet IS NULL THEN
    BEGIN
      SELECT LOWER(COALESCE(
        identity_data ->> 'address',
        identity_data ->> 'wallet_address',
        CASE WHEN provider_id ~ '^0x[a-fA-F0-9]{40}$' THEN provider_id ELSE NULL END
      )) INTO v_auth_wallet
      FROM auth.identities
      WHERE user_id = v_auth_uid
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- If the authenticated provider explicitly identified the wallet, ensure it matches!
  IF v_auth_wallet IS NOT NULL AND v_auth_wallet <> v_target_wallet THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED_WALLET',
      'message', 'Authenticated wallet does not match target wallet parameter.'
    );
  END IF;

  -- 3. Check if a dummy placeholder row was created for this auth.uid()
  SELECT * INTO v_placeholder_row
  FROM public.users
  WHERE user_id = v_auth_uid OR web3_auth_id = v_auth_uid
  ORDER BY created_at DESC
  LIMIT 1;

  -- 4. Locate the user's real row in public.users
  SELECT * INTO v_user_row
  FROM public.users
  WHERE LOWER(linked_wallet_address) = v_target_wallet
     OR LOWER(player_id) = v_target_wallet
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_row.player_id IS NOT NULL THEN
    -- Delete empty placeholder if a separate one was auto-created during auth event
    IF v_placeholder_row.player_id IS NOT NULL AND v_placeholder_row.player_id <> v_user_row.player_id THEN
      DELETE FROM public.users WHERE player_id = v_placeholder_row.player_id;
    END IF;

    -- Bind authenticated auth.uid() to the real user row:
    -- If user_id is already set to another identity (e.g. Google OAuth UID for Fill),
    -- preserve their Google user_id and store this Web3 session in web3_auth_id!
    IF v_user_row.user_id IS NOT NULL AND v_user_row.user_id <> v_auth_uid THEN
      UPDATE public.users
      SET web3_auth_id = v_auth_uid,
          linked_wallet_address = COALESCE(linked_wallet_address, v_target_wallet),
          updated_at = NOW()
      WHERE player_id = v_user_row.player_id;
    ELSE
      -- Primary binding (pure Web3 user, or unlinked profile)
      UPDATE public.users
      SET user_id = COALESCE(user_id, v_auth_uid),
          web3_auth_id = v_auth_uid,
          linked_wallet_address = COALESCE(linked_wallet_address, v_target_wallet),
          updated_at = NOW()
      WHERE player_id = v_user_row.player_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'player_id', v_user_row.player_id,
      'user_id', COALESCE(v_user_row.user_id, v_auth_uid)::TEXT,
      'web3_auth_id', v_auth_uid::TEXT,
      'linked_wallet_address', COALESCE(v_user_row.linked_wallet_address, v_target_wallet)
    );
  ELSE
    -- No profile row with this wallet found yet:
    IF v_placeholder_row.player_id IS NOT NULL THEN
      UPDATE public.users
      SET linked_wallet_address = v_target_wallet,
          web3_auth_id = v_auth_uid,
          updated_at = NOW()
      WHERE player_id = v_placeholder_row.player_id;

      RETURN jsonb_build_object(
        'success', true,
        'player_id', v_placeholder_row.player_id,
        'user_id', v_auth_uid::TEXT,
        'web3_auth_id', v_auth_uid::TEXT,
        'linked_wallet_address', v_target_wallet
      );
    ELSE
      -- If no row exists yet, create one with the verified user_id and web3_auth_id
      INSERT INTO public.users (
        user_id,
        web3_auth_id,
        player_id,
        linked_wallet_address,
        balance_pgt
      ) VALUES (
        v_auth_uid,
        v_auth_uid,
        v_target_wallet,
        v_target_wallet,
        0.0
      );

      RETURN jsonb_build_object(
        'success', true,
        'player_id', v_target_wallet,
        'user_id', v_auth_uid::TEXT,
        'web3_auth_id', v_auth_uid::TEXT,
        'linked_wallet_address', v_target_wallet
      );
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bind_web3_user_session(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: get_admin_discord_webhooks
-- Sourced from: harden_arcade_nft_validation_and_isolate_discord_webhooks.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_admin_discord_webhooks(TEXT);
DROP FUNCTION IF EXISTS get_admin_discord_webhooks(TEXT);
CREATE OR REPLACE FUNCTION public.get_admin_discord_webhooks(p_admin_passkey TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row RECORD;
BEGIN
  -- Verify Master Admin passkey via canonical salted verifier
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid Master Admin Passkey');
  END IF;

  SELECT * INTO v_row FROM public.admin_discord_secrets WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'main', COALESCE(v_row.discord_webhook_url, ''),
    'admin', COALESCE(v_row.discord_admin_webhook_url, ''),
    'announcements', COALESCE(v_row.discord_announcements_webhook_url, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_discord_webhooks(TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_admin_discord_webhooks(TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: update_admin_discord_webhooks
-- Sourced from: harden_arcade_nft_validation_and_isolate_discord_webhooks.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_admin_discord_webhooks(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_admin_discord_webhooks(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.update_admin_discord_webhooks(
  p_admin_passkey TEXT,
  p_main TEXT DEFAULT NULL,
  p_admin TEXT DEFAULT NULL,
  p_announcements TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
BEGIN
  -- Verify Master Admin passkey via canonical salted verifier
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid Master Admin Passkey');
  END IF;

  INSERT INTO public.admin_discord_secrets (id, discord_webhook_url, discord_admin_webhook_url, discord_announcements_webhook_url, updated_at)
  VALUES (1, p_main, p_admin, p_announcements, NOW())
  ON CONFLICT (id) DO UPDATE
  SET discord_webhook_url = COALESCE(p_main, admin_discord_secrets.discord_webhook_url),
      discord_admin_webhook_url = COALESCE(p_admin, admin_discord_secrets.discord_admin_webhook_url),
      discord_announcements_webhook_url = COALESCE(p_announcements, admin_discord_secrets.discord_announcements_webhook_url),
      updated_at = NOW();

  -- Guarantee global_settings columns remain completely sanitized
  UPDATE public.global_settings
  SET discord_webhook_url = NULL,
      discord_admin_webhook_url = NULL,
      discord_announcements_webhook_url = NULL
  WHERE id = 1;

  RETURN jsonb_build_object('success', true, 'message', 'Discord Webhook secrets updated securely');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_admin_discord_webhooks(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_admin_discord_webhooks(TEXT, TEXT, TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: record_bot_warning
-- Source: harden_relic_drops_and_auto_ban_probes.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_bot_warning(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS record_bot_warning(TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.record_bot_warning(
  p_player_id TEXT,
  p_reason TEXT,
  p_game TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  SELECT * INTO v_user FROM public.users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Atomically increment bot_warning count
  UPDATE public.users
  SET bot_warning = COALESCE(bot_warning, 0) + 1,
      updated_at = NOW()
  WHERE player_id = v_pid
  RETURNING bot_warning INTO v_count;

  -- Auto-ban policy: Automatically ban after 20 warnings (protects paying & active players from false positives)
  IF v_count >= 20 AND COALESCE(v_user.is_banned, false) = false THEN
    UPDATE public.users
    SET is_banned = true,
        updated_at = NOW()
    WHERE player_id = v_pid;

    INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
    VALUES (v_pid, 'auto_banned_threshold_reached', 'Security Engine', jsonb_build_object('warning_count', v_count, 'last_reason', p_reason), NOW());
  END IF;

  -- Log security incident to persistent audit table
  INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
  VALUES (v_pid, COALESCE(p_reason, 'suspicious_activity'), p_game, COALESCE(p_details, '{}'::jsonb), NOW());

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_pid,
    'bot_warning', v_count,
    'is_banned', (COALESCE(v_user.is_banned, false) OR v_count >= 20),
    'reason', p_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_bot_warning(TEXT, TEXT, TEXT, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_bot_warning(TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';

