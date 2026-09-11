-- ==============================================================================
-- POLYGAME: SEAL ARCADE BONUS ITEMS & PAYOUT VELOCITY ANTI-CHEAT SENTINEL
-- ==============================================================================
-- 1. Drops ALL legacy overloaded signatures of end_arcade_session to eliminate
--    PostgREST PGRST203 "Could not choose the best candidate function" collisions.
-- 2. Velocity-clamps bonus items (p_bonus_items) against session duration (max 1 item/sec + 2 buffer).
-- 3. Velocity-clamps bonus golden tokens (p_bonus_tokens) against session duration (1 token/30s, max 5/session).
-- 4. Hard-clamps instant sessions (< 3s duration) to maximum 1.00 PGT.
-- 5. Enforces global payout velocity ceiling (0.35 PGT/sec, max 50.00 PGT ceiling).
-- 6. Fully supports all arcade games (AstroDodge, Cyber Invaders, Cyber Drift,
--    Cyber Stacker, Cyber Skeet, Cyber Defense).
-- 7. Maintains weekly activity tiers, referral commissions, and game metrics.
-- ==============================================================================

-- Step 1: Dynamically drop EVERY existing signature of end_arcade_session in public schema
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'end_arcade_session'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION ' || r.func_sig || ' CASCADE;';
  END LOOP;
END $$;

-- Explicit fallback drops for known historical signatures
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER, NUMERIC);

-- Step 1b: Drop legacy conflicting compute_weekly_active_tier signatures and ensure single canonical definition
DROP FUNCTION IF EXISTS public.compute_weekly_active_tier(INT, INT);
DROP FUNCTION IF EXISTS public.compute_weekly_active_tier(BIGINT, BIGINT);

