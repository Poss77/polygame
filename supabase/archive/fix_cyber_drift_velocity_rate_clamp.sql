-- ==============================================================================
-- POLYGAME HOTFIX: Calibrate Cyber Drift Score Velocity & Reimburse Session
-- File: fix_cyber_drift_velocity_rate_clamp.sql
-- Date: 2026-09-16
-- ==============================================================================

DROP FUNCTION IF EXISTS public.end_arcade_session(text, text, integer, integer, integer, numeric, numeric);

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
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(COALESCE(p_player_id, ''))); 
  END IF;

  v_now := NOW();
  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  -- Cap bonus tokens to maximum 20 (equivalent to 100 PGT max bonus)
  v_clamped_tokens := GREATEST(0, LEAST(COALESCE(p_bonus_tokens, 0), 20));
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));
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

  -- 1.5x Apex Relics multiplier evaluated from user relics or parameter
  IF is_season1_apex_unlocked(v_user.relics) OR COALESCE(p_relic_multiplier, 1.0) >= 1.5 THEN
    v_relic_mult := 1.5;
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
    v_game_name := v_session.game_name;
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
  END IF;

  -- Base Game Earn Ceiling (75.00 PGT): protects against unmultiplied bot exploits
  v_raw_pgt := LEAST(v_raw_pgt, 75.00);

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

GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- REIMBURSEMENT: Restore correct score and payout for session ae0442da-3f7b-400a-973e-5647d90aad0f
-- Difference: 93.83 PGT (intended) - 47.39 PGT (clamped) = +46.44 PGT
-- ------------------------------------------------------------------------------
UPDATE public.arcade_sessions
SET score = 18381,
    payout_pgt = 93.83
WHERE id = 'ae0442da-3f7b-400a-973e-5647d90aad0f';

UPDATE public.users
SET balance_pgt = ROUND((COALESCE(balance_pgt, 0) + 46.44)::numeric, 2),
    total_earned = ROUND((COALESCE(total_earned, 0) + 46.44)::numeric, 2),
    drift_highscore = GREATEST(COALESCE(drift_highscore, 0), 18381),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), 18381)
WHERE player_id = '0xpgt8312e02d37185b5983e6922d1dae1cce';
