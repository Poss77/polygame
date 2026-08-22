-- ====================================================================
-- POLYGAME - RECALIBRATE CYBER INVADERS PAYOUT FORMULA IN RPC
-- Corrects old legacy score multiplier (score * 0.015 -> score / 2000.0)
-- to prevent 10x over-crediting of PGT balance.
-- ====================================================================

CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id UUID,
  p_score INTEGER,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_user RECORD;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_duration_seconds INTEGER;
  v_clamped_score INTEGER;
  v_clamped_items INTEGER;
  v_clamped_tokens INTEGER;
  v_clamped_nft_mult NUMERIC;
  v_game_name TEXT;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC;
  v_raw_pgt NUMERIC := 0.0;
  v_final_pgt NUMERIC := 0.0;
  v_new_balance NUMERIC;
  v_is_new_high BOOLEAN := false;
  v_pid TEXT;
  v_max_daily_plays INTEGER := 25;
  v_daily_completed_count INTEGER := 0;
BEGIN
  -- 1. Validate Session
  SELECT * INTO v_session FROM arcade_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Session not found'); END IF;
  IF v_session.status <> 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'Session is already ' || v_session.status); END IF;

  v_pid := LOWER(TRIM(p_player_id));
  v_game_name := v_session.game_name;
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

  v_clamped_score := GREATEST(0, p_score);
  v_clamped_items := GREATEST(0, LEAST(500, p_bonus_items));
  v_clamped_tokens := GREATEST(0, LEAST(10, p_bonus_tokens));
  v_clamped_nft_mult := GREATEST(1.0, LEAST(10.0, COALESCE(p_nft_multiplier, 1.0)));

  -- 2. Anti-Cheat Velocity Clamping
  IF v_game_name = 'Cyber Invaders' THEN v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_name = 'AstroDodge' THEN v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 500);
  ELSIF v_game_name = 'Cyber Drift' THEN v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSE v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 450 + 500);
  END IF;

  -- 3. Lock User Row by player_id
  SELECT * INTO v_user FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;

  IF v_user.player_id IS NOT NULL AND v_user.player_id <> '' THEN
    v_pid := LOWER(TRIM(v_user.player_id));
  END IF;

  IF (v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now) 
     OR LOWER(COALESCE(v_user.linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
     OR LOWER(COALESCE(v_user.player_id, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
     OR v_user.is_admin IS TRUE 
     OR v_user.is_ambassador IS TRUE THEN 
    v_vip_mult := 2.0; 
  END IF;
  IF v_user.is_ambassador IS TRUE THEN v_amb_mult := 2.0; END IF;

  v_total_multiplier := v_clamped_nft_mult * v_vip_mult * v_amb_mult;

  -- 4. Check Daily Play Count Threshold
  SELECT COALESCE(max_daily_plays_per_game, 25) INTO v_max_daily_plays FROM global_settings WHERE id = 1;
  IF v_max_daily_plays IS NULL OR v_max_daily_plays <= 0 THEN v_max_daily_plays := 25; END IF;

  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE LOWER(player_id) = LOWER(v_pid)
    AND LOWER(game_name) = LOWER(TRIM(v_game_name))
    AND completed_at >= (v_now - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    v_final_pgt := 0.0;
  ELSE
    -- Balanced Reward Formulas
    IF v_game_name = 'Cyber Invaders' THEN 
      v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04));
    ELSIF v_game_name = 'AstroDodge' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05));
    ELSIF v_game_name = 'Cyber Drift' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04));
    ELSIF (v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher') THEN
      v_raw_pgt := ((v_clamped_items * 0.45) + (v_clamped_score / 1500.0));
    ELSE 
      v_raw_pgt := (v_clamped_score / 2500.0);
    END IF;

    v_final_pgt := ROUND(((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0))::numeric, 2);
  END IF;

  -- 5. Update High Scores
  IF v_game_name = 'Cyber Invaders' AND v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_name = 'AstroDodge' AND v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET game_highscore = v_clamped_score, alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score), alltime_highscore = GREATEST(COALESCE(alltime_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_name = 'Cyber Drift' AND v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF (v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher') AND v_clamped_score > COALESCE(v_user.catcher_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET catcher_highscore = v_clamped_score, stacker_highscore = v_clamped_score, alltime_catcher_highscore = GREATEST(COALESCE(alltime_catcher_highscore, 0), v_clamped_score), alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  END IF;

  -- 6. Increment balance_pgt
  IF v_final_pgt > 0 THEN
    UPDATE users
    SET balance_pgt = balance_pgt + v_final_pgt
    WHERE LOWER(player_id) = LOWER(v_user.player_id)
    RETURNING balance_pgt INTO v_new_balance;
  ELSE
    v_new_balance := v_user.balance_pgt;
  END IF;

  -- 7. Mark session completed
  UPDATE arcade_sessions
  SET status = 'completed',
      final_score = v_clamped_score,
      payout_pgt = v_final_pgt,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      duration_seconds = v_duration_seconds,
      completed_at = v_now
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance,
    'is_new_high', v_is_new_high,
    'is_daily_limit_reached', (v_daily_completed_count >= v_max_daily_plays),
    'daily_plays_used', v_daily_completed_count + 1,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;
