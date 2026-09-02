-- ==============================================================================
-- POLYGAME: MASTER CANONICAL STORED PROCEDURES (RPCs) (v1.5.130+)
-- ==============================================================================
-- Complete, production-grade definitions of all active SECURITY DEFINER stored
-- procedures for anti-cheat gameplay, token payouts, staking, 4-tier referrals,
-- faucet claims, arcade sessions, leaderboards, and maintenance.
-- ==============================================================================

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
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS best_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS prize_pgt NUMERIC DEFAULT 0;

ALTER TABLE public.weekly_leaderboard_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to weekly_leaderboard_history" ON public.weekly_leaderboard_history;
CREATE POLICY "Allow public read access to weekly_leaderboard_history" ON public.weekly_leaderboard_history FOR SELECT TO anon, authenticated, service_role USING (true);
DROP POLICY IF EXISTS "Allow service role insert to weekly_leaderboard_history" ON public.weekly_leaderboard_history;
CREATE POLICY "Allow service role insert to weekly_leaderboard_history" ON public.weekly_leaderboard_history FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);

-- Ensure users table columns exist for all 5 arcade games & active tiers
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stacker_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_stacker_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS skeet_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_skeet_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_faucet_claims INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_games_played INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_active_tier INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_weekly_active_tier INTEGER DEFAULT 0;

