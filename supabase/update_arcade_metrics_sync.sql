-- ==============================================================================
-- POLYGAME - UPDATE ARCADE METRICS REAL-TIME LOGGING
-- ==============================================================================
-- Automatically updates game_metrics (total_payout and total_playtime_seconds)
-- inside end_arcade_session so that 'Payout (Since Reset)' and 'Playtime' update live.
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
AS \$\$
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
  v_total_multiplier NUMERIC;
  v_raw_pgt NUMERIC;
  v_final_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_is_new_high BOOLEAN;
  v_max_daily_plays INTEGER;
  v_daily_completed_count INTEGER;
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
  v_is_new_high := false;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arcade session not found');
  END IF;

  IF v_session.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arcade session already finished or expired');
  END IF;

  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

  -- Velocity anti-cheat sanity checks
  IF v_clamped_score > 0 AND v_duration_seconds < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session duration impossibly short');
  END IF;

  -- 24-Hour Play Quota Check
  SELECT COALESCE(max_daily_plays_per_game, 35) INTO v_max_daily_plays
  FROM global_settings
  WHERE id = 1;

  SELECT COUNT(*)::INTEGER INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE player_id = v_pid
    AND game_name = v_session.game_name
    AND status = 'completed'
    AND completed_at >= (v_now - INTERVAL '24 hours');

  IF v_daily_completed_count >= v_max_daily_plays THEN
    UPDATE arcade_sessions
    SET status = 'completed',
        score = v_clamped_score,
        bonus_items = v_clamped_items,
        bonus_tokens = v_clamped_tokens,
        payout_pgt = 0.0,
        duration_seconds = v_duration_seconds,
        completed_at = v_now
    WHERE id = v_session_uuid;

    SELECT balance_pgt INTO v_new_balance FROM users WHERE player_id = v_pid;

    RETURN jsonb_build_object(
      'success', true,
      'payout_pgt', 0.0,
      'raw_pgt', 0.0,
      'multiplier', 1.0,
      'new_balance', v_new_balance,
      'is_new_highscore', false,
      'score', v_clamped_score,
      'daily_limit_reached', true,
      'plays_today', v_daily_completed_count,
      'max_daily_plays', v_max_daily_plays
    );
  END IF;

  SELECT * INTO v_user
  FROM users
  WHERE player_id = v_pid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- VIP (2.0x) & Ambassador (2.0x) Multipliers
  v_vip_mult := 1.0;
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  v_amb_mult := 1.0;
  IF v_user.is_ambassador IS TRUE THEN
    v_amb_mult := 2.0;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_vip_mult * v_amb_mult;
  v_game_clean := LOWER(TRIM(v_session.game_name));

  IF v_game_clean LIKE '%dodge%' OR v_game_clean LIKE '%astro%' THEN
    v_game_name := 'AstroDodge';
    -- HUD Formula: (score / 2500.0) + (shards * 0.04)
    v_raw_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.04);
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

  -- Update game_metrics for arcade analytics (since reset)
  BEGIN
    INSERT INTO public.game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
    VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
    ON CONFLICT (game_name) DO UPDATE
    SET total_payout = COALESCE(public.game_metrics.total_payout, 0) + v_final_pgt,
        total_playtime_seconds = COALESCE(public.game_metrics.total_playtime_seconds, 0) + v_duration_seconds;
  EXCEPTION WHEN OTHERS THEN
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
\$\$;

GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;