CREATE OR REPLACE FUNCTION public.compute_weekly_active_tier(p_faucets BIGINT, p_games BIGINT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_faucets >= 7 AND p_games >= 30 THEN RETURN 5;
  ELSIF p_faucets >= 5 AND p_games >= 20 THEN RETURN 4;
  ELSIF p_faucets >= 4 AND p_games >= 15 THEN RETURN 3;
  ELSIF p_faucets >= 3 AND p_games >= 10 THEN RETURN 2;
  ELSIF p_faucets >= 1 AND p_games >= 5 THEN RETURN 1;
  ELSE RETURN 0;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_weekly_active_tier(BIGINT, BIGINT) TO anon, authenticated, service_role;

-- Step 2: Create the SINGLE CANONICAL 7-parameter end_arcade_session RPC
CREATE OR REPLACE FUNCTION public.end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
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
  v_pid TEXT;
  v_session RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER;
  v_clamped_items INTEGER;
  v_clamped_tokens INTEGER;
  v_clamped_nft_mult NUMERIC;
  v_user RECORD;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_global_earn_mult NUMERIC := 1.0;
  v_raw_pgt NUMERIC := 0.0;
  v_final_pgt NUMERIC := 0.0;
  v_new_balance NUMERIC := 0.0;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_game_key TEXT;
  v_is_new_high BOOLEAN := false;
  v_max_daily_plays INTEGER := 25;
  v_daily_completed_count INTEGER := 0;
  v_game_settings JSONB;
  v_harvest_enabled BOOLEAN := true;
  v_new_weekly_games INTEGER := 0;
  v_current_weekly_faucets INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  -- 1. Resolve synthetic player_id or normalize input
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(COALESCE(p_player_id, ''))); 
  END IF;

  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  -- 2. Lock and Verify Active Arcade Session
  SELECT * INTO v_session 
  FROM public.arcade_sessions 
  WHERE id = v_session_uuid 
    AND (LOWER(player_id) = LOWER(v_pid) OR player_id = v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or belongs to another player');
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session has already been finalized and claimed');
  END IF;

  v_game_name := COALESCE(v_session.game_name, 'AstroDodge');
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - COALESCE(v_session.started_at, v_session.created_at)))::INTEGER);

  -- 3. Anti-Cheat Velocity Clamping: Clamps max score and items based on elapsed duration
  v_game_clean := LOWER(REPLACE(v_game_name, ' ', ''));

  IF v_game_clean LIKE '%invader%' THEN
    v_game_key := 'invaders';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_key := 'astrododge';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 500);
  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_key := 'drift';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_key := 'stacker';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 300 + 300);
  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_key := 'skeet';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 450 + 500);
  ELSIF v_game_clean LIKE '%defense%' THEN
    v_game_key := 'defense';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSE
    v_game_key := v_game_clean;
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 450 + 500);
  END IF;

  -- Velocity clamp bonus items: max 1 item/second + 2 initial buffer
  v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 1) + 2);

  -- Rare Golden Tokens: max 1 token per 30 seconds survival, absolute max 5 per session
  v_clamped_tokens := LEAST(v_clamped_tokens, LEAST(5, v_duration_seconds / 30));

  -- 4. Lock User Profile Row
  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found in database');
  END IF;

  IF v_user.player_id IS NOT NULL AND v_user.player_id <> '' THEN
    v_pid := LOWER(TRIM(v_user.player_id));
  END IF;

  -- 5. Multipliers & Global Settings
  IF (v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now) 
     OR LOWER(COALESCE(v_user.linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
     OR LOWER(COALESCE(v_user.player_id, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
     OR v_user.is_admin IS TRUE 
     OR v_user.is_ambassador IS TRUE THEN 
    v_vip_mult := 2.0; 
  END IF;

  IF v_user.is_ambassador IS TRUE THEN
    v_amb_mult := 2.0;
  END IF;

  -- 1.5x Apex Relics multiplier evaluated from user relics or client parameter
  BEGIN
    IF is_season1_apex_unlocked(v_user.relics) OR COALESCE(p_relic_multiplier, 1.0) >= 1.5 THEN
      v_relic_mult := 1.5;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF COALESCE(p_relic_multiplier, 1.0) >= 1.5 THEN
      v_relic_mult := 1.5;
    END IF;
  END;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Read global settings & in-game harvest permission
  SELECT COALESCE(earn_multiplier, 1.0), COALESCE(max_daily_plays_per_game, 25), game_payout_settings
  INTO v_global_earn_mult, v_max_daily_plays, v_game_settings
  FROM public.global_settings WHERE id = 1 LIMIT 1;

  IF v_global_earn_mult IS NULL OR v_global_earn_mult <= 0 THEN v_global_earn_mult := 1.0; END IF;
  IF v_max_daily_plays IS NULL OR v_max_daily_plays <= 0 THEN v_max_daily_plays := 25; END IF;

  IF v_game_settings IS NOT NULL AND v_game_settings ? v_game_key THEN
    v_harvest_enabled := COALESCE((v_game_settings->v_game_key->>'harvest_enabled')::BOOLEAN, true);
  END IF;

  -- 6. Daily Plays Cap (Rolling 24 Hours)
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM public.arcade_sessions
  WHERE LOWER(player_id) = LOWER(v_pid)
    AND LOWER(game_name) = LOWER(TRIM(v_game_name))
    AND completed_at >= (v_now - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    UPDATE public.arcade_sessions
    SET status = 'completed',
        score = v_clamped_score,
        bonus_items = v_clamped_items,
        bonus_tokens = v_clamped_tokens,
        payout_pgt = 0.0,
        completed_at = v_now,
        duration_seconds = v_duration_seconds
    WHERE id = v_session_uuid;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit reached (' || v_daily_completed_count || '/' || v_max_daily_plays || ')',
      'daily_limit_reached', true,
      'completed_today', v_daily_completed_count,
      'max_daily_plays', v_max_daily_plays,
      'payout_pgt', 0.0
    );
  END IF;

  -- 7. Calculate Game-Specific PGT Formula
  IF NOT v_harvest_enabled THEN
    v_raw_pgt := 0.0;
    v_final_pgt := 0.0;
  ELSE
    IF v_game_clean LIKE '%invader%' THEN 
      v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%drift%' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
      v_raw_pgt := ((v_clamped_items * 0.45) + (v_clamped_score / 1500.0)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%skeet%' THEN
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%defense%' THEN
      v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    ELSE 
      v_raw_pgt := (v_clamped_score / 2500.0) * v_global_earn_mult;
    END IF;

    v_final_pgt := ROUND(((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0))::NUMERIC, 2);

    -- Payout Velocity Sentinel: Sessions under 3 seconds cannot earn more than 1.00 PGT
    IF v_duration_seconds < 3 THEN
      v_final_pgt := LEAST(v_final_pgt, 1.00);
    END IF;

    -- Global Payout Velocity Ceiling: Max 0.35 PGT per second played (minimum 1.00 PGT floor, max 50.00 PGT ceiling)
    v_final_pgt := LEAST(v_final_pgt, GREATEST(1.00, ROUND((v_duration_seconds * 0.35 * v_total_multiplier)::NUMERIC, 2)));
    v_final_pgt := LEAST(v_final_pgt, 50.00);
  END IF;

  -- 8. Monotonic High Score Updates
  IF v_game_clean LIKE '%invader%' AND v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET invaders_highscore = v_clamped_score, 
        alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF (v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge') AND v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET game_highscore = v_clamped_score, 
        alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score), 
        alltime_highscore = GREATEST(COALESCE(alltime_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_clean LIKE '%drift%' AND v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET drift_highscore = v_clamped_score, 
        alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF (v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%') AND v_clamped_score > COALESCE(v_user.stacker_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET stacker_highscore = v_clamped_score, 
        alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_clean LIKE '%skeet%' AND v_clamped_score > COALESCE(v_user.skeet_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET skeet_highscore = v_clamped_score, 
        alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_clean LIKE '%defense%' AND v_clamped_score > COALESCE(v_user.defense_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET defense_highscore = v_clamped_score, 
        defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  END IF;

  -- 9. Weekly Activity Tiers Recalculation
  v_new_weekly_games := COALESCE(v_user.weekly_games_played, 0) + 1;
  v_current_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0);
  BEGIN
    v_new_weekly_tier := compute_weekly_active_tier(v_current_weekly_faucets, v_new_weekly_games);
  EXCEPTION WHEN OTHERS THEN
    v_new_weekly_tier := COALESCE(v_user.weekly_active_tier, 0);
  END;

  -- 10. Credit Balance & Process Downline Referral Commissions
  IF v_final_pgt > 0 THEN
    UPDATE public.users 
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt, 
        total_earned = COALESCE(total_earned, 0) + v_final_pgt, 
        weekly_games_played = v_new_weekly_games,
        weekly_active_tier = v_new_weekly_tier,
        updated_at = v_now 
    WHERE LOWER(player_id) = LOWER(v_user.player_id) 
    RETURNING balance_pgt INTO v_new_balance;

    -- Trigger downline referral commissions
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_final_pgt, v_game_name || ' Arcade');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSE
    UPDATE public.users 
    SET weekly_games_played = v_new_weekly_games,
        weekly_active_tier = v_new_weekly_tier,
        updated_at = v_now 
    WHERE LOWER(player_id) = LOWER(v_user.player_id) 
    RETURNING balance_pgt INTO v_new_balance;
  END IF;

  -- 11. Mark Arcade Session Completed
  UPDATE public.arcade_sessions 
  SET status = 'completed', 
      completed_at = v_now, 
      score = v_clamped_score, 
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt, 
      duration_seconds = v_duration_seconds 
  WHERE id = v_session_uuid;

  -- 12. Atomically update game_metrics
  BEGIN
    INSERT INTO public.game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
    VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
    ON CONFLICT (game_name) DO UPDATE
    SET total_payout = COALESCE(public.game_metrics.total_payout, 0) + v_final_pgt,
        total_playtime_seconds = COALESCE(public.game_metrics.total_playtime_seconds, 0) + v_duration_seconds;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true, 
    'game_name', v_game_name,
    'harvest_enabled', v_harvest_enabled,
    'payout', v_final_pgt, 
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance, 
    'duration_seconds', v_duration_seconds, 
    'score', v_clamped_score, 
    'is_new_high', v_is_new_high,
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', v_new_weekly_tier,
    'completed_today', v_daily_completed_count + 1,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;

-- Grant execute privileges
GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- Force PostgREST schema cache reload immediately
NOTIFY pgrst, 'reload schema';