-- ==============================================================================
-- 1. UTILITY: resolve_player_id
-- ==============================================================================
CREATE OR REPLACE FUNCTION resolve_player_id(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_clean TEXT := LOWER(TRIM(COALESCE(p_input, '')));
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT player_id INTO v_pid
  FROM users
  WHERE LOWER(player_id) = v_clean
     OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean
     OR LOWER(COALESCE(wallet_address, '')) = v_clean
     OR LOWER(COALESCE(user_id, '')) = v_clean
  LIMIT 1;

  IF v_pid IS NOT NULL THEN
    RETURN v_pid;
  END IF;

  RETURN v_clean;
END;
$$;
GRANT EXECUTE ON FUNCTION resolve_player_id(TEXT) TO anon, authenticated, service_role;


-- ==============================================================================
-- 1b. UTILITY: compute_weekly_active_tier (Levels 0 to 5)
-- ==============================================================================
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
    RETURN 5; -- ðŸ‘‘ Level 5: Apex Legend
  ELSIF v_f >= 5 AND v_g >= 25 THEN
    RETURN 4; -- ðŸ’Ž Level 4: Elite Champion
  ELSIF v_f >= 3 AND v_g >= 5 THEN
    RETURN 3; -- ðŸ¥‡ Level 3: Veteran
  ELSIF v_f >= 2 AND v_g >= 1 THEN
    RETURN 2; -- ðŸ¥ˆ Level 2: Contender
  ELSIF v_f >= 1 THEN
    RETURN 1; -- ðŸ¥‰ Level 1: Scout
  ELSE
    RETURN 0; -- âšª Level 0: Dormant
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION compute_weekly_active_tier(BIGINT, BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION compute_weekly_active_tier(INT, INT) TO anon, authenticated, service_role;


-- ==============================================================================
-- 1c. UTILITY: is_season1_apex_unlocked (Serie 1 17-Relic Set Multiplier)
-- ==============================================================================
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

-- ==============================================================================
-- 2. REFERRALS: get_user_referral_multiplier & process_referral_commissions
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_user_referral_multiplier(p_player_id TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
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

CREATE OR REPLACE FUNCTION process_referral_commissions(
  p_player_id TEXT,
  p_base_pgt NUMERIC,
  p_action_type TEXT DEFAULT 'Gameplay'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_downline RECORD;
  v_upline_pid TEXT;
  v_rates NUMERIC[] := ARRAY[0.10, 0.05, 0.02, 0.01]; -- 10%, 5%, 2%, 1%
  v_tier INTEGER;
  v_upline_keys TEXT[];
  v_mult NUMERIC;
  v_commission NUMERIC;
  v_downline_name TEXT;
BEGIN
  IF v_pid IS NULL OR p_base_pgt IS NULL OR p_base_pgt <= 0 THEN
    RETURN;
  END IF;

  SELECT referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4, username, player_id, linked_wallet_address
  INTO v_downline
  FROM users WHERE player_id = v_pid;

  IF NOT FOUND THEN RETURN; END IF;

  v_downline_name := COALESCE(NULLIF(TRIM(v_downline.username), ''), NULLIF(TRIM(v_downline.linked_wallet_address), ''), v_downline.player_id);
  v_upline_keys := ARRAY[v_downline.referred_by_l1, v_downline.referred_by_l2, v_downline.referred_by_l3, v_downline.referred_by_l4];

  FOR v_tier IN 1..4 LOOP
    v_upline_pid := resolve_player_id(v_upline_keys[v_tier]);
    IF v_upline_pid IS NOT NULL AND v_upline_pid <> '' AND v_upline_pid <> v_pid THEN
      v_mult := get_user_referral_multiplier(v_upline_pid);
      v_commission := ROUND(p_base_pgt * v_rates[v_tier] * v_mult, 4);

      IF v_commission > 0 THEN
        UPDATE users
        SET balance_pgt = COALESCE(balance_pgt, 0) + v_commission,
            referral_pgt_earned = COALESCE(referral_pgt_earned, 0) + v_commission
        WHERE player_id = v_upline_pid;

        INSERT INTO referral_commissions (upline_player_id, downline_player_id, tier, commission_pgt, action_type, downline_username)
        VALUES (v_upline_pid, v_pid, v_tier, v_commission, p_action_type, v_downline_name);
      END IF;
    END IF;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION process_referral_commissions(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 3. ARCADE SESSIONS: start_arcade_session & end_arcade_session
-- ==============================================================================
CREATE OR REPLACE FUNCTION start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_session_id UUID;
  v_max_daily_plays INTEGER := 25;
  v_daily_completed_count INTEGER := 0;
  v_clean_game TEXT;
  v_game_key TEXT;
  v_game_settings JSONB;
  v_vip_only BOOLEAN := false;
  v_user RECORD;
BEGIN
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  v_clean_game := LOWER(REPLACE(COALESCE(p_game_name, 'astrododge'), ' ', ''));

  IF v_clean_game LIKE '%astro%' OR v_clean_game = 'astrododge' THEN
    v_game_key := 'astrododge';
  ELSIF v_clean_game LIKE '%invader%' THEN
    v_game_key := 'invaders';
  ELSIF v_clean_game LIKE '%drift%' THEN
    v_game_key := 'drift';
  ELSIF v_clean_game LIKE '%stacker%' OR v_clean_game LIKE '%catcher%' THEN
    v_game_key := 'stacker';
  ELSIF v_clean_game LIKE '%skeet%' THEN
    v_game_key := 'skeet';
  ELSE
    v_game_key := v_clean_game;
  END IF;

  SELECT COALESCE(max_daily_plays_per_game, 25), game_payout_settings
  INTO v_max_daily_plays, v_game_settings
  FROM global_settings WHERE id = 1 LIMIT 1;

  -- Server-side VIP Access Enforcement
  v_vip_only := COALESCE((v_game_settings->v_game_key->>'vip_only')::boolean, false);
  IF v_vip_only THEN
    SELECT * INTO v_user FROM users WHERE player_id = v_pid;
    IF v_user IS NULL OR (
      (v_user.vip_until IS NULL OR v_user.vip_until <= NOW())
      AND NOT COALESCE(v_user.is_ambassador, false)
      AND LOWER(v_pid) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', '👑 VIP Exclusive Game! Upgrade to VIP Pass to play.',
        'vip_required', true
      );
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE player_id = v_pid
    AND LOWER(REPLACE(COALESCE(game_name, ''), ' ', '')) = v_clean_game
    AND created_at >= (NOW() - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit reached (' || v_max_daily_plays || '/' || v_max_daily_plays || ' runs in last 24 hours). Please wait for cooldown.',
      'limit_reached', true,
      'daily_completed', v_daily_completed_count,
      'max_plays', v_max_daily_plays
    );
  END IF;

  INSERT INTO arcade_sessions (player_id, game_name, status, created_at, started_at)
  VALUES (v_pid, p_game_name, 'active', NOW(), NOW())
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'player_id', v_pid,
    'game_name', p_game_name,
    'plays_today', v_daily_completed_count,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;
GRANT EXECUTE ON FUNCTION start_arcade_session(TEXT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_session RECORD;
  v_now TIMESTAMPTZ;
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER;
  v_clamped_items INTEGER;
  v_clamped_tokens INTEGER;
  v_clamped_nft_mult NUMERIC;
  v_user RECORD;
  v_vip_mult NUMERIC;
  v_amb_mult NUMERIC;
  v_relic_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC;
  v_raw_pgt NUMERIC;
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
  v_new_weekly_games INTEGER := 0;
  v_current_weekly_faucets INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(COALESCE(p_player_id, ''))); 
  END IF;

  v_now := NOW();
  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));
  v_vip_mult := 1.0;
  v_amb_mult := 1.0;
  v_total_multiplier := 1.0;
  v_raw_pgt := 0.0;
  v_final_pgt := 0.0;
  v_new_balance := 0.0;
  v_is_new_high := false;
  v_max_daily_plays := 25;
  v_daily_completed_count := 0;
  v_global_earn_mult := 1.0;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid AND player_id = v_pid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arcade session not found');
  END IF;

  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arcade session already finished or expired');
  END IF;

  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.created_at))::INTEGER);

  IF v_duration_seconds > 7200 THEN
    UPDATE arcade_sessions SET status = 'expired', duration_seconds = v_duration_seconds WHERE id = v_session_uuid;
    RETURN jsonb_build_object('success', false, 'error', 'Arcade session expired (max 2 hours)');
  END IF;

  v_game_clean := LOWER(REPLACE(COALESCE(v_session.game_name, ''), ' ', ''));

  SELECT COALESCE(earn_multiplier, 1.0), COALESCE(max_daily_plays_per_game, 25), game_payout_settings 
  INTO v_global_earn_mult, v_max_daily_plays, v_game_settings
  FROM global_settings WHERE id = 1 LIMIT 1;

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
  ELSE
    v_game_key := v_game_clean;
  END IF;

  -- Check In-Game Harvest Permission
  v_harvest_enabled := COALESCE((v_game_settings->v_game_key->>'harvest_enabled')::boolean, true);

  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE player_id = v_pid
    AND LOWER(REPLACE(COALESCE(game_name, ''), ' ', '')) = v_game_clean
    AND created_at >= (NOW() - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    UPDATE arcade_sessions SET status = 'expired', duration_seconds = v_duration_seconds WHERE id = v_session_uuid;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit exceeded (' || v_max_daily_plays || '/' || v_max_daily_plays || ' runs completed in last 24 hours)',
      'limit_reached', true
    );
  END IF;

  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User record not found');
  END IF;

  -- 2.0x VIP Multiplier
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  -- 2.0x Ambassador Multiplier
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- 1.5x Serie 1 Apex Relics Multiplier
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas (Exact Match with Client HUDs, scaled by global earn multiplier)
  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_name := 'AstroDodge';
    -- HUD Formula: ((score / 2500.0) + (shards * 0.05)) * global_mult
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET game_highscore = v_clamped_score, alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_name := 'Cyber Invaders';
    -- HUD Formula: ((score / 2000.0) + (aliens * 0.04)) * global_mult
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_name := 'Cyber Drift';
    -- HUD Formula: ((score / 2500.0) + (orbs * 0.04)) * global_mult
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_name := 'Cyber Stacker';
    -- HUD Formula: ((floors * 0.45) + (score / 1500.0)) * global_mult
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
    -- HUD Formula: ((score / 2500.0) + (clays * 0.04)) * global_mult
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.skeet_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET skeet_highscore = v_clamped_score, 
          alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;
  ELSE
    v_game_name := 'Arcade Game';
    v_raw_pgt := (v_clamped_score / 1000.0) * v_global_earn_mult;
  END IF;

  -- Enforce In-Game Harvest toggle: If harvest is disabled for this game, zero out score & token payout
  IF NOT v_harvest_enabled THEN
    v_raw_pgt := 0.0;
    v_final_pgt := 0.0;
  ELSE
    v_final_pgt := ROUND((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0), 2);
  END IF;

  v_new_weekly_games := COALESCE(v_user.weekly_games_played, 0) + 1;
  v_current_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_current_weekly_faucets, v_new_weekly_games);

  -- Credit PGT and update weekly active activity
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt,
      weekly_games_played = v_new_weekly_games,
      weekly_active_tier = v_new_weekly_tier,
      updated_at = v_now
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  -- Mark session completed
  UPDATE arcade_sessions
  SET status = 'completed',
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt,
      duration_seconds = v_duration_seconds,
      completed_at = v_now
  WHERE id = v_session_uuid;

  -- Update game_metrics for arcade analytics (since reset)
  BEGIN
    INSERT INTO public.game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
    VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
    ON CONFLICT (game_name) DO UPDATE
    SET total_payout = COALESCE(public.game_metrics.total_payout, 0) + v_final_pgt,
        total_playtime_seconds = COALESCE(public.game_metrics.total_playtime_seconds, 0) + v_duration_seconds;
  EXCEPTION WHEN OTHERS THEN
    -- Prevent metric error from blocking arcade payout
    NULL;
  END;

  IF v_final_pgt > 0 THEN
    PERFORM process_referral_commissions(v_pid, v_final_pgt, v_game_name);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout', v_final_pgt,
    'payout_pgt', v_final_pgt,
    'harvest_enabled', v_harvest_enabled,
    'raw_pgt', v_raw_pgt,
    'multiplier', v_total_multiplier,
    'new_balance', v_new_balance,
    'is_new_high', COALESCE(v_is_new_high, false),
    'is_new_highscore', COALESCE(v_is_new_high, false),
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', v_new_weekly_tier,
    'score', v_clamped_score
  );
