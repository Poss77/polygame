-- ==============================================================================
-- POLYGAME: FIX SERIE 1 APEX RELICS 1.5x MULTIPLIER (FAUCET & ARCADE)
-- ==============================================================================
-- Run this script in the Supabase SQL Editor

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
BEGIN
  IF v_r IS NULL OR v_r::text IN ('{}', 'null', '""', '[]') THEN
    RETURN false;
  END IF;

  RETURN (
    (COALESCE((v_r->'relic_astrododge_prism'->>'total')::int, (v_r->'relic_astrododge_prism'->>'unminted')::int, (v_r->'relic_astrododge_prism'->>'onchain')::int, (v_r->>'relic_astrododge_prism')::int, 0) > 0 OR (v_r ? 'relic_astrododge_prism')) AND
    (COALESCE((v_r->'relic_astrododge_deflector'->>'total')::int, (v_r->'relic_astrododge_deflector'->>'unminted')::int, (v_r->'relic_astrododge_deflector'->>'onchain')::int, (v_r->>'relic_astrododge_deflector')::int, 0) > 0 OR (v_r ? 'relic_astrododge_deflector')) AND
    (COALESCE((v_r->'relic_astrododge_compass'->>'total')::int, (v_r->'relic_astrododge_compass'->>'unminted')::int, (v_r->'relic_astrododge_compass'->>'onchain')::int, (v_r->>'relic_astrododge_compass')::int, (v_r->'relic_astrododge_chrono'->>'total')::int, 0) > 0 OR (v_r ? 'relic_astrododge_compass') OR (v_r ? 'relic_astrododge_chrono')) AND
    (COALESCE((v_r->'relic_invaders_core'->>'total')::int, (v_r->'relic_invaders_core'->>'unminted')::int, (v_r->'relic_invaders_core'->>'onchain')::int, (v_r->>'relic_invaders_core')::int, (v_r->'relic_invaders_pulsar'->>'total')::int, 0) > 0 OR (v_r ? 'relic_invaders_core') OR (v_r ? 'relic_invaders_pulsar')) AND
    (COALESCE((v_r->'relic_invaders_dynamo'->>'total')::int, (v_r->'relic_invaders_dynamo'->>'unminted')::int, (v_r->'relic_invaders_dynamo'->>'onchain')::int, (v_r->>'relic_invaders_dynamo')::int, 0) > 0 OR (v_r ? 'relic_invaders_dynamo')) AND
    (COALESCE((v_r->'relic_invaders_transmitter'->>'total')::int, (v_r->'relic_invaders_transmitter'->>'unminted')::int, (v_r->'relic_invaders_transmitter'->>'onchain')::int, (v_r->>'relic_invaders_transmitter')::int, 0) > 0 OR (v_r ? 'relic_invaders_transmitter')) AND
    (COALESCE((v_r->'relic_drift_chronometer'->>'total')::int, (v_r->'relic_drift_chronometer'->>'unminted')::int, (v_r->'relic_drift_chronometer'->>'onchain')::int, (v_r->>'relic_drift_chronometer')::int, (v_r->'relic_drift_tachometer'->>'total')::int, 0) > 0 OR (v_r ? 'relic_drift_chronometer') OR (v_r ? 'relic_drift_tachometer')) AND
    (COALESCE((v_r->'relic_drift_capacitor'->>'total')::int, (v_r->'relic_drift_capacitor'->>'unminted')::int, (v_r->'relic_drift_capacitor'->>'onchain')::int, (v_r->>'relic_drift_capacitor')::int, (v_r->'relic_drift_flux'->>'total')::int, 0) > 0 OR (v_r ? 'relic_drift_capacitor') OR (v_r ? 'relic_drift_flux')) AND
    (COALESCE((v_r->'relic_drift_overdrive'->>'total')::int, (v_r->'relic_drift_overdrive'->>'unminted')::int, (v_r->'relic_drift_overdrive'->>'onchain')::int, (v_r->>'relic_drift_overdrive')::int, (v_r->'relic_drift_supercharger'->>'total')::int, 0) > 0 OR (v_r ? 'relic_drift_overdrive') OR (v_r ? 'relic_drift_supercharger')) AND
    (COALESCE((v_r->'relic_stacker_foundation'->>'total')::int, (v_r->'relic_stacker_foundation'->>'unminted')::int, (v_r->'relic_stacker_foundation'->>'onchain')::int, (v_r->>'relic_stacker_foundation')::int, (v_r->'relic_stacker_bedrock'->>'total')::int, 0) > 0 OR (v_r ? 'relic_stacker_foundation') OR (v_r ? 'relic_stacker_bedrock')) AND
    (COALESCE((v_r->'relic_stacker_keystone'->>'total')::int, (v_r->'relic_stacker_keystone'->>'unminted')::int, (v_r->'relic_stacker_keystone'->>'onchain')::int, (v_r->>'relic_stacker_keystone')::int, 0) > 0 OR (v_r ? 'relic_stacker_keystone')) AND
    (COALESCE((v_r->'relic_stacker_monolith'->>'total')::int, (v_r->'relic_stacker_monolith'->>'unminted')::int, (v_r->'relic_stacker_monolith'->>'onchain')::int, (v_r->>'relic_stacker_monolith')::int, 0) > 0 OR (v_r ? 'relic_stacker_monolith')) AND
    (COALESCE((v_r->'relic_space_darkmatter'->>'total')::int, (v_r->'relic_space_darkmatter'->>'unminted')::int, (v_r->'relic_space_darkmatter'->>'onchain')::int, (v_r->>'relic_space_darkmatter')::int, 0) > 0 OR (v_r ? 'relic_space_darkmatter')) AND
    (COALESCE((v_r->'relic_space_coil'->>'total')::int, (v_r->'relic_space_coil'->>'unminted')::int, (v_r->'relic_space_coil'->>'onchain')::int, (v_r->>'relic_space_coil')::int, 0) > 0 OR (v_r ? 'relic_space_coil')) AND
    (COALESCE((v_r->'relic_space_harvester'->>'total')::int, (v_r->'relic_space_harvester'->>'unminted')::int, (v_r->'relic_space_harvester'->>'onchain')::int, (v_r->>'relic_space_harvester')::int, 0) > 0 OR (v_r ? 'relic_space_harvester')) AND
    (COALESCE((v_r->'relic_apex_singularity'->>'total')::int, (v_r->'relic_apex_singularity'->>'unminted')::int, (v_r->'relic_apex_singularity'->>'onchain')::int, (v_r->>'relic_apex_singularity')::int, 0) > 0 OR (v_r ? 'relic_apex_singularity')) AND
    (COALESCE((v_r->'relic_apex_genesis'->>'total')::int, (v_r->'relic_apex_genesis'->>'unminted')::int, (v_r->'relic_apex_genesis'->>'onchain')::int, (v_r->>'relic_apex_genesis')::int, 0) > 0 OR (v_r ? 'relic_apex_genesis'))
  );
