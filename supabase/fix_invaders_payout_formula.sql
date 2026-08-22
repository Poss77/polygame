-- ====================================================================
-- POLYGAME - FIX PGRST203 OVERLOAD & CALIBRATE ARCADE PAYOUTS
-- Drops all old overloaded signatures of end_arcade_session to resolve
-- PostgREST PGRST203 error and enforces the single canonical function.
-- ====================================================================

-- 1. DROP ALL OVERLOADED PREVIOUS SIGNATURES
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(UUID, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT);

-- 2. CREATE THE SINGLE CANONICAL FUNCTION (NO OVERLOADS)
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
  v_clamped_items INTEGER := GREATEST(0, LEAST(500, COALESCE(p_bonus_items, 0)));
  v_clamped_tokens INTEGER := GREATEST(0, LEAST(10, COALESCE(p_bonus_tokens, 0)));
  v_clamped_nft_mult NUMERIC := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));
  v_user RECORD;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_raw_pgt NUMERIC := 0.0;
  v_final_pgt NUMERIC := 0.0;
  v_new_balance NUMERIC := 0.0;
  v_game_name TEXT;
  v_is_new_high BOOLEAN := false;
  v_max_daily_plays INTEGER := 25;
  v_daily_completed_count INTEGER := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_player_id)); END IF;
  BEGIN 
    v_session_uuid := p_session_id::UUID; 
  EXCEPTION WHEN OTHERS THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID'); 
  END;

  -- 1. Lock Active Session
  SELECT * INTO v_session FROM arcade_sessions WHERE id = v_session_uuid AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session'); END IF;

  v_game_name := v_session.game_name;
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

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

  -- 6. Credit Balance Atomically
  IF v_final_pgt > 0 THEN
    UPDATE users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt,
        total_earned = COALESCE(total_earned, 0) + v_final_pgt,
        updated_at = v_now
    WHERE LOWER(player_id) = LOWER(v_user.player_id)
    RETURNING balance_pgt INTO v_new_balance;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  -- 7. Complete Session Record
  UPDATE arcade_sessions
  SET status = 'completed',
      completed_at = v_now,
      score = v_clamped_score,
      payout_pgt = v_final_pgt,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      duration_seconds = v_duration_seconds
  WHERE id = v_session_uuid;

  RETURN jsonb_build_object(
    'success', true,
    'payout', v_final_pgt,
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance,
    'duration_seconds', v_duration_seconds,
    'score', v_clamped_score,
    'is_new_high', v_is_new_high,
    'is_daily_limit_reached', (v_daily_completed_count >= v_max_daily_plays),
    'daily_plays_used', v_daily_completed_count + 1,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;

-- 3. Grant Permissions to canonical function
GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;