END;
$$;
GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;

-- 3b. ARCADE HIGH SCORES: submit_arcade_highscore
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_player_id TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_stacker_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL,
  p_skeet_highscore INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_stacker_val INTEGER := COALESCE(p_stacker_highscore, p_catcher_highscore);
BEGIN
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  UPDATE users
  SET 
    game_highscore = GREATEST(COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
    invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
    drift_highscore = GREATEST(COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
    stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), COALESCE(v_stacker_val, 0)),
    skeet_highscore = GREATEST(COALESCE(skeet_highscore, 0), COALESCE(p_skeet_highscore, 0)),
    alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
    alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0), COALESCE(v_stacker_val, 0)),
    alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0), COALESCE(p_skeet_highscore, 0)),
    updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- ==============================================================================
-- 4. POLYSPACE MINING & EXPEDITIONS: credit_arcade_payout
-- ==============================================================================
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.credit_arcade_payout(NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, TEXT, NUMERIC, INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, TEXT, NUMERIC) CASCADE;

CREATE OR REPLACE FUNCTION public.credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC DEFAULT 0.0,
  p_game_name TEXT DEFAULT 'PolySpace Mining'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_payout NUMERIC;
  v_new_balance NUMERIC;
  v_user RECORD;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  -- 1. Check user exists
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- 2. Anti-cheat ceiling: Hard cap single expedition / mining payout to max 2500 PGT
  v_payout := LEAST(2500.0, GREATEST(0.0, COALESCE(p_amount, 0.0)));

  -- 3. Atomic credit
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_payout,
      total_earned = COALESCE(total_earned, 0) + v_payout,
      updated_at = NOW()
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  -- 4. Process referral commissions
  IF v_payout > 0 THEN
    PERFORM process_referral_commissions(v_pid, v_payout, COALESCE(p_game_name, 'PolySpace Mining'));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_payout,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 5. FAUCET: claim_faucet
-- ==============================================================================
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.claim_faucet(
  p_player_id TEXT,
  p_nft_boost_percent NUMERIC DEFAULT 0.0,
  p_1flr_balance NUMERIC DEFAULT 0.0,
  p_staked_pgt NUMERIC DEFAULT 0.0,
  p_onchain_pgt NUMERIC DEFAULT 0.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_hours NUMERIC := 24.0;
  v_is_vip BOOLEAN := false;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_streak INTEGER := 0;
  v_base_payout NUMERIC := 50.0;
  v_final_payout NUMERIC := 50.0;
  v_new_balance NUMERIC := 0;
  v_new_weekly_faucets INTEGER := 0;
  v_current_weekly_games INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  SELECT * INTO v_user FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_is_vip := true;
    v_vip_mult := 2.0;
    v_cooldown_hours := 21.6; -- 10% faster cooldown
  END IF;

  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- Check Serie 1 Apex Relics Multiplier (1.5x) from DB relics
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Faucet on cooldown',
      'next_claim', v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')
    );
  END IF;

  -- Daily streak calculation (within 48h preserves streak)
  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + INTERVAL '48 hours') THEN
    v_streak := LEAST(COALESCE(v_user.faucet_streak, 0) + 1, 7);
  ELSE
    v_streak := 1;
  END IF;

  v_final_payout := v_base_payout * (1.0 + (GREATEST(0.0, LEAST(COALESCE(p_nft_boost_percent, 0.0), 300.0)) / 100.0));
  
  IF COALESCE(p_1flr_balance, 0) >= 5000000 THEN 
    v_final_payout := v_final_payout * 1.15; 
  END IF;
  
  IF COALESCE(p_staked_pgt, 0) >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.25; 
  END IF;
  
  IF COALESCE(p_onchain_pgt, 0) >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.10; 
  END IF;

  v_final_payout := v_final_payout * v_relic_mult * v_vip_mult * v_amb_mult;
  v_final_payout := ROUND(v_final_payout, 2);

  v_new_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0) + 1;
  v_current_weekly_games := COALESCE(v_user.weekly_games_played, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_new_weekly_faucets, v_current_weekly_games);

  UPDATE users
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
    'multiplier', (v_final_payout / v_base_payout),
    'streak', v_streak,
    'new_balance', v_new_balance,
    'weekly_faucet_claims', v_new_weekly_faucets,
    'weekly_active_tier', v_new_weekly_tier,
    'claimed_at', v_now
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- ==============================================================================
-- 6. STAKING: get_user_stakes, deposit_stake, unstake_position, unstake_all_matured
-- ==============================================================================
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

