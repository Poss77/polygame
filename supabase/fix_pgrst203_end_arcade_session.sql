-- ==============================================================================
-- POLYGON GAMING: FIX PGRST203 END_ARCADE_SESSION FUNCTION OVERLOADING COLLISION
-- Resolves "Could not choose the best candidate function between..." error
-- by cleanly purging all legacy/overloaded signatures of end_arcade_session
-- and recreating the single canonical 7-parameter function with Cyber Defense.
-- ==============================================================================

-- 1. Dynamically drop EVERY existing signature of end_arcade_session in public schema
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

-- 2. Explicit fallback drops for known historical signatures
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER, NUMERIC);

-- 3. Recreate the SINGLE CANONICAL end_arcade_session RPC
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

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or belongs to another player');
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session has already been finalized and claimed');
  END IF;

  v_duration_seconds := EXTRACT(EPOCH FROM (v_now - v_session.created_at))::INTEGER;
  IF v_duration_seconds < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session ended too quickly (anti-cheat)');
  END IF;

  SELECT COALESCE(earn_multiplier, 1.0), COALESCE(max_daily_plays_per_game, 25), game_payout_settings
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

  v_harvest_enabled := COALESCE((v_game_settings->v_game_key->>'harvest_enabled')::boolean, true);

  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE player_id = v_pid
    AND game_name = v_session.game_name
    AND status = 'completed'
    AND created_at >= CURRENT_DATE;

  IF v_daily_completed_count >= v_max_daily_plays THEN
    UPDATE arcade_sessions
    SET status = 'completed', score = v_clamped_score, ended_at = v_now, duration_seconds = v_duration_seconds
    WHERE id = v_session_uuid;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit reached (' || v_daily_completed_count || '/' || v_max_daily_plays || ')',
      'daily_limit_reached', true,
      'completed_today', v_daily_completed_count,
      'max_daily_plays', v_max_daily_plays,
      'payout_pgt', 0
    );
  END IF;

  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- 1.5x Apex Relics multiplier evaluated from user relics or parameter
  IF is_season1_apex_unlocked(v_user.relics) OR COALESCE(p_relic_multiplier, 1.0) >= 1.5 THEN
    v_relic_mult := 1.5;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas
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
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
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
    v_game_name := 'Arcade Game';
    v_raw_pgt := (v_clamped_score / 1000.0) * v_global_earn_mult;
  END IF;

  -- Enforce in-game harvest toggle
  IF NOT v_harvest_enabled THEN
    v_raw_pgt := 0.0;
    v_final_pgt := 0.0;
  ELSE
    v_final_pgt := ROUND((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0), 2);
  END IF;

  v_new_weekly_games := COALESCE(v_user.weekly_games_played, 0) + 1;
  v_current_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_current_weekly_faucets, v_new_weekly_games);

  UPDATE users
  SET balance_pgt = balance_pgt + v_final_pgt,
      total_earned = COALESCE(total_earned, 0) + v_final_pgt,
      weekly_games_played = v_new_weekly_games,
      weekly_active_tier = v_new_weekly_tier,
      updated_at = v_now
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  UPDATE arcade_sessions
  SET status = 'completed',
      score = v_clamped_score,
      payout_pgt = v_final_pgt,
      ended_at = v_now,
      duration_seconds = v_duration_seconds
  WHERE id = v_session_uuid;

  RETURN jsonb_build_object(
    'success', true,
    'game_name', v_game_name,
    'harvest_enabled', v_harvest_enabled,
    'final_score', v_clamped_score,
    'raw_pgt', ROUND(v_raw_pgt, 2),
    'multiplier', v_total_multiplier,
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance,
    'is_new_high', v_is_new_high,
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', v_new_weekly_tier,
    'completed_today', v_daily_completed_count + 1,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- Force PostgREST schema cache reload immediately
NOTIFY pgrst, 'reload schema';