END;
$$;
GRANT EXECUTE ON FUNCTION is_season1_apex_unlocked(JSONB) TO anon, authenticated, service_role;

-- ==============================================================================
-- 5. FAUCET: claim_faucet
-- ==============================================================================
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.claim_faucet(
  p_wallet TEXT,
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
  v_pid TEXT := resolve_player_id(p_wallet);
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
    v_pid := LOWER(TRIM(p_wallet));
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
-- 3. ARCADE: end_arcade_session (with 1.5x Apex Relics multiplier)
-- ==============================================================================
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
  v_is_new_high BOOLEAN;
  v_max_daily_plays INTEGER;
  v_daily_completed_count INTEGER;
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

  -- 1.5x Serie 1 Apex Relics Multiplier
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas (Exact Match with Client HUDs)
  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_name := 'AstroDodge';
    -- HUD Formula: (score / 2500.0) + (shards * 0.05)
    v_raw_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.05);
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
    IF v_clamped_score > COALESCE(v_user.stacker_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET stacker_highscore = v_clamped_score, 
          alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_name := 'Cyber Skeet';
    -- HUD Formula: (score / 2500.0) + (clays * 0.04)
    v_raw_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.04);
    IF v_clamped_score > COALESCE(v_user.skeet_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET skeet_highscore = v_clamped_score, 
          alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;
  ELSE
    v_game_name := 'Arcade Game';
    v_raw_pgt := (v_clamped_score / 1000.0);
  END IF;

  -- 5 PGT flat bonus per collectible token / canister / golden core
  v_final_pgt := ROUND((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0), 2);

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