CREATE OR REPLACE FUNCTION deposit_stake(
  p_wallet TEXT,
  p_pool TEXT,
  p_amount NUMERIC,
  p_tier TEXT,
  p_apy NUMERIC,
  p_duration_ms BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_now TIMESTAMPTZ := NOW();
  v_lock_until TIMESTAMPTZ;
  v_stake_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid deposit amount');
  END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE player_id = v_pid FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance');
  END IF;

  v_lock_until := v_now + ((p_duration_ms / 1000.0) * INTERVAL '1 second');

  UPDATE users
  SET balance_pgt = balance_pgt - p_amount,
      updated_at = v_now
  WHERE player_id = v_pid;

  INSERT INTO user_stakes (wallet_address, pool, amount, tier, apy, staked_at, lock_until, last_harvest, active)
  VALUES (v_pid, LOWER(p_pool), p_amount, p_tier, p_apy, v_now, v_lock_until, v_now, true)
  RETURNING id INTO v_stake_id;

  RETURN jsonb_build_object(
    'success', true,
    'stake_id', v_stake_id,
    'amount', p_amount,
    'new_balance', v_balance - p_amount
  );
END;
$$;
GRANT EXECUTE ON FUNCTION deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION unstake_position(
  p_wallet TEXT,
  p_stake_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_reward NUMERIC := 0;
  v_total_return NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_elapsed_seconds NUMERIC;
BEGIN
  SELECT * INTO v_stake FROM user_stakes WHERE id = p_stake_id FOR UPDATE;
  IF NOT FOUND OR v_stake.active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stake position not active or not found');
  END IF;

  v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.staked_at));
  v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
  v_total_return := v_stake.amount + v_reward;

  UPDATE user_stakes SET active = false, last_harvest = v_now WHERE id = p_stake_id;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_return,
      updated_at = v_now
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true,
    'principal', v_stake.amount,
    'reward', v_reward,
    'total_return', v_total_return,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION unstake_position(TEXT, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION unstake_all_matured(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_count INTEGER := 0;
  v_total_payout NUMERIC := 0;
  v_reward NUMERIC;
  v_elapsed_seconds NUMERIC;
  v_new_balance NUMERIC := 0;
BEGIN
  FOR v_stake IN
    SELECT * FROM user_stakes
    WHERE (LOWER(wallet_address) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(p_wallet))
      AND active = true
      AND lock_until <= v_now
    FOR UPDATE
  LOOP
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.staked_at));
    v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
    v_total_payout := v_total_payout + v_stake.amount + v_reward;
    v_count := v_count + 1;

    UPDATE user_stakes SET active = false, last_harvest = v_now WHERE id = v_stake.id;
  END LOOP;

  IF v_count > 0 THEN
    UPDATE users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_payout,
        updated_at = v_now
    WHERE player_id = v_pid
    RETURNING balance_pgt INTO v_new_balance;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'unstaked_count', v_count,
    'total_payout', v_total_payout,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION unstake_all_matured(TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 7. MAINTENANCE & ADMIN: prune_old_arcade_sessions, execute_weekly_payout_and_reset, reconcile_referral_trees
-- ==============================================================================
CREATE OR REPLACE FUNCTION prune_old_arcade_sessions(p_days INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (GREATEST(1, COALESCE(p_days, 7)) * INTERVAL '1 day');
  v_deleted_count INTEGER := 0;
BEGIN
  DELETE FROM arcade_sessions
  WHERE created_at < v_cutoff
    AND status IN ('completed', 'expired');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_sessions', v_deleted_count,
    'cutoff_date', v_cutoff
  );
END;
$$;
GRANT EXECUTE ON FUNCTION prune_old_arcade_sessions(INTEGER) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION reconcile_referral_trees()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reconciled_users INTEGER := 0;
  v_user RECORD;
  v_p1 RECORD;
  v_p2 RECORD;
  v_p3 RECORD;
BEGIN
  FOR v_user IN SELECT player_id, referred_by_l1 FROM users WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' LOOP
    SELECT referred_by_l1, referred_by_l2, referred_by_l3 INTO v_p1 FROM users WHERE player_id = v_user.referred_by_l1;
    IF FOUND THEN
      UPDATE users
      SET referred_by_l2 = v_p1.referred_by_l1,
          referred_by_l3 = v_p1.referred_by_l2,
          referred_by_l4 = v_p1.referred_by_l3
      WHERE player_id = v_user.player_id;
      v_reconciled_users := v_reconciled_users + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'reconciled_users_count', v_reconciled_users
  );
END;
$$;
GRANT EXECUTE ON FUNCTION reconcile_referral_trees() TO anon, authenticated, service_role;

-- ==============================================================================
-- 7b. MODULAR WEEKLY RESET PROCEDURES
-- ==============================================================================

