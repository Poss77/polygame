-- ==============================================================================
-- POLYGON GAMING: RESTORE 4-TIER REFERRAL COMMISSIONS TO ARCADE SESSIONS
-- ==============================================================================
-- Updates end_arcade_session so downline arcade wins automatically distribute
-- 4-tier PGT commissions to uplines and log the gameplay into upline referral history.
-- ==============================================================================

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
AS $BODY$
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
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC;
  v_global_earn_mult NUMERIC := 1.0;
  v_game_name TEXT;
  v_raw_pgt NUMERIC;
  v_final_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_is_new_high BOOLEAN := false;
  v_new_weekly_games INTEGER;
  v_new_weekly_tier INTEGER;
  v_current_weekly_faucets INTEGER;
  v_max_daily_plays INTEGER := 10;
  v_daily_completed_count INTEGER := 0;
  v_game_settings JSONB;
  v_game_key TEXT;
  v_harvest_enabled BOOLEAN := true;
  v_game_clean TEXT;
BEGIN
  v_now := clock_timestamp();
  v_pid := resolve_player_id(p_player_id);
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
  WHERE id = v_session_uuid AND status = 'active'
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or already completed');
  END IF;

  v_game_name := v_session.game_name;
  v_game_clean := LOWER(TRIM(COALESCE(v_game_name, '')));
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

  -- Fetch Game Settings & Global Earn Multiplier
  BEGIN
    SELECT 
      COALESCE(global_earn_multiplier, 1.0),
      COALESCE(game_payout_settings, '{}'::jsonb),
      COALESCE(max_daily_plays_per_game, 10)
    INTO 
      v_global_earn_mult,
      v_game_settings,
      v_max_daily_plays
    FROM global_settings 
    WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    v_global_earn_mult := 1.0;
    v_game_settings := '{}'::jsonb;
    v_max_daily_plays := 10;
  END;

  IF v_game_clean LIKE '%astro%' THEN v_game_key := 'astrododge';
  ELSIF v_game_clean LIKE '%invader%' THEN v_game_key := 'invaders';
  ELSIF v_game_clean LIKE '%drift%' THEN v_game_key := 'drift';
  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN v_game_key := 'stacker';
  ELSIF v_game_clean LIKE '%skeet%' THEN v_game_key := 'skeet';
  ELSIF v_game_clean LIKE '%defense%' THEN v_game_key := 'defense';
  ELSE v_game_key := v_game_clean;
  END IF;

  IF v_game_settings ? v_game_key THEN
    IF (v_game_settings->v_game_key->>'harvest_enabled') IS NOT NULL THEN
      v_harvest_enabled := (v_game_settings->v_game_key->>'harvest_enabled')::BOOLEAN;
    END IF;
  END IF;

  -- Velocity rate checks
  IF v_game_clean LIKE '%astro%' THEN
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 600 + 500);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 5 + 50);
  ELSIF v_game_clean LIKE '%invader%' THEN
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 500 + 500);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 4 + 40);
  ELSIF v_game_clean LIKE '%drift%' THEN
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 500 + 500);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 4 + 40);
  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 600 + 500);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 5 + 50);
  ELSIF v_game_clean LIKE '%defense%' THEN
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 500 + 5000);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 6 + 100);
  ELSE
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 450 + 500);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 4 + 40);
  END IF;

  v_clamped_tokens := LEAST(GREATEST(0, p_bonus_tokens), 10);
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));

  -- Daily Play Limit Check
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE player_id = v_pid
    AND LOWER(game_name) = v_game_clean
    AND completed_at >= (v_now - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    UPDATE arcade_sessions
    SET status = 'completed', score = v_clamped_score, completed_at = v_now, duration_seconds = v_duration_seconds
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
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt,
      completed_at = v_now,
      duration_seconds = v_duration_seconds
  WHERE id = v_session_uuid;

  -- Atomically update game_metrics for arcade analytics (since reset)
  BEGIN
    INSERT INTO public.game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
    VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
    ON CONFLICT (game_name) DO UPDATE
    SET total_payout = COALESCE(public.game_metrics.total_payout, 0) + v_final_pgt,
        total_playtime_seconds = COALESCE(public.game_metrics.total_playtime_seconds, 0) + v_duration_seconds;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Distribute 4-tier referral commissions to uplines
  IF v_final_pgt > 0 THEN
    BEGIN
      PERFORM process_referral_commissions(v_pid, v_final_pgt, v_game_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

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
    'max_daily_plays', v_max_daily_plays,
    'referral_processed', (v_final_pgt > 0)
  );
END;
$BODY$;

GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
