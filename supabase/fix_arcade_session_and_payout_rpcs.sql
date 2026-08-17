-- ==============================================================================
-- POLYGAME ARCADE REWARDS & SESSION RPCS (CONCISE FIX)
-- ==============================================================================

-- 1. START ARCADE SESSION
DROP FUNCTION IF EXISTS start_arcade_session(TEXT, TEXT);
CREATE OR REPLACE FUNCTION start_arcade_session(p_player_id TEXT, p_game_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_player_id)); END IF;
  IF v_pid IS NULL OR v_pid = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Player ID required'); END IF;

  INSERT INTO arcade_sessions (player_id, game_name, status, started_at)
  VALUES (v_pid, p_game_name, 'active', v_now)
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object('success', true, 'session_id', v_session_id, 'started_at', v_now);
END;
$$;
GRANT EXECUTE ON FUNCTION start_arcade_session(TEXT, TEXT) TO anon, authenticated, service_role;

-- 2. END ARCADE SESSION
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT, p_session_id TEXT, p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0, p_bonus_tokens INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items INTEGER := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens INTEGER := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  v_user RECORD;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_global_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_raw_pgt NUMERIC := 0;
  v_final_pgt NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_game_name TEXT;
  v_is_new_high BOOLEAN := false;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_player_id)); END IF;
  BEGIN v_session_uuid := p_session_id::UUID; EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID'); END;

  SELECT * INTO v_session FROM arcade_sessions WHERE id = v_session_uuid AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session'); END IF;

  v_game_name := v_session.game_name;
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

  IF v_duration_seconds < 2 AND v_clamped_score > 50 THEN
    UPDATE arcade_sessions SET status = 'rejected', completed_at = v_now, duration_seconds = v_duration_seconds WHERE id = v_session_uuid;
    RETURN jsonb_build_object('success', false, 'error', 'Session rejected');
  END IF;

  IF v_game_name = 'Cyber Invaders' THEN v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_name = 'AstroDodge' THEN v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 500);
  ELSIF v_game_name = 'Cyber Drift' THEN v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSE v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 450 + 500);
  END IF;

  SELECT * INTO v_user FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN v_vip_mult := 2.0; END IF;
  IF v_user.is_ambassador IS TRUE THEN v_amb_mult := 2.0; END IF;
  SELECT COALESCE(earn_multiplier, 1.0) INTO v_global_mult FROM global_settings WHERE id = 1;
  v_total_multiplier := v_vip_mult * v_amb_mult;

  IF v_game_name = 'Cyber Invaders' THEN v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_mult;
  ELSIF v_game_name = 'AstroDodge' THEN v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_mult;
  ELSIF v_game_name = 'Cyber Drift' THEN v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_mult;
  ELSE v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_mult;
  END IF;

  v_final_pgt := ROUND(LEAST((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0), (v_duration_seconds / 60.0) * 50.0 * v_total_multiplier + 50.0)::numeric, 2);

  -- Update High Scores keyed by player_id
  IF v_game_name = 'Cyber Invaders' AND v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_name = 'AstroDodge' AND v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET game_highscore = v_clamped_score, alltime_highscore = GREATEST(COALESCE(alltime_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_name = 'Cyber Drift' AND v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF (v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher') AND v_clamped_score > COALESCE(v_user.catcher_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET catcher_highscore = v_clamped_score, stacker_highscore = v_clamped_score, alltime_catcher_highscore = GREATEST(COALESCE(alltime_catcher_highscore, 0), v_clamped_score), alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  END IF;

  -- Credit balance
  IF v_final_pgt > 0 THEN
    UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt, total_earned = COALESCE(total_earned, 0) + v_final_pgt, updated_at = v_now WHERE LOWER(player_id) = LOWER(v_user.player_id) RETURNING balance_pgt INTO v_new_balance;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  UPDATE arcade_sessions SET status = 'completed', completed_at = v_now, score = v_clamped_score, payout_pgt = v_final_pgt, duration_seconds = v_duration_seconds WHERE id = v_session_uuid;

  RETURN jsonb_build_object('success', true, 'payout', v_final_pgt, 'new_balance', v_new_balance, 'duration_seconds', v_duration_seconds, 'score', v_clamped_score, 'is_new_high', v_is_new_high);
END;
$$;
GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 3. SUBMIT ARCADE HIGHSCORES
DROP FUNCTION IF EXISTS submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_wallet TEXT, p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL, p_drift_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;
  UPDATE users
  SET game_highscore = GREATEST(COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
      invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
      drift_highscore = GREATEST(COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
      catcher_highscore = GREATEST(COALESCE(catcher_highscore, 0), COALESCE(p_catcher_highscore, 0)),
      stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), COALESCE(p_catcher_highscore, 0)),
      alltime_highscore = GREATEST(COALESCE(alltime_highscore, 0), COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
      alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
      alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
      alltime_catcher_highscore = GREATEST(COALESCE(alltime_catcher_highscore, 0), COALESCE(catcher_highscore, 0), COALESCE(p_catcher_highscore, 0)),
      alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0), COALESCE(p_catcher_highscore, 0)),
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 4. SAFE credit_arcade_payout FALLBACK (Max 100 PGT)
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION credit_arcade_payout(p_player_id TEXT, p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_capped NUMERIC := LEAST(GREATEST(0, COALESCE(p_amount, 0)), 100.0);
  v_new_balance NUMERIC;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_player_id)); END IF;
  IF v_capped <= 0 THEN RETURN jsonb_build_object('success', true, 'credited', 0); END IF;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_capped,
      total_earned = COALESCE(total_earned, 0) + v_capped,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object('success', true, 'credited', v_capped, 'new_balance', v_new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION credit_arcade_payout(p_player_id TEXT, p_amount NUMERIC, p_wallet TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN credit_arcade_payout(COALESCE(p_player_id, p_wallet), p_amount);
END;
$$;
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