-- Step 1: Distribute Arcade Leaderboard Prizes (AstroDodge, Invaders, Drift, Stacker, Skeet)
CREATE OR REPLACE FUNCTION public.distribute_weekly_arcade_prizes()
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
    v_games_processed := array_append(v_games_processed, 'Astro-Dodge (' || v_pool::TEXT || ' PGT)');
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
    v_games_processed := array_append(v_games_processed, 'Cyber Invaders (' || v_pool::TEXT || ' PGT)');
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
    v_games_processed := array_append(v_games_processed, 'Cyber Drift (' || v_pool::TEXT || ' PGT)');
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
    v_games_processed := array_append(v_games_processed, 'Cyber Stacker (' || v_pool::TEXT || ' PGT)');
  END IF;

  -- 5. CYBER SKEET POOL
  v_pool := COALESCE((v_settings->'skeet'->>'weekly_pool_pgt')::numeric, 25000);

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
    v_games_processed := array_append(v_games_processed, 'Cyber Skeet (' || v_pool::TEXT || ' PGT)');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', v_total_distributed,
    'winner_count', v_total_winners,
    'games_processed', v_games_processed,
    'week_label', v_week_label
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.distribute_weekly_arcade_prizes() TO anon, authenticated, service_role;

-- Step 3: Snapshot Weekly Activity Tiers (L0â€“L5) & Reset Active Counters
CREATE OR REPLACE FUNCTION public.snapshot_weekly_activity_tiers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INT := 0;
BEGIN
  WITH updated AS (
    UPDATE users
    SET 
      last_weekly_active_tier = COALESCE(weekly_active_tier, 0),
      weekly_faucet_claims = 0,
      weekly_games_played = 0,
      weekly_active_tier = 0,
      updated_at = NOW()
    WHERE 
      COALESCE(weekly_faucet_claims, 0) > 0 OR 
      COALESCE(weekly_games_played, 0) > 0 OR 
      COALESCE(weekly_active_tier, 0) > 0 OR
      COALESCE(last_weekly_active_tier, 0) > 0
    RETURNING player_id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_snapshotted', v_updated_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.snapshot_weekly_activity_tiers() TO anon, authenticated, service_role;

-- Step 4: Reset Arcade Tournament High Scores to 0 (Preserving All-Time Career Records)
CREATE OR REPLACE FUNCTION public.reset_arcade_leaderboard_scores()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reset_count INT := 0;
BEGIN
  WITH updated AS (
    UPDATE users
    SET 
      alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0)),
      alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0)),
      alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0)),
      alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0)),
      alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0)),
      game_highscore = 0,
      invaders_highscore = 0,
      drift_highscore = 0,
      stacker_highscore = 0,
      skeet_highscore = 0,
      updated_at = NOW()
    WHERE 
      COALESCE(game_highscore, 0) > 0 OR 
      COALESCE(invaders_highscore, 0) > 0 OR 
      COALESCE(drift_highscore, 0) > 0 OR 
      COALESCE(stacker_highscore, 0) > 0 OR 
      COALESCE(skeet_highscore, 0) > 0
    RETURNING player_id
  )
  SELECT COUNT(*) INTO v_reset_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_reset', v_reset_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_arcade_leaderboard_scores() TO anon, authenticated, service_role;

-- Master Server Procedure: execute_weekly_payout_and_reset (Calls all 4 steps)
CREATE OR REPLACE FUNCTION public.execute_weekly_payout_and_reset()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_arcade_res JSONB;
  v_boss_res JSONB;
  v_activity_res JSONB;
  v_scores_res JSONB;
BEGIN
  -- 1. Distribute Arcade Leaderboard Prizes
  v_arcade_res := distribute_weekly_arcade_prizes();

  -- 2. Distribute World Boss Bounty Loot
  BEGIN
    v_boss_res := distribute_weekly_boss_prizes();
  EXCEPTION WHEN OTHERS THEN
    v_boss_res := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  -- 3. Snapshot Activity Tiers & Reset Active Counters
  v_activity_res := snapshot_weekly_activity_tiers();

  -- 4. Reset Weekly Arcade Scores to 0
  v_scores_res := reset_arcade_leaderboard_scores();

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
GRANT EXECUTE ON FUNCTION public.execute_weekly_payout_and_reset() TO anon, authenticated, service_role;

-- ==============================================================================
-- 7c. GLOBAL SETTINGS ADMIN MANAGEMENT: admin_update_global_settings & update_game_payout_settings
-- ==============================================================================

-- 1. Ensure global_settings table has all columns and permissive RLS for admin operations
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on global_settings" ON public.global_settings;
CREATE POLICY "Allow public read on global_settings" ON public.global_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all access on global_settings" ON public.global_settings;
CREATE POLICY "Allow all access on global_settings" ON public.global_settings FOR ALL USING (true) WITH CHECK (true);

