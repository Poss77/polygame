-- ==============================================================================
-- POLYGAME: MASTER CANONICAL STORED PROCEDURES (RPCs) (v1.5.130+)
-- ==============================================================================
-- Complete, production-grade definitions of all active SECURITY DEFINER stored
-- procedures for anti-cheat gameplay, token payouts, staking, 4-tier referrals,
-- faucet claims, arcade sessions, leaderboards, and maintenance.
-- ==============================================================================

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
-- Canonical start_arcade_session RPC
CREATE OR REPLACE FUNCTION start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session_id UUID;
  v_max_plays INTEGER := 25;
  v_daily_completed_count INTEGER := 0;
  v_clean_game TEXT := LOWER(REPLACE(COALESCE(p_game_name, 'astrododge'), ' ', ''));
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  SELECT COALESCE(max_daily_plays_per_game, 25) INTO v_max_plays
  FROM global_settings WHERE id = 1 LIMIT 1;

  SELECT COUNT(*) INTO v_completed_count
  FROM arcade_sessions
  WHERE player_id = v_pid
    AND LOWER(REPLACE(COALESCE(game_name, ''), ' ', '')) = v_clean_game
    AND created_at >= (NOW() - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_completed_count >= v_max_plays THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit reached (' || v_max_plays || '/' || v_max_plays || ' runs in last 24 hours). Please wait for cooldown.',
      'limit_reached', true,
      'daily_completed', v_completed_count,
      'max_plays', v_max_plays
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
    'plays_today', v_completed_count,
    'max_daily_plays', v_max_plays
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
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items INTEGER := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens INTEGER := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  v_clamped_nft_mult NUMERIC := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));
  v_user RECORD;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_raw_pgt NUMERIC := 0;
  v_final_pgt NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_is_new_high BOOLEAN := false;
  v_max_daily_plays INTEGER := 25;
  v_daily_completed_count INTEGER := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

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

  SELECT COALESCE(max_daily_plays_per_game, 25) INTO v_max_plays
  FROM global_settings WHERE id = 1 LIMIT 1;

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

  v_total_multiplier := v_clamped_nft_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas (Exact Match with Client HUDs)
  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_name := 'AstroDodge';
    -- HUD Formula: (score / 1000.0) + (shards * 0.05)
    v_raw_pgt := (v_clamped_score / 1000.0) + (v_clamped_items * 0.05);
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET game_highscore = v_clamped_score, alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_name := 'Cyber Invaders';
    -- HUD Formula: (score / 2000.0) + (aliens * 0.04)
    v_raw_pgt := (v_clamped_score / 2000.0) + (v_clamped_items * 0.04);
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_name := 'Cyber Drift';
    -- HUD Formula: (score / 2500.0) + (orbs * 0.04)
    v_raw_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.04);
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_name := 'Cyber Stacker';
    -- HUD Formula: (floors * 0.45) + (score / 1500.0)
    v_raw_pgt := (v_clamped_items * 0.45) + (v_clamped_score / 1500.0);
    IF v_clamped_score > COALESCE(v_user.catcher_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET catcher_highscore = v_clamped_score, alltime_catcher_highscore = GREATEST(COALESCE(alltime_catcher_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;
  ELSE
    v_game_name := 'Arcade Game';
    v_raw_pgt := (v_clamped_score / 1000.0);
  END IF;

  -- 5 PGT flat bonus per collectible token / canister / golden core
  v_final_pgt := ROUND((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0), 2);

  -- Credit PGT to users table balance
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt,
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

  IF v_final_pgt > 0 THEN
    PERFORM process_referral_commissions(v_pid, v_final_pgt, v_game_name);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_final_pgt,
    'raw_pgt', v_raw_pgt,
    'multiplier', v_total_multiplier,
    'new_balance', v_new_balance,
    'is_new_highscore', v_is_new_high,
    'score', v_clamped_score
  );
END;
$$;
GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;

-- ==============================================================================
-- 4. POLYSPACE & GENERIC PAYOUT: credit_arcade_payout
-- ==============================================================================
CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_player_id TEXT,
  p_game_name TEXT,
  p_payout_pgt NUMERIC,
  p_score INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_clamped_payout NUMERIC := GREATEST(0, COALESCE(p_payout_pgt, 0));
  v_new_balance NUMERIC;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  IF v_clamped_payout > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout exceeds maximum single transaction threshold');
  END IF;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_clamped_payout,
      updated_at = NOW()
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  IF v_clamped_payout > 0 THEN
    PERFORM process_referral_commissions(v_pid, v_clamped_payout, COALESCE(p_game_name, 'PolySpace Loot'));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_clamped_payout,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, TEXT, NUMERIC, INTEGER, NUMERIC) TO anon, authenticated, service_role;

-- ==============================================================================
-- 5. FAUCET: claim_faucet
-- ==============================================================================
CREATE OR REPLACE FUNCTION claim_faucet(
  p_player_id TEXT,
  p_nft_multiplier NUMERIC DEFAULT 1.0
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
  v_streak INTEGER := 0;
  v_streak_bonus NUMERIC := 0.0;
  v_base_payout NUMERIC := 10.0;
  v_final_payout NUMERIC := 10.0;
  v_total_multiplier NUMERIC := 1.0;
  v_new_balance NUMERIC := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
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

  v_streak_bonus := (v_streak - 1) * 0.05; -- +5% per streak day up to +30%
  v_total_multiplier := (GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 5.0)) + v_streak_bonus) * v_vip_mult * v_amb_mult;
  v_final_payout := ROUND(v_base_payout * v_total_multiplier, 2);

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_payout,
      last_faucet_claim = v_now,
      faucet_streak = v_streak,
      updated_at = v_now
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  PERFORM process_referral_commissions(v_pid, v_final_payout, 'Faucet Claim');

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_final_payout,
    'multiplier', v_total_multiplier,
    'streak', v_streak,
    'new_balance', v_new_balance,
    'claimed_at', v_now
  );
END;
$$;
GRANT EXECUTE ON FUNCTION claim_faucet(TEXT, NUMERIC) TO anon, authenticated, service_role;

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
    v_new_max_hp := ROUND(5000000.0 * POWER(1.20, v_new_level - 1));
    v_new_pool := ROUND(10000.0 * POWER(1.10, v_new_level - 1));

    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "vip_only": false}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    UPDATE global_settings
    SET 
      boss_level = v_new_level,
      boss_max_hp = v_new_max_hp,
      boss_current_hp = v_new_max_hp,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
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
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "vip_only": false}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    UPDATE global_settings
    SET 
      boss_level = 1,
      boss_max_hp = 5000000,
      boss_current_hp = 5000000,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
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

