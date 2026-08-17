-- ==============================================================================
-- POLYGAME ARCADE REWARD & SESSION RPCS FIX
-- Fixes:
-- 1. Replaces non-existent "id" and "wallet_address" column references with "player_id"
-- 2. Restores end_arcade_session, start_arcade_session, and submit_arcade_highscore
-- 3. Re-enables safe credit_arcade_payout (hard-capped to 100 PGT max)
-- ==============================================================================

-- 1. START ARCADE SESSION
DROP FUNCTION IF EXISTS start_arcade_session(TEXT, TEXT);
CREATE OR REPLACE FUNCTION start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_user RECORD;
  v_settings JSONB;
  v_game_key TEXT;
  v_vip_only BOOLEAN := false;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player identity required');
  END IF;

  -- Determine Game Key
  IF LOWER(p_game_name) LIKE '%invader%' THEN v_game_key := 'invaders';
  ELSIF LOWER(p_game_name) LIKE '%drift%' THEN v_game_key := 'drift';
  ELSIF LOWER(p_game_name) LIKE '%catcher%' OR LOWER(p_game_name) LIKE '%stacker%' THEN 
    v_game_key := 'stacker';
  ELSE v_game_key := 'astrododge';
  END IF;

  -- Fetch Game Settings & Check VIP-Only Access
  SELECT game_payout_settings INTO v_settings FROM global_settings WHERE id = 1;
  IF v_settings IS NOT NULL AND v_settings ? v_game_key THEN
    v_vip_only := COALESCE((v_settings->v_game_key->>'vip_only')::boolean, false);
  ELSIF v_settings IS NOT NULL AND v_settings ? 'stacker' THEN
    v_vip_only := COALESCE((v_settings->'stacker'->>'vip_only')::boolean, false);
  END IF;

  IF v_vip_only THEN
    SELECT * INTO v_user FROM users 
    WHERE LOWER(player_id) = LOWER(v_pid) 
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

    IF NOT FOUND OR (
      (v_user.vip_until IS NULL OR v_user.vip_until <= v_now) 
      AND v_user.is_ambassador IS NOT TRUE 
      AND v_user.is_admin IS NOT TRUE
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'VIP access required to play this game');
    END IF;
  END IF;

  -- Create New Active Session
  INSERT INTO arcade_sessions (
    player_id,
    game_name,
    status,
    started_at
  ) VALUES (
    v_pid,
    p_game_name,
    'active',
    v_now
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'started_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION start_arcade_session(TEXT, TEXT) TO anon, authenticated, service_role;

-- 2. END ARCADE SESSION
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0
) RETURNS JSONB
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
  
  -- User and Multiplier Variables
  v_user RECORD;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_global_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_settings JSONB;
  v_game_key TEXT;
  v_harvest_enabled BOOLEAN := true;
  
  -- Payout calculation variables
  v_raw_pgt NUMERIC := 0;
  v_token_pgt NUMERIC := 0;
  v_final_pgt NUMERIC := 0;
  v_max_allowed_pgt NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_game_name TEXT;
  v_is_new_high BOOLEAN := false;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  -- 1. Find and Lock Active Session
  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid 
    AND (LOWER(player_id) = LOWER(v_pid) OR LOWER(player_id) = LOWER(p_player_id))
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  v_game_name := v_session.game_name;
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

  -- Determine Game Key for settings check
  IF LOWER(v_game_name) LIKE '%invader%' THEN v_game_key := 'invaders';
  ELSIF LOWER(v_game_name) LIKE '%drift%' THEN v_game_key := 'drift';
  ELSIF LOWER(v_game_name) LIKE '%catcher%' OR LOWER(v_game_name) LIKE '%stacker%' THEN v_game_key := 'stacker';
  ELSE v_game_key := 'astrododge';
  END IF;

  -- 2. Anti-Cheat Check: Reject impossible instant claims (< 2 seconds with score > 50)
  IF v_duration_seconds < 2 AND v_clamped_score > 50 THEN
    UPDATE arcade_sessions 
    SET status = 'rejected', completed_at = v_now, duration_seconds = v_duration_seconds 
    WHERE id = v_session_uuid;
    
    RETURN jsonb_build_object('success', false, 'error', 'Session rejected: impossible speed');
  END IF;

  -- 3. Anti-Cheat Check: Maximum Score Velocity Clamping (points per second - generous headroom)
  IF v_game_name = 'Cyber Invaders' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_name = 'AstroDodge' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 500);
  ELSIF v_game_name = 'Cyber Drift' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 450 + 500);
  END IF;

  -- 4. Anti-Cheat Check: In-Game Collectibles & +5 PGT Bonus Tokens Clamping
  v_clamped_items := LEAST(v_clamped_items, v_duration_seconds * 5 + 10);
  v_clamped_tokens := LEAST(v_clamped_tokens, FLOOR(v_duration_seconds / 10) + 2);

  -- 5. Fetch User Profile and Verified Multipliers
  SELECT * INTO v_user
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player account not found');
  END IF;

  -- VIP Multiplier (2.0x)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  -- Ambassador Multiplier (2.0x)
  IF v_user.is_ambassador IS TRUE THEN
    v_amb_mult := 2.0;
  END IF;

  -- Global Setting Multiplier & Harvest Check
  SELECT COALESCE(earn_multiplier, 1.0), game_payout_settings 
  INTO v_global_mult, v_settings 
  FROM global_settings 
  WHERE id = 1;

  IF v_global_mult IS NULL OR v_global_mult <= 0 THEN 
    v_global_mult := 1.0; 
  END IF;

  IF v_settings IS NOT NULL AND v_settings ? v_game_key THEN
    v_harvest_enabled := COALESCE((v_settings->v_game_key->>'harvest_enabled')::boolean, true);
  END IF;

  -- Calculate combined multiplier
  v_total_multiplier := v_vip_mult * v_amb_mult;

  -- 6. Server-Side Reward Calculation based on Game Formula
  IF v_game_name = 'Cyber Invaders' THEN
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_mult;
  ELSIF v_game_name = 'AstroDodge' THEN
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_mult;
  ELSIF v_game_name = 'Cyber Drift' THEN
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_mult;
  ELSIF v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher' THEN
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_mult;
  ELSE
    v_raw_pgt := (v_clamped_score / 2500.0) * v_global_mult;
  END IF;

  v_token_pgt := v_clamped_tokens * 5.0;
  v_final_pgt := (v_raw_pgt * v_total_multiplier) + v_token_pgt;

  -- If harvest is disabled by Admin, set PGT payout to 0 while preserving high score updates
  IF NOT v_harvest_enabled THEN
    v_final_pgt := 0;
  ELSE
    -- Anti-Cheat Generous Safety Ceiling: Max 50 PGT/min + 50 buffer
    v_max_allowed_pgt := GREATEST(1.0, (v_duration_seconds / 60.0) * 50.0 * v_total_multiplier + 50.0);
    v_final_pgt := ROUND(LEAST(v_final_pgt, v_max_allowed_pgt)::numeric, 2);
  END IF;

  -- 7. High Score Updates (Keyed strictly by player_id)
  IF v_game_name = 'Cyber Invaders' THEN
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        invaders_highscore = v_clamped_score,
        alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score)
      WHERE LOWER(player_id) = LOWER(v_user.player_id);
    END IF;
  ELSIF v_game_name = 'AstroDodge' THEN
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        game_highscore = v_clamped_score,
        alltime_highscore = GREATEST(COALESCE(alltime_highscore, 0), v_clamped_score)
      WHERE LOWER(player_id) = LOWER(v_user.player_id);
    END IF;
  ELSIF v_game_name = 'Cyber Drift' THEN
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        drift_highscore = v_clamped_score,
        alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score)
      WHERE LOWER(player_id) = LOWER(v_user.player_id);
    END IF;
  ELSIF v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher' THEN
    IF v_clamped_score > COALESCE(v_user.catcher_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        catcher_highscore = v_clamped_score,
        stacker_highscore = v_clamped_score,
        alltime_catcher_highscore = GREATEST(COALESCE(alltime_catcher_highscore, 0), v_clamped_score),
        alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score)
      WHERE LOWER(player_id) = LOWER(v_user.player_id);
    END IF;
  END IF;

  -- 8. Atomically Credit Balance & Increment Total Earned (Keyed by player_id)
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

  -- 9. Update Global Game Metrics Atomically
  INSERT INTO game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
  VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
  ON CONFLICT (game_name) DO UPDATE
  SET total_payout = COALESCE(game_metrics.total_payout, 0) + v_final_pgt,
      total_playtime_seconds = COALESCE(game_metrics.total_playtime_seconds, 0) + v_duration_seconds;

  -- 10. Mark Session as Completed
  UPDATE arcade_sessions
  SET status = 'completed',
      completed_at = v_now,
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt,
      duration_seconds = v_duration_seconds
  WHERE id = v_session_uuid;

  RETURN jsonb_build_object(
    'success', true,
    'payout', v_final_pgt,
    'new_balance', v_new_balance,
    'duration_seconds', v_duration_seconds,
    'score', v_clamped_score,
    'is_new_high', v_is_new_high
  );
END;
$$;

GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 3. SUBMIT ARCADE HIGHSCORES
DROP FUNCTION IF EXISTS submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_wallet TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_wallet));
  END IF;

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
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 4. RE-ENABLE SAFE credit_arcade_payout (Overloaded for 2 and 3 parameter calls)
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_capped_amount NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF p_player_id IS NULL OR p_player_id = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player ID required');
  END IF;

  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  -- HARD SAFETY CEILING: Max 100 PGT per arcade call
  v_capped_amount := LEAST(GREATEST(0, COALESCE(p_amount, 0)), 100.0);

  IF v_capped_amount <= 0 THEN
    RETURN jsonb_build_object('success', true, 'credited', 0, 'message', 'Zero amount credited');
  END IF;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_capped_amount,
      total_earned = COALESCE(total_earned, 0) + v_capped_amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player record not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'credited', v_capped_amount, 'new_balance', v_new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC,
  p_wallet TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN credit_arcade_payout(COALESCE(p_player_id, p_wallet), p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