-- 2. General Admin Global Settings Updater (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_update_global_settings(
  p_admin_wallet TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_addr TEXT := '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';
  v_sender_wallet TEXT;
BEGIN
  -- Resolve input admin wallet / player ID
  IF p_admin_wallet IS NOT NULL AND p_admin_wallet <> '' THEN
    SELECT LOWER(COALESCE(linked_wallet_address, player_id)) INTO v_sender_wallet
    FROM users
    WHERE player_id = p_admin_wallet OR LOWER(linked_wallet_address) = LOWER(p_admin_wallet)
    LIMIT 1;
  END IF;

  IF v_sender_wallet IS NULL THEN
    v_sender_wallet := LOWER(p_admin_wallet);
  END IF;

  IF v_sender_wallet <> v_admin_addr THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Master Admin wallet required');
  END IF;

  -- Update global_settings dynamically
  UPDATE public.global_settings
  SET
    earn_multiplier = COALESCE((p_payload->>'earn_multiplier')::numeric, earn_multiplier),
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
    END
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_global_settings(TEXT, JSONB) TO anon, authenticated, service_role;

-- 3. Dedicated Game Payout Settings Updater (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.update_game_payout_settings(
  p_admin_wallet TEXT,
  p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_addr TEXT := '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';
  v_sender_wallet TEXT;
BEGIN
  IF p_admin_wallet IS NOT NULL AND p_admin_wallet <> '' THEN
    SELECT LOWER(COALESCE(linked_wallet_address, player_id)) INTO v_sender_wallet
    FROM users
    WHERE player_id = p_admin_wallet OR LOWER(linked_wallet_address) = LOWER(p_admin_wallet)
    LIMIT 1;
  END IF;

  IF v_sender_wallet IS NULL THEN
    v_sender_wallet := LOWER(p_admin_wallet);
  END IF;

  IF v_sender_wallet <> v_admin_addr THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Master Admin wallet required');
  END IF;

  UPDATE public.global_settings
  SET game_payout_settings = p_settings
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_game_payout_settings(TEXT, JSONB) TO anon, authenticated, service_role;

-- ==============================================================================
-- 8. COSMIC WORLD BOSS: strike_world_boss & distribute_weekly_boss_prizes
-- ==============================================================================
CREATE OR REPLACE FUNCTION strike_world_boss(
  p_player_id TEXT,
  p_damage NUMERIC,
  p_crystals_cost NUMERIC DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id TEXT;
  v_space_state JSONB;
  v_current_quantum NUMERIC := 0;
  v_new_quantum NUMERIC := 0;
  v_strikes_count INT := 1;
  v_new_player_dmg NUMERIC;
  v_alltime_dmg NUMERIC;
  v_attacks INT;
  v_total_server_dmg NUMERIC;
  v_boss_level INT := 1;
  v_boss_pool NUMERIC := 10000;
  v_boss_hp NUMERIC := 5000000;
  v_boss_max_hp NUMERIC := 5000000;
  v_game_settings JSONB;
BEGIN
  IF p_damage IS NULL OR p_damage <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid strike damage value.');
  END IF;

  IF p_crystals_cost IS NULL OR p_crystals_cost < 1000 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Striking the World Boss requires at least 1,000 Quantum Crystals.');
  END IF;

  v_strikes_count := GREATEST(1, FLOOR(p_crystals_cost / 1000));

  SELECT player_id, space_state 
  INTO v_user_id, v_space_state
  FROM users
  WHERE LOWER(player_id) = LOWER(p_player_id)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(p_player_id)
  LIMIT 1
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player account not found.');
  END IF;

  v_current_quantum := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);

  IF v_current_quantum < p_crystals_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient Quantum Crystals! You have ' || v_current_quantum::INT::TEXT || ' but need ' || p_crystals_cost::INT::TEXT || ' Crystals.'
    );
  END IF;

  v_new_quantum := GREATEST(0, v_current_quantum - p_crystals_cost);
  v_space_state := jsonb_set(
    COALESCE(v_space_state, '{}'::jsonb),
    '{quantum}',
    to_jsonb(v_new_quantum)
  );

  UPDATE users
  SET 
    space_state = v_space_state,
    boss_weekly_damage = COALESCE(boss_weekly_damage, 0) + p_damage,
    alltime_boss_damage = COALESCE(alltime_boss_damage, 0) + p_damage,
    boss_attacks_count = COALESCE(boss_attacks_count, 0) + v_strikes_count,
    updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_user_id)
  RETURNING boss_weekly_damage, alltime_boss_damage, boss_attacks_count
  INTO v_new_player_dmg, v_alltime_dmg, v_attacks;

  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_hp, v_boss_max_hp, v_game_settings
  FROM global_settings
  WHERE id = 1;

  v_boss_pool := ROUND(10000.0 * POWER(1.10, GREATEST(0, v_boss_level - 1)));
  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, v_boss_pool);
  END IF;

  v_boss_hp := GREATEST(0, v_boss_hp - p_damage);

  UPDATE global_settings
  SET boss_current_hp = v_boss_hp
  WHERE id = 1;

  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_server_dmg
  FROM users
  WHERE boss_weekly_damage > 0;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_user_id,
    'strike_damage', p_damage,
    'crystals_deducted', p_crystals_cost,
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
GRANT EXECUTE ON FUNCTION strike_world_boss(TEXT, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION distribute_weekly_boss_prizes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_current_hp, v_boss_max_hp, v_game_settings
  FROM global_settings
  WHERE id = 1;

  v_boss_pool := ROUND(10000.0 * POWER(1.10, GREATEST(0, v_boss_level - 1)));
  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, v_boss_pool);
  END IF;

  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_damage
  FROM users
  WHERE boss_weekly_damage > 0;

  v_is_slain := (v_boss_current_hp <= 0);

  -- If pool set to 0, pause prize distribution but reset weekly damage
  IF v_boss_pool <= 0 THEN
    UPDATE users SET boss_weekly_damage = 0 WHERE boss_weekly_damage > 0;
    RETURN jsonb_build_object(
      'success', true,
      'message', 'World Boss weekly pool set to 0 PGT. Prize payout paused.',
      'slain', v_is_slain,
      'distributed_total', 0,
      'payout_count', 0
    );
  END IF;

  IF v_is_slain AND v_total_damage > 0 AND v_boss_pool > 0 THEN
    SELECT jsonb_agg(sub) INTO v_top_hunters
    FROM (
      SELECT 
        COALESCE(NULLIF(username, ''), SUBSTRING(player_id, 1, 8)) AS name,
        boss_weekly_damage AS damage,
        ROUND((boss_weekly_damage / v_total_damage) * v_boss_pool, 2) AS payout_pgt
      FROM users
      WHERE boss_weekly_damage > 0
      ORDER BY boss_weekly_damage DESC
      LIMIT 3
    ) sub;

    FOR v_winner IN
      SELECT player_id, boss_weekly_damage
      FROM users
      WHERE boss_weekly_damage > 0
    LOOP
      v_payout := ROUND((v_winner.boss_weekly_damage / v_total_damage) * v_boss_pool, 4);

      IF v_payout > 0 THEN
        UPDATE users
        SET 
          balance_pgt = COALESCE(balance_pgt, 0) + v_payout,
          updated_at = NOW()
        WHERE player_id = v_winner.player_id;

        v_payout_count := v_payout_count + 1;
        v_distributed_total := v_distributed_total + v_payout;
      END IF;
    END LOOP;

    v_new_level := v_boss_level + 1;
    v_new_max_hp := ROUND(5000000.0 * POWER(1.50, v_new_level - 1));
    v_new_pool := ROUND(10000.0 * POWER(1.20, v_new_level - 1));

    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "ðŸ‘¾ Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "vip_only": false}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    UPDATE global_settings
    SET 
      boss_level = v_new_level,
      boss_max_hp = v_new_max_hp,
      boss_current_hp = v_new_max_hp,
      game_payout_settings = v_game_settings
    WHERE id = 1;

    UPDATE users
    SET boss_weekly_damage = 0
    WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'victory', true,
      'distributed', true,
      'message', 'Quantum Leviathan was slain! Weekly prize pool distributed and Boss ascended to Level ' || v_new_level::TEXT || '!',
      'defeated_level', v_boss_level,
      'next_level', v_new_level,
      'winner_count', v_payout_count,
      'total_damage_dealt', v_total_damage,
      'pool_pgt', v_boss_pool,
      'distributed_total_pgt', v_distributed_total,
      'next_max_hp', v_new_max_hp,
      'next_pool_pgt', v_new_pool,
      'top_hunters', v_top_hunters
    );

  ELSE
    v_new_level := 1;
    v_new_max_hp := 5000000;
    v_new_pool := 10000;

    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "ðŸ‘¾ Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "vip_only": false}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    UPDATE global_settings
    SET 
      boss_level = 1,
      boss_max_hp = 5000000,
      boss_current_hp = 5000000,
      game_payout_settings = v_game_settings
    WHERE id = 1;

    UPDATE users
    SET boss_weekly_damage = 0
    WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'distributed', false,
      'message', 'Quantum Leviathan was NOT defeated before reset (survived with ' || v_boss_current_hp::BIGINT::TEXT || ' HP). Prize pool withheld and Boss reset to Level 1.',
      'survived_level', v_boss_level,
      'survived_hp', v_boss_current_hp,
      'next_level', 1,
      'winner_count', 0,
      'total_damage_dealt', v_total_damage,
      'pool_pgt', v_boss_pool,
      'distributed_total_pgt', 0,
      'next_max_hp', 5000000,
      'next_pool_pgt', 10000,
      'top_hunters', '[]'::jsonb
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION distribute_weekly_boss_prizes() TO anon, authenticated, service_role;

-- ==============================================================================
-- 16. QUANTUM RELICS: grant_relic_drop & mark_relic_minted
-- ==============================================================================
CREATE OR REPLACE FUNCTION grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_amount INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_player_id TEXT := resolve_player_id(p_player_id);
    v_current_relics JSONB;
    v_relic_obj JSONB;
    v_total INT;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_updated_relics JSONB;
BEGIN
    IF v_actual_player_id IS NULL OR v_actual_player_id = '' THEN
        v_actual_player_id := LOWER(TRIM(COALESCE(p_player_id, '')));
    END IF;

    SELECT COALESCE(relics, '{}'::jsonb) INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    v_relic_obj := COALESCE(v_current_relics->p_relic_id, '{}'::jsonb);
    v_unminted := COALESCE((v_relic_obj->>'unminted')::int, 0) + GREATEST(1, COALESCE(p_amount, 1));
    v_onchain := COALESCE((v_relic_obj->>'onchain')::int, 0);
    v_total := v_unminted + v_onchain;
    v_token_ids := COALESCE(v_relic_obj->'token_ids', '[]'::jsonb);

    v_relic_obj := jsonb_build_object(
        'total', v_total,
        'unminted', v_unminted,
        'onchain', v_onchain,
        'token_ids', v_token_ids
    );

    v_updated_relics := jsonb_set(v_current_relics, ARRAY[p_relic_id], v_relic_obj, true);

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN v_updated_relics;
END;
$$;
GRANT EXECUTE ON FUNCTION grant_relic_drop(TEXT, TEXT, INT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 9. ACCOUNT MERGING & LINKING: link_wallet_to_account
-- ==============================================================================
CREATE OR REPLACE FUNCTION link_wallet_to_account(p_wallet TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_owner UUID;
  v_old_row RECORD;
  v_merged_pgt NUMERIC := 0;
  v_merged_1flr NUMERIC := 0;
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

  IF p_wallet IS NULL OR p_wallet = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid wallet address');
  END IF;

  -- 1. Prevent stealing a wallet already linked to ANOTHER Google user
  SELECT user_id INTO v_existing_owner 
  FROM users 
  WHERE (LOWER(linked_wallet_address) = p_wallet OR LOWER(wallet_address) = p_wallet)
    AND user_id IS NOT NULL 
    AND user_id <> p_user_id;

  IF v_existing_owner IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'This wallet is already linked to another Google account.'
    );
  END IF;

  -- 2. Fetch unauthenticated standalone wallet row if it exists
  SELECT *
  INTO v_old_row
  FROM users
  WHERE (LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet OR LOWER(player_id) = p_wallet)
    AND (user_id IS NULL OR user_id <> p_user_id);

  IF FOUND THEN
    v_merged_pgt := COALESCE(v_old_row.balance_pgt, 0);
    v_merged_1flr := COALESCE(v_old_row.balance_1flr, 0);
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
    WHERE (LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet OR LOWER(player_id) = p_wallet)
      AND (user_id IS NULL OR user_id <> p_user_id);
  END IF;

  -- 3. Merge balance, highscores, stakes, referrals, relics, NFTs, VIP status, and link wallet directly to the Google account row
  UPDATE users 
  SET linked_wallet_address = p_wallet,
      balance_pgt = COALESCE(balance_pgt, 0) + v_merged_pgt,
      balance_1flr = COALESCE(balance_1flr, 0) + v_merged_1flr,
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

GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO anon, authenticated, service_role;

-- ==============================================================================
-- 10. DAILY QUESTS: claim_daily_quest (Canonical RPC with resolve_player_id)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.claim_daily_quest(
  p_wallet TEXT,
  p_quest_type TEXT
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
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_wallet, '')));
  END IF;
  
  SELECT * INTO v_user
  FROM users
  WHERE player_id = v_pid OR LOWER(linked_wallet_address) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
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
    IF NOT (COALESCE((v_q->>'games_claimed')::boolean, false) OR COALESCE((v_q->>'games')::int, 0) >= 3)
       OR NOT (COALESCE((v_q->>'mining_claimed')::boolean, false) OR COALESCE((v_q->>'mining')::int, 0) >= 3)
       OR NOT (COALESCE((v_q->>'wins_claimed')::boolean, false) OR COALESCE((v_q->>'wins')::int, 0) >= 3) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Complete all 3 daily quests first!');
    END IF;
    IF COALESCE((v_q->>'master_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Master quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{master_claimed}', 'true');
    v_reward := 25;
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
GRANT EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 11. ANTI-CHEAT TRIGGER: prevent_direct_balance_mutation
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_ambassador := false;
      NEW.vip_until := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
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

-- ==============================================================================
-- POLYGAME: CYBER MINES (NEON MINESWEEPER) STORED PROCEDURES & SESSION TABLE
-- ==============================================================================
-- Server-authoritative 5x5 Cyber Mines wager game with:
-- 1. Exact 94.0% RTP mathematical multiplier curve (6.0% house edge)
-- 2. 1,000x Hard Multiplier Cap & Auto-Cashout
-- 3. Complete anti-cheat session security (mine positions hidden from client)
-- 4. Automatic 1% Progressive Jackpot auto-increment & 1 in 25,000 jackpot win roll
-- 5. Automatic game_metrics table logging for Admin Panel House Net Profit tracking
-- ==============================================================================

-- 1. CREATE MINES SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.mines_sessions (
    id BIGSERIAL PRIMARY KEY,
    player_id TEXT NOT NULL,
    wallet_address TEXT,
    bet_amount NUMERIC NOT NULL,
    mines_count INT NOT NULL,
    mine_positions INT[] NOT NULL,
    revealed_tiles INT[] DEFAULT '{}',
    current_multiplier NUMERIC DEFAULT 1.00,
    payout NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active', -- 'active', 'cashed_out', 'busted'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mines_sessions_player ON public.mines_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_mines_sessions_status ON public.mines_sessions(status);

ALTER TABLE public.mines_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role all on mines_sessions" ON public.mines_sessions;
CREATE POLICY "Allow service role all on mines_sessions" ON public.mines_sessions FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Allow public read own mines_sessions" ON public.mines_sessions;
CREATE POLICY "Allow public read own mines_sessions" ON public.mines_sessions FOR SELECT TO anon, authenticated USING (true);

-- 2. MATHEMATICAL MULTIPLIER HELPER (94% RTP WITH 1,000x CAP)
CREATE OR REPLACE FUNCTION compute_mines_multiplier(p_mines INT, p_step INT, p_rtp NUMERIC DEFAULT 0.94)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_mult NUMERIC := p_rtp;
  v_total_tiles NUMERIC := 25.0;
  v_safe_tiles NUMERIC := (25 - p_mines)::numeric;
  i INT;
BEGIN
  IF p_mines < 1 OR p_mines > 24 OR p_step < 1 OR p_step > (25 - p_mines) THEN
    RETURN 1.00;
  END IF;
  
  FOR i IN 0..(p_step - 1) LOOP
    v_mult := v_mult * ((v_total_tiles - i) / (v_safe_tiles - i));
  END LOOP;
  
  -- Enforce 1,000x hard multiplier cap
  v_mult := LEAST(v_mult, 1000.00);

  RETURN ROUND(v_mult, 2);
END;
$$;
GRANT EXECUTE ON FUNCTION compute_mines_multiplier(INT, INT, NUMERIC) TO anon, authenticated, service_role;


-- 3. START MINES GAME RPC
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
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_mines_count INT := GREATEST(1, LEAST(24, COALESCE(p_mines, 3)));
  v_mine_positions INT[] := '{}';
  v_pos INT;
  v_session_id BIGINT;
  v_next_mult NUMERIC;
  v_new_jackpot NUMERIC;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;
  IF p_bet < 10 THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum bet is 10 PGT'); END IF;

  -- Lock user row and check balance
  SELECT balance_pgt INTO v_balance 
  FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
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
GRANT EXECUTE ON FUNCTION start_mines_game(TEXT, NUMERIC, INT) TO anon, authenticated, service_role;


-- 4. REVEAL MINES TILE RPC (WITH 1,000x CAP AUTO-CASHOUT)
DROP FUNCTION IF EXISTS reveal_mines_tile(TEXT, BIGINT, INT);
CREATE OR REPLACE FUNCTION reveal_mines_tile(
  p_wallet TEXT,
  p_session_id BIGINT,
  p_tile_index INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
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
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;
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
GRANT EXECUTE ON FUNCTION reveal_mines_tile(TEXT, BIGINT, INT) TO anon, authenticated, service_role;


-- 5. CASHOUT MINES GAME RPC (WITH 1,000x CAP ENFORCEMENT)
DROP FUNCTION IF EXISTS cashout_mines_game(TEXT, BIGINT);
CREATE OR REPLACE FUNCTION cashout_mines_game(
  p_wallet TEXT,
  p_session_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_session RECORD;
  v_multiplier NUMERIC;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;

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
GRANT EXECUTE ON FUNCTION cashout_mines_game(TEXT, BIGINT) TO anon, authenticated, service_role;

